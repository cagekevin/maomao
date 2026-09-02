/**
 * 声明火山方舟（volcengine）Seedance 视频模型能力表，供 UI 参数选择器按模型约束分辨率 / 时长。
 * 火山方舟走独立的内容生成协议（contents/generations/tasks），与 APIMart 的 videos/generations 不同，
 * 因此能力表只承载 UI 侧的档位约束，不参与请求体映射。
 */
import type { ApimartSeedanceCapability } from './apimart/videoModels';

const SD_2_RESOLUTIONS = ['480p', '720p'] as const;
const SD_2_FULL_RESOLUTIONS = [...SD_2_RESOLUTIONS, '1080p', '4k'] as const;
const SD_2_0_RATIOS = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;
const COMMON_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'] as const;

/**
 * 火山方舟 Seedance 能力表。按官方模型规格限制参数面板可选项，
 * 避免把某个版本不支持的分辨率、比例或时长提交到接口。
 */
const VOLCENGINE_SEEDANCE_CAPABILITIES: Record<string, ApimartSeedanceCapability> = {
  'doubao-seedance-2-0': {
    modelId: 'doubao-seedance-2-0-260128',
    resolutions: SD_2_FULL_RESOLUTIONS,
    defaultResolution: '720p',
    ratios: SD_2_0_RATIOS,
    defaultRatio: '16:9',
    ratioField: 'aspect_ratio',
    minDuration: 4,
    maxDuration: 15,
    defaultDuration: 5,
    audioField: 'generate_audio',
    defaultAudio: true,
    operations: ['text-to-video', 'image-to-video', 'video-to-video'],
    maxImageReferences: 9,
    maxVideoReferences: 3,
    maxAudioReferences: 3,
  },
  'doubao-seedance-2-0-fast': {
    modelId: 'doubao-seedance-2-0-fast-260128',
    resolutions: SD_2_RESOLUTIONS,
    defaultResolution: '720p',
    ratios: SD_2_0_RATIOS,
    defaultRatio: '16:9',
    ratioField: 'aspect_ratio',
    minDuration: 4,
    maxDuration: 15,
    defaultDuration: 5,
    audioField: 'generate_audio',
    defaultAudio: true,
    operations: ['text-to-video', 'image-to-video', 'video-to-video'],
    maxImageReferences: 9,
    maxVideoReferences: 3,
    maxAudioReferences: 3,
  },
  'doubao-seedance-2-0-mini': {
    modelId: 'doubao-seedance-2-0-mini-260615',
    resolutions: SD_2_RESOLUTIONS,
    defaultResolution: '720p',
    ratios: SD_2_0_RATIOS,
    defaultRatio: '16:9',
    ratioField: 'aspect_ratio',
    minDuration: 4,
    maxDuration: 15,
    defaultDuration: 5,
    audioField: 'generate_audio',
    defaultAudio: true,
    operations: ['text-to-video', 'image-to-video', 'video-to-video'],
    maxImageReferences: 9,
    maxVideoReferences: 3,
    maxAudioReferences: 3,
  },
  'doubao-seedance-2-5': {
    modelId: 'doubao-seedance-2-5-260628',
    resolutions: [...SD_2_RESOLUTIONS, '1080p'],
    defaultResolution: '720p',
    ratios: COMMON_RATIOS,
    defaultRatio: '16:9',
    ratioField: 'aspect_ratio',
    minDuration: 4,
    maxDuration: 30,
    defaultDuration: 5,
    audioField: 'generate_audio',
    defaultAudio: true,
    operations: ['text-to-video', 'image-to-video', 'video-to-video'],
    maxImageReferences: 30,
    maxVideoReferences: 10,
    maxAudioReferences: 10,
  },
};

function normalizeVolcengineModelId(model: string): string {
  const stripped = model.startsWith('volcengine/') ? model.slice('volcengine/'.length) : model;
  // 去掉日期版本后缀（如 -260628），使 doubao-seedance-2-5-260628 → doubao-seedance-2-5
  return stripped
    .toLowerCase()
    .replace(/-\d{6,}$/, '');
}

export function getVolcengineSeedanceCapability(
  model?: string,
): ApimartSeedanceCapability | undefined {
  return model ? VOLCENGINE_SEEDANCE_CAPABILITIES[normalizeVolcengineModelId(model)] : undefined;
}

export function isVolcengineSeedanceModel(model?: string): boolean {
  return Boolean(getVolcengineSeedanceCapability(model));
}

export function isVolcengineSeedance25Model(model?: string): boolean {
  return Boolean(model && normalizeVolcengineModelId(model) === 'doubao-seedance-2-5');
}
