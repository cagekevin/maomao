/**
 * protocol/poll — 异步协议的轮询执行与重试。
 * 轮询请求强制同源；只对瞬时网络错误与可重试 HTTP 状态码退避重试。
 * 对应 AI-Canvas-tauri 的 modelProtocolPoll.ts。
 */

import { pollTask } from './pollTask.js';
import { serializeModelProtocolBody } from './body.js';
import { corsSafeFetch } from '../httpTransport.js';
import {
  ModelProtocolHttpError,
  fetchSameOriginResultUrls,
  normalizeBase64Result,
  readJsonResponse,
} from './http.js';
import { readModelProtocolFirstScalar, readModelProtocolUrls } from './response.js';
import {
  applyQueryAuthentication,
  assertSerializedBodyWithinLimit,
  buildSameOriginUrl,
  renderRequestBody,
  renderRequestHeaders,
} from './request.js';
import {
  DEFAULT_MAX_QUERY_RETRIES,
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_RETRY_HTTP_STATUSES,
  resolveAuthentication,
  validateHeaderName,
} from './shared.js';
import { validateAuthentication } from './validation.js';
import type {
  AuthConfig,
  ModelProtocolExecuteResult,
  ModelProtocolPollConfig,
  ModelProtocolRetryConfig,
  ProtocolVariables,
  ResolvedPollConfig,
} from '../types.js';

export function resolvePoll(baseUrl: string, poll: ModelProtocolPollConfig, auth: AuthConfig | undefined, context: ProtocolVariables): ResolvedPollConfig {
  if (poll.bodyEncoding === 'multipart') {
    throw new Error('异步轮询请求不支持 multipart 请求体');
  }
  const headers = renderRequestHeaders(poll, { type: 'none' }, '', context);
  const body = renderRequestBody(poll, context);
  if (poll.method !== 'GET' && body !== undefined) {
    const serializedBody = serializeModelProtocolBody(body, poll.bodyEncoding, headers);
    assertSerializedBodyWithinLimit(poll, serializedBody, '轮询请求体');
  }
  const response = poll.response;
  const result = response.result;
  return {
    method: poll.method,
    url: buildSameOriginUrl(baseUrl, poll, context),
    auth: structuredClone(resolveAuthentication(auth)),
    headers,
    bodyEncoding: poll.bodyEncoding,
    body,
    statusPath: response.statusPath,
    successValues: [...response.successValues],
    failureValues: [...response.failureValues],
    resultUrlPath: result.urlPath,
    resultTextPath: result.textPath,
    resultBase64Path: result.base64Path,
    resultMimeType: result.mimeType,
    resultBase64Transform: result.base64Transform
      ? structuredClone(result.base64Transform)
      : undefined,
    resultFetchUrl: result.fetchUrl,
    errorPath: response.errorPath,
    progressPath: response.progressPath,
    intervalMs: poll.intervalMs ?? 3000,
    maxAttempts: poll.maxAttempts,
    maxDurationMs: poll.maxDurationMs,
    retry: poll.retry ? structuredClone(poll.retry) : undefined,
  };
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : String(value ?? '').toLowerCase();
}

/**
 * 单轮状态查询结果（供「轮询句柄管理器」使用，见 relay-poll）。
 *
 * 说明：这是对 `pollResolvedModelProtocol` 单轮内部逻辑的**分解导出**（无语义变化、无绕开 kit），
 * 让外部能自己持有轮询句柄逐轮打点（进度可见 / 可 attach / 可重启恢复），而不是只能调用
 * 「一次跑完整轮询到终态」的 `pollResolvedModelProtocol`。
 *
 * 与 `pollResolvedModelProtocol` 差异：
 *  - 只做**一轮** fetch + 分类，不带内部的退避重试延迟循环、不代管 interval/maxDuration。
 *    重试节奏与总超时由调用方（句柄管理器）掌控——那正是「常驻轮询器」该负责的。
 *  - 瞬时网络/可重试 HTTP 错误：本轮直接以 `error` 形态返回（附 retryable 标记 + 原始错误），
 *    不静默吞错；调用方决定是否下轮续查。
 */
export type ModelPollOnceResult =
  | { status: 'completed'; urls: string[]; text?: string; taskId?: string; progress?: number }
  | { status: 'failed'; error: string; taskId?: string; progress?: number }
  | { status: 'processing'; progress?: number; taskId?: string; error?: string; retryable?: boolean };

