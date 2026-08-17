// @vitest-environment jsdom
/**
 * useCanvasHistory 单测（批 1-8，hook 桥接）。
 * 覆盖：返回 canUndo/canRedo/record/undo/redo/clear；record 后 canUndo 为真；
 * undo 将历史快照应用到 apply；空历史时 undo/redo 安全不抛。
 * 策略：jsdom + @testing-library/react renderHook；HistoryStack 走真实纯类（已有独立单测），
 * 这里只验证 React 桥接层。提供 getSnapshot 与 apply 两个注入函数。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { useCanvasHistory } = await import('../../src/components/base/useCanvasHistory.js')

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals() })

describe('useCanvasHistory — 基础', () => {
  it('初始 canUndo/canRedo 均为 false，暴露 record/undo/redo/clear', () => {
    const { result } = renderHook(() =>
      useCanvasHistory(() => ({ nodes: [], edges: [] }), () => {})
    )
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
    expect(typeof result.current.record).toBe('function')
    expect(typeof result.current.undo).toBe('function')
    expect(typeof result.current.redo).toBe('function')
    expect(typeof result.current.clear).toBe('function')
  })

  it('空历史时 undo/redo 不抛错', () => {
    const { result } = renderHook(() =>
      useCanvasHistory(() => ({ nodes: [], edges: [] }), () => {})
    )
    expect(() => act(() => result.current.undo())).not.toThrow()
    expect(() => act(() => result.current.redo())).not.toThrow()
  })
})

describe('useCanvasHistory — 记录与撤销', () => {
  it('record 两次后 canUndo 为真；undo 把上一份快照交给 apply', () => {
    const apply = vi.fn()
    const s1 = { nodes: [{ id: 'n1' }], edges: [] }
    const s2 = { nodes: [{ id: 'n2' }], edges: [] }
    const { result } = renderHook(() => useCanvasHistory(() => ({ nodes: [], edges: [] }), apply))

    act(() => result.current.record(s1))
    act(() => result.current.record(s2))
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(apply).toHaveBeenCalledWith(s1)
  })

  it('redo 在 undo 后可用', () => {
    const apply = vi.fn()
    const s1 = { nodes: [{ id: 'a' }], edges: [] }
    const s2 = { nodes: [{ id: 'b' }], edges: [] }
    const { result } = renderHook(() => useCanvasHistory(() => ({ nodes: [], edges: [] }), apply))

    act(() => result.current.record(s1))
    act(() => result.current.record(s2))
    act(() => result.current.undo()) // 回到 s1
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.redo()) // 回到 s2
    expect(apply).toHaveBeenLastCalledWith(s2)
  })

  it('clear 清空历史，canUndo 回到 false', () => {
    const { result } = renderHook(() =>
      useCanvasHistory(() => ({ nodes: [], edges: [] }), () => {})
    )
    act(() => result.current.record({ nodes: [], edges: [] }))
    act(() => result.current.record({ nodes: [{ id: 'x' }], edges: [] }))
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.clear())
    expect(result.current.canUndo).toBe(false)
  })
})
