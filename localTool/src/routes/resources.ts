/**
 * 子模块 0.4 — Resources 业务存储路由（sql.js 兼容版）
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUploadDir, queryAll, queryOne, run, debouncedSaveDb } from '../db/database.js';
import {
  json,
  parseJsonBody,
  sendError,
  HttpStatusError,
  parsePagination,
  buildPaginatedQuery,
  paginatedResult,
} from '../utils/helpers.js';
import {
  writeUploadBuffer,
  ensureDir,
  resolveUploadFile,
  contentIdOf,
} from '../utils/fileStore.js';
import { runReferenceGc } from '../utils/orphanGc.js';
import { toAbsoluteFileUrl } from '../utils/localToolBaseUrl.js';
import { mimeToExt } from '../utils/mime.js';

// ── rescan：扫描 upload 目录，把磁盘文件/文件夹元数据同步进 resources 表 ──
const RESCAN_FILE_TYPE: Record<string, string> = {
  // 图片
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.bmp': 'image',
  '.svg': 'image',
  // 视频
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.avi': 'video',
  '.mkv': 'video',
  '.flv': 'video',
  '.m4v': 'video',
  // 音频
  '.mp3': 'audio',
  '.wav': 'audio',
  '.flac': 'audio',
  '.ogg': 'audio',
  '.m4a': 'audio',
  // 文本（md / txt 等统一归为 text，前端有文本渲染分支）
  '.md': 'text',
  '.markdown': 'text',
  '.txt': 'text',
};

function extToFileType(ext: string): string | null {
  return RESCAN_FILE_TYPE[ext.toLowerCase()] || null;
}

/**
 * 计算文件内容 sha1（去重身份列 A′）。读文件失败返回 null（不阻断 rescan，缺失列可下次回填）。
 * @param {string} filePath 磁盘绝对路径
 * @returns {string|null} sha1(file 内容) hex；读失败 → null
 */
function contentSha1(filePath: string): string | null {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
}

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
  // 扩展名唯一实现 mimeToExt（utils/mime.ts）；表外回 .bin（对齐旧兜底）
  const ext = mimeToExt(mime) ?? '.bin';
  return { buffer, ext };
}

// 本地工具服务基址：资源面板运行在 chrome-extension:// 页面，
// 直接 <img src="/files/..."> 会被解析成 chrome-extension://.../files/... → 404 破图。
// 因此 rescan 入库的 url 必须补全为可访问的完整地址。
// 更新(2026-09-04)：基址改读 PORT（默认 18080），消除原硬编码 `:18080` 忽略 PORT 的弊病
// （见 utils/localToolBaseUrl.ts / Temp/deepening-localtool-baseurl-seam-20260904.md）。
// 更新(2026-09-11)：toAbsoluteFileUrl 唯一实现已收口 utils/localToolBaseUrl.ts，本文件委托。

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

