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
vi.mock('../../src/components/agent/canvas/useCanvasAgentTools.js', () => ({
  useCanvasAgentTools: () => ({ toolSchemas, callTool }),
  getGenParams: () => ({ model: '', ratio: 'Auto', resolution: '1K' }),
  setCurrentReferenceImages: vi.fn(),
  getCurrentReferenceImages: () => [],
}))

// mock logger：AI 助手链路新增日志会 POST /api/logs，会污染全局 fetchMock 计数，
// 故测试环境把 logger 变成空操作（保持对 fetch/callTool 的精确断言）。
vi.mock('../../src/components/base/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

// ── mock 会话数据层：内存独立，避免跨测试污染 ──
// 【阶段1A 消息单源】useAgentChat 渲染走 useStoreSelector(subscribe, getState)（conversationState），
//   消息写入走 setCurrentSnapshot/patchCurrentMessages（conversationStore）。为让「写入→订阅连通」，
//   conversationState 与 conversationStore 的 mock 必须共享同一份内存 store（会话消息单源不变量）。
const sharedConvStore = vi.hoisted(() => {
  const state = {
    activeId: 'c1',
    sending: false,
    conversations: [
      { id: 'c1', title: '对话1', messages: [], skills: [], draft: '', attachments: [] },
      { id: 'c2', title: '对话2', messages: [], skills: [], draft: '', attachments: [] },
    ],
  }
  const listeners = new Set()
  const getActiveConv = () => state.conversations.find((c) => c.id === state.activeId) || null
  const notify = () => listeners.forEach((l) => l())
  // 更新当前对话 messages（唯一写口；模拟 setCurrentSnapshot/patchCurrentMessages 的落 store 语义）
  const setActiveMessages = (messages) => {
    const conv = getActiveConv()
    if (!conv) return
    conv.messages = Array.isArray(messages) ? messages.slice(-60) : conv.messages
    notify()
  }
  // 阶段1D：sending 运行态（模拟 store.setSending，订阅可读）
  const setSendingState = (v) => {
    state.sending = !!v
    notify()
  }
  // 阶段1D：activeId 切换（newChat/switchChat/deleteChat 改 store.activeId，订阅可读）
  const setActiveId = (id) => {
    state.activeId = id
    notify()
  }
  return {
    state, listeners, getActiveConv, notify, setActiveMessages, setSendingState, setActiveId,
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) },
    getState() { return state },
    reset() { state.activeId = 'c1'; state.sending = false; state.conversations.forEach((c) => { c.messages = [] }) },
  }
})

vi.mock('../../src/components/agent/conversation/conversationState.ts', () => ({
  subscribe: sharedConvStore.subscribe,
  getState: sharedConvStore.getState,
}))

vi.mock('../../src/components/agent/conversation/conversationStore.ts', () => {
  let pending = null
  let activeId = 'c1'
  const conversations = [{ id: 'c1', title: '对话1' }, { id: 'c2', title: '对话2' }]
  return {
    ensureActiveConversation: vi.fn(() => activeId),
    setAgentKey: vi.fn(),
    waitHydrated: vi.fn(async () => {}),
    applyConversation: vi.fn((id) => ({ id, messages: [], skills: [], draft: '', attachments: [] })),
    getActiveConversationId: vi.fn(() => activeId),
    getConversations: vi.fn(() => conversations),
    getCurrentPending: vi.fn(() => pending),
    setCurrentPending: vi.fn((p) => { pending = p }),
    // P1a 引用契约：构造器透传（send 用它生成 pending 引用；恢复交给真实 resolvePendingRecovery，其默认被 getCurrentPending=null 短路）
    makePendingRef: vi.fn((arg) => arg),
    getCurrentWorkflow: vi.fn(() => null),
    patchCurrentWorkflow: vi.fn((p) => ({ steerQueue: [], ...p })),
    captureActiveConversation: vi.fn(),
    // 消息单源：setCurrentSnapshot / patchCurrentMessages / getCurrentSnapshot 落到共享内存 store
    //   （useStoreSelector 读同一份 state → 写入立即可见，模拟生产环境 commit 同步链）。
    setCurrentSnapshot: vi.fn((snap) => { if (snap && snap.messages !== undefined) sharedConvStore.setActiveMessages(snap.messages) }),
    patchCurrentMessages: vi.fn((messages) => sharedConvStore.setActiveMessages(messages)),
    getCurrentSnapshot: vi.fn(() => {
      const c = sharedConvStore.getActiveConv()
      return { messages: c ? [...c.messages] : [], skills: [], draft: '', attachments: [] }
    }),
    // 阶段1D：sending 落到共享 store（订阅可读）
    setSending: vi.fn((v) => sharedConvStore.setSendingState(v)),
    setAwaitingConfirm: vi.fn(),
    getAwaitingConfirm: vi.fn(() => false),
    getActivePendingGenerations: vi.fn(() => null),
    setActivePendingGenerations: vi.fn(),
    getCreditGate: vi.fn(() => null),
    setCreditGate: vi.fn(),
    clearCreditGate: vi.fn(),
    getCurrentMemory: vi.fn(() => ({ summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] })),
    setCurrentMemory: vi.fn(),
    getCurrentImageMap: vi.fn(() => []),
    getCurrentRunMode: vi.fn(() => 'auto'),
    setCurrentRunMode: vi.fn(),
    getWorkMode: vi.fn(() => 'auto'),
    getActivePendingMemorySuggest: vi.fn(() => null),
    setActivePendingMemorySuggest: vi.fn(),
    newConversation: vi.fn(() => {
      const id = `c_new_${Date.now()}`
      activeId = id
      sharedConvStore.setActiveId(id)
      return { id, snapshot: { id, messages: [], skills: [], draft: '', attachments: [] } }
    }),
    switchConversation: vi.fn((id) => {
      activeId = id
      sharedConvStore.setActiveId(id)
      return { id, messages: [], skills: [], draft: '', attachments: [] }
    }),
    deleteConversation: vi.fn(() => {
      activeId = 'c1'
      sharedConvStore.setActiveId('c1')
      return { activeId: 'c1', snapshot: { id: 'c1', messages: [], skills: [], draft: '', attachments: [] } }
    }),
  }
})

