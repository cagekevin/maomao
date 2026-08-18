// @vitest-environment jsdom
/**
 * LazyImage 关键交互锚点（P9 懒加载复用原语）。
 *
 * LazyImage 是全局懒加载图片复用组件（复刻官方 Lg.jsx）：
 * IntersectionObserver（rootMargin 120px）判定进入视口附近才挂载 <img>，
 * 避免大画布多图/素材网格一次性解码全部图片。
 *
 * 本文件锁定最易回归的 3 条语义：
 *  - 懒加载：未进入视口不挂载 <img>（只留占位 div）；进入视口才挂载
 *  - 降级：无 IntersectionObserver 环境直接显示（不依赖 IO）
 *  - 兜底：加载失败显示「破图占位」，不再保留裂图
 */
import React, { act } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// toAbsoluteFileUrl：仅归一化相对 /files/ 路径；空串保持空（决定「无 src 不挂载」）
vi.mock('../../src/components/base/filesApi.js', () => ({
  toAbsoluteFileUrl: (u) => (u && u.startsWith('/files/') ? `ABS:${u}` : u || ''),
}))

import LazyImage from '../../src/components/base/LazyImage.jsx'

// 可操控的 IntersectionObserver 假实现：手动触发回调驱动「进入视口」
const h = vi.hoisted(() => {
  class FakeIO {
    static instances = []
    constructor(cb) {
      this.cb = cb
      FakeIO.instances.push(this)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  return { FakeIO }
})

const triggerIntersect = (entries) => {
  act(() => {
    for (const io of h.FakeIO.instances) io.cb(entries, io)
  })
}

beforeEach(() => {
  h.FakeIO.instances = []
  global.IntersectionObserver = h.FakeIO
})

describe('LazyImage — 懒加载语义', () => {
  it('未进入视口 → 只留占位 div，不挂载 <img>（延迟解码）', () => {
    render(<LazyImage src="http://x/a.png" />)
    expect(document.querySelector('img')).toBeNull()
    expect(h.FakeIO.instances.length).toBe(1)
  })

  it('未相交 → 保持不挂载；进入视口（isIntersecting）才挂载 <img>', () => {
    render(<LazyImage src="http://x/b.png" />)
    triggerIntersect([{ isIntersecting: false }])
    expect(document.querySelector('img')).toBeNull()

    triggerIntersect([{ isIntersecting: true }])
    const img = document.querySelector('img')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('http://x/b.png')
  })

  it('相对 /files/ 路径 → 经 toAbsoluteFileUrl 归一为绝对地址后挂载', () => {
    render(<LazyImage src="/files/pic.png" />)
    triggerIntersect([{ isIntersecting: true }])
    const img = document.querySelector('img')
    expect(img.getAttribute('src')).toBe('ABS:/files/pic.png')
  })
})

describe('LazyImage — 降级与兜底', () => {
  it('无 IntersectionObserver（旧环境）→ 直接挂载，不依赖 IO', () => {
    delete global.IntersectionObserver
    render(<LazyImage src="http://x/c.png" />)
    expect(document.querySelector('img')).toBeTruthy()
  })

  it('加载失败 → 显示「破图占位」，不再保留 <img>', () => {
    render(<LazyImage src="http://x/d.png" />)
    triggerIntersect([{ isIntersecting: true }])
    const img = document.querySelector('img')
    expect(img).toBeTruthy()

    fireEvent.error(img)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText('图片加载失败')).toBeTruthy()
  })

  it('src 为空 → 永不挂载 <img>', () => {
    render(<LazyImage src="" />)
    triggerIntersect([{ isIntersecting: true }])
    expect(document.querySelector('img')).toBeNull()
  })
})
