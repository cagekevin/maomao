/**
 * relay — 深模块门面。
 *
 * 一句话：给一条连接（apiKey + baseUrl）和一组意图参数，换回生成结果；
 * 底层「多平台协议差异」全部藏在这一个入口后面。
 *
 * 接口刻意做窄：只有 6 组方法（providers / connection / protocol / generate / stations / http）
 * 加 1 个地址工具。实现很深：13 个文件、2000+ 行的协议引擎在背后。
 *
 * 需要绕过门面直接碰协议引擎时，从包根导入底层函数即可（见 index.ts 的「逃生舱」导出）。
 */
import { normalizeBaseUrl, baseUrlCandidates } from './core/base-url';
import { getRelayTransport, logAiRequest, relayFetch, setRelayTransport } from './core/transport';
import type { RelayTransport } from './core/transport';
import { buildAuthHeaders, parseResponseError } from './core/http-utils';
import { pollTask } from './core/polling';

import {
  createConnectionId,
  fetchProviderModelCatalog,
  getProviderDefinition,
  getProviderDefinitions,
  getWebSearchProviderDefinitions,
  isWebSearchProviderId,
  resolveWebSearchProviderId,
  capCatalogModels,
  type FetchProviderCatalogOptions,
  type ProviderCatalogResult,
  type ProviderDefinition,
} from './_aux/providers/catalog';
import { testConnection } from './_aux/providers/connection-test';

import {
  getDefaultCustomProtocol,
  getModelProtocolPreset,
  modelProtocolUsesVariable,
  parseModelExecutionProtocol,
  validateModelExecutionProtocol,
} from './2-engine/schema';
import {
  buildModelProtocolRequest,
  pollResolvedModelProtocol,
  previewModelProtocolRequest,
  previewModelProtocolResponse,
  submitModelProtocol,
  executeModelProtocol,
  getDefaultModelProtocolPollRetryConfig,
  type ModelProtocolVariables,
} from './2-engine/executor';
import {
  getCategoryProtocolVariables,
  resolveProtocolFieldTemplate,
  PROTOCOL_VARIABLES,
  PROTOCOL_VARIABLE_NAMES,
  REFERENCE_PROTOCOL_VARIABLES,
} from './2-engine/variables';
import { analyzeModelProtocolDocument, analyzeModelProtocolExamples } from './2-engine/import';
import type {
  ModelProtocolExamples,
  ModelProtocolImportOptions,
  ModelProtocolImportResult,
} from './2-engine/import';

import { parseConnectionShare, serializeConnection } from './_aux/share/connection';
import type { ParsedConnectionShare } from './_aux/share/connection';

import {
  discoverProvider,
  probeStation,
  type DiscoverOptions,
  type ProviderDiscovery,
} from './_aux/docs/discover';
import { readProviderDocsPage, type ProviderDocsPage } from './_aux/docs/reader';
import {
  extractDocUrls,
  isDocUrlAllowed,
  isSameOrigin,
  normalizeDocUrl,
} from './_aux/docs/safety';
import {
  createStaticDocBridge,
  createTauriDocBridge,
  getDocBridge,
  setDocBridge,
  type DocBridge,
  type NativeDocResponse,
} from './_aux/docs/bridge';
import {
  beginProviderDocRead,
  clearProviderDocsGrantsForTests,
  clearProviderDocsTask,
  completeProviderDocRead,
  getProviderDocRemainingTextChars,
  isProviderDocUrlGranted,
  listProviderDocGrants,
  releaseProviderDocRead,
  type ProviderDocReadCompletion,
  type ProviderDocReadReservation,
} from './_aux/docs/grant';

import {
  buildGroupedModelChoiceList,
  buildRelayCatalogContent,
  inferRelayModelCategory,
  parseNewApiPricingPayload,
  parseNewApiStatusPayload,
  type NewApiPricingItem,
  type NewApiStatusInfo,
} from './_aux/stations/new-api';

import { generateText } from './1-intent/text';
import { generateImage } from './1-intent/image';
import { generateVideo } from './1-intent/video';
import { generateAudio } from './1-intent/audio';
import { findUnusedReferenceVariables, runModel } from './1-intent/run';

import type { ApiProviderConfig, GeneralModelCategory } from './4-types/connection';
import type { ModelExecutionProtocol, ProtocolJsonValue } from './4-types/protocol';
import type {
  ConnectionTestInput,
  ConnectionTestResult,
  GenerateAudioInput,
  GenerateImageInput,
  GenerateMediaResult,
  GenerateTextInput,
  GenerateTextResult,
  GenerateVideoInput,
  RelayOptions,
  RunModelInput,
  WebSearchConfig,
} from './contract';
import { RELAY_CAPABILITIES, type RelayCapability } from './capabilities';

