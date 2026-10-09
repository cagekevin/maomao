/**
 * routes/openaiCompat — OpenAI 兼容面（把 localTool 的 Lovart 全能力暴露成 BeefTV 可直连的渠道）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么存在】BeefTV 的三个内置插件（`openai-chat-completions` / `openai-images` /
 * `openai-videos`）按 OpenAI 线协议出站（bearer 鉴权 + 固定端点）。本模块把这三条线协议
 * 映射到 localTool **既有生成链路**，从而让「已在 localTool 跑通的 Lovart」直接成为一个
 * BeefTV 渠道，无需在 BeefTV 侧写插件、也无需另起进程。
 *
 * 【红线：本模块只做「线协议 ↔ 既有入口」的翻译】
 *   - chat      → `relayGenerate`（同步；providerId=lovart 时走 providers/lovart 直连）
 *                 ⚠️ lovart 适配器**无 function calling** ⇒ 本层对其**丢弃 tools**（否则 relayGenerate
 *                 会走 chatWithTools 分支打 `{lovart基址}/chat/completions`，Lovart 无此端点必失败）；
 *                 `stream:true` 由本层把整段文本合成 OpenAI SSE（Lovart 无真流式）。
 *   - image/video → `submitGenerateTask` + `getGenerateStatus`（复用 relay-poll 的异步句柄，
 *                   不丢图、可重启恢复）
 *   ⇒ 本模块**不** import ai-relay、**不**自写 fetch、**不**碰 DB / 协议执行 / 轮询。
 *
 * 【与 BeefTV 插件的字段对齐（真源 = 各插件 docs/interface.md）】
 *   - chat  路径 `/chat/completions`；响应 `choices.0.message.content` / `...tool_calls`
 *   - image 路径 `/v1/images/generations`；响应 `data[].url`
 *   - video 路径 `POST /v1/videos`(multipart) → `GET /v1/videos/{id}` → `GET /v1/videos/{id}/content`
 *           响应 `id` / `status` / `url`
 *   ⚠️ 三条路径前缀**不一致**（chat 无 `/v1`，image/video 有）是插件 manifest 写死的差异；
 *     本模块对每条都**同时挂 `/v1` 与无 `/v1` 别名**，故 BeefTV 侧 baseUrl 统一填
 *     `http://127.0.0.1:18080` 即可全通。
 * ════════════════════════════════════════════════════════════════
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { json, parseJsonBody, parseMultipart, relativePathFromFilesUrl } from '../utils/helpers.js';
import { getUploadDir, getDb } from '../db/database.js';
import { relayGenerate } from '../generateEngine.js';
import { submitGenerateTask, getGenerateStatus, cancelGenerateTask } from '../relay-poll.js';
import { normalizeOverrideMs } from '../budget.js';
import { LOVART_MODEL_SPECS } from '../ai-relay/providers/lovart/lovart_config.js';
import { saveBase64ToFile } from '../utils/base64Externalize.js';
import { extToMime } from '../utils/mime.js';

/** 默认 providerId：本兼容面的目标 = 把 Lovart 接进 BeefTV；可用 body.providerId / ?provider= 覆盖。 */
const DEFAULT_PROVIDER = 'lovart';

/** 图片同步协议的轮询节奏 / 总等待上限（图片是同步响应，必须阻塞到终态）。 */
const IMAGE_POLL_INTERVAL_MS = 1500;
const IMAGE_WAIT_MS = 300_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newId(prefix: string): string {
  return `${prefix}${crypto.randomBytes(8).toString('hex')}`;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
}

/** OpenAI 错误信封（BeefTV 按 `error.code` / `error.message` 抽值，见各插件 manifest 的 errorPaths）。 */
function sendOpenAiError(
  res: ServerResponse,
  message: string,
  status = 500,
  code = 'upstream_error',
): void {
  json(res, { error: { message, type: code, code } }, status);
}

/** 从请求体 / 查询串解析本次任务的 providerId（默认 lovart）。 */
function resolveProviderId(body: Record<string, unknown>, url: URL): string {
  const q = url.searchParams.get('provider');
  return str(body.providerId) || q || DEFAULT_PROVIDER;
}

