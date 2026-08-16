/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层（对齐大雄 canvas-agent 的多对话架构）
 * ════════════════════════════════════════════════════════════════
 *
 * 【解决什么问题】
 * 之前 AI 助手是"单一会话"：历史只存一份，启用的 Skill 是全局的（agent_active_skills），
 * 无法开多个对话、每个对话独立的历史与 Skill。本模块引入多对话（conversation）隔离。
 *
 * 【数据模型 —— 对齐大雄的"完整对话状态对象"】
 *  conversations: [{ id, title, ts, updatedAt, ...对话状态 }]
 *  activeConversationId: 当前对话 id
 *  每个对话独立持有（对齐大雄 conv.*，全部走 capture/apply 切换隔离）：
 *   - messages：    该对话的历史消息
 *   - skills：      该对话启用的 Skill（per-conversation）
 *   - attachments： 该对话的参考图
 *   - draft：       该对话的输入框草稿
 *   - workflow：    该对话的任务状态对象（对齐大雄 conv.workflow）
 *                   { id, status, nodeIds, steerQueue, startedAt, updatedAt }，
 *                   status ∈ planning/creating_nodes/ready/running/stopping/completed/failed。
 *                   用于：判定该对话是否 busy（running/steer）、steer 队列 per-conversation。
 *   - pending：     该对话未完成的 LLM 任务（对齐大雄 conv.pending）
 *                   { conversationId, text, attachments }，
 *                   发送时写入、完成后清除；刷新后据此自动恢复上次操作。
 *   - memory：      该对话提炼的记忆（对齐大雄 conv.memory）
 *                   { summary, facts, lastPlan, lastSharedStyle, notes }，
 *                   从 present_plan/execute_plan 提炼 lastPlan，供多轮上下文。
 *
 * 【"内存镜像"模式（对齐大雄 agentState.messages 只是当前对话镜像）】
 *  本 store 持有一个 `current` 快照（当前对话在内存中的全部状态）。
 *  调用方（useAgentChat / AgentPanel）用 setCurrentSnapshot() 把 React state 同步进来，
 *  切换/新建/删除对话时：
 *   - captureActiveConversation()：把 current 写回 conversations（切换/新建前必调，防串对话）
 *   - applyConversation(id)：       把目标对话加载进 current（切换/新建后）
 *  这样全部对话状态按对话天然隔离，不串台。
 *
 * 【存储】
 *  conversations 存 localStorage（chrome 插件则走 storageAdapter 的 chrome.storage）。
 * 纯逻辑、无 React 依赖，可独立单测。UI 将来重构时本层可原样复用。
 *
 * 【与旧数据的迁移】
 *  旧版是单会话（agent_history_<key> 存 messages + agent_active_skills 全局 skill）。
 *  首次启动若 conversations 为空且有旧数据，可调 importLegacy() 迁移成一个对话。
 * ════════════════════════════════════════════════════════════════
 */
import { sGet, sSet } from './storageAdapter.js'

const CONVERSATIONS_KEY = 'agent_conversations'
const ACTIVE_KEY = 'agent_active_conversation_id'
/** 每对话消息上限（对齐大雄 AGENT_MSG_MAX = 60，防无限膨胀） */
const AGENT_MSG_MAX = 60

/** 空对话记忆（对齐大雄 agentEmptyConversationMemory） */
function emptyMemory() {
  return { summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] }
}

/** 当前对话的内存镜像（由调用方 setCurrentSnapshot 同步；workflow/pending/memory 为运行时状态） */
let current = {
  messages: [], skills: [], attachments: [], draft: '',
  workflow: null, pending: null, memory: emptyMemory(),
}

/** conversations 数组内存缓存（避免每次 get 都读 localStorage） */
let cache = null

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
  return c
}

