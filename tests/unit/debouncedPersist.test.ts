// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDebouncedPersist } from '../../src/components/base/core/contentStore.ts'

describe('createDebouncedPersist（P4 落盘节流原语）', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('高频 schedule：窗口内只落盘 1 次', () => {
    const write = vi.fn()
    const p = createDebouncedPersist(write, 300)
    p.schedule()
    p.schedule()
    p.schedule()
    expect(write).not.toHaveBeenCalled()
    vi.advanceTimersByTime(299)
    expect(write).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('窗口内多次变更合并为最终态（flush 时读最新状态）', () => {
    let state = 'v1'
    const write = vi.fn(() => seen.push(state))
    const seen = []
    const p = createDebouncedPersist(write, 300)
    p.schedule() // state=v1
    state = 'v2'
    p.schedule()
    state = 'v3'
    p.schedule()
    vi.advanceTimersByTime(300)
    // 只写 1 次，且写的是窗口内最终态 v3
    expect(write).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['v3'])
  })

  it('flush() 强制立即落盘（供 beforeunload 兜底）', () => {
    const write = vi.fn()
    const p = createDebouncedPersist(write, 300)
    p.schedule()
    expect(write).not.toHaveBeenCalled()
    p.flush()
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('flush() 后 pending 清空，重复 flush 不重复写', () => {
    const write = vi.fn()
    const p = createDebouncedPersist(write, 300)
    p.schedule()
    p.flush()
    p.flush()
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('cancel() 取消未落盘写', () => {
    const write = vi.fn()
    const p = createDebouncedPersist(write, 300)
    p.schedule()
    p.cancel()
    vi.advanceTimersByTime(300)
    expect(write).not.toHaveBeenCalled()
  })

  it('schedule 后窗口内再次 flush 会清掉定时器，不重复写', () => {
    const write = vi.fn()
    const p = createDebouncedPersist(write, 300)
    p.schedule()
    p.flush() // 立即写 1 次
    vi.advanceTimersByTime(300) // 原定时器已清，不再写
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('pagehide 事件自动触发 flush（页面退出不丢数据）', () => {
    const write = vi.fn()
    const p = createDebouncedPersist(write, 300)
    p.schedule()
    expect(write).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('pagehide'))
    expect(write).toHaveBeenCalledTimes(1)
  })
})
