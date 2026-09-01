/**
 * 通用日志上报入口（全链路日志，docs/01-项目与画布存储链路）
 *
 * 这是【统一日志总线】的接收端，不绑定任何特定上游：
 *   - 前端 logger.ts 上报 → source 默认 "frontend"（向后兼容，body 不传 source 即前端）
 *   - 各后端服务（如 apimart-gateway:9004、未来其他网关/Worker）主动上报 →
 *     在 body 带 source 字段（如 "apimart" / "worker-xxx"），18080 以 [source] 前缀
 *     打进 console，随 logWriter 落盘 localtool_18080_*.log，并实时广播给日志面板 SSE。
 *
 * 这样「一键查一个任务完整生命周期」可 grep 数据库 + 18080 自身 + 前端 + 各后端
 * 同文件全链路；新增后端只需 POST /api/logs 带 source，零前端改动、不硬编码端口。
 *
 * body: { timestamp?, level?, source?, category?, action?, detail?, taskId?, nodeId? }
 *   - source: 来源标识（可选，默认 "frontend"）。任意字符串，用于日志前缀与面板归类。
 *   - detail 可为字符串或任意对象（对象会 JSON 序列化）。
 *   - taskId / nodeId 单独带出，便于按任务/节点一键 grep。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseJsonBody, json } from '../utils/helpers.js';
import { addLogClient, removeLogClient } from '../utils/logWriter.js';

export async function handleLogsPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await parseJsonBody(req);
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    // 空/非法 body 静默忽略，上报失败不应影响主链路
  }

  const timestamp = typeof body.timestamp === 'string' ? body.timestamp : new Date().toISOString();
  // level 白名单归一：仅允许已知级别，防止异常/注入值（如 "[error]"）导致面板误高亮
  const LEVELS = new Set(['debug', 'info', 'warn', 'error']);
  const levelRaw = typeof body.level === 'string' ? body.level.trim().toLowerCase() : '';
  const level = LEVELS.has(levelRaw) ? levelRaw : 'info';
  // source 归一：缺省即前端（向后兼容旧 logger.ts）；限制长度避免异常长串污染日志行
  let source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'frontend';
  if (source.length > 32) source = source.slice(0, 32);
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
  // 前缀 [source]，前端/各后端统一经此归一；logWriter 自动落盘 + SSE 广播
  console.log(`[${source}][${level}]${cat} ${action} ${timestamp}${tags ? ` ${tags}` : ''}${detailText ? ` ${detailText}` : ''}`);

  return json(res, { ok: true });
}

/**
 * 实时日志流（SSE）：前端「日志面板」经 EventSource('/api/logs/stream') 订阅，
 * 此后所有经 logWriter 的日志行（前端上报 [frontend] + 后端自身）实时推给面板。
 * 无历史回放（连接前日志不可见，需查 localtool_18080_*.log）；刷新即断开重连、面板清空。
 * 断连时由 req 'close' 移除 client，防内存泄漏；heartbeat 保活代理不掐断长连接。
 */
export async function handleLogsStream(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.write('retry: 3000\n\n'); // 前端 EventSource 断线自动重连间隔
  addLogClient(res);

  // 30s 心跳，避免中间代理因空闲掐断长连接
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { /* ignore */ }
  }, 30000);

  const cleanup = () => {
    clearInterval(heartbeat);
    removeLogClient(res);
    try { res.end(); } catch { /* ignore */ }
  };
  _req.on('close', cleanup);
}


