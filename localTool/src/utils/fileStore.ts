/**
 * 文件落盘统一管理（单一职责收口）
 * ------------------------------------------------------------
 * 之前「写盘 / 建目录 / 缩略图」散落在 files.ts 的 saveFile、
 * saveRemoteUrl、tryGenerateThumbnail、handleThumbnail、handleMkdir、
 * handleMove、handleOpen 多处，各自重复 existsSync+mkdirSync+writeFileSync，
 * 缩略图目录逻辑还复制了两份。这里统一收口，避免后期改一处漏一处。
 */

import fs from 'node:fs';
import path from 'node:path';
import Jimp from 'jimp';
import { getUploadDir } from '../db/database.js';

/** 目录不存在则递归创建 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** 清洗文件名：去除非法字符与空白（多路径共用，避免各自实现不一致） */
export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_');
}

/**
 * 拼出上传目录下的绝对路径与可访问 URL（只计算，不写盘）。
 * urlPath 形如 /files/{subfolder}/{filename}，供前端直接引用。
 */
export function resolveUploadTarget(
  subfolder: string,
  filename: string
): { dir: string; savedPath: string; urlPath: string } {
  const dir = path.join(getUploadDir(), subfolder);
  const savedPath = path.join(dir, sanitizeFilename(filename));
  const urlPath = `/files/${subfolder}/${path.basename(savedPath)}`;
  return { dir, savedPath, urlPath };
}

/** 本地上传落盘：自动加时间戳前缀去重，返回绝对路径与 URL */
export function writeUploadBuffer(
  subfolder: string,
  filename: string,
  data: Buffer
): { savedPath: string; urlPath: string } {
  const { dir, savedPath, urlPath } = resolveUploadTarget(subfolder, `${Date.now()}-${filename}`);
  ensureDir(dir);
  fs.writeFileSync(savedPath, data);
  return { savedPath, urlPath };
}

/** 落盘到指定稳定文件名（远程 URL 下载用，幂等由调用方判 exists 保证） */
export function writeUploadBufferAt(
  subfolder: string,
  stableName: string,
  data: Buffer
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
  suffix = ''
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
  { maxDim, quality }: { maxDim: number; quality: number }
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
