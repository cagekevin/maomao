/**
 * 管理 API — stats / cleanup / export / import
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUploadDir, saveDb, queryAll, queryOne, run } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import { runReferenceGc, collectReferences, isUploadReferenced } from '../utils/orphanGc.js';
import { extractFilesUrls } from '../utils/base64Externalize.js';
import { extToCategoryLabel } from '../utils/mime.js';

// ── GET /api/admin/stats ──
export async function handleAdminStats(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();

  // KV
  const kvRow = queryOne(
    db,
    'SELECT COUNT(*) as cnt, SUM(LENGTH(key) + LENGTH(value)) as est FROM kv',
  ) as { cnt: number; est: number | null } | undefined;
  const kv = { count: kvRow?.cnt ?? 0, estimatedBytes: kvRow?.est ?? 0 };

  // tasks
  const taskTotal = queryOne(db, 'SELECT COUNT(*) as cnt FROM tasks') as
    { cnt: number } | undefined;
  const taskStatuses = queryAll(
    db,
    'SELECT status, COUNT(*) as cnt FROM tasks WHERE status IS NOT NULL GROUP BY status',
  ) as Array<{ status: string; cnt: number }>;
  const byStatus: Record<string, number> = {};
  for (const s of taskStatuses) byStatus[s.status] = s.cnt;
  const tasks = { total: taskTotal?.cnt ?? 0, byStatus };

  // resources
  const resTotal = queryOne(db, 'SELECT COUNT(*) as cnt FROM resources') as
    { cnt: number } | undefined;
  const resTypes = queryAll(
    db,
    'SELECT type, COUNT(*) as cnt FROM resources GROUP BY type',
  ) as Array<{ type: string; cnt: number }>;
  const byType: Record<string, number> = {};
  for (const t of resTypes) byType[t.type] = t.cnt;
  const resources = { total: resTotal?.cnt ?? 0, byType };

  // disk
  const uploadDir = getUploadDir();
  let diskBytes = 0;
  try {
    diskBytes = dirSize(uploadDir);
  } catch {
    /* ignore */
  }

  return json(res, {
    code: 0,
    data: { kv, tasks, resources, disk: { uploadDirBytes: diskBytes } },
  });
}

// 注：原 `GET /api/admin/kv-list` 已归位为 `GET /api/kv/keys`（routes/kv.ts，2026-09-16，TD-02-30）——
//     KV 键枚举属 kv 域，且用户备份（backupStore）已成为它的第二个消费方，不该挂在 admin 前缀下。

// ── POST /api/admin/clear-cache（按缓存前缀精准清理 KV，保留业务数据）──
// 只删缓存类键（img_* 图片缓存、接入点、同步元数据、画布版本标记等），
/**
 * 画布快照 KV 键前缀 —— **与前端 `contracts.ts::CANVAS_STATE_PREFIX` 同值的跨栈契约**（TD-08-68）。
 *
 * 【为什么两端各留一份】**两栈无共享模块**（`src/components/**` 与 `localTool/src/**` 是两套构建产物）
 * ⇒ 各持一份是**结构必然**；一致性由 `check:arch` 的 `CROSS_STACK_CONSTS` **逐字对账**
 * （任一侧改值而另一侧没跟 ⇒ 闸红）。
 * 【本处两处用途】① 清理类操作的**保护名单**（绝不删画布状态本体）；② 项目存储统计（拼 `{prefix}{projectId}` 查 kv 表）。
 */
export const CANVAS_STATE_PREFIX = 'canvas-state-v1-';

