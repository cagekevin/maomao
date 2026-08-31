// @vitest-environment jsdom
/**
 * useFitNodeRatio 单测（批 3）。
 * 覆盖 useFitNodeRatio(id).fitByRatio(naturalW, naturalH)：
 *   - 按当前节点宽度 + 媒体真实宽高比算高度，clamp 到 [80,900]
 *   - 调 onMainBoxResize（→ setNodes）写回 width/height（不可变）
 *   - 非法输入（缺宽高/比例非正）→ 不写
 * 通过 mock @xyflow/react 捕获 setNodes 验证。
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const setNodes = vi.fn()
const getNodes = vi.fn(() => [{ id: 'n1', width: 400, height: 100, style: { width: 400, height: 100 } }])
// P7：useFitNodeRatio 改为 getNode(id) 实时读（替 getNodes().find），测试 mock 需同步提供
const getNode = vi.fn((id) => getNodes().find((n) => n.id === id))
const updateNodeInternals = vi.fn()

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ getNodes, getNode, setNodes, screenToFlowPosition: (p) => p }),
  useUpdateNodeInternals: () => updateNodeInternals,
}))

const { useFitNodeRatio } = await import('../../src/components/base/useFitNodeRatio.ts')

function lastSetNodesUpdate() {
  const updater = setNodes.mock.calls[setNodes.mock.calls.length - 1][0]
  return updater([{ id: 'n1', data: {}, style: {} }])[0]
}

describe('useFitNodeRatio', () => {
  it('宽高比 2 → 高度 = 宽/2 = 200，写回 width 保持、height=200', () => {
    const { result } = renderHook(() => useFitNodeRatio('n1'))
    setNodes.mockClear()
    result.current.fitByRatio(2000, 1000)
    const node = lastSetNodesUpdate()
    expect(node.width).toBe(400)
    expect(node.height).toBe(200)
    expect(node.style).toMatchObject({ width: 400, height: 200 })
  })

  it('极端宽高比（1000x50 → ratio20 → h=20 <80 → clamp 到 80）', () => {
    const { result } = renderHook(() => useFitNodeRatio('n1'))
    setNodes.mockClear()
    result.current.fitByRatio(1000, 50)
    const node = lastSetNodesUpdate()
    expect(node.height).toBe(80)
  })

  it('非法输入（缺宽/高或比例<=0）→ 不写 setNodes', () => {
    const { result } = renderHook(() => useFitNodeRatio('n1'))
    setNodes.mockClear()
    result.current.fitByRatio(0, 0)
    result.current.fitByRatio(100, 0)
    result.current.fitByRatio(100, -5)
    expect(setNodes).not.toHaveBeenCalled()
  })

  it('fitFromImage / fitFromVideo 透传到 fitByRatio（读取节点尺寸）', () => {
    const { result } = renderHook(() => useFitNodeRatio('n1'))
    getNode.mockClear()
    result.current.fitFromImage({ currentTarget: { naturalWidth: 800, naturalHeight: 400 } })
    // handler 透传 media 尺寸 → fitByRatio 读取当前节点尺寸
    expect(getNode).toHaveBeenCalled()
    getNode.mockClear()
    result.current.fitFromVideo({ currentTarget: { videoWidth: 1600, videoHeight: 400 } })
    expect(getNode).toHaveBeenCalled()
  })
})
