// @vitest-environment jsdom
/**
 * useAssetDropPaste 单测（粘贴收口 · 万全之策）。
 *
 * 覆盖目标：粘贴读取不再依赖「paste 事件里会被回收的 clipboardData 快照 + 异步 getAsString」，
 * 而是优先 navigator.clipboard.read() 实时读系统剪贴板；read 失败/不可用时退回 paste 事件
 * 的「同步 getData」作为 fallback。四类内容全部有归宿：
 *   A. 图片（file / text/html 里的 <img>）
 *   B. 纯文本 → textNode
 *   C. 节点组（mutiwindow-nodes JSON）→ 重建节点+边
 *   D. 提取帧（mutiwindow-images JSON）→ 图片网格
 *
 * 关键修复（被这些测试锁定，防止回退）：
 *   1. 图片粘贴不依赖异步 getAsString（避免事件结束后快照回收读空）。
 *   2. 焦点在 contenteditable 内时，图片仍应建节点，不被 insertText 分支吞掉。
 *   3. read() 抛错时退回 paste 事件同步 getData，不再静默失败。
 *   4. 所有来源都失败 → showToast 提示，而不是无声无息。
 *
 * 通过 vi.mock 隔离 uploadFileToLocal / showToast；用 vi.stubGlobal 控制 navigator.clipboard。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const uploadMock = vi.fn(async (file) => 'http://local/' + file.name)
vi.mock('../../src/components/base/filesApi.js', () => ({
  uploadFileToLocal: (...a) => uploadMock(...a),
}))
const toastMock = vi.fn()
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: toastMock }))

const { useAssetDropPaste } = await import('../../src/components/base/useAssetDropPaste.js')

function makeFile(name, type) {
  return { name, type, size: 10 }
}

function makeOpts(overrides = {}) {
  return {
    addNode: vi.fn(),
    screenToFlowPosition: vi.fn(() => ({ x: 0, y: 0 })),
    onPasteNodeGroup: vi.fn(),
    ...overrides,
  }
}

// 造一个 navigator.clipboard，read() 可控；默认没有 write 以验证只读路径
function installClipboard({ read, write, writeText } = {}) {
  const clipboard = {
    read: read || vi.fn().mockRejectedValue(new Error('not implemented')),
    write: write || vi.fn().mockResolvedValue(undefined),
    writeText: writeText || vi.fn().mockResolvedValue(undefined),
  }
  vi.stubGlobal('navigator', { clipboard })
  return clipboard
}

// 造 ClipboardItem（navigator.clipboard.read 返回的实时剪贴板项）
function clipboardItem(types, dataMap) {
  return {
    types,
    getType: (t) => dataMap[t],
  }
}

// 构造一个 ClipboardItem 包装的 Blob（图片）
function imageBlobItem(blob = new Blob(['img'], { type: 'image/png' })) {
  return clipboardItem(['image/png'], { 'image/png': blob })
}

// 构造纯文本 ClipboardItem
function textItem(text, type = 'text/plain') {
  return clipboardItem([type], { [type]: text })
}

// 构造 text/html ClipboardItem（外部复制图片常是这个形态）
function htmlImageItem(src = 'http://ext/pic.png') {
  return clipboardItem(['text/html'], { 'text/html': `<img src="${src}">` })
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAssetDropPaste — onPaste（万全之策）', () => {
  // ── A. 图片：实时 read() 读 image/png Blob ──────────────────────────
  it('read() 返回 image/png Blob → 建 imageNode（不依赖事件快照）', async () => {
    installClipboard({ read: vi.fn().mockResolvedValue([imageBlobItem()]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    // 故意传一个不含 items 的 paste 事件（模拟 getAsFile 拿不到的场景）
    const e = { preventDefault: vi.fn(), target: document.createElement('div'), clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e) })
    expect(e.preventDefault).toHaveBeenCalled()
    expect(uploadMock).toHaveBeenCalled()
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://local/png', label: 'png' })
  })

  it('read() 返回 text/html（含 <img>）→ 提取图片建 imageNode', async () => {
    installClipboard({ read: vi.fn().mockResolvedValue([htmlImageItem('http://ext/cat.png')]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = { preventDefault: vi.fn(), target: document.createElement('div'), clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://ext/cat.png' })
  })

  // ── B. 纯文本 ─────────────────────────────────────────────────────
  it('read() 返回纯文本 → sanitize 后建 textNode', async () => {
    installClipboard({ read: vi.fn().mockResolvedValue([textItem('  hello   world  ')]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = { preventDefault: vi.fn(), target: document.createElement('div'), clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.addNode).toHaveBeenCalledWith('textNode', expect.any(Object), { text: 'hello world', expanded: false })
  })

  // ── C. 节点组 ─────────────────────────────────────────────────────
  it('read() 返回 mutiwindow-nodes JSON → 交给 onPasteNodeGroup', async () => {
    const json = JSON.stringify({ type: 'mutiwindow-nodes', nodes: [{ id: 'n1' }], edges: [] })
    installClipboard({ read: vi.fn().mockResolvedValue([textItem(json)]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = { preventDefault: vi.fn(), target: document.createElement('div'), clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.onPasteNodeGroup).toHaveBeenCalledWith(json, expect.any(Object))
  })

  // ── D. 提取帧 ─────────────────────────────────────────────────────
  it('read() 返回 mutiwindow-images JSON → 建图片网格', async () => {
    const json = JSON.stringify({ type: 'mutiwindow-images', images: ['http://x/1.png', 'http://x/2.png'] })
    installClipboard({ read: vi.fn().mockResolvedValue([textItem(json)]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = { preventDefault: vi.fn(), target: document.createElement('div'), clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://x/1.png', label: '提取帧 1' })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://x/2.png', label: '提取帧 2' })
  })

  // ── 修复 2：contenteditable 内粘贴图片 → 放行建节点（不被 insertText 吞） ──
  it('焦点在 contenteditable 内、剪贴板是图片 → 仍建 imageNode（不进 insertText）', async () => {
    installClipboard({ read: vi.fn().mockResolvedValue([imageBlobItem()]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const ce = document.createElement('div')
    ce.setAttribute('contenteditable', 'true')
    const e = { preventDefault: vi.fn(), target: ce, clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://local/png', label: 'png' })
  })

  it('焦点在 contenteditable 内、剪贴板是纯文本 → 走 insertText（不建节点）', async () => {
    installClipboard({ read: vi.fn().mockResolvedValue([textItem('hello')]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const ce = document.createElement('div')
    ce.setAttribute('contenteditable', 'true')
    const e = { preventDefault: vi.fn(), target: ce, clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.addNode).not.toHaveBeenCalled()
  })

  // ── 修复 3：read() 失败 → 退回 paste 事件「同步 getData」 fallback ──
  it('read() 抛错 → 退回 paste 事件同步 getData（text/plain）建 textNode', async () => {
    installClipboard({ read: vi.fn().mockRejectedValue(new Error('permission')) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    // 注意：fallback 用同步 getData，不再用异步 getAsString（避免事件结束读空）
    const e = {
      preventDefault: vi.fn(),
      target: document.createElement('div'),
      clipboardData: { getData: (k) => (k === 'text/plain' ? 'fallback text' : null), items: [] },
    }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.addNode).toHaveBeenCalledWith('textNode', expect.any(Object), { text: 'fallback text', expanded: false })
  })

  it('read() 抛错 → 退回 paste 事件同步 files（图片）建 imageNode', async () => {
    installClipboard({ read: vi.fn().mockRejectedValue(new Error('permission')) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const file = makeFile('fb.png', 'image/png')
    const e = {
      preventDefault: vi.fn(),
      target: document.createElement('div'),
      clipboardData: { getData: () => null, files: [file], items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] },
    }
    await act(async () => { await result.current.onPaste(e) })
    expect(uploadMock).toHaveBeenCalledWith(file, 'canvas/drop')
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://local/fb.png', label: 'fb.png' })
  })

  // ── 修复 3（旧路径兼容）：paste 事件本身带 file items（无 read 能力，如 file://）──
  it('无 clipboard.read 能力、paste 事件带 file items → 建 imageNode', async () => {
    installClipboard({ read: undefined }) // 模拟 navigator.clipboard.read 不存在
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const file = makeFile('ev.png', 'image/png')
    const e = {
      preventDefault: vi.fn(),
      target: document.createElement('div'),
      clipboardData: { getData: () => null, files: [file], items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] },
    }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://local/ev.png', label: 'ev.png' })
  })

  // ── 修复 4：全部失败 → 提示，不静默 ───────────────────────────────
  it('read() 失败 且 paste 事件也无内容 → showToast 提示（不静默、不建节点）', async () => {
    installClipboard({ read: vi.fn().mockRejectedValue(new Error('denied')) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      target: document.createElement('div'),
      clipboardData: { getData: () => null, files: [], items: [] },
    }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.addNode).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalled()
    const msg = toastMock.mock.calls[0][0]
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  // ── 守卫：可编辑元素内粘贴被 isEditableTarget 跳过（input） ───────
  it('input 内粘贴 → 被 isEditableTarget 守卫跳过（不建节点、不进 read）', async () => {
    const readMock = vi.fn()
    installClipboard({ read: readMock })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      target: document.createElement('input'),
      clipboardData: { items: [] },
    }
    await act(async () => { await result.current.onPaste(e) })
    expect(readMock).not.toHaveBeenCalled()
    expect(opts.addNode).not.toHaveBeenCalled()
  })
})
