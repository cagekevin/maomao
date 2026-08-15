/**
 * 子模块 0.4 — Resources 业务存储路由（sql.js 兼容版）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUploadDir, queryAll, queryOne, run, debouncedSaveDb, deleteLocalFile } from '../db/database.js';
import { json, parseJsonBody, sendError, parsePagination, buildPaginatedQuery, paginatedResult } from '../utils/helpers.js';
import { writeUploadBuffer } from '../utils/fileStore.js';

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

// MIME → 扩展名（dataURL 落盘时需要）。不在表内的兜底用 .bin。
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/bmp': '.bmp', 'image/svg+xml': '.svg',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-msvideo': '.avi', 'video/x-matroska': '.mkv',
  'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/flac': '.flac', 'audio/ogg': '.ogg', 'audio/x-m4a': '.m4a',
  'text/markdown': '.md', 'text/plain': '.txt',
};

/**
 * 把 dataURL（形如 data:<mime>;base64,xxxx）解成二进制 Buffer，并给出扩展名。
 * @returns null 表示不是可解析的 dataURL
 */
function decodeDataUrl(dataUrl: string): { buffer: Buffer; ext: string } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m || !m[3]) return null;
  const mime = (m[1] || '').toLowerCase();
  const isBase64 = !!m[2];
  let buffer: Buffer;
  try {
    buffer = isBase64 ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  } catch {
    return null;
  }
  if (buffer.length === 0) return null;
  const ext = MIME_TO_EXT[mime] || (isBase64 && mime.startsWith('image/') ? '.bin' : '.bin');
  return { buffer, ext };
}

