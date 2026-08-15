/**
 * 子模块 — 项目系统后端化路由（对齐官方 /api/projects）。
 *
 * 背景（docs/18 §0）：官方项目系统（projects / lastOpenedProject）走后端管理。
 * 本模块把前端 projectStore 的「项目列表 + 当前项目」从 localStorage 迁移到 localTool SQLite，
 * 使项目在刷新/换浏览器/连同一 localTool 的设备间共享。
 *
 * 数据模型（projects 表，见 database.ts initTables）：
 *  - id TEXT PRIMARY KEY
 *  - name TEXT NOT NULL
 *  - is_last_opened INTEGER（0/1，标记当前项目）
 *  - created_at INTEGER
 *
 * 接口（对齐前端全量保存模式，简洁可靠）：
 *  - GET  /api/projects            → { projects:[{id,name,createdAt}], lastOpened }
 *  - POST /api/projects/save       body { projects:[{id,name}], lastOpened }  → { ok:true }
 *    全量覆盖：删除旧行 + 按传入列表重建，并把 lastOpened 对应行标 is_last_opened=1。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getDb, queryAll, queryOne, run, debouncedSaveDb, beginTx, commitTx, rollbackTx } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';

export async function handleProjectsGet(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();
  const rows = queryAll(db, 'SELECT id, name, is_last_opened, created_at FROM projects ORDER BY created_at ASC');
  const projects = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    isLastOpened: !!r.is_last_opened,
  }));
  const lastOpenedRow = rows.find((r: any) => r.is_last_opened === 1);
  const lastOpened = lastOpenedRow ? String(lastOpenedRow.id) : (projects[0]?.id || 'default');
  return json(res, { projects, lastOpened });
}

export async function handleProjectsSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { projects?: unknown; lastOpened?: string } | null;
  if (!body || !Array.isArray(body.projects)) {
    return sendError(res, 'Invalid body: projects[] required', 400);
  }
  const lastOpened = typeof body.lastOpened === 'string' ? body.lastOpened : '';

  const db = await getDb();
  beginTx(db);
  try {
    const now = Math.floor(Date.now() / 1000);
    const incomingIds: string[] = [];
    for (const p of body.projects) {
      const id = String(p?.id || '').trim();
      const name = String(p?.name || '').trim();
      if (!id) continue;
      incomingIds.push(id);
      const isLast = id === lastOpened ? 1 : 0;
      // 【② 优化】增量 upsert：存在则更新 name/lastOpened（保留 created_at），不存在才 INSERT。
      // 替代旧的「DELETE 全部 + 重建」，避免项目多时每次全量删插的低效与 id 重建。
      const existing = queryOne(db, 'SELECT id FROM projects WHERE id = ?', [id]);
      if (existing) {
        run(db, 'UPDATE projects SET name = ?, is_last_opened = ? WHERE id = ?', [name, isLast, id]);
      } else {
        run(db, 'INSERT INTO projects (id, name, is_last_opened, created_at) VALUES (?, ?, ?, ?)', [id, name, isLast, now]);
      }
    }
    // 删除不在传入列表里的旧项目（处理前端删除项目场景）
    if (incomingIds.length > 0) {
      const placeholders = incomingIds.map(() => '?').join(',');
      run(db, `DELETE FROM projects WHERE id NOT IN (${placeholders})`, incomingIds);
    }
    // 若 lastOpened 指定的项目不存在于传入列表，回退到第一个
    const exists = queryOne(db, 'SELECT id FROM projects WHERE id = ?', [lastOpened]);
    if (!exists) {
      const first = queryOne(db, 'SELECT id FROM projects ORDER BY created_at ASC LIMIT 1');
      if (first) run(db, 'UPDATE projects SET is_last_opened = 1 WHERE id = ?', [first.id]);
    }
    commitTx(db);
  } catch (e) {
    rollbackTx(db);
    throw e;
  }
  debouncedSaveDb();
  return json(res, { ok: true });
}
