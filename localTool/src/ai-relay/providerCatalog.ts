/**
 * 12 个 API 中转的目录定义表。
 * 从 AI-Canvas-tauri src/services/ai/providerCatalogService.ts 搬出。
 *
 * 每个中转的连接元数据都在这里集中声明：默认 baseUrl、鉴权类型、模型目录适配器、
 * 模型列表路径、连接测试路径、固定查询参数、隐藏模型、内置模型清单、是否联网搜索类。
 * 下游的「稳定连接」完全基于这张表驱动。
 */
import {
  APIMART_BASE_URL, BOCHA_SEARCH_BASE_URL, EXA_SEARCH_BASE_URL, GRSAI_BASE_URL,
  RUNNINGHUB_MODEL_BASE_URL, TAVILY_BASE_URL, VOLCENGINE_BASE_URL, ZHIPU_SEARCH_BASE_URL,
  SORA2U_BASE_URL, SORA2U_REQUEST_QUERY, XAI_BASE_URL, GOOGLE_GEMINI_BASE_URL,
  LOVART_DIRECT_BASE_URL,
} from './providerEndpoints.js';
import { XAI_MODEL_MANIFEST } from './manifests/xaiModelManifest.js';
import { GOOGLE_MODEL_MANIFEST } from './manifests/googleModelManifest.js';
import { SORA2U_MODEL_MANIFEST } from './manifests/sora2uModelManifest.js';
import { RUNNINGHUB_MODEL_MANIFEST } from './manifests/runninghubModelManifest.js';
import { LOVART_MODEL_MANIFEST } from './manifests/lovartModelManifest.js';
import type { ProviderDefinition } from './types.js';

const API_KEY_FIELD: ProviderDefinition['credentials'][number] = { key: 'apiKey', label: 'API Key', required: true, secret: true };

export const WEB_SEARCH_PROVIDER_IDS = ['tavily', 'bocha', 'zhipu-search', 'exa'];

