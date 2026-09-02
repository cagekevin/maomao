/**
 * contract — 模块对外的输入 / 输出形状。
 *
 * 这一份就是本模块的「接口面」：接入方只需要认识这里面的类型。
 * 底层十几个文件的复杂度一律不出现在入口上（深模块：窄接口、深实现）。
 */
import type { RelayTransport } from './core/transport';
import type {
  ModelExecutionProtocol,
  ModelExecutionProfile,
  ProtocolJsonValue,
} from './4-types/protocol';
import type {
  AppConfig,
  GeneralModelCategory,
  ImageReferenceRequestMode,
} from './4-types/connection';

/** 创建一个 relay 实例时的可选项。 */
export interface RelayOptions {
  /** 自定义传输层（代理、mock、Tauri 原生通道等）；缺省使用全局 fetch。 */
  transport?: RelayTransport;
  /** 打开脱敏后的请求日志（默认关闭）。 */
  debug?: boolean;
}

/** 一条连接的凭据与地址；协议执行只需要这两样。 */
export interface RelayCredential {
  apiKey: string;
  baseUrl: string;
}

/** 连到哪个模型、用哪份协议。 */
export interface RelayModelRef {
  /** 模型 ID（原样写进请求体的 model 字段）。 */
  model: string;
  /** 展示名，仅用于报错信息。 */
  name?: string;
  /** 自定义调用协议；缺省按 category 套用内置预设。 */
  executionProfile?: ModelExecutionProfile;
  category?: GeneralModelCategory;
}

// ── 生成入参 ──

interface GenerateBaseInput {
  connection: RelayCredential;
  model: RelayModelRef | string;
  /** 自定义协议；不给就用 category 对应的内置预设。 */
  protocol?: ModelExecutionProtocol;
  signal?: AbortSignal;
}

export interface GenerateTextInput extends GenerateBaseInput {
  prompt: string;
  systemPrompt?: string;
  /** 附带图片（OpenAI image_url 结构），模型需支持视觉输入。 */
  imageUrls?: string[];
  /** 非流式。协议里声明了 openai-sse 才能用于上游流式场景。 */
  stream?: boolean;
}

export interface GenerateImageInput extends GenerateBaseInput {
  prompt: string;
  /** 生成张数，默认 1。 */
  n?: number;
  /** 像素尺寸，如 '1024x1024'；与 aspectRatio 二选一。 */
  size?: string;
  /** 宽高比，如 '16:9'。 */
  aspectRatio?: string;
  /** 画质档位，如 '1K' | '2K' | '4K'。 */
  imageSize?: string;
  /** 参考图（URL 或 data URL）。 */
  imageUrls?: string[];
  /** 参考图提交方式；缺省用 imageUrls 数组。 */
  imageReferenceRequestMode?: ImageReferenceRequestMode;
}

export interface GenerateVideoInput extends GenerateBaseInput {
  prompt: string;
  n?: number;
  aspectRatio?: string;
  /** 分辨率档位，如 '480p' | '720p' | '1080p'。 */
  resolution?: string;
  /** 时长（秒）。 */
  duration?: number;
  fps?: number;
  /** 帧数；会自动收敛为 8n+1（部分模型硬性要求）。 */
  frames?: number;
  /** 是否生成音频轨。 */
  generateAudio?: boolean;
  /** 参考图：首帧 / 尾帧 / 普通参考。 */
  imageUrls?: string[];
  firstFrameImage?: string;
  lastFrameImage?: string;
  videoUrls?: string[];
  audioUrls?: string[];
}

export interface GenerateAudioInput extends GenerateBaseInput {
  prompt: string;
  n?: number;
  /** 音色（TTS）。 */
  voice?: string;
  /** 输出格式，如 'mp3' | 'wav' | 'opus'。 */
  format?: string;
  /** 语速，0.25–4。 */
  speed?: number;
  /** 时长（秒），音乐生成用。 */
  duration?: number;
  /** 音乐标题。 */
  title?: string;
  /** 歌词。 */
  lyrics?: string;
  bpm?: number;
}

/** 直接传协议变量的逃生舱入口。 */
export interface RunModelInput {
  connection: RelayCredential;
  /** 缺省按 category 套用内置预设。 */
  protocol?: ModelExecutionProtocol;
  category: GeneralModelCategory;
  variables: Record<string, ProtocolJsonValue | undefined>;
  signal?: AbortSignal;
  /** 关掉「参考素材接不住就报错」的检查。 */
  skipReferenceCheck?: boolean;
}

// ── 生成出参 ──

export interface GenerateTextResult {
  text: string;
  /** 同步协议同时返回了 URL 时也一并返回。 */
  urls?: string[];
  taskId?: string;
}

export interface GenerateMediaResult {
  /** data URL 或远端 URL；顺序即请求返回顺序。 */
  urls: string[];
  text?: string;
  /** 异步任务 ID，可用于断点续查。 */
  taskId?: string;
}

export type GenerateResult = GenerateTextResult | GenerateMediaResult;

// ── 连接测试 ──

export interface ConnectionTestInput {
  /** 厂商目录 ID（如 'custom-openai'）；可省略，仅按地址探测。 */
  providerId?: string;
  config: RelayCredential;
}

/** 挑联网搜索厂商时需要的配置切片。 */
export type WebSearchConfig = Pick<AppConfig, 'providers' | 'webSearchProviderId'>;

export interface ConnectionTestResult {
  success: boolean;
  /** 实际探测成功的地址；与传入值不同（如自动补了 /v1）时调用方应回写。 */
  baseUrl?: string;
  /** 账户余额文本（仅部分厂商的只读端点会返回）。 */
  balance?: string;
  error?: string;
  /** 该厂商没有已知的无计费端点，本次未发起请求。 */
  unsupported?: boolean;
}
