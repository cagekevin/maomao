// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 【对齐大雄 docs/12-ai助手架构.md §6.3】
// 覆盖 roundTrip 的「非流式工具开关」路径：
//   - ENABLE_TOOLS_ON_NON_STREAM=false + 非流式模型 → 请求体不含 tools，响应解析不带 tool_calls
//   - ENABLE_TOOLS_ON_NON_STREAM=true  + 非流式模型 → 请求体含 tools，响应带 tool_calls 时回填
//   - 流式模型默认带 tools（无论开关）
import { roundTrip } from '../../src/components/agent/runtime/agentRuntime.ts'

function makeCtx({ streamMode = 'stream', ENABLE_TOOLS_ON_NON_STREAM = false, toolSchemas = [{ name: 'show_plan_for_confirm' }], provider = null, useProxy = false, onStream } = {}) {
  return {
    endpoint: 'http://local/api/agent/key/chat',
    model: 'test-model',
    toolSchemas,
    provider: useProxy ? (provider || { id: 'p1', protocol: 'openai', base_url: 'http://up' }) : null,
    apiBase: 'http://local',
    chatApiKey: '',
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    loadAgentChatModel: () => ({ streamMode, id: 'm1' }),
    parseAgentError: (res, fb) => `err:${res?.status || ''}:${fb}`,
    parseSSEChunk: vi.fn(),
    ENABLE_TOOLS_ON_NON_STREAM,
    onStream: onStream || vi.fn(),
  }
}

