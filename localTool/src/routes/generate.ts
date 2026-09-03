/**
 * routes/generate — 统一生成入口（Step 6：/api/relay 已并入，删薄壳）。
 *
 * 职责：前端意图 → relay 层（唯一协议执行出口）→ {code,data} 信封。
 * 端点内无 fetch / 轮询 / 字段抽取 / 落盘（C0/C5），协议执行收敛在 ai-relay kit。
 * relay 引擎 / 13 厂商 / relay-poll 完整保留。
 *
 * 单入口但内部按 capability 走各自数据流（capability 只是入参，勿按模态拆端点）：
 *   - chat        → 聊天数据流：同步 relayGenerate await 出文本，直接返 {code:0,data:{status:'completed',text}}
 *                    （聊天空丁无句柄、不建任务行、不进 relay-poll；【红线】chat 进 poller 会进度卡 90）
 *   - image/video → 图片/视频数据流：异步句柄，submit 即返 {code:0,data:{taskId}}，GET attach 收结果
 *
 *   GET  /api/generate/:frontTaskId  attach 查询 → progress / completed(url) / failed / not-found（仅 image/video）
 *   POST /api/generate/:frontTaskId/cancel   取消 → 置 failed（仅 image/video）
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import {
  submitGenerateTask,
  getGenerateStatus,
  cancelGenerateTask,
} from '../relay-poll.js';
import type { RelayCapability } from '../relay-poll.js';
import { relayGenerate, relayChatStream } from '../relay.js';

/** POST /api/generate —— 统一生成入口：按 capability 分流到聊天/图片/视频数据流。 */
export async function handleGenerateSubmit(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  if (!body) return sendError(res, 'Missing body', 400);

  const providerId = typeof body.providerId === 'string' ? body.providerId : 'lovart';
  const capability: RelayCapability | undefined =
    body.capability === 'image' || body.capability === 'video' || body.capability === 'chat'
      ? body.capability
      : undefined;
  const model = typeof body.model === 'string' ? body.model : '';
  if (!capability) return sendError(res, 'Invalid or missing capability', 400);
  if (!model) return sendError(res, 'Missing model', 400);

  // ── 聊天数据流（前端 frontTaskId 有则透传，后端不消费——聊天无句柄、不建任务行）──
  if (capability === 'chat') {
    const tools = (Array.isArray(body.tools) ? body.tools : []) as unknown[];
    const hasTools = tools.length > 0;
    // AI 助手（带 tools）→ 默认流式打字机（SSE 透传，前端保留 tool_calls delta 解析）；
    // 显式请求流式或带工具 → 流式；否则同步 JSON 快路径。
    const wantStream = body.stream === true || hasTools;
    if (wantStream) {
      await relayChatStream(req, res, {
        providerId,
        model,
        messages: (Array.isArray(body.messages)
          ? (body.messages as unknown[])
          : (typeof body.prompt === 'string' ? [{ role: 'user', content: body.prompt }] : [])),
        tools: hasTools ? tools : undefined,
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
      });
      return;
    }

    const out = await relayGenerate({
      providerId,
      capability,
      model,
      prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
      messages: Array.isArray(body.messages) ? (body.messages as unknown[]) : undefined,
      images: Array.isArray(body.images) ? (body.images as string[]) : undefined,
      temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
      responseFormat: typeof body.response_format === 'string' ? body.response_format : undefined,
      persist: false, // 文本不落盘（聊天数据流）
    });
    if (!out.ok) {
      return json(res, { code: -1, data: { error: out.error || '聊天失败', providerId, capability } });
    }
    return json(res, {
      code: 0,
      data: {
        status: 'completed',
        kind: out.kind ?? 'text',
        text: out.text,
        providerId,
        model,
      },
    });
  }

  // ── 图片/视频数据流：异步句柄（frontTaskId 是句柄定位主键，必填）──
  const frontTaskId = typeof body.frontTaskId === 'string' ? body.frontTaskId : '';
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : '';
  const type = typeof body.type === 'string' ? body.type : '';
  if (!frontTaskId) return sendError(res, 'Missing frontTaskId', 400);

  const out = await submitGenerateTask({
    frontTaskId,
    nodeId,
    type,
    providerId,
    capability,
    model,
    prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
    size: typeof body.size === 'string' ? body.size : undefined,
    images: Array.isArray(body.images) ? (body.images as string[]) : undefined,
    messages: Array.isArray(body.messages) ? (body.messages as unknown[]) : undefined,
    resolution: typeof body.resolution === 'string' ? body.resolution : undefined,
    duration: body.duration !== undefined ? String(body.duration) : undefined,
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
  });
  if (!out.ok) return json(res, { code: -1, data: { error: out.error || '提交失败', frontTaskId } });
  return json(res, { code: 0, data: { taskId: out.frontTaskId, frontTaskId: out.frontTaskId } });
}

/** GET /api/generate/:frontTaskId —— attach 查询进度/结果。 */
export async function handleGenerateGet(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const frontTaskId = url.pathname.replace(/^\/api\/generate\//, '');
  if (!frontTaskId || frontTaskId === 'cancel' || frontTaskId.includes('/')) {
    return sendError(res, 'Missing frontTaskId', 400);
  }
  const st = await getGenerateStatus(frontTaskId);
  if (st.status === 'completed') {
    return json(res, { code: 0, data: { status: 'completed', url: st.url, type: st.type } });
  }
  if (st.status === 'failed') {
    return json(res, { code: 0, data: { status: 'failed', error: st.error } });
  }
  if (st.status === 'running') {
    return json(res, { code: 0, data: { status: 'running', progress: st.progress ?? 0 } });
  }
  return sendError(res, 'Task not found', 404);
}

/** POST /api/generate/:frontTaskId/cancel —— 取消（停句柄 + 置 failed）。 */
export async function handleGenerateCancel(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const frontTaskId = url.pathname.replace(/^\/api\/generate\//, '').replace(/\/cancel$/, '');
  if (!frontTaskId) return sendError(res, 'Missing frontTaskId', 400);
  const out = await cancelGenerateTask(frontTaskId);
  return json(res, { code: 0, data: { ok: out.ok } });
}
