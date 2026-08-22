import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: mocks.HoverToolbar }))
vi.mock('../../src/components/base/ExpandablePanel.jsx', () => ({ default: mocks.ExpandablePanel }))
vi.mock('../../src/components/base/GenerateButton.jsx', () => ({ default: mocks.GenerateButton }))
vi.mock('../../src/components/base/ModelSelect.jsx', () => ({ default: mocks.ModelSelect }))
vi.mock('../../src/components/base/PromptInput.jsx', () => ({ default: mocks.PromptInput }))
vi.mock('../../src/components/base/MaterialStrip.jsx', () => ({ default: mocks.MaterialStrip }))
vi.mock('../../src/components/base/ResizeFullscreenHandle.jsx', () => ({ default: mocks.ResizeFullscreenHandle }))
vi.mock('../../src/components/base/FullscreenModal.jsx', () => ({ default: mocks.FullscreenModal }))
vi.mock('../../src/components/base/GeneratingOverlay.jsx', () => ({ default: mocks.GeneratingOverlay }))
vi.mock('../../src/components/base/PromptLibraryButton.jsx', () => ({ default: mocks.PromptLibraryButton }))
vi.mock('../../src/components/base/hooks.js', () => ({ useNodeResize: mocks.useNodeResize, useOutsideClick: mocks.useOutsideClick }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/useNodeGeneration.js', () => ({ useNodeGeneration: mocks.useNodeGeneration }))
vi.mock('../../src/components/base/nodePrefs.js', () => ({ useNodePrefs: mocks.useNodePrefs }))
vi.mock('../../src/components/base/useSyncNodeData.js', () => ({ useSyncNodeData: mocks.useSyncNodeData }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastWarning: mocks.toastWarning, toastError: mocks.toastError }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl, saveResultToTasks: mocks.saveResultToTasks, saveTextToTasks: mocks.saveTextToTasks }))
vi.mock('../../src/components/base/settings/providerStore.js', () => ({ useProviders: mocks.useProviders, load: mocks.loadProviders }))
vi.mock('../../src/components/base/providerModels.js', () => ({ buildAllModels: mocks.buildAllModels, resolveProviderModel: mocks.resolveProviderModel }))
vi.mock('../../src/components/base/chatApi.js', () => ({ chatCompletions: mocks.chatCompletions }))

import TextNode from '../../src/components/nodes/TextNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<TextNode id="txt1" data={{}} selected={false} {...props} />)

describe('TextNode', () => {
  it('挂载不崩', () => { expect(setup().container).toBeTruthy() })
  it('点击「生成」调用 chatCompletions', async () => {
    setup({ data: { prompt: '写一句诗', name: '文案' } })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mocks.chatCompletionsCalls.n).toBeGreaterThan(0))
  })
})
