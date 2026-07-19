import type { PresetPrompt } from '../types';

export const PRESET_PROMPTS: PresetPrompt[] = [
  { id: 'p1', title: '三视图', prompt: '三视图，正面、侧面、背面，纯色背景，产品展示', category: 'drawing' },
  { id: 'p2', title: '九宫格', prompt: '九宫格构图，9张不同角度的图，统一风格', category: 'drawing' },
  { id: 'p3', title: '产品主图', prompt: '白色背景，产品居中，高清摄影，电商主图风格', category: 'drawing' },
  { id: 'p4', title: '人物肖像', prompt: '半身肖像，柔和光线，写实风格，景深效果', category: 'drawing' },
  { id: 'p5', title: '风景插画', prompt: '风景插画，宫崎骏风格，明亮色彩，梦幻氛围', category: 'drawing' },
  { id: 'p6', title: '短视频脚本', prompt: '请帮我写一个30秒短视频脚本，包含开场、主体、结尾', category: 'video' },
  { id: 'p7', title: '视频分镜', prompt: '请为以下描述生成4组分镜描述：', category: 'video' },
  { id: 'p8', title: '文章润色', prompt: '请帮我润色以下文字，使其更流畅、专业：', category: 'text' },
  { id: 'p9', title: '翻译', prompt: '请将以下内容翻译成英文：', category: 'text' },
  { id: 'p10', title: '头脑风暴', prompt: '请针对以下主题进行头脑风暴，列出10个创意方向：', category: 'general' },
  { id: 'p11', title: '提示词优化', prompt: '请帮我优化以下提示词，使其更详细、更适合AI生成：', category: 'general' },
  { id: 'p12', title: 'AI 扩图', prompt: '请扩展描述以下场景，补充更多细节和氛围：', category: 'general' },
];