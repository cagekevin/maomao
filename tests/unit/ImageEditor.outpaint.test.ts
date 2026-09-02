/**
 * ImageEditor 外扩白边（outpaint）坐标纯逻辑单测。
 *
 * 复刻 AI-Canvas ExpandEditor 的 zoom 机制：
 *  - 外扩量由 zoom 控制，zoom∈[0.3,1]，越小白边越多；
 *  - 目标画布 tw = round(裁剪宽 / zoom)，th = round(裁剪高 / zoom)，原图居中不拉伸；
 *  - zoom=1 退化为普通裁剪（无白边）。
 * computeOutpaintRect 负责把「裁剪选区 + 外扩量」归一为「目标画布 + 原图居中偏移」。
 */
import { describe, it, expect } from 'vitest'
import { computeOutpaintRect, OUTPAINT_FILL } from '../../src/components/base/ImageEditor.tsx'

describe('computeOutpaintRect', () => {
  it('zoom=1 → 退化为普通裁剪，无白边（画布=选区，偏移0）', () => {
    const r = computeOutpaintRect({ x: 0, y: 0, width: 200, height: 100 }, 1)
    expect(r).toEqual({ tw: 200, th: 100, dx: 0, dy: 0 })
  })

  it('zoom=0.5 → 画布翻倍，四周各扩一半', () => {
    const r = computeOutpaintRect({ x: 0, y: 0, width: 200, height: 100 }, 0.5)
    expect(r).toEqual({ tw: 400, th: 200, dx: 100, dy: 50 })
  })

  it('zoom=0.3 → 画布按 0.3 放大，偏移正确', () => {
    const r = computeOutpaintRect({ x: 0, y: 0, width: 300, height: 150 }, 0.3)
    expect(r.tw).toBe(Math.round(300 / 0.3))
    expect(r.th).toBe(Math.round(150 / 0.3))
    expect(r.dx).toBe(Math.round((r.tw - 300) / 2))
    expect(r.dy).toBe(Math.round((r.th - 150) / 2))
  })

  it('非整图选区 + 外扩 → 偏移相对选区尺寸计算', () => {
    const r = computeOutpaintRect({ x: 10, y: 10, width: 100, height: 50 }, 0.5)
    expect(r.tw).toBe(200)
    expect(r.th).toBe(100)
    expect(r.dx).toBe(50)
    expect(r.dy).toBe(25)
  })

  it('zoom 越界自动钳制到 [0.3, 1]（<0.3 按下限，>1 按上限）', () => {
    const lo = computeOutpaintRect({ x: 0, y: 0, width: 100, height: 100 }, 0.1)
    expect(lo.tw).toBe(Math.round(100 / 0.3))
    const hi = computeOutpaintRect({ x: 0, y: 0, width: 100, height: 100 }, 5)
    expect(hi.tw).toBe(100) // 钳到 1 → 无外扩
    expect(hi.dx).toBe(0)
  })

  it('零宽/零高选区 → 至少为 1px，不产生 0 画布', () => {
    const r = computeOutpaintRect({ x: 0, y: 0, width: 0, height: 0 }, 0.5)
    expect(r.tw).toBeGreaterThanOrEqual(1)
    expect(r.th).toBeGreaterThanOrEqual(1)
  })

  it('白边填充色为纯白 #ffffff', () => {
    expect(OUTPAINT_FILL).toBe('#ffffff')
  })
})
