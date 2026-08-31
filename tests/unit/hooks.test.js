// @vitest-environment node
/**
 * hooks 单测（批 1-7，纯函数部分）。
 * hooks.js 既有 React hooks（useOutsideClick/useNodeResize 等，需 jsdom，留批 3），
 * 也有不依赖 React 的纯函数：isEditableTarget / parseAspect / computeSizeSync。
 * 本文件覆盖这三者，均为 node 可测的确定逻辑。
 */
import { describe, it, expect } from 'vitest'

const { isEditableTarget, parseAspect, computeSizeSync } = await import(
  '../../src/components/base/hooks.ts'
)

describe('hooks — isEditableTarget', () => {
  it('INPUT/TEXTAREA 标志位 → true', () => {
    expect(isEditableTarget({ target: { tagName: 'INPUT' } })).toBe(true)
    expect(isEditableTarget({ target: { tagName: 'TEXTAREA' } })).toBe(true)
  })
  it('contentEditable → true', () => {
    expect(isEditableTarget({ target: { isContentEditable: true } })).toBe(true)
  })
  it('普通元素 → false', () => {
    expect(isEditableTarget({ target: { tagName: 'DIV' } })).toBe(false)
  })
  it('无 target / 无事件 → false', () => {
    expect(isEditableTarget(null)).toBe(false)
    expect(isEditableTarget({})).toBe(false)
  })
})

describe('hooks — parseAspect', () => {
  it('空值 / Auto → null', () => {
    expect(parseAspect('')).toBeNull()
    expect(parseAspect(null)).toBeNull()
    expect(parseAspect('Auto')).toBeNull()
  })
  it('解析 "16:9" / "16：9" / "16 : 9"', () => {
    expect(parseAspect('16:9')).toBeCloseTo(16 / 9)
    expect(parseAspect('16：9')).toBeCloseTo(16 / 9)
    expect(parseAspect('16 : 9')).toBeCloseTo(16 / 9)
  })
  it('非比例字符串 → null', () => {
    expect(parseAspect('hello')).toBeNull()
  })
})

describe('hooks — computeSizeSync', () => {
  it('ratio=null → 默认尺寸', () => {
    expect(computeSizeSync(null)).toEqual({ width: 420, height: 420 })
  })
  it('width-fixed：宽固定，高 = 宽 / ratio', () => {
    const r = computeSizeSync(16 / 9, { currentWidth: 320 })
    expect(r.width).toBe(320)
    expect(r.height).toBe(Math.round(320 / (16 / 9)))
  })
  it('area-fixed：宽 = sqrt(ratio)*base，高 = base/sqrt(ratio)', () => {
    const base = 380
    const ratio = 2
    const r = computeSizeSync(ratio, { mode: 'area-fixed', baseSize: base })
    expect(r.width).toBe(Math.round(Math.sqrt(ratio) * base))
    expect(r.height).toBe(Math.round(base / Math.sqrt(ratio)))
  })
  it('自定义默认值生效', () => {
    expect(computeSizeSync(null, { defaultWidth: 500, defaultHeight: 300 })).toEqual({
      width: 500,
      height: 300,
    })
  })
})