import { useAgentChat, buildRequestMessages, parseSSEChunk, parseGenerationsFromReply } from '../../src/components/agent/runtime/useAgentChat.ts'
import { resolveSkillExecutionRules } from '../../src/components/agent/runtime/agentCore.ts'
import * as convStore from '../../src/components/agent/conversation/conversationStore.ts'

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
  sharedConvStore.reset() // 消息单源隔离：清空共享 store 的 messages，防跨测试累积
  callTool.mockReset()
  callTool.mockReturnValue({ ok: true, data: { nodeId: 'n1' } })
  // 重置三阶段门禁 mock 状态：默认非待确认（防上一个测试的 mockReturnValue 污染后续）
  vi.mocked(convStore.setAwaitingConfirm).mockImplementation((v) => {
    vi.mocked(convStore.getAwaitingConfirm).mockReturnValue(v === true)
  })
  vi.mocked(convStore.getAwaitingConfirm).mockReturnValue(false)
  // 默认 auto（LLM 编排），直接生图用例临时切 direct（docs/65 M7/M9）
  vi.mocked(convStore.getWorkMode).mockReturnValue('auto')
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
    await act(async () => {}) // 会话水化/初始恢复为异步：flush 微任务等 restore 完成，避免其复位消息
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
    await act(async () => {}) // 会话水化/初始恢复为异步：flush 微任务等 restore 完成，避免其复位消息
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

  it('复合忙判定：任务进行中（发送锁 + 状态机 running）再次 send 走 steer，不触发第二次请求', async () => {
    // 第一轮 fetch 挂起（pending），保证发送锁保持 true、状态机 running
    fetchMock.mockImplementation((url, opts) => new Promise(() => {}))
    const { result } = renderHook(() => useAgentChat())
    // 发起第一轮
    act(() => { result.current.send('第一轮任务').catch(() => {}) })
    await waitFor(() => expect(result.current.sending).toBe(true))
    const fetchCallsBefore = fetchMock.mock.calls.length

    // 任务进行中再发 → 应走 steer（不触发第二次 fetch），user 消息带 steer 标记
    act(() => { result.current.send('插一句补充').catch(() => {}) })
    await waitFor(() => {
      expect(result.current.messages.some((m) => m.steer === true && m.content === '插一句补充')).toBe(true)
    })
    // 关键：没有第二次真实请求（steer 只是排队，不打断）
    expect(fetchMock.mock.calls.length).toBe(fetchCallsBefore)
  })

  it('三阶段门禁：show_plan_for_confirm 后暂停循环，不再继续第二轮（等用户确认，防自言自语）', async () => {
    // 模拟 show_plan_for_confirm 工具：调用后进入"待确认"（setAwaitingConfirm(true) 且 getAwaitingConfirm 返回 true）
    callTool.mockImplementation((name) => {
      if (name === 'show_plan_for_confirm') {
        vi.mocked(convStore.setAwaitingConfirm).mockImplementation((v) => { vi.mocked(convStore.getAwaitingConfirm).mockReturnValue(v === true) })
        convStore.setAwaitingConfirm(true)
        return { ok: true, data: { presented: true, plan_text: '一套策划', generations_count: 2, awaiting_confirm: true } }
      }
      return { ok: true, data: { nodeId: 'n1' } }
    })
    // 第一轮：show_plan_for_confirm；如果门禁失效，会有第二轮 fetch（执行 execute_plan 或输出）
    fetchMock
      .mockResolvedValueOnce(toolStream('call_1', 'show_plan_for_confirm', '{"plan_text":"一套策划","generations":[]}'))
      .mockResolvedValueOnce(textStream('不该出现的第二轮'))

    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('帮我策划一套图')
    })

    // 关键：show_plan_for_confirm 后立即暂停 → 只有 1 次 LLM 请求，没有第二轮
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // workflow 进入 awaiting_confirm
    expect(vi.mocked(convStore.patchCurrentWorkflow)).toHaveBeenCalledWith(expect.objectContaining({ status: 'awaiting_confirm' }))
    // sending 释放（等待用户确认，不锁死）
    expect(result.current.sending).toBe(false)
  })

  it('【积分闸语义】残留 creditGate.pending 不打断非 execute_plan 工具循环（积分闸只拦"点生成那下"）', async () => {
    // 历史 bug 场景：之前生图挂起（creditGate.pending）未确认也未取消 → 残留在会话态。
    // 新指令（建节点）的工具循环绝不能被它打断（积分闸不影响建节点/读节点/用工具）。
    vi.mocked(convStore.getCreditGate).mockReturnValue({ pending: true, gens: [{}], map: { g1: 'n1' } })
    fetchMock
      .mockResolvedValueOnce(toolStream('call_1', 'create_node', '{"type":"promptNode","label":"生图节点"}'))
      .mockResolvedValueOnce(textStream('已创建。'))
    const { result } = renderHook(() => useAgentChat())
    await act(async () => { await result.current.send('创建一个生图节点') })
    // 关键：残留 creditGate.pending 不打断 → create_node 执行 + 第二轮 LLM 收敛
    expect(callTool).toHaveBeenCalledWith('create_node', { type: 'promptNode', label: '生图节点' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.messages.at(-1).content).toBe('已创建。')
    expect(vi.mocked(convStore.patchCurrentWorkflow)).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'awaiting_confirm' }))
    vi.mocked(convStore.getCreditGate).mockReturnValue(null)
  })

  it('【积分闸语义】本轮 execute_plan 返回 awaited:credit → 工具循环暂停等点生成（唯一停点）', async () => {
    callTool.mockReturnValue({ ok: true, data: { awaited: 'credit', steps: [{ id: 'g1', status: 'ready', nodeId: 'n1' }], note: '节点已建好，生成待积分确认' } })
    fetchMock
      .mockResolvedValueOnce(toolStream('call_1', 'execute_plan', '{}'))
      .mockResolvedValueOnce(textStream('不该出现的第二轮'))
    const { result } = renderHook(() => useAgentChat())
    await act(async () => { await result.current.send('生成一张图') })
    // 关键：execute_plan 命中 credit → 只有 1 次 LLM 请求（暂停等点生成）
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.mocked(convStore.patchCurrentWorkflow)).toHaveBeenCalledWith(expect.objectContaining({ status: 'awaiting_confirm' }))
    expect(result.current.sending).toBe(false)
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
    // 防死循环核心断言：工具循环严格停在 MAX_TOOL_ROUNDS(8) 轮（callTool 恰 8 次 = LLM 恰 8 轮）。
    // fetch 次数不做硬钉：send 收尾会触发既有「摘要压缩」→ compressToSummary → chatProxy 额外 1 次
    // 请求（走 httpRequest 带 proxy payload，与 roundTrip 的 SSE 请求结构不同），不计入工具循环轮数。
    expect(callTool).toHaveBeenCalledTimes(8)
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(8)
    expect(callTool.mock.results.filter((r) => r.type === 'throw')).toHaveLength(0)
    // 越限后追加「自动停止」提示，且不应因越限保护自身报错（bug 修复：assistant 提升到循环外）。
    const stopMsg = result.current.messages.at(-1)
    expect(stopMsg.role).toBe('assistant')
    expect(stopMsg.content).toContain('自动停止')
    expect(result.current.error).toBeNull()
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
    await act(async () => {}) // 会话水化/初始恢复为异步：flush 微任务等 restore 完成，避免其复位消息
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

describe('useAgentChat · 直接生图（三态=direct，send 内部第一行分流到直连，docs/65 M7）', () => {
  // direct 分支 = 原 sendImageMode 正文，经 send 单入口在 workMode=direct 时 bypass LLM 触发
  it('空提示词不发送（no-op）', async () => {
    vi.mocked(convStore.getWorkMode).mockReturnValue('direct')
    const { result } = renderHook(() => useAgentChat())
    await act(async () => { await result.current.send('', []) })
    expect(callTool).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('成功：callTool(execute_plan) 返回 ok → 追加 image 模式 assistant 消息', async () => {
    vi.mocked(convStore.getWorkMode).mockReturnValue('direct')
    callTool.mockReturnValue({ ok: true, data: { entries: [{ status: 'completed' }, { status: 'completed' }] } })
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('一只赛博猫', [{ type: 'image', url: 'http://x/r.png' }])
    })
    expect(callTool).toHaveBeenCalledWith('execute_plan', expect.objectContaining({
      auto_run: true,
      referenceImages: ['http://x/r.png'],
    }))
    const imgMsg = result.current.messages.find((m) => m.role === 'assistant' && m.mode === 'image')
    expect(imgMsg).toBeTruthy()
    expect(imgMsg.content).toContain('已在画布生图')
    expect(imgMsg.content).toContain('2 张')
    expect(result.current.error).toBeNull()
  })

  it('【积分闸·直接生图】callTool 返回 awaited:credit → 追加「节点已建好、待积分确认」，不声称「已在画布生图」', async () => {
    vi.mocked(convStore.getWorkMode).mockReturnValue('direct')
    // 2026-08-27 简化：直接生图在积分开关开时也被拦截，execute_plan 返回 awaited:'credit'（节点建好未真生成）。
    // direct 分支（直连点）必须兼容该语义：不写「已在画布生图」、不二次 execute_plan（红线 §6.4）。
    callTool.mockReturnValue({ ok: true, data: { awaited: 'credit', steps: [{ id: 'g1', status: 'ready', nodeId: 'n1' }], note: '节点已建好，生成待积分确认' } })
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {}) // 会话水化/初始恢复为异步：flush 微任务等 restore 完成，避免其复位消息
    await act(async () => {
      await result.current.send('一只猫', [])
    })
    const imgMsg = result.current.messages.find((m) => m.role === 'assistant' && m.mode === 'image')
    expect(imgMsg).toBeTruthy()
    expect(imgMsg.content).toContain('待积分确认')
    expect(imgMsg.content).not.toContain('已在画布生图') // 不声称已生成
    expect(callTool).toHaveBeenCalledTimes(1) // 绝不再触发生成
    expect(result.current.error).toBeNull()
  })

  it('【图生图·单图修复】直连模式带一张参考图 → 生成的 generation 声明 use_attachments:true（否则 execute_plan 作废参考图，图生图失效）', async () => {
    vi.mocked(convStore.getWorkMode).mockReturnValue('direct')
    // 单参考图 → perRef 拆分不触发（referenceImages.length>=2 才拆），走单 generation。
    // 该 generation 必须带 use_attachments:true，让 execute_plan 把它整批共享挂到节点 data.images（对齐多图 buildPerReferenceGenerations）。
    callTool.mockReturnValue({ ok: true, data: { entries: [{ status: 'completed', nodeId: 'n1' }] } })
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('把它改成红色的猫', [{ type: 'image', url: 'http://x/ref.png' }])
    })
    expect(callTool).toHaveBeenCalledTimes(1)
    const arg = callTool.mock.calls[0][1]
    expect(arg.generations).toHaveLength(1) // 单图不拆分
    expect(arg.generations[0].use_attachments).toBe(true) // 关键：声明挂参考图
    expect(arg.referenceImages).toEqual(['http://x/ref.png'])
  })

  it('【图生图】直连模式无参考图 → generation 不带 use_attachments（纯文生图，不误挂）', async () => {
    vi.mocked(convStore.getWorkMode).mockReturnValue('direct')
    callTool.mockReturnValue({ ok: true, data: { entries: [{ status: 'completed', nodeId: 'n1' }] } })
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('一只纯文字生成的猫', [])
    })
    const arg = callTool.mock.calls[0][1]
    expect(arg.generations[0].use_attachments).toBeUndefined()
  })

  it('失败：callTool(execute_plan) 返回 error → 设置 error', async () => {
    vi.mocked(convStore.getWorkMode).mockReturnValue('direct')
    callTool.mockReturnValueOnce({ ok: false, error: '生图服务异常' })
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {}) // 会话水化/初始恢复为异步：flush 微任务等 restore 完成，避免其复位消息
    await act(async () => {
      await result.current.send('一只猫', [])
    })
    expect(result.current.error).toBe('生图服务异常')
    const imgMsg = result.current.messages.find((m) => m.role === 'assistant' && m.mode === 'image')
    expect(imgMsg.content).toContain('生图失败')
  })
})

