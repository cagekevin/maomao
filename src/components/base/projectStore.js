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
import { useStoreSelector } from './useStoreSelector.js'
import { CANVAS_STATE_PREFIX } from './kvStore.js'
import { CANVAS_SCHEMA_VERSION } from './contracts.js'
import { fetchProjects, saveProjects } from './localToolApi.js'
import { contentGet, contentSet, contentGetAsync, contentSetAsync, contentDeleteAsync, createDebouncedPersist } from './contentStore.js'
import { logger } from './logger.js'

const PROJECTS_KEY = 'projects'
const LAST_OPENED_KEY = 'lastOpenedProject'

let projects = loadProjects()
let currentProjectId = loadLastOpened()
let loaded = false // 是否已从后端加载过
let lastSavedVersion = 0 // 画布版本号单调递增保底（同毫秒连续保存时自增）
const listeners = new Set()

function loadProjects() {
  const list = contentGet(PROJECTS_KEY)
  if (Array.isArray(list) && list.length > 0) return list
  const seeded = [{ id: 'default', name: '默认项目' }]
  contentSet(PROJECTS_KEY, seeded)
  return seeded
}

function loadLastOpened() {
  const v = contentGet(LAST_OPENED_KEY)
  const id = typeof v === 'string' && v ? v : 'default'
  return id
}

// P4 落盘节流：项目切换/重命名等离散操作同步 stringify + 双写（localStorage + 后端）节流合并，
// 消除高频切换时的重复 JSON.stringify 与 saveProjects 网络请求。通知订阅者保持即时。
// write 是「读当前最新 projects/currentProjectId」的 thunk——flush 时才执行，合并窗口内最终态。
// 兜底：createDebouncedPersist 自动注册 pagehide flush，极端刷新/关闭不丢最后变更。
const persistDebounced = createDebouncedPersist(() => {
  contentSet(PROJECTS_KEY, projects)
  contentSet(LAST_OPENED_KEY, currentProjectId)
  saveProjects(
    projects.map((p) => ({ id: p.id, name: p.name })),
    currentProjectId
  ).catch(() => {}) // fire-and-forget，后端保存失败下次 persist 再同步
}, 300)

function persist() {
  persistDebounced.schedule()
}

/** 强制立即落盘（页面卸载兜底 / 测试用） */
export function flushPersist() {
  persistDebounced.flush()
}

// 启动时从后端加载项目（以后端为准，覆盖本地兜底）
export function initProjects() {
  if (loaded) return
  loaded = true
  fetchProjects()
    .then((data) => {
      const list = Array.isArray(data?.data?.projects) ? data.data.projects.map((p) => ({ id: p.id, name: p.name })) : []
      if (list.length > 0) {
        projects = list
        currentProjectId = data.data.lastOpened && list.some((p) => p.id === data.data.lastOpened) ? data.data.lastOpened : list[0].id
        // 对齐官方 Vr.jsx L1104-1108：当前项目变化即持久化 lastOpenedProject。
        // 让 localStorage 与后端 lastOpened 同步，避免「刷新后短暂闪 default 再跳到正确项目」。
        persist()
        notify()
      }
    })
    .catch((e) => logger.warn('projectStore', '加载项目失败（localTool 未连？）', e?.message))
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
    const v = await contentGetAsync(CANVAS_STATE_PREFIX + (projectId || currentProjectId))
    if (!v || typeof v !== 'object') return null
    // P0-4 兼容读取：旧快照无 schemaVersion（视为版本 1 + 缺字段），统一返回 { nodes, edges, schemaVersion }。
    // 缺省字段由 App 加载侧的 applyNodeTypeDefaults 补齐，读取端不在此改结构，保持最小差异。
    // P20 viewport：旧快照可能无 viewport（未存视窗），读取端归一为 null（App 侧回退 fitView 适配全图）。
    const vp = v.viewport
    return {
      ...v,
      nodes: Array.isArray(v.nodes) ? v.nodes : null,
      edges: Array.isArray(v.edges) ? v.edges : [],
      schemaVersion: typeof v.schemaVersion === 'number' ? v.schemaVersion : 1,
      viewport: vp && typeof vp === 'object' ? { x: Number(vp.x) || 0, y: Number(vp.y) || 0, zoom: Number(vp.zoom) || 1 } : null,
    }
  } catch (e) {
    logger.warn('projectStore', '读取画布快照失败（KV 不可用？）', e?.message)
    return null
  }
}

