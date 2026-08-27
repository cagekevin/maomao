/**
 * GhostTargetNode 深度测试。
 *
 * 幽灵目标节点：透明占位节点，渲染一个透明 target Handle，让 React Flow
 * 能解析幽灵边（否则报 error 008「Couldn't create edge for target handle id:
 * null」）。此前测试只有「挂载不崩」冒烟，无法验证 Handle 契约。
 * 本文件捕获 Handle 收到的 props，断言：
 *  - 必须渲染一个 target 类型 Handle（type=target、position=left、无 id → 默认 target handle）
 *  - 透明不可见契约（opacity 0 / transparent / pointerEvents none），保证不遮挡画布
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const h = vi.hoisted(() => {
  const handleProps = []
  return {
    handleProps,
    HandleMock: (props) => {
      h.handleProps.push(props)
      return null
    },
  }
})

vi.mock('@xyflow/react', () => ({
  Handle: (props) => h.HandleMock(props),
}))

import GhostTargetNode from '../../src/components/nodes/GhostTargetNode.jsx'

describe('GhostTargetNode', () => {
  afterEach(() => {
    h.handleProps.length = 0
  })

  it('渲染一个 target 类型 Handle（复刻官方 ghostTarget 契约）', () => {
    render(<GhostTargetNode />)
    expect(h.handleProps).toHaveLength(1)
    const p = h.handleProps[0]
    expect(p.type).toBe('target')
    expect(p.position).toBe('left')
    // 无 id → 使用默认 target handle id（null），与 App.jsx 建 ghost-edge 的 target 契约一致
    expect(p.id).toBeUndefined()
  })

  it('Handle 透明不可见：不遮挡画布交互', () => {
    render(<GhostTargetNode />)
    const s = h.handleProps[0].style
    expect(s.background).toBe('transparent')
    expect(s.border).toBe(0)
    expect(s.opacity).toBe(0)
    expect(s.pointerEvents).toBe('none')
    // 铺满整个节点（1x1 透明节点的全部区域）
    expect(s.width).toBe('100%')
    expect(s.height).toBe('100%')
  })
})
