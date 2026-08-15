import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Pencil, Eraser, Crop, Square, Circle, Minus, MoveUpRight, ListOrdered,
  Pipette, Type, Undo2, Trash2, ZoomIn, ZoomOut, Maximize, X, Check,
  Image as ImageIcon
} from 'lucide-react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

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

// 可绘制/标记工具集合（裁剪在 ReactCrop 层处理，不参与 canvas 绘制）
const DRAW_TOOLS = ['pencil', 'eraser', 'text', 'line', 'arrow', 'square', 'circle', 'number', 'eyedropper']
// 全部可用工具（含裁剪）
const ALL_TOOLS = [...DRAW_TOOLS, 'crop']

// 裁剪比例选项（官方 _Component129:530-535）
const CROP_RATIOS = [
  { label: '自由尺寸', value: undefined },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
]

export default function ImageEditor({ imageUrl, initialTool = 'pencil', onSave, onClose }) {
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

  // 裁剪态（ReactCrop）
  const [crop, setCrop] = useState(undefined)
  const [completedCrop, setCompletedCrop] = useState(undefined)
  const [cropAspect, setCropAspect] = useState(undefined)

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
    const ctx = canvas?.getContext('2d')
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
        console.warn('[ImageEditor] 图片绘制失败（跨域污染？）:', err.message)
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

  // 滚轮缩放（画布区）
  const onWheel = useCallback((e) => {
    e.preventDefault()
    setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 0.9)))
  }, [clampZoom])

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
    const move = (e) => {
      const vp = viewportRef.current
      if (vp) {
        vp.scrollLeft = scrollRef.current.scrollLeft - (e.clientX - scrollRef.current.x)
        vp.scrollTop = scrollRef.current.scrollTop - (e.clientY - scrollRef.current.y)
      }
    }
    const up = () => setPanning(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
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
      const canvasRect = canvas.getBoundingClientRect()
      const vp = viewportRef.current
      const cxp = 'touches' in e ? e.touches[0].clientX : e.clientX
      const cyp = 'touches' in e ? e.touches[0].clientY : e.clientY
      setTextInput({
        x, y,
        left: cxp - (canvasRect.left || 0) + (vp?.scrollLeft || 0),
        top: cyp - (canvasRect.top || 0) + (vp?.scrollTop || 0),
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
  }, [tool, color, lineWidth, seq, pushHistory, toCanvasPos])

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

  // 文字确认写入
  const commitText = useCallback(() => {
    if (!textInput || !textInput.text.trim()) { setTextInput(null); return }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      pushHistory()
      ctx.fillStyle = color
      ctx.font = `bold ${Math.max(20, lineWidth * 5)}px sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(textInput.text, textInput.x, textInput.y + 4)
    }
    setTextInput(null)
  }, [textInput, color, lineWidth, pushHistory])

  // 确认裁剪（复刻官方 537-574）：把 ReactCrop 的 crop 换算成 canvas 像素 → 裁切
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
    imgRef.current = null // 裁剪后原始图失效
    setImgSize({ w: sw, h: sh })
    setCrop(undefined)
    setCompletedCrop(undefined)
    setTool('pencil')
  }, [completedCrop, pushHistory])

  const lastCropStart = useRef({ x: 0, y: 0 })

  // 保存
  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onSave?.({ dataUrl: canvas.toDataURL('image/jpeg', 0.9) })
    onClose?.()
  }, [onSave, onClose])

  const toolBtn = (t, icon, title, active) => (
    <button
      type="button"
      className={`p-2 rounded transition-colors ${active ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white hover:bg-surface-hover-strong'}`}
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
          </div>
          <div className="h-6 w-[1px] bg-surface-3 mx-2" />
          {/* 颜色 + 粗细 */}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0" />
          <input type="range" min="1" max="20" value={lineWidth} onChange={(e) => setLineWidth(parseInt(e.target.value))} className="w-24 accent-blue-500 ml-2" title={`粗细: ${lineWidth}px`} />
          <div className="h-6 w-[1px] bg-surface-3 mx-2" />
          {/* 撤销 + 清空 */}
          <button type="button" onClick={undo} disabled={history.length <= 1} className={`p-2 rounded text-gray-400 hover:text-white hover:bg-surface-hover-strong ${history.length <= 1 ? 'opacity-50 cursor-not-allowed' : ''}`} title="撤销">
            <Undo2 size={16} />
          </button>
          <button type="button" onClick={clearAll} className="p-2 rounded text-gray-400 hover:text-red-400 hover:bg-surface-hover-strong" title="清空涂鸦">
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
                className="bg-surface-hover text-xs text-gray-200 px-2 py-1.5 rounded border border-edge-muted focus:outline-none"
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
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-gray-300 hover:bg-surface-hover-strong transition-colors flex items-center gap-1 text-sm">
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
        onWheel={onWheel}
        onMouseDown={spaceDown ? onPanStart : undefined}
        className="flex-1 overflow-auto bg-[#0a0a0a] relative"
        style={{ cursor: spaceDown ? (panning ? 'grabbing' : 'grab') : undefined }}
      >
        <div className="min-w-full min-h-full flex items-center justify-center p-4 w-fit">
          {/* ReactCrop 裁剪层 + canvas 绘制层 */}
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
              onMouseDown={tool === 'crop' ? undefined : onDrawStart}
              onMouseMove={tool === 'crop' ? undefined : onShapePreview}
              onMouseUp={tool === 'crop' ? undefined : onDrawEnd}
              onMouseLeave={tool === 'crop' ? undefined : onDrawEnd}
              onTouchStart={tool === 'crop' ? undefined : onDrawStart}
              onTouchMove={tool === 'crop' ? undefined : onShapePreview}
              onTouchEnd={tool === 'crop' ? undefined : onDrawEnd}
              className="block shadow-2xl bg-white cursor-crosshair"
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
            autoFocus
            type="text"
            value={textInput.text}
            onChange={(e) => setTextInput((t) => ({ ...t, text: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') commitText() }}
            onBlur={commitText}
            placeholder="输入文字..."
            style={{
              position: 'absolute',
              left: textInput.left,
              top: textInput.top,
              color,
              fontSize: `${Math.max(20, lineWidth * 5)}px`,
              fontWeight: 'bold',
              background: 'transparent',
              border: '1px dashed #666',
              outline: 'none',
              padding: 0,
              margin: 0,
              zIndex: 10000,
              minWidth: '20px',
              lineHeight: 1,
            }}
          />
        )}
      </div>

      {/* 底部缩放条（复刻 _Component129:644-659） */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 bg-surface-raised/95 border border-edge rounded-lg shadow-xl backdrop-blur z-modal-action">
        <button type="button" onClick={zoomOut} className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-surface-hover-strong" title="缩小 (滚轮)">
          <ZoomOut size={15} />
        </button>
        <button type="button" onClick={resetZoom} className="px-2 text-caption-sm text-gray-200 tabular-nums min-w-[44px] text-center hover:text-white" title="重置为 100%（空格拖动平移）">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={zoomIn} className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-surface-hover-strong" title="放大 (滚轮)">
          <ZoomIn size={15} />
        </button>
        <div className="w-[1px] h-4 bg-surface-3 mx-0.5" />
        <button type="button" onClick={fitZoom} className="p-1.5 rounded text-gray-300 hover:text-white hover:bg-surface-hover-strong" title="适应屏幕">
          <Maximize size={15} />
        </button>
      </div>
    </div>,
    document.body
  )
}