describe('useAgentChat · 多对话隔离（newChat/switchChat/deleteChat）', () => {
  it('newChat：创建新对话，activeConversationId 变化，messages 清空', async () => {
    const { result } = renderHook(() => useAgentChat())
    // 先在 c1 留一条消息
    fetchMock.mockResolvedValue(textStream('hi'))
    await act(async () => { await result.current.send('你好') })
    expect(result.current.activeConversationId).toBe('c1')
    act(() => { result.current.newChat() })
    expect(result.current.activeConversationId).not.toBe('c1')
    expect(result.current.messages).toHaveLength(0)
  })

  it('switchChat：切换到已存在对话，同步其快照', async () => {
    const { result } = renderHook(() => useAgentChat())
    act(() => { result.current.switchChat('c2') })
    expect(result.current.activeConversationId).toBe('c2')
    expect(result.current.messages).toHaveLength(0)
  })

  it('deleteChat：删除当前对话后自动切回 activeId', async () => {
    const { result } = renderHook(() => useAgentChat())
    // 当前是 c1，删除 c1 → 内部 deleteConversation mock 把 activeId 置回 c1
    act(() => { result.current.deleteChat('c1') })
    expect(result.current.activeConversationId).toBe('c1')
    expect(result.current.messages).toHaveLength(0)
  })
})

