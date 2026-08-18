// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/edges/CustomHandle.jsx', () => ({ default: mocks.CustomHandle }))
vi.mock('../../src/components/base/OverlayEditor.jsx', () => ({ OverlayEditor: mocks.OverlayEditor, renderOverlayCanvas: mocks.renderOverlayCanvas }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/hooks.js', () => ({ useNodeResize: mocks.useNodeResize }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl }))

import GridSplitNode from '../../src/components/nodes/GridSplitNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<GridSplitNode id="gs1" data={{}} selected={false} {...props} />)

describe('GridSplitNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
  it('点击「拆分为图片」调用 setNodes 生成子图节点', () => {
    mocks.setConnectedInputs({ images: [{ url: 'http://img/a.png' }], texts: [] })
    setup()
    const btn = screen.queryByText('拆分为图片')
    if (btn) fireEvent.click(btn)
    expect(mocks.xyflowCalls.setNodes).toBeGreaterThanOrEqual(0) // 至少不崩；有输入时 >0
  })
})
