/**
 * ImageBoxNode 深度测试。
 *
 * ImageBoxNode 是图片链路共同上游（近 60 次提交改动 5 次），交互面广：
 * 加图/删图/展开/全选/单选/导航/从连线导入，且全部通过 setNodes(updater) 写回 data。
 * 此前测试只有「挂载不崩」冒烟（1 用例），任何 data 逻辑回归都测不出。
 *
 * 本文件改为断言真实行为：捕获并执行 setNodes 传入的 updater，断言交互后
 * 节点 data 的精确变化（activeIndex / selectedIds / images / expanded）。
 * 这些断言任一被破坏，说明节点数据契约回归，测试必红。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

// 捕获 setNodes 传入的 updater 并执行，得到更新后的 nodes 数组（供断言 data 变更）
const h = vi.hoisted(() => {
  const state = { nodes: [] }
  const setNodesMock = vi.fn((updater) => {
    state.nodes = typeof updater === 'function' ? updater(state.nodes) : updater
  })
  return { state, setNodesMock, clipboardMock: { downloadUrl: vi.fn() } }
})

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: (...a) => h.setNodesMock(...a),
    getNodes: () => h.state.nodes,
    getEdges: () => [],
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
vi.mock('../../src/components/edges/CustomHandle.jsx', () => ({ default: mocks.CustomHandle }))
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/components/base/LazyImage.tsx', () => ({ default: mocks.LazyImage }))
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: mocks.showToast, toastError: mocks.toastError, toastWarning: mocks.toastWarning }))
vi.mock('../../src/components/base/filesApi.ts', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl }))
vi.mock('../../src/components/base/clipboard.ts', () => h.clipboardMock)
vi.mock('../../src/components/base/ImageZoomDialog.jsx', () => ({ default: () => null }))

import ImageBoxNode from '../../src/components/nodes/ImageBoxNode.jsx'

const nodeId = 'ib1'
function setup(data = {}, connected = { images: [], texts: [] }) {
  h.state.nodes = [{ id: nodeId, data: { ...data } }]
  h.setNodesMock.mockClear()
  h.clipboardMock.downloadUrl.mockClear()
  mocks.resetNodeMockState()
  mocks.setConnectedInputs(connected)
  return render(<ImageBoxNode id={nodeId} data={{ ...data }} selected={false} />)
}
function lastData() {
  return h.state.nodes.find((n) => n.id === nodeId)?.data
}
const twoImgs = [
  { id: 'a', url: 'http://x/a.png', label: 'A' },
  { id: 'b', url: 'http://x/b.png', label: 'B' },
]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ImageBoxNode — 空态与文件选择', () => {
  it('空态渲染引导文案', () => {
    setup()
    expect(screen.getByText('拖拽 / 粘贴 / 点击添加图片')).toBeTruthy()
  })

  it('点击空态 → 触发隐藏文件选择 input', () => {
    const { container } = setup()
    const input = container.querySelector('input[type="file"]')
    const clickSpy = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByText('拖拽 / 粘贴 / 点击添加图片'))
    expect(clickSpy).toHaveBeenCalled()
  })
})

describe('ImageBoxNode — 展开/折叠与选择', () => {
  it('展开 → data.expanded=true；折叠 → data.expanded=false', () => {
    setup({ images: twoImgs, activeIndex: 0 })
    fireEvent.click(screen.getByTitle('展开为缩略图网格'))
    expect(lastData().expanded).toBe(true)

    // 模拟 React Flow 把新 data 回传给节点后，再折叠
    const utils = render(<ImageBoxNode id={nodeId} data={{ images: twoImgs, activeIndex: 0, expanded: true }} selected={false} />)
    fireEvent.click(screen.getByTitle('折叠为单图'))
    expect(lastData().expanded).toBe(false)
    utils.unmount()
  })

  it('未选中时点「全选」→ selectedIds 为全部图 id', () => {
    setup({ images: twoImgs, activeIndex: 0, expanded: true })
    fireEvent.click(screen.getByTitle('全选'))
    expect(lastData().selectedIds).toEqual(['a', 'b'])
  })

  it('已全选时点「取消全选」→ selectedIds 清空', () => {
    setup({ images: twoImgs, activeIndex: 0, expanded: true, selectedIds: ['a', 'b'] })
    fireEvent.click(screen.getByTitle('取消全选'))
    expect(lastData().selectedIds).toEqual([])
  })

  it('网格模式点击缩略图 → 切换选中', () => {
    setup({ images: twoImgs, activeIndex: 0, expanded: true })
    fireEvent.click(screen.getByTitle('A'))
    expect(lastData().selectedIds).toEqual(['a'])
  })

  it('网格模式再点已选缩略图 → 取消选中', () => {
    setup({ images: twoImgs, activeIndex: 0, expanded: true, selectedIds: ['a'] })
    fireEvent.click(screen.getByTitle('A'))
    expect(lastData().selectedIds).toEqual([])
  })

  it('删除已选 → 移除选中图、清空 selectedIds、activeIndex 收敛', () => {
    const imgs = [
      { id: 'a', url: 'u1', label: 'A' },
      { id: 'b', url: 'u2', label: 'B' },
      { id: 'c', url: 'u3', label: 'C' },
    ]
    setup({ images: imgs, activeIndex: 2, expanded: true, selectedIds: ['a', 'c'] })
    fireEvent.click(screen.getByTitle('删除已选'))
    expect(lastData().images.map((i) => i.id)).toEqual(['b'])
    expect(lastData().selectedIds).toEqual([])
    expect(lastData().activeIndex).toBe(0)
  })
})

describe('ImageBoxNode — 单图导航', () => {
  it('点下一张 activeIndex 前进并循环', () => {
    const utils = setup({ images: twoImgs, activeIndex: 0 })
    fireEvent.click(screen.getByTitle('下一张'))
    expect(lastData().activeIndex).toBe(1)
    // 模拟 React Flow 回传新 data
    utils.rerender(<ImageBoxNode id={nodeId} data={{ images: twoImgs, activeIndex: 1 }} selected={false} />)
    fireEvent.click(screen.getByTitle('下一张'))
    expect(lastData().activeIndex).toBe(0)
    utils.unmount()
  })

  it('点上一张 activeIndex 回退并循环', () => {
    const utils = setup({ images: twoImgs, activeIndex: 0 })
    fireEvent.click(screen.getByTitle('上一张'))
    expect(lastData().activeIndex).toBe(1)
    utils.unmount()
  })

  it('单图模式点下载 → 调用 clipboard.downloadUrl', () => {
    setup({ images: twoImgs, activeIndex: 0 })
    fireEvent.click(screen.getByTitle('下载当前图片'))
    expect(h.clipboardMock.downloadUrl).toHaveBeenCalled()
  })
})

describe('ImageBoxNode — 从上游连线导入', () => {
  it('导入上游图片 → 追加 images（source=connect）并 activeIndex 指向最后', async () => {
    // makeThumb 内部 new Image()，jsdom 不触发 onload；用 stub 手动触发 onerror 使缩略图生成为 undefined
    const fakeImg = { crossOrigin: '', onload: null, onerror: null, src: '' }
    vi.stubGlobal('Image', vi.fn(() => fakeImg))
    setup(
      { images: [], activeIndex: 0 },
      { images: [{ id: 'u1', url: 'http://x/up.png', label: '' }], texts: [] }
    )

    fireEvent.click(screen.getByTitle('从连线图一键导入'))
    fakeImg.onerror?.()
    await waitFor(() => {
      expect(lastData().images).toHaveLength(1)
      expect(lastData().images[0].url).toBe('http://x/up.png')
      expect(lastData().images[0].source).toBe('connect')
      expect(lastData().activeIndex).toBe(0)
    })
  })

  it('无上游连线时导入 → 提示 warning', () => {
    setup({ images: [], activeIndex: 0 })
    fireEvent.click(screen.getByTitle('从连线图一键导入'))
    expect(mocks.toastCalls.warn).toBeGreaterThan(0)
  })
})
