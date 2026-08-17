// @vitest-environment jsdom
/**
 * useLocalToolStatus 单测（批 3）。
 * 覆盖 useLocalToolStatus()：
 *   - 挂载即检测一次（fetch ${API_BASE}/api/status）
 *   - body.status==='ok' → status.isConnected true
 *   - HTTP 非 ok / body.status 非 'ok' → status.isConnected false
 *   - fetch 抛错（工具未启动）→ status.isConnected false
 *   - 手动 checkConnection 可覆盖上次结果（offline→online）
 * 用 fake timers 避免 5s 轮询产生 open handle；fetch 用 vi.stubGlobal 显式 mock。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { useLocalToolStatus } = await import('../../src/components/base/useLocalToolStatus.js')

const okBody = { ok: true, json: async () => ({ status: 'ok' }) }
const badBody = { ok: true, json: async () => ({ status: 'down' }) }
const notOk = { ok: false, status: 503, json: async () => ({}) }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useLocalToolStatus', () => {
  it('ping 200 + body.status=ok → status.isConnected true', async () => {
    globalThis.fetch.mockResolvedValue(okBody)
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('ping 非 200 → status.isConnected false', async () => {
    globalThis.fetch.mockResolvedValue(notOk)
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(false)
  })

  it('body.status 非 ok → status.isConnected false', async () => {
    globalThis.fetch.mockResolvedValue(badBody)
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(false)
  })

  it('ping 抛错（工具未启动）→ status.isConnected false', async () => {
    globalThis.fetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(false)
  })

  it('手动 checkConnection 覆盖上次结果（从 offline 到 online）', async () => {
    globalThis.fetch.mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(false)

    globalThis.fetch.mockResolvedValue(okBody)
    await act(async () => { await result.current.checkConnection() })
    expect(result.current.status.isConnected).toBe(true)
  })
})
