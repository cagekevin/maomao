/**
 * AI 助手「刷新恢复未完成任务」的纯解析器（从 useAgentChat 的恢复 effect 里抽出，便于单测）。
 *
 * 【数据流】useAgentChat 挂载恢复时，读 pending（引用形态 { conversationId, messageId, [attachments] }）
 * 经本函数解析成「要不要恢复、恢复什么」→ 决定 action。逻辑：
 *   - 不属于当前对话 → action:'none'（不碰别人的任务）。
 *   - 优先按 messageId 找回用户消息正文（P1a 去重：text 不存副本）；缺失回退旧 pending.text（迁移期）。
 *   - attachments 优先用 pending 存的【原始输入】附件（恢复重发走 send 归一化一次，避免二次压缩）；
 *     无则回退消息里的附件。
 *   - 正文与附件都为空 → action:'drop'（dangling-safe：被 AGENT_MSG_MAX 裁剪或崩溃窗口未建成，不空转重发）。
 *
 * @param {object} param
 * @param {object|null} param.pending  pending 引用（undefined/null = 无待恢复）
 * @param {Array}    param.messages     当前对话 messages（用于按 id 找回正文/附件）
 * @param {string}   param.activeConversationId 当前活跃会话 id
 * @returns {{action:'none'|'send'|'drop', text?:string, attachments?:Array}}
 */
/** pending 引用形态（刷新恢复用；text 为迁移期旧字段，正文优先按 messageId 找回） */
export interface PendingRef {
  conversationId?: string
  messageId?: string
  text?: string
  attachments?: unknown[]
  [key: string]: unknown
}

/** 恢复决策：none=不碰 / send=重发 / drop=悬空丢弃 */
export interface PendingRecoveryResult {
  action: 'none' | 'send' | 'drop'
  text?: string
  attachments?: unknown[]
}

export function resolvePendingRecovery(
  { pending, messages = [], activeConversationId }: {
    pending?: PendingRef | null
    messages?: Array<Record<string, unknown>>
    activeConversationId?: string
  }
): PendingRecoveryResult {
  if (!pending || pending.conversationId !== activeConversationId) return { action: 'none' }
  const byId = pending.messageId ? messages.find((m) => m && m.id === pending.messageId) : null
  const text = String(byId?.content || pending.text || '')
  const attachments: unknown[] =
    Array.isArray(pending.attachments) && pending.attachments.length
      ? pending.attachments
      : (Array.isArray(byId?.attachments) ? byId.attachments as unknown[] : [])
  if (!text && (!attachments || attachments.length === 0)) return { action: 'drop' }
  return { action: 'send', text, attachments }
}