/**
 * protocol/request — 把校验通过的协议渲染成真正的同源请求。
 * 请求地址由连接 baseUrl + 模板化相对路径拼出，并再次校验同源；
 * 鉴权头由统一注入，API Key 本身不进入模板上下文。
 * 对应 AI-Canvas-tauri 的 modelProtocolRequest.ts。
 */

import {
  redactModelProtocolMultipartPreview,
  serializeModelProtocolBody,
} from './body.js';
import { OMIT_TEMPLATE_VALUE, resolveAuthentication, validateRelativePath } from './shared.js';
import { renderTemplate, renderTemplateString } from './template.js';
import { parseModelExecutionProtocol } from './validation.js';
import type {
  AuthConfig,
  ModelProtocol,
  ModelProtocolRequestConfig,
  PreviewModelProtocolRequestOptions,
  ProtocolVariables,
  SubmitModelProtocolOptions,
} from '../types.js';

export function buildSameOriginUrl(baseUrl: string, request: ModelProtocolRequestConfig, context: ProtocolVariables): string {
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

function assertModelProtocolApiKey(auth: AuthConfig | undefined, apiKey: string | undefined): void {
  if (apiKey || resolveAuthentication(auth).type === 'none') return;
  throw new Error('该模型所在的连接还没有填写 API Key，请在「设置 → API Key」中补填后重试');
}

export function applyQueryAuthentication(rawUrl: string, auth: AuthConfig | undefined, apiKey: string | undefined): string {
  const resolvedAuth = resolveAuthentication(auth);
  if (resolvedAuth.type !== 'query' || !apiKey) return rawUrl;
  const url = new URL(rawUrl);
  url.searchParams.set(resolvedAuth.name ?? 'authorization', `${resolvedAuth.prefix ?? ''}${apiKey}`);
  return url.toString();
}

export function renderRequestHeaders(request: ModelProtocolRequestConfig, auth: AuthConfig | undefined, apiKey: string | undefined, context: ProtocolVariables): Record<string, string> {
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
    headers[resolvedAuth.name ?? 'Authorization'] = `${resolvedAuth.prefix ?? ''}${apiKey}`;
  }
  return headers;
}

export function renderRequestBody(request: ModelProtocolRequestConfig, context: ProtocolVariables): unknown {
  if (request.body === undefined) return undefined;
  const rendered = renderTemplate(request.body, context, { conditionalDirectives: true });
  return rendered === OMIT_TEMPLATE_VALUE ? undefined : rendered;
}

function serializedBodyByteLength(body: unknown): number {
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  if (body instanceof URLSearchParams) {
    return new TextEncoder().encode(body.toString()).byteLength;
  }
  throw new Error('调用协议无法计算该请求体的序列化字节数');
}

export function assertSerializedBodyWithinLimit(request: ModelProtocolRequestConfig, body: unknown, label: string): void {
  if (request.maxBodyBytes === undefined) return;
  const actualBytes = serializedBodyByteLength(body);
  if (actualBytes <= request.maxBodyBytes) return;
  throw new Error(
    `${label}序列化后为 ${actualBytes} 字节，超过调用协议 maxBodyBytes ${request.maxBodyBytes} 字节`,
  );
}

export function buildRequestInit(request: ModelProtocolRequestConfig, auth: AuthConfig | undefined, apiKey: string | undefined, context: ProtocolVariables, signal?: AbortSignal): RequestInit {
  const headers = renderRequestHeaders(request, auth, apiKey, context);
  const body = renderRequestBody(request, context);
  const serializedBody = request.method === 'GET' || body === undefined
    ? undefined
    : serializeModelProtocolBody(body, request.bodyEncoding, headers);
  if (serializedBody !== undefined) {
    assertSerializedBodyWithinLimit(request, serializedBody, '提交请求体');
  }
  return {
    method: request.method,
    headers,
    body: serializedBody,
    signal,
  };
}

export function buildModelProtocolRequest(options: SubmitModelProtocolOptions): { url: string; init: RequestInit; protocol: ModelProtocol; renderedBody?: unknown } {
  const protocol = parseModelExecutionProtocol(options.protocol);
  assertModelProtocolApiKey(protocol.auth, options.apiKey);
  const context: ProtocolVariables = { ...options.variables };
  const renderedBody = renderRequestBody(protocol.submit, context);
  const url = buildSameOriginUrl(options.baseUrl, protocol.submit, context);
  return {
    url: applyQueryAuthentication(url, protocol.auth, options.apiKey),
    init: buildRequestInit(protocol.submit, protocol.auth, options.apiKey, context, options.signal),
    protocol,
    ...(renderedBody === undefined ? {} : { renderedBody }),
  };
}

export function previewModelProtocolRequest(options: PreviewModelProtocolRequestOptions): { method: string; relativeUrl: string; headers: Record<string, string>; body?: unknown } {
  const built = buildModelProtocolRequest({ ...options, apiKey: '********' });
  const url = new URL(built.url);
  const headers: Record<string, string> = { ...(built.init.headers as Record<string, string> | undefined) };
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
