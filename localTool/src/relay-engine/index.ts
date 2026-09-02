/**
 * ai-relay-kit —— 多平台 API 中转 / 声明式模型调用协议工具箱。
 *
 * 【怎么用】绝大多数场景只需要一个入口：
 *
 * ```ts
 * import { createRelay } from 'ai-relay-kit';
 *
 * const relay = createRelay();
 * const { urls } = await relay.generate.image({
 *   connection: { apiKey: 'sk-...', baseUrl: 'https://你的中转站/v1' },
 *   model: 'gpt-image-1',
 *   prompt: '一只在屋顶上看海的猫',
 *   aspectRatio: '16:9',
 * });
 * ```
 *
 * `createRelay()` 返回的 `Relay` 对象就是本模块的全部对外接口（深模块：窄接口、深实现）。
 * 需要绕过门面直接操作协议引擎时，用文件末尾的「逃生舱」导出。
 *
 * 字段级说明见 `docs/API字段全表.md`，每个文件的职责见 `ARCHITECTURE.md`。
 */

// ══════════════════════════════════════════════════════════════
// 主入口：深模块门面
// ══════════════════════════════════════════════════════════════
export { createRelay, type Relay } from './relay';
export {
  RELAY_CAPABILITIES,
  capabilitiesByGroup,
  describeCapabilities,
  type RelayCapability,
} from './capabilities';

// ══════════════════════════════════════════════════════════════
// 对外类型（接入方需要写的入参 / 会拿到的出参）
// ══════════════════════════════════════════════════════════════
export type {
  ConnectionTestInput,
  ConnectionTestResult,
  GenerateAudioInput,
  GenerateImageInput,
  GenerateMediaResult,
  GenerateResult,
  GenerateTextInput,
  GenerateTextResult,
  GenerateVideoInput,
  RelayCredential,
  RelayModelRef,
  RelayOptions,
  RunModelInput,
} from './contract';

export type {
  ApiProviderConfig,
  AppConfig,
  GeneralModelCategory,
  GeneralModelConfig,
  ImageReferenceRequestMode,
  ProviderCatalogAdapter,
  ProviderModelSelection,
  WebSearchProviderId,
} from './4-types/connection';

export type {
  ModelExecutionProtocol,
  ModelExecutionProtocolV1,
  ModelExecutionProtocolV2,
  ModelExecutionProfile,
  ModelProtocolAuthConfig,
  ModelProtocolBodyEncoding,
  ModelProtocolHttpMethod,
  ModelProtocolPollRetryConfig,
  ModelProtocolPollTemplate,
  ModelProtocolRequestTemplate,
  ModelProtocolResponseConfig,
  ModelProtocolResponseType,
  ModelProtocolResultConfig,
  NormalizedModelExecutionProtocol,
  ProtocolJsonValue,
  ResolvedModelProtocolPoll,
  VideoModelCapability,
} from './4-types/protocol';

// ══════════════════════════════════════════════════════════════
// 逃生舱：绕过门面直接操作底层（自定义流程、测试、扩展）
// ══════════════════════════════════════════════════════════════

// ── 传输与工具 ──
export {
  relayFetch,
  setRelayTransport,
  getRelayTransport,
  logAiRequest,
  type RelayTransport,
} from './core/transport';
export { buildAuthHeaders, parseResponseError } from './core/http-utils';
export { createTauriTransport, isTauriRuntime, type TauriBridge } from './core/tauri-transport';
export { normalizeBaseUrl, baseUrlCandidates } from './core/base-url';
export { pollTask, type PollTaskOptions } from './core/polling';

// ── 声明式协议 ──
export {
  getDefaultCustomProtocol,
  getModelProtocolPreset,
  modelProtocolUsesVariable,
  normalizeFrames8n1,
  parseModelExecutionProtocol,
  resolveModelExecutionProfile,
  validateModelExecutionProtocol,
} from './2-engine/schema';
export {
  buildModelProtocolRequest,
  executeModelProtocol,
  getDefaultModelProtocolPollRetryConfig,
  pollResolvedModelProtocol,
  previewModelProtocolRequest,
  previewModelProtocolResponse,
  submitModelProtocol,
  type BuildModelProtocolRequestOptions,
  type BuiltModelProtocolRequest,
  type ExecuteModelProtocolOptions,
  type ExecuteModelProtocolResult,
  type ModelProtocolRequestPreview,
  type ModelProtocolResponsePreviewEntry,
  type ModelProtocolVariables,
  type SubmitModelProtocolOptions,
  type SubmittedModelProtocol,
} from './2-engine/executor';
export {
  PROTOCOL_VARIABLES,
  PROTOCOL_VARIABLE_NAMES,
  REFERENCE_PROTOCOL_VARIABLES,
  IMAGE_ARRAY_FIELDS,
  IMAGE_SINGLE_FIELDS,
  getCategoryProtocolVariables,
  resolveProtocolFieldTemplate,
  type ProtocolVariableSpec,
} from './2-engine/variables';
export { serializeModelProtocolBody, redactModelProtocolMultipartPreview } from './2-engine/body';
export {
  readModelProtocolFirstScalar,
  readModelProtocolPathValues,
  readModelProtocolUrls,
  previewNormalizedModelProtocolResponse,
} from './2-engine/response';
export {
  analyzeModelProtocolDocument,
  analyzeModelProtocolExamples,
  type ModelProtocolExamples,
  type ModelProtocolImportResult,
  type ModelProtocolImportOptions,
} from './2-engine/import';

