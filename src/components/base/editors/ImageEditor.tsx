import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Pencil, Eraser, Crop, Square, Circle, Minus, MoveUpRight, ListOrdered,
  Pipette, Type, Undo2, Trash2, ZoomIn, ZoomOut, Maximize, X, Check,
  Expand
} from 'lucide-react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { logger } from '../core/logger.ts'
import { createRafBatch } from '../core/utils.ts'
import { toastError } from '../core/toastStore.ts'

/**
 * 全屏图片编辑器（复刻官方 _Component129.jsx 图片编辑 / ImageNode 的「裁剪」「标记」入口）。
 *
 * 【为什么用 react-image-crop（抉择）】
 * 官方裁剪就用 react-image-crop（混淆名 _Component27 / To.jsx）。它是成熟库，裁剪的
 * 拖拽选区、比例锁定、ruleOfThirds 三分线、遮罩全是现成实现，自造纯属重复造轮子且易出
 * 坐标换算 bug。故直接复用官方同款库，裁剪交互与官方一致。
 *
 * 【入口与工具（抉择）】
 * ImageNode 的 hover 工具栏两颗按钮打开本编辑器：
 *  - 「裁剪」(Crop)  → initialTool='crop'：进入裁剪模式（ReactCrop 选区 + 比例下拉 + 确认裁剪）；
 *  - 「标记」(Pencil) → initialTool='pencil'：进入画笔/涂鸦模式（画笔/橡皮擦/文字/形状/序号/吸管）。
 * 官方是**同一个编辑器**只是 initialTool 不同（_Component129 的 t prop）——故一组件两入口。
 *
 * 【绘制 + 裁剪共存的方式（抉择，对齐官方）】
 * 底层是一个 canvas（绘制/涂鸦都画在它上面），ReactCrop 作为裁剪层叠在 canvas 外：
 *  - 裁剪模式（tool==='crop'）：ReactCrop disabled=false，可拖选区；canvas 上禁绘制（不响应绘制事件）；
 *  - 绘制模式：ReactCrop disabled=true（不拦截鼠标），canvas 响应绘制。
 * 确认裁剪时把 ReactCrop 的 percentCrop 换算成 canvas 像素坐标 → getImageData 裁切（官方 537-574 同款）。
 * 这样「先涂鸦再裁剪」或「先裁剪再涂鸦」都能正确合并到同一 canvas。
 *
 * 【接真实系统】
 * 官方保存调 `_cmp_Er(canvas.toDataURL('image/jpeg',0.9), 2048, 0.85)`（压缩+上传本地）后回写节点
 * imageUrl。本组件 onSave 直接回传 canvas 的 dataURL；接真系统时在 ImageNode 的 onSave 里改走
 * 「上传 localTool /files/ + 写回 imageUrl」即可，编辑器内部无需改。
 *
 * @param {Object} props
 * @param {string} props.imageUrl    要编辑的图片 URL（dataURL / http / blob）
 * @param {string} props.initialTool 初始工具：'crop' 或 'pencil'（或官方其它工具名）
 * @param {Function} props.onSave    保存回调，入参 { dataUrl }
 * @param {Function} props.onClose   关闭回调
 */

/** 全屏图片编辑器 Props。 */
interface ImageEditorProps {
  /** 要编辑的图片 URL（dataURL / http / blob） */
  imageUrl: string
  /** 初始工具：'crop' 或绘制工具，未知值回退 'pencil' */
  initialTool?: string
  /** 保存回调，入参 { dataUrl, width, height }（width/height 为最终画布真实像素尺寸，供节点按真实比例自适应） */
  onSave?: (payload: { dataUrl: string; width: number; height: number }) => void
  /** 关闭回调 */
  onClose?: () => void
}

// 可绘制/标记工具集合（裁剪在 ReactCrop 层处理，不参与 canvas 绘制）
const DRAW_TOOLS = ['pencil', 'eraser', 'text', 'line', 'arrow', 'square', 'circle', 'number', 'eyedropper']
// 全部可用工具（含裁剪、扩图）
const ALL_TOOLS = [...DRAW_TOOLS, 'crop', 'expand']

// 裁剪比例选项（官方 _Component129:530-535）
const CROP_RATIOS = [
  { label: '自由尺寸', value: undefined },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
]

/* ── 扩图工具（复刻 AI-Canvas ExpandEditor）──
 * 扩图是独立于裁剪的工具：不选内部区域，而是「原图整体 + 四周白边」。
 * 交互参考 AI-Canvas ExpandEditor：
 *  - 目标比例：扩图后整张图的画幅（如 1:1 / 16:9），原图按比例「贴边内接」；
 *  - 画布放大倍数 factor（1~√2，滑块从左到右白边越来越多）：目标画布 = 原图内接尺寸 × factor，
 *    面积随 factor² 增长，factor=√2 时整张图面积恰好是原图内接面积的 2 倍（白边最多上限）；
 *  - 原图可在目标画布内拖动（offset 归一化 [-0.5, 0.5]）。
 * 原图始终保持原始分辨率，不拉伸，只放大画布留白。
 * factor 与内部 computeOutpaintTarget 的 zoom 语义相反（zoom = 1/factor）。 */
