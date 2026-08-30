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
 *  - keepOriginalFormat 是否保持原格式（true=沿用原图格式，仅缩尺寸不改格式，不丢透明；默认 false=转 format 指定格式）
 * @returns {Promise<{ dataUrl, blob, width, height, size, originalSize }>}
 */
import { loadImageWithTimeout } from './asyncGuard.ts'
import { httpRequest } from './httpClient.js'
import { IMAGE_LOAD_TIMEOUT, API_BASE } from './config.js'
import { dataUrlToBlob } from './utils.ts'

// 加载用地址补全：/files/ 相对 → 绝对（本地引擎端口）。与 imageUrl.js 的 toAbsoluteFileUrl 逻辑一致，
// 但这里不 import imageUrl 以避免「imageUrl → imageCompress → imageUrl」循环依赖（imageUrl 发送出口要调本模块）。
function toLoadableUrl(url: string): string {
  return typeof url === 'string' && url.startsWith('/files/') ? `${API_BASE}${url}` : url
}

// 常见图片 MIME → canvas.toDataURL 格式
const MIME_TO_FORMAT: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
  'image/bmp': 'image/bmp',
}
// 扩展名 → MIME
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jpe': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp',
}

/** 从 URL / data: header / blob 推断原图 MIME；推断不出返回 null */
function inferMime(src: string): string | null {
  if (!src || typeof src !== 'string') return null
  if (src.startsWith('data:')) {
    const m = /^data:([^;,]+)/.exec(src)
    return m ? m[1] : null
  }
  if (src.startsWith('blob:')) return null // blob: 拿不到类型（需 Blob.type，此处未知）
  const path = src.split('?')[0].toLowerCase()
  const dot = path.lastIndexOf('.')
  if (dot === -1) return null
  const ext = path.slice(dot)
  return EXT_TO_MIME[ext] || null
}

/** 图片压缩入参（compressImage.opts；均可选，见函数头 JSDoc） */
export interface CompressImageOptions {
  /** 质量 0~1，默认 0.8 */
  quality?: number
  /** 输出格式，默认 image/jpeg（jpg 有损压缩才明显省体积） */
  format?: string
  /** 最长边像素（可选），超出则等比缩放 */
  maxSize?: number
  /** 是否保持原格式（true=沿用原图格式，仅缩尺寸不改格式，不丢透明；默认 false=转 format 指定格式） */
  keepOriginalFormat?: boolean
}

/** 图片压缩结果（dataUrl/blob/尺寸/体积；大小均以「压缩后」为准，originalSize 为尽力获取的原图体积） */
export interface CompressImageResult {
  dataUrl: string
  blob: Blob
  width: number
  height: number
  size: number
  originalSize: number
}

export async function compressImage(url: string, opts: CompressImageOptions = {}): Promise<CompressImageResult> {
  const { quality = 0.8, format = 'image/jpeg', maxSize = 0, keepOriginalFormat = false } = opts
  const src = toLoadableUrl(url || '')
  if (!src) throw new Error('无图片可压缩')

  // 保持原格式：推断原图 MIME 作为输出格式（推断不出回退 png，避免 JPEG 丢透明/变黑底）
  let outFormat = format
  if (keepOriginalFormat) {
    outFormat = MIME_TO_FORMAT[inferMime(src)] || 'image/png'
  }

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
  if (outFormat === 'image/jpeg') {
    // JPEG 无透明，白底填充避免黑底
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)

  // 【R2 治理】toDataURL 跨域污染时抛 SecurityError，必须兜底成明确错误（TASK-015#2 静默吞错）
  let dataUrl
  try {
    dataUrl = canvas.toDataURL(outFormat, quality)
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
