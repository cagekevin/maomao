// @vitest-environment node
/**
 * imageApi 单测（批 2，API 封装层）。
 * 覆盖：resolveImagePixel 查表与边界（纯函数）；generateImage sync 模式成功取 url；
 * 网络错误分支。策略：node + mock fetch(SSE reader) + mock refImage/taskStore。
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

const api = await import('../../src/components/base/imageApi.js')

// 构造 SSE 假响应：依次 push 若干 data 行，最后 done
function sseResp(lines) {
  let i = 0
  const chunks = lines.map((l) => new TextEncoder().encode(l + '\n'))
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (i < chunks.length) return { done: false, value: chunks[i++] }
            return { done: true, value: undefined }
          },
          releaseLock() {},
        }
      },
    },
  }
}

beforeEach(() => fetchMock.mockClear())
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
})

describe('imageApi — 错误路径', () => {
  it('fetch reject（网络错误）→ ok:false', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('net'))
    const res = await api.generateImage({ provider: {}, prompt: 'x', model: 'm' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('生图失败')
  })
})
