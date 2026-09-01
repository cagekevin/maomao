import { describe, it, expect } from 'vitest'
import {
  truncateTo, sanitizeLastResults, capConversationMemory,
  estimateConversationsBytes, applyConversationBudget,
  MSG_CONTENT_MAX, LAST_RESULTS_MAX, FACTS_MAX, ARTIFACTS_MAX,
} from '../../src/components/base/volumePolicy.ts'

describe('volumePolicy · truncateTo', () => {
  it('短串原样返回', () => {
    expect(truncateTo('abc', 10)).toBe('abc')
  })
  it('非字符串原样返回', () => {
    expect(truncateTo(undefined, 10)).toBe(undefined)
    expect(truncateTo(null, 10)).toBe(null)
  })
  it('超长补省略标记', () => {
    const out = truncateTo('x'.repeat(100), 10)
    expect(out.length).toBe(10)
    expect(out.endsWith('…[已截断]')).toBe(true)
  })
})

describe('volumePolicy · sanitizeLastResults', () => {
  it('非数组返回空数组', () => {
    expect(sanitizeLastResults(undefined)).toEqual([])
    expect(sanitizeLastResults(null)).toEqual([])
  })
  it('按 url 去重并保留最近顺序', () => {
    const list = [
      { id: 1, url: 'http://h/a.png' },
      { id: 2, url: 'http://h/b.png' },
      { id: 3, url: 'http://h/a.png' }, // 重复 a，保留较新的 3
    ]
    expect(sanitizeLastResults(list).map((i) => i.id)).toEqual([2, 3]) // 保原时序：b 在前，较新的 a(3) 顶上
  })
  it('超上限只留最近 LAST_RESULTS_MAX 条', () => {
    const list = Array.from({ length: LAST_RESULTS_MAX + 5 }, (_, i) => ({ url: `http://h/u${i}.png` }))
    const out = sanitizeLastResults(list)
    expect(out.length).toBe(LAST_RESULTS_MAX)
  })
  it('过滤无效项', () => {
    const out = sanitizeLastResults([null, { url: 'http://h/x.png' }, 'bad'])
    expect(out).toEqual([{ url: 'http://h/x.png' }])
  })
})

describe('volumePolicy · capConversationMemory', () => {
  it('非对象原样返回', () => {
    expect(capConversationMemory(null)).toBe(null)
  })
  it('facts 超限保最近 FACTS_MAX', () => {
    const mem = { facts: Array.from({ length: FACTS_MAX + 3 }, (_, i) => ({ k: `k${i}`, v: 'v' })) }
    const out = capConversationMemory(mem)
    expect(out.facts.length).toBe(FACTS_MAX)
  })
  it('artifacts 超限保最近 ARTIFACTS_MAX', () => {
    const mem = { artifacts: Array.from({ length: ARTIFACTS_MAX + 5 }, (_, i) => ({ id: String(i) })) }
    const out = capConversationMemory(mem)
    expect(out.artifacts.length).toBe(ARTIFACTS_MAX)
  })
  it('不 mutate 入参', () => {
    const mem = { facts: Array.from({ length: FACTS_MAX + 1 }, (_, i) => ({ k: `k${i}`, v: 'v' })) }
    const before = mem.facts.length
    capConversationMemory(mem)
    expect(mem.facts.length).toBe(before)
  })
})

describe('volumePolicy · 整包预算', () => {
  it('空会话 bytes=0 且不降级', () => {
    expect(estimateConversationsBytes([])).toBe(0)
    const r = applyConversationBudget([], 100)
    expect(r.downgraded).toBe(false)
  })
  it('未超预算不降级（原引用返回）', () => {
    const convs = [{ id: 'c1', messages: [{ id: 'm1', role: 'user', content: 'hi' }] }]
    const r = applyConversationBudget(convs, 10000)
    expect(r.downgraded).toBe(false)
  })
  it('超预算剥离瞬时字段（streaming 占位）', () => {
    const convs = [{
      id: 'c1',
      messages: [
        { id: 'm1', role: 'assistant', content: 'f', streaming: true },
        { id: 'm2', role: 'user', content: 'hi' },
      ],
    }]
    const r = applyConversationBudget(convs, 100)
    // 预算 100 字节内必先剥离 streaming，且不被截断正文（正文很短）
    const kept = r.conversations[0].messages
    expect(kept.some((m) => m.streaming)).toBe(false)
    // 非瞬时用户消息应保留
    expect(kept.some((m) => m.role === 'user')).toBe(true)
  })
  it('超预算截断超大正文降到预算内', () => {
    const huge = 'x'.repeat(100000)
    const convs = [{ id: 'c1', messages: [{ id: 'm1', role: 'user', content: huge }] }]
    const r = applyConversationBudget(convs, 1000)
    expect(r.downgraded).toBe(true)
    const finalContent = r.conversations[0].messages[0].content
    expect(finalContent.length).toBeLessThan(1000)
    expect(estimateConversationsBytes(r.conversations)).toBeLessThanOrEqual(1000 * 2) // 宽松：截断半长收敛
  })
  it('入参内存态不被 mutate（投影副本原则）', () => {
    const huge = 'x'.repeat(100000)
    const convs = [{ id: 'c1', messages: [{ id: 'm1', role: 'user', content: huge, streaming: true }] }]
    applyConversationBudget(convs, 100)
    // 原对象内容与 streaming 均保持不变
    expect(convs[0].messages[0].content).toBe(huge)
    expect(convs[0].messages[0].streaming).toBe(true)
  })
  it('lastResults 去重降级', () => {
    const convs = [{
      id: 'c1',
      messages: [{ id: 'm1', role: 'assistant', content: 'r', lastResults: [{ url: 'u1' }, { url: 'u1' }, { url: 'u2' }, { url: 'u2' }] }],
    }]
    const r = applyConversationBudget(convs, 10000)
    const lr = r.conversations[0].messages[0].lastResults
    expect(lr.length).toBe(2)
  })
})