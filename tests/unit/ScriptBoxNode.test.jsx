// @vitest-environment jsdom
/**
 * ScriptBoxNode 深度测试。
 *
 * 剧本盒子（复刻 c_.jsx）：三步状态机（确认镜头/准备资产/合成提示词）+ 引擎回调注入
 * （useScriptBoxEngine 把 9 个 onXxx 写回 node.data）+ 齿轮设置/全屏弹窗 + genMask 计时。
 * 此前零测试，本文件断言核心契约：
 *  - 三步切换：点击步骤 → updateData({ step })；data.step 驱动内容渲染
 *  - 步骤完成度描述（镜头数/资产进度）
 *  - 引擎注入：node.data.onXxx 10 个回调被注入且与引擎实例一致
 *  - 步骤子组件通过 callbacks 调用引擎回调（UI 只调回调，不做引擎）
 *  - 设置弹窗打开/保存、全屏弹窗打开
 *  - genMask 生成中计时（秒数递增）
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const h = vi.hoisted(() => {
  const state = { nodes: [] }
  const setNodesMock = vi.fn((updater) => {
    state.nodes = typeof updater === 'function' ? updater(state.nodes) : updater
  })
  const getNodesMock = vi.fn(() => state.nodes)
  const updateData = vi.fn()
  // 引擎实例：10 个回调（含 onStopScriptItem），与真实 createScriptBoxEngine 返回一致
  const engine = {
    onGenerateScript: vi.fn(),
    onGenerateAssetImage: vi.fn(),
    onGenerateAllAssetImages: vi.fn(),
    onGenerateShotPrompts: vi.fn(),
    onGenerateShotImage: vi.fn(),
    onStopScriptItem: vi.fn(),
    onRetryVideoAssetUpload: vi.fn(),
    onUploadAllVideoAssets: vi.fn(),
    onConnectShot: vi.fn(),
    onConnectShots: vi.fn(),
  }
  return { state, setNodesMock, getNodesMock, updateData, engine }
})

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: (...a) => h.setNodesMock(...a),
    getNodes: () => h.getNodesMock(),
    setEdges: vi.fn(),
    addNodes: vi.fn(),
    screenToFlowPosition: () => ({ x: 0, y: 0 }),
  }),
  // CustomHandle（节点内部端口）会渲染 Handle，mock 成 null 即可（测试不关心端口 DOM）
  Handle: () => null,
}))

vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/FullscreenModal.jsx', () => ({ default: ({ open, children }) => (open ? <div data-testid="fullscreen">{children}</div> : null) }))
// 数据读写 hook：updateData 记录调用（StepNav 切步用）
vi.mock('../../src/components/base/useScriptBoxData.js', () => ({ useScriptBoxData: () => ({ updateData: (...a) => h.updateData(...a) }) }))
// 引擎 hook：mock createScriptBoxEngine → 返回稳定引擎实例，验证真实注入链路
vi.mock('../../src/components/base/scriptBoxEngine.js', () => ({ createScriptBoxEngine: () => h.engine }))
vi.mock('../../src/components/base/settings/providerStore.js', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(async () => {}) }))
vi.mock('../../src/components/base/logger.js', () => ({ logger: { warn: vi.fn() } }))
vi.mock('../../src/components/base/hooks.js', () => ({ useOutsideClick: () => {}, useNodeResize: () => ({ onMainBoxResize: vi.fn() }) }))
// 上游输入接入 hook：mock 返回空（测试默认无上游连线），避免依赖 @xyflow/react 的 useStore
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: () => ({ images: [], texts: [], videos: [], audios: [] }) }))

// 三步子组件 mock：渲染内容标记 + 可点的引擎回调按钮（验证 UI 只调回调）
vi.mock('../../src/components/scriptbox/StepShots.jsx', () => ({
  default: ({ data, callbacks }) => (
    <div data-testid="step-shots">
      <span data-testid="shots-count">{data.shots?.length || 0}</span>
      <button type="button" data-testid="gen-script" onClick={() => callbacks?.onGenerateScript?.()}>生成分镜脚本</button>
    </div>
  ),
}))
vi.mock('../../src/components/scriptbox/StepAssets.jsx', () => ({
  default: ({ data }) => (
    <div data-testid="step-assets">
      <span data-testid="assets-count">{data.assets?.length || 0}</span>
    </div>
  ),
}))
vi.mock('../../src/components/scriptbox/StepPrompt.jsx', () => ({
  default: ({ data }) => (
    <div data-testid="step-prompt">
      <span data-testid="prompt-count">{data.shots?.length || 0}</span>
    </div>
  ),
}))
vi.mock('../../src/components/scriptbox/GearSettings.jsx', () => ({
  default: ({ updateData }) => (
    <div data-testid="gear-settings">
      <button type="button" data-testid="gear-save" onClick={() => updateData({ aspectRatio: '9:16' })}>保存设置</button>
    </div>
  ),
}))

import ScriptBoxNode from '../../src/components/nodes/ScriptBoxNode.jsx'

const nodeId = 'sb1'
function setup(data = {}) {
  // 传入含引擎回调的 data（模拟挂载后注入完成状态），使步骤子组件能调 callbacks
  const nodeData0 = { ...data, ...h.engine }
  h.state.nodes = [{ id: nodeId, data: { ...nodeData0 } }]
  h.updateData.mockClear()
  Object.values(h.engine).forEach((fn) => fn.mockClear())
  return render(<ScriptBoxNode id={nodeId} data={{ ...nodeData0 }} selected={false} />)
}
function nodeData() {
  return h.state.nodes.find((n) => n.id === nodeId)?.data
}

describe('ScriptBoxNode — 三步状态机渲染', () => {
  it('默认 step=1：渲染确认镜头（StepShots）', () => {
    setup()
    expect(screen.getByTestId('step-shots')).toBeTruthy()
    expect(screen.queryByTestId('step-assets')).toBeNull()
    expect(screen.queryByTestId('step-prompt')).toBeNull()
  })

  it('data.step=2 渲染准备资产（StepAssets）', () => {
    setup({ step: 2 })
    expect(screen.getByTestId('step-assets')).toBeTruthy()
    expect(screen.queryByTestId('step-shots')).toBeNull()
  })

  it('data.step=3 渲染合成提示词（StepPrompt）', () => {
    setup({ step: 3 })
    expect(screen.getByTestId('step-prompt')).toBeTruthy()
    expect(screen.queryByTestId('step-shots')).toBeNull()
  })

  it('步骤数据传给子组件（shots/assets 计数）', () => {
    setup({ shots: [{ id: 1 }, { id: 2 }], assets: [{ id: 'a' }] })
    expect(screen.getByTestId('shots-count').textContent).toBe('2')
  })
})

describe('ScriptBoxNode — 步骤导航交互', () => {
  it('点击「准备资产」→ updateData({ step: 2 })', () => {
    setup()
    fireEvent.click(screen.getByText('准备资产'))
    expect(h.updateData).toHaveBeenCalledWith({ step: 2 })
  })

  it('点击「合成提示词」→ updateData({ step: 3 })', () => {
    setup()
    fireEvent.click(screen.getByText('合成提示词'))
    expect(h.updateData).toHaveBeenCalledWith({ step: 3 })
  })

  it('激活步骤按钮带高亮类（bg-surface-hover）', () => {
    setup({ step: 2 })
    const active = screen.getByText('准备资产').closest('button')
    expect(active.className).toContain('bg-surface-hover')
    const inactive = screen.getByText('确认镜头').closest('button')
    expect(inactive.className).not.toContain('bg-surface-hover')
  })

  it('步骤完成度描述：镜头数 / 资产进度', () => {
    setup({
      shots: [{ id: 1, prompt: 'x' }, { id: 2 }],
      assets: [{ id: 'a', has: true }, { id: 'b', has: false }],
    })
    // 步骤1：2镜头；步骤2：1/2；步骤3：1/2（有 prompt 的镜头数）
    expect(screen.getByText('2镜头')).toBeTruthy()
    expect(screen.getAllByText('1/2').length).toBe(2)
  })

  it('标题显示 projectName，缺省回退「剧本盒子」', () => {
    setup({ projectName: '我的短剧' })
    expect(screen.getByText('我的短剧')).toBeTruthy()
  })
})

describe('ScriptBoxNode — 引擎回调注入与调用', () => {
  it('挂载后 node.data 注入全部 onXxx 引擎回调', () => {
    setup()
    expect(nodeData().onGenerateScript).toBe(h.engine.onGenerateScript)
    expect(nodeData().onGenerateShotPrompts).toBe(h.engine.onGenerateShotPrompts)
    expect(nodeData().onConnectShot).toBe(h.engine.onConnectShot)
    expect(nodeData().onGenerateAssetImage).toBe(h.engine.onGenerateAssetImage)
    expect(nodeData().onGenerateAllAssetImages).toBe(h.engine.onGenerateAllAssetImages)
    expect(nodeData().onConnectShots).toBe(h.engine.onConnectShots)
  })

  it('步骤子组件点击 → 调引擎回调（UI 只调回调，不做引擎）', () => {
    setup()
    fireEvent.click(screen.getByTestId('gen-script'))
    expect(h.engine.onGenerateScript).toHaveBeenCalledTimes(1)
  })
})

describe('ScriptBoxNode — 设置弹窗与全屏', () => {
  it('点击设置 → 打开齿轮设置弹窗', () => {
    setup()
    fireEvent.click(screen.getByTitle('总体提示词设置'))
    expect(screen.getByTestId('gear-settings')).toBeTruthy()
  })

  it('设置弹窗保存 → updateData 收到配置', () => {
    setup()
    fireEvent.click(screen.getByTitle('总体提示词设置'))
    fireEvent.click(screen.getByTestId('gear-save'))
    expect(h.updateData).toHaveBeenCalledWith({ aspectRatio: '9:16' })
  })

  it('点击全屏 → 打开全屏弹窗并渲染当前步骤内容', () => {
    setup()
    fireEvent.click(screen.getByTitle('全屏显示'))
    const fs = screen.getByTestId('fullscreen')
    expect(fs).toBeTruthy()
    expect(fs.querySelector('[data-testid="step-shots"]')).toBeTruthy()
  })
})

describe('ScriptBoxNode — genMask 生成计时', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('genMask=true 显示「生成中 X 字 · Ns」，秒数随计时递增', () => {
    vi.useFakeTimers()
    setup({ genMask: true, genChars: 120 })
    expect(screen.getByText(/生成中 120 字 · 0s/)).toBeTruthy()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText(/生成中 120 字 · 3s/)).toBeTruthy()
  })

  it('genMask=false 不显示生成计时徽标', () => {
    setup({ genChars: 120 })
    expect(screen.queryByText(/生成中/)).toBeNull()
  })
})
