/**
 * localTool 出站图片回读 —— 把请求体里的本机 /files/ 图片 URL 内联成 data: base64（E 方案，docs/72）。
 *
 * 背景：前端会话/内存态只存 /files/ 相对路径（KB 级，不撑爆会话快照、不误触发 volumePolicy 降级）。
 *       AI 聊天 / 生图等出站请求（外部 provider / LLM）都读不到用户本机 127.0.0.1:18080
 *       的 /files/ 磁盘文件，必须由 localTool（架构红线：唯一出站口）在转发前读 uploads/ → 压缩≤1920
 *       → base64 内联。与入库方向（base64Externalize：base64 → /files/）形成「存俩名」闭环（docs/41 §2）。
 *
 * 幂等（刻意决策，勿改成"连 data: 也压缩"）：已是 data: 的 base64 原样透传、不二次压缩——
 *   ① 存量会话里历史 base64 不应被意外重编码（行为稳定）；
 *   ② data: 可能是 video 型（视频生成参考图），Jimp 解不了，若压缩需按图像/视频分流，复杂度上升；
 *   ③ blob:/data: 的 ≤1920 压缩已由前端在转 base64 时完成（imageUrl.js normalizeImageUrlForSend），
 *      localTool 只负责 /files/ 的压缩——两端压缩口径对齐（MAX_SEND_DIM=1920 契约双写，勿单边漂移）。
 *   http(s) 公网 URL 原样透传（AI/网关可直接访问）。
 * 失败可见：读文件/压缩失败 → console.error 记录 + 保留原 URL（由上游显性失败，绝不静默丢参考图，
 *          否则图生图会静默退化成文生图且无报错 —— 见 docs/72 D-1 教训）。
 * 压缩：复用 fileStore.resizeImage 的缩放语义（最长边 ≤ MAX_SEND_DIM、小图不放大），内存内
 *       getBufferAsync 输出，不新建任何磁盘文件（不引入孤儿文件 GC 负担）。
 * 消费方：agentChat.ts（LLM 聊天消息）/ system.ts /api/proxy（生图/视频/聊天请求体），禁止各写一份。
 */
import Jimp from 'jimp';
import fs from 'node:fs';
import path from 'node:path';
import { getUploadDir } from '../db/database.js';

/** 发送最长边上限（与前端 imageUrl.js MAX_SEND_DIM=1920 契约对齐，出站压缩防超大图触碰 API 上限） */
const MAX_SEND_DIM = 1920;

/** 绝对自指 localTool /files/ URL（127.0.0.1 / localhost / ::1 + 任意端口 + /files/ 路径） */
const SELF_FILE_URL_RE = /^https?:\/\/(?:127\.0\.0\.1|localhost|::1)(?::\d+)?(\/files\/.*)$/i;

/** 扩展名 → Jimp MIME（仅 Jimp 0.22 可编码格式；webp 无编码器 → 统一 png，同 files.ts 缩略图契约） */
function mimeFromExt(ext: string): string {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return Jimp.MIME_JPEG;
    case 'gif':
      return Jimp.MIME_GIF;
    case 'bmp':
      return Jimp.MIME_BMP;
    case 'tiff':
      return Jimp.MIME_TIFF;
    default:
      return Jimp.MIME_PNG; // png / 未知格式统一 png
  }
}

