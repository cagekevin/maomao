import { describe, it, expect } from 'vitest'
import { parseAspect, computeSizeSync } from '../../src/components/base/hooks.ts'

// §2.17 横切纯逻辑：useSizeSync 的尺寸计算（computeSizeSync） + 比例解析（parseAspect）
// 规划 §3.1 的 sizeSync.test.js 遗漏项。

describe('parseAspect 比例解析', () => {
  it('标准比例转宽/高数值', () => {
    expect(parseAspect('16:9')).toBeCloseTo(16 / 9)
    expect(parseAspect('1:1')).toBeCloseTo(1)
    expect(parseAspect('9:16')).toBeCloseTo(9 / 16)
  })

  it('支持全角冒号', () => {
    expect(parseAspect('3:4')).toBeCloseTo(0.75)
    expect(parseAspect('3\uFF1A4')).toBeCloseTo(0.75)
  })

  it('Auto / 空 / 非法返回 null', () => {
    expect(parseAspect('Auto')).toBeNull()
    expect(parseAspect('')).toBeNull()
    expect(parseAspect(null)).toBeNull()
    expect(parseAspect('abc')).toBeNull()
    expect(parseAspect('16')).toBeNull()
  })
})

describe('computeSizeSync 尺寸计算', () => {
  it('Auto（ratio=null）用默认尺寸', () => {
    expect(computeSizeSync(null, { defaultWidth: 420, defaultHeight: 420 })).toEqual({ width: 420, height: 420 })
    expect(computeSizeSync(null, { defaultWidth: 640, defaultHeight: 360 })).toEqual({ width: 640, height: 360 })
  })

  it('width-fixed：宽固定当前宽，高 = 宽/比例', () => {
    const r = computeSizeSync(parseAspect('1:1'), { mode: 'width-fixed', currentWidth: 420 })
    expect(r).toEqual({ width: 420, height: 420 })
    const r2 = computeSizeSync(parseAspect('16:9'), { mode: 'width-fixed', currentWidth: 640 })
    expect(r2.width).toBe(640)
    expect(r2.height).toBe(Math.round(640 / (16 / 9)))
  })

  it('area-fixed：宽 = sqrt(比例)*base，高 = base/sqrt(比例)', () => {
    const r = computeSizeSync(parseAspect('1:1'), { mode: 'area-fixed', baseSize: 380 })
    expect(r).toEqual({ width: 380, height: 380 })
    const r2 = computeSizeSync(parseAspect('16:9'), { mode: 'area-fixed', baseSize: 380 })
    expect(r2.width).toBe(Math.round(Math.sqrt(16 / 9) * 380))
    expect(r2.height).toBe(Math.round(380 / Math.sqrt(16 / 9)))
    // 面积近似守恒（rounding 引入 ±100 内误差可接受）
    expect(Math.abs(r2.width * r2.height - 380 * 380)).toBeLessThan(100)
  })

  it('无 currentWidth 时回退 defaultWidth', () => {
    const r = computeSizeSync(parseAspect('1:1'), { mode: 'width-fixed', defaultWidth: 420 })
    expect(r.width).toBe(420)
  })
})
