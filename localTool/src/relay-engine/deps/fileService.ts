/**
 * deps/fileService — 文件系统服务（宿主能力，kit 只保留读取与下载的注入点）。
 *
 * 原实现绑定 Tauri 文件系统。kit 通过 `setFileHost` 注入读/存实现，
 * 并导出与原文件同名的函数，让 `ai/` 调用方无需改动。
 */
import { readFileToDataUrl as hostReadFile, setUploadHost } from './uploadService';

export interface FileHost {
  /** 读取本地文件为 data URL。 */
  readFileToDataUrl?: (path: string) => Promise<string | null>;
  /** 保存二进制到项目数据目录，返回 { filePath, assetUrl }。 */
  saveBinaryToProjectData?: (
    data: Uint8Array,
    projectId: string,
    fileName: string,
  ) => Promise<{ filePath: string; assetUrl: string } | null>;
  /** 把 URL 下载并保存，返回 { filePath, assetUrl }。 */
  downloadUrlAndSave?: (
    url: string,
    projectId: string,
    fallbackPrefix: string,
    baseName?: string,
  ) => Promise<{ filePath: string; assetUrl: string } | null>;
  /** 本地路径 → 可访问的 asset URL。 */
  getAssetUrlFromPath?: (path: string) => Promise<string | null>;
}

/** 读取本地文件为 data URL（透传给 uploadService 的注入点）。 */
export async function readFileToDataUrl(path: string): Promise<string | null> {
  return hostReadFile(path);
}

/** 是否运行在 Tauri 环境。 */
export function isTauriEnv(): boolean {
  return typeof window !== 'undefined'
    && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

/** 保存二进制到项目数据目录，返回落盘路径与 asset URL；非 Tauri / 未注入时返回 null。 */
export async function saveBinaryToProjectData(
  data: Uint8Array,
  projectId: string,
  fileName: string,
): Promise<{ filePath: string; assetUrl: string } | null> {
  if (!isTauriEnv()) return null;
  const fileHost = getFileHost();
  if (fileHost.saveBinaryToProjectData) {
    return fileHost.saveBinaryToProjectData(data, projectId, fileName);
  }
  return null;
}

/** 下载 URL 并保存到项目数据目录，返回 { filePath, assetUrl }；非 Tauri / 未注入时返回 null。 */
export async function downloadUrlAndSave(
  url: string,
  projectId: string,
  fallbackPrefix: string,
  baseName?: string,
  _options?: unknown,
): Promise<{ filePath: string; assetUrl: string } | null> {
  if (!isTauriEnv()) return null;
  const fileHost = getFileHost();
  if (fileHost.downloadUrlAndSave) {
    return fileHost.downloadUrlAndSave(url, projectId, fallbackPrefix, baseName);
  }
  return null;
}

/** 本地路径 → asset URL。 */
export async function getAssetUrlFromPath(path: string): Promise<string | null> {
  const fileHost = getFileHost();
  if (fileHost.getAssetUrlFromPath) return fileHost.getAssetUrlFromPath(path);
  return null;
}

/** 按扩展名推断文件类别。 */
export function getFileCategory(_path: string): 'image' | 'video' | 'audio' | 'other' {
  const ext = _path.split('.').pop()?.toLowerCase() ?? '';
  if (/^(png|jpe?g|gif|webp|avif|bmp)$/.test(ext)) return 'image';
  if (/^(mp4|mov|webm|mkv)$/.test(ext)) return 'video';
  if (/^(mp3|wav|ogg|m4a|flac)$/.test(ext)) return 'audio';
  return 'other';
}

let fileHost: FileHost = {};

/** 注入文件宿主。返回还原函数。 */
export function setFileHost(next: FileHost): () => void {
  const previous = fileHost;
  fileHost = next;
  return () => {
    if (fileHost === next) fileHost = previous;
  };
}

export function getFileHost(): FileHost {
  return fileHost;
}

export { setUploadHost };
