/**
 * PromptNode 上游合并测试（本次修复核心逻辑）。
 * 覆盖：上游文本节点/图片节点连线后，文字与图片合并进生图请求；
 * 本地 prompt 与上游文本结合；多上游节点合并；上游有内容时校验通过。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ---- 共享 ReactFlow mock ----
const mockSetNodes = vi.fn()
const mockGetNodes = vi.fn(() => [])
const mockAddNodes = vi.fn()
let genConfig = null

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: mockSetNodes,
    setEdges: vi.fn(),
    getEdges: vi.fn(() => []),
    getNodes: mockGetNodes,
    addNodes: mockAddNodes,
  }),
  useStore: vi.fn(() => () => {}),
}))

vi.mock('../../src/components/base/useNodeGeneration.js', () => ({
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

vi.mock('../../src/components/base/ModelSelect.jsx', () => ({
  default: ({ value, onChange }) => (
    <button type="button" data-testid="model-select" onClick={() => onChange('model-x')}>
      {value || '选择模型'}
    </button>
  ),
}))
vi.mock('../../src/components/base/GenerateButton.jsx', () => ({ default: ({ onGenerate }) => <button type="button" onClick={onGenerate}>生成</button> }))
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/ExpandablePanel.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/MaterialStrip.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptInput.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ResizeFullscreenHandle.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/FullscreenModal.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/GeneratingOverlay.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptLibraryButton.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/JianyingIcon.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/hooks.js', () => ({ useNodeResize: () => ({ onInputResize: vi.fn() }), useOutsideClick: () => {} }))

// ---- 可控的 useConnectedInputs：测试内动态覆盖其返回值 ----
let connectedInputs = {}
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: () => connectedInputs }))

vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: () => ({ isHidden: () => false }) }))
vi.mock('../../src/components/base/nodePrefs.js', () => ({ useNodePrefs: () => ({ prefs: {}, set: vi.fn() }) }))
vi.mock('../../src/components/base/useSyncNodeData.js', () => ({ useSyncNodeData: () => {} }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: (x) => x, saveResultToTasks: vi.fn(async () => undefined) }))
vi.mock('../../src/components/base/settings/providerStore.js', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/components/base/localToolApi.js', () => ({ fetchTasks: vi.fn(async () => ({ items: [] })) }))
const mockGenerateImage = vi.fn(async () => ({ url: 'http://gen.local/img.png' }))
vi.mock('../../src/components/base/imageApi.js', () => ({ generateImage: (...a) => mockGenerateImage(...a) }))
vi.mock('../../src/components/base/providerModels.js', () => ({ buildAllModels: vi.fn(() => []), resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })) }))

beforeEach(() => {
  mockSetNodes.mockClear()
  mockGetNodes.mockReset()
  mockGetNodes.mockReturnValue([])
  mockAddNodes.mockClear()
  mockGenerateImage.mockReset()
  mockGenerateImage.mockResolvedValue({ url: 'http://gen.local/img.png' })
  genConfig = null
  connectedInputs = {}
  if (!global.IntersectionObserver) {
    global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
  }
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
  global.cancelAnimationFrame = (id) => clearTimeout(id)
})

import PromptNode from '../../src/components/nodes/PromptNode.jsx'

function setup(data = {}) {
  return render(<PromptNode id="n1" data={data} selected={false} />)
}

describe('PromptNode 上游文本/图片合并（修复点）', () => {
  it('上游文本节点连入时，文字合并进生图 prompt（本地 prompt + 上游文本）', async () => {
    connectedInputs = {
      images: [],
      texts: [{ id: 't1', text: '一只戴帽子的猫', sourceNodeId: 'srcText' }],
    }
    setup({ prompt: ' studio ghibli 风格' })
    fireEvent.click(screen.getByText('生成'))

    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled())
    const call = mockGenerateImage.mock.calls[0][0]
    expect(call.prompt).toContain('studio ghibli 风格')
    expect(call.prompt).toContain('一只戴帽子的猫')
  })

  it('上游有文本但本地 prompt 为空时，校验通过（不再提示请输入提示词）', async () => {
    connectedInputs = { images: [], texts: [{ id: 't1', text: '红色跑车', sourceNodeId: 'srcText' }] }
    setup({ prompt: '' })
    // 触发 validate：start 内部先调用 config.validate
    fireEvent.click(screen.getByText('生成'))
    expect(genConfig.validate()).toBe('') // 空串 = 通过
    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled())
    expect(mockGenerateImage.mock.calls[0][0].prompt).toContain('红色跑车')
  })

  it('多个上游文本节点合并（全部拼入）', async () => {
    connectedInputs = {
      images: [],
      texts: [
        { id: 't1', text: '白天', sourceNodeId: 's1' },
        { id: 't2', text: '雪山', sourceNodeId: 's2' },
        { id: 't3', text: '湖泊', sourceNodeId: 's3' },
      ],
    }
    setup({ prompt: '风景照' })
    fireEvent.click(screen.getByText('生成'))

    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled())
    const p = mockGenerateImage.mock.calls[0][0].prompt
    expect(p).toContain('风景照')
    expect(p).toContain('白天')
    expect(p).toContain('雪山')
    expect(p).toContain('湖泊')
  })

  it('多个上游图片节点合并进 refImages（图生图参考图）', async () => {
    connectedInputs = {
      images: [
        { id: 'i1', url: 'http://up/a.png', sourceNodeId: 's1' },
        { id: 'i2', url: 'http://up/b.png', sourceNodeId: 's2' },
      ],
      texts: [{ id: 't1', text: '转成水墨', sourceNodeId: 's3' }],
    }
    setup({ prompt: '风格化' })
    fireEvent.click(screen.getByText('生成'))

    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled())
    const call = mockGenerateImage.mock.calls[0][0]
    expect(call.prompt).toContain('转成水墨')
    // 注意 PromptNode 把 refImages 转成 url 数组后以 images 字段传下（图生图参考图）
    expect(call.images).toEqual(['http://up/a.png', 'http://up/b.png'])
  })

  it('本地 prompt 与上游文本皆为空时，仍提示请输入提示词', () => {
    connectedInputs = { images: [], texts: [] }
    setup({ prompt: '' })
    expect(genConfig.validate()).toBe('请输入提示词')
  })
})
