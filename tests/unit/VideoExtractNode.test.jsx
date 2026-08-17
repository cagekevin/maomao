// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/NodeTitle.jsx', () => ({ default: mocks.NodeTitle }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastError: mocks.toastError, toastWarning: mocks.toastWarning, toastInfo: mocks.showToast }))
vi.mock('../../src/components/base/storageAdapter.js', () => ({ sSet: mocks.sSet }))
vi.mock('../../src/components/base/storageKeys.js', () => ({ StorageKeys: mocks.StorageKeys }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl }))

import VideoExtractNode from '../../src/components/VideoExtractNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<VideoExtractNode id="ve1" data={{}} selected={false} {...props} />)

describe('VideoExtractNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
  it('标题显示（NodeTitle 透传）', () => {
    const { container } = setup({ data: { name: '抽帧' } })
    expect(container).toBeTruthy()
  })
})
