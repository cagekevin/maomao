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
  setCurrentReferenceImages: vi.fn(),
  getCurrentReferenceImages: () => [],
}))

// ── mock 会话数据层：内存独立，避免跨测试污染 ──
vi.mock('../../src/components/base/conversationStore.js', () => {
  let pending = null
  let activeId = 'c1'
  const conversations = [{ id: 'c1', title: '对话1' }, { id: 'c2', title: '对话2' }]
  return {
    ensureActiveConversation: vi.fn(() => activeId),
    applyConversation: vi.fn((id) => ({ id, messages: [], skills: [], draft: '', attachments: [] })),
    getActiveConversationId: vi.fn(() => activeId),
    getConversations: vi.fn(() => conversations),
    getCurrentPending: vi.fn(() => pending),
    setCurrentPending: vi.fn((p) => { pending = p }),
    getCurrentWorkflow: vi.fn(() => null),
    patchCurrentWorkflow: vi.fn((p) => ({ steerQueue: [], ...p })),
    captureActiveConversation: vi.fn(),
    setCurrentSnapshot: vi.fn(),
    setAwaitingConfirm: vi.fn(),
    getAwaitingConfirm: vi.fn(() => false),
    getCurrentMemory: vi.fn(() => ({ summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] })),
    setCurrentMemory: vi.fn(),
    newConversation: vi.fn(() => {
      const id = `c_new_${Date.now()}`
      activeId = id
      return { id, snapshot: { id, messages: [], skills: [], draft: '', attachments: [] } }
    }),
    switchConversation: vi.fn((id) => {
      activeId = id
      return { id, messages: [], skills: [], draft: '', attachments: [] }
    }),
    deleteConversation: vi.fn(() => {
      activeId = 'c1'
      return { activeId: 'c1', snapshot: { id: 'c1', messages: [], skills: [], draft: '', attachments: [] } }
    }),
  }
})

import { useAgentChat, buildRequestMessages, parseSSEChunk } from '../../src/components/base/useAgentChat.js'
import * as convStore from '../../src/components/base/conversationStore.js'

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
  // 重置三阶段门禁 mock 状态：默认非待确认（防上一个测试的 mockReturnValue 污染后续）
  vi.mocked(convStore.setAwaitingConfirm).mockImplementation((v) => {
    vi.mocked(convStore.getAwaitingConfirm).mockReturnValue(v === true)
  })
  vi.mocked(convStore.getAwaitingConfirm).mockReturnValue(false)
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
    // 防死循环生效：fetch 严格停在 MAX_TOOL_ROUNDS(8) 次。
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

describe('useAgentChat · sendImageMode（图像模式直连生图）', () => {
  it('空提示词不发送（no-op）', async () => {
    const { result } = renderHook(() => useAgentChat())
    await act(async () => { await result.current.sendImageMode('', []) })
    expect(callTool).not.toHaveBeenCalled()
    expect(result.current.messages).toHaveLength(0)
  })

  it('成功：callTool(execute_plan) 返回 ok → 追加 image 模式 assistant 消息', async () => {
    callTool.mockReturnValue({ ok: true, data: { entries: [{ status: 'completed' }, { status: 'completed' }] } })
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.sendImageMode('一只赛博猫', [{ type: 'image', url: 'http://x/r.png' }])
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

  it('失败：callTool(execute_plan) 返回 error → 设置 error', async () => {
    callTool.mockReturnValueOnce({ ok: false, error: '生图服务异常' })
    const { result } = renderHook(() => useAgentChat())
    await act(async () => {
      await result.current.sendImageMode('一只猫', [])
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

  it('enhance=true 且无 system：前置注入画布准则（CANVAS_AGENT_RULES），历史消息按顺序接在后面', () => {
    const out = buildRequestMessages(base, '', true)
    // 首条是系统准则
    expect(out[0].role).toBe('system')
    expect(out[0].content).toContain('你是猫猫画布助手')
    // 原始 3 条消息全部保留，顺序不变
    expect(out).toHaveLength(4)
    expect(out[1].content).toBe('帮我建个节点')
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

  it('历史消息已含 system（恢复旧对话）：补注入画布准则 + 保留历史 system', () => {
    // 【bug 修复后】buildRequestMessages 不再因 hasSystem 而跳过准则注入，也不丢弃历史 system：
    //  - 准则（CANVAS_AGENT_RULES）无条件注入（enhance=true 时）；
    //  - 历史 system 在遍历中保留。
    //  → 恢复旧对话时 LLM 至少收到 1 条画布准则，画布操作能力不丢失。
    const withSys = [{ role: 'system', content: '旧的历史 system' }, ...base]
    const out = buildRequestMessages(withSys, '', true)
    // 首条应是补注入的画布准则
    expect(out[0].role).toBe('system')
    expect(out[0].content).toContain('猫猫画布助手')
    // 历史 system 也被保留（两条 system：准则 + 旧历史）
    expect(out.filter((m) => m.role === 'system').length).toBeGreaterThanOrEqual(2)
    expect(out.some((m) => m.role === 'system' && m.content === '旧的历史 system')).toBe(true)
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
    const msgs = [{ role: 'user', content: '看这张图', attachments: [{ type: 'image', url: 'http://x/r.png' }] }]
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

  it('空 messages：enhance=true 仍至少注入一条 system 准则（LLM 永远有画布规则）', () => {
    const out = buildRequestMessages([], '', true)
    expect(out).toHaveLength(1)
    expect(out[0].role).toBe('system')
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
