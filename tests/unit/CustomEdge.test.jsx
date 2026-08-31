/**
 * CustomEdge 深度测试。
 *
 * 自定义连线（复刻原 Mg.jsx）：三层 path（hit/glow/base）+ 选中或关联时渲染
 * Comet 彗星流光 + 连线中点删除按钮。此前测试只有「挂载不崩」冒烟，激活分支与
 * 删除动作完全测不出。
 * 本文件断言：
 *  - 未激活：仅基础线（无 is-active）、无辉光/粒子/删除按钮
 *  - selected 激活：辉光 + Comet + 删除按钮 + 隐藏 mpath
 *  - data.relatedToSelected 关联激活（与选中联动）
 *  - 点击删除按钮 → deleteElements({ edges: [{ id }] })
 *  - markerEnd 字符串透传给主线
 */
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const h = vi.hoisted(() => {
  const deleteElements = vi.fn()
  const cometProps = []
  return { deleteElements, cometProps }
})

vi.mock('@xyflow/react', () => ({
  getBezierPath: vi.fn(() => ['M0,0 C10,10 90,10 100,100', 50, 50]),
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  EdgeLabelRenderer: ({ children }) => <div data-testid="edge-label">{children}</div>,
  useReactFlow: () => ({ deleteElements: (...a) => h.deleteElements(...a) }),
}))

vi.mock('../../src/components/edges/Comet.tsx', () => ({
  default: (props) => {
    h.cometProps.push(props)
    return <g data-testid="comet" />
  },
}))

import CustomEdge from '../../src/components/edges/CustomEdge.tsx'

const BASE_PROPS = {
  id: 'e1',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  markerEnd: 'url(#arrow)',
  selected: false,
  data: {},
}

function setup(overrides = {}) {
  return render(<CustomEdge {...BASE_PROPS} {...overrides} />)
}

describe('CustomEdge — 未激活态', () => {
  beforeEach(() => {
    h.deleteElements.mockClear()
    h.cometProps.length = 0
  })

  it('渲染透明命中层 + 基础线（无 is-active）', () => {
    const view = setup()
    expect(view.container.querySelector('.cust-edge-hit')).toBeTruthy()
    const base = view.container.querySelector('.cust-edge-base')
    expect(base).toBeTruthy()
    expect(base.className).not.toContain('is-active')
  })

  it('未激活：无辉光层、无隐藏 mpath、无 Comet、无删除按钮', () => {
    const view = setup()
    expect(view.container.querySelector('.cust-edge-glow')).toBeNull()
    expect(view.container.querySelector('[id^="cust-edge-mpath"]')).toBeNull()
    expect(h.cometProps).toHaveLength(0)
    expect(screen.queryByTitle('删除连线')).toBeNull()
  })

  it('markerEnd 透传给主线 path', () => {
    const view = setup()
    expect(view.container.querySelector('.cust-edge-base').getAttribute('marker-end')).toBe('url(#arrow)')
  })

  it('markerEnd 非字符串时不透传', () => {
    const view = setup({ markerEnd: { id: 'obj' } })
    expect(view.container.querySelector('.cust-edge-base').getAttribute('marker-end')).toBeNull()
  })

  it('bezier path d 透传给各层', () => {
    const view = setup()
    const d = 'M0,0 C10,10 90,10 100,100'
    expect(view.container.querySelector('.cust-edge-hit').getAttribute('d')).toBe(d)
    expect(view.container.querySelector('.cust-edge-base').getAttribute('d')).toBe(d)
  })
})

describe('CustomEdge — 激活态', () => {
  beforeEach(() => {
    h.deleteElements.mockClear()
    h.cometProps.length = 0
  })

  it('selected=true：渲染辉光 + 隐藏 mpath + Comet + 删除按钮', () => {
    const view = setup({ selected: true })
    expect(view.container.querySelector('.cust-edge-glow.is-active')).toBeTruthy()
    expect(view.container.querySelector('#cust-edge-mpath-e1')).toBeTruthy()
    expect(h.cometProps).toHaveLength(1)
    expect(h.cometProps[0].edgeId).toBe('e1')
    expect(h.cometProps[0].isActive).toBe(true)
    expect(h.cometProps[0].pathRef).toBe('cust-edge-mpath-e1')
    expect(screen.getByTitle('删除连线')).toBeTruthy()
  })

  it('data.relatedToSelected=true：关联激活（与选中联动）', () => {
    const view = setup({ data: { relatedToSelected: true } })
    expect(view.container.querySelector('.cust-edge-base').className).toContain('is-active')
    expect(view.container.querySelector('.cust-edge-glow.is-active')).toBeTruthy()
    expect(h.cometProps).toHaveLength(1)
    expect(screen.getByTitle('删除连线')).toBeTruthy()
  })

  it('点击删除按钮 → deleteElements({ edges: [{ id }] })', () => {
    setup({ selected: true })
    fireEvent.click(screen.getByTitle('删除连线'))
    expect(h.deleteElements).toHaveBeenCalledTimes(1)
    expect(h.deleteElements).toHaveBeenCalledWith({ edges: [{ id: 'e1' }] })
  })

  it('删除按钮在 EdgeLabelRenderer 内（连线中点浮层）', () => {
    const view = setup({ selected: true })
    const label = view.container.querySelector('[data-testid="edge-label"]')
    expect(label).toBeTruthy()
    expect(label.querySelector('[title="删除连线"]')).toBeTruthy()
  })
})
