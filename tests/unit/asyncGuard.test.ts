import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withTimeout, isTimeoutError, TimeoutError, loadImageWithTimeout } from '../../src/components/base/asyncGuard.ts'

describe('asyncGuard.withTimeout（R2 统一异步超时）', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('正常 resolve：超时前完成 → 返回原值', async () => {
    const p = Promise.resolve(42)
    const r = await withTimeout(p, 5000)
    expect(r).toBe(42)
  })

  it('正常 reject：超时前失败 → 透传原错误（非超时）', async () => {
    const p = Promise.reject(new Error('真实失败'))
    const err = await withTimeout(p, 5000).catch((e) => e)
    expect(err.message).toBe('真实失败')
    expect(isTimeoutError(err)).toBe(false)
  })

  it('超时：超过 ms 未完成 → reject TimeoutError', async () => {
    const never = new Promise(() => {}) // 永不 resolve
    const p = withTimeout(never, 1000, '自定义超时')
    let settled = false
    p.catch(() => { settled = true })
    await vi.advanceTimersByTimeAsync(1001)
    expect(settled).toBe(true)
    await expect(p).rejects.toThrow('自定义超时')
  })

  it('超时错误可被 isTimeoutError 识别，真实失败不可', async () => {
    expect(isTimeoutError(new TimeoutError())).toBe(true)
    expect(isTimeoutError(new Error('普通错误'))).toBe(false)
    expect(isTimeoutError(null)).toBe(false)
  })

  it('无效 ms（<=0）直接透传原 Promise，不加超时', async () => {
    const p = Promise.resolve('v')
    expect(await withTimeout(p, 0)).toBe('v')
  })

  it('超时触发 onTimeout 回调（供取消底层任务）', async () => {
    const never = new Promise(() => {})
    const onTimeout = vi.fn()
    const p = withTimeout(never, 1000, '超时', undefined, onTimeout)
    p.catch(() => {})
    await vi.advanceTimersByTimeAsync(1001)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    await expect(p).rejects.toThrow('超时')
  })

  it('超时中止传入的 signal（真实定时器；jsdom 的 AbortSignal 无 abort()，走 dispatchEvent fallback）', async () => {
    vi.useRealTimers()
    const never = new Promise(() => {})
    const ctl = new AbortController()
    let aborted = false
    ctl.signal.addEventListener('abort', () => { aborted = true })
    const p = withTimeout(never, 30, '超时', ctl.signal)
    p.catch(() => {})
    expect(aborted).toBe(false)
    await new Promise((r) => setTimeout(r, 60))
    expect(aborted).toBe(true)
  })

  it('正常完成时不触发 onTimeout 也不 abort signal', async () => {
    const ctl = new AbortController()
    const onTimeout = vi.fn()
    const p = withTimeout(Promise.resolve('v'), 5000, '超时', ctl.signal, onTimeout)
    expect(await p).toBe('v')
    expect(onTimeout).not.toHaveBeenCalled()
    expect(ctl.signal.aborted).toBe(false)
  })
})

describe('asyncGuard.loadImageWithTimeout（统一图片加载入口）', () => {
  afterEach(() => { vi.useRealTimers() })

  it('onload 成功 → resolve HTMLImageElement', async () => {
    const img: { src: string; crossOrigin: string; onload: (() => void) | null; onerror: (() => void) | null } = { src: '', crossOrigin: '', onload: null, onerror: null }
    global.Image = vi.fn(() => img) as unknown as typeof Image
    const p = loadImageWithTimeout('http://x/a.png')
    img.onload()
    expect(await p).toBe(img)
  })

  it('onerror 失败 → reject 明确错误', async () => {
    const img: { src: string; crossOrigin: string; onload: (() => void) | null; onerror: (() => void) | null } = { src: '', crossOrigin: '', onload: null, onerror: null }
    global.Image = vi.fn(() => img) as unknown as typeof Image
    const p = loadImageWithTimeout('http://x/a.png')
    img.onerror()
    await expect(p).rejects.toThrow('图片加载失败')
  })

  it('超时未加载 → reject TimeoutError（不再永久挂起）', async () => {
    vi.useFakeTimers()
    const img: { src: string; crossOrigin: string; onload: (() => void) | null; onerror: (() => void) | null } = { src: '', crossOrigin: '', onload: null, onerror: null }
    global.Image = vi.fn(() => img) as unknown as typeof Image
    const p = loadImageWithTimeout('http://x/a.png', { timeoutMs: 1000 })
    let settled = false
    p.catch(() => { settled = true })
    await vi.advanceTimersByTimeAsync(1001)
    expect(settled).toBe(true)
    await expect(p).rejects.toThrow('图片加载超时')
  })

  it('设置 crossOrigin = anonymous（跨域 canvas 不污染）', () => {
    const img: { src: string; crossOrigin: string; onload: (() => void) | null; onerror: (() => void) | null } = { src: '', crossOrigin: '', onload: null, onerror: null }
    global.Image = vi.fn(() => img) as unknown as typeof Image
    loadImageWithTimeout('http://x/a.png')
    expect(img.crossOrigin).toBe('anonymous')
  })
})
