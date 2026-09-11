/**
 * 子模块 0.2 — KV 存储路由
 *
 * 【并发写入根治（docs/118 §三 S1）】
 *  - `handleKvSet` 支持 `ifVersion`（乐观并发 / CAS）：版本不符 → 409 且**一个字节都不写**；
 *    `ifVersion` 缺省 = 旧行为（无条件写 + 版本自增）→ 现有调用点零改动、可随时回滚。
 *  - `handleKvVersion`：轻量只读 `<key>_version`（跨源冲突轮询用，绝不拉整包）。
 *
 * ★★★ 原子性红线（勿删）★★★
 *   `await getDb()` 之后到 `return` 之间**禁止任何 await**：sql.js 是内存库、API 全同步，
 *   Node 单线程事件循环保证这段不被其它请求插入 → 天然 CAS。
 *   一旦中间插了 await（fetch / 文件 IO / contentSetAsync…），就退化成 TOCTOU，本方案失效。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb, queryOne, run, debouncedSaveDb } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import { externalizeBase64InValue } from '../utils/base64Externalize.js';

export async function handleKvGet(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const key = url.searchParams.get('key');
  if (!key) return sendError(res, 'Missing key parameter', 400);

  const db = await getDb();
  const row = queryOne(db, 'SELECT value FROM kv WHERE key = ?', [key]);

  if (!row) return json(res, null);

  try {
    return json(res, JSON.parse(row.value));
  } catch {
    return json(res, row.value);
  }
}

/**
 * POST /api/kv/set { key, value, ifVersion? }
 *  - `ifVersion === undefined` → 无条件写（导入/迁移/强制），版本自增，返回 `{ code:0, data:{ ok, version } }`；
 *  - `ifVersion !== 当前 <key>_version` → 409 `{ error:{code:'conflict'}, current }`，value 与 version 都不动；
 *  - `ifVersion === 当前版本` → 写 value；`<key>_version = max(Date.now(), cur+1)`。
 */
export async function handleKvSet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as {
    key?: string;
    value?: unknown;
    ifVersion?: number;
  } | null;
  if (!body || typeof body.key !== 'string') return sendError(res, 'Missing key field', 400);

  const db = await getDb();
  const versionKey = `${body.key}_version`;

  // ★★★ 以下到 return 之间禁止任何 await：原子 CAS 全部依赖这段同步执行 ★★★
  const curRow = queryOne(db, 'SELECT value FROM kv WHERE key = ?', [versionKey]) as
    { value?: string } | undefined;
  const cur = curRow?.value ? parseInt(String(curRow.value), 10) || 0 : 0;

  if (body.ifVersion !== undefined && body.ifVersion !== cur) {
    // 冲突：value 与 version 都不动（一个字节都不写）
    return json(res, { error: { code: 'conflict', message: '版本冲突' }, current: cur }, 409);
  }

  const value = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);
  // 方案②：把 value 里的 base64 图片外置为 uploads/ 磁盘文件，用 /files/ URL 替换后入库，
  // 避免 sql.js KV 库被 base64 撑大 → 全量 export + 同步写盘导致的卡死（docs/41）。
  // 失败字段自动回退保留原 base64，不破坏契约。
  const finalValue = externalizeBase64InValue(value);
  const next = Math.max(Date.now(), cur + 1);

  // sql.js 不支持 ON CONFLICT，用 DELETE + INSERT 模拟
  run(db, 'DELETE FROM kv WHERE key = ?', [body.key]);
  run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, unixepoch())', [
    body.key,
    finalValue,
  ]);
  run(db, 'DELETE FROM kv WHERE key = ?', [versionKey]);
  run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, unixepoch())', [
    versionKey,
    String(next),
  ]);

  debouncedSaveDb();
  return json(res, { code: 0, data: { ok: true, version: next } });
}

/**
 * GET /api/kv/version?key=<key> → `{ code:0, data:{ version } }`
 * 轻量：只读 `<key>_version`，不拉整包（3s 冲突轮询专用）。key 不存在/不可解析 → 0。
 */
export async function handleKvVersion(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const key = url.searchParams.get('key');
  if (!key) return sendError(res, 'Missing key parameter', 400);

  const db = await getDb();
  const row = queryOne(db, 'SELECT value FROM kv WHERE key = ?', [`${key}_version`]) as
    { value?: string } | undefined;
  const version = row?.value ? parseInt(String(row.value), 10) || 0 : 0;
  return json(res, { code: 0, data: { version } });
}

export async function handleKvDelete(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const key = url.searchParams.get('key');
  if (!key) return sendError(res, 'Missing key parameter', 400);

  const db = await getDb();
  run(db, 'DELETE FROM kv WHERE key = ?', [key]);
  debouncedSaveDb();
  return json(res, { code: 0, data: { ok: true } });
}
