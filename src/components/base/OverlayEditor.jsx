import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Box, Eye, EyeOff, Lock, Unlock, Brush, Trash2,
  ChevronsUp, ChevronUp, ChevronDown, ChevronsDown, Maximize, X
} from 'lucide-react'

/* ════════════════════════════════════════════════════════════════
 * 叠加图层编辑器（复刻官方 Uo.jsx，图片拼图 overlay 模式）
 *
 * 受控组件：props = { state, onChange, upstreamUrls }
 *  state: { layers, canvasWidth, canvasHeight, bgColor }
 *  layer: { id, imageUrl, x, y, scale, rotation, opacity, zIndex, visible, locked, naturalWidth, naturalHeight, maskUrl }
 *
 * ★ 核心渲染模型（与官方一致）：
 *  - 画布只显示一张「合成预览图」（renderOverlayCanvas 把全部图层按 zIndex 合成，object-fill 铺满）
 *  - 每个图层是一个「透明定位框」（平时 outline-transparent，选中 outline-blue-400），
 *    只用于点击选中 / 拖动 / 显示缩放旋转手柄，本身不承载图片
 *  - 拖动时实时更新 layer.x/y → preview 防抖重合成，框与合成图始终对齐
 *
 * 能力：图层导入/排序/显隐/锁定/删除/涂抹擦除恢复、画布尺寸、全屏聚焦、属性面板
 * ════════════════════════════════════════════════════════════════ */