describe('useAgentChat · roundTrip 双路径（默认 / proxy）', () => {
  it('默认路径：fetch 指向 /api/agent/{agentKey}/chat', async () => {
    fetchMock.mockResolvedValue(textStream('默认路径回复'))
    const { result } = renderHook(() => useAgentChat({ agentKey: 'canvas-assistant' }))
    await act(async () => { await result.current.send('hi') })
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('/api/agent/canvas-assistant/chat')
  })

  it('proxy 路径：传入 provider → fetch 指向 /api/proxy 且带 providerId', async () => {
    fetchMock.mockResolvedValue(textStream('proxy 路径回复'))
    const provider = { id: 'p1', protocol: 'openai', base_url: 'https://api.example.com', refFormat: 'url' }
    const { result } = renderHook(() => useAgentChat({ agentKey: 'canvas-assistant', provider }))
    await act(async () => { await result.current.send('hi') })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:18080/api/proxy')
    const body = JSON.parse(opts.body)
    expect(body.providerId).toBe('p1')
    // protocol=openai 时走约定 scheme（见 useAgentChat.js roundTrip：protocol==='openai' → 'openai://chat/completions'）
    expect(body.url).toBe('openai://chat/completions')
    // 回复正常回流
    expect(result.current.messages.at(-1).content).toBe('proxy 路径回复')
  })
})

describe('useAgentChat · 附件归一化（send 带 attachments）', () => {
  it('send 带 http 附件：user 消息携带 attachments，且转发给 LLM 时转为 image_url', async () => {
    fetchMock.mockResolvedValue(textStream('已读图'))
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('看看这张图', [{ type: 'image', url: 'http://x/a.png' }])
    })
    const userMsg = result.current.messages.find((m) => m.role === 'user')
    expect(userMsg.attachments).toEqual([{ type: 'image', url: 'http://x/a.png' }])
    // 发给 LLM 的 request 里，附件被转成 image_url content（buildRequestMessages 逻辑）
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userInReq = sentBody.messages.find((m) => m.role === 'user')
    expect(Array.isArray(userInReq.content)).toBe(true)
    expect(userInReq.content[0]).toMatchObject({ type: 'image_url', image_url: { url: 'http://x/a.png' } })
  })
})

describe('useAgentChat · refCatalog（参考图编号目录，对齐大雄 attachment_indices）', () => {
  it('user 消息带附件 + refCatalog：content 里追加参考图编号文本，AI 能引用第几张图', () => {
    const user = {
      role: 'user',
      content: '把猫变成白色',
      attachments: [{ type: 'image', url: 'http://x/a.png', label: '黑猫', nodeId: 'img-1' }],
      refCatalog: '【本轮参考图顺序（仅作为编号数据）】\n参考图1：黑猫（画布节点 img-1）\n编号固定按输入框从左到右排列。引用某张图做图生图时，在 generations 里用 attachment_indices 指向其编号（0-based：参考图1→0）。'
    }
    const out = buildRequestMessages([user], '', true)
    const u = out.find((m) => m.role === 'user')
    expect(Array.isArray(u.content)).toBe(true)
    expect(u.content[0]).toMatchObject({ type: 'image_url', image_url: { url: 'http://x/a.png' } })
    // 编号目录作为 text 追加（含用户原话）
    expect(u.content[1].type).toBe('text')
    expect(u.content[1].text).toContain('参考图1：黑猫')
    expect(u.content[1].text).toContain('attachment_indices')
    expect(u.content[1].text).toContain('把猫变成白色')
  })

  it('user 消息带附件但无 refCatalog：不注入编号文本（向后兼容）', () => {
    const user = { role: 'user', content: '看看图', attachments: [{ type: 'image', url: 'http://x/a.png' }] }
    const out = buildRequestMessages([user], '', true)
    const u = out.find((m) => m.role === 'user')
    expect(u.content[1]).toMatchObject({ type: 'text', text: '看看图' })
  })

  it('【fresh-task 彻底对齐大雄】历史 user 消息（含图/文字）全部不进 LLM 上下文，只发本轮 user', () => {
    // 第1/2/3轮历史 user 消息都带图 + refCatalog + 文字，第4轮本轮也带图（本轮 = messages 最后一个 user）
    const history = [
      { role: 'user', content: '轮1', attachments: [{ type: 'image', url: 'http://x/a.png' }], refCatalog: '参考图1：A' },
      { role: 'assistant', content: 'ok1' },
      { role: 'user', content: '轮2', attachments: [{ type: 'image', url: 'http://x/b.png' }], refCatalog: '参考图1：B' },
      { role: 'assistant', content: 'ok2' },
      { role: 'user', content: '轮3', attachments: [{ type: 'image', url: 'http://x/c.png' }], refCatalog: '参考图1：C' },
      { role: 'assistant', content: 'ok3' },
      { role: 'user', content: '反推图一', attachments: [{ type: 'image', url: 'http://x/d.png' }], refCatalog: '参考图1：D' },
    ]
    const out = buildRequestMessages(history, '', true)
    // 历史轮次被丢弃：只保留本轮 user（含本轮图内联）
    const users = out.filter((m) => m.role === 'user')
    expect(users).toHaveLength(1)
    expect(Array.isArray(users[0].content)).toBe(true)
    expect(users[0].content[0]).toMatchObject({ type: 'image_url', image_url: { url: 'http://x/d.png' } })
    // 整条请求里只有本轮这张图（http://x/d.png），历史 a/b/c 三张真图一律不出现
    const allImageUrls = out.flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .filter((c) => c.type === 'image_url')
      .map((c) => c.image_url.url)
    expect(allImageUrls).toEqual(['http://x/d.png'])
    // 历史 user 文字也不回传（对齐大雄 messages:[]）
    expect(out.some((m) => m.role === 'user' && m.content === '轮1')).toBe(false)
  })

  it('【fresh-task】本轮不带图：只发本轮纯文字，历史 user（含图）一律不进上下文', () => {
    const history = [
      { role: 'user', content: '轮1', attachments: [{ type: 'image', url: 'http://x/a.png' }], refCatalog: '参考图1：A' },
      { role: 'assistant', content: 'ok1' },
      { role: 'user', content: '本轮纯文字不带图' },
    ]
    const out = buildRequestMessages(history, '', true)
    // 无任何 image_url（历史图不进上下文）
    const allImageUrls = out.flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .filter((c) => c.type === 'image_url')
    expect(allImageUrls).toHaveLength(0)
    // 只保留本轮 user 纯文字，历史 user 丢弃
    const users = out.filter((m) => m.role === 'user')
    expect(users).toHaveLength(1)
    expect(users[0].content).toBe('本轮纯文字不带图')
  })
})

