// @vitest-environment jsdom
/**
 * useArrangeCanvas 单测（批 3）。
 * 覆盖 useArrangeCanvas().arrange({nodes, edges, onArrange, onComplete})：
 *   - 空画布 → 直接返回原样并调用 onComplete（不跑 dagre）
 *   - 多节点（含连线）→ 返回重新布局的节点（position 改变、data.expanded=false）、边不变
 *   - group 父子：父框测量尺寸写回 style
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const GROUP_PAD = 40 // 与 useArrangeCanvas.js 中 group 外接矩形留白保持一致

const { useArrangeCanvas } = await import('../../src/components/base/useArrangeCanvas.js')

describe('useArrangeCanvas', () => {
  it('空画布 → 原样返回 + 调用 onComplete', () => {
    const { result } = renderHook(() => useArrangeCanvas())
    const onArrange = vi.fn()
    const onComplete = vi.fn()
    const res = result.current.arrange({ nodes: [], edges: [], onArrange, onComplete })
    expect(res.nodes).toEqual([])
    expect(onComplete).toHaveBeenCalled()
    expect(onArrange).not.toHaveBeenCalled()
  })

  it('多节点连线 → 重排后收到 position 且 data.expanded=false、边原样', () => {
    const { result } = renderHook(() => useArrangeCanvas())
    const nodes = [
      { id: 'a', type: 'promptNode', position: { x: 999, y: 888 }, data: {}, width: 420, height: 420 },
      { id: 'b', type: 'imageNode', position: { x: 1, y: 2 }, data: { expanded: true }, width: 200, height: 120 },
    ]
    const edges = [{ id: 'e-ab', source: 'a', target: 'b' }]
    const onArrange = vi.fn()
    const res = result.current.arrange({ nodes, edges, onArrange })

    // 返回数量一致
    expect(res.nodes).toHaveLength(2)
    const a = res.nodes.find((n) => n.id === 'a')
    const b = res.nodes.find((n) => n.id === 'b')
    // 布局后都收到有效 position（number）
    expect(typeof a.position.x).toBe('number')
    expect(typeof a.position.y).toBe('number')
    expect(typeof b.position.x).toBe('number')
    expect(typeof b.position.y).toBe('number')
    // b 与 a 通过边保持左右相对关系（rankdir=LR，a 在左 b 在右）
    expect(b.position.x).toBeGreaterThan(a.position.x)
    // 折叠面板
    expect(a.data.expanded).toBe(false)
    expect(b.data.expanded).toBe(false)
    // 边原样回传
    expect(res.edges).toBe(edges)
    // onArrange 收到新布局
    expect(onArrange).toHaveBeenCalledWith(res)
  })

  it('group 父子：子节点 parentId 保留、父框写回真实尺寸', () => {
    const { result } = renderHook(() => useArrangeCanvas())
    // 加一个独立顶层节点作为不跳变锚点，避免画布跳到原点
    const nodes = [
      { id: 'n', type: 'promptNode', position: { x: 5000, y: 5000 }, data: {}, width: 420, height: 420 },
      { id: 'g', type: 'group', position: { x: 0, y: 0 }, data: {}, width: 400, height: 300, style: {} },
      { id: 'c', type: 'textNode', position: { x: 10, y: 10 }, data: {}, width: 120, height: 60, parentId: 'g' },
    ]
    const res = result.current.arrange({ nodes, edges: [] })
    const g = res.nodes.find((n) => n.id === 'g')
    const c = res.nodes.find((n) => n.id === 'c')
    expect(c).toBeDefined()
    expect(c.parentId).toBe('g')
    // 子节点相对父框坐标原样保留（组内摆放不动）
    expect(c.position).toEqual({ x: 10, y: 10 })
    // 父框写回测量尺寸到 style
    expect(g.style.width).toBeGreaterThan(0)
    expect(g.style.height).toBeGreaterThan(0)
  })

  it('有编组时组当整体：子节点相对坐标原样保留，不重排组内摆放', () => {
    const { result } = renderHook(() => useArrangeCanvas())
    const nodes = [
      // 独立于编组的普通节点（无连线），作为不跳变锚点
      { id: 'n', type: 'promptNode', position: { x: 5000, y: 5000 }, data: {}, width: 420, height: 420 },
      // 编组：父框 + 两个子节点（相对父框坐标故意不规整，验证不被改动）
      { id: 'g', type: 'group', position: { x: 100, y: 100 }, data: {}, width: 400, height: 300, style: {} },
      { id: 'c1', type: 'textNode', position: { x: 10, y: 40 }, data: {}, width: 120, height: 60, parentId: 'g' },
      { id: 'c2', type: 'imageNode', position: { x: 233, y: 175 }, data: {}, width: 120, height: 80, parentId: 'g' },
    ]
    const res = result.current.arrange({ nodes, edges: [] })

    const g = res.nodes.find((n) => n.id === 'g')
    const c1 = res.nodes.find((n) => n.id === 'c1')
    const c2 = res.nodes.find((n) => n.id === 'c2')
    // 编组关系保持
    expect(c1.parentId).toBe('g')
    expect(c2.parentId).toBe('g')
    // 【优化①】子节点相对父框的坐标原封不动（组内摆放不被重排）
    expect(c1.position).toEqual({ x: 10, y: 40 })
    expect(c2.position).toEqual({ x: 233, y: 175 })
    // 父框写回真实外接矩形尺寸（含 40 留白）：宽 = (233+120)-10 + 80 = 423
    expect(g.style.width).toBeCloseTo(120 + 233 - 10 + GROUP_PAD * 2, 0)
    expect(g.style.height).toBeGreaterThan(0)
  })

  it('不跳变：整理后第一个顶层节点位置与原位置一致（整体最小平移）', () => {
    const { result } = renderHook(() => useArrangeCanvas())
    const origTop = { id: 'a', type: 'promptNode', position: { x: 4321, y: 8765 }, data: {}, width: 420, height: 420 }
    const nodes = [
      origTop,
      { id: 'b', type: 'textNode', position: { x: 4000, y: 9000 }, data: {}, width: 120, height: 60 },
    ]
    const edges = [{ id: 'e1', source: 'a', target: 'b' }]
    const res = result.current.arrange({ nodes, edges })
    const a = res.nodes.find((n) => n.id === 'a')
    // 锚点节点整理前后位置不变，画布不漂移回原点
    expect(a.position).toEqual({ x: 4321, y: 8765 })
    // 另一个节点随整体平移，仍与 a 保持合理相对关系（未放到原点附近）
    const b = res.nodes.find((n) => n.id === 'b')
    expect(b.position.x).toBeGreaterThan(4000)
  })
})