/** 单轮打点：跑一次状态查询并分类。调用方以 poll.intervalMs 节奏驱动。 */
export async function pollModelProtocolOnce(
  poll: ResolvedPollConfig,
  apiKey: string | undefined,
  signal?: AbortSignal,
  allowedBaseUrl?: string,
): Promise<ModelPollOnceResult> {
  const successValues = new Set(poll.successValues.map(normalizeStatus));
  const failureValues = new Set(poll.failureValues.map(normalizeStatus));
  let payload: unknown;
  try {
    const response = await corsSafeFetch(
      applyQueryAuthentication(poll.url, poll.auth, apiKey),
      { ...buildResolvedRequestInit(poll, apiKey), signal },
    );
    payload = await readJsonResponse(response, '模型任务查询失败', poll.errorPath);
  } catch (error) {
    const retryable = error instanceof ModelProtocolHttpError
      ? true // HTTP 层错误交给调用方按 retryable httpStatuses 决定；此处不再吞掉
      : isTransientNetworkError(error);
    return {
      status: 'processing',
      error: error instanceof Error ? error.message : String(error),
      retryable,
    };
  }
  // 分类状态
  const status = normalizeStatus(readModelProtocolFirstScalar(payload, poll.statusPath));
  const progress = poll.progressPath
    ? (() => {
        const p = readModelProtocolFirstScalar(payload, poll.progressPath);
        return typeof p === 'number' ? p : undefined;
      })()
    : undefined;
  if (successValues.has(status)) {
    const urls = poll.resultUrlPath ? readModelProtocolUrls(payload, poll.resultUrlPath) : [];
    const base64Urls = poll.resultBase64Path
      ? readModelProtocolUrls(payload, poll.resultBase64Path).map((value) =>
          normalizeBase64Result(value, poll.resultMimeType, poll.resultBase64Transform))
      : [];
    const textValue = poll.resultTextPath
      ? readModelProtocolFirstScalar(payload, poll.resultTextPath)
      : undefined;
    const text = textValue === undefined || textValue === null ? undefined : String(textValue);
    const mediaUrls = [...urls, ...base64Urls];
    if (mediaUrls.length === 0 && !text) throw new Error('模型任务完成但未返回配置的结果');
    return { status: 'completed', urls: mediaUrls, ...(text ? { text } : {}), progress };
  }
  if (failureValues.has(status)) {
    const detail = poll.errorPath ? readModelProtocolFirstScalar(payload, poll.errorPath) : undefined;
    return { status: 'failed', error: `模型任务失败：${detail || status}`, progress };
  }
  return { status: 'processing', progress };
}

export function getDefaultModelProtocolPollRetryConfig(): ModelProtocolRetryConfig {
  return {
    httpStatuses: [...DEFAULT_RETRY_HTTP_STATUSES],
    maxRetries: DEFAULT_MAX_QUERY_RETRIES,
    backoff: 'fixed',
    maxDelayMs: DEFAULT_MAX_RETRY_DELAY_MS,
    honorRetryAfter: true,
    retryNetworkErrors: true,
  };
}

function resolvePollRetryConfig(value: ModelProtocolRetryConfig | undefined): ModelProtocolRetryConfig {
  const defaults = getDefaultModelProtocolPollRetryConfig();
  return {
    ...defaults,
    ...value,
    httpStatuses: value?.httpStatuses ?? defaults.httpStatuses,
  };
}

function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (
    typeof DOMException !== 'undefined'
    && error instanceof DOMException
    && ['NetworkError', 'TimeoutError'].includes(error.name)
  ) {
    return true;
  }
  return error instanceof Error
    && /failed to fetch|network error|connection (?:closed|reset)|timed? out/i.test(error.message);
}

function calculateRetryDelayMs(intervalMs: number, retryCount: number, retry: ModelProtocolRetryConfig, retryAfterMs?: number): number {
  const multiplier = retry.backoff === 'exponential'
    ? 2 ** Math.max(0, retryCount - 1)
    : retry.backoff === 'linear'
      ? retryCount
      : 1;
  const backoffDelay = intervalMs * multiplier;
  const requestedDelay = retry.honorRetryAfter && retryAfterMs !== undefined
    ? Math.max(backoffDelay, retryAfterMs)
    : backoffDelay;
  return Math.max(intervalMs, Math.min(retry.maxDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS, requestedDelay));
}

async function waitForRetryDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (delayMs <= 0) return;
  if (signal?.aborted) throw new Error('任务已被取消');
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('任务已被取消'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function buildResolvedRequestInit(poll: ResolvedPollConfig, apiKey: string | undefined): RequestInit {
  const errors: string[] = [];
  validateAuthentication(poll.auth, errors);
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(poll.headers ?? {})) {
    validateHeaderName(name, '轮询请求 ', errors);
    headers[name] = value;
  }
  if (errors.length > 0) throw new Error(errors[0]);

  const auth = resolveAuthentication(poll.auth);
  if (apiKey && auth.type === 'bearer') {
    headers.Authorization = `${auth.prefix ?? 'Bearer '}${apiKey}`;
  } else if (apiKey && auth.type === 'header') {
    headers[auth.name ?? 'Authorization'] = `${auth.prefix ?? ''}${apiKey}`;
  }
  const body = poll.method === 'GET' || poll.body === undefined
    ? undefined
    : serializeModelProtocolBody(poll.body, poll.bodyEncoding, headers);
  return {
    method: poll.method,
    headers,
    body,
  };
}

