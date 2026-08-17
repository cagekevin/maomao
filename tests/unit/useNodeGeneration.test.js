// @vitest-environment jsdom
/**
 * useNodeGeneration 单测（批 3）。
 * 覆盖统一「节点生成」契约：
 *   - validate 返回错误 → start() 返回 false，不调用 run，setError
 *   - run 成功 {ok:true,url} → onSuccess 被调、saveResultToTasks 持久化、返回 {ok:true,resultUrl}
 *   - run 失败 {ok:false,error} → setError、返回 {ok:false,error}
 *   - 防重入：running 期间二次 start() 直接返回 false（不重复 run）
 *   - run 抛 AbortError → 视为已停止，不报红
 * 通过 vi.mock 隔离 taskStore / filesApi / toastStore / logger / eventBus。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const taskCtl = { taskId: 't1', progress: vi.fn(), done: vi.fn(), fail: vi.fn() }
const reportGenerate = vi.fn(() => taskCtl)
const registerTaskRetry = vi.fn()
const unregisterTaskRetry = vi.fn()
const setCurrentTaskId = vi.fn()
const saveResultToTasks = vi.fn(async (url) => url + '?saved')
const showToast = vi.fn()
const logger = { info: vi.fn(), error: vi.fn() }
const subscribe = vi.fn(() => vi.fn())

vi.mock('../../src/components/base/taskStore.js', () => ({
  reportGenerate: (...a) => reportGenerate(...a),
  registerTaskRetry,
  unregisterTaskRetry,
  setCurrentTaskId: (...a) => setCurrentTaskId(...a),
}))
vi.mock('../../src/components/base/filesApi.js', () => ({ saveResultToTasks: (...a) => saveResultToTasks(...a) }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: (...a) => showToast(...a) }))
vi.mock('../../src/components/base/logger.js', () => ({ logger }))
vi.mock('../../src/components/base/eventBus.js', () => ({ subscribe: (...a) => subscribe(...a) }))

const { useNodeGeneration } = await import('../../src/components/base/useNodeGeneration.js')

beforeEach(() => {
  reportGenerate.mockClear()
  registerTaskRetry.mockClear()
  setCurrentTaskId.mockClear()
  saveResultToTasks.mockClear()
  showToast.mockClear()
  taskCtl.progress.mockClear()
  taskCtl.done.mockClear()
  taskCtl.fail.mockClear()
})

describe('useNodeGeneration', () => {
  it('validate 拦截 → start 返回 false，不调用 run', async () => {
    const run = vi.fn()
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useNodeGeneration({
      nodeId: 'n1',
      type: { type: 'image', prompt: 'x' },
      validate: () => '请输入提示词',
      run,
      onSuccess,
    }))
    const r = await act(async () => result.current.start())
    expect(r).toBe(false)
    expect(run).not.toHaveBeenCalled()
    expect(result.current.error).toBe('请输入提示词')
  })

  it('run 成功 → onSuccess + saveResultToTasks + 返回 resultUrl', async () => {
    const run = vi.fn(async () => ({ ok: true, url: 'http://img/a.png' }))
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useNodeGeneration({
      nodeId: 'n1',
      type: { type: 'image', prompt: 'x', modelName: 'm' },
      run,
      onSuccess,
    }))
    const r = await act(async () => result.current.start())
    expect(run).toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledWith({ ok: true, url: 'http://img/a.png' }, expect.anything())
    expect(saveResultToTasks).toHaveBeenCalledWith('http://img/a.png', 'image')
    expect(r).toEqual({ ok: true, resultUrl: 'http://img/a.png?saved' })
    expect(result.current.loading).toBe(false)
  })

  it('run 失败 → setError + 返回 {ok:false,error}', async () => {
    const run = vi.fn(async () => ({ ok: false, error: '模型挂了' }))
    const { result } = renderHook(() => useNodeGeneration({
      nodeId: 'n1', type: { type: 'image', prompt: 'x' }, run,
    }))
    const r = await act(async () => result.current.start())
    expect(result.current.error).toBe('模型挂了')
    expect(taskCtl.fail).toHaveBeenCalledWith('模型挂了')
    expect(r).toEqual({ ok: false, error: '模型挂了' })
  })

  it('防重入：首次运行中二次 start 直接返回 false（不重复 run）', async () => {
    let resolve
    const run = vi.fn(() => new Promise((res) => { resolve = res }))
    const { result } = renderHook(() => useNodeGeneration({
      nodeId: 'n1', type: { type: 'image', prompt: 'x' }, run,
    }))
    await act(async () => { result.current.start() })
    const second = await act(async () => result.current.start())
    expect(second).toBe(false)
    expect(run).toHaveBeenCalledTimes(1)
    await act(async () => { resolve({ ok: true, url: 'u' }) })
  })

  it('run 抛 AbortError → 视为已停止，不报错', async () => {
    const run = vi.fn(async () => { const e = new Error('stop'); e.name = 'AbortError'; throw e })
    const { result } = renderHook(() => useNodeGeneration({
      nodeId: 'n1', type: { type: 'image', prompt: 'x' }, run,
    }))
    const r = await act(async () => result.current.start())
    expect(r).toMatchObject({ ok: false, aborted: true })
    expect(result.current.error).toBe('')
    expect(showToast).not.toHaveBeenCalled()
  })

  it('stop() 真中断：把 abort 传播给传给 run 的 signal', async () => {
    let capturedSignal = null
    let resolveRun
    const run = vi.fn(({ signal }) => {
      capturedSignal = signal
      return new Promise((res) => { resolveRun = res })
    })
    const { result } = renderHook(() => useNodeGeneration({
      nodeId: 'n1', type: { type: 'image', prompt: 'x' }, run,
    }))
    await act(async () => { result.current.start() })
    expect(capturedSignal).toBeDefined()
    expect(capturedSignal.aborted).toBe(false)
    // stop() 应真中断：abort 传给 run 的 signal（run 执行器据此取消底层 fetch/轮询）
    await act(async () => { result.current.stop() })
    expect(capturedSignal.aborted).toBe(true)
    // 结算未完成的 run，避免 pending promise
    await act(async () => { resolveRun?.({ ok: false, aborted: true }) })
  })
})
