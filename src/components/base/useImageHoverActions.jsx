import { useState, useCallback } from 'react'
import { Crop, Pencil, Maximize2, Minimize2 } from 'lucide-react'
import ImageEditor from './ImageEditor.jsx'
import InlineImageCropper from './InlineImageCropper.jsx'
import { compressImage } from './imageCompress.ts'
import { upscaleImage } from './imageUpscale.ts'
import { saveInlineToLocal } from './filesApi.js'
import { showToast, toastError } from './toastStore.js'

/**
 * 图片类节点 hover 操作栏「行为 + 按钮」统一机制。
 *
 * 【为什么抽出来】图片节点(ImageNode)与生图节点(PromptNode)的 hover 栏都含
 * 「裁剪 / 标记 / 压缩 / 发送到素材库 / 下载」这套图片行为能力。此前两节点各写一份，
 * 生图节点的 crop/edit 甚至漏写 onClick 成了死按钮（功能漂移）。抽出统一 hook，
 * 两节点只声明差异项（上传语义不同），共享能力一处维护、一处修复。
 *
 * 【解耦写回】hook 不耦合 setNodes / patchData 差异：调用方传 onImageReplaced(dataUrl)，
 * 由各自节点决定如何把新图写回（图片节点走 setNodes 不可变更新，生图节点走
 * setImageUrl + patchData 落盘）。hook 只负责「产出新 dataURL」。
 *
 * 【失败可见】压缩/发送失败均 toastError 透传真实原因，不吞错；异步均经
 * compressImage（内部带超时）与 saveInlineToLocal（httpRequest 带超时），不无限挂起。
 *
 * @param {Object} opts
 *  - id          节点 id（写回定位用，透传给调用方）
 *  - url         当前图片 URL（裁剪/压缩/下载/发送的源）
 *  - hasImage    是否已有图片（控制 crop/edit/compress 显示）
 *  - label       节点 label（发送素材库命名用）
 *  - onImageReplaced(dataUrl) 新图写回回调（裁剪保存 / 压缩覆盖都走它）
 * @returns {{
 *   editor,          // 编辑器开合态：null | { tool:'crop'|'pencil' }
 *   setEditor,       // 开关编辑器
 *   handleEditorSave,// ImageEditor.onSave
 *   handleCompress,  // 压缩按钮 onClick
 *   compressing,     // 压缩中（按钮 loading 用）
 *   handleUpscale,   // 放大按钮 onClick
 *   upscaling,       // 放大中（按钮 loading 用）
 *   imageButtons,    // 共享图片 hover 按钮数组（crop/edit/compress/upscale）
 *   renderEditor     // 渲染 ImageEditor 的函数（返回 JSX 或 null）
 * }}
 */
export function useImageHoverActions({ id, url, hasImage, label, onImageReplaced }) {
  const [editor, setEditor] = useState(null) // 全屏 ImageEditor（重编辑入口，保留）
  const [cropping, setCropping] = useState(false) // 就地裁剪浮层
  const [compressing, setCompressing] = useState(false)
  const [upscaling, setUpscaling] = useState(false)

  // 编辑器保存（裁剪/标记）→ 写回节点图片。失败透传 toastError，不静默。
  const handleEditorSave = useCallback(
    ({ dataUrl }) => {
      if (!dataUrl) return
      onImageReplaced?.(dataUrl)
      setEditor(null)
    },
    [onImageReplaced]
  )

  // 就地裁剪保存 → 写回节点图片，关闭裁剪浮层。
  const handleCropSave = useCallback(
    ({ dataUrl }) => {
      if (!dataUrl) return
      onImageReplaced?.(dataUrl)
      setCropping(false)
    },
    [onImageReplaced]
  )

  // 压缩：压缩后原位覆盖（先写回立即生效，再异步落盘换持久 URL）。
  const handleCompress = useCallback(async () => {
    if (!url || compressing) return
    setCompressing(true)
    try {
      const { dataUrl, size, originalSize } = await compressImage(url, { quality: 0.8 })
      if (!dataUrl) throw new Error('压缩失败')
      onImageReplaced?.(dataUrl) // 立即覆盖显示
      const saved = await saveInlineToLocal(dataUrl, 'canvas')
      if (saved && saved !== dataUrl) onImageReplaced?.(saved) // 落盘后换持久 URL
      const kb = (n) => `${(n / 1024).toFixed(0)}KB`
      showToast(`已压缩：${originalSize ? kb(originalSize) : '?'} → ${size ? kb(size) : '?'}`, { type: 'success' })
    } catch (e) {
      toastError(e?.message || '压缩失败')
    } finally {
      setCompressing(false)
    }
  }, [url, compressing, onImageReplaced])

  // 放大：浏览器 canvas 最高插值质量 ×2 放大（轻量，零模型），写回机制与压缩一致。
  const handleUpscale = useCallback(async () => {
    if (!url || upscaling) return
    setUpscaling(true)
    try {
      const { dataUrl } = await upscaleImage(url, { scale: 2 })
      if (!dataUrl) throw new Error('放大失败')
      onImageReplaced?.(dataUrl) // 立即覆盖显示
      const saved = await saveInlineToLocal(dataUrl, 'canvas')
      if (saved && saved !== dataUrl) onImageReplaced?.(saved) // 落盘后换持久 URL
      showToast('已放大 2 倍', { type: 'success' })
    } catch (e) {
      toastError(e?.message || '放大失败')
    } finally {
      setUpscaling(false)
    }
  }, [url, upscaling, onImageReplaced])

  // 共享图片 hover 按钮：裁剪（就地）/ 放大 / 压缩（图片编辑核心能力）。
  // 仅 hasImage 时显示（无图不显示死按钮）。发送/下载由各节点按自身语义保留。
  const imageButtons = [
    {
      key: 'crop',
      icon: <Crop size={14} />,
      title: '裁剪',
      onClick: () => url && setCropping(true),
      show: hasImage,
    },
    {
      key: 'edit',
      icon: <Pencil size={14} />,
      title: '标记',
      onClick: () => url && setEditor({ tool: 'pencil' }),
      show: hasImage,
    },
    {
      key: 'upscale',
      icon: <Maximize2 size={14} />,
      title: '超分放大（AI 2x）',
      onClick: handleUpscale,
      show: hasImage && !!url,
    },
    {
      key: 'compress',
      icon: <Minimize2 size={14} />,
      title: '压缩图片（80%）',
      onClick: handleCompress,
      show: hasImage && !!url,
    },
  ]

  // 渲染编辑器（调用方在节点末尾 render，全屏重编辑入口，保留未删）
  const renderEditor = () =>
    editor && url ? (
      <ImageEditor
        imageUrl={url}
        initialTool={editor.tool}
        onSave={handleEditorSave}
        onClose={() => setEditor(null)}
      />
    ) : null

  // 渲染就地裁剪浮层（调用方放在图片区 relative 容器内）
  const renderInlineCropper = () =>
    cropping && url ? (
      <InlineImageCropper
        imageUrl={url}
        onSave={handleCropSave}
        onClose={() => setCropping(false)}
      />
    ) : null

  return {
    editor,
    setEditor,
    cropping,
    setCropping,
    handleEditorSave,
    handleCropSave,
    handleCompress,
    compressing,
    handleUpscale,
    upscaling,
    imageButtons,
    renderEditor,
    renderInlineCropper,
  }
}

export default useImageHoverActions
