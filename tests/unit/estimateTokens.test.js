// @vitest-environment node
/**
 * estimateTokens（token 估算，供上下文预算触发压缩决策）单测。
 * 启发式口径：CJK 约 1 字符≈1 token，拉丁约 4 字符≈1 token。
 * 覆盖：estimateTokens 纯估算 / estimateMessagesTokens 整组消息估算 / 边界。
 */
import { describe, it, expect } from 'vitest'

const { estimateTokens, estimateMessagesTokens } =
  await import('../../src/components/agent/runtime/estimateTokens.js')

describe('estimateTokens —— 单段估算', () => {
  it('空/非字符串 → 0', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens(null)).toBe(0)
    expect(estimateTokens(undefined)).toBe(0)
  })

  it('中文字符按 1 字符 ≈ 1 token', () => {
    // 4 个汉字 → 4
    expect(estimateTokens('一二三四')).toBe(4)
  })

  it('拉丁按约 4 字符 ≈ 1 token（向上取整）', () => {
    // 8 个字符 → 2；非整组进位
    expect(estimateTokens('abcdefgh')).toBe(2)
    expect(estimateTokens('abc')).toBe(1) // 3/4 向上取整 1
    expect(estimateTokens('a'.repeat(5))).toBe(2) // 5/4 向上取整 2
  })

  it('中英混排叠加', () => {
    // 2 汉字 + 4 拉丁 = 2 + 1 = 3
    expect(estimateTokens('你好test')).toBe(3)
  })
})

describe('estimateMessagesTokens —— 整组消息估算', () => {
  it('逐条叠加 role 开销与内容 token，tool_calls 一并计入', () => {
    const messages = [
      { role: 'user', content: '你好' }, // 8 + 2
      { role: 'assistant', content: 'ok', tool_calls: [{ id: 'a', function: { name: 'read', arguments: '{}' } }] },
    ]
    const total = estimateMessagesTokens(messages)
    // user: 8+2=10；assistant: 8 + 2(ok→1*? 'ok' 2字符/4=1) + tool_calls(JSON) > 0
    expect(total).toBeGreaterThan(10 + 9)
    expect(estimateMessagesTokens([])).toBe(0)
    expect(estimateMessagesTokens(null)).toBe(0)
  })

  it('忽略 null/非对象条目；缺 content 仍计单条 overhead', () => {
    const messages = [null, 'bad', { role: 'assistant' }, { role: 'user', content: '哈哈' }]
    // 仅 {role:'assistant'}（8）与 {content:'哈哈'}（8+2=10）计入，共 18
    expect(estimateMessagesTokens(messages)).toBe(18)
  })
})