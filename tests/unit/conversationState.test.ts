// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as contentStore from '../../src/components/base/contentStore.ts'
import { SAFE_BUDGET_BYTES } from '../../src/components/base/volumePolicy.ts'
const { contentClearCache } = contentStore
import { subscribe, getState } from '../../src/components/agent/conversation/conversationState.ts'
import {
  resetConversationCache, ensureActiveConversation, applyConversation, setAgentKey,
  flushPersist, getCurrentSnapshot, setCurrentSnapshot, patchCurrentMessages,
  setCurrentPending, getCurrentPending, makePendingRef,
} from '../../src/components/agent/conversation/conversationStore.ts'

// 会话键已迁 KV（backend:'kv'）：写走 kvSet、读走 kvGet。用 Map 兜底让 KV 确定性往返，
// 避免走真实 localToolApi 网络（响铃 fetch 抛错 + 误导性降级告警 + 慢）。
const kvStore = new Map()
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...(await importOriginal()),
  kvGet: vi.fn(async (key) => (kvStore.has(key) ? kvStore.get(key) : null)),
  kvSet: vi.fn(async (key, value) => { kvStore.set(key, value); return { ok: true } }),
  kvDelete: vi.fn(async (key) => { kvStore.delete(key); return { ok: true } }),
}))

beforeEach(() => {
  localStorage.clear()
  kvStore.clear()
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

    it('setCurrentSnapshot 落盘（对比基准：仅最终写入会持久化）', async () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentSnapshot({ messages: [{ role: 'user', content: 'PERSISTED' }] })
    flushPersist()
    // contentSet 对 KV 是 fire-and-forget 异步写：先等 KV stub 落位，再重置缓存并异步水化重读
    await vi.waitFor(() => expect(kvStore.has('agent_conversations_canvas-assistant')).toBe(true))
    contentClearCache()
    resetConversationCache()
    setAgentKey('canvas-assistant')
    // 会话键已迁 KV，水化为异步：轮询等待水化完成读到 KV 里持久化数据（而非空壳）
    await vi.waitFor(() => expect(getCurrentSnapshot().messages).toHaveLength(1))
    expect(getCurrentSnapshot().messages[0].content).toBe('PERSISTED')
  })

  it('会话落盘失败：persistDebounced 内 contentSet 抛错被 catch-ignore，不阻断调用栈（事件已由 sSet 内部 publish）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    setCurrentSnapshot({ messages: [{ role: 'user', content: 'P' }] })
    const spy = vi.spyOn(contentStore, 'contentSet').mockImplementationOnce(() => { throw new Error('QuotaExceededError') })
    // 落盘失败不抛给调用方（匹配 persistDebounced 的 catch 忽略语义；persist:failed 事件在 sSet 层已发）
    expect(() => flushPersist()).not.toThrow()
    spy.mockRestore()
  })

  it('整包超预算：persistDebounced 用 applyConversationBudget 降级后的投影落盘（内存态不受影响）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    // 构造一个远超 SAFE_BUDGET_BYTES 的整包（仅驻内存，落盘前被降级）
    const hugeContent = 'x'.repeat(SAFE_BUDGET_BYTES + 1024 * 1024)
    setCurrentSnapshot({ messages: [{ role: 'user', content: hugeContent }] })
    const spy = vi.spyOn(contentStore, 'contentSet')
    flushPersist()
    // contentSet 拿到的是【降级后】的投影：正文被截断，序列化字节回到预算内
    const persisted = spy.mock.calls[0][1] // contentSet(key, value) → value 即 toStore 数组
    expect(JSON.stringify(persisted).length).toBeLessThan(SAFE_BUDGET_BYTES)
    const downgradedContent = persisted[0].messages[0].content
    expect(downgradedContent.length).toBeLessThan(hugeContent.length)
    expect(downgradedContent.includes('…[已截断]')).toBe(true)
    // 内存态保持完整（投影降级不改 states 本体）
    expect(getCurrentSnapshot().messages[0].content).toBe(hugeContent)
    spy.mockRestore()
  })

  it('patchCurrentMessages 同样受 AGENT_MSG_MAX=60 上限截断（保留最近 60 条）', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    const many = Array.from({ length: 100 }, (_, i) => ({ role: 'user', content: `m${i}` }))
    patchCurrentMessages(many)
    expect(getCurrentSnapshot().messages).toHaveLength(60)
    expect(getCurrentSnapshot().messages.at(-1).content).toBe('m99')
  })

  it('pending 引用契约（P1a）：makePendingRef 不存 text 副本、保留原始 attachments；set/get 往返一致', () => {
    const id = ensureActiveConversation()
    applyConversation(id)
    const rawAtt = [{ type: 'image', url: '/files/raw.png' }]
    setCurrentPending(makePendingRef({ conversationId: id, messageId: 'm-42', attachments: rawAtt }))
    const p = getCurrentPending()
    expect(p.messageId).toBe('m-42')
    // text 不入 pending（由 messageId 引用找回），避免用户消息双副本
    expect(p.text).toBeUndefined()
    // attachments 保留原始输入（恢复时经 send 归一化一次，避免二次压缩）
    expect(p.attachments).toEqual(rawAtt)
    // 兼容旧形态：遗留 text 仍保留（迁移期可恢复）
    setCurrentPending({ conversationId: id, text: 'legacy' })
    expect(getCurrentPending().text).toBe('legacy')
  })
})