// 构造 mock fetch：记录请求体，返回给定响应
function mockFetchOnce({ assertBody, jsonResp, status = 200, headers = {} }) {
  const fetchMock = vi.fn(async (url, opts) => {
    const body = JSON.parse(opts.body)
    if (assertBody) assertBody(body)
    // 实际代码用 res.text() + safeParseNonStreamJSON 解析非流式响应
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(jsonResp),
      headers: { get: (k) => headers[k] || null },
      body: null,
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('agentRuntime.roundTrip —— 非流式工具开关 (§6.3)', () => {
  beforeEach(() => { vi.restoreAllMocks() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('【§6.3 默认】非流式模型 + 开关=false → 请求体不含 tools/tool_choice', async () => {
    let captured
    mockFetchOnce({
      assertBody: (b) => { captured = b },
      jsonResp: { choices: [{ message: { content: '普通对话', role: 'assistant' } }] },
    })
    const ctx = makeCtx({ streamMode: 'non-stream', ENABLE_TOOLS_ON_NON_STREAM: false })
    const r = await roundTrip(ctx, [{ role: 'user', content: 'hi' }], new AbortController().signal, ctx.onStream)
    expect(captured.tools).toBeUndefined()
    expect(captured.tool_choice).toBeUndefined()
    expect(captured.stream).toBe(false)
    expect(r.content).toBe('普通对话')
    expect(r.tool_calls).toBeUndefined()
  })

  it('【§6.3 开开关】非流式模型 + 开关=true → 请求体含 tools/tool_choice，且响应 tool_calls 被回填', async () => {
    let captured
    mockFetchOnce({
      assertBody: (b) => { captured = b },
      jsonResp: {
        choices: [{
          message: {
            content: '',
            role: 'assistant',
            tool_calls: [{ id: 'c1', type: 'function', function: { name: 'show_plan_for_confirm', arguments: '{"plan_text":"x"}' } }],
          },
        }],
      },
    })
    const ctx = makeCtx({ streamMode: 'non-stream', ENABLE_TOOLS_ON_NON_STREAM: true })
    const r = await roundTrip(ctx, [{ role: 'user', content: 'hi' }], new AbortController().signal, ctx.onStream)
    expect(Array.isArray(captured.tools)).toBe(true)
    expect(captured.tool_choice).toBe('auto')
    expect(r.tool_calls).toBeDefined()
    expect(r.tool_calls[0].function.name).toBe('show_plan_for_confirm')
  })

  it('【§6.3 开开关但无 tool_calls】非流式 + 开关=true → 响应无 tool_calls 时不回填', async () => {
    mockFetchOnce({
      jsonResp: { choices: [{ message: { content: '纯文本', role: 'assistant' } }] },
    })
    const ctx = makeCtx({ streamMode: 'non-stream', ENABLE_TOOLS_ON_NON_STREAM: true })
    const r = await roundTrip(ctx, [{ role: 'user', content: 'hi' }], new AbortController().signal, ctx.onStream)
    expect(r.content).toBe('纯文本')
    expect(r.tool_calls).toBeUndefined()
  })

  it('【§6.3 流式默认】流式模型 → 请求体含 tools（无论开关），走 SSE', async () => {
    let captured
    // 流式响应：构造可读流
    const streamText = 'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
    const fetchMock = vi.fn(async (url, opts) => {
      captured = JSON.parse(opts.body)
      return {
        ok: true, status: 200,
        headers: { get: (k) => (k === 'content-type' ? 'text/event-stream' : null) },
        body: {
          getReader: () => {
            let done = false
            return {
              read: async () => {
                if (done) return { done: true, value: undefined }
                done = true
                return { done: false, value: new TextEncoder().encode(streamText) }
              },
            }
          },
        },
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    // 提供 parseSSEChunk 真实实现（最小：把 delta.content 累积）
    const ctx = makeCtx({
      streamMode: 'stream',
      ENABLE_TOOLS_ON_NON_STREAM: false,
      onStream: vi.fn(),
    })
    ctx.parseSSEChunk = (chunk, acc) => {
      const m = chunk.match(/data:\s*(.*)/)
      if (m && m[1] !== '[DONE]') {
        try {
          const d = JSON.parse(m[1])
          const delta = d.choices?.[0]?.delta || {}
          if (delta.content) acc.content += delta.content
        } catch (_) {}
      }
    }
    const r = await roundTrip(ctx, [{ role: 'user', content: 'hi' }], new AbortController().signal, ctx.onStream)
    expect(Array.isArray(captured.tools)).toBe(true)
    expect(captured.stream).toBe(true)
    expect(r.content).toBe('hello')
  })

  it('【吞输出兜底】流式模式下模型返回非流式 JSON（message.content）也能拿到 content', async () => {
    // 场景：streamMode='stream'，但模型/网关实际返回普通 JSON（choices[0].message.content）。
    // parseSSEChunk 只认 data: 前缀，会把整段吞掉；此处应经非流式兜底解析提取到 content。
    const jsonResp = { id: 'x', choices: [{ message: { role: 'assistant', content: '流式模式收到非流式JSON' } }] }
    const fetchMock = vi.fn(async (url, opts) => ({
      ok: true, status: 200,
      headers: { get: (k) => null },
      body: {
        getReader: () => {
          let done = false
          return {
            read: async () => {
              if (done) return { done: true, value: undefined }
              done = true
              return { done: false, value: new TextEncoder().encode(JSON.stringify(jsonResp)) }
            },
          }
        },
      },
    }))
    vi.stubGlobal('fetch', fetchMock)
    // 真实 parseSSEChunk（返回 boolean：data: 前缀 true / 非 data: 前缀 false，驱动兜底）
    const ctx = makeCtx({
      streamMode: 'stream',
      ENABLE_TOOLS_ON_NON_STREAM: false,
      onStream: vi.fn(),
    })
    const { parseSSEChunk } = await import('../../src/components/agent/runtime/agentCore.ts')
    ctx.parseSSEChunk = parseSSEChunk
    const r = await roundTrip(ctx, [{ role: 'user', content: 'hi' }], new AbortController().signal, ctx.onStream)
    expect(r.content).toBe('流式模式收到非流式JSON')
  })

  it('【吞输出兜底】流式模式下非流式 JSON 带 tool_calls 也能回填', async () => {
    const jsonResp = {
      id: 'x',
      choices: [{
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'create_node', arguments: '{"nodeType":"textNode"}' } }],
        },
      }],
    }
    const fetchMock = vi.fn(async (url, opts) => ({
      ok: true, status: 200,
      headers: { get: (k) => null },
      body: {
        getReader: () => {
          let done = false
          return {
            read: async () => {
              if (done) return { done: true, value: undefined }
              done = true
              return { done: false, value: new TextEncoder().encode(JSON.stringify(jsonResp)) }
            },
          }
        },
      },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = makeCtx({ streamMode: 'stream', ENABLE_TOOLS_ON_NON_STREAM: false, onStream: vi.fn() })
    const { parseSSEChunk } = await import('../../src/components/agent/runtime/agentCore.ts')
    ctx.parseSSEChunk = parseSSEChunk
    const r = await roundTrip(ctx, [{ role: 'user', content: 'hi' }], new AbortController().signal, ctx.onStream)
    expect(Array.isArray(r.tool_calls)).toBe(true)
    expect(r.tool_calls[0].function.name).toBe('create_node')
    expect(r.tool_calls[0].function.arguments).toBe('{"nodeType":"textNode"}')
  })
})
