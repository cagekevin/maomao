/**
 * types — ai-relay 的共享类型定义（统一给 strict 标注用）。
 *
 * 这里集中声明：供应商目录、鉴权、模型清单、稳定请求、声明式调用协议、
 * 流式事件。协议内部是高度动态的（模板字符串、点号路径遍历），因此
 * 请求/响应配置的「值」多处用 unknown/Record<string, unknown>，
 * 仅在边界（公共函数入参/出参）做强类型。
 */

import type { ModelProtocolResponsePreviewEntry } from './protocol/response.js';

/* ------------------------------------------------------------------ */
/* 鉴权                                                                */
/* ------------------------------------------------------------------ */

export type AuthType = 'bearer' | 'header' | 'query' | 'oauth' | 'none' | 'hmac';

export interface AuthConfig {
  type: AuthType;
  /** header / query 鉴权时的字段名 */
  name?: string;
  /** 拼接在 key 前的固定前缀（如 "Bearer " / "Key "） */
  prefix?: string;
  /** oauth 时直接给 token */
  token?: string;
  /** hmac 鉴权时的访问凭证（Lovart 原生 Agent 协议） */
  accessKey?: string;
  /** hmac 鉴权时的签名密钥 */
  secretKey?: string;
}

/* ------------------------------------------------------------------ */
/* 供应商目录                                                          */
/* ------------------------------------------------------------------ */

export type CatalogAdapter = 'openai-compatible' | 'local-manifest';
export type ModelCategory = 'text' | 'image' | 'video' | 'audio';

export interface CredentialField {
  key: string;
  label: string;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
}

export interface CatalogModel {
  id: string;
  name: string;
  category: ModelCategory | string;
  provider: string;
  description?: string;
  inputModalities?: string[];
  videoCapability?: Record<string, unknown>;
  /** 连接层预先过滤、不再暴露给 UI 的模型 id */
  hiddenModelIds?: string[];
}

export interface ProviderDefinition {
  id: string;
  name: string;
  description?: string;
  badgeText?: string;
  authType: 'api-key' | 'oauth';
  catalogAdapter: CatalogAdapter;
  defaultBaseUrl?: string;
  modelsPath?: string;
  allowCustomBaseUrl?: boolean;
  credentials: CredentialField[];
  models?: CatalogModel[];
  externalUrl?: string;
  connectionTestPath?: string;
  requestQuery?: Record<string, string>;
  hiddenModelIds?: string[];
  kind?: string;
}

export interface CatalogFetchResult {
  models: CatalogModel[];
  source: 'local-manifest' | 'remote' | 'local-fallback';
  resolvedBaseUrl?: string;
  warning?: string;
}

export interface CatalogFetchOptions {
  providerId: string;
  config: { apiKey?: string; baseUrl?: string; catalogId?: string };
  fallbackModels?: CatalogModel[];
  signal?: AbortSignal;
}

export interface ConnectionTestResult {
  ok: boolean;
  status: number;
  resolvedBaseUrl?: string;
  warning?: string;
  /**
   * 连接测试顺带返回的余额文本（如 "1100 积分" / "58.20 USD"）。
   * 由 connection.ts 的 fetchBalance 原型填充；原型阶段仅部分厂商支持。
   */
  balance?: string;
}

export interface CreateRelayConfig {
  providerId: string;
  apiKey?: string;
  baseUrl?: string;
  catalogId?: string;
  auth?: AuthConfig;
  /** Lovart 直连（hmac）专用：访问凭证（与 apiKey 二选一，按 provider 而定） */
  accessKey?: string;
  /** Lovart 直连（hmac）专用：签名密钥 */
  secretKey?: string;
}

/* ------------------------------------------------------------------ */
/* 稳定 HTTP 请求                                                      */
/* ------------------------------------------------------------------ */

export interface StableRequestOptions {
  method?: string;
  path?: string;
  baseUrl?: string;
  candidates?: string[];
  apiKey?: string;
  auth?: AuthConfig;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  requestQuery?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
  maxRetries?: number;
  /** 底层 fetch 实现；缺省全局 fetch。lovart 等需走代理的域名注入 fetchWithProxy。 */
  fetchImpl?: typeof fetch;
}

export interface StableRequestResult {
  response: Response;
  resolvedBaseUrl: string;
}

/* ------------------------------------------------------------------ */
/* 声明式调用协议                                                      */
/* ------------------------------------------------------------------ */

export interface ModelProtocolResultConfig {
  urlPath?: string;
  textPath?: string;
  base64Path?: string;
  mimeType?: string;
  fetchUrl?: boolean;
  base64Transform?: { type: 'pcm-s16le-to-wav'; sampleRate: number; channels?: number };
}

export interface ModelProtocolResponseConfig {
  type: 'json' | 'text' | 'binary';
  result?: ModelProtocolResultConfig;
  errorPath?: string;
  taskIdPath?: string;
}

export interface ModelProtocolPollResponseConfig {
  statusPath: string;
  successValues: string[];
  failureValues: string[];
  result: ModelProtocolResultConfig;
  errorPath?: string;
  progressPath?: string;
}

