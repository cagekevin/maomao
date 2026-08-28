/**
 * 子模块 0.4 — Resources 业务存储路由（sql.js 兼容版）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUploadDir, queryAll, queryOne, run, debouncedSaveDb, rewriteUrlReferences } from '../db/database.js';
import { json, parseJsonBody, sendError, HttpStatusError, parsePagination, buildPaginatedQuery, paginatedResult } from '../utils/helpers.js';
import { writeUploadBuffer, ensureDir, resolveUploadFile } from '../utils/fileStore.js';
import { runReferenceGc } from '../utils/orphanGc.js';

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

/**
 * 资源 id 规则：`local-${folder}-${name}`（顶层文件 folder 为空 → `local-${name}`）。
 *
 * 【必须单一来源】rescan 录入与身份变更（改名/移动）**共用本函数**：
 * 若身份变更自造一套 id，rescan 再扫到同文件时会因 id 不同而重复录入一条
 * → 素材面板重复显示同一张图。这是清单 §8 决策 4 的硬约束，由 T11 守着。
 */
export function resourceIdOf(relPath: string): string {
  const dir = path.posix.dirname(relPath);
  const folder = !dir || dir === '.' ? '' : dir;
  const name = path.posix.basename(relPath);
  return folder ? `local-${folder}-${name}` : `local-${name}`;
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
    return json(res, { code: 0, data: { ok: true, count: 0 } });
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
        const id = resourceIdOf(childRel);
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
      const id = resourceIdOf(childRel);

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
  return json(res, { code: 0, data: { ok: true, count: added, scanned, added, skipped, orphanDeleted } });
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

  return json(res, { code: 0, data: paginatedResult(rows.map(rowToResource), total, params.page, params.pageSize) });
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
        body.id = resourceIdOf(`${folder}/${basename}`);
      } catch (e) {
        // 落盘失败不阻断：仍按原 dataURL 入库，避免前端报错
        console.error(`[resources] save dataURL 落盘失败，按原样入库:`, e);
      }
    }
  }

  const db = await getDb();
  upsertResource(db, resourceToRow(body));
  debouncedSaveDb();
  return json(res, { code: 0, data: { ok: true } });
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
  return json(res, { code: 0, data: { ok: true } });
}

export async function handleResourcesDelete(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const id = url.searchParams.get('id');
  if (!id) return sendError(res, 'Missing id parameter', 400);

  const db = await getDb();
  run(db, 'DELETE FROM resources WHERE id = ?', [id]);
  debouncedSaveDb();
  // 只删记录，删盘统一交给引用感知 GC（docs/13）：不再 deleteLocalFile，
  // 且该文件可能仍被画布 KV 或 tasks 引用，由 GC 全库引用裁决是否回收。
  await runReferenceGc(false);
  return json(res, { code: 0, data: { ok: true } });
}

export async function handleResourcesClear(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { folder?: string; deleteFiles?: boolean } | null;
  const db = await getDb();

  // 只删记录，绝不删盘（docs/13）：
  // 原实现 deleteFiles=true 时用 fs.rmSync(recursive) 整目录递归删 / fs.unlinkSync 循环逐个删，
  // 这是最危险的删盘——不看任何引用，画布/其它文件夹引用的文件也会被连带删除。
  // 现在删盘统一交给引用感知 GC（含画布 KV + tasks + resources 全库引用）在删除后裁决回收。
  // deleteFiles 参数仅作兼容保留（不再触发任何删盘动作）。
  if (body?.folder) {
    const result = run(db, 'DELETE FROM resources WHERE folder = ?', [body.folder]);
    debouncedSaveDb();
    await runReferenceGc(false);
    return json(res, { code: 0, data: { deleted: result.changes } });
  } else {
    const result = run(db, 'DELETE FROM resources');
    debouncedSaveDb();
    await runReferenceGc(false);
    return json(res, { code: 0, data: { deleted: result.changes } });
  }
}

/**
 * 资源身份变更的【唯一入口】—— 改名（rename）与移动归类（move）共用。
 *
 * 【为什么必须收口成一个】二者本质同一件事：资源的 url 身份变了（文件名变 / 所在目录变）。
 * 此前 `handleResourcesRename` 与 `files.ts handleMove` 各写一遍，第二份抄漏了三步：
 * 目标存在性判重（→ 静默覆盖丢数据）、resources 表行重建（→ 收藏丢失 + GC 误删窗口）、
 * 落盘（→ 改写停在内存，进程强杀即丢）。清单 §8 P0-1/P0-2/P1-3 全部源于此。
 * 收口后两侧在结构上不可能再不对称。
 *
 * 【一次调用完成的五件事】
 *  1. 路径安全解析（拒绝越出 uploads 的 `..` 逃逸）
 *  2. 目标已存在 → 409（禁止静默覆盖，源与目标都保持完好）
 *  3. 磁盘 renameSync
 *  4. resources 表行重建：有旧行则迁移（保留 is_favorite 等元数据），无旧行则按 rescan
 *     规则补建（保证"磁盘有文件、表内无行"的不一致态不会残留）
 *  5. 库内旧 url 引用改写（kv + tasks，raw/encodeURI × 绝对/相对 四态）+ 落盘
 *
 * 【id 硬约束】新行 id 必须走 resourceIdOf（即 rescan 的 `local-${folder}-${name}` 规则），
 * 否则下次 rescan 会重复录入同一文件 → 面板重复显示（T11 护栏）。
 *
 * @throws {HttpStatusError} 400 非法路径 / 404 源不存在 / 409 目标已存在 / 500 磁盘失败
 */
