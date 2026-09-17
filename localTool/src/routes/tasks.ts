/**
 * 子模块 0.4 — Tasks 业务存储路由（sql.js 兼容版）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getDb,
  queryAll,
  queryOne,
  run,
  debouncedSaveDb,
  beginTx,
  commitTx,
  rollbackTx,
} from '../db/database.js';
import {
  json,
  parseJsonBody,
  sendError,
  parsePagination,
  buildPaginatedQuery,
  paginatedResult,
} from '../utils/helpers.js';
import { runReferenceGc } from '../utils/orphanGc.js';

const SNAKE_TO_CAMEL: Record<string, string> = {
  task_id: 'taskId',
  node_id: 'nodeId',
  result_url: 'resultUrl',
  thumbnail_url: 'thumbnailUrl',
  error_msg: 'errorMsg',
  error_message: 'errorMessage',
  custom_output_type: 'customOutputType',
  channel_name: 'channelName',
  model_name: 'modelName',
  created_at: 'createdAt',
  not_found_count: 'notFoundCount',
  custom_result_data: 'customResultData',
  custom_raw_response: 'customRawResponse',
  request_data: 'requestData',
  response_data: 'responseData',
  media_meta: 'mediaMeta',
  extra_fields: 'extraFields',
  thread_id: 'threadId',
  poll_task_id: 'pollTaskId',
  submit_ack_at: 'submitAckAt',
  completed_at: 'completedAt',
  poll_count: 'pollCount',
};
const CAMEL_TO_SNAKE: Record<string, string> = {};
for (const [k, v] of Object.entries(SNAKE_TO_CAMEL)) CAMEL_TO_SNAKE[v] = k;
// 兼容别名：部分调用方用 id 而非 taskId，归一化到 task_id
CAMEL_TO_SNAKE['id'] = 'task_id';
// 兼容别名：部分调用方用 errorMessage 而非 errorMsg
CAMEL_TO_SNAKE['errorMsg'] ||= 'error_msg';

const JSON_FIELDS = new Set([
  'customResultData',
  'customRawResponse',
  'requestData',
  'responseData',
  'mediaMeta',
  'extraFields',
]);

function rowToTask(row: Record<string, unknown>) {
  const task: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key;
    if (typeof value === 'string' && JSON_FIELDS.has(camelKey)) {
      try {
        task[camelKey] = JSON.parse(value);
      } catch {
        task[camelKey] = value;
      }
    } else {
      task[camelKey] = value;
    }
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
  'task_id',
  'node_id',
  'prompt',
  'result_url',
  'thumbnail_url',
  'error_msg',
  'error_message',
  'custom_output_type',
  'channel_name',
  'model_name',
  'progress',
  'created_at',
  'not_found_count',
  'custom_result_data',
  'custom_raw_response',
  'request_data',
  'response_data',
  'media_meta',
  'extra_fields',
  'type',
  'status',
  'thread_id',
  'poll_task_id',
  'submit_ack_at',
  'completed_at',
  'poll_count',
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
    if (JSON_FIELDS.has(key) && typeof value === 'object' && value !== null)
      row[snakeKey] = JSON.stringify(value);
    else row[snakeKey] = value;
  }
  return { row, droppedKeys };
}

/**
 * 执行态 / 诊断列 —— **真相归后端 relay-poll**（`relay-poll.ts` 是提交·轮询·落盘 /files/ 的唯一执行方）。
 *
 * 【谁无权写（TD-08-38 · 2026-09-17）】前端来路（`/api/tasks/save`、`/api/tasks/batch-save`）**无权**改这些列：
 * 前端角色是「发意图 + GET attach 拿状态」的**消费者**（见 `base/api/relayProxy.ts` 文件头
 * 「前端只发意图 + GET attach，不再自轮询/自落盘/自写 result_url」），DB 才是真相。
 *
 * 【原先哪里错了】`upsertTask` 整行浅覆盖（`{...existing, ...row}`，后写者赢）+ 前端把整份 Task 快照发来 ⇒
 * 前端那条 **running 快照**只要比后端终态写晚到（前端 200ms 防抖 + 网络往返），就会把 DB 里的
 * `status='completed'` 改回 `running`、并把 `result_url` 抹成 `''`（前端 Task 的 `resultUrl` 初值就是空串）
 * ⇒ 任务中心刷新后「结果消失、任务永远卡在进行中」，而后端其实早已完成、图已在磁盘。
 * `request_data` 也在此列：它内嵌 `_relayPoll` 在途快照（`pendingSubmit`），被前端旧快照覆盖会让
 * 崩溃恢复误判「尚未出站」→ **重复提交**（TD-08-24 刚闭合的窗口）。
 */
