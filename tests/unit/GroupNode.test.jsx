/**
 * GroupNode 单测（阶段五试点）。
 * 覆盖：展开态/折叠态渲染、双击/按钮切换折叠（调用 useReactFlow().setNodes 更新 data.collapsed 与子节点 hidden）。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockSetNodes = vi.fn()
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ setNodes: mockSetNodes, setEdges: vi.fn(), getEdges: vi.fn(() => []), getNodes: vi.fn(() => []), addNodes: vi.fn() }),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}))
vi.mock('../../src/components/base/NodeShell.tsx', () => ({ default: ({ children, titleRight, label }) => (<div data-testid="shell" data-label={label}>{titleRight}{children}</div>) }))
vi.mock('../../src/components/edges/CustomHandle.tsx', () => ({ default: () => null }))

import GroupNode from '../../src/components/nodes/GroupNode.jsx'

beforeEach(() => {
  mockSetNodes.mockClear()
})

function setup(props = {}) {
  return render(<GroupNode id="g1" data={{ name: '我的编组' }} selected={false} {...props} />)
}

describe('GroupNode', () => {
  it('展开态渲染 NodeShell + 标题', () => {
    setup()
    const shell = screen.getByTestId('shell')
    expect(shell).toBeTruthy()
    expect(shell.getAttribute('data-label')).toBe('我的编组')
  })

  it('data.name 缺省回落「编组」', () => {
    setup({ data: {} })
    expect(screen.getByTestId('shell').getAttribute('data-label')).toBe('编组')
  })

  it('点击折叠按钮：setNodes 将本节点 data.collapsed=true 且子节点 hidden=true', () => {
    setup()
    fireEvent.click(screen.getByTitle('折叠'))
    expect(mockSetNodes).toHaveBeenCalledTimes(1)
    const updater = mockSetNodes.mock.calls[0][0]
    const next = updater([{ id: 'g1', data: {}, parentId: undefined }, { id: 'child1', parentId: 'g1' }])
    const self = next.find((n) => n.id === 'g1')
    const child = next.find((n) => n.id === 'child1')
    expect(self.data.collapsed).toBe(true)
    expect(child.hidden).toBe(true)
    // 折叠态样式：高度 40、宽度 max-content
    expect(self.style.height).toBe(40)
    expect(self.style.width).toBe('max-content')
  })

  it('折叠态再点击展开：data.collapsed=false、子节点 hidden=false、恢复尺寸', () => {
    setup({ data: { name: '我的编组', collapsed: true, expandedWidth: 320, expandedHeight: 210 } })
    fireEvent.click(screen.getByText('我的编组'))
    expect(mockSetNodes).toHaveBeenCalledTimes(1)
    const updater = mockSetNodes.mock.calls[0][0]
    const next = updater([{ id: 'g1', data: { collapsed: true, expandedWidth: 320, expandedHeight: 210 } }, { id: 'child1', parentId: 'g1', hidden: true }])
    const self = next.find((n) => n.id === 'g1')
    const child = next.find((n) => n.id === 'child1')
    expect(self.data.collapsed).toBe(false)
    expect(child.hidden).toBe(false)
    expect(self.style.width).toBe(320)
    expect(self.style.height).toBe(210)
  })

  it('折叠态渲染小胶囊（不含 NodeShell）', () => {
    const { container } = setup({ data: { collapsed: true } })
    // 折叠态直接渲染胶囊 div（无 data-testid="shell"）
    expect(screen.queryByTestId('shell')).toBeNull()
    expect(container.querySelector('.cursor-pointer')).toBeTruthy()
  })
})
