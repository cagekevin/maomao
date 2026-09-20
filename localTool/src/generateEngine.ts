/**
 * relay — localTool 后端生成层（统一收口）。
 *
 * 链路：前端只发意图 → POST /api/generate（routes/generate.ts）→ 本文件 relayGenerate
 * → ai-relay 引擎（localTool/src/ai-relay/，内置多平台目录，含 lovart 直连适配器）
 * → image/video 拿到远端结果后经 saveRemoteUrl 落盘成本地 /files/ url → 统一 {code,data} 回前端。
 *
 * 【2026-09-03 收口】/api/relay 已并入 /api/generate，本文件删除 handleRelay HTTP 薄壳，
 * relayGenerate 作为唯一生成引擎被 generate 端点复用（chat 同步走它，image/video 走 relay-poll）。
 * relay 引擎 / 13 厂商 / relay-poll 完整保留，仅收敛对外端点。
 *
 * 平台 baseUrl 真源 = ai-relay 内置目录；key 只进 .env（localTool 启动 loadDotEnv 注入 process.env）。
 * 参考图归一走 resolveLocalImages（唯一出站口纪律）。不改动 ai-relay 内部引擎代码。
 * 【2026-09-20】归一必须落在**分叉之后**（选定出站路径的那个分支里）—— 分叉之前算 = 算了不消费的那条，
 * 既白干又出假警（详见本文件 relayGenerate 内注释）。
 *
 * 总超时：异步（image/video）若网关一直 processing，绝不能无限轮询 —— 用 AbortSignal
 * 给整个执行套硬超时（默认 10 分钟），到点 abort 抛错（失败可见，不静默挂起）。
 */

import { chatWithTools, chat } from './ai-relay/index.js';
import { chatLovartText } from './ai-relay/providers/lovart/index.js';
import { resolveLocalImages, resolveImagesForEgress } from './utils/resolveLocalImages.js';
import { fetchWithProxy } from './utils/netProxy.js';
import { sendError } from './utils/helpers.js';
import {
  resolveProviderBaseUrl,
  resolveProviderApiKey,
  buildLovartDirectProfile,
} from './providerConfigStore.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

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

// 平台 baseUrl / apiKey 唯一实现已收口 providerConfigStore（resolveProviderBaseUrl /
// resolveProviderApiKey），本文件不再持有副本（2026-09-11 单一规则收口）。

