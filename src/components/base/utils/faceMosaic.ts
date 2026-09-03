/**
 * 人脸打码核心算法（完整复刻官方 shared.js 的 sl/cl/ll/fl/pl/dl/ml/hl/gl + _l.jsx + al/ol/vl）。
 *
 * 【依赖】@mediapipe/tasks-vision：FilesetResolver.forVisionTasks + FaceDetector.createFromOptions。
 * 模型 mediapipe/blaze_face_short_range.tflite + wasm 运行时位于 public/mediapipe/（Vite 静态资源；
 * Chrome 扩展下经 chrome.runtime.getURL 解析，复刻官方 rl()）。
 *
 * 【打码模式】（对齐官方 xl/yl）
 *  - mosaic  马赛克（dl：缩小 canvas 再放大，像素块）
 *  - bar     黑条   （fl：色块填充；眼睛处 pl：旋转色条）
 *  - grid    网格   （ml：网格线）
 *  - blur    模糊   （hl：canvas filter blur 局部）
 *
 * 对外主要 API：
 *  - loadFaceDetector()     懒加载 FaceDetector 单例（复刻官方 al）
 *  - detectFaces(imgUrl)    识别人脸区域框列表 [{x,y,w,h}]（复刻官方 vl，供手动编辑器「自动识别人脸」）
 *  - applyMosaic(dataUrl, {mode,strength,color}) 整图打码 → {dataUrl,width,height,faceCount}（复刻官方 _l）
 */

import { FilesetResolver, FaceDetector, type Detection } from '@mediapipe/tasks-vision'
// 图片加载走系统统一入口（asyncGuard 已声明替代本文件的私有实现）：带超时 + crossOrigin + 可取消，
// 超时值统一取 config 的 IMAGE_LOAD_TIMEOUT，不再自带第二套 20s。
import { loadImageWithTimeout } from './asyncGuard.ts'
import { IMAGE_LOAD_TIMEOUT } from '../core/config.ts'

/** 打码模式（对齐官方 xl/yl） */
export type MosaicMode = 'mosaic' | 'bar' | 'grid' | 'blur'

/** 打码区域裁剪形状 */
export type MosaicShape = 'rect' | 'ellipse'

/** 人脸区域框（像素坐标，对齐官方 cl/faceBox/eyeBox 输出） */
export interface FaceBox {
  x: number
  y: number
  w: number
  h: number
}

/** 眼睛关键点连线（复刻官方 sl/eyeLine 输出，bar 模式旋转色条用） */
interface EyeLine {
  lx: number
  ly: number
  rx: number
  ry: number
  dist: number
}

/** 整图打码入参（applyMosaic.opts；均可选） */
export interface MosaicOptions {
  mode?: MosaicMode
  strength?: number
  color?: string
  format?: string
  timeoutMs?: number
}

/** 解析静态资源路径：Chrome 扩展走 runtime.getURL，否则用相对路径（复刻官方 rl） */
function resolveAsset(p: string): string {
  try {
    if (globalThis.chrome?.runtime?.getURL) return globalThis.chrome.runtime.getURL(p)
  } catch {}
  return p
}

let detectorSingleton: Promise<FaceDetector> | null = null

/** 懒加载 FaceDetector 单例（复刻官方 al）：失败则置空下次重试 */
export async function loadFaceDetector(): Promise<FaceDetector> {
  detectorSingleton ||= (async () => {
    const wasm = await FilesetResolver.forVisionTasks(resolveAsset('mediapipe/wasm'))
    return FaceDetector.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath: resolveAsset('mediapipe/blaze_face_short_range.tflite'),
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.4,
    })
  })().catch((e) => {
    detectorSingleton = null
    throw e
  })
  return detectorSingleton
}

/** 眼睛关键点坐标（复刻官方 sl）→ {lx,ly,rx,ry,dist} 或 null */
function eyeLine(e: Detection, imgW: number, imgH: number): EyeLine | null {
  const kp = e.keypoints
  if (!kp || kp.length < 2) return null
  const lx = kp[1].x * imgW, ly = kp[1].y * imgH
  const rx = kp[0].x * imgW, ry = kp[0].y * imgH
  const dist = Math.hypot(lx - rx, ly - ry)
  if (!isFinite(dist) || dist <= 0) return null
  return { lx, ly, rx, ry, dist }
}

