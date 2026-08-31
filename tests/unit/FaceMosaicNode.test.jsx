/**
 * FaceMosaicNode 深度测试。
 *
 * FaceMosaicNode 是图片链路节点（近 200 次提交改动 8 次，此前只有「挂载不崩」冒烟）。
 * 交互面：模式切换/强度/颜色 → useEffect 写回节点 data；上传/连接图 → AI打码/手动打码 →
 * applyMosaic + uploadFileToLocal → spawn imageNode（setNodes 追加）+ 结果信息展示。
 *
 * 本文件断言真实行为：
 *  - 模式/强度/颜色 → 节点 data 的精确变化（setNodes updater 被捕获执行）
 *  - AI打码成功 → 输出 imageNode、显示结果张数与识别人脸数
 *  - AI打码全部失败 → toastError + 错误提示展示
 *  - 手动打码 → 打开编辑器、保存后输出 imageNode
 *  - 无图时 AI/手动按钮禁用（契约：不能空打码）
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

// 捕获 setNodes 传入的 updater 并执行，得到更新后的 nodes（供断言 data 变更与 spawn 输出）
const h = vi.hoisted(() => {
  const state = { nodes: [] }
  const setNodesMock = vi.fn((updater) => {
    state.nodes = typeof updater === 'function' ? updater(state.nodes) : updater
  })
  const applyMosaicMock = vi.fn(async (url, opts) => ({ dataUrl: 'data:image/png;base64,AAAA', faceCount: 2 }))
  const uploadMock = vi.fn(async () => 'http://local/mosaic.png')
  return { state, setNodesMock, applyMosaicMock, uploadMock }
})

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: (...a) => h.setNodesMock(...a),
    getNodes: () => h.state.nodes,
    // P7：FaceMosaicNode 输出用 getNode(id) 读自身位置（替 getNodes().find），mock 需同步提供
    getNode: (id) => h.state.nodes.find((n) => n.id === id),
    addNodes: () => {},
    addEdges: () => {},
  }),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  NodeResizer: () => null,
  useStore: () => () => ({}),
  ReactFlowProvider: ({ children }) => children,
}))
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: mocks.HoverToolbar }))
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/filesApi.ts', () => ({
  uploadFileToLocal: (...a) => h.uploadMock(...a),
  toAbsoluteFileUrl: (u) => `ABS:${u}`,
}))
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: mocks.showToast, toastError: mocks.toastError, toastWarning: mocks.toastWarning }))
vi.mock('../../src/components/base/faceMosaic.ts', () => ({
  applyMosaic: (...a) => h.applyMosaicMock(...a),
  MOSAIC_MODES: [
    { mode: 'mosaic', label: '马赛克' },
    { mode: 'bar', label: '黑条' },
    { mode: 'grid', label: '网格' },
    { mode: 'blur', label: '模糊' },
  ],
  MOSAIC_PALETTE: ['#000000', '#ffffff'],
}))
vi.mock('../../src/components/base/FaceMosaicEditor.jsx', () => ({
  default: ({ imageUrl, onSave, onClose }) =>
    React.createElement('div', { 'data-testid': 'mosaic-editor' },
      React.createElement('span', null, '手动编辑器'),
      React.createElement('button', { onClick: () => onSave('data:image/png;base64,QUFBQQ==') }, '保存手动打码'),
      React.createElement('button', { onClick: onClose }, '关闭编辑器')),
}))
vi.mock('../../src/components/base/ImageZoomDialog.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/previewUrl.ts', () => ({ default: { create: () => 'http://preview.x' } }))

import FaceMosaicNode from '../../src/components/nodes/FaceMosaicNode.jsx'

const nodeId = 'fm1'
function setup(data = {}, connected = { images: [], texts: [] }) {
  h.state.nodes = [{ id: nodeId, data: { ...data } }]
  mocks.resetNodeMockState()
  mocks.setConnectedInputs(connected)
  h.setNodesMock.mockClear()
  h.applyMosaicMock.mockClear()
  h.uploadMock.mockClear()
  return render(<FaceMosaicNode id={nodeId} data={{ ...data }} selected={false} />)
}
function lastData() {
  return h.state.nodes.find((n) => n.id === nodeId)?.data
}
function spawnedNodes() {
  return h.state.nodes.filter((n) => n.type === 'imageNode')
}

describe('FaceMosaicNode — 空态与图片源', () => {
  it('无图 → 显示引导文案', () => {
    setup()
    expect(screen.getByText('上传图片 或 左侧连接图片节点')).toBeTruthy()
  })

  it('连接上游图片 → 显示张数与输入缩略图', () => {
    setup({}, { images: [{ url: 'http://x/in1.png' }, { url: 'http://x/in2.png' }] })
    // 文案被 <span> 拆分：「已连接 <span>2</span> 张图片」，跨元素匹配
    expect(screen.getByText(/已连接/)).toBeTruthy()
    expect(document.querySelectorAll('img[alt^="input-"]')).toHaveLength(2)
  })

  it('无图时 AI打码/手动打码按钮禁用', () => {
    setup()
    const ai = screen.getByText(/AI打码/)
    const manual = screen.getByTitle('手动打码')
    expect(ai.closest('button').disabled).toBe(true)
    expect(manual.disabled).toBe(true)
  })
})

describe('FaceMosaicNode — 模式/强度/颜色写回 data', () => {
  it('切换模式 → 写回 data.mode（并显示颜色面板 when grid）', () => {
    setup()
    fireEvent.click(screen.getByText('网格'))
    expect(lastData().mode).toBe('grid')
    // grid/bar 模式才显示颜色选择
    expect(document.querySelectorAll('button[style*="background"]').length).toBeGreaterThan(0)
  })

  it('切换为模糊 → 无颜色面板', () => {
    setup()
    fireEvent.click(screen.getByText('模糊'))
    expect(lastData().mode).toBe('blur')
    expect(document.querySelectorAll('button[style*="background"]')).toHaveLength(0)
  })

  it('调整强度滑块 → 写回 data.strength 且百分比显示同步', () => {
    setup()
    const range = document.querySelector('input[type="range"]')
    fireEvent.change(range, { target: { value: '0.8' } })
    expect(lastData().strength).toBe(0.8)
    expect(screen.getByText('80%')).toBeTruthy()
  })

  it('网格模式下选择颜色 → 写回 data.color', () => {
    setup()
    fireEvent.click(screen.getByText('网格'))
    const swatches = document.querySelectorAll('button[style*="background"]')
    // 色板第二个是 #ffffff
    fireEvent.click(swatches[1])
    expect(lastData().color).toBe('#ffffff')
  })
})

describe('FaceMosaicNode — AI打码', () => {
  it('有图 → 打码成功输出 imageNode + 结果信息', async () => {
    h.applyMosaicMock.mockResolvedValue({ dataUrl: 'data:image/png;base64,AAAA', faceCount: 2 })
    setup({}, { images: [{ url: 'http://x/in1.png' }] })

    fireEvent.click(screen.getByText(/AI打码/))
    await waitFor(() => {
      expect(h.applyMosaicMock).toHaveBeenCalledWith('ABS:http://x/in1.png', { mode: 'mosaic', strength: 0.5, color: '#000000' })
      expect(spawnedNodes()).toHaveLength(1)
      const spawned = spawnedNodes()[0]
      expect(spawned.data.imageUrl).toBe('http://local/mosaic.png')
      expect(spawned.data.label).toBe('马赛克 1')
      // 结果信息（「共 <span>2</span> 张人脸」被拆分，跨元素匹配）
      expect(screen.getByText('1 张')).toBeTruthy()
      expect(screen.getByText(/张人脸/)).toBeTruthy()
    })
  })

  it('多图 → 逐张打码并更新进度', async () => {
    h.applyMosaicMock.mockResolvedValue({ dataUrl: 'data:image/png;base64,AAAA', faceCount: 0 })
    setup({}, { images: [{ url: 'http://x/1.png' }, { url: 'http://x/2.png' }] })

    fireEvent.click(screen.getByText(/AI打码/))
    await waitFor(() => {
      expect(h.applyMosaicMock).toHaveBeenCalledTimes(2)
      expect(spawnedNodes()).toHaveLength(2)
      // 未检测到人脸 → warning
      expect(mocks.toastCalls.warn).toBeGreaterThan(0)
      // 结果信息只显示张数（faceTotal=0 不显示）
      expect(screen.getByText('2 张')).toBeTruthy()
    })
  })

  it('全部失败 → toastError + 错误提示', async () => {
    h.applyMosaicMock.mockRejectedValue(new Error('detector 未加载'))
    setup({}, { images: [{ url: 'http://x/1.png' }] })

    fireEvent.click(screen.getByText(/AI打码/))
    await waitFor(() => {
      expect(mocks.toastCalls.error).toBeGreaterThan(0)
      expect(screen.getByText(/detector 未加载/)).toBeTruthy()
      expect(spawnedNodes()).toHaveLength(0)
    })
  })
})

describe('FaceMosaicNode — 手动打码', () => {
  it('有图 → 点击手动打开编辑器，保存后输出 imageNode', async () => {
    setup({}, { images: [{ url: 'http://x/in1.png' }] })
    fireEvent.click(screen.getByTitle('手动打码'))
    expect(screen.getByTestId('mosaic-editor')).toBeTruthy()

    fireEvent.click(screen.getByText('保存手动打码'))
    await waitFor(() => {
      expect(h.uploadMock).toHaveBeenCalled()
      expect(spawnedNodes()).toHaveLength(1)
      expect(spawnedNodes()[0].data.label).toBe('手动打码')
      expect(screen.getByText('1 张')).toBeTruthy()
    })
  })

  it('无图 → 不打开编辑器', () => {
    setup()
    fireEvent.click(screen.getByTitle('手动打码'))
    expect(screen.queryByTestId('mosaic-editor')).toBeNull()
  })
})