// 本地工具服务基址：资源面板运行在 chrome-extension:// 页面，
// 直接 <img src="/files/..."> 会被解析成 chrome-extension://.../files/... → 404 破图。
// 因此 rescan 入库的 url 必须补全为可访问的完整地址。
const LOCAL_TOOL_BASE = 'http://127.0.0.1:18080';
function toAbsoluteFileUrl(relativePath: string): string {
  if (!relativePath) return relativePath;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `${LOCAL_TOOL_BASE}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
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

  // 递归扫描 upload 下某目录，把文件与子目录元数据同步进 resources 表。
  // relFolderPath: 相对 uploadDir 的目录路径（含子目录，如 'migrated/人物'；顶层目录传顶层名，如 'tasks'/'migrated'）。
  // 顶层目录本身不录 folder 类型（它们是遍历根）；其下的子目录才录 folder 类型并递归进入。
  const scanRescanDir = (
    dbh: unknown,
    absDir: string,
    relFolderPath: string,
    counters: { scanned: number; added: number; skipped: number },
  ): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === '.thumbnails') continue;
      const childRel = relFolderPath ? `${relFolderPath}/${entry.name}` : entry.name;

      // 文件夹：作为 type=folder 的资源录入，供资源面板浏览；再递归扫其内文件
      if (entry.isDirectory()) {
        counters.scanned++;
        const id = `local-${relFolderPath ? relFolderPath + '-' : ''}${entry.name}`;
        const exist = queryOne(dbh, 'SELECT id FROM resources WHERE id = ?', [id]);
        if (!exist) {
          const row = resourceToRow({
            id,
            url: toAbsoluteFileUrl(`/files/${childRel}`),
            type: 'folder',
            source: 'local-tool',
            folder: relFolderPath,
            name: entry.name,
            timestamp: Date.now(),
          });
          upsertResource(dbh, row);
          counters.added++;
        } else {
          counters.skipped++;
        }
        scanRescanDir(dbh, path.join(absDir, entry.name), childRel, counters);
        continue;
      }

      // 文件：按扩展名映射类型（图片/视频/音频/文本）
      const ext = path.extname(entry.name).toLowerCase();
      const type = extToFileType(ext);
      if (!type) continue;
      counters.scanned++;

      const url = toAbsoluteFileUrl(`/files/${childRel}`);
      const id = `local-${relFolderPath ? relFolderPath + '-' : ''}${entry.name}`;

      // 已存在同 id 则跳过（保留收藏/手动元数据）
      const exist = queryOne(dbh, 'SELECT id FROM resources WHERE id = ?', [id]);
      if (exist) {
        counters.skipped++;
        continue;
      }

      const stat = fs.statSync(path.join(absDir, entry.name));
      const row = resourceToRow({
        id,
        url,
        type,
        source: 'local-tool',
        folder: relFolderPath,
        name: entry.name,
        timestamp: stat.mtimeMs ? Math.floor(stat.mtimeMs) : Date.now(),
      });
      upsertResource(dbh, row);
      counters.added++;
    }
  };

  const counters = { scanned, added, skipped };
  for (const folder of subfolders) {
    scanRescanDir(db, path.join(uploadDir, folder), folder, counters);
  }
  scanned = counters.scanned;
  added = counters.added;
  skipped = counters.skipped;

  // 孤儿清理：库中 source='local-tool' 但磁盘上对应路径已不存在的记录删除。
  // 否则本地删了文件夹/文件后，rescan 只新增不删除，前端仍显示陈旧条目。
  let orphanDeleted = 0;
  const localRows = queryAll(db, `SELECT id, folder, name, type FROM resources WHERE source = 'local-tool'`) as Array<{ id: string; folder: string; name: string; type: string }>;
  for (const row of localRows) {
    const diskPath = path.join(uploadDir, row.folder, row.name);
    if (!fs.existsSync(diskPath)) {
      run(db, `DELETE FROM resources WHERE id = ?`, [row.id]);
      orphanDeleted++;
    }
  }

  debouncedSaveDb();
  return json(res, { ok: true, count: added, scanned, added, skipped, orphanDeleted });
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

  // dataURL 素材（剪贴板粘贴等）：先解码落盘为真实文件，再入库。
  // 否则只把 dataURL 长字符串塞进 SQLite、磁盘 upload/ 无文件，刷新/重开页面后素材会丢。
  // 落盘后 URL 改写为 18080 文件地址，与 ci/hi/rescan 共用同一文件体系，删除/备份也统一。
  if (typeof body.url === 'string' && body.url.startsWith('data:')) {
    const decoded = decodeDataUrl(body.url);
    if (decoded) {
      const folder = typeof body.folder === 'string' && body.folder ? body.folder : 'migrated';
      const filename = `clip-${Date.now()}${decoded.ext}`;
      try {
        const { urlPath } = writeUploadBuffer(folder, filename, decoded.buffer);
        body.url = toAbsoluteFileUrl(urlPath);
        // 落盘文件会被 rescan 扫到并以 `local-${folder}-${basename}` 为 id 入库（resources.ts:126）。
        // 前端剪贴板粘贴自造的 id 是时间戳字符串，与 rescan 的 id 不一致 → 同一文件两条记录（「来自剪贴板」+ 落盘文件各一条）。
        // 这里把 id 对齐为 rescan 命名，使 rescan 扫到同文件时因 id 相同而 skipped，避免前端重复显示。
        // 参考：docs/34 素材落盘修复 + 本处 dup 修复。
        const basename = path.basename(urlPath);
        body.id = `local-${folder}-${basename}`;
      } catch (e) {
        // 落盘失败不阻断：仍按原 dataURL 入库，避免前端报错
        console.error(`[resources] save dataURL 落盘失败，按原样入库:`, e);
      }
    }
  }

  const db = await getDb();
  upsertResource(db, resourceToRow(body));
  debouncedSaveDb();
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
  debouncedSaveDb();
  return json(res, { ok: true });
}

export async function handleResourcesDelete(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const id = url.searchParams.get('id');
  if (!id) return sendError(res, 'Missing id parameter', 400);

  const db = await getDb();
  const row = queryOne(db, 'SELECT url FROM resources WHERE id = ?', [id]) as { url?: string } | undefined;
  run(db, 'DELETE FROM resources WHERE id = ?', [id]);
  if (row?.url) deleteLocalFile(db, row.url);
  debouncedSaveDb();
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
    debouncedSaveDb();
    return json(res, { deleted: result.changes });
  } else {
    const result = run(db, 'DELETE FROM resources');
    if (body?.deleteFiles) {
      const uploadDir = getUploadDir();
      try {
        for (const entry of fs.readdirSync(uploadDir, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name === '.thumbnails' || entry.name === 'tasks') continue;
          for (const file of fs.readdirSync(path.join(uploadDir, entry.name))) {
            fs.unlinkSync(path.join(uploadDir, entry.name, file));
          }
        }
      } catch { /* ignore */ }
    }
    debouncedSaveDb();
    return json(res, { deleted: result.changes });
  }
}

/**
 * 重命名一条资源（同步改磁盘文件名 + resources 表记录）。
 * 仅支持 source='local-tool' 的本地文件型资源；保留原扩展名，只改文件名主体。
 * 用法：POST /api/resources/rename?id=<id>&name=<新名>
 */
export async function handleResourcesRename(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const id = url.searchParams.get('id');
  const rawName = url.searchParams.get('name');
  if (!id || !rawName) return sendError(res, 'Missing id or name', 400);

  const db = await getDb();
  const row = queryOne(db, 'SELECT * FROM resources WHERE id = ?', [id]) as Record<string, unknown> | undefined;
  if (!row) return sendError(res, 'Resource not found', 404);
  if (row.source !== 'local-tool' || row.type === 'folder') return sendError(res, '仅支持重命名本地文件', 400);

  const folder = (row.folder as string) || '';
  const oldName = row.name as string;
  const ext = path.extname(oldName);
  let base = String(rawName || '').trim();
  if (!base) return sendError(res, 'Invalid name', 400);
  // 用户可能带扩展名输入，去掉以统一保留原扩展名
  if (path.extname(base)) base = base.slice(0, base.length - path.extname(base).length);
  const newFileName = `${base}${ext}`;
  if (!newFileName || newFileName === oldName) return json(res, { ok: true, id, url: row.url, name: oldName });

  const uploadDir = getUploadDir();
  const oldPath = path.join(uploadDir, folder, oldName);
  const newPath = path.join(uploadDir, folder, newFileName);
  if (!fs.existsSync(oldPath)) return sendError(res, 'Source file not found', 404);
  if (fs.existsSync(newPath)) return sendError(res, '目标文件已存在', 409);

  try {
    fs.renameSync(oldPath, newPath);
  } catch (e) {
    return sendError(res, `Rename failed: ${(e as Error).message}`, 500);
  }

  // 同步 resources 表：旧记录删除，按新文件名重建（id/url 对齐 rescan 命名，避免重复）
  const newId = `local-${folder}-${newFileName}`;
  const newUrl = toAbsoluteFileUrl(`/files/${folder}/${newFileName}`);
  run(db, 'DELETE FROM resources WHERE id = ?', [id]);
  upsertResource(db, { ...resourceToRow(row), id: newId, url: newUrl, name: newFileName });
  debouncedSaveDb();
  return json(res, { ok: true, id: newId, url: newUrl, name: newFileName });
}
