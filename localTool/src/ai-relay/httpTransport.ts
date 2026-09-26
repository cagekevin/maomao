/**
 * 稳定 HTTP 客户端 —— 12 个中转的「连接稳定性」核心。
 *
 * 从 AI-Canvas-tauri 的两处来源合并而来：
 *  - src/services/ai/httpTransport.ts 的 corsSafeFetch（鉴权注入、脱敏、可取消）
 *  - src-tauri/src/lib.rs 的 proxy_fetch（64MB 响应上限、流式）
 *  - src/services/ai/modelProtocolHttp.ts 的 ModelProtocolHttpError（429/Retry-After 退避）
 *
 * 在 Node 侧用原生 fetch + AbortController 重新实现，去掉 Tauri/IPC 依赖。
 * 稳定性三件套：
 *   1. baseUrlCandidates：地址填错（漏 /v1）自动兜底探测；
 *   2. 重试：**只对网络层错误**（DNS/连接重置/超时）按指数退避；状态码重试须调用方显式声明
 *      `retryStatuses`（429 遵循 Retry-After）——「只有网络错误才能重试」红线，见 §5.1 与下方 stableRequest 注释；
 *   3. 上限：响应体默认 64MB 上限，防 OOM；全程可被 AbortSignal 取消。
 *
 * 错误契约：上游返回什么，就透传什么——绝不把上游错误翻译成中文提示。
 */

import { baseUrlCandidates } from './providerBaseUrl.js';
import { createHmac } from 'node:crypto';
import type { AuthConfig, StableRequestOptions, StableRequestResult } from './types.js';

/** 与 Rust proxy_fetch 一致的响应体上限 */
export const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

/**
 * 「瞬态、重发有希望恢复」的 HTTP 状态码（唯一真源）。
 *
 * 【谁可以引用它】① **显式**声明重试的调用方（如 `files.ts` 下载：`retryStatuses: [403, ...本集]`）；
 * ② 协议层轮询（`isRetryableHttpStatus` 判"下轮续查有希望"，是**再次查询**不是同请求重发）。
 * 【谁不可以】`stableRequest` 的**缺省**路径 —— 缺省不再据此重试（TD-08-41：那会让非幂等 POST
 * 在 429/5xx 时被静默重发）。本集是"证据清单"，不是"默认开关"。
 */
export const RETRYABLE_HTTP_STATUSES: number[] = [408, 429, 500, 502, 503, 504];
const DEFAULT_RETRY_STATUSES = new Set<number>(RETRYABLE_HTTP_STATUSES);
const DEFAULT_MAX_RETRIES = 3;

/**
 * 判断某 HTTP 状态码是否「可重试」（瞬态，下轮续查有希望恢复）。
 * - 0：网络层/超时/取消（RelayHttpError(0,...)），瞬态 → 可重试；
 * - 408/429/5xx：上游明确可重试或服务器瞬态 → 可重试；
 * - 其余 4xx（401/403/404/400…）：确定性硬失败，重试无意义 → 不可重试。
 * 轮询句柄据此把硬失败立即判为 failed 透传，避免任务静默挂起至总超时。
 */
export function isRetryableHttpStatus(status: number): boolean {
  return status === 0 || DEFAULT_RETRY_STATUSES.has(status);
}
const DEFAULT_MAX_RETRY_DELAY_MS = 60_000;
const DEFAULT_BASE_DELAY_MS = 800;

const SENSITIVE_KEY_RE =
  /(?:authorization|api[-_]?key|access[-_]?key|token|secret|password|credential|signature|cookie)/i;

export class RelayHttpError extends Error {
  status: number;
  retryAfterMs?: number;
  constructor(status: number, message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'RelayHttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, timestamp - Date.now());
}

/** 鉴权头：bearer / header / oauth（即梦走 token 而非 Bearer key）。 */
export function buildAuthHeaders(
  auth: AuthConfig | undefined,
  apiKey?: string,
): Record<string, string> {
  const resolved = auth ?? { type: 'bearer' };
  if (resolved.type === 'oauth') {
    return resolved.token ? { Authorization: resolved.token } : {};
  }
  if (!apiKey) return {};
  if (resolved.type === 'header') {
    return { [resolved.name ?? 'Authorization']: `${resolved.prefix ?? ''}${apiKey}` };
  }
  return { Authorization: `${resolved.prefix ?? 'Bearer '}${apiKey}` };
}

/**
 * HMAC-SHA256 鉴权头（Lovart 原生 Agent 协议）。
 * 签名串 = "{METHOD}\n{path}\n{timestamp}"，每次请求（含重试）重算时间戳与签名。
 * 与 .codebuddy/skills/lovart/agent_skill.py 的 _sign 完全一致。
 */
export function buildHmacAuthHeaders(
  auth: AuthConfig,
  method: string,
  path: string,
): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000).toString();
  const raw = `${method}\n${path}\n${ts}`;
  const sig = createHmac('sha256', auth.secretKey ?? '')
    .update(raw)
    .digest('hex');
  return {
    'X-Access-Key': auth.accessKey ?? '',
    'X-Timestamp': ts,
    'X-Signature': sig,
    'X-Signed-Method': method,
    'X-Signed-Path': path,
    'User-Agent': 'LovartAgentSkill/1.0',
  };
}

