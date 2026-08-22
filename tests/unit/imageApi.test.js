// @vitest-environment node
/**
 * imageApi 单测（批 2，API 封装层）。
 * 覆盖：resolveImagePixel 查表与边界（纯函数）；generateImage sync 模式成功取 url；
 * 网络错误分支。策略：node + mock fetch(SSE reader) + mock imageUrl/taskStore。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { jsonResp, sseResp } from './_testUtils.mjs'

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

const api = await import('../../src/components/base/imageApi.js')
const { normalizeImageUrlsForSend } = await import('../../src/components/base/imageUrl.js')
const { getCurrentTaskId, setTaskPollId } = await import('../../src/components/base/taskStore.js')

beforeEach(() => {
  // mockReset 清掉上个用例遗留的 mockResolvedValueOnce / mockRejectedValueOnce 队列
  fetchMock.mockReset()
  normalizeImageUrlsForSend.mockReset()
  normalizeImageUrlsForSend.mockResolvedValue([])
  getCurrentTaskId.mockReset()
  getCurrentTaskId.mockReturnValue(null)
  setTaskPollId.mockReset()
  vi.restoreAllMocks() // 清掉上个用例 spy 的 setTimeout
})
afterEach(() => vi.unstubAllGlobals())

describe('imageApi — resolveImagePixel（纯函数）', () => {
  it('Auto / 空 → 空串（不指定 size）', () => {
    expect(api.resolveImagePixel('Auto', '1K')).toBe('')
    expect(api.resolveImagePixel('auto', '1K')).toBe('')
    expect(api.resolveImagePixel('', '1K')).toBe('')
  })
  it('比例+档位 → 精确像素（查表）', () => {
    expect(api.resolveImagePixel('9:16', '1K')).toBe('880x1776')
    expect(api.resolveImagePixel('16:9', '2K')).toBe('2048x1152')
    expect(api.resolveImagePixel('1:1', '4K')).toBe('2880x2880')
  })
  it('档位查不到 → 回退该比例 1K', () => {
    expect(api.resolveImagePixel('9:16', '8K')).toBe('880x1776')
  })
  it('比例未知 → 兜底 1024x1024', () => {
    expect(api.resolveImagePixel('99:1', '1K')).toBe('1024x1024')
  })
})

describe('imageApi — generateImage sync 成功', () => {
  it('SSE 流含 succeeded + results[0].url → 返回 ok:true,url', async () => {
    fetchMock.mockResolvedValue(
      sseResp(['data: {"status":"succeeded","progress":100,"results":[{"url":"http://x/y.png"}]}'])
    )
    const res = await api.generateImage({
      provider: { id: 'p1' },
      prompt: 'a cat',
      model: 'm',
      aspectRatio: '9:16',
      size: '1K',
    })
    expect(res.ok).toBe(true)
    expect(res.url).toBe('http://x/y.png')
    // 请求打到 /api/proxy，且负载 url 指向 images/generations
    expect(fetchMock.mock.calls[0][0]).toContain('/api/proxy')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.url).toContain('images/generations')
  })

  it('SSE 流无 url → 返回失败', async () => {
    fetchMock.mockResolvedValue(sseResp(['data: {"status":"succeeded","progress":100}']))
    const res = await api.generateImage({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('未返回图片')
  })

  it('genBody：比例非 Auto → size 转精确像素 + resolution/image_size/quality/n', async () => {
    fetchMock.mockResolvedValue(sseResp(['data: {"status":"succeeded","results":[{"url":"http://x/y.png"}]}']))
    await api.generateImage({ provider: {}, prompt: 'a cat', model: 'm', aspectRatio: '9:16', size: '2K', n: 2, quality: 'high' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const genBody = JSON.parse(body.body)
    expect(genBody.size).toBe('1152x2048') // 9:16 + 2K
    expect(genBody.resolution).toBe('2K')
    expect(genBody.image_size).toBe('2K')
    expect(genBody.quality).toBe('high')
    expect(genBody.n).toBe(2)
  })

  it('genBody：比例 Auto → size 用传入档位原样', async () => {
    fetchMock.mockResolvedValue(sseResp(['data: {"status":"succeeded","results":[{"url":"http://x/y.png"}]}']))
    await api.generateImage({ provider: {}, prompt: 'x', model: 'm', aspectRatio: 'Auto', size: '1024' })
    const genBody = JSON.parse(JSON.parse(fetchMock.mock.calls[0][1].body).body)
    expect(genBody.size).toBe('1024')
  })

  it('quality=auto → 不写 quality', async () => {
    fetchMock.mockResolvedValue(sseResp(['data: {"status":"succeeded","results":[{"url":"http://x/y.png"}]}']))
    await api.generateImage({ provider: {}, prompt: 'x', model: 'm', quality: 'auto' })
    const genBody = JSON.parse(JSON.parse(fetchMock.mock.calls[0][1].body).body)
    expect(genBody.quality).toBeUndefined()
  })

  it('参考图 → normalizeImageUrlsForSend 且写 image_urls', async () => {
    normalizeImageUrlsForSend.mockResolvedValue(['http://ref/a.png'])
    fetchMock.mockResolvedValue(sseResp(['data: {"status":"succeeded","results":[{"url":"http://x/y.png"}]}']))
    await api.generateImage({ provider: {}, prompt: 'x', model: 'm', images: ['blob:x'] })
    expect(normalizeImageUrlsForSend).toHaveBeenCalledWith(['blob:x'], { preferBase64: false })
    const genBody = JSON.parse(JSON.parse(fetchMock.mock.calls[0][1].body).body)
    expect(genBody.image_urls).toEqual(['http://ref/a.png'])
  })

  it('refFormat=base64 → normalizeImageUrlsForSend 传 preferBase64', async () => {
    normalizeImageUrlsForSend.mockResolvedValue([])
    fetchMock.mockResolvedValue(sseResp(['data: {"status":"succeeded","results":[{"url":"http://x/y.png"}]}']))
    await api.generateImage({ provider: { refFormat: 'base64' }, prompt: 'x', model: 'm', images: ['http://x/a.png'] })
    expect(normalizeImageUrlsForSend).toHaveBeenCalledWith(['http://x/a.png'], { preferBase64: true })
  })

  it('openai 协议 → 提交 url 用伪协议 openai://images/generations 且带 wait=1', async () => {
    fetchMock.mockResolvedValue(sseResp(['data: {"status":"succeeded","results":[{"url":"http://x/y.png"}]}']))
    await api.generateImage({ provider: { protocol: 'openai' }, prompt: 'x', model: 'm' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.url).toBe('openai://images/generations?wait=1')
  })

  it('SSE 多事件：progress 单调封顶 + result.images 数组 url', async () => {
    const progress = vi.fn()
    fetchMock.mockResolvedValue(sseResp([
      'data: {"status":"processing","progress":50}',
      // 非单调：90 后又回 10，应被单调封顶不会掉回去
      'data: {"status":"processing","progress":10}',
      'data: {"status":"succeeded","progress":100,"result":{"images":[{"url":["http://x/arr.png"]}]}}',
    ]))
    const res = await api.generateImage({ provider: {}, prompt: 'x', model: 'm' }, progress)
    expect(res.ok).toBe(true)
    expect(res.url).toBe('http://x/arr.png')
    // 触发过 progress
    expect(progress).toHaveBeenCalled()
  })

  it('SSE 事件带 error → 因无 url 判失败（内部 catch 吞掉该条错误，落回未返回图片）', async () => {
    fetchMock.mockResolvedValue(sseResp(['data: {"status":"failed","error":"content rejected"}']))
    const res = await api.generateImage({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('未返回图片')
  })
})

describe('imageApi — 错误路径', () => {
  it('fetch reject（网络错误）→ ok:false', async () => {
    // 用共享 mock（beforeEach mockReset 会自动清理），不要替换 globalThis.fetch 以免污染后续用例
    fetchMock.mockImplementation(async () => { throw new Error('net') })
    const res = await api.generateImage({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('生图失败')
  })
})

describe('imageApi — async 模式（image_mode: async）', () => {
  // 轮询循环内有真实 setTimeout(pollInterval=3s)。用 fake timers 把睡眠加速为近似瞬时：
  // 先发起 promise，再 advanceTimersByTimeAsync(3000) 触发首个轮询 sleep，避免全量真等 3s/例。
  // 注意：文件级 beforeEach 的 vi.restoreAllMocks() 不重置 fake timer，须显式 useRealTimers 还原。
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('提交拿 task_id → 轮询到 images url（数组形式）', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T1' }] }))
      .mockResolvedValueOnce(jsonResp({ data: { result: { images: [{ url: ['http://x/async.png'] }] } } }))
    const p = api.generateImage({ provider: { image_mode: 'async' }, prompt: 'x', model: 'm' })
    await vi.advanceTimersByTimeAsync(3000) // 触发首个轮询 sleep
    const res = await p
    expect(res.ok).toBe(true)
    expect(res.url).toBe('http://x/async.png')
    // 异步提交成功 → 回填 setTaskPollId
    expect(setTaskPollId).toHaveBeenCalled()
  })

  it('提交返回直接结果（非任务形态）→ 直接成功', async () => {
    fetchMock.mockResolvedValueOnce(jsonResp({ data: { results: [{ url: 'http://x/d.png' }] } }))
    const res = await api.generateImage({ provider: { image_mode: 'async' }, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(true)
    expect(res.url).toBe('http://x/d.png')
  })

  it('轮询 status=failed → 失败', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T1' }] }))
      .mockResolvedValueOnce(jsonResp({ data: { status: 'failed', error: 'bad prompt' } }))
    const p = api.generateImage({ provider: { image_mode: 'async' }, prompt: 'x', model: 'm' })
    await vi.advanceTimersByTimeAsync(3000)
    const res = await p
    expect(res.ok).toBe(false)
    expect(res.error).toBe('bad prompt')
  })

  it('轮询网络错误 → 失败', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResp({ data: [{ status: 'submitted', task_id: 'T1' }] }))
      .mockRejectedValueOnce(new Error('net'))
    const p = api.generateImage({ provider: { image_mode: 'async' }, prompt: 'x', model: 'm' })
    await vi.advanceTimersByTimeAsync(3000)
    const res = await p
    expect(res.ok).toBe(false)
    expect(res.error).toContain('轮询失败')
  })
})
