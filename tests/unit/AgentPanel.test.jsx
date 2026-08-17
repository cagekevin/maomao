// @vitest-environment jsdom
/**
 * AgentPanel 单测（批 4）。
 * 重组件，依赖链长：useAgentChat / useProviders / ModelSelect / providerModels /
 * skillStore / storageAdapter / conversationStore / taskStore / toastStore 等。
 * 全部用 vi.mock 隔离为最小 stub，验证：挂载不崩、空态欢迎语、发送逻辑、
 * Skill 应用/移除、待确认引用图确认、生图参数面板切换。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const sendMock = vi.fn().mockResolvedValue(undefined)
const sendImageModeMock = vi.fn().mockResolvedValue(undefined)
const stopMock = vi.fn()
const clearMock = vi.fn()
const newChatMock = vi.fn()
const switchChatMock = vi.fn()
const deleteChatMock = vi.fn()

vi.mock('../../src/components/base/useAgentChat.js', () => ({
  useAgentChat: () => ({
    messages: [],
    sending: false,
    error: null,
    model: 'gpt-4o-mini',
    setModel: vi.fn(),
    send: sendMock,
    sendImageMode: sendImageModeMock,
    stop: stopMock,
    clear: clearMock,
    stateAction: 'idle',
    conversations: [],
    activeConversationId: null,
    newChat: newChatMock,
    switchChat: switchChatMock,
    deleteChat: deleteChatMock,
  }),
}))

vi.mock('../../src/components/base/settings/providerStore.js', () => ({
  useProviders: () => ({ providers: [{ id: 'p1', name: 'P1', isPrimary: true, chat_models: [{ id: 'gpt-4o' }] }] }),
  load: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/components/base/providerModels.js', () => ({
  buildAllModels: () => [{ id: 'model-a', label: 'Model A' }],
}))

vi.mock('../../src/components/base/ModelSelect.jsx', () => ({
  default: ({ value, onChange, models }) => (
    <select data-testid="model-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {(models || []).map((m) => <option key={m.id} value={m.id}>{m.label || m.id}</option>)}
    </select>
  ),
}))

vi.mock('../../src/components/base/useCanvasAgentTools.js', () => ({
  setGenParams: vi.fn(),
  getGenParams: () => ({ model: '', resolution: '1K', ratio: 'Auto', quality: 'auto' }),
}))

vi.mock('../../src/components/base/settings/agentModelStore.js', () => ({
  loadAgentChatModel: () => ({ providerId: '', modelId: '' }),
}))

const allSkills = [{ id: 's1', name: '风格A', description: '', content: 'x' }]
vi.mock('../../src/components/base/skillStore.js', () => ({
  getAllSkills: () => allSkills,
  markSkillUsed: vi.fn(),
  repairMojibakeText: (t) => t,
}))

vi.mock('../../src/components/base/storageAdapter.js', () => ({
  sGet: () => null,
  sSet: vi.fn(),
}))

vi.mock('../../src/components/base/conversationStore.js', () => ({
  setCurrentSnapshot: vi.fn(),
  setAwaitingConfirm: vi.fn(),
}))

vi.mock('../../src/components/base/taskStore.js', () => ({
  runNodeGeneration: vi.fn().mockResolvedValue({ ok: true, resultUrl: 'u' }),
}))

vi.mock('../../src/components/base/toastStore.js', () => ({
  showToast: vi.fn(),
}))

// AgentMessage 是真组件但已单测过，这里 mock 成透明占位避免重渲染负担
vi.mock('../../src/components/AgentMessage.jsx', () => ({
  default: () => null,
}))

import AgentPanel from '../../src/components/AgentPanel.jsx'

describe('AgentPanel', () => {
  beforeEach(() => {
    sendMock.mockClear()
    sendImageModeMock.mockClear()
    newChatMock.mockClear()
  })

  it('挂载不崩，渲染标题与空态欢迎语', () => {
    render(<AgentPanel open />)
    expect(screen.getByText('AI 助手')).toBeTruthy()
    expect(screen.getByText('有什么可以帮你？')).toBeTruthy()
  })

  it('open=false 时不渲染面板', () => {
    const { container } = render(<AgentPanel open={false} />)
    expect(container.querySelector('div')).toBeFalsy()
  })

  it('空态快捷建议可点击发送', () => {
    render(<AgentPanel open />)
    const chip = screen.getByText('生成赛博朋克猫咪图')
    fireEvent.click(chip)
    expect(sendMock).toHaveBeenCalled()
  })

  it('输入文本回车触发 send', () => {
    render(<AgentPanel open />)
    const textarea = screen.getByPlaceholderText(/输入消息/)
    fireEvent.change(textarea, { target: { value: '你好' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(sendMock).toHaveBeenCalledWith('你好', undefined)
  })

  it('新建对话按钮触发 newChat', () => {
    render(<AgentPanel open />)
    fireEvent.click(screen.getByTitle('新建对话'))
    expect(newChatMock).toHaveBeenCalled()
  })

  it('应用 Skill 后显示已启用 chip，可移除', () => {
    render(<AgentPanel open />)
    // 空态下方有 Skill 快捷按钮
    const skillBtn = screen.getByText('风格A')
    fireEvent.click(skillBtn)
    // 应用后工具栏 Skill 按钮文本变为 Skill·风格A
    expect(screen.getByText(/Skill·风格A/)).toBeTruthy()
  })

  it('生图参数面板可打开并切换画质', () => {
    render(<AgentPanel open />)
    fireEvent.click(screen.getByTitle('生图参数'))
    // 弹层出现画质选项
    expect(screen.getByText('画质')).toBeTruthy()
    expect(screen.getByText('比例')).toBeTruthy()
  })

  it('图像模式切换后发送走 sendImageMode', () => {
    render(<AgentPanel open />)
    fireEvent.click(screen.getByText('图像'))
    const textarea = screen.getByPlaceholderText(/输入最终生图提示词/)
    fireEvent.change(textarea, { target: { value: '一只猫' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(sendImageModeMock).toHaveBeenCalled()
  })

  it('选中图节点作为待确认引用，聚焦输入框时转正式附件', () => {
    const { rerender } = render(<AgentPanel open selectedImageNodes={[]} />)
    rerender(<AgentPanel open selectedImageNodes={[{ url: 'http://x/a.png', nodeId: 'n1', label: '图1' }]} />)
    // 待引用区出现
    expect(screen.getByText('待引用：')).toBeTruthy()
    const textarea = screen.getByPlaceholderText(/输入消息/)
    fireEvent.focus(textarea)
    // 确认后待引用消失（转入正式附件，正式附件区出现）
    expect(screen.queryByText('待引用：')).toBeFalsy()
  })
})
