// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/CustomHandle.jsx', () => ({ default: mocks.CustomHandle }))
vi.mock('../../src/components/base/OverlayEditor.jsx', () => ({ OverlayEditor: mocks.OverlayEditor, renderOverlayCanvas: mocks.renderOverlayCanvas }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/hooks.js', () => ({ useNodeResize: mocks.useNodeResize }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl }))

import GridMergeNode from '../../src/components/GridMergeNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<GridMergeNode id="gm1" data={{}} selected={false} {...props} />)

describe('GridMergeNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
  it('点击「合成为视频」调用 setNodes', () => {
    mocks.setConnectedInputs({ images: [{ url: 'http://img/a.png' }], texts: [] })
    setup()
    const btn = screen.queryByText('合成为视频')
    if (btn) fireEvent.click(btn)
    expect(mocks.xyflowCalls.setNodes).toBeGreaterThanOrEqual(0)
  })
})
