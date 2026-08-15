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
    run(db, 'DELETE FROM projects');
    let lastId = lastOpened;
    const now = Math.floor(Date.now() / 1000);
    for (const p of body.projects) {
      const id = String(p?.id || '').trim();
      const name = String(p?.name || '').trim();
      if (!id) continue;
      if (!lastId && !lastId) lastId = id;
      const isLast = id === lastOpened ? 1 : 0;
      run(db, 'INSERT INTO projects (id, name, is_last_opened, created_at) VALUES (?, ?, ?, ?)', [id, name, isLast, now]);
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
