import { describe, it, expect } from 'vitest'
import { detectMentionQuery, computeMentionPlacement, MENTION_FLIP_MIN_H } from '../../src/components/base/promptMention.js'

describe('detectMentionQuery', () => {
  it('正常触发：@ 后跟中文/英文 query，中文后直接打 @ 也弹', () => {
    expect(detectMentionQuery('abc @')).toEqual({ active: true, query: '', atIndex: 4 })
    expect(detectMentionQuery('abc @人')).toEqual({ active: true, query: '人', atIndex: 4 })
    expect(detectMentionQuery('@人')).toEqual({ active: true, query: '人', atIndex: 0 })
    expect(detectMentionQuery('小猫吃鱼@')).toEqual({ active: true, query: '', atIndex: 4 })
    expect(detectMentionQuery('参考@')).toEqual({ active: true, query: '', atIndex: 2 })
  })

  it('URL/邮箱 由 query 内标点自然拦截', () => {
    expect(detectMentionQuery('hello@world.com').active).toBe(false) // query 含 . → BREAK
    expect(detectMentionQuery('我的邮箱是abc@xx.com').active).toBe(false) // query 含 . → BREAK
    expect(detectMentionQuery('abc@xx').active).toBe(true) // 无断字符 → 弹
  })

  it('query 含空白/标点即收尾', () => {
    expect(detectMentionQuery('@人物参考 走在街上').active).toBe(false)
    expect(detectMentionQuery('@人物参考，然后').active).toBe(false)
  })

  it('超长 query 判为不在 @ 人', () => {
    expect(detectMentionQuery('@' + '人'.repeat(30)).active).toBe(false)
  })

  it('芯片尾 } 后打 @ 可弹（与 autoLinkAssetsByName 同规则）', () => {
    expect(detectMentionQuery('@{id:label}@').active).toBe(true)
  })
})

describe('computeMentionPlacement', () => {
  const vw = 1440
  const vh = 900

  it('上方充足 → 向上（底对齐）', () => {
    const p = computeMentionPlacement({ top: 400, bottom: 425, left: 100 }, { viewportW: vw, viewportH: vh })
    expect(p.placement).toBe('up')
    expect(p.top).toBeUndefined()
    expect(p.bottom).toBe(vh - 400 + 4) // 底边贴 @ 行顶 -4px
  })

  it('上方不足 → 翻转到下方', () => {
    const p = computeMentionPlacement({ top: 60, bottom: 85, left: 100 }, { viewportW: vw, viewportH: vh })
    expect(p.placement).toBe('down')
    expect(p.top).toBe(85 + 4)
  })

  it('翻转阈值 = MENTION_FLIP_MIN_H，且两侧都不够时取空间大的一侧', () => {
    expect(MENTION_FLIP_MIN_H).toBe(160)
    // 上 272 >= 160 → up（下方 104 也不够，取上方）
    const p = computeMentionPlacement({ top: 280, bottom: 305, left: 100 }, { viewportW: 400, viewportH: 400 })
    expect(p.placement).toBe('up')
    // 上 100 < 160 且 < 下 807 → down
    const p2 = computeMentionPlacement({ top: 108, bottom: 133, left: 100 }, { viewportW: 1440, viewportH: 900 })
    expect(p2.placement).toBe('down')
  })

  it('左右溢出 clamp 到边距', () => {
    expect(computeMentionPlacement({ top: 400, bottom: 425, left: 5 }, { viewportW: vw, viewportH: vh }).left).toBe(8)
    expect(computeMentionPlacement({ top: 400, bottom: 425, left: vw - 10 }, { viewportW: vw, viewportH: vh }).left).toBe(vw - 280 - 8)
  })

  it('最小高度兜底：宁可溢出也不塌成一条', () => {
    const p = computeMentionPlacement({ top: 500, bottom: 525, left: 100 }, { viewportW: vw, viewportH: 600 })
    expect(p.height).toBeGreaterThanOrEqual(96)
  })
})
