/**
 * 即梦 CLI v1.4.17 模型目录与视频能力表。
 * 版本值必须与官方 CLI `--model_version` 完全一致（包括 5.0Pro 的大小写）。
 */
import type { VideoGenerationOperation } from '../types/protocol';

export interface DreaminaModelCatalogItem {
  version: string;
  label: string;
  description: string;
}

export interface DreaminaImageModelCatalogItem extends DreaminaModelCatalogItem {
  resolutions: readonly string[];
  supportsImageReference: boolean;
}

export interface DreaminaVideoCapability extends DreaminaModelCatalogItem {
  modelId: string;
  resolutions: readonly string[];
  defaultResolution: string;
  ratios: readonly string[];
  defaultRatio: string;
  ratioField: 'size';
  durations?: number[];
  minDuration: number;
  maxDuration: number;
  defaultDuration: number;
  audioField?: 'audio' | 'generate_audio';
  defaultAudio: boolean;
  operations: readonly VideoGenerationOperation[];
  maxImageReferences: number;
  maxVideoReferences: number;
  maxAudioReferences: number;
  maxTotalReferences: number;
  allowsAudioOnly: boolean;
}

const IMAGE_RATIOS_DESCRIPTION = '支持文生图、批量生成与自定义比例';
export const DREAMINA_IMAGE_RATIOS = ['21:9', '16:9', '3:2', '4:3', '1:1', '3:4', '2:3', '9:16'] as const;

export const DREAMINA_IMAGE_MODELS: readonly DreaminaImageModelCatalogItem[] = [
  { version: '3.0', label: '即梦 3.0', description: '经典文生图模型，1K/2K', resolutions: ['1K', '2K'], supportsImageReference: false },
  { version: '3.1', label: '即梦 3.1', description: '经典文生图增强版，1K/2K', resolutions: ['1K', '2K'], supportsImageReference: false },
  { version: '4.0', label: '即梦 4.0', description: IMAGE_RATIOS_DESCRIPTION, resolutions: ['2K', '4K'], supportsImageReference: true },
  { version: '4.1', label: '即梦 4.1', description: IMAGE_RATIOS_DESCRIPTION, resolutions: ['2K', '4K'], supportsImageReference: true },
  { version: '4.5', label: '即梦 4.5', description: '综合性能均衡，支持文生图/图生图', resolutions: ['2K', '4K'], supportsImageReference: true },
  { version: '4.6', label: '即梦 4.6', description: '画面质量增强，支持文生图/图生图', resolutions: ['2K', '4K'], supportsImageReference: true },
  { version: '4.7', label: '即梦 4.7', description: '细节增强，生成更稳定', resolutions: ['2K', '4K'], supportsImageReference: true },
  { version: '5.0', label: 'Seedream 5.0', description: '新版图片模型，2K/4K', resolutions: ['2K', '4K'], supportsImageReference: true },
  { version: '5.0Pro', label: 'Seedream 5.0 Pro', description: '旗舰图片模型，1.5K/2K/4K', resolutions: ['1.5K', '2K', '4K'], supportsImageReference: true },
] as const;

const VIDEO_RATIOS = ['1:1', '3:4', '16:9', '4:3', '9:16', '21:9'] as const;
const ALL_VIDEO_OPERATIONS: readonly VideoGenerationOperation[] = [
  'text-to-video',
  'image-to-video',
  'video-to-video',
];

function videoModel(
  item: DreaminaModelCatalogItem,
  overrides: Partial<DreaminaVideoCapability> = {},
): DreaminaVideoCapability {
  return {
    ...item,
    modelId: item.version,
    resolutions: ['720p'],
    defaultResolution: '720p',
    ratios: VIDEO_RATIOS,
    defaultRatio: '16:9',
    ratioField: 'size',
    minDuration: 4,
    maxDuration: 15,
    defaultDuration: 5,
    defaultAudio: false,
    operations: ALL_VIDEO_OPERATIONS,
    maxImageReferences: 9,
    maxVideoReferences: 3,
    maxAudioReferences: 3,
    maxTotalReferences: 12,
    allowsAudioOnly: false,
    ...overrides,
  };
}

export const DREAMINA_VIDEO_MODELS: readonly DreaminaVideoCapability[] = [
  videoModel({ version: 'seedance2.0', label: 'Seedance 2.0', description: '质量优先，支持全模态参考' }),
  videoModel({ version: 'seedance2.0fast', label: 'Seedance 2.0 Fast', description: '速度优先，支持全模态参考' }),
  videoModel(
    { version: 'seedance2.0_vip', label: 'Seedance 2.0 VIP', description: '高质量会员模型，最高 4K' },
    { resolutions: ['720p', '1080p', '4k'] },
  ),
  videoModel({ version: 'seedance2.0fast_vip', label: 'Seedance 2.0 Fast VIP', description: '快速会员模型，支持全模态参考' }),
  videoModel({ version: 'seedance2.0mini', label: 'Seedance 2.0 Mini', description: '轻量视频模型，支持全模态参考' }),
  videoModel(
    { version: 'seedance2.5', label: 'Seedance 2.5', description: '旗舰全模态视频，4–30 秒，最高 1080p' },
    {
      resolutions: ['480p', '720p', '1080p'],
      maxDuration: 30,
      maxImageReferences: 30,
      maxVideoReferences: 10,
      maxAudioReferences: 10,
      maxTotalReferences: 50,
      allowsAudioOnly: true,
    },
  ),
] as const;

function versionOf(model: string): string {
  const stripped = model.startsWith('dreamina/') ? model.slice('dreamina/'.length) : model;
  return stripped.toLowerCase();
}

export function getDreaminaImageModel(model?: string): DreaminaImageModelCatalogItem | undefined {
  if (!model) return undefined;
  const version = versionOf(model);
  return DREAMINA_IMAGE_MODELS.find((item) => item.version.toLowerCase() === version);
}

export function getDreaminaVideoCapability(model?: string): DreaminaVideoCapability | undefined {
  if (!model) return undefined;
  const version = versionOf(model);
  return DREAMINA_VIDEO_MODELS.find((item) => item.version.toLowerCase() === version);
}
