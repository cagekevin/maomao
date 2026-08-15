/**
 * 子模块 0.4 — Tasks 业务存储路由（sql.js 兼容版）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb, queryAll, queryOne, run, debouncedSaveDb, beginTx, commitTx, rollbackTx, deleteLocalFile } from '../db/database.js';
import { json, parseJsonBody, sendError, parsePagination, buildPaginatedQuery, paginatedResult } from '../utils/helpers.js';

const SNAKE_TO_CAMEL: Record<string, string> = {
  task_id: 'taskId', node_id: 'nodeId', result_url: 'resultUrl', thumbnail_url: 'thumbnailUrl',
  error_msg: 'errorMsg', error_message: 'errorMessage',
  custom_output_type: 'customOutputType', channel_name: 'channelName',
  model_name: 'modelName', created_at: 'createdAt', not_found_count: 'notFoundCount',
  custom_result_data: 'customResultData', custom_raw_response: 'customRawResponse',
  request_data: 'requestData', response_data: 'responseData', media_meta: 'mediaMeta', extra_fields: 'extraFields',
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

  return json(res, paginatedResult(rows.map(rowToTask), total, params.page, params.pageSize));
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
  return json(res, { ok: true });
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
  return json(res, { ok: true });
}

export async function handleTasksDelete(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const id = url.searchParams.get('id');
  if (!id) return sendError(res, 'Missing id parameter', 400);

  const db = await getDb();
  const task = queryOne(db, 'SELECT result_url, thumbnail_url FROM tasks WHERE task_id = ?', [id]) as { result_url?: string; thumbnail_url?: string } | undefined;
  run(db, 'DELETE FROM tasks WHERE task_id = ?', [id]);
  if (task?.result_url) deleteLocalFile(db, task.result_url);
  if (task?.thumbnail_url) deleteLocalFile(db, task.thumbnail_url);
  debouncedSaveDb();
  return json(res, { ok: true });
}

export async function handleTasksBatchDelete(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { ids?: string[] } | null;
  if (!body || !body.ids || !Array.isArray(body.ids)) return sendError(res, 'Missing ids array', 400);

  const db = await getDb();
  const placeholders = body.ids.map(() => '?').join(', ');
  const rows = queryAll(db, `SELECT result_url, thumbnail_url FROM tasks WHERE task_id IN (${placeholders})`, body.ids) as Array<{ result_url?: string; thumbnail_url?: string }>;
  for (const id of body.ids) run(db, 'DELETE FROM tasks WHERE task_id = ?', [id]);
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.result_url && !seen.has(row.result_url)) { seen.add(row.result_url); deleteLocalFile(db, row.result_url); }
    if (row.thumbnail_url && !seen.has(row.thumbnail_url)) { seen.add(row.thumbnail_url); deleteLocalFile(db, row.thumbnail_url); }
  }
  debouncedSaveDb();
  return json(res, { deleted: body.ids.length });
}

export async function handleTasksClear(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();
  const rows = queryAll(db, 'SELECT result_url, thumbnail_url FROM tasks') as Array<{ result_url?: string; thumbnail_url?: string }>;
  const result = run(db, 'DELETE FROM tasks');
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.result_url && !seen.has(row.result_url)) { seen.add(row.result_url); deleteLocalFile(db, row.result_url); }
    if (row.thumbnail_url && !seen.has(row.thumbnail_url)) { seen.add(row.thumbnail_url); deleteLocalFile(db, row.thumbnail_url); }
  }
  debouncedSaveDb();
  return json(res, { deleted: result.changes });
}
