// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

// 路径计算与 ReactFlow 能力 mock
const deleteElements = vi.fn()
vi.mock('@xyflow/react', () => ({
  getBezierPath: () => ['M0 0 L 10 10', 5, 5],
  EdgeLabelRenderer: ({ children }) => <div data-testid="edge-label">{children}</div>,
  Position: { Left: 'left', Right: 'right' },
  useReactFlow: () => ({ deleteElements }),
}))

import CustomEdge from '../../src/components/CustomEdge.jsx'

const baseProps = {
  id: 'e1',
  sourceX: 0,
  sourceY: 0,
  targetX: 10,
  targetY: 10,
  markerEnd: 'url(#arrow)',
  selected: false,
  data: {},
}

describe('CustomEdge', () => {
  it('挂载不崩，渲染三层 path（hit / glow / base）', () => {
    const { container } = render(<CustomEdge {...baseProps} />)
    expect(container.querySelector('.cust-edge-hit')).toBeTruthy()
    expect(container.querySelector('.cust-edge-base')).toBeTruthy()
  })

  it('非选中/非关联时不渲染辉光与删除按钮', () => {
    const { container } = render(<CustomEdge {...baseProps} />)
    expect(container.querySelector('.cust-edge-glow.is-active')).toBeFalsy()
    expect(container.querySelector('button[title="删除连线"]')).toBeFalsy()
  })

  it('selected 时渲染辉光 + 删除按钮，点击删除调 deleteElements', () => {
    const { container } = render(<CustomEdge {...baseProps} selected />)
    expect(container.querySelector('.cust-edge-glow.is-active')).toBeTruthy()
    const btn = container.querySelector('button[title="删除连线"]')
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(deleteElements).toHaveBeenCalledWith({ edges: [{ id: 'e1' }] })
  })

  it('data.relatedToSelected 触发 active 特效', () => {
    const { container } = render(<CustomEdge {...baseProps} data={{ relatedToSelected: true }} />)
    expect(container.querySelector('.cust-edge-glow.is-active')).toBeTruthy()
    expect(container.querySelector('button[title="删除连线"]')).toBeTruthy()
  })

  it('markerEnd 字符串透传到主线', () => {
    const { container } = render(<CustomEdge {...baseProps} />)
    const base = container.querySelector('.cust-edge-base')
    expect(base.getAttribute('marker-end')).toBe('url(#arrow)')
  })
})
