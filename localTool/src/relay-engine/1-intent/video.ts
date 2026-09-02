/**
 * generate/video — 视频生成入口。
 *
 * 绝大多数中转站的视频接口是异步的：先提交拿任务 ID，再按 statusPath 轮询拿结果 URL。
 * 这里只负责把上层参数映射成协议变量，提交/轮询/重试/取结果全部由 executor 完成。
 */
import type { GenerateVideoInput, GenerateMediaResult } from '../contract';
import { compactVariables, normalizeFrames8n1, resolveModelRef, resolveProtocol, runModel } from './run';

export async function generateVideo(input: GenerateVideoInput): Promise<GenerateMediaResult> {
  const model = resolveModelRef(input.model, 'video');
  const protocol = resolveProtocol(input.protocol ?? model.protocol, 'video');
  const variables = compactVariables({
    model: model.model,
    prompt: input.prompt,
    n: input.n ?? 1,
    ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
    ...(input.resolution ? { seedanceResolution: input.resolution, resolution: input.resolution } : {}),
    ...(input.duration !== undefined ? { duration: input.duration } : {}),
    ...(input.fps !== undefined ? { fps: input.fps } : {}),
    // 部分模型硬性要求帧数为 8n+1，这里统一收敛
    ...(input.frames !== undefined
      ? { frames8n1: normalizeFrames8n1(input.frames), frames: input.frames }
      : {}),
    ...(input.generateAudio !== undefined ? { generateAudio: input.generateAudio } : {}),
    ...(input.imageUrls?.length ? { imageUrls: input.imageUrls } : {}),
    ...(input.firstFrameImage ? { firstImage: input.firstFrameImage } : {}),
    ...(input.lastFrameImage ? { lastImage: input.lastFrameImage } : {}),
    ...(input.videoUrls?.length ? { videoUrls: input.videoUrls } : {}),
    ...(input.audioUrls?.length ? { audioUrls: input.audioUrls } : {}),
  });

  const result = await runModel({
    connection: input.connection,
    protocol,
    category: 'video',
    variables,
    signal: input.signal,
  });
  if (!result.urls?.length) throw new Error('视频模型未返回结果 URL');
  return { urls: result.urls, ...(result.text ? { text: result.text } : {}), ...(result.taskId ? { taskId: result.taskId } : {}) };
}
