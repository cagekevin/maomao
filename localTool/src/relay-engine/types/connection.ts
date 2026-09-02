/**
 * 连接 / 模型目录侧的共享类型。
 *
 * 抽取自 AI-Canvas-tauri 的 `src/types/index.ts`（仅保留 API 中转体系用到的部分），
 * 并去掉了对画布、节点、项目等上层业务的依赖，便于在别处直接引用。
 */
import type { ModelExecutionProfile, VideoModelCapability } from './protocol';

/** 模型按生成物划分的四大类，决定参数面板、可用协议变量与节点落位。 */
export type GeneralModelCategory = 'text' | 'image' | 'audio' | 'video';

/**
 * 图片模型存在参考图时使用的请求协议；缺省保持 generations JSON 兼容方式。
 * - generation-json-image-urls：请求体里放公网 URL 数组
 * - generation-json-image-data-urls：请求体里放 data URL 数组
 * - edits-multipart：改为 multipart 上传图片文件
 */
export type ImageReferenceRequestMode =
  | 'generation-json-image-urls'
  | 'generation-json-image-data-urls'
  | 'edits-multipart';

/** 模型清单的获取方式：远程拉取 OpenAI 兼容 /models，或使用随包发布的内置清单。 */
export type ProviderCatalogAdapter = 'openai-compatible' | 'local-manifest';

/** 内置的联网搜索厂商 ID。 */
export type WebSearchProviderId = 'tavily' | 'bocha' | 'zhipu-search' | 'exa';

/** 用户在厂商目录中明确启用的模型，不包含凭据。 */
export interface ProviderModelSelection {
  id: string;
  name: string;
  category: GeneralModelCategory;
  provider: string;
  description?: string;
  /** 用户已手动编辑用途说明，刷新厂商目录时不覆盖。 */
  descriptionManual?: boolean;
  /** 可验证的输入模态；自然语言描述不能替代该能力声明。 */
  inputModalities?: Array<'text' | 'image'>;
  /** 用户已手动确认输入模态，刷新厂商目录时不覆盖。 */
  inputModalitiesManual?: boolean;
  /** 分类是否由用户手动指定；为 true 时重新拉取目录或合并模型不再覆盖该分类。 */
  categoryManual?: boolean;
  /**
   * 文本模型的上下文窗口（token）。缺省时按模型 ID 猜目录，猜不中退回保守默认值，
   * 中转站的自定义命名基本都猜不中，声明出来助手才不会过早压缩上下文。
   */
  contextWindow?: number;
  /** 自定义媒体模型的提交、轮询与结果解析规则。 */
  executionProfile?: ModelExecutionProfile;
  /** 图片模型存在参考图时使用的请求协议；缺省保持 generations JSON 兼容方式。 */
  imageReferenceRequestMode?: ImageReferenceRequestMode;
  /** 视频模型的参数能力声明（时长/分辨率/比例/参考素材等），缺省走通用兜底。 */
  videoCapability?: VideoModelCapability;
}

/** 一条厂商连接（含凭据占位与已选模型），持久化在配置中。 */
export interface ApiProviderConfig {
  name: string;
  /**
   * 运行期明文凭据，只存在于内存。持久化时由调用方摘进安全存储，
   * 业务代码不要把它写进数据库或分享文本。
   */
  apiKey: string;
  /** 凭据在安全存储中的条目名；由持久化层维护，业务代码不要直接读写。 */
  apiKeyRef?: string;
  baseUrl?: string;
  /** 内置目录定义 ID；自定义连接的配置 key 与目录定义 ID 不同。 */
  catalogId?: string;
  /** undefined 表示旧配置尚未选择；空数组表示用户明确未启用任何模型。 */
  selectedModels?: ProviderModelSelection[];
  /** 最近一次拉取并保存在本地的完整模型目录，不包含凭据。 */
  catalogModels?: ProviderModelSelection[];
  /** undefined 表示旧配置全部可见；空数组表示从所有节点模型列表隐藏该厂商。 */
  visibleModelCategories?: GeneralModelCategory[];
  catalogUpdatedAt?: number;
}

/** 用户在连接之上自建的「通用模型」，凭据与地址一律从 providerConfigId 指向的连接读取。 */
export interface GeneralModelConfig {
  id: string;
  name: string;
  modelId: string;
  category: GeneralModelCategory;
  contextWindow?: number;
  description?: string;
  inputModalities?: Array<'text' | 'image'>;
  providerConfigId: string;
  executionProfile?: ModelExecutionProfile;
  imageReferenceRequestMode?: ImageReferenceRequestMode;
  videoCapability?: VideoModelCapability;
}

/**
 * 本模块只关心配置里的连接与联网搜索选择；
 * 接入方自己的 AppConfig 只要结构上兼容即可直接传入。
 */
export interface AppConfig {
  providers: Record<string, ApiProviderConfig>;
  webSearchProviderId?: WebSearchProviderId;
}

export const GENERAL_MODEL_CATEGORY_LABELS: Record<GeneralModelCategory, string> = {
  text: '文本',
  image: '图片',
  audio: '音频',
  video: '视频',
};