/** 从存储加载 conversations（内存缓存 + localStorage 兜底） */
function load() {
  if (cache) return cache
  try {
    const raw = sGet(CONVERSATIONS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    cache = (Array.isArray(arr) ? arr : []).map(normalizeConversation).filter(Boolean)
  } catch {
    cache = []
  }
  return cache
}

/** 持久化 conversations（含结构规范化） */
function save() {
  try {
    sSet(CONVERSATIONS_KEY, JSON.stringify((cache || []).map(normalizeConversation)))
  } catch {
    /* 忽略写失败 */
  }
}

/** 读当前对话 id */
export function getActiveConversationId() {
  try {
    const id = sGet(ACTIVE_KEY)
    return typeof id === 'string' && id ? id : ''
  } catch {
    return ''
  }
}

/** 写当前对话 id */
function setActiveConversationId(id) {
  try {
    sSet(ACTIVE_KEY, id || '')
  } catch {
    /* 忽略写失败 */
  }
}

/** 全量对话列表（浅拷贝，供 UI 渲染对话列表用） */
export function getConversations() {
  return load().map((c) => ({
    ...c,
    messages: [...c.messages],
    skills: [...c.skills],
    attachments: [...c.attachments],
    workflow: normalizeWorkflow(c.workflow),
    pending: normalizePending(c.pending),
    memory: normalizeMemory(c.memory),
  }))
}

/** 读当前对话的内存镜像副本 */
export function getCurrentSnapshot() {
  return {
    messages: [...current.messages],
    skills: [...current.skills],
    attachments: [...current.attachments],
    draft: current.draft,
    workflow: current.workflow ? { ...current.workflow, steerQueue: [...(current.workflow.steerQueue || [])] } : null,
    pending: current.pending ? { ...current.pending, attachments: [...(current.pending.attachments || [])] } : null,
    memory: current.memory ? { ...current.memory, facts: [...current.memory.facts], notes: [...current.memory.notes] } : emptyMemory(),
  }
}

/** 同步调用方（React state）的当前对话内存态到本 store（只覆盖传入字段，其余保留） */
export function setCurrentSnapshot(snap) {
  current = {
    messages: Array.isArray(snap?.messages) ? snap.messages : current.messages,
    skills: Array.isArray(snap?.skills) ? snap.skills : current.skills,
    attachments: Array.isArray(snap?.attachments) ? snap.attachments : current.attachments,
    draft: typeof snap?.draft === 'string' ? snap.draft : current.draft,
    workflow: snap?.workflow ? normalizeWorkflow(snap.workflow) : current.workflow,
    pending: snap?.pending !== undefined ? normalizePending(snap.pending) : current.pending,
    memory: snap?.memory ? normalizeMemory(snap.memory) : current.memory,
  }
}

/** 读当前对话的 workflow（未归一化副本；无则 null） */
export function getCurrentWorkflow() {
  return current.workflow ? { ...current.workflow, steerQueue: [...(current.workflow.steerQueue || [])] } : null
}

/** 原地补丁当前对话的 workflow（运行时状态，不落盘；供 execute_plan/useAgentChat 更新 status/steerQueue 等） */
export function patchCurrentWorkflow(patch = {}) {
  const wf = current.workflow ? { ...current.workflow } : { status: 'planning', nodeIds: [], steerQueue: [] }
  const next = { ...wf, ...patch, steerQueue: Array.isArray(patch?.steerQueue) ? patch.steerQueue : (wf.steerQueue || []) }
  current.workflow = normalizeWorkflow(next)
  return current.workflow
}

/** 读当前对话的 pending（副本；无则 null） */
export function getCurrentPending() {
  return current.pending ? { ...current.pending, attachments: [...(current.pending.attachments || [])] } : null
}

/** 设置/清除当前对话的 pending（对齐大雄 conv.pending；刷新后据此恢复任务） */
export function setCurrentPending(p) {
  current.pending = normalizePending(p)
}

/** 读当前对话的 memory（副本；无则空记忆） */
export function getCurrentMemory() {
  return current.memory ? normalizeMemory(current.memory) : emptyMemory()
}

/** 更新当前对话的 memory（对齐大雄 conv.memory；提炼 lastPlan 等） */
export function setCurrentMemory(m) {
  current.memory = normalizeMemory(m)
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

/** 确保至少有一个对话；没有则建一个空的，并设为当前。返回当前对话 id */
export function ensureActiveConversation() {
  const list = load()
  let activeId = getActiveConversationId()
  if (activeId && list.some((c) => c.id === activeId)) return activeId
  // 优先取第一个
  if (list.length > 0) {
    const first = list[0]
    setActiveConversationId(first.id)
    return first.id
  }
  // 完全没有 → 建一个空对话
  const conv = normalizeConversation({ id: uid('ac'), title: '对话', messages: [], skills: [], draft: '' })
  list.unshift(conv)
  setActiveConversationId(conv.id)
  save()
  return conv.id
}

/** 把 current 写回当前对话（切换/新建前必调，防止消息/Skill 串台） */
export function captureActiveConversation() {
  const list = load()
  const activeId = getActiveConversationId()
  const idx = list.findIndex((c) => c.id === activeId)
  const base = idx >= 0 ? list[idx] : normalizeConversation({ id: activeId || uid('ac'), title: '对话' })
  if (idx < 0) list.unshift(base)
  base.messages = current.messages.slice(-AGENT_MSG_MAX)
  base.skills = current.skills.map((s) => ({ ...s }))
  base.attachments = current.attachments.map((a) => ({ ...a }))
  base.draft = current.draft
  base.workflow = current.workflow ? normalizeWorkflow(current.workflow) : null
  base.pending = current.pending ? normalizePending(current.pending) : null
  base.memory = normalizeMemory(current.memory)
  base.updatedAt = Date.now()
  // 标题：首条用户消息前 30 字
  const firstUser = current.messages.find((m) => m.role === 'user' && m.content)
  if (firstUser?.content && (!base.title || base.title === '对话' || base.title === '新对话')) {
    base.title = String(firstUser.content).slice(0, 30)
  }
  save()
  return base
}

/** 把某对话加载进 current（切换/新建后调用），返回快照供调用方 setState */
export function applyConversation(id) {
  const list = load()
  // 目标不存在时回退到当前对话；当前也没有则建一个兜底空对话，保证始终有可用对话
  let conv = list.find((c) => c.id === id)
  if (!conv) {
    const activeId = getActiveConversationId()
    conv = list.find((c) => c.id === activeId) || null
  }
  if (!conv) {
    const list2 = load()
    const blank = normalizeConversation({ id: uid('ac'), title: '对话', messages: [], skills: [], draft: '' })
    list2.unshift(blank)
    cache = list2
    setActiveConversationId(blank.id)
    save()
    conv = blank
  }
  setActiveConversationId(conv.id)
  current = {
    messages: (conv.messages || []).slice(-AGENT_MSG_MAX),
    skills: (conv.skills || []).map((s) => ({ ...s })),
    attachments: (conv.attachments || []).map((a) => ({ ...a })),
    draft: conv.draft || '',
    workflow: normalizeWorkflow(conv.workflow),
    pending: normalizePending(conv.pending),
    memory: normalizeMemory(conv.memory),
  }
  return getCurrentSnapshot()
}

/** 新建对话：先 capture 当前，再建空对话并设为当前，返回新对话 id 与快照 */
export function newConversation() {
  captureActiveConversation()
  const conv = normalizeConversation({ id: uid('ac'), title: '新对话', messages: [], skills: [], draft: '' })
  const list = load()
  list.unshift(conv)
  setActiveConversationId(conv.id)
  save()
  const snap = applyConversation(conv.id)
  return { id: conv.id, snapshot: snap }
}

/** 切换对话：先 capture 当前，再 apply 目标，返回目标快照 */
export function switchConversation(id) {
  if (!id || id === getActiveConversationId()) return getCurrentSnapshot()
  captureActiveConversation()
  return applyConversation(id)
}

/** 删除对话：capture 当前后删除；删空则建新对话。返回 { activeId, snapshot } */
export function deleteConversation(id) {
  captureActiveConversation()
  const list = load()
  const remaining = list.filter((c) => c.id !== id)
  cache = remaining
  if (remaining.length > 0) {
    const next = remaining[0]
    setActiveConversationId(next.id)
    const snap = applyConversation(next.id)
    return { activeId: next.id, snapshot: snap }
  }
  // 全删空 → 建一个空对话
  const conv = normalizeConversation({ id: uid('ac'), title: '新对话', messages: [], skills: [], draft: '' })
  cache = [conv]
  setActiveConversationId(conv.id)
  save()
  const snap = applyConversation(conv.id)
  return { activeId: conv.id, snapshot: snap }
}

/** 重命名当前对话标题（UI 可选） */
export function renameActiveConversation(title) {
  captureActiveConversation()
  const list = load()
  const idx = list.findIndex((c) => c.id === getActiveConversationId())
  if (idx >= 0) {
    list[idx].title = String(title || '').slice(0, 30) || list[idx].title
    save()
  }
}

/** 从旧单会话数据迁移：conversations 为空且有旧 messages/skills 时，迁成一个对话 */
export function importLegacy({ messages, skills }) {
  if (!Array.isArray(messages) || messages.length === 0) return null
  const list = load()
  if (list.length > 0) return null // 已有对话，不迁移
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
  cache = [conv]
  setActiveConversationId(conv.id)
  save()
  return applyConversation(conv.id)
}

/** 重置 store 内存缓存（测试/硬重置用） */
export function resetConversationCache() {
  cache = null
  current = { messages: [], skills: [], attachments: [], draft: '', workflow: null, pending: null, memory: emptyMemory() }
}
