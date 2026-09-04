/**
 * providers/lovart/index — 唯一对外出口（barrel）。遵循 ADAPTER_SPEC（见 providers/ADAPTER_SPEC.md）。
 *
 * 对外暴露「统一适配器接口」：
 *   - 阻塞直调：generateImageLovart / generateVideoLovart / streamChatLovart（单测/直调）
 *   - 统一异步原语：submitLovartTask / pollLovartTaskOnce（★ 后端 relay 异步句柄用，不丢图）
 * 内部按 model 路由到 image/video/chat 实现。ai-relay/index.ts 的 createRelay 在此分流。
 */

import type { GenerateImageOptions, GenerateVideoOptions, StreamChatOptions } from '../../types.js';
import type { LovartDirectProfile } from './lovart_contract.js';
import { LOVART_MODEL_SPECS } from './lovart_config.js';
import { LovartError, LOVART_ERR_TYPES } from './lovart_errors.js';
import type { LovartClientDeps } from './lovart_client.js';
import { ensureLovartProject } from './lovart_project.js';
import { setLovartMode } from './lovart_client.js';
import { sendLovartChat } from './lovart_client.js';
import { resolveLovartAttachments } from './lovart_attachments.js';
import { buildLovartPrompt, buildLovartToolConfig } from './lovart_prompt.js';
import { pollLovartThread, extractLovartArtifacts, extractLovartText } from './lovart_task.js';
import { getLovartStatus, getLovartResult, confirmLovartThread } from './lovart_client.js';
import { synthesizeLovartChatStream } from './lovart_stream.js';

function toDeps(
  profile: LovartDirectProfile,
  signal?: AbortSignal,
  timeoutMs?: number,
): LovartClientDeps {
  return {
    baseUrl: profile.baseUrl,
    auth: profile.auth,
    signal: signal ?? profile.signal,
    timeoutMs: timeoutMs ?? profile.timeoutMs,
    transport: profile.transport,
    fetchImpl: profile.fetchImpl,
    pollIntervalMs: profile.pollIntervalMs,
    doneRecheckMs: profile.doneRecheckMs,
  };
}

function assertCategory(model: string, expected: 'IMAGE' | 'VIDEO' | 'CHAT'): void {
  const spec = LOVART_MODEL_SPECS[model];
  if (!spec || spec.category !== expected) {
    throw new LovartError(`模型 ${model} 不是${expected === 'IMAGE' ? '图片' : expected === 'VIDEO' ? '视频' : '对话'}模型`, -1, LOVART_ERR_TYPES.UPSTREAM);
  }
}

/**
 * 从 OpenAI 风格 messages 提取「纯文本」+「图片 URL 列表」。
 * 对齐 9004 main.py chat_completions：content 为字符串直接取；为数组时提取 text 块与
 * image_url 块（url 可为 data:base64 / http(s) / 本地 /files/ 路径，后续由 resolveLovartAttachments 上传 CDN）。
 */
function extractChatTextAndImages(messages?: Array<{ role?: string; content?: unknown }>): { text: string; images: string[] } {
  const textParts: string[] = [];
  const images: string[] = [];
  if (!messages || messages.length === 0) return { text: '', images };
  for (const m of messages) {
    const c = m?.content;
    if (typeof c === 'string') {
      if (c.trim()) textParts.push(c.trim());
      continue;
    }
    if (Array.isArray(c)) {
      let blockTexts: string[] = [];
      for (const block of c) {
        if (!block || typeof block !== 'object') continue;
        const b = block as { text?: string; type?: string; image_url?: { url?: string } | string };
        if (typeof b.text === 'string' && b.text.trim()) {
          blockTexts.push(b.text.trim());
        } else if (b.type === 'image_url') {
          const u = typeof b.image_url === 'string' ? b.image_url : b.image_url?.url;
          if (u) images.push(u);
        }
      }
      if (blockTexts.length) textParts.push(blockTexts.join(' '));
    }
  }
  return { text: textParts.join('\n'), images };
}

// ── 图片 ─────────────────────────────────────────────────────────────