export const BUILT_IN_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'apimart',
    name: 'APIMart',
    description: 'OpenAI 兼容的多类型模型服务',
    badgeText: 'AM',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    defaultBaseUrl: APIMART_BASE_URL,
    modelsPath: '/models',
    allowCustomBaseUrl: false,
    credentials: [API_KEY_FIELD, { key: 'baseUrl', label: '接口地址', required: false, placeholder: APIMART_BASE_URL }],
  },
  {
    id: 'xai',
    name: 'xAI / Grok 官方',
    description: 'Grok 官方文本、图片与视频模型',
    badgeText: 'xAI',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: XAI_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: 'xai-...' }],
    models: XAI_MODEL_MANIFEST,
  },
  {
    id: 'google',
    name: 'Google Gemini 官方',
    description: 'Gemini 文本、Nano Banana 图片、Omni/Veo 视频与 TTS',
    badgeText: 'G',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: GOOGLE_GEMINI_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: 'Google AI Studio API Key' }],
    models: GOOGLE_MODEL_MANIFEST,
  },
  {
    id: 'sora2u',
    name: 'Sora2U',
    description: 'Seedance 全模态视频与 Gemini/Kontext 图片模型',
    badgeText: 'S2U',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    defaultBaseUrl: SORA2U_BASE_URL,
    modelsPath: '/api/v1/models',
    allowCustomBaseUrl: false,
    externalUrl: 'https://sora2u.com/?utm_source=tenney&utm_medium=canvas&utm_content=wx',
    connectionTestPath: '/api/v1/credits',
    requestQuery: SORA2U_REQUEST_QUERY,
    credentials: [{ ...API_KEY_FIELD, placeholder: 'sk_sora_...' }],
    models: SORA2U_MODEL_MANIFEST,
  },
  {
    id: 'volcengine',
    name: '火山方舟',
    description: '火山引擎方舟模型服务',
    badgeText: 'V',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    defaultBaseUrl: VOLCENGINE_BASE_URL,
    modelsPath: '/models',
    allowCustomBaseUrl: false,
    credentials: [API_KEY_FIELD, { key: 'baseUrl', label: '接口地址', required: false, placeholder: VOLCENGINE_BASE_URL }],
  },
  {
    id: 'runninghub-model',
    name: 'RunningHub',
    description: 'RunningHub 标准模型 API 与工作流',
    badgeText: 'RH',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: RUNNINGHUB_MODEL_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, label: '企业级-共享 API Key', placeholder: '用于 RunningHub 标准模型 API' }],
    models: RUNNINGHUB_MODEL_MANIFEST,
  },
  {
    id: 'grsai',
    name: 'GRSAI',
    description: '图像生成与多模态文本模型服务',
    badgeText: 'GR',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: GRSAI_BASE_URL,
    allowCustomBaseUrl: false,
    credentials: [API_KEY_FIELD, { key: 'baseUrl', label: '接口地址', required: false, placeholder: GRSAI_BASE_URL }],
    // GRSAI 原工程未内置模型清单：连接层返回空，由用户填模型 ID 或远程拉取补充。
    models: [],
  },
  {
    id: 'dreamina',
    name: '即梦',
    description: '通过官方 OAuth 登录使用即梦模型',
    badgeText: 'JM',
    authType: 'oauth',
    catalogAdapter: 'local-manifest',
    credentials: [],
  },
  {
    id: 'tavily',
    name: 'Tavily',
    description: '面向 AI Agent 的搜索与来源服务',
    badgeText: 'TV',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: TAVILY_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: 'tvly-...' }],
    kind: 'web-search',
  },
  {
    id: 'bocha',
    name: '博查 Web Search',
    description: '国内网络环境友好的结构化搜索服务',
    badgeText: 'BC',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: BOCHA_SEARCH_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: 'sk-...' }],
    kind: 'web-search',
  },
  {
    id: 'zhipu-search',
    name: '智谱联网搜索',
    description: '智谱开放平台提供的 Web Search API',
    badgeText: 'ZP',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: ZHIPU_SEARCH_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: '智谱 API Key' }],
    kind: 'web-search',
  },
  {
    id: 'exa',
    name: 'Exa',
    description: '支持语义检索与网页摘要的搜索服务',
    badgeText: 'EX',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: EXA_SEARCH_BASE_URL,
    credentials: [{ ...API_KEY_FIELD, placeholder: 'Exa API Key' }],
    kind: 'web-search',
  },
  {
    id: 'custom-openai',
    name: '自定义接口',
    description: 'OpenAI 兼容接口；非标准接口用模型的调用协议单独声明',
    badgeText: 'API',
    authType: 'api-key',
    catalogAdapter: 'openai-compatible',
    modelsPath: '/models',
    allowCustomBaseUrl: true,
    credentials: [API_KEY_FIELD, { key: 'baseUrl', label: '接口地址', required: true }],
  },
  // ── 旧轨：lovart-old（apimart 系 / 9004 本地网关，退役回退）──
  // 双轨已收敛到直连 lovart(lgw.lovart.ai)；本轨留作 9004 回退，后续删除。
  {
    id: 'lovart-old',
    name: 'Lovart Old',
    description: 'Lovart / APIMart 本地网关（9004，旧轨回退），异步生图/生视频 + 文本',
    badgeText: 'LV',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: 'http://127.0.0.1:9004',
    allowCustomBaseUrl: false,
    credentials: [{ ...API_KEY_FIELD, label: 'Lovart Key' }],
    models: LOVART_MODEL_MANIFEST,
  },
  // ── Lovart 原生 Agent 协议直连（lgw.lovart.ai，正式主平台，取代 9004）──
  // 走 providers/lovart 命令式 adapter（HMAC 鉴权 + project/轮询/confirm/SSE 合成）。
  {
    id: 'lovart',
    name: 'Lovart',
    description: 'Lovart 原生 Agent 协议直连（lgw.lovart.ai），异步生图/生视频 + 文本',
    badgeText: 'LV',
    authType: 'api-key',
    catalogAdapter: 'local-manifest',
    defaultBaseUrl: LOVART_DIRECT_BASE_URL,
    allowCustomBaseUrl: false,
    credentials: [
      { key: 'accessKey', label: 'Lovart Access Key', required: true, secret: true },
      { key: 'secretKey', label: 'Lovart Secret Key', required: true, secret: true },
    ],
    models: LOVART_MODEL_MANIFEST,
  },
];

const PROVIDER_DEFINITION_MAP = new Map<string, ProviderDefinition>(
  BUILT_IN_PROVIDER_DEFINITIONS.map((d) => [d.id, d]),
);

export function getProviderDefinitions(): ProviderDefinition[] {
  return BUILT_IN_PROVIDER_DEFINITIONS;
}

export function getProviderDefinition(providerId: string, config?: string | { catalogId?: string } | null): ProviderDefinition | undefined {
  const catalogId = config && typeof config === 'object' ? config.catalogId : config;
  return PROVIDER_DEFINITION_MAP.get(catalogId || providerId);
}

export function isProviderModelVisible(catalogId: string | undefined, modelId: string): boolean {
  if (!catalogId) return true;
  const def = PROVIDER_DEFINITION_MAP.get(catalogId);
  return !def?.hiddenModelIds?.includes(modelId);
}

export function isWebSearchProviderId(value: string): boolean {
  return WEB_SEARCH_PROVIDER_IDS.includes(value);
}
