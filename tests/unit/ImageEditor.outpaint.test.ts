/**
 * ImageEditor 扩图工具坐标纯逻辑单测。
 *
 * 复刻 AI-Canvas ExpandEditor 机制（独立于裁剪的扩图工具）：
 *  - computeOutpaintTarget：按「目标比例 + 外扩量 zoom」算目标画布与原图尺寸/可移动范围；
 *  - computeOutpaintDrawPos：由拖动偏移 offset（归一化 [-0.5,0.5]）算原图绘制起点。
 * 原图始终不拉伸，只放大画布留白。
 */
import { describe, it, expect } from 'vitest'
import {
  computeOutpaintTarget,
  computeOutpaintDrawPos,
  OUTPAINT_FILL,
  OUTPAINT_RATIOS,
} from '../../src/components/base/ImageEditor.tsx'

describe('computeOutpaintTarget', () => {
  it('zoom=1 + 原图比例 → 目标画布=原图，无白边，可移动范围 0', () => {
    const r = computeOutpaintTarget(200, 100, undefined, 1)
    expect(r.tw).toBe(200)
    expect(r.th).toBe(100)
    expect(r.sw).toBe(200)
    expect(r.sh).toBe(100)
    expect(r.maxOffX).toBe(0)
    expect(r.maxOffY).toBe(0)
  })

  it('zoom=1/√2（factor=√2，面积2倍上限）+ 原图比例 → 画布线性放大√2', () => {
    const r = computeOutpaintTarget(200, 100, undefined, 1 / Math.SQRT2)
    // 原图 2:1，目标比例=原图 → base=200x100，/(1/√2)=×√2 → 面积恰好 2 倍
    const tw = Math.round(200 * Math.SQRT2)
    const th = Math.round(100 * Math.SQRT2)
    expect(r.tw).toBe(tw)
    expect(r.th).toBe(th)
    // sw/sh 保持原图原始尺寸（200×100），可拖动偏移 = (画布 - 原图)/2
    expect(r.sw).toBe(200)
    expect(r.sh).toBe(100)
    expect(r.maxOffX).toBe((tw - 200) / 2)
    expect(r.maxOffY).toBe((th - 100) / 2)
  })

  it('zoom=1（factor=1）→ 画布等于原图内接尺寸，四周无白边', () => {
    const r = computeOutpaintTarget(200, 100, undefined, 1)
    expect(r.tw).toBe(200)
    expect(r.th).toBe(100)
    expect(r.maxOffX).toBe(0)
    expect(r.maxOffY).toBe(0)
  })

  it('指定目标比例 1:1 → 原图贴边内接，再按 zoom 外扩', () => {
    const r = computeOutpaintTarget(200, 100, 1, 0.8)
    // 原图 2:1，目标 1:1（更窄）→ 宽度贴边：baseW=200, baseH=round(200/1)=200；/0.8 外扩
    expect(r.tw).toBe(Math.round(200 / 0.8))
    expect(r.th).toBe(Math.round(200 / 0.8))
    // 1:1 画布，原图 200x100 的可移动范围
    expect(r.sw).toBe(200)
    expect(r.sh).toBe(100)
    expect(r.maxOffX).toBe(Math.round((r.tw - 200) / 2))
    expect(r.maxOffY).toBe(Math.round((r.th - 100) / 2))
  })

  it('zoom 越界钳制到 [1/√2,1]（factor ∈ [1,√2] → 面积最多 2 倍）', () => {
    const lo = computeOutpaintTarget(100, 100, undefined, 0.1)
    expect(lo.tw).toBe(Math.round(100 / (1 / Math.SQRT2)))
    const hi = computeOutpaintTarget(100, 100, undefined, 5)
    expect(hi.tw).toBe(100)
    expect(hi.maxOffX).toBe(0)
  })

  it('零尺寸输入 → 至少 1px', () => {
    const r = computeOutpaintTarget(0, 0, undefined, 0.5)
    expect(r.tw).toBeGreaterThanOrEqual(1)
    expect(r.th).toBeGreaterThanOrEqual(1)
  })
})

describe('computeOutpaintDrawPos', () => {
  it('offset 0 → 居中（偏移=可移动范围一半）', () => {
    const r = computeOutpaintDrawPos({ x: 0, y: 0 }, 100, 50)
    expect(r.dx).toBe(100)
    expect(r.dy).toBe(50)
  })

  it('offset -0.5 → 贴左/贴上', () => {
    const r = computeOutpaintDrawPos({ x: -0.5, y: -0.5 }, 100, 50)
    expect(r.dx).toBe(0)
    expect(r.dy).toBe(0)
  })

  it('offset +0.5 → 贴右/贴下', () => {
    const r = computeOutpaintDrawPos({ x: 0.5, y: 0.5 }, 100, 50)
    expect(r.dx).toBe(200) // maxOffX + 0.5*2*maxOffX = 100+100
    expect(r.dy).toBe(100) // maxOffY + 0.5*2*maxOffY = 50+50
  })

  it('offset 越界 → 钳制到 [-0.5,0.5]', () => {
    const lo = computeOutpaintDrawPos({ x: -5, y: 5 }, 100, 50)
    expect(lo.dx).toBe(0)
    expect(lo.dy).toBe(100)
  })

  it('可移动范围 0（无白边）→ 偏移恒为 0', () => {
    const r = computeOutpaintDrawPos({ x: 0.5, y: -0.5 }, 0, 0)
    expect(r.dx).toBe(0)
    expect(r.dy).toBe(0)
  })
})

describe('扩图常量', () => {
  it('白边填充色为纯白 #ffffff', () => {
    expect(OUTPAINT_FILL).toBe('#ffffff')
  })

  it('目标比例选项覆盖常用画幅', () => {
    expect(OUTPAINT_RATIOS.map((r) => r.key)).toEqual(['1:1', '4:3', '3:4', '16:9', '9:16'])
  })
})
