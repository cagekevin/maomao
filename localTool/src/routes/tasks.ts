/**
 * 子模块 0.4 — Tasks 业务存储路由（sql.js 兼容版）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb, queryAll, queryOne, run, debouncedSaveDb, beginTx, commitTx, rollbackTx } from '../db/database.js';
import { json, parseJsonBody, sendError, parsePagination, buildPaginatedQuery, paginatedResult } from '../utils/helpers.js';
import { runReferenceGc } from '../utils/orphanGc.js';

const SNAKE_TO_CAMEL: Record<string, string> = {
  task_id: 'taskId', node_id: 'nodeId', result_url: 'resultUrl', thumbnail_url: 'thumbnailUrl',
  error_msg: 'errorMsg', error_message: 'errorMessage',
  custom_output_type: 'customOutputType', channel_name: 'channelName',
  model_name: 'modelName', created_at: 'createdAt', not_found_count: 'notFoundCount',
  custom_result_data: 'customResultData', custom_raw_response: 'customRawResponse',
  request_data: 'requestData', response_data: 'responseData', media_meta: 'mediaMeta', extra_fields: 'extraFields',
  thread_id: 'threadId', poll_task_id: 'pollTaskId',
  submit_ack_at: 'submitAckAt', completed_at: 'completedAt', poll_count: 'pollCount',
};
const CAMEL_TO_SNAKE: Record<string, string> = {};
for (const [k, v] of Object.entries(SNAKE_TO_CAMEL)) CAMEL_TO_SNAKE[v] = k;
// 兼容别名：部分调用方用 id 而非 taskId，归一化到 task_id
CAMEL_TO_SNAKE['id'] = 'task_id';
// 兼容别名：部分调用方用 errorMessage 而非 errorMsg
CAMEL_TO_SNAKE['errorMsg'] ||= 'error_msg';

const JSON_FIELDS = new Set(['customResultData', 'customRawResponse', 'requestData', 'responseData', 'mediaMeta', 'extraFields']);

function rowToTask(row: Record<string, unknown>) {
  const task: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key;
    if (typeof value === 'string' && JSON_FIELDS.has(camelKey)) {
      try { task[camelKey] = JSON.parse(value); } catch { task[camelKey] = value; }
    } else { task[camelKey] = value; }
  }
  // 补回 id 字段：前端（httpClient）的 diffAndPersistTasks 以任务对象的 `id` 作为去重 /
  // diff 基准键（按 e.id 建 map）。但本接口原本只把 task_id 映射成 taskId 返回，未回传
  // id，导致前端重载历史记录后 id 全为 undefined，diff map 全部 miss、整组被当作「新增」
  // 重新写回，任务中心的「日志」每次打开都重复累加（见 daily/11-前端任务唯一标识梳理报告）。
  // 此处令 id === taskId，使前端去重键在 reload 后仍能命中已有记录，避免重复写入。
  task.id = task.taskId;
  return task;
}

// 白名单：tasks 表中实际存在的列（来源 database.ts initTables）
// 只有这些列才能写入 DB；前端 task 对象携带的 loading 等纯 UI 字段会被过滤
const ALLOWED_TASK_COLUMNS = new Set([
  'task_id', 'node_id', 'prompt', 'result_url', 'thumbnail_url', 'error_msg',
  'error_message', 'custom_output_type', 'channel_name', 'model_name', 'progress',
  'created_at', 'not_found_count', 'custom_result_data', 'custom_raw_response',
  'request_data', 'response_data', 'media_meta', 'extra_fields', 'type', 'status',
  'thread_id', 'poll_task_id', 'submit_ack_at', 'completed_at', 'poll_count',
]);

function taskToRow(task: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  const droppedKeys: string[] = [];
  for (const [key, value] of Object.entries(task)) {
    const snakeKey = CAMEL_TO_SNAKE[key] || key;
    if (!ALLOWED_TASK_COLUMNS.has(snakeKey)) {
      droppedKeys.push(key);
      continue; // 过滤前端运行时字段（status/loading/errorMessage 等）
    }
    if (JSON_FIELDS.has(key) && typeof value === 'object' && value !== null) row[snakeKey] = JSON.stringify(value);
    else row[snakeKey] = value;
  }
  return { row, droppedKeys };
}

function upsertTask(db: any, row: Record<string, unknown>) {
  // 真 UPSERT：先取现有行合并，避免 DELETE+INSERT 抹掉已落库的诊断字段（request_data / response_data / error_msg 等）
  const existing = queryOne(db, `SELECT * FROM tasks WHERE task_id = ?`, [row.task_id]);
  const merged = existing ? { ...existing, ...row } : row;
  const keys = Object.keys(merged);
  const vals = keys.map(k => merged[k]);
  const placeholders = keys.map(() => '?').join(', ');
  const cols = keys.join(', ');
  const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');
  run(db,
    `INSERT INTO tasks (${cols}) VALUES (${placeholders})
     ON CONFLICT(task_id) DO UPDATE SET ${updates}`,
    vals);
}

export async function handleTasksGet(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const params = parsePagination(url, { sortBy: 'created_at', sortDir: 'DESC' });
  const searchColumns = ['task_id', 'node_id', 'prompt', 'channel_name', 'model_name', 'error_msg', 'created_at'];
  const { sql, countSql, values, countValues } = buildPaginatedQuery('tasks', params, searchColumns);

  const db = await getDb();
  const rows = queryAll(db, sql, values);
  const countRow = queryOne(db, countSql, countValues);
  const total = countRow ? (countRow.total as number) : 0;

  return json(res, { code: 0, data: paginatedResult(rows.map(rowToTask), total, params.page, params.pageSize) });
}

export async function handleTasksSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  if (!body) return sendError(res, 'Missing body', 400);
  if (!body.taskId && !body.id) return sendError(res, 'Missing taskId or id field', 400);

  const db = await getDb();
  const { row, droppedKeys } = taskToRow(body);
  if (droppedKeys.length) console.warn(`[taskToRow:dropped] ${droppedKeys.join(', ')}`);
  upsertTask(db, row);
  debouncedSaveDb();
  return json(res, { code: 0, data: { ok: true } });
}

export async function handleTasksBatchSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown>[] | null;
  if (!body || !Array.isArray(body)) return sendError(res, 'Body must be an array', 400);

  const db = await getDb();
  beginTx(db);
  try {
    for (const task of body) {
      if (!task.taskId && !task.id) continue;
      const { row, droppedKeys } = taskToRow(task);
      if (droppedKeys.length) console.warn(`[taskToRow:dropped] ${droppedKeys.join(', ')}`);
      upsertTask(db, row);
    }
    commitTx(db);
  } catch (e) {
    rollbackTx(db);
    throw e;
  }
  debouncedSaveDb();
  return json(res, { code: 0, data: { ok: true } });
}

export async function handleTasksDelete(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const id = url.searchParams.get('id');
  if (!id) return sendError(res, 'Missing id parameter', 400);

  const db = await getDb();
  run(db, 'DELETE FROM tasks WHERE task_id = ?', [id]);
  debouncedSaveDb();
  // 只删记录，删盘统一交给引用感知 GC（docs/13）：此处不再 deleteLocalFile，
  // 因为 deleteLocalFile 只查 tasks/resources 表、不查画布 KV，会误删画布仍在引用的图（问题2 根因）。
  await runReferenceGc(false);
  return json(res, { code: 0, data: { ok: true } });
}

export async function handleTasksBatchDelete(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { ids?: string[] } | null;
  if (!body || !body.ids || !Array.isArray(body.ids)) return sendError(res, 'Missing ids array', 400);

  const db = await getDb();
  for (const id of body.ids) run(db, 'DELETE FROM tasks WHERE task_id = ?', [id]);
  debouncedSaveDb();
  // 只删记录，删盘统一交给引用感知 GC（docs/13）
  await runReferenceGc(false);
  return json(res, { code: 0, data: { deleted: body.ids.length } });
}

export async function handleTasksClear(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();
  const result = run(db, 'DELETE FROM tasks');
  debouncedSaveDb();
  // 只删记录，删盘统一交给引用感知 GC（docs/13）：
  // 此前 handleTasksClear 会 deleteLocalFile 逐个删盘，而 deleteLocalFile 不查画布 KV，
  // 导致"清空任务"把画布仍在引用的图一起删掉 → 图片 404（问题2 根因）。
  await runReferenceGc(false);
  return json(res, { code: 0, data: { deleted: result.changes } });
}

/**
 * 持久化网关返回的 Lovart 上游 thread_id（打通"拿 thread_id 去 Lovart 查状态"链路）。
 *
 * 背景：thread_id 来自 Lovart `/chat` 返回，网关把它拼成 task_id（= "task_" + thread_id）返回给调用方。
 * 前端节点自造的任务 id 与它无关，故此前 thread_id 无落库。这里由 localTool 在 /api/proxy 转发
 * 网关响应时调用本函数，把 thread_id 写进 tasks 表。
 *
 * ⚠️ 关键修复（避免任务中心"多出来一个空任务"）：
 *   早期实现会为「网关 task_id」单独 upsert 一条占位行，而该行的 node_id/type/status 全为空，
 *   于是一次生图在任务中心产生两条记录：① 前端 task（有 nodeId，正常展示）② 网关 task_id 行（nodeId=null，垃圾）。
 *   轮询（pollTask.js）用的是前端任务行上的 pollTaskId 直接打网关，并不依赖这条网关行；
 *   所以这里【只为前端 frontTaskId 行补 thread_id】，绝不再为网关 task_id 单独建行，杜绝重复垃圾任务。
 *
 * @param threadId Lovart 上游真实 ID（task_id 去掉 task_ 前缀）
 * @param taskId   网关返回的 task_id（="task_"+threadId）——仅用于关联/调试，不再落库成独立任务行
 * @param meta     可选补充字段（node_id / prompt / model_name 等），供无前端落库时仍可追溯
 */
