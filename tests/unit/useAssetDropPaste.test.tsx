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
import type { ClipboardEvent as ReactClipboardEvent, DragEvent as ReactDragEvent } from 'react'

const uploadMock = vi.fn(async (file, folder) => 'http://local/' + (file?.name || 'drag'))
const downloadRemoteMock = vi.fn(async (url, opts) => null)
vi.mock('../../src/components/base/api/filesApi.ts', () => ({
  uploadFileToLocal: (file, folder) => uploadMock(file, folder),
  downloadRemoteToLocal: (url, opts) => downloadRemoteMock(url, opts),
  WEB_DROP_SUBFOLDER: 'web',
}))
const toastMock = vi.fn()
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: toastMock }))

const { useAssetDropPaste } = await import('../../src/hooks/useAssetDropPaste.ts')

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
function installClipboard({ read, write, writeText }: { read?: (...a: unknown[]) => unknown; write?: (...a: unknown[]) => unknown; writeText?: (...a: unknown[]) => unknown } = {}) {
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
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    // 补充路径（read() 异步）不依赖 e.preventDefault（异步期调用无效），只需验证节点被正确建立
    expect(uploadMock).toHaveBeenCalled()
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://local/png', label: 'png' })
  })

  it('read() 返回 text/html（含 <img>）→ 提取图片建 imageNode', async () => {
    installClipboard({ read: vi.fn().mockResolvedValue([htmlImageItem('http://ext/cat.png')]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = { preventDefault: vi.fn(), target: document.createElement('div'), clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://ext/cat.png' })
  })

  // ── B. 纯文本 ─────────────────────────────────────────────────────
  it('read() 返回纯文本 → sanitize 后建 textNode（清洗压缩）', async () => {
    installClipboard({ read: vi.fn().mockResolvedValue([textItem('  hello   world  ')]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = { preventDefault: vi.fn(), target: document.createElement('div'), clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    expect(opts.addNode).toHaveBeenCalledWith('textNode', expect.any(Object), { text: 'hello world', expanded: false })
  })

  // ── C. 节点组 ─────────────────────────────────────────────────────
  it('read() 返回 mutiwindow-nodes JSON → 交给 onPasteNodeGroup', async () => {
    const json = JSON.stringify({ type: 'mutiwindow-nodes', nodes: [{ id: 'n1' }], edges: [] })
    installClipboard({ read: vi.fn().mockResolvedValue([textItem(json)]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = { preventDefault: vi.fn(), target: document.createElement('div'), clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    expect(opts.onPasteNodeGroup).toHaveBeenCalledWith(json, expect.any(Object))
  })

  // ── D. 提取帧 ─────────────────────────────────────────────────────
  it('read() 返回 mutiwindow-images JSON → 建图片网格', async () => {
    const json = JSON.stringify({ type: 'mutiwindow-images', images: ['http://x/1.png', 'http://x/2.png'] })
    installClipboard({ read: vi.fn().mockResolvedValue([textItem(json)]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = { preventDefault: vi.fn(), target: document.createElement('div'), clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
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
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://local/png', label: 'png' })
  })

  it('焦点在 contenteditable 内、剪贴板是纯文本 → 走 insertText（不建节点）', async () => {
    installClipboard({ read: vi.fn().mockResolvedValue([textItem('hello')]) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const ce = document.createElement('div')
    ce.setAttribute('contenteditable', 'true')
    const e = { preventDefault: vi.fn(), target: ce, clipboardData: { items: [] } }
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
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
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
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
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
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
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
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
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    expect(opts.addNode).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalled()
    const msg = toastMock.mock.calls[0][0]
    expect(typeof msg).toBe('string')
    expect(msg.length).toBeGreaterThan(0)
  })

  // ── 关键修复：text/plain 用「同步 getData」优先，避免 getAsString 异步被回收读空 ──
  // 复现「复制节点偶发粘贴不上」：getAsString 回调不触发（或读空），但 getData 同步有值。
  it('节点组 JSON：getAsString 不触发，但同步 getData 有值 → 仍建节点（防偶发粘贴不上）', async () => {
    const json = JSON.stringify({ type: 'mutiwindow-nodes', nodes: [{ id: 'n1' }], edges: [] })
    installClipboard({ read: vi.fn().mockRejectedValue(new Error('no')) })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      target: document.createElement('div'),
      // items 里有 text/plain 项，但 getAsString 永远不回调（模拟事件回收）
      clipboardData: {
        getData: (k) => (k === 'text/plain' ? json : null),
        items: [{ kind: 'string', type: 'text/plain', getAsString: () => {} }],
      },
    }
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    expect(opts.onPasteNodeGroup).toHaveBeenCalledWith(json, expect.any(Object))
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
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    expect(readMock).not.toHaveBeenCalled()
    expect(opts.addNode).not.toHaveBeenCalled()
  })

  // ── 焦点卡编辑区：节点组 JSON 在 contenteditable / input 内也必须放行建节点 ──
  // 根因：复制节点后若焦点落在编辑区，粘贴被「可编辑元素走原生」守卫吞掉 → 表现为
  // 「复制节点粘贴不上」，且焦点一直卡在编辑区 → 后续所有节点粘贴都失败。JSON 应放行。
  it('contenteditable 内粘贴节点组 JSON → 放行建节点（不退化塞进编辑框）', async () => {
    const json = JSON.stringify({ type: 'mutiwindow-nodes', nodes: [{ id: 'n1' }], edges: [] })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const ce = document.createElement('div')
    ce.setAttribute('contenteditable', 'true')
    const e = {
      preventDefault: vi.fn(),
      target: ce,
      clipboardData: {
        getData: (k) => (k === 'text/plain' ? json : null),
        items: [{ kind: 'string', type: 'text/plain', getAsString: () => {} }],
      },
    }
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    expect(opts.onPasteNodeGroup).toHaveBeenCalledWith(json, expect.any(Object))
  })

  it('input 内粘贴节点组 JSON → 放行建节点（不交给原生插入 JSON）', async () => {
    const json = JSON.stringify({ type: 'mutiwindow-images', images: ['http://x/1.png'] })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      target: document.createElement('input'),
      clipboardData: {
        getData: (k) => (k === 'text/plain' ? json : null),
        items: [{ kind: 'string', type: 'text/plain', getAsString: () => {} }],
      },
    }
    await act(async () => { await result.current.onPaste(e as unknown as ReactClipboardEvent) })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://x/1.png', label: '提取帧 1' })
  })

  // ════════════════════════════════════════════════════════════════
  // 文本节点两种复制语义（用户高频痛点）：
  //   A. 工具栏「复制文本」→ writeText(节点里的文字) = 纯文本
  //   B. 右键「复制」→ writeText(mutiwindow-nodes JSON) = 整个节点
  // 要求：A 粘贴到画布建 textNode 且内容经 sanitize「彻底清洗」成干净纯文本
  //       （用户核心诉求：粘贴表格/富文本时绝不当图片/带样式贴进来，必须清晰纯文本）；
  //       A 粘贴到 textarea 走原生插入；B 无论焦点在哪都放行建节点组。
  // ════════════════════════════════════════════════════════════════
  function plainEvent(text, target): ReactClipboardEvent {
    return {
      preventDefault: vi.fn(),
      target,
      clipboardData: {
        getData: (k) => (k === 'text/plain' ? text : null),
        items: [{ kind: 'string', type: 'text/plain', getAsString: () => {} }],
      },
    } as unknown as ReactClipboardEvent
  }

  it('复制文本节点里的文字 → 粘贴到画布：建 textNode 且内容被 sanitize 清洗（去缩进/空行）', async () => {
    const original = '第一行\n    缩进的行\n\n\n结尾'
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    await act(async () => { await result.current.onPaste(plainEvent(original, document.createElement('div'))) })
    // sanitize 清洗：压缩连续空格/空行、去行首尾空格、trim
    expect(opts.addNode).toHaveBeenCalledWith('textNode', expect.any(Object), { text: '第一行\n缩进的行\n\n结尾', expanded: false })
  })

  it('复制文本节点里的文字 → 粘贴到 textarea：走原生插入（不建节点）', async () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    await act(async () => { await result.current.onPaste(plainEvent('hello', document.createElement('textarea'))) })
    expect(opts.addNode).not.toHaveBeenCalled()
  })

  it('复制文本节点里的文字（普通 JSON 但不含 mutiwindow 标记）→ 粘贴到画布：建 textNode 且被清洗', async () => {
    const original = '{"a": 1, "b": [1,   2]}' // 合法 JSON 但非 mutiwindow → 当普通文本
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    await act(async () => { await result.current.onPaste(plainEvent(original, document.createElement('div'))) })
    expect(opts.addNode).toHaveBeenCalledWith('textNode', expect.any(Object), { text: '{"a": 1, "b": [1, 2]}', expanded: false })
  })

  it('复制整个文本节点（节点组 JSON）→ 粘贴到画布：重建节点组', async () => {
    const json = JSON.stringify({ type: 'mutiwindow-nodes', nodes: [{ id: 'n1' }], edges: [] })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    await act(async () => { await result.current.onPaste(plainEvent(json, document.createElement('div'))) })
    expect(opts.onPasteNodeGroup).toHaveBeenCalledWith(json, expect.any(Object))
  })

  it('复制整个文本节点（节点组 JSON）→ 粘贴到 textarea：放行建节点（不被吞）', async () => {
    const json = JSON.stringify({ type: 'mutiwindow-nodes', nodes: [{ id: 'n1' }], edges: [] })
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    await act(async () => { await result.current.onPaste(plainEvent(json, document.createElement('textarea'))) })
    expect(opts.onPasteNodeGroup).toHaveBeenCalledWith(json, expect.any(Object))
  })

  // ── onDrop 拖拽：从网页拖图（URL 在 text/uri-list，非 File）→ 直接用原 URL 建节点 ──
  it('拖入图片：URL 在 text/uri-list（拖网页图的 Chrome 标准 MIME）→ 用原 URL 建 imageNode', () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [],
        getData: (k) => (k === 'text/uri-list' ? 'https://www.qq.com/img/cat.png' : k === 'text/plain' ? '' : ''),
      },
    }
    result.current.onDrop(e as unknown as ReactDragEvent)
    // 直接用原网络 URL 建节点（不做下载/本地化，保持简单；不加 label）
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', { x: 0, y: 0 }, { imageUrl: 'https://www.qq.com/img/cat.png' })
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('拖入文本：text/uri-list 是纯文本（非图片 URL）→ 建 textNode', () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [],
        getData: (k) => (k === 'text/uri-list' ? 'hello world' : k === 'text/plain' ? '' : ''),
      },
    }
    result.current.onDrop(e as unknown as ReactDragEvent)
    expect(opts.addNode).toHaveBeenCalledWith('textNode', expect.any(Object), { text: 'hello world', expanded: false })
  })

  it('拖入链接：text/uri-list 为空、text/plain 是图片 URL → 用原 URL 建 imageNode', () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: [],
        getData: (k) => (k === 'text/uri-list' ? '' : k === 'text/plain' ? 'https://cdn/x/1.jpg' : ''),
      },
    }
    result.current.onDrop(e as unknown as ReactDragEvent)
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', { x: 0, y: 0 }, { imageUrl: 'https://cdn/x/1.jpg' })
  })

  it('拖入空内容（无 files、无 uri-list、无 plain）→ 不建节点、不报错', () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [], getData: () => '' },
    }
    result.current.onDrop(e as unknown as ReactDragEvent)
    expect(opts.addNode).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════════════════
// 网页图后台本地化（先显示后替换）：复用后端 fileUrl 下载（服务端+代理，绕 CORS），
// 成功把节点 imageUrl 替换为 /files/web/ 本地 URL（专用 web 目录）；失败保持原 URL，
// 不打扰、不抛错。未注入 patchNodeData 时退回纯显示模式（不触发本地化）。
// ════════════════════════════════════════════════════════════════
describe('useAssetDropPaste — 网页图后台本地化（web 目录）', () => {
  afterEach(() => downloadRemoteMock.mockReset())

  it('拖入网页图 → 先用原 URL 建节点 + 触发后台本地化；成功后替换节点 imageUrl', async () => {
    downloadRemoteMock.mockResolvedValue('http://127.0.0.1:18080/files/web/abc.png')
    const patchNodeData = vi.fn()
    const opts = makeOpts({ addNode: vi.fn(() => 'node-web-1'), patchNodeData })
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [], getData: (k) => (k === 'text/uri-list' ? 'https://x/cat.png' : '') },
    }
    result.current.onDrop(e as unknown as ReactDragEvent)
    // 立即用原 URL 建节点（无 label）
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', { x: 0, y: 0 }, { imageUrl: 'https://x/cat.png' })
    // 后台本地化 → 专用 web 目录
    expect(downloadRemoteMock).toHaveBeenCalledWith('https://x/cat.png', { folder: 'web' })
    // 等异步完成 → 替换为本地 URL（id = addNode 返回值）
    await act(async () => {})
    expect(patchNodeData).toHaveBeenCalledWith('node-web-1', { imageUrl: 'http://127.0.0.1:18080/files/web/abc.png' })
  })

  it('后台本地化失败（返回 null）→ 保持原 URL，不替换、不抛错', async () => {
    downloadRemoteMock.mockResolvedValue(null)
    const patchNodeData = vi.fn()
    const opts = makeOpts({ addNode: vi.fn(() => 'node-web-2'), patchNodeData })
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [], getData: (k) => (k === 'text/uri-list' ? 'https://x/cat.png' : '') },
    }
    result.current.onDrop(e as unknown as ReactDragEvent)
    await act(async () => {})
    expect(patchNodeData).not.toHaveBeenCalled()
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', { x: 0, y: 0 }, { imageUrl: 'https://x/cat.png' })
  })

  it('本地化结果与原 URL 相同 → 不重复替换', async () => {
    downloadRemoteMock.mockResolvedValue('https://x/cat.png')
    const patchNodeData = vi.fn()
    const opts = makeOpts({ addNode: vi.fn(() => 'node-web-3'), patchNodeData })
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [], getData: (k) => (k === 'text/uri-list' ? 'https://x/cat.png' : '') },
    }
    result.current.onDrop(e as unknown as ReactDragEvent)
    await act(async () => {})
    expect(patchNodeData).not.toHaveBeenCalled()
  })

  it('未注入 patchNodeData（纯显示模式）→ 仍建节点但不触发本地化', () => {
    const opts = makeOpts({ addNode: vi.fn(() => 'node-web-4') }) // 无 patchNodeData
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [], getData: (k) => (k === 'text/uri-list' ? 'https://x/cat.png' : '') },
    }
    result.current.onDrop(e as unknown as ReactDragEvent)
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', { x: 0, y: 0 }, { imageUrl: 'https://x/cat.png' })
    expect(downloadRemoteMock).not.toHaveBeenCalled()
  })
})
