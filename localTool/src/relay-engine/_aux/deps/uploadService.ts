/**
 * deps/uploadService — 素材上传宿主适配（替换原 Tauri 版，保留同一套导出签名）。
 *
 * 原项目的 `uploadService` 把参考素材上传成厂商能访问的 URL，但硬依赖 Tauri 文件系统。
 * Kit 不能绑定宿主，所以这里保留**完全相同的三个导出函数**（`isLocalImageUrl` /
 * `uploadToRemote` / `resolveMediaReferenceUrl`），让 `ai/` 里所有调用方无需改动，
 * 只把"上传怎么执行"改成宿主注入。
 *
 * 宿主（浏览器 / Node / Tauri）通过 `setUploadHost` 注入上传与本地读取实现。
 * 缺省实现：http(s)/data: 原样透传，其余抛错提示需要注入。
 */
import type { RelayTransport } from '../../core/transport';
import { relayFetch } from '../../core/transport';

/** 本地 / 内联 URL 判定：这类 URL 必须经过上传才能被厂商访问。 */
const LOCAL_URL_RE = /^(?:asset:|blob:|file:|data:|tauri:|http:\/\/asset\.localhost)/i;

/** 判断一个 URL 是否需要先上传才能给厂商用。 */
export function isLocalImageUrl(url: string): boolean {
  return LOCAL_URL_RE.test(url) || url.includes('asset.localhost');
}

export interface UploadHost {
  /**
   * 把本地素材上传为厂商能访问的公网 URL。
   * provider 是厂商 ID（如 'apimart' 有自己的 /uploads/images 端点），可据需处理。
   */
  uploadToRemote?: (source: string, provider?: string) => Promise<string>;
  /** 把本地文件路径读取为 data URL。 */
  readFileToDataUrl?: (path: string) => Promise<string | null>;
  /** data URL 是否可直接给厂商用（OpenAI 兼容接口常支持），默认 true。 */
  allowDataUrl?: boolean;
}

let host: UploadHost = {
  allowDataUrl: true,
};

/** 注入上传宿主。返回还原函数。 */
export function setUploadHost(next: UploadHost): () => void {
  const previous = host;
  host = { allowDataUrl: true, ...next };
  return () => {
    if (host !== previous) {
      // 还原时尽量恢复旧宿主
      host = previous;
    }
  };
}

export function getUploadHost(): UploadHost {
  return host;
}

/**
 * 把参考素材上传成厂商可访问的 URL。
 * 已是 http(s) 或（允许时）data: 的直接透传；否则交给宿主。
 */
export async function uploadToRemote(url: string, provider = ''): Promise<string> {
  if (/^https?:\/\//i.test(url)) return url;
  if (/^data:/i.test(url) && host.allowDataUrl) return url;
  if (host.uploadToRemote) return host.uploadToRemote(url, provider);
  throw new Error(
    `参考素材 "${url.slice(0, 40)}..." 需要上传为公网 URL，但未配置 uploadToRemote。`
      + '（请用 setUploadHost 注入上传实现，或传入已是 http(s)/data 的 URL）',
  );
}

/** 把本地路径读取为 data URL；无法读取时返回 null。 */
export async function readFileToDataUrl(path: string): Promise<string | null> {
  if (/^data:/i.test(path)) return path;
  if (host.readFileToDataUrl) return host.readFileToDataUrl(path);
  return null;
}

/** 兼容原 uploadService 的 `resolveMediaReferenceUrl`（逐字保留原逻辑）。 */
export async function resolveMediaReferenceUrl(
  url: string,
  options: {
    provider?: string;
    mode?: 'publicUrl' | 'dataUrl';
    kind?: 'image' | 'video' | 'audio';
  } = {},
): Promise<string> {
  const { provider = '', mode = 'publicUrl', kind = 'image' } = options;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;

  if (mode === 'dataUrl') {
    const dataUrl = await readFileToDataUrl(url);
    if (!dataUrl) {
      throw new Error(`无法读取本地${kind === 'video' ? '视频' : kind === 'audio' ? '音频' : '图片'}参考，请重新导入文件`);
    }
    return dataUrl;
  }

  // APIMart 的 /uploads/images 只接受图片；视频/音频即使 provider 是 apimart 也走通用图床
  const effectiveProvider = provider === 'apimart' && kind === 'image' ? 'apimart' : '';
  return uploadToRemote(url, effectiveProvider);
}

export { relayFetch };
export type { RelayTransport };
