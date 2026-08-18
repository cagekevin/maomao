// @vitest-environment jsdom
/**
 * DiscountVideoNode 上游合并测试（本次修复核心逻辑）。
 * 覆盖：上游文本节点连线后文字合并进生视频 prompt；多上游文本/图片合并；
 * 上游有文本但本地 prompt 为空时校验通过。
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

vi.mock('../../src/components/base/GenerateButton.jsx', () => ({ default: ({ onGenerate }) => <button type="button" onClick={onGenerate}>生成</button> }))
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/ExpandablePanel.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/MaterialStrip.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptInput.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/hooks.js', async (importOriginal) => ({ ...(await importOriginal()), useNodeResize: () => ({ onInputResize: vi.fn() }), useOutsideClick: () => {} }))

// 可控的 useConnectedInputs
let connectedInputs = { images: [], texts: [] }
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: () => connectedInputs }))

vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: () => ({ isHidden: () => false }) }))
vi.mock('../../src/components/base/nodePrefs.js', () => ({ useNodePrefs: () => ({ prefs: {}, set: vi.fn() }) }))
vi.mock('../../src/components/base/useSyncNodeData.js', () => ({ useSyncNodeData: () => {} }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: (x) => x, saveResultToTasks: vi.fn(async () => undefined) }))
vi.mock('../../src/components/base/settings/providerStore.js', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/components/base/localToolApi.js', () => ({ fetchTasks: vi.fn(async () => ({ items: [] })) }))
const mockGenerateVideo = vi.fn(async () => ({ url: 'http://gen.local/v.mp4' }))
vi.mock('../../src/components/base/videoApi.js', () => ({ generateVideo: (...a) => mockGenerateVideo(...a) }))
vi.mock('../../src/components/base/providerModels.js', () => ({ buildAllModels: vi.fn(() => []), resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })) }))

beforeEach(() => {
  mockSetNodes.mockClear()
  mockGetNodes.mockReset()
  mockGetNodes.mockReturnValue([])
  mockAddNodes.mockClear()
  mockGenerateVideo.mockReset()
  mockGenerateVideo.mockResolvedValue({ url: 'http://gen.local/v.mp4' })
  genConfig = null
  connectedInputs = { images: [], texts: [] }
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
  global.cancelAnimationFrame = (id) => clearTimeout(id)
})

import DiscountVideoNode from '../../src/components/nodes/DiscountVideoNode.jsx'

function setup(data = {}) {
  return render(<DiscountVideoNode id="n1" data={data} selected={false} />)
}

describe('DiscountVideoNode 上游文本/图片合并（修复点）', () => {
  it('上游文本节点连入时，文字合并进生视频 prompt', async () => {
    connectedInputs = { images: [], texts: [{ id: 't1', text: '产品开箱视频', sourceNodeId: 's1' }] }
    setup({ prompt: '快节奏剪辑' })
    fireEvent.click(screen.getByText('生成'))

    await waitFor(() => expect(mockGenerateVideo).toHaveBeenCalled())
    const call = mockGenerateVideo.mock.calls[0][0]
    expect(call.prompt).toContain('快节奏剪辑')
    expect(call.prompt).toContain('产品开箱视频')
  })

  it('上游有文本但本地 prompt 为空时，校验通过', async () => {
    connectedInputs = { images: [], texts: [{ id: 't1', text: '夏日促销', sourceNodeId: 's1' }] }
    setup({ prompt: '' })
    expect(genConfig.validate()).toBe('')
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockGenerateVideo).toHaveBeenCalled())
    expect(mockGenerateVideo.mock.calls[0][0].prompt).toContain('夏日促销')
  })

  it('多个上游文本节点合并', async () => {
    connectedInputs = {
      images: [],
      texts: [
        { id: 't1', text: '镜头一：城市', sourceNodeId: 's1' },
        { id: 't2', text: '镜头二：海边', sourceNodeId: 's2' },
      ],
    }
    setup({ prompt: 'vlog' })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockGenerateVideo).toHaveBeenCalled())
    const p = mockGenerateVideo.mock.calls[0][0].prompt
    expect(p).toContain('vlog')
    expect(p).toContain('镜头一：城市')
    expect(p).toContain('镜头二：海边')
  })

  it('上游图片节点合并进 images 参考图', async () => {
    connectedInputs = {
      images: [{ id: 'i1', url: 'http://up/a.png', sourceNodeId: 's1' }],
      texts: [{ id: 't1', text: '同类风格', sourceNodeId: 's2' }],
    }
    setup({ prompt: '模仿' })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockGenerateVideo).toHaveBeenCalled())
    const call = mockGenerateVideo.mock.calls[0][0]
    expect(call.prompt).toContain('模仿')
    expect(call.images).toEqual(['http://up/a.png'])
  })

  it('本地与上游皆为空时，提示请输入提示词', () => {
    connectedInputs = { images: [], texts: [] }
    setup({ prompt: '' })
    expect(genConfig.validate()).toBe('请输入提示词')
  })
})
