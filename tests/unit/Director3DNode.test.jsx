import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/edges/CustomHandle.jsx', () => ({ default: mocks.CustomHandle }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl, saveInlineToLocal: mocks.saveInlineToLocal }))
vi.mock('../../src/components/director3d/App.tsx', () => ({ Director3DOverlay: mocks.Director3DOverlay }))

import Director3DNode from '../../src/components/nodes/Director3DNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<Director3DNode id="d3d1" data={{}} selected={false} {...props} />)

describe('Director3DNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
})
