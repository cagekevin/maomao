/**
 * 子模块 0.4 — Resources 业务存储路由（sql.js 兼容版）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUploadDir, queryAll, queryOne, run } from '../db/database.js';
import { json, parseJsonBody, sendError, parsePagination, buildPaginatedQuery, paginatedResult } from '../utils/helpers.js';

// ── rescan：扫描 upload 目录，把磁盘文件/文件夹元数据同步进 resources 表 ──
const RESCAN_FILE_TYPE: Record<string, string> = {
  // 图片
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image', '.bmp': 'image', '.svg': 'image',
  // 视频
  '.mp4': 'video', '.webm': 'video', '.mov': 'video', '.avi': 'video', '.mkv': 'video', '.flv': 'video', '.m4v': 'video',
  // 音频
  '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio', '.ogg': 'audio', '.m4a': 'audio',
  // 文本（md / txt 等统一归为 text，前端有文本渲染分支）
  '.md': 'text', '.markdown': 'text', '.txt': 'text',
};

function extToFileType(ext: string): string | null {
  return RESCAN_FILE_TYPE[ext.toLowerCase()] || null;
}

export async function handleResourcesRescan(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const uploadDir = getUploadDir();
  const db = await getDb();

  let scanned = 0;
  let added = 0;
  let skipped = 0;

  // 遍历 upload 子目录（tasks / migrated / 其它）
  let subfolders: string[] = [];
  try {
    subfolders = fs.readdirSync(uploadDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== '.thumbnails')
      .map((e) => e.name);
  } catch {
    return json(res, { ok: true, count: 0 });
  }

  for (const folder of subfolders) {
    const folderPath = path.join(uploadDir, folder);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(folderPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      // 文件夹：作为 type=folder 的资源录入，供资源面板浏览
      if (entry.isDirectory()) {
        scanned++;
        const id = `local-${folder}-${entry.name}`;
        const exist = queryOne(db, 'SELECT id FROM resources WHERE id = ?', [id]);
        if (exist) {
          skipped++;
          continue;
        }
        const row = resourceToRow({
          id,
          url: `/files/${folder}/${entry.name}`,
          type: 'folder',
          source: 'local-tool',
          folder,
          name: entry.name,
          timestamp: Date.now(),
        });
        upsertResource(db, row);
        added++;
        continue;
      }

      // 文件：按扩展名映射类型（图片/视频/音频/文本）
      const ext = path.extname(entry.name).toLowerCase();
      const type = extToFileType(ext);
      if (!type) continue;
      scanned++;

      const url = `/files/${folder}/${entry.name}`;
      const id = `local-${folder}-${entry.name}`;

      // 已存在同 id 则跳过（保留收藏/手动元数据）
      const exist = queryOne(db, 'SELECT id FROM resources WHERE id = ?', [id]);
      if (exist) {
        skipped++;
        continue;
      }

      const stat = fs.statSync(path.join(folderPath, entry.name));
      const row = resourceToRow({
        id,
        url,
        type,
        source: 'local-tool',
        folder,
        name: entry.name,
        timestamp: stat.mtimeMs ? Math.floor(stat.mtimeMs) : Date.now(),
      });
      upsertResource(db, row);
      added++;
    }
  }

  return json(res, { ok: true, count: added, scanned, added, skipped });
}

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
