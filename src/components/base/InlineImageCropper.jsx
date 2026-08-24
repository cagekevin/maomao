import React, { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { toastError } from './toastStore.js'
import { loadImageWithTimeout } from './asyncGuard.js'

/**
 * 就地裁剪浮层（极简，只做裁剪）。
 *
 * 要求（来自需求）：
 *  1. 无菜单、无顶部按钮栏——只有图片 + 底部「取消 / 裁剪」两个按钮。
 *  2. 默认按图片原始尺寸铺满：选区初始 = 整图（100%），ReactCrop 按图片比例铺满节点图片区；
 *     保存时换算回原始像素，不缩放失真。
 *  3. 选完选区后，点「裁剪」按钮确认保存写回。
 *
 * 【坐标精确的关键】图片不能用 object-contain：object-contain 会让 <img> 元素盒子
 * 大于实际可见图（留白），导致 ReactCrop 测量的渲染尺寸与可见图不一致，换算坐标错位、
 * drawImage 取到空白区 → 点确认"没效果"。改用默认等比缩放（max-w/h-full），<img> 元素
 * 盒子正好等于可见图尺寸，ReactCrop 的 completedCrop 与 img.width 一致，换算精确。
 *
 * 挂载：由调用方放在图片区 `relative` 容器内，本组件 `absolute inset-0` 覆盖。
 *
 * @param {Object} props
 * @param {string} props.imageUrl 要裁剪的图片 URL
 * @param {Function} props.onSave  保存回调，入参 { dataUrl }
 * @param {Function} props.onClose 关闭回调
 */
/**
 * 把 ReactCrop 的选区换算成原图像素上的裁剪矩形。
 *
 * 【两种单位，两种映射】
 *  - unit === '%'：百分比是「图片本身的占比」，与盒子渲染/缩放完全无关 → 直接映射原图像素
 *    （sx=x/100×natW）。这是最稳的，避免不同宽高比在节点盒子里缩放不一致导致的「右边多出一截」。
 *  - unit === 'px'：像素坐标是「渲染盒上的像素」，需按 natural/render 换算（兜底）。
 *
 * @param {Object} sel     { x, y, width, height, unit }
 * @param {number} renderW 渲染盒子宽（仅 px 分支用）
 * @param {number} renderH 渲染盒子高（仅 px 分支用）
 * @param {number} natW    原图宽
 * @param {number} natH    原图高
 * @returns {{sx:number,sy:number,sw:number,sh:number} | null}
 */
export function cropRectFromSelection({ sel, renderW, renderH, natW, natH }) {
  if (!sel || !sel.width || !sel.height) return null
  let sx, sy, sw, sh
  if (sel.unit === '%') {
    sx = Math.max(0, Math.round((sel.x / 100) * natW))
    sy = Math.max(0, Math.round((sel.y / 100) * natH))
    sw = Math.max(1, Math.min(natW - sx, Math.round((sel.width / 100) * natW)))
    sh = Math.max(1, Math.min(natH - sy, Math.round((sel.height / 100) * natH)))
  } else {
    const iw = renderW || natW || 1
    const ih = renderH || natH || 1
    const scaleX = natW / iw
    const scaleY = natH / ih
    sx = Math.max(0, Math.round(sel.x * scaleX))
    sy = Math.max(0, Math.round(sel.y * scaleY))
    sw = Math.max(1, Math.min(natW - sx, Math.round(sel.width * scaleX)))
    sh = Math.max(1, Math.min(natH - sy, Math.round(sel.height * scaleY)))
  }
  return { sx, sy, sw, sh }
}

export default function InlineImageCropper({ imageUrl, onSave, onClose }) {
  const imgRef = useRef(null)
  // 干净绘制源：预加载一份 crossOrigin='anonymous' 的图（复用 loadImageWithTimeout，
  // 与压缩/放大同机制）。直接 drawImage 渲染用的 <img> 会把跨域图污染 canvas → toDataURL
  // 抛 SecurityError，故绘制一律用这份干净图（服务端允许 CORS 时才能拿到，拿不到则回退原 <img>）。
  const cleanImgRef = useRef(null)
  const [crop, setCrop] = useState(undefined)
  // 百分比选区：保存用它（相对图片本身，布局无关，最稳）；onChange 第二个参数即 PercentCrop
  const [percentCrop, setPercentCrop] = useState(undefined)

  // 预加载干净图（供保存时绘制）
  useEffect(() => {
    if (!imageUrl) return
    let cancelled = false
    cleanImgRef.current = null
    loadImageWithTimeout(imageUrl)
      .then((im) => { if (!cancelled) cleanImgRef.current = im })
      .catch(() => { /* 保持 null；保存时回退原 <img>（跨域无法导出时 toast 提示） */ })
    return () => { cancelled = true }
  }, [imageUrl])

  // 取绘制源：优先干净图，未就绪/失败则现场再加载一次，再不行回退渲染 <img>
  const getDrawImage = useCallback(async () => {
    if (cleanImgRef.current) return cleanImgRef.current
    try {
      const im = await loadImageWithTimeout(imageUrl)
      cleanImgRef.current = im
      return im
    } catch {
      return imgRef.current || null
    }
  }, [imageUrl])

  // 图片加载 → 默认整图选区（100%），即初始尺寸 = 图片尺寸
  const onImageLoad = useCallback((e) => {
    imgRef.current = e.currentTarget
    const full = { unit: '%', x: 0, y: 0, width: 100, height: 100 }
    setCrop(full)
    setPercentCrop(full)
  }, [])

  // 确认裁剪：把选区换算成原图像素 → canvas 裁切 → 回传 dataURL。
  const handleSave = useCallback(async () => {
    const img = imgRef.current
    if (!img) { onClose?.(); return }
    const drawImg = (await getDrawImage()) || img
    const rect = cropRectFromSelection({
      sel: percentCrop,          // 百分比选区（布局无关），直接映射原图像素，不出「右边多出一截」
      renderW: img.width || img.naturalWidth,
      renderH: img.height || img.naturalHeight,
      natW: drawImg.naturalWidth,
      natH: drawImg.naturalHeight,
    })
    if (!rect) { onClose?.(); return }
    const { sx, sy, sw, sh } = rect
    // 裁切导出（跨域且服务端不允许 CORS 时，canvas 仍会污染 → toDataURL 抛 SecurityError，显式透传）
    try {
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (!ctx) { toastError('裁剪失败：无法创建画布'); return }
      ctx.drawImage(drawImg, sx, sy, sw, sh, 0, 0, sw, sh)
      onSave?.({ dataUrl: canvas.toDataURL('image/jpeg', 0.9) })
      onClose?.()
    } catch (e) {
      toastError(`裁剪保存失败：${e?.message || '图片跨域限制，无法导出'}`)
    }
  }, [percentCrop, onSave, onClose, getDrawImage])

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/70 nodrag">
      {/* 图片区：ReactCrop 直接叠在图片上，按图片比例铺满（等比缩放，无 contain 留白） */}
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        <ReactCrop
          crop={crop}
          onChange={(_, pc) => { setCrop(pc); setPercentCrop(pc) }}
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        >
          <img
            src={imageUrl}
            alt="裁剪预览"
            onLoad={onImageLoad}
            className="block max-w-full max-h-full select-none"
            draggable={false}
          />
        </ReactCrop>
      </div>

      {/* 底部仅两个按钮：取消 / 裁剪 */}
      <div className="flex items-center justify-end gap-2 px-3 py-2 bg-surface-raised border-t border-edge">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-body hover:bg-surface-hover-strong text-sm transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          裁剪
        </button>
      </div>
    </div>
  )
}
