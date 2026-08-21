/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层 —— 共享底层状态 + 存储抽象（可拆分的底座）
 * ════════════════════════════════════════════════════════════════
 *
 * 【拆分契约 · 2026-08-21】原 conversationStore.js 是"上帝文件"（674 行 / 44 导出），
 * 本文件把「模块级可变状态 + 落盘/订阅/隔离 + 归一化」这一最底层依赖抽出来，作为单向依赖底座。
 * 分文件依赖方向（无环）：conversationState(底座) ← { conversationSnapshot, conversationAiState }
 *   ← { conversationImageMap, conversationStore(聚合入口) }。
 *
 * 【本文件职责 = 审计文档 §1.6 的"共享 state 层"】states/hydratedSet/currentAgentKey/listeners
 * 等模块级可变状态、persistDebounced 落盘、subscribe/getSnapshot 订阅、initState/getState/commit
 * 读写、uid/emptyMemory 与 normalize 归一化。必须全局唯一，否则多文件各持 state 状态隔离断裂。
 *
 * 【对外 API】其余文件从本文件 import 这套内部契约（convKey / getState / commit / uid /
 * getActiveConv / normalize* 等）；但本文件的"公开 API"仅 useConversationStore / setAgentKey /
 * flushPersist / resetConversationCache / normalize* ，由 conversationStore.js 作为聚合入口统一 re-export，
 * 调用方 import 路径与符号名都不变。
 * ════════════════════════════════════════════════════════════════
 */
import { useSyncExternalStore } from 'react'
import { contentGet, contentSet, createDebouncedPersist } from './contentStore.js'
import { generateId } from './idGen.js'

/**
 * 存储键按 agentKey 隔离（每项目一个 agentKey → 每项目一套会话）。
 * 键形如 agent_conversations_canvas-assistant-<projectId>，天然按项目分开。
 */
export const convKey = (k) => `agent_conversations_${k}`
export const activeKey = (k) => `agent_active_conversation_id_${k}`
/** 每对话消息上限（对齐大雄 AGENT_MSG_MAX = 60，防无限膨胀） */
export const AGENT_MSG_MAX = 60

/** 空对话记忆（对齐大雄 agentEmptyConversationMemory） */
export function emptyMemory() {
  return {
    summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [],
    global_contract: null, // 统一风格契约 {visual_positioning, unified_style_prompt, unified_negative_prompt}（对齐大雄 global_contract）
    artifacts: null,       // 跨步成果资产 [{id,type,title,description,nodeId?,url?}]（对齐大雄 plan.artifacts）
  }
}

/**
 * 单一数据源改为「按 agentKey 隔离」：每个 agentKey（本项目=每项目）一份 { conversations, activeId, sending }。
 * 这样 AI 会话跟随项目走，项目作为最顶层，互不串话。
 * sending = 运行态标志（是否正在发送/流式）。仅存内存、不落盘（persist 只序列化 conversations + activeId）。
 */
const states = {}           // { [agentKey]: { conversations, activeId, sending } }
const hydratedSet = {}      // { [agentKey]: boolean } 该 key 是否已恢复过当前对话
let currentAgentKey = 'canvas-assistant'  // 当前生效的 agentKey（由 setAgentKey 设置）

// P4 落盘节流：commit 每次变更全量 stringify + 落盘是热路径（流式/轮询/记忆提炼高频触发），
// 防抖合并成最终态一次落盘。通知订阅者（notify）保持即时，只有「落盘」被节流。
// write 是「读当前最新 state」的 thunk——flush 时才执行，天然合并窗口内多次 commit 的最终态。
// 兜底：createDebouncedPersist 自动注册 pagehide flush，极端刷新/关闭不丢最后变更。
const persistDebounced = createDebouncedPersist(() => {
  if (!hydratedSet[currentAgentKey]) return // 未恢复不落盘（防挂载覆盖）
  const next = states[currentAgentKey]
  if (!next) return
  try {
    contentSet(convKey(currentAgentKey), next.conversations.map(normalizeConversation))
    contentSet(activeKey(currentAgentKey), next.activeId || '')
  } catch { /* 忽略写失败 */ }
}, 300)

/** 强制立即落盘当前 agentKey 会话（页面卸载兜底 / 测试用） */
export function flushPersist() {
  persistDebounced.flush()
}

/** 订阅者 */
const listeners = new Set()

/** 订阅当前 agentKey 状态变更（供 useStoreSelector 按字段订阅，避免整包订阅连坐重渲染） */
export function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot() {
  return states[currentAgentKey] || { conversations: [], activeId: '', sending: false }
}

