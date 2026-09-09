/**
 * 管理 API — stats / cleanup / export / import
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUploadDir, saveDb, queryAll, queryOne, run } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import { runReferenceGc, collectReferencedRelPaths } from '../utils/orphanGc.js';
import { extractFilesUrls } from '../utils/base64Externalize.js';

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

// ── GET /api/admin/kv-list（列出所有 KV 键，供缓存清理脚本精准定位）──
export async function handleAdminKvList(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();
  const rows = queryAll(db, 'SELECT key, length(value) as len, updated_at FROM kv ORDER BY key');
  return json(res, { code: 0, data: { keys: rows } });
}

// ── POST /api/admin/clear-cache（按缓存前缀精准清理 KV，保留业务数据）──
// 只删缓存类键（img_* 图片缓存、接入点、同步元数据、画布版本标记等），
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
    if (key === 'auth_token' || key.startsWith('canvas-state-v1-')) continue;
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

  // KV
  run(db, 'DELETE FROM kv');
  for (const row of src.kv) {
    run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)', [
      row.key,
      row.value,
      row.updated_at ?? Math.floor(Date.now() / 1000),
    ]);
  }

  // tasks
  run(db, 'DELETE FROM tasks');
  for (const row of src.tasks) {
    const keys = Object.keys(row);
    const vals = Object.values(row);
    const placeholders = keys.map(() => '?').join(', ');
    try {
      run(db, `INSERT INTO tasks (${keys.join(', ')}) VALUES (${placeholders})`, vals);
    } catch {
      /* skip invalid row */
    }
  }

  // resources
  run(db, 'DELETE FROM resources');
  for (const row of src.resources) {
    const keys = Object.keys(row);
    const vals = Object.values(row);
    const placeholders = keys.map(() => '?').join(', ');
    try {
      run(db, `INSERT INTO resources (${keys.join(', ')}) VALUES (${placeholders})`, vals);
    } catch {
      /* skip invalid row */
    }
  }

  saveDb();
  return json(res, {
    code: 0,
    data: {
      ok: true,
      counts: { kv: src.kv.length, tasks: src.tasks.length, resources: src.resources.length },
    },
  });
}

// ── 存储健康 · 文件分类（对齐外部 StorageHealthCenter CATEGORY_LABELS 口径）──
const CATEGORY_BY_EXT: Record<string, string> = {
  '.png': '图片',
  '.jpg': '图片',
  '.jpeg': '图片',
  '.gif': '图片',
  '.webp': '图片',
  '.svg': '图片',
  '.bmp': '图片',
  '.ico': '图片',
  '.mp4': '视频',
  '.webm': '视频',
  '.mov': '视频',
  '.avi': '视频',
  '.mkv': '视频',
  '.flv': '视频',
  '.wmv': '视频',
  '.m4v': '视频',
  '.mp3': '音频',
  '.wav': '音频',
  '.ogg': '音频',
  '.aac': '音频',
  '.flac': '音频',
  '.opus': '音频',
  '.txt': '文本',
  '.md': '文本',
  '.json': '文本',
  '.csv': '文本',
  '.xml': '文本',
  '.html': '文本',
  '.css': '文本',
  '.log': '文本',
};
function categoryOf(name: string): string {
  const ext = `.${(name.split('.').pop() || '').toLowerCase()}`;
  return CATEGORY_BY_EXT[ext] || '其他';
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
  const referenced = await collectReferencedRelPaths();

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
    const key = `canvas-state-v1-${p.id}`;
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
    .filter((f) => !referenced.has(f.rel))
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
        referenced: referenced.has(f.rel),
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

  const referenced = await collectReferencedRelPaths();
  if (referenced.has(relSlashes)) {
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
