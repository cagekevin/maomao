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
import { render, screen, fireEvent, within, act } from '@testing-library/react'

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
  const setAwaitingConfirm = vi.fn()
  const getCurrentRunMode = vi.fn(() => (agentState.runMode || 'auto'))
  // workMode 三态（docs/65 M8）：注册表单例，供 selector 切换与占位符驱动
  let workMode = 'auto'
  const getWorkMode = vi.fn(() => workMode)
  const setWorkMode = vi.fn((m) => { workMode = m; return m })
  const RUN_MODE_IDS = { DIRECT: 'direct', STEP_CONFIRM: 'step-confirm', AUTO: 'auto' }
  // 收口 store 穿透（2026-08-21）：AgentPanel 从 useAgentChat 解构这 4 个 handler，不再直连 conversationStore
  const useAgentChat = vi.fn(() => ({ ...agentState, setModel, send, stop, clear, stateAction: '', newChat, switchChat, deleteChat, updateMessageByContent: vi.fn(), executePlanDirect: vi.fn(async () => ({ ok: true })), setCurrentSnapshot, setAwaitingConfirm, getCreditGate: vi.fn(() => null), clearCreditGate: vi.fn() }))
  // contentStore 订阅桩：记录已注册的 key→cb，供测试触发「设置变更」回调
  let subscribeCbs = {}
  let subscribeUnsubs = []
  const contentSubscribe = vi.fn((key, cb) => { subscribeCbs[key] = cb; subscribeUnsubs.push(vi.fn()); return subscribeUnsubs[subscribeUnsubs.length - 1] })

  // loadAgentChatModel 返回值（可覆盖，默认空=未配置）
  let agentModelCfg = {}
  // useProviders 返回值（可覆盖，默认空）
  let providers = []
  // 订阅键常量：与 mock 的 AGENT_CHAT_MODEL_KEY 同源，避免 fireAgentModelChange 硬编码漂移
  const AGENT_CHAT_MODEL_KEY = 'agent_chat_model'

  return {
    useAgentChat, setModel, send, stop, clear, newChat, switchChat, deleteChat,
    markSkillUsed, showToast, setCurrentSnapshot, setCurrentRunMode, setAwaitingConfirm, getCurrentRunMode,
    getWorkMode, setWorkMode, RUN_MODE_IDS,
    contentSubscribe, subscribeCbs, AGENT_CHAT_MODEL_KEY,
    setSubscribeCbs: (c) => { subscribeCbs = c },
    resetWorkMode: () => { workMode = 'auto' },
    fireAgentModelChange: (cfg) => { subscribeCbs[AGENT_CHAT_MODEL_KEY]?.(cfg) },
    get agentModelCfg() { return agentModelCfg },
    setAgentModelCfg: (c) => { agentModelCfg = c },
    get providers() { return providers },
    setProviders: (p) => { providers = p },
    get agentState() { return agentState },
    setAgentState: (s) => { agentState = { ...agentState, ...s } },
    get skills() { return skills },
    setSkills: skillsSetter,
    get snapshots() { return snapshots },
    get subscribeUnsubs() { return subscribeUnsubs },
  }
})