// 【④ 不存不该存的】画布快照落盘前清理 ReactFlow 运行时 UI 态。
// ReactFlow 的 nodes 在交互时会带 selected / dragging / measured / handles 等运行时字段，
// 这些是「会话态」不是「数据」，不该进 KV 快照（否则污染存储、加大体积）。
// 白名单：只保留恢复画布必需的字段。
// ⚠️ 必须保留 parentId 与 extent：编组后子节点以「相对父节点的坐标」存储，且带 parentId + extent:'parent'。
// 旧白名单漏掉这俩，落盘后子节点丢失父子关系、却仍带着相对坐标被当作绝对坐标渲染，
// 刷新后所有编组子节点跑到原点附近（位置全乱）；同时 React Flow 失去 extent 钳制约束。
// ⚠️ 还要保留 style / initialWidth / initialHeight：group 节点的面积存在 style.width/height（渲染用）
// 与 initialWidth/Height（React Flow getNodeDimensions fallback 用）。旧白名单漏掉它们，
// 刷新后 group 矩形面积塌成 0×0（视觉缩成点），且框选命中判定因尺寸缺失而错乱。
// edges 同理只保留 source/target/type/data 等必要字段。
const NODE_KEEP = ['id', 'type', 'position', 'data', 'width', 'height', 'parentId', 'extent', 'style', 'initialWidth', 'initialHeight']
const EDGE_KEEP = ['id', 'source', 'target', 'sourceHandle', 'targetHandle', 'type', 'data', 'label']
function sanitizeNodes(nodes) {
  if (!Array.isArray(nodes)) return nodes
  return nodes.map((n) => {
    const out = {}
    for (const k of NODE_KEEP) {
      if (n[k] !== undefined && n[k] !== null) out[k] = n[k]
    }
    return out
  })
}
function sanitizeEdges(edges) {
  if (!Array.isArray(edges)) return edges
  return edges.map((e) => {
    const out = {}
    for (const k of EDGE_KEEP) {
      if (e[k] !== undefined && e[k] !== null) out[k] = e[k]
    }
    return out
  })
}
export async function saveCanvasState(projectId, nodes, edges, viewport) {
  const key = CANVAS_STATE_PREFIX + (projectId || currentProjectId)
  try {
    // 对齐官方 shared.js L1405：空画布跳过保存，防止空画布覆盖已有历史（误清空保护）。
    if (!nodes || nodes.length === 0) {
      return { success: false, skipped: true }
    }
    // 对齐官方 shared.js L1416：版本冲突检测。每次保存用 Date.now() 作为版本号写入 <key>_version，
    // 若远程已有更高版本（另一窗口/设备先写了更新的画布），拒绝本次覆盖，防旧数据冲掉新数据。
    // 单调递增保底：同毫秒内连续保存时 Date.now() 不变，需保证严格递增（否则 v2 不 > v1）。
    const now = Date.now()
    const version = now > lastSavedVersion ? now : lastSavedVersion + 1
    lastSavedVersion = version
    const remoteRaw = await contentGetAsync(`${key}_version`)
    const remoteVer = remoteRaw ? parseInt(String(remoteRaw), 10) : 0
    if (remoteVer > version) {
      logger.warn('projectStore', '画布版本冲突，拒绝覆盖', { key, remoteVer, version })
      return { success: false, skipped: true, conflictVersion: remoteVer }
    }
    // 【④】落盘前清理 ReactFlow 运行时 UI 态（selected/dragging/measured 等），只存必要字段
    // P20 viewport：视窗状态 { x, y, zoom }，仅当传入合法数值才存（否则留 undefined 不进 KV）。
    let savedViewport
    if (viewport && typeof viewport === 'object' && Number.isFinite(viewport.zoom)) {
      savedViewport = { x: Number(viewport.x) || 0, y: Number(viewport.y) || 0, zoom: Number(viewport.zoom) || 1 }
    }
    await contentSetAsync(key, {
      schemaVersion: CANVAS_SCHEMA_VERSION,
      nodes: sanitizeNodes(nodes),
      edges: sanitizeEdges(edges),
      ...(savedViewport ? { viewport: savedViewport } : {}),
    })
    await contentSetAsync(`${key}_version`, version)
    return { success: true, skipped: false }
  } catch (e) {
    logger.warn('projectStore', '保存画布快照失败（KV 不可用？）', e?.message)
    return { success: false, skipped: false }
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
  // 异步删除画布快照（KV）及对应 _version 版本 key
  contentDeleteAsync(CANVAS_STATE_PREFIX + id).catch(() => {}) // fire-and-forget，KV 删除失败不影响主流程
  contentDeleteAsync(CANVAS_STATE_PREFIX + id + '_version').catch(() => {}) // fire-and-forget
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

/** 原子订阅：只订阅当前项目 id（P5）。App 等大组件只用 currentProjectId 时，
 *  避免 projects 列表变更（新建/重命名）连坐整组件重渲染。 */
export function useCurrentProjectId() {
  return useStoreSelector(subscribe, getSnapshot, (s) => s.currentProjectId)
}
