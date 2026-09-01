/**
 * TemplateNode 单测（阶段五）。
 * 复用共享 mock kit（tests/unit/_nodeMocks.mjs）。
 * 覆盖：渲染不崩、label 透传、点击「生成」触发生成链路（generateImage 被调用）。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

// 覆盖 @xyflow/react：setNodes 真正执行 updater 维护 nodes state，供断言 patchData 写回 node.data
const h = vi.hoisted(() => {
  const state = { nodes: [] }
  const setNodes = vi.fn((updater) => { state.nodes = typeof updater === 'function' ? updater(state.nodes) : updater })
  return { state, setNodes }
})
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: (...a: unknown[]) => (h.setNodes as unknown as (...x: unknown[]) => void)(...a),
    setEdges: (...a) => a[0],
    getNodes: () => h.state.nodes,
    getEdges: () => [],
  }),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  useStore: () => () => ({}),
}))
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
vi.mock('../../src/components/base/hooks.ts', () => ({ useNodeResize: mocks.useNodeResize, useOutsideClick: mocks.useOutsideClick }))
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
// useNodeGeneration：记录 config，复刻真实 hook 的声明式写回（resultKey + recoverable）以对齐 P0-2-c。
// 桩经 h.setNodes 写入 node.data，供断言「成功/广播回填」后 data 自动更新（不再依赖节点手写 patchData）。
let genConfig = null
const getGenConfig = () => genConfig
vi.mock('../../src/hooks/useNodeGeneration.ts', () => ({
  useNodeGeneration: (config) => {
    genConfig = config
    // 复刻真实的广播 handler：recoverable + resultKey 且广播带 resultUrl 时先自动写回，再透传原 onRecover
    const originalOnRecover = config.onRecover
    genConfig.onRecover = (d) => {
      if (config.recoverable && config.resultKey && d?.resultUrl) {
        h.setNodes((ns) => ns.map((n) => (n.id === config.nodeId ? { ...n, data: { ...n.data, [config.resultKey]: d.resultUrl } } : n)))
      }
      originalOnRecover?.(d)
    }
    return {
      loading: false,
      error: null,
      stop: () => {},
      start: async () => {
        const r = await config?.run?.({ progress: () => {}, signal: { aborted: false } })
        if (config.resultKey && (r?.url || r?.doneUrl)) {
          const url = r.url || r.doneUrl
          h.setNodes((ns) => ns.map((n) => (n.id === config.nodeId ? { ...n, data: { ...n.data, [config.resultKey]: url } } : n)))
        }
        config?.onSuccess?.(r)
        return r
      },
    }
  },
}))
vi.mock('../../src/components/base/nodePrefs.ts', () => ({ useNodePrefs: mocks.useNodePrefs }))
vi.mock('../../src/hooks/useSyncNodeData.ts', () => ({ useSyncNodeData: mocks.useSyncNodeData }))
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: mocks.showToast, toastWarning: mocks.toastWarning, toastError: mocks.toastError }))
vi.mock('../../src/components/base/api/imageApi.ts', () => ({ generateImage: mocks.generateImage }))
vi.mock('../../src/components/base/api/filesApi.ts', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl, saveResultToTasks: mocks.saveResultToTasks }))
vi.mock('../../src/components/base/settings/providerStore.ts', () => ({ useProviders: mocks.useProviders, load: mocks.loadProviders }))
vi.mock('../../src/components/base/providerModels.ts', () => ({ buildAllModels: mocks.buildAllModels, resolveProviderModel: mocks.resolveProviderModel }))

import TemplateNode from '../../src/components/nodes/TemplateNode.tsx'

beforeEach(() => {
  mocks.resetNodeMockState()
  h.state.nodes = []
  h.setNodes.mockClear()
})

function setup(props: { id?: string; data?: Record<string, unknown> } = {}) {
  const id = props.id || 't1'
  const data = props.data || {}
  h.state.nodes = [{ id, data: { ...data } }]
  return render(<TemplateNode id={id} data={{ ...data }} selected={false} />)
}
function nodeData(id = 't1') {
  return h.state.nodes.find((n) => n.id === id)?.data
}

describe('TemplateNode', () => {
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

  it('onRecover（任务中心完成广播回填）→ 把持久 resultUrl 写回 data.imageUrl（刷新不丢）', () => {
    setup()
    // 触发 useNodeGeneration 的 onRecover 回调（模拟 agent:task-completed 广播精准回填）
    const cfg = getGenConfig()
    expect(cfg).toBeTruthy()
    act(() => cfg.onRecover({ resultUrl: 'http://127.0.0.1:18080/files/tasks/x.png' }))
    expect(nodeData().imageUrl).toBe('http://127.0.0.1:18080/files/tasks/x.png')
  })
})
