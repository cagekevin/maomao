/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层（对齐 taskStore/providerStore 的 useSyncExternalStore 范式）
 * ════════════════════════════════════════════════════════════════
 *
 * 【为什么重构】见 docs/10。原实现是"current 内存镜像 + cache + 手动 captureActiveConversation"
 * 三套状态，靠各处手动同步，导致：
 *   - 挂载早期 AgentPanel 的 effect 用空 current 覆盖 localStorage 真实记录 → 刷新丢历史
 *   - 落盘时机靠手动 capture，漏调/时序错就丢或覆盖
 * 本次改为「单一数据源 + 自动落盘」，对齐 taskStore/providerStore 范式。
 *
 * 【单一数据源】
 *   state = { conversations: [], activeId }  模块级单例，从 localStorage 加载。
 *   所有变更统一走 _commit(nextState)：生成新 state + notify 订阅者 + 自动写 localStorage。
 *
 * 【写盘时机】
 *   - hydrated=false（尚未从 localStorage 恢复当前对话）时，_commit 只更新内存、不落盘，
 *     避免挂载早期用空数据覆盖已有记录。
 *   - applyConversation（恢复/切换）成功后 hydrated=true，此后所有变更自动落盘。
 *
 * 【存储】
 *   conversations 存 localStorage（storageAdapter）。纯逻辑、无 React 依赖。
 *
 * 【对外 API 保持不变】（useAgentChat / AgentPanel / useCanvasAgentTools 依赖）
 * ════════════════════════════════════════════════════════════════
 */
import { useSyncExternalStore } from 'react'
import { sGet, sSet } from './storageAdapter.js'

const CONVERSATIONS_KEY = 'agent_conversations'
const ACTIVE_KEY = 'agent_active_conversation_id'
/** 每对话消息上限（对齐大雄 AGENT_MSG_MAX = 60，防无限膨胀） */
const AGENT_MSG_MAX = 60

/** 空对话记忆（对齐大雄 agentEmptyConversationMemory） */
function emptyMemory() {
  return { summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] }
}

/** 单一数据源 */
let state = loadState()
/** 是否已恢复过当前对话（applyConversation 置 true；未恢复前禁止落盘，防挂载覆盖） */
let hydrated = false

/** 订阅者 */
const listeners = new Set()

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot() {
  return state
}

/** useConversationStore()：订阅画布会话状态（对齐 taskStore 的 useTasks 用法） */
export function useConversationStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 从 localStorage 加载初始 state */
function loadState() {
  let conversations = []
  try {
    const raw = sGet(CONVERSATIONS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    conversations = (Array.isArray(arr) ? arr : []).map(normalizeConversation).filter(Boolean)
  } catch {
    conversations = []
  }
  let activeId = ''
  try {
    const id = sGet(ACTIVE_KEY)
    activeId = typeof id === 'string' && id ? id : ''
  } catch {
    activeId = ''
  }
  return { conversations, activeId }
}

/** 统一提交：生成新 state + 通知 + 落盘（hydrated 后才写 localStorage，防挂载覆盖） */
function commit(next) {
  state = next
  listeners.forEach((l) => l())
  if (hydrated) {
    try {
      sSet(CONVERSATIONS_KEY, JSON.stringify(state.conversations.map(normalizeConversation)))
      sSet(ACTIVE_KEY, state.activeId || '')
    } catch {
      /* 忽略写失败 */
    }
  }
}

/** 生成唯一 id（对齐大雄 uid('ac')） */
function uid(prefix) {
  return `${prefix || 'ac'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 保证一个对话的结构完整（数组字段缺省补齐、workflow/pending/memory 归一） */
export function normalizeConversation(c) {
  if (!c || typeof c !== 'object') return null
  if (!Array.isArray(c.messages)) c.messages = []
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
  return c
}

/** 归一 workflow：保证结构完整（对齐大雄 conv.workflow） */
export function normalizeWorkflow(w) {
  if (!w || typeof w !== 'object') return null
  if (!w.id) w.id = `awf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
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
  }
}

/** 读当前对话 id */
export function getActiveConversationId() {
  return state.activeId || ''
}

/** 全量对话列表（浅拷贝，供 UI 渲染对话列表用） */
export function getConversations() {
  return state.conversations.map((c) => ({
    ...c,
    messages: [...c.messages],
    skills: [...c.skills],
    attachments: [...c.attachments],
    workflow: normalizeWorkflow(c.workflow),
    pending: normalizePending(c.pending),
    memory: normalizeMemory(c.memory),
  }))
}

/** 读当前对话对象（内部；无则 null） */
function getActiveConv() {
  return state.conversations.find((c) => c.id === state.activeId) || null
}

/** 读当前对话的快照副本（对外） */
export function getCurrentSnapshot() {
  const conv = getActiveConv()
  return {
    messages: conv ? [...conv.messages] : [],
    skills: conv ? [...conv.skills] : [],
    attachments: conv ? [...conv.attachments] : [],
    draft: conv?.draft || '',
    workflow: conv?.workflow ? { ...conv.workflow, steerQueue: [...(conv.workflow.steerQueue || [])] } : null,
    pending: conv?.pending ? { ...conv.pending, attachments: [...(conv.pending.attachments || [])] } : null,
    memory: conv?.memory ? normalizeMemory(conv.memory) : emptyMemory(),
  }
}

