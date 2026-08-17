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
 * 【单一数据源 → 按 agentKey 隔离（本项目=按项目隔离）】
 *   states = { [agentKey]: { conversations: [], activeId } }  模块级 Map，按 agentKey 从
 *   localStorage 各自加载。所有变更统一走 _commit(nextState)：更新当前 agentKey 的 state
 *   + notify 订阅者 + 自动写 localStorage（键带 agentKey 后缀，天然按项目分开）。
 *   - 项目切换/新建时，调用方（App）通过 setAgentKey('canvas-assistant-<projectId>') 切换，
 *     使 AI 会话跟随项目走，project 作为最顶层；新建项目即新 agentKey → 会话全新。
 *
 * 【写盘时机】
 *   - hydratedSet[agentKey]=false（尚未从 localStorage 恢复当前对话）时，_commit 只更新内存、
 *     不落盘，避免挂载早期用空数据覆盖已有记录。
 *   - applyConversation（恢复/切换）成功后置 true，此后所有变更自动落盘。
 *
 * 【存储】
 *   conversations 存 localStorage（storageAdapter），键 agent_conversations_<agentKey> /
 *   agent_active_conversation_id_<agentKey>。纯逻辑、无 React 依赖。
 *
 * 【对外 API 保持不变】（useAgentChat / AgentPanel / useCanvasAgentTools 依赖；新增 setAgentKey）
 * ════════════════════════════════════════════════════════════════
 */
import { useSyncExternalStore } from 'react'
import { contentGet, contentSet } from './contentStore.js'

/**
 * 存储键按 agentKey 隔离（每项目一个 agentKey → 每项目一套会话）。
 * 键形如 agent_conversations_canvas-assistant-<projectId>，天然按项目分开。
 */
const convKey = (k) => `agent_conversations_${k}`
const activeKey = (k) => `agent_active_conversation_id_${k}`
/** 每对话消息上限（对齐大雄 AGENT_MSG_MAX = 60，防无限膨胀） */
const AGENT_MSG_MAX = 60

/** 空对话记忆（对齐大雄 agentEmptyConversationMemory） */
function emptyMemory() {
  return {
    summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [],
    global_contract: null, // 统一风格契约 {visual_positioning, unified_style_prompt, unified_negative_prompt}（对齐大雄 global_contract）
    artifacts: null,       // 跨步成果资产 [{id,type,title,description,nodeId?,url?}]（对齐大雄 plan.artifacts）
  }
}

/**
 * 单一数据源改为「按 agentKey 隔离」：每个 agentKey（本项目=每项目）一份 { conversations, activeId }。
 * 这样 AI 会话跟随项目走，项目作为最顶层，互不串话。
 */
const states = {}           // { [agentKey]: { conversations, activeId } }
const hydratedSet = {}      // { [agentKey]: boolean } 该 key 是否已恢复过当前对话
let currentAgentKey = 'canvas-assistant'  // 当前生效的 agentKey（由 setAgentKey 设置）

