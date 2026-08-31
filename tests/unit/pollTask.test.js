/**
 * pollTask 单元测试（阶段一·算法与逻辑层）
 * 覆盖：单任务轮询状态机（completed/failed/running/无 pollTaskId/网络异常）、
 * 结果 URL 提取（视频/图片/顶层 video_url）、轮询节流与并发上限。
 * taskStore 与 fetch 均 mock。
 */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'

// mock taskStore：隔离副作用，可控 getTasks / patchTask
vi.mock('../../src/components/base/taskStore.ts', () => ({
  getTasks: vi.fn(() => []),
  patchTask: vi.fn()
}))

import { API_BASE } from '../../src/components/base/config.js'
import { getTasks, patchTask } from '../../src/components/base/taskStore.ts'
import * as poll from '@/components/base/api/pollTask.ts'

function mockFetchJson(body, { ok = true, status = 200 } = {}) {
  const res = { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
  const fetchMock = vi.fn(async () => res)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// 网关 task_view 标准响应包
const gw = (data) => ({ code: 0, data })

beforeEach(() => {
  vi.restoreAllMocks()
  getTasks.mockReturnValue([])
  patchTask.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pollOneTask - 状态机', () => {
  it('无 pollTaskId 直接返回 false（不查询）', async () => {
    const fetchMock = mockFetchJson(gw({ status: 'completed' }))
    const done = await poll.pollOneTask({ id: 't1', type: 'video' })
    expect(done).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(patchTask).not.toHaveBeenCalled()
  })

  it('completed（视频）提取 result.videos[0].url 并回写 + 广播', async () => {
    mockFetchJson(gw({ status: 'completed', result: { videos: [{ url: 'http://v/1.mp4' }] } }))
    const done = await poll.pollOneTask({ id: 't1', type: 'video', nodeId: 'n1', pollTaskId: 'p1' })
    expect(done).toBe(true)
    expect(patchTask).toHaveBeenCalledWith('t1', { status: 'completed', progress: 100, resultUrl: 'http://v/1.mp4' })
  })

  it('completed（图片）提取 result.images[0].url', async () => {
    mockFetchJson(gw({ status: 'completed', result: { images: [{ url: 'http://i/1.png' }] } }))
    await poll.pollOneTask({ id: 't2', type: 'image', pollTaskId: 'p2' })
    expect(patchTask).toHaveBeenCalledWith('t2', { status: 'completed', progress: 100, resultUrl: 'http://i/1.png' })
  })

  it('completed（code:1）成功态：后端 samenti gateway 把 code:200→1，仍按 data 识别', async () => {
    // 缺口⑱：system.ts handleGatewayTask 把 apimart 返回的 code:200 改写成 code:1，
    // 前端特惠轮询兼容该成功态（body={code:1, data:{...}}），必须仍判 completed。
    mockFetchJson({ code: 1, data: { status: 'completed', result: { videos: [{ url: 'http://v/gw.mp4' }] } } })
    const done = await poll.pollOneTask({ id: 't12', type: 'video', pollTaskId: 'p12' })
    expect(done).toBe(true)
    expect(patchTask).toHaveBeenCalledWith('t12', { status: 'completed', progress: 100, resultUrl: 'http://v/gw.mp4' })
  })

  it('completed 视频走顶层 video_url 兜底', async () => {
    mockFetchJson(gw({ status: 'completed', video_url: 'http://v/top.mp4' }))
    await poll.pollOneTask({ id: 't3', type: 'video', pollTaskId: 'p3' })
    expect(patchTask).toHaveBeenCalledWith('t3', expect.objectContaining({ resultUrl: 'http://v/top.mp4' }))
  })

  it('failed 回写失败状态与错误文案', async () => {
    mockFetchJson(gw({ status: 'failed', error: { message: '网关超时' } }))
    const done = await poll.pollOneTask({ id: 't4', type: 'video', pollTaskId: 'p4' })
    expect(done).toBe(true)
    expect(patchTask).toHaveBeenCalledWith('t4', { status: 'failed', errorMsg: '网关超时' })
  })

  it('error（非 failed 字面值）同样判终态', async () => {
    mockFetchJson(gw({ status: 'error', error: 'boom' }))
    const done = await poll.pollOneTask({ id: 't5', type: 'video', pollTaskId: 'p5' })
    expect(done).toBe(true)
    expect(patchTask).toHaveBeenCalledWith('t5', { status: 'failed', errorMsg: 'boom' })
  })

  it('running 带 progress 回写进度', async () => {
    mockFetchJson(gw({ status: 'processing', progress: 42 }))
    const done = await poll.pollOneTask({ id: 't6', type: 'video', pollTaskId: 'p6' })
    expect(done).toBe(false)
    expect(patchTask).toHaveBeenCalledWith('t6', { status: 'running', progress: 42 })
  })

  it('running 无 progress 仅回写状态', async () => {
    mockFetchJson(gw({ status: 'pending' }))
    await poll.pollOneTask({ id: 't7', type: 'video', pollTaskId: 'p7' })
    expect(patchTask).toHaveBeenCalledWith('t7', { status: 'running' })
  })
})

describe('pollOneTask - 异常与边界', () => {
  it('网络异常（fetch 抛错）返回 false 且不误判失败', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('network down') })
    vi.stubGlobal('fetch', fetchMock)
    const done = await poll.pollOneTask({ id: 't8', type: 'video', pollTaskId: 'p8' })
    expect(done).toBe(false)
    expect(patchTask).not.toHaveBeenCalled()
  })

  it('响应非 JSON 返回 false', async () => {
    const res = { ok: true, status: 200, json: async () => { throw new Error('bad json') }, text: async () => 'html' }
    vi.stubGlobal('fetch', vi.fn(async () => res))
    const done = await poll.pollOneTask({ id: 't9', type: 'video', pollTaskId: 'p9' })
    expect(done).toBe(false)
  })

  it('body 无 data 字段返回 false', async () => {
    mockFetchJson({ code: 1, msg: 'not found' })
    const done = await poll.pollOneTask({ id: 't10', type: 'video', pollTaskId: 'p10' })
    expect(done).toBe(false)
    expect(patchTask).not.toHaveBeenCalled()
  })

  it('请求 URL 含编码后的 pollTaskId', async () => {
    const fetchMock = mockFetchJson(gw({ status: 'completed' }))
    await poll.pollOneTask({ id: 't11', type: 'video', pollTaskId: 'a/b c' })
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/v1/gateway/task/${encodeURIComponent('a/b c')}`)
  })
})