// ── GET /v1/models：列出 Lovart 可用模型（供 BeefTV 渠道发现）────────────────
export function handleOpenAiModels(_req: IncomingMessage, res: ServerResponse): void {
  const data = Object.entries(LOVART_MODEL_SPECS).map(([id, spec]) => ({
    id,
    object: 'model',
    created: 0,
    owned_by: 'lovart',
    // 非标准扩展：便于 BeefTV / 调试识别能力（chat | image | video）。
    category: spec.category.toLowerCase(),
  }));
  json(res, { object: 'list', data });
}

/**
 * OpenAI chat.completion.chunk 的 SSE 合成（把已拿到的整段文本写成流）。
 *
 * 【为什么需要】BeefTV（含其画布 Agent）可能带 `stream:true` 请求；若此时回普通 JSON，
 * 客户端按 SSE 解析会拿不到内容而报"聊天没成功"。Lovart 是「异步轮询拿整段文本」（无真流式），
 * 故这里把整段文本一次性写成 SSE chunk——语义等价、客户端照常工作。
 */
function streamChatCompletion(
  res: ServerResponse,
  opts: { model: string; text: string; toolCalls?: unknown[] },
): void {
  const id = newId('chatcmpl-');
  const created = Math.floor(Date.now() / 1000);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });
  const chunk = (delta: Record<string, unknown>, finish: string | null): string =>
    `data: ${JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      created,
      model: opts.model,
      choices: [{ index: 0, delta, finish_reason: finish }],
    })}\n\n`;
  const hasTools = Array.isArray(opts.toolCalls) && opts.toolCalls.length > 0;
  const first: Record<string, unknown> = { role: 'assistant', content: opts.text };
  if (hasTools) first.tool_calls = opts.toolCalls;
  res.write(chunk(first, null));
  res.write(chunk({}, hasTools ? 'tool_calls' : 'stop'));
  res.write('data: [DONE]\n\n');
  res.end();
}

