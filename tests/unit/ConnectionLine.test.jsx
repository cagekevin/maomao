// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// 路径计算与 LOD 为外部依赖，统一 mock：getBezierPath 返回固定 path，Position 透传。
vi.mock('@xyflow/react', () => ({
  getBezierPath: () => ['M0 0 L 10 10'],
  Position: { Left: 'left', Right: 'right' },
}))

// ConnectionLine 依赖 CometParticles（纯 SVG，无外部依赖，保留真实实现以验证渲染）
import ConnectionLine from '../../src/components/ConnectionLine.jsx'
import { LodContext } from '../../src/components/base/useLod.js'

function renderAt(lodLevel, props = {}) {
  return render(
    <LodContext.Provider value={{ lodLevel, viewportMoving: false, nodeCount: 0, handleFollowLimit: 60, edgeFxLimit: 50, useThumbnail: false }}>
      <svg>
        <ConnectionLine fromX={0} fromY={0} toX={100} toY={100} {...props} />
      </svg>
    </LodContext.Provider>
  )
}

describe('ConnectionLine', () => {
  it('挂载不崩，渲染基础连线 path', () => {
    const { container } = renderAt(0)
    expect(container.querySelector('.cust-edge-base.is-active')).toBeTruthy()
  })

  it('lodLevel < 2 时启用辉光 + 粒子流光', () => {
    const { container } = renderAt(1)
    expect(container.querySelector('.cust-edge-glow.is-active')).toBeTruthy()
    // CometParticles 渲染 <g aria-hidden="true">
    expect(container.querySelector('g[aria-hidden="true"]')).toBeTruthy()
  })

  it('lodLevel >= 2 时关闭辉光与粒子（性能降级）', () => {
    const { container } = renderAt(2)
    expect(container.querySelector('.cust-edge-glow.is-active')).toBeFalsy()
    expect(container.querySelector('g[aria-hidden="true"]')).toBeFalsy()
    // 基础线始终存在
    expect(container.querySelector('.cust-edge-base.is-active')).toBeTruthy()
  })
})
