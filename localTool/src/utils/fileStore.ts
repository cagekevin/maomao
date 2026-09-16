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
 *    `sha1(buffer)`（contentHashName）。同字节 → 同一物理文件名。
 *    【TD-12-6 更正 2026-09-13】改名/移动已收口为 context-only（只改 resource 行的 name/folder，
 *    不碰磁盘）→ 该内容寻址名即**永久物理名**，不会因改名再失效（原「改名后再失效」注释基于
 *    已退役的 applyResourceIdentityChange 物理改名机制，语义已反转）。
 *  - 新增 contentIdOf / findDedupUrl（按 contentId 去重的纯判定，folder 无关）与
 *    writeUploadDedup（按 contentId 查重的去重感知落盘编排）。
 *  -「同字节 → 1 物理文件」去重真源 = Content 维度 identity = contentId(`<alg>:<hex>`)；
 *    应用层查重仅优化。并发去重真保证 = **content-hash 文件名的写入幂等**（同字节必得同名 →
 *    `writeFileSync` 覆盖同一路径）+ `inflightDownloads` 同进程并发锁。
 *    【TD-03-10 更正 2026-09-13】此前声称「DB 对 contentId 列加唯一约束 + 冲突回退」不成立——
 *    `database.ts:330` 已显式 `DROP INDEX idx_resources_sha1` 并声明不依赖该约束
 *    （因「同内容被不同路径引用」时 UNIQUE 会误杀合法复用）。原注释 stale，会误导审阅者。
 *
 * 更新(2026-09-16 · TD-08-23)：新增「扩展名缺失 → 读字节真相」的唯一原语 `jimpMimeForFile`
 *  / `jimpExtForFile`（替代两处 `path.extname(...) || 'png'` 静默猜格式）；同时删除 `jimpMimeForExt`
 *  （改用后零生产消费者）。**新写缩略图/内联编码逻辑一律引用这两个原语，禁再猜格式** ——
 *  该形态已被 `check:arch` 规则 13-c 机器拦截。
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
 *
 * ⚠️ **改这里之前先读**：本集合是「uploads 顶层根」的**真源**（执行校验的一方）。
 * 新增/删除顶层根时必须**同时**改前端 `src/components/base/utils/uploadDirs.ts::UPLOAD_DIRS`：
 * 后端加了前端没加 ⇒ 前端永远传不出该根（功能死）；反之前端加了后端没加 ⇒ 落盘被拒（静默失败）。
 *
 * 更新(2026-09-15)：原由闸 `scripts/check-upload-dirs.mjs` 对账两端，已按用户裁定删除（实测常绿）。
 * 判据改由**此处注释 + 前端同款注释**承担；顶层根若开始频繁增删，应恢复该闸而不是靠注释。
 */
export const UPLOAD_ROOT_ALLOW = new Set(['tasks', 'web', 'canvas', 'migrated', 'director3d']);

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
 * Jimp 0.22 **可编码格式 → Jimp MIME**（唯一真源，2026-09-16 收口 · TD-02-41）。
 *
 * 【为什么单独成表】「Jimp 能编码哪些格式」这一个事实，此前在库里被写了 **3 份**：
 *   ① `src/components/base/utils/assetUrl.ts`（前端 `new Set` —— 抄后端判据做预校验）；
 *   ② `src/routes/files.ts` 的 `SUPPORTED_THUMB_FORMATS`（缩略图输出扩展名白名单）；
 *   ③ `src/utils/resolveLocalImages.ts` 的 `mimeFromExt` switch（内联 base64 时选 MIME）。
 *   三者靠注释「与 XX 一致」手工同步，**且已漂移过**（前端注释曾写「与后端一致」而值不同步）。
 *   ⇒ 按 §5.4.9「同一语义只允许一种实现」收口到本表 + 两个派生函数。
 *
 * 【为何不放 utils/mime.ts】那是「通用媒体/文本 MIME ↔ 扩展名」表（含 webp/avif/svg —— 描述性映射）；
 *   本表是「**Jimp 能编码哪些**」能力表（webp/avif/svg **无编码器**，故意不登记）。
 *   两者语义不同：`extToMime('.webp')` = 'image/webp'（描述文件），本表 `.webp` = 不可编码。
 *   混在一起会让「放行 webp」看起来像补一个映射那么简单 —— 实则会产出「文件名 .webp + 原格式字节」的
 *   假图（不省体积 + MIME 错标，resize 失败后 copyFileSync 的旧坑，TD-03-7）。
 *
 * 【消费方】`routes/files.ts handleThumbnail`（format 参数是否可编码）·
 *   `utils/resolveLocalImages.ts fileToInlineBase64`（扩展名该配哪个 MIME）。新增消费方一律引用本表。
 */
