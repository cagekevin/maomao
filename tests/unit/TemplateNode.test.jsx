// @vitest-environment jsdom
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
    setNodes: (...a) => h.setNodes(...a),
    setEdges: (...a) => a[0],
    getNodes: () => h.state.nodes,
    getEdges: () => [],
  }),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  useStore: () => () => ({}),
}))
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
// useNodeGeneration：记录 config，复刻真实 hook 的声明式写回（resultKey + recoverable）以对齐 P0-2-c。
// 桩经 h.setNodes 写入 node.data，供断言「成功/广播回填」后 data 自动更新（不再依赖节点手写 patchData）。
let genConfig = null
const getGenConfig = () => genConfig
vi.mock('../../src/components/base/useNodeGeneration.js', () => ({
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
vi.mock('../../src/components/base/nodePrefs.js', () => ({ useNodePrefs: mocks.useNodePrefs }))
vi.mock('../../src/components/base/useSyncNodeData.js', () => ({ useSyncNodeData: mocks.useSyncNodeData }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastWarning: mocks.toastWarning, toastError: mocks.toastError }))
vi.mock('../../src/components/base/imageApi.js', () => ({ generateImage: mocks.generateImage }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl, saveResultToTasks: mocks.saveResultToTasks }))
vi.mock('../../src/components/base/settings/providerStore.js', () => ({ useProviders: mocks.useProviders, load: mocks.loadProviders }))
vi.mock('../../src/components/base/providerModels.js', () => ({ buildAllModels: mocks.buildAllModels, resolveProviderModel: mocks.resolveProviderModel }))

import TemplateNode from '../../src/components/nodes/TemplateNode.jsx'

beforeEach(() => {
  mocks.resetNodeMockState()
  h.state.nodes = []
  h.setNodes.mockClear()
})

function setup(props = {}) {
  const id = props.id || 't1'
  const data = props.data || {}
  h.state.nodes = [{ id, data: { ...data } }]
  return render(<TemplateNode id={id} data={{ ...data }} selected={false} />)
}
function nodeData(id = 't1') {
  return h.state.nodes.find((n) => n.id === id)?.data
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

  it('onRecover（任务中心完成广播回填）→ 把持久 resultUrl 写回 data.imageUrl（刷新不丢）', () => {
    setup()
    // 触发 useNodeGeneration 的 onRecover 回调（模拟 agent:task-completed 广播精准回填）
    const cfg = getGenConfig()
    expect(cfg).toBeTruthy()
    act(() => cfg.onRecover({ resultUrl: 'http://127.0.0.1:18080/files/tasks/x.png' }))
    expect(nodeData().imageUrl).toBe('http://127.0.0.1:18080/files/tasks/x.png')
  })
})
