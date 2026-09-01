// @ts-nocheck
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.tsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/base/HoverToolbar.tsx', () => ({ default: mocks.HoverToolbar }))
vi.mock('../../src/components/base/ExpandablePanel.tsx', () => ({ default: mocks.ExpandablePanel }))
vi.mock('../../src/components/base/GenerateButton.tsx', () => ({ default: mocks.GenerateButton }))
vi.mock('../../src/components/base/ModelSelect.tsx', () => ({ default: mocks.ModelSelect }))
vi.mock('../../src/components/base/PromptInput.tsx', () => ({ default: mocks.PromptInput }))
vi.mock('../../src/components/base/MaterialStrip.tsx', () => ({ default: mocks.MaterialStrip }))
vi.mock('../../src/components/base/ResizeFullscreenHandle.tsx', () => ({ default: mocks.ResizeFullscreenHandle }))
vi.mock('../../src/components/base/FullscreenModal.tsx', () => ({ default: mocks.FullscreenModal }))
vi.mock('../../src/components/base/GeneratingOverlay.tsx', () => ({ default: mocks.GeneratingOverlay }))
vi.mock('../../src/components/base/PromptLibraryButton.tsx', () => ({ default: mocks.PromptLibraryButton }))
vi.mock('../../src/components/base/hooks.ts', () => ({ useNodeResize: mocks.useNodeResize, useOutsideClick: mocks.useOutsideClick }))
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/hooks/useNodeGeneration.ts', () => ({ useNodeGeneration: mocks.useNodeGeneration }))
vi.mock('../../src/components/base/nodePrefs.ts', () => ({ useNodePrefs: mocks.useNodePrefs }))
vi.mock('../../src/hooks/useSyncNodeData.ts', () => ({ useSyncNodeData: mocks.useSyncNodeData }))
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: mocks.showToast, toastWarning: mocks.toastWarning, toastError: mocks.toastError }))
vi.mock('../../src/components/base/api/filesApi.ts', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl, saveResultToTasks: mocks.saveResultToTasks, saveTextToTasks: mocks.saveTextToTasks }))
vi.mock('../../src/components/base/settings/providerStore.ts', () => ({ useProviders: mocks.useProviders, load: mocks.loadProviders }))
vi.mock('../../src/components/base/providerModels.ts', () => ({ buildAllModels: mocks.buildAllModels, resolveProviderModel: mocks.resolveProviderModel }))
vi.mock('../../src/components/base/api/chatApi.ts', () => ({ chatCompletions: mocks.chatCompletions }))

import TextNode from '../../src/components/nodes/TextNode.tsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<TextNode id="txt1" data={{}} selected={false} {...props} />)

describe('TextNode', () => {
  it('点击「生成」调用 chatCompletions', async () => {
    setup({ data: { prompt: '写一句诗', name: '文案' } })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mocks.chatCompletionsCalls.n).toBeGreaterThan(0))
  })
})