export async function pollResolvedModelProtocol(poll: ResolvedPollConfig, apiKey: string | undefined, signal?: AbortSignal, allowedBaseUrl?: string): Promise<ModelProtocolExecuteResult> {
  if (allowedBaseUrl) {
    const pollUrl = new URL(poll.url);
    const baseUrl = new URL(allowedBaseUrl);
    if (pollUrl.origin !== baseUrl.origin) {
      throw new Error('轮询地址与厂商连接地址不同源');
    }
  }
  const successValues = new Set(poll.successValues.map(normalizeStatus));
  const failureValues = new Set(poll.failureValues.map(normalizeStatus));
  const retry = resolvePollRetryConfig(poll.retry);
  const retryHttpStatuses = new Set(retry.httpStatuses);
  const pollStartedAt = Date.now();
  let consecutiveErrors = 0;
  let pendingExtraDelayMs = 0;
  const result = await pollTask({
    fetchState: async () => {
      if (pendingExtraDelayMs > 0) {
        const maxDurationMs = poll.maxDurationMs ?? Infinity;
        if (Date.now() - pollStartedAt + pendingExtraDelayMs >= maxDurationMs) {
          throw new Error('模型任务轮询超时');
        }
        const delayMs = pendingExtraDelayMs;
        pendingExtraDelayMs = 0;
        await waitForRetryDelay(delayMs, signal);
      }
      try {
        const response = await corsSafeFetch(
          applyQueryAuthentication(poll.url, poll.auth, apiKey),
          {
            ...buildResolvedRequestInit(poll, apiKey),
            signal,
          },
        );
        const payload = await readJsonResponse(response, '模型任务查询失败', poll.errorPath);
        consecutiveErrors = 0;
        return payload;
      } catch (error) {
        const retryAfterMs = error instanceof ModelProtocolHttpError ? error.retryAfterMs : undefined;
        const retryableHttpError = error instanceof ModelProtocolHttpError
          && retryHttpStatuses.has(error.status);
        const retryableNetworkError = retry.retryNetworkErrors
          && !(error instanceof ModelProtocolHttpError)
          && isTransientNetworkError(error);
        if ((retryableHttpError || retryableNetworkError) && consecutiveErrors < (retry.maxRetries ?? DEFAULT_MAX_QUERY_RETRIES)) {
          consecutiveErrors += 1;
          const retryDelayMs = calculateRetryDelayMs(
            poll.intervalMs,
            consecutiveErrors,
            retry,
            retryAfterMs,
          );
          pendingExtraDelayMs = Math.max(0, retryDelayMs - poll.intervalMs);
          return {};
        }
        throw error;
      }
    },
    isComplete: (payload) => {
      const status = normalizeStatus(readModelProtocolFirstScalar(payload, poll.statusPath));
      if (!successValues.has(status)) return null;
      const urls = poll.resultUrlPath ? readModelProtocolUrls(payload, poll.resultUrlPath) : [];
      const base64Urls = poll.resultBase64Path
        ? readModelProtocolUrls(payload, poll.resultBase64Path).map((value) =>
            normalizeBase64Result(value, poll.resultMimeType, poll.resultBase64Transform))
        : [];
      const textValue = poll.resultTextPath
        ? readModelProtocolFirstScalar(payload, poll.resultTextPath)
        : undefined;
      const text = textValue === undefined || textValue === null ? undefined : String(textValue);
      const mediaUrls = [...urls, ...base64Urls];
      if (mediaUrls.length === 0 && !text) throw new Error('模型任务完成但未返回配置的结果');
      return {
        ...(mediaUrls.length > 0 ? { urls: mediaUrls } : {}),
        ...(text ? { text } : {}),
      };
    },
    isFailed: (payload) => {
      const status = normalizeStatus(readModelProtocolFirstScalar(payload, poll.statusPath));
      if (!failureValues.has(status)) return null;
      const detail = poll.errorPath ? readModelProtocolFirstScalar(payload, poll.errorPath) : undefined;
      return `模型任务失败：${detail || status}`;
    },
    interval: poll.intervalMs,
    maxAttempts: poll.maxAttempts,
    maxDuration: poll.maxDurationMs,
    timeoutMsg: '模型任务轮询超时',
    signal,
  });
  if (result.urls && poll.resultFetchUrl) {
    if (!allowedBaseUrl) throw new Error('同源结果下载缺少厂商连接地址');
    return {
      ...result,
      urls: await fetchSameOriginResultUrls(
        result.urls,
        allowedBaseUrl,
        poll.auth,
        apiKey,
        poll.resultMimeType,
        signal,
      ),
    };
  }
  return result;
}