function mergeSearchParams(
  base: URL,
  query?: Record<string, string | number | boolean | null | undefined>,
  requestQuery?: Record<string, string>,
): string {
  const sp = new URLSearchParams(base.search);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) sp.set(k, String(v));
    }
  }
  // 厂商固定查询参数（如 Sora2U 的 utm_*）优先级最高，覆盖用户误填
  if (requestQuery) {
    for (const [k, v] of Object.entries(requestQuery)) sp.set(k, String(v));
  }
  return sp.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 判断请求体是否已是原生 BodyInit（multipart 上传等），若是则透传不 JSON 化。 */
function isBodyInit(value: unknown): boolean {
  if (value == null) return false;
  if (typeof FormData !== 'undefined' && value instanceof FormData) return true;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
  if (value instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(value)) return true; // Uint8Array / Buffer / DataView
  if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) return true;
  if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) return true;
  return false;
}

function withTimeout(
  signal: AbortSignal | undefined,
  ms?: number,
): { signal: AbortSignal; cleanup: () => void } | undefined {
  if (!signal) return undefined;
  const controller = new AbortController();
  // 仅当显式给了超时毫秒才设 timer；否则 setTimeout(fn, undefined) 会立即触发误杀请求。
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (ms !== undefined) {
    timer = setTimeout(() => controller.abort(new RelayHttpError(0, '请求超时', undefined)), ms);
  }
  const onAbort = () =>
    controller.abort(signal.reason ?? new RelayHttpError(0, '请求已取消', undefined));
  signal.addEventListener('abort', onAbort, { once: true });
  const inner = controller.signal;
  return {
    signal: inner,
    cleanup() {
      if (timer !== undefined) clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    },
  };
}

/**
 * 发起一次稳定请求。错误响应一律把上游原始文案透传（截断到 300 字防超长），
 * 不翻译、不重写。
 */
