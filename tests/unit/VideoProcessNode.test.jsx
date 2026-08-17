// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/CustomHandle.jsx', () => ({ default: mocks.CustomHandle }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/hooks.js', () => ({ useNodeResize: mocks.useNodeResize, useOutsideClick: mocks.useOutsideClick }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastError: mocks.toastError, toastWarning: mocks.toastWarning }))
vi.mock('../../src/components/base/eventBus.js', () => ({ publish: mocks.publish }))
vi.mock('../../src/components/base/asyncGuard.js', () => ({ withTimeout: mocks.withTimeout, isTimeoutError: mocks.isTimeoutError }))
vi.mock('../../src/components/base/videoEngine.js', () => ({ readVideoMetadata: mocks.readVideoMetadata, processVideo: mocks.processVideo, concatVideos: mocks.concatVideos, videoToGif: mocks.videoToGif, formatBytes: mocks.formatBytes, uploadResult: mocks.uploadResult, ProgressController: mocks.ProgressController, ConversionCanceled: mocks.ConversionCanceled }))

import VideoProcessNode from '../../src/components/VideoProcessNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<VideoProcessNode id="vp1" data={{}} selected={false} {...props} />)

describe('VideoProcessNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
  it('挂载后根节点带 data-node-id', () => {
    const { container } = setup({ data: { name: '视频处理' } })
    expect(container.querySelector('[data-node-id="vp1"]')).toBeTruthy()
  })
})