export interface ModelProtocolRequestConfig {
  method: 'GET' | 'POST';
  path: string;
  pathMode?: 'append' | 'origin';
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  bodyEncoding?: 'json' | 'form-urlencoded' | 'multipart';
  maxBodyBytes?: number;
}

export interface ModelProtocolRetryConfig {
  httpStatuses?: number[];
  maxRetries?: number;
  backoff?: 'fixed' | 'linear' | 'exponential';
  maxDelayMs?: number;
  honorRetryAfter?: boolean;
  retryNetworkErrors?: boolean;
}

export interface ModelProtocolPollConfig extends ModelProtocolRequestConfig {
  response: ModelProtocolPollResponseConfig;
  intervalMs?: number;
  maxAttempts?: number;
  maxDurationMs?: number;
  retry?: ModelProtocolRetryConfig;
}

export interface ModelProtocol {
  version: 1 | 2;
  mode: 'sync' | 'async';
  streamFormat?: 'openai-sse';
  auth?: AuthConfig;
  submit: ModelProtocolRequestConfig;
  response: ModelProtocolResponseConfig;
  poll?: ModelProtocolPollConfig;
}

export type ModelProtocolPresetName = 'openai-chat' | 'openai-image' | 'agnes-video' | 'custom'; // custom = per-provider 自定义协议（relay-poll 按 provider 读取 model_protocols，见 providerConfigStore）

export interface ModelProtocolProfile {
  preset: ModelProtocolPresetName;
  protocol?: ModelProtocol;
}

/** 协议模板可引用的变量上下文（白名单见 protocol/variables.ts）。 */
export type ProtocolVariables = Record<string, unknown>;

export interface SubmitModelProtocolOptions {
  protocol: ModelProtocol;
  apiKey?: string;
  baseUrl: string;
  variables: ProtocolVariables;
  signal?: AbortSignal;
}

export interface ResolvedPollConfig {
  method: 'GET' | 'POST';
  url: string;
  auth: AuthConfig;
  headers: Record<string, string>;
  bodyEncoding?: 'json' | 'form-urlencoded' | 'multipart';
  body?: unknown;
  statusPath: string;
  successValues: string[];
  failureValues: string[];
  resultUrlPath?: string;
  resultTextPath?: string;
  resultBase64Path?: string;
  resultMimeType?: string;
  resultBase64Transform?: { type: 'pcm-s16le-to-wav'; sampleRate: number; channels?: number };
  resultFetchUrl?: boolean;
  errorPath?: string;
  progressPath?: string;
  intervalMs: number;
  maxAttempts?: number;
  maxDurationMs?: number;
  retry?: ModelProtocolRetryConfig;
}

export interface ModelProtocolSubmitResult {
  text?: string;
  urls?: string[];
  taskId?: string;
  poll?: ResolvedPollConfig;
}

export interface ModelProtocolExecuteResult {
  text?: string;
  urls?: string[];
  taskId?: string;
}

export interface PreviewModelProtocolRequestOptions {
  protocol: ModelProtocol;
  apiKey?: string;
  baseUrl: string;
  variables: ProtocolVariables;
  signal?: AbortSignal;
}

/* ------------------------------------------------------------------ */
/* 流式事件                                                            */
/* ------------------------------------------------------------------ */

export type AssistantStreamEvent =
  | { type: 'start'; requestId: string; modelId: string }
  | { type: 'text.delta'; delta: string }
  | { type: 'tool.call.delta'; callId: string; delta: string }
  | { type: 'tool.call.final'; call: { callId: string; toolId: string; input: unknown } }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; code: string; message: string; retryable: boolean }
  | { type: 'done'; finishReason: string };

export interface ParseStreamOptions {
  requestId?: string;
  modelId?: string;
  onEvent: (event: AssistantStreamEvent) => void;
  signal?: AbortSignal;
}

/* ------------------------------------------------------------------ */
/* generate 入口                                                       */
/* ------------------------------------------------------------------ */

export interface ChatOptions {
  apiKey?: string;
  baseUrl: string;
  model: string;
  messages: unknown[];
  signal?: AbortSignal;
  tools?: unknown;
  toolChoice?: unknown;
  timeoutMs?: number;
}

/** 画布 Agent 需要的 chat 响应：文本或/且工具调用（非流式一次返回）。 */
export interface ChatWithToolsResult {
  text: string;
  toolCalls?: unknown[];
  finishReason?: string;
}

export interface StreamChatOptions {
  apiKey?: string;
  baseUrl: string;
  model: string;
  messages: unknown[];
  signal?: AbortSignal;
  onEvent: (event: AssistantStreamEvent) => void;
  timeoutMs?: number;
}

export interface GenerateImageOptions {
  apiKey?: string;
  baseUrl: string;
  model: string;
  prompt: string;
  size?: string;
  width?: number;
  height?: number;
  imageUrls?: string[];
  n?: number;
  protocol?: ModelProtocol;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface GenerateVideoOptions {
  apiKey?: string;
  baseUrl: string;
  model: string;
  variables: ProtocolVariables;
  protocol: ModelProtocol;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface GenerateAudioOptions {
  apiKey?: string;
  baseUrl: string;
  model: string;
  variables: ProtocolVariables;
  protocol: ModelProtocol;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type { ModelProtocolResponsePreviewEntry };
