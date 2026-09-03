/**
 * relay — localTool 后端生成层（统一收口）。
 *
 * 链路：前端只发意图 → POST /api/generate（routes/generate.ts）→ 本文件 relayGenerate
 * → ai-relay 引擎（localTool/src/ai-relay/，内置 14 平台目录含 lovart/9004）
 * → image/video 拿到远端结果后经 saveRemoteUrl 落盘成本地 /files/ url → 统一 {code,data} 回前端。
 *
 * 【2026-09-03 收口】/api/relay 已并入 /api/generate，本文件删除 handleRelay HTTP 薄壳，
 * relayGenerate 作为唯一生成引擎被 generate 端点复用（chat 同步走它，image/video 走 relay-poll）。
 * relay 引擎 / 13 厂商 / relay-poll 完整保留，仅收敛对外端点。
 *
 * 平台 baseUrl 真源 = ai-relay 内置目录；key 只进 .env（localTool 启动 loadDotEnv 注入 process.env）。
 * 参考图归一走 resolveLocalImages（唯一出站口纪律）。不改动 ai-relay 内部引擎代码。
 *
 * 总超时：异步（image/video）若网关一直 processing，绝不能无限轮询 —— 用 AbortSignal
 * 给整个执行套硬超时（默认 10 分钟），到点 abort 抛错（失败可见，不静默挂起）。
 */

import { getModelProtocolPreset, protocol, getProviderDefinition, chatWithTools, chat } from './ai-relay/index.js';
import { resolveLocalImages } from './utils/resolveLocalImages.js';
import { saveRemoteUrl } from './routes/files.js';
import { fetchWithProxy } from './utils/netProxy.js';
import { sendError } from './utils/helpers.js';
import { readProviderConfigFile } from './providerConfigStore.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
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
  /** chat + 画布 Agent：function calling 工具 schema（有则走 chatWithTools 非流式出站） */
  tools?: unknown;
  /** chat：tool_choice（如 'auto'/'required'），配合 tools */
  toolChoice?: unknown;
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
  /** chat + 画布 Agent：tool_calls（chatWithTools 出站返回，非流式一次给全） */
  toolCalls?: unknown[];
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
  // 1) 唯一出站地址真源 = 用户配置文件 base_url（modelscope 等内置无 defaultBaseUrl、靠配置地址）。
  //    只读内置目录会忽略用户配置 → 报「未配置接口地址」（2026-09-03 modelscope 回归修复）。
  const file = readProviderConfigFile(providerId);
  const fileBase = typeof (file as { base_url?: unknown } | null)?.base_url === 'string'
    && (file as { base_url?: string }).base_url!.trim()
    ? (file as { base_url: string }).base_url
    : '';
  if (fileBase) return fileBase.replace(/\/+$/, '');
  // 2) 兜底内置目录 defaultBaseUrl
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
    // 【排障埋点 · 2026-09-03 chat 参考图排查】已确认参考图正常，埋点随 2026-09-04 清理移除；
    // 若再排查 /files/ 内联成 base64 是否命中，比对 resolvedMessages（inline 后）即可，勿回填 console.log。

    const variables: Record<string, unknown> = { model };
    if (input.prompt !== undefined) variables.prompt = input.prompt;
    if (input.size !== undefined) variables.size = input.size;
    if (resolvedMessages !== undefined) variables.messages = resolvedMessages;
    if (input.temperature !== undefined) variables.temperature = input.temperature;
    if (input.responseFormat !== undefined) variables.response_format = input.responseFormat;
    if (resolvedImages !== undefined) variables.imageUrls = resolvedImages;

    // ── chat + 画布 Agent（带 tools）分流：走 chatWithTools（OpenAI 兼容非流式）──
    // 9004(lovart) 不支持流式+tools；魔搭等 OpenAI 兼容厂商无 data. 信封、一次返 tool_calls。
    // 参考图已由 resolvedMessages 内联 base64，魔搭能读本机图。非流式，打字机留后补。
    if (capability === 'chat' && input.tools !== undefined) {
      const kitOut = await chatWithTools({
        apiKey,
        baseUrl,
        model,
        messages: (resolvedMessages ?? input.messages) as unknown[],
        tools: input.tools,
        toolChoice: input.toolChoice,
        signal: timeout.signal,
        timeoutMs,
      });
      return {
        ok: true,
        providerId,
        capability,
        model,
        kind: 'text',
        text: kitOut.text,
        toolCalls: kitOut.toolCalls,
        durationMs: Date.now() - startedAt,
      };
    }

    // ── chat 同步（无 tools）分流：非 9004/lovart 厂商走通用 OpenAI，否则走 LOVART preset（9004 data. 信封）──
    // 9004(lovart) 返回 {code,data} 双信封，必须走 LOVART preset 剥 data.；魔搭等标准 OpenAI 无信封，
    // 走 kit chat()。否则预设按 9004 信封抽 text 会拿空（AI 助手非流式"不生效"根因）。
    if (capability === 'chat') {
      const isLovart9004 = providerId === 'lovart' || /:9004/.test(baseUrl);
      if (!isLovart9004) {
        const text = await chat({
          apiKey,
          baseUrl,
          model,
          messages: (resolvedMessages ?? input.messages) as unknown[],
          signal: timeout.signal,
          timeoutMs,
        });
        return {
          ok: true,
          providerId,
          capability,
          model,
          kind: 'text',
          text,
          durationMs: Date.now() - startedAt,
        };
      }
    }

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

