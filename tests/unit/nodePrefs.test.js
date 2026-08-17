// @vitest-environment jsdom
/**
 * nodePrefs 单测（批 3）。
 * 覆盖 useNodePrefs(type, defaults)：
 *   - 首读：默认值 + 持久化覆盖
 *   - set：更新并持久化到 localStorage（键 yimao_node_prefs，按 type 分桶）
 *   - 跨「实例」读取：第二个 useNodePrefs 实例能读到上次 set 的值（跨会话/跨窗口记忆）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { useNodePrefs } = await import('../../src/components/base/nodePrefs.js')
const { contentClearCache } = await import('../../src/components/base/contentStore.js')

beforeEach(() => {
  localStorage.clear()
  contentClearCache() // 清 contentStore 内存缓存，防跨测试污染
})

describe('useNodePrefs', () => {
  it('首次读取：默认参数生效', () => {
    const { result } = renderHook(() => useNodePrefs('textNode', { model: 'a', size: '1k' }))
    expect(result.current.prefs).toEqual({ model: 'a', size: '1k' })
  })

  it('set：更新 prefs 并持久化到 localStorage', () => {
    const { result } = renderHook(() => useNodePrefs('textNode', { model: 'a' }))
    act(() => result.current.set({ model: 'b' }))
    expect(result.current.prefs.model).toBe('b')

    // storageAdapter 写入带前缀 yimao:，故完整键为 yimao:yimao_node_prefs
    const raw = localStorage.getItem('yimao:yimao_node_prefs')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw).textNode).toEqual({ model: 'b' })
  })

  it('跨实例记忆：第二个 hook 读取到上次 set 的值', () => {
    const first = renderHook(() => useNodePrefs('textNode', { model: 'a' }))
    act(() => first.result.current.set({ model: 'saved' }))

    const second = renderHook(() => useNodePrefs('textNode', { model: 'a' }))
    expect(second.result.current.prefs.model).toBe('saved')
  })

  it('不同 type 互不污染', () => {
    const t = renderHook(() => useNodePrefs('textNode', {}))
    act(() => t.result.current.set({ x: 1 }))
    const v = renderHook(() => useNodePrefs('videoNode', {}))
    expect(v.result.current.prefs).toEqual({})
  })

  it('localStorage 损坏时不崩，回退默认', () => {
    localStorage.setItem('yimao_node_prefs', '{bad json')
    const { result } = renderHook(() => useNodePrefs('textNode', { model: 'a' }))
    expect(result.current.prefs).toEqual({ model: 'a' })
  })
})
