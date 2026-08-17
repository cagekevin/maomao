/**
 * 前端日志上报（全链路日志，docs/01-项目与画布存储链路）
 *
 * 背景：前端 logger.js 目前只打到浏览器 console，AI/脚本无法查前端侧日志。
 * 这里提供 POST /api/logs，让前端把日志上报到 localTool，以 [frontend] 前缀
 * 打进 console（随启动重定向进 localtool_18080.log），与后端日志同文件。
 * 这样「一键查一个任务完整生命周期」可 grep 数据库 + 后端日志 + 前端日志三处全链路。
 *
 * body: { timestamp?, level?, category?, action?, detail?, taskId?, nodeId? }
 *   - detail 可为字符串或任意对象（对象会 JSON 序列化）。
 *   - taskId / nodeId 单独带出，便于按任务/节点一键 grep。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseJsonBody, json } from '../utils/helpers.js';

export async function handleLogsPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await parseJsonBody(req);
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    // 空/非法 body 静默忽略，前端上报失败不应影响主链路
  }

  const timestamp = typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString();
  const level = typeof body.level === 'string' ? body.level : 'info';
  const category = typeof body.category === 'string' ? body.category : '';
  const action = typeof body.action === 'string' ? body.action : '';
  const taskId = typeof body.taskId === 'string' ? body.taskId : '';
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : '';

  let detailText = '';
  if (typeof body.detail === 'string') detailText = body.detail;
  else if (body.detail !== undefined && body.detail !== null) {
    try {
      detailText = JSON.stringify(body.detail);
    } catch {
      detailText = String(body.detail);
    }
  }

  // taskId/nodeId 单独带出（#taskId=.../#nodeId=...），便于按任务/节点一键 grep
  const tags = [
    taskId ? `#taskId=${taskId}` : '',
    nodeId ? `#nodeId=${nodeId}` : '',
  ].filter(Boolean).join(' ');
  const cat = category ? `[${category}]` : '';
  console.log(`[frontend][${level}]${cat} ${action} ${timestamp}${tags ? ` ${tags}` : ''}${detailText ? ` ${detailText}` : ''}`);

  return json(res, { ok: true });
}
