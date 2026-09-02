/**
 * generate/image — 图片生成入口。
 *
 * 入参（prompt / size / imageSize / imageUrls）→ 生成图片。
 * 支持两条路（与 video/audio 对齐的协议驱动 + 保留的原 OpenAI 同步兜底）：
 *   - 调用方显式给了自定义协议（input.protocol 或 model.executionProfile.custom，含异步 submit/poll/result）
 *     → 走协议驱动 runModel，提交/轮询/取结果全部由 executor 完成（可承载 9004 等自定义异步网关）。
 *   - 未给自定义协议 → 保留原 OpenAI 同步生图行为（upstream/openai/image，支持 /images/generations
 *     与 edits-multipart 参考图），保证默认行为不回归。
 * 返回 { urls: string[], text?, taskId? }。
 */
import { generateImageStandard, type StandardImageParams } from '../upstream/openai/image';
import { compactVariables, resolveModelRef, resolveProtocol, runModel } from './run';
import type { ModelExecutionProtocol } from '../4-types/protocol';
import type { GenerateImageInput, GenerateMediaResult } from '../contract';

/** 从 "1024x1024" 解析出宽高；解析失败返回 undefined。 */
function parseDimensions(size?: string): { width: number; height: number } | undefined {
  if (!size) return undefined;
  const match = /^(\d+)[x×](\d+)$/i.exec(size.trim());
  if (!match) return undefined;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** 显式携带的自定义协议（input.protocol 或 RelayModelRef.executionProfile.custom）；无则 undefined */
function resolveExplicitProtocol(input: GenerateImageInput): ModelExecutionProtocol | undefined {
  if (input.protocol) return input.protocol;
  if (typeof input.model !== 'object') return undefined;
  const profile = input.model.executionProfile;
  return profile?.preset === 'custom' ? profile.protocol : undefined;
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateMediaResult> {
  // ── 路径 A：显式自定义协议（含异步）→ 协议驱动（与 video/audio 同一 runModel 底座）──
  const explicit = resolveExplicitProtocol(input);
  if (explicit) {
    const model = resolveModelRef(input.model, 'image');
    const protocol = resolveProtocol(input.protocol ?? model.protocol, 'image');
    const variables = compactVariables({
      model: model.model,
      prompt: input.prompt,
      n: input.n ?? 1,
      // size：像素字符串（如 '1024x1024'）；9004 异步 image 协议认 {{size}}
      ...(input.size ? { size: input.size } : {}),
      // 参考图：协议里声明了 image_urls(归一 imageUrls) 才会发出；无参考图时为空不污染请求体
      ...(input.imageUrls?.length ? { imageUrls: input.imageUrls } : {}),
    });
    const result = await runModel({
      connection: input.connection,
      protocol,
      category: 'image',
      variables,
      signal: input.signal,
    });
    if (!result.urls?.length && !result.text) throw new Error('图片模型未返回结果');
    return {
      urls: result.urls ?? [],
      ...(result.text ? { text: result.text } : {}),
      ...(result.taskId ? { taskId: result.taskId } : {}), // 异步协议：异步任务 ID，供断点续查
    };
  }

  // ── 路径 B：无自定义协议 → 保留原 OpenAI 同步生图（含 edits-multipart 参考图），不回归 ──
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