/** 订阅者 */
const listeners = new Set()

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
function getSnapshot() {
  return states[currentAgentKey] || { conversations: [], activeId: '' }
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
  states[k] = { conversations, activeId }
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

/** 读取当前 agentKey 的 state（确保已初始化） */
function getState() {
  if (!states[currentAgentKey]) initState(currentAgentKey)
  return states[currentAgentKey]
}

/** 统一提交：更新当前 agentKey 的 state + 通知 + 落盘（hydrated 后才写 localStorage，防挂载覆盖） */
function commit(next) {
  states[currentAgentKey] = next
  listeners.forEach((l) => l())
  if (hydratedSet[currentAgentKey]) {
    try {
      contentSet(convKey(currentAgentKey), next.conversations.map(normalizeConversation))
      contentSet(activeKey(currentAgentKey), next.activeId || '')
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
  if (!Array.isArray(c.referenceImages)) c.referenceImages = [] // 本轮用户引用的参考图 URL（per-conversation，防跨对话泄漏）
  // 【对齐大雄 runMode】执行分级：'auto'（默认，直接出 generations 执行，不展示 plan 门禁）/
  // 'semi'（半自动，出 generations 后展示 plan 确认再执行）。大雄 agentNormalizeRunModeState(1468)。
  if (String(c.runMode || 'auto').toLowerCase() !== 'semi') c.runMode = 'auto'
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

/** 读当前对话 id */
export function getActiveConversationId() {
  return getState().activeId || ''
}

/** 全量对话列表（浅拷贝，供 UI 渲染对话列表用） */
export function getConversations() {
  return getState().conversations.map((c) => ({
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
  return getState().conversations.find((c) => c.id === getState().activeId) || null
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

/* ════════════════════════════════════════════════════════════════════
 * 跨轮图数据源（对齐大雄执行层的「跨轮图记忆」机制）
 * ────────────────────────────────────────────────────────────────────
 * 【完整逻辑】fresh-task 下历史图/上一轮生成图一律不进 LLM 上下文，跨轮用图（"改上一张图"）靠执行层
 *   从当前对话历史里反查原图。本模块三个函数就是执行层反查的「数据源」：
 *   - getLastUserReferenceImages：本轮无图时，回退用「最近一条带图 user 消息」的图（对齐 agentLastUserAttachments）。
 *   - getLastGeneratedImages：取「最近一次 execute_plan 生成的结果图」（对齐 agentLastResults）。
 *       数据来自 useAgentChat 在 execute_plan 成功后回填到 assistant 消息的 lastResults。
 *   - getCurrentImageMap：把「上一轮生成图(图1~M) + 本轮附件(图M+1~N)」统一编号，供 execute_plan
 *       把 prompt 里的「图N」翻译成参考图、按 direct_refs 反查原图（对齐 agentCurrentImageMap）。
 *
 * 【与参考项目大雄的差距对照（差距③执行层）】大雄在 executeAgentGenerations 时：
 *   - agentLastResults()（4250 行）取最近生成结果图；
 *   - agentLastUserAttachments()（4258 行）本轮无图回退上一轮用户图；
 *   - agentCurrentImageMap()（4265 行）统一编号「图1~图M+N」。
 *   我们对齐前：execute_plan 只认本轮 refPool（getCurrentReferenceImages），跨轮无图就找不到图。
 *   对齐后：本模块提供上述三数据源，execute_plan 支持跨轮回退 + direct_refs/「图N」解析。
 */
/** 向前找当前对话里最近一条带图 user 消息，返回其参考图 url 数组（对齐大雄 agentLastUserAttachments）。 */
export function getLastUserReferenceImages() {
  const conv = getActiveConv()
  const msgs = conv?.messages || []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const imgs = Array.isArray(m.attachments) ? m.attachments.filter((a) => a && a.url) : []
    if (imgs.length > 0) return imgs.map((a) => a.url).filter(Boolean)
  }
  return []
}

/** 【对齐大雄 agentLastResults】向前找当前对话里最近一条带生成结果图的 assistant 消息，返回其结果图数组。
 *  结果图来自 execute_plan 成功回填到 assistant 消息的 lastResults（useAgentChat.runToolCalls 回填）。
 *  ⚠️ 消费方：只有 getCurrentImageMap() 用它做「图1~图M」编号供 direct_refs 引用，execute_plan **不直接
 *  调用它自动挂历史生成图**——对齐大雄 use_last_outputs=false「跨轮 lastResults 彻底关闭」，只有 LLM
 *  用 direct_refs 显式引用历史图时才用。图本体不进 LLM 上下文，执行层反查原图 url。 */
export function getLastGeneratedImages() {
  const conv = getActiveConv()
  const msgs = conv?.messages || []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m?.role !== 'assistant') continue
    const lr = Array.isArray(m.lastResults) ? m.lastResults.filter((r) => r && r.url) : []
    if (lr.length > 0) return lr
  }
  return []
}

/** 【对齐大雄 agentCurrentImageMap】统一编号映射：上一轮生成图(图1~图M) + 当前附件(图M+1~图M+N)。
 *  返回 [{ num, url, name, source:'gen'|'att' }]。**两个消费方**（改前必读）：
 *   ① 执行层：execute_plan（useCanvasAgentTools.js）用它把 direct_refs 的 url 反查成「图N」，翻译 prompt 里的「图N」；
 *   ② 发送层：useAgentChat.send 把它传给 buildRequestMessages 的 imageCatalog，注入 LLM（「当前可引用的图」），
 *      让 LLM 在 generations 里能用「图N」+ direct_refs 精确引用历史图/上一轮生成图（图本体不进 LLM 上下文）。
 *  数据源：上一轮生成图来自 getLastGeneratedImages()（assistant 消息的 lastResults，由 useAgentChat 在
 *  execute_plan 成功后回填）；当前附件来自 getCurrentSnapshot().attachments。 */
export function getCurrentImageMap() {
  const genResults = getLastGeneratedImages()
  const attachments = getCurrentSnapshot().attachments || []
  const map = []
  genResults.forEach((r, i) => map.push({ num: i + 1, url: r.url, name: r.name || `图${i + 1}`, source: 'gen' }))
  const offset = genResults.length
  attachments.filter((a) => a && a.url).forEach((a, i) => map.push({ num: offset + i + 1, url: a.url, name: a.name || a.label || `图${offset + i + 1}`, source: 'att' }))
  return map
}

/** 【对齐大雄 agentGetRunMode】读当前对话执行分级（'auto' | 'semi'），缺省 'auto'。 */
export function getCurrentRunMode() {
  const conv = getActiveConv()
  const mode = String(conv?.runMode || 'auto').toLowerCase()
  return mode === 'semi' ? 'semi' : 'auto'
}

/** 【对齐大雄 agentSetRunMode】写当前对话执行分级（auto 直接执行 / semi 半自动确认）。 */
export function setCurrentRunMode(mode) {
  const conv = getActiveConv()
  if (!conv) return
  const next = String(mode || 'auto').toLowerCase() === 'semi' ? 'semi' : 'auto'
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, runMode: next, updatedAt: Date.now() } : c)),
  })
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
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? next : c)),
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
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, workflow: nextWf, updatedAt: Date.now() } : c)),
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
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, pending: normalizePending(p), updatedAt: Date.now() } : c)),
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
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, memory: normalizeMemory(m), updatedAt: Date.now() } : c)),
  })
}