/**
 * 一个 relay 实例暴露的全部能力。
 * 这个接口就是本模块的「API 契约」，接入方只需认识它。
 */
export interface Relay {
  /** 机器可读能力清单，供文档生成、自检或 UI 消费。 */
  readonly capabilities: readonly RelayCapability[];

  /** 规范化用户粘贴的接口地址（补协议、去尾斜杠、剥掉误贴的端点、自动补 /v1 候选）。 */
  normalizeBaseUrl(raw: string | null | undefined): string;
  /** 探测顺序：地址里已有 /v1 就不再猜，否则补一个 /v1 候选。 */
  baseUrlCandidates(raw: string | null | undefined): string[];

  /** 厂商与模型目录。 */
  providers: {
    /** 全部内置厂商定义（13 个）。 */
    list(): readonly ProviderDefinition[];
    get(providerId: string, config?: Pick<ApiProviderConfig, 'catalogId'>): ProviderDefinition | undefined;
    /** 列出联网搜索类厂商（tavily / bocha / zhipu-search / exa）。 */
    listWebSearch(): readonly ProviderDefinition[];
    isWebSearch(providerId?: string): boolean;
    /** 从配置里挑出当前可用的联网搜索厂商。 */
    resolveWebSearch(config: WebSearchConfig): string | undefined;
    /** 生成一条连接的 ID（自定义接口可有多条，带随机后缀）。 */
    newConnectionId(providerId: string): string;
    /** 拉取模型目录；本地清单厂商直接返回清单，OpenAI 兼容厂商走 /models。 */
    fetchModels(options: FetchProviderCatalogOptions): Promise<ProviderCatalogResult>;
    /** 截断目录缓存，保留已勾选模型（中转站常返回上千个模型）。 */
    capCatalogModels(models: ProviderCatalogResult['models'], selectedIds: ReadonlySet<string>): ProviderCatalogResult['models'];
  };

  /** 连接生命周期：验证、导出、导入。 */
  connection: {
    /** 只打无计费端点（/models 或厂商声明的只读端点），绝不触发付费生成。 */
    test(input: ConnectionTestInput): Promise<ConnectionTestResult>;
    /** 导出为可分享的 JSON 文本；**永不包含 API Key**。 */
    export(config: ApiProviderConfig): string;
    /** 解析分享文本；格式不符返回 null，凭据一律留空由用户补填。 */
    import(text: string): ParsedConnectionShare | null;
  };

  /** 声明式调用协议：把任意非标准接口描述成一段 JSON。 */
  protocol: {
    /** 三个内置预设：openai-chat / openai-image / agnes-video。 */
    preset(id: 'openai-chat' | 'openai-image' | 'agnes-video'): ModelExecutionProtocol;
    /** 按类别给一份可直接改的自定义协议骨架。 */
    skeleton(category: GeneralModelCategory): ModelExecutionProtocol;
    /** 校验并返回全部错误；空数组表示合法。 */
    validate(protocol: unknown): string[];
    /** 校验 + 归一化（v1 自动升 v2）；非法时抛错。 */
    parse(protocol: unknown): ModelExecutionProtocol;
    /** 从 curl / fetch / axios / python / OpenAPI 示例直接生成协议草稿。 */
    fromExamples(examples: ModelProtocolExamples, options?: ModelProtocolImportOptions): ModelProtocolImportResult;
    /** 从整段文档正文里识别请求/响应示例并生成协议草稿。 */
    fromDocument(text: string, options?: ModelProtocolImportOptions): ModelProtocolImportResult;
    /** 预览协议会发出什么请求（密钥以 ******** 显示）。 */
    previewRequest(input: Omit<Parameters<typeof buildModelProtocolRequest>[0], never>): ReturnType<typeof previewModelProtocolRequest>;
    /** 拿一份真实响应，预览各条路径能取出什么。 */
    previewResponse(protocol: ModelExecutionProtocol, payload: ProtocolJsonValue): ReturnType<typeof previewModelProtocolResponse>;
    /** 该类别模型在模板里能引用哪些变量。 */
    variablesFor(category: GeneralModelCategory): string[];
    /** 中转站请求体字段名 → 协议变量模板（认不出来返回 undefined）。 */
    templateFor(field: string, value: ProtocolJsonValue, category: GeneralModelCategory): string | undefined;
    /** 协议里是否引用了指定变量。 */
    usesVariable(source: string, ...variables: string[]): boolean;
    /** 协议接不住的参考素材变量（空数组表示没问题）。 */
    unusedReferenceVariables(protocol: unknown, variables: ModelProtocolVariables): string[];
    /** 全部协议变量定义（字段映射的唯一来源）。 */
    readonly variables: typeof PROTOCOL_VARIABLES;
    /** 允许在模板中引用的变量名集合。 */
    readonly variableNames: ReadonlySet<string>;
    /** 参考素材类变量名集合。 */
    readonly referenceVariables: readonly string[];
  };

