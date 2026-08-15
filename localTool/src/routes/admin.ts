/**
 * 管理 API — stats / cleanup / export / import
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUploadDir, saveDb, queryAll, queryOne, run, LOCAL_FILE_BASE } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import { runOrphanGc } from '../utils/orphanGc.js';

// ── GET /api/admin/stats ──
export async function handleAdminStats(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();

  // KV
  const kvRow = queryOne(db, 'SELECT COUNT(*) as cnt, SUM(LENGTH(key) + LENGTH(value)) as est FROM kv') as { cnt: number; est: number | null } | undefined;
  const kv = { count: kvRow?.cnt ?? 0, estimatedBytes: kvRow?.est ?? 0 };

  // tasks
  const taskTotal = queryOne(db, 'SELECT COUNT(*) as cnt FROM tasks') as { cnt: number } | undefined;
  const taskStatuses = queryAll(db, 'SELECT status, COUNT(*) as cnt FROM tasks WHERE status IS NOT NULL GROUP BY status') as Array<{ status: string; cnt: number }>;
  const byStatus: Record<string, number> = {};
  for (const s of taskStatuses) byStatus[s.status] = s.cnt;
  const tasks = { total: taskTotal?.cnt ?? 0, byStatus };

  // resources
  const resTotal = queryOne(db, 'SELECT COUNT(*) as cnt FROM resources') as { cnt: number } | undefined;
  const resTypes = queryAll(db, 'SELECT type, COUNT(*) as cnt FROM resources GROUP BY type') as Array<{ type: string; cnt: number }>;
  const byType: Record<string, number> = {};
  for (const t of resTypes) byType[t.type] = t.cnt;
  const resources = { total: resTotal?.cnt ?? 0, byType };

  // disk
  const uploadDir = getUploadDir();
  let diskBytes = 0;
  try { diskBytes = dirSize(uploadDir); } catch { /* ignore */ }

  return json(res, { kv, tasks, resources, disk: { uploadDirBytes: diskBytes } });
}

// ── GET /api/admin/kv-list（列出所有 KV 键，供缓存清理脚本精准定位）──
export async function handleAdminKvList(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();
  const rows = queryAll(db, 'SELECT key, length(value) as len, updated_at FROM kv ORDER BY key');
  return json(res, { keys: rows });
}

// ── POST /api/admin/clear-cache（按缓存前缀精准清理 KV，保留业务数据）──
// 只删缓存类键（img_* 图片缓存、接入点、同步元数据、画布版本标记等），
// 绝不碰 canvas-state-v1-* 本体 / auth_token / projects / users 等业务数据。
// body: { confirm: true, prefixes?: string[], exactKeys?: string[] }
export async function handleAdminClearCache(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { confirm?: boolean; prefixes?: string[]; exactKeys?: string[] } | null;
  if (!body?.confirm) return sendError(res, 'Set confirm: true to proceed', 400);

  const db = await getDb();
  const all = queryAll(db, 'SELECT key FROM kv') as Array<{ key: string }>;
  const toDelete: string[] = [];

  const prefixes = body.prefixes?.filter(Boolean) ?? [
    'img_orig_',      // 原始图缓存
    'img_thumb_',     // 缩略图缓存
  ];
  const exactKeys = body.exactKeys?.filter(Boolean) ?? [
    'active_api_endpoint',  // 接入点选择（曾致登录回环）
    '_syncMeta',            // 云同步元数据缓存
    '__debug_probe',
    't',
    'lastOpenedProject',
  ];

  for (const { key } of all) {
    // 画布状态本体、登录 token、项目等业务键绝不删（即使命中前缀）
    if (key === 'auth_token' || key.startsWith('canvas-state-v1-')) continue;
    if (exactKeys.includes(key)) { toDelete.push(key); continue; }
    for (const p of prefixes) {
      if (key.startsWith(p)) { toDelete.push(key); break; }
    }
  }

  for (const key of toDelete) run(db, 'DELETE FROM kv WHERE key = ?', [key]);
  saveDb();
  return json(res, { ok: true, deleted: toDelete, count: toDelete.length });
}

