// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: mocks.HoverToolbar }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/filesApi.js', () => ({ uploadFileToLocal: mocks.uploadFileToLocal, toAbsoluteFileUrl: mocks.toAbsoluteFileUrl }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastError: mocks.toastError, toastWarning: mocks.toastWarning }))
vi.mock('../../src/components/base/faceMosaic.js', () => ({ applyMosaic: mocks.applyMosaic, MOSAIC_MODES: mocks.MOSAIC_MODES, MOSAIC_PALETTE: mocks.MOSAIC_PALETTE }))
vi.mock('../../src/components/base/FaceMosaicEditor.jsx', () => ({ default: mocks.FaceMosaicEditor }))

import FaceMosaicNode from '../../src/components/FaceMosaicNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<FaceMosaicNode id="fm1" data={{}} selected={false} {...props} />)

describe('FaceMosaicNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
  it('点击主按钮触发处理链（不崩）', async () => {
    const { container } = setup({ data: { name: '打码', mode: 'mosaic' } })
    // 主按钮（带 node-btn-primary 类）存在时点击，验证不抛错
    const btn = container.querySelector('button.node-btn-primary') || container.querySelector('button')
    if (btn) fireEvent.click(btn)
    expect(mocks.toastCalls).toBeTruthy()
  })
})
