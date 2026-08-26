import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Undo2, Redo2, RotateCcw, ScanFace, LayoutGrid, Ban, Grid3X3, Waves } from 'lucide-react'
import { detectFaces, drawMosaicOnBox, MOSAIC_MODES, MOSAIC_PALETTE } from './faceMosaic.js'
import { createRafBatch } from './utils.js'

/**
 * 人脸打码 · 手动编辑器（完整复刻官方 _Component55.jsx）。
 *
 * 全屏遮罩：加载图片到 canvas，用户拖拽框选要打码的区域，
 * 也可「自动识别人脸」一键框出所有脸；支持撤销/重做/重置 + 模式/强度/颜色。
 * 完成 → onSave(dataUrl)；取消 → onClose。
 */
export default function FaceMosaicEditor({ imageUrl, onSave, onClose }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const origImgRef = useRef(null) // 原始 Image（mosaic/blur 需要原图做像素源）
  const historyRef = useRef([]) // getImageData 快照栈
  const [mode, setMode] = useState('mosaic')
  const [strength, setStrength] = useState(0.5)
  const [color, setColor] = useState('#000000')
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [scale, setScale] = useState(1)
  const [recognizing, setRecognizing] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [dragBox, setDragBox] = useState(null)
  const [histIdx, setHistIdx] = useState(0)
  // P3：框选手势期缓存 { rect, batch }；dragBoxRef 供 onPointerUp 读最新框（state 异步，避免差一帧）
  const dragGesture = useRef(null)
  const dragBoxRef = useRef(null)
  // 拖拽起点缓存（ref 而非 state）：rAF 回调若读 state 的 dragStart 会因异步更新拿到
  // 上一次/空起点，导致「第一次拖不动」（stale closure）。起点必须与当次手势绑定。
  const dragStartRef = useRef(null)

  // 快照当前 canvas 入历史栈（复刻官方 D，用于撤销/重做）
  const pushSnapshot = useCallback(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const data = ctx.getImageData(0, 0, c.width, c.height)
    const next = historyRef.current.slice(0, histIdx + 1)
    next.push(data)
    historyRef.current = next
    setHistIdx(next.length - 1)
  }, [histIdx])

  const restoreSnapshot = useCallback((i) => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !historyRef.current[i]) return
    ctx.putImageData(historyRef.current[i], 0, 0)
    setHistIdx(i)
  }, [])

  // 加载图片
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = canvasRef.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      origImgRef.current = img
      setDims({ w: img.naturalWidth, h: img.naturalHeight })
      historyRef.current = [ctx.getImageData(0, 0, c.width, c.height)]
      setHistIdx(0)
      // 缩放适配容器
      const el = wrapRef.current
      if (el) {
        const scale = Math.min((el.clientWidth - 32) / img.naturalWidth, (el.clientHeight - 32) / img.naturalHeight, 1)
        setScale(scale > 0 ? scale : 1)
      }
    }
    img.onerror = () => onClose()
    img.src = imageUrl
  }, [imageUrl, onClose])

  // 屏幕坐标 → 图片坐标（复刻官方 k）
  const toCanvasPos = (cx, cy) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (cx - rect.left) / scale
    const y = (cy - rect.top) / scale
    return { x: Math.max(0, Math.min(dims.w, x)), y: Math.max(0, Math.min(dims.h, y)) }
  }

  const onPointerDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const p = toCanvasPos(e.clientX, e.clientY)
    // 起点写入 ref：rAF 回调直接读本次起点，避免 state 异步更新导致的 stale closure
    dragStartRef.current = p
    setDragStart(p)
    const box = { x: p.x, y: p.y, w: 0, h: 0 }
    dragBoxRef.current = box
    setDragBox(box)
    // P3：move 高频 → rAF 合并 setDragBox；rect 在 pointerdown 缓存一次，move 内不再读
    const batch = createRafBatch((clientX, clientY) => {
      const start = dragStartRef.current
      if (!start) return
      const x = (clientX - rect.left) / scale
      const y = (clientY - rect.top) / scale
      const px = Math.max(0, Math.min(dims.w, x))
      const py = Math.max(0, Math.min(dims.h, y))
      const next = { x: Math.min(start.x, px), y: Math.min(start.y, py), w: Math.abs(px - start.x), h: Math.abs(py - start.y) }
      dragBoxRef.current = next
      setDragBox(next)
    })
    dragGesture.current = { batch }
  }
  const onPointerMove = (e) => {
    if (!dragStartRef.current) return
    dragGesture.current?.batch(e.clientX, e.clientY)
  }
  const onPointerUp = () => {
    dragGesture.current?.batch.flush() // 松手补最后一帧，避免漏最后一段拖拽
    dragGesture.current = null
    const dragBox = dragBoxRef.current
    if (dragBox && dragBox.w > 4 && dragBox.h > 4) {
      const c = canvasRef.current
      const ctx = c?.getContext('2d')
      const src = origImgRef.current
      if (c && ctx && src) {
        const box = { x: Math.round(dragBox.x), y: Math.round(dragBox.y), w: Math.round(dragBox.w), h: Math.round(dragBox.h) }
        drawMosaicOnBox(ctx, mode === 'bar' || mode === 'grid' ? src : c, box, mode, strength, 'rect', color)
        pushSnapshot()
      }
    }
    setDragStart(null)
    setDragBox(null)
    dragBoxRef.current = null
    dragStartRef.current = null
  }

  const canUndo = histIdx > 0
  const canRedo = histIdx < historyRef.current.length - 1

  // 键盘快捷键（复刻官方 _Component55）：Ctrl+Z 撤销 / Ctrl+Shift+Z、Ctrl+Y 重做 / Esc 关闭
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) { if (canRedo) restoreSnapshot(histIdx + 1) }
        else if (canUndo) restoreSnapshot(histIdx - 1)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        if (canRedo) restoreSnapshot(histIdx + 1)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canUndo, canRedo, histIdx, restoreSnapshot, onClose])

  const autoDetect = async () => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    const src = origImgRef.current
    if (!c || !ctx || !src) return
    setRecognizing(true)
    try {
      const boxes = await detectFaces(imageUrl)
      if (boxes.length === 0) return
      const shape = mode === 'mosaic' || mode === 'blur' ? 'ellipse' : 'rect'
      for (const b of boxes) {
        drawMosaicOnBox(ctx, mode === 'bar' || mode === 'grid' ? src : c, b, mode, strength, shape, color)
      }
      pushSnapshot()
    } finally {
      setRecognizing(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 flex flex-col" onClick={onClose}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-raised border-b border-edge" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-primary font-medium">人脸打码 · 手动编辑</span>
          <span className="text-[11px] text-muted">在图上拖拽框选要打码的区域</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] text-body bg-surface-hover hover:bg-surface-hover-strong border border-edge cursor-pointer border-none">
            <X size={13} /> 取消
          </button>
          <button
            onClick={() => { const c = canvasRef.current; if (c) onSave(c.toDataURL('image/png')) }}
            className="flex items-center gap-1 px-3 h-7 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 cursor-pointer border-none"
          >
            <Check size={13} /> 完成
          </button>
        </div>
      </div>

      {/* 工具条 */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-strong border-b border-edge-faint flex-wrap" onClick={(e) => e.stopPropagation()}>
        {MOSAIC_MODES.map((m) => (
          <button
            key={m.mode}
            onClick={() => setMode(m.mode)}
            className={`flex items-center gap-1 px-2.5 h-7 rounded-md text-body-xs border transition-colors cursor-pointer ${mode === m.mode ? 'bg-blue-600 text-white border-blue-500' : 'text-body bg-surface-hover hover:bg-surface-hover-strong border-edge'}`}
          >
            <ModeIcon mode={m.mode} size={13} /> {m.label}
          </button>
        ))}
        {mode !== 'bar' && (
          <label className="flex items-center gap-1.5 text-[11px] text-secondary ml-1">
            {mode === 'grid' ? '密度' : '程度'}
            <input type="range" min={0} max={1} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="accent-blue-500 w-28" />
          </label>
        )}
        {(mode === 'bar' || mode === 'grid') && (
          <>
            <div className="w-px h-5 bg-surface-hover-strong mx-1" />
            <div className="flex items-center gap-1">
              {MOSAIC_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 rounded-full border border-edge cursor-pointer ${color === c ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-surface-strong' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </>
        )}
        <div className="w-px h-5 bg-surface-hover-strong mx-1" />
        <button onClick={autoDetect} disabled={recognizing} className="flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] text-body bg-surface-hover hover:bg-surface-hover-strong border border-edge disabled:opacity-40 cursor-pointer">
          <ScanFace size={13} /> {recognizing ? '识别中…' : '自动识别人脸'}
        </button>
        <button onClick={() => canUndo && restoreSnapshot(histIdx - 1)} disabled={!canUndo} className="flex items-center gap-1 px-2 h-7 rounded-md text-[12px] text-body bg-surface-hover hover:bg-surface-hover-strong border border-edge disabled:opacity-40 cursor-pointer" title="撤销 (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button onClick={() => canRedo && restoreSnapshot(histIdx + 1)} disabled={!canRedo} className="flex items-center gap-1 px-2 h-7 rounded-md text-[12px] text-body bg-surface-hover hover:bg-surface-hover-strong border border-edge disabled:opacity-40 cursor-pointer" title="前进 (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </button>
        <button onClick={() => canUndo && restoreSnapshot(0)} disabled={!canUndo} className="flex items-center gap-1 px-2 h-7 rounded-md text-[12px] text-body bg-surface-hover hover:bg-surface-hover-strong border border-edge disabled:opacity-40 cursor-pointer" title="重置">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* 画布区 */}
      <div ref={wrapRef} className="flex-1 overflow-auto flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative" style={{ width: dims.w * scale, height: dims.h * scale }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{ width: dims.w * scale, height: dims.h * scale, cursor: 'crosshair', touchAction: 'none' }}
            className="block bg-surface-black"
          />
          {dragBox && (
            <div
              className="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none"
              style={{ left: dragBox.x * scale, top: dragBox.y * scale, width: dragBox.w * scale, height: dragBox.h * scale, willChange: 'left, top, width, height' }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function ModeIcon({ mode, size }) {
  switch (mode) {
    case 'mosaic': return <LayoutGrid size={size} />
    case 'bar': return <Ban size={size} />
    case 'grid': return <Grid3X3 size={size} />
    case 'blur': return <Waves size={size} />
    default: return <LayoutGrid size={size} />
  }
}