// ── 厂商与目录 ──
export {
  MAX_CACHED_CATALOG_MODELS,
  WEB_SEARCH_PROVIDER_IDS,
  capCatalogModels,
  createConnectionId,
  fetchProviderModelCatalog,
  getProviderDefinition,
  getProviderDefinitions,
  getWebSearchProviderDefinitions,
  isProviderModelVisible,
  isWebSearchProviderId,
  resolveWebSearchProviderId,
  type ProviderAuthType,
  type ProviderCatalogResult,
  type ProviderCredentialField,
  type ProviderDefinition,
  type FetchProviderCatalogOptions,
} from './_aux/providers/catalog';
export { testConnection } from './_aux/providers/connection-test';
export {
  APIMART_BASE_URL,
  VOLCENGINE_BASE_URL,
  GRSAI_BASE_URL,
  DREAMINA_BASE_URL,
  RUNNINGHUB_BASE_URL,
  RUNNINGHUB_MODEL_BASE_URL,
  TAVILY_BASE_URL,
  BOCHA_SEARCH_BASE_URL,
  ZHIPU_SEARCH_BASE_URL,
  EXA_SEARCH_BASE_URL,
  DEFAULT_BASE_URLS,
} from './_aux/providers/base-urls';
export { XAI_BASE_URL, XAI_MODEL_MANIFEST } from './_aux/providers/manifests/xai';
export { GOOGLE_GEMINI_BASE_URL, GOOGLE_MODEL_MANIFEST } from './_aux/providers/manifests/google';
export { SORA2U_BASE_URL, SORA2U_MODEL_MANIFEST, SORA2U_REQUEST_QUERY } from './_aux/providers/manifests/sora2u';

// ── 文档抓取与中转站探测（「不知道对方 API 长什么样」时的起点） ──
export {
  discoverProvider,
  probeStation,
  type DiscoveredModel,
  type DiscoverOptions,
  type ProviderDiscovery,
} from './_aux/docs/discover';
export {
  readProviderDocsPage,
  sliceDocText,
  type ProviderDocLink,
  type ProviderDocsPage,
} from './_aux/docs/reader';
export { normalizeDocUrl, isDocUrlAllowed, isSameOrigin, extractDocUrls } from './_aux/docs/safety';
export { shouldRenderDynamicHtml } from './_aux/docs/spa-detect';
export {
  setDocBridge,
  getDocBridge,
  createTauriDocBridge,
  createStaticDocBridge,
  type DocBridge,
  type NativeDocResponse,
} from './_aux/docs/bridge';
export {
  beginProviderDocRead,
  completeProviderDocRead,
  releaseProviderDocRead,
  isProviderDocUrlGranted,
  listProviderDocGrants,
  getProviderDocRemainingTextChars,
  clearProviderDocsTask,
  clearProviderDocsGrantsForTests,
  type ProviderDocReadCompletion,
  type ProviderDocReadReservation,
} from './_aux/docs/grant';

// ── 连接分享 ──
export {
  parseConnectionShare,
  serializeConnection,
  type ParsedConnectionShare,
} from './_aux/share/connection';

// ── new-api 中转站 ──
export {
  buildGroupedModelChoiceList,
  buildRelayCatalogContent,
  inferRelayModelCategory,
  parseNewApiPricingPayload,
  parseNewApiStatusPayload,
  type NewApiPricingItem,
  type NewApiStatusInfo,
} from './_aux/stations/new-api';

// ── 生成入口（可单独用，不必经过 createRelay） ──
export { generateText, buildChatMessages } from './1-intent/text';
export { generateImage } from './1-intent/image';
export { generateVideo } from './1-intent/video';
export { generateAudio } from './1-intent/audio';
export { runModel, findUnusedReferenceVariables } from './1-intent/run';
