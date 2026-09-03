// @vitest-environment node
/**
 * chatApi 单测（2026-09-03 relay 收口后重写）。
 * chatCompletions 现收 relayChat（直连 localTool /api/relay），不再拼 /api/proxy。
 * 覆盖：relay 信封 → {ok,content} 映射；参考图 attachImages 归一；temperature/responseFormat 透传。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../src/components/base/imageUrl.ts', () => ({
  normalizeImageUrlsForSend: vi.fn(async () => []),
  toImageContentBlocks: vi.fn((urls) => (urls || []).map((url) => ({ type: 'image_url', image_url: { url } }))),
  toAbsoluteFileUrl: vi.fn((u) => u),
  normalizeImageUrl: vi.fn((u) => u),
  normalizeImageUrlForSend: vi.fn(async (u) => u),
}))

const h = vi.hoisted(() => ({
  mockRelayChat: vi.fn(),
}))
vi.mock('../../src/components/base/api/relayProxy.ts', () => ({
  relayChat: (...a) => h.mockRelayChat(...a),
}))

const { chatCompletions } = await import('@/components/base/api/chatApi.ts')
const { normalizeImageUrlsForSend } = await import('../../src/components/base/imageUrl.ts')

beforeEach(() => {
  h.mockRelayChat.mockReset()
  vi.mocked(normalizeImageUrlsForSend).mockReset()
  vi.mocked(normalizeImageUrlsForSend).mockResolvedValue([])
})

describe('chatApi — relay 信封映射', () => {
  it('relay 返回 content → {ok:true, content}', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: true, content: '你好' })
    const res = await chatCompletions({
      provider: { id: 'lovart' },
      model: 'lovart-chat',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(res).toEqual({ ok: true, content: '你好' })
    // 意图经 relayChat：providerId/capability/model/messages 正确传入
    const intent = h.mockRelayChat.mock.calls[0][0]
    expect(intent.providerId).toBe('lovart')
    expect(intent.capability).toBe('chat')
    expect(intent.model).toBe('lovart-chat')
    expect(intent.messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('relay 返回 error → {ok:false, error}', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: false, error: '上游未返回文本内容' })
    const res = await chatCompletions({ provider: { id: 'p1' }, model: 'm', messages: [] })
    expect(res.ok).toBe(false)
    expect(res.error).toBe('上游未返回文本内容')
  })

  it('relay 返回 aborted → {ok:false, aborted:true}', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: false, aborted: true, error: '已停止' })
    const res = await chatCompletions({ provider: { id: 'p1' }, model: 'm', messages: [] })
    expect(res.ok).toBe(false)
    expect(res.aborted).toBe(true)
  })

  it('temperature 与 responseFormat 透传 relayChat（json→json_object 归一）', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: true, content: 'x' })
    await chatCompletions({
      provider: { id: 'p1' },
      model: 'm',
      messages: [],
      temperature: 0.7,
      responseFormat: 'json',
    })
    const opts = h.mockRelayChat.mock.calls[0][1]
    expect(opts.temperature).toBe(0.7)
    expect(opts.responseFormat).toBe('json_object') // 'json' 归一为后端认的 json_object
  })
})

describe('chatApi — 参考图 attachImages', () => {
  it('无参考图 → 不调 normalizeImageUrlsForSend，消息原样', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: true, content: 'x' })
    await chatCompletions({ provider: { id: 'p1' }, model: 'm', messages: [{ role: 'user', content: 'hi' }] })
    expect(normalizeImageUrlsForSend).not.toHaveBeenCalled()
    expect(h.mockRelayChat.mock.calls[0][0].messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('有参考图 → normalizeImageUrlsForSend 且把图片块追加到末条 user 消息', async () => {
    vi.mocked(normalizeImageUrlsForSend).mockResolvedValue(['http://ref/x.png'])
    h.mockRelayChat.mockResolvedValue({ ok: true, content: 'x' })
    await chatCompletions({
      provider: { id: 'p1' },
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      images: ['blob:q'],
    })
    expect(normalizeImageUrlsForSend).toHaveBeenCalledWith(['blob:q'])
    const sent = h.mockRelayChat.mock.calls[0][0].messages
    expect(sent).toHaveLength(1)
    expect(sent[0].content).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'image_url', image_url: { url: 'http://ref/x.png' } },
    ])
  })

  it('normalizeImageUrlsForSend 返回空 → 不追加图片块，消息原样', async () => {
    h.mockRelayChat.mockResolvedValue({ ok: true, content: 'x' })
    await chatCompletions({
      provider: { id: 'p1' },
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      images: ['http://x/a.png'],
    })
    const sent = h.mockRelayChat.mock.calls[0][0].messages
    expect(sent[0].content).toBe('hi')
  })
})