/** 人脸区域框（复刻官方 cl）：优先关键点推导，回退 boundingBox */
function faceBox(e: Detection, imgW: number, imgH: number): FaceBox | null {
  const r = eyeLine(e, imgW, imgH)
  if (r) {
    const cx = (r.lx + r.rx) / 2
    const cy = (r.ly + r.ry) / 2
    const a = r.dist * 1.15
    const o = r.dist * 0.7
    const s = r.dist * 1.55
    let x = Math.max(0, Math.floor(cx - a))
    let y = Math.max(0, Math.floor(cy - o))
    let w = Math.min(imgW - x, Math.ceil(a * 2))
    let h = Math.min(imgH - y, Math.ceil(o + s))
    if (w <= 0 || h <= 0) return null
    return { x, y, w, h }
  }
  const bb = e.boundingBox
  if (!bb) return null
  const x = Math.max(0, Math.floor(bb.originX + bb.width * 0.12))
  const y = Math.max(0, Math.floor(bb.originY + bb.height * 0.2))
  const w = Math.min(imgW - x, Math.ceil(bb.width * 0.76))
  const h = Math.min(imgH - y, Math.ceil(bb.height * 0.5))
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

/** 眼睛区域框（复刻官方 ll，供 bar 模式的眼睛条） */
function eyeBox(e: Detection, imgW: number, imgH: number): FaceBox | null {
  const r = eyeLine(e, imgW, imgH)
  if (!r) {
    const bb = e.boundingBox
    if (!bb) return null
    const y = Math.floor(bb.originY + bb.height * 0.28)
    const h = Math.ceil(bb.height * 0.16)
    return { x: Math.floor(bb.originX + bb.width * 0.05), y, w: Math.ceil(bb.width * 0.9), h }
  }
  const cx = (r.lx + r.rx) / 2
  const cy = (r.ly + r.ry) / 2
  const o = r.dist * 1.15
  const s = r.dist * 0.42
  let x = Math.max(0, Math.floor(cx - o))
  let y = Math.max(0, Math.floor(cy - s))
  let w = Math.min(imgW - x, Math.ceil(o * 2))
  let h = Math.min(imgH - y, Math.ceil(s * 2))
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

/** clip 路径（复刻官方 ul）：ellipse 或 rect */
function clipPath(ctx: CanvasRenderingContext2D, box: FaceBox, shape: MosaicShape): void {
  ctx.beginPath()
  if (shape === 'ellipse') ctx.ellipse(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, box.h / 2, 0, 0, Math.PI * 2)
  else ctx.rect(box.x, box.y, box.w, box.h)
  ctx.clip()
}

/** 色块填充（复刻官方 fl，bar 模式身体/面部黑条） */
function fillRect(ctx: CanvasRenderingContext2D, box: FaceBox, alpha = 0.7, color = '#000000'): void {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(box.x, box.y, box.w, box.h)
  ctx.restore()
}

/** 旋转色条（复刻官方 pl，bar 模式眼睛处） */
function rotateFill(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, halfH: number, angle: number, alpha = 0.7, color = '#000000'): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(-r / 2, -halfH / 2, r, halfH)
  ctx.restore()
}

/** 马赛克（复刻官方 dl）：区域缩小再放大，像素块 */
function mosaic(ctx: CanvasRenderingContext2D, srcImg: CanvasImageSource, box: FaceBox, strength = 0.5, shape: MosaicShape = 'rect'): void {
  const a = Math.max(3, Math.round(24 - strength * 20))
  const o = Math.max(1, a)
  const s = Math.max(1, Math.round((box.h / box.w) * a))
  const c = document.createElement('canvas')
  c.width = o
  c.height = s
  const l = c.getContext('2d')
  l.imageSmoothingEnabled = false
  l.drawImage(srcImg, box.x, box.y, box.w, box.h, 0, 0, o, s)
  ctx.save()
  clipPath(ctx, box, shape)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(c, 0, 0, o, s, box.x, box.y, box.w, box.h)
  ctx.imageSmoothingEnabled = true
  ctx.restore()
}

/** 网格线（复刻官方 ml） */
function grid(ctx: CanvasRenderingContext2D, box: FaceBox, strength = 0.5, color = '#000000'): void {
  ctx.save()
  const step = Math.max(3, Math.round(18 - strength * 14))
  ctx.globalAlpha = 0.6
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = box.x; x <= box.x + box.w; x += step) { ctx.moveTo(x + 0.5, box.y); ctx.lineTo(x + 0.5, box.y + box.h) }
  for (let y = box.y; y <= box.y + box.h; y += step) { ctx.moveTo(box.x, y + 0.5); ctx.lineTo(box.x + box.w, y + 0.5) }
  ctx.stroke()
  ctx.restore()
}

/** 模糊（复刻官方 hl）：区域局部 blur */
function blur(ctx: CanvasRenderingContext2D, srcImg: CanvasImageSource, box: FaceBox, strength = 0.5, shape: MosaicShape = 'rect'): void {
  const a = Math.max(3, Math.round(box.w * (0.04 + strength * 0.16)))
  ctx.save()
  clipPath(ctx, box, shape)
  ctx.filter = `blur(${a}px)`
  const o = a
  ctx.drawImage(srcImg, Math.max(0, box.x - o), Math.max(0, box.y - o), box.w + o * 2, box.h + o * 2, box.x - o, box.y - o, box.w + o * 2, box.h + o * 2)
  ctx.restore()
}