// 绝不碰 canvas-state-v1-* 本体 / auth_token / projects / users 等业务数据。
// body: { confirm: true, prefixes?: string[], exactKeys?: string[] }
export async function handleAdminClearCache(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = (await parseJsonBody(req)) as {
    confirm?: boolean;
    prefixes?: string[];
    exactKeys?: string[];
  } | null;
  if (!body?.confirm) return sendError(res, 'Set confirm: true to proceed', 400);

  const db = await getDb();
  const all = queryAll(db, 'SELECT key FROM kv') as Array<{ key: string }>;
  const toDelete: string[] = [];

  const prefixes = body.prefixes?.filter(Boolean) ?? [
    'img_orig_', // 原始图缓存
    'img_thumb_', // 缩略图缓存
  ];
  const exactKeys = body.exactKeys?.filter(Boolean) ?? [
    'active_api_endpoint', // 接入点选择（曾致登录回环）
    '_syncMeta', // 云同步元数据缓存
    '__debug_probe',
    't',
    'lastOpenedProject',
  ];

  for (const { key } of all) {
    // 画布状态本体、登录 token、项目等业务键绝不删（即使命中前缀）
    if (key === 'auth_token' || key.startsWith(CANVAS_STATE_PREFIX)) continue;
    if (exactKeys.includes(key)) {
      toDelete.push(key);
      continue;
    }
    for (const p of prefixes) {
      if (key.startsWith(p)) {
        toDelete.push(key);
        break;
      }
    }
  }

  for (const key of toDelete) run(db, 'DELETE FROM kv WHERE key = ?', [key]);
  saveDb();
  return json(res, { code: 0, data: { ok: true, deleted: toDelete, count: toDelete.length } });
}

// ── POST /api/admin/cleanup ──
export async function handleAdminCleanup(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // 引用收集统一收敛在 runReferenceGc（orphanGc.ts）：resources 表 url + tasks 表 url + KV 全部 value。
  // 删除入口尾部也会调用同一函数，保证"全库引用"口径唯一（docs/13 §3.5.3）。
  const gc = await runReferenceGc(false);

  return json(res, {
    code: 0,
    data: {
      scanned: gc.scanned,
      deleted: gc.deleted,
      referenced: gc.referenced,
      deletedFiles: gc.deletedFiles,
    },
  });
}

// ── GET /api/admin/export ──
export async function handleAdminExport(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();

  const kvRows = queryAll(db, 'SELECT key, value, updated_at FROM kv');
  const taskRows = queryAll(db, 'SELECT * FROM tasks');
  const resRows = queryAll(db, 'SELECT * FROM resources');

  return json(res, {
    code: 0,
    data: {
      kv: kvRows,
      tasks: taskRows,
      resources: resRows,
      exportedAt: Date.now(),
      version: '2.0.0',
    },
  });
}

// ── POST /api/admin/import ──
export async function handleAdminImport(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as {
    data?: Record<string, unknown>;
    confirm?: boolean;
  } | null;
  if (!body || !body.data) return sendError(res, 'Missing data field', 400);
  if (!body.confirm) return sendError(res, 'Set confirm: true to proceed', 400);

  const src = body.data as {
    kv?: Array<{ key: string; value: string; updated_at?: number }>;
    tasks?: Array<Record<string, unknown>>;
    resources?: Array<Record<string, unknown>>;
  };
  if (!src.kv || !src.tasks || !src.resources)
    return sendError(res, 'data must contain kv, tasks, resources arrays', 400);

  saveDb(); // 先落当前数据
  const db = await getDb();

  // 【成功判据必须取结果事实 · 2026-09-17 TD-16-27】原实现三处问题：
  //  ① `counts` 取 `src.*.length`（**输入长度**）⇒ 被吞掉的行仍报「导入了 N 行」；
  //  ② tasks/resources 的 `catch { /* skip invalid row */ }` 把丢行彻底静默；
  //  ③ `ok: true` 恒真。
  // 现改为**逐行记账**：真写入才 +1，失败/形状违约逐条记录并回给调用方 ——
  // 备份导入是「整包替换」，丢行必须让用户看见（否则"恢复成功"之后数据其实是缺的）。
  const counts = { kv: 0, tasks: 0, resources: 0 };
  const skipped: Array<{ table: string; index: number; error: string }> = [];
  const recordSkip = (table: string, index: number, e: unknown): void => {
    skipped.push({ table, index, error: e instanceof Error ? e.message : String(e) });
  };

  // KV
  run(db, 'DELETE FROM kv');
  for (let i = 0; i < src.kv.length; i++) {
    const row = src.kv[i];
    try {
      run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)', [
        row.key,
        row.value,
        row.updated_at ?? Math.floor(Date.now() / 1000),
      ]);
      counts.kv++;
    } catch (e) {
      recordSkip('kv', i, e);
    }
  }

  // tasks
  run(db, 'DELETE FROM tasks');
  for (let i = 0; i < src.tasks.length; i++) {
    const row = src.tasks[i];
    const keys = Object.keys(row);
    const vals = Object.values(row);
    const placeholders = keys.map(() => '?').join(', ');
    try {
      run(db, `INSERT INTO tasks (${keys.join(', ')}) VALUES (${placeholders})`, vals);
      counts.tasks++;
    } catch (e) {
      recordSkip('tasks', i, e);
    }
  }

  // resources
  run(db, 'DELETE FROM resources');
  for (let i = 0; i < src.resources.length; i++) {
    const row = src.resources[i];
    const keys = Object.keys(row);
    const vals = Object.values(row);
    const placeholders = keys.map(() => '?').join(', ');
    try {
      run(db, `INSERT INTO resources (${keys.join(', ')}) VALUES (${placeholders})`, vals);
      counts.resources++;
    } catch (e) {
      recordSkip('resources', i, e);
    }
  }

  saveDb();
  return json(res, {
    code: 0,
    data: {
      // ok 唯一真源 = 没有任何一行被丢（调用方据此决定是否报"导入成功"）
      ok: skipped.length === 0,
      counts,
      expected: { kv: src.kv.length, tasks: src.tasks.length, resources: src.resources.length },
      skipped,
    },
  });
}

