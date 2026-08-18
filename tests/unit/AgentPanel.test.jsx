// @vitest-environment jsdom
/**
 * AgentPanel 深度测试 —— 面板装配层。
 *
 * 策略：最小化 mock 列表，避免 worker OOM。只 mock 必须隔离的外部 store，其他
 * 子组件对齐真实实现（AgentMessage 已单独测试，此处只测面板特有行为）。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── 必须 mock 的外部 store：useAgentChat 是整个面板的逻辑核心，必须隔离 ──
const h = vi.hoisted(() => {
  const send = vi.fn(async () => ({ ok: true }))
  const sendImageMode = vi.fn(async () => ({ ok: true }))
  const stop = vi.fn()
  const clear = vi.fn()
  const setModel = vi.fn()
  const newChat = vi.fn()
  const switchChat = vi.fn()
  const deleteChat = vi.fn()
  const useAgentChat = vi.fn(() => ({
    messages: [], sending: false, error: '', model: 'gpt-4o',
    setModel, send, sendImageMode, stop, clear, stateAction: '',
    conversations: [], activeConversationId: 'c1',
    newChat, switchChat, deleteChat,
    updateMessageByContent: vi.fn(),
    executePlanDirect: vi.fn(async () => ({ ok: true })),
  }))
  return { useAgentChat, send, sendImageMode, stop, clear, newChat, switchChat, deleteChat }
})

vi.mock('../../src/components/base/useAgentChat.js', () => ({
  useAgentChat: (...a) => h.useAgentChat(...a),
}))
// 剩余外部依赖用空桩
vi.mock('../../src/components/base/settings/providerStore.js', () => ({ useProviders: () => [], load: vi.fn(async () => {}) }))
vi.mock('../../src/components/base/settings/agentModelStore.js', () => ({ loadAgentChatModel: () => ({}) }))
vi.mock('../../src/components/base/providerModels.js', () => ({ buildAllModels: () => [] }))
vi.mock('../../src/components/base/hooks.js', () => ({ useOutsideClick: () => {} }))
vi.mock('../../src/components/base/useCanvasAgentTools.js', () => ({ setGenParams: vi.fn(), getGenParams: () => ({}) }))
vi.mock('../../src/components/base/skillStore.js', () => ({ getAllSkills: () => [], markSkillUsed: vi.fn(), repairMojibakeText: (t) => t }))
vi.mock('../../src/components/base/contentStore.js', () => ({ contentGet: () => null, contentSet: vi.fn() }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: (u) => u }))
vi.mock('../../src/components/base/conversationStore.js', () => ({ setCurrentSnapshot: vi.fn(), setAwaitingConfirm: vi.fn(), getCurrentRunMode: () => 'auto', setCurrentRunMode: vi.fn() }))
vi.mock('../../src/components/base/taskStore.js', () => ({ runNodeGeneration: vi.fn() }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: vi.fn() }))
vi.mock('../../src/components/base/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() } }))
vi.mock('../../src/components/base/config.js', () => ({ AGENT_MODELS: ['gpt-4o-mini'] }))
vi.mock('../../src/components/base/previewUrl.js', () => ({ default: { create: vi.fn(() => 'blob:x'), release: vi.fn() } }))
// AgentMessage 子组件用最小桩
vi.mock('../../src/components/AgentMessage.jsx', () => ({
  default: ({ message }) => React.createElement('div', { 'data-testid': `msg-${message.role}` }, message.content || null),
}))
vi.mock('../../src/components/base/ModelSelect.jsx', () => ({
  default: () => React.createElement('span', null, 'ModelSelect'),
}))

import AgentPanel from '../../src/components/AgentPanel.jsx'

// jsdom(pretendToBeVisual) 的平滑 scrollTo 在部分组合下会触发持续 rAF 循环耗尽内存；
// AgentPanel 的滚动 effect 用到它，测试环境固定为空操作，并禁用 rAF 递归。
if (typeof globalThis.Element !== 'undefined' && globalThis.Element.prototype.scrollTo) {
  globalThis.Element.prototype.scrollTo = function () {}
}
// 彻底禁用 requestAnimationFrame 避免持续递归
if (typeof globalThis.window !== 'undefined') {
  globalThis.window.requestAnimationFrame = () => 0
  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame
}

const OPEN_PROPS = {
  open: true, onClose: vi.fn(), onWidthChange: vi.fn(), onEnabledChange: vi.fn(),
}

beforeEach(() => { vi.clearAllMocks() })

describe('AgentPanel', () => {
  it('open=false → 不渲染', () => {
    render(<AgentPanel open={false} onClose={vi.fn()} onWidthChange={vi.fn()} onEnabledChange={vi.fn()} />)
    expect(document.body.textContent).toBe('')
  })

  it('open=true → 渲染标题与空态', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(screen.getByText('AI 助手')).toBeTruthy()
    expect(screen.getByText('有什么可以帮你？')).toBeTruthy()
  })

  it('输入文本 → 回车发送', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    const ta = screen.getByPlaceholderText(/输入消息/)
    fireEvent.change(ta, { target: { value: '你好' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    expect(h.send).toHaveBeenCalledWith('你好', undefined)
  })

  it('无输入 → 发送按钮禁用', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(screen.getByTitle('发送').disabled).toBe(true)
  })

  it('快捷 chip → 直接发送', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByText('生成赛博朋克猫咪图'))
    expect(h.send).toHaveBeenCalledWith('生成赛博朋克猫咪图', undefined)
  })

  it('sending 态 → 停止按钮', () => {
    h.useAgentChat.mockReturnValue({
      messages: [], sending: true, error: '', model: 'gpt-4o',
      setModel: vi.fn(), send: h.send, sendImageMode: h.sendImageMode,
      stop: h.stop, clear: h.clear, stateAction: '',
      conversations: [], activeConversationId: 'c1',
      newChat: h.newChat, switchChat: h.switchChat, deleteChat: h.deleteChat,
      updateMessageByContent: vi.fn(), executePlanDirect: vi.fn(),
    })
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(screen.getByText('思考中...')).toBeTruthy()
    fireEvent.click(screen.getByTitle('停止'))
    expect(h.stop).toHaveBeenCalled()
  })
})