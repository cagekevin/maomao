// @ts-nocheck
/**
 * PromptNode（图片生成节点）交互测试。
 * 覆盖：比例/画质/渲染质量菜单、批量数量菜单、模型选择、刷新恢复、生成成功回填、异步恢复。
 *
 * 逆向自 1mao（bo.jsx）。屏蔽重型子组件 / ReactFlow hooks，只验证节点内部交互与 patchData 行为。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

// ---- 稳定的 ReactFlow mock（组件与测试共享同一实例）----
const mockSetNodes = vi.fn()
const mockGetNodes = vi.fn(() => [])
const mockAddNodes = vi.fn()

// 捕获 useNodeGeneration 的 config（含 run/onSuccess/onRecover），供测试触发生成链路
let genConfig = null

// ---- 可交互子组件 / 可控 hooks ----
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
    // 复刻真实 hook 的广播 handler：recoverable + resultKey 时自动写回（先于 onRecover），
    // 以对齐 P0-2-b 声明式写回（节点不再手写 patchData）。先保存原 onRecover 避免覆盖造成递归。
    const originalOnRecover = config.onRecover
    genConfig.onRecover = (d) => {
      if (config.recoverable && config.resultKey && d?.resultUrl) {
        mockSetNodes((ns) => ns.map((n) => (n.id === config.nodeId ? { ...n, data: { ...n.data, [config.resultKey]: d.resultUrl } } : n)))
      }
      originalOnRecover?.(d)
    }
    return {
      loading: false,
      error: null,
      stop: vi.fn(),
      // 复刻真实 start：跑 run → resultKey 自动写回 → 回调 onSuccess（便于测试回填）
      start: vi.fn(async () => {
        const r = await config.run?.({ progress: () => {}, signal: { aborted: false } })
        if (config.resultKey && (r?.url || r?.doneUrl)) {
          const url = r.url || r.doneUrl
          mockSetNodes((ns) => ns.map((n) => (n.id === config.nodeId ? { ...n, data: { ...n.data, [config.resultKey]: url } } : n)))
        }
        config.onSuccess?.(r)
        return r
      }),
    }
  },
}))

vi.mock('../../src/components/base/ModelSelect.tsx', () => ({
  default: ({ value, onChange }) => (
    <button type="button" data-testid="model-select" onClick={() => onChange('model-x')}>
      {value || '选择模型'}
    </button>
  ),
}))

vi.mock('../../src/components/base/GenerateButton.tsx', () => ({
  default: ({ onGenerate }) => <button type="button" onClick={onGenerate}>生成</button>,
}))

vi.mock('../../src/components/base/NodeShell.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/ExpandablePanel.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/MaterialStrip.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/HoverToolbar.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptInput.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ResizeFullscreenHandle.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/FullscreenModal.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/GeneratingOverlay.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptLibraryButton.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/JianyingIcon.tsx', () => ({ default: () => null }))

vi.mock('../../src/components/base/hooks.ts', () => ({
  useNodeResize: () => ({ onInputResize: vi.fn() }),
  useOutsideClick: () => {},
}))
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: () => ({}) }))
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: () => ({ isHidden: () => false }) }))
vi.mock('../../src/components/base/nodePrefs.ts', () => ({ useNodePrefs: () => ({ prefs: {}, set: vi.fn() }) }))
vi.mock('../../src/hooks/useSyncNodeData.ts', () => ({ useSyncNodeData: () => {} }))
vi.mock('../../src/components/base/api/filesApi.ts', () => ({ toAbsoluteFileUrl: (x) => x, saveResultToTasks: vi.fn(async () => undefined) }))

const mockFetchTasks = vi.fn(async () => ({ data: { items: [] } }))
vi.mock('../../src/components/base/settings/providerStore.ts', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({ fetchTasks: (...a) => mockFetchTasks(...a) }))
const mockGenerateImage = vi.fn(async () => ({ url: 'http://gen.local/img.png' }))
vi.mock('../../src/components/base/api/imageApi.ts', () => ({ generateImage: (...a) => mockGenerateImage(...a) }))
vi.mock('../../src/components/base/providerModels.ts', () => ({ buildAllModels: vi.fn(() => []), resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })) }))

// jsdom 可能缺少 IntersectionObserver / requestAnimationFrame
beforeEach(() => {
  mockSetNodes.mockClear()
  mockGetNodes.mockReset()
  mockGetNodes.mockReturnValue([])
  mockAddNodes.mockClear()
  mockGenerateImage.mockReset()
  mockGenerateImage.mockResolvedValue({ url: 'http://gen.local/img.png' })
  mockFetchTasks.mockReset()
  mockFetchTasks.mockResolvedValue({ data: { items: [] } })
  genConfig = null
  if (!global.IntersectionObserver) {
    global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
  }
})

import PromptNode from '../../src/components/nodes/PromptNode.tsx'

function setup(data = {}) {
  return render(<PromptNode id="n1" data={data} selected={false} />)
}

/** 触发节点内某次 patchData 后，取出 updater 并执行，返回合并后的 data */
function lastPatchData(initialData = {}) {
  const calls = mockSetNodes.mock.calls
  // 找最后一条含 data patch 的调用
  for (let i = calls.length - 1; i >= 0; i--) {
    const updater = calls[i][0]
    if (typeof updater === 'function') {
      const r = updater([{ id: 'n1', data: initialData }])
      return r[0].data
    }
  }
  return undefined
}

