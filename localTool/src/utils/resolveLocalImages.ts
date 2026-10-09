/**
 * localTool 出站媒体回读 —— 把请求体里的本机 /files/ 媒体 URL 内联成 data: base64（E 方案，docs/72）。
 *
 * 背景：前端会话/内存态只存 /files/ 相对路径（KB 级，不撑爆会话快照、不误触发 volumePolicy 降级）。
 *       AI 聊天 / 生图等出站请求（外部 provider / LLM）都读不到用户本机 127.0.0.1:18080
 *       的 /files/ 磁盘文件，必须由 localTool（架构红线：唯一出站口）在转发前回读 uploads/ →
 *       内联 data:。与入库方向（base64Externalize：base64 → /files/）形成「存俩名」闭环（docs/41 §2）。
 *
 * 形态（2026-10-09 · 统一 base64，见 fileToInlineBase64）：
 *   - **图片** → Jimp 压缩 ≤1920 后内联；
 *   - **视频 / 音频** → 直读原始字节内联（不压缩）。
 *   ⚠️ 曾有过第二条路「lovart 走回环 URL 交 adapter 自取」（省一趟 encode/decode），已于
 *      2026-10-09 退役（TD-08-46）：它是一次**请求自己**的 HTTP 回环、无超时、未压缩，是段①
 *      长尾根因。现在**本机媒体一律走本文件这一条**，禁再建形态分流（理由见文件尾）。
 *
 * 幂等（刻意决策，勿改成"连 data: 也压缩"）：已是 data: 的 base64 原样透传、不二次压缩——
 *   ① 存量会话里历史 base64 不应被意外重编码（行为稳定）；
 *   ② data: 可能是 video 型（视频生成参考图），Jimp 解不了，若压缩需按图像/视频分流，复杂度上升；
 *   ③ blob:/data: 的 ≤1920 压缩已由前端在转 base64 时完成（assetUrl.ts normalizeAssetUrlForSend），
 *      localTool 只负责 /files/ 的压缩——两端压缩口径对齐（MAX_SEND_DIM=1920 契约双写，勿单边漂移）。
 *   http(s) 公网 URL 原样透传（AI/网关可直接访问）。
 * 失败可见：读文件/压缩失败 → console.error 记录 + 保留原 URL（由上游显性失败，绝不静默丢参考图，
 *          否则图生图会静默退化成文生图且无报错 —— 见 docs/72 D-1 教训）。
 * 压缩：复用 fileStore.resizeImage 的缩放语义（最长边 ≤ MAX_SEND_DIM、小图不放大），内存内
 *       getBufferAsync 输出，不新建任何磁盘文件（不引入孤儿文件 GC 负担）。
 * 消费方：generateEngine.ts（relayGenerate / relayChatStream）· relay-poll.ts（runDirectSubmit / 非 direct 提交），
 *         禁止各写一份（2026-09-11 更新：旧 agentChat.ts 与 system.ts /api/proxy 已随 relay 收口退役，消费方改为生成引擎）。
 */
import Jimp from 'jimp';
import fs from 'node:fs';
import path from 'node:path';
import { getUploadDir } from '../db/database.js';
// 「Jimp 可编码格式 → MIME」唯一真源（2026-09-16 收口 · TD-02-41）。
// 原为本文件内 `mimeFromExt` switch —— 与 files.ts 的白名单、前端 assetUrl.ts 的 Set 同源三份，
// 已漂移过一次（见 fileStore.JIMP_MIME_BY_EXT 注释）。此处改为委托，不再自持映射。
// 【TD-08-23 修复 2026-09-16】选 MIME 的入口由 `jimpMimeForExt(ext)` 改为 `jimpMimeForFile(ext, img)` ——
// 原先 `path.extname(...) || 'png'` 把**无扩展名文件静默当 png**，真 JPEG 被重编码为 PNG；
// 现由该原语在扩展名缺失时读 `img.getMIME()`（字节真相），不再猜。
import { jimpMimeForFile } from './fileStore.js';
import { extToKind, extToMime } from './mime.js';
// TD-08-16：URL→磁盘相对路径统一走 helpers 唯一原语（URL 解析剥 ?# + decode 一次）。
import { relativePathFromFilesUrl } from './helpers.js';