/** 打码分派（复刻官方 gl）：ctx 为当前绘制上下文，srcImg 为原图（mosaic/blur 用） */
function applyMode(ctx: CanvasRenderingContext2D, srcImg: CanvasImageSource, box: FaceBox, mode: MosaicMode, strength = 0.5, shape: MosaicShape = 'rect', color = '#000000'): void {
  if (box.w <= 0 || box.h <= 0) return
  if (mode === 'mosaic') mosaic(ctx, srcImg, box, strength, shape)
  else if (mode === 'bar') fillRect(ctx, box, strength, color)
  else if (mode === 'grid') grid(ctx, box, strength, color)
  else if (mode === 'blur') blur(ctx, srcImg, box, strength, shape)
}

/**
 * 识别人脸区域框列表（复刻官方 vl）→ [{x,y,w,h}, ...]
 * 供手动打码编辑器「自动识别人脸」用。
 */
export async function detectFaces(imgUrl: string, timeoutMs: number = IMAGE_LOAD_TIMEOUT): Promise<FaceBox[]> {
  const detector = await loadFaceDetector()
  const img = await loadImageWithTimeout(imgUrl, { timeoutMs })
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const res = detector.detect(img)
  const boxes: FaceBox[] = []
  for (const d of res.detections || []) {
    const b = faceBox(d, w, h)
    if (b) boxes.push(b)
  }
  return boxes
}

/**
 * 整图打码（复刻官方 _l）→ { dataUrl, width, height, faceCount }
 * @param {string} dataUrl 图片 dataURL / URL
 * @param {{mode?:'mosaic'|'bar'|'grid'|'blur', strength?:number, color?:string, format?:string, timeoutMs?:number}} opts
 */
export async function applyMosaic(dataUrl: string, opts: MosaicOptions = {}): Promise<{ dataUrl: string; width: number; height: number; faceCount: number }> {
  const { mode = 'mosaic', strength = 0.5, color = '#000000', format = 'image/png', timeoutMs = IMAGE_LOAD_TIMEOUT } = opts
  const detector = await loadFaceDetector()
  const img = await loadImageWithTimeout(dataUrl, { timeoutMs })
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) throw new Error('无法获取图片尺寸')

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D 不可用')
  ctx.drawImage(img, 0, 0, w, h)

  const detections = detector.detect(img).detections || []
  let faceCount = 0
  for (const d of detections) {
    if (mode === 'bar') {
      // 对齐官方 _l.jsx bar 分支：先 sl(eyeLine) → pl(rotateFill)；
      // 无关键点则 ll(eyeBox) → fl(fillRect)；否则跳过。无 faceBox 兜底。
      const line = eyeLine(d, w, h)
      if (line) {
        const cx = (line.lx + line.rx) / 2
        const cy = (line.ly + line.ry) / 2
        const angle = Math.atan2(line.ly - line.ry, line.lx - line.rx)
        rotateFill(ctx, cx, cy, line.dist * 2.3, line.dist * 0.85, angle, strength, color)
        faceCount++
      } else {
        const eye = eyeBox(d, w, h)
        if (!eye) continue
        fillRect(ctx, eye, strength, color)
        faceCount++
      }
      continue
    }
    const box = faceBox(d, w, h)
    if (!box) continue
    faceCount++
    applyMode(ctx, img, box, mode, strength, mode === 'mosaic' || mode === 'blur' ? 'ellipse' : 'rect', color)
  }

  return {
    dataUrl: canvas.toDataURL(format, format === 'image/png' ? undefined : 0.92),
    width: w,
    height: h,
    faceCount,
  }
}

/** 打码模式定义（复刻官方 xl/yl） */
export const MOSAIC_MODES: Array<{ mode: MosaicMode; label: string }> = [
  { mode: 'mosaic', label: '马赛克' },
  { mode: 'bar', label: '黑条' },
  { mode: 'grid', label: '网格' },
  { mode: 'blur', label: '模糊' },
]

/** 供手动编辑器复用的底层绘制：在 ctx 上对某个 box 应用打码（复刻官方 gl） */
export function drawMosaicOnBox(ctx: CanvasRenderingContext2D, srcImg: CanvasImageSource, box: FaceBox, mode: MosaicMode, strength = 0.5, shape: MosaicShape = 'rect', color = '#000000'): void {
  applyMode(ctx, srcImg, box, mode, strength, shape, color)
}

/** 供手动编辑器复用：识别图片的色板（复刻官方 _Component55 的取色数组） */
export const MOSAIC_PALETTE: string[] = ['#000000', '#ffffff', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#a855f7', '#ec4899']
