/**
 * ConnectionLine 深度测试。
 *
 * 拖拽中的临时连线（复刻原 Pg.jsx）：与选中 comet 同一套视觉
 * （cust-edge-glow + cust-edge-base is-active + 粒子流光）。
 * 关键契约：LOD 降级 —— lodLevel>=2（缩到很小）时关闭辉光与粒子流，只保留基础线。
 * 此前测试只有「挂载不崩」冒烟，LOD 降级分支完全测不出。
 * 本文件 mock useLod 控制 lodLevel，断言：
 *  - lodLevel<2：基础线 + 辉光 + 粒子流全部渲染
 *  - lodLevel>=2：辉光与粒子流消失，基础线保留（性能降级）
 *  - bezier path d 透传给各层 path
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const h = vi.hoisted(() => {
  const particles = []
  let lodLevel = 0
  return {
    particles,
    CometParticlesMock: (props) => {
      h.particles.push(props)
      return <g data-testid="comet-particles" />
    },
    setLodLevel: (v) => { lodLevel = v },
    useLodMock: () => ({ lodLevel }),
  }
})

vi.mock('@xyflow/react', () => ({
  getBezierPath: vi.fn(() => ['M0,0 C10,10 90,10 100,100']),
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}))

vi.mock('../../src/components/base/CometParticles.tsx', () => ({
  default: (props) => h.CometParticlesMock(props),
}))

vi.mock('../../src/components/base/lod.tsx', () => ({
  useLod: () => h.useLodMock(),
}))

import ConnectionLine from '../../src/components/edges/ConnectionLine.tsx'

describe('ConnectionLine — 正常渲染（lodLevel < 2）', () => {
  afterEach(() => {
    h.particles.length = 0
    h.setLodLevel(0)
  })

  function setup(props = {}) {
    const view = render(
      <ConnectionLine fromX={0} fromY={0} toX={100} toY={100} {...props} />
    )
    return view
  }

  it('渲染隐藏 mpath path（供粒子沿其运动）', () => {
    const view = setup()
    const mpath = view.container.querySelector('#cust-conn-mpath')
    expect(mpath).toBeTruthy()
    expect(mpath.getAttribute('d')).toBe('M0,0 C10,10 90,10 100,100')
  })

  it('渲染基础线 + 辉光层（is-active）', () => {
    const view = setup()
    expect(view.container.querySelector('.cust-edge-base')).toBeTruthy()
    expect(view.container.querySelector('.cust-edge-base.is-active')).toBeTruthy()
    expect(view.container.querySelector('.cust-edge-glow')).toBeTruthy()
    expect(view.container.querySelector('.cust-edge-glow.is-active')).toBeTruthy()
  })

  it('lodLevel<2 时渲染粒子流光', () => {
    const view = setup()
    expect(h.particles).toHaveLength(1)
    expect(h.particles[0].pathId).toBe('cust-conn-mpath')
    expect(h.particles[0].headRadius).toBe(3.6)
    expect(view.container.querySelector('[data-testid="comet-particles"]')).toBeTruthy()
  })

  it('bezier path d 透传给各层 path', () => {
    const view = setup()
    const d = 'M0,0 C10,10 90,10 100,100'
    expect(view.container.querySelector('.cust-edge-base').getAttribute('d')).toBe(d)
    expect(view.container.querySelector('.cust-edge-glow').getAttribute('d')).toBe(d)
  })
})

describe('ConnectionLine — LOD 性能降级（lodLevel >= 2）', () => {
  afterEach(() => {
    h.particles.length = 0
    h.setLodLevel(0)
  })

  function setup(lod) {
    h.setLodLevel(lod)
    const view = render(<ConnectionLine fromX={0} fromY={0} toX={100} toY={100} />)
    return view
  }

  it('lodLevel=2：关闭辉光与粒子流，保留基础线', () => {
    const view = setup(2)
    expect(view.container.querySelector('.cust-edge-base')).toBeTruthy()
    expect(view.container.querySelector('.cust-edge-glow')).toBeNull()
    expect(h.particles).toHaveLength(0)
  })

  it('lodLevel=3（最小视图）：同样关闭特效', () => {
    const view = setup(3)
    expect(view.container.querySelector('.cust-edge-base')).toBeTruthy()
    expect(view.container.querySelector('.cust-edge-glow')).toBeNull()
    expect(h.particles).toHaveLength(0)
  })
})
