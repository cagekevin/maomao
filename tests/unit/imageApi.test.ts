// @vitest-environment node
/**
 * imageApi 单测（2026-09-03 relay 收口后重写）。
 * generateImage 收 relayGenerate（直连 /api/generate），不再拼 /api/proxy genBody。
 * 保留：resolveImagePixel 查表纯函数（复刻官方）；generateImage relay 意图组装 + 信封映射。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/components/base/imageUrl.ts', () => ({
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

const api = await import('@/components/base/api/imageApi.ts')
const { normalizeImageUrlsForSend } = await import('../../src/components/base/imageUrl.ts')

beforeEach(() => {
  h.mockRelayGenerate.mockReset()
  vi.mocked(normalizeImageUrlsForSend).mockReset()
  vi.mocked(normalizeImageUrlsForSend).mockResolvedValue([])
})

describe('imageApi — resolveImagePixel（纯函数，复刻官方驻树）', () => {
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

describe('imageApi — generateImage relay 意图 + 信封', () => {
  it('relay 返回 {ok:true,url} → 映射为 GenerationResult', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://127.0.0.1:18080/files/tasks/x.png' })
    const res = await api.generateImage({
      provider: { id: 'lovart' },
      prompt: 'a cat',
      model: 'gpt-image-2-low',
      aspectRatio: '9:16',
      size: '1K',
      taskId: 'front-task-1',
    })
    expect(res).toEqual({ ok: true, url: 'http://127.0.0.1:18080/files/tasks/x.png' })
    const { intent, timeoutMs } = h.mockRelayGenerate.mock.calls[0][0]
    expect(intent.capability).toBe('image')
    expect(intent.providerId).toBe('lovart')
    expect(intent.model).toBe('gpt-image-2-low')
    expect(intent.prompt).toBe('a cat')
    // 9:16 + 1K → 精确像素 size
    expect(intent.size).toBe('880x1776')
    // 前端任务号透传
    expect(intent.frontTaskId).toBe('front-task-1')
    // 总超时对齐 GEN_TIMEOUT(300s)
    expect(timeoutMs).toBe(300000)
  })

  it('relay 返回 error → {ok:false, error}', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: false, error: '生成失败' })
    const res = await api.generateImage({ provider: { id: 'p1' }, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('生成失败')
  })

  it('relay 抛 AbortError → 转 aborted 信封', async () => {
    const err = new Error('Aborted')
    err.name = 'AbortError'
    h.mockRelayGenerate.mockRejectedValue(err)
    const res = await api.generateImage({ provider: { id: 'p1' }, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.aborted).toBe(true)
  })

  it('比例 Auto → size 不指定（undefined）', async () => {
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/y.png' })
    await api.generateImage({ provider: { id: 'p1' }, prompt: 'x', model: 'm', aspectRatio: 'Auto', size: '1K' })
    expect(h.mockRelayGenerate.mock.calls[0][0].intent.size).toBeUndefined()
  })

  it('参考图 → normalizeImageUrlsForSend 并透传 images', async () => {
    vi.mocked(normalizeImageUrlsForSend).mockResolvedValue(['http://ref/a.png'])
    h.mockRelayGenerate.mockResolvedValue({ ok: true, url: 'http://x/y.png' })
    await api.generateImage({ provider: { id: 'p1' }, prompt: 'x', model: 'm', images: ['blob:x'] })
    expect(normalizeImageUrlsForSend).toHaveBeenCalledWith(['blob:x'])
    expect(h.mockRelayGenerate.mock.calls[0][0].intent.images).toEqual(['http://ref/a.png'])
  })
})