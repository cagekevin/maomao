/**
 * ai-relay 公共入口。
 *
 * 把 AI-Canvas-tauri 的 12 个 API 中转「连接层」整体搬到一个可独立运行的 Node 模块：
 *   - catalog：12 个中转的目录定义 + 自定义接口
 *   - baseUrl：地址规范化与兜底探测（稳定连接防线 1）
 *   - transport：稳定 HTTP 客户端（候选重试 + 429 退避 + 64MB 上限 + 可取消，防线 2）
 *   - catalogFetch：模型目录拉取（local-manifest 兜底，防线 3）
 *   - connection：连接测试
 *
 * 用法：
 *   import { listProviders, createRelay } from 'ai-relay';
 *   const relay = createRelay({ providerId: 'xai', apiKey: 'xai-...' });
 *   const test = await relay.testConnection();
 *   const models = await relay.listModels();
 *   const { response } = await relay.request({ method: 'POST', path: '/chat/completions', body: {...} });
 */
import { baseUrlCandidates } from './providerBaseUrl.js';
import { getProviderDefinitions, getProviderDefinition } from './providerCatalog.js';
import { stableRequest } from './httpTransport.js';
import { fetchProviderModelCatalog } from './providerCatalogFetch.js';
import { testConnection } from './connection.js';
import * as protocol from './protocol/index.js';
import {
  chat, streamChat, chatWithTools, generateImage, generateVideo, generateAudio, getModelProtocolPreset,
} from './generate.js';
import type {
  ProviderDefinition,
  CreateRelayConfig,
  CatalogModel,
  StableRequestOptions,
  ChatOptions,
  StreamChatOptions,
  ChatWithToolsResult,
  GenerateImageOptions,
  GenerateVideoOptions,
  GenerateAudioOptions,
} from './types.js';

export { baseUrlCandidates, normalizeBaseUrl } from './providerBaseUrl.js';
export { stableRequest, readCapped, buildAuthHeaders, RelayHttpError, DEFAULT_MAX_BYTES } from './httpTransport.js';
export {
  getProviderDefinitions, getProviderDefinition, isProviderModelVisible, isWebSearchProviderId,
  WEB_SEARCH_PROVIDER_IDS, BUILT_IN_PROVIDER_DEFINITIONS,
} from './providerCatalog.js';
export { fetchProviderModelCatalog } from './providerCatalogFetch.js';
export { testConnection } from './connection.js';

/** 声明式调用协议引擎（请求体序列化 / 模板渲染 / 同步·异步执行 / 轮询重试 / 结果抽取）。 */
export { protocol };
/** 各模态「配套支持」入口：文本（流式/非流式/带工具）、图片、视频、音频。 */
export { chat, streamChat, chatWithTools, generateImage, generateVideo, generateAudio, getModelProtocolPreset };

export function listProviders() {
  return getProviderDefinitions();
}

export function getProvider(id: string): ProviderDefinition | undefined {
  return getProviderDefinition(id);
}

/**
 * 为一个已配置的供应商创建中转客户端。
 * @param {object} config
 * @param {string} config.providerId  目录 ID（'xai' / 'sora2u' / 'custom-openai' ...）
 * @param {string} [config.apiKey]
 * @param {string} [config.baseUrl]    自定义接口地址（allowCustomBaseUrl 时生效）
 * @param {string} [config.catalogId]  连接实际的目录 ID（custom-openai 多连接时用）
 * @param {object} [config.auth]       覆盖鉴权（oauth 传 { type:'oauth', token }）
 */
export function createRelay(config: CreateRelayConfig) {
  const definition = getProviderDefinition(config.providerId, config);
  if (!definition) throw new Error(`未知厂商目录：${config.providerId}`);

  const effectiveBaseUrl = definition.allowCustomBaseUrl || !definition.defaultBaseUrl
    ? (config.baseUrl || definition.defaultBaseUrl)
    : definition.defaultBaseUrl;
  const candidates = baseUrlCandidates(effectiveBaseUrl ?? '');
  const auth = config.auth ?? (definition.authType === 'oauth' ? { type: 'oauth' } : { type: 'bearer' });

  return {
    providerId: config.providerId,
    definition,
    /** 列出该中转可用模型（远程拉取 + 本地清单兜底）。 */
    listModels(fallbackModels: CatalogModel[] | undefined, signal: AbortSignal | undefined) {
      return fetchProviderModelCatalog({
        providerId: config.providerId,
        config: { apiKey: config.apiKey, baseUrl: effectiveBaseUrl, catalogId: config.catalogId },
        fallbackModels,
        signal,
      });
    },
    /** 测试连接是否可用。 */
    testConnection(signal: AbortSignal | undefined) {
      return testConnection(config.providerId, { apiKey: config.apiKey, baseUrl: effectiveBaseUrl, catalogId: config.catalogId }, signal);
    },
    /**
     * 发起一次稳定请求。path 相对 baseUrl；自动套用 baseUrl 候选、requestQuery、鉴权、重试。
     * 返回原生 Response（已确认 ok），可用 response.json() / readCapped(response) 读取。
     */
    request(opts: StableRequestOptions) {
      return stableRequest({
        ...opts,
        baseUrl: effectiveBaseUrl ?? '',
        candidates,
        apiKey: config.apiKey,
        auth,
        requestQuery: definition.requestQuery,
      });
    },
    /** 文本生成（非流式）。 */
    chat(opts: ChatOptions) {
      return chat({ apiKey: config.apiKey, ...opts, baseUrl: effectiveBaseUrl ?? '' });
    },
    /** 文本生成（流式，逐 token 事件）。 */
    streamChat(opts: StreamChatOptions) {
      return streamChat({ apiKey: config.apiKey, ...opts, baseUrl: effectiveBaseUrl ?? '' });
    },
    /** 图片生成（OpenAI 兼容预设，或传入自定义 protocol）。 */
    generateImage(opts: GenerateImageOptions) {
      return generateImage({ apiKey: config.apiKey, ...opts, baseUrl: effectiveBaseUrl ?? '' });
    },
    /** 视频生成（异步协议 + 轮询，需传 protocol）。 */
    generateVideo(opts: GenerateVideoOptions) {
      return generateVideo({ apiKey: config.apiKey, ...opts, baseUrl: effectiveBaseUrl ?? '' });
    },
    /** 音频生成（异步协议 + 轮询，需传 protocol）。 */
    generateAudio(opts: GenerateAudioOptions) {
      return generateAudio({ apiKey: config.apiKey, ...opts, baseUrl: effectiveBaseUrl ?? '' });
    },
  };
}
