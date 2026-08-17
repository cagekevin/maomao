// @vitest-environment jsdom
/**
 * useScriptBoxData 单测（批 3）。
 * 覆盖 useScriptBoxData(id).updateData(patch)：
 *   - 不可变合并写回 node.data（setNodes 内定位 id 并浅合并 patch）
 * 通过 mock @xyflow/react 的 useReactFlow().setNodes 捕获更新函数并模拟执行验证。
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const setNodes = vi.fn()
const getNodes = vi.fn(() => [])

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ setNodes, getNodes, screenToFlowPosition: (p) => p }),
}))

const { useScriptBoxData } = await import('../../src/components/base/useScriptBoxData.js')

describe('useScriptBoxData', () => {
  it('updateData 浅合并 patch 进 node.data', () => {
    const { result } = renderHook(() => useScriptBoxData('n1'))
    setNodes.mockClear()
    result.current.updateData({ shots: [1, 2, 3], title: '剧本' })
    expect(setNodes).toHaveBeenCalledTimes(1)
    const updater = setNodes.mock.calls[0][0]
    const out = updater([{ id: 'n1', data: { title: '旧', foo: 'bar' } }])
    expect(out[0].data).toEqual({ title: '剧本', foo: 'bar', shots: [1, 2, 3] })
  })

  it('updateData 只改目标 id 的节点', () => {
    const { result } = renderHook(() => useScriptBoxData('target'))
    setNodes.mockClear()
    result.current.updateData({ x: 1 })
    const updater = setNodes.mock.calls[0][0]
    const out = updater([{ id: 'other', data: {} }, { id: 'target', data: { a: 1 } }])
    expect(out[0]).toEqual({ id: 'other', data: {} })
    expect(out[1].data).toEqual({ a: 1, x: 1 })
  })
})
