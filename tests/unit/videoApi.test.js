// @vitest-environment node
/**
 * videoApi 单测（批 2，API 封装层）。
 * 覆盖：generateVideo 强制 async（提交→轮询→取 url）；无 task_id 失败；网络错误分支。
 * 策略：node + mock fetch（顺序响应）+ mock imageUrl/taskStore + mock setTimeout 加速轮询。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { jsonResp, fastPollTimers } from './_testUtils.mjs'

const fetchMock = globalThis.fetch

vi.mock('../../src/components/base/imageUrl.js', () => ({
  normalizeImageUrlsForSend: vi.fn(async () => []),
  toAbsoluteFileUrl: vi.fn((u) => u),
  normalizeImageUrl: vi.fn((u) => u),
  normalizeImageUrlForSend: vi.fn(async (u) => u),
  toImageContentBlocks: vi.fn((u) => []),
}))
vi.mock('../../src/components/base/taskStore.js', () => ({
  getCurrentTaskId: vi.fn(() => null),
  setTaskPollId: vi.fn(),
}))

const { generateVideo } = await import('../../src/components/base/videoApi.js')
const { normalizeImageUrlsForSend } = await import('../../src/components/base/imageUrl.js')
const { getCurrentTaskId, setTaskPollId } = await import('../../src/components/base/taskStore.js')

/** 读提交/轮询请求的 body 里的 url（即后端要转发的上游 url） */
function submittedUrl() {
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  return body.url
}