// ════════════════════════════════════════════════════════════════════
// 深度测试：buildRequestMessages（发给 LLM 的请求体组装核心）
// 这是前端逻辑核心：决定 LLM 看到的 system 准则 / Skill / memory / 附件转换 / 工具回传。
// 不依赖任何 store / fetch，纯函数，逐一覆盖每个分支与边界。
// ════════════════════════════════════════════════════════════════════
describe('useAgentChat · buildRequestMessages 深度（请求体组装）', () => {
  const base = [
    { role: 'user', content: '帮我建个节点' },
    { role: 'assistant', content: '已建', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'create_node', arguments: '{}' } }] },
    { role: 'tool', content: '{"ok":true}', tool_call_id: 'c1' },
  ]

  it('enhance=true 且无 system：前置注入画布准则 + 三态分流段（默认 auto），历史消息按顺序接在后面', () => {
    const out = buildRequestMessages(base, '', true)
    // 首条是系统准则
    expect(out[0].role).toBe('system')
    expect(out[0].content).toContain('你是猫猫画布助手')
    // 三态分流段（默认 auto）紧随准则作为独立 system（docs/65 M5：引导 show_plan_for_confirm 可调性）
    expect(out[1]).toMatchObject({ role: 'system' })
    expect(out[1].content).toContain('show_plan_for_confirm')
    expect(out[1].content).toContain('完全自主')
    // 原始 3 条消息全部保留，顺序不变
    expect(out).toHaveLength(5)
    expect(out[2].content).toBe('帮我建个节点')
    expect(out.at(-1).content).toBe('{"ok":true}')
  })

  it('enhance=true 且传入 systemPrompt：准则之后拼接 systemPrompt，不覆盖准则', () => {
    const out = buildRequestMessages(base, '你是严格模式', true)
    expect(out[0].content).toContain('你是猫猫画布助手')
    expect(out[1]).toMatchObject({ role: 'system', content: '你是严格模式' })
  })

  it('enhance=false 且无 systemPrompt：完全不注入 system（保持最小请求）', () => {
    const out = buildRequestMessages(base, '', false)
    expect(out.every((m) => m.role !== 'system')).toBe(true)
    expect(out).toHaveLength(3)
  })

  it('enhance=false 但传入 systemPrompt：仅保留该 systemPrompt', () => {
    const out = buildRequestMessages(base, '外部系统指令', false)
    expect(out).toHaveLength(4)
    expect(out[0]).toMatchObject({ role: 'system', content: '外部系统指令' })
  })

  it('【fresh-task】历史 system 不进 LLM：只保留注入的画布准则，历史消息（含 system）丢弃', () => {
    // fresh-task 对齐大雄：历史轮次整体不进上下文，历史 system 也不回传；画布准则始终注入。
    const withSys = [{ role: 'system', content: '旧的历史 system' }, ...base]
    const out = buildRequestMessages(withSys, '', true)
    // 首条是补注入的画布准则（无条件，画布操作能力不丢失）
    expect(out[0].role).toBe('system')
    expect(out[0].content).toContain('猫猫画布助手')
    // 历史 system 不回传（fresh-task 只发本轮 + 注入的 system）
    expect(out.some((m) => m.role === 'system' && m.content === '旧的历史 system')).toBe(false)
    // 本轮 user 及同轮工具消息仍保留（工具配对协议不破坏）
    expect(out.some((m) => m.role === 'user')).toBe(true)
    expect(out.some((m) => m.role === 'tool')).toBe(true)
  })

  it('Skill 无损注入：原文包成 ==== Skill 文档 ==== 且不 rewrite，并追加 SKILL_EXECUTION_RULES', () => {
    const skills = [{ name: '电商主图', content: '原始 Skill 内容 #@! 不可被改写' }]
    const out = buildRequestMessages(base, '', true, skills)
    const skillSys = out.find((m) => m.role === 'system' && m.content.includes('Skill 文档'))
    expect(skillSys).toBeTruthy()
    expect(skillSys.content).toContain('===== Skill 文档开始：电商主图 =====')
    expect(skillSys.content).toContain('原始 Skill 内容 #@! 不可被改写')
    expect(skillSys.content).toContain('===== Skill 文档结束：电商主图 =====')
    expect(skillSys.content).toContain('【Skill 驱动的批量生图（三阶段')
  })

  it('多 Skill：各自独立包文档，拼接在同一 system 内（丢失一个也能定位）', () => {
    const skills = [
      { name: 'A', content: '内容A' },
      { name: 'B', content: '内容B' },
    ]
    const out = buildRequestMessages(base, '', true, skills)
    const skillSys = out.find((m) => m.role === 'system' && m.content.includes('Skill 文档'))
    expect(skillSys.content).toContain('===== Skill 文档开始：A =====')
    expect(skillSys.content).toContain('===== Skill 文档开始：B =====')
    expect(skillSys.content).toContain('内容A')
    expect(skillSys.content).toContain('内容B')
  })

  it('memory.lastPlan 注入：最近策划以独立 system 注入，供多轮延续', () => {
    const memory = { lastPlan: { plan_text: '策划说明', generations: [{ title: '主图', prompt: '一只猫' }] } }
    const out = buildRequestMessages(base, '', true, [], memory)
    const memSys = out.find((m) => m.role === 'system' && m.content.includes('本对话最近策划'))
    expect(memSys).toBeTruthy()
    expect(memSys.content).toContain('策划说明')
    expect(memSys.content).toContain('- 主图: 一只猫')
  })

  it('memory 无 lastPlan：不注入 memory system（避免空 system）', () => {
    const out = buildRequestMessages(base, '', true, [], { lastPlan: null })
    expect(out.find((m) => m.role === 'system' && m.content.includes('本对话最近策划'))).toBeFalsy()
  })

  it('附件转 image_url：user 带 attachments → content 变为数组，image_url 在前、原文 text 在后', () => {
    const msgs = [{ role: 'user', content: '看这张图', attachments: [{ type: 'image', url: 'http://x/r.png' }], isCurrent: true }]
    const out = buildRequestMessages(msgs, '', true)
    const u = out.find((m) => m.role === 'user')
    expect(Array.isArray(u.content)).toBe(true)
    expect(u.content[0]).toMatchObject({ type: 'image_url', image_url: { url: 'http://x/r.png' } })
    expect(u.content[1]).toMatchObject({ type: 'text', text: '看这张图' })
  })

  it('附件为空数组：user 不转数组，保持纯文本 content', () => {
    const msgs = [{ role: 'user', content: '纯文本', attachments: [] }]
    const out = buildRequestMessages(msgs, '', true)
    const u = out.find((m) => m.role === 'user')
    expect(typeof u.content).toBe('string')
    expect(u.content).toBe('纯文本')
  })

  it('tool / assistant 的 tool_calls 与 tool_call_id 透传：LLM 多轮工具协议不丢字段', () => {
    const msgs = [
      { role: 'assistant', content: '', tool_calls: [{ id: 'c9', type: 'function', function: { name: 'create_node', arguments: '{"x":1}' } }] },
      { role: 'tool', content: '{"ok":true}', tool_call_id: 'c9' },
    ]
    const out = buildRequestMessages(msgs, '', false)
    const a = out.find((m) => m.role === 'assistant')
    const t = out.find((m) => m.role === 'tool')
    expect(a.tool_calls).toEqual([{ id: 'c9', type: 'function', function: { name: 'create_node', arguments: '{"x":1}' } }])
    expect(t.tool_call_id).toBe('c9')
  })

  it('空 messages：enhance=true 仍至少注入 system（画布准则 + 三态分流段，LLM 永远有规则）', () => {
    const out = buildRequestMessages([], '', true)
    expect(out).toHaveLength(2)
    expect(out.every((m) => m.role === 'system')).toBe(true)
    expect(out[0].content).toContain('猫猫画布助手')
    expect(out[1].content).toContain('show_plan_for_confirm')
  })
})