// ── 存储健康 · 文件分类（对齐外部 StorageHealthCenter CATEGORY_LABELS 口径）──
// 【2026-09-16 收口 TD-08-17】原 `CATEGORY_BY_EXT` 是本文件自持的**第三张** ext→类别表
// （与 resources.ts `RESCAN_FILE_TYPE` 并行手抄、互相漂移）。现统一委托 utils/mime.ts：
// `extToKind` 定 kind、`kindLabel` 出中文 —— 中文只是 kind 的显示派生，不再按扩展名手抄第二份。
function categoryOf(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  return extToCategoryLabel(ext);
}

/** 递归扫描 uploads 目录（跳过 .thumbnails/ 与隐藏文件），返回相对路径+绝对路径+大小。 */
function walkUploadFiles(
  uploadsDir: string,
): Array<{ rel: string; abs: string; size: number; name: string }> {
  const out: Array<{ rel: string; abs: string; size: number; name: string }> = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === '.thumbnails') continue;
        walk(abs);
      } else if (entry.isFile() && !entry.name.startsWith('.')) {
        try {
          const s = fs.statSync(abs);
          out.push({
            rel: path.relative(uploadsDir, abs).replace(/\\/g, '/'),
            abs,
            size: s.size,
            name: entry.name,
          });
        } catch {
          /* skip 无法 stat */
        }
      }
    }
  };
  walk(uploadsDir);
  return out;
}

/**
 * GET /api/admin/storage-health — 存储健康总报表（对齐外部 StorageHealthCenter 一份报表驱动总览+明细）。
 * 返回：按文件类别占用、各项目占用（画布 KV + 该画布引用的磁盘文件）、孤儿文件清单、重复文件组、可释放空间。
 * 只读不删；重复/孤儿能否删由 referenced 集合（canvas/tasks/resources 全库引用）裁决。
 * 信封形态：code-data。
 */
