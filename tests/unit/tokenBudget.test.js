// @vitest-environment node
/**
 * tokenBudget（上下文预算触发压缩决策）单测。
 * 覆盖 resolveInputBudget / decideContextCompression。
 * 阈值：≥0.9 强制压缩，≥0.75 预压缩，否则不压缩。
 */
import { describe, it, expect } from 'vitest'

const { resolveInputBudget, decideContextCompression, CONTEXT_PRECOMPRESS_RATIO, CONTEXT_FORCE_COMPRESS_RATIO } =
  await import('../../src/components/agent/runtime/tokenBudget.js')

// 构造单条消息，使其经 estimateMessagesTokens 估算的总 token 恰为 n（content 全 CJK → n-8 + overhead 8）
const tokensOf = (n) => [{ role: 'user', content: '长'.repeat(Math.max(0, n - 8)) }]

describe('resolveInputBudget —— 输入预算解析', () => {
  it('= contextWindow × (1 − outputBudgetRatio)', () => {
    expect(resolveInputBudget({ contextWindow: 128_000, outputBudgetRatio: 0.2 })).toBe(102_400)
    expect(resolveInputBudget({ contextWindow: 8192, outputBudgetRatio: 0.25 })).toBe(6144)
  })

  it('无效/缺省输入返回 0', () => {
    expect(resolveInputBudget({ contextWindow: 0 })).toBe(0)
    expect(resolveInputBudget({ contextWindow: -1 })).toBe(0)
    expect(resolveInputBudget({})).toBe(0)
  })

  it('输出比例钳制到 [0,1]', () => {
    expect(resolveInputBudget({ contextWindow: 1000, outputBudgetRatio: 1.5 })).toBe(0)
    expect(resolveInputBudget({ contextWindow: 1000, outputBudgetRatio: -1 })).toBe(1000)
  })
})

describe('decideContextCompression —— 压缩决策', () => {
  it('≥ FORCE 阈值且仅达 FORCE 时 → force', () => {
    const budget = 1000
    expect(decideContextCompression({ messages: tokensOf(900), inputBudget: budget })).toBe('force')
    expect(decideContextCompression({ messages: tokensOf(999), inputBudget: budget })).toBe('force')
  })

  it('在 [precompress, force) 区间 → precompress', () => {
    const budget = 1000
    expect(decideContextCompression({ messages: tokensOf(750), inputBudget: budget })).toBe('precompress')
    expect(decideContextCompression({ messages: tokensOf(890), inputBudget: budget })).toBe('precompress')
  })

  it('低于 precompress 阈值 → none', () => {
    const budget = 1000
    expect(decideContextCompression({ messages: tokensOf(749), inputBudget: budget })).toBe('none')
    expect(decideContextCompression({ messages: [], inputBudget: budget })).toBe('none')
  })

  it('预算无效 → 保守 none（不因缺预算误触发）', () => {
    const msgs = tokensOf(900)
    expect(decideContextCompression({ messages: msgs, inputBudget: 0 })).toBe('none')
    expect(decideContextCompression({ messages: msgs, inputBudget: -1 })).toBe('none')
  })

  it('导出阈值常量合理（force > precompress）', () => {
    expect(CONTEXT_FORCE_COMPRESS_RATIO).toBeGreaterThan(CONTEXT_PRECOMPRESS_RATIO)
  })
})