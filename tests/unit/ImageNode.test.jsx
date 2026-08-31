/**
 * ImageNode 深度测试（修复审计 P1"偏薄"）。
 * 覆盖 content type 判定的多种内容态：empty / image / audio / text / video。
 * detectMediaType 为真实实现；mediaType 显式标注时优先（blob/无扩展名产出场景）。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/base/HoverToolbar.jsx', () => ({ default: mocks.HoverToolbar }))
vi.mock('../../src/components/base/ImageEditor.jsx', () => ({ default: mocks.ImageEditor }))
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: mocks.useMediaDegrade }))
vi.mock('../../src/hooks/useFitNodeRatio.ts', () => ({ useFitNodeRatio: mocks.useFitNodeRatio }))
vi.mock('../../src/hooks/useVideoPoster.ts', () => ({ useVideoPoster: mocks.useVideoPoster }))
vi.mock('../../src/components/base/filesApi.ts', () => ({ toAbsoluteFileUrl: mocks.toAbsoluteFileUrl, saveInlineToLocal: mocks.saveInlineToLocal, uploadFileToLocal: mocks.uploadFileToLocal }))
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: mocks.showToast, toastError: mocks.toastError }))
vi.mock('../../src/components/base/imageCompress.ts', () => ({ compressImage: mocks.compressImage }))

import ImageNode from '../../src/components/nodes/ImageNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<ImageNode id="im1" data={{}} selected={false} {...props} />)

describe('ImageNode — 内容态', () => {
  it('无内容 → 空态（无 img、无内容文本）', () => {
    setup()
    expect(document.querySelector('img[alt="Content"]')).toBeNull()
    expect(screen.queryByText('文本/数据文件')).toBeNull()
  })

  it('image URL → 渲染图片并加载宽高比', () => {
    const { container } = setup({ data: { imageUrl: 'http://x/a.png' } })
    const img = container.querySelector('img[alt="Content"]')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('http://x/a.png')
  })

  it('mediaType=text → 渲染文本文件占位', () => {
    setup({ data: { mediaType: 'text', url: 'http://x/a.txt' } })
    expect(screen.getByText('文本/数据文件')).toBeTruthy()
  })

  it('mediaType=audio → 渲染 audio 元素', () => {
    setup({ data: { mediaType: 'audio', url: 'http://x/a.m4a' } })
    expect(document.querySelector('audio')).toBeTruthy()
  })

  it('mediaType=video → 渲染视频播放器 + 播放按钮', () => {
    setup({ data: { mediaType: 'video', url: 'http://x/v.mp4' } })
    expect(document.querySelector('video')).toBeTruthy()
    // 未播放状态：出现播放按钮（title=播放视频）
    const playBtn = screen.getAllByTitle('播放视频')[0]
    expect(playBtn).toBeTruthy()
  })
})