const OUTPAINT_FACTOR_MIN = 1
const OUTPAINT_FACTOR_MAX = Math.SQRT2 // 面积 = factor² 倍 → 最多 2 倍面积
const OUTPAINT_FACTOR_STEP = 0.01
// 内部 computeOutpaintTarget 的 zoom（= 1/factor）边界：factor∈[1,√2] → zoom∈[1/√2,1]
const OUTPAINT_ZOOM_MIN = 1 / OUTPAINT_FACTOR_MAX
const OUTPAINT_ZOOM_MAX = 1 / OUTPAINT_FACTOR_MIN
/** 扩图白边填充色（纯白）。 */
export const OUTPAINT_FILL = '#ffffff'

/** 扩图目标比例选项（AI-Canvas ExpandEditor ASPECT_OPTIONS 同款）。 */
export const OUTPAINT_RATIOS = [
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 },
  { key: '3:4', label: '3:4', ratio: 3 / 4 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
] as const

/**
 * 计算扩图目标画布（纯函数，可单测）。
 *
 * @param srcW 原图自然宽
 * @param srcH 原图自然高
 * @param ratio 目标画幅比例（宽/高）；不传则用原图比例（只外扩不改画幅）
 * @param zoom 外扩量（0.3~1，越小白边越多）；越界自动钳制
 * @returns 目标画布 tw×th、原图尺寸 sw×sh、原图可移动范围 maxOffX/maxOffY（自然像素）
 */
export function computeOutpaintTarget(
  srcW: number,
  srcH: number,
  ratio: number | undefined,
  zoom: number,
): { tw: number; th: number; sw: number; sh: number; maxOffX: number; maxOffY: number } {
  const sw = Math.max(1, Math.round(srcW))
  const sh = Math.max(1, Math.round(srcH))
  const srcRatio = sw / sh
  const r = ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : srcRatio
  // 按目标比例让原图「贴边内接」得 base 画布
  let baseW: number
  let baseH: number
  if (r >= srcRatio) {
    // 目标更宽 → 高度贴边
    baseH = sh
    baseW = Math.round(sh * r)
  } else {
    // 目标更高 → 宽度贴边
    baseW = sw
    baseH = Math.round(sw / r)
  }
  // 除以 zoom 放大画布，使原图四周留白
  const z = Math.max(OUTPAINT_ZOOM_MIN, Math.min(OUTPAINT_ZOOM_MAX, zoom))
  const tw = Math.round(baseW / z)
  const th = Math.round(baseH / z)
  return {
    tw,
    th,
    sw,
    sh,
    maxOffX: (tw - sw) / 2,
    maxOffY: (th - sh) / 2,
  }
}

/**
 * 由「归一化偏移 offset（[-0.5,0.5]）」计算原图在目标画布内的绘制起点（纯函数，可单测）。
 * offset=-0.5 → 贴左/贴上；+0.5 → 贴右/贴下；0 → 居中。
 */
export function computeOutpaintDrawPos(
  offset: { x: number; y: number },
  maxOffX: number,
  maxOffY: number,
): { dx: number; dy: number } {
  return {
    dx: Math.round(maxOffX + Math.max(-0.5, Math.min(0.5, offset.x)) * 2 * maxOffX),
    dy: Math.round(maxOffY + Math.max(-0.5, Math.min(0.5, offset.y)) * 2 * maxOffY),
  }
}

