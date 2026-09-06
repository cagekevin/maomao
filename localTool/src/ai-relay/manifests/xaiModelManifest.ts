/**
 * xAI / Grok 官方模型清单（从 AI-Canvas-tauri providers/xaiModelManifest.ts 搬出）。
 * 这里只保留「连接层」需要的模型目录（id/name/category）；
 * 声明式执行协议（图片/视频异步轮询）属生成引擎，见 README 的 Phase 2。
 */
export const XAI_MODEL_MANIFEST: import('../types.js').CatalogModel[] = [
  {
    id: 'grok-4.5',
    name: 'Grok 4.5',
    category: 'text',
    provider: 'xai',
    description: 'xAI 官方旗舰文本与推理模型',
  },
  {
    id: 'grok-imagine-image',
    name: 'Grok Imagine Image',
    category: 'image',
    provider: 'xai',
    description: 'xAI 官方标准图片生成模型',
  },
  {
    id: 'grok-imagine-image-quality',
    name: 'Grok Imagine Image Quality',
    category: 'image',
    provider: 'xai',
    description: 'xAI 官方高质量图片生成模型',
  },
  {
    id: 'grok-imagine-video',
    name: 'Grok Imagine Video（文生视频）',
    category: 'video',
    provider: 'xai',
    description: 'xAI 官方文生视频模型',
  },
  {
    id: 'grok-imagine-video-1.5',
    name: 'Grok Imagine Video 1.5（单图生视频）',
    category: 'video',
    provider: 'xai',
    description: 'xAI 官方单图生视频模型，需要连接一张参考图',
  },
];
