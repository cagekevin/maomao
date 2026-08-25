/**
 * localTool 后端端点统一封装（深模块）—— tasks / projects / resources / providers / kv。
 *
 * 【为什么存在】原 tasksApi / projectsApi / resourcesApi / settingsApi(providerApi) 四薄壳
 * 各自散落「拼 URL + httpRequest + label」，接口面 ≈ 实现体。合并为本模块后：
 *  - URL 契约（/api/tasks、/api/projects、/api/resources、/api/providers、/api/kv）集中到 1 处；
 *  - encodeURIComponent / JSON.stringify POST 样板收口；
 *  - 新增 localTool 端点只需在本文件加 1 个函数，不再开新薄壳文件。
 *
 * 【边界】filesApi.js 是深模块（sha1 去重 / dataURL↔Blob / blob: 短路），不并入。
 *  kvStore.js 的 storageGet/Set/Delete 分流外壳（含 localStorage 降级）也留在 kvStore。
 *  本模块只收口「纯 /api/* 透传」的 CRUD + kv 底层。
 *
 * 【传输】一律经 httpClient.httpRequest，继承超时 / 取消 / 错误分类 / 受限重试。
 *  非 2xx 抛 HttpError，本模块不吞错误、不改写 message（CONTEXT 错误透传铁律）。
 */
import { httpRequest, httpPost } from './httpClient.js'
import { API_BASE } from './config.js'
import { UPLOAD_DIRS } from './uploadDirs.js'

// ─────────────────────────── tasks ───────────────────────────
// GET /api/tasks?page&pageSize&keyword → { items, total }
export async function fetchTasks({ page = 1, pageSize = 200, keyword = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (keyword) params.set('keyword', keyword)
  return httpRequest(`${API_BASE}/api/tasks?${params}`, { label: 'fetchTasks' })
}

// POST /api/tasks/save { task } → { ok:true }（单条 upsert）
export async function saveTask(task) {
  return httpRequest(`${API_BASE}/api/tasks/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
    label: 'saveTask',
  })
}

// POST /api/tasks/batch-save [ task, ... ] → { ok:true }；空数组短路
export async function batchSaveTasks(tasks) {
  if (!tasks || tasks.length === 0) return { ok: true }
  return httpRequest(`${API_BASE}/api/tasks/batch-save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tasks),
    label: 'batchSaveTasks',
  })
}

// POST /api/tasks/delete?id=... → { ok:true }
export async function deleteTask(id) {
  return httpPost(`${API_BASE}/api/tasks/delete?id=${encodeURIComponent(id)}`, null, { label: 'deleteTask' })
}

// POST /api/tasks/batch-delete { ids:[...] } → { deleted:n }；空数组短路
export async function batchDeleteTasks(ids) {
  if (!ids || ids.length === 0) return { deleted: 0 }
  return httpRequest(`${API_BASE}/api/tasks/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    label: 'batchDeleteTasks',
  })
}

// POST /api/tasks/clear → { deleted:n }
export async function clearAllTasksApi() {
  return httpPost(`${API_BASE}/api/tasks/clear`, null, { label: 'clearTasks' })
}

// ─────────────────────────── projects ───────────────────────────
// GET /api/projects → { projects, lastOpened }
export async function fetchProjects() {
  return httpRequest(`${API_BASE}/api/projects`, { label: 'fetchProjects' })
}

// POST /api/projects/save { projects, lastOpened, version } → { ok:true, version }（全量覆盖 + 并发版本保护）
// version：前端声明的项目列表版本号。后端检测 body.version < 库内最新 version → 拒绝（conflict:true），
// 防双页面/旧数据覆盖丢新项目。旧前端不传 version → 后端不拦截（向后兼容）。
export async function saveProjects(projects, lastOpened, version) {
  return httpRequest(`${API_BASE}/api/projects/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects, lastOpened, version: typeof version === 'number' ? version : undefined }),
    label: 'saveProjects',
  })
}

// ─────────────────────────── resources ───────────────────────────
// GET /api/resources?page&pageSize&filters=JSON → 分页资源列表
export async function fetchResources({ folder, page = 1, pageSize = 60, type } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  const filters = {}
  if (folder) filters.folder = folder // 精确等值匹配当前层级
  if (type) filters.type = type
  if (Object.keys(filters).length) params.set('filters', JSON.stringify(filters))
  return httpRequest(`${API_BASE}/api/resources?${params.toString()}`, { label: 'fetchResources' }) // { items, total, page, pageSize, totalPages }
}

// POST /api/resources/rescan → 同步磁盘 upload 目录进 resources 表
export async function rescanResources() {
  return httpPost(`${API_BASE}/api/resources/rescan`, null, { label: 'rescanResources' })
}

