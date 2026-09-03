/**
 * routes/generate — 异步生成薄端点（锚定 relay 架构：submit 即返 taskId，GET attach）。
 *
 * 职责：前端意图 → relay-poll 句柄管理器（唯一协议执行出口）→ {code,data} 信封。
 * 端点内无 fetch / 轮询 / 字段抽取 / 落盘（C0/C5/M5-C1），全部收敛在 ai-relay kit + relay-poll。
 *
 *   POST /api/generate             提交 → 立即返 {code:0,data:{taskId}}（不等终态）
 *   GET  /api/generate/:frontTaskId  attach 查询 → progress / completed(url) / failed / not-found
 *   POST /api/generate/:frontTaskId/cancel   取消 → 置 failed
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import {
  submitGenerateTask,
  getGenerateStatus,
  cancelGenerateTask,
} from '../relay-poll.js';
import type { RelayCapability } from '../relay-poll.js';

/** POST /api/generate —— 提交即返 frontTaskId。 */
export async function handleGenerateSubmit(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  if (!body) return sendError(res, 'Missing body', 400);

  const frontTaskId = typeof body.frontTaskId === 'string' ? body.frontTaskId : '';
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : '';
  const type = typeof body.type === 'string' ? body.type : '';
  const providerId = typeof body.providerId === 'string' ? body.providerId : 'lovart';
  const capability: RelayCapability | undefined =
    body.capability === 'image' || body.capability === 'video' || body.capability === 'chat'
      ? body.capability
      : undefined;
  const model = typeof body.model === 'string' ? body.model : '';
  if (!frontTaskId) return sendError(res, 'Missing frontTaskId', 400);
  if (!capability) return sendError(res, 'Invalid or missing capability', 400);
  if (!model) return sendError(res, 'Missing model', 400);

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