const JIMP_MIME_BY_EXT: Record<string, string> = {
  png: Jimp.MIME_PNG,
  jpg: Jimp.MIME_JPEG,
  jpeg: Jimp.MIME_JPEG,
  gif: Jimp.MIME_GIF,
  bmp: Jimp.MIME_BMP,
  tiff: Jimp.MIME_TIFF,
};

/** 扩展名（无点、任意大小写）是否可由 Jimp 编码。非字符串/未登记一律 false（不抛）。 */
export function isJimpEncodableExt(ext: unknown): boolean {
  return Object.prototype.hasOwnProperty.call(JIMP_MIME_BY_EXT, String(ext).toLowerCase());
}

/**
 * 「磁盘文件该配哪个 MIME」唯一原语（2026-09-16 收口 · TD-08-23）。
 *
 * 【为什么存在】此前两处（`routes/files.ts` 缩略图端点 / `utils/resolveLocalImages.ts` 内联 base64）
 * 都写 `path.extname(filePath) || 'png'` —— **无扩展名文件被静默当成 png**，
 * 真实 JPEG 被 Jimp 重编码为 PNG（体积膨胀 + 格式丢失），且零日志 = 静默。
 * 而 Jimp 在 `Jimp.read` 时**已按字节解出真实格式**（`img.getMIME()`）——「猜」纯属多余。
 *
 * 【口径】扩展名能配 MIME → 用它（尊重用户声明名，与历史行为一致）；否则用**已解码对象的真 MIME**
 * （字节事实，权威）。二者都不确定才回 `image/png`（Jimp 可编码格式的保底，非静默错标）。
 *
 * 【消费方】`routes/files.ts handleThumbnail`（无 format 参数时定输出扩展名）·
 *   `utils/resolveLocalImages.ts fileToInlineBase64`（内联 base64 选 MIME）。新增消费方一律引用本函数。
 * @param ext 磁盘文件扩展名（可带/不带点，可空 —— 空即无扩展名）
 * @param img 已 `Jimp.read` 的图对象（其 `getMIME()` 是字节真相）
 */
export function jimpMimeForFile(ext: unknown, img: Jimp): string {
  const bare = String(ext ?? '')
    .replace(/^\./, '')
    .toLowerCase();
  if (Object.prototype.hasOwnProperty.call(JIMP_MIME_BY_EXT, bare)) {
    return JIMP_MIME_BY_EXT[bare];
  }
  // 扩展名缺失/未登记 → 取已解码对象的字节真相（`getMIME()` 落在 JIMP 可编码集合内才用）。
  const real = String(img?.getMIME?.() ?? '').toLowerCase();
  return JIMP_MIME_BY_EXT[DECODED_MIME_BY_EXT[real] ?? ''] ?? Jimp.MIME_PNG;
}

/**
 * MIME → 扩展名（`JIMP_MIME_BY_EXT` 的定向反转）—— 只列 Jimp **既有解码器又有编码器**的格式。
 * 刻意不含 webp/avif（Jimp 0.22 能读不能写）：映射回来会产出「.webp 名 + PNG 字节」的假图（TD-03-7 同坑）。
 */
const DECODED_MIME_BY_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/tiff': 'tiff',
};

/**
 * 无扩展名磁盘文件 → 真实编码格式扩展名（无点，小写）；读不出（非图/不可编码）返回 `null`。
 *
 * 【为什么单独成函数】`routes/files.ts handleThumbnail` 需要的是**输出文件名的扩展名**，不是 MIME；
 * 且它必须拿到「无扩展名时的真相」才能拼出**名实相符**的缩略图文件。仅在扩展名缺失时才真读盘
 * （正常带扩展名的请求走 `isJimpEncodableExt` 短路，零额外 I/O）。
 * @param filePath 已确认存在的磁盘文件
 */
export async function jimpExtForFile(filePath: string): Promise<string | null> {
  try {
    const img = await Jimp.read(filePath);
    return DECODED_MIME_BY_EXT[String(img.getMIME()).toLowerCase()] ?? null;
  } catch {
    return null;
  }
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