export async function handleAdminStorageHealth(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const db = await getDb();
  const uploadDir = getUploadDir();
  const files = walkUploadFiles(uploadDir);
  // 全库引用（含内容身份那一半）—— 单文件判定统一走 isUploadReferenced，本文件不自己拼判据。
  const refs = await collectReferences();
  const isReferenced = (rel: string): boolean =>
    isUploadReferenced(rel, refs.paths, refs.contentIds);

  // ── ① 按文件类别总占用（文件只算一次）──
  const byCategory: Record<string, { count: number; size: number }> = {};
  let totalBytes = 0;
  for (const f of files) {
    const c = categoryOf(f.name);
    if (!byCategory[c]) byCategory[c] = { count: 0, size: 0 };
    byCategory[c].count++;
    byCategory[c].size += f.size;
    totalBytes += f.size;
  }

  // ── ② 各项目占用：画布 KV 字节 + 该画布引用的磁盘文件 ──
  const sizeByRel = new Map(files.map((f) => [f.rel, f.size]));
  const projRows = queryAll(db, 'SELECT id, name FROM projects ORDER BY created_at ASC') as Array<{
    id: string;
    name: string;
  }>;
  const projects = projRows.map((p) => {
    const key = `${CANVAS_STATE_PREFIX}${p.id}`;
    const kvRow = queryOne(db, 'SELECT value FROM kv WHERE key = ?', [key]) as
      { value: string } | undefined;
    const kvBytes = kvRow && typeof kvRow.value === 'string' ? kvRow.value.length : 0;
    let fileBytes = 0;
    let fileCount = 0;
    if (kvRow && typeof kvRow.value === 'string') {
      for (const rel of extractFilesUrls(kvRow.value)) {
        const s = sizeByRel.get(rel);
        if (s !== undefined) {
          fileBytes += s;
          fileCount++;
        }
      }
    }
    return { projectId: p.id, projectName: p.name, kvBytes, fileBytes, fileCount };
  });

  // ── ③ 孤儿文件（磁盘有、全库无引用）──
  const orphans = files
    .filter((f) => !isReferenced(f.rel))
    .map((f) => ({ path: f.rel, name: f.name, size: f.size, category: categoryOf(f.name) }));
  const orphanBytes = orphans.reduce((s, o) => s + o.size, 0);

  // ── ④ 重复文件组（size+name 分组，count>=2；仅「未引用」副本可释放）──
  const groups = new Map<string, typeof files>();
  for (const f of files) {
    const key = `${f.size}|${f.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  const duplicates = Array.from(groups.values())
    .filter((g) => g.length >= 2)
    .map((g) => {
      const members = g.map((f) => ({
        path: f.rel,
        name: f.name,
        size: f.size,
        referenced: isReferenced(f.rel),
      }));
      // 只统计未引用副本的可释放量（被画布/任务/素材引用的副本绝不能删）
      const reclaimable = members.filter((m) => !m.referenced).reduce((s, m) => s + m.size, 0);
      return { name: g[0].name, size: g[0].size, count: g.length, files: members, reclaimable };
    });

  const reclaimableBytes = orphanBytes + duplicates.reduce((s, d) => s + d.reclaimable, 0);

  return json(res, {
    code: 0,
    data: {
      totalBytes,
      fileCount: files.length,
      byCategory,
      projects,
      orphans,
      duplicates,
      orphanBytes,
      reclaimableBytes,
      scannedAt: Date.now(),
    },
  });
}

/**
 * POST /api/admin/delete-file — 安全删除单个 uploads 文件（孤儿/重复副本共用）。
 * body: { path: "相对 uploads 的路径" }。
 * 安全红线：仅删「全库无引用」的文件；被画布/任务/素材引用 → 返回 skipped:'referenced' 不删。
 * 路径必须在 uploadDir 内且跳过 .thumbnails/ 与隐藏文件，防穿越/误删系统文件。
 * 二次确认由前端把关。
 */
export async function handleAdminDeleteFile(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = (await parseJsonBody(req)) as { path?: unknown } | null;
  const relPath = body?.path;
  if (typeof relPath !== 'string' || !relPath) return sendError(res, 'Missing path', 400);

  const uploadsDir = path.normalize(getUploadDir());
  const relSlashes = relPath.replace(/\\/g, '/');
  if (
    relSlashes.startsWith('/') ||
    relSlashes.split('/').some((s) => s === '..' || s.startsWith('.'))
  ) {
    return json(res, { code: 0, data: { ok: false, skipped: 'protected' } });
  }

  const abs = path.normalize(path.join(uploadsDir, relSlashes));
  if (!abs.startsWith(uploadsDir + path.sep)) {
    return json(res, { code: 0, data: { ok: false, skipped: 'protected' } });
  }
  if (!fs.existsSync(abs)) {
    return json(res, { code: 0, data: { ok: false, skipped: 'missing' } });
  }

  // 被引用 → 拒绝删除。判定走唯一入口 isUploadReferenced（文本引用 or 内容身份两半；
  // 只判前者会在"删行 → 立刻 GC"的时序里误判 —— 见 orphanGc.ts 文件头 2026-09-21 注）。
  const refs = await collectReferences();
  if (isUploadReferenced(relSlashes, refs.paths, refs.contentIds)) {
    return json(res, { code: 0, data: { ok: false, skipped: 'referenced' } });
  }

  try {
    fs.unlinkSync(abs);
    return json(res, { code: 0, data: { ok: true, path: relSlashes } });
  } catch {
    return sendError(res, 'delete failed', 500);
  }
}

// ── helpers ──
function dirSize(dir: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        total += dirSize(p);
      } else if (entry.isFile()) {
        total += fs.statSync(p).size;
      }
    }
  } catch {
    /* ignore */
  }
  return total;
}