export async function applyResourceIdentityChange(opts: {
  /** 旧相对路径（相对 uploadDir，如 'migrated/a.png'） */
  oldRel: string;
  /** 新相对路径（相对 uploadDir，如 'migrated/人物/a.png'） */
  newRel: string;
  /** 新文件名；缺省取 basename(newRel)。改名场景显式传入（可能含大小写修正） */
  newName?: string;
}): Promise<{
  oldRel: string;
  newRel: string;
  id: string;
  url: string;
  name: string;
  folder: string;
  /** 变更前表内是否已有对应行（false = 本次为补建） */
  hadRow: boolean;
  /** 是否真的动了磁盘（同路径短路时为 false） */
  renamed: boolean;
}> {
  const { oldRel, newRel } = opts;
  const db = await getDb();

  const srcAbs = resolveUploadFile(oldRel);
  const dstAbs = resolveUploadFile(newRel);
  // 非法路径一律 400，且不静默回退到默认目录——回退会掩盖越权尝试
  if (!srcAbs || !dstAbs) throw new HttpStatusError(400, '非法的资源路径');

  const relFolder = path.posix.dirname(newRel);
  const folder = relFolder === '.' ? '' : relFolder;
  const name = opts.newName || path.posix.basename(newRel);
  const id = resourceIdOf(newRel);
  const url = toAbsoluteFileUrl(`/files/${newRel}`);

  // 同路径：幂等短路（移动同目录 / 改名同名），不动磁盘、不改写引用
  if (srcAbs === dstAbs) {
    return { oldRel, newRel, id, url, name, folder, hadRow: true, renamed: false };
  }

  if (!fs.existsSync(srcAbs)) throw new HttpStatusError(404, 'Source file not found');
  // P0：renameSync 在 POSIX 上是「目标存在即静默覆盖」，必须先判重。
  // 覆盖不仅丢文件，更隐蔽的是引用还在（kv/tasks 仍指向该路径）→ 引用感知 GC 判定"有人引用"
  // 而不回收，结果是全库引用静默指向了另一张图的内容，比 404 更难发现。
  if (fs.existsSync(dstAbs)) {
    throw new HttpStatusError(409, `目标已存在同名文件：${path.basename(dstAbs)}`);
  }

  // 旧行：优先按 url 定位（rescan / rename 都写绝对 url），兜底按 id
  const oldUrl = toAbsoluteFileUrl(`/files/${oldRel}`);
  let oldRow = queryOne(db, 'SELECT * FROM resources WHERE url = ?', [oldUrl]) as Record<string, unknown> | undefined;
  if (!oldRow) {
    oldRow = queryOne(db, 'SELECT * FROM resources WHERE id = ?', [resourceIdOf(oldRel)]) as Record<string, unknown> | undefined;
  }
  const hadRow = !!oldRow;

  ensureDir(path.dirname(dstAbs));
  try {
    fs.renameSync(srcAbs, dstAbs);
  } catch (e) {
    throw new HttpStatusError(500, `Rename failed: ${(e as Error).message}`);
  }

  // 有旧行 → 迁移（保留 is_favorite / page_url / timestamp 等全部元数据，只换身份字段）；
  // 无旧行 → 按 rescan 口径补建，使 resources 表始终与磁盘一致（不留"有文件无行"的窗口）
  const row = oldRow
    ? { ...oldRow, id, url, name, folder }
    : {
        id,
        url,
        name,
        folder,
        type: extToFileType(path.extname(name)) || 'image',
        source: 'local-tool',
        timestamp: Date.now(),
      };
  if (oldRow) run(db, 'DELETE FROM resources WHERE id = ?', [oldRow.id as string]);
  upsertResource(db, resourceToRow(row));

  try {
    rewriteUrlReferences(db, oldRel, newRel);
  } catch (e) {
    // 改写失败不阻断：身份变更已成功，库里旧引用留待后续排查，但必须留痕
    console.error(`[identity] url 引用改写失败（不影响变更本身）：${(e as Error).message}`);
  }

  debouncedSaveDb();
  return { oldRel, newRel, id, url, name, folder, hadRow, renamed: true };
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
  // 仅当用户输入以「字母型扩展名」结尾时才剥离（用户带后缀输入的常见场景）。
  // 不能用 `if (path.extname(base))`：它会把「图1.2」这类含点的名字误切成「图1」（清单 #11）。
  if (/\.[a-z]{1,5}$/i.test(base) && base.length > path.extname(base).length) {
    base = base.slice(0, base.length - path.extname(base).length);
  }
  const newFileName = `${base}${ext}`;
  if (!newFileName || newFileName === oldName) return json(res, { code: 0, data: { ok: true, id, url: row.url, name: oldName } });

  const oldRel = folder ? `${folder}/${oldName}` : oldName;
  const newRel = folder ? `${folder}/${newFileName}` : newFileName;
  try {
    // 与「移动归类」共用同一个身份变更入口：判重 / 表行迁移（保收藏）/ 引用改写 / 落盘一次做完
    const r = await applyResourceIdentityChange({ oldRel, newRel, newName: newFileName });
    return json(res, { code: 0, data: { ok: true, id: r.id, url: r.url, name: r.name } });
  } catch (e) {
    const status = e instanceof HttpStatusError ? e.status : 500;
    return sendError(res, (e as Error).message, status);
  }
}
