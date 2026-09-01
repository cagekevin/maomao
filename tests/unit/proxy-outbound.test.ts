// @vitest-environment node
/**
 * B5 出口回收锁定测试（proxy-outbound）。
 *
 * 已由 imageApi/chatApi/videoApi/useAgentChat.hook 覆盖「行为路径」；
 * 本文件只锁「回炉到 httpRequest 的走法」这条结构性红线（T5.1 / T5.2）：
 *  - proxyGenerate 的 __proxyFetch / chatProxy 必须经 httpRequest 出站，且用 SSE 模式：
 *      timeoutMs:0（不被 15s 默认超时掐断长连接）+ retries:0 + parseJson:false（返回未消费原始 Response）
 *  - agentRuntime.roundTrip 走 /api/proxy 分支同样经 httpRequest 出站（SSE 行协议豁免红线不破）；
 *    直连官方分支为白名单，保留原生 fetch（不在本文件 mock 范围）
 *  - chatProxy 维持「信封永不抛错」的 {ok,error} 契约
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 记录每一次 httpRequest 出站参数，且仍走真实 httpRequest（保留真实行为）
const { outbound } = vi.hoisted(() => ({ outbound: { calls: [] } }))
vi.mock('../../src/components/base/api/httpClient.ts', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    httpRequest: (url, opts) => {
      outbound.calls.push({ url, opts })
      return actual.httpRequest(url, opts)
    },
  }
})

const { chatProxy, imageProxy } = await import('@/components/base/api/proxyGenerate.ts')
const { roundTrip } = await import('../../src/components/agent/runtime/agentRuntime.ts')

const provider = {
  id: 'openai',
  protocol: 'openai',
  base_url: 'http://127.0.0.1:18080/v1',
  image_mode: 'sync',
}

/** ASSERT：最近一次 httpRequest 出站走了统一出口 + SSE 模式（不掐断、不重试、不预解析）。 */
function expectProxyOutbound(count = 1) {
  const last = outbound.calls.slice(-count)
  for (const { url, opts } of last) {
    expect(url).toContain('/api/proxy')
    expect(opts.timeoutMs).toBe(0)
    expect(opts.retries).toBe(0)
    expect(opts.parseJson).toBe(false)
  }
  return last
}

beforeEach(() => { outbound.calls.length = 0; vi.restoreAllMocks() })
afterEach(() => { vi.unstubAllGlobals() })

describe('B5 · proxyGenerate 出口回炉 httpRequest', () => {
  it('chatProxy 经 httpRequest /api/proxy 出站，SSE 模式 + {ok,error} 契约不变', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: { choices: [{ message: { content: 'hi' } }] } }),
    }))
    const r = await chatProxy({ provider, body: {} })
    expectProxyOutbound()
    expect(r).toEqual({ ok: true, content: 'hi' })
  })

  it('__proxyFetch 经 httpRequest /api/proxy 出站，timeoutMs:0（SSE 流不被 15s 掐断）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [{ task_id: 't1', status: 'submitted' }] }),
    }).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ data: { result: { images: [{ url: 'p' }] } } }),
    }))
    const r = await imageProxy({ provider: { ...provider, image_mode: 'async' }, genBody: {} })
    expectProxyOutbound(2) // 提交 + 轮询各一次
    expect(r).toEqual({ ok: true, url: 'p' })
  })

  it('chatProxy 非 2xx：走 HttpError 业务分支，不误加「网络错误」前缀（{ok,error} 契约）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 402,
      json: async () => ({ error: { message: '余额不足' } }),
    }))
    const r = await chatProxy({ provider, body: {} })
    expectProxyOutbound()
    expect(r).toEqual({ ok: false, error: '余额不足' })
  })
})

describe('B5 · agentRuntime roundTrip proxy 分支回炉 httpRequest', () => {
  function agentCtx() {
    return {
      endpoint: 'http://local/api/agent/k/chat',
      model: 'm',
      toolSchemas: [{ name: 'show_plan_for_confirm' }],
      provider: { id: 'p1', protocol: 'openai', base_url: 'http://up' },
      apiBase: 'http://local',
      chatApiKey: '',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      loadAgentChatModel: () => ({ streamMode: 'stream', id: 'm' }),
      parseAgentError: (res, fb) => `err:${res?.status || ''}:${fb}`,
      parseSSEChunk: vi.fn(),
      ENABLE_TOOLS_ON_NON_STREAM: false,
      onStream: vi.fn(),
    }
  }

  it('provider 存在走 /api/proxy：经 httpRequest 出站，SSE 模式（不掐断），流能读', async () => {
    const streamBody = {
      getReader: () => {
        let done = false
        return { read: async () => done ? { done: true, value: undefined } : (done = true, { done: false, value: new TextEncoder().encode('data: {}\n\n') }) }
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      headers: { get: (k) => (k === 'content-type' ? 'text/event-stream' : null) },
      body: streamBody,
    }))
    const ctx = agentCtx()
    await roundTrip(ctx, [{ role: 'user', content: 'hi' }], new AbortController().signal, ctx.onStream)
    expectProxyOutbound()
  })
})