/**
 * 同步当前对话的内存态（只覆盖传入字段，其余保留）。
 * 重构后这是唯一写入口之一：更新 active 对话并自动落盘。
 */
export function setCurrentSnapshot(snap) {
  const conv = getActiveConv()
  if (!conv) return
  const next = {
    ...conv,
    messages: Array.isArray(snap?.messages) ? snap.messages.slice(-AGENT_MSG_MAX) : conv.messages,
    skills: Array.isArray(snap?.skills) ? snap.skills.map((s) => ({ ...s })) : conv.skills,
    attachments: Array.isArray(snap?.attachments) ? snap.attachments.map((a) => ({ ...a })) : conv.attachments,
    draft: typeof snap?.draft === 'string' ? snap.draft : conv.draft,
    workflow: snap?.workflow ? normalizeWorkflow(snap.workflow) : conv.workflow,
    pending: snap?.pending !== undefined ? normalizePending(snap.pending) : conv.pending,
    memory: snap?.memory ? normalizeMemory(snap.memory) : conv.memory,
    updatedAt: Date.now(),
  }
  commit({
    ...state,
    conversations: state.conversations.map((c) => (c.id === conv.id ? next : c)),
  })
}

/** 读当前对话的 workflow（副本；无则 null） */
export function getCurrentWorkflow() {
  return getActiveConv()?.workflow ? { ...getActiveConv().workflow, steerQueue: [...(getActiveConv().workflow.steerQueue || [])] } : null
}

/** 原地补丁当前对话的 workflow（运行时状态；更新后落盘） */
export function patchCurrentWorkflow(patch = {}) {
  const conv = getActiveConv()
  if (!conv) return null
  const wf = conv.workflow ? { ...conv.workflow } : { status: 'planning', nodeIds: [], steerQueue: [] }
  const nextWf = normalizeWorkflow({ ...wf, ...patch, steerQueue: Array.isArray(patch?.steerQueue) ? patch.steerQueue : (wf.steerQueue || []) })
  commit({
    ...state,
    conversations: state.conversations.map((c) => (c.id === conv.id ? { ...c, workflow: nextWf, updatedAt: Date.now() } : c)),
  })
  return nextWf
}

/** 读当前对话的 pending（副本；无则 null） */
export function getCurrentPending() {
  const p = getActiveConv()?.pending
  return p ? { ...p, attachments: [...(p.attachments || [])] } : null
}

/** 设置/清除当前对话的 pending（刷新后据此恢复任务） */
export function setCurrentPending(p) {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...state,
    conversations: state.conversations.map((c) => (c.id === conv.id ? { ...c, pending: normalizePending(p), updatedAt: Date.now() } : c)),
  })
}

/** 读当前对话的 memory（副本；无则空记忆） */
export function getCurrentMemory() {
  return getActiveConv()?.memory ? normalizeMemory(getActiveConv().memory) : emptyMemory()
}

/** 更新当前对话的 memory（提炼 lastPlan 等） */
export function setCurrentMemory(m) {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...state,
    conversations: state.conversations.map((c) => (c.id === conv.id ? { ...c, memory: normalizeMemory(m), updatedAt: Date.now() } : c)),
  })
}

/* ── 工作流运行时状态（per-conversation，Step D；替代模块级 aiUndoStack/pendingGenerations）── */

/** 读当前对话的 AI 撤销栈（副本） */
export function getActiveAiUndoStack() {
  return [...(getActiveConv()?.aiUndoStack || [])]
}

/** 压入 AI 撤销快照（上限 20） */
export function pushActiveAiUndo(snapshot) {
  const conv = getActiveConv()
  if (!conv) return
  const stack = [...(conv.aiUndoStack || []), snapshot]
  if (stack.length > 20) stack.shift()
  commit({
    ...state,
    conversations: state.conversations.map((c) => (c.id === conv.id ? { ...c, aiUndoStack: stack, updatedAt: Date.now() } : c)),
  })
}

/** 弹出最近 AI 撤销快照 */
export function popActiveAiUndo() {
  const conv = getActiveConv()
  if (!conv || !(conv.aiUndoStack || []).length) return null
  const stack = [...conv.aiUndoStack]
  const popped = stack.pop()
  commit({
    ...state,
    conversations: state.conversations.map((c) => (c.id === conv.id ? { ...c, aiUndoStack: stack, updatedAt: Date.now() } : c)),
  })
  return popped
}

/** 读当前对话的 Skill 阶段1 策划暂存（副本） */
export function getActivePendingGenerations() {
  return getActiveConv()?.pendingGenerations || null
}

/** 设置/清除当前对话的 Skill 策划暂存 */
export function setActivePendingGenerations(gens) {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...state,
    conversations: state.conversations.map((c) => (c.id === conv.id ? { ...c, pendingGenerations: Array.isArray(gens) && gens.length ? gens : null, updatedAt: Date.now() } : c)),
  })
}

