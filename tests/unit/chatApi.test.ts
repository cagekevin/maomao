// @vitest-environment node
/**
 * chatApi 单测（批 2，API 封装层）。
 * 覆盖：chatCompletions 成功返回 content / 网络异常 / AbortError / 上游无文本。
 * 策略：node + mock fetch + mock imageUrl（normalizeImageUrlsForSend / toImageContentBlocks）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// setup.mjs 已把 globalThis.fetch 定义为共享 vi.fn；此处做类型对齐以启用 .mock* / mock.calls。
const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>

vi.mock('../../src/components/base/imageUrl.ts', () => ({
  normalizeImageUrlsForSend: vi.fn(async () => []),
  // 纯函数：mock 成与源码一致的实现，便于断言聊天消息里图片块的形态
  toImageContentBlocks: vi.fn((urls) => (urls || []).map((url) => ({ type: 'image_url', image_url: { url } }))),
  // 其他导出不需要 mock
  toAbsoluteFileUrl: vi.fn((u) => u),
  normalizeImageUrl: vi.fn((u) => u),
  normalizeImageUrlForSend: vi.fn(async (u) => u),
}))

const { chatCompletions } = await import('@/components/base/api/chatApi.ts')
const { normalizeImageUrlsForSend } = await import('../../src/components/base/imageUrl.ts')

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

  it('apimart 协议 → targetUrl 拼 base_url + /v1/chat/completions', async () => {
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: 'x' } }] } }))
    await chatCompletions({ provider: { protocol: 'apimart', base_url: 'https://api.example.com/' }, model: 'm', messages: [] })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    // 去掉末尾 /，base_url + /v1/chat/completions
    expect(body.url).toBe('https://api.example.com/v1/chat/completions')
  })

  it('openai 协议 → targetUrl 用伪协议 openai://chat/completions', async () => {
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: 'x' } }] } }))
    await chatCompletions({ provider: { protocol: 'openai', base_url: 'ignored' }, model: 'm', messages: [] })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.url).toBe('openai://chat/completions')
  })

  // /api/proxy 负载结构：外层 { url, method, body: '<inner json>', providerId? }，内层才是 { model, messages, temperature, stream }
  // 注意：有参考图时 attachImages 先触发 logger.info → 上报 /api/logs（也是 fetch），
  // 故 chat 请求不一定是 calls[0]；用最后一条（chatCompletions 只发一次 chat post）取内层 body。
  function innerBody() {
    const outer = JSON.parse(fetchMock.mock.calls.at(-1)[1].body)
    return JSON.parse(outer.body)
  }

  it('responseFormat 传给 response_format', async () => {
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: 'x' } }] } }))
    await chatCompletions({ provider: {}, model: 'm', messages: [], responseFormat: 'json_object' })
    expect(innerBody().response_format).toEqual({ type: 'json_object' })
  })

  it('temperature 默认 0.1 且 stream=false', async () => {
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: 'x' } }] } }))
    await chatCompletions({ provider: {}, model: 'm', messages: [] })
    expect(innerBody().temperature).toBe(0.1)
    expect(innerBody().stream).toBe(false)
  })

  it('有参考图时调用 normalizeImageUrlsForSend 并追加 image_url 内容块到末条 user 消息', async () => {
    vi.mocked(normalizeImageUrlsForSend).mockResolvedValue(['http://ref/x.png'])
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: 'x' } }] } }))
    await chatCompletions({
      provider: {},
      model: 'm',
      messages: [{ role: 'user', content: 'hi' }],
      images: ['blob:abc'],
    })
    expect(normalizeImageUrlsForSend).toHaveBeenCalledWith(['blob:abc'], expect.any(Object))
    const msgs = innerBody().messages
    const last = msgs[msgs.length - 1]
    // 末条 user 消息 content 转成数组，末尾追加 image_url 块
    expect(Array.isArray(last.content)).toBe(true)
    expect(last.content).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'image_url', image_url: { url: 'http://ref/x.png' } },
    ])
  })

  it('无参考图（images 空）→ 不调 normalizeImageUrlsForSend，消息原样', async () => {
    vi.mocked(normalizeImageUrlsForSend).mockClear()
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: 'x' } }] } }))
    await chatCompletions({ provider: {}, model: 'm', messages: [{ role: 'user', content: 'hi' }], images: [] })
    expect(normalizeImageUrlsForSend).not.toHaveBeenCalled()
    expect(innerBody().messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('normalizeImageUrlsForSend 返回空 → 不追加图片块', async () => {
    vi.mocked(normalizeImageUrlsForSend).mockResolvedValue([])
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: 'x' } }] } }))
    await chatCompletions({ provider: {}, model: 'm', messages: [{ role: 'user', content: 'hi' }], images: ['blob:x'] })
    expect(innerBody().messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('refFormat=base64 → normalizeImageUrlsForSend 传 preferBase64', async () => {
    vi.mocked(normalizeImageUrlsForSend).mockResolvedValue([])
    fetchMock.mockResolvedValue(proxyResp({ data: { choices: [{ message: { content: 'x' } }] } }))
    await chatCompletions({ provider: { refFormat: 'base64' }, model: 'm', messages: [], images: ['http://x/a.png'] })
    expect(normalizeImageUrlsForSend).toHaveBeenCalledWith(['http://x/a.png'], { preferBase64: true })
  })
})

describe('chatApi — 错误路径', () => {
  it('fetch reject → 网络错误信封', async () => {
    // 生产网络失败是 TypeError（fetch 断网）；真实网络错误才被加「网络错误」标记（可自动重试）
    fetchMock.mockRejectedValue(new TypeError('net down'))
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

  it('响应 JSON 解析失败 → 失败信封（含 HTTP 状态）', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json') } })
    const res = await chatCompletions({ provider: {}, model: 'm', messages: [] })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('响应解析失败')
    expect(res.error).toContain('200')
  })

  it('HTTP 失败但无 message → 兜底 HTTP 状态', async () => {
    fetchMock.mockResolvedValue(proxyResp({}, false, 500))
    const res = await chatCompletions({ provider: {}, model: 'm', messages: [] })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('HTTP 500')
  })
})