const EXECUTION_OWNED_COLUMNS = new Set([
  'status',
  'progress',
  'result_url',
  'error_msg',
  'error_message',
  'thread_id',
  'poll_task_id',
  'submit_ack_at',
  'completed_at',
  'poll_count',
  'not_found_count',
  'request_data',
  'response_data',
]);

/**
 * 真 UPSERT（先取现有行合并，避免 DELETE+INSERT 抹掉已落库的诊断字段）。
 *
 * @param opts.owner 写方（默认 `'poller'` = 后端执行态真相源，可写全部列）。
 *   `'client'` = 前端来路：**行已存在且该行由后端持有执行句柄**（`request_data._relayPoll`）时，
 *   丢弃执行态列（见 `EXECUTION_OWNED_COLUMNS`）并留痕；**行不存在**、或该行无句柄（前端自执行链路，
 *   如文本/chat）时不受限 —— 前者前端建在途行必须能给 `status` 初值，后者前端本就是执行方。
 */
/**
 * 该行是否由**后端 relay-poll 持有执行句柄**（`request_data` 内嵌 `_relayPoll` 快照）。
 *
 * 【为什么用它当判据，而不是"前端一律不许写执行态"】执行态该归谁，取决于**谁是这条链路的执行方**：
 *  - 图/视频链路：前端 `POST /api/generate` → **后端 relay-poll** 提交·轮询·落盘，提交时会写入
 *    `request_data._relayPoll`（`pendingSubmit` → `taskId`）⇒ **后端是执行方**，前端无权改执行态；
 *  - 文本/chat 链路：后端**无句柄、不建任务行**（`routes/generate.ts` chat 分支），终态只有前端知道
 *    ⇒ 前端就是执行方，必须能写（否则文本任务永远停在 running —— 一刀切会造出这个回归）。
 * 一行有没有句柄是可判的事实，故判据用它，而不是全局假定。
 *
 * 解析不了（脏值）按**无句柄**处理并留痕：拿不到句柄事实时不得据此剥夺前端的写权。
 */
function hasRelayPollHandle(existing: Record<string, unknown> | undefined): boolean {
  const raw = existing?.request_data;
  if (typeof raw !== 'string') return false;
  try {
    return Boolean((JSON.parse(raw) as { _relayPoll?: unknown } | null)?._relayPoll);
  } catch {
    console.warn('[upsertTask:request_data-unparsable] request_data 非合法 JSON，按"无句柄"处理', {
      task_id: existing?.task_id,
    });
    return false;
  }
}

export function upsertTask(
  db: any,
  row: Record<string, unknown>,
  opts: { owner?: 'poller' | 'client' } = {},
) {
  const owner = opts.owner ?? 'poller';
  const existing = queryOne(db, `SELECT * FROM tasks WHERE task_id = ?`, [row.task_id]);
  let incoming = row;
  if (existing && owner === 'client' && hasRelayPollHandle(existing)) {
    incoming = {};
    const blocked: string[] = [];
    for (const [k, v] of Object.entries(row)) {
      if (EXECUTION_OWNED_COLUMNS.has(k)) blocked.push(k);
      else incoming[k] = v;
    }
    if (blocked.length) {
      // 失败必须可见（不是静默忽略）：若这条日志频繁出现，说明**某条链路缺执行方**（该由后端写却没写），
      // 要去补后端的终态写，而不是放开这里的判据（放开 = 回到"后写者赢"）。
      console.warn('[upsertTask:client-blocked] 前端来路越权写执行态列，已忽略', {
        task_id: row.task_id,
        cols: blocked,
      });
    }
  }
  const merged = existing ? { ...existing, ...incoming } : row;
  const keys = Object.keys(merged);
  const vals = keys.map((k) => merged[k]);
  const placeholders = keys.map(() => '?').join(', ');
  const cols = keys.join(', ');
  const updates = keys.map((k) => `${k} = excluded.${k}`).join(', ');
  run(
    db,
    `INSERT INTO tasks (${cols}) VALUES (${placeholders})
     ON CONFLICT(task_id) DO UPDATE SET ${updates}`,
    vals,
  );
}