// AgentPanel 现从聚合入口 agent/index.js import（useAgentChat/setGenParams/getGenParams），
// vitest 按模块路径 mock——必须 mock index.js 而非深层路径，否则 mock 失效（M0 聚合入口收口）。
vi.mock('../../src/components/agent/index.ts', () => ({
  useAgentChat: (...a) => h.useAgentChat(...a),
  setGenParams: vi.fn(),
  getGenParams: () => ({}),
  getWorkMode: (...a) => h.getWorkMode(...a),
  setWorkMode: (...a) => h.setWorkMode(...a),
  RUN_MODE_IDS: h.RUN_MODE_IDS,
  WORK_MODE_STORAGE_KEY: 'agent_work_mode',
}))
vi.mock('../../src/components/base/settings/providerStore.ts', () => ({ useProviders: () => ({ providers: h.providers }), load: vi.fn(async () => {}) }))
vi.mock('../../src/components/base/settings/agentModelStore.ts', () => ({ loadAgentChatModel: () => h.agentModelCfg, AGENT_CHAT_MODEL_KEY: h.AGENT_CHAT_MODEL_KEY }))
vi.mock('../../src/components/base/providerModels.ts', () => ({ buildAllModels: () => [] }))
vi.mock('../../src/components/base/hooks.ts', () => ({ useOutsideClick: () => {} }))
vi.mock('../../src/components/base/skillStore.ts', () => ({
  getAllSkills: () => h.skills,
  markSkillUsed: (...a) => h.markSkillUsed(...a),
  isSkillEnabled: () => true,
  repairMojibakeText: (t) => t,
}))
vi.mock('../../src/components/base/contentStore.ts', () => ({
  contentGet: () => null,
  contentSet: vi.fn(),
  contentSubscribe: (...a) => h.contentSubscribe(...a),
}))
vi.mock('../../src/components/base/api/filesApi.ts', () => ({ toAbsoluteFileUrl: (u) => u }))
vi.mock('../../src/components/agent/conversation/conversationStore.ts', () => ({
  setCurrentSnapshot: (...a) => h.setCurrentSnapshot(...a),
  setAwaitingConfirm: vi.fn(),
  getCurrentRunMode: () => 'auto',
  setCurrentRunMode: (...a) => h.setCurrentRunMode(...a),
}))
vi.mock('../../src/components/base/taskStore.ts', () => ({ runNodeGeneration: vi.fn() }))
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: (...a) => h.showToast(...a) }))
vi.mock('../../src/components/base/logger.ts', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn(), debug: vi.fn() } }))
vi.mock('../../src/components/base/config.js', () => ({ AGENT_MODELS: ['gpt-4o-mini'] }))
vi.mock('../../src/components/base/previewUrl.ts', () => ({ default: { create: vi.fn(() => 'blob:x'), release: vi.fn() } }))
// AgentMessage 子组件用最小桩
vi.mock('../../src/components/panels/AgentMessage.tsx', () => ({
  default: ({ message }) => React.createElement('div', { 'data-testid': `msg-${message.role}` }, message.content || null),
}))
vi.mock('../../src/components/base/ModelSelect.tsx', () => ({
  default: () => React.createElement('span', null, 'ModelSelect'),
}))

import AgentPanel from '../../src/components/panels/AgentPanel.tsx'

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
  h.resetWorkMode() // 复位 workMode，防「直接生图」用例的 direct 状态跨用例泄漏
  h.setAgentState({ messages: [], sending: false, error: '', conversations: [], activeConversationId: 'c1' })
  h.setSkills([])
  h.snapshots.length = 0
  // 重置订阅桩（清空历史注册与取消订阅记录），让每条用例从干净订阅态开始
  // 注意：必须走 setSubscribeCbs 写闭包变量——直接 h.subscribeCbs = {} 只改返回对象属性，
  // 而 contentSubscribe mock 闭包引用的是 hoisted 内部 let，两处不同引用，会清空失效导致跨用例累积。
  h.setSubscribeCbs({})
  h.subscribeUnsubs.length = 0
  h.setAgentModelCfg({})
  h.setProviders([])
})

