// @vitest-environment node
/**
 * chatApi 单测（批 2，API 封装层）。
 * 覆盖：chatCompletions 成功返回 content / 网络异常 / AbortError / 上游无文本。
 * 策略：node + mock fetch + mock refImage（resolveRefImages / toImageContentBlocks）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const fetchMock = globalThis.fetch

vi.mock('../../src/components/base/refImage.js', () => ({
  resolveRefImages: vi.fn(async () => []),
  toImageContentBlocks: vi.fn(() => []),
}))

const { chatCompletions } = await import('../../src/components/base/chatApi.js')
const { resolveRefImages } = await import('../../src/components/base/refImage.js')

function proxyResp(obj, ok = true, status = 200) {
  return { ok, status, json: async () => obj }
}

beforeEach(() => {
  // 恢复全局 fetch 为共享 mock（防止某用例直接覆盖 globalThis.fetch 影响后续用例）
  globalThis.fetch = fetchMock
  fetchMock.mockClear()
})

describe('chatApi — chatCompletions 成功', () => {
  it('返回统一信封 ok:true + content', async () => {
    fetchMock.mockResolvedValue(
      proxyResp({ data: { choices: [{ message: { content: '你好' } }] } })
    )
    const res = await chatCompletions({
      provider: { id: 'p1' },
      model: 'gpt',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(res.ok).toBe(true)
    expect(res.content).toBe('你好')
    // 请求发到 /api/proxy
    expect(fetchMock.mock.calls[0][0]).toContain('/api/proxy')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.providerId).toBe('p1')
  })

  it('有参考图时调用 resolveRefImages', async () => {
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: 'x' } }] } }))
    await chatCompletions({
      provider: {},
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      images: ['blob:abc'],
    })
    expect(resolveRefImages).toHaveBeenCalledWith(['blob:abc'], expect.any(Object))
  })
})

describe('chatApi — 错误路径', () => {
  it('fetch reject → 网络错误信封', async () => {
    fetchMock.mockRejectedValue(new Error('net down'))
    const res = await chatCompletions({ provider: {}, model: 'm', messages: [] })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('网络错误')
  })

  it('AbortError → aborted 信封', async () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    fetchMock.mockRejectedValue(err)
    const res = await chatCompletions({ provider: {}, model: 'm', messages: [] })
    expect(res.ok).toBe(false)
    expect(res.aborted).toBe(true)
    expect(res.error).toBe('已停止')
  })

  it('上游 HTTP 失败 → error 取自上游消息', async () => {
    fetchMock.mockResolvedValue(proxyResp({ error: { message: 'invalid key' } }, false, 401))
    const res = await chatCompletions({ provider: {}, model: 'm', messages: [] })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('invalid key')
  })

  it('上游无文本内容 → 失败信封', async () => {
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: '' } }] } }))
    const res = await chatCompletions({ provider: {}, model: 'm', messages: [] })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('未返回文本')
  })
})
