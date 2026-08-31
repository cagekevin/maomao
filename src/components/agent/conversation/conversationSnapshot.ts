/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层 —— 当前对话快照读写（D 类：runtime 状态）
 * ════════════════════════════════════════════════════════════════
 *
 * 【拆分契约 · 2026-08-21】从 conversationStore.js 拆出的 D 类职能：
 * "读写当前对话"的快照/workflow/pending/memory。依赖单向指向 conversationState 底座。
 * 下游 conversationImageMap / conversationStore(聚合) 可再依赖本文件。
 * 命名/导出不变，消费方无感知。
 * ════════════════════════════════════════════════════════════════
 */
import {
  getActiveConv, commit, getState, normalizeWorkflow, normalizePending, normalizeMemory,
  emptyMemory, AGENT_MSG_MAX,
} from './conversationState.ts'
// 【P1b L1 静态上限】写入口统一限容：lastResults 去重限条 + memory 限条，防止整包体积无界增长（见 volumePolicy.js）
import { sanitizeMessages, capConversationMemory } from '../../base/volumePolicy.ts'

/**
 * 当前对话快照（对外读形状）。
 * 具体字段类型待 conversationState.ts 转完后收敛为 Conversation 的子集视图；
 * 此处以「结构 + 逐字段可空」为准，不改变运行时行为。
 */
export interface ConversationSnapshot {
  messages: any[]
  skills: any[]
  attachments: any[]
  draft: string
  /** 工作流运行时状态（无则 null，见 workflowState.WorkflowStatus） */
  workflow: any
  /** 刷新恢复用的 pending 引用（无则 null） */
  pending: any
  memory: Record<string, any>
}

/** setCurrentSnapshot 入参：只覆盖传入字段，其余保留 */
export type SnapshotPatch = Partial<ConversationSnapshot> & Record<string, unknown>

/** 读当前对话的快照副本（对外） */
export function getCurrentSnapshot(): ConversationSnapshot {
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
export function setCurrentSnapshot(snap?: SnapshotPatch | null): void {
  const conv = getActiveConv()
  if (!conv) return
  const rawMessages = Array.isArray(snap?.messages) ? snap.messages.slice(-AGENT_MSG_MAX) : conv.messages
  const rawMemory = snap?.memory ? normalizeMemory(snap.memory) : conv.memory
  const next = {
    ...conv,
    // 【P1b L1】写入口统一限容：lastResults 去重限条 + memory 限条
    messages: sanitizeMessages(rawMessages),
    skills: Array.isArray(snap?.skills) ? snap.skills.map((s) => ({ ...s })) : conv.skills,
    attachments: Array.isArray(snap?.attachments) ? snap.attachments.map((a) => ({ ...a })) : conv.attachments,
    draft: typeof snap?.draft === 'string' ? snap.draft : conv.draft,
    workflow: snap?.workflow ? normalizeWorkflow(snap.workflow) : conv.workflow,
    pending: snap?.pending !== undefined ? normalizePending(snap.pending) : conv.pending,
    memory: capConversationMemory(rawMemory),
    updatedAt: Date.now(),
  }
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? next : c)),
  })
}

/**
 * 轻量更新当前对话的消息数组：只更新 messages + 通知订阅者，跳过落盘（persist:false）。
 * 【用途】流式热路径（updateLastStreaming/endStreaming）每 50ms 高频调用，若走 setCurrentSnapshot
 *   （内部 commit → 触发 persistDebounced 落盘调度）会造成高频落盘抖动；此函数不落盘，
 *   最终态由 send 的 finally 统一 captureActiveConversation 落盘。
 * 【同步性】commit 内部同步更新 states 并 notify，因此调用后立即 getState()/getCurrentSnapshot()
 *   读取到的就是最新消息（保证 send finally 同步读到完整 assistant 而非空 streaming 占位）。
 */
export function patchCurrentMessages(messages?: any[] | null): void {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id ? { ...c, messages: Array.isArray(messages) ? messages.slice(-AGENT_MSG_MAX) : c.messages, updatedAt: Date.now() } : c
    ),
  }, { persist: false })
}

/** 读当前对话的 workflow（副本；无则 null） */
export function getCurrentWorkflow(): any {
  return getActiveConv()?.workflow ? { ...getActiveConv().workflow, steerQueue: [...(getActiveConv().workflow.steerQueue || [])] } : null
}

/** 原地补丁当前对话的 workflow（运行时状态；更新后落盘） */
export function patchCurrentWorkflow(patch: Record<string, unknown> = {}): any {
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
export function getCurrentPending(): any {
  const p = getActiveConv()?.pending
  return p ? { ...p, attachments: [...(p.attachments || [])] } : null
}

/** 设置/清除当前对话的 pending（刷新后据此恢复任务） */
export function setCurrentPending(p: unknown): void {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, pending: normalizePending(p), updatedAt: Date.now() } : c)),
  })
}

/** 读当前对话的 memory（副本；无则空记忆） */
export function getCurrentMemory(): Record<string, any> {
  return getActiveConv()?.memory ? normalizeMemory(getActiveConv().memory) : emptyMemory()
}

/** 更新当前对话的 memory（提炼 lastPlan 等；【P1b】facts/artifacts 限容） */
export function setCurrentMemory(m: unknown): void {
  const conv = getActiveConv()
  if (!conv) return
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? { ...c, memory: capConversationMemory(normalizeMemory(m)), updatedAt: Date.now() } : c)),
  })
}