/** 相对 /files/ 或绝对自指 /files/ URL → uploads 磁盘绝对路径；非本机可读图片 URL 返回 null */
function resolveLocalPath(u: string): string | null {
  let rel: string | null = null;
  if (u.startsWith('/files/')) {
    rel = u.slice('/files/'.length);
  } else {
    const m = SELF_FILE_URL_RE.exec(u);
    if (m) rel = m[1].replace(/^\/files\//, '');
  }
  if (!rel) return null;
  // URL 编码还原（中文/空格文件名在 /files/ URL 里以 %xx 形态存在，对齐 base64Externalize.extractFilesUrls 惯例）
  try {
    rel = decodeURIComponent(rel);
  } catch {
    /* 非法编码保留原样，读不到时走失败可见 */
  }
  return path.join(getUploadDir(), rel);
}

/** 读 uploads 文件 → 压缩≤1920 保持原格式 → data: base64；失败返回 null（调用方保留原 URL） */
async function fileToInlineBase64(filePath: string): Promise<string | null> {
  try {
    if (!fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
    const img = await Jimp.read(filePath);
    const scale = Math.min(1, MAX_SEND_DIM / Math.max(img.getWidth(), img.getHeight()));
    if (scale < 1) {
      img.resize(
        Math.max(1, Math.round(img.getWidth() * scale)),
        Math.max(1, Math.round(img.getHeight() * scale)),
      );
    }
    const mime = mimeFromExt(ext);
    const buf = await img.getBufferAsync(mime);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * 深遍历任意 JSON 值，把所有「本机 /files/ 图片 URL」（相对 + 绝对自指）替换为 data: base64。
 *  - data: 原样透传（幂等）；http(s) 公网原样；其余类型不变。
 *  - 同一次调用内按 filePath 缓存（同一参考图被多次引用只转换一次，如 attachment_indices 共享/套图复用）。
 *  - 数组/对象字段并行转换（Promise.all），多参考图不串行累积等待。
 *  - 转换失败：console.error + 保留原 URL（失败可见，不静默丢弃参考图）。
 * @param value 上游请求体（messages 数组 / genBody 对象等），仅转换值，不改写原引用
 * @returns 转换后的新值（原对象不变）
 */
export async function resolveLocalImages(value: unknown): Promise<unknown> {
  const cache = new Map<string, Promise<string | null>>();

  async function walk(v: unknown): Promise<unknown> {
    if (typeof v === 'string') {
      if (v.startsWith('data:')) return v; // 已内联 base64，幂等透传
      const filePath = resolveLocalPath(v);
      if (!filePath) return v; // 非本机可读图片（公网/其它），原样透传
      let p = cache.get(filePath);
      if (!p) {
        p = fileToInlineBase64(filePath);
        cache.set(filePath, p);
      }
      const inlined = await p;
      if (inlined) {
        console.log(
          `[resolve:inline-img] ${v.slice(0, 80)} -> data:image (${(inlined.length / 1024).toFixed(0)}KB)`,
        );
        return inlined;
      }
      console.error(
        `[resolve:inline-img] 读文件失败，保留原 URL（上游将显性失败）: ${v.slice(0, 120)}`,
      );
      return v;
    }
    if (Array.isArray(v)) {
      return Promise.all(v.map((item) => walk(item)));
    }
    if (v && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      const resolved = await Promise.all(
        entries.map(([k, val]) => walk(val).then((nv) => [k, nv] as const)),
      );
      return Object.fromEntries(resolved);
    }
    return v;
  }

  return walk(value);
}

/* ════════════════════════════════════════════════════════════════
 * 出站形态裁决（按 provider 决定「本机 /files/ 图转成什么」）
 * ════════════════════════════════════════════════════════════════
 * 背景（单出口纪律的延伸）：外部上游都读不到 localTool 本机 /files/，所以必须由
 * localTool 唯一出站口把本机图变成「上游可访问」形态。但具体形态因平台而异：
 *   - base64：多数 OpenAI 兼容平台只认内联 base64 → /files/ 压成 data:base64（现状）。
 *   - cdn   ：lovart 直连 adapter 在本机进程内，能自己下载回环 URL 再传 CDN → 后端
 *             不必预压 base64，直接把回环可下载 URL 交给 adapter，省掉 encode→decode 两遍。
 * 形态决策只收敛在本文件（refFormatOf + resolveImagesForEgress），数据流单向、可追溯，
 * 不在各处手写「要不要 base64」。
 */

/** provider → 出站参考图形态。出厂内置：只有 lovart（原生直连）走 cdn，其余走 base64。 */
export type RefFormat = 'base64' | 'cdn';
export function refFormatOf(providerId: string): RefFormat {
  return providerId === 'lovart' ? 'cdn' : 'base64';
}

/** 本机 /files/（相对或绝对自指）→ 127.0.0.1 回环可下载绝对 URL；非本机可读 URL 返回原值。 */
export function toLoopbackUrl(u: string): string {
  const filePath = resolveLocalPath(u);
  if (!filePath) return u; // 公网 / data / 其它：不可能是本机，原样
  // 绝对自指 http(s) 已是完整 URL → 原样返回（保留原端口/原协议细节）。
  if (/^https?:\/\/(?:127\.0\.0\.1|localhost|::1)(?::\d+)?\/files\//i.test(u)) return u;
  // 相对 /files/ 或可还原为 /files/ 的绝对 URL → 补全为回环 URL。
  const rel = u.replace(/^https?:\/\/[^/]+\/files\//i, '/files/');
  return `http://127.0.0.1:${localPortOf()}${rel}`;
}

/** 回环端口：复用数据服务端口（与前端 toAbsoluteFileUrl 口径一致，读环境兜底 18080）。 */
function localPortOf(): number {
  const p = Number(process.env.LOCALTOOL_PORT || process.env.PORT || 18080);
  return Number.isFinite(p) && p > 0 ? p : 18080;
}

/**
 * 按 provider 出站形态把任意请求体里本机 /files/ 图归一。
 *   - refFormat='base64'：走既有 resolveLocalImages（压 base64；data:/公网幂等透传）——现状不变。
 *   - refFormat='cdn'   ：把本机 /files/ 补成回环可下载 URL（不 base64），其余原样；交由
 *                         lovart adapter 自取（resolveLovartAttachments 下载回环→传 CDN）。
 * @returns 转换后的新值（原对象不变）。
 */
export async function resolveImagesForEgress(
  value: unknown,
  refFormat: RefFormat,
): Promise<unknown> {
  if (refFormat === 'base64') return resolveLocalImages(value);
  // cdn：遍历字符串，仅把本机 /files/ 替换为回环 URL；data:/公网/其它原样。
  async function walkCdn(v: unknown): Promise<unknown> {
    if (typeof v === 'string') {
      if (v.startsWith('data:')) return v;
      const url = toLoopbackUrl(v);
      if (url !== v) {
        console.log(`[resolve:cdn-url] ${v.slice(0, 80)} -> ${url.slice(0, 120)}`);
        return url;
      }
      return v;
    }
    if (Array.isArray(v)) return Promise.all(v.map((item) => walkCdn(item)));
    if (v && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>);
      const resolved = await Promise.all(
        entries.map(([k, val]) => walkCdn(val).then((nv) => [k, nv] as const)),
      );
      return Object.fromEntries(resolved);
    }
    return v;
  }
  return walkCdn(value);
}
