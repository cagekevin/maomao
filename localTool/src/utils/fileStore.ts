/**
 * 文件落盘统一管理（单一职责收口）
 * ------------------------------------------------------------
 * 之前「写盘 / 建目录 / 缩略图」散落在 files.ts 的 saveFile、
 * saveRemoteUrl、tryGenerateThumbnail、handleThumbnail、handleMkdir、
 * handleMove、handleOpen 多处，各自重复 existsSync+mkdirSync+writeFileSync，
 * 缩略图目录逻辑还复制了两份。这里统一收口，避免后期改一处漏一处。
 *
 * 更新(2026-09-12 · docs/122 文件管理收口 #1/#6 · Content 维度)：
 *  - writeUploadBuffer 命名由 `${Date.now()}-${filename}` 时间戳前缀改为内容寻址
 *    `sha1(buffer)`（contentHashName）。同字节 → 同一初始物理文件名；仅决定首次落盘的
 *    初始文件名，applyResourceIdentityChange 改名后再失效。
 *  - 新增 contentIdOf / findDedupUrl（按 contentId 去重的纯判定，folder 无关）与
 *    writeUploadDedup（按 contentId 查重的去重感知落盘编排）。
 *  -「同字节 → 1 物理文件」去重真源 = Content 维度 identity = contentId(`<alg>:<hex>`)；
 *    应用层查重仅优化，并发去重真保证 = DB 对 contentId 列加唯一约束 + 冲突回退复用。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Jimp from 'jimp';
import { getUploadDir } from '../db/database.js';

/** 目录不存在则递归创建 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** 清洗文件名：去除非法字符与空白（多路径共用，避免各自实现不一致） */
// 文件名里的控制字符（NUL..US）用字符码动态拼出正则，规避 no-control-regex（源文件不含字面控制字符）；其余非法可见字符留字面量
const CONTROL_CHARS_RE = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}]`);

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(CONTROL_CHARS_RE, '_')
    .replace(/\s+/g, '_');
}

/**
 * 目录根白名单（docs/45 收口）。subfolder 只允许以这些根开头，防止拼错目录污染 uploads 根。
 * ⚠️ 不能做成「精确值全量禁止」：素材库有动态分类目录（migrated/人物、migrated/脚本/尾帧变体 等），
 * 且 canvas、migrated 下可嵌套（canvas/drop、canvas/video-process）——故白名单针对【顶层根】，
 * 只拒绝未知顶层根与目录逃逸，放行既有所有合法用法（这与前端 uploadDirs.js 的常量根一致）。
 */
const UPLOAD_ROOT_ALLOW = new Set(['tasks', 'web', 'canvas', 'migrated', 'director3d']);

/**
 * 规范化并校验 subfolder（目录根白名单 + 防目录逃逸）。
 * - 统一 `/` 分隔、去首尾斜杠、折叠连续斜杠；
 * - 拒绝空段 / `.` / `..` / 含盘符或 `:` 的绝对形式 / 未登记顶层根；
 *   （路径经 path.join 拼接后必然落在 uploads 根内，杜绝 ../ 越根写文件）
 * - 合法 → 返回规范化后的相对子路径；非法 → 返回 null（调用方回退默认根 canvas）。
 */
export function normalizeSubfolder(subfolder: unknown): string | null {
  if (typeof subfolder !== 'string') return null;
  const s = subfolder
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
  if (!s) return null;
  const parts = s.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) return null;
  const root = parts[0];
  if (root.includes(':') || !UPLOAD_ROOT_ALLOW.has(root)) return null;
  return parts.join('/');
}

/**
 * 拼出上传目录下的绝对路径与可访问 URL（只计算，不写盘）。
 * urlPath 形如 /files/{subfolder}/{filename}，供前端直接引用。
 */
export function resolveUploadTarget(
  subfolder: string,
  filename: string,
): { dir: string; savedPath: string; urlPath: string } {
  const safeSub = normalizeSubfolder(subfolder) ?? 'canvas'; // 非法子目录回退默认根，杜绝越根写
  const dir = path.join(getUploadDir(), safeSub);
  const savedPath = path.join(dir, sanitizeFilename(filename));
  const urlPath = `/files/${safeSub}/${path.basename(savedPath)}`;
  return { dir, savedPath, urlPath };
}

/**
 * 把「相对 uploadDir 的路径」解析为安全的绝对路径（只校验，不改写、不写盘）。
 *
 * 【与 resolveUploadTarget 的分工】
 *  - resolveUploadTarget：新文件落盘用 —— 会 sanitize 文件名、非法目录回退默认根；
 *  - resolveUploadFile  ：既有文件定位 / 改名移动目标用 —— **绝不改写调用方给的路径**。
 *    因为 sanitizeFilename 会把空格变 `_`，含空格的既有文件会被判"不存在"（T10 护栏）。
 *
 * 【为什么只防逃逸、不做顶层根白名单】
 * UPLOAD_ROOT_ALLOW 是「新建目录防污染 uploads 根」的落盘侧策略；而改名/移动的对象是
 * **已存在的**目录，不存在污染问题。且 rescan 收录 uploadDir 下任意顶层子目录——若在此
 * 加白名单，存量里未登记根目录下的文件将无法移动（功能倒退）。故只做防逃逸，
 * 这正是路径穿越风险（清单 #11）的全部要害。
 *
 * @param rel 相对 uploadDir 的路径（如 'migrated/人物/a.png'）
 * @returns 安全的绝对路径；非法（空 / 含 `.` `..` / 越出 uploadDir）→ null，由调用方决定拒绝还是回退
 */
export function resolveUploadFile(rel: unknown): string | null {
  if (typeof rel !== 'string') return null;
  const s = rel
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/');
  if (!s) return null;
  const parts = s.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) return null;

  const uploadDir = getUploadDir();
  const abs = path.resolve(uploadDir, ...parts);
  // 硬兜底：resolve 后必须仍在 uploadDir 内（上层规范化若被绕过，这里是最后一道闸）
  const back = path.relative(uploadDir, abs);
  if (!back || back.startsWith('..') || path.isAbsolute(back)) return null;
  return abs;
}

/**
 * 文件物理命名的单一规范（内容寻址）：`sha1(content).ext`。
 * - ext 统一小写、去前导点；无扩展名（空串）→ 只返回哈希（保持既有「无后缀文件」语义）。
 * - 去重本体依赖该命名：同一字节必然得到同一 name，是跨目录预查的匹配键。
 * @param {string} hash sha1(content) hex
 * @param {string} [ext] 扩展名（可带或不带前导点）
 */
export function contentHashName(hash: string, ext = ''): string {
  const e = String(ext || '')
    .replace(/^\./, '')
    .toLowerCase();
  return e ? `${hash}.${e}` : hash;
}

/**
 * 本地上传落盘：以内容寻址命名（替代原时间戳前缀），返回绝对路径与 URL。
 * - 命名 = contentHashName(sha1(data), ext)，ext 从入参 filename 推导（保留调用方想要的扩展名/类型识别）。
 * - 注意：只决定「首次落盘的初始文件名」（同一目录内同内容同名覆盖 = 同目录去重）。
 *   跨目录去重用 writeUploadDedup 的预查，非本函数职责。
 */
export function writeUploadBuffer(
  subfolder: string,
  filename: string,
  data: Buffer,
): { savedPath: string; urlPath: string } {
  const hash = crypto.createHash('sha1').update(data).digest('hex');
  const contentName = contentHashName(hash, path.extname(filename));
  const { dir, savedPath, urlPath } = resolveUploadTarget(subfolder, contentName);
  ensureDir(dir);
  fs.writeFileSync(savedPath, data);
  return { savedPath, urlPath };
}

/** 内容寻址默认算法（docs/122 Content 维度）：contentId 带算法前缀可演进 */
export const CONTENT_ALG = 'sha1' as const;

/** 由纯哈希 hex 组成 contentId：`<alg>:<hex>`（Content 维度身份，folder/url/name 无关） */
export function contentIdOf(hashHex: string): string {
  return `${CONTENT_ALG}:${hashHex}`;
}

/**
 * 按 `contentId` 去重（docs/122 Content 维度核心判定，纯函数、无 DB / 无 I/O）：
 * 在既有文件记录列表中按 `contentId` 匹配（folder/url 无关、改名仍存活），命中返回其 url。
 * 去重是维度副产物（同字节→同 contentId→同 Content）；应用层查重只是优化，
 * 并发去重真保证是 DB 对 contentId 加唯一约束 + 冲突回退（见路由层）。
 * @param {Array<{url:string; sha1?:string}>} files 既有文件记录（含去重身份列，值为 contentId）
 * @param {string} contentId `<alg>:<hex>`
 * @returns {{url:string}|null} 命中返回既有 url；无则 null（需新建）
 */
export function findDedupUrl(
  files: Array<{ url: string; sha1?: string }>,
  contentId: string,
): { url: string } | null {
  const hit = (files || []).find((f) => !!f.sha1 && f.sha1 === contentId);
  return hit ? { url: hit.url } : null;
}

/** writeUploadDedup 入参 / 出参（纯只读数据结构，不 mutate） */
export interface WriteDedupOpts {
  subfolder: string;
  /** 扩展名（可带或不带前导点），用于首落盘文件命名（仅初始命名，非去重键） */
  ext?: string;
  data: Buffer;
  /**
   * 按 `contentId` 查重路由：查询既有文件（任意 folder）中 contentId 匹配的 url。
   * 路由层注入 DB glue（SELECT url FROM resources WHERE sha1(contentId)=?），
   * fileStore 不直接依赖 DB -> 保持低层职责纯粹、去重判定单一实现。
   */
  existingUrlByContentId: (contentId: string) => string | null;
}
export interface WriteDedupResult {
  /** 实际落盘的绝对路径；deduped=true 时为 null（未写盘） */
  savedPath: string | null;
  /** /files/...（新建）或既有 url（复用命中，可能为绝对形式，路由层转相对） */
  urlPath: string;
  /** contentId = `<alg>:<hex>`（Content 维度身份，去重/GC 键） */
  contentId: string;
  /** true = 按 contentId 命中，复用既有物理文件，未写盘 */
  deduped: boolean;
}

/**
 * 去重感知落盘（docs/122 Content 维度 #6 单一实现）：
 * 1. 算 sha1(data) → contentId = `<alg>:<hex>`（去重身份）；
 * 2. 调 existingUrlByContentId 按 contentId 查重（folder 无关）→ 命中复用既有 url；
 *    （应用层查重仅优化；并发真保证 = DB contentId 唯一约束 + 冲突回退，见路由层）
 * 3. 未命中 → writeUploadBuffer 以 sha1 命名落盘（contentHashName，仅初始命名）。
 * 任何「新建文件落盘」入口应经本函数按 contentId 去重。
 */
export async function writeUploadDedup(opts: WriteDedupOpts): Promise<WriteDedupResult> {
  const hash = crypto.createHash('sha1').update(opts.data).digest('hex');
  const contentId = contentIdOf(hash);
  const hitUrl = opts.existingUrlByContentId(contentId);
  if (hitUrl) return { savedPath: null, urlPath: hitUrl, contentId, deduped: true };
  const contentName = contentHashName(hash, opts.ext);
  const { savedPath, urlPath } = writeUploadBuffer(opts.subfolder, contentName, opts.data);
  return { savedPath, urlPath, contentId, deduped: false };
}

/** 落盘到指定稳定文件名（远程 URL 下载用，幂等由调用方判 exists 保证） */
export function writeUploadBufferAt(
  subfolder: string,
  stableName: string,
  data: Buffer,
): { savedPath: string; urlPath: string } {
  const { dir, savedPath, urlPath } = resolveUploadTarget(subfolder, stableName);
  ensureDir(dir);
  fs.writeFileSync(savedPath, data);
  return { savedPath, urlPath };
}

/**
 * 取/建缩略图目录，并算出缩略图绝对路径与可访问 URL。
 * suffix 用于区分不同尺寸（如 "200x80_"），保证同名文件多尺寸互不覆盖。
 */
export function ensureThumbnailTarget(
  filePath: string,
  suffix = '',
): { thumbDir: string; thumbPath: string; thumbUrl: string } {
  const thumbDir = path.join(path.dirname(filePath), '.thumbnails');
  ensureDir(thumbDir);
  const thumbPath = path.join(thumbDir, `thumb_${suffix}${path.basename(filePath)}`);
  const thumbUrl = `/files/${path.relative(getUploadDir(), thumbDir).replace(/\\/g, '/')}/${path.basename(thumbPath)}`;
  return { thumbDir, thumbPath, thumbUrl };
}

/**
 * 用 jimp 把 src 图片缩放/压缩后写入 dst，返回是否成功。
 * - 最长边缩放到 ≤maxDim（不超过原图，小图不放大）；quality 用于 JPEG/WebP 压缩（PNG/GIF 由 jimp 忽略）。
 * - 失败返回 false，调用方应回退到 copyFileSync（兜底，保证功能不回归）。
 * - jimp 为纯 JS 实现，无原生编译依赖，符合 localTool 轻量取向（docs/35 §6）。
 */
export async function resizeImage(
  src: string,
  dst: string,
  { maxDim, quality }: { maxDim: number; quality: number },
): Promise<boolean> {
  try {
    const img = await Jimp.read(src);
    const scale = Math.min(1, maxDim / Math.max(img.getWidth(), img.getHeight()));
    const w = Math.max(1, Math.round(img.getWidth() * scale));
    const h = Math.max(1, Math.round(img.getHeight() * scale));
    if (w !== img.getWidth() || h !== img.getHeight()) {
      img.resize(w, h);
    }
    img.quality(quality);
    await img.writeAsync(dst);
    return true;
  } catch {
    return false;
  }
}