// ════════════════════════════════════════════════════════════════════
// 四象限 prompt 断言（docs/65 M5/M9）：三态 × Skill 组合的确认粒度注入
// 规则：Skill 只编排思维路径、不改确认粒度；确认粒度始终由三态决定（R1/R6）。
//   noSkill×auto / noSkill×step-confirm / skill×auto / skill×step-confirm
// ════════════════════════════════════════════════════════════════════
describe('useAgentChat · 三态 × Skill 四象限提示词注入（docs/65 M5）', () => {
  const base = [
    { role: 'user', content: '生成一张猫图' },
    { role: 'assistant', content: 'ok', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'execute_plan', arguments: '{}' } }] },
    { role: 'tool', content: '{"ok":true}', tool_call_id: 'c1' },
  ]
  const skill = (name = '电商主图') => [{ name, content: 'Skill 原文内容' }]

  const systemTexts = (out) => out.filter((m) => m.role === 'system').map((m) => m.content)

  it('resolveSkillExecutionRules：auto → 追加「阶段2 作废·不等待」；step-confirm → 用原始（阶段2 等确认）', () => {
    expect(resolveSkillExecutionRules('auto')).toContain('【确认粒度自适应 · 完全自主】')
    expect(resolveSkillExecutionRules('auto')).toContain('阶段2 · 等待确认】作废')
    expect(resolveSkillExecutionRules('step-confirm')).not.toContain('作废')
    expect(resolveSkillExecutionRules('step-confirm')).toContain('【阶段2 · 等待确认】')
  })

  it('noSkill × auto：注入「完全自主」分流段，引导 plan 可调且不卡确认（R2）', () => {
    const out = buildRequestMessages(base, '', true, [], null, 0, '', '', '', 'auto')
    const joined = systemTexts(out).join('\n')
    expect(joined).toContain('show_plan_for_confirm')
    expect(joined).toContain('完全自主')
    expect(joined).toContain('不阻塞') // 不卡确认
    expect(joined).not.toContain('等待用户确认')
  })

  it('noSkill × step-confirm：注入「分步确认」分流段，引导 plan 等待确认', () => {
    const out = buildRequestMessages(base, '', true, [], null, 0, '', '', '', 'step-confirm')
    const joined = systemTexts(out).join('\n')
    expect(joined).toContain('show_plan_for_confirm')
    expect(joined).toContain('分步确认')
    expect(joined).toContain('等待用户确认')
  })

  it('skill × auto：Skill 阶段2 不等待（追加自适应），确认粒度仍由 auto 决定（R1）', () => {
    const out = buildRequestMessages(base, '', true, skill(), null, 0, '', '', '', 'auto')
    const texts = systemTexts(out)
    const skillSys = texts.find((t) => t.includes('Skill 文档'))
    expect(skillSys).toContain('【确认粒度自适应 · 完全自主】') // 阶段2 作废
    expect(texts.join('\n')).toContain('不阻塞') // 全局 auto 分流段
  })

  it('skill × step-confirm：Skill 阶段2 保持等待确认，确认粒度由 step-confirm 决定', () => {
    const out = buildRequestMessages(base, '', true, skill(), null, 0, '', '', '', 'step-confirm')
    const texts = systemTexts(out)
    const skillSys = texts.find((t) => t.includes('Skill 文档'))
    expect(skillSys).not.toContain('作废')
    expect(skillSys).toContain('【阶段2 · 等待确认】')
    expect(texts.join('\n')).toContain('等待用户确认')
  })
})

