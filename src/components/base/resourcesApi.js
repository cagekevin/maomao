/**
 * 资源面板（生成/素材）后端 API 封装 —— 对齐官方资源面板（Vr.jsx ft()/kr() + Un.jsx）。
 *
 * localTool 已实现（routes/resources.ts + routes/files.ts，SQLite 落盘）：
 *  - GET  /api/resources?page&pageSize&sortBy&sortDir&filters=JSON   → 分页资源列表
 *        filters 支持官方 DSL：{ folder: { eqOrPrefix: 'tasks' } }（精确 + 前缀，即 tasks 及其子目录）
 *  - POST /api/resources/rescan    → 扫描 upload 目录同步进 resources 表（打开面板时先触发，保证生成结果最新）
 *  - POST /api/resources/delete?id=xxx        → { ok:true }
 *  - POST /api/resources/save      body 资源对象 → { ok:true }（upsert，含 isFavorite）
 *  - GET  /api/files/open?subfolder=xxx       → 打开本地目录（顶部「打开本地存储目录」按钮）
 *  - GET  /api/files/open-dir?filepath=xxx    → 打开某文件所在目录（卡片「打开目录」按钮）
 */
import { API_BASE } from './apiBase.js'

/** 分页查询资源（folder eqOrPrefix 匹配：'tasks' 会命中 tasks 及其子目录 tasks/xxx） */
export async function fetchResources({ folder, page = 1, pageSize = 60, type } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  const filters = {}
  if (folder) filters.folder = { eqOrPrefix: folder }
  if (type) filters.type = type
  if (Object.keys(filters).length) params.set('filters', JSON.stringify(filters))
  const res = await fetch(`${API_BASE}/api/resources?${params.toString()}`)
  if (!res.ok) throw new Error(`fetchResources failed: HTTP ${res.status}`)
  return res.json() // { items, total, page, pageSize, totalPages }
}

/** 触发 rescan：把磁盘 upload 目录（含 tasks）同步进 resources 表 */
export async function rescanResources() {
  const res = await fetch(`${API_BASE}/api/resources/rescan`, { method: 'POST' })
  if (!res.ok) throw new Error(`rescan failed: HTTP ${res.status}`)
  return res.json()
}

/** 删除一条资源（同步删磁盘文件） */
export async function deleteResource(id) {
  const res = await fetch(`${API_BASE}/api/resources/delete?id=${encodeURIComponent(id)}`, { method: 'POST' })
  if (!res.ok) throw new Error(`deleteResource failed: HTTP ${res.status}`)
  return res.json()
}

/** 保存/更新一条资源（收藏 toggle 走这里 upsert isFavorite） */
export async function saveResource(resource) {
  const res = await fetch(`${API_BASE}/api/resources/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resource),
  })
  if (!res.ok) throw new Error(`saveResource failed: HTTP ${res.status}`)
  return res.json()
}

/** 重命名资源（同步改磁盘文件名 + resources 表记录） */
export async function renameResource(id, name) {
  const res = await fetch(`${API_BASE}/api/resources/rename?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`, { method: 'POST' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || `renameResource failed: HTTP ${res.status}`)
  }
  return res.json() // { ok, id, url, name }
}

/** 打开本地存储目录（官方 Un.jsx 顶部「打开本地存储目录」按钮） */
export async function openLocalFolder(subfolder) {
  const res = await fetch(`${API_BASE}/api/files/open?subfolder=${encodeURIComponent(subfolder || 'tasks')}`)
  if (!res.ok) throw new Error(`openLocalFolder failed: HTTP ${res.status}`)
  return res.json() // { path }
}

/** 打开某文件所在目录（官方卡片「打开目录」按钮）。filepath 是 url 去 /files/ 前缀的相对路径 */
export async function openFileDir(filepath) {
  if (!filepath) return
  const res = await fetch(`${API_BASE}/api/files/open-dir?filepath=${encodeURIComponent(filepath)}`)
  if (!res.ok) throw new Error(`openFileDir failed: HTTP ${res.status}`)
  return res.json() // { path }
}

/** 从资源的 18080 url 解析出相对路径（去 /files/ 前缀），供 open-dir 用 */
export function relativePathFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/^\/files\//, '')
  } catch {
    return null
  }
}
