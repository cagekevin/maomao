/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层 —— AI 编排状态（F 类，占原文件近半导出）
 * ════════════════════════════════════════════════════════════════
 *
 * 【拆分契约 · 2026-08-21】从 conversationStore.js 拆出的 F 类职能：
 * 统一风格契约 global_contract / 跨步成果 artifact / AI 撤销栈 /
 * 参考图 refImages / 执行分级 runMode。全部 per-conversation。
 * 【阶段3 · 2026-08-21】Skill 三阶段状态（pendingGenerations/awaitingConfirm）已抽至
 * conversationSkillState.js（编排轴子域化）。本文件不再包含 Skill 门禁状态。
 * 依赖单向指向 conversationState 底座，命名/导出不变，消费方无感知。
 * ════════════════════════════════════════════════════════════════
 */
import { getActiveConv, commit, getState, normalizeMemory } from './conversationState.js'

/** 【对齐大雄 agentGetRunMode】读当前对话执行分级（'step-confirm' | 'auto'），缺省 'step-confirm'（默认分步确认）。 */
export function getCurrentRunMode() {
  const conv = getActiveConv()
  const mode = String(conv?.runMode || 'step-confirm').toLowerCase()
  return mode === 'auto' ? 'auto' : 'step-confirm'
}

/** 【对齐大雄 agentSetRunMode】写当前对话执行分级（step-confirm 分步确认默认 / auto 完全自主）。 */
export function setCurrentRunMode(mode) {
  const conv = getActiveConv()
  if (!conv) return
  // 非 auto（含旧值 'semi'）一律归 'step-confirm'，兼容历史持久化数据
  const next = String(mode || 'step-confirm').toLowerCase() === 'auto' ? 'auto' : 'step-confirm'
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, runMode: next, updatedAt: Date.now() } : c)),
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

/* ── 参考图引用（per-conversation，防跨对话泄漏）── */

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