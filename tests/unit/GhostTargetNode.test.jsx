// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Handle } from '@xyflow/react'
import GhostTargetNode from '../../src/components/GhostTargetNode.jsx'

// GhostTargetNode 本身仅是透明 Handle 占位，依赖 @xyflow/react 的 Handle。
// 这里把 Handle 替换成纯标记，验证组件结构（透明占位 + target handle）即可。
vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, style }) => (
    <div
      data-testid="ghost-handle"
      data-type={type}
      data-position={position}
      data-opacity={style ? String(style.opacity) : ''}
    />
  ),
}))

describe('GhostTargetNode', () => {
  it('渲染一个透明 target Handle（让 React Flow 能解析幽灵边）', () => {
    const { container } = render(<GhostTargetNode />)
    const h = container.querySelector('[data-testid="ghost-handle"]')
    expect(h).toBeTruthy()
    expect(h.getAttribute('data-type')).toBe('target')
    expect(h.getAttribute('data-position')).toBe('left')
    expect(h.getAttribute('data-opacity')).toBe('0')
  })
})