// ════════════════════════════════════════════════════════════════════
// 深度测试：parseSSEChunk（SSE 流式增量解析）
// 工具循环依赖它把分片 delta 拼回完整 content/reasoning/tool_calls。
// 覆盖：基础 data: 解析、增量 content 拼接、reasoning 双字段、tool_calls 多段增量拼接、[DONE] 跳过、
//       非 data: 行忽略、坏 JSON 容错、index 分包归并。
// ════════════════════════════════════════════════════════════════════
describe('useAgentChat · parseSSEChunk 深度（SSE 增量解析）', () => {
  it('基础 data: 行 → content 累加', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {"choices":[{"delta":{"content":"你好"}}]}', acc)
    expect(acc.content).toBe('你好')
  })

  it('多段增量 content 流式拼接', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {"choices":[{"delta":{"content":"A"}}]}', acc)
    parseSSEChunk('data: {"choices":[{"delta":{"content":"B"}}]}', acc)
    parseSSEChunk('data: {"choices":[{"delta":{"content":"C"}}]}', acc)
    expect(acc.content).toBe('ABC')
  })

  it('reasoning_content 与 reasoning 双字段都累加', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {"choices":[{"delta":{"reasoning_content":"想"}}]}', acc)
    parseSSEChunk('data: {"choices":[{"delta":{"reasoning":"一下"}}]}', acc)
    expect(acc.reasoning).toBe('想一下')
  })

  it('tool_calls 跨多段按 index 分包拼接（name 与 arguments 分段到达）', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    // 第 1 段：index 0，带 id + 部分 name
    parseSSEChunk('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"create_"}}]}}]}', acc)
    // 第 2 段：index 0，继续拼 name
    parseSSEChunk('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"node"}}]}}]}', acc)
    // 第 3 段：index 0，拼 arguments
    parseSSEChunk('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"type\\":\\"promptNode\\"}"}}]}}]}', acc)
    expect(acc.toolCalls).toHaveLength(1)
    expect(acc.toolCalls[0].id).toBe('call_1')
    expect(acc.toolCalls[0].function.name).toBe('create_node')
    expect(acc.toolCalls[0].function.arguments).toBe('{"type":"promptNode"}')
  })

  it('多个并行 tool_calls（不同 index）分别归并，不串台', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c0","function":{"name":"a"}}]}}]}', acc)
    parseSSEChunk('data: {"choices":[{"delta":{"tool_calls":[{"index":1,"id":"c1","function":{"name":"b"}}]}}]}', acc)
    expect(acc.toolCalls.map((t) => t.function.name)).toEqual(['a', 'b'])
  })

  it('SSE tool_calls 无 name（仅 index）：产生空占位（根因——filter 后为空需判断）', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    // 模型只发 index + id，无 function.name（某些模型/网关流式占位）
    parseSSEChunk('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_x","function":{}}]}}]}', acc)
    expect(acc.toolCalls).toHaveLength(1) // 产生了占位
    expect(acc.toolCalls[0].function.name).toBe('') // name 为空
    // 关键：filter 后应为空数组，roundTrip 据此不应设 tool_calls（避免发 tool_calls:[]）
    expect(acc.toolCalls.filter((t) => t.function?.name)).toHaveLength(0)
  })

  it('[DONE] 标记：直接跳过，不污染 acc', () => {
    const acc = { content: '已有', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: [DONE]', acc)
    expect(acc.content).toBe('已有')
    expect(acc.toolCalls).toHaveLength(0)
  })

  it('非空 data: 行（如注释/keepalive）：忽略，不改 acc', () => {
    const acc = { content: 'x', reasoning: '', toolCalls: [] }
    parseSSEChunk(': keepalive', acc)
    expect(acc.content).toBe('x')
  })

  it('坏 JSON：try/catch 吞掉，不改 acc（单条解析失败不影响整体流）', () => {
    const acc = { content: 'keep', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {这不是合法json', acc)
    expect(acc.content).toBe('keep')
    expect(acc.toolCalls).toHaveLength(0)
  })

  it('data: 行但无 delta（choices 缺省）：安全跳过', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {"choices":[]}', acc)
    parseSSEChunk('data: {"other":"field"}', acc)
    expect(acc.content).toBe('')
    expect(acc.toolCalls).toHaveLength(0)
  })

  it('tool_calls 无 name 仅 arguments（补全场景）：保留已有 name', () => {
    const acc = { content: '', reasoning: '', toolCalls: [] }
    parseSSEChunk('data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c","function":{"arguments":"{\\"x\\":1}"}}]}}]}', acc)
    // 没有 name 段 → name 为空字符串（roundTrip 会用 .filter(t=>t.function?.name) 过滤掉空 name 的）
    expect(acc.toolCalls[0].function.name).toBe('')
    expect(acc.toolCalls[0].function.arguments).toBe('{"x":1}')
  })
})

// ════════════════════════════════════════════════════════════════════
// parseGenerationsFromReply（对齐大雄 parseAgentResponse：从 LLM 回复正文解析 generations）
// 阶段1 的 generations 主通道走回复正文 JSON，前端解析暂存，不走工具参数超大 JSON。
// ════════════════════════════════════════════════════════════════════
describe('useAgentChat · parseGenerationsFromReply（回复正文解析）', () => {
  it('解析 ```json 代码块里的 plan + generations', () => {
    const content = '我先规划一下：\n```json\n{ "plan": { "goal": "做5张主图" }, "generations": [ { "id": "g1", "title": "主图1", "prompt": "猫" } ] }\n```\n请确认。'
    const { plan, generations } = parseGenerationsFromReply(content)
    expect(plan).toEqual({ goal: '做5张主图' })
    expect(generations).toHaveLength(1)
    expect(generations[0].id).toBe('g1')
    expect(generations[0].prompt).toBe('猫')
  })

  it('无代码块时回退提取最大 {...} JSON', () => {
    const content = '规划如下 { "generations": [ { "id": "g2", "title": "详情1", "prompt": "狗" } ] } 请确认'
    const { generations } = parseGenerationsFromReply(content)
    expect(generations).toHaveLength(1)
    expect(generations[0].prompt).toBe('狗')
  })

  it('没有 generations 字段 → 返回空数组，不 throw', () => {
    const { plan, generations } = parseGenerationsFromReply('这是一段普通策划文字，没有 JSON。')
    expect(plan).toBeNull()
    expect(generations).toEqual([])
  })

  it('坏 JSON → 返回空数组，不 throw', () => {
    const { generations } = parseGenerationsFromReply('```json\n{ 这不是合法json\n```')
    expect(generations).toEqual([])
  })

  it('generations 含非对象项时过滤掉', () => {
    const content = '```json\n{ "generations": [ { "id": "g1" }, "bad", null ] }\n```'
    const { generations } = parseGenerationsFromReply(content)
    expect(generations).toHaveLength(1)
    expect(generations[0].id).toBe('g1')
  })

  it('空 content / 空串 → 空结果', () => {
    expect(parseGenerationsFromReply('').generations).toEqual([])
    expect(parseGenerationsFromReply(undefined).generations).toEqual([])
  })
})

