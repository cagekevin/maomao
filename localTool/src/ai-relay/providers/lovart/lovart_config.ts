/** Lovart 直连 adapter 的常量与模型规格表。 */

export const LOVART_PATH_PREFIX = '/v1/openapi';
export const LOVART_AUTO_CONFIRM = true;
export const LOVART_DEFAULT_MODE: 'thinking' | 'fast' = 'fast';
export const LOVART_POLL_INTERVAL_MS = 3000;
export const LOVART_DONE_RECHECK_MS = 5000;
export const LOVART_DEFAULT_TIMEOUT_MS = 180_000;
export const LOVART_PROJECT_TYPE = 3;

export type LovartCategory = 'IMAGE' | 'VIDEO' | 'CHAT';

export interface LovartModelSpec {
  category: LovartCategory;
  /** 结构化路选模型用的工具名；undefined => 仅自然语言路（prompt_only） */
  tool?: string;
  readableName: string;
}

/**
 * 模型 id → 规格映射。tool 名为 Lovart 上游工具标识，若与实际不符请以官方为准调整；
 * 自然语言路（prompt 内写可读名）始终兜底，保证"模型必显式"不依赖工具名被采信。
 */
export const LOVART_MODEL_SPECS: Record<string, LovartModelSpec> = {
  'gpt-image-2-low': { category: 'IMAGE', tool: 'generate_image_gpt_image_2', readableName: 'GPT Image 2 Low' },
  'gpt-image-2-medium': { category: 'IMAGE', tool: 'generate_image_gpt_image_2', readableName: 'GPT Image 2 Medium' },
  'gpt-image-2-high': { category: 'IMAGE', tool: 'generate_image_gpt_image_2', readableName: 'GPT Image 2 High' },
  'nano-bn-pro': { category: 'IMAGE', tool: 'generate_image_nano_banana', readableName: 'Nano Banana Pro' },
  'nano-bn-2': { category: 'IMAGE', tool: 'generate_image_nano_banana', readableName: 'Nano Banana 2' },
  'nano-bn-2-lite': { category: 'IMAGE', readableName: 'Nano Banana 2 Lite' },
  'lovart-chat': { category: 'CHAT', tool: 'lovart-chat', readableName: 'Lovart Chat' },
  'seedance-2.0-fast': { category: 'VIDEO', tool: 'generate_video_seedance', readableName: 'Seedance 2.0 Fast' },
  'seedance-2': { category: 'VIDEO', tool: 'generate_video_seedance', readableName: 'Seedance 2' },
  'seedance-2.0-mini': { category: 'VIDEO', tool: 'generate_video_seedance', readableName: 'Seedance 2.0 Mini' },
  'minimax-h3': { category: 'VIDEO', tool: 'generate_video_minimax', readableName: 'MiniMax H3' },
  'kling-v3-omni': { category: 'VIDEO', tool: 'generate_video_kling', readableName: 'Kling V3 Omni' },
};

export const LOVART_ERR_TYPES = {
  PROJECT_INVALID: 'project_invalid',
  NO_ARTIFACT: 'no_artifact',
  ABORT: 'abort',
  TIMEOUT: 'timeout',
  UPLOAD_FAILED: 'upload_failed',
  UPSTREAM: 'upstream',
  PENDING_CONFIRMATION: 'pending_confirmation',
} as const;