export async function stableRequest(opts: StableRequestOptions): Promise<StableRequestResult> {
  const candidates =
    opts.candidates && opts.candidates.length
      ? opts.candidates
      : baseUrlCandidates(opts.baseUrl ?? '');
  if (candidates.length === 0) throw new RelayHttpError(0, '请填写接口地址', undefined);

  const method = (opts.method || 'GET').toUpperCase();
  const isPlainJsonBody =
    opts.body !== undefined &&
    opts.body !== null &&
    typeof opts.body !== 'string' &&
    !isBodyInit(opts.body);
  const bodyStr: string | undefined =
    typeof opts.body === 'string'
      ? opts.body
      : isPlainJsonBody
        ? JSON.stringify(opts.body)
        : undefined;
  const extraHeaders: Record<string, string> = isPlainJsonBody
    ? { 'Content-Type': 'application/json' }
    : {};

  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  // 退避基数：缺省真源常量；调用方（测试）可注入小值，避免为真 sleep 白等数秒。
  const baseDelayMs = opts.retryDelayMs ?? DEFAULT_BASE_DELAY_MS;
  // 【TD-08-41 · 2026-09-17】缺省 = **空集**（不按状态码重试）。
  //
  // 【为什么改（原先缺省 = 中央 RETRYABLE_HTTP_STATUSES）】原口径让**每个**调用点都自动按
  //   408/429/5xx 重发，不分 method、也不问"这个请求重发一次会不会有副作用"——
  //   Lovart 直连的 `save / chat / file/upload` 全是 POST 且经裸包装进本原语（无 maxRetries），
  //   于是 429/5xx 时会**静默重发非幂等请求**（重复建任务/重复上传）。
  //   这违反红线「**只有网络错误才能重试**」（业务/服务端错误不得无条件重试，见 CLAUDE.md §5.1）。
  // 【现口径】① 网络层错误（DNS/连接重置/超时）→ 仍自动按 maxRetries 退避重试（红线允许的那半）；
  //   ② 状态码重试 → **必须由调用方显式声明** `retryStatuses`（= 它有本场景的瞬态证据，
  //   如 `files.ts` 下载对 CDN 发布窗口的 403），没声明就确定性失败直接抛，不猜。
  const retryStatuses = new Set<number>(opts.retryStatuses ?? []);

  let lastError: unknown;
  for (const candidate of candidates) {
    const url = new URL(candidate + (opts.path || ''));
    const qs = mergeSearchParams(
      url,
      opts.query as Record<string, string | number | boolean | null | undefined> | undefined,
      opts.requestQuery,
    );
    url.search = qs;
    const finalUrl = url.toString();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const timeout = withTimeout(opts.signal, opts.timeoutMs);
      try {
        const authHeaders =
          opts.auth?.type === 'hmac'
            ? buildHmacAuthHeaders(opts.auth, method, opts.path ?? '')
            : buildAuthHeaders(opts.auth, opts.apiKey);
        const requestHeaders: Record<string, string> = { ...authHeaders, ...extraHeaders };
        if (opts.headers) Object.assign(requestHeaders, opts.headers);
        const fetchBody: BodyInit | undefined =
          bodyStr !== undefined
            ? bodyStr
            : opts.body !== undefined && opts.body !== null
              ? (opts.body as BodyInit)
              : undefined;
        const fetchImpl: typeof fetch = opts.fetchImpl ?? fetch;
        const response = await fetchImpl(finalUrl, {
          method,
          headers: requestHeaders,
          body: fetchBody,
          signal: timeout ? timeout.signal : opts.signal,
        });

        const lengthHeader = response.headers.get('content-length');
        if (lengthHeader && Number(lengthHeader) > maxBytes) {
          throw new RelayHttpError(413, `响应体超过上限 ${maxBytes} 字节`, undefined);
        }

        if (response.ok) {
          return { response, resolvedBaseUrl: candidate };
        }

        // 错误响应：抽取上游文案原样透传（上游显示啥，我们就显示啥）。
        // 【重试判据唯一】本分支只负责**构造错误对象**，不自行重试 ——
        //   抛出的 RelayHttpError 立刻由下方 catch 以**同一判据**（retryStatuses / maxRetries / aborted）
        //   接管决定是否重试。此前两处各写一份重试判据（M3 SSOT 第二份）：
        //   改一处不改另一处会**静默失效**（探针实测：仅改本处时行为完全不变，被 catch 分支兜住）。
        const text = await response.text().catch(() => '');
        throw new RelayHttpError(
          response.status,
          text.slice(0, 300) || `${method} ${finalUrl} (${response.status})`,
          parseRetryAfterMs(response.headers.get('retry-after')) ?? undefined,
        );
      } catch (err) {
        if (err instanceof RelayHttpError) {
          lastError = err;
          if (retryStatuses.has(err.status) && attempt < maxRetries && !opts.signal?.aborted) {
            const delay =
              err.retryAfterMs && err.retryAfterMs > 0
                ? err.retryAfterMs
                : Math.min(DEFAULT_MAX_RETRY_DELAY_MS, baseDelayMs * 2 ** attempt);
            await sleep(delay);
            continue;
          }
          throw err;
        }
        // 网络层错误（DNS/连接重置/超时）：**唯一**默认重试的错误类别（红线「只有网络错误才能重试」）。
        // 业务/服务端错误（RelayHttpError 带状态码）走上一分支：未显式声明 retryStatuses 即直接抛。
        lastError = err;
        if (attempt < maxRetries && !opts.signal?.aborted) {
          await sleep(Math.min(DEFAULT_MAX_RETRY_DELAY_MS, baseDelayMs * 2 ** attempt));
          continue;
        }
        throw err;
      } finally {
        if (timeout) timeout.cleanup();
      }
    }
  }
  throw lastError ?? new RelayHttpError(0, '无法连接', undefined);
}

/** 读取响应体并强制 64MB 上限（分块累加，避免一次性吃满内存）。 */
export async function readCapped(
  response: Response,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  let total = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel();
      throw new RelayHttpError(413, `响应体超过上限 ${maxBytes} 字节`, undefined);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * corsSafeFetch —— 声明式协议引擎使用的底层请求函数。
 * 返回原始 Response（不预读 body），因此流式 SSE 解析也能直接读 response.body；
 * 支持外部 AbortSignal 与可选超时；错误文案统一由协议层 readJsonResponse 抽取。
 * 与原仓库 httpTransport.ts 的 corsSafeFetch 语义一致（Node 侧用原生 fetch 复刻）。
 */
export async function corsSafeFetch(
  url: string,
  init: RequestInit = {},
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Response> {
  const signal = init.signal ?? opts.signal;
  const timeout = withTimeout(signal, opts.timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: timeout ? timeout.signal : signal,
    });
  } finally {
    if (timeout) timeout.cleanup();
  }
}

/** 脱敏：把日志里的敏感头/本地路径抹掉（来自 httpTransport.ts）。 */
export function sanitizeHeadersForLog(
  headers: HeadersInit | Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const norm = new Headers(headers as HeadersInit);
  norm.forEach((value, name) => {
    out[name] = SENSITIVE_KEY_RE.test(name) ? '[REDACTED]' : value;
  });
  return out;
}