  /** 生成：四类媒体 + 一个变量级逃生舱。 */
  generate: {
    text(input: GenerateTextInput): Promise<GenerateTextResult>;
    image(input: GenerateImageInput): Promise<GenerateMediaResult>;
    video(input: GenerateVideoInput): Promise<GenerateMediaResult>;
    audio(input: GenerateAudioInput): Promise<GenerateMediaResult>;
    /** 绕过参数映射，直接给协议变量。 */
    run(input: RunModelInput): Promise<{ urls?: string[]; text?: string; taskId?: string }>;
  };

  /**
   * 文档侧：在「完全不知道对方 API 长什么样」时，先把信息采集回来。
   * 这是整个适配流程的起点——读不到对方的接口信息，协议就只能靠猜。
   */
  docs: {
    /** 校验 URL 是否可安全读取（HTTPS / 公网 / 无凭据 / 443）。 */
    normalizeUrl(raw: string): string | null;
    isAllowed(raw: string): boolean;
    /** 从一段文本里抽出合规的 HTTPS 链接。 */
    extractUrls(text: string): string[];
    isSameOrigin(a: string, b: string): boolean;
    /**
     * 读一个文档页。内部三级回落：
     * 静态 HTML → （首屏空壳时）SPA 动态渲染 → （需登录时）new-api 公开模型清单。
     */
    read(url: string, options?: { maxTextChars?: number; offset?: number; signal?: AbortSignal }): Promise<ProviderDocsPage>;
    /**
     * ★ 一站式中转站探测：给一个站点地址，返回「有哪些模型 + 协议长什么样 + 还缺什么」。
     * 只读，不写任何配置，不产生任何付费生成。
     */
    discover(url: string, options?: DiscoverOptions): Promise<ProviderDiscovery>;
    /** 只探 new-api 的 /api/pricing 与 /api/status。 */
    probe(origin: string): Promise<ProviderDiscovery['station']>;
    /** 配置原生读取桥接（Tauri 用 createTauriDocBridge；测试用 createStaticDocBridge）。 */
    setBridge(bridge: DocBridge | null): () => void;
    getBridge(): DocBridge | null;
    createTauriBridge(invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>): DocBridge;
    createStaticBridge(responses: Record<string, Partial<NativeDocResponse>>): DocBridge;
    /** 访问预算：限制单个任务能读多少页、多深、多少字。 */
    grants: {
      isGranted(taskId: string, taskGoal: string, url: string, conversationId?: string): boolean;
      begin(taskId: string, taskGoal: string, url: string, conversationId?: string, offset?: number): ProviderDocReadReservation;
      complete(reservation: ProviderDocReadReservation, textChars: number, discoveredUrls: string[]): ProviderDocReadCompletion;
      release(reservation: ProviderDocReadReservation): void;
      remainingTextChars(taskId: string): number;
      list(taskId: string, taskGoal: string, conversationId?: string): string[];
      clear(taskId: string): void;
      clearAll(): void;
    };
  };

  /** new-api（New API / One API 系）中转站的公开接口解析。 */
  stations: {
    parsePricing(body: string): NewApiPricingItem[] | null;
    parseStatus(body: string): NewApiStatusInfo | null;
    /** 把清单 + 公告拼成可读正文，供生成配置草稿使用。 */
    catalogContent(url: string, pricing: NewApiPricingItem[], status: NewApiStatusInfo | null): { title: string; text: string };
    /** 按 文本/图片/视频/音频 分好组的模型清单。 */
    groupedChoices(pricing: NewApiPricingItem[]): string;
    categoryOf(item: NewApiPricingItem): string;
  };

  /** 传输层与底层工具：给需要自己发请求或做轮询的调用方。 */
  http: {
    fetch(url: string, init?: RequestInit): Promise<Response>;
    /** 替换传输层，返回还原函数。 */
    setTransport(transport: RelayTransport): () => void;
    getTransport(): RelayTransport;
    /** 构造 Bearer 鉴权头；apiKey 为空时不带 Authorization。 */
    authHeaders(apiKey: string, contentType?: string): Record<string, string>;
    /** 解析 !response.ok 的错误体并抛出统一格式的错误。 */
    throwOnError(response: Response, defaultMsg: string): Promise<never>;
    /** 通用异步任务轮询。 */
    pollTask: typeof pollTask;
    /** 开发环境打印脱敏请求摘要。 */
    log(url: string, init?: RequestInit, source?: string): void;
  };

