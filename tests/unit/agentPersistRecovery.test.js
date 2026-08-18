// @vitest-environment jsdom
/**
 * AI 助手会话「刷新恢复」回归测试（真实 conversationStore + useAgentChat 集成）。
 *
 * 【背景】用户反馈「一刷新聊天记录就没了」。经复现定位，根因是：
 *   useAgentChat 初始化 effect 用 hook 参数 agentKey 去恢复会话，而 conversationStore 的
 *   currentAgentKey 由 App 的 syncAgentKey effect 异步设置。当 agentKey 在挂载期变化
 *   （如 activeProjectId 首帧 undefined → 真实 id）时二者错位，导致
 *   ensureActiveConversation/applyConversation 在错误的 key 上操作，真实数据（存在
 *   正确 key 的 localStorage）未被加载 → 刷新后看不到记录。
 *
 * 【修复】useAgentChat 初始化 effect 开头先 setAgentKey(agentKey)，强制 store 与 hook 的
 *   key 对齐后再恢复（见 useAgentChat.js 初始化 effect 第 0 步）。
 *
 * 本文件不 mock conversationStore（走真实 localStorage），专测「跨挂载持久化恢复」，
 * 是 useAgentChat.hook.test.js（全 mock store）无法覆盖的盲区。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import * as convStore from '../../src/components/base/conversationStore.js'

const callTool = vi.fn()
vi.mock('../../src/components/base/useCanvasAgentTools.js', () => ({
  useCanvasAgentTools: () => ({ toolSchemas: [], callTool }),
  getGenParams: () => ({ model: '', ratio: 'Auto', resolution: '1K' }),
  setCurrentReferenceImages: vi.fn(),
  getCurrentReferenceImages: () => [],
}))
vi.mock('../../src/components/base/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))

import { useAgentChat } from '../../src/components/base/useAgentChat.js'

describe('AI 助手会话刷新恢复（真实 store）', () => {
  beforeEach(() => {
    localStorage.clear()
    convStore.resetConversationCache()
  })

  it('同 agentKey：send 后落盘，重新挂载（模拟刷新）能恢复消息', async () => {
    // mock 一个完整 SSE 文本流，让 roundTrip 成功收敛并落盘完整 assistant
    const sseBody = `data: ${JSON.stringify({ choices: [{ delta: { content: '你好，我帮你操作画布。' } }] })}\n\n`
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(c) { c.enqueue(encoder.encode(sseBody)); c.close() },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })))

    convStore.setAgentKey('canvas-assistant-projZ')
    const r1 = renderHook(() => useAgentChat({ agentKey: 'canvas-assistant-projZ', provider: null }))
    await act(async () => { await r1.result.current.send('你好') })
    convStore.flushPersist() // P4 落盘节流：send 走防抖落盘，主动刷盘后断言最终态
    const persisted = localStorage.getItem('yimao:agent_conversations_canvas-assistant-projZ')
    expect(persisted).toBeTruthy()
    // 关键：assistant 消息（AI 回复）也应完整落盘，而非只保留 user
    const parsed = JSON.parse(persisted)
    const roles = parsed[0].messages.map((m) => m.role)
    expect(roles).toContain('assistant')

    const r2 = renderHook(() => useAgentChat({ agentKey: 'canvas-assistant-projZ', provider: null }))
    await waitFor(() => {
      expect(r2.result.current.messages.some((m) => m.content === '你好')).toBe(true)
      expect(r2.result.current.messages.some((m) => m.role === 'assistant' && m.content)).toBe(true)
    })
  })

  it('回归：hook 的 agentKey 与 store 的 currentAgentKey 错位时，也能恢复真实 key 的数据', async () => {
    // 第一次会话：在 projX 正常保存消息
    convStore.setAgentKey('canvas-assistant-projX')
    const r1 = renderHook(() => useAgentChat({ agentKey: 'canvas-assistant-projX', provider: null }))
    await act(async () => { await r1.result.current.send('项目X的消息') })
    convStore.flushPersist() // P4 落盘节流：send 走防抖落盘，主动刷盘后断言最终态
    expect(localStorage.getItem('yimao:agent_conversations_canvas-assistant-projX')).toBeTruthy()

    // 模拟刷新且时序错位：store 的 currentAgentKey 仍在 default，而 hook 已用 projX 挂载。
    // 修复前：数据落在/停留在 projX 但没被加载，挂载后 messages 为空（丢记录的复现）；
    // 修复后：useAgentChat 初始化开头 setAgentKey(agentKey) 强制对齐，能恢复 projX 数据。
    convStore.resetConversationCache()
    convStore.setAgentKey('canvas-assistant-default')
    const r2 = renderHook(() => useAgentChat({ agentKey: 'canvas-assistant-projX', provider: null }))
    await waitFor(() => {
      expect(r2.result.current.messages.some((m) => m.content === '项目X的消息')).toBe(true)
    })
  })
})
