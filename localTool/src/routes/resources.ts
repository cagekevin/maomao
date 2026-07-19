/**
 * 子模块 0.4 — Resources 业务存储路由（sql.js 兼容版）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUploadDir, queryAll, queryOne, run } from '../db/database.js';
import { json, parseJsonBody, sendError, parsePagination, buildPaginatedQuery, paginatedResult } from '../utils/helpers.js';

const SNAKE_TO_CAMEL: Record<string, string> = {
  id: 'id', url: 'url', type: 'type', source: 'source', folder: 'folder', name: 'name',
  page_url: 'pageUrl', page_title: 'pageTitle', is_favorite: 'isFavorite', timestamp: 'timestamp',
};
const CAMEL_TO_SNAKE: Record<string, string> = {};
for (const [k, v] of Object.entries(SNAKE_TO_CAMEL)) CAMEL_TO_SNAKE[v] = k;

function rowToResource(row: Record<string, unknown>) {
  const resource: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key;
    resource[camelKey] = camelKey === 'isFavorite' ? Boolean(value) : value;
  }
  return resource;
}

function resourceToRow(resource: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(resource)) {
    const snakeKey = CAMEL_TO_SNAKE[key] || key;
    row[snakeKey] = snakeKey === 'is_favorite' ? (value ? 1 : 0) : value;
  }
  return row;
}

function upsertResource(db: any, row: Record<string, unknown>) {
  const keys = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = keys.map(() => '?').join(', ');
  run(db, `DELETE FROM resources WHERE id = ?`, [row.id]);
  run(db, `INSERT INTO resources (${keys.join(', ')}) VALUES (${placeholders})`, vals);
}

export async function handleResourcesGet(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const params = parsePagination(url, { sortBy: 'timestamp', sortDir: 'DESC' });
  const searchColumns = ['id', 'url', 'type', 'source', 'folder', 'name', 'page_url', 'page_title', 'timestamp'];
  const { sql, countSql, values, countValues } = buildPaginatedQuery('resources', params, searchColumns);

  const db = await getDb();
  const rows = queryAll(db, sql, values);
  const countRow = queryOne(db, countSql, countValues);
  const total = countRow ? (countRow.total as number) : 0;

  return json(res, paginatedResult(rows.map(rowToResource), total, params.page, params.pageSize));
}

export async function handleResourcesSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  if (!body || !body.id) return sendError(res, 'Missing id field', 400);

  const db = await getDb();
  upsertResource(db, resourceToRow(body));
  return json(res, { ok: true });
}

export async function handleResourcesBatchSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown>[] | null;
  if (!body || !Array.isArray(body)) return sendError(res, 'Body must be an array', 400);

  const db = await getDb();
  for (const resource of body) {
    if (!resource.id) continue;
    upsertResource(db, resourceToRow(resource));
  }
  return json(res, { ok: true });
}

export async function handleResourcesDelete(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const id = url.searchParams.get('id');
  if (!id) return sendError(res, 'Missing id parameter', 400);

  const db = await getDb();
  run(db, 'DELETE FROM resources WHERE id = ?', [id]);
  return json(res, { ok: true });
}

export async function handleResourcesClear(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { folder?: string; deleteFiles?: boolean } | null;
  const db = await getDb();

  if (body?.folder) {
    const result = run(db, 'DELETE FROM resources WHERE folder = ?', [body.folder]);
    if (body.deleteFiles) {
      const folderPath = path.join(getUploadDir(), body.folder);
      if (fs.existsSync(folderPath)) fs.rmSync(folderPath, { recursive: true, force: true });
    }
    return json(res, { deleted: result.changes });
  } else {
    const result = run(db, 'DELETE FROM resources');
    if (body?.deleteFiles) {
      const uploadDir = getUploadDir();
      try {
        for (const entry of fs.readdirSync(uploadDir, { withFileTypes: true })) {
          if (entry.isDirectory() && entry.name !== '.thumbnails') {
            for (const file of fs.readdirSync(path.join(uploadDir, entry.name))) {
              fs.unlinkSync(path.join(uploadDir, entry.name, file));
            }
          }
        }
      } catch { /* ignore */ }
    }
    return json(res, { deleted: result.changes });
  }
}
