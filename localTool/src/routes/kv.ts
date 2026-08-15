/**
 * 子模块 0.2 — KV 存储路由
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb, queryOne, run, debouncedSaveDb } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import { externalizeBase64InValue } from '../utils/base64Externalize.js';

export async function handleKvGet(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const key = url.searchParams.get('key');
  if (!key) return sendError(res, 'Missing key parameter', 400);

  const db = await getDb();
  const row = queryOne(db, 'SELECT value FROM kv WHERE key = ?', [key]);

  if (!row) return json(res, null);

  try { return json(res, JSON.parse(row.value)); }
  catch { return json(res, row.value); }
}

export async function handleKvSet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { key?: string; value?: string } | null;
  if (!body || typeof body.key !== 'string') return sendError(res, 'Missing key field', 400);

  const db = await getDb();
  const value = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);

  // 方案②：把 value 里的 base64 图片外置为 uploads/ 磁盘文件，用 /files/ URL 替换后入库，
  // 避免 sql.js KV 库被 base64 撑大 → 全量 export + 同步写盘导致的卡死（docs/41）。
  // 失败字段自动回退保留原 base64，不破坏 {ok:true} 契约。
  const finalValue = externalizeBase64InValue(value);

  // sql.js 不支持 ON CONFLICT，用 DELETE + INSERT 模拟
  run(db, 'DELETE FROM kv WHERE key = ?', [body.key]);
  run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, unixepoch())', [body.key, finalValue]);

  debouncedSaveDb();
  return json(res, { ok: true });
}

export async function handleKvDelete(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const key = url.searchParams.get('key');
  if (!key) return sendError(res, 'Missing key parameter', 400);

  const db = await getDb();
  run(db, 'DELETE FROM kv WHERE key = ?', [key]);
  debouncedSaveDb();
  return json(res, { ok: true });
}
