// @ts-nocheck
/**
 * useImageHoverActions 共享机制单测（State 2 契约细化）。
 * 验证：① 按钮含 crop/edit/compress 且带 onClick（非死按钮，对齐图片节点）
 *       ② 有图时三个按钮 show=true，无图时 show=false
 *       ③ 点击 crop/edit → setEditor 设对应 tool → renderEditor 渲染 ImageEditor
 *       ④ 压缩/裁剪写回走 onImageReplaced 回调（解耦写回方式）
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useImageHoverActions } from '../../src/components/base/useImageHoverActions.tsx'

// 依赖 stub（hook 内部 import 的真实模块，测试中用轻量替身）
vi.mock('../../src/components/base/ImageEditor.tsx', () => ({ default: () => null }))
vi.mock('../../src/components/base/imageCompress.ts', () => ({ compressImage: async (url) => ({ dataUrl: 'data:compressed', size: 1, originalSize: 2 }) }))
vi.mock('../../src/components/base/imageUpscale.ts', () => ({ upscaleImage: async (url) => ({ dataUrl: 'data:upscaled' }) }))
vi.mock('../../src/components/base/api/filesApi.ts', () => ({ saveInlineToLocal: async () => 'local://saved' }))
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: () => {}, toastError: () => {} }))

const findBtn = (btns, key) => btns.find((b) => b.key === key)

describe('useImageHoverActions — 图片共享 hover 能力', () => {
  beforeEach(() => {})

  it('有图时 crop/edit/upscale/compress 均显示且带 onClick（非死按钮）', () => {
    const { result } = renderHook(() =>
      useImageHoverActions({ id: 'n1', url: 'http://x/a.png', hasImage: true, label: 'L', onImageReplaced: () => {} })
    )
    const btns = result.current.imageButtons
    for (const k of ['crop', 'edit', 'upscale', 'compress']) {
      const b = findBtn(btns, k)
      expect(b, `按钮 ${k} 应存在`).toBeTruthy()
      expect(b.show, `按钮 ${k} 有图时应显示`).toBe(true)
      expect(typeof b.onClick === 'function', `按钮 ${k} 必须有 onClick（此前生图节点是死按钮）`).toBe(true)
    }
  })

  it('无图时 crop/edit/upscale/compress 均隐藏', () => {
    const { result } = renderHook(() =>
      useImageHoverActions({ id: 'n1', url: '', hasImage: false, label: 'L', onImageReplaced: () => {} })
    )
    for (const k of ['crop', 'edit', 'upscale', 'compress']) {
      expect(findBtn(result.current.imageButtons, k).show, `${k} 无图时应隐藏`).toBe(false)
    }
  })

  it('点击裁剪 → 打开就地裁剪浮层（cropping=true）→ renderInlineCropper 渲染', () => {
    const { result } = renderHook(() =>
      useImageHoverActions({ id: 'n1', url: 'http://x/a.png', hasImage: true, label: 'L', onImageReplaced: () => {} })
    )
    expect(result.current.cropping).toBe(false)
    act(() => { findBtn(result.current.imageButtons, 'crop').onClick() })
    expect(result.current.cropping).toBe(true)
    expect(result.current.renderInlineCropper()).not.toBeNull()
    // 关闭
    act(() => { result.current.setCropping(false) })
    expect(result.current.renderInlineCropper()).toBeNull()
  })

  it('点击标记(edit) → 打开全屏编辑器 → renderEditor 渲染 ImageEditor', () => {
    const { result } = renderHook(() =>
      useImageHoverActions({ id: 'n1', url: 'http://x/a.png', hasImage: true, label: 'L', onImageReplaced: () => {} })
    )
    expect(result.current.editor).toBeNull()
    act(() => { findBtn(result.current.imageButtons, 'edit').onClick() })
    expect(result.current.editor).toEqual({ tool: 'pencil' })
    expect(result.current.renderEditor()).not.toBeNull()
    // 关闭
    act(() => { result.current.setEditor(null) })
    expect(result.current.renderEditor()).toBeNull()
  })

  it('放大 → 调 onImageReplaced 写回（先放大 dataUrl，再落盘 URL）', async () => {
    const onReplaced = vi.fn()
    const { result } = renderHook(() =>
      useImageHoverActions({ id: 'n1', url: 'http://x/a.png', hasImage: true, label: 'L', onImageReplaced: onReplaced })
    )
    await act(async () => { await findBtn(result.current.imageButtons, 'upscale').onClick() })
    // 放大覆盖 + 落盘换 URL 各调用一次
    expect(onReplaced).toHaveBeenCalledTimes(2)
    expect(onReplaced).toHaveBeenNthCalledWith(1, 'data:upscaled')
    expect(onReplaced).toHaveBeenNthCalledWith(2, 'local://saved')
  })

  it('压缩 → 调 onImageReplaced 写回（先压缩 dataUrl，再落盘 URL）', async () => {
    const onReplaced = vi.fn()
    const { result } = renderHook(() =>
      useImageHoverActions({ id: 'n1', url: 'http://x/a.png', hasImage: true, label: 'L', onImageReplaced: onReplaced })
    )
    await act(async () => { await findBtn(result.current.imageButtons, 'compress').onClick() })
    // 压缩覆盖 + 落盘换 URL 各调用一次
    expect(onReplaced).toHaveBeenCalledTimes(2)
    expect(onReplaced).toHaveBeenNthCalledWith(1, 'data:compressed')
    expect(onReplaced).toHaveBeenNthCalledWith(2, 'local://saved')
  })

  it('编辑器保存 → onImageReplaced 写回并关闭', () => {
    const onReplaced = vi.fn()
    const { result } = renderHook(() =>
      useImageHoverActions({ id: 'n1', url: 'http://x/a.png', hasImage: true, label: 'L', onImageReplaced: onReplaced })
    )
    act(() => { findBtn(result.current.imageButtons, 'edit').onClick() })
    act(() => { result.current.handleEditorSave({ dataUrl: 'data:edited' }) })
    expect(onReplaced).toHaveBeenCalledWith('data:edited')
    expect(result.current.editor).toBeNull()
  })
})
