// @vitest-environment node
/**
 * videoApi 单测（2026-09-03 relay 收口后重写）。
 * generateVideo 收 relayGenerate（直连 /api/generate 异步句柄），不再拼 /api/proxy。
 * 覆盖：relay 意图组装（size/resolution/duration/images/时间戳）+ 信封映射 + 取消转 aborted。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/components/base/utils/imageUrl.ts', () => ({
  normalizeImageUrlsForSend: vi.fn(async () => []),
  toAbsoluteFileUrl: vi.fn((u) => u),
  normalizeImageUrl: vi.fn((u) => u),
  normalizeImageUrlForSend: vi.fn(async (u) => u),
  toImageContentBlocks: vi.fn(() => []),
}))

const h = vi.hoisted(() => ({
  mockRelayGenerate: vi.fn(),
}))
vi.mock('../../src/components/base/api/relayProxy.ts', () => ({
  relayGenerate: (...a) => h.mockRelayGenerate(...a),
}))

const api = await import('@/components/base/api/videoApi.ts')
const { normalizeImageUrlsForSend } = await import('../../src/components/base/utils/imageUrl.ts')

beforeEach(() => {
  h.mockRelayGenerate.mockReset()
  vi.mocked(normalizeImageUrlsForSend).mockReset()
  vi.mocked(normalizeImageUrlsForSend).mockResolvedValue([])
})

describe('videoApi — generateVideo relay 意图 + 信封', () => {
  it('relay 返回 url → {ok:true, url}', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://127.0.0.1:18080/files/tasks/v.mp4' })
    const res = await api.generateVideo({
      provider: { id: 'lovart' },
      prompt: 'a horse',
      model: 'video-model',
      size: '16:9',
      resolution: '1080p',
      seconds: 8,
      taskId: 'front-task-1',
    })
    expect(res).toEqual({ ok: true, url: 'http://127.0.0.1:18080/files/tasks/v.mp4' })
    const { intent, timeoutMs } = h.mockRelayGenerate.mock.calls[0][0]
    expect(intent.capability).toBe('video')
    expect(intent.providerId).toBe('lovart')
    expect(intent.model).toBe('video-model')
    expect(intent.size).toBe('16:9')
    expect(intent.resolution).toBe('1080p')
    expect(intent.duration).toBe('8')
    expect(intent.frontTaskId).toBe('front-task-1')
    // 视频总超时 VIDEO_TIMEOUT(600s)
    expect(timeoutMs).toBe(600000)
  })

  it('size=Auto → 不写 size；无 seconds → 不写 duration', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/v.mp4' })
    await api.generateVideo({ provider: { id: 'p1' }, prompt: 'x', model: 'm', size: 'Auto' })
    const intent = h.mockRelayGenerate.mock.calls[0][0].intent
    expect(intent.size).toBeUndefined()
    expect(intent.duration).toBeUndefined()
  })

  it('参考图 → normalizeImageUrlsForSend 且透传 images', async () => {
    vi.mocked(normalizeImageUrlsForSend).mockResolvedValue(['http://ref/a.png'])
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/v.mp4' })
    await api.generateVideo({ provider: { id: 'p1' }, prompt: 'x', model: 'm', images: ['blob:i'] })
    expect(normalizeImageUrlsForSend).toHaveBeenCalledWith(['blob:i'])
    expect(h.mockRelayGenerate.mock.calls[0][0].intent.images).toEqual(['http://ref/a.png'])
  })

  it('relay 返回 error → {ok:false, error}', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: false, error: '生成失败' })
    const res = await api.generateVideo({ provider: { id: 'p1' }, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('生成失败')
  })

  it('relay 抛 AbortError → 转 aborted 信封', async () => {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    h.mockRelayGenerate.mockRejectedValue(err)
    const res = await api.generateVideo({ provider: { id: 'p1' }, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.aborted).toBe(true)
  })
})