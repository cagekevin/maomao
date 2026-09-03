/**
 * Sora2U 内置模型清单（从 AI-Canvas-tauri providers/sora2uModelManifest.ts 搬出）。
 * hiddenModelIds（seedance-2.5 系列）按原逻辑预先过滤，连接层不再暴露。
 */
export const SORA2U_MODEL_MANIFEST: import('../types.js').CatalogModel[] = [
  { id: 'seedance-1.5', name: 'Seedance 1.5', category: 'video', provider: 'sora2u', description: 'Sora2U 图片驱动视频模型', videoCapability: { maxImageReferences: 1, maxVideoReferences: 0, maxAudioReferences: 0, ratios: ['9:16'], defaultRatio: '9:16', resolutions: ['720p'], defaultResolution: '720p', supportsAudio: false } },
  { id: 'seedance-2.0', name: 'Seedance 2.0', category: 'video', provider: 'sora2u', description: 'Sora2U 全模态视频模型，支持文生视频', videoCapability: { maxImageReferences: 9, maxVideoReferences: 3, maxAudioReferences: 3, supportsAudio: true } },
  { id: 'seedance-2.0-character', name: 'Seedance 2.0 Character', category: 'video', provider: 'sora2u', description: 'Sora2U 角色一致性全模态视频模型', videoCapability: { maxImageReferences: 9, maxVideoReferences: 3, maxAudioReferences: 3, supportsAudio: true } },
  { id: 'seedance-2.0-character-mono', name: 'Seedance 2.0 Character Mono', category: 'video', provider: 'sora2u', description: 'Sora2U 单角色一致性全模态视频模型', videoCapability: { maxImageReferences: 9, maxVideoReferences: 3, maxAudioReferences: 3, supportsAudio: true } },
  { id: 'gemini-image', name: 'Gemini Image', category: 'image', provider: 'sora2u', description: 'Sora2U Gemini 图片生成模型，支持最多 4 张参考图', inputModalities: ['text', 'image'] },
  { id: 'kontext-image', name: 'Kontext Image', category: 'image', provider: 'sora2u', description: 'Sora2U Kontext 图片生成模型，支持最多 4 张参考图', inputModalities: ['text', 'image'] },
];
