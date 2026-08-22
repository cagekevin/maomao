/**
 * InlineImageCropper 坐标换算纯逻辑单测。
 *
 * 根因回归：react-image-crop 的 onComplete 返回「像素坐标」PixelCrop，而组件初始化默认用
 * 「百分比」{x:0,y:0,width:100}，二者单位混用导致「点确认保存不了/裁错」。cropRectFromSelection
 * 负责把选区（% 或 px）统一归一为原图像素矩形并钳制到图内，这里用纯函数断言其精确性。
 */
import { describe, it, expect } from 'vitest'
import { cropRectFromSelection } from '../../src/components/base/InlineImageCropper.jsx'

// 固定场景：原图 1200×800，渲染盒子 300×200（scale 4）
const R = { renderW: 300, renderH: 200, natW: 1200, natH: 800 }

describe('cropRectFromSelection', () => {
  it('默认百分比整图（100%）→ 原始整图区域', () => {
    const r = cropRectFromSelection({ sel: { x: 0, y: 0, width: 100, height: 100, unit: '%' }, ...R })
    expect(r).toEqual({ sx: 0, sy: 0, sw: 1200, sh: 800 })
  })

  it('百分比 50% → 原图一半区域', () => {
    const r = cropRectFromSelection({ sel: { x: 0, y: 0, width: 50, height: 50, unit: '%' }, ...R })
    expect(r).toEqual({ sx: 0, sy: 0, sw: 600, sh: 400 })
  })

  it('百分比映射与渲染盒尺寸完全无关（不同宽高比缩放不产生右侧多出）', () => {
    // 同一张 1200×800 原图，即便渲染盒宽高不同，百分比选区都应精确映射到同一原图区域
    const a = cropRectFromSelection({ sel: { x: 0, y: 0, width: 100, height: 100, unit: '%' }, renderW: 300, renderH: 200, natW: 1200, natH: 800 })
    const b = cropRectFromSelection({ sel: { x: 0, y: 0, width: 100, height: 100, unit: '%' }, renderW: 900, renderH: 400, natW: 1200, natH: 800 })
    const c = cropRectFromSelection({ sel: { x: 0, y: 0, width: 100, height: 100, unit: '%' }, renderW: 1, renderH: 1, natW: 1200, natH: 800 })
    expect(a).toEqual({ sx: 0, sy: 0, sw: 1200, sh: 800 })
    expect(b).toEqual(a)
    expect(c).toEqual(a)
  })

  it('像素选区（onComplete 返回）→ 按 natural/render 映射到原图', () => {
    const r = cropRectFromSelection({ sel: { x: 50, y: 40, width: 100, height: 60, unit: 'px' }, ...R })
    expect(r).toEqual({ sx: 200, sy: 160, sw: 400, sh: 240 })
  })

  it('像素选区偏移正确（非零起点）', () => {
    const r = cropRectFromSelection({ sel: { x: 150, y: 100, width: 75, height: 50, unit: 'px' }, ...R })
    expect(r).toEqual({ sx: 600, sy: 400, sw: 300, sh: 200 })
  })

  it('越界选区钳制到图内（sw/sh 不超出原图残留）', () => {
    const r = cropRectFromSelection({ sel: { x: 250, y: 180, width: 200, height: 200, unit: 'px' }, ...R })
    expect(r.sx).toBeGreaterThanOrEqual(0)
    expect(r.sy).toBeGreaterThanOrEqual(0)
    expect(r.sx + r.sw).toBeLessThanOrEqual(1200)
    expect(r.sy + r.sh).toBeLessThanOrEqual(800)
  })

  it('无效选区（无宽度/高度）→ null', () => {
    expect(cropRectFromSelection({ sel: null, ...R })).toBeNull()
    expect(cropRectFromSelection({ sel: { x: 0, y: 0, width: 0, height: 0, unit: '%' }, ...R })).toBeNull()
  })
})