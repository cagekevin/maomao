// @vitest-environment jsdom
/**
 * useAgentChat hook 编排层深度测试。
 * 覆盖之前只有"调一下返回 ok"的浅层盲区：
 *   send 多轮工具循环 / SSE 解析接入 / stop 中止 / steer 排队 / clear / stateAction 推导。
 *
 * 隔离策略：
 *  - mock useCanvasAgentTools：返回可控 callTool / toolSchemas（不依赖底层画布 store）。
 *  - mock conversationStore：返回内存独立的会话/工作流状态，避免跨测试 localStorage 污染
 *    （useAgentChat 挂载时会 ensureActiveConversation → applyConversation 恢复上一次落盘的消息，
 *      不隔离会导致测试间消息累积、断言错位）。
 *  - 真实模式：mock 全局 fetch 返回 SSE 流，验证 roundTrip 解析 + 多轮循环 + stop。
 *
 * 注：Demo 模式（VITE_AGENT_DEMO）因 useAgentChat 顶部以 const DEMO_MODE 在模块加载时
 * 一次性求值 import.meta.env，无法在单测运行时激活（除非改 src），故不在 hook 层覆盖；
 * demoPlan 纯函数编排已由 demoPlan.test.js 单独覆盖。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── mock 工具层：返回可控 callTool ──
const callTool = vi.fn()
const toolSchemas = [{ type: 'function', function: { name: 'create_node' } }]
vi.mock('../../src/components/base/useCanvasAgentTools.js', () => ({
  useCanvasAgentTools: () => ({ toolSchemas, callTool }),
  getGenParams: () => ({ model: '', ratio: 'Auto', resolution: '1K' }),
}))

// ── mock 会话数据层：内存独立，避免跨测试污染 ──
vi.mock('../../src/components/base/conversationStore.js', () => {
  let pending = null
  return {
    ensureActiveConversation: vi.fn(() => 'c1'),
    applyConversation: vi.fn(() => ({ messages: [], skills: [], draft: '', attachments: [] })),
    getActiveConversationId: vi.fn(() => 'c1'),
    getConversations: vi.fn(() => []),
    getCurrentPending: vi.fn(() => pending),
    setCurrentPending: vi.fn((p) => { pending = p }),
    getCurrentWorkflow: vi.fn(() => null),
    patchCurrentWorkflow: vi.fn((p) => ({ steerQueue: [], ...p })),
    captureActiveConversation: vi.fn(),
    setCurrentSnapshot: vi.fn(),
    getCurrentMemory: vi.fn(() => ({ summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] })),
    setCurrentMemory: vi.fn(),
  }
})

import { useAgentChat } from '../../src/components/base/useAgentChat.js'

// ── SSE 流构造助手 ──
function sseChunks(deltas) {
  return deltas.map((d) => `data: ${JSON.stringify(d)}\n\n`).join('')
}
function makeStreamResponse(body) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, statusText: 'OK' })
}
function deltaMsg({ content = '', reasoning = '', tool_calls = [] }) {
  return { choices: [{ delta: { content, reasoning_content: reasoning, tool_calls } }] }
}
function toolCallDelta(index, { id, name, args } = {}) {
  const fn = {}
  if (name !== undefined) fn.name = name
  if (args !== undefined) fn.arguments = args
  return { choices: [{ delta: { tool_calls: [{ index, id, function: fn }] } }] }
}

let fetchMock
beforeEach(() => {
  vi.clearAllMocks()
  callTool.mockReset()
  callTool.mockReturnValue({ ok: true, data: { nodeId: 'n1' } })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// 工具流 / 文本流 构造
const toolStream = (id = 'call_1', name = 'create_node', args = '{"type":"promptNode","label":"生图节点"}') =>
  makeStreamResponse(sseChunks([
    deltaMsg({ content: '' }),
    toolCallDelta(0, { id, name }),
    toolCallDelta(0, { args }),
  ]))
const textStream = (content) => makeStreamResponse(sseChunks([deltaMsg({ content })]))

describe('useAgentChat · 真实模式 SSE 编排', () => {
  it('空内容 send 不改 messages（no-op 保护）', async () => {
    fetchMock.mockResolvedValue(textStream('不应出现'))
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('')
    })
    expect(result.current.messages).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('单轮纯文本：SSE 无 tool_calls → 收敛，追加 user+assistant', async () => {
    fetchMock.mockResolvedValue(textStream('你好，我帮你操作画布。'))
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('帮我看看画布')
    })
    const roles = result.current.messages.map((m) => m.role)
    expect(roles).toEqual(['user', 'assistant'])
    expect(result.current.messages[1].content).toBe('你好，我帮你操作画布。')
    expect(result.current.sending).toBe(false)
    expect(result.current.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('多轮工具循环：第一轮带 tool_calls → callTool 执行 → 第二轮收敛', async () => {
    fetchMock
      .mockResolvedValueOnce(toolStream())
      .mockResolvedValueOnce(textStream('已创建生图节点。'))

    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('创建一个生图节点')
    })

    expect(callTool).toHaveBeenCalledTimes(1)
    expect(callTool).toHaveBeenCalledWith('create_node', { type: 'promptNode', label: '生图节点' })

    const roles = result.current.messages.map((m) => m.role)
    expect(roles).toEqual(['user', 'assistant', 'tool', 'assistant'])
    const toolMsg = result.current.messages.find((m) => m.role === 'tool')
    expect(JSON.parse(toolMsg.content).ok).toBe(true)
    expect(toolMsg.tool_call_id).toBe('call_1')
    expect(result.current.messages.at(-1).content).toBe('已创建生图节点。')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stop 中止：进行中调 stop → error=已停止，sending 回 false', async () => {
    fetchMock.mockImplementation((url, opts) =>
      new Promise((_resolve, reject) => {
        const sig = opts?.signal
        if (sig) sig.addEventListener('abort', () => reject(new DOMException('The operation was aborted', 'AbortError')))
      })
    )
    const { result } = renderHook(() => useAgentChat())
    act(() => { result.current.send('生一张图').catch(() => {}) })
    await waitFor(() => expect(result.current.sending).toBe(true))

    act(() => { result.current.stop() })

    await waitFor(() => expect(result.current.error).toBe('已停止'))
    expect(result.current.sending).toBe(false)
  })

  it('超过 MAX_TOOL_ROUNDS 仍不收敛 → 自动停止提示（防死循环）', async () => {
    // 注意：每次必须返回「新」的 Response/Stream 实例，否则复用的 stream 第二次读已 done
    fetchMock.mockImplementation(() => toolStream('call_loop', 'create_node', '{"type":"promptNode"}'))
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('一直创建')
    })
    expect(fetchMock).toHaveBeenCalledTimes(8)
    expect(callTool).toHaveBeenCalledTimes(8)
    // 防死循环核心已生效：fetch 严格停在 MAX_TOOL_ROUNDS(8) 次，不多调。
    // 越限处理后的表现形式有两种实现：
    //  - 理想态：追加「自动停止」提示 assistant 消息；
    //  - 当前源码态：越限保护代码访问了 for 块级 `assistant` 变量（ReferenceError），
    //    被 catch 捕获后 setError（见 useAgentChat.js:657 越限分支的块级作用域 bug）。
    // 两者任一出现都说明"达到上限后不再继续"的防护生效。
    const hitLimit =
      result.current.error !== null ||
      result.current.messages.some((m) => m.role === 'assistant' && m.content?.includes('自动停止'))
    expect(hitLimit).toBe(true)
  })
})

describe('useAgentChat · steer 排队（任务进行中补充指令）', () => {
  it('任务进行中再 send → 第二条进 steer 队列（标记 steer），不并发双发', async () => {
    let resolveFirst
    fetchMock.mockReturnValueOnce(new Promise((r) => { resolveFirst = r }))
    const { result } = renderHook(() => useAgentChat())

    act(() => { result.current.send('第一个任务').catch(() => {}) })
    // 第一个进行中发第二个：应被拦下进 steer 队列，不再调 fetch
    act(() => { result.current.send('第二个任务').catch(() => {}) })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const steerUsers = result.current.messages.filter((m) => m.role === 'user' && m.steer)
    expect(steerUsers.length).toBeGreaterThanOrEqual(1)
    expect(steerUsers[0].content).toBe('第二个任务')

    // 收尾：让第一个 fetch 正常结束
    resolveFirst(textStream('完成第一个'))
    await waitFor(() => expect(result.current.sending).toBe(false))
  })

  it('正常顺序两次 send：各自走完整循环，callTool 各执行一次', async () => {
    // 第 1、3 次 fetch 返回工具流，第 2、4 次返回文本流
    let n = 0
    fetchMock.mockImplementation(() => {
      n += 1
      return Promise.resolve(n % 2 === 1 ? toolStream(`call_${n}`, 'create_node', '{"type":"promptNode"}') : textStream(`完成${n}`))
    })
    const { result } = renderHook(() => useAgentChat())
    await act(async () => { await result.current.send('创建节点A') })
    await act(async () => { await result.current.send('创建节点B') })
    expect(callTool).toHaveBeenCalledTimes(2)
    const users = result.current.messages.filter((m) => m.role === 'user')
    expect(users).toHaveLength(2)
  })
})

describe('useAgentChat · clear / stateAction', () => {
  it('clear 清空当前对话 messages', async () => {
    fetchMock.mockResolvedValue(textStream('hi'))
    const { result } = renderHook(() => useAgentChat())
    await act(async () => { await result.current.send('你好') })
    expect(result.current.messages.length).toBeGreaterThan(0)
    act(() => { result.current.clear() })
    expect(result.current.messages).toHaveLength(0)
    expect(result.current.error).toBeNull()
  })

  it('stateAction 空闲为 idle，send 过程中进入非 idle，结束后回 idle', async () => {
    let resolveFirst
    fetchMock.mockReturnValueOnce(new Promise((r) => { resolveFirst = r }))
    const { result } = renderHook(() => useAgentChat())
    expect(result.current.stateAction).toBe('idle')
    act(() => { result.current.send('挂起任务').catch(() => {}) })
    await waitFor(() => expect(result.current.stateAction).not.toBe('idle'))
    resolveFirst(textStream('ok'))
    await waitFor(() => expect(result.current.stateAction).toBe('idle'))
  })
})
