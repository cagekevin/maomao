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
 * 模型别名表（转发映射，非业务逻辑）——对齐 apimart-gateway/main.py 的 _IMAGE_RULES / _VIDEO_RULES。
 * 仅把前端 model 名翻译为 Lovart 工具名；新增模型只需在此追加一条，不新增分支。
 * 本表是【人工精选子集】，仅收录运营挑选的少量模型（main.py 注释：刻意不全，不用的模型不进表）。
 *
 * 元素 = [别名数组, 工具名]。工具名空串 '' = 官方暂无对应生成工具，仅作提示词驱动，
 * 不下发 prefer_tool_categories（避免上游收到无效工具名），对齐 main.py:162-163 / 172-175。
 *
 * ⚠ 顺序敏感：匹配用 `any(k in m)` 子串包含，故更特异的别名必须排在更短的之前，
 * 例如 'gpt-image-2-low' 必须排在 'gpt-image-2' 之前，否则 low 会被 'gpt-image-2' 误吞。
 */
export const LOVART_IMAGE_RULES: ReadonlyArray<readonly [readonly string[], string]> = [
  [['gpt-image-2-low', 'gpt-image2-low', 'gptimage2low'], 'generate_image_gpt_image_2_low'],
  [
    ['gpt-image-2-medium', 'gpt-image2-medium', 'gptimage2medium'],
    'generate_image_gpt_image_2_medium',
  ],
  [['gpt-image-2', 'gpt-image2', 'gptimage2'], 'generate_image_gpt_image_2'],
  [['nano-bn-pro', 'nano bn pro', 'nanobnpro'], 'generate_image_nano_banana_pro'],
  // 顺序修正（相对 main.py 的缺陷修复）：'nano-bn-2' 是 'nano-bn-2-lite' 的前缀子串，
  // 若按 main.py 把 'nano-bn-2' 排在前面，lite 会被前缀规则误吞成 generate_image_nano_banana_2，
  // 导致本行空串规则永远不可达。故 lite 必须排在 'nano-bn-2' 之前。
  [['nano-bn-2-lite', 'nano banana 2 lite', 'nanobn2lite'], ''],
  [['nano-bn-2', 'nano bn 2'], 'generate_image_nano_banana_2'],
];

export const LOVART_VIDEO_RULES: ReadonlyArray<readonly [readonly string[], string]> = [
  [
    [
      'seedance-2.0-fast',
      'seedance-v2-0-fast',
      'seedance 2.0 fast',
      'seedance_2_fast',
      'seedance-2-fast',
      'seedance 2 fast',
    ],
    'generate_video_seedance_v2_0_fast',
  ],
  [['kling-v3-omni', 'kling-3-omni', 'kling 3 omni'], 'generate_video_kling_v3_omni'],
  // 顺序修正（相对 main.py 的缺陷修复）：'seedance-2' 是 'seedance-2.0-mini' 的前缀子串，
  // 若按 main.py 把 'seedance-2' 排在前面，mini 会被误吞成 generate_video_seedance_v2_0，
  // 导致本行空串规则永远不可达。故 mini 必须排在 'seedance-2' 之前。
  [
    [
      'seedance-2.0-mini',
      'seedance-v2-0-mini',
      'seedance 2.0 mini',
      'seedance_2_mini',
      'seedance-2-mini',
      'seedance 2 mini',
    ],
    '',
  ],
  [['seedance-2', 'seedance2', 'seedance-v2', 'seedance 2'], 'generate_video_seedance_v2_0'],
  [['minimax-h3', 'minimax h3', 'hailuo h3'], ''],
];

/**
 * 提示词可读模型名：前端可能传内部代号（如 nano-bn-2-lite），
 * 但拼进 prompt 时必须用上游 AI 能识别的官方可读名，否则 Agent 看不懂。
 * 对齐 main.py:180-186 的 _PROMPT_MODEL_NAMES；未登记的回退到 specs 的 readableName。
 */
export const LOVART_PROMPT_MODEL_NAMES: Record<string, string> = {
  'nano-bn-pro': 'Nano Banana Pro',
  'nano-bn-2': 'Nano Banana 2',
  'nano-bn-2-lite': 'Nano Banana 2 Lite',
  'seedance-2.0-mini': 'Seedance 2.0 mini',
  'minimax-h3': 'MiniMax H3',
};

/**
 * 模型 id → 规格映射（category / readableName 供断言与 prompt 拼装用）。
 * tool 名不再在此硬编码，改由 LOVART_IMAGE_RULES / LOVART_VIDEO_RULES 别名表解析（对齐 main.py）。
 */
export const LOVART_MODEL_SPECS: Record<string, LovartModelSpec> = {
  'gpt-image-2-low': { category: 'IMAGE', readableName: 'GPT Image 2 Low' },
  'gpt-image-2-medium': { category: 'IMAGE', readableName: 'GPT Image 2 Medium' },
  'gpt-image-2-high': { category: 'IMAGE', readableName: 'GPT Image 2 High' },
  'nano-bn-pro': { category: 'IMAGE', readableName: 'Nano Banana Pro' },
  'nano-bn-2': { category: 'IMAGE', readableName: 'Nano Banana 2' },
  'nano-bn-2-lite': { category: 'IMAGE', readableName: 'Nano Banana 2 Lite' },
  'lovart-chat': { category: 'CHAT', tool: 'lovart-chat', readableName: 'Lovart Chat' },
  'seedance-2.0-fast': { category: 'VIDEO', readableName: 'Seedance 2.0 Fast' },
  'seedance-2': { category: 'VIDEO', readableName: 'Seedance 2' },
  'seedance-2.0-mini': { category: 'VIDEO', readableName: 'Seedance 2.0 Mini' },
  'minimax-h3': { category: 'VIDEO', readableName: 'MiniMax H3' },
  'kling-v3-omni': { category: 'VIDEO', readableName: 'Kling V3 Omni' },
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
