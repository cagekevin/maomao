/**
 * ai/imageParameterMappings — 图片生成参数到各 Provider 请求字段的声明式映射。
 * 把 model、prompt、imageSize、aspectRatio、batchCount、referenceImageUrls 等上层参数
 * 按厂商与模型模式换算成各家 API 的真实字段名（如 apimart 的 resolution/size、火山 seedream 的 image），
 * 供 buildStandardImageRequestBody 生成图片请求体，避免在调用点散落厂商判断。
 */
import type { ImageReferenceRequestMode } from '../types/connection';

export type ImageParameterKey =
  | 'model'
  | 'prompt'
  | 'imageSize'
  | 'aspectRatio'
  | 'batchCount'
  | 'referenceImageUrls';

export interface ImageParameterMapping {
  providerId: string;
  modelPattern?: RegExp;
  fields: Partial<Record<ImageParameterKey, string>>;
  staticFields?: Record<string, unknown>;
}

export interface StandardImageRequestInput {
  modelName: string;
  prompt: string;
  count: number;
  size: string;
  imageUrls?: string[];
  imageReferenceRequestMode?: ImageReferenceRequestMode;
}

const DEFAULT_IMAGE_MAPPING: ImageParameterMapping = {
  providerId: '*',
  fields: {
    model: 'model',
    prompt: 'prompt',
    imageSize: 'size',
    batchCount: 'n',
    referenceImageUrls: 'image_urls',
  },
  staticFields: { response_format: 'url' },
};

/**
 * Provider/model overrides live here; UI parameters remain provider agnostic.
 * 只收录字段名与 DEFAULT_IMAGE_MAPPING 不同的 Provider；其余（standard 等）走兜底。
 */
export const IMAGE_PARAMETER_MAPPINGS: readonly ImageParameterMapping[] = [
  {
    providerId: 'apimart',
    fields: { model: 'model', prompt: 'prompt', imageSize: 'resolution', aspectRatio: 'size', batchCount: 'n', referenceImageUrls: 'image_urls' },
  },
  {
    providerId: 'volcengine',
    modelPattern: /seedream/i,
    fields: { model: 'model', prompt: 'prompt', imageSize: 'size', referenceImageUrls: 'image' },
    staticFields: { response_format: 'url', stream: false, watermark: true },
  },
  {
    providerId: 'runninghub',
    fields: { prompt: 'prompt', aspectRatio: 'aspectRatio', imageSize: 'resolution', referenceImageUrls: 'imageUrls' },
  },
];

export function resolveImageParameterMapping(providerId: string, modelId = ''): ImageParameterMapping {
  const normalizedProvider = providerId.trim().toLowerCase();
  return IMAGE_PARAMETER_MAPPINGS.find((mapping) =>
    mapping.providerId === normalizedProvider && (!mapping.modelPattern || mapping.modelPattern.test(modelId)),
  ) ?? DEFAULT_IMAGE_MAPPING;
}

export function mapImageParameters(
  providerId: string,
  modelId: string,
  values: Partial<Record<ImageParameterKey, unknown>>,
): Record<string, unknown> {
  const mapping = resolveImageParameterMapping(providerId, modelId);
  const output: Record<string, unknown> = { ...(mapping.staticFields ?? {}) };
  for (const [key, field] of Object.entries(mapping.fields)) {
    const value = values[key as ImageParameterKey];
    if (field && value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0)) {
      output[field] = value;
    }
  }
  return output;
}

export function buildStandardImageRequestBody(input: StandardImageRequestInput): Record<string, unknown> {
  const referenceField = input.imageReferenceRequestMode === 'generation-json-image-data-urls'
    ? 'image'
    : 'image_urls';
  const body = mapImageParameters('standard', input.modelName, {
    model: input.modelName,
    prompt: input.prompt,
    imageSize: input.size,
    batchCount: input.count,
    referenceImageUrls: input.imageUrls,
  });
  if (input.imageUrls?.length) {
    delete body.image_urls;
    body[referenceField] = input.imageUrls;
  }
  return body;
}
