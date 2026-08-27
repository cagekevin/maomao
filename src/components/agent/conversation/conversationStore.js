/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层 —— 聚合入口 + 核心会话 CRUD（对齐 taskStore/providerStore 范式）
 * ════════════════════════════════════════════════════════════════
 *
 * 【拆分契约 · 2026-08-21】原"上帝文件"(674 行 / 44 导出)按关注点拆成 5 个实现文件 + 本聚合入口：
 *   - conversationState(共享 state/落盘/归一化底座)
 *   - conversationSnapshot(D：当前对话快照 workflow/pending/memory)
 *   - conversationAiState(F：contract/artifact/undo/refImages/runMode)
 *   - conversationSkillState(F·阶段3：Skill 三阶段 pendingGenerations/awaitingConfirm)
 *   - conversationImageMap(E：跨轮图数据源)
 *   - conversationStore(本文件)：保留核心会话 CRUD(A 类) 并作为 re-export 聚合层。
 *
 * 【兼容性】调用方 import 路径与符号名全部不变（App/useAgentChat/useCanvasAgentTools/AgentPanel 零改动）：
 *   - 本文件内部定义的 A 类函数 re-export 自本模块；
 *   - D/E/Skill/F 与底座公开 API 通过 `export { x } from './xxx.js'` 原样 re-export。
 * 依赖方向单向无环：state ← { snapshot, aiState, skillState } ← { imageMap, store }。
 * ════════════════════════════════════════════════════════════════
 */
import {
  getState, commit, uid, getActiveConv, markHydrated,
  normalizeConversation, normalizeWorkflow, normalizePending, normalizeMemory,
  emptyMemory, AGENT_MSG_MAX,
} from './conversationState.js'
import { getCurrentSnapshot } from './conversationSnapshot.js'

/* ── 会话核心 CRUD（A 类：对话增删切换读写）────────────────── */

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
  markHydrated() // 已从存储恢复，此后允许落盘
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
  markHydrated()
  commit({ conversations: [conv], activeId: conv.id })
  return getCurrentSnapshot()
}

/* ── 聚合 re-export（保持原 conversationStore 全公开导出面，消费方零改动）── */

// conversationState：底座公开 API（useConversationStore / setAgentKey / flushPersist /
// resetConversationCache + 归一化 normalizeConversation / normalizeWorkflow / normalizePending / normalizeMemory）
export {
  useConversationStore, setAgentKey, setSending, flushPersist, resetConversationCache,
  normalizeConversation, normalizeWorkflow, normalizePending, normalizeMemory,
} from './conversationState.js'
// conversationSnapshot：当前对话快照（D 类）
export {
  getCurrentSnapshot, setCurrentSnapshot, patchCurrentMessages, getCurrentWorkflow, patchCurrentWorkflow,
  getCurrentPending, setCurrentPending, getCurrentMemory, setCurrentMemory,
} from './conversationSnapshot.js'
// conversationAiState：AI 编排状态（F 类）
export {
  getCurrentRunMode, setCurrentRunMode, getCurrentGlobalContract, setCurrentGlobalContract,
  getCurrentArtifacts, setCurrentArtifacts, getActiveAiUndoStack, pushActiveAiUndo, popActiveAiUndo,
  getCurrentRefImages, setCurrentRefImages,
} from './conversationAiState.js'
// conversationSkillState：Skill 三阶段门禁状态（阶段3 编排轴子域化）
export {
  getActivePendingGenerations, setActivePendingGenerations, getAwaitingConfirm, setAwaitingConfirm,
  getActivePendingMemorySuggest, setActivePendingMemorySuggest,
  getCreditGate, setCreditGate, clearCreditGate,
} from './conversationSkillState.js'
// conversationImageMap：跨轮图数据源（E 类）
export {
  getLastUserReferenceImages, getLastGeneratedImages, getCurrentImageMap,
} from './conversationImageMap.js'