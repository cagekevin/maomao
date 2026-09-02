/**
 * protocol/executor — 协议「怎么跑」。
 *
 * 把 schema 校验过的协议变成一次真实调用：渲染模板变量 → 拼同源 URL 与鉴权 →
 * 序列化请求体 → 提交 →（异步时）按 statusPath 轮询 → 按 result 路径取回结果。
 * 全程只允许请求连接 Base URL 的同源地址，协议不能覆盖鉴权头、不能指向外站。
 */
import { pollTask } from '../core/polling';
import { relayFetch } from '../core/transport';
import type {
  ModelExecutionProtocol,
  ModelProtocolAuthConfig,
  ModelProtocolPollRetryConfig,
  ModelProtocolPollTemplate,
  ModelProtocolRequestTemplate,
  ModelProtocolResultConfig,
  ProtocolJsonValue,
  ResolvedModelProtocolPoll,
} from '../4-types/protocol';
import { redactModelProtocolMultipartPreview, serializeModelProtocolBody } from './body';
import {
  DEFAULT_MAX_QUERY_RETRIES,
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_RETRY_HTTP_STATUSES,
  FULL_TEMPLATE_RE,
  MIME_TYPE_RE,
  OMIT_TEMPLATE_VALUE,
  TEMPLATE_RE,
  isRecord,
  resolveAuthentication,
  validateAuthentication,
  validateHeaderName,
  validateRelativePath,
} from './internals';
import { parseModelExecutionProtocol } from './schema';
import {
  previewNormalizedModelProtocolResponse,
  readModelProtocolFirstScalar,
  readModelProtocolPathValues,
  readModelProtocolUrls,
  type ModelProtocolResponsePreviewEntry,
} from './response';
import type {
  BuildModelProtocolRequestOptions,
  BuiltModelProtocolRequest,
  ExecuteModelProtocolOptions,
  ExecuteModelProtocolResult,
  ModelProtocolRequestPreview,
  SubmitModelProtocolOptions,
  SubmittedModelProtocol,
} from './contract';

export type {
  BuildModelProtocolRequestOptions,
  BuiltModelProtocolRequest,
  ExecuteModelProtocolOptions,
  ExecuteModelProtocolResult,
  ModelProtocolRequestPreview,
  ModelProtocolResponsePreviewEntry,
  ModelProtocolVariables,
  SubmitModelProtocolOptions,
  SubmittedModelProtocol,
} from './contract';

export function previewModelProtocolResponse(
  protocolValue: ModelExecutionProtocol,
  payload: ProtocolJsonValue,
): ModelProtocolResponsePreviewEntry[] {
  return previewNormalizedModelProtocolResponse(
    parseModelExecutionProtocol(protocolValue),
    payload,
  );
}

function resolveContextPath(context: Record<string, unknown>, path: string): unknown {
  return readModelProtocolPathValues(context, path)[0];
}

function renderTemplateString(
  template: string,
  context: Record<string, unknown>,
): ProtocolJsonValue | typeof OMIT_TEMPLATE_VALUE {
  const fullMatch = FULL_TEMPLATE_RE.exec(template);
  if (fullMatch) {
    const resolved = resolveContextPath(context, fullMatch[1]);
    if (resolved === undefined) return OMIT_TEMPLATE_VALUE;
    return resolved as ProtocolJsonValue;
  }
  return template.replace(TEMPLATE_RE, (_match, path: string) => {
    const resolved = resolveContextPath(context, path);
    if (resolved === undefined) throw new Error(`调用协议变量 ${path} 没有可用值`);
    if (typeof resolved === 'object') throw new Error(`调用协议变量 ${path} 不能嵌入字符串`);
    return String(resolved);
  });
}