/**
 * relayChatStream — chat 流式出站（SSE 透传前端，打字机 + tool_calls delta）。
 * 【为什么存在】AI 助手要打字机 + function calling。9004(lovart) 不支持流式+tools；
 * 魔搭等 OpenAI 兼容厂商支持（无 data. 信封）。前端 roundTrip 自带 SSE + tool_calls delta 解析，
 * 故后端只把上游 SSE 原样透传；上游非 SSE（如不支持流式的厂商报错/降级）→ 读文本包 `data:`
 * 行回写（前端 tryParseNonStreamJsonFallback 兜底自动降级非流式），打字机在有流式的厂商生效。
 * 模型按 provider 分流：前端发 GenIntent(providerId + tools/stream)，此处 resolveBaseUrl/apiKey 出站。
 */
export async function relayChatStream(
  req: IncomingMessage,
  res: ServerResponse,
  input: {
    providerId: string;
    model: string;
    messages: unknown[];
    tools?: unknown[];
    baseUrl?: string;
    apiKey?: string;
    timeoutMs?: number;
  },
): Promise<void> {
  try {
    const baseUrl = resolveBaseUrl(input.providerId, input.baseUrl);
    const apiKey = input.apiKey
      ?? process.env[`API_PROVIDER_${input.providerId.toUpperCase()}_KEY`]
      ?? '';
    // 参考图统一内联 base64（唯一出站口纪律；魔搭读得到本机图）
    const msgs = (await resolveLocalImages(input.messages)) as unknown[];

    const controller = new AbortController();
    const frontSignal = (req as IncomingMessage & { signal?: AbortSignal }).signal;
    if (frontSignal) frontSignal.addEventListener('abort', () => controller.abort());

    const url = `${(baseUrl || '').replace(/\/+$/, '')}/chat/completions`;
    let upstream: Response;
    try {
      upstream = await fetchWithProxy(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          // 主动规避 gzip：本层多为原样透传，避免前端解析被压缩打断（对齐 agentChat.ts）
          'Accept-Encoding': 'identity',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: input.model,
          messages: msgs,
          stream: true,
          ...(input.tools && input.tools.length ? { tools: input.tools, tool_choice: 'auto' } : {}),
        }),
      });
    } catch (e) {
      return sendError(res, `upstream error: ${(e as Error).message}`, 502);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders?.();
    const timeoutMs = input.timeoutMs ?? 120_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const ctype = (upstream.headers.get('content-type') || '').toLowerCase();
    if (ctype.includes('text/event-stream')) {
      // 上游 SSE → 原样透传（含 tool_calls delta）。魔搭同步响应被当作非 SSE → 走下方兜底降级。
      try {
        const body = upstream.body as ReadableStream<Uint8Array> | null;
        if (body) {
          for await (const chunk of body as AsyncIterable<Uint8Array>) {
            if (res.writableEnded) break;
            res.write(chunk);
          }
        }
      } finally {
        clearTimeout(timer);
        if (!res.writableEnded) res.end();
      }
      return;
    }

    // 上游非 SSE（不支持流式 / 报错 JSON）→ 读文本包 data: 行回写，前端 auto 降级非流式解析
    try {
      let text = '';
      const body = upstream.body as ReadableStream<Uint8Array> | null;
      if (body) {
        for await (const chunk of body as AsyncIterable<Uint8Array>) text += new TextDecoder().decode(chunk);
      }
      let line: string;
      try { line = JSON.stringify(JSON.parse(text)); } catch { line = text.replace(/\r?\n/g, '\\n'); }
      if (!res.writableEnded) {
        res.write(`data: ${line}\n\n`);
        res.write('data: [DONE]\n\n');
      }
    } finally {
      clearTimeout(timer);
      if (!res.writableEnded) res.end();
    }
  } catch (e) {
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: -1, data: { error: (e as Error).message || String(e) } }));
    }
  }
}