export async function persistThreadId(threadId: string, taskId: string, meta: Record<string, unknown> = {}, frontTaskId = '') {
  if (!threadId) return;
  const db = await getDb(); // getDb 是 async（sql.js 内存库首次需异步初始化），必须 await，否则拿到 Promise 无法 upsert
  // 只处理前端自造 task_id 行：把 thread_id 关联进去，供 pollTask 轮询用。
  if (frontTaskId) {
    const existingFront = queryOne(db, `SELECT task_id FROM tasks WHERE task_id = ?`, [frontTaskId]);
    if (existingFront) {
      // 前端行已存在：直接补 thread_id（合并，不新建）
      // 同步锚点 B 时刻 submit_ack_at：本函数被调用 = Lovart 已确认接单（拿到 thread_id）。
      run(db, `UPDATE tasks SET thread_id = ?, submit_ack_at = ? WHERE task_id = ?`, [threadId, Date.now(), frontTaskId]);
    } else {
      // 前端行尚未落库（网关响应早于前端 save 的极小概率）：以其 task_id 建行并带 thread_id。
      // 注意用 frontTaskId（前端 id，后续前端 save 同 id 会合并），绝不新建网关 task_id 行（那是 nodeId=null 的垃圾来源）。
      upsertTask(db, { task_id: frontTaskId, thread_id: threadId, submit_ack_at: Date.now(), created_at: Date.now(), ...meta });
    }
  }
  debouncedSaveDb();
}
