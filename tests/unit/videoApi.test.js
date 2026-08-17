// @vitest-environment node
/**
 * videoApi 单测（批 2，API 封装层）。
 * 覆盖：generateVideo 强制 async（提交→轮询→取 url）；无 task_id 失败；网络错误分支。
 * 策略：node + mock fetch（顺序响应）+ mock refImage/taskStore + mock setTimeout 加速轮询。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const fetchMock = globalThis.fetch

vi.mock('../../src/components/base/refImage.js', () => ({
  resolveRefImages: vi.fn(async () => []),
}))
vi.mock('../../src/components/base/taskStore.js', () => ({
  getCurrentTaskId: vi.fn(() => null),
  setTaskPollId: vi.fn(),
}))

const { generateVideo } = await import('../../src/components/base/videoApi.js')

function jsonResp(obj, ok = true, status = 200) {
  return { ok, status, json: async () => obj }
}

beforeEach(() => {
  fetchMock.mockClear()
  // 加速轮询里的 setTimeout(5000)
  vi.spyOn(global, 'setTimeout').mockImplementation((fn) => Promise.resolve().then(fn))
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
})