// ── POST /api/admin/cleanup ──
export async function handleAdminCleanup(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();
  const uploadDir = getUploadDir();

  // 收集所有被引用的 URL（从 resources 和 tasks 两个表）
  const refUrls = new Set<string>();
  const resUrls = queryAll(db, 'SELECT url FROM resources') as Array<{ url: string }>;
  for (const r of resUrls) refUrls.add(r.url);
  const taskUrls = queryAll(db, 'SELECT result_url, thumbnail_url FROM tasks') as Array<{ result_url?: string; thumbnail_url?: string }>;
  for (const t of taskUrls) {
    if (t.result_url) refUrls.add(t.result_url);
    if (t.thumbnail_url) refUrls.add(t.thumbnail_url);
  }

  // 方案②配套（docs/41 §2.7①）：KV 表里被外置成 /files/ URL 的图片引用
  // 也要纳入"被引用集合"，否则节点删除后磁盘文件会成为孤儿无限累积。
  const kvValues = queryAll(db, 'SELECT value FROM kv') as Array<{ value: string }>;
  const kvValueStrings = kvValues.map((r) => r.value).filter((v): v is string => typeof v === 'string');

  const gc = runOrphanGc(kvValueStrings, uploadDir, refUrls, false);

  return json(res, {
    scanned: gc.scanned,
    deleted: gc.deleted,
    referenced: gc.referenced,
    deletedFiles: gc.deletedFiles,
  });
}

// ── GET /api/admin/export ──
export async function handleAdminExport(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();

  const kvRows = queryAll(db, 'SELECT key, value, updated_at FROM kv');
  const taskRows = queryAll(db, 'SELECT * FROM tasks');
  const resRows = queryAll(db, 'SELECT * FROM resources');

  return json(res, {
    kv: kvRows,
    tasks: taskRows,
    resources: resRows,
    exportedAt: Date.now(),
    version: '2.0.0',
  });
}

// ── POST /api/admin/import ──
export async function handleAdminImport(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { data?: Record<string, unknown>; confirm?: boolean } | null;
  if (!body || !body.data) return sendError(res, 'Missing data field', 400);
  if (!body.confirm) return sendError(res, 'Set confirm: true to proceed', 400);

  const src = body.data as {
    kv?: Array<{ key: string; value: string; updated_at?: number }>;
    tasks?: Array<Record<string, unknown>>;
    resources?: Array<Record<string, unknown>>;
  };
  if (!src.kv || !src.tasks || !src.resources) return sendError(res, 'data must contain kv, tasks, resources arrays', 400);

  saveDb(); // 先落当前数据
  const db = await getDb();

  // KV
  run(db, 'DELETE FROM kv');
  for (const row of src.kv) {
    run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
      [row.key, row.value, row.updated_at ?? Math.floor(Date.now() / 1000)]);
  }

  // tasks
  run(db, 'DELETE FROM tasks');
  for (const row of src.tasks) {
    const keys = Object.keys(row);
    const vals = Object.values(row);
    const placeholders = keys.map(() => '?').join(', ');
    try { run(db, `INSERT INTO tasks (${keys.join(', ')}) VALUES (${placeholders})`, vals); } catch { /* skip invalid row */ }
  }

  // resources
  run(db, 'DELETE FROM resources');
  for (const row of src.resources) {
    const keys = Object.keys(row);
    const vals = Object.values(row);
    const placeholders = keys.map(() => '?').join(', ');
    try { run(db, `INSERT INTO resources (${keys.join(', ')}) VALUES (${placeholders})`, vals); } catch { /* skip invalid row */ }
  }

  saveDb();
  return json(res, {
    ok: true,
    counts: { kv: src.kv.length, tasks: src.tasks.length, resources: src.resources.length },
  });
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
  } catch { /* ignore */ }
  return total;
}

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        files.push(...walkFiles(p));
      } else if (entry.isFile()) {
        files.push(p);
      }
    }
  } catch { /* ignore */ }
  return files;
}
