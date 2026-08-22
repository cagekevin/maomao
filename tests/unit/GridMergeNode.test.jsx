/**
 * GridMergeNode 深度测试。
 * 审计建议 P1：多图输入、切图逻辑、参数变更重渲染。
 * 覆盖三种拼接模式切换、网格预设/自定义、多图输入填充格子、无图校验禁用。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/edges/CustomHandle.jsx', () => ({ default: mocks.CustomHandle }))
vi.mock('../../src/components/base/OverlayEditor.jsx', () => ({ default: mocks.OverlayEditor, renderOverlayCanvas: mocks.renderOverlayCanvas }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/hooks.js', () => ({ useNodeResize: mocks.useNodeResize, useContentHeightSync: mocks.useContentHeightSync }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl }))

import GridMergeNode from '../../src/components/nodes/GridMergeNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<GridMergeNode id="gm1" data={{}} selected={false} {...props} />)

describe('GridMergeNode — 模式切换', () => {
  it('默认网格：显示三种模式按钮 + 网格预设', () => {
    setup()
    expect(screen.getByText('网格')).toBeTruthy()
    expect(screen.getByText('长图')).toBeTruthy()
    expect(screen.getByText('叠加')).toBeTruthy()
    expect(screen.getByText('2×2')).toBeTruthy()
    expect(screen.getByText('3×3')).toBeTruthy()
  })

  it('切到长图 → 显示方向/跟随首图/间距', () => {
    setup()
    fireEvent.click(screen.getByText('长图'))
    expect(screen.getByText('垂直')).toBeTruthy()
    expect(screen.getByText('水平')).toBeTruthy()
    expect(screen.getByText('跟随首图')).toBeTruthy()
    expect(screen.getByText('间距')).toBeTruthy()
    // 网格具体预设消失
    expect(screen.queryByText('4列')).toBeNull()
  })

  it('切到叠加 → 网格预设消失、开始合成仍在', () => {
    setup()
    fireEvent.click(screen.getByText('叠加'))
    expect(screen.queryByText('3×3')).toBeNull()
    expect(screen.getByText('开始合成')).toBeTruthy()
  })
})

describe('GridMergeNode — 多图输入与校验', () => {
  it('无上游图 → grid 模式「开始合成」禁用', () => {
    setup()
    const btn = screen.getByText('开始合成').closest('button')
    expect(btn).toBeTruthy()
    expect(btn.disabled).toBe(true)
  })

  it('多图输入 → 预览网格生成带角标的格子', async () => {
    mocks.setConnectedInputs({
      images: [
        { id: 'a', url: 'http://img/a.png' },
        { id: 'b', url: 'http://img/b.png' },
      ],
      texts: [],
    })
    setup()
    // 默认 3×3=9 格，前两格被图片填充，显示角标 1、2
    expect(await screen.findByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('多图输入 → 开始合成由禁用变为可用', () => {
    mocks.setConnectedInputs({ images: [{ id: 'a', url: 'http://img/a.png' }], texts: [] })
    setup()
    const btn = screen.getByText('开始合成').closest('button')
    expect(btn.disabled).toBe(false)
  })
})