beforeEach(() => {
  fetchMock.mockReset()
  normalizeImageUrlsForSend.mockReset()
  normalizeImageUrlsForSend.mockResolvedValue([])
  getCurrentTaskId.mockReset()
  getCurrentTaskId.mockReturnValue(null)
  setTaskPollId.mockReset()
  vi.restoreAllMocks()
  // 加速轮询里的 setTimeout(5000)：统一走共享 helper（见 _testUtils.fastPollTimers）
  fastPollTimers()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('videoApi — generateVideo async 成功', () => {
  it('提交返回 task_id → 轮询拿到视频 url', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T1' }] }))
      .mockResolvedValueOnce(jsonResp({ data: { result: { videos: [{ url: 'http://x/v.mp4' }] } } }))
    const res = await generateVideo({
      provider: { id: 'p1' },
      prompt: 'a cat video',
      model: 'm',
      size: '16:9',
    })
    expect(res.ok).toBe(true)
    expect(res.url).toBe('http://x/v.mp4')
    // 第二次请求（轮询）的负载 url 指向 tasks/T1（外层 url 始终是 /api/proxy）
    expect(fetchMock.mock.calls[1][0]).toContain('/api/proxy')
    const pollBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(pollBody.url).toContain('tasks/T1')
  })

  it('提交即返回结果（非任务形态）→ 直接成功', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ data: { result: { videos: [{ url: 'http://x/d.mp4' }] } } }))
    const res = await generateVideo({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(true)
    expect(res.url).toBe('http://x/d.mp4')
  })

  it('openai 协议 → 提交 url 用伪协议 openai://videos/generations', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ data: { result: { videos: [{ url: 'http://x/o.mp4' }] } } }))
    const res = await generateVideo({ provider: { protocol: 'openai' }, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(true)
    expect(submittedUrl()).toBe('openai://videos/generations')
  })

  it('genBody 构造：size/resolution/seconds 都进提交 body', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T1' }] }))
      .mockResolvedValueOnce(jsonResp({ data: { result: { videos: [{ url: 'http://x/v.mp4' }] } } }))
    await generateVideo({ provider: {}, prompt: 'x', model: 'm', size: '16:9', resolution: '1080p', seconds: 5 })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const genBody = JSON.parse(body.body)
    expect(genBody.size).toBe('16:9')
    expect(genBody.resolution).toBe('1080p')
    expect(genBody.duration).toBe('5')
  })

  it('size=Auto → 不写 size 字段', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ data: { result: { videos: [{ url: 'http://x/v.mp4' }] } } }))
    await generateVideo({ provider: {}, prompt: 'x', model: 'm', size: 'Auto' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const genBody = JSON.parse(body.body)
    expect(genBody.size).toBeUndefined()
  })

  it('参考图 → normalizeImageUrlsForSend 且写 image_urls', async () => {
    normalizeImageUrlsForSend.mockResolvedValue(['http://ref/a.png'])
    fetchMock.mockResolvedValueOnce(jsonResp({ data: { result: { videos: [{ url: 'http://x/v.mp4' }] } } }))
    await generateVideo({ provider: {}, prompt: 'x', model: 'm', images: ['blob:x'] })
    expect(normalizeImageUrlsForSend).toHaveBeenCalledWith(['blob:x'], { preferBase64: false })
    const genBody = JSON.parse(JSON.parse(fetchMock.mock.calls[0][1].body).body)
    expect(genBody.image_urls).toEqual(['http://ref/a.png'])
  })

  it('refFormat=base64 → normalizeImageUrlsForSend 传 preferBase64', async () => {
    normalizeImageUrlsForSend.mockResolvedValue([])
    fetchMock.mockResolvedValueOnce(jsonResp({ data: { result: { videos: [{ url: 'http://x/v.mp4' }] } } }))
    await generateVideo({ provider: { refFormat: 'base64' }, prompt: 'x', model: 'm', images: ['http://x/a.png'] })
    expect(normalizeImageUrlsForSend).toHaveBeenCalledWith(['http://x/a.png'], { preferBase64: true })
  })

  it('异步提交成功后回填 setTaskPollId(taskId, pollTaskId)', async () => {
    getCurrentTaskId.mockReturnValue('front-task-1')
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T9' }] }))
      .mockResolvedValueOnce(jsonResp({ data: { result: { videos: [{ url: 'http://x/v.mp4' }] } } }))
    await generateVideo({ provider: {}, prompt: 'x', model: 'm' })
    expect(setTaskPollId).toHaveBeenCalledWith('front-task-1', 'T9')
    // 提交请求也带 taskId 贯穿
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.taskId).toBe('front-task-1')
  })

  it('onProgress 收到阶段回调', async () => {
    const progress = vi.fn()
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T1' }] }))
      .mockResolvedValueOnce(jsonResp({ data: { result: { videos: [{ url: 'http://x/v.mp4' }] } } }))
    await generateVideo({ provider: {}, prompt: 'x', model: 'm' }, progress)
    expect(progress).toHaveBeenCalled()
  })
})

describe('videoApi — 错误路径', () => {
  it('上游未返回 task_id → 失败', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ data: { foo: 'bar' } }))
    const res = await generateVideo({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('未返回任务 id')
  })

  it('轮询中网络错误 → 失败', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T1' }] }))
      .mockRejectedValueOnce(new Error('net'))
    const res = await generateVideo({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('轮询失败')
  })

  it('提交即网络错误 → 失败', async () => {
    fetchMock.mockRejectedValue(new Error('net'))
    const res = await generateVideo({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('提交失败')
  })

  it('轮询返回 status=failed → 用上游错误文案', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T1' }] }))
      .mockResolvedValueOnce(jsonResp({ data: { status: 'failed', error: { message: 'timeout upstream' } } }))
    const res = await generateVideo({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('timeout upstream')
  })

  it('轮询无结果直到超时 → 轮询超时', async () => {
    // 第一次提交返回 task_id；之后轮询永远返回 pending，让循环一直跑到 timeoutMs
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T1' }] }))
      .mockResolvedValue(jsonResp({ data: { status: 'pending' } }))
    // setTimeout 保持加速（立即触发）；仅用 Date.now 让每次循环都越过 600000 上限 → 立刻超时
    let t = 0
    vi.spyOn(Date, 'now').mockImplementation(() => (t += 600001))
    const res = await generateVideo({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('轮询超时')
    vi.spyOn(Date, 'now').mockRestore()
  })
})
