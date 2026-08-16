/**
 * ════════════════════════════════════════════════════════════════
 * 完整导入/导出备份层（对齐官方 yimao 工作流备份）
 * ════════════════════════════════════════════════════════════════
 *
 * 【解决什么】官方有"导出所有内容/导入所有内容(JSON)"——把全局配置、项目、画布快照
 * 完整打包下载/恢复。我们此前分散在各 store，无统一备份清单。
 * 本模块提供「备份清单 + exportAll/importAll」，作为导入导出的地基。
 *
 * 【备份内容】见 LS_KEYS（localStorage 配置）+ KV 画布快照（canvas-state-v1-*，遍历 projects）。
 * ⚠️ 含用户数据（对话历史/账号环境/API key 等），导出文件需妥善保管（对齐官方语义）。
 *
 * 【导入后】各 store 的内存缓存不会自动更新（localStorage 直写），故 importAll 后
 * 调用方必须 window.location.reload() 刷新应用（对齐官方）。
 *
 * 【格式】
 * {
 *   version: 2,
 *   type: 'yimao-backup',
 *   exportedAt: ISO,
 *   ls: { [localStorageKey]: value },          // 所有备份清单里的 localStorage 键
 *   canvas: { [projectId]: { nodes, edges } }   // 各项目画布快照
 * }
 */
import { sGet, sSet } from './storageAdapter.js'
import { loadCanvasState, saveCanvasState } from './projectStore.js'

/** localStorage 备份清单（所有该备份的用户数据/配置键） */
const LS_KEYS = [
  'projects',                     // 项目列表（projectStore）
  'lastOpenedProject',            // 上次打开项目（projectStore）
  'app_settings',                 // 应用设置（appSettings）
  'agent_skills',                 // 自定义 Skill（skillStore）
  'agent_skill_usage',            // Skill 使用次数（skillStore）
  'agent_chat_model',             // AI 聊天模型（agentModelStore）
  'yimao_preset_prompts',         // 提示词预设（promptManager）
  'yimao_preset_recent',          // 预设最近使用（promptManager）
  'yimao_asset_library',          // 素材库（assetStore）
  'yimao_node_prefs',             // 节点偏好（nodePrefs）
  'yimao_accounts',               // 账号环境（accountsStore）
]

/**
 * AI 会话键（conversationStore 按 agentKey=项目隔离）：每项目一套会话存储。
 * 项目列表读自 projects 键；键形如 agent_conversations_canvas-assistant-<projectId>。
 * @param {Array} projects 项目列表（{id}）
 * @returns {string[]} 所有项目的会话键
 */
function conversationKeys(projects) {
  const keys = []
  const list = Array.isArray(projects) ? projects : []
  const ids = new Set(list.map((p) => p && p.id).filter(Boolean))
  ids.add(getCurrentProjectId())
  for (const id of ids) {
    keys.push(`agent_conversations_canvas-assistant-${id}`)
    keys.push(`agent_active_conversation_id_canvas-assistant-${id}`)
  }
  return keys
}

/** 读 localStorage 某键（容错） */
function readLS(k) {
  try {
    const v = sGet(k)
    if (v === null || v === undefined) return undefined
    try { return JSON.parse(v) } catch { return v }
  } catch { return undefined }
}

/** 写 localStorage 某键（容错） */
function writeLS(k, v) {
  try {
    sSet(k, typeof v === 'string' ? v : JSON.stringify(v))
  } catch { /* ignore */ }
}

/** 当前项目 id（从项目列表取当前，优先 lastOpenedProject） */
function getCurrentProjectId() {
  try {
    const projects = readLS('projects')
    if (Array.isArray(projects) && projects.length) {
      const last = readLS('lastOpenedProject')
      if (last && projects.some((p) => p.id === last)) return last
      return projects[0].id
    }
  } catch { /* ignore */ }
  return 'default'
}

/**
 * 导出全部备份 → 打包对象（不触发下载）。
 * @returns {Promise<object>} 备份对象（含 ls + canvas）
 */
export async function exportAll() {
  const ls = {}
  for (const k of LS_KEYS) {
    const v = readLS(k)
    if (v !== undefined) ls[k] = v
  }
  // AI 会话（按项目隔离）：动态收集所有项目的会话键
  const projectsForConv = Array.isArray(ls.projects) ? ls.projects : []
  for (const k of conversationKeys(projectsForConv)) {
    const v = readLS(k)
    if (v !== undefined) ls[k] = v
  }
  // 画布快照：遍历所有项目逐个读 KV
  const canvas = {}
  const projects = Array.isArray(ls.projects) ? ls.projects : []
  const ids = new Set(projects.map((p) => p.id))
  ids.add(getCurrentProjectId())
  for (const id of ids) {
    try {
      const state = await loadCanvasState(id)
      if (state && (state.nodes || state.edges)) canvas[id] = { nodes: state.nodes || [], edges: state.edges || [] }
    } catch { /* 单个项目快照读失败跳过 */ }
  }
  return {
    version: 2,
    type: 'yimao-backup',
    exportedAt: new Date().toISOString(),
    ls,
    canvas,
  }
}

/**
 * 导入备份：把备份对象写回 localStorage + KV 画布快照。
 * ⚠️ 调用方需在成功后 window.location.reload() 刷新应用。
 * @param {object} backup 备份对象（exportAll 的返回）
 * @returns {{ ok:boolean, ls:number, canvas:number, error?:string }}
 */
export async function importAll(backup) {
  if (!backup || typeof backup !== 'object') return { ok: false, ls: 0, canvas: 0, error: '备份数据无效' }
  let lsCount = 0
  let canvasCount = 0
  // localStorage：先备份清单里已有的键再覆盖
  if (backup.ls && typeof backup.ls === 'object') {
    for (const k of Object.keys(backup.ls)) {
      writeLS(k, backup.ls[k])
      lsCount++
    }
  }
  // 画布快照：逐个写回 KV
  if (backup.canvas && typeof backup.canvas === 'object') {
    for (const projectId of Object.keys(backup.canvas)) {
      const c = backup.canvas[projectId]
      try {
        const res = await saveCanvasState(projectId, c?.nodes || [], c?.edges || [])
        if (!res?.skipped) canvasCount++
      } catch { /* 单个快照写失败跳过 */ }
    }
  }
  return { ok: true, ls: lsCount, canvas: canvasCount }
}

/** 把备份对象转成可下载的 Blob */
export function backupToBlob(backup) {
  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
}
