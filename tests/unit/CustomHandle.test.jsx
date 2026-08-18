// @vitest-environment jsdom
/**
 * CustomHandle 深度测试。
 *
 * 自定义连接端口（复刻原 _Component12.jsx）：大号(48px)/小号(32px)、左/右端口、
 * 鼠标移动追踪（--cust-shift-x/y CSS 变量驱动十字指示器）。此前测试只有「挂载不崩」
 * 冒烟，无法检测端口定位/变体/追踪契约。
 * 本文件捕获 Handle 收到的 props 并直接驱动真实 mousemove，断言：
 *  - large/small 变体的尺寸（48/32）与样式偏移（-half 使圆心贴主框边缘）
 *  - left/right 的 Handle type/position 与定位
 *  - mousemove 更新 --cust-shift-x/y、mouseleave 归零
 *  - 左端口 shift-x 只往左侧（≤0）、右端口只往右侧（≥0）
 */
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

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

import CustomHandle from '../../src/components/edges/CustomHandle.jsx'

describe('CustomHandle — 变体与定位', () => {
  afterEach(() => {
    h.handleProps.length = 0
  })

  function setup(props) {
    const view = render(<CustomHandle {...props} />)
    const wrap = view.container.querySelector('.cust-handle-wrap')
    return { view, wrap }
  }

  it('large 变体（默认）：48px 端口，偏移 -24 使圆心贴边', () => {
    const { wrap } = setup({ position: 'right' })
    expect(wrap.style.width).toBe('48px')
    expect(wrap.style.height).toBe('48px')
    expect(wrap.style.right).toBe('-24px')
    expect(wrap.className).not.toContain('is-small')
  })

  it('small 变体：32px 端口，偏移 -16', () => {
    const { wrap } = setup({ variant: 'small', position: 'left' })
    expect(wrap.style.width).toBe('32px')
    expect(wrap.style.height).toBe('32px')
    expect(wrap.style.left).toBe('-16px')
    expect(wrap.className).toContain('is-small')
  })

  it('left 端口：target Handle + left 定位 + 外偏移', () => {
    setup({ position: 'left' })
    expect(h.handleProps).toHaveLength(1)
    expect(h.handleProps[0].type).toBe('target')
    expect(h.handleProps[0].position).toBe('left')
    expect(h.handleProps[0].id).toBeUndefined()
  })

  it('right 端口：source Handle + right 定位 + 外偏移', () => {
    setup({ position: 'right' })
    expect(h.handleProps[0].type).toBe('source')
    expect(h.handleProps[0].position).toBe('right')
  })

  it('可传 handleId 与自定义 top', () => {
    const { wrap } = setup({ position: 'right', handleId: 'out-1', top: '60%' })
    expect(h.handleProps[0].id).toBe('out-1')
    expect(wrap.style.top).toBe('calc(60% - 24px)')
  })

  it('默认 top 垂直居中', () => {
    const { wrap } = setup({ position: 'left' })
    expect(wrap.style.top).toBe('calc(50% - 24px)')
  })

  it('Handle 本体透明铺满端口区域（视觉由 CSS 伪元素提供）', () => {
    setup({ position: 'left' })
    const s = h.handleProps[0].style
    expect(s.opacity).toBe(0)
    expect(s.background).toBe('transparent')
    expect(s.border).toBe(0)
    expect(s.width).toBe('100%')
    expect(s.height).toBe('100%')
  })
})

describe('CustomHandle — 鼠标追踪（--cust-shift-x/y）', () => {
  afterEach(() => {
    h.handleProps.length = 0
    vi.restoreAllMocks()
  })

  function setup(props) {
    const view = render(<CustomHandle {...props} />)
    const wrap = view.container.querySelector('.cust-handle-wrap')
    return { view, wrap }
  }

  it('mousemove 设置 --cust-shift-x/y（钳制 ±14）', () => {
    const { wrap } = setup({ position: 'left' })
    // wrap 尺寸为 0x0，圆心在 (0,0)；鼠标在 (-40, 30)：dx=clamp(-40*0.35,-14,14)=-14，dy=clamp(30*0.35)=10.5
    fireEvent.mouseMove(wrap, { clientX: -40, clientY: 30 })
    expect(wrap.style.getPropertyValue('--cust-shift-x')).toBe('-14px')
    expect(wrap.style.getPropertyValue('--cust-shift-y')).toBe('10.5px')
  })

  it('左端口 shift-x 只偏左（≤0），即使鼠标在右侧也归 0', () => {
    const { wrap } = setup({ position: 'left' })
    fireEvent.mouseMove(wrap, { clientX: 100, clientY: 0 })
    // dx = clamp(100*0.35, ±14) = 14，但 isLeft 强制 Math.min(0, dx) = 0
    expect(wrap.style.getPropertyValue('--cust-shift-x')).toBe('0px')
  })

  it('右端口 shift-x 只偏右（≥0），即使鼠标在左侧也归 0', () => {
    const { wrap } = setup({ position: 'right' })
    fireEvent.mouseMove(wrap, { clientX: -100, clientY: 0 })
    // dx = clamp(-100*0.35, ±14) = -14，但 isRight 强制 Math.max(0, dx) = 0
    expect(wrap.style.getPropertyValue('--cust-shift-x')).toBe('0px')
  })

  it('mouseleave 将偏移归零', () => {
    const { wrap } = setup({ position: 'right' })
    fireEvent.mouseMove(wrap, { clientX: 50, clientY: 50 })
    expect(wrap.style.getPropertyValue('--cust-shift-x')).not.toBe('0px')
    fireEvent.mouseLeave(wrap)
    expect(wrap.style.getPropertyValue('--cust-shift-x')).toBe('0px')
    expect(wrap.style.getPropertyValue('--cust-shift-y')).toBe('0px')
  })

  it('卸载后不再响应 mousemove（监听已清理，不泄漏）', () => {
    const { view, wrap } = setup({ position: 'right' })
    fireEvent.mouseMove(wrap, { clientX: 50, clientY: 0 })
    expect(wrap.style.getPropertyValue('--cust-shift-x')).toBe('14px')
    view.unmount()
    // 重置后再次触发 mousemove：若监听未清理会重新设置 CSS 变量
    wrap.style.setProperty('--cust-shift-x', '0px')
    fireEvent.mouseMove(wrap, { clientX: 50, clientY: 0 })
    expect(wrap.style.getPropertyValue('--cust-shift-x')).toBe('0px')
  })
})
