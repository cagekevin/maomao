/**
 * lovart（apimart 系）模型清单。
 * 从 localTool 运行期 providers.json 的 lovart 连接（image/chat/video_models）搬出，
 * 供 ai-relay local-manifest 目录离线列出模型。执行走直连 adapter（providers/lovart），
 * 不依赖旧声明式 lovart-* preset（已随 lovart-old 9004 旧轨退役删除，见 docs/105）。
 */
export const LOVART_MODEL_MANIFEST: import('../types.js').CatalogModel[] = [
  // 图片（异步任务，直连走 providers/lovart adapter）
  {
    id: 'gpt-image-2-low',
    name: 'GPT Image 2 Low',
    category: 'image',
    provider: 'lovart',
    description: 'Lovart GPT Image 2 Low',
  },
  {
    id: 'gpt-image-2-medium',
    name: 'GPT Image 2 Medium',
    category: 'image',
    provider: 'lovart',
    description: 'Lovart GPT Image 2 Medium',
  },
  {
    id: 'gpt-image-2-high',
    name: 'GPT Image 2 High',
    category: 'image',
    provider: 'lovart',
    description: 'Lovart GPT Image 2 High',
  },
  {
    id: 'nano-bn-pro',
    name: 'Nano Banana Pro',
    category: 'image',
    provider: 'lovart',
    description: 'Lovart Nano Banana Pro',
  },
  {
    id: 'nano-bn-2',
    name: 'Nano Banana 2',
    category: 'image',
    provider: 'lovart',
    description: 'Lovart Nano Banana 2',
  },
  {
    id: 'nano-bn-2-lite',
    name: 'Nano Banana 2 Lite',
    category: 'image',
    provider: 'lovart',
    description: 'Lovart Nano Banana 2 Lite（仅自然语言选模型）',
  },
  // 文本（走 lovart-chat）
  {
    id: 'lovart-chat',
    name: 'Lovart Chat',
    category: 'text',
    provider: 'lovart',
    description: 'Lovart 文本对话模型',
  },
  // 视频（异步任务，直连走 providers/lovart adapter）
  {
    id: 'seedance-2.0-fast',
    name: 'Seedance 2.0 Fast',
    category: 'video',
    provider: 'lovart',
    description: 'Lovart Seedance 2.0 Fast 文生视频',
  },
  {
    id: 'seedance-2',
    name: 'Seedance 2',
    category: 'video',
    provider: 'lovart',
    description: 'Lovart Seedance 2 文生视频',
  },
  {
    id: 'seedance-2.0-mini',
    name: 'Seedance 2.0 Mini',
    category: 'video',
    provider: 'lovart',
    description: 'Lovart Seedance 2.0 Mini 文生视频（仅自然语言选模型）',
  },
  {
    id: 'minimax-h3',
    name: 'MiniMax H3',
    category: 'video',
    provider: 'lovart',
    description: 'Lovart MiniMax H3 文生视频（仅自然语言选模型）',
  },
  {
    id: 'kling-v3-omni',
    name: 'Kling V3 Omni',
    category: 'video',
    provider: 'lovart',
    description: 'Lovart Kling V3 Omni 文生视频',
  },
];
