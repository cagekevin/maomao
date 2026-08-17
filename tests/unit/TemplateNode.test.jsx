// @vitest-environment jsdom
/**
 * TemplateNode 单测（阶段五）。
 * 复用共享 mock kit（tests/unit/_nodeMocks.mjs）。
 * 覆盖：渲染不崩、label 透传、点击「生成」触发生成链路（generateImage 被调用）。
 */
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
vi.mock('../../src/components/base/hooks.js', () => ({ useNodeResize: mocks.useNodeResize, useOutsideClick: mocks.useOutsideClick }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/useNodeGeneration.js', () => ({ useNodeGeneration: mocks.useNodeGeneration }))
vi.mock('../../src/components/base/nodePrefs.js', () => ({ useNodePrefs: mocks.useNodePrefs }))
vi.mock('../../src/components/base/useSyncNodeData.js', () => ({ useSyncNodeData: mocks.useSyncNodeData }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastWarning: mocks.toastWarning, toastError: mocks.toastError }))
vi.mock('../../src/components/base/imageApi.js', () => ({ generateImage: mocks.generateImage }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl, saveResultToTasks: mocks.saveResultToTasks }))
vi.mock('../../src/components/base/settings/providerStore.js', () => ({ useProviders: mocks.useProviders, load: mocks.loadProviders }))
vi.mock('../../src/components/base/providerModels.js', () => ({ buildAllModels: mocks.buildAllModels, resolveProviderModel: mocks.resolveProviderModel }))

import TemplateNode from '../../src/components/TemplateNode.jsx'

beforeEach(() => { mocks.resetNodeMockState() })

function setup(props = {}) {
  return render(<TemplateNode id="t1" data={{}} selected={false} {...props} />)
}

describe('TemplateNode', () => {
  it('挂载渲染不崩', () => {
    const { container } = setup()
    expect(container).toBeTruthy()
  })

  it('标题显示模板节点默认标签', () => {
    setup({ data: { name: '分镜模板' } })
    expect(screen.getByTestId('shell').getAttribute('data-label')).toBe('模板节点')
  })

  it('点击「生成」触发生成链路（generateImage 被调用）', async () => {
    setup({ data: { prompt: '一只猫', name: '测试' } })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mocks.generateImageCalls.n).toBeGreaterThan(0))
    expect(mocks.generateImageCalls.last).toBeTruthy()
  })
})
