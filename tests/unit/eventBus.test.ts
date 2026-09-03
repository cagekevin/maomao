import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  subscribe,
  publish,
  subscribeOnce,
  clearEvent,
} = await import('../../src/components/base/core/eventBus.ts')

beforeEach(() => {
  // 清空所有事件订阅，保证测试独立
  clearEvent('test:event')
  clearEvent('test:once')
})

describe('eventBus §基础设施 订阅/发布', () => {
  it('subscribe 后 publish 同步调用订阅者并传入 payload', () => {
    const fn = vi.fn()
    subscribe('test:event', fn)
    publish('test:event', { a: 1 })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith({ a: 1 })
  })

  it('多个订阅者都会收到', () => {
    const f1 = vi.fn()
    const f2 = vi.fn()
    subscribe('test:event', f1)
    subscribe('test:event', f2)
    publish('test:event', 'x')
    expect(f1).toHaveBeenCalledWith('x')
    expect(f2).toHaveBeenCalledWith('x')
  })

  it('取消订阅后不再收到', () => {
    const fn = vi.fn()
    const off = subscribe('test:event', fn)
    off()
    publish('test:event', 'y')
    expect(fn).not.toHaveBeenCalled()
  })

  it('非法参数（空事件/非函数）返回安全的 noop 取消函数', () => {
    const off = subscribe('', null)
    expect(typeof off).toBe('function')
    expect(() => off()).not.toThrow()
  })

  it('发布无人订阅的事件不抛错', () => {
    expect(() => publish('test:none', 1)).not.toThrow()
  })
})

describe('eventBus §基础设施 subscribeOnce', () => {
  it('只触发一次后自动取消', () => {
    const fn = vi.fn()
    subscribeOnce('test:once', fn)
    publish('test:once', 1)
    publish('test:once', 2)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(1)
  })

  it('subscribeOnce 返回取消函数可提前退订', () => {
    const fn = vi.fn()
    const off = subscribeOnce('test:once', fn)
    off()
    publish('test:once', 1)
    expect(fn).not.toHaveBeenCalled()
  })
})