/** 读当前对话的 Skill 确认态 */
export function getAwaitingConfirm() {
  return !!getActiveConv()?.awaitingConfirm
}

/** 设置当前对话的 Skill 确认态（仅前端确认按钮翻转） */
export function setAwaitingConfirm(v) {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...state,
    conversations: state.conversations.map((c) => (c.id === conv.id ? { ...c, awaitingConfirm: !!v, updatedAt: Date.now() } : c)),
  })
}

/** 确保至少有一个对话；没有则建一个空的，并设为当前。返回当前对话 id */
export function ensureActiveConversation() {
  let { conversations, activeId } = state
  if (activeId && conversations.some((c) => c.id === activeId)) return activeId
  if (conversations.length > 0) {
    commit({ ...state, activeId: conversations[0].id })
    return conversations[0].id
  }
  const conv = normalizeConversation({ id: uid('ac'), title: '对话', messages: [], skills: [], draft: '' })
  commit({ conversations: [conv], activeId: conv.id })
  return conv.id
}

/**
 * 把当前对话写回 conversations（对外兼容；重构后 setCurrentSnapshot 已自动落盘，此函数基本不再需要）。
 * 保留兼容，但不做挂载期覆盖（内部由 commit 的 hydrated 守卫兜底）。
 */
export function captureActiveConversation() {
  // 无额外动作：setCurrentSnapshot 已把 active 对话写回并落盘。
  // 保留导出仅兼容旧调用方；若 activeId 无效则返回 null。
  if (!getActiveConv()) return null
  return getActiveConv()
}

/** 把某对话加载进当前（恢复/切换），hydrated 置 true，返回快照 */
export function applyConversation(id) {
  let conv = state.conversations.find((c) => c.id === id)
  // 目标不存在 → 回退当前；当前也没有 → 建空对话兜底
  if (!conv) {
    const active = state.conversations.find((c) => c.id === state.activeId)
    conv = active || null
  }
  if (!conv) {
    conv = normalizeConversation({ id: uid('ac'), title: '对话', messages: [], skills: [], draft: '' })
    commit({ conversations: [conv], activeId: conv.id })
  }
  hydrated = true // 已从存储恢复，此后允许落盘
  commit({ ...state, activeId: conv.id })
  return getCurrentSnapshot()
}

/** 新建对话：把当前对话先落盘，再建空对话并设为当前，返回新对话 id 与快照 */
export function newConversation() {
  const conv = normalizeConversation({ id: uid('ac'), title: '新对话', messages: [], skills: [], draft: '' })
  commit({ conversations: [conv, ...state.conversations], activeId: conv.id })
  return { id: conv.id, snapshot: getCurrentSnapshot() }
}

/** 切换对话：apply 目标，返回目标快照 */
export function switchConversation(id) {
  if (!id || id === state.activeId) return getCurrentSnapshot()
  return applyConversation(id)
}

/** 删除对话：删空则建新对话。返回 { activeId, snapshot } */
export function deleteConversation(id) {
  const remaining = state.conversations.filter((c) => c.id !== id)
  if (remaining.length > 0) {
    commit({ conversations: remaining, activeId: remaining[0].id })
    return { activeId: remaining[0].id, snapshot: getCurrentSnapshot() }
  }
  const conv = normalizeConversation({ id: uid('ac'), title: '新对话', messages: [], skills: [], draft: '' })
  commit({ conversations: [conv], activeId: conv.id })
  return { activeId: conv.id, snapshot: getCurrentSnapshot() }
}

/** 重命名当前对话标题（UI 可选） */
export function renameActiveConversation(title) {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...state,
    conversations: state.conversations.map((c) =>
      c.id === conv.id ? { ...c, title: (String(title || '').slice(0, 30) || c.title), updatedAt: Date.now() } : c
    ),
  })
}

/** 从旧单会话数据迁移：conversations 为空且有旧 messages/skills 时，迁成一个对话 */
export function importLegacy({ messages, skills }) {
  if (!Array.isArray(messages) || messages.length === 0) return null
  if (state.conversations.length > 0) return null // 已有对话，不迁移
  const firstUser = messages.find((m) => m.role === 'user' && m.content)
  const conv = normalizeConversation({
    id: uid('ac'),
    title: (firstUser?.content ? String(firstUser.content).slice(0, 30) : '对话'),
    messages: messages.slice(-AGENT_MSG_MAX),
    skills: Array.isArray(skills) ? skills.map((s) => ({ ...s })) : [],
    attachments: [],
    draft: '',
    workflow: null,
    pending: null,
    memory: emptyMemory(),
  })
  hydrated = true
  commit({ conversations: [conv], activeId: conv.id })
  return getCurrentSnapshot()
}

/** 重置 store 内存缓存（测试/硬重置用） */
export function resetConversationCache() {
  state = { conversations: [], activeId: '' }
  hydrated = false
  listeners.forEach((l) => l())
}