/** 发送最长边上限（与前端 assetUrl.ts MAX_SEND_DIM=1920 契约对齐，出站压缩防超大图触碰 API 上限） */
const MAX_SEND_DIM = 1920;

/** 相对 /files/ 或绝对自指 /files/ URL → uploads 磁盘绝对路径；非本机可读图片 URL 返回 null */
function resolveLocalPath(u: string): string | null {
  // 【TD-08-16 修复 2026-09-16】原实现用 `SELF_FILE_URL_RE` 正则 `(\/files\/.*)$` 捕获，
  // **不剥 `?`/`#`** —— `/files/a.png?token=1` 会把查询串当文件名，读不到磁盘 → 静默失败。
  // 统一走 helpers.relativePathFromFilesUrl（URL 解析剥 ?# + decode 一次，与 resources 同口径）。
  const rel = relativePathFromFilesUrl(u);
  if (!rel) return null;
  return path.join(getUploadDir(), rel);
}

/**
 * 读 uploads 文件 → data: base64（调用方保留原 URL 时返回 null）。**本机媒体统一回读口**：
 *   ① **图片** → Jimp 压缩 ≤1920 后内联（含无扩展名真图，靠字节真相；TD-08-23）；
 *   ② **视频 / 音频** → 直读原始字节内联，**不压缩**（Jimp 读不了，也无缩放语义）。
 *
 * 【2026-10-09 · 视频/音频为什么也走 base64】
 *   原实现只服务图片：视频/音频 Jimp 必抛 ⇒ 返回 null ⇒ 保留原 URL ⇒ 上游读不到本机地址。
 *   当时靠 lovart 的「回环 URL」妥协路径兜住（出站补 `http://127.0.0.1:18080/files/…` 交
 *   adapter 自取自传 CDN）——但那条路是**一次 HTTP 回环请求自己**（无超时、未压缩），
 *   是段①长尾的根因（TD-08-46）。现按用户裁定「所有网站都直接内联 base64」**拆掉该妥协**，
 *   由本函数统一吐出 data: URL（图片压缩 / 视频音频原样），能力不减、复杂度净减。
 */
async function fileToInlineBase64(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) return null;
  // ① 图片优先：Jimp 读得出 ⇒ 压缩 ≤1920（字节真相判型，不靠扩展名猜）。
  try {
    // 【TD-08-23 修复 2026-09-16】不再 `extname || 'png'` 猜（无扩展名真 JPEG 会被错标 png）——
    // 先 Jimp.read 出字节真相，再由 jimpMimeForFile 决定：扩展名缺省时取 img.getMIME()。
    const img = await Jimp.read(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const scale = Math.min(1, MAX_SEND_DIM / Math.max(img.getWidth(), img.getHeight()));
    if (scale < 1) {
      img.resize(
        Math.max(1, Math.round(img.getWidth() * scale)),
        Math.max(1, Math.round(img.getHeight() * scale)),
      );
    }
    const mime = jimpMimeForFile(ext, img);
    const buf = await img.getBufferAsync(mime);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    // Jimp 读不了 ⇒ 非图片，落到 ② 判媒体并直读。
  }
  // ② 非图片媒体（视频/音频）：直读原始字节内联，不压缩（与图片同一出口，只是不经 Jimp）。
  const ext = path.extname(filePath).toLowerCase();
  const kind = extToKind(ext);
  if (kind === 'video' || kind === 'audio') {
    try {
      const bytes = await fs.promises.readFile(filePath);
      return `data:${extToMime(ext)};base64,${bytes.toString('base64')}`;
    } catch {
      return null;
    }
  }
  // 文本 / 未登记扩展 / 无扩展名且非图：保留原 URL（失败可见，不静默转错形态）。
  return null;
}

