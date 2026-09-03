/**
 * relay — localTool 后端生成层（统一收口）。
 *
 * 链路：前端只发意图 → POST /api/relay（本文件 handleRelay）→ relayGenerate
 * → ai-relay 引擎（localTool/src/ai-relay/，内置 13 平台目录含第 13 平台 lovart/9004）
 * → image/video 拿到远端结果后经 saveRemoteUrl 落盘成本地 /files/ url → 统一 {code,data} 回前端。
 *
 * 平台 baseUrl 真源 = ai-relay 内置目录；key 只进 .env（localTool 启动 loadDotEnv 注入 process.env）。
 * 参考图归一走 resolveLocalImages（唯一出站口纪律）。不改动 ai-relay 内部引擎代码。
 *
 * 总超时：异步（image/video）若网关一直 processing，绝不能无限轮询 —— 用 AbortSignal
 * 给整个执行套硬超时（默认 10 分钟），到点 abort 抛错（失败可见，不静默挂起）。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getModelProtocolPreset, protocol, getProviderDefinition } from './ai-relay/index.js';
import { resolveLocalImages } from './utils/resolveLocalImages.js';
import { saveRemoteUrl } from './routes/files.js';
import { json, parseJsonBody, sendError } from './utils/helpers.js';
import type { ModelProtocolPresetName } from './ai-relay/types.js';

/** relay 生成结果统一落到 uploads 的顶层子目录（对齐 fileStore UPLOAD_ROOT_ALLOW 白名单）。 */
const RELAY_UPLOAD_SUBFOLDER = 'tasks';

export type RelayCapability = 'image' | 'video' | 'chat';

export interface RelayGenerateInput {
  providerId: string;
  capability: RelayCapability;
  model: string;
  prompt?: string;
  size?: string;
  messages?: unknown[];
  images?: string[];
  /** chat：采样温度（有传才进 body，preset 纯模板剔项） */
  temperature?: number;
  /** chat：response_format（如 'json_object'），TextNode JSON 依赖 */
  responseFormat?: string;
  /** 连接覆盖：存在则优先于 providers.json / .env（测试打 mock、同平台多实例用） */
  baseUrl?: string;
  apiKey?: string;
  /** 总超时毫秒；缺省 600000（10 分钟），异步轮询到点必抛，防无限挂 */
  timeoutMs?: number;
  signal?: AbortSignal;
  /**
   * 是否把生成结果落盘到本地 uploads。
   * image/video：拿到远端结果后经 saveRemoteUrl 下载成 /files/ 本地 url 再返回（后端收口落盘）；
   * chat：文本不落盘，直接返回。缺省 false（纯调用可测）；HTTP 入口应传 true。
   */
  persist?: boolean;
}

export interface RelayGenerateOutput {
  ok: boolean;
  /** 结果类型：image/video 落盘后返回本地 url；text 返回内容 */
  kind?: 'image' | 'video' | 'text';
  /** image/video：本地 /files/ url（persist 落盘后）或远端 url（未落盘） */
  url?: string;
  /** 原始远端结果 url（落盘前的上游地址，便于对照） */
  remoteUrl?: string;
  /** chat 文本结果 */
  text?: string;
  taskId?: string;
  providerId: string;
  capability: RelayCapability;
  model: string;
  error?: string;
  durationMs: number;
}

/** capability → ai-relay 内置 preset 名（第 13 平台 lovart）。 */
function presetNameFor(capability: RelayCapability): ModelProtocolPresetName {
  switch (capability) {
    case 'image':
      return 'lovart-image';
    case 'video':
      return 'lovart-video';
    case 'chat':
      return 'lovart-chat';
    default:
      return 'lovart-chat';
  }
}