export async function generateImageLovart(
  profile: LovartDirectProfile,
  opts: GenerateImageOptions,
): Promise<string[]> {
  const deps = toDeps(profile, opts.signal, opts.timeoutMs);
  assertCategory(opts.model, 'IMAGE');
  const projectId = await ensureLovartProject(deps);
  await setLovartMode(deps, false); // 锁 fast 配额轴（B4）
  const attachments = await resolveLovartAttachments(deps, opts.imageUrls);
  const prompt = buildLovartPrompt(opts.model, opts.prompt ?? '', opts.size, !!attachments);
  const toolConfig = buildLovartToolConfig(opts.model); // 结构化路选模型（B5）；prompt_only 返回 undefined（B7）
  const threadId = await sendLovartChat(deps, { prompt, projectId, attachments, toolConfig });
  const result = await pollLovartThread(deps, threadId);
  return extractLovartArtifacts(result);
}

// ── 视频 ─────────────────────────────────────────────────────────────

export async function generateVideoLovart(
  profile: LovartDirectProfile,
  opts: GenerateVideoOptions,
): Promise<{ url: string }> {
  const deps = toDeps(profile, opts.signal, opts.timeoutMs);
  assertCategory(opts.model, 'VIDEO');
  const vars = (opts.variables ?? {}) as Record<string, unknown>;
  const userPrompt = String(vars.prompt ?? '');
  const size = String(vars.size ?? '');
  const imageUrls = (vars.imageUrls as string[] | undefined) ?? undefined;
  // 视频额外参数拼进 gen_prefix，对齐 main.py:1237-1247（duration / aspect_ratio / resolution）。
  const extraParams: string[] = [];
  const dur = vars.duration;
  if (dur) extraParams.push(`duration: ${dur}`);
  const ar = vars.aspect_ratio;
  if (ar) extraParams.push(`aspect_ratio: ${ar}`);
  const res = vars.resolution;
  if (res) extraParams.push(`resolution: ${String(res).trim()}`);
  const projectId = await ensureLovartProject(deps);
  await setLovartMode(deps, false);
  const attachments = await resolveLovartAttachments(deps, imageUrls);
  const prompt = buildLovartPrompt(opts.model, userPrompt, size, !!attachments, extraParams);
  const toolConfig = buildLovartToolConfig(opts.model);
  const threadId = await sendLovartChat(deps, { prompt, projectId, attachments, toolConfig });
  const result = await pollLovartThread(deps, threadId);
  const urls = extractLovartArtifacts(result);
  const url = urls[0];
  if (!url) throw new LovartError('视频生成完成但未返回结果', -1, LOVART_ERR_TYPES.NO_ARTIFACT);
  return { url };
}

// ── 对话（流式合成 SSE） ─────────────────────────────────────────────

export async function streamChatLovart(
  profile: LovartDirectProfile,
  opts: StreamChatOptions,
): Promise<Response> {
  const deps = toDeps(profile, opts.signal, opts.timeoutMs);
  const spec = LOVART_MODEL_SPECS[opts.model];
  if (spec && spec.category !== 'CHAT') {
    // 非 chat 模型走对话不被鼓励，但允许（用可读名兜底）
  }
  const projectId = await ensureLovartProject(deps);
  await setLovartMode(deps, false);
  const { text: userText, images } = extractChatTextAndImages(opts.messages as Array<{ role?: string; content?: unknown }>);
  const attachments = await resolveLovartAttachments(deps, images.length ? images : undefined);
  const prompt = buildLovartPrompt(opts.model, userText, undefined, !!attachments);
  const toolConfig = buildLovartToolConfig(opts.model);
  const threadId = await sendLovartChat(deps, { prompt, projectId, attachments, toolConfig });
  const result = await pollLovartThread(deps, threadId);
  const text = extractLovartText(result);
  return synthesizeLovartChatStream(text, deps.signal); // 交回 parseStream
}

// ── 对话（非流式，9004 chat 同步文本语义，供后端 relayGenerate 用）──
// Lovart chat 是异步轮询拿整段文本（无真流式）；本函数 send→poll→抽 text，返回 string。
export async function chatLovartText(
  profile: LovartDirectProfile,
  opts: { model: string; messages?: unknown[]; signal?: AbortSignal; timeoutMs?: number },
): Promise<string> {
  const deps = toDeps(profile, opts.signal, opts.timeoutMs);
  const { text: userText, images } = extractChatTextAndImages(opts.messages as Array<{ role?: string; content?: unknown }>);
  const projectId = await ensureLovartProject(deps);
  await setLovartMode(deps, false);
  const attachments = await resolveLovartAttachments(deps, images.length ? images : undefined);
  const prompt = buildLovartPrompt(opts.model, userText, undefined, !!attachments);
  const toolConfig = buildLovartToolConfig(opts.model);
  const threadId = await sendLovartChat(deps, { prompt, projectId, attachments, toolConfig });
  const result = await pollLovartThread(deps, threadId);
  return extractLovartText(result);
}