const genId = () => `ov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => {
      const r = new Image()
      r.src = src
      r.onload = () => resolve(r)
      r.onerror = () => resolve(null)
    }
    img.src = src
  })

// 单层渲染 canvas（复刻 Bo_1.jsx：drawImage + mask destination-in）
const renderLayerCanvas = async (layer) => {
  const img = await loadImage(layer.imageUrl)
  if (!img) return null
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  if (layer.maskUrl) {
    const mask = await loadImage(layer.maskUrl)
    if (mask) {
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(mask, 0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }
  }
  return canvas
}

// overlay 合成（复刻 Vo.jsx：背景 + 按 zIndex 绘制，返回 dataURL）
export const renderOverlayCanvas = async ({ layers, canvasWidth, canvasHeight, bgColor }) => {
  if (canvasWidth <= 0 || canvasHeight <= 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const bg = bgColor ?? '#000000'
  if (bg !== 'transparent') {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  }
  const sorted = [...layers].filter((l) => l.visible !== false).sort((a, b) => a.zIndex - b.zIndex)
  for (const l of sorted) {
    const t = await renderLayerCanvas(l)
    if (!t) continue
    ctx.save()
    ctx.globalAlpha = l.opacity
    const cx = l.x + (t.width * l.scale) / 2
    const cy = l.y + (t.height * l.scale) / 2
    ctx.translate(cx, cy)
    ctx.rotate((l.rotation * Math.PI) / 180)
    ctx.translate(-cx, -cy)
    ctx.drawImage(t, l.x, l.y, t.width * l.scale, t.height * l.scale)
    ctx.restore()
  }
  return canvas.toDataURL('image/png')
}

export default function OverlayEditor({ state, onChange, upstreamUrls }) {
  const { layers, canvasWidth, canvasHeight } = state

  const [selectedId, setSelectedId] = useState(null)
  const [paintLayerId, setPaintLayerId] = useState(null)
  const [brushSize, setBrushSize] = useState(40)
  const [brushMode, setBrushMode] = useState('erase')
  const [menu, setMenu] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)

  const boardRef = useRef(null)
  const paintCanvasRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const strokeRef = useRef([])
  const historyRef = useRef([])
  const dragRef = useRef(null)
  const pointerRef = useRef(null)

  const selectedLayer = layers.find((l) => l.id === selectedId) || null

  // 显示尺寸（复刻 Uo.jsx R）
  const display = useMemo(() => {
    const maxW = fullscreen ? Math.min(window.innerWidth - 80, 1600) : 320
    const maxH = fullscreen ? Math.min(window.innerHeight - 200, 1000) : 360
    const ratio = canvasWidth / canvasHeight
    let w = maxW
    let h = maxW / ratio
    if (h > maxH) {
      h = maxH
      w = h * ratio
    }
    return { displayW: w, displayH: h, scale: w / canvasWidth }
  }, [canvasWidth, canvasHeight, fullscreen])

  // 上游图片变化 → 同步 layers（复刻 Uo.jsx useEffect[upstreamUrls]）
  useEffect(() => {
    let cancelled = false
    const set = new Set(upstreamUrls)
    const cur = new Set(layers.map((l) => l.imageUrl))
    const toAdd = upstreamUrls.filter((u) => !cur.has(u))
    const toRemove = layers.filter((l) => !set.has(l.imageUrl))
    if (toAdd.length === 0 && toRemove.length === 0) return
    ;(async () => {
      const added = []
      let maxZ = layers.reduce((m, l) => Math.max(m, l.zIndex), 0)
      for (const url of toAdd) {
        const img = await loadImage(url)
        if (cancelled) return
        if (!img) continue
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        const s = Math.min(canvasWidth / w, canvasHeight / h, 1)
        maxZ += 1
        added.push({
          id: genId(),
          imageUrl: url,
          x: (canvasWidth - w * s) / 2,
          y: (canvasHeight - h * s) / 2,
          scale: s,
          rotation: 0,
          opacity: 1,
          zIndex: maxZ,
          visible: true,
          locked: false,
          naturalWidth: w,
          naturalHeight: h
        })
      }
      if (cancelled) return
      const removeIds = new Set(toRemove.map((l) => l.id))
      onChange({ ...state, layers: [...layers.filter((l) => !removeIds.has(l.id)), ...added] })
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamUrls.join('|'), canvasWidth, canvasHeight])

  // 合成预览（复刻 Uo.jsx useEffect[E]：debounce）
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    let timer
    const delay = paintLayerId ? 60 : 200
    timer = window.setTimeout(async () => {
      const url = await renderOverlayCanvas(state)
      setPreview(url)
    }, delay)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, canvasWidth, canvasHeight, state.bgColor, paintLayerId])

  // Esc 退出全屏
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // 关闭菜单
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
    }
  }, [menu])

  // 更新单个图层（复刻 te）
  const updateLayer = useCallback(
    (layerId, patch) => {
      onChange({ ...state, layers: layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)) })
    },
    [layers, state, onChange]
  )

  // 删除图层（复刻 z）
  const removeLayer = useCallback(
    (layerId) => {
      onChange({ ...state, layers: layers.filter((l) => l.id !== layerId) })
      if (selectedId === layerId) setSelectedId(null)
    },
    [layers, state, onChange, selectedId]
  )

  // 图层排序（复刻 ee）
  const reorderLayer = useCallback(
    (layerId, dir) => {
      const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex)
      const from = sorted.findIndex((l) => l.id === layerId)
      if (from < 0) return
      let to = from
      if (dir === 'top') to = 0
      else if (dir === 'bottom') to = sorted.length - 1
      else if (dir === 'up') to = Math.max(0, from - 1)
      else if (dir === 'down') to = Math.min(sorted.length - 1, from + 1)
      if (to === from) return
      const arr = sorted.slice()
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      const len = arr.length
      onChange({ ...state, layers: arr.map((l, i) => ({ ...l, zIndex: len - i })) })
    },
    [layers, state, onChange]
  )

  const [dragLayerId, setDragLayerId] = useState(null)
  const [overLayerId, setOverLayerId] = useState(null)
  const handleDropReorder = useCallback(
    (fromId, toId) => {
      if (fromId === toId) return
      const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex)
      const from = sorted.findIndex((l) => l.id === fromId)
      const to = sorted.findIndex((l) => l.id === toId)
      if (from < 0 || to < 0) return
      const arr = sorted.slice()
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      const len = arr.length
      onChange({ ...state, layers: arr.map((l, i) => ({ ...l, zIndex: len - i })) })
    },
    [layers, state, onChange]
  )

  // 开始拖拽（复刻 ne）
  const beginDrag = useCallback(
    (e, layer, mode) => {
      if (layer.locked || paintLayerId) return
      e.stopPropagation()
      e.preventDefault()
      setSelectedId(layer.id)
      dragRef.current = {
        mode,
        layerId: layer.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: layer.x,
        origY: layer.y,
        origScale: layer.scale,
        origRotation: layer.rotation,
        origCenterX: layer.x + (layer.naturalWidth || 0) * layer.scale / 2,
        origCenterY: layer.y + (layer.naturalHeight || 0) * layer.scale / 2,
        width: layer.naturalWidth || 0,
        height: layer.naturalHeight || 0
      }
    },
    [paintLayerId]
  )

  // 拖拽移动/缩放/旋转（复刻 Uo.jsx useEffect[v]）
  useEffect(() => {
    if (!dragRef.current) return
    const onMove = (e) => {
      const d = dragRef.current
      const dx = (e.clientX - d.startX) / display.scale
      const dy = (e.clientY - d.startY) / display.scale
      if (d.mode === 'move') {
        updateLayer(d.layerId, { x: d.origX + dx, y: d.origY + dy })
      } else if (d.mode === 'scale') {
        const right = d.origX + d.width * d.origScale + dx
        const scale = Math.max(0.05, (right - d.origX) / d.width)
        updateLayer(d.layerId, { scale })
      } else if (d.mode === 'rotate') {
        const rect = boardRef.current?.getBoundingClientRect()
        if (!rect) return
        const px = (e.clientX - rect.left) / display.scale
        const py = (e.clientY - rect.top) / display.scale
        const deg = (Math.atan2(py - d.origCenterY, px - d.origCenterX) * 180) / Math.PI + 90
        updateLayer(d.layerId, { rotation: deg })
      }
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [display.scale, updateLayer])

  // ---- 涂抹 ----
  useEffect(() => {
    if (!paintLayerId) {
      strokeRef.current = []
      historyRef.current = []
      return
    }
    const layer = layers.find((l) => l.id === paintLayerId)
    if (!layer) return
    const w = layer.naturalWidth || 0
    const h = layer.naturalHeight || 0
    if (w <= 0 || h <= 0) return
    let cancelled = false
    ;(async () => {
      await new Promise((r) => requestAnimationFrame(() => r()))
      if (cancelled) return
      const canvas = paintCanvasRef.current
      if (!canvas) return
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)
      if (layer.maskUrl) {
        const mask = await loadImage(layer.maskUrl)
        if (!cancelled && mask) ctx.drawImage(mask, 0, 0, w, h)
      } else {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, w, h)
      }
      historyRef.current = [ctx.getImageData(0, 0, w, h)]
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintLayerId])

  const saveHistory = useCallback(() => {
    const canvas = paintCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height)
    historyRef.current.push(snap)
    if (historyRef.current.length > 20) historyRef.current.shift()
  }, [])

  const undoPaint = useCallback(() => {
    const canvas = paintCanvasRef.current
    if (!canvas || historyRef.current.length <= 1) return
    historyRef.current.pop()
    const last = historyRef.current[historyRef.current.length - 1]
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.putImageData(last, 0, 0)
  }, [])

  const applyMask = useCallback(() => {
    const canvas = paintCanvasRef.current
    if (!canvas) return
    updateLayer(paintLayerId, { maskUrl: canvas.toDataURL('image/png') })
  }, [paintLayerId, updateLayer])

  const finishPaint = useCallback(() => {
    applyMask()
    setPaintLayerId(null)
  }, [applyMask])

  const toCanvasPos = useCallback(
    (clientX, clientY, layer) => {
      const rect = boardRef.current?.getBoundingClientRect()
      if (!rect || rect.width <= 0) return null
      const sx = (clientX - rect.left) * (canvasWidth / rect.width)
      const sy = (clientY - rect.top) * (canvasHeight / rect.height)
      const cx = layer.x + (layer.naturalWidth || 0) * layer.scale / 2
      const cy = layer.y + (layer.naturalHeight || 0) * layer.scale / 2
      const rad = (-(layer.rotation * Math.PI) / 180)
      const fx = sx - cx
      const fy = sy - cy
      const mx = fx * Math.cos(rad) - fy * Math.sin(rad) + cx
      const my = fx * Math.sin(rad) + fy * Math.cos(rad) + cy
      return { x: (mx - layer.x) / layer.scale, y: (my - layer.y) / layer.scale }
    },
    [canvasWidth, canvasHeight]
  )

  const drawStroke = useCallback(
    (x0, y0, x1, y1) => {
      const canvas = overlayCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = brushSize
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = brushMode === 'erase' ? 'rgba(250,204,21,0.85)' : 'rgba(96,165,250,0.85)'
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      strokeRef.current.push({ x0, y0, x1, y1 })
    },
    [brushSize, brushMode]
  )

  const commitStroke = useCallback(() => {
    const strokes = strokeRef.current
    strokeRef.current = []
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.getContext('2d')?.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height)
    }
    if (strokes.length === 0) return
    const canvas = paintCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brushSize
    if (brushMode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = 'rgba(255,255,255,1)'
    }
    ctx.beginPath()
    for (const s of strokes) {
      ctx.moveTo(s.x0, s.y0)
      ctx.lineTo(s.x1, s.y1)
    }
    ctx.stroke()
    ctx.restore()
  }, [brushSize, brushMode])

  useEffect(() => {
    if (!paintLayerId) return
    const layer = layers.find((l) => l.id === paintLayerId)
    if (!layer) return
    const board = boardRef.current
    if (!board) return
    let pending = null
    let raf = null
    let pointerDown = false

    const flush = () => {
      raf = null
      if (pointerDown && pointerRef.current) {
        drawStroke(pointerRef.current.x, pointerRef.current.y, pointerRef.current.x, pointerRef.current.y)
        pointerRef.current = null
      }
    }
    const onDown = (e) => {
      const pos = toCanvasPos(e.clientX, e.clientY, layer)
      if (!pos) return
      if (pos.x < -50 || pos.y < -50 || pos.x > (layer.naturalWidth || 0) + 50 || pos.y > (layer.naturalHeight || 0) + 50) return
      e.preventDefault()
      e.stopPropagation()
      board.setPointerCapture?.(e.pointerId)
      pointerDown = true
      pointerRef.current = { x: pos.x, y: pos.y }
      drawStroke(pos.x, pos.y, pos.x, pos.y)
    }
    const onMove = (e) => {
      const pos = toCanvasPos(e.clientX, e.clientY, layer)
      if (!pos) return
      if (!pointerDown) return
      pending = pos
      raf ??= requestAnimationFrame(() => {
        raf = null
        const p = pending
        if (pointerRef.current) {
          drawStroke(pointerRef.current.x, pointerRef.current.y, p.x, p.y)
        }
        pointerRef.current = p
      })
    }
    const onUp = (e) => {
      if (pointerDown) {
        flush()
        pointerDown = false
        commitStroke()
        saveHistory()
        applyMask()
      }
      try {
        board.releasePointerCapture?.(e.pointerId)
      } catch {}
    }
    board.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      if (raf != null) cancelAnimationFrame(raf)
      board.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [paintLayerId, layers, brushSize, brushMode, drawStroke, commitStroke, saveHistory, applyMask, toCanvasPos])

  useEffect(() => {
    if (!selectedId && !paintLayerId) return
    const onKey = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (paintLayerId) {
        e.stopPropagation()
        e.preventDefault()
        return
      }
      if (selectedId) {
        e.stopPropagation()
        e.preventDefault()
        removeLayer(selectedId)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [selectedId, paintLayerId, removeLayer])

  const sortedLayers = useMemo(() => [...layers].sort((a, b) => b.zIndex - a.zIndex), [layers])

  const menuLayer = menu ? layers.find((l) => l.id === menu.id) : null
  const menuIndex = menuLayer ? sortedLayers.findIndex((l) => l.id === menuLayer.id) : -1
  const isTop = menuIndex === 0
  const isBottom = menuIndex === sortedLayers.length - 1

  const MenuItem = ({ icon, label, disabled, onClick, danger }) => (
    <button
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) {
          onClick()
          setMenu(null)
        }
      }}
      className={`w-full flex items-center gap-2 px-2 py-1 text-caption-sm text-left rounded transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : danger ? 'text-red-300 hover:bg-red-500/15' : 'text-gray-200 hover:bg-blue-500/15'} cursor-pointer`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )

  return (
    <div className="space-y-2">
      {/* 画布尺寸 */}
      <div className="flex items-center gap-1.5 text-caption text-gray-400 nodrag flex-wrap">
        <span>画布</span>
        <input
          type="number" min={64} max={4096}
          value={canvasWidth}
          onChange={(e) => onChange({ ...state, canvasWidth: Math.max(64, Math.min(4096, parseInt(e.target.value || '0', 10) || canvasWidth)) })}
          className="w-16 bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge outline-none"
        />
        <span>×</span>
        <input
          type="number" min={64} max={4096}
          value={canvasHeight}
          onChange={(e) => onChange({ ...state, canvasHeight: Math.max(64, Math.min(4096, parseInt(e.target.value || '0', 10) || canvasHeight)) })}
          className="w-16 bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge outline-none"
        />
      </div>

      {/* 画布（只显示合成预览图 + 透明图层选择框，对齐官方 Component568） */}
      <div
        className={fullscreen ? 'fixed inset-0 z-modal bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 nodrag nowheel' : 'flex justify-center bg-[#0d0d0d] rounded border border-edge p-2 nodrag'}
        onClick={fullscreen ? (e) => e.stopPropagation() : undefined}
        onWheel={fullscreen ? (e) => e.stopPropagation() : undefined}
      >
        {fullscreen && (
          <button
            className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded border bg-surface-hover border-edge-muted text-gray-200 hover:text-white hover:border-[#666] text-xs cursor-pointer"
            onClick={() => setFullscreen(false)}
            title="退出全屏 (Esc)"
          >
            <X size={13} /> 退出全屏
          </button>
        )}
        <div
          ref={boardRef}
          className="relative"
          style={{
            width: display.displayW,
            height: display.displayH,
            cursor: paintLayerId ? 'crosshair' : 'default',
            touchAction: paintLayerId ? 'none' : 'auto',
            backgroundColor: '#1a1a1a',
            backgroundImage: 'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
            backgroundSize: '12px 12px',
            backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0'
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            if (!paintLayerId) setSelectedId(null)
          }}
        >
          {/* 合成预览图（object-fill 铺满画布） */}
          {preview && <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-fill pointer-events-none" />}

          {/* 透明图层选择框（平时透明，选中时蓝色；不承载图片，只做选中/拖动/手柄） */}
          {!paintLayerId &&
            layers
              .filter((l) => l.visible !== false)
              .map((layer) => {
                const isSel = layer.id === selectedId
                const w = (layer.naturalWidth || 0) * layer.scale * display.scale
                const h = (layer.naturalHeight || 0) * layer.scale * display.scale
                const left = layer.x * display.scale
                const top = layer.y * display.scale
                return (
                  <div
                    key={layer.id}
                    className={`absolute ${isSel ? 'outline outline-1 outline-blue-400' : 'outline outline-1 outline-transparent hover:outline-blue-300/40'} ${layer.locked ? 'cursor-not-allowed' : 'cursor-move'}`}
                    style={{
                      left,
                      top,
                      width: w,
                      height: h,
                      transform: `rotate(${layer.rotation}deg)`,
                      transformOrigin: 'center center'
                    }}
                    onMouseDown={(e) => beginDrag(e, layer, 'move')}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSelectedId(layer.id)
                      const x = e.clientX
                      const y = e.clientY
                      setTimeout(() => setMenu({ id: layer.id, x, y }), 0)
                    }}
                  >
                    {isSel && !layer.locked && (
                      <>
                        <div className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-blue-400 border border-white rounded-sm cursor-se-resize" onMouseDown={(e) => beginDrag(e, layer, 'scale')} />
                        <div className="absolute left-1/2 -translate-x-1/2 -top-5 w-2 h-2 bg-blue-400 border border-white rounded-full cursor-grab" onMouseDown={(e) => beginDrag(e, layer, 'rotate')} />
                      </>
                    )}
                  </div>
                )
              })}

          {/* 涂抹编辑中的图层画布 */}
          {paintLayerId &&
            (() => {
              const layer = layers.find((l) => l.id === paintLayerId)
              if (!layer) return null
              const scale = display.scale
              const w = (layer.naturalWidth || 0) * layer.scale * scale
              const h = (layer.naturalHeight || 0) * layer.scale * scale
              return (
                <div
                  className="absolute outline outline-2 outline-orange-400/80 pointer-events-none"
                  style={{
                    left: layer.x * scale,
                    top: layer.y * scale,
                    width: w,
                    height: h,
                    transform: `rotate(${layer.rotation}deg)`,
                    transformOrigin: 'center center'
                  }}
                >
                  <canvas ref={paintCanvasRef} className="w-full h-full block" style={{ visibility: 'hidden' }} />
                  <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full block" width={layer.naturalWidth || 0} height={layer.naturalHeight || 0} />
                </div>
              )
            })()}
        </div>
      </div>

      {/* 涂抹工具栏 */}
      {paintLayerId && (
        <div className="flex flex-wrap items-center gap-1.5 text-caption text-gray-300 bg-surface-raised border border-orange-500/40 rounded p-1.5 nodrag">
          <button className={`px-1.5 py-0.5 rounded border cursor-pointer ${brushMode === 'erase' ? 'bg-orange-500/15 border-orange-500/60 text-orange-300' : 'bg-surface-hover border-edge text-gray-300'}`} onClick={() => setBrushMode('erase')}>擦除</button>
          <button className={`px-1.5 py-0.5 rounded border cursor-pointer ${brushMode === 'restore' ? 'bg-orange-500/15 border-orange-500/60 text-orange-300' : 'bg-surface-hover border-edge text-gray-300'}`} onClick={() => setBrushMode('restore')}>恢复</button>
          <span className="ml-1">笔刷</span>
          <input type="range" min={4} max={200} value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} className="w-20 accent-orange-400" />
          <span className="text-gray-400">{brushSize}px</span>
          <button className="ml-auto px-1.5 py-0.5 rounded border bg-surface-hover border-edge text-gray-300 hover:text-white cursor-pointer" onClick={() => setFullscreen(true)} title="全屏涂抹"><Maximize size={11} /></button>
          <button className="px-1.5 py-0.5 rounded border bg-surface-hover border-edge text-gray-300 hover:text-white cursor-pointer" onClick={undoPaint}>撤销</button>
          <button className="px-1.5 py-0.5 rounded border bg-surface-hover border-edge text-gray-300 hover:text-white cursor-pointer" onClick={() => setPaintLayerId(null)}>取消</button>
          <button className="px-1.5 py-0.5 rounded border bg-orange-500/15 border-orange-500/60 text-orange-200 cursor-pointer" onClick={finishPaint}>完成</button>
        </div>
      )}

      {/* 图层列表 */}
      <div className="bg-surface-raised border border-edge rounded p-1.5 max-h-[180px] overflow-y-auto nodrag">
        <div className="flex items-center gap-1 text-caption text-gray-400 mb-1">
          <Box size={11} />
          <span>图层（{layers.length}）</span>
        </div>
        {sortedLayers.length === 0 ? (
          <div className="text-caption text-gray-500 py-2 text-center">连线一张图即作为新图层导入</div>
        ) : (
          sortedLayers.map((layer) => {
            const isDragging = dragLayerId === layer.id
            const isOver = overLayerId === layer.id && dragLayerId !== layer.id
            return (
              <div
                key={layer.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation()
                  setDragLayerId(layer.id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('application/x-yimao-layer', layer.id)
                  const ghost = document.createElement('div')
                  ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;'
                  document.body.appendChild(ghost)
                  e.dataTransfer.setDragImage(ghost, 0, 0)
                  setTimeout(() => document.body.removeChild(ghost), 0)
                }}
                onDragEnter={(e) => {
                  if (dragLayerId !== null) {
                    e.preventDefault()
                    e.stopPropagation()
                    setOverLayerId(layer.id)
                  }
                }}
                onDragOver={(e) => {
                  if (dragLayerId !== null) {
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = 'move'
                  }
                }}
                onDragLeave={(e) => {
                  e.stopPropagation()
                  setOverLayerId((cur) => (cur === layer.id ? null : cur))
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const from = e.dataTransfer.getData('application/x-yimao-layer') || dragLayerId
                  if (from && from !== layer.id) handleDropReorder(from, layer.id)
                  setDragLayerId(null)
                  setOverLayerId(null)
                }}
                onDragEnd={(e) => {
                  e.stopPropagation()
                  setDragLayerId(null)
                  setOverLayerId(null)
                }}
                className={`flex items-center gap-1 px-1 py-0.5 rounded text-caption cursor-grab active:cursor-grabbing transition-colors
                  ${selectedId === layer.id ? 'bg-blue-500/15' : 'hover:bg-white/5'}
                  ${isDragging ? 'opacity-40' : ''}
                  ${isOver ? 'ring-1 ring-blue-400 bg-blue-400/10' : ''}
                `}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedId(layer.id)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedId(layer.id)
                  const x = e.clientX
                  const y = e.clientY
                  setTimeout(() => setMenu({ id: layer.id, x, y }), 0)
                }}
              >
                <button className="text-gray-400 hover:text-white cursor-pointer" onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: layer.visible === false }) }} title="显隐">
                  {layer.visible === false ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
                <button className="text-gray-400 hover:text-white cursor-pointer" onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }) }} title="锁定">
                  {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
                </button>
                <img src={layer.imageUrl} alt="" className="w-6 h-6 object-cover rounded pointer-events-none" />
                <span className="flex-1 truncate text-gray-300">图层 {layer.zIndex}</span>
                <button className="text-gray-400 hover:text-orange-300 cursor-pointer" onClick={(e) => { e.stopPropagation(); setPaintLayerId(layer.id); setSelectedId(layer.id) }} title="涂抹擦除"><Brush size={11} /></button>
                <button className="text-gray-400 hover:text-red-300 cursor-pointer" onClick={(e) => { e.stopPropagation(); removeLayer(layer.id) }} title="删除"><Trash2 size={11} /></button>
              </div>
            )
          })
        )}
      </div>

      {/* 属性面板 */}
      {selectedLayer && !paintLayerId && (
        <div className="flex items-center gap-1.5 text-caption text-gray-400 nodrag">
          <span>不透明</span>
          <input type="range" min={0} max={100} value={Math.round(selectedLayer.opacity * 100)} onChange={(e) => updateLayer(selectedLayer.id, { opacity: parseInt(e.target.value, 10) / 100 })} className="w-20 accent-blue-400" />
          <span>{Math.round(selectedLayer.opacity * 100)}%</span>
          <span className="ml-2">缩放</span>
          <input type="number" min={0.05} max={10} step={0.05} value={Number(selectedLayer.scale.toFixed(2))} onChange={(e) => updateLayer(selectedLayer.id, { scale: Math.max(0.05, parseFloat(e.target.value) || selectedLayer.scale) })} className="w-14 bg-surface-hover text-gray-200 rounded px-1 py-0.5 border border-edge outline-none" />
          <span className="ml-2">旋转</span>
          <input type="number" min={-360} max={360} step={1} value={Math.round(selectedLayer.rotation)} onChange={(e) => updateLayer(selectedLayer.id, { rotation: parseFloat(e.target.value) || 0 })} className="w-14 bg-surface-hover text-gray-200 rounded px-1 py-0.5 border border-edge outline-none" />
        </div>
      )}

      {/* 右键菜单 */}
      {menu && menuLayer && createPortal(
        <div
          className="fixed z-modal-raise min-w-[140px] bg-surface-raised border border-edge rounded-md shadow-2xl p-1"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <MenuItem icon={<ChevronsUp size={12} />} label="移到顶部" disabled={isTop} onClick={() => reorderLayer(menuLayer.id, 'top')} />
          <MenuItem icon={<ChevronUp size={12} />} label="上移一层" disabled={isTop} onClick={() => reorderLayer(menuLayer.id, 'up')} />
          <MenuItem icon={<ChevronDown size={12} />} label="下移一层" disabled={isBottom} onClick={() => reorderLayer(menuLayer.id, 'down')} />
          <MenuItem icon={<ChevronsDown size={12} />} label="移到底部" disabled={isBottom} onClick={() => reorderLayer(menuLayer.id, 'bottom')} />
          <div className="h-px my-1 bg-surface-hover-strong" />
          <MenuItem icon={<Brush size={12} />} label="涂抹擦除" onClick={() => { setPaintLayerId(menuLayer.id); setSelectedId(menuLayer.id) }} />
          <MenuItem icon={<Trash2 size={12} />} label="删除图层" onClick={() => removeLayer(menuLayer.id)} danger />
        </div>,
        document.body
      )}
    </div>
  )
}