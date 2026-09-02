/**
 * generate/image — 图片生成入口。
 *
 * 入参（prompt / size / imageSize / imageUrls）→ 调用上游原版逻辑
 * （upstream/openai/image.ts，抽取自原项目 standardImage.ts）。
 * 原版支持：文生图（/images/generations）、图生图（image_urls 或 edits-multipart）。
 * 返回 { urls: [ { url, width, height } ] }。
 */
import { generateImageStandard, type StandardImageParams } from '../upstream/openai/image';
import type { GenerateImageInput, GenerateMediaResult } from '../contract';

/** 从 "1024x1024" 解析出宽高；解析失败返回 undefined。 */
function parseDimensions(size?: string): { width: number; height: number } | undefined {
  if (!size) return undefined;
  const match = /^(\d+)[x×](\d+)$/i.exec(size.trim());
  if (!match) return undefined;
  return { width: Number(match[1]), height: Number(match[2]) };
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateMediaResult> {
  const modelName = typeof input.model === 'string' ? input.model : input.model.model;
  const params: StandardImageParams = {
    apiKey: input.connection.apiKey,
    baseUrl: input.connection.baseUrl,
    modelName,
    prompt: input.prompt,
    // 原版用宽高算 size 字符串；优先从 input.size 解析，否则用 imageSize 档位（2K 默认）
    dimensions: parseDimensions(input.size) ?? { width: 2048, height: 2048 },
    ...(input.imageUrls?.length ? { imageUrls: input.imageUrls } : {}),
    ...(input.imageReferenceRequestMode ? { imageReferenceRequestMode: input.imageReferenceRequestMode } : {}),
  };
  const result = await generateImageStandard(params, input.signal);
  return { urls: [result.url] };
}