/**
 * 深遍历任意 JSON 值，把所有「本机 /files/ 媒体 URL」（相对 + 绝对自指）替换为 data: base64。
 *  - data: 原样透传（幂等）；http(s) 公网原样；其余类型不变。
 *  - 同一次调用内按 filePath 缓存（同一参考图被多次引用只转换一次，如 attachment_indices 共享/套图复用）。
 *  - 数组/对象字段并行转换（Promise.all），多参考图不串行累积等待。
 *  - 转换失败：console.error + 保留原 URL（失败可见，不静默丢弃参考图）。
 * @param value 上游请求体（messages 数组 / genBody 对象等），仅转换值，不改写原引用
 * @returns 转换后的新值（原对象不变）
 */
/**
 * 深遍历任意 JSON 值，对**字符串叶子**应用 `leaf` 变换（数组/对象结构原样重建，不改写原引用）。
 *
 * 【TD-08-32 · 2026-09-17 收口】本文件原有**两份逐行相同**的深遍历（`walk` / `walkCdn`），
 * 只有"字符串叶子怎么变"不同 ⇒ 同一件事写成两份（M3 SSOT 第二份）⇒ 收口为**一个遍历**。
 * 2026-10-09（TD-08-46）cdn 形态退役后，叶子只剩 `inlineLeaf` 一个，遍历与叶子都只有一份。
 */
async function mapLeaves(value: unknown, leaf: (s: string) => Promise<string>): Promise<unknown> {
  if (typeof value === 'string') return leaf(value);
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => mapLeaves(item, leaf)));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const resolved = await Promise.all(
      entries.map(([k, val]) => mapLeaves(val, leaf).then((nv) => [k, nv] as const)),
    );
    return Object.fromEntries(resolved);
  }
  return value;
}

export async function resolveLocalImages(value: unknown): Promise<unknown> {
  const cache = new Map<string, Promise<string | null>>();

  /** 叶子变换：本机 /files/ 媒体 → data:base64（`data:` 幂等透传；公网原样；读失败留痕并保留原 URL）。 */
  const inlineLeaf = async (v: string): Promise<string> => {
    if (v.startsWith('data:')) return v; // 已内联 base64，幂等透传
    const filePath = resolveLocalPath(v);
    if (!filePath) return v; // 非本机可读（公网/其它），原样透传
    let p = cache.get(filePath);
    if (!p) {
      p = fileToInlineBase64(filePath);
      cache.set(filePath, p);
    }
    const inlined = await p;
    if (inlined) {
      console.log(
        `[resolve:inline-img] ${v.slice(0, 80)} -> data: (${(inlined.length / 1024).toFixed(0)}KB)`,
      );
      return inlined;
    }
    // 读失败 / 非媒体形态 ⇒ 保留原 URL（失败可见，上游将显性失败）。
    // ⚠️ 视频/音频**不再落这里**（已由 fileToInlineBase64 直读内联）；落到这里的是
    //   文本 / 未登记扩展 / 无扩展名非图 —— 它们本就不该当参考素材发。
    //   （此条 error 是**真警**，不许静音，否则参考素材就静默丢了 —— docs/72 D-1。）
    console.error(
      `[resolve:inline-img] 读文件失败，保留原 URL（上游将显性失败）: ${v.slice(0, 120)}`,
    );
    return v;
  };

  return mapLeaves(value, inlineLeaf);
}

/* ════════════════════════════════════════════════════════════════
 * 【2026-10-09 · cdn 妥协已退役（TD-08-46）】原「出站形态裁决」段（`RefFormat` /
 * `refFormatOf` / `toLoopbackUrl` / `localPortOf` / `resolveImagesForEgress`）**整段删除**：
 * lovart 不再走「本机图 → 回环 URL → adapter 下载回环 → 传 CDN」这条路（它是一次**请求自己**
 * 的 HTTP 回环，无超时、未压缩 ⇒ 段①长尾根因）。本机媒体现在一律由 `resolveLocalImages`
 * 内联 base64（图片压缩 ≤1920 / 视频音频直读原样，见 `fileToInlineBase64`）。
 *
 * 🔴 **禁重建**：任何"再给某平台一条 cdn / 回环 / 形态分流"的念头，先读留痕
 *   `daily/架构日志/08-跨区-段①长尾收口-2026-10-09.md`。用户裁定原话：
 *   「**所有的网站都是直接内联 base64 的，就这么简单**」。
 * ════════════════════════════════════════════════════════════════ */
