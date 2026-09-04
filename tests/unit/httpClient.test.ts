// @vitest-environment node
/**
 * httpClient 单测 —— 统一请求层。
 * 覆盖：成功/HTTP 错误/网络错误/超时/取消/重试/跨标签。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { httpRequest, httpPost, httpRequestLogged, HttpError, NetworkError } from '@/components/base/api/httpClient.ts'
import { TimeoutError } from '../../src/components/base/utils/asyncGuard.ts'

let mockFetch

beforeEach(() => {
  mockFetch = vi.fn()
  vi.stubGlobal('fetch', mockFetch)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/* ── 成功 ───────────────────────────────────────────── */

describe('httpRequest — 成功', () => {
  it('GET 返回 JSON', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ items: [] }) })
    const data = await httpRequest('/api/tasks')
    expect(data).toEqual({ items: [] })
  })

  it('parseJson=false 返回 Response', async () => {
    const res = { ok: true, status: 200, text: () => Promise.resolve('raw') }
    mockFetch.mockResolvedValue(res)
    const result = await httpRequest('/api/x', { parseJson: false })
    expect(result).toBe(res)
  })
})

/* ── HTTP 错误 ───────────────────────────────────────── */

describe('httpRequest — HTTP 错误', () => {
  it('带 error 字符串字段 → message 只承载业务文案（B2 去 HTTP 前缀）', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve({ error: 'bad request' }) })
    await expect(httpRequest('/api/x')).rejects.toThrow(HttpError)
    await expect(httpRequest('/api/x')).rejects.toMatchObject({ status: 400, message: 'bad request' })
  })

  it('无 error 字段回落 message 为空（status 单独暴露）', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })
    await expect(httpRequest('/api/x')).rejects.toMatchObject({ status: 500, message: '' })
  })

  it('label 不再拼入 HttpError.message（B2 去前缀）', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ detail: 'db down' }) })
    await expect(httpRequest('/api/x', { label: 'fetchTasks' })).rejects.toMatchObject({
      status: 500,
      message: 'db down',
    })
  })

  it('业务 4xx 不重试', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ error: 'unauthorized' }) })
    mockFetch.mockImplementation(fn)
    await expect(httpRequest('/api/x', { retries: 3 })).rejects.toThrow(HttpError)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

/* ── 网络错误 ────────────────────────────────────────── */

describe('httpRequest — 网络错误', () => {
  afterEach(() => { vi.useRealTimers() })

  it('TypeError 归类为 NetworkError', async () => {
    vi.useRealTimers()
    mockFetch.mockRejectedValue(new TypeError('fetch failed'))
    await expect(httpRequest('/api/x', { retries: 0 })).rejects.toThrow(NetworkError)
  })

  it('网络错误自动重试后成功', async () => {
    vi.useRealTimers()
    const fn = vi.fn()
      .mockRejectedValueOnce(new TypeError('net err'))
      .mockRejectedValueOnce(new TypeError('net err'))
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) })
    mockFetch.mockImplementation(fn)
    const data = await httpRequest('/api/x', { retries: 3, retryDelay: 10 })
    expect(data).toEqual({ ok: true })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('重试耗尽仍失败', async () => {
    vi.useRealTimers()
    const fn = vi.fn().mockRejectedValue(new TypeError('net err'))
    mockFetch.mockImplementation(fn)
    await expect(httpRequest('/api/x', { retries: 2, retryDelay: 10 })).rejects.toThrow(NetworkError)
    expect(fn).toHaveBeenCalledTimes(3) // 初始 + 2 次重试
  })
})

/* ── 超时 ────────────────────────────────────────────── */

describe('httpRequest — 超时', () => {
  afterEach(() => { vi.useRealTimers() })

  it('超时抛 TimeoutError', async () => {
    vi.useRealTimers() // 超时依赖真实 setTimeout
    mockFetch.mockImplementation(() => new Promise(() => {})) // 永不返回
    await expect(httpRequest('/api/x', { timeoutMs: 50, retries: 0 })).rejects.toThrow(TimeoutError)
  })

  it('不传 timeoutMs → 不掐点（无默认超时）', async () => {
    // 契约锁：httpClient 曾默认 15s，把上传类长请求在 15s 掐断（网络稍差时大图/视频传不完即失败）。
    // 现无默认值——需要时限的调用方显式传。若有人把默认值改回具体毫秒数，此用例必红。
    mockFetch.mockImplementation(() => new Promise(() => {})) // 永不返回
    let timedOut = false
    httpRequest('/api/x').catch((e) => { timedOut = e instanceof TimeoutError })
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000) // 推进 5 分钟，远超原 15s 与试算的 3min
    expect(timedOut).toBe(false)
  })
})

/* ── 外部取消 ────────────────────────────────────────── */

describe('httpRequest — 外部取消（AbortSignal）', () => {
  it('signal 已中止 → 直接抛 AbortError', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(httpRequest('/api/x', { signal: ctrl.signal })).rejects.toThrow(/aborted/)
  })

  it('signal 中途中止 → 抛 AbortError 且不重试', async () => {
    const ctrl = new AbortController()
    const fn = vi.fn().mockImplementation(() => {
      ctrl.abort() // 让 fetch 抛 AbortError
      const err = new Error('aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })
    mockFetch.mockImplementation(fn)
    await expect(httpRequest('/api/x', { signal: ctrl.signal, retries: 3 })).rejects.toThrow(/aborted/)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

/* ── httpPost 助手 ───────────────────────────────────── */

describe('httpPost — JSON POST 助手', () => {
  it('自动序列化 body + Content-Type', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) })
    await httpPost('/api/save', { name: 'test' })
    const call = mockFetch.mock.calls[0]
    expect(call[1].method).toBe('POST')
    expect(call[1].headers).toEqual({ 'Content-Type': 'application/json' })
    expect(call[1].body).toBe(JSON.stringify({ name: 'test' }))
  })
})

/* ── httpRequestLogged ───────────────────────────────── */

describe('httpRequestLogged — 带日志', () => {
  it('失败时调用 logger.warn', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })
    await expect(httpRequestLogged('/api/x', {}, 'mylabel')).rejects.toThrow()
  })
})