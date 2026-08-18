// @vitest-environment jsdom
/**
 * AgentPanel 深度测试 —— 画布 AI 助手聊天面板装配层。
 *
 * 高频改动组件（近 200 次提交多次改动，此前无组件测试）。覆盖：
 *  - 面板显隐
 *  - 消息发送（回车 / 快捷 chip / 空输入禁用）
 *  - 图像模式（直连生图走 sendImageMode，不经过 LLM）
 *  - sending 态（思考中 + 停止按钮）
 *  - Skill 应用与移除（markSkillUsed / setCurrentSnapshot 同步 / 标题更新）
 *  - 对话管理（新建 / 切换 / 清空）
 *  - 错误展示、消息渲染、待引用图确认并入附件
 *
 * 隔离策略：
 *  - useAgentChat（逻辑核心）用可控 hoisted 状态 mock，每用例可调 sending/error/messages。
 *  - skillStore.getAllSkills 可控，验证 Skill 下拉与应用。
 *  - conversationStore.setCurrentSnapshot 记录调用，验证 skills 同步落盘。
 *  - 其余外部依赖空桩；AgentMessage/ModelSelect 用最小桩（其自身已有/将有专测）。
 *
 * OOM 教训：AgentPanel 的 selectedImageNodes 若用默认参数（每次渲染新 []），
 * 会与组件内 useEffect(setPendingImageNodes) 无限 re-render → 堆溢出。测试必须传稳定引用。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

// ── 可控 hoisted 状态 ──
const h = vi.hoisted(() => {
  // useAgentChat 返回值（可覆盖）
  let agentState = {
    messages: [], sending: false, error: '', model: 'gpt-4o',
    conversations: [], activeConversationId: 'c1',
  }
  // Skill 列表
  let skills = []
  let skillsSetter = (s) => { skills = s }
  // 记录 setCurrentSnapshot 调用
  let snapshots = []
  let snapshotSetter = (s) => { snapshots.push(s) }

  const send = vi.fn(async () => ({ ok: true }))
  const sendImageMode = vi.fn(async () => ({ ok: true }))
  const stop = vi.fn()
  const clear = vi.fn()
  const setModel = vi.fn()
  const newChat = vi.fn()
  const switchChat = vi.fn()
  const deleteChat = vi.fn()
  const markSkillUsed = vi.fn()
  const showToast = vi.fn()
  const setCurrentSnapshot = vi.fn((s) => snapshotSetter(s))
  const setCurrentRunMode = vi.fn()
  const useAgentChat = vi.fn(() => ({ ...agentState, setModel, send, sendImageMode, stop, clear, stateAction: '', newChat, switchChat, deleteChat, updateMessageByContent: vi.fn(), executePlanDirect: vi.fn(async () => ({ ok: true })) }))

  return {
    useAgentChat, send, sendImageMode, stop, clear, newChat, switchChat, deleteChat,
    markSkillUsed, showToast, setCurrentSnapshot, setCurrentRunMode,
    get agentState() { return agentState },
    setAgentState: (s) => { agentState = { ...agentState, ...s } },
    get skills() { return skills },
    setSkills: skillsSetter,
    get snapshots() { return snapshots },
  }
})

vi.mock('../../src/components/base/useAgentChat.js', () => ({
  useAgentChat: (...a) => h.useAgentChat(...a),
}))
vi.mock('../../src/components/base/settings/providerStore.js', () => ({ useProviders: () => [], load: vi.fn(async () => {}) }))
vi.mock('../../src/components/base/settings/agentModelStore.js', () => ({ loadAgentChatModel: () => ({}) }))
vi.mock('../../src/components/base/providerModels.js', () => ({ buildAllModels: () => [] }))
vi.mock('../../src/components/base/hooks.js', () => ({ useOutsideClick: () => {} }))
vi.mock('../../src/components/base/useCanvasAgentTools.js', () => ({ setGenParams: vi.fn(), getGenParams: () => ({}) }))
vi.mock('../../src/components/base/skillStore.js', () => ({
  getAllSkills: () => h.skills,
  markSkillUsed: (...a) => h.markSkillUsed(...a),
  repairMojibakeText: (t) => t,
}))
vi.mock('../../src/components/base/contentStore.js', () => ({ contentGet: () => null, contentSet: vi.fn() }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: (u) => u }))
vi.mock('../../src/components/base/conversationStore.js', () => ({
  setCurrentSnapshot: (...a) => h.setCurrentSnapshot(...a),
  setAwaitingConfirm: vi.fn(),
  getCurrentRunMode: () => 'auto',
  setCurrentRunMode: (...a) => h.setCurrentRunMode(...a),
}))
vi.mock('../../src/components/base/taskStore.js', () => ({ runNodeGeneration: vi.fn() }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: (...a) => h.showToast(...a) }))
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

// jsdom(pretendToBeVisual) 的平滑 scrollTo / rAF 在部分组合下会持续递归耗尽内存；
// AgentPanel 的滚动 effect 用到它们，测试环境固定为空操作。
if (typeof globalThis.Element !== 'undefined' && globalThis.Element.prototype.scrollTo) {
  globalThis.Element.prototype.scrollTo = function () {}
}
if (typeof globalThis.window !== 'undefined') {
  globalThis.window.requestAnimationFrame = () => 0
  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame
}

// 稳定引用：默认参数每次渲染都是新 []，会与组件内 effect(setPendingImageNodes) 无限 re-render → OOM
const OPEN_PROPS = {
  selectedImageNodes: [],
  open: true, onClose: vi.fn(), onWidthChange: vi.fn(), onEnabledChange: vi.fn(),
}
const CLOSED_PROPS = {
  selectedImageNodes: [],
  open: false, onClose: vi.fn(), onWidthChange: vi.fn(), onEnabledChange: vi.fn(),
}

const SKILLS = [
  { id: 's1', name: '赛博朋克风格', description: 'd', content: 'c', builtin: true },
  { id: 's2', name: '分镜脚本', description: 'd', content: 'c' },
]

beforeEach(() => {
  vi.clearAllMocks()
  h.setAgentState({ messages: [], sending: false, error: '', conversations: [], activeConversationId: 'c1' })
  h.setSkills([])
  h.snapshots.length = 0
})

describe('AgentPanel — 面板显隐', () => {
  it('open=false → 不渲染任何内容', () => {
    render(<AgentPanel {...CLOSED_PROPS} />)
    expect(document.body.textContent).toBe('')
  })

  it('open=true → 渲染标题与空态', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(screen.getByText('AI 助手')).toBeTruthy()
    expect(screen.getByText('有什么可以帮你？')).toBeTruthy()
  })

  it('点击关闭按钮 → 触发 onClose', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByTitle('关闭'))
    expect(OPEN_PROPS.onClose).toHaveBeenCalled()
  })
})

describe('AgentPanel — 消息发送', () => {
  it('输入文本 → 回车发送（携带输入内容）', () => {
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

  it('快捷 chip → 直接发送该文案', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByText('生成赛博朋克猫咪图'))
    expect(h.send).toHaveBeenCalledWith('生成赛博朋克猫咪图', undefined)
  })

  it('发送后 → 清空输入框', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    const ta = screen.getByPlaceholderText(/输入消息/)
    fireEvent.change(ta, { target: { value: '你好' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    expect(ta.value).toBe('')
  })
})

describe('AgentPanel — 图像模式（直连生图）', () => {
  it('切换到图像模式 → 提示文案与占位符变化', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByTitle('图像模式：参考图 + 提示词直连生图，不经过 LLM'))
    expect(screen.getByText('直连生图')).toBeTruthy()
    expect(screen.getByPlaceholderText(/输入最终生图提示词/)).toBeTruthy()
  })

  it('图像模式 → 发送走 sendImageMode（不经过 LLM）', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByTitle('图像模式：参考图 + 提示词直连生图，不经过 LLM'))
    const ta = screen.getByPlaceholderText(/输入最终生图提示词/)
    fireEvent.change(ta, { target: { value: '一只机械猫' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    expect(h.sendImageMode).toHaveBeenCalledWith('一只机械猫', [])
    expect(h.send).not.toHaveBeenCalled()
  })

  it('图像模式 → 执行分级按钮禁用（title 提示不走分级）', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByTitle('图像模式：参考图 + 提示词直连生图，不经过 LLM'))
    expect(screen.getByTitle('图像模式不走分级').disabled).toBe(true)
  })
})

describe('AgentPanel — sending 态', () => {
  it('sending → 显示思考中，发送变停止按钮', () => {
    h.setAgentState({ sending: true })
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(screen.getByText('思考中...')).toBeTruthy()
    fireEvent.click(screen.getByTitle('停止'))
    expect(h.stop).toHaveBeenCalled()
  })
})

describe('AgentPanel — 消息与错误渲染', () => {
  it('渲染用户与助手消息（传给 AgentMessage）', () => {
    h.setAgentState({ messages: [
      { role: 'user', content: '帮我生成一张图' },
      { role: 'assistant', content: '好的' },
    ] })
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(screen.getByTestId('msg-user')).toBeTruthy()
    expect(screen.getByTestId('msg-assistant')).toBeTruthy()
    // 空态不再显示
    expect(screen.queryByText('有什么可以帮你？')).toBeNull()
  })

  it('error 非空 → 展示错误信息', () => {
    h.setAgentState({ error: '模型请求超时' })
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(screen.getByText('模型请求超时')).toBeTruthy()
  })
})

describe('AgentPanel — Skill 应用与移除', () => {
  // 空态 chips 与下拉项都渲染 Skill 名，点击下拉项需限定在 picker 容器（span[ref=skillPickRef]）
  const openSkillPicker = () => {
    const btn = screen.getByTitle('应用 Skill')
    fireEvent.click(btn)
    return btn.parentElement
  }

  it('点击 Skill 按钮 → 打开下拉，展示所有 Skill', () => {
    h.setSkills(SKILLS)
    render(<AgentPanel {...OPEN_PROPS} />)
    const picker = openSkillPicker()
    expect(within(picker).getByText('赛博朋克风格')).toBeTruthy()
    expect(within(picker).getByText('分镜脚本')).toBeTruthy()
  })

  it('应用 Skill → markSkillUsed 调用 + 按钮标题带 Skill 名 + 同步 setCurrentSnapshot', () => {
    h.setSkills(SKILLS)
    render(<AgentPanel {...OPEN_PROPS} />)
    const picker = openSkillPicker()
    fireEvent.click(within(picker).getByText('赛博朋克风格'))
    expect(h.markSkillUsed).toHaveBeenCalledWith('s1')
    // 按钮标题变为已启用 Skill 名
    expect(screen.getByTitle('已启用 赛博朋克风格')).toBeTruthy()
    // skills 同步到 conversationStore
    const lastSnapshot = h.snapshots[h.snapshots.length - 1]
    expect(lastSnapshot.skills).toEqual([{ id: 's1', name: '赛博朋克风格', description: 'd', content: 'c' }])
  })

  it('再次点击已应用 Skill → 移除（不重复 markSkillUsed）', () => {
    h.setSkills(SKILLS)
    render(<AgentPanel {...OPEN_PROPS} />)
    // 先应用
    const picker = openSkillPicker()
    fireEvent.click(within(picker).getByText('赛博朋克风格'))
    // 再打开下拉移除（按钮标题此时为已启用）
    fireEvent.click(screen.getByTitle(/已启用/))
    const picker2 = screen.getByTitle(/已启用/).parentElement
    fireEvent.click(within(picker2).getByText('赛博朋克风格'))
    expect(h.markSkillUsed).toHaveBeenCalledTimes(1) // 移除不计数
    expect(screen.getByTitle('应用 Skill')).toBeTruthy() // 回到未应用态
  })

  it('空态渲染 Skill chips → 点击直接应用', () => {
    h.setSkills(SKILLS)
    render(<AgentPanel {...OPEN_PROPS} />)
    // 空态下方展示前 3 个 Skill chips
    fireEvent.click(screen.getByText('分镜脚本'))
    expect(h.markSkillUsed).toHaveBeenCalledWith('s2')
    expect(screen.getByTitle('已启用 分镜脚本')).toBeTruthy()
  })
})

describe('AgentPanel — 对话管理', () => {
  it('点击新建对话 → newChat + showToast', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByTitle('新建对话'))
    expect(h.newChat).toHaveBeenCalled()
    expect(h.showToast).toHaveBeenCalledWith('已新建对话', { type: 'success' })
  })

  it('打开对话列表 → 展示对话标题，点击切换', () => {
    h.setAgentState({
      conversations: [
        { id: 'c1', title: '对话一', messages: [] },
        { id: 'c2', title: '对话二', messages: [{ role: 'user', content: '帮我改布局' }] },
      ],
      activeConversationId: 'c1',
    })
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByTitle('对话列表'))
    // c2 标题由首条 user 消息内容推导
    expect(screen.getByText('帮我改布局')).toBeTruthy()
    fireEvent.click(screen.getByText('帮我改布局'))
    expect(h.switchChat).toHaveBeenCalledWith('c2')
  })

  it('点击清空对话 → confirm 后 clear', () => {
    h.setAgentState({ messages: [{ role: 'user', content: 'x' }] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByTitle('清空对话'))
    expect(h.clear).toHaveBeenCalled()
    window.confirm.mockRestore()
  })

  it('清空对话取消确认 → 不 clear', () => {
    h.setAgentState({ messages: [{ role: 'user', content: 'x' }] })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByTitle('清空对话'))
    expect(h.clear).not.toHaveBeenCalled()
    window.confirm.mockRestore()
  })

  it('无消息 → 清空对话按钮禁用', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(screen.getByTitle('清空对话').disabled).toBe(true)
  })
})

describe('AgentPanel — 待引用图确认', () => {
  it('选中画布图节点 → 显示待引用，聚焦输入框后并入附件并随发送带出', () => {
    render(<AgentPanel {...OPEN_PROPS} selectedImageNodes={[{ url: 'http://x/img.png', label: 'L', nodeId: 'n1', nodeType: 'image' }]} />)
    expect(screen.getByText('待引用：')).toBeTruthy()
    // 聚焦输入框 → 确认并入附件（此时发送附件非空）
    const ta = screen.getByPlaceholderText(/输入消息/)
    fireEvent.focus(ta)
    fireEvent.change(ta, { target: { value: '参考这张图' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    // agent 模式发送：attachments 映射为 {type,url,nodeId,label,x,y}（不带 localUrl/nodeType）
    expect(h.send).toHaveBeenCalledWith('参考这张图', [{ type: 'image', url: 'http://x/img.png', nodeId: 'n1', label: 'L', x: 0, y: 0 }])
  })
})

describe('AgentPanel — 执行分级切换', () => {
  it('默认全自动 → 点击切换半自动 → setCurrentRunMode("semi") + 文案变化', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(screen.getByText('全自动')).toBeTruthy()
    fireEvent.click(screen.getByText('全自动'))
    expect(h.setCurrentRunMode).toHaveBeenCalledWith('semi')
    expect(screen.getByText('半自动')).toBeTruthy()
  })
})
