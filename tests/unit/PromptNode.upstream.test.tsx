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

vi.mock('../../src/components/base/ui/ModelSelect.tsx', () => ({
  default: ({ value, onChange }) => (
    <button type="button" data-testid="model-select" onClick={() => onChange('model-x')}>
      {value || '选择模型'}
    </button>
  ),
}))
vi.mock('../../src/components/base/ui/GenerateButton.tsx', () => ({ default: ({ onGenerate }) => <button type="button" onClick={onGenerate}>生成</button> }))
vi.mock('../../src/components/base/ui/NodeShell.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/ui/ExpandablePanel.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/panels/MaterialStrip.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/panels/HoverToolbar.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/prompt/PromptInput.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ui/ResizeFullscreenHandle.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/panels/FullscreenModal.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ui/GeneratingOverlay.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/prompt/PromptLibraryButton.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ui/JianyingIcon.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/core/uiHooks.ts', () => ({ useNodeResize: () => ({ onInputResize: vi.fn() }), useOutsideClick: () => {} }))

// ---- 可控的 useConnectedInputs：测试内动态覆盖其返回值 ----
let connectedInputs = {}
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: () => connectedInputs }))

vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: () => ({ isHidden: () => false }) }))
vi.mock('../../src/components/base/canvas/nodePrefs.ts', () => ({ useNodePrefs: () => ({ prefs: {}, set: vi.fn() }) }))
vi.mock('../../src/hooks/useSyncNodeData.ts', () => ({ useSyncNodeData: () => {} }))
vi.mock('../../src/components/base/api/filesApi.ts', () => ({ toAbsoluteFileUrl: (x) => x, saveResultToTasks: vi.fn(async () => undefined) }))
vi.mock('../../src/components/base/store/providerStore.ts', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({ fetchTasks: vi.fn(async () => ({ items: [] })) }))
// 显式声明参数元组：vi.fn(async () => …) 会把参数推断成空元组 []，
// 导致后续 mock.calls[0][0] 报 TS2493、mockGenerateImage(...a) 报 TS2556。
const mockGenerateImage = vi.fn(async (..._args: unknown[]) => ({ url: 'http://gen.local/img.png' }))
vi.mock('../../src/components/base/api/imageApi.ts', () => ({ generateImage: (...a) => mockGenerateImage(...a) }))
vi.mock('../../src/components/base/utils/providerModels.ts', () => ({ buildAllModels: vi.fn(() => []), resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })) }))

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
    // stub 只实现被测用到的 3 个方法，缺 root/thresholds/takeRecords 等成员 → cast 收尾
    global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver
  }
})

import PromptNode from '../../src/components/nodes/PromptNode.tsx'

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
    const call = mockGenerateImage.mock.calls[0][0] as unknown as { prompt: string; images?: unknown }
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
    expect((mockGenerateImage.mock.calls[0][0] as unknown as { prompt: string }).prompt).toContain('红色跑车')
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
    const p = (mockGenerateImage.mock.calls[0][0] as unknown as { prompt: string }).prompt
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
    const call = mockGenerateImage.mock.calls[0][0] as unknown as { prompt: string; images?: unknown }
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