function renderTemplate(
  value: ProtocolJsonValue,
  context: Record<string, unknown>,
): ProtocolJsonValue | typeof OMIT_TEMPLATE_VALUE {
  if (typeof value === 'string') return renderTemplateString(value, context);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const rendered = renderTemplate(item, context);
      return rendered === OMIT_TEMPLATE_VALUE ? [] : [rendered];
    });
  }
  if (value && typeof value === 'object') {
    const entries: Array<[string, ProtocolJsonValue]> = [];
    for (const [key, item] of Object.entries(value)) {
      const rendered = renderTemplate(item, context);
      if (rendered !== OMIT_TEMPLATE_VALUE) entries.push([key, rendered]);
    }
    return Object.fromEntries(entries);
  }
  return value;
}

function buildSameOriginUrl(
  baseUrl: string,
  request: ModelProtocolRequestTemplate,
  context: Record<string, unknown>,
): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  const parsedBase = new URL(normalizedBase);
  const renderedPath = renderTemplateString(request.path, context);
  if (typeof renderedPath !== 'string') throw new Error('调用协议请求路径变量没有可用值');
  const errors: string[] = [];
  validateRelativePath(renderedPath, '请求 path', errors);
  if (errors.length > 0) throw new Error(errors[0]);

  const url = request.pathMode === 'origin'
    ? new URL(renderedPath, parsedBase.origin)
    : new URL(`${normalizedBase}${renderedPath}`);
  if (url.origin !== parsedBase.origin) throw new Error('调用协议不能请求连接地址以外的站点');

  for (const [key, rawValue] of Object.entries(request.query ?? {})) {
    const rendered = renderTemplate(rawValue, context);
    if (rendered === OMIT_TEMPLATE_VALUE || rendered === null) continue;
    if (typeof rendered === 'object') throw new Error(`查询参数 ${key} 必须是标量`);
    url.searchParams.set(key, String(rendered));
  }
  return url.toString();
}



/**
 * 协议声明了鉴权却拿不到 API Key 时直接拦下。
 * 否则请求会不带 Authorization 头照常发出去，用户看到的是上游一句 401 Invalid token，
 * 完全看不出是本地没填密钥——Agent 建的连接默认就是空密钥，很容易踩到。
 */
function assertModelProtocolApiKey(
  auth: ModelProtocolAuthConfig | undefined,
  apiKey: string,
): void {
  if (apiKey || resolveAuthentication(auth).type === 'none') return;
  throw new Error('该模型所在的连接还没有填写 API Key，请在「设置 → API Key」中补填后重试');
}

function applyQueryAuthentication(
  rawUrl: string,
  auth: ModelProtocolAuthConfig | undefined,
  apiKey: string,
): string {
  const resolvedAuth = resolveAuthentication(auth);
  if (resolvedAuth.type !== 'query' || !apiKey) return rawUrl;
  const url = new URL(rawUrl);
  url.searchParams.set(resolvedAuth.name!, `${resolvedAuth.prefix ?? ''}${apiKey}`);
  return url.toString();
}

function renderRequestHeaders(
  request: ModelProtocolRequestTemplate,
  auth: ModelProtocolAuthConfig | undefined,
  apiKey: string,
  context: Record<string, unknown>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, template] of Object.entries(request.headers ?? {})) {
    const rendered = renderTemplateString(template, context);
    if (rendered === OMIT_TEMPLATE_VALUE || rendered === null) continue;
    if (typeof rendered === 'object') throw new Error(`请求头 ${name} 必须是标量`);
    headers[name] = String(rendered);
  }
  const resolvedAuth = resolveAuthentication(auth);
  if (!apiKey) return headers;
  if (resolvedAuth.type === 'bearer') {
    headers.Authorization = `${resolvedAuth.prefix ?? 'Bearer '}${apiKey}`;
  } else if (resolvedAuth.type === 'header') {
    headers[resolvedAuth.name!] = `${resolvedAuth.prefix ?? ''}${apiKey}`;
  }
  return headers;
}

function renderRequestBody(
  request: ModelProtocolRequestTemplate,
  context: Record<string, unknown>,
): ProtocolJsonValue | undefined {
  if (request.body === undefined) return undefined;
  const rendered = renderTemplate(request.body, context);
  return rendered === OMIT_TEMPLATE_VALUE ? undefined : rendered;
}