// POST /api/resources/delete?id=... → { ok:true }
export async function deleteResource(id) {
  return httpPost(`${API_BASE}/api/resources/delete?id=${encodeURIComponent(id)}`, null, { label: 'deleteResource' })
}

// POST /api/resources/save body 资源对象 → { ok:true }（upsert，含 isFavorite）
export async function saveResource(resource) {
  return httpRequest(`${API_BASE}/api/resources/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resource),
    label: 'saveResource',
  })
}

// POST /api/resources/rename?id=...&name=... → { ok:true }
export async function renameResource(id, name) {
  return httpPost(`${API_BASE}/api/resources/rename?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`, null, { label: 'renameResource' })
}

// GET /api/files/open?subfolder=... → { path }
export async function openLocalFolder(subfolder) {
  return httpRequest(`${API_BASE}/api/files/open?subfolder=${encodeURIComponent(subfolder || 'tasks')}`, { label: 'openLocalFolder' })
}

// GET /api/files/open-dir?filepath=... → { path }；空路径短路
export async function openFileDir(filepath) {
  if (!filepath) return
  return httpRequest(`${API_BASE}/api/files/open-dir?filepath=${encodeURIComponent(filepath)}`, { label: 'openFileDir' })
}

/** 从资源的 18080 url 解析出相对路径（去 /files/ 前缀），供 open-dir 用。纯函数，非转发。 */
export function relativePathFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/^\/files\//, '')
  } catch {
    return null
  }
}

// ─────────────────────────── providers（供应商管理）───────────────────────────
// 保持对象式 Interface（providerStore / cloudSync 共 6 处调用零改造）
const request = (path, { method = 'GET', body, label } = {}) =>
  httpRequest(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    label,
  })

export const providerApi = {
  getProviders: () => request('/api/providers', { label: 'getProviders' }),
  saveProviders: (providers) => request('/api/providers', { method: 'PUT', body: { providers }, label: 'saveProviders' }),
  testConnection: (payload) => request('/api/providers/test-connection', { method: 'POST', body: payload, label: 'testConnection' }),
  probeAsync: (payload) => request('/api/providers/probe-async', { method: 'POST', body: payload, label: 'probeAsync' }),
  fetchModels: (id) => request(`/api/providers/${encodeURIComponent(id)}/fetch-models`, { method: 'POST', label: 'fetchModels' }),
  syncConfigBase: (providers) => request('/api/config/base', { method: 'PUT', body: { providers }, label: 'syncConfigBase' }),
}

// ─────────────────────────── kv 底层（localTool KV，非 localStorage 分流）───────────────────────────
// GET /api/kv/get?key=... → 解析后的值或 null（key 不存在）
export async function kvGet(key) {
  return httpRequest(`${API_BASE}/api/kv/get?key=${encodeURIComponent(key)}`, { label: 'kvGet' })
}

// POST /api/kv/set { key, value } → { ok:true }
export async function kvSet(key, value) {
  return httpRequest(`${API_BASE}/api/kv/set`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
    label: 'kvSet',
  })
}

// POST /api/kv/delete?key=... → { ok:true }（删不存在也 ok）
export async function kvDelete(key) {
  return httpRequest(`${API_BASE}/api/kv/delete?key=${encodeURIComponent(key)}`, { method: 'POST', label: 'kvDelete' })
}

// ─────────────────────────── files（散落点收口）───────────────────────────
// POST /api/files/mkdir { folder } → { code:0, data:{ ok:true } }
// 收口 GeneratedView/AssetLibrary 此前裸拼 `/api/files/mkdir` 的 createFolder 散落点。
export async function createFolder(folder) {
  return httpRequest(`${API_BASE}/api/files/mkdir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
    retries: 0, // mkdir 是 UI 即时操作，不重试
    label: 'createFolder',
  })
}

// POST /api/files/upload multipart(file+subfolder=...) → { code:0, data:{ url, path, thumbnailUrl } }
// 收口 AssetLibrary 此前裸拼 `/api/files/upload` 的上传散落点；filesApi 深模块的
// sha1 去重 / dataURL↔Blob / blob: 短路逻辑留在 filesApi（本模块只收口纯透传 multipart）。
export async function uploadFile(file, subfolder, filename) {
  const fd = new FormData()
  fd.append('file', file, filename || file.name || 'upload')
  fd.append('subfolder', subfolder || UPLOAD_DIRS.migrated)
  return httpRequest(`${API_BASE}/api/files/upload`, { method: 'POST', body: fd, retries: 0, label: 'uploadFile' })
}