/** useConversationStore()：订阅当前 agentKey 的会话状态（对齐 taskStore 的 useTasks 用法） */
export function useConversationStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 设置当前 agentKey（项目切换/新建时调用）。若该 key 首次出现则从 localStorage 加载。 */
export function setAgentKey(key) {
  const k = key || 'canvas-assistant'
  if (k === currentAgentKey) return
  currentAgentKey = k
  if (!states[k]) initState(k)
  listeners.forEach((l) => l())
}

/** 从 localStorage 加载某个 agentKey 的初始 state */
function initState(k) {
  let conversations = []
  try {
    const arr = contentGet(convKey(k))
    conversations = (Array.isArray(arr) ? arr : []).map(normalizeConversation).filter(Boolean)
  } catch {
    conversations = []
  }
  let activeId = ''
  try {
    const id = contentGet(activeKey(k))
    activeId = typeof id === 'string' && id ? id : ''
  } catch {
    activeId = ''
  }
  // 兼容迁移：改造前会话存固定键 agent_conversations（无项目后缀）。
  // 仅当「默认项目(canvas-assistant-default)」且新键无数据时，从旧键迁一次，避免历史会话丢失。
  if (conversations.length === 0 && k === 'canvas-assistant-default') {
    const migrated = migrateLegacyGlobal()
    if (migrated) {
      conversations = migrated.conversations
      activeId = migrated.activeId
      // 迁移后立即落盘到新键
      try {
        contentSet(convKey(k), conversations.map(normalizeConversation))
        contentSet(activeKey(k), activeId || '')
      } catch { /* 忽略写失败 */ }
    }
  }
  states[k] = { conversations, activeId, sending: false }
}

/** 从旧固定键 agent_conversations 迁移一次（改造前会话归属默认项目） */
function migrateLegacyGlobal() {
  let conversations = []
  try {
    const arr = contentGet('agent_conversations')
    conversations = (Array.isArray(arr) ? arr : []).map(normalizeConversation).filter(Boolean)
  } catch {
    conversations = []
  }
  if (conversations.length === 0) return null
  let activeId = ''
  try {
    const id = contentGet('agent_active_conversation_id')
    activeId = typeof id === 'string' && id && conversations.some((c) => c.id === id) ? id : conversations[0].id
  } catch {
    activeId = conversations[0].id
  }
  return { conversations, activeId }
}

/** 读取当前 agentKey 的 state（确保已初始化）——供各分文件读写共享状态 */
export function getState() {
  if (!states[currentAgentKey]) initState(currentAgentKey)
  return states[currentAgentKey]
}

/** 统一提交：更新当前 agentKey 的 state + 通知；持久化由 persist 控制（hydrated 后才写 localStorage，防挂载覆盖）。
 *  persist=false 用于流式热路径的"仅通知不落盘"（patchCurrentMessages），最终态由 send finally 统一落盘。 */
export function commit(next, opts = {}) {
  const { persist = true } = opts
  states[currentAgentKey] = next
  listeners.forEach((l) => l())
  if (hydratedSet[currentAgentKey] && persist) persistDebounced.schedule()
}

/**
 * 【阶段1D·薄壳化】设置当前 agentKey 的 sending 运行态标志。
 * 仅内存、不落盘（persist 只序列化 conversations + activeId，sending 会被忽略）。
 * 供 useAgentChat 订阅 sending（UI 展示"思考中"），与 sendingRef（异步闭包读）分离。
 */
export function setSending(sending) {
  const st = getState()
  commit({ ...st, sending: !!sending }, { persist: false })
}

/** 生成唯一 id（对齐大雄 uid('ac')） */
export function uid(prefix) {
  return generateId(prefix || 'ac')
}

/** 读当前对话对象（内部；无则 null）——各分文件共用 */
export function getActiveConv() {
  return getState().conversations.find((c) => c.id === getState().activeId) || null
}

/** 标记当前 agentKey 已从存储恢复（hydrated=true，此后 commit 允许落盘）。
 *  由 applyConversation / importLegacy（conversationStore 聚合层）在恢复/切换成功后调用。 */
export function markHydrated() {
  hydratedSet[currentAgentKey] = true
}

