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
const busState = vi.hoisted(() => ({ handler: null, logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
const saveResultToTasksMock = vi.hoisted(() => vi.fn(async (url) => url))
const reportDegradeMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/hooks/useNodeData.ts', () => ({ useNodeData: () => ({ patchData: patchDataMock }) }))
vi.mock('../../src/components/base/store/taskStore.ts', () => ({
  reportGenerate: () => taskCtlMock,
  registerTaskRetry: vi.fn(),
  unregisterTaskRetry: vi.fn(),
  claimNodeRun: () => ({ ok: true }),
  releaseNodeRun: vi.fn()
}))
vi.mock('../../src/components/base/api/filesApi.ts', () => ({ saveResultToTasks: saveResultToTasksMock }))
vi.mock('../../src/components/base/utils/degrade.ts', () => ({ reportDegrade: reportDegradeMock }))
vi.mock('../../src/components/base/core/eventBus.ts', () => ({
  subscribe: (evt, cb) => { busState.handler = cb; return () => {} }
}))
vi.mock('../../src/components/base/core/logger.ts', () => ({ logger: busState.logger }))
vi.mock('../../src/components/base/core/toastStore.ts', () => ({ showToast: vi.fn() }))

import { useNodeGeneration } from '../../src/hooks/useNodeGeneration.ts'

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
    busState.logger.error.mockClear()
    saveResultToTasksMock.mockClear()
    reportDegradeMock.mockClear()
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

  it('run 抛网络异常 → logger.error 记录 classifyError 分类（network，可重试）', async () => {
    // 【R7 错误分类记录】异常对象必须经 classifyError 统一分类并进日志，网络错误 retryable:true
    const { result } = renderHook(() =>
      useNodeGeneration({ ...baseProps, run: async () => { throw new TypeError('Failed to fetch') } })
    )
    await act(async () => { await result.current.start() })
    expect(busState.logger.error).toHaveBeenCalledWith(
      '生成', 'fail',
      expect.objectContaining({ errType: 'network', retryable: true, error: 'Failed to fetch' })
    )
  })

  it('run 返回 { ok:false } → logger.error 记录分类 business（契约业务失败，不可重试）', async () => {
    // 【R7 错误分类记录】契约业务失败（message 字符串）归 business，不自动重试
    const { result } = renderHook(() =>
      useNodeGeneration({ ...baseProps, run: async () => ({ ok: false, error: '模型限流' }) })
    )
    await act(async () => { await result.current.start() })
    expect(busState.logger.error).toHaveBeenCalledWith(
      '生成', 'fail',
      expect.objectContaining({ errType: 'business', retryable: false, error: '模型限流' })
    )
  })

  it('落盘失败 → reportDegrade 留痕，结果仍回退原始 URL（P0-C 语义不破坏）', async () => {
    // 【失败可见 + 回退】saveResultToTasks reject 时：必须经 reportDegrade 可见（不得静默吞），
    //   且保留回退语义 finalUrl = persistedUrl || strUrl → 返回 ok:true + 原始 url。
    saveResultToTasksMock.mockRejectedValueOnce(new Error('磁盘写入失败'))
    const { result } = renderHook(() => useNodeGeneration(baseProps))
    let r
    await act(async () => { r = await result.current.start() })
    expect(reportDegradeMock).toHaveBeenCalledWith({
      layer: 'useNodeGeneration',
      key: 'saveResultToTasks',
      e: expect.any(Error),
    })
    // P0-C 回退：落盘失败不得把整体生成判为失败
    expect(r).toEqual({ ok: true, resultUrl: 'http://x/y.png' })
  })
})