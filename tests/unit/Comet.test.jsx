// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Comet from '../../src/components/Comet.jsx'

describe('Comet', () => {
  it('挂载不崩，渲染粒子容器', () => {
    const { container } = render(<Comet pathRef="cust-edge-mpath-e1" edgeId="e1" isActive />)
    expect(container.querySelector('g.cust-edge-comet')).toBeTruthy()
  })

  it('active 状态加 is-active class', () => {
    const { container } = render(<Comet edgeId="e1" isActive />)
    expect(container.querySelector('g.cust-edge-comet.is-active')).toBeTruthy()
  })

  it('非 active 不加 is-active class', () => {
    const { container } = render(<Comet edgeId="e1" isActive={false} />)
    expect(container.querySelector('g.cust-edge-comet.is-active')).toBeFalsy()
  })

  it('未传 pathRef 时回退到 edgeId 推导的 mpath', () => {
    const { container } = render(<Comet edgeId="abc" />)
    const mpath = container.querySelector('mpath')
    expect(mpath && mpath.getAttribute('xlink:href')).toBe('#cust-edge-mpath-abc')
  })
})
