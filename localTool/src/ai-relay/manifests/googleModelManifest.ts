/**
 * Google Gemini 官方模型清单（从 AI-Canvas-tauri providers/googleModelManifest.ts 搬出）。
 */
export const GOOGLE_MODEL_MANIFEST: import('../types.js').CatalogModel[] = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', category: 'text', provider: 'google', description: 'Google 官方生产级文本与多模态模型' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', category: 'text', provider: 'google', description: 'Google 官方低延迟、低成本文本模型' },
  { id: 'gemini-3.1-flash-lite-image', name: 'Gemini 3.1 Flash Lite Image', category: 'image', provider: 'google', description: 'Google 官方 Nano Banana 图片生成模型（当前接入文生图）' },
  { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash Image', category: 'image', provider: 'google', description: 'Google 官方 Nano Banana 图片生成模型' },
  { id: 'gemini-3-pro-image', name: 'Gemini 3 Pro Image', category: 'image', provider: 'google', description: 'Google 官方 Nano Banana 图片生成模型' },
  { id: 'gemini-omni-flash-preview', name: 'Gemini Omni Flash Video（文生视频）', category: 'video', provider: 'google', description: 'Google 官方原生多模态视频模型，当前接入文生视频' },
  { id: 'veo-3.1-generate-preview', name: 'Veo 3.1（文生视频）', category: 'video', provider: 'google', description: 'Google 官方高质量异步视频生成模型' },
  { id: 'gemini-3.1-flash-tts-preview', name: 'Gemini 3.1 Flash TTS（Kore / WAV）', category: 'audio', provider: 'google', description: 'Google 官方语音生成模型，24kHz 单声道 PCM 自动封装为 WAV' },
];
