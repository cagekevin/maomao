/**
 * 统一 HTTP 出口。
 *
 * 原项目里所有 AI 请求都走 `corsSafeFetch`：Tauri 环境下经 Rust 原生流式通道绕过 WebView 的
 * CORS 限制，浏览器环境回落到原生 fetch。抽成独立模块后不能硬依赖 `@tauri-apps/api`，
 * 因此这里改成可注入的传输层：默认使用全局 fetch，宿主环境可用 `setRelayTransport`
 * 换成自己的实现（见 `./tauri` 提供的 Tauri 原生实现）。
 *
 * 另有 `logAiRequest`：开发环境下的请求日志，会对密钥、本地路径、大段 Base64 做脱敏。
 */

const SENSITIVE_KEY_RE = /(?:authorization|api[-_]?key|access[-_]?key|token|secret|password|credential|signature|cookie)/i;
const LOCAL_MEDIA_RE = /^(?:asset|blob|data|file):/i;
const WINDOWS_ABSOLUTE_PATH_RE = /(?:^|[\s"'(=])[a-z]:[\\/]/i;
const UNIX_ABSOLUTE_PATH_RE = /(?:^|[\s"'(=])\/(?:Users|home|root|private|var\/folders|tmp)\//;
const MAX_LOGGED_STRING_LENGTH = 1000;

type SanitizedValue =
  | null
  | boolean
  | number
  | string
  | SanitizedValue[]
  | { [key: string]: SanitizedValue };

function mediaScheme(value: string): string {
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(value)?.[1]?.toLowerCase();
  return scheme || (value.includes('asset.localhost') ? 'asset.localhost' : 'local');
}

function sanitizeUrl(value: string): SanitizedValue {
  if (LOCAL_MEDIA_RE.test(value) || value.includes('asset.localhost')) {
    return { type: 'local-media', scheme: mediaScheme(value), length: value.length };
  }
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'tauri:'].includes(url.protocol)) return value;
    for (const [name, queryValue] of url.searchParams.entries()) {
      url.searchParams.set(
        name,
        SENSITIVE_KEY_RE.test(name) ? '[REDACTED]' : sanitizeString(queryValue),
      );
    }
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

function sanitizeString(value: string): string {
  if (WINDOWS_ABSOLUTE_PATH_RE.test(value) || UNIX_ABSOLUTE_PATH_RE.test(value)) {
    return '[REDACTED_TEXT_WITH_LOCAL_PATH]';
  }
  if (value.length > MAX_LOGGED_STRING_LENGTH) {
    return `${value.slice(0, MAX_LOGGED_STRING_LENGTH)}... [length=${value.length}]`;
  }
  return value;
}

function sanitizeValue(
  value: unknown,
  key = '',
  seen = new WeakSet<object>(),
): SanitizedValue {
  if (SENSITIVE_KEY_RE.test(key)) return '[REDACTED]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (LOCAL_MEDIA_RE.test(value) || value.includes('asset.localhost') || /^https?:\/\//i.test(value)) {
      return sanitizeUrl(value);
    }
    return sanitizeString(value);
  }
  if (value instanceof Blob) {
    return {
      type: value instanceof File ? 'file' : 'blob',
      mimeType: value.type || 'application/octet-stream',
      size: value.size,
      ...(value instanceof File ? { name: sanitizeString(value.name) } : {}),
    };
  }
  if (value instanceof ArrayBuffer) return { type: 'array-buffer', byteLength: value.byteLength };
  if (ArrayBuffer.isView(value)) return { type: 'binary-view', byteLength: value.byteLength };
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, key, seen));
  if (typeof value === 'object') {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    const sanitized: Record<string, SanitizedValue> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      sanitized[entryKey] = sanitizeValue(entryValue, entryKey, seen);
    }
    return sanitized;
  }
  return String(value);
}

function sanitizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  const normalized = new Headers(headers);
  normalized.forEach((value, name) => {
    result[name] = SENSITIVE_KEY_RE.test(name) ? '[REDACTED]' : sanitizeString(value);
  });
  return result;
}

function sanitizeBody(body: BodyInit | null | undefined): SanitizedValue | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') {
    try {
      return sanitizeValue(JSON.parse(body));
    } catch {
      return sanitizeString(body);
    }
  }
  if (body instanceof URLSearchParams) {
    return sanitizeValue(Object.fromEntries(body.entries()));
  }
  if (body instanceof FormData) {
    const entries: Record<string, SanitizedValue | SanitizedValue[]> = {};
    for (const [name, value] of body.entries()) {
      const next = sanitizeValue(value, name);
      const current = entries[name];
      entries[name] = current === undefined
        ? next
        : Array.isArray(current) ? [...current, next] : [current, next];
    }
    return entries as Record<string, SanitizedValue>;
  }
  return sanitizeValue(body);
}

/** 开发环境打印脱敏后的请求摘要；生产环境静默。 */
export function logAiRequest(
  url: string,
  init: RequestInit = {},
  source = 'HTTP',
  enabled = false,
): void {
  if (!enabled) return;
  console.info('[AI Request]', {
    source,
    method: (init.method || 'GET').toUpperCase(),
    url: sanitizeUrl(url),
    headers: sanitizeHeaders(init.headers),
    body: sanitizeBody(init.body),
  });
}

/**
 * 传输层契约。宿主环境可实现自己的版本（代理、原生通道、mock 等）。
 */
export interface RelayTransport {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

const defaultTransport: RelayTransport = {
  fetch: (url, init) => fetch(url, init),
};

let activeTransport: RelayTransport = defaultTransport;

/** 替换全局传输层，返回可还原的清理函数。 */
export function setRelayTransport(transport: RelayTransport): () => void {
  const previous = activeTransport;
  activeTransport = transport;
  return () => {
    if (activeTransport === transport) activeTransport = previous;
  };
}

export function getRelayTransport(): RelayTransport {
  return activeTransport;
}

/** 本模块的唯一 HTTP 出口；所有协议 / 目录请求都经过这里。 */
export function relayFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return activeTransport.fetch(url, init);
}

/** 兼容原 `ai/httpTransport` 的命名（厂商适配器仍引用 corsSafeFetch）。 */
export const corsSafeFetch = relayFetch;
