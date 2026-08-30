// @vitest-environment jsdom
/**
 * useNodeData 单测（P0-2-a 基础设施）。
 * 纯 hook 逻辑：patchData 不可变局部更新 / patchDebounced 防抖 + flush。
 * 用 vi.mock 隔离 @xyflow/react（仅取 useReactFlow().setNodes），不依赖真实 ReactFlowProvider。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const setNodesMock = vi.hoisted(() => vi.fn())
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ setNodes: setNodesMock })
}))

const { useNodeData } = await import('../../src/components/base/useNodeData.ts')

describe('useNodeData — patchData', () => {
  beforeEach(() => setNodesMock.mockClear())

  it('不可变局部更新：只合并目标节点 data，其它节点不动', () => {
    const ns = [
      { id: 'n1', data: { a: 1 } },
      { id: 'n2', data: { a: 9 } }
    ]
    let updater
    setNodesMock.mockImplementation((u) => { updater = u })
    const { result } = renderHook(() => useNodeData('n1'))

    act(() => result.current.patchData({ b: 2 }))
    // setNodes 应收到「函数式更新器」，才能做不可变局部更新
    expect(typeof updater).toBe('function')

    const next = updater(ns)
    expect(next).not.toBe(ns)
    expect(next[0]).toEqual({ id: 'n1', data: { a: 1, b: 2 } })
    expect(next[1].data).toBe(ns[1].data) // 其它节点 data 引用不动
  })
})

describe('useNodeData — patchDebounced', () => {
  beforeEach(() => setNodesMock.mockClear())

  it('防抖：连续多次调用不立即写，flush 后只写最后一次', () => {
    const ns = [{ id: 'n1', data: { a: 1 } }]
    let updater
    setNodesMock.mockImplementation((u) => { updater = u })
    const { result } = renderHook(() => useNodeData('n1'))

    act(() => {
      result.current.patchDebounced({ a: 2 })
      result.current.patchDebounced({ a: 3 })
    })
    // 防抖窗口内未 flush 前不触发 setNodes
    expect(setNodesMock).not.toHaveBeenCalled()

    act(() => result.current.patchDebounced.flush())
    expect(typeof updater).toBe('function')
    expect(updater(ns)[0].data).toEqual({ a: 3 }) // 只写最后一次
  })
})