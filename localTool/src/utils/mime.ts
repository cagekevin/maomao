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
  // 视频
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/mp4',
  '.flv': 'video/x-flv',
  // 音频
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  // 文本/数据
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

/** 扩展名 → MIME；未登记回 fallback（缺省 application/octet-stream）。 */
export function extToMime(ext: string, fallback = 'application/octet-stream'): string {
  return EXT_TO_MIME[ext.toLowerCase()] || fallback;
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
    case 'text/markdown':
      return '.md';
    case 'text/plain':
      return '.txt';
    case 'application/json':
      return '.json';
    default:
      return null;
  }
}
