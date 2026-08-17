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

  it('多节点连线 → 重排后位置改变且 data.expanded=false', () => {
    const { result } = renderHook(() => useArrangeCanvas())
    const nodes = [
      { id: 'a', type: 'promptNode', position: { x: 999, y: 888 }, data: {}, width: 420, height: 420 },
      { id: 'b', type: 'imageNode', position: { x: 1, y: 2 }, data: { expanded: true }, width: 200, height: 120 },
    ]
    const edges = [{ id: 'e-ab', source: 'a', target: 'b' }]
    const onArrange = vi.fn()
    const res = result.current.arrange({ nodes, edges, onArrange })

    // 返回数量一致、顺序保持
    expect(res.nodes).toHaveLength(2)
    // 布局后都收到新的 position（不为原始乱值）
    const a = res.nodes.find((n) => n.id === 'a')
    const b = res.nodes.find((n) => n.id === 'b')
    expect(a.position).not.toEqual({ x: 999, y: 888 })
    expect(typeof a.position.x).toBe('number')
    expect(typeof a.position.y).toBe('number')
    // 折叠面板
    expect(a.data.expanded).toBe(false)
    expect(b.data.expanded).toBe(false)
    // 边原样回传
    expect(res.edges).toBe(edges)
    // onArrange 收到新布局
    expect(onArrange).toHaveBeenCalledWith(res)
  })

  it('group 父子：子节点 parentId 保留且随父相对布局', () => {
    const { result } = renderHook(() => useArrangeCanvas())
    const nodes = [
      { id: 'g', type: 'group', position: { x: 0, y: 0 }, data: {}, width: 400, height: 300, style: {} },
      { id: 'c', type: 'textNode', position: { x: 10, y: 10 }, data: {}, width: 120, height: 60, parentId: 'g' },
    ]
    const res = result.current.arrange({ nodes, edges: [] })
    const g = res.nodes.find((n) => n.id === 'g')
    const c = res.nodes.find((n) => n.id === 'c')
    expect(c.parentId).toBe('g')
    // 父框写回测量尺寸到 style
    expect(g.style.width).toBeGreaterThan(0)
    expect(g.style.height).toBeGreaterThan(0)
  })
})
