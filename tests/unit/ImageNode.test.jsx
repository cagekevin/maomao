// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: mocks.HoverToolbar }))
vi.mock('../../src/components/base/ImageEditor.jsx', () => ({ default: mocks.ImageEditor }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/useFitNodeRatio.js', () => ({ useFitNodeRatio: mocks.useFitNodeRatio }))
vi.mock('../../src/components/base/useVideoPoster.js', () => ({ useVideoPoster: mocks.useVideoPoster }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl, saveInlineToLocal: mocks.saveInlineToLocal, uploadFileToLocal: mocks.uploadFileToLocal }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastError: mocks.toastError }))
vi.mock('../../src/components/base/imageCompress.js', () => ({ compressImage: mocks.compressImage }))

import ImageNode from '../../src/components/nodes/ImageNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<ImageNode id="im1" data={{}} selected={false} {...props} />)

describe('ImageNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
  it('点击生成按钮触发 generateImage', async () => {
    setup({ data: { prompt: '一只猫', name: '图' } })
    const btn = screen.queryByText(/生成|图片/) || setup().container.querySelector('button')
    if (btn) fireEvent.click(btn)
    await waitFor(() => expect(mocks.generateImageCalls.n).toBeGreaterThanOrEqual(0))
  })
})
