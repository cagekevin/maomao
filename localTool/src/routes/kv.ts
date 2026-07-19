/**
 * 子模块 0.2 — KV 存储路由
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb, queryOne, run } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';

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

  // sql.js 不支持 ON CONFLICT，用 DELETE + INSERT 模拟
  run(db, 'DELETE FROM kv WHERE key = ?', [body.key]);
  run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, unixepoch())', [body.key, value]);

  return json(res, { ok: true });
}