function resolveBaseUrl(providerId: string, override?: string): string {
  if (override && override.trim()) return override.trim().replace(/\/+$/, '');
  // 平台 baseUrl 真源 = ai-relay 内置目录（第 13 平台 lovart 等，含 defaultBaseUrl）。
  const def = getProviderDefinition(providerId);
  const baseUrl = (def?.defaultBaseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error(`Provider ${providerId} 未配置接口地址`);
  return baseUrl;
}

/** 携带超时的 abort 信号（到点抛 AbortError，由 relayGenerate 捕获转 error）。 */
function makeTimeoutSignal(timeoutMs: number, external?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`生成超时（${Math.round(timeoutMs / 1000)}s）`)), timeoutMs);
  const onExternalAbort = () => controller.abort(external!.reason ?? new Error('请求已取消'));
  external?.addEventListener('abort', onExternalAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      external?.removeEventListener('abort', onExternalAbort);
    },
  };
}

/** 后端生成统一入口：意图 → ai-relay 引擎 → 结构化结果。 */
export async function relayGenerate(input: RelayGenerateInput): Promise<RelayGenerateOutput> {
  const startedAt = Date.now();
  const { providerId, capability, model } = input;
  const timeoutMs = input.timeoutMs ?? 600_000;
  const timeout = makeTimeoutSignal(timeoutMs, input.signal);
  const base: RelayGenerateOutput = {
    ok: false,
    providerId,
    capability,
    model,
    durationMs: 0,
  };

  try {
    const baseUrl = resolveBaseUrl(providerId, input.baseUrl);
    // key 只进 .env（localTool 启动 loadDotEnv 注入 process.env），调用方显式传时优先。
    const apiKey = input.apiKey ?? process.env[`API_PROVIDER_${providerId.toUpperCase()}_KEY`] ?? '';

    // 参考图归一：/files/ 磁盘图 → data: base64（唯一出站口纪律）。
    // chat 参考图在前端经 imageUrl.normalizeImageUrlsForSend + toImageContentBlocks 塞进 messages
    // 的 image_url 内容块（URL 形态，base64s:0）；顶层 images 前端不传。故对 messages 也做 resolveLocalImages
    // （深遍历就地 inline 内嵌的所有 /files/ URL），否则 9004 读不到本机图、链路失效。data:/公网幂等透传。
    const resolvedImages = input.images && input.images.length > 0
      ? ((await resolveLocalImages(input.images)) as string[])
      : undefined;
    const resolvedMessages = input.messages !== undefined
      ? (await resolveLocalImages(input.messages))
      : undefined;
    // 【排障埋点 · 2026-09-03 chat 参考图排查】打印 chat 是否带图 + 图片 URL 形态（inline 前），
    // 确认 resolveLocalImages 是否真的把 /files/ 内联成 base64（若图 URL 非 /files/ 则此处不命中）。
    if (capability === 'chat' && Array.isArray(input.messages)) {
      const rawImgUrls: string[] = [];
      const collect = (v: unknown): void => {
        if (typeof v !== 'object' || v === null) return;
        if (Array.isArray(v)) { v.forEach(collect); return; }
        const r = v as Record<string, unknown>;
        if (r.type === 'image_url' && r.image_url && typeof (r.image_url as { url?: unknown }).url === 'string') {
          rawImgUrls.push((r.image_url as { url: string }).url);
        }
        Object.values(r).forEach(collect);
      };
      collect(input.messages);
      if (rawImgUrls.length > 0) {
        console.log(`[relay-chat-image] 图片块 x${rawImgUrls.length}: ${rawImgUrls.map((u) => u.slice(0, 90)).join(' | ')}`);
      }
    }

    const variables: Record<string, unknown> = { model };
    if (input.prompt !== undefined) variables.prompt = input.prompt;
    if (input.size !== undefined) variables.size = input.size;
    if (resolvedMessages !== undefined) variables.messages = resolvedMessages;
    if (input.temperature !== undefined) variables.temperature = input.temperature;
    if (input.responseFormat !== undefined) variables.response_format = input.responseFormat;
    if (resolvedImages !== undefined) variables.imageUrls = resolvedImages;

    // 同步 image/video 参考图：与 relay-poll 同一修复（2026-09-03）——preset body 缺 image_url 字段，
    // 只进 variables.imageUrls 会被引擎忽略 → 上游收不到图。clone preset 把 data:base64 补进 body.image_urls。
    const protocolDef = structuredClone(getModelProtocolPreset(presetNameFor(capability)));
    if ((capability === 'image' || capability === 'video') && resolvedImages && resolvedImages.length > 0
        && protocolDef.submit?.body && typeof protocolDef.submit.body === 'object' && !Array.isArray(protocolDef.submit.body)) {
      (protocolDef.submit.body as Record<string, unknown>).image_urls = resolvedImages;
    }

    const result = await protocol.executeModelProtocol({
      apiKey,
      baseUrl,
      protocol: protocolDef,
      variables,
      signal: timeout.signal,
    });

    const output: RelayGenerateOutput = {
      ok: true,
      providerId,
      capability,
      model,
      durationMs: Date.now() - startedAt,
    };

    // 媒体（image/video）：拿到远端结果。persist 时后端落盘成本地 /files/ url（收口），否则回远端。
    const remoteUrl = result.urls && result.urls.length > 0 ? result.urls[0] : undefined;
    if (remoteUrl && (capability === 'image' || capability === 'video')) {
      output.kind = capability;
      output.remoteUrl = remoteUrl;
      output.url = input.persist
        ? (await saveRemoteUrl(RELAY_UPLOAD_SUBFOLDER, remoteUrl)).url
        : remoteUrl;
    }
    // 文本（chat）：直接返回内容，不落盘。
    if (result.text) {
      output.text = result.text;
      output.kind = output.kind ?? 'text';
    }
    if (result.taskId) output.taskId = result.taskId;
    return output;
  } catch (e) {
    return {
      ...base,
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    timeout.cleanup();
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/relay —— 前端发意图的唯一入口（统一收口回前端）
// 请求：{ providerId, capability:'image'|'video'|'chat', model, prompt?, size?, messages? }
// 响应：{ code:0, data:{ kind, url?|text?, taskId?, providerId, model } }
//     或 { code:-1, data:{ error, providerId, capability } }
// ══════════════════════════════════════════════════════════════
export async function handleRelay(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  if (!body) return sendError(res, 'Missing body', 400);

  const providerId = typeof body.providerId === 'string' ? body.providerId : '';
  const capability = body.capability === 'image' || body.capability === 'video' || body.capability === 'chat'
    ? body.capability
    : undefined;
  const model = typeof body.model === 'string' ? body.model : '';
  if (!providerId) return sendError(res, 'Missing providerId', 400);
  if (!capability) return sendError(res, 'Invalid or missing capability', 400);
  if (!model) return sendError(res, 'Missing model', 400);

  const input: RelayGenerateInput = {
    providerId,
    capability,
    model,
    prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
    size: typeof body.size === 'string' ? body.size : undefined,
    messages: Array.isArray(body.messages) ? (body.messages as unknown[]) : undefined,
    images: Array.isArray(body.images) ? (body.images as string[]) : undefined,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    responseFormat: typeof body.response_format === 'string' ? body.response_format : undefined,
    persist: true, // HTTP 入口默认落盘：图片/视频下载到 uploads 再回本地 url
  };

  const startedAt = Date.now();
  const out = await relayGenerate(input);
  const elapsed = Date.now() - startedAt;
  console.log(`[relay] providerId=${out.providerId} capability=${out.capability} model=${out.model} ok=${out.ok} kind=${out.kind ?? '-'} err=${out.error ?? ''} | ${elapsed}ms`);

  if (!out.ok) {
    return json(res, { code: -1, data: { error: out.error, providerId: out.providerId, capability: out.capability } });
  }
  return json(res, {
    code: 0,
    data: {
      kind: out.kind,
      url: out.url,
      text: out.text,
      taskId: out.taskId,
      providerId: out.providerId,
      model: out.model,
      durationMs: out.durationMs,
    },
  });
}
