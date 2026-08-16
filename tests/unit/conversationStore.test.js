import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetConversationCache, ensureActiveConversation, newConversation, switchConversation,
  deleteConversation, applyConversation, importLegacy, getCurrentSnapshot, setCurrentSnapshot,
  getCurrentMemory, setCurrentMemory, patchCurrentWorkflow, getCurrentWorkflow,
  setCurrentPending, getCurrentPending, getActiveAiUndoStack, pushActiveAiUndo, popActiveAiUndo,
  normalizeConversation,
} from '../../src/components/base/conversationStore.js'

beforeEach(() => {
  localStorage.clear()
  resetConversationCache()
})

describe('会话隔离数据层 §2.15', () => {
  it('ensureActiveConversation 在没有对话时建空对话并设为当前', () => {
    const id = ensureActiveConversation()
    expect(id).toBeTruthy()
    // 激活 hydrated 才能落盘
    applyConversation(id)
    expect(getCurrentSnapshot().messages).toEqual([])
  })

  it('newConversation 新建并把当前切换过去', () => {
    const id1 = ensureActiveConversation()
    applyConversation(id1)
    const { id: id2 } = newConversation()
    expect(id2).not.toBe(id1)
    expect(getCurrentSnapshot().messages).toEqual([])
  })

  it('switchConversation 切换对话且状态隔离', () => {
    const id1 = ensureActiveConversation()
    applyConversation(id1)
    setCurrentSnapshot({ messages: [{ role: 'user', content: 'AAA' }] })
    const { id: id2 } = newConversation()
    applyConversation(id2)
    expect(getCurrentSnapshot().messages).toEqual([])
    switchConversation(id1)
    expect(getCurrentSnapshot().messages).toHaveLength(1)
    expect(getCurrentSnapshot().messages[0].content).toBe('AAA')
  })

  it('deleteConversation 删除并保留至少 1 个（删空则新建）', () => {
    const id1 = ensureActiveConversation()
    applyConversation(id1)
    const { id: id2 } = newConversation()
    deleteConversation(id2)
    // 只剩 id1
    deleteConversation(id1)
    // 删空后自动新建一个
    expect(getCurrentSnapshot()).toBeTruthy()
  })

  it('importLegacy 旧单会话迁移（幂等：已有对话不迁移）', () => {
    const s = importLegacy({ messages: [{ role: 'user', content: '历史消息' }], skills: [] })
    expect(s).toBeTruthy()
    expect(getCurrentSnapshot().messages[0].content).toBe('历史消息')
    // 再次 import 应返回 null（已有对话）
    expect(importLegacy({ messages: [{ role: 'user', content: 'X' }] })).toBeNull()
  })

  it('AGENT_MSG_MAX=60 上限截断（保留最近 60 条）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    const many = Array.from({ length: 100 }, (_, i) => ({ role: 'user', content: `m${i}` }))
    setCurrentSnapshot({ messages: many })
    expect(getCurrentSnapshot().messages).toHaveLength(60)
    expect(getCurrentSnapshot().messages.at(-1).content).toBe('m99')
  })

  it('memory 读写：setCurrentMemory / getCurrentMemory', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentMemory({ summary: '测试摘要', lastPlan: { id: 'p1' }, lastSharedStyle: '皮克斯' })
    const m = getCurrentMemory()
    expect(m.summary).toBe('测试摘要')
    expect(m.lastSharedStyle).toBe('皮克斯')
    expect(m.facts).toEqual([])
  })

  it('patchCurrentWorkflow 补丁 workflow（归一 status/steerQueue）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    const wf = patchCurrentWorkflow({ status: 'running', nodeIds: ['n1'] })
    expect(wf.status).toBe('running')
    expect(wf.steerQueue).toEqual([])
    const cur = getCurrentWorkflow()
    expect(cur.nodeIds).toEqual(['n1'])
  })

  it('pending 暂存恢复：setCurrentPending / getCurrentPending', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentPending({ conversationId: id, text: '待恢复任务', attachments: [] })
    const p = getCurrentPending()
    expect(p.text).toBe('待恢复任务')
  })

  it('AI 撤销栈：push/pop，上限 20', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    for (let i = 0; i < 25; i++) pushActiveAiUndo({ i })
    const stack = getActiveAiUndoStack()
    expect(stack).toHaveLength(20)
    expect(stack.at(-1).i).toBe(24)
    const popped = popActiveAiUndo()
    expect(popped.i).toBe(24)
    expect(getActiveAiUndoStack()).toHaveLength(19)
  })

  it('normalizeConversation 补齐全字段', () => {
    const c = normalizeConversation({ title: 'X' })
    expect(c.id).toBeTruthy()
    expect(c.messages).toEqual([])
    expect(c.memory.summary).toBe('')
    expect(c.aiUndoStack).toEqual([])
    expect(c.workflow).toBeNull()
  })

  it('hydrated 守卫：未 apply 前 setCurrentSnapshot 不落盘（内存可改，但不写 localStorage）', () => {
    const id = ensureActiveConversation()
    // 未 apply（hydrated=false）：内存可写入，但不落盘
    setCurrentSnapshot({ messages: [{ role: 'user', content: '临时' }] })
    expect(getCurrentSnapshot().messages).toHaveLength(1) // 内存已更新
    const persisted = localStorage.getItem('yimao:agent_conversations')
    expect(persisted).toBeNull() // 关键：未 hydrated 前不落盘，防挂载覆盖
    applyConversation(id)
    setCurrentSnapshot({ messages: [{ role: 'user', content: '正式' }] })
    const persisted2 = localStorage.getItem('yimao:agent_conversations')
    expect(persisted2).toBeTruthy() // 已 hydrated，落盘
    expect(getCurrentSnapshot().messages).toHaveLength(1)
  })
})