function buildRequestInit(
  request: ModelProtocolRequestTemplate,
  auth: ModelProtocolAuthConfig | undefined,
  apiKey: string,
  context: Record<string, unknown>,
  signal?: AbortSignal,
  renderedBody?: ProtocolJsonValue,
): RequestInit {
  const headers = renderRequestHeaders(request, auth, apiKey, context);
  // 复用已渲染的请求体（调用方已渲染过一次），避免对模板重复渲染。
  const body = renderedBody ?? renderRequestBody(request, context);
  return {
    method: request.method,
    headers,
    body: request.method === 'GET' || body === undefined
      ? undefined
      : serializeModelProtocolBody(body, request.bodyEncoding, headers),
    signal,
  };
}

export function buildModelProtocolRequest(
  options: BuildModelProtocolRequestOptions,
): BuiltModelProtocolRequest {
  const protocol = parseModelExecutionProtocol(options.protocol);
  assertModelProtocolApiKey(protocol.auth, options.apiKey);
  const context: Record<string, unknown> = { ...options.variables };
  const renderedBody = renderRequestBody(protocol.submit, context);
  const url = buildSameOriginUrl(options.baseUrl, protocol.submit, context);
  return {
    url: applyQueryAuthentication(url, protocol.auth, options.apiKey),
    init: buildRequestInit(protocol.submit, protocol.auth, options.apiKey, context, options.signal, renderedBody),
    protocol,
    ...(renderedBody === undefined ? {} : { renderedBody }),
  };
}

export function previewModelProtocolRequest(
  options: Omit<SubmitModelProtocolOptions, 'apiKey'>,
): ModelProtocolRequestPreview {
  const built = buildModelProtocolRequest({
    ...options,
    apiKey: '********',
  });
  const url = new URL(built.url);
  const headers = { ...(built.init.headers as Record<string, string> | undefined) };
  const body = built.renderedBody === undefined
    ? undefined
    : built.protocol.submit.bodyEncoding === 'multipart'
      ? redactModelProtocolMultipartPreview(built.renderedBody)
      : built.renderedBody;
  return {
    method: built.init.method || built.protocol.submit.method,
    relativeUrl: `${url.pathname}${url.search}${url.hash}`,
    headers,
    ...(body === undefined ? {} : { body }),
  };
}

class ModelProtocolHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;

  constructor(
    status: number,
    message: string,
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ModelProtocolHttpError';
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

async function readJsonResponse(
  response: Response,
  label: string,
  errorPath?: string,
): Promise<ProtocolJsonValue> {
  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    let payload: unknown;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      payload = null;
    }
    const configuredMessage = errorPath && (isRecord(payload) || Array.isArray(payload))
      ? readModelProtocolFirstScalar(payload, errorPath)
      : undefined;
    const message = configuredMessage !== undefined && configuredMessage !== null
      ? String(configuredMessage)
      : isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string'
        ? payload.error.message
      : isRecord(payload) && typeof payload.message === 'string'
        ? payload.message
        : rawText.trim() || `${label} (${response.status})`;
    if (response.status === 429 && /no deployments available/i.test(message)) {
      throw new Error('所选模型暂无可用部署，请稍后手动重试（429）');
    }
    throw new ModelProtocolHttpError(
      response.status,
      `${label} (${response.status}): ${message}`,
      parseRetryAfterMs(response.headers.get('Retry-After')),
    );
  }
  const payload = await response.json().catch(() => null) as unknown;
  if (!isRecord(payload) && !Array.isArray(payload)) {
    throw new Error(`${label}：响应必须是 JSON 对象或数组`);
  }
  return payload as ProtocolJsonValue;
}

async function ensureSuccessfulRawResponse(
  response: Response,
  label: string,
  errorPath?: string,
): Promise<Response> {
  if (response.ok) return response;
  await readJsonResponse(response, label, errorPath);
  return response;
}

function encodeBytesBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64Bytes(value: string): Uint8Array {
  const encoded = /^data:[^;,]+;base64,/i.test(value)
    ? value.slice(value.indexOf(',') + 1)
    : value;
  const normalized = encoded.replace(/\s/g, '');
  try {
    const binary = atob(normalized);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error('模型响应中的 Base64 结果无效');
  }
}

function pcmS16LeToWav(pcm: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  if (pcm.byteLength % blockAlign !== 0) {
    throw new Error('模型响应中的 PCM 数据长度与声道配置不匹配');
  }
  const wav = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(wav.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      wav[offset + index] = value.charCodeAt(index);
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  wav.set(pcm, 44);
  return wav;
}

function normalizeBase64Result(
  value: string,
  mimeType: string,
  transform?: ModelProtocolResultConfig['base64Transform'],
): string {
  if (transform?.type === 'pcm-s16le-to-wav') {
    const wav = pcmS16LeToWav(
      decodeBase64Bytes(value),
      transform.sampleRate,
      transform.channels ?? 1,
    );
    return `data:audio/wav;base64,${encodeBytesBase64(wav)}`;
  }
  if (/^data:[^;,]+;base64,/i.test(value)) return value;
  return `data:${mimeType};base64,${encodeBytesBase64(decodeBase64Bytes(value))}`;
}

function buildResultAuthenticationHeaders(
  auth: ModelProtocolAuthConfig | undefined,
  apiKey: string,
): Record<string, string> {
  if (!apiKey) return {};
  const resolvedAuth = resolveAuthentication(auth);
  if (resolvedAuth.type === 'bearer') {
    return { Authorization: `${resolvedAuth.prefix ?? 'Bearer '}${apiKey}` };
  }
  if (resolvedAuth.type === 'header') {
    return { [resolvedAuth.name!]: `${resolvedAuth.prefix ?? ''}${apiKey}` };
  }
  return {};
}

async function fetchSameOriginResultUrls(
  urls: readonly string[],
  baseUrl: string,
  auth: ModelProtocolAuthConfig | undefined,
  apiKey: string,
  fallbackMimeType?: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const allowedOrigin = new URL(baseUrl).origin;
  return Promise.all(urls.map(async (rawUrl) => {
    const url = new URL(rawUrl);
    if (url.origin !== allowedOrigin) {
      throw new Error('模型结果下载地址与厂商连接地址不同源');
    }
    const response = await relayFetch(
      applyQueryAuthentication(url.toString(), auth, apiKey),
      { method: 'GET', headers: buildResultAuthenticationHeaders(auth, apiKey), signal },
    );
    await ensureSuccessfulRawResponse(response, '模型结果下载失败');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error('模型结果下载内容为空');
    const responseMimeType = response.headers.get('Content-Type')?.split(';')[0]?.trim();
    const mimeType = responseMimeType && MIME_TYPE_RE.test(responseMimeType)
      ? responseMimeType
      : fallbackMimeType ?? 'application/octet-stream';
    return `data:${mimeType};base64,${encodeBytesBase64(bytes)}`;
  }));
}

function resolvePoll(
  baseUrl: string,
  poll: ModelProtocolPollTemplate,
  auth: ModelProtocolAuthConfig | undefined,
  context: Record<string, unknown>,
): ResolvedModelProtocolPoll {
  if (poll.bodyEncoding === 'multipart') {
    throw new Error('异步轮询请求不支持 multipart 请求体');
  }
  const headers = renderRequestHeaders(poll, { type: 'none' }, '', context);
  const body = renderRequestBody(poll, context);
  if (poll.method !== 'GET' && body !== undefined) {
    serializeModelProtocolBody(body, poll.bodyEncoding, headers);
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

export async function submitModelProtocol(
  options: SubmitModelProtocolOptions,
): Promise<SubmittedModelProtocol> {
  const built = buildModelProtocolRequest(options);
  const protocol = built.protocol;
  const context: Record<string, unknown> = { ...options.variables };
  const response = await relayFetch(built.url, built.init);
  const responseConfig = protocol.response;

  if (protocol.mode === 'sync') {
    if (responseConfig.type === 'text') {
      await ensureSuccessfulRawResponse(response, '模型请求失败', responseConfig.errorPath);
      const text = await response.text();
      if (!text) throw new Error('模型响应中未找到文本结果');
      return { text };
    }
    if (responseConfig.type === 'binary') {
      await ensureSuccessfulRawResponse(response, '模型请求失败', responseConfig.errorPath);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error('模型响应中未找到二进制结果');
      const responseMimeType = response.headers.get('Content-Type')?.split(';')[0]?.trim();
      const mimeType = responseMimeType && MIME_TYPE_RE.test(responseMimeType)
        ? responseMimeType
        : responseConfig.result?.mimeType ?? 'application/octet-stream';
      return { urls: [`data:${mimeType};base64,${encodeBytesBase64(bytes)}`] };
    }
    const payload = await readJsonResponse(response, '模型请求失败', responseConfig.errorPath);
    const resultConfig = responseConfig.result!;
    let urls = resultConfig.urlPath ? readModelProtocolUrls(payload, resultConfig.urlPath) : [];
    if (resultConfig.fetchUrl) {
      urls = await fetchSameOriginResultUrls(
        urls,
        options.baseUrl,
        protocol.auth,
        options.apiKey,
        resultConfig.mimeType,
        options.signal,
      );
    }
    const base64Urls = resultConfig.base64Path
      ? readModelProtocolUrls(payload, resultConfig.base64Path).map((value) =>
          normalizeBase64Result(value, resultConfig.mimeType!, resultConfig.base64Transform))
      : [];
    const textValue = resultConfig.textPath
      ? readModelProtocolFirstScalar(payload, resultConfig.textPath)
      : undefined;
    const text = textValue === undefined || textValue === null ? undefined : String(textValue);
    const mediaUrls = [...urls, ...base64Urls];
    if (mediaUrls.length === 0 && !text) throw new Error('模型响应中未找到配置的结果');
    return {
      ...(mediaUrls.length > 0 ? { urls: mediaUrls } : {}),
      ...(text ? { text } : {}),
    };
  }

  const payload = await readJsonResponse(response, '模型请求失败', responseConfig.errorPath);
  const taskIdValue = readModelProtocolFirstScalar(payload, responseConfig.taskIdPath!);
  if (taskIdValue === undefined || taskIdValue === null || taskIdValue === '') {
    throw new Error(`模型提交响应中未找到任务 ID：${responseConfig.taskIdPath}`);
  }
  const pollContext = { ...context, submit: payload };
  return {
    taskId: String(taskIdValue),
    poll: resolvePoll(options.baseUrl, protocol.poll!, protocol.auth, pollContext),
  };
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : String(value ?? '').toLowerCase();
}

export function getDefaultModelProtocolPollRetryConfig(): Required<ModelProtocolPollRetryConfig> {
  return {
    httpStatuses: [...DEFAULT_RETRY_HTTP_STATUSES],
    maxRetries: DEFAULT_MAX_QUERY_RETRIES,
    backoff: 'fixed',
    maxDelayMs: DEFAULT_MAX_RETRY_DELAY_MS,
    honorRetryAfter: true,
    retryNetworkErrors: true,
  };
}

function resolvePollRetryConfig(
  value: ModelProtocolPollRetryConfig | undefined,
): Required<ModelProtocolPollRetryConfig> {
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

function calculateRetryDelayMs(
  intervalMs: number,
  retryCount: number,
  retry: Required<ModelProtocolPollRetryConfig>,
  retryAfterMs?: number,
): number {
  const multiplier = retry.backoff === 'exponential'
    ? 2 ** Math.max(0, retryCount - 1)
    : retry.backoff === 'linear'
      ? retryCount
      : 1;
  const backoffDelay = intervalMs * multiplier;
  const requestedDelay = retry.honorRetryAfter && retryAfterMs !== undefined
    ? Math.max(backoffDelay, retryAfterMs)
    : backoffDelay;
  return Math.max(intervalMs, Math.min(retry.maxDelayMs, requestedDelay));
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

function buildResolvedRequestInit(
  poll: ResolvedModelProtocolPoll,
  apiKey: string,
): RequestInit {
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
    headers[auth.name!] = `${auth.prefix ?? ''}${apiKey}`;
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

export type ModelProtocolPollPhase = 'processing' | 'completed' | 'failed';

/** 单轮轮询结果：外部调用方（如可 attach 的后端轮询句柄）每次 pollOnce 拿一轮状态 */
export interface ModelProtocolPollRound {
  phase: ModelProtocolPollPhase;
  /** completed 时结果（raw urls/text；未做 resultFetchUrl 同源下载，由调用方决定） */
  result?: ExecuteModelProtocolResult;
  /** failed 时错误消息 */
  error?: string;
  /** 非终态时协议声明到的进度 0-100（缺省 undefined） */
  progress?: number;
}

/**
 * 可复用的协议轮询驱动。
 *
 * 把"单轮查询 + 单轮内重试退避 + 状态/进度/结果/错误抽取"封装成一套原语，
 * 让【内部整体轮询 pollResolvedModelProtocol】与【外部逐轮打点】共用同一份逻辑，
 * 避免外部为拿中间进度/可 attach 而重抄 fetch+解析。
 *
 * 内部用法：pollResolvedModelProtocol 把它喂给 pollTask 一直跑到终态（能力不变）。
 * 外部用法：异步任务句柄拿到 poll 后，每次调 driver.pollOnce() 打一轮，
 *  phase=completed/failed 即终态停止；phase=processing 可拿 progress 并等 intervalMs 再打。
 */
export interface ModelProtocolPollDriver {
  intervalMs: number;
  maxAttempts?: number;
  maxDurationMs?: number;
  /** 单轮状态拉取（含单轮内重试退避），pollTask.fetchState 兼容 */
  fetchState: (signal?: AbortSignal) => Promise<ProtocolJsonValue>;
  /** 判完成，pollTask.isComplete 兼容 */
  isComplete: (payload: ProtocolJsonValue) => ExecuteModelProtocolResult | null;
  /** 判失败，pollTask.isFailed 兼容 */
  isFailed: (payload: ProtocolJsonValue) => string | null;
  /** 对外单轮：一次查询并归一成 {phase, result/error/progress}；终态后应停止调用 */
  pollOnce: (signal?: AbortSignal) => Promise<ModelProtocolPollRound>;
}

/** 构建协议轮询驱动：`poll` 必须是 submitModelProtocol 已渲染出的 ResolvedModelProtocolPoll。 */
export function buildModelProtocolPollDriver(
  poll: ResolvedModelProtocolPoll,
  apiKey: string,
  signal?: AbortSignal,
): ModelProtocolPollDriver {
  const successValues = new Set(poll.successValues.map(normalizeStatus));
  const failureValues = new Set(poll.failureValues.map(normalizeStatus));
  const retry = resolvePollRetryConfig(poll.retry);
  const retryHttpStatuses = new Set(retry.httpStatuses);
  const startedAt = Date.now();
  let consecutiveErrors = 0;
  let pendingExtraDelayMs = 0;

  const fetchState = async (runSignal?: AbortSignal): Promise<ProtocolJsonValue> => {
    const activeSignal = runSignal ?? signal;
    if (pendingExtraDelayMs > 0) {
      const maxDurationMs = poll.maxDurationMs ?? Infinity;
      if (Date.now() - startedAt + pendingExtraDelayMs >= maxDurationMs) {
        throw new Error('模型任务轮询超时');
      }
      const delayMs = pendingExtraDelayMs;
      pendingExtraDelayMs = 0;
      await waitForRetryDelay(delayMs, activeSignal);
    }
    try {
      const response = await relayFetch(
        applyQueryAuthentication(poll.url, poll.auth, apiKey),
        {
          ...buildResolvedRequestInit(poll, apiKey),
          signal: activeSignal,
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
      if ((retryableHttpError || retryableNetworkError) && consecutiveErrors < retry.maxRetries) {
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
  };

  const isComplete = (payload: ProtocolJsonValue): ExecuteModelProtocolResult | null => {
    const status = normalizeStatus(readModelProtocolFirstScalar(payload, poll.statusPath));
    if (!successValues.has(status)) return null;
    const urls = poll.resultUrlPath ? readModelProtocolUrls(payload, poll.resultUrlPath) : [];
    const base64Urls = poll.resultBase64Path
      ? readModelProtocolUrls(payload, poll.resultBase64Path).map((value) =>
          normalizeBase64Result(value, poll.resultMimeType!, poll.resultBase64Transform))
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
  };

  const isFailed = (payload: ProtocolJsonValue): string | null => {
    const status = normalizeStatus(readModelProtocolFirstScalar(payload, poll.statusPath));
    if (!failureValues.has(status)) return null;
    const detail = poll.errorPath ? readModelProtocolFirstScalar(payload, poll.errorPath) : undefined;
    return `模型任务失败：${detail || status}`;
  };

  const pollOnce = async (runSignal?: AbortSignal): Promise<ModelProtocolPollRound> => {
    const payload = await fetchState(runSignal);
    const failedMsg = isFailed(payload);
    if (failedMsg) return { phase: 'failed', error: failedMsg };
    const completed = isComplete(payload);
    if (completed) return { phase: 'completed', result: completed };
    let progress: number | undefined;
    if (poll.progressPath) {
      const rawProg = readModelProtocolFirstScalar(payload, poll.progressPath);
      if (typeof rawProg === 'number' && Number.isFinite(rawProg)) progress = rawProg;
      else if (typeof rawProg === 'string' && rawProg.trim() !== '' && Number.isFinite(Number(rawProg))) {
        progress = Number(rawProg);
      }
    }
    return { phase: 'processing', ...(progress === undefined ? {} : { progress }) };
  };

  return {
    intervalMs: poll.intervalMs,
    maxAttempts: poll.maxAttempts,
    maxDurationMs: poll.maxDurationMs,
    fetchState,
    isComplete,
    isFailed,
    pollOnce,
  };
}

export async function pollResolvedModelProtocol(
  poll: ResolvedModelProtocolPoll,
  apiKey: string,
  signal?: AbortSignal,
  allowedBaseUrl?: string,
): Promise<ExecuteModelProtocolResult> {
  if (allowedBaseUrl) {
    const pollUrl = new URL(poll.url);
    const baseUrl = new URL(allowedBaseUrl);
    if (pollUrl.origin !== baseUrl.origin) {
      throw new Error('轮询地址与厂商连接地址不同源');
    }
  }
  const driver = buildModelProtocolPollDriver(poll, apiKey, signal);
  const result = await pollTask<ProtocolJsonValue, ExecuteModelProtocolResult>({
    fetchState: driver.fetchState,
    isComplete: driver.isComplete,
    isFailed: driver.isFailed,
    interval: driver.intervalMs,
    maxAttempts: driver.maxAttempts,
    maxDuration: driver.maxDurationMs,
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

export async function executeModelProtocol(
  options: ExecuteModelProtocolOptions,
): Promise<ExecuteModelProtocolResult> {
  const submitted = await submitModelProtocol(options);
  if (submitted.urls) return { urls: submitted.urls };
  if (submitted.text) return { text: submitted.text };
  if (!submitted.poll) throw new Error('异步调用协议未生成轮询配置');
  return {
    ...await pollResolvedModelProtocol(
      submitted.poll,
      options.apiKey,
      options.signal,
      options.baseUrl,
    ),
    taskId: submitted.taskId,
  };
}