/** 保证一个对话的结构完整（数组字段缺省补齐、workflow/pending/memory 归一） */
export function normalizeConversation(c) {
  if (!c || typeof c !== 'object') return null
  if (!Array.isArray(c.messages)) c.messages = []
  // P15 列表 key：保证每条消息有稳定唯一 id（无 id 的补一个，已有保留；幂等——补过的对象带 id，
  // 二次归一化直接返回原引用，不重生成 → 列表 key 稳定不重挂载）。
  c.messages = c.messages.map((m) => {
    if (!m || typeof m !== 'object' || m.id) return m
    return { ...m, id: generateId('msg') }
  })
  if (!Array.isArray(c.skills)) c.skills = []
  if (!Array.isArray(c.attachments)) c.attachments = []
  if (typeof c.title !== 'string') c.title = c.title || '对话'
  if (typeof c.draft !== 'string') c.draft = ''
  if (!c.id) c.id = uid('ac')
  if (!c.ts) c.ts = Date.now()
  if (!c.updatedAt) c.updatedAt = c.ts
  // 记忆归一
  if (!c.memory || typeof c.memory !== 'object') c.memory = emptyMemory()
  if (!Array.isArray(c.memory.facts)) c.memory.facts = []
  if (!Array.isArray(c.memory.notes)) c.memory.notes = []
  if (typeof c.memory.summary !== 'string') c.memory.summary = ''
  if (typeof c.memory.lastSharedStyle !== 'string') c.memory.lastSharedStyle = ''
  // workflow / pending：缺省为 null（可空）
  if (c.workflow === undefined) c.workflow = null
  if (c.pending === undefined) c.pending = null
  // 工作流运行时状态（per-conversation，Step D 下沉，防模块级串话）
  if (!Array.isArray(c.aiUndoStack)) c.aiUndoStack = [] // AI 撤销栈快照 [{nodes,edges,action}]
  if (c.pendingGenerations === undefined) c.pendingGenerations = null // Skill 阶段1 策划暂存
  if (typeof c.awaitingConfirm !== 'boolean') c.awaitingConfirm = false // Skill 阶段2 确认态
  if (!Array.isArray(c.referenceImages)) c.referenceImages = [] // 本轮用户引用的参考图 URL（per-conversation，防跨对话泄漏）
  // 【对齐大雄 runMode】执行分级：'auto'（默认，直接出 generations 执行，不展示 plan 门禁）/
  // 'semi'（半自动，出 generations 后展示 plan 确认再执行）。大雄 agentNormalizeRunModeState(1468)。
  if (String(c.runMode || 'auto').toLowerCase() !== 'semi') c.runMode = 'auto'
  return c
}

/** 归一 workflow：保证结构完整（对齐大雄 conv.workflow） */
export function normalizeWorkflow(w) {
  if (!w || typeof w !== 'object') return null
  if (!w.id) w.id = generateId('awf')
  if (!w.status) w.status = 'planning'
  if (!Array.isArray(w.nodeIds)) w.nodeIds = []
  if (!Array.isArray(w.steerQueue)) w.steerQueue = []
  if (!w.startedAt) w.startedAt = Date.now()
  if (!w.updatedAt) w.updatedAt = Date.now()
  return w
}

/** 归一 pending：{ conversationId, text, attachments } */
export function normalizePending(p) {
  if (!p || typeof p !== 'object') return null
  return {
    conversationId: p.conversationId || '',
    text: String(p.text || ''),
    attachments: Array.isArray(p.attachments) ? p.attachments.slice() : [],
  }
}

/** 归一 memory（对齐大雄 agentEmptyConversationMemory） */
export function normalizeMemory(m) {
  const base = emptyMemory()
  if (!m || typeof m !== 'object') return base
  return {
    summary: typeof m.summary === 'string' ? m.summary : base.summary,
    facts: Array.isArray(m.facts) ? m.facts.slice() : base.facts,
    lastPlan: m.lastPlan || null,
    lastSharedStyle: typeof m.lastSharedStyle === 'string' ? m.lastSharedStyle : base.lastSharedStyle,
    notes: Array.isArray(m.notes) ? m.notes.slice() : base.notes,
    global_contract: (m && m.global_contract && typeof m.global_contract === 'object')
      ? {
          visual_positioning: String(m.global_contract.visual_positioning || '').trim(),
          unified_style_prompt: String(m.global_contract.unified_style_prompt || '').trim(),
          unified_negative_prompt: String(m.global_contract.unified_negative_prompt || '').trim(),
        }
      : null,
    artifacts: Array.isArray(m?.artifacts) ? m.artifacts.map((a) => ({ ...a })) : null,
  }
}

/** 重置 store 内存缓存（测试/硬重置用）：清空所有 agentKey 的缓存 */
export function resetConversationCache() {
  for (const k of Object.keys(states)) delete states[k]
  for (const k of Object.keys(hydratedSet)) delete hydratedSet[k]
  listeners.forEach((l) => l())
}