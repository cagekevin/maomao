import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as contentStore from '../../src/components/base/contentStore.js'
const { contentClearCache } = contentStore
import { subscribe, getState } from '../../src/components/agent/conversation/conversationState.js'
import {
  resetConversationCache, ensureActiveConversation, applyConversation, setAgentKey,
  flushPersist, getCurrentSnapshot, setCurrentSnapshot, patchCurrentMessages,
} from '../../src/components/agent/conversation/conversationStore.js'

beforeEach(() => {
  localStorage.clear()
  contentClearCache()
  resetConversationCache()
})

/**
 * 阶段1A（docs/25）新增测试安全网：
 * 覆盖 message 单源化的底层基座 —— commit 的 persist 语义（patch 轻量不落盘 vs setCurrentSnapshot 落盘）、
 * patchCurrentMessages 的「同步读」不变量、subscribe 按字段订阅入口。
 */

describe('conversationState 订阅与提交（消息单源底座）', () => {
  it('getState/subscribe 是可用入口（可订阅并收到通知）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    expect(getState().activeId).toBe(id)
    let notified = 0
    const unsub = subscribe(() => { notified++ })
    patchCurrentMessages([{ role: 'user', content: 'X' }])
    expect(notified).toBeGreaterThan(0)
    unsub()
    const before = notified
    patchCurrentMessages([{ role: 'user', content: 'Y' }])
    expect(notified).toBe(before) // 退订后不再通知
  })

  it('patchCurrentMessages 更新消息且同步可读（50ms 热路径的不变量）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    patchCurrentMessages([{ role: 'user', content: 'first' }])
    // 核心不变量：patch 后立即 getCurrentSnapshot() 读到最新消息（send finally 落盘依赖此同步链）
    expect(getCurrentSnapshot().messages).toHaveLength(1)
    expect(getCurrentSnapshot().messages[0].content).toBe('first')
    // 追加一条再读
    const cur = getCurrentSnapshot().messages
    patchCurrentMessages([...cur, { role: 'assistant', content: 'second' }])
    expect(getCurrentSnapshot().messages).toHaveLength(2)
    expect(getCurrentSnapshot().messages[1].content).toBe('second')
  })

  it('patchCurrentMessages 是轻量通知路径：不发起落盘调度（contentSet 不被同步触发）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    const spy = vi.spyOn(contentStore, 'contentSet')
    patchCurrentMessages([{ role: 'user', content: 'IN_FLIGHT' }])
    // patch 走 persist:false，不触发 persistDebounced.schedule → 不同步写存储；
    // 落盘只由 send finally（最终态）统一发起。这是流式热路径不卡主线程的关键。
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('setCurrentSnapshot 落盘（对比基准：仅最终写入会持久化）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentSnapshot({ messages: [{ role: 'user', content: 'PERSISTED' }] })
    flushPersist()
    contentClearCache()
    resetConversationCache()
    setAgentKey('canvas-assistant')
    expect(getCurrentSnapshot().messages).toHaveLength(1)
    expect(getCurrentSnapshot().messages[0].content).toBe('PERSISTED')
  })

  it('patchCurrentMessages 同样受 AGENT_MSG_MAX=60 上限截断（保留最近 60 条）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    const many = Array.from({ length: 100 }, (_, i) => ({ role: 'user', content: `m${i}` }))
    patchCurrentMessages(many)
    expect(getCurrentSnapshot().messages).toHaveLength(60)
    expect(getCurrentSnapshot().messages.at(-1).content).toBe('m99')
  })
})