export async function handleResourcesRescan(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const uploadDir = getUploadDir();
  const db = await getDb();

  let scanned = 0;
  let added = 0;
  let skipped = 0;

  // 遍历 upload 子目录（tasks / migrated / 其它）
  let subfolders: string[] = [];
  try {
    subfolders = fs
      .readdirSync(uploadDir, { withFileTypes: true })
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
      const absPath = path.join(absDir, entry.name);

      // 已存在同 id → 保留收藏/手动元数据；若缺去重身份列则懒回填（避免每次 rescan 全表重读文件）
      const exist = queryOne(dbh, 'SELECT id, sha1 FROM resources WHERE id = ?', [id]);
      if (exist) {
        if (!exist.sha1) {
          const h = contentSha1(absPath);
          if (h) run(dbh, `UPDATE resources SET sha1 = ? WHERE id = ?`, [contentIdOf(h), id]);
        }
        counters.skipped++;
        continue;
      }

      const stat = fs.statSync(absPath);
      const fileSha1 = contentSha1(absPath);
      const contentIdVal = fileSha1 ? contentIdOf(fileSha1) : null;
      // Content 维度去重（docs/122）：该 contentId 已被另一 id 引用 → 复用既有 Content，
      // 不新建重复 row（否则撞 UNIQUE → rescan 崩）。应用层先判、DB 唯一约束兜底。
      if (contentIdVal) {
        const existing = queryOne(dbh, 'SELECT url FROM resources WHERE sha1 = ? AND id != ?', [
          contentIdVal,
          id,
        ]);
        if (existing) {
          counters.skipped++;
          continue;
        }
      }
      const row = resourceToRow({
        id,
        url,
        type,
        source: 'local-tool',
        folder: relFolderPath,
        name: entry.name,
        // 去重身份列（docs/122 Content 维度）：contentId = `<alg>:<hex>`，folder 无关、全库唯一
        sha1: contentIdVal,
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
  const localRows = queryAll(
    db,
    `SELECT id, folder, name, type FROM resources WHERE source = 'local-tool'`,
  ) as Array<{ id: string; folder: string; name: string; type: string }>;
  for (const row of localRows) {
    const diskPath = path.join(uploadDir, row.folder, row.name);
    if (!fs.existsSync(diskPath)) {
      run(db, `DELETE FROM resources WHERE id = ?`, [row.id]);
      orphanDeleted++;
    }
  }

  debouncedSaveDb();
  return json(res, {
    code: 0,
    data: { ok: true, count: added, scanned, added, skipped, orphanDeleted },
  });
}

const SNAKE_TO_CAMEL: Record<string, string> = {
  id: 'id',
  url: 'url',
  type: 'type',
  source: 'source',
  folder: 'folder',
  name: 'name',
  sha1: 'sha1',
  project_id: 'projectId',
  page_url: 'pageUrl',
  page_title: 'pageTitle',
  is_favorite: 'isFavorite',
  timestamp: 'timestamp',
};
const CAMEL_TO_SNAKE: Record<string, string> = {};
for (const [k, v] of Object.entries(SNAKE_TO_CAMEL)) CAMEL_TO_SNAKE[v] = k;

function rowToResource(row: Record<string, unknown>) {
  const resource: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = SNAKE_TO_CAMEL[key] || key;
    resource[camelKey] = camelKey === 'isFavorite' ? Boolean(value) : value;
  }
  // docs/122 #4：暴露 contentId 别名（= sha1 去重身份列），供前端 asset 持稳定 contentId（folder/url 无关）
  if (typeof resource.sha1 === 'string' && resource.sha1) resource.contentId = resource.sha1;
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
  // docs/122 收口（根因修复）：resource 行 identity 与 content 一一对应（同内容→同行）。
  // 若同一 contentId 已存在于另一行（不同 id，例如同图从文件上传后又被 base64/远程入口登记），
  // 不新建冲突行、不触发历史 UNIQUE 约束 500，而是复用既有行、仅刷新其可变 context（folder/name/...），
  // 物理 url 与 contentId 保持不变（永不破图）。这是「同内容全局唯一一行」不变量在应用层的落实。
  const sha1val =
    (typeof row.sha1 === 'string' && row.sha1) ||
    (typeof row.contentId === 'string' ? row.contentId : undefined);
  if (sha1val) {
    const existing = queryOne(db, 'SELECT id FROM resources WHERE sha1 = ? AND id != ?', [
      sha1val,
      row.id,
    ]) as { id?: string } | undefined;
    if (existing?.id) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      // 仅刷新可变 context；url / sha1(contentId) 保持既有，绝不改动物理落点
      for (const col of [
        'folder',
        'name',
        'type',
        'source',
        'project_id',
        'timestamp',
        'is_favorite',
      ]) {
        if (row[col] !== undefined) {
          sets.push(`${col} = ?`);
          vals.push(row[col]);
        }
      }
      if (sets.length) {
        vals.push(existing.id);
        run(db, `UPDATE resources SET ${sets.join(', ')} WHERE id = ?`, vals);
      }
      return;
    }
  }

  const keys = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = keys.map(() => '?').join(', ');
  run(db, `DELETE FROM resources WHERE id = ?`, [row.id]);
  run(db, `INSERT INTO resources (${keys.join(', ')}) VALUES (${placeholders})`, vals);
}

/**
 * projectId 过滤谓词（docs/122 #2 语义的纯函数表达）：
 *  - filterProjectId 缺省 → 不过滤（全量，向后兼容）
 *  - rowProjectId 为 null/undefined（legacy/全局物理）→ 对所有 project 可见
 *  - 否则 → 仅当与过滤 projectId 相同才可见
 * @param {string|null|undefined} rowProjectId 行内 project_id
 * @param {string|null|undefined} filterProjectId 查询过滤的 projectId（缺省 = 不过滤）
 * @returns {boolean}
 */
export function resourceVisibleForProject(
  rowProjectId: string | null | undefined,
  filterProjectId: string | null | undefined,
): boolean {
  if (filterProjectId === undefined || filterProjectId === null || filterProjectId === '')
    return true;
  if (rowProjectId === undefined || rowProjectId === null) return true; // legacy NULL 全项目可见
  return rowProjectId === filterProjectId;
}

export async function handleResourcesGet(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const params = parsePagination(url, { sortBy: 'timestamp', sortDir: 'DESC' });
  // 【docs/122 #2】GET ?projectId= 作为 project_id 的「NULL 也可见」过滤（统一走 buildPaginatedQuery nullOrEqCols）。
  // 语义：project_id IS NULL（legacy/全局物理，rescan 行保持 NULL 不分裂）或等于该 projectId 的行可见。
  const projectId = url.searchParams.get('projectId');
  if (projectId) {
    params.filters = { ...(params.filters || {}), project_id: projectId };
  }
  const searchColumns = [
    'id',
    'url',
    'type',
    'source',
    'folder',
    'name',
    'project_id',
    'page_url',
    'page_title',
    'timestamp',
  ];
  const { sql, countSql, values, countValues } = buildPaginatedQuery(
    'resources',
    params,
    searchColumns,
    ['project_id'],
  );

  const db = await getDb();
  const rows = queryAll(db, sql, values);
  const countRow = queryOne(db, countSql, countValues);
  const total = countRow ? (countRow.total as number) : 0;

  return json(res, {
    code: 0,
    data: paginatedResult(rows.map(rowToResource), total, params.page, params.pageSize),
  });
}

export async function handleResourcesSave(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
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

export async function handleResourcesBatchSave(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
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

export async function handleResourcesDelete(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
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

export async function handleResourcesClear(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
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
 * 增量② · 上下文仅改名/移动（docs/122 Content/Ref：#4「改名/移动只动 context」）：
 * 只更新 resource 行的 `name`（显示名）/`folder`（UI 分类），**不动磁盘、不改 `url`（含不可变 physBucket）、
 * 不改 contentId** → 引用方（asset 持 contentId/url）永不感知改名 → **永不破图，无需 rewriteUrlReferences**。
 * 这是对 applyResourceIdentityChange（真·移动磁盘 + 改写 url）的正交替代：改名/移动归类属 context 层操作。
 * @returns 更新后的 { id, url(不变), name, folder }；url/contentId 保持原值
 */
export async function applyResourceContextChange(opts: {
  id: string;
  /** 新显示名（仅改 UI 名，不动物理文件名） */
  name?: string;
  /** 新 UI 分类目录（仅改展示，不移动磁盘/物理路径） */
  folder?: string;
}): Promise<{ id: string; url: string; name: string; folder: string | null }> {
  const db = await getDb();
  const row = queryOne(db, 'SELECT * FROM resources WHERE id = ?', [opts.id]) as
    Record<string, unknown> | undefined;
  if (!row) throw new HttpStatusError(404, 'Resource not found');
  const name =
    opts.name !== undefined && String(opts.name).trim()
      ? String(opts.name).trim()
      : (row.name as string);
  const folder =
    opts.folder !== undefined && String(opts.folder).trim()
      ? String(opts.folder).trim()
      : ((row.folder as string | null) ?? null);
  // 只改 context 层：url（物理, 含 physBucket）、contentId、磁盘均不动
  run(db, 'UPDATE resources SET name = ?, folder = ? WHERE id = ?', [name, folder, opts.id]);
  debouncedSaveDb();
  return { id: opts.id, url: row.url as string, name, folder };
}

/**
 * 增量② · context-only 移动归类（docs/122 Content/Ref：#4「移动只动 context」）：
 * 把资源拖入文件夹 = 只更新 resource 行的 `folder`（UI 分类），**物理文件 / url / contentId 均不动**。
 * 与 applyResourceContextChange 同一 context 层语义；按「旧相对路径」定位 resource 行（id = resourceIdOf(oldRel)）。
 * 行不存在（尚未 rescan）时无元数据可改、物理本就未动，返回原样（由后续 rescan 对齐）。
 * @returns 更新后的 { id, url(url 不变，可能 null 当行不存在), name, folder }
 */
export async function applyResourceContextMove(opts: {
  oldRel: string;
  newRel: string;
}): Promise<{ id: string; url: string | null; name: string; folder: string | null }> {
  const { oldRel, newRel } = opts;
  // 路径安全（context-only 虽不碰磁盘，仍拒绝越出 uploads 的相对路径，防脏 folder 污染 UI）
  if (
    !oldRel ||
    !newRel ||
    oldRel.includes('..') ||
    newRel.includes('..') ||
    oldRel.startsWith('/') ||
    newRel.startsWith('/')
  ) {
    throw new HttpStatusError(400, '非法的资源路径');
  }
  const oldName = path.posix.basename(oldRel);
  const parent = path.posix.dirname(newRel);
  const folder = parent === '.' ? '' : parent;
  const id = resourceIdOf(oldRel);

  const db = await getDb();
  const row = queryOne(db, 'SELECT * FROM resources WHERE id = ?', [id]) as
    Record<string, unknown> | undefined;
  if (!row) {
    // context-only 移动：行不存在则无可更新元数据，物理文件未动，返回原样供前端刷新
    return { id, url: null, name: oldName, folder };
  }
  run(db, 'UPDATE resources SET folder = ? WHERE id = ?', [folder, id]);
  debouncedSaveDb();
  return { id, url: row.url as string, name: row.name as string, folder };
}

/**
 * 重命名一条资源（context-only）：只改显示名，磁盘文件 / url / contentId 不变（docs/122 增量②）。
 * 仅支持 source='local-tool' 的本地文件型资源；保留原扩展名，只改文件名主体（显示名）。
 * 用法：POST /api/resources/rename?id=<id>&name=<新名>
 */
export async function handleResourcesRename(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const id = url.searchParams.get('id');
  const rawName = url.searchParams.get('name');
  if (!id || !rawName) return sendError(res, 'Missing id or name', 400);

  const db = await getDb();
  const row = queryOne(db, 'SELECT * FROM resources WHERE id = ?', [id]) as
    Record<string, unknown> | undefined;
  if (!row) return sendError(res, 'Resource not found', 404);
  if (row.source !== 'local-tool' || row.type === 'folder')
    return sendError(res, '仅支持重命名本地文件', 400);

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
  if (!newFileName || newFileName === oldName)
    return json(res, { code: 0, data: { ok: true, id, url: row.url, name: oldName } });

  try {
    // context-only 改名：只更新显示名，url/contentId/磁盘不变 → asset 永不破图（docs/122 #4）
    const r = await applyResourceContextChange({ id, name: newFileName });
    return json(res, { code: 0, data: { ok: true, id: r.id, url: r.url, name: r.name } });
  } catch (e) {
    const status = e instanceof HttpStatusError ? e.status : 500;
    return sendError(res, (e as Error).message, status);
  }
}
