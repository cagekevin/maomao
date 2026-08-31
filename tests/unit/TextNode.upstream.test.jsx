/**
 * TextNode 上游合并测试（本次修复核心逻辑）。
 * 覆盖：上游文本节点连线后文字合并进文本生成消息；多上游文本/图片合并；
 * 上游有文本但本地为空时校验通过。
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

vi.mock('../../src/components/base/GenerateButton.tsx', () => ({ default: ({ onGenerate }) => <button type="button" onClick={onGenerate}>生成</button> }))
vi.mock('../../src/components/base/NodeShell.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/ExpandablePanel.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/MaterialStrip.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptInput.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/hooks.ts', async (importOriginal) => ({ ...(await importOriginal()), useNodeResize: () => ({ onInputResize: vi.fn() }), useOutsideClick: () => {} }))

// 可控的 useConnectedInputs
let connectedInputs = { images: [], texts: [] }
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: () => connectedInputs }))

vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: () => ({ isHidden: () => false }) }))
vi.mock('../../src/components/base/nodePrefs.ts', () => ({ useNodePrefs: () => ({ prefs: {}, set: vi.fn() }) }))
vi.mock('../../src/hooks/useSyncNodeData.ts', () => ({ useSyncNodeData: () => {} }))
vi.mock('../../src/components/base/api/filesApi.ts', () => ({ toAbsoluteFileUrl: (x) => x, saveResultToTasks: vi.fn(async () => undefined) }))
vi.mock('../../src/components/base/settings/providerStore.ts', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({ fetchTasks: vi.fn(async () => ({ items: [] })) }))
const mockChat = vi.fn(async () => ({ ok: true, content: '生成结果' }))
vi.mock('../../src/components/base/api/chatApi.ts', () => ({ chatCompletions: (...a) => mockChat(...a) }))
vi.mock('../../src/components/base/providerModels.ts', () => ({ buildAllModels: vi.fn(() => []), resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })) }))

beforeEach(() => {
  mockSetNodes.mockClear()
  mockGetNodes.mockReset()
  mockGetNodes.mockReturnValue([])
  mockAddNodes.mockClear()
  mockChat.mockReset()
  mockChat.mockResolvedValue({ ok: true, content: '生成结果' })
  genConfig = null
  connectedInputs = { images: [], texts: [] }
})

import TextNode from '../../src/components/nodes/TextNode.jsx'

function setup(data = {}) {
  return render(<TextNode id="n1" data={data} selected={false} />)
}

describe('TextNode 上游文本/图片合并（修复点）', () => {
  it('上游文本节点连入时，文字合并进生成消息', async () => {
    connectedInputs = { images: [], texts: [{ id: 't1', text: '原始文案：今天天气好', sourceNodeId: 's1' }] }
    setup({ prompt: '改写成小红书风格' })
    fireEvent.click(screen.getByText('生成'))

    await waitFor(() => expect(mockChat).toHaveBeenCalled())
    const call = mockChat.mock.calls[0][0]
    const userMsg = call.messages.find((m) => m.role === 'user')
    expect(userMsg.content).toContain('改写成小红书风格')
    expect(userMsg.content).toContain('原始文案：今天天气好')
  })

  it('上游有文本但本地为空时，校验通过', async () => {
    connectedInputs = { images: [], texts: [{ id: 't1', text: '产品卖点', sourceNodeId: 's1' }] }
    setup({ prompt: '', text: '' })
    expect(genConfig.validate()).toBe('')
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockChat).toHaveBeenCalled())
    const userMsg = mockChat.mock.calls[0][0].messages.find((m) => m.role === 'user')
    expect(userMsg.content).toContain('产品卖点')
  })

  it('多个上游文本节点合并', async () => {
    connectedInputs = {
      images: [],
      texts: [
        { id: 't1', text: '段落A', sourceNodeId: 's1' },
        { id: 't2', text: '段落B', sourceNodeId: 's2' },
      ],
    }
    setup({ prompt: '汇总' })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockChat).toHaveBeenCalled())
    const userMsg = mockChat.mock.calls[0][0].messages.find((m) => m.role === 'user')
    expect(userMsg.content).toContain('汇总')
    expect(userMsg.content).toContain('段落A')
    expect(userMsg.content).toContain('段落B')
  })

  it('上游图片节点合并进 images 参考图', async () => {
    connectedInputs = {
      images: [{ id: 'i1', url: 'http://up/a.png', sourceNodeId: 's1' }],
      texts: [{ id: 't1', text: '描述这张图', sourceNodeId: 's2' }],
    }
    setup({ prompt: '看图说话' })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockChat).toHaveBeenCalled())
    const call = mockChat.mock.calls[0][0]
    expect(call.images).toEqual(['http://up/a.png'])
    const userMsg = call.messages.find((m) => m.role === 'user')
    expect(userMsg.content).toContain('看图说话')
  })

  it('本地与上游皆为空时，提示请输入提示词或文本', () => {
    connectedInputs = { images: [], texts: [] }
    setup({ prompt: '', text: '' })
    expect(genConfig.validate()).toBe('请输入提示词或文本')
  })

  it('prompt 中的 @图片芯片 → 解析为可读文本 + 提取为参考图（不泄漏 @{...|url} 噪音）', async () => {
    connectedInputs = {
      images: [{ id: 'i1', url: 'http://up/ref.png', sourceNodeId: 's1' }],
      texts: [],
    }
    setup({ prompt: '请描述 @{i1:参考图|http%3A%2F%2Fup%2Fref.png} 的画面', text: '' })
    fireEvent.click(screen.getByText('生成'))
    await waitFor(() => expect(mockChat).toHaveBeenCalled())
    const call = mockChat.mock.calls[0][0]
    // 芯片被解析为可读文本（图片 → 图片N），绝不把 @{id:label|url} 噪音原样发给 LLM
    const userMsg = call.messages.find((m) => m.role === 'user')
    expect(userMsg.content).not.toContain('@{i1')
    expect(userMsg.content).not.toContain('http%3A')
    expect(userMsg.content).toContain('图片1')
    // 芯片图被提取进参考图，供 LLM 看图理解
    expect(call.images).toContain('http://up/ref.png')
  })
})