// ── AI 助手全链路：发图 → localTool 透传上游 400 → 前端显示真实错误 ──
// 对应今日排查链路：上传图 → buildRequestMessages 转 image_url → 经 localTool 转发 →
// 上游非视觉模型拒图返回 400（SSE）→ localTool 剥壳透传 error JSON → 前端 parseAgentError
// 读到 error.message 并显示（而非只显示状态码 400）。此测试验证全链路的最后一环：前端拿到错误。
describe('useAgentChat · 全链路 400 错误透传（发图被拒）', () => {
  it('LLM 返回 400 + error.message → 前端 error 显示真实原因（不只状态码）', async () => {
    // 模拟 localTool /api/proxy 透传的上游 400 错误（剥壳后的 JSON，含 error.message）
    fetchMock.mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'model does not support image_url' } }),
      { status: 400, statusText: 'Bad Request', headers: { 'content-type': 'application/json' } }
    ))
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('看看这张图', [{ type: 'image', url: 'http://x/a.png' }])
    })
    // 关键断言：前端展示的是上游真实错误信息，而非仅"400"
    expect(result.current.error).toContain('model does not support image_url')
  })
})

// ── 阶段1B 卸载不 abort / 切 key abort（docs/25 §阶段1B）──
// 卸载不断流（配合阶段1C 面板常驻）；切 agentKey 显式中断旧流（防项目串台）。
describe('useAgentChat · 阶段1B 卸载不 abort / 切 key abort', () => {
  it('组件卸载且 send 进行中 → 不触发 abort，流不被中断', async () => {
    let capturedSignal
    let resolveFetch
    fetchMock.mockImplementation((_url, opts) => new Promise((resolve) => {
      capturedSignal = opts.signal
      resolveFetch = resolve
      if (opts.signal) opts.signal.addEventListener('abort', () => {})
    }))
    const { result, unmount } = renderHook(() => useAgentChat({ agentKey: 'k1' }))
    act(() => { result.current.send('挂起任务').catch(() => {}) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(capturedSignal.aborted).toBe(false)
    unmount() // 卸载——不得触发 abort（原 cleanup abort 已移除）
    expect(capturedSignal.aborted).toBe(false)
    // 收尾：让挂起的 fetch 正常结束，避免遗留 pending
    act(() => { resolveFetch(textStream('卸载后仍完成')) })
  })

  it('切 agentKey → 旧流被显式 abort（运行态不串台），新 key 独立', async () => {
    const signals = []
    fetchMock.mockImplementation(() => new Promise(() => { /* 永不 resolve，保持进行中 */ }))
    const { result, rerender } = renderHook(
      ({ agentKey }) => useAgentChat({ agentKey }),
      { initialProps: { agentKey: 'projA' } }
    )
    act(() => { result.current.send('任务A').catch(() => {}) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const sig = fetchMock.mock.calls[0][1].signal
    expect(sig.aborted).toBe(false)
    rerender({ agentKey: 'projB' }) // 切 key → 中断旧流
    expect(sig.aborted).toBe(true)
  })
})

// ── 阶段1A 消息单源不变量 ──
// 若有人重新引入「setMessages / messagesRef 本地消息副本」，下列断言即红（实现一变必红）。
describe('useAgentChat · 消息单源（store 唯一真相）', () => {
  it('渲染跟随 store：外部直接写 store → hook 重渲染读同一份（无本地消息副本）', async () => {
    const { result } = renderHook(() => useAgentChat())
    // 模拟「其他模块直接写 store」——若 hook 自持 messages 副本，此处不会更新渲染
    act(() => {
      sharedConvStore.setActiveMessages([{ role: 'user', content: '来自别的模块写入' }])
    })
    expect(result.current.messages).toEqual([{ role: 'user', content: '来自别的模块写入' }])
    // 渲染的就是 store 数组本身（同一引用），单源不变量核心
    expect(result.current.messages).toBe(sharedConvStore.getActiveConv().messages)
  })

  it('流式结束后占位替换为完整 assistant 且无 streaming 残留，内容与 store 一致', async () => {
    fetchMock.mockResolvedValue(textStream('带一句回复'))
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.send('发消息')
    })
    const storeConv = sharedConvStore.getActiveConv()
    const last = storeConv.messages.at(-1)
    expect(last.role).toBe('assistant')
    expect(last.streaming).toBeFalsy() // 无 streaming 残留占位
    expect(result.current.messages).toEqual(storeConv.messages)
  })
})

// ── 阶段1D 薄壳化：sending / activeConversationId 为 store 字段订阅（非本地 useState）──
describe('useAgentChat · 阶段1D 薄壳化（sending/activeId 订阅 store）', () => {
  it('sending 单源：外部 setSending → hook 订阅重渲染', () => {
    const { result } = renderHook(() => useAgentChat())
    expect(result.current.sending).toBe(false)
    act(() => { sharedConvStore.setSendingState(true) })
    expect(result.current.sending).toBe(true)
    act(() => { sharedConvStore.setSendingState(false) })
    expect(result.current.sending).toBe(false)
  })

  it('activeConversationId 单源：跟随 store.activeId', () => {
    const { result } = renderHook(() => useAgentChat())
    expect(result.current.activeConversationId).toBe('c1')
    act(() => { sharedConvStore.setActiveId('c9') })
    expect(result.current.activeConversationId).toBe('c9')
  })

  it('收口穿透：回传 AgentPanel 所需的 4 个 store 原子 handler（指向聚合层，非新造）', () => {
    const { result } = renderHook(() => useAgentChat())
    // 若将来用 hook 时忘回传、或改成局部新造，此断言即红（保证 AgentPanel 不直连 store 仍可用）
    expect(result.current.setCurrentSnapshot).toBe(convStore.setCurrentSnapshot)
    expect(result.current.setAwaitingConfirm).toBe(convStore.setAwaitingConfirm)
    expect(result.current.getCurrentRunMode).toBe(convStore.getCurrentRunMode)
    expect(result.current.setCurrentRunMode).toBe(convStore.setCurrentRunMode)
  })

  it('发送锁单一真相：send 一开始即同步置位 store.sending（不再依赖独立 sendingRef）', async () => {
    // fetch 挂起（不 resolve），保证发送中；store.sending 应是同步 true 且无需等 UI 渲染
    fetchMock.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useAgentChat())
    expect(sharedConvStore.state.sending).toBe(false)
    act(() => { result.current.send('挂起任务').catch(() => {}) })
    // 同步锁：进入 send 骨架即置位，异步闭包 getState().sending 可读——是"发送锁"的唯一真相
    expect(sharedConvStore.state.sending).toBe(true)
  })
})