/* ── 统一风格契约 global_contract + 跨步成果 artifact（对齐大雄，per-conversation）── */

/** 读当前对话的统一风格契约（无则 null） */
export function getCurrentGlobalContract() {
  return getActiveConv()?.memory?.global_contract || null
}

/** 写当前对话的统一风格契约（阶段1 产出，逐字锁定每步） */
export function setCurrentGlobalContract(c) {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...getState(),
    conversations: getState().conversations.map((x) => (x.id === conv.id ? { ...x, memory: normalizeMemory({
      ...x.memory,
      global_contract: c || null,
      // 【对齐大雄 agentCaptureActiveConversation】统一风格契约写入时同步 lastSharedStyle：
      // 大雄从最后 assistant 消息的 shared_style 提炼 memory.lastSharedStyle，续轮 fresh-task 时注入。
      // 我们统一风格走 global_contract，故在此映射，保证 memory.lastSharedStyle 有承载。
      lastSharedStyle: (c && (c.unified_style_prompt || c.visual_positioning)) ? String(c.unified_style_prompt || c.visual_positioning || '').trim() : x.memory.lastSharedStyle,
    }), updatedAt: Date.now() } : x)),
  })
}

/** 读当前对话的跨步成果资产（无则 null） */
export function getCurrentArtifacts() {
  return getActiveConv()?.memory?.artifacts || null
}

/** 写当前对话的跨步成果资产（[{id,type,title,description,nodeId?,url?}]） */
export function setCurrentArtifacts(arr) {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...getState(),
    conversations: getState().conversations.map((x) => (x.id === conv.id ? { ...x, memory: normalizeMemory({ ...x.memory, artifacts: Array.isArray(arr) && arr.length ? arr : null }), updatedAt: Date.now() } : x)),
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
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, aiUndoStack: stack, updatedAt: Date.now() } : c)),
  })
}

