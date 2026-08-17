// @vitest-environment jsdom
/**
 * ScriptBoxNode 单测（批 4）。
 * 依赖多：useScriptBoxData / useScriptBoxEngine / useReactFlow / NodeShell /
 * FullscreenModal / scriptbox/* 子组件 / hooks(useOutsideClick,useNodeResize)。
 * 用 vi.mock 把上述依赖替换成最小 stub，只验证「挂载不崩 + 三步导航可切换 + 标题透传」。
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── 依赖 mock ──
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ getNodes: () => [], setNodes: vi.fn() }),
}))

const updateData = vi.fn()
vi.mock('../../src/components/base/useScriptBoxData.js', () => ({
  useScriptBoxData: () => ({ updateData }),
}))

vi.mock('../../src/components/base/useScriptBoxEngine.js', () => ({
  useScriptBoxEngine: () => {},
}))

vi.mock('../../src/components/base/hooks.js', () => ({
  useOutsideClick: () => {},
  useNodeResize: () => ({ onMainBoxResize: vi.fn() }),
}))

// NodeShell：暴露 data-testid + label 透传
vi.mock('../../src/components/base/NodeShell.jsx', () => ({
  default: ({ label, defaultTitle, children }) => (
    <div data-testid="shell" data-label={label ?? defaultTitle}>
      {children}
    </div>
  ),
}))

vi.mock('../../src/components/base/FullscreenModal.jsx', () => ({
  default: ({ open, children }) => (open ? <div data-testid="fullscreen">{children}</div> : null),
}))

// scriptbox 子组件：占位，仅渲染当前步标识便于断言
vi.mock('../../src/components/scriptbox/StepShots.jsx', () => ({ default: () => <div data-testid="step-shots" /> }))
vi.mock('../../src/components/scriptbox/StepAssets.jsx', () => ({ default: () => <div data-testid="step-assets" /> }))
vi.mock('../../src/components/scriptbox/StepPrompt.jsx', () => ({ default: () => <div data-testid="step-prompt" /> }))
vi.mock('../../src/components/scriptbox/GearSettings.jsx', () => ({ default: () => <div data-testid="gear" /> }))

import ScriptBoxNode from '../../src/components/ScriptBoxNode.jsx'

const baseProps = { id: 'sb1', data: { label: '我的剧本', projectName: '项目A' }, selected: false }

describe('ScriptBoxNode', () => {
  it('挂载不崩，渲染 NodeShell 且透传标题', () => {
    render(<ScriptBoxNode {...baseProps} />)
    const shell = screen.getByTestId('shell')
    expect(shell).toBeTruthy()
    expect(shell.getAttribute('data-label')).toBe('我的剧本')
  })

  it('默认显示三步导航且第 1 步高亮', () => {
    render(<ScriptBoxNode {...baseProps} />)
    expect(screen.getByText('确认镜头')).toBeTruthy()
    expect(screen.getByText('准备资产')).toBeTruthy()
    expect(screen.getByText('合成提示词')).toBeTruthy()
    expect(screen.getByTestId('step-shots')).toBeTruthy()
  })

  it('点击第 2 步写回 data.step=2（数据由宿主经 node.data 落回）', () => {
    render(<ScriptBoxNode {...baseProps} />)
    fireEvent.click(screen.getByText('准备资产'))
    expect(updateData).toHaveBeenCalledWith({ step: 2 })
  })

  it('点击第 3 步写回 data.step=3', () => {
    render(<ScriptBoxNode {...baseProps} />)
    fireEvent.click(screen.getByText('合成提示词'))
    expect(updateData).toHaveBeenCalledWith({ step: 3 })
  })

  it('生成中（genMask）显示生成计时遮罩', () => {
    render(<ScriptBoxNode {...baseProps} data={{ ...baseProps.data, genMask: true, genChars: 10 }} />)
    expect(screen.getByText(/生成中/)).toBeTruthy()
  })

  it('打开齿轮设置弹窗', () => {
    render(<ScriptBoxNode {...baseProps} />)
    const settingsBtn = screen.getByTitle('总体提示词设置')
    fireEvent.click(settingsBtn)
    expect(screen.getByTestId('gear')).toBeTruthy()
  })

  it('打开全屏弹层', () => {
    render(<ScriptBoxNode {...baseProps} />)
    const fullBtn = screen.getByTitle('全屏显示')
    fireEvent.click(fullBtn)
    expect(screen.getByTestId('fullscreen')).toBeTruthy()
  })
})
