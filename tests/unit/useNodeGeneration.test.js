// @vitest-environment jsdom
/**
 * useNodeGeneration 单测（P0-2-b resultKey/recoverable 声明式写回）。
 * 三个关键行为：
 *  1. 非破坏——默认不传 resultKey/recoverable 时，成功路径不自动写 node.data；
 *  2. resultKey 声明后，成功时自动 patchData({[resultKey]: url})；
 *  3. recoverable + resultKey 声明后，收到 task-completed 广播自动回填。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const patchDataMock = vi.hoisted(() => vi.fn())
const taskCtlMock = vi.hoisted(() => ({ taskId: 't1', progress: vi.fn(), done: vi.fn(), fail: vi.fn() }))
const busState = vi.hoisted(() => ({ handler: null }))

vi.mock('../../src/components/base/useNodeData.js', () => ({ useNodeData: () => ({ patchData: patchDataMock }) }))
vi.mock('../../src/components/base/taskStore.js', () => ({
  reportGenerate: () => taskCtlMock,
  registerTaskRetry: vi.fn(),
  unregisterTaskRetry: vi.fn(),
  setCurrentTaskId: vi.fn()
}))
vi.mock('../../src/components/base/filesApi.js', () => ({ saveResultToTasks: async (url) => url }))
vi.mock('../../src/components/base/eventBus.js', () => ({
  subscribe: (evt, cb) => { busState.handler = cb; return () => {} }
}))
vi.mock('../../src/components/base/logger.js', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: vi.fn() }))

import { useNodeGeneration } from '../../src/components/base/useNodeGeneration.js'

const baseProps = {
  nodeId: 'n1',
  type: { type: 'image', prompt: 'p', modelName: 'm' },
  run: async () => ({ ok: true, url: 'http://x/y.png' })
}

describe('useNodeGeneration — resultKey/recoverable（P0-2-b）', () => {
  beforeEach(() => {
    patchDataMock.mockClear()
    taskCtlMock.done.mockClear()
    taskCtlMock.fail.mockClear()
    busState.handler = null
  })

  it('非破坏：默认不传时成功路径不自动写 node.data', async () => {
    const { result } = renderHook(() => useNodeGeneration(baseProps))
    let ok
    await act(async () => { ok = await result.current.start() })
    expect(ok.ok).toBe(true)
    expect(patchDataMock).not.toHaveBeenCalled()
  })

  it('传 resultKey 后成功自动 patchData({[resultKey]: url})，onSuccess 仍会调用', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useNodeGeneration({ ...baseProps, resultKey: 'imageUrl', onSuccess }))
    await act(async () => { await result.current.start() })
    expect(patchDataMock).toHaveBeenCalledWith({ imageUrl: 'http://x/y.png' })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('recoverable + resultKey：收到完成广播自动回填，且过滤非本节点/非完成', async () => {
    const { result } = renderHook(() => useNodeGeneration({ ...baseProps, resultKey: 'imageUrl', recoverable: true }))
    // 先让 start 抛错无关：直接测广播路径
    await act(async () => {
      expect(busState.handler).toEqual(expect.any(Function))
      // 非本节点 → 忽略
      busState.handler({ nodeId: 'other', status: 'completed', resultUrl: 'http://x/ignored.png' })
      // 非 completed → 忽略
      busState.handler({ nodeId: 'n1', status: 'running', resultUrl: 'http://x/ignored2.png' })
      expect(patchDataMock).not.toHaveBeenCalled()
      // 本节点 + completed → 自动回填
      busState.handler({ nodeId: 'n1', status: 'completed', resultUrl: 'http://x/rec.png' })
    })
    expect(patchDataMock).toHaveBeenCalledTimes(1)
    expect(patchDataMock).toHaveBeenCalledWith({ imageUrl: 'http://x/rec.png' })
  })
})