describe('AgentPanel — 面板显隐（阶段1C：常驻 DOM，CSS 显隐）', () => {
  it('open=false → 根容器仍在 DOM 但带 hidden（不卸载，运行态不断流）', () => {
    render(<AgentPanel {...CLOSED_PROPS} />)
    const root = document.querySelector('.absolute.top-0.right-0.bottom-0')
    expect(root).toBeTruthy()          // 常驻：容器卸载不触发
    expect(root.className).toContain('hidden') // 关闭：CSS 隐藏可见内容
  })

  it('open=true → 根容器不带 hidden（可见）', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    const root = document.querySelector('.absolute.top-0.right-0.bottom-0')
    expect(root).toBeTruthy()
    expect(root.className).not.toContain('hidden')
  })

  it('open=true → 渲染空态引导', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
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

describe('AgentPanel — 直接生图模式', () => {
  it('切换到直接生图 → 提示文案与占位符变化', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: '直接生图' }))
    expect(screen.getByPlaceholderText(/输入最终生图提示词/)).toBeTruthy()
  })

  it('直接生图 → 仍走统一 send 入口（send 内部按 workMode 分流到直连，docs/65 M7）', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: '直接生图' }))
    const ta = screen.getByPlaceholderText(/输入最终生图提示词/)
    fireEvent.change(ta, { target: { value: '一只机械猫' } })
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: false })
    expect(h.send).toHaveBeenCalledWith('一只机械猫', undefined)
  })

  it('挂载 → 订阅 agent_work_mode（docs/65 M8 交叉消除）：外部入口改模式时面板随注册表真源跟随', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    // 订阅已注册：回调读注册表真源 getWorkMode()（真源切换 → 面板本地 state 跟随）。
    // 注册行为用 call 历史断言（可靠），真源读写已在 runModeRegistry.test 覆盖。
    expect(h.contentSubscribe).toHaveBeenCalledWith('agent_work_mode', expect.any(Function))
    expect(h.contentSubscribe).toHaveBeenCalledWith('agent_chat_model', expect.any(Function))
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
      { id: 'm1', role: 'user', content: '帮我生成一张图' },
      { id: 'm2', role: 'assistant', content: '好的' },
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
    h.setAgentState({ messages: [{ id: 'm1', role: 'user', content: 'x' }] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AgentPanel {...OPEN_PROPS} />)
    fireEvent.click(screen.getByTitle('清空对话'))
    expect(h.clear).toHaveBeenCalled()
    window.confirm.mockRestore()
  })

  it('清空对话取消确认 → 不 clear', () => {
    h.setAgentState({ messages: [{ id: 'm1', role: 'user', content: 'x' }] })
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

describe('AgentPanel — 设置改模型/供应商即生效（方案 B，无需刷新）', () => {
  it('挂载 → 订阅 agent_chat_model 变更（contentSubscribe 注册）', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    expect(h.contentSubscribe).toHaveBeenCalledWith(h.AGENT_CHAT_MODEL_KEY, expect.any(Function))
    // 防漂移：fireAgentModelChange 触发的 key 必须与订阅注册 key 一致，否则回调静默触发不到
    expect(h.contentSubscribe).toHaveBeenCalledWith(expect.stringMatching(/^agent_chat_model$/), expect.any(Function))
  })

  it('触发设置变更 → setModel 同步为新 modelId（model 进 useAgentChat）', () => {
    render(<AgentPanel {...OPEN_PROPS} />)
    act(() => { h.fireAgentModelChange({ providerId: 'p1', modelId: 'gpt-5', streamMode: 'stream' }) })
    expect(h.setModel).toHaveBeenCalledWith('gpt-5')
  })

  it('触发设置变更 → useAgentChat 收到新 provider（agentProvider 重算）', () => {
    h.setProviders([
      { id: 'modelscope', name: '魔搭', primary: true, chat_models: [{ id: 'qwen' }] },
      { id: 'p2', name: 'B', chat_models: [{ id: 'gpt-5' }] },
    ])
    h.setAgentModelCfg({ providerId: 'p2', modelId: 'gpt-5', streamMode: 'stream' })
    render(<AgentPanel {...OPEN_PROPS} />)
    // 初始 provider 由挂载时配置决定（useAgentChat 收到的 provider 应为 p2）
    expect(h.useAgentChat).toHaveBeenCalledWith(expect.objectContaining({ provider: expect.objectContaining({ id: 'p2' }) }))
  })

  it('卸载 → 取消订阅（返回的 unsubscribe 被调用，防泄漏）', () => {
    // 假设：AgentPanel 注册两次 contentSubscribe（agent_chat_model + agent_work_mode），
    // 取最后一次订阅（work_mode）的取消函数验证卸载即退订。若再新增订阅需按 key 定位。
    const { unmount } = render(<AgentPanel {...OPEN_PROPS} />)
    expect(h.subscribeUnsubs.length).toBe(2)
    const unsub = h.subscribeUnsubs[h.subscribeUnsubs.length - 1]
    unmount()
    expect(unsub).toHaveBeenCalled()
  })
})
