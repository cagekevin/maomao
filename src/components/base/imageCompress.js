/**
 * 图片压缩工具（复刻官方 Xc.jsx 核心，简化为"原位压缩"场景）。
 *
 * 与官方差异：
 *  - 官方是独立 imageCompressNode（上传 + 三下拉 + 目标KB + 生成新节点），复杂。
 *  - 这里只做单图压缩，返回 dataURL，供调用方"写回原节点"（原位覆盖）。
 *  - 默认参数：quality 0.8（压缩 80%）、format image/jpeg（JPEG 才支持质量压缩）。
 *
 * 输入支持 data: / blob: / http(s) / 相对 /files/ 路径（经 toAbsoluteFileUrl 补全）。
 * @param {string} url 图片 URL
 * @param {object} [opts]
 *  - quality  质量 0~1，默认 0.8
 *  - format   输出格式，默认 image/jpeg（jpg 有损压缩才明显省体积）
 *  - maxSize  最长边像素（可选），超出则等比缩放
 * @returns {Promise<{ dataUrl, blob, width, height, size, originalSize }>}
 */
import { toAbsoluteFileUrl } from './imageUrl.js'
import { loadImageWithTimeout } from './asyncGuard.js'
import { httpRequest } from './httpClient.js'
import { IMAGE_LOAD_TIMEOUT } from './config.js'

export async function compressImage(url, opts = {}) {
  const { quality = 0.8, format = 'image/jpeg', maxSize = 0 } = opts
  const src = toAbsoluteFileUrl(url || '')
  if (!src) throw new Error('无图片可压缩')

  // 加载图片（跨域允许 canvas 不污染；blob/data 本地直接可用）。用统一入口带超时，避免失效图永久挂起（R2）
  const img = await loadImageWithTimeout(src, { timeoutMs: IMAGE_LOAD_TIMEOUT })
  let { naturalWidth: w, naturalHeight: h } = img
  if (!w || !h) throw new Error('无法获取图片尺寸')

  // 可选等比缩放
  if (maxSize && (w > maxSize || h > maxSize)) {
    if (w >= h) {
      h = Math.round((h * maxSize) / w)
      w = maxSize
    } else {
      w = Math.round((w * maxSize) / h)
      h = maxSize
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D 不可用')
  if (format === 'image/jpeg') {
    // JPEG 无透明，白底填充避免黑底
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)

  // 【R2 治理】toDataURL 跨域污染时抛 SecurityError，必须兜底成明确错误（TASK-015#2 静默吞错）
  let dataUrl
  try {
    dataUrl = canvas.toDataURL(format, quality)
  } catch (e) {
    throw new Error(`图片压缩失败：画布被跨域污染（${e?.name || 'SecurityError'}），请改用本地文件或允许跨域`)
  }
  const blob = dataUrlToBlob(dataUrl)

  // 原图体积（尽力获取，失败不阻断；fetch 也加超时防挂起）
  let originalSize = 0
  try {
    const res = await httpRequest(src, { timeoutMs: IMAGE_LOAD_TIMEOUT, retries: 0, parseJson: false })
    const buf = await res.blob()
    originalSize = buf.size
  } catch {
    try {
      originalSize = atob(src.split(',')[1] || '').length
    } catch {}
  }

  return { dataUrl, blob, width: w, height: h, size: blob.size, originalSize }
}

/** data: URL → Blob */
function dataUrlToBlob(dataUrl) {
  const idx = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, idx)
  const raw = dataUrl.slice(idx + 1)
  const mime = meta.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream'
  const bin = atob(raw)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