// ── POST /chat/completions：文本（同步/SSE；lovart 走 providerId 分流）──────────
export async function handleOpenAiChatCompletions(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const body = asObj(await parseJsonBody(req));
  const providerId = resolveProviderId(body, url);
  const model = str(body.model) || 'lovart-chat';
  const messages = Array.isArray(body.messages) ? (body.messages as unknown[]) : [];
  const tools = Array.isArray(body.tools) ? (body.tools as unknown[]) : [];
  const wantStream = body.stream === true;
  // 【关键修复】Lovart 直连适配器**不支持 function calling**：一旦把 tools 透传给 relayGenerate，
  // generateEngine 会走 `chatWithTools` 分支 → POST `{lovart 基址}/chat/completions`（Lovart 无此
  // OpenAI 端点）⇒ 必失败（BeefTV 画布 Agent 恰好总带 tools，故"聊天没成功"）。故 lovart 丢弃 tools，
  // 退化为纯文本对话（Agent 把整段文本当最终回答）；其它 provider 照常透传（其 chatWithTools 有效）。
  const forwardTools = providerId === 'lovart' ? [] : tools;
  const out = await relayGenerate({
    providerId,
    capability: 'chat',
    model,
    messages,
    tools: forwardTools.length ? forwardTools : undefined,
    toolChoice: forwardTools.length ? body.tool_choice : undefined,
    timeoutMs: normalizeOverrideMs(body.timeout_ms ?? body.timeoutMs),
    persist: false, // 文本不落盘（聊天数据流）
  });
  if (!out.ok) {
    return sendOpenAiError(res, out.error || '聊天失败');
  }
  const hasTools = Array.isArray(out.toolCalls) && out.toolCalls.length > 0;
  if (wantStream) {
    return streamChatCompletion(res, { model, text: out.text ?? '', toolCalls: out.toolCalls });
  }
  const message: Record<string, unknown> = {
    role: 'assistant',
    content: out.text ?? (hasTools ? null : ''),
  };
  if (hasTools) message.tool_calls = out.toolCalls;
  json(res, {
    id: newId('chatcmpl-'),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: hasTools ? 'tool_calls' : 'stop',
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
}

// ── POST /v1/images/generations：图片（同步协议 → 阻塞到终态）─────────────────
export async function handleOpenAiImagesGenerations(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const body = asObj(await parseJsonBody(req));
  const providerId = resolveProviderId(body, url);
  const model = str(body.model);
  const prompt = str(body.prompt);
  const size = str(body.size);
  if (!model) return sendOpenAiError(res, 'Missing model', 400, 'invalid_request_error');
  if (!prompt) return sendOpenAiError(res, 'Missing prompt', 400, 'invalid_request_error');

  const frontTaskId = newId('oai_img_');
  const submit = await submitGenerateTask({
    frontTaskId,
    type: 'image',
    providerId,
    capability: 'image',
    model,
    prompt,
    size: size || undefined,
    timeoutMs: IMAGE_WAIT_MS,
  });
  if (!submit.ok) return sendOpenAiError(res, submit.error || '图片任务提交失败');

  // 同步阻塞：轮询到终态（BeefTV 的 images 插件无轮询，必须在一次响应里给全）。
  const deadline = Date.now() + IMAGE_WAIT_MS;
  while (Date.now() < deadline) {
    const st = await getGenerateStatus(frontTaskId);
    if (st.status === 'completed') {
      return json(res, {
        created: Math.floor(Date.now() / 1000),
        data: [{ url: st.url }],
      });
    }
    if (st.status === 'failed') return sendOpenAiError(res, st.error || '图片生成失败');
    if (st.status === 'unknown') {
      // 第三终态：可能已生成（不得诱导重提）——同步协议下只能如实报错，附上游原文。
      return sendOpenAiError(res, st.error || '图片提交结果未知', 502, 'unknown');
    }
    if (st.status === 'not-found') {
      return sendOpenAiError(res, st.error || '后端无此任务记录', 502, 'unknown');
    }
    await sleep(IMAGE_POLL_INTERVAL_MS);
  }
  return sendOpenAiError(
    res,
    `图片生成超时（${Math.round(IMAGE_WAIT_MS / 1000)}s）`,
    504,
    'timeout',
  );
}

// ── POST /v1/videos：视频提交（BeefTV 用 multipart，兼容 JSON）───────────────
export async function handleOpenAiVideosCreate(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const contentType = req.headers['content-type'] || '';
  let fields: Record<string, string> = {};
  let images: string[] | undefined;

  try {
    if (contentType.includes('multipart/form-data')) {
      const parsed = await parseMultipart(req);
      fields = parsed.fields;
      const ref = parsed.files['input_reference'];
      if (ref && ref.data && ref.data.length > 0) {
        // 参考图 → 落 uploads（内容寻址）→ /files/ url，交既有链路（出站时由 resolveLocalImages 内联 base64）。
        const dataUri = `data:${ref.mimeType || 'image/png'};base64,${ref.data.toString('base64')}`;
        const saved = saveBase64ToFile(dataUri, 'tasks', await getDb());
        if (!saved)
          return sendOpenAiError(
            res,
            '参考图落盘失败（非法图片数据）',
            400,
            'invalid_request_error',
          );
        images = [saved.url];
      }
    } else {
      const body = asObj(await parseJsonBody(req));
      fields = {
        model: str(body.model),
        prompt: str(body.prompt),
        seconds: str(body.seconds ?? body.duration),
        size: str(body.size),
        resolution_name: str(body.resolution_name ?? body.resolution),
      };
      if (typeof body.image === 'string' && body.image.startsWith('data:')) {
        const saved = saveBase64ToFile(body.image, 'tasks', await getDb());
        if (saved) images = [saved.url];
      }
    }
  } catch (e) {
    return sendOpenAiError(
      res,
      `解析请求体失败：${(e as Error).message}`,
      400,
      'invalid_request_error',
    );
  }

  const providerId = resolveProviderId({ providerId: fields.providerId }, url);
  const model = fields.model;
  const prompt = fields.prompt || '';
  if (!model) return sendOpenAiError(res, 'Missing model', 400, 'invalid_request_error');

  const frontTaskId = newId('oai_vid_');
  const submit = await submitGenerateTask({
    frontTaskId,
    type: 'video',
    providerId,
    capability: 'video',
    model,
    prompt,
    size: fields.size || undefined, // BeefTV 的 size = aspectRatio（如 16:9）
    resolution: fields.resolution_name || undefined,
    duration: fields.seconds || undefined,
    images,
  });
  if (!submit.ok) return sendOpenAiError(res, submit.error || '视频任务提交失败');

  // 异步：立即返回 id + 非终态 status，后续由 BeefTV 轮询 GET /v1/videos/{id}。
  return json(res, {
    id: frontTaskId,
    object: 'video',
    created: Math.floor(Date.now() / 1000),
    status: 'queued',
    model,
  });
}

/** 从 `/v1/videos/{id}` 或 `.../content` 路径取任务 id 段。 */
function videoIdFromPath(url: URL, withContent: boolean): string {
  const re = withContent ? /^\/v1\/videos\/([^/]+)\/content$/ : /^\/v1\/videos\/([^/]+)$/;
  const m = url.pathname.match(re);
  return m ? m[1] : '';
}

// ── GET /v1/videos/{id}：查询状态 ────────────────────────────────────────────
export async function handleOpenAiVideosGet(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const id = videoIdFromPath(url, false);
  if (!id) return sendOpenAiError(res, 'Missing video id', 400, 'invalid_request_error');
  const st = await getGenerateStatus(id);
  switch (st.status) {
    case 'completed':
      return json(res, { id, status: 'completed', url: st.url });
    case 'failed':
      return json(res, {
        id,
        status: 'failed',
        error: { code: 'generation_failed', message: st.error },
      });
    case 'unknown':
      // 可能已生成：报 failed 会诱导重提 —— 但 BeefTV 只认终态，故如实给 failed 语义 + 上游原文。
      return json(res, {
        id,
        status: 'failed',
        error: { code: 'unknown', message: st.error || '提交结果未知（可能已生成，请核对）' },
      });
    case 'running':
      return json(res, { id, status: 'processing', progress: st.progress ?? 0 });
    case 'not-found':
      return sendOpenAiError(res, st.error || '后端无此任务记录', 404, 'not_found');
    default: {
      // 穷尽性守卫：RelayTaskStatus 新增状态而此处漏处理 ⇒ 编译报错。
      const _exhaustive: never = st;
      return _exhaustive;
    }
  }
}

// ── GET /v1/videos/{id}/content：取最终视频字节 ──────────────────────────────
export async function handleOpenAiVideosContent(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const id = videoIdFromPath(url, true);
  if (!id) return sendOpenAiError(res, 'Missing video id', 400, 'invalid_request_error');
  const st = await getGenerateStatus(id);
  if (st.status !== 'completed') {
    return sendOpenAiError(res, '视频尚未完成', 409, 'not_ready');
  }
  // 本地 /files/ → 磁盘流；非本地（落盘失败回退的外链）→ 302 到原地址。
  const rel = relativePathFromFilesUrl(st.url);
  if (rel) {
    const filePath = path.join(getUploadDir(), rel);
    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': extToMime(path.extname(filePath)),
        'Content-Length': stat.size,
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }
  res.writeHead(302, { Location: st.url });
  res.end();
}

// ── DELETE /v1/videos/{id}：取消 ─────────────────────────────────────────────
export async function handleOpenAiVideosCancel(
  _req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const id = videoIdFromPath(url, false);
  if (!id) return sendOpenAiError(res, 'Missing video id', 400, 'invalid_request_error');
  const r = await cancelGenerateTask(id);
  if (!r.ok) return sendOpenAiError(res, '任务不存在或已结束', 404, 'not_found');
  return json(res, { id, status: 'cancelled' });
}
