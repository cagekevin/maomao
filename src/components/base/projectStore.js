/**
 * 项目 store —— 后端化（对齐官方，项目列表 + 当前项目走 localTool /api/projects → SQLite）。
 *
 * 存储策略（双写，兼顾持久化与可用性）：
 *  - 内存 `projects`/`currentProjectId` 是唯一数据源（供 useProjects 实时订阅）。
 *  - 每次变更「同时写」localStorage（兜底，localTool 断开也能用）+ localTool /api/projects（持久化，跨端共享）。
 *  - 启动时 `initProjects()` 从后端加载，以后端为准（localTool 连上时项目跨端共享）。
 *  - 画布快照 canvas-state-v1-${projectId} 走 KV（跨端共享，见 kvStore）。
 */
import { useSyncExternalStore } from 'react'
import { storageGet, storageSet, storageDelete, CANVAS_STATE_PREFIX } from './kvStore.js'
import { fetchProjects, saveProjects } from './projectsApi.js'
import { sGet, sSet } from './storageAdapter.js'

const PROJECTS_KEY = 'projects'
const LAST_OPENED_KEY = 'lastOpenedProject'

let projects = loadProjects()
let currentProjectId = loadLastOpened()
let loaded = false // 是否已从后端加载过
const listeners = new Set()

function loadJSON(key, fallback) {
  try {
    const raw = sGet(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveJSON(key, val) {
  try {
    sSet(key, JSON.stringify(val))
  } catch {
    /* ignore */
  }
}

function loadProjects() {
  const list = loadJSON(PROJECTS_KEY, null)
  if (Array.isArray(list) && list.length > 0) return list
  const seeded = [{ id: 'default', name: '默认项目' }]
  saveJSON(PROJECTS_KEY, seeded)
  return seeded
}

function loadLastOpened() {
  const v = loadJSON(LAST_OPENED_KEY, 'default')
  return typeof v === 'string' && v ? v : 'default'
}

// 持久化：双写 localStorage + localTool 后端（fire-and-forget）
function persist() {
  saveJSON(PROJECTS_KEY, projects)
  saveJSON(LAST_OPENED_KEY, currentProjectId)
  saveProjects(
    projects.map((p) => ({ id: p.id, name: p.name })),
    currentProjectId
  ).catch(() => {})
}

// 启动时从后端加载项目（以后端为准，覆盖本地兜底）
export function initProjects() {
  if (loaded) return
  loaded = true
  fetchProjects()
    .then((data) => {
      const list = Array.isArray(data?.projects) ? data.projects.map((p) => ({ id: p.id, name: p.name })) : []
      if (list.length > 0) {
        projects = list
        currentProjectId = data.lastOpened && list.some((p) => p.id === data.lastOpened) ? data.lastOpened : list[0].id
        notify()
      }
    })
    .catch((e) => console.warn('[projectStore] 加载项目失败（localTool 未连？）:', e?.message))
}

// 缓存快照对象，保证 useSyncExternalStore 的 getSnapshot 返回稳定引用（避免无限重渲染）
let lastSnapshot = { projects, currentProjectId }

function updateSnapshot() {
  lastSnapshot = { projects, currentProjectId }
}

function notify() {
  updateSnapshot()
  listeners.forEach((l) => l())
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return lastSnapshot
}

// 项目 id 复刻官方 Vr.jsx L2303 `proj-${Date.now()}`
function genId() {
  return `proj-${Date.now()}`
}

// 读写当前项目画布快照（走 KV，异步）。key 为 canvas-state-v1- 前缀 → 自动分流到 localTool KV。
export async function loadCanvasState(projectId) {
  try {
    const v = await storageGet(CANVAS_STATE_PREFIX + (projectId || currentProjectId))
    return v && typeof v === 'object' ? v : null
  } catch (e) {
    console.warn('[projectStore] 读取画布快照失败（KV 不可用？）:', e?.message)
    return null
  }
}
export async function saveCanvasState(projectId, nodes, edges) {
  try {
    await storageSet(CANVAS_STATE_PREFIX + (projectId || currentProjectId), { nodes, edges })
  } catch (e) {
    console.warn('[projectStore] 保存画布快照失败（KV 不可用？）:', e?.message)
  }
}

// 当前项目信息
export function getCurrentProject() {
  return projects.find((p) => p.id === currentProjectId) || projects[0] || { id: 'default', name: '默认项目' }
}

// 新建项目：返回新项目；创建后切到该项目（不自动清空画布，由调用方决定）
export function createProject(name) {
  const proj = { id: genId(), name: (name && name.trim()) || '未命名项目' }
  projects = [...projects, proj]
  currentProjectId = proj.id
  persist()
  notify()
  return proj
}

// 切换项目：返回目标项目
export function switchProject(id) {
  if (!projects.some((p) => p.id === id)) return getCurrentProject()
  currentProjectId = id
  persist()
  notify()
  return getCurrentProject()
}

// 删除项目：至少保留一个；删除时移除画布快照（KV），切到第一个
export function deleteProject(id) {
  if (projects.length <= 1) return false
  projects = projects.filter((p) => p.id !== id)
  // 异步删除画布快照（KV）
  storageDelete(CANVAS_STATE_PREFIX + id).catch(() => {})
  if (currentProjectId === id) currentProjectId = projects[0].id
  persist()
  notify()
  return true
}

// 重命名项目
export function renameProject(id, name) {
  projects = projects.map((p) => (p.id === id ? { ...p, name: (name && name.trim()) || p.name } : p))
  persist()
  notify()
}

export function useProjects() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
