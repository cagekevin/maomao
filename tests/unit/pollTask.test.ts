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
// mock filesApi.saveResultToTasks：恢复落盘补丁(刷新时任务还在跑→恢复 completed 也落盘)用；
// 默认返回 null(落盘失败→回退原 URL)，使既有断言不受影响；新增用例再 mockResolvedValue 指定持久 URL
vi.mock('../../src/components/base/api/filesApi.ts', () => ({
  saveResultToTasks: vi.fn(async () => null),
}))

import { API_BASE } from '../../src/components/base/config.ts'
import { getTasks, patchTask } from '../../src/components/base/taskStore.ts'
import { saveResultToTasks } from '../../src/components/base/api/filesApi.ts'
import * as poll from '@/components/base/api/pollTask.ts'

function mockFetchJson(body, { ok = true, status = 200 } = {}) {
  const res = { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
  const fetchMock = vi.fn(async () => res) as unknown as ReturnType<typeof vi.fn>
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// 网关 task_view 标准响应包
const gw = (data) => ({ code: 0, data })

// PollableTask 在 src 为未导出内部类型，且 nodeId/status 字段运行时不被 pollOneTask 消费，
// 仅 id/type/pollTaskId 参与决策；用 pollOne 将测试构造对象收敛到该参数类型，避免重复补无关字段。
type PollableTaskArg = Parameters<typeof poll.pollOneTask>[0]
const pollOne = (o: Record<string, unknown>): Promise<boolean> => poll.pollOneTask(o as unknown as PollableTaskArg)

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(getTasks).mockReturnValue([])
  vi.mocked(patchTask).mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pollOneTask - 状态机', () => {
  it('无 pollTaskId 直接返回 false（不查询）', async () => {
    const fetchMock = mockFetchJson(gw({ status: 'completed' }))
    const done = await pollOne({ id: 't1', type: 'video' })
    expect(done).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(patchTask).not.toHaveBeenCalled()
  })

  it('completed（视频）提取 result.videos[0].url 并回写 + 广播', async () => {
    mockFetchJson(gw({ status: 'completed', result: { videos: [{ url: 'http://v/1.mp4' }] } }))
    const done = await pollOne({ id: 't1', type: 'video', nodeId: 'n1', pollTaskId: 'p1' })
    expect(done).toBe(true)
    expect(patchTask).toHaveBeenCalledWith('t1', { status: 'completed', progress: 100, resultUrl: 'http://v/1.mp4' })
  })

  it('completed（图片）提取 result.images[0].url', async () => {
    mockFetchJson(gw({ status: 'completed', result: { images: [{ url: 'http://i/1.png' }] } }))
    await pollOne({ id: 't2', type: 'image', pollTaskId: 'p2' })
    expect(patchTask).toHaveBeenCalledWith('t2', { status: 'completed', progress: 100, resultUrl: 'http://i/1.png' })
  })

  it('completed（code:1）成功态：后端 samenti gateway 把 code:200→1，仍按 data 识别', async () => {
    // 缺口⑱：system.ts handleGatewayTask 把 apimart 返回的 code:200 改写成 code:1，
    // 前端特惠轮询兼容该成功态（body={code:1, data:{...}}），必须仍判 completed。
    mockFetchJson({ code: 1, data: { status: 'completed', result: { videos: [{ url: 'http://v/gw.mp4' }] } } })
    const done = await pollOne({ id: 't12', type: 'video', pollTaskId: 'p12' })
    expect(done).toBe(true)
    expect(patchTask).toHaveBeenCalledWith('t12', { status: 'completed', progress: 100, resultUrl: 'http://v/gw.mp4' })
  })

  it('completed 视频走顶层 video_url 兜底', async () => {
    mockFetchJson(gw({ status: 'completed', video_url: 'http://v/top.mp4' }))
    await pollOne({ id: 't3', type: 'video', pollTaskId: 'p3' })
    expect(patchTask).toHaveBeenCalledWith('t3', expect.objectContaining({ resultUrl: 'http://v/top.mp4' }))
  })

  it('failed 回写失败状态与错误文案', async () => {
    mockFetchJson(gw({ status: 'failed', error: { message: '网关超时' } }))
    const done = await pollOne({ id: 't4', type: 'video', pollTaskId: 'p4' })
    expect(done).toBe(true)
    expect(patchTask).toHaveBeenCalledWith('t4', { status: 'failed', errorMsg: '网关超时' })
  })

  it('error（非 failed 字面值）同样判终态', async () => {
    mockFetchJson(gw({ status: 'error', error: 'boom' }))
    const done = await pollOne({ id: 't5', type: 'video', pollTaskId: 'p5' })
    expect(done).toBe(true)
    expect(patchTask).toHaveBeenCalledWith('t5', { status: 'failed', errorMsg: 'boom' })
  })

  it('running 带 progress 回写进度', async () => {
    mockFetchJson(gw({ status: 'processing', progress: 42 }))
    const done = await pollOne({ id: 't6', type: 'video', pollTaskId: 'p6' })
    expect(done).toBe(false)
    expect(patchTask).toHaveBeenCalledWith('t6', { status: 'running', progress: 42 })
  })

  it('running 无 progress 仅回写状态', async () => {
    mockFetchJson(gw({ status: 'pending' }))
    await pollOne({ id: 't7', type: 'video', pollTaskId: 'p7' })
    expect(patchTask).toHaveBeenCalledWith('t7', { status: 'running' })
  })
})

