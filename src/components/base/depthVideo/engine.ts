/**
 * 深度转视频 —— 纯逻辑层（与 DOM / React 解耦，可单元测试）。
 *
 * 依据集成设计稿 §6/§8：把 Downloads `depth-video-converter/app.js`（独立页 DOM 版）中与 DOM 无关的
 * 计算剥离成纯函数，供 DepthVideoModal 调用，并天然可复用（§10.5-p2，未来抠图等工具）。
 *
 * 职责边界：
 *  - 本文件只做「数据 → 数据」的纯计算：灰度化、对比度/反色、帧间混合、格式探测、输出命名、下游节点规格；
 *  - 不触碰 document/canvas/video/MediaRecorder（这些留在组件层）；不 import 重量级运行时。
 */

/** 数值夹取 [min,max] */
export function clampInt(value: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, value))
}

/** 深度值对比度/反色调整（port 自 app.js adjustDepthValue） */
export function adjustDepthValue(value: number, options: { contrast: number; invert: boolean }): number {
  const contrast = Number.isFinite(options.contrast) ? options.contrast : 1
  const contrasted = (value - 128) * contrast + 128
  const adjusted = options.invert ? 255 - contrasted : contrasted
  return clampInt(Math.round(adjusted), 0, 255)
}

/** 单个像素 → 灰度值（RGB 三通道平均；通道不足则复用首通道） */
function grayOfPixel(data: ArrayLike<number>, i: number, channels: number): number {
  const r = data[i] ?? 0
  const g = channels > 1 ? data[i + 1] : r
  const b = channels > 2 ? data[i + 2] : r
  return (r + g + b) / 3
}

/** 归一化 float tensor（{data, dims}）→ 每像素 0..255 灰度（min-max 归一化；全等不除零） */
export function grayFromTensor(
  data: ArrayLike<number>,
  dims: number[],
  options: { contrast: number; invert: boolean }
): Float32Array {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < data.length; i += 1) {
    const v = data[i]
    if (Number.isFinite(v)) {
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  const scale = max > min ? 255 / (max - min) : 1
  const out = new Float32Array(data.length)
  for (let i = 0; i < data.length; i += 1) {
    const normalized = ((data[i] as number) - (Number.isFinite(min) ? min : 0)) * scale
    out[i] = adjustDepthValue(normalized, options)
  }
  return out
}

/**
 * raw RGB {data,width,height,channels} → 每像素 0..255 灰度（平均亮度 + 对比度/反色）。
 * port 自 app.js rawToImageData 的逐像素计算（去掉 canvas 绘制）。
 */
export function grayFromRaw(
  raw: { data: ArrayLike<number>; width: number; height: number; channels?: number },
  options: { contrast: number; invert: boolean }
): Float32Array {
  const channels = raw.channels || 4
  const out = new Float32Array(raw.width * raw.height)
  for (let i = 0, p = 0; i < raw.data.length; i += channels, p += 1) {
    out[p] = adjustDepthValue(grayOfPixel(raw.data, i, channels), options)
  }
  return out
}

/**
 * 快速预览伪深度（亮度伪深度，无需模型）→ 每像素 0..255。
 * port 自 app.js drawFastDepth 的计算核心（去 canvas；输入为 RGBA 亮度数组）。
 */
export function fastDepthFromSource(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  options: { contrast: number; invert: boolean }
): Float32Array {
  const n = width * height
  const lum = new Float32Array(n)
  for (let i = 0, p = 0; i < rgba.length; i += 4, p += 1) {
    lum[p] = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114
  }
  const out = new Float32Array(n)
  for (let y = 0; y < height; y += 1) {
    const yBias = y / Math.max(1, height - 1)
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const left = lum[y * width + Math.max(0, x - 1)]
      const right = lum[y * width + Math.min(width - 1, x + 1)]
      const up = lum[Math.max(0, y - 1) * width + x]
      const down = lum[Math.min(height - 1, y + 1) * width + x]
      const edge = Math.min(255, Math.abs(right - left) + Math.abs(down - up))
      const lumaDepth = 255 - lum[idx]
      out[idx] = adjustDepthValue(lumaDepth * 0.45 + yBias * 120 + edge * 0.35, options)
    }
  }
  return out
}

/**
 * 帧间平滑混合：prev ← smooth，curr ← (1-smooth)。smooth 越界被夹取到 [0,1]。
 * port 自 app.js commitDepthFrame 的混合循环（作用于灰度值数组，去 RGBA/ canvas）。
 */
export function blendFrames(
  prev: ArrayLike<number>,
  curr: ArrayLike<number>,
  length: number,
  smooth: number
): Uint8ClampedArray {
  const blend = clampInt(smooth, 0, 1)
  const out = new Uint8ClampedArray(length)
  for (let i = 0; i < length; i += 1) {
    out[i] = Math.round((curr[i] ?? 0) * (1 - blend) + (prev[i] ?? 0) * blend)
  }
  return out
}

/** 录制格式探测结果 */
export interface RecordingFormat {
  mimeType: string
  extension: 'mp4' | 'webm'
  /** 显式 mp4 但浏览器不支持，回退 webm 时置 true */
  fellBackToWebm: boolean
}

/**
 * 录制格式探测：auto 优先 mp4 否则 webm；webm 显式直接 webm；mp4 显式志愿 mp4（不支持如实报错，
 * 不静默替换）。port 自 app.js pickRecordingFormat，isTypeSupported 以参数注入便于单测。
 */
export function pickRecordingFormat(
  preferred: 'auto' | 'mp4' | 'webm',
  isTypeSupported: (mime: string) => boolean
): RecordingFormat {
  const mp4Types = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1.64001F',
    'video/mp4;codecs=h264',
    'video/mp4',
  ]
  const webmTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

  if (preferred === 'webm') {
    const mime = webmTypes.find((t) => isTypeSupported(t))
    if (!mime) throw new Error('当前浏览器不支持导出视频，请换 Chrome 或 Edge。')
    return { mimeType: mime, extension: 'webm', fellBackToWebm: false }
  }

  const candidates = [...mp4Types, ...webmTypes]
  const mime = candidates.find((t) => isTypeSupported(t))
  if (!mime) throw new Error('当前浏览器不支持导出视频，请换 Chrome 或 Edge。')
  const extension = mime.includes('mp4') ? 'mp4' : 'webm'
  return { mimeType: mime, extension, fellBackToWebm: preferred === 'mp4' && extension === 'webm' }
}

/** 文件名去扩展名（port 自 VideoProcessNode 局部 stripExt） */
export function stripExtOf(name: string): string {
  return (name || '').replace(/\.[^.]+$/, '') || 'video'
}

/** 产出深度视频输出文件名：`${去扩展名源名}_depth.${ext}`（不覆盖源名，对应设计稿 R7） */
export function depthOutputName(sourceName: string, extension: string): string {
  return `${stripExtOf(sourceName)}_depth.${extension}`
}

/**
 * 下游深度视频节点规格（spawn 的唯一数据构造点，对应设计稿 D4/§6.8）。
 * 只定「节点类型 + data 契约」；position 由 spawn 侧的右缘排布（getNode + measured.width）计算，
 * 不放这里（避免与 spawnVideoNode 的右缘语义冲突）。被 depthVideo/spawn.ts 的 spawnDepthVideoNode 复用。
 */
export function buildDepthChildSpec(outputUrl: string, name: string): {
  type: string
  data: Record<string, unknown>
} {
  return {
    type: 'imageNode',
    data: { imageUrl: outputUrl, mediaType: 'video', label: name, expanded: true },
  }
}