const mainMenuBtn = () => screen.getByText('Auto · 1K · 自动')

describe('PromptNode 比例/画质/渲染质量菜单', () => {
  it('点击主菜单按钮可打开菜单，看到比例选项', () => {
    setup({})
    expect(screen.queryByText('1:1')).toBeNull()
    fireEvent.click(mainMenuBtn())
    expect(screen.getByText('1:1')).toBeTruthy()
    expect(screen.getByText('16:9')).toBeTruthy()
  })

  it('点击比例项后菜单关闭，且通过 rAF 异步 patchData 写入 aspectRatio（不含 imageSize）', async () => {
    setup({})
    fireEvent.click(mainMenuBtn())
    expect(screen.getByText('1:1')).toBeTruthy()

    fireEvent.click(screen.getByText('1:1'))

    // 菜单关闭：'1:1' 不再可见（主按钮此时显示 1:1 · 1K · 自动，但 getByText 精确匹配整串不会命中）
    expect(screen.queryByText('1:1')).toBeNull()

    await waitFor(() => expect(mockSetNodes).toHaveBeenCalled())
    const data = lastPatchData()
    expect(data.aspectRatio).toBe('1:1')
    expect(data.imageSize).toBeUndefined()
  })

  it('点击画质项后菜单关闭并异步 patchData 写入 imageSize', async () => {
    setup({})
    fireEvent.click(mainMenuBtn())
    fireEvent.click(screen.getByText('2K'))

    expect(screen.queryByText('2K')).toBeNull()
    await waitFor(() => expect(mockSetNodes).toHaveBeenCalled())
    const data = lastPatchData()
    expect(data.imageSize).toBe('2K')
  })

  it('点击渲染质量项后菜单关闭并异步 patchData 写入 quality', async () => {
    setup({})
    fireEvent.click(mainMenuBtn())
    fireEvent.click(screen.getByText('高质量'))

    expect(screen.queryByText('高质量')).toBeNull()
    await waitFor(() => expect(mockSetNodes).toHaveBeenCalled())
    const data = lastPatchData()
    expect(data.quality).toBe('high')
  })

  it('可连续多次切换比例（修复二次点不动）', async () => {
    setup({})
    const open = mainMenuBtn()

    fireEvent.click(open)
    fireEvent.click(screen.getByText('9:16'))
    await waitFor(() => expect(mockSetNodes).toHaveBeenCalled())
    expect(lastPatchData().aspectRatio).toBe('9:16')

    fireEvent.click(open)
    fireEvent.click(screen.getByText('16:9'))
    await waitFor(() => {
      expect(lastPatchData().aspectRatio).toBe('16:9')
    })
  })
})

