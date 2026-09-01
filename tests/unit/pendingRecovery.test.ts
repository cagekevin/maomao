// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { resolvePendingRecovery } from '../../src/components/agent/runtime/pendingRecovery.ts'

describe('pendingRecovery.resolvePendingRecovery（刷新恢复解析器）', () => {
  it('无 pending / 不属于当前对话 → action=none（不碰别人的任务）', () => {
    expect(resolvePendingRecovery({ pending: null, activeConversationId: 'c1' }).action).toBe('none')
    expect(
      resolvePendingRecovery({ pending: { conversationId: 'c2', messageId: 'm1' }, messages: [], activeConversationId: 'c1' }).action
    ).toBe('none')
  })

  it('按 messageId 找回用户消息正文（P1a 去重：text 不存 pending）', () => {
    const messages = [{ id: 'm1', role: 'user', content: '帮我生成一张猫图', attachments: [] }]
    const r = resolvePendingRecovery({ pending: { conversationId: 'c1', messageId: 'm1' }, messages, activeConversationId: 'c1' })
    expect(r.action).toBe('send')
    expect(r.text).toBe('帮我生成一张猫图')
  })

  it('attachments 优先用 pending 存的【原始输入】（恢复重发经 send 归一化一次，避免二次压缩）', () => {
    const rawAtt = [{ type: 'image', url: '/files/raw.png' }]
    const messages = [{ id: 'm1', role: 'user', content: 'x', attachments: [{ type: 'image', url: 'data:image/png;base64,XXXX' }] }]
    const r = resolvePendingRecovery({ pending: { conversationId: 'c1', messageId: 'm1', attachments: rawAtt }, messages, activeConversationId: 'c1' })
    expect(r.action).toBe('send')
    expect(r.attachments).toBe(rawAtt) // 返回原始引用，而非消息里已归一(base64)那份
  })

  it('旧数据（无 messageId，退 text）迁移期仍可恢复', () => {
    const r = resolvePendingRecovery({ pending: { conversationId: 'c1', text: '旧任务' }, messages: [], activeConversationId: 'c1' })
    expect(r.action).toBe('send')
    expect(r.text).toBe('旧任务')
  })

  it('dangling-safe：messageId 对应消息已被 AGENT_MSG_MAX 裁剪、又无 text → action=drop（不空转重发）', () => {
    const r = resolvePendingRecovery({ pending: { conversationId: 'c1', messageId: 'gone' }, messages: [{ id: 'other' }], activeConversationId: 'c1' })
    expect(r.action).toBe('drop')
  })

  it('仅带附件无正文也可恢复（图反推场景）', () => {
    const r = resolvePendingRecovery({ pending: { conversationId: 'c1', messageId: 'm9', attachments: [{ type: 'image', url: '/files/a.png' }] }, messages: [{ id: 'm9', role: 'user', content: '' }], activeConversationId: 'c1' })
    expect(r.action).toBe('send')
    expect(r.text).toBe('')
    expect(r.attachments.length).toBe(1)
  })
})