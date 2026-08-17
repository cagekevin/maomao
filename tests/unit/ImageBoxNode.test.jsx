// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/CustomHandle.jsx', () => ({ default: mocks.CustomHandle }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/LazyImage.jsx', () => ({ default: mocks.LazyImage }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastError: mocks.toastError, toastWarning: mocks.toastWarning }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl }))

import ImageBoxNode from '../../src/components/ImageBoxNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<ImageBoxNode id="ib1" data={{}} selected={false} {...props} />)

describe('ImageBoxNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
})