// ── 统一异步任务原语（ADAPTER_SPEC §2：submitTask + pollTaskOnce，供 relay 异步句柄）──
// 阻塞式 generateImage/VideoLovart 只做单测/直调；后端 image/video 用这两段式进句柄，不丢图。

export interface LovartTaskInput {
  model: string;
  prompt?: string;
  /** IMAGE：具体像素（如 1024x1024）；VIDEO：比例（如 16:9） */
  size?: string;
  /** 参考图 URL / base64 列表 */
  images?: string[];
  /** video：清晰度（如 '1080p'） */
  resolution?: string;
  /** video：时长（秒，字符串） */
  duration?: string;
  /** 额外生成参数（透传给 buildLovartPrompt，拼进 gen_prefix），对齐 main.py:1237-1247 */
  extraParams?: string[];
}

export interface LovartTaskHandle {
  /** 原生上游任务 id（thread_id）；可序列化，凭证不入内 */
  threadId: string;
  projectId: string;
}

/** 提交一次 image/video 任务（project→set_mode→attachments→send），返回可持久化句柄，不等终态。 */
export async function submitLovartTask(
  profile: LovartDirectProfile,
  opts: LovartTaskInput & { capability: 'IMAGE' | 'VIDEO' },
): Promise<LovartTaskHandle> {
  const deps = toDeps(profile, profile.signal, profile.timeoutMs);
  assertCategory(opts.model, opts.capability);
  const projectId = await ensureLovartProject(deps);
  await setLovartMode(deps, false); // 锁 fast 配额轴（B4）
  const attachments = await resolveLovartAttachments(deps, opts.images);
  // 视频比例/清晰度/时长拼进 gen_prefix，对齐 main.py:1237-1247（aspect_ratio / duration / resolution）。
  // 前端 video 的 size 语义是比例（如 16:9），故对 VIDEO 将其作为 aspect_ratio，而非常量 extraParams。
  const extraParams = [...(opts.extraParams ?? [])];
  if (opts.capability === 'VIDEO' && opts.size) extraParams.push(`aspect_ratio: ${opts.size}`);
  if (opts.capability === 'VIDEO' && opts.duration) extraParams.push(`duration: ${opts.duration}`);
  if (opts.capability === 'VIDEO' && opts.resolution) extraParams.push(`resolution: ${String(opts.resolution).trim()}`);
  const prompt = buildLovartPrompt(opts.model, opts.prompt ?? '', opts.capability === 'IMAGE' ? opts.size : undefined, !!attachments, extraParams);
  const toolConfig = buildLovartToolConfig(opts.model); // 结构化路选模型（B5）
  const threadId = await sendLovartChat(deps, { prompt, projectId, attachments, toolConfig });
  return { threadId, projectId };
}

/**
 * 单次轮询（relay-poll 句柄后台驱动）：归一到 running/completed/failed。
 * pending_confirmation → auto-confirm 后算 running（下一轮续查）。单轮异常不误判终态。
 */
export async function pollLovartTaskOnce(
  profile: LovartDirectProfile,
  opts: { handle: LovartTaskHandle },
): Promise<{ status: 'running' | 'completed' | 'failed'; urls?: string[]; error?: string }> {
  const deps = toDeps(profile, profile.signal, profile.timeoutMs);
  try {
    const st = await getLovartStatus(deps, opts.handle.threadId);
    const s = String(st?.status ?? 'running');
    if (s === 'abort') return { status: 'failed', error: 'Lovart 任务被中止' };
    if (s === 'pending_confirmation') {
      await confirmLovartThread(deps, opts.handle.threadId); // auto-confirm 后下轮续查
      return { status: 'running' };
    }
    if (s === 'done') {
      const result = await getLovartResult(deps, opts.handle.threadId);
      if (result?.pending_confirmation) {
        await confirmLovartThread(deps, opts.handle.threadId);
        return { status: 'running' };
      }
      try {
        const urls = extractLovartArtifacts(result);
        return { status: 'completed', urls };
      } catch (e) {
        return { status: 'failed', error: (e as Error).message };
      }
    }
    return { status: 'running' };
  } catch (e) {
    return { status: 'running', error: (e as Error).message };
  }
}