/** 弹出最近 AI 撤销快照 */
export function popActiveAiUndo() {
  const conv = getActiveConv()
  if (!conv || !(conv.aiUndoStack || []).length) return null
  const stack = [...conv.aiUndoStack]
  const popped = stack.pop()
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, aiUndoStack: stack, updatedAt: Date.now() } : c)),
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
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, pendingGenerations: Array.isArray(gens) && gens.length ? gens : null, updatedAt: Date.now() } : c)),
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
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, awaitingConfirm: !!v, updatedAt: Date.now() } : c)),
  })
}

/** 读当前对话「本轮用户引用的参考图」URL 数组（per-conversation，TASK-006 #7 防跨对话泄漏） */
export function getCurrentRefImages() {
  return getActiveConv()?.referenceImages || []
}

/** 写当前对话「本轮用户引用的参考图」URL 数组 */
export function setCurrentRefImages(urls = []) {
  const conv = getActiveConv()
  if (!conv) return
  const next = Array.isArray(urls) ? urls.filter(Boolean) : []
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, referenceImages: next, updatedAt: Date.now() } : c)),
  })
}

/** 确保至少有一个对话；没有则建一个空的，并设为当前。返回当前对话 id */
export function ensureActiveConversation() {
  const st = getState()
  let { conversations, activeId } = st
  if (activeId && conversations.some((c) => c.id === activeId)) return activeId
  if (conversations.length > 0) {
    commit({ ...st, activeId: conversations[0].id })
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
  const st = getState()
  let conv = st.conversations.find((c) => c.id === id)
  // 目标不存在 → 回退当前；当前也没有 → 建空对话兜底
  if (!conv) {
    const active = st.conversations.find((c) => c.id === st.activeId)
    conv = active || null
  }
  if (!conv) {
    conv = normalizeConversation({ id: uid('ac'), title: '对话', messages: [], skills: [], draft: '' })
    commit({ conversations: [conv], activeId: conv.id })
  }
  hydratedSet[currentAgentKey] = true // 已从存储恢复，此后允许落盘
  commit({ ...st, activeId: conv.id })
  return getCurrentSnapshot()
}

/** 新建对话：把当前对话先落盘，再建空对话并设为当前，返回新对话 id 与快照 */
export function newConversation() {
  const st = getState()
  const conv = normalizeConversation({ id: uid('ac'), title: '新对话', messages: [], skills: [], draft: '' })
  commit({ conversations: [conv, ...st.conversations], activeId: conv.id })
  return { id: conv.id, snapshot: getCurrentSnapshot() }
}

/** 切换对话：apply 目标，返回目标快照 */
export function switchConversation(id) {
  if (!id || id === getState().activeId) return getCurrentSnapshot()
  return applyConversation(id)
}

/** 删除对话：删空则建新对话。返回 { activeId, snapshot } */
export function deleteConversation(id) {
  const st = getState()
  const remaining = st.conversations.filter((c) => c.id !== id)
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
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id ? { ...c, title: (String(title || '').slice(0, 30) || c.title), updatedAt: Date.now() } : c
    ),
  })
}

/** 从旧单会话数据迁移：conversations 为空且有旧 messages/skills 时，迁成一个对话 */
export function importLegacy({ messages, skills }) {
  if (!Array.isArray(messages) || messages.length === 0) return null
  if (getState().conversations.length > 0) return null // 已有对话，不迁移
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
  hydratedSet[currentAgentKey] = true
  commit({ conversations: [conv], activeId: conv.id })
  return getCurrentSnapshot()
}

/** 重置 store 内存缓存（测试/硬重置用）：清空所有 agentKey 的缓存 */
export function resetConversationCache() {
  for (const k of Object.keys(states)) delete states[k]
  for (const k of Object.keys(hydratedSet)) delete hydratedSet[k]
  listeners.forEach((l) => l())
}