describe('PromptNode 批量数量菜单', () => {
  it('点击数量按钮打开菜单，选择 x3 后菜单关闭且主按钮显示 x3', () => {
    setup({})
    expect(screen.queryByText('x5')).toBeNull()
    fireEvent.click(screen.getByText(/^x\d$/))
    // 菜单打开，出现 x1~x5
    expect(screen.getByText('x5')).toBeTruthy()
    fireEvent.click(screen.getByText('x3'))
    // 菜单关闭
    expect(screen.queryByText('x5')).toBeNull()
    // 主数量按钮变为 x3
    expect(screen.getByText('x3')).toBeTruthy()
  })
})

describe('PromptNode 模型选择', () => {
  it('点击模型选择后 patchData 写入 selectedModel', async () => {
    setup({})
    fireEvent.click(screen.getByTestId('model-select'))
    await waitFor(() => expect(mockSetNodes).toHaveBeenCalled())
    const data = lastPatchData()
    expect(data.selectedModel).toBe('model-x')
  })
})

describe('PromptNode 刷新恢复（restoreFromServer）', () => {
  it('节点无图时，从任务中心恢复最近完成结果并写回 data.imageUrl', async () => {
    mockFetchTasks.mockResolvedValue({
      data: {
        items: [
          { nodeId: 'n1', status: 'completed', resultUrl: 'http://recovered.local/a.png' },
          { nodeId: 'n2', status: 'completed', resultUrl: 'http://other/b.png' },
        ],
      },
    })
    setup({}) // data 无 imageUrl，走恢复分支

    await waitFor(() => {
      const data = lastPatchData()
      expect(data.imageUrl).toBe('http://recovered.local/a.png')
    })
  })

  it('节点已有图时不覆盖（不发起恢复写回）', async () => {
    setup({ imageUrl: 'http://already.local/c.png' })
    // 等待一拍，确保恢复 effect 已执行
    await new Promise((r) => setTimeout(r, 20))
    const data = lastPatchData()
    // 最近一次 patch 不应把 imageUrl 覆盖成任务中心结果
    expect(data?.imageUrl).not.toBe('http://recovered.local/a.png')
  })
})

describe('PromptNode 生成成功回填（onSuccess）', () => {
  it('点击生成后，结果 url 落盘写回 data.imageUrl', async () => {
    mockGenerateImage.mockResolvedValue({ url: 'http://gen.local/result.png' })
    setup({})
    fireEvent.click(screen.getByText('生成'))

    await waitFor(() => {
      const data = lastPatchData()
      expect(data.imageUrl).toBe('http://gen.local/result.png')
    })
  })
})

describe('PromptNode 异步任务恢复（onRecover）', () => {
  it('节点仍在画布时，轮询完成的广播结果写回本节点 data.imageUrl', () => {
    mockGetNodes.mockReturnValue([{ id: 'n1' }])
    setup({})
    act(() => { genConfig.onRecover({ resultUrl: 'http://poll.local/done.png' }) })
    const data = lastPatchData()
    expect(data.imageUrl).toBe('http://poll.local/done.png')
    // 节点存在时不重建（不调用 addNodes）
    expect(mockAddNodes).not.toHaveBeenCalled()
  })

  it('节点已消失时，用原 id 重建生图节点并带 resultUrl', () => {
    mockGetNodes.mockReturnValue([]) // 节点不在画布
    setup({ prompt: '一只猫', label: '生图' })
    act(() => { genConfig.onRecover({ resultUrl: 'http://poll.local/rebuild.png' }) })
    expect(mockAddNodes).toHaveBeenCalled()
    const added = mockAddNodes.mock.calls[0][0][0]
    expect(added.id).toBe('n1')
    expect(added.type).toBe('promptNode')
    expect(added.data.imageUrl).toBe('http://poll.local/rebuild.png')
  })
})
