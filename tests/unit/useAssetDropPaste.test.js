// @vitest-environment jsdom
/**
 * useAssetDropPaste 单测（批 3）。
 * 覆盖 useAssetDropPaste(opts).onDrop / onPaste 的素材导入逻辑：
 *   opts 由调用方注入：addNode / screenToFlowPosition / onPasteNodeGroup
 *   实际分发走 createNodeFromFile：
 *     - 图片/视频文件 → uploadFileToLocal(file,'canvas/drop') → addNode('imageNode', pos, {imageUrl, label})
 *     - 拖入文本 URL（text/plain）→ isAssetUrl 命中 → addNode('imageNode', {imageUrl})
 *     - 粘贴发生在可编辑元素（input）→ 被 isEditableTarget 守卫跳过
 *     - 粘贴图片 blob → createNodeFromFile → addNode
 * 通过 vi.mock 隔离 uploadFileToLocal（本地上传）与 showToast。
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const uploadMock = vi.fn(async (file) => 'http://local/' + file.name)
vi.mock('../../src/components/base/filesApi.js', () => ({
  uploadFileToLocal: (...a) => uploadMock(...a),
}))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: vi.fn() }))

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

describe('useAssetDropPaste — onDrop', () => {
  it('图片文件 → uploadFileToLocal + addNode(imageNode)', async () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const file = makeFile('a.png', 'image/png')
    const e = {
      preventDefault: vi.fn(),
      clientX: 10, clientY: 20,
      dataTransfer: { getData: () => null, files: [file] },
    }
    await act(async () => { await result.current.onDrop(e) })
    expect(uploadMock).toHaveBeenCalledWith(file, 'canvas/drop')
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', { x: 0, y: 0 }, { imageUrl: 'http://local/a.png', label: 'a.png' })
  })

  it('视频文件 → addNode(imageNode, imageUrl=上传URL)', async () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const file = makeFile('v.mp4', 'video/mp4')
    const e = {
      preventDefault: vi.fn(),
      clientX: 10, clientY: 20,
      dataTransfer: { getData: () => null, files: [file] },
    }
    await act(async () => { await result.current.onDrop(e) })
    expect(uploadMock).toHaveBeenCalledWith(file, 'canvas/drop')
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', { x: 0, y: 0 }, { imageUrl: 'http://local/v.mp4', label: 'v.mp4' })
  })

  it('文本 URL（图片）→ addNode imageNode', async () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      clientX: 10, clientY: 20,
      dataTransfer: { getData: (k) => (k === 'text/plain' ? 'http://x/pic.png' : null), files: [] },
    }
    await act(async () => { await result.current.onDrop(e) })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', { x: 0, y: 0 }, { imageUrl: 'http://x/pic.png' })
  })

  it('文本 URL（视频）→ addNode imageNode', async () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      clientX: 10, clientY: 20,
      dataTransfer: { getData: (k) => (k === 'text/plain' ? 'http://x/clip.mp4' : null), files: [] },
    }
    await act(async () => { await result.current.onDrop(e) })
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', { x: 0, y: 0 }, { imageUrl: 'http://x/clip.mp4' })
  })
})

describe('useAssetDropPaste — onPaste', () => {
  it('可编辑元素（input）内粘贴 → 被守卫跳过', async () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const input = document.createElement('input')
    const e = {
      preventDefault: vi.fn(),
      target: input,
      clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => makeFile('p.png', 'image/png') }] },
    }
    await act(async () => { await result.current.onPaste(e) })
    expect(opts.addNode).not.toHaveBeenCalled()
  })

  it('图片 blob 粘贴 → uploadFileToLocal + addNode', async () => {
    const opts = makeOpts()
    const { result } = renderHook(() => useAssetDropPaste(opts))
    const e = {
      preventDefault: vi.fn(),
      target: document.createElement('div'),
      clipboardData: { items: [{ kind: 'file', type: 'image/png', getAsFile: () => makeFile('p.png', 'image/png') }] },
    }
    await act(async () => { await result.current.onPaste(e) })
    expect(uploadMock).toHaveBeenCalled()
    expect(opts.addNode).toHaveBeenCalledWith('imageNode', expect.any(Object), { imageUrl: 'http://local/p.png', label: 'p.png' })
  })
})
