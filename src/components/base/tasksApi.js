/**
 * 任务中心后端 API 封装（对齐官方，localTool /api/tasks）。
 *
 * localTool 已实现（routes/tasks.ts，SQLite 落盘）：
 *  - GET  /api/tasks?page&pageSize&sortBy&sortDir&keyword   → 分页任务列表
 *  - POST /api/tasks/save          { task }                → { ok:true }（单条 upsert）
 *  - POST /api/tasks/batch-save    [ task, ... ]           → { ok:true }（批量 upsert）
 *  - POST /api/tasks/delete?id=...                          → { ok:true }
 *  - POST /api/tasks/batch-delete  { ids:[...] }           → { deleted:n }
 *  - POST /api/tasks/clear                                  → { deleted:n }
 *
 * 注意：后端把前端 task 的运行时字段（status/loading 等）过滤掉（见 ALLOWED_TASK_COLUMNS），
 * 只落 task_id/node_id/prompt/result_url/... 等持久化字段。status 是运行时态，每次 upsert
 * 都传最新值，前端内存仍以 useTasks 为准；后端只保证「刷新/重启后历史还在」。
 */
import { API_BASE } from './apiBase.js'

/** 读任务列表（分页），返回 { items, total } */
export async function fetchTasks({ page = 1, pageSize = 200, keyword = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (keyword) params.set('keyword', keyword)
  const res = await fetch(`${API_BASE}/api/tasks?${params}`)
  if (!res.ok) throw new Error(`fetchTasks failed: HTTP ${res.status}`)
  return res.json() // { items, total, page, pageSize }
}

/** 保存单条任务（upsert） */
export async function saveTask(task) {
  const res = await fetch(`${API_BASE}/api/tasks/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  })
  if (!res.ok) throw new Error(`saveTask failed: HTTP ${res.status}`)
  return res.json()
}

/** 批量保存任务 */
export async function batchSaveTasks(tasks) {
  if (!tasks || tasks.length === 0) return { ok: true }
  const res = await fetch(`${API_BASE}/api/tasks/batch-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tasks),
  })
  if (!res.ok) throw new Error(`batchSaveTasks failed: HTTP ${res.status}`)
  return res.json()
}

/** 删除单个任务 */
export async function deleteTask(id) {
  const res = await fetch(`${API_BASE}/api/tasks/delete?id=${encodeURIComponent(id)}`, { method: 'POST' })
  if (!res.ok) throw new Error(`deleteTask failed: HTTP ${res.status}`)
  return res.json()
}

/** 批量删除任务 */
export async function batchDeleteTasks(ids) {
  if (!ids || ids.length === 0) return { deleted: 0 }
  const res = await fetch(`${API_BASE}/api/tasks/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error(`batchDeleteTasks failed: HTTP ${res.status}`)
  return res.json()
}

/** 清空所有任务 */
export async function clearAllTasksApi() {
  const res = await fetch(`${API_BASE}/api/tasks/clear`, { method: 'POST' })
  if (!res.ok) throw new Error(`clearTasks failed: HTTP ${res.status}`)
  return res.json()
}
