// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// CustomHandle 依赖 @xyflow/react 的 Handle，mock 成透明标记便于断言结构。
vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, id, className }) => (
    <div
      data-testid="xy-handle"
      data-type={type}
      data-position={position || ''}
      data-id={id || ''}
      data-class={className || ''}
    />
  ),
}))

import CustomHandle from '../../src/components/CustomHandle.jsx'

describe('CustomHandle', () => {
  it('挂载不崩，渲染外层包裹 + Handle + 三个指示 span', () => {
    const { container } = render(<CustomHandle position="right" variant="large" />)
    expect(container.querySelector('.cust-handle-wrap')).toBeTruthy()
    expect(container.querySelector('[data-testid="xy-handle"]')).toBeTruthy()
    expect(container.querySelectorAll('.cust-handle-ring, .cust-handle-plus, .cust-handle-dot').length).toBe(3)
  })

  it('左端口渲染为 target handle', () => {
    const { container } = render(<CustomHandle position="left" />)
    expect(container.querySelector('[data-testid="xy-handle"]').getAttribute('data-type')).toBe('target')
  })

  it('右端口渲染为 source handle', () => {
    const { container } = render(<CustomHandle position="right" />)
    expect(container.querySelector('[data-testid="xy-handle"]').getAttribute('data-type')).toBe('source')
  })

  it('large 变体不加 is-small，small 变体加', () => {
    const { container: c1 } = render(<CustomHandle position="left" variant="large" />)
    expect(c1.querySelector('.cust-handle-wrap.is-small')).toBeFalsy()
    const { container: c2 } = render(<CustomHandle position="left" variant="small" />)
    expect(c2.querySelector('.cust-handle-wrap.is-small')).toBeTruthy()
  })

  it('mousemove 更新 --cust-shift-x/y CSS 变量不抛错', () => {
    const { container } = render(<CustomHandle position="left" />)
    const wrap = container.querySelector('.cust-handle-wrap')
    // jsdom getBoundingClientRect 默认全 0，仅验证不抛错
    expect(() => fireEvent.mouseMove(wrap, { clientX: 10, clientY: 10 })).not.toThrow()
  })
})
