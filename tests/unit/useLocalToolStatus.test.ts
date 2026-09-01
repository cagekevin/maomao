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

const { useLocalToolStatus } = await import('../../src/hooks/useLocalToolStatus.ts')

// vi.mocked(globalThis.fetch) 包装后返回类型为 Mock，但 mock 的响应体 okBody 等并非真实 Response 形状，
// 用 any 别名承载（运行时 fetch 已被 vi.stubGlobal 替换为 vi.fn）
let fetchMock: ReturnType<typeof vi.fn>

const okBody = { ok: true, json: async () => ({ status: 'ok' }) }
const badBody = { ok: true, json: async () => ({ status: 'down' }) }
const notOk = { ok: false, status: 503, json: async () => ({}) }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  fetchMock = vi.mocked(globalThis.fetch)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useLocalToolStatus', () => {
  it('ping 200 + body.status=ok → status.isConnected true', async () => {
    fetchMock.mockResolvedValue(okBody)
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalled()
  })

  it('ping 非 200 → status.isConnected false', async () => {
    fetchMock.mockResolvedValue(notOk)
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(false)
  })

  it('body.status 非 ok → status.isConnected false', async () => {
    fetchMock.mockResolvedValue(badBody)
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(false)
  })

  it('ping 抛错（工具未启动）→ status.isConnected false', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(false)
  })

  it('手动 checkConnection 覆盖上次结果（从 offline 到 online）', async () => {
    fetchMock.mockRejectedValue(new Error('down'))
    const { result } = renderHook(() => useLocalToolStatus())
    await act(async () => { await Promise.resolve() })
    await act(async () => { await Promise.resolve() })
    expect(result.current.status.isConnected).toBe(false)

    fetchMock.mockResolvedValue(okBody)
    await act(async () => { await result.current.checkConnection() })
    expect(result.current.status.isConnected).toBe(true)
  })
})

describe('useLocalToolStatus 轮询（ensurePoll 幂等回归防线）', () => {
  // 轮询状态（pollTimer / pollIntervalMs / sharedStatus）是模块级单例，
  // 每个用例 resetModules 后重新 import 拿干净实例，避免跨用例污染。
  const freshHook = async () => {
    vi.resetModules()
    return (await import('../../src/hooks/useLocalToolStatus.ts')).useLocalToolStatus
  }

  it('连接状态变化后轮询仍存活', async () => {
    // 回归防线：原实现 restartPoll() 清 timer 后没复位 pollRunning → schedulePoll() 被挡回
    // → interval 被杀后永不重建，连接一变化断线检测就永久失效。此处推进 15s 若不再 ping 即红。
    vi.useFakeTimers()
    try {
      fetchMock.mockResolvedValue(okBody)
      const useIt = await freshHook()
      const { result } = renderHook(() => useIt())
      await act(async () => { await Promise.resolve() })
      await act(async () => { await Promise.resolve() })
      expect(result.current.status.isConnected).toBe(true) // 触发 useEffect → 重建为 15s 间隔

      const before = fetchMock.mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
      expect(fetchMock.mock.calls.length).toBeGreaterThan(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('首次挂载不重复起轮询（幂等：useEffect 那一次被挡掉）', async () => {
    // 回归防线：原实现 subscribe 起一轮（runCheck + schedulePoll 各 ping 一次）、
    // useEffect 首次再起一轮，共 4 次 /api/status，且最后一轮 restartPoll 杀掉 interval 后不重建。
    // 现为 2 次：React 挂载期 subscribe → cleanup → resubscribe 各 ping 一次（真实重订阅，属预期）；
    // useEffect 那次被 ensurePoll 幂等挡掉。**幂等一旦失效就会变成 3 次 → 必红**。
    vi.useFakeTimers()
    try {
      fetchMock.mockResolvedValue(notOk) // 保持未连接，避免状态变化触发重建
      const useIt = await freshHook()
      renderHook(() => useIt())
      await act(async () => { await Promise.resolve() })
      await act(async () => { await Promise.resolve() })
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('已连接走 15s 间隔、未连接走 5s 间隔', async () => {
    vi.useFakeTimers()
    try {
      // 未连接：推进 5s 应触发一次轮询
      fetchMock.mockResolvedValue(notOk)
      const useIt = await freshHook()
      const { result } = renderHook(() => useIt())
      await act(async () => { await Promise.resolve() })
      await act(async () => { await Promise.resolve() })
      const base = fetchMock.mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(fetchMock.mock.calls.length).toBeGreaterThan(base)

      // 切到已连接：间隔变 15s，推进 5s 不应触发（证明间隔确实变了，而非仍是 5s）
      fetchMock.mockResolvedValue(okBody)
      await act(async () => { await result.current.checkConnection() })
      await act(async () => { await Promise.resolve() })
      const afterConnect = fetchMock.mock.calls.length
      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(fetchMock.mock.calls.length).toBe(afterConnect)
    } finally {
      vi.useRealTimers()
    }
  })
})