export async function handleTasksGet(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const params = parsePagination(url, { sortBy: 'created_at', sortDir: 'DESC' });
  const searchColumns = [
    'task_id',
    'node_id',
    'prompt',
    'channel_name',
    'model_name',
    'error_msg',
    'created_at',
  ];
  const { sql, countSql, values, countValues } = buildPaginatedQuery(
    'tasks',
    params,
    searchColumns,
  );

  const db = await getDb();
  const rows = queryAll(db, sql, values);
  const countRow = queryOne(db, countSql, countValues);
  const total = countRow ? (countRow.total as number) : 0;

  return json(res, {
    code: 0,
    data: paginatedResult(rows.map(rowToTask), total, params.page, params.pageSize),
  });
}

export async function handleTasksSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  if (!body) return sendError(res, 'Missing body', 400);
  if (!body.taskId && !body.id) return sendError(res, 'Missing taskId or id field', 400);

  const db = await getDb();
  const { row, droppedKeys } = taskToRow(body);
  if (droppedKeys.length) console.warn(`[taskToRow:dropped] ${droppedKeys.join(', ')}`);
  upsertTask(db, row, { owner: 'client' }); // 前端来路：不许改执行态列（TD-08-38）
  debouncedSaveDb();
  return json(res, { code: 0, data: { ok: true } });
}

export async function handleTasksBatchSave(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown>[] | null;
  if (!body || !Array.isArray(body)) return sendError(res, 'Body must be an array', 400);

  const db = await getDb();
  beginTx(db);
  try {
    for (const task of body) {
      if (!task.taskId && !task.id) continue;
      const { row, droppedKeys } = taskToRow(task);
      if (droppedKeys.length) console.warn(`[taskToRow:dropped] ${droppedKeys.join(', ')}`);
      upsertTask(db, row, { owner: 'client' }); // 同 save：前端来路不许改执行态列
    }
    commitTx(db);
  } catch (e) {
    rollbackTx(db);
    throw e;
  }
  debouncedSaveDb();
  return json(res, { code: 0, data: { ok: true } });
}

export async function handleTasksDelete(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const id = url.searchParams.get('id');
  if (!id) return sendError(res, 'Missing id parameter', 400);

  const db = await getDb();
  // 【成功判据必须取结果事实 · 2026-09-17 TD-16-27】原实现丢弃 `run()` 返回值并恒回 `ok: true`：
  // 删不存在的 task_id（changes=0，实际什么都没删）也报成功。
  const r = run(db, 'DELETE FROM tasks WHERE task_id = ?', [id]);
  debouncedSaveDb();
  // 只删记录，删盘统一交给引用感知 GC（docs/13）：此处不再 deleteLocalFile，
  // 因为 deleteLocalFile 只查 tasks/resources 表、不查画布 KV，会误删画布仍在引用的图（问题2 根因）。
  await runReferenceGc(false);
  return json(res, { code: 0, data: { ok: r.changes > 0, deleted: r.changes } });
}

export async function handleTasksBatchDelete(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = (await parseJsonBody(req)) as { ids?: string[] } | null;
  if (!body || !body.ids || !Array.isArray(body.ids))
    return sendError(res, 'Missing ids array', 400);

  const db = await getDb();
  // 【成功判据必须取结果事实 · 2026-09-17 TD-16-27】原实现回 `deleted: body.ids.length`（**输入长度**）：
  // 传进来的 id 全不存在（0 行被删）也报「已删除 N 条」。现累加真实 `changes`。
  let deleted = 0;
  for (const id of body.ids)
    deleted += run(db, 'DELETE FROM tasks WHERE task_id = ?', [id]).changes;
  debouncedSaveDb();
  // 只删记录，删盘统一交给引用感知 GC（docs/13）
  await runReferenceGc(false);
  return json(res, { code: 0, data: { deleted, requested: body.ids.length } });
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

// 更新(2026-09-11)：persistThreadId 已删除——它是 /api/proxy 时代的 0 调用者死代码
// （docs/105-lovart-old-9004-退役删除手册 §阶段C 已点名未删）。thread_id 现由 relay-poll.ts
// runDirectSubmit 提交完成后直接 upsertTask 落库（见 relay-poll.ts），不再需要本函数。
