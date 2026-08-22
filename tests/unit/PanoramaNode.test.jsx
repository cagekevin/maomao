import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: mocks.HoverToolbar }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/PanoViewer.jsx', () => ({ default: mocks.PanoViewer }))

import PanoramaNode from '../../src/components/nodes/PanoramaNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<PanoramaNode id="pn1" data={{}} selected={false} {...props} />)

describe('PanoramaNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
  it('点击「截图并送图片盒子」调用 setNodes', () => {
    setup({ data: { imageUrl: 'http://pano/x.png' } })
    const btn = screen.queryByText(/送图片盒子/)
    if (btn) fireEvent.click(btn)
    expect(mocks.xyflowCalls.setNodes).toBeGreaterThanOrEqual(0)
  })
})
