// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deepClone, formatTime, debounce, throttle, useDebouncedEffect } from '../../src/components/base/utils.js'
import { renderHook } from '@testing-library/react'

describe('deepClone', () => {
  it('深拷贝普通对象，不共享引用', () => {
    const src = { a: 1, b: { c: 2 }, list: [1, 2] }
    const copy = deepClone(src)
    expect(copy).toEqual(src)
    expect(copy).not.toBe(src)
    expect(copy.b).not.toBe(src.b)
    expect(copy.list).not.toBe(src.list)
  })

  it('返回 undefined 时保持 undefined', () => {
    expect(deepClone(undefined)).toBe(undefined)
  })
})

describe('formatTime', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('默认 zh-CN locale（TaskCenter 语义）', () => {
    vi.setSystemTime(new Date(2026, 7, 18, 14, 30, 45))
    const out = formatTime(Date.now())
    expect(out).toContain('2026')
    expect(out).toContain('14:30:45')
  })

  it('mode=time 返回 HH:mm:ss（logger 语义）', () => {
    vi.setSystemTime(new Date(2026, 7, 18, 14, 30, 45))
    expect(formatTime(Date.now(), { mode: 'time' })).toBe('14:30:45')
  })

  it('mode=file 返回 yyyymmdd_HHmmss（filesApi 文件名语义）', () => {
    vi.setSystemTime(new Date(2026, 7, 18, 14, 30, 5))
    expect(formatTime(Date.now(), { mode: 'file' })).toBe('20260818_143005')
  })

  it('非法时间戳返回空串', () => {
    expect(formatTime('invalid', { mode: 'time' })).toBe('')
  })
})

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('延迟执行，多次调用只触发一次', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d()
    d()
    d()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel 取消未执行的定时器', () => {
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d()
    d.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('throttle', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('立即触发一次，间隔内后续调用节流', () => {
    const fn = vi.fn()
    const t = throttle(fn, 100)
    t()
    expect(fn).toHaveBeenCalledTimes(1)
    t()
    t()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancel 取消尾部定时器', () => {
    const fn = vi.fn()
    const t = throttle(fn, 100)
    t()
    t()
    t.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('useDebouncedEffect', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('依赖变化后延迟触发回调', async () => {
    const fn = vi.fn()
    renderHook(() => useDebouncedEffect(fn, [1], 100))
    await vi.advanceTimersByTimeAsync(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('condition=false 时跳过，不触发', async () => {
    const fn = vi.fn()
    renderHook(() => useDebouncedEffect(fn, [1], 100, false))
    await vi.advanceTimersByTimeAsync(200)
    expect(fn).not.toHaveBeenCalled()
  })
})