export default function ImageEditor({ imageUrl, initialTool = 'pencil', onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef(null)
  const viewportRef = useRef(null) // 可滚动画布容器
  const imgRef = useRef(null) // 原始图（清空/橡皮擦恢复用）

  // 初始工具：'crop' 或绘制工具都在 ALL_TOOLS 里；未知值回退 'pencil'
  const [tool, setTool] = useState(ALL_TOOLS.includes(initialTool) ? initialTool : 'pencil')
  const [color, setColor] = useState('#ff0000')
  const [lineWidth, setLineWidth] = useState(3)
  const [drawing, setDrawing] = useState(false)
  const [history, setHistory] = useState([]) // getImageData 撤销栈
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [panning, setPanning] = useState(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [seq, setSeq] = useState(1)
  const [textInput, setTextInput] = useState(null)
  const textInputRef = useRef(null) // 文字输入框 ref：动态出现时显式聚焦（autoFocus 不可靠）

  // 文字输入框出现时显式聚焦并定位光标到末尾（autoFocus 在 mousedown 触发的动态渲染里不可靠，
  // 导致输入框弹出却无焦点、看不到闪烁光标、打不了字）。
  useEffect(() => {
    if (textInput && textInputRef.current) {
      const el = textInputRef.current
      el.focus()
      const len = el.value.length
      try { el.setSelectionRange(len, len) } catch {}
    }
  }, [textInput])

  // 裁剪态（ReactCrop）
  const [crop, setCrop] = useState(undefined)
  const [completedCrop, setCompletedCrop] = useState(undefined)
  const [cropAspect, setCropAspect] = useState(undefined)

  // 扩图态（独立工具）：目标比例 + 画布放大倍数 factor + 原图拖动偏移（归一化 [-0.5,0.5]）
  const [outpaintRatioKey, setOutpaintRatioKey] = useState('1:1')
  const [outpaintFactor, setOutpaintFactor] = useState(1) // 默认 1 = 无白边、原图铺满（factor 越大白边越多）
  const [outpaintOffset, setOutpaintOffset] = useState({ x: 0, y: 0 })

  const scrollRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  // 工具切换时给裁剪态初始化默认选区（复刻 To.jsx onLoad 里 centerCrop 80%）
  useEffect(() => {
    if (tool === 'crop' && !crop && imgSize.w && imgSize.h) {
      setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 80 }, cropAspect || 16 / 9, imgSize.w, imgSize.h), imgSize.w, imgSize.h))
    }
  }, [tool, crop, cropAspect, imgSize])

  // 加载图片 → 铺 canvas 原始尺寸 + 初始缩放适配
  // 【根本原因说明（为什么用 cancelled 而非 cleanup 里清 onload）】
  // React.StrictMode 会把 useEffect 执行两遍：挂载 → 清理 → 再挂载。若在 cleanup 里写
  // `im.onload = null`，会在「第一次挂载创建的 img 还在异步下载」时就把它的 onload 清掉，
  // 下载完成后的 onload 回调因已被置 null 而永不触发 → canvas 永远画不出图（且第二次挂载
  // 的 img 因浏览器缓存时序也不稳定）。正确做法是：cleanup 只置 `cancelled = true` 标记
  // 「这次加载已被废弃」，onload 里检查该标记再决定是否画图——既不误清回调，也防止旧图
  // 晚到覆盖新图（imageUrl 变化时）。
  useEffect(() => {
    const canvas = canvasRef.current
    // willReadFrequently：本编辑器每画一笔都要 getImageData 存撤销历史（频繁读回），
    // 首次取 context 即声明该优化，消除浏览器的 "Multiple readback operations" 性能警告。
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx || !imageUrl) return
    let cancelled = false
    // 把图片画进 canvas 的公共函数（onload 调用）
    const drawImg = (im) => {
      if (cancelled) return
      try {
        canvas.width = im.naturalWidth
        canvas.height = im.naturalHeight
        ctx.drawImage(im, 0, 0)
        imgRef.current = im
        setImgSize({ w: im.naturalWidth, h: im.naturalHeight })
        const vp = viewportRef.current
        if (vp) {
          const s = Math.min((vp.clientWidth - 32) / im.naturalWidth, (vp.clientHeight - 32) / im.naturalHeight, 1)
          setZoom(s > 0 ? s : 1)
        }
        setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)])
      } catch (err) {
        logger.warn('ImageEditor', '图片绘制失败（跨域污染？）', err.message)
      }
    }
    // 图片加载：dataURL/blob 无需 crossOrigin；http 跨域图先试 crossOrigin（保证 canvas 不被
    // 污染、保存 toDataURL 可用），onerror 再回退普通加载（牺牲 toDataURL 换取能显示图）。
    const tryLoad = (withCors) => {
      const im = new Image()
      if (withCors) im.crossOrigin = 'Anonymous'
      im.onload = () => drawImg(im)
      im.onerror = () => { if (withCors) tryLoad(false) }
      im.src = imageUrl
      return im
    }
    tryLoad(true)
    return () => { cancelled = true }
  }, [imageUrl])

  const clampZoom = useCallback((z) => Math.min(8, Math.max(0.05, z)), [])
  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z * 1.2)), [clampZoom])
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(z / 1.2)), [clampZoom])
  const resetZoom = useCallback(() => setZoom(1), [])
  const fitZoom = useCallback(() => {
    const vp = viewportRef.current
    if (!vp || !imgSize.w || !imgSize.h) { setZoom(1); return }
    setZoom(clampZoom(Math.min((vp.clientWidth - 32) / imgSize.w, (vp.clientHeight - 32) / imgSize.h, 1)))
  }, [imgSize, clampZoom])

  // 滚轮缩放（画布区）；P3：高频 → rAF 合并 setZoom（last-args-wins，每帧只按最新 deltaY 缩放一次）。
  // 用原生 addEventListener({ passive: false }) 绑定：React 的 onWheel 是被动监听器，
  // 其 preventDefault() 无效且触发 "Unable to preventDefault inside passive event listener" 告警；
  // 原生非被动监听才能拦截页面滚动、独占画布滚轮缩放。
  const wheelRaf = useRef(null)
  if (wheelRaf.current == null) {
    wheelRaf.current = createRafBatch((deltaY) => setZoom((z) => clampZoom(z * (deltaY < 0 ? 1.1 : 0.9))))
  }
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      wheelRaf.current?.(e.deltaY)
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [])

  // 空格平移
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !textInput) { e.preventDefault(); setSpaceDown(true) }
    }
    const up = (e) => { if (e.code === 'Space') { setSpaceDown(false); setPanning(false) } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [textInput])

  const onPanStart = useCallback((e) => {
    const vp = viewportRef.current
    if (!vp) return
    e.preventDefault()
    setPanning(true)
    scrollRef.current = { x: e.clientX, y: e.clientY, scrollLeft: vp.scrollLeft, scrollTop: vp.scrollTop }
  }, [])
  useEffect(() => {
    if (!panning) return
    // P3：move 高频 → rAF 合并 scrollLeft/Top 写入（last-args-wins，move 直接用最新坐标算绝对滚动量）
    const batch = createRafBatch((clientX, clientY) => {
      const vp = viewportRef.current
      if (vp) {
        vp.scrollLeft = scrollRef.current.scrollLeft - (clientX - scrollRef.current.x)
        vp.scrollTop = scrollRef.current.scrollTop - (clientY - scrollRef.current.y)
      }
    })
    const move = (e) => batch(e.clientX, e.clientY)
    const up = () => {
      batch.flush() // 松手补最后一帧，避免视口差一帧
      setPanning(false)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); batch.cancel() }
  }, [panning])

  // 事件坐标 → canvas 像素坐标（复刻官方 ce()）
  const toCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const cxp = 'touches' in e ? e.touches[0].clientX : e.clientX
    const cyp = 'touches' in e ? e.touches[0].clientY : e.clientY
    return { x: (cxp - rect.left) * (canvas.width / rect.width), y: (cyp - rect.top) * (canvas.height / rect.height) }
  }, [])

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) setHistory((h) => [...h, ctx.getImageData(0, 0, canvas.width, canvas.height)])
  }, [])

  // 文字确认写入：有字 → 落笔并关闭；空字（如误失焦）→ 保留输入框，避免误关。
  // 【为何放这里】onDrawStart 里要引用 commitText（点画布空白=保存文字），而 const 有暂时性
  // 死区，若 commitText 定义在 onDrawStart 之后会报 "Cannot access before initialization"，
  // 故把 commitText 提前到 onDrawStart 之前。
  const commitText = useCallback(() => {
    if (!textInput) return
    const text = (textInput.text || '').trim()
    if (!text) return // 空文本不关闭，让用户继续输入
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      // canvas 屏幕显示尺寸 = 内部像素 × zoom，故字体用内部像素时需 /zoom，
      // 落笔后屏幕显示大小才与输入框一致（不会"保存后变小"），且随滑块(lineWidth)增减。
      const fontSize = Math.max(20, lineWidth * 5) / (zoom > 0 ? zoom : 1)
      pushHistory()
      ctx.fillStyle = color
      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(text, textInput.x, textInput.y + fontSize * 0.1)
    }
    setTextInput(null)
  }, [textInput, color, lineWidth, zoom, pushHistory])

  // 撤销
  const undo = useCallback(() => {
    if (history.length <= 1) return
    const next = history.slice(0, -1)
    setHistory(next)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const last = next[next.length - 1]
    canvas.width = last.width
    canvas.height = last.height
    ctx.putImageData(last, 0, 0)
  }, [history])

  // 清空涂鸦（恢复原始图）
  const clearAll = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !imgRef.current) return
    canvas.width = imgRef.current.naturalWidth
    canvas.height = imgRef.current.naturalHeight
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(imgRef.current, 0, 0)
    setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)])
    setSeq(1)
  }, [])

  // 绘制开始
  const onDrawStart = useCallback((e) => {
    if (tool === 'crop') return // 裁剪模式由 ReactCrop 处理
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { x, y } = toCanvasPos(e)
    // shape（square/circle/line/arrow）：记录起始点供 onShapePreview 实时重画
    if (['square', 'circle', 'line', 'arrow'].includes(tool)) lastCropStart.current = { x, y }
    if (tool === 'eyedropper') {
      const px = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data
      setColor(`#${`000000${(px[0] << 16 | px[1] << 8 | px[2]).toString(16)}`.slice(-6)}`)
      setTool('pencil')
      return
    }
    if (tool === 'text') {
      e.preventDefault()
      // 若已在输入中（textInput 存在），用户点击画布空白 = 确认当前文字并保存（点外部自动保存），不重开。
      if (textInput) {
        commitText()
        return
      }
      // 首次点图：在该位置创建文字输入框
      const vp = viewportRef.current
      const vpRect = vp?.getBoundingClientRect()
      const cxp = 'touches' in e ? e.touches[0].clientX : e.clientX
      const cyp = 'touches' in e ? e.touches[0].clientY : e.clientY
      setTextInput({
        x, y,
        left: vpRect ? cxp - vpRect.left + (vp.scrollLeft || 0) : cxp,
        top: vpRect ? cyp - vpRect.top + (vp.scrollTop || 0) : cyp,
        text: '',
      })
      return
    }
    setDrawing(true)
    if (tool === 'pencil') {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.strokeStyle = color
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    } else if (tool === 'eraser') {
      if (imgRef.current) {
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, lineWidth * 3, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height); ctx.restore()
      }
    } else if (tool === 'number') {
      pushHistory()
      ctx.beginPath(); ctx.arc(x, y, Math.max(15, lineWidth * 3), 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${Math.max(16, lineWidth * 3)}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(seq), x, y + 1)
      setSeq((s) => s + 1)
      setDrawing(false)
    } else {
      // shape：画前存历史，便于实时预览回退
      pushHistory()
    }
  }, [tool, color, lineWidth, seq, pushHistory, toCanvasPos, textInput, commitText])

  // 绘制进行
  const onDrawMove = useCallback((e) => {
    if (!drawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { x, y } = toCanvasPos(e)
    if (tool === 'pencil') {
      ctx.lineTo(x, y); ctx.stroke()
    } else if (tool === 'eraser') {
      if (imgRef.current) {
        ctx.save(); ctx.beginPath(); ctx.arc(x, y, lineWidth * 3, 0, Math.PI * 2); ctx.clip()
        ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height); ctx.restore()
      }
    }
  }, [drawing, tool, lineWidth, toCanvasPos])

  // 绘制结束（shape 收尾：从最近历史重画）
  const onDrawEnd = useCallback(() => {
    if (tool === 'pencil' && drawing) pushHistory()
    setDrawing(false)
  }, [tool, drawing, pushHistory])

  // shape 实时预览：每次 move 从历史快照重画 + 画当前 shape
  const onShapePreview = useCallback((e) => {
    if (!drawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { x, y } = toCanvasPos(e)
    const last = history[history.length - 1]
    if (!last) return
    ctx.putImageData(last, 0, 0)
    const start = lastCropStart.current || { x, y }
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (tool === 'square') ctx.rect(start.x, start.y, x - start.x, y - start.y)
    else if (tool === 'circle') { const r = Math.sqrt((x - start.x) ** 2 + (y - start.y) ** 2); ctx.arc(start.x, start.y, r, 0, Math.PI * 2) }
    else if (tool === 'line') { ctx.moveTo(start.x, start.y); ctx.lineTo(x, y) }
    else if (tool === 'arrow') {
      const head = Math.max(10, lineWidth * 3)
      const dx = x - start.x, dy = y - start.y, ang = Math.atan2(dy, dx)
      ctx.moveTo(start.x, start.y); ctx.lineTo(x, y)
      ctx.moveTo(x, y); ctx.lineTo(x - head * Math.cos(ang - Math.PI / 6), y - head * Math.sin(ang - Math.PI / 6))
      ctx.moveTo(x, y); ctx.lineTo(x - head * Math.cos(ang + Math.PI / 6), y - head * Math.sin(ang + Math.PI / 6))
    }
    ctx.stroke()
  }, [drawing, tool, color, lineWidth, history, toCanvasPos])

  // canvas 移动统一分发：画笔/橡皮走 onDrawMove（实时连线），其它形状走 onShapePreview（快照重画）。
  // 【修复】此前 onMouseMove 只绑了 onShapePreview，导致 pencil 的 onDrawMove 永远不被调用 → 画笔画不出线。
  const handleCanvasMove = useCallback((e) => {
    if (tool === 'pencil' || tool === 'eraser') onDrawMove(e)
    else onShapePreview(e)
  }, [tool, onDrawMove, onShapePreview])

  // 把当前 canvas 的像素作为「新的底图」回填到 imgRef，供后续裁剪/扩图复用。
  // 这是裁剪↔扩图收口的关键：每一步的结果都成为下一步的输入，两者可任意先后、可重复。
  const commitCanvasToImgRef = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.width || !canvas.height) return
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
    }
    img.src = canvas.toDataURL('image/png')
  }, [])

  // 确认裁剪（复刻官方 537-574）：把 ReactCrop 的 crop 换算成 canvas 像素 → 裁切。
  // 裁剪只往内裁，不做外扩；外扩白边由独立的「扩图」工具承担。
  const applyCrop = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !completedCrop?.width || !completedCrop?.height) return
    const scaleX = canvas.width / canvas.offsetWidth
    const scaleY = canvas.height / canvas.offsetHeight
    const px = Math.round(completedCrop.x * scaleX)
    const py = Math.round(completedCrop.y * scaleY)
    const pw = Math.round(completedCrop.width * scaleX)
    const ph = Math.round(completedCrop.height * scaleY)
    const sx = Math.max(0, Math.min(px, canvas.width))
    const sy = Math.max(0, Math.min(py, canvas.height))
    const sw = Math.max(1, Math.min(pw, canvas.width - sx))
    const sh = Math.max(1, Math.min(ph, canvas.height - sy))
    const data = ctx.getImageData(sx, sy, sw, sh)
    pushHistory()
    canvas.width = sw
    canvas.height = sh
    ctx.putImageData(data, 0, 0)
    // 裁剪结果回填为新的底图（不再置 null），后续扩图/再裁剪均以此为基础
    commitCanvasToImgRef()
    setImgSize({ w: sw, h: sh })
    setCrop(undefined)
    setCompletedCrop(undefined)
    setTool('pencil')
  }, [completedCrop, pushHistory, commitCanvasToImgRef])

  const lastCropStart = useRef({ x: 0, y: 0 })

  // ── 扩图工具（独立，复刻 AI-Canvas ExpandEditor）──
  // 用「当前底图」按「目标比例 + 外扩量 + 拖动偏移」实时重画 canvas。
  // 底图来源：优先 imgRef.current（原始图 / 上一步裁剪或扩图回填的结果）；
  // 若异步回填尚未完成则回退 canvasRef.current（当前已绘制内容），保证可重复操作不卡空白。
  const renderOutpaint = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    // 底图来源：优先 imgRef.current（原始图 / 上一步裁剪或扩图回填的结果）；
    // 若异步回填尚未完成，则在重置 canvas 尺寸前先缓存当前像素到临时 canvas 作兜底源，
    // 避免 self-drawImage 在 width 被重置清空后只画空白（虚假兜底）。
    const im = imgRef.current
    const srcW = im ? im.naturalWidth : canvas.width
    const srcH = im ? im.naturalHeight : canvas.height
    if (!srcW || !srcH) return
    const ratio = OUTPAINT_RATIOS.find((r) => r.key === outpaintRatioKey)?.ratio
    const t = computeOutpaintTarget(srcW, srcH, ratio, 1 / outpaintFactor)
    const { dx, dy } = computeOutpaintDrawPos(outpaintOffset, t.maxOffX, t.maxOffY)
    const fallbackCanvas = im ? null : (() => {
      const c = document.createElement('canvas')
      c.width = canvas.width
      c.height = canvas.height
      c.getContext('2d')?.drawImage(canvas, 0, 0)
      return c
    })()
    // 预览态不入撤销栈（拖动/调参高频触发）；确认扩图时才 pushHistory 记录最终结果
    canvas.width = t.tw
    canvas.height = t.th
    ctx.fillStyle = OUTPAINT_FILL
    ctx.fillRect(0, 0, t.tw, t.th)
    const source = im || fallbackCanvas
    if (source) ctx.drawImage(source, dx, dy, t.sw, t.sh)
    setImgSize({ w: t.tw, h: t.th })
  }, [outpaintRatioKey, outpaintFactor, outpaintOffset])

  // 确认扩图：把当前「原图+白边」画布作为结果，退出扩图态
  const applyOutpaint = useCallback(() => {
    renderOutpaint()
    pushHistory() // 扩图结果入撤销栈
    // 扩图结果回填为新的底图（不再置 null），后续裁剪/再扩图均以此为基础
    commitCanvasToImgRef()
    setCrop(undefined)
    setCompletedCrop(undefined)
    setTool('pencil')
  }, [renderOutpaint, pushHistory, commitCanvasToImgRef])

  // 拖动原图重定位：屏幕位移 → 归一化 offset（相对可移动范围）
  const outpaintDragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)
  const onOutpaintPointerDown = useCallback((e: React.PointerEvent) => {
    if (tool !== 'expand') return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    outpaintDragRef.current = { startX: e.clientX, startY: e.clientY, ox: outpaintOffset.x, oy: outpaintOffset.y }
  }, [tool, outpaintOffset])
  const onOutpaintPointerMove = useCallback((e: React.PointerEvent) => {
    const d = outpaintDragRef.current
    if (!d || tool !== 'expand') return
    const canvas = canvasRef.current
    const im = imgRef.current
    if (!canvas || !im) return
    const ratio = OUTPAINT_RATIOS.find((r) => r.key === outpaintRatioKey)?.ratio
    const t = computeOutpaintTarget(im.naturalWidth, im.naturalHeight, ratio, 1 / outpaintFactor)
    // 屏幕位移 → 画布内部像素位移（画布内部像素 / 渲染尺寸 ≈ 1，直接按渲染盒比例换算）
    const scale = canvas.width / canvas.offsetWidth
    const dxNat = (e.clientX - d.startX) * scale
    const dyNat = (e.clientY - d.startY) * scale
    const nx = t.maxOffX > 0 ? d.ox + dxNat / (2 * t.maxOffX) : 0
    const ny = t.maxOffY > 0 ? d.oy + dyNat / (2 * t.maxOffY) : 0
    const next = { x: Math.max(-0.5, Math.min(0.5, nx)), y: Math.max(-0.5, Math.min(0.5, ny)) }
    // 直接按新 offset 重画预览（绕过 state 异步，保证拖动跟手）
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = OUTPAINT_FILL
      ctx.fillRect(0, 0, t.tw, t.th)
      const pos = computeOutpaintDrawPos(next, t.maxOffX, t.maxOffY)
      ctx.drawImage(im, pos.dx, pos.dy, t.sw, t.sh)
    }
    setOutpaintOffset(next)
  }, [tool, outpaintRatioKey, outpaintFactor])
  const onOutpaintPointerUp = useCallback((e: React.PointerEvent) => {
    outpaintDragRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }, [])

  // 进入扩图工具 / 比例 / 外扩量变化：渲染预览。拖动偏移由 onOutpaintPointerMove 内手动重画（跟手）。
  useEffect(() => {
    if (tool !== 'expand') return
    setOutpaintOffset({ x: 0, y: 0 })
    renderOutpaint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, outpaintRatioKey, outpaintFactor])

  // 保存
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // 一并回传画布真实像素尺寸：扩图/裁剪后画布尺寸会变，节点据此用 fitByRatio 显式自适应，
    // 不再依赖缩略图端点还原的尺寸（缩略图压到最长边 640 会吞掉等比外扩带来的比例变化）。
    onSave?.({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height })
    onClose?.()
  }, [onSave, onClose])

  const toolBtn = (t: string, icon: React.ReactNode, title: string, active: boolean) => (
    <button
      type="button"
      className={`p-2 rounded transition-colors ${active ? 'bg-blue-500 text-white' : 'text-secondary hover:text-white hover:bg-surface-hover-strong'}`}
      onClick={() => { setTool(t); if (t === 'crop') setCrop(undefined) }}
      title={title}
    >
      {icon}
    </button>
  )

  return createPortal(
    <div className="fixed inset-0 z-ceiling flex flex-col bg-canvas select-none">
      {/* 顶部工具栏（复刻 _Component129:444-595） */}
      <div className="flex items-center justify-between p-3 bg-surface-raised border-b border-edge">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium mr-4">图片编辑</span>
          {/* 工具组 */}
          <div className="flex items-center bg-surface-hover rounded-lg p-1">
            {toolBtn('pencil', <Pencil size={16} />, '画笔', tool === 'pencil')}
            {toolBtn('eraser', <Eraser size={16} />, '橡皮擦', tool === 'eraser')}
            {toolBtn('text', <Type size={16} />, '文字', tool === 'text')}
            {toolBtn('line', <Minus size={16} />, '直线', tool === 'line')}
            {toolBtn('arrow', <MoveUpRight size={16} />, '箭头', tool === 'arrow')}
            {toolBtn('square', <Square size={16} />, '方框', tool === 'square')}
            {toolBtn('circle', <Circle size={16} />, '圆框', tool === 'circle')}
            {toolBtn('number', <ListOrdered size={16} />, '序号标记', tool === 'number')}
            {toolBtn('eyedropper', <Pipette size={16} />, '吸管取色', tool === 'eyedropper')}
            {toolBtn('crop', <Crop size={16} />, '裁剪', tool === 'crop')}
            {toolBtn('expand', <Expand size={16} />, '扩图', tool === 'expand')}
          </div>
          <div className="h-6 w-[1px] bg-surface-3 mx-2" />
          {/* 颜色 + 粗细 */}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0" />
          <input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} className="w-24 accent-blue-500 ml-2" title={`粗细: ${lineWidth}px`} />
          <div className="h-6 w-[1px] bg-surface-3 mx-2" />
          {/* 撤销 + 清空 */}
          <button type="button" onClick={undo} disabled={history.length <= 1} className={`p-2 rounded text-secondary hover:text-white hover:bg-surface-hover-strong ${history.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`} title="撤销">
            <Undo2 size={16} />
          </button>
          <button type="button" onClick={clearAll} className="p-2 rounded text-secondary hover:text-red-400 hover:bg-surface-hover-strong" title="清空涂鸦">
            <Trash2 size={16} />
          </button>
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center gap-2">
          {tool === 'crop' && (
            <React.Fragment>
              <select
                value={cropAspect ?? 'free'}
                onChange={(e) => {
                  const v = e.target.value
                  const ratio = v === 'free' ? undefined : parseFloat(v)
                  setCropAspect(ratio)
                  if (imgSize.w && imgSize.h) {
                    setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 80 }, ratio || 16 / 9, imgSize.w, imgSize.h), imgSize.w, imgSize.h))
                  }
                }}
                className="bg-surface-hover text-xs text-primary px-2 py-1.5 rounded border border-edge-muted focus:outline-none"
              >
                {CROP_RATIOS.map((r) => (
                  <option key={r.label} value={r.value ?? 'free'}>{r.label}</option>
                ))}
              </select>
              <button type="button" onClick={applyCrop} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors flex items-center gap-1 text-sm font-medium mr-2">
                <Check size={16} /> 确认裁剪
              </button>
            </React.Fragment>
          )}
          {/* 扩图控件（独立工具，复刻 AI-Canvas ExpandEditor）：目标比例 + 外扩量 + 确认 */}
          {tool === 'expand' && (
            <React.Fragment>
              <select
                value={outpaintRatioKey}
                onChange={(e) => setOutpaintRatioKey(e.target.value)}
                className="bg-surface-hover text-xs text-primary px-2 py-1.5 rounded border border-edge-muted focus:outline-none"
                title="扩图后整张图的画幅比例"
              >
                {OUTPAINT_RATIOS.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 bg-surface-hover rounded border border-edge-muted px-2 py-1.5" title="向右拖动放大画布、四周白边越来越多；最多扩展为原图 2 倍面积。原图可拖到白边内任意位置">
                <span className="text-xs text-secondary whitespace-nowrap">扩展</span>
                <input
                  type="range"
                  min={OUTPAINT_FACTOR_MIN}
                  max={OUTPAINT_FACTOR_MAX}
                  step={OUTPAINT_FACTOR_STEP}
                  value={outpaintFactor}
                  onChange={(e) => { setOutpaintFactor(parseFloat(e.target.value)); setOutpaintOffset({ x: 0, y: 0 }) }}
                  className="w-24 accent-blue-500"
                />
                <span className="text-xs text-primary tabular-nums w-12 text-right">+{Math.round((outpaintFactor * outpaintFactor - 1) * 100)}%</span>
              </label>
              <span className="text-xs text-secondary whitespace-nowrap">拖动原图定位</span>
              <button type="button" onClick={applyOutpaint} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors flex items-center gap-1 text-sm font-medium mr-2">
                <Check size={16} /> 确认扩图
              </button>
            </React.Fragment>
          )}
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-body hover:bg-surface-hover-strong transition-colors flex items-center gap-1 text-sm">
            <X size={16} /> 取消
          </button>
          <button type="button" onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1 text-sm font-medium">
            <Check size={16} /> 保存
          </button>
        </div>
      </div>

      {/* 画布区（复刻 _Component129:596-660）：可滚动画布容器 */}
      <div
        ref={viewportRef}
        onMouseDown={spaceDown ? onPanStart : undefined}
        className="flex-1 overflow-auto bg-surface-sunken relative"
        style={{ cursor: spaceDown ? (panning ? 'grabbing' : 'grab') : undefined }}
      >
        <div className="min-w-full min-h-full flex items-center justify-center p-4 w-fit">
          {/* ReactCrop 裁剪层 + canvas 绘制层（expand 扩图模式：ReactCrop 禁用，走拖动原图） */}
          <ReactCrop
            crop={crop}
            onChange={(_, pc) => setCrop(pc)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={cropAspect}
            ruleOfThirds
            disabled={tool !== 'crop'}
            className="block"
            style={{ display: 'block', flex: 'none' }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={tool === 'expand' ? onOutpaintPointerDown : undefined}
              onPointerMove={tool === 'expand' ? onOutpaintPointerMove : undefined}
              onPointerUp={tool === 'expand' ? onOutpaintPointerUp : undefined}
              onMouseDown={tool === 'crop' || tool === 'expand' ? undefined : onDrawStart}
              onMouseMove={tool === 'crop' || tool === 'expand' ? undefined : handleCanvasMove}
              onMouseUp={tool === 'crop' || tool === 'expand' ? undefined : onDrawEnd}
              onMouseLeave={tool === 'crop' || tool === 'expand' ? undefined : onDrawEnd}
              onTouchStart={tool === 'crop' || tool === 'expand' ? undefined : onDrawStart}
              onTouchMove={tool === 'crop' || tool === 'expand' ? undefined : onShapePreview}
              onTouchEnd={tool === 'crop' || tool === 'expand' ? undefined : onDrawEnd}
              className={`block shadow-2xl bg-white ${tool === 'expand' ? 'cursor-move' : 'cursor-crosshair'}`}
              style={{
                touchAction: 'none',
                width: imgSize.w ? `${imgSize.w * zoom}px` : undefined,
                height: imgSize.h ? `${imgSize.h * zoom}px` : undefined,
                pointerEvents: spaceDown ? 'none' : undefined,
              }}
            />
          </ReactCrop>
        </div>

        {/* 文字输入浮层 */}
        {textInput && (
          <input
            ref={textInputRef}
            type="text"
            value={textInput.text}
            onChange={(e) => setTextInput((t) => ({ ...t, text: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText()
              else if (e.key === 'Escape') { e.stopPropagation(); setTextInput(null) } // Esc 取消，不落字
            }}
            onBlur={commitText}
            placeholder="输入文字..."
            style={{
              position: 'absolute',
              left: textInput.left,
              top: textInput.top,
              color,
              fontSize: `${Math.max(20, lineWidth * 5)}px`,
              fontWeight: 'bold',
              background: 'rgba(0,0,0,0.65)',
              border: '1px solid #3b82f6',
              borderRadius: 2,
              outline: 'none',
              padding: '1px 3px',
              margin: 0,
              zIndex: 10000,
              minWidth: '40px',
              lineHeight: 1,
              caretColor: color,
            }}
          />
        )}
      </div>

      {/* 底部缩放条（复刻 _Component129:644-659） */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 bg-surface-raised/95 border border-edge rounded-lg shadow-xl backdrop-blur z-modal-action">
        <button type="button" onClick={zoomOut} className="p-1.5 rounded text-body hover:text-white hover:bg-surface-hover-strong" title="缩小 (滚轮)">
          <ZoomOut size={15} />
        </button>
        <button type="button" onClick={resetZoom} className="px-2 text-caption-sm text-primary tabular-nums min-w-[44px] text-center hover:text-white" title="重置为 100%（空格拖动平移）">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={zoomIn} className="p-1.5 rounded text-body hover:text-white hover:bg-surface-hover-strong" title="放大 (滚轮)">
          <ZoomIn size={15} />
        </button>
        <div className="w-[1px] h-4 bg-surface-3 mx-0.5" />
        <button type="button" onClick={fitZoom} className="p-1.5 rounded text-body hover:text-white hover:bg-surface-hover-strong" title="适应屏幕">
          <Maximize size={15} />
        </button>
      </div>
    </div>,
    document.body
  )
}
