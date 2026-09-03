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
vi.mock('../../src/hooks/useNodeGeneration.ts', () => ({
  useNodeGeneration: (config) => {
    genConfig = config
    return { loading: false, error: null, stop: vi.fn(), start: vi.fn() }
  },
}))
// HoverToolbar：把传入的 buttons 数组按 title 渲染成可点击按钮（show=false 不渲染）
vi.mock('../../src/components/base/panels/HoverToolbar.tsx', () => ({
  default: ({ buttons = [] }) => (
    <>
      {buttons.filter((b) => b.show !== false).map((b) => (
        <button key={b.key} type="button" title={b.title} onClick={b.onClick}>{b.title}</button>
      ))}
    </>
  ),
}))
vi.mock('../../src/components/base/ui/NodeShell.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/ui/ExpandablePanel.tsx', () => ({ default: ({ children }) => children }))
vi.mock('../../src/components/base/panels/MaterialStrip.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/prompt/PromptInput.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ui/ResizeFullscreenHandle.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/panels/FullscreenModal.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ui/GeneratingOverlay.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/prompt/PromptLibraryButton.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/ui/JianyingIcon.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/core/uiHooks.ts', () => ({ useNodeResize: () => ({ onInputResize: vi.fn() }), useOutsideClick: () => {} }))
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: () => ({}) }))
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: () => ({ isHidden: () => false }) }))
vi.mock('../../src/components/base/canvas/nodePrefs.ts', () => ({ useNodePrefs: () => ({ prefs: {}, set: vi.fn() }) }))
vi.mock('../../src/components/base/api/filesApi.ts', () => ({ toAbsoluteFileUrl: (x) => x, saveResultToTasks: vi.fn(async () => undefined) }))
vi.mock('../../src/components/base/store/providerStore.ts', () => ({ useProviders: () => ({ providers: [] }), load: vi.fn(() => Promise.resolve()) }))
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({ fetchTasks: vi.fn(async () => ({ items: [] })) }))
vi.mock('../../src/components/base/api/imageApi.ts', () => ({ generateImage: vi.fn(async () => ({ url: 'http://gen.local/img.png' })) }))
vi.mock('../../src/components/base/utils/providerModels.ts', () => ({ buildAllModels: vi.fn(() => []), resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })) }))
vi.mock('../../src/components/base/utils/clipboard.ts', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return { ...actual, downloadUrl: vi.fn() }
})

// ImageEditor：记录最近渲染的 imageUrl，便于断言「打开编辑器」
let lastEditorUrl = null
vi.mock('../../src/components/base/editors/ImageEditor.tsx', () => ({
  default: ({ imageUrl, onSave, onClose }) => {
    lastEditorUrl = imageUrl
    return <div data-testid="image-editor" data-url={imageUrl} />
  },
}))
// InlineImageCropper：记录是否打开（就地裁剪浮层）
let inlineCropperOpen = false
vi.mock('../../src/components/base/editors/InlineImageCropper.tsx', () => ({
  default: ({ imageUrl, onSave, onClose }) => {
    inlineCropperOpen = true
    return <div data-testid="inline-cropper" data-url={imageUrl} />
  },
}))

import PromptNode from '../../src/components/nodes/PromptNode.tsx'

beforeEach(() => {
  mockSetNodes.mockClear()
  mockGetNodes.mockReset(); mockGetNodes.mockReturnValue([])
  mockAddNodes.mockClear()
  genConfig = null
  lastEditorUrl = null
  inlineCropperOpen = false
  // jsdom 无 IntersectionObserver；补一个类型完整的最小实现（DOM lib 已有声明，故无需 as any）
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class implements IntersectionObserver {
      readonly root: Element | Document | null = null
      readonly rootMargin = ''
      readonly thresholds: ReadonlyArray<number> = []
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] { return [] }
    }
  }
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
