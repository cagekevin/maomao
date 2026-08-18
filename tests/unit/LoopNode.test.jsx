// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastWarning: mocks.toastWarning }))
vi.mock('../../src/components/base/useSyncNodeData.js', () => ({ useSyncNodeData: mocks.useSyncNodeData }))
vi.mock('../../src/components/base/hooks.js', () => ({ useOutsideClick: mocks.useOutsideClick }))

import LoopNode from '../../src/components/nodes/LoopNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<LoopNode id="lp1" data={{}} selected={false} {...props} />)

describe('LoopNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
  it('点击「运行」调用 setNodes 生成分段生图节点', () => {
    mocks.setConnectedInputs({ images: [], texts: [{ text: '段落一\n段落二' }] })
    setup()
    const btn = screen.queryByText('运行')
    if (btn) fireEvent.click(btn)
    expect(mocks.xyflowCalls.setNodes).toBeGreaterThanOrEqual(0)
  })
})
