/**
 * TemplateNode 上游合并测试（本次修复核心逻辑）。
 * 覆盖：上游文本/图片节点连线后文字与图片合并进生图请求；
 * 多上游节点合并；上游有文本但本地 prompt 为空时校验通过。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockSetNodes = vi.fn()
const mockGetNodes = vi.fn(() => [])
const mockAddNodes = vi.fn()
let genConfig = null

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ setNodes: mockSetNodes, setEdges: vi.fn(), getEdges: vi.fn(() => []), getNodes: mockGetNodes, addNodes: mockAddNodes }),
  useStore: vi.fn(() => () => {}),
}))

vi.mock('../../src/hooks/useNodeGeneration.ts', () => ({
  useNodeGeneration: (config) => {
    genConfig = config
    return {
      loading: false,
      error: null,
      stop: vi.fn(),
      start: vi.fn(async () => {
        const r = await config.run?.({ progress: () => {}, signal: { aborted: false } })
        config.onSuccess?.(r)
        return r
      }),
    }
  },
}))

vi.mock('../../src/components/base/ModelSelect.tsx', () => ({ default: ({ value, onChange }) => <button type="button" data-testid="model-select" onClick={() => onChange('model-x')}>{value || '选择模型'}</button> }))
vi.mock('../../src/components/base/GenerateButton.tsx', () => ({ default: ({ onGenerate }) => <button type="button" onClick={onGenerate}>生成</button> }))
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/ExpandablePanel.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/MaterialStrip.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptInput.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ResizeFullscreenHandle.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/FullscreenModal.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/GeneratingOverlay.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptLibraryButton.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/hooks.ts', async (importOriginal) => ({ ...(await importOriginal()), useNodeResize: () => ({ onInputResize: vi.fn() }), useOutsideClick: () => {} }))

let connectedInputs = { images: [], texts: [] }
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: () => connectedInputs }))

vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: () => ({ isHidden: () => false }) }))
vi.mock('../../src/components/base/nodePrefs.ts', () => ({ useNodePrefs: () => ({ prefs: {}, set: vi.fn() }) }))
vi.mock('../../src/hooks/useSyncNodeData.ts', () => ({ useSyncNodeData: () => {} }))
vi.mock('../../src/components/base/filesApi.ts', () => ({ toAbsoluteFileUrl: (x) => x, saveResultToTasks: vi.fn(async () => undefined) }))
vi.mock('../../src/components/base/settings/providerStore.ts', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/components/base/localToolApi.ts', () => ({ fetchTasks: vi.fn(async () => ({ items: [] })) }))
const mockGenerateImage = vi.fn(async () => ({ url: 'http://gen.local/img.png' }))
vi.mock('../../src/components/base/imageApi.ts', () => ({ generateImage: (...a) => mockGenerateImage(...a) }))
vi.mock('../../src/components/base/providerModels.ts', () => ({ buildAllModels: vi.fn(() => []), resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })) }))

beforeEach(() => {
  mockSetNodes.mockClear()
  mockGetNodes.mockReset()
  mockGetNodes.mockReturnValue([])
  mockAddNodes.mockClear()
  mockGenerateImage.mockReset()
  mockGenerateImage.mockResolvedValue({ url: 'http://gen.local/img.png' })
  genConfig = null
  connectedInputs = { images: [], texts: [] }
})

import TemplateNode from '../../src/components/nodes/TemplateNode.jsx'

function setup(data = {}) {
  return render(<TemplateNode id="n1" data={data} selected={false} />)
}

describe('TemplateNode 上游文本/图片合并（修复点）', () => {
  it('上游文本节点连入时，文字合并进生图 prompt', async () => {
    connectedInputs = { images: [], texts: [{ id: 't1', text: '国潮风格模板', sourceNodeId: 's1' }] }
    setup({ prompt: '海报' })
    fireEvent.click(screen.getByText('生成'))

    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled())
    const call = mockGenerateImage.mock.calls[0][0]
    expect(call.prompt).toContain('海报')
    expect(call.prompt).toContain('国潮风格模板')
  })

  it('上游有文本但本地 prompt 为空时，校验通过', async () => {
    connectedInputs = { images: [], texts: [{ id: 't1', text: '电商主图', sourceNodeId: 's1' }] }
    setup({ prompt: '' })
    expect(genConfig.validate()).toBe('')
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled())
    expect(mockGenerateImage.mock.calls[0][0].prompt).toContain('电商主图')
  })

  it('多个上游文本节点合并', async () => {
    connectedInputs = {
      images: [],
      texts: [
        { id: 't1', text: '标题文案', sourceNodeId: 's1' },
        { id: 't2', text: '副标题', sourceNodeId: 's2' },
      ],
    }
    setup({ prompt: '模板' })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled())
    const p = mockGenerateImage.mock.calls[0][0].prompt
    expect(p).toContain('模板')
    expect(p).toContain('标题文案')
    expect(p).toContain('副标题')
  })

  it('多个上游图片节点合并进 refImages', async () => {
    connectedInputs = {
      images: [
        { id: 'i1', url: 'http://up/a.png', sourceNodeId: 's1' },
        { id: 'i2', url: 'http://up/b.png', sourceNodeId: 's2' },
      ],
      texts: [{ id: 't1', text: '融合两张图', sourceNodeId: 's3' }],
    }
    setup({ prompt: '合成' })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled())
    const call = mockGenerateImage.mock.calls[0][0]
    expect(call.prompt).toContain('融合两张图')
    expect(call.refImages).toHaveLength(2)
    expect(call.refImages.map((r) => r.url)).toEqual(['http://up/a.png', 'http://up/b.png'])
  })

  it('本地与上游皆为空时，提示请输入提示词', () => {
    connectedInputs = { images: [], texts: [] }
    setup({ prompt: '' })
    expect(genConfig.validate()).toBe('请输入提示词')
  })
})