describe('pollOneTask - 异常与边界', () => {
  it('网络异常（fetch 抛错）返回 false 且不误判失败', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('network down') })
    vi.stubGlobal('fetch', fetchMock)
    const done = await pollOne({ id: 't8', type: 'video', pollTaskId: 'p8' })
    expect(done).toBe(false)
    expect(patchTask).not.toHaveBeenCalled()
  })

  it('响应非 JSON 返回 false', async () => {
    const res = { ok: true, status: 200, json: async () => { throw new Error('bad json') }, text: async () => 'html' }
    vi.stubGlobal('fetch', vi.fn(async () => res))
    const done = await pollOne({ id: 't9', type: 'video', pollTaskId: 'p9' })
    expect(done).toBe(false)
  })

  it('body 无 data 字段返回 false', async () => {
    mockFetchJson({ code: 1, msg: 'not found' })
    const done = await pollOne({ id: 't10', type: 'video', pollTaskId: 'p10' })
    expect(done).toBe(false)
    expect(patchTask).not.toHaveBeenCalled()
  })

  it('请求 URL 含编码后的 pollTaskId', async () => {
    const fetchMock = mockFetchJson(gw({ status: 'completed' }))
    await pollOne({ id: 't11', type: 'video', pollTaskId: 'a/b c' })
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/v1/gateway/task/${encodeURIComponent('a/b c')}`)
  })
})

// ══════════════════════════════════════════════════════════════
// S2-b 修根因 C：恢复轮询不得用网关外链覆盖已持久 /files/ resultUrl
// ══════════════════════════════════════════════════════════════
describe('pollOneTask - 恢复不覆盖已持久 resultUrl（S2-b）', () => {
  it('任务记录已有已持久 /files/ resultUrl → 保留，不覆盖成网关外链', async () => {
    // 网关已 completed 且返回原始上游外链
    mockFetchJson(gw({ status: 'completed', result: { videos: [{ url: 'https://a.lovart.ai/expired.mp4' }] } }))
    // 任务记录里 in-flight 阶段已落盘 /files/ 持久 URL
    const done = await pollOne({ id: 't-persisted', type: 'video', nodeId: 'n1', pollTaskId: 'p1', resultUrl: 'http://127.0.0.1:18080/files/tasks/generated_1.mp4' })
    expect(done).toBe(true)
    // patchTask 应保留持久 URL，而非覆盖成外链
    expect(patchTask).toHaveBeenCalledWith('t-persisted', expect.objectContaining({ status: 'completed', resultUrl: 'http://127.0.0.1:18080/files/tasks/generated_1.mp4' }))
    // 广播也用持久 URL（不污染节点回填）
    expect(patchTask).not.toHaveBeenCalledWith('t-persisted', expect.objectContaining({ resultUrl: 'https://a.lovart.ai/expired.mp4' }))
  })

  it('相对 /files/ 形态同样视为已持久 → 保留', async () => {
    mockFetchJson(gw({ status: 'completed', result: { images: [{ url: 'https://a.lovart.ai/expired.png' }] } }))
    await pollOne({ id: 't-rel', type: 'image', nodeId: 'n1', pollTaskId: 'p1', resultUrl: '/files/tasks/abc.png' })
    expect(patchTask).toHaveBeenCalledWith('t-rel', expect.objectContaining({ resultUrl: '/files/tasks/abc.png' }))
  })

  it('任务记录无持久 resultUrl（崩在落盘前）→ 回源网关原始 URL 兜底（现状不破）', async () => {
    mockFetchJson(gw({ status: 'completed', result: { videos: [{ url: 'https://v/fallback.mp4' }] } }))
    await pollOne({ id: 't-fallback', type: 'video', nodeId: 'n1', pollTaskId: 'p1' }) // 无 resultUrl
    expect(patchTask).toHaveBeenCalledWith('t-fallback', expect.objectContaining({ status: 'completed', resultUrl: 'https://v/fallback.mp4' }))
  })

  it('任务记录 resultUrl 是外链(非已持久) → 以网关为准回写（不因误判空而丢）', async () => {
    mockFetchJson(gw({ status: 'completed', result: { videos: [{ url: 'https://gw/real.mp4' }] } }))
    await pollOne({ id: 't-ext', type: 'video', nodeId: 'n1', pollTaskId: 'p1', resultUrl: 'https://old.external.com/x.mp4' })
    // 旧外链非 /files/，应被网关最新结果覆盖
    expect(patchTask).toHaveBeenCalledWith('t-ext', expect.objectContaining({ resultUrl: 'https://gw/real.mp4' }))
  })
})

// ══════════════════════════════════════════════════════════════
// 恢复落盘缺口：刷新时任务还在跑 → 恢复 completed 回源拿到外链 → 先落盘成 /files/ 再广播
// ══════════════════════════════════════════════════════════════
describe('pollOneTask - 恢复 completed 也落盘（刷新前还在跑场景）', () => {
  beforeEach(() => {
    vi.mocked(saveResultToTasks).mockClear()
    vi.mocked(saveResultToTasks).mockResolvedValue(null)
  })
  it('任务无已持久 URL + 回源外链 → 先 saveResultToTasks 落盘，用持久 URL 回写/广播', async () => {
    // 落盘成功返回持久 /files/ URL
    vi.mocked(saveResultToTasks).mockResolvedValue('http://127.0.0.1:18080/files/tasks/generated_rec.mp4')
    mockFetchJson(gw({ status: 'completed', result: { videos: [{ url: 'https://a.lovart.ai/expired.mp4' }] } }))
    await pollOne({ id: 't-recover-persist', type: 'video', nodeId: 'n1', pollTaskId: 'p1' })
    // 应触发落盘(把回源外链交给 saveResultToTasks)
    expect(saveResultToTasks).toHaveBeenCalledWith('https://a.lovart.ai/expired.mp4', 'video')
    // 回写/广播用落盘后的持久 URL，而非外链
    expect(patchTask).toHaveBeenCalledWith('t-recover-persist', expect.objectContaining({ status: 'completed', resultUrl: 'http://127.0.0.1:18080/files/tasks/generated_rec.mp4' }))
    expect(patchTask).not.toHaveBeenCalledWith('t-recover-persist', expect.objectContaining({ resultUrl: 'https://a.lovart.ai/expired.mp4' }))
  })

  it('落盘失败(返回 null) → 回退原回源 URL(宁显示外链不丢图)', async () => {
    vi.mocked(saveResultToTasks).mockResolvedValue(null) // 落盘失败
    mockFetchJson(gw({ status: 'completed', result: { videos: [{ url: 'https://v/fallback.mp4' }] } }))
    await pollOne({ id: 't-recover-fail', type: 'video', nodeId: 'n1', pollTaskId: 'p1' })
    expect(saveResultToTasks).toHaveBeenCalled()
    expect(patchTask).toHaveBeenCalledWith('t-recover-fail', expect.objectContaining({ resultUrl: 'https://v/fallback.mp4' }))
  })

  it('任务已有已持久 URL → 不再触发 saveResultToTasks(直接复用，不重复落盘)', async () => {
    vi.mocked(saveResultToTasks).mockResolvedValue('http://should-not-be-used')
    mockFetchJson(gw({ status: 'completed', result: { videos: [{ url: 'https://a.lovart.ai/expired.mp4' }] } }))
    await pollOne({ id: 't-no-redownload', type: 'video', nodeId: 'n1', pollTaskId: 'p1', resultUrl: '/files/tasks/already.png' })
    expect(saveResultToTasks).not.toHaveBeenCalled() // 已持久，无需再落盘
    expect(patchTask).toHaveBeenCalledWith('t-no-redownload', expect.objectContaining({ resultUrl: '/files/tasks/already.png' }))
  })
})
