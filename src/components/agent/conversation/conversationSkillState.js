/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层 —— Skill 三阶段状态（docs/25 · 阶段3 编排轴子域化）
 * ════════════════════════════════════════════════════════════════
 *
 * 【拆分契约 · 2026-08-21】从 conversationAiState.js 抽出的 Skill 专属域：
 *  Skill 三阶段门禁的运行时状态：
 *    - 阶段1 策划暂存 pendingGenerations（show_plan_for_confirm 产出，等用户/runMode 决定执行）
 *    - 阶段2 确认态 awaitingConfirm（半自动/Skill 需用户确认才进入阶段3）
 * 全部 per-conversation，只依赖 conversationState 底座（无环）。命名/导出不变，消费方无感知
 * （经 conversationStore 聚合 re-export）。
 * ════════════════════════════════════════════════════════════════
 */
import { getActiveConv, commit, getState } from './conversationState.js'
import { CREDIT_GATE_FIELD } from '../../base/contracts.js'

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

/** 读当前对话的「记」项目记忆建议暂存（memory_suggest 待用户确认的候选内容） */
export function getActivePendingMemorySuggest() {
  return getActiveConv()?.pendingMemorySuggest || null
}

/** 设置/清除当前对话的「记」项目记忆建议暂存 */
export function setActivePendingMemorySuggest(suggest) {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id
      ? { ...c, pendingMemorySuggest: suggest && typeof suggest === 'object' ? suggest : null, updatedAt: Date.now() }
      : c)),
  })
}

/** 读当前对话的积分确认门禁（creditGate：null 或 { pending, gens, map(stepId→nodeId) }） */
export function getCreditGate() {
  return getActiveConv()?.[CREDIT_GATE_FIELD] || null
}

/**
 * 设置/清除当前对话的积分确认门禁（高消耗积分确认）。
 * gate 合法形状：{ pending:boolean, gens:array, map:object(stepId→nodeId) }。
 * 置位（pending=true）+ 清除（null）配对使用：补跑成功清、失败保留待重试。
 */
export function setCreditGate(gate) {
  const conv = getActiveConv()
  if (!conv) return
  const valid = gate && typeof gate === 'object'
    && gate.pending === true
    && Array.isArray(gate.gens)
    && gate.map && typeof gate.map === 'object'
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id
      ? { ...c, [CREDIT_GATE_FIELD]: valid ? gate : null, updatedAt: Date.now() }
      : c)),
  })
}

/** 清除当前对话的积分确认门禁（补跑成功/取消后调用；不保留待确认态） */
export function clearCreditGate() {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id
      ? { ...c, [CREDIT_GATE_FIELD]: null, updatedAt: Date.now() }
      : c)),
  })
}