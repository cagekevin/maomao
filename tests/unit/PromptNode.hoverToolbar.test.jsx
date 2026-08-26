/**
 * PromptNode hover 工具栏回归测试（State 2 契约细化）。
 * 核心验证：生图节点的「裁剪」按钮此前是死按钮（无 onClick），
 * 迁入共享机制 useImageHoverActions 后必须可点击并打开 ImageEditor。
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
    return { loading: false, error: null, stop: vi.fn(), start: vi.fn() }
  },
}))
// HoverToolbar：把传入的 buttons 数组按 title 渲染成可点击按钮（show=false 不渲染）
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({
  default: ({ buttons = [] }) => (
    <>
      {buttons.filter((b) => b.show !== false).map((b) => (
        <button key={b.key} type="button" title={b.title} onClick={b.onClick}>{b.title}</button>
      ))}
    </>
  ),
}))
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/ExpandablePanel.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/MaterialStrip.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptInput.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ResizeFullscreenHandle.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/FullscreenModal.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/GeneratingOverlay.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/PromptLibraryButton.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/JianyingIcon.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/hooks.js', () => ({ useNodeResize: () => ({ onInputResize: vi.fn() }), useOutsideClick: () => {} }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: () => ({}) }))
vi.mock('../../src/components/base/useMediaDegrade.js', () => ({ useMediaDegrade: () => ({ isHidden: () => false }) }))
vi.mock('../../src/components/base/nodePrefs.js', () => ({ useNodePrefs: () => ({ prefs: {}, set: vi.fn() }) }))
vi.mock('../../src/components/base/filesApi.js', () => ({ toAbsoluteFileUrl: (x) => x, saveResultToTasks: vi.fn(async () => undefined) }))
vi.mock('../../src/components/base/settings/providerStore.js', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/components/base/localToolApi.js', () => ({ fetchTasks: vi.fn(async () => ({ items: [] })) }))
vi.mock('../../src/components/base/imageApi.js', () => ({ generateImage: vi.fn(async () => ({ url: 'http://gen.local/img.png' })) }))
vi.mock('../../src/components/base/providerModels.js', () => ({ buildAllModels: vi.fn(() => []), resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })) }))
vi.mock('../../src/components/base/clipboard.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, downloadUrl: vi.fn() }
})

// ImageEditor：记录最近渲染的 imageUrl，便于断言「打开编辑器」
let lastEditorUrl = null
vi.mock('../../src/components/base/ImageEditor.jsx', () => ({
  default: ({ imageUrl, onSave, onClose }) => {
    lastEditorUrl = imageUrl
    return <div data-testid="image-editor" data-url={imageUrl} />
  },
}))
// InlineImageCropper：记录是否打开（就地裁剪浮层）
let inlineCropperOpen = false
vi.mock('../../src/components/base/InlineImageCropper.jsx', () => ({
  default: ({ imageUrl, onSave, onClose }) => {
    inlineCropperOpen = true
    return <div data-testid="inline-cropper" data-url={imageUrl} />
  },
}))

import PromptNode from '../../src/components/nodes/PromptNode.jsx'

beforeEach(() => {
  mockSetNodes.mockClear()
  mockGetNodes.mockReset(); mockGetNodes.mockReturnValue([])
  mockAddNodes.mockClear()
  genConfig = null
  lastEditorUrl = null
  inlineCropperOpen = false
  if (!global.IntersectionObserver) global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
})

describe('PromptNode hover 工具栏 — 共享图片能力', () => {
  it('有生图结果时，hover 栏出现「裁剪」按钮且可点击打开就地裁剪浮层', async () => {
    render(<PromptNode id="pn1" data={{ imageUrl: 'http://x/result.png', label: '生图' }} selected={false} />)
    const cropBtn = screen.getByTitle('裁剪')
    expect(cropBtn).toBeTruthy()
    expect(inlineCropperOpen).toBe(false) // 初始未打开
    fireEvent.click(cropBtn)
    await waitFor(() => expect(inlineCropperOpen).toBe(true))
    expect(screen.getByTestId('inline-cropper')).toBeTruthy()
  })

  it('有生图结果时，「标记」按钮可点击打开全屏 ImageEditor', async () => {
    render(<PromptNode id="pn1" data={{ imageUrl: 'http://x/result.png', label: '生图' }} selected={false} />)
    expect(lastEditorUrl).toBeNull() // 初始未打开
    fireEvent.click(screen.getByTitle('标记'))
    await waitFor(() => expect(lastEditorUrl).toBe('http://x/result.png'))
  })

  it('有生图结果时，hover 栏出现「标记」「压缩图片（80%）」按钮', () => {
    render(<PromptNode id="pn1" data={{ imageUrl: 'http://x/result.png' }} selected={false} />)
    expect(screen.getByTitle('标记')).toBeTruthy()
    expect(screen.getByTitle('压缩图片（80%）')).toBeTruthy()
  })

  it('有生图结果时仍保留生图节点专属按钮（放大/发送到剪映素材库）', () => {
    render(<PromptNode id="pn1" data={{ imageUrl: 'http://x/result.png' }} selected={false} />)
    expect(screen.getByTitle('放大')).toBeTruthy()
    expect(screen.getByTitle('发送到剪映素材库')).toBeTruthy()
  })
})