  /** 协议引擎底层入口：需要自定义提交/轮询流程时用（逃生舱）。 */
  lowLevel: {
    buildRequest: typeof buildModelProtocolRequest;
    submit: typeof submitModelProtocol;
    poll: typeof pollResolvedModelProtocol;
    execute: typeof executeModelProtocol;
    defaultRetry: typeof getDefaultModelProtocolPollRetryConfig;
  };
}

/** 创建一个 relay 实例。同一个进程可以创建多个、各自用不同传输层。 */
export function createRelay(options: RelayOptions = {}): Relay {
  if (options.transport) setRelayTransport(options.transport);
  const debug = options.debug ?? false;

  return {
    capabilities: RELAY_CAPABILITIES,

    normalizeBaseUrl,
    baseUrlCandidates,

    providers: {
      list: getProviderDefinitions,
      get: (providerId, config) => getProviderDefinition(providerId, config),
      listWebSearch: getWebSearchProviderDefinitions,
      isWebSearch: (providerId) => isWebSearchProviderId(providerId),
      resolveWebSearch: (config) => resolveWebSearchProviderId(config),
      newConnectionId: createConnectionId,
      fetchModels: fetchProviderModelCatalog,
      capCatalogModels,
    },

    connection: {
      test: (input) => testConnection({
        providerId: input.providerId,
        apiKey: input.config.apiKey,
        baseUrl: input.config.baseUrl,
      }),
      export: serializeConnection,
      import: parseConnectionShare,
    },

    protocol: {
      preset: (id) => getModelProtocolPreset(id) as ModelExecutionProtocol,
      skeleton: (category) => getDefaultCustomProtocol(category) as ModelExecutionProtocol,
      validate: validateModelExecutionProtocol,
      parse: (value) => parseModelExecutionProtocol(value) as ModelExecutionProtocol,
      fromExamples: analyzeModelProtocolExamples,
      fromDocument: analyzeModelProtocolDocument,
      previewRequest: (input) => previewModelProtocolRequest(input),
      previewResponse: (protocol, payload) => previewModelProtocolResponse(protocol, payload),
      variablesFor: getCategoryProtocolVariables,
      templateFor: resolveProtocolFieldTemplate,
      usesVariable: modelProtocolUsesVariable,
      unusedReferenceVariables: findUnusedReferenceVariables,
      variables: PROTOCOL_VARIABLES,
      variableNames: PROTOCOL_VARIABLE_NAMES,
      referenceVariables: REFERENCE_PROTOCOL_VARIABLES,
    },

    generate: {
      text: generateText,
      image: generateImage,
      video: generateVideo,
      audio: generateAudio,
      run: runModel,
    },

    docs: {
      normalizeUrl: normalizeDocUrl,
      isAllowed: isDocUrlAllowed,
      extractUrls: extractDocUrls,
      isSameOrigin,
      read: readProviderDocsPage,
      discover: discoverProvider,
      probe: probeStation,
      setBridge: setDocBridge,
      getBridge: getDocBridge,
      createTauriBridge: createTauriDocBridge,
      createStaticBridge: createStaticDocBridge,
      grants: {
        isGranted: isProviderDocUrlGranted,
        begin: beginProviderDocRead,
        complete: completeProviderDocRead,
        release: releaseProviderDocRead,
        remainingTextChars: getProviderDocRemainingTextChars,
        list: listProviderDocGrants,
        clear: clearProviderDocsTask,
        clearAll: clearProviderDocsGrantsForTests,
      },
    },

    stations: {
      parsePricing: parseNewApiPricingPayload,
      parseStatus: parseNewApiStatusPayload,
      catalogContent: buildRelayCatalogContent,
      groupedChoices: buildGroupedModelChoiceList,
      categoryOf: inferRelayModelCategory,
    },

    http: {
      fetch: relayFetch,
      setTransport: setRelayTransport,
      getTransport: getRelayTransport,
      authHeaders: buildAuthHeaders,
      throwOnError: parseResponseError,
      pollTask,
      log: (url, init, source) => logAiRequest(url, init ?? {}, source, debug),
    },

    lowLevel: {
      buildRequest: buildModelProtocolRequest,
      submit: submitModelProtocol,
      poll: pollResolvedModelProtocol,
      execute: executeModelProtocol,
      defaultRetry: getDefaultModelProtocolPollRetryConfig,
    },
  };
}
