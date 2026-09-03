/**
 * generate — 各模态「配套支持」入口。把 12 个中转真正用起来：
 *   chat()         OpenAI 兼容文本生成（非流式）
 *   streamChat()   流式文本生成（SSE，逐 token 事件）
 *   generateImage() 图片生成（openai-image 预设或自定义协议）
 *   generateVideo() 视频生成（异步任务：自定义协议 + 轮询）
 *   generateAudio() 音频生成（异步任务：自定义协议 + 轮询）
 *
 * 这些都建立在 protocol/ 引擎之上：请求体怎么拼、流式怎么解析、异步怎么轮询、
 * 结果怎么从响应抽取，全部由声明式协议决定，调用方只需给 apiKey/baseUrl/模型/变量。
 */

import { corsSafeFetch } from '../httpTransport.js';
import { parseStream } from '../assistantStream.js';
import type {
  ChatOptions,
  StreamChatOptions,
  GenerateImageOptions,
  GenerateVideoOptions,
  GenerateAudioOptions,
  ModelProtocolProfile,
} from '../types.js';
import {
  executeModelProtocol,
  resolveModelExecutionProfile,
} from '../protocol/engine.js';
import { getModelProtocolPreset } from '../protocol/presets.js';

function chatUrl(baseUrl: string | undefined): string {
  return `${(baseUrl || '').replace(/\/+$/, '')}/chat/completions`;
}

function bearerHeaders(apiKey: string | undefined, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...extra,
  };
}

/** OpenAI 兼容文本生成（非流式），返回完整文本。 */
export async function chat({ apiKey, baseUrl, model, messages, signal, tools, toolChoice, timeoutMs }: ChatOptions): Promise<string> {
  const response = await corsSafeFetch(chatUrl(baseUrl), {
    method: 'POST',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
    }),
    signal,
  }, { timeoutMs });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let msg = `API 请求失败 (${response.status})`;
    try { msg = JSON.parse(text)?.error?.message || msg; } catch { if (text) msg += `: ${text.slice(0, 200)}`; }
    throw new Error(msg);
  }
  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型返回结果为空');
  return content;
}

/** 流式文本生成：逐 token 通过 onEvent 回调，返回拼接后的完整文本。 */
export async function streamChat({ apiKey, baseUrl, model, messages, signal, onEvent, timeoutMs }: StreamChatOptions): Promise<string> {
  const response = await corsSafeFetch(chatUrl(baseUrl), {
    method: 'POST',
    headers: bearerHeaders(apiKey),
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  }, { timeoutMs });
  return parseStream(response, { requestId: '', modelId: model, onEvent, signal });
}

/** 图片生成。protocol 省略时走 OpenAI 兼容 /images/generations 预设。 */
export async function generateImage({
  apiKey, baseUrl, model, prompt, size, width, height, imageUrls, n = 1, protocol, signal,
}: GenerateImageOptions): Promise<string[]> {
  const profile: ModelProtocolProfile = protocol
    ? { preset: 'custom', protocol }
    : { preset: 'openai-image' };
  const resolved = resolveModelExecutionProfile(profile);
  if (!resolved) throw new Error('图片协议解析失败');
  const result = await executeModelProtocol({
    apiKey,
    baseUrl,
    protocol: resolved,
    variables: {
      model,
      prompt,
      size,
      width,
      height,
      n,
      batchCount: n,
      imageUrls,
    },
    signal,
  });
  if (!result.urls || result.urls.length === 0) throw new Error('图片生成未返回结果');
  return result.urls;
}

/** 视频生成（异步任务）。视频接口无跨厂商标准端点，必须提供 protocol（自定义协议）。 */
export async function generateVideo({
  apiKey, baseUrl, model, variables, protocol, signal,
}: GenerateVideoOptions): Promise<{ url: string }> {
  if (!protocol) {
    throw new Error('视频生成必须提供自定义调用协议（protocol），系统不会猜测 /videos/generations 等端点');
  }
  const resolved = resolveModelExecutionProfile({ preset: 'custom', protocol });
  if (!resolved) throw new Error('视频协议解析失败');
  const result = await executeModelProtocol({
    apiKey,
    baseUrl,
    protocol: resolved,
    variables: { model, ...variables },
    signal,
  });
  const url = result.urls?.[0];
  if (!url) throw new Error('视频生成完成但未返回结果');
  return { url };
}

/** 音频生成（异步任务）。必须提供 protocol（自定义协议）。 */
export async function generateAudio({
  apiKey, baseUrl, model, variables, protocol, signal,
}: GenerateAudioOptions): Promise<{ url: string }> {
  if (!protocol) {
    throw new Error('音频生成必须提供自定义调用协议（protocol）');
  }
  const resolved = resolveModelExecutionProfile({ preset: 'custom', protocol });
  if (!resolved) throw new Error('音频协议解析失败');
  const result = await executeModelProtocol({
    apiKey,
    baseUrl,
    protocol: resolved,
    variables: { model, ...variables },
    signal,
  });
  const url = result.urls?.[0];
  if (!url) throw new Error('音频生成完成但未返回结果');
  return { url };
}

export { getModelProtocolPreset };
