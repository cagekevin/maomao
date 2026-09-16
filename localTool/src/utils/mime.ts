/**
 * utils/mime — 媒体 MIME ↔ 扩展名映射唯一实现（2026-09-11 收口）。
 *
 * 【为什么存在】此前同一语义散落 6 处：
 *   - ext→mime：index.ts handleStaticFile / handleDepthResource / FRONTEND_MIME、
 *               files.ts handleRead / handleThumbnail 各写一份表；
 *   - mime→ext：files.ts MIME_TO_EXT（下载补后缀，无点）、resources.ts MIME_TO_EXT
 *               （dataURL 落盘，带点）、base64Externalize.extFromMime（KV 外置，default 用 subtype）。
 *   新增格式要改 6 处、且已出现「带点/无点」漂移（单规则原则 §5.4.9 违反）。
 *
 * 【收口边界（真缝隙，勿强行并入）】
 *   - FRONTEND_MIME（woff2/ico）、handleDepthResource（wasm/onnx/safetensors 等推理运行时）
 *     是域专用表（变化速率与通用媒体不同），保留在各文件，不并入本表。
 *   - 本表只收「通用媒体/文本」两向映射；调用方 fallback 语义各自声明（见下）。
 *
 * 【fallback 语义（各调用方保留自己的行为，勿统一）】
 *   - mimeToExt 第三参 fallback：files 下载落盘=undefined（无法识别保持无后缀）、
 *     resources dataURL=.bin、base64 外置=mime subtype。返回均带点（'.png'），
 *     调用方按需去点（files 用 `.slice(1)` 对齐旧无点语义）。
 */

/** 扩展名（小写，带点）→ MIME（通用媒体/文本表，并集自旧 5 表）。 */
export const EXT_TO_MIME: Record<string, string> = {
  // 图片
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  // 视频
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/mp4',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.ogv': 'video/ogg',
  // 音频
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.wma': 'audio/x-ms-wma',
  '.aiff': 'audio/aiff',
  // 文本/数据
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.csv': 'text/csv',
  '.xml': 'text/xml',
  '.log': 'text/plain',
};

/** 扩展名 → MIME；未登记回 fallback（缺省 application/octet-stream）。 */
export function extToMime(ext: string, fallback = 'application/octet-stream'): string {
  return EXT_TO_MIME[ext.toLowerCase()] || fallback;
}

/**
 * 媒体类别（kind）—— 全库「扩展名 → 类别」判定的**唯一取值域**。
 * 与前端 `src/components/base/utils/assetType.ts` 的 `AssetType` 四类对齐（other/empty 是前端态，后端不用）。
 */
export type MediaKind = 'image' | 'video' | 'audio' | 'text';

/**
 * 类别 → 中文显示名（存储健康面板口径，对齐外部 StorageHealthCenter CATEGORY_LABELS）。
 * 中文只是 **kind 的显示派生**，不是第二张真源表 —— 别按扩展名再手抄一份。
 */
const KIND_LABEL: Record<MediaKind, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  text: '文本',
};

/**
 * MIME 大前缀 → kind（mime 比扩展名权威：`audio/ogg` 与 `.ogv` 各自正确）。
 * 这是「ext→mime 真源」到「kind」的唯一推导规则 —— 本文件唯一实现。
 */
function mimeKind(mime: string): MediaKind | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || mime === 'application/json') return 'text';
  return null;
}

/**
 * 扩展名 → 媒体类别；未登记 / 无扩展名 → **null（不猜）**。
 *
 * 【为什么是唯一真源（TD-08-17 / TD-08-18 / TD-16-13 收口 · 2026-09-16）】此前后端有**两张手抄表**：
 * `resources.ts` 的 `RESCAN_FILE_TYPE`（ext→kind）与 `admin.ts` 的 `CATEGORY_BY_EXT`（ext→中文），
 * 互不委托、已漂移 —— `.wmv` 在 rescan 被判 image（破图）、admin 判视频；`.json`/`.csv`/`.log` 等
 * rescan 直接丢弃。**类别这件事只该有一张表**：由 `EXT_TO_MIME` 按 MIME 大前缀派生，
 * 新增格式只改 `EXT_TO_MIME`（或前端 `EXT_KIND`），本函数自动跟随。
 *
 * @param ext 带点小写扩展名（如 `.png`）或裸扩展名（如 `png`），大小写不敏感
 * @returns kind；表外 / 非媒体扩展 → null（调用方须显式处置，**禁 `|| 'image'` 静默兜底**）
 */
export function extToKind(ext: string): MediaKind | null {
  if (!ext) return null;
  const dotted = ext.startsWith('.') ? ext : `.${ext}`;
  const mime = EXT_TO_MIME[dotted.toLowerCase()];
  return mime ? mimeKind(mime) : null;
}

/** 类别 → 中文显示名（存储健康面板）；未知 kind 回「其他」。 */
export function kindLabel(kind: MediaKind | null): string {
  return kind ? KIND_LABEL[kind] : '其他';
}

/** 扩展名 → 中文类别显示名（`extToKind` + `kindLabel` 的组合，供 admin 健康面板用）。 */
export function extToCategoryLabel(ext: string): string {
  return kindLabel(extToKind(ext));
}

/** MIME（小写）→ 扩展名（带点）；返回 null 表示表外（调用方定 fallback）。 */
export function mimeToExt(mime: string): string | null {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  if (!m) return null;
  switch (m) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    case 'image/bmp':
      return '.bmp';
    case 'image/tiff':
      return '.tiff';
    case 'image/svg+xml':
      return '.svg';
    case 'image/avif':
      return '.avif';
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return '.ico';
    case 'video/mp4':
      return '.mp4';
    case 'video/webm':
      return '.webm';
    case 'video/quicktime':
      return '.mov';
    case 'video/x-msvideo':
      return '.avi';
    case 'video/x-matroska':
      return '.mkv';
    case 'video/x-ms-wmv':
      return '.wmv';
    case 'video/ogg':
      return '.ogv';
    case 'audio/mpeg':
      return '.mp3';
    case 'audio/wav':
    case 'audio/x-wav':
      return '.wav';
    case 'audio/mp4':
    case 'audio/x-m4a':
      return '.m4a';
    case 'audio/flac':
      return '.flac';
    case 'audio/ogg':
      return '.ogg';
    case 'audio/aac':
      return '.aac';
    case 'audio/opus':
      return '.opus';
    case 'audio/x-ms-wma':
      return '.wma';
    case 'audio/aiff':
    case 'audio/x-aiff':
      return '.aiff';
    case 'text/markdown':
      return '.md';
    case 'text/plain':
      return '.txt';
    case 'text/csv':
      return '.csv';
    case 'text/xml':
    case 'application/xml':
      return '.xml';
    case 'application/json':
      return '.json';
    default:
      return null;
  }
}