/** 携带超时的 abort 信号（到点抛 AbortError，由 relayGenerate 捕获转 error）。 */
function makeTimeoutSignal(
  timeoutMs: number,
  external?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`生成超时（${Math.round(timeoutMs / 1000)}s）`)),
    timeoutMs,
  );
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
    const baseUrl = resolveProviderBaseUrl(providerId, input.baseUrl);
    // key 只进 .env（localTool 启动 loadDotEnv 注入 process.env），调用方显式传时优先。
    const apiKey = resolveProviderApiKey(providerId, input.apiKey);

    // ── 出站素材归一：**落在分叉之后**（2026-09-20 收口）──────────────────────────────
    // 素材以 URL 形态进来（前端把 /files/ 相对或绝对自指 URL 塞进 messages 的 image_url / video_url
    // 内容块），出站前必须变成"上游拿得到"的东西，否则上游读不到本机图、链路失效。
    // 形态的本体只有一种：**回读 uploads/ → 压 ≤1920 → 内联 data:base64**（E 方案，/files/ 是会话唯一真值）。
    // **所有网站都走这一条。** 唯一的例外是下面 lovart 分支的回环 URL，而它只是个妥协。
    //
    // 【为什么不在本函数顶部统一算（本次修的假报错就是它）】
    //   顶部 = 分叉之前 ⇒ 还不知道会走哪条路 ⇒ 算了的那份可能没人消费。
    //   铁证 logs 2026-09-20 13:42:45：同一张 png 先打 `[resolve:inline-img] … -> data:image (1522KB)`，
    //   紧接着又打 `[resolve:cdn-url] …` —— 两份都算了，前一份直接丢弃。
    //   假警：mp4 在 base64 叶子处 Jimp 必抛 → 打 error「读文件失败，保留原 URL（上游将显性失败）」，
    //   而 lovart 这条路径**不消费**这份结果（实测 13:37:06 / 13:38:18 两次带视频提问，报错行之后请求均 200）。
    //   该文案另属**越权**：形态实现层替生产者断言"上游将失败"这一因果结论（7 步法 Step 4 铁律③）。
    //   真警必须留：通用路径下上游**确实**读不到本机地址，读失败留痕是真的，不许静音。
    //
    // 【lovart 分支给回环 URL 是**妥协**，不是架构维度】
    //   本体只有一种：**内联 base64** —— **所有网站都走这条**（外部上游都读不到本机 /files/）。
    //   例外只有 lovart 这一个平台：它的 adapter 跑在本机进程内、能自己去下载回环 URL ⇒
    //   预压 base64 等于白干一趟 encode、再让 adapter decode 回来。**为了省掉这一趟**才给回环 URL。
    //   ⚠️ 就这么简单。**不设判据层、不写 ADR、不据此切文件或建"通道 / 平台"层** ——
    //      那些动作都是在把一个性能妥协固化成架构（2026-09-20 已翻过这个车，见轮次日志 §五 第 4 条）。
    //
    // 【另一件事，不在此处建抽象】"上游能不能消费这种素材"（如视频需抽帧转图）与上面的"怎么送出去"
    //   是两个问题；抽帧今天未实现（docs/plan/00-猫猫项目架构总览.md §2.3、lovart_attachments.ts:62 一致）。
    // 排障：若怀疑 /files/ 内联没命中，比对**分支内** inline 后的 messages 即可，勿回填 console.log。

    // ── chat + 画布 Agent（带 tools）分流：走 chatWithTools（OpenAI 兼容非流式）──
    // lovart 不支持流式+tools；魔搭等 OpenAI 兼容厂商无 data. 信封、一次返 tool_calls。
    // 本分支就地内联 base64（默认形态），魔搭读得到本机图。非流式，打字机留后补。
    if (capability === 'chat' && input.tools !== undefined) {
      const kitOut = await chatWithTools({
        apiKey,
        baseUrl,
        model,
        messages: (await resolveLocalImages(input.messages)) as unknown[],
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

    // ── chat 同步（无 tools）分流：非 lovart 厂商走通用 OpenAI，否则走 LOVART preset（data. 信封）──
    // lovart 返回 {code,data} 双信封，必须走 LOVART preset 剥 data.；魔搭等标准 OpenAI 无信封，
    // 走 kit chat()。否则预设按 data. 信封抽 text 会拿空（AI 助手非流式"不生效"根因）。
    if (capability === 'chat') {
      // lovart（原生直连）：走 adapter 非流式拿整段文本（对齐 Lovart chat 同步语义）
      if (providerId === 'lovart') {
        // HMAC profile 唯一构造已收口 providerConfigStore.buildLovartDirectProfile
        // （读 LOVART_* 凭证 + 代理 transport），本文件不再内联复制（2026-09-11）。
        const profile = buildLovartDirectProfile(baseUrl, { timeoutMs });
        // 参考图形态按 lovart 直连（cdn）：不把 messages 里 /files/ 预压 base64，而是保留
        // 回环可下载 URL 交给 adapter 自取（resolveLovartAttachments 下载→传 CDN），省 encode→decode。
        // **只有这一个平台走这条，且只是为了省这一步** —— 妥协，不是架构维度（见上）。
        // 本分支**就地**决定，不复用别处结果（顶部不归一，理由见上）。非图片媒体（mp4/音频）天然走
        // 这条 —— 不经过 Jimp，故不会有那条"读文件失败"的假警。
        const cdnMessages = (await resolveImagesForEgress(input.messages, 'cdn')) as {
          role: string;
          content?: string;
        }[];
        const text = await chatLovartText(profile, {
          model,
          messages: cdnMessages,
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
      // 本分支就地内联 base64（默认形态；此处 providerId ≠ 'lovart'）
      const text = await chat({
        apiKey,
        baseUrl,
        model,
        messages: (await resolveLocalImages(input.messages)) as unknown[],
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

    // ── image/video 异步生成：统一走 POST /api/generate → submitGenerateTask（relay-poll 异步句柄），
    // 本函数仅服务 chat（同步/流式）。此处兜底：若被以 image/video 误调，明确报错而非静默空结果。
    return {
      ...base,
      error: `${capability} 异步生成需经 POST /api/generate 提交异步句柄，请改用异步生成入口`,
      durationMs: Date.now() - startedAt,
    };
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
 * 【为什么存在】AI 助手要打字机 + function calling。lovart 不支持流式+tools；
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
    const baseUrl = resolveProviderBaseUrl(input.providerId, input.baseUrl);
    const apiKey = resolveProviderApiKey(input.providerId, input.apiKey);
    // 参考图统一内联 base64（唯一出站口纪律；魔搭读得到本机图）。
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
          // 主动规避 gzip：本层多为原样透传，避免前端解析被压缩打断
          // （对齐旧 agentChat.ts 行为，该文件已随 L3b 退役，语义保留）
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
    // 【TD-01-24】上游预算 = **调用方给的预算**（前端已把实际值写进 body.timeoutMs 并由路由转发过来）；
    // 这个 120_000 只在"调用方没给"时兜底 —— 它**不是口径**，别拿它当"后端默认 180s"那种第二份真相。
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
        for await (const chunk of body as AsyncIterable<Uint8Array>)
          text += new TextDecoder().decode(chunk);
      }
      let line: string;
      try {
        line = JSON.stringify(JSON.parse(text));
      } catch {
        line = text.replace(/\r?\n/g, '\\n');
      }
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
