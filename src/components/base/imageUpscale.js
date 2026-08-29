/**
 * 图片放大工具（纯浏览器 canvas 放大，零模型、零依赖、最轻量）。
 *
 * 【为什么存在】用户要"轻量"的图片放大，放弃 ONNX 重模型（Real-ESRGAN fp16 也有 32MB）。
 * 纯 canvas 用浏览器原生最高插值质量（bicubic）放大，秒出结果、体积为 0，代价是没有
 * AI 超分那种"凭空补细节"，只是让像素平滑变大 + 轻度锐化提升观感。
 *
 * 【与 imageCompress 对齐】返回结构一致（dataUrl/blob/width/height），调用方走同一套
 * "原位覆盖"写回机制（onImageReplaced + saveInlineToLocal）。
 *
 * 【放大倍数】默认 ×2（等比，宽高各乘 scale）。scale 必须是 >=1 的数。
 *
 * 【锐化】可选 unsharp mask（USM），默认开启、强度 0.6，让放大后更"清亮"不糊。
 * 锐化实现：在放大后的 canvas 上叠加"原图 - 高斯模糊(原图)"的高频分量 × 强度。
 * 用离线 canvas 的 putImageData/getImageData 逐像素做，约 ~O(w*h*9)，小图无感、大图稍慢。
 *
 * 输入支持 data: / blob: / http(s) / 相对 /files/ 路径（经 toAbsoluteFileUrl 补全）。
 * @param {string} url 图片 URL
 * @param {object} [opts]
 *  - scale     放大倍数，默认 2
 *  - sharpen   是否轻度锐化，默认 true
 *  - sharpenAmount 锐化强度 0~2，默认 0.6
 *  - format    输出格式，默认 image/png（保持无损，适合放大）
 *  - maxOutputSize 输出最长边像素上限（可选），超出则等比 clamp（防超大图内存爆炸）
 * @returns {Promise<{ dataUrl, blob, width, height }>}
 */
import { toAbsoluteFileUrl } from './imageUrl.js'
import { loadImageWithTimeout } from './asyncGuard.js'
import { IMAGE_LOAD_TIMEOUT } from './config.js'
import { dataUrlToBlob } from './utils.js'

export async function upscaleImage(url, opts = {}) {
  const {
    scale = 2,
    sharpen = true,
    sharpenAmount = 0.6,
    format = 'image/png',
    maxOutputSize = 0,
  } = opts
  const src = toAbsoluteFileUrl(url || '')
  if (!src) throw new Error('无图片可放大')
  if (!(scale >= 1)) throw new Error('放大倍数必须 >= 1')

  // 加载图片（统一入口带超时，避免失效图永久挂起，对齐 imageCompress 的 R2 治理）
  const img = await loadImageWithTimeout(src, { timeoutMs: IMAGE_LOAD_TIMEOUT })
  let { naturalWidth: w, naturalHeight: h } = img
  if (!w || !h) throw new Error('无法获取图片尺寸')

  // 放大（等比）
  let outW = Math.round(w * scale)
  let outH = Math.round(h * scale)

  // 可选最长边 clamp：超出则等比降回来，防止极端大图把 canvas / 内存打爆
  if (maxOutputSize && (outW > maxOutputSize || outH > maxOutputSize)) {
    if (outW >= outH) {
      outH = Math.round((outH * maxOutputSize) / outW)
      outW = maxOutputSize
    } else {
      outW = Math.round((outW * maxOutputSize) / outH)
      outH = maxOutputSize
    }
  }

  // 先画到临时的原尺寸 canvas（保留原始像素，供锐化取原图；也便于统一 drawImage 入口）
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = w
  srcCanvas.height = h
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx) throw new Error('Canvas 2D 不可用')
  srcCtx.drawImage(img, 0, 0, w, h)

  // 放大 canvas：用浏览器最高插值质量（bicubic）平滑放大
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D 不可用')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high' // bicubic，最清晰的原生插值
  ctx.drawImage(srcCanvas, 0, 0, w, h, 0, 0, outW, outH)

  // 可选轻度锐化（unsharp mask）：放大后图像偏柔，叠加高频分量让边缘更清亮
  if (sharpen && sharpenAmount > 0) {
    try {
      applyUnsharpMask(canvas, sharpenAmount)
    } catch {
      // 锐化失败（极老环境无 getImageData 权限等）不阻断，保留未锐化结果
    }
  }

  // toDataURL 跨域污染兜底（对齐 imageCompress 的 SecurityError 处理）
  let dataUrl
  try {
    dataUrl = canvas.toDataURL(format)
  } catch (e) {
    throw new Error(`图片放大失败：画布被跨域污染（${e?.name || 'SecurityError'}），请改用本地文件或允许跨域`)
  }
  const blob = dataUrlToBlob(dataUrl)

  return { dataUrl, blob, width: outW, height: outH }
}

/**
 * Unsharp Mask：output = original + amount * (original - blur(original))。
 * 在原画布上就地锐化。用 3x3 box blur 近似高斯，足够轻。
 * @param {HTMLCanvasElement} canvas 放大的画布（就地修改）
 * @param {number} amount 锐化强度 0~2
 */
function applyUnsharpMask(canvas, amount) {
  const W = canvas.width
  const H = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 把原图画到与 canvas 同尺寸的临时缓冲，得到"模糊前参考"。直接用 canvas 本身放大图即 reference。
  // 模糊：对 canvas 当前像素做 3x3 box blur。
  const imgData = ctx.getImageData(0, 0, W, H)
  const data = imgData.data
  const ref = new Uint8ClampedArray(data) // reference = 当前（放大、略糊）像素

  // 3x3 box blur 到 out
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, cnt = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx >= 0 && xx < W && yy >= 0 && yy < H) {
            const i = (yy * W + xx) * 4
            r += data[i]; g += data[i + 1]; b += data[i + 2]; cnt++
          }
        }
      }
      const i = (y * W + x) * 4
      out[i] = r / cnt; out[i + 1] = g / cnt; out[i + 2] = b / cnt
    }
  }

  // USM：pixel' = ref + amount*(ref - blur)
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = ref[i + c] - out[i + c]
      data[i + c] = ref[i + c] + amount * diff
    }
  }
  ctx.putImageData(imgData, 0, 0)
}
