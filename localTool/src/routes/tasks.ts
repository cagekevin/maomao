/**
 * 子模块 0.4 — Tasks 业务存储路由（sql.js 兼容版）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb, queryAll, queryOne, run } from '../db/database.js';
import { json, parseJsonBody, sendError, parsePagination, buildPaginatedQuery, paginatedResult } from '../utils/helpers.js';

const SNAKE_TO_CAMEL: Record<string, string> = {
  task_id: 'taskId', node_id: 'nodeId', result_url: 'resultUrl', thumbnail_url: 'thumbnailUrl',
  error_msg: 'errorMsg', custom_output_type: 'customOutputType', channel_name: 'channelName',
  model_name: 'modelName', created_at: 'createdAt', not_found_count: 'notFoundCount',
  custom_result_data: 'customResultData', custom_raw_response: 'customRawResponse',
  request_data: 'requestData', response_data: 'responseData', media_meta: 'mediaMeta', extra_fields: 'extraFields',
};
const CAMEL_TO_SNAKE: Record<string, string> = {};
for (const [k, v] of Object.entries(SNAKE_TO_CAMEL)) CAMEL_TO_SNAKE[v] = k;
// 兼容别名：部分调用方用 id 而非 taskId，归一化到 task_id（表无 id 列）
CAMEL_TO_SNAKE['id'] = 'task_id';

const JSON_FIELDS = new Set(['customResultData', 'customRawResponse', 'requestData', 'responseData', 'mediaMeta', 'extraFields']);

function rowToTask(row: Record<string, unknown>) {
  const task: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key;
    if (typeof value === 'string' && JSON_FIELDS.has(camelKey)) {
      try { task[camelKey] = JSON.parse(value); } catch { task[camelKey] = value; }
    } else { task[camelKey] = value; }
  }
  return task;
}

function taskToRow(task: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(task)) {
    const snakeKey = CAMEL_TO_SNAKE[key] || key;
    if (JSON_FIELDS.has(key) && typeof value === 'object' && value !== null) row[snakeKey] = JSON.stringify(value);
    else row[snakeKey] = value;
  }
  return row;
}

function upsertTask(db: any, row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = keys.map(() => '?').join(', ');
  run(db, `DELETE FROM tasks WHERE task_id = ?`, [row.task_id]);
  run(db, `INSERT INTO tasks (${keys.join(', ')}) VALUES (${placeholders})`, vals);
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
  upsertTask(db, taskToRow(body));
  return json(res, { ok: true });
}

export async function handleTasksBatchSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown>[] | null;
  if (!body || !Array.isArray(body)) return sendError(res, 'Body must be an array', 400);

  const db = await getDb();
  for (const task of body) {
    if (!task.taskId && !task.id) continue;
    upsertTask(db, taskToRow(task));
  }
  return json(res, { ok: true });
}

export async function handleTasksDelete(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const id = url.searchParams.get('id');
  if (!id) return sendError(res, 'Missing id parameter', 400);

  const db = await getDb();
  run(db, 'DELETE FROM tasks WHERE task_id = ?', [id]);
  return json(res, { ok: true });
}

export async function handleTasksBatchDelete(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { ids?: string[] } | null;
  if (!body || !body.ids || !Array.isArray(body.ids)) return sendError(res, 'Missing ids array', 400);

  const db = await getDb();
  for (const id of body.ids) run(db, 'DELETE FROM tasks WHERE task_id = ?', [id]);
  return json(res, { deleted: body.ids.length });
}

export async function handleTasksClear(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();
  const result = run(db, 'DELETE FROM tasks');
  return json(res, { deleted: result.changes });
}
