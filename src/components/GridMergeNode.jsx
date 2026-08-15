import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Grid3X3, PanelsTopLeft, Layers, Loader2 } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import NodeShell from './base/NodeShell.jsx'
import CustomHandle from './CustomHandle.jsx'
import OverlayEditor, { renderOverlayCanvas } from './base/OverlayEditor.jsx'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'
import { useNodeResize } from './base/hooks.js'
import { showToast } from './base/toastStore.js'

/* ════════════════════════════════════════════════════════════════
 * 图片拼图节点（复刻官方 Yo.jsx / gridMergeNode）
 *
 * 三种拼接模式：
 *  - 网格（grid）：rows×cols 网格拼图，拖拽交换位置，分图角标、单格尺寸/比例/自适应
 *  - 长图（longImage）：垂直/水平拼接，间距、跟随首图/目标尺寸
 *  - 叠加（overlay）：完整图层编辑器（OverlayEditor，复刻 Uo.jsx）+ PNG 导出
 *
 * 核心链路：
 *  - 上游取图（imageBoxNode.images selectedIds优先/全部 → extractedImages → imageUrl）
 *  - 渲染：canvas 排布（grid cell / longImage 方向拼接）→ 预览 + 导出
 *  - 导出：renderToCanvas(true) / renderOverlayCanvas → 生成 imageNode 节点
 *
 * 端口：target default（按序填充）+ target cell-N（指定格子）；source merged-output / batch-output
 * ════════════════════════════════════════════════════════════════ */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const parseGrid = (str) => {
  const m = (str || '').trim().match(/^(\d+)\s*[x×*]\s*(\d+)$/i)
  if (!m) return null
  const rows = clamp(parseInt(m[1], 10), 1, 20)
  const cols = clamp(parseInt(m[2], 10), 1, 20)
  return rows && cols ? { rows, cols } : null
}
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
// 背景填充（复刻 shared.js Jo）：非透明→实色；透明预览→棋盘格；grid 预览→网格线
const fillBg = (ctx, w, h, isExport, color, grid = null) => {
  if (color !== 'transparent') {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
  } else if (!isExport) {
    for (let yy = 0; yy < h; yy += 14) {
      for (let xx = 0; xx < w; xx += 14) {
        ctx.fillStyle = (xx / 14 + yy / 14) % 2 < 1 ? '#1f2937' : '#111827'
        ctx.fillRect(xx, yy, 14, 14)
      }
    }
  }
  if (grid && !isExport) {
    ctx.strokeStyle = 'rgba(96,165,250,0.55)'
    ctx.lineWidth = 1
    for (let t = 1; t < grid.cols; t++) {
      const x = Math.round(t * grid.cellW) + 0.5
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let t = 1; t < grid.rows; t++) {
      const y = Math.round(t * grid.cellH) + 0.5
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
  }
}

const GRID_PRESETS = [
  { label: '2×2', rows: 2, cols: 2 },
  { label: '3×3', rows: 3, cols: 3 },
  { label: '4×4', rows: 4, cols: 4 },
  { label: '1×5', rows: 1, cols: 5 },
  { label: '5×1', rows: 5, cols: 1 }
]

export default function GridMergeNode({ id, data, selected }) {
  const { setNodes, getNodes, setEdges } = useReactFlow()
  const { isHidden } = useMediaDegrade()
  const { onMainBoxResize } = useNodeResize(id)
  const contentRef = useRef(null)

  // ---- 状态（复刻 Yo.jsx 1-52 行）----
  const gridSize = typeof data.gridSize === 'number' ? data.gridSize : undefined
  const [mergeMode, setMergeMode] = useState(data.mergeMode || 'grid')
  const [rows, setRows] = useState(data.rows ?? gridSize ?? 3)
  const [cols, setCols] = useState(data.cols ?? gridSize ?? 3)
  const [cellSize, setCellSize] = useState(data.cellSize || 512)
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || '1:1')
  const [autoSize, setAutoSize] = useState(data.autoSize ?? true)
  const [titlePattern, setTitlePattern] = useState(data.titlePattern || '')
  const [longDirection, setLongDirection] = useState(data.longDirection || 'vertical')
  const [longGap, setLongGap] = useState(data.longGap ?? 0)
  const [longTargetSize, setLongTargetSize] = useState(data.longTargetSize ?? 1024)
  const [longAutoSize, setLongAutoSize] = useState(data.longAutoSize ?? true)
  const [showCustom, setShowCustom] = useState(false)
  const [gridText, setGridText] = useState(`${data.rows ?? gridSize ?? 3}x${data.cols ?? gridSize ?? 3}`)
  const [bgColor, setBgColor] = useState(data.bgColor || 'transparent')
  const [preview, setPreview] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [gridCells, setGridCells] = useState([]) // rows×cols 定长数组
  const [longList, setLongList] = useState([]) // 长图图片数组
  const [overlayState, setOverlayState] = useState(() => {
    const e = data.overlayState
    if (e && Array.isArray(e.layers)) return e
    return { layers: [], canvasWidth: data.canvasWidth || 1024, canvasHeight: data.canvasHeight || 1024, bgColor: data.bgColor || 'transparent' }
  })
  // 拖拽交换状态
  const [dragFrom, setDragFrom] = useState(null)
  const [dragTo, setDragTo] = useState(null)
  const suppressSyncRef = useRef(false)

  // ---- 上游取图（复刻 Yo.jsx 89-189 行）----
  const connected = useConnectedInputs(id)

  // 收集上游图片（按 targetHandle 分配）
  const { gridCells: zCells, longList: bList } = useMemo(() => {
    const total = rows * cols
    const z = Array(total).fill(null)
    const n = []
    // connected.images 是 {id, url}[]，原型 useConnectedInputs 不区分 targetHandle，
    // 这里所有上游图片按 default 顺序填充 grid / 全部进 longList
    const urls = (connected.images || []).map((x) => x.url).filter(Boolean)
    urls.forEach((u, i) => {
      if (i < total) z[i] = u
      n.push(u)
    })
    return { gridCells: z, longList: n }
  }, [connected, rows, cols])

  useEffect(() => {
    setGridCells(zCells)
  }, [zCells])
  useEffect(() => {
    setLongList(bList)
  }, [bList])

  // ---- 同步 data（复刻 Yo.jsx 60-78 行）----
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, mergeMode, rows, cols, cellSize, aspectRatio, autoSize, titlePattern, longDirection, longGap, longTargetSize, longAutoSize, bgColor, overlayState, canvasWidth: overlayState.canvasWidth, canvasHeight: overlayState.canvasHeight } }
          : n
      )
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeMode, rows, cols, cellSize, aspectRatio, autoSize, titlePattern, longDirection, longGap, longTargetSize, longAutoSize, bgColor, overlayState])

  // ---- 高度自适应（内容撑多高，节点就多高）----
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight
      if (!h) return
      const n = getNodes().find((x) => x.id === id)
      const curH = n?.height ?? n?.style?.height ?? 0
      if (Math.abs(h - curH) < 4) return
      const curW = n?.width ?? n?.style?.width ?? 320
      onMainBoxResize(Math.round(curW), Math.max(160, Math.round(h)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [id, getNodes, onMainBoxResize])

  // ---- 渲染到 canvas（复刻 Yo.jsx pe）----
  const renderToCanvas = useCallback(
    async (isExport) => {
      try {
        if (mergeMode === 'longImage') {
          const list = longList
          if (list.length === 0) return null
          const imgs = (await Promise.all(list.map(loadImage))).filter(Boolean)
          if (imgs.length === 0) return null
          const vertical = longDirection === 'vertical'
          const base = longAutoSize ? (vertical ? imgs[0].width : imgs[0].height) : longTargetSize
          let totalW = 0
          let totalH = 0
          const sizes = []
          if (vertical) {
            totalW = base
            for (const img of imgs) {
              const w = base
              const h = Math.round((img.height / img.width) * base)
              sizes.push({ w, h })
              totalH += h
            }
            totalH += longGap * Math.max(0, imgs.length - 1)
          } else {
            totalH = base
            for (const img of imgs) {
              const h = base
              const w = Math.round((img.width / img.height) * base)
              sizes.push({ w, h })
              totalW += w
            }
            totalW += longGap * Math.max(0, imgs.length - 1)
          }
          const scale = isExport ? 1 : Math.min(1, 800 / Math.max(totalW, totalH))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(totalW * scale))
          canvas.height = Math.max(1, Math.round(totalH * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) return null
          fillBg(ctx, canvas.width, canvas.height, isExport, bgColor)
          let offset = 0
          imgs.forEach((img, i) => {
            const s = sizes[i]
            const w = s.w * scale
            const h = s.h * scale
            if (vertical) {
              ctx.drawImage(img, 0, offset, w, h)
              offset += h + longGap * scale
            } else {
              ctx.drawImage(img, offset, 0, w, h)
              offset += w + longGap * scale
            }
          })
          return canvas.toDataURL(isExport ? 'image/png' : 'image/jpeg', isExport ? 1 : 0.85)
        }
        if (mergeMode === 'grid') {
          const total = rows * cols
          const cells = gridCells.slice(0, total)
          const imgs = await Promise.all(cells.map((c) => (c ? loadImage(c) : Promise.resolve(null))))
          let cellW = cellSize
          let cellH = cellSize
          const first = imgs.find(Boolean)
          if (autoSize && first) {
            cellW = first.width
            cellH = first.height
          } else {
            const [rw, rh] = aspectRatio.split(':').map(Number)
            const ratio = rw / rh
            cellH = Math.round(cellSize / ratio)
          }
          const canvasW = cellW * cols
          const canvasH = cellH * rows
          const scale = isExport ? 1 : Math.min(1, 600 / Math.max(canvasW, canvasH))
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(canvasW * scale))
          canvas.height = Math.max(1, Math.round(canvasH * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) return null
          fillBg(ctx, canvas.width, canvas.height, isExport, bgColor, { rows, cols, cellW: cellW * scale, cellH: cellH * scale })
          imgs.forEach((img, n) => {
            if (n >= total) return
            const r = Math.floor(n / cols)
            const c = (n % cols) * cellW * scale
            const cy = r * cellH * scale
            const cw = cellW * scale
            const ch = cellH * scale
            if (img) ctx.drawImage(img, c, cy, cw, ch)
            const label = titlePattern.trim() ? titlePattern.replace('{num}', String(n + 1)) : ''
            if (label) {
              const fs = Math.max(12, cw * 0.08)
              ctx.font = `bold ${fs}px sans-serif`
              const tw = ctx.measureText(label)
              const padX = fs * 0.6
              const padY = fs * 0.4
              const bw = tw.width + padX * 2
              const bh = fs + padY * 2
              const margin = cw * 0.03
              ctx.fillStyle = 'rgba(0,0,0,0.75)'
              ctx.beginPath()
              const bx = c + margin
              const by = cy + margin
              if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, bw, bh, 8)
              else ctx.rect(bx, by, bw, bh)
              ctx.fill()
              ctx.fillStyle = '#fff'
              ctx.textBaseline = 'middle'
              ctx.textAlign = 'center'
              ctx.fillText(label, bx + bw / 2, by + bh / 2 + 2)
            }
          })
          return canvas.toDataURL(isExport ? 'image/png' : 'image/jpeg', isExport ? 1 : 0.85)
        }
        return null
      } catch (e) {
        console.error('renderToCanvas failed', e)
        return null
      }
    },
    [mergeMode, longList, longDirection, longAutoSize, longTargetSize, longGap, bgColor, gridCells, rows, cols, cellSize, autoSize, aspectRatio, titlePattern]
  )

  // ---- 预览（复刻 Yo.jsx useEffect[pe] debounce 250ms）----
  useEffect(() => {
    if (mergeMode === 'overlay') return
    let timer
    timer = window.setTimeout(async () => {
      setPreview(await renderToCanvas(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [renderToCanvas, mergeMode])

  // ---- 开始合成（复刻 Yo.jsx me）----
  const handleMerge = useCallback(async () => {
    const canMerge = mergeMode === 'longImage' ? longList.length !== 0 : mergeMode === 'grid' ? !gridCells.every((c) => !c) : overlayState.layers.length !== 0
    if (!canMerge) return
    setExporting(true)
    try {
      let url = null
      if (mergeMode === 'overlay') {
        url = await renderOverlayCanvas(overlayState)
      } else {
        url = await renderToCanvas(true)
      }
      if (url) {
        setPreview(url)
        setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, imageUrl: url } } : n)))
        spawnMergedImage(url)
      }
    } finally {
      setExporting(false)
    }
  }, [mergeMode, longList, gridCells, overlayState, renderToCanvas, id, setNodes])

  // 生成合成图片节点（复刻 Yo.jsx onSpawnImageNode）
  const spawnMergedImage = useCallback(
    (url) => {
      const me = getNodes().find((n) => n.id === id)
      const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 400) + 50
      const baseY = me?.position.y ?? 100
      const nid = `merged-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setNodes((ns) =>
        ns.concat([{ id: nid, type: 'imageNode', position: { x: baseX, y: baseY }, data: { imageUrl: url, label: `合并结果`, expanded: false }, style: { width: 320, height: 320 } }])
      )
      setEdges((es) => es.concat([{ id: `e-${id}-${nid}`, source: id, target: nid, sourceHandle: 'merged-output' }]))
    },
    [id, getNodes, setNodes, setEdges]
  )

  // 交换 grid cell（拖拽）
  const swapCells = useCallback((from, to) => {
    if (from === to) return
    suppressSyncRef.current = true
    setGridCells((arr) => {
      const c = arr.slice()
      const t = c[from]
      c[from] = c[to]
      c[to] = t
      return c
    })
  }, [])
  // 交换 longList（拖拽）
  const swapLong = useCallback((from, to) => {
    if (from === to) return
    setLongList((arr) => {
      const c = arr.slice()
      const t = c[from]
      c[from] = c[to]
      c[to] = t
      return c
    })
  }, [])

  const titleIcon = <Layers size={11} className="text-gray-500" />
  const totalCells = rows * cols
  const totalCount = mergeMode === 'longImage' ? Math.max(1, longList.length || 3) : totalCells

  const modeBtn = (mode, label, icon, title) => (
    <button
      key={mode}
      className={`px-1.5 py-0.5 rounded text-caption flex items-center gap-1 border transition-colors cursor-pointer ${
        mergeMode === mode ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400 hover:text-white'
      }`}
      onClick={() => setMergeMode(mode)}
      title={title}
    >
      {icon}
      <span>{label}</span>
    </button>
  )

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="图像拼图"
      icon={titleIcon}
      selected={selected}
      showHandles={false}
      titleRight={
        <div className="flex items-center gap-1 nodrag">
          {modeBtn('grid', '网格', <Grid3X3 size={11} />, '网格拼图')}
          {modeBtn('longImage', '长图', <PanelsTopLeft size={11} />, '无限长图')}
          {modeBtn('overlay', '叠加', <Layers size={11} />, '叠加图层')}
        </div>
      }
      className="min-w-[320px]"
    >
      <CustomHandle position="left" handleId="default" variant="small" />
      <CustomHandle position="right" handleId="merged-output" variant="small" />

      <div ref={contentRef} className="p-3 space-y-3 bg-surface relative drag-handle w-full">
        {/* 预览区（含可拖拽 cell/项，复刻官方 Yo.jsx Component614/616 自由组合拼图） */}
        {mergeMode !== 'overlay' && (
          <div
            className="bg-canvas rounded border border-edge flex items-center justify-center relative overflow-hidden nodrag"
            style={{ minHeight: 160, maxHeight: 360 }}
          >
            {preview && <img src={preview} alt="Preview" className="max-w-full max-h-[360px] object-contain block pointer-events-none" />}

            {/* grid 模式：可拖拽 cell 网格层（复刻官方自由组合拼图） */}
            {mergeMode === 'grid' && (
              <div
                className="absolute inset-0"
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`
                }}
              >
                {Array.from({ length: totalCells }).map((_, t) => {
                  const n = gridCells[t]
                  const isDragFrom = dragFrom === t
                  const isDragTo = dragTo === t && dragFrom !== null && dragFrom !== t
                  return (
                    <div
                      key={t}
                      draggable={!!n}
                      onDragStart={(e) => {
                        if (!n) return
                        e.stopPropagation()
                        setDragFrom(t)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('application/x-yimao-puzzle', String(t))
                        const ghost = document.createElement('div')
                        ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;'
                        document.body.appendChild(ghost)
                        e.dataTransfer.setDragImage(ghost, 0, 0)
                        setTimeout(() => { try { document.body.removeChild(ghost) } catch {} }, 0)
                      }}
                      onDragEnter={(e) => {
                        if (dragFrom !== null) {
                          e.preventDefault()
                          e.stopPropagation()
                          setDragTo(t)
                        }
                      }}
                      onDragOver={(e) => {
                        if (dragFrom !== null) {
                          e.preventDefault()
                          e.stopPropagation()
                          e.dataTransfer.dropEffect = 'move'
                          if (dragTo !== t) setDragTo(t)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const fromRaw = e.dataTransfer.getData('application/x-yimao-puzzle')
                        const from = fromRaw ? parseInt(fromRaw, 10) : dragFrom ?? -1
                        if (from < 0 || from === t || Number.isNaN(from)) {
                          setDragFrom(null); setDragTo(null)
                          return
                        }
                        swapCells(from, t)
                        setDragFrom(null); setDragTo(null)
                      }}
                      onDragEnd={(e) => {
                        e.stopPropagation()
                        setDragFrom(null); setDragTo(null)
                      }}
                      title={n ? `第 ${t + 1} 格：拖到其它格子可交换位置` : ''}
                      className={`relative rounded-[2px] transition-all ${n ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragFrom ? 'opacity-30 ring-2 ring-blue-300' : ''} ${isDragTo ? 'ring-2 ring-blue-400 bg-blue-400/15' : ''}`}
                    >
                      {n && (
                        <>
                          <img src={n} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                          <span className="absolute top-1 right-1 px-1 py-px rounded text-meta font-mono pointer-events-none ${isDragTo ? 'bg-blue-500 text-white' : 'bg-black/60 text-white/80'}">
                            {t + 1}
                          </span>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* longImage 模式：可拖拽项列表 */}
            {mergeMode === 'longImage' && (
              <div
                className="absolute inset-0 flex gap-1 p-2"
                style={{ flexDirection: longDirection === 'vertical' ? 'column' : 'row' }}
              >
                {longList.map((n, t) => {
                  const isDragFrom = dragFrom === t
                  const isDragTo = dragTo === t && dragFrom !== null && dragFrom !== t
                  return (
                    <div
                      key={t}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        setDragFrom(t)
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('application/x-yimao-puzzle', String(t))
                        const ghost = document.createElement('div')
                        ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;'
                        document.body.appendChild(ghost)
                        e.dataTransfer.setDragImage(ghost, 0, 0)
                        setTimeout(() => { try { document.body.removeChild(ghost) } catch {} }, 0)
                      }}
                      onDragEnter={(e) => {
                        if (dragFrom !== null) {
                          e.preventDefault()
                          e.stopPropagation()
                          setDragTo(t)
                        }
                      }}
                      onDragOver={(e) => {
                        if (dragFrom !== null) {
                          e.preventDefault()
                          e.stopPropagation()
                          e.dataTransfer.dropEffect = 'move'
                          if (dragTo !== t) setDragTo(t)
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const fromRaw = e.dataTransfer.getData('application/x-yimao-puzzle')
                        const from = fromRaw ? parseInt(fromRaw, 10) : dragFrom ?? -1
                        if (from < 0 || from === t || Number.isNaN(from)) {
                          setDragFrom(null); setDragTo(null)
                          return
                        }
                        swapLong(from, t)
                        setDragFrom(null); setDragTo(null)
                      }}
                      onDragEnd={(e) => {
                        e.stopPropagation()
                        setDragFrom(null); setDragTo(null)
                      }}
                      title={`第 ${t + 1} 张：拖到其它项可交换顺序`}
                      className={`relative rounded-[2px] overflow-hidden transition-all flex-1 cursor-grab active:cursor-grabbing ${isDragFrom ? 'opacity-30 ring-2 ring-blue-300' : ''} ${isDragTo ? 'ring-2 ring-blue-400 bg-blue-400/15' : ''}`}
                      style={{ minWidth: longDirection === 'horizontal' ? 40 : 0, minHeight: longDirection === 'vertical' ? 40 : 0 }}
                    >
                      <img src={n} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                      <span className={`absolute m-1 px-1 py-px rounded text-meta font-mono pointer-events-none ${isDragTo ? 'bg-blue-500 text-white' : 'bg-black/60 text-white/80'}`}>
                        {t + 1}
                      </span>
                    </div>
                  )
                })}
                {longList.length === 0 && (
                  <div className="w-full h-full flex items-center justify-center text-caption text-gray-600">连线图片加入</div>
                )}
              </div>
            )}

            {exporting && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="animate-spin text-white" size={20} />
              </div>
            )}
          </div>
        )}

        {/* 控制区 */}
        <div className="space-y-2 nodrag">
          {/* 背景 */}
          <div className="flex items-center gap-1.5 text-caption text-gray-400">
            <span>背景</span>
            <button
              className={`px-1.5 py-0.5 rounded border text-caption transition-colors cursor-pointer ${bgColor === 'transparent' ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400 hover:text-white'}`}
              onClick={() => setBgColor('transparent')}
              title="透明背景（导出 PNG 保留透明通道）"
            >
              透明
            </button>
            <input type="color" value={bgColor === 'transparent' ? '#000000' : bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-6 h-5 rounded border border-edge bg-transparent cursor-pointer" title="自定义背景色" />
            {bgColor !== 'transparent' && <span className="font-mono text-gray-500">{bgColor}</span>}
          </div>

          {/* 网格参数 */}
          {mergeMode === 'grid' && (
            <>
              <div className="flex flex-wrap items-center gap-1">
                {GRID_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={`text-caption px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      rows === p.rows && cols === p.cols ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400 hover:text-white hover:border-edge-strong'
                    }`}
                    onClick={() => { setRows(p.rows); setCols(p.cols); setGridText(`${p.rows}x${p.cols}`) }}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  className={`text-caption px-2 py-0.5 rounded border transition-colors cursor-pointer ${showCustom ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400 hover:text-white hover:border-edge-strong'}`}
                  onClick={() => setShowCustom((v) => !v)}
                >
                  自定义
                </button>
              </div>
              {showCustom && (
                <div className="flex items-center gap-1.5 text-caption text-gray-400">
                  <span>行</span>
                  <input type="number" min={1} max={20} value={rows} onChange={(e) => { const v = clamp(parseInt(e.target.value || '1', 10) || 1, 1, 20); setRows(v); setGridText(`${v}x${cols}`) }} className="w-12 bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge outline-none" />
                  <span>×</span>
                  <span>列</span>
                  <input type="number" min={1} max={20} value={cols} onChange={(e) => { const v = clamp(parseInt(e.target.value || '1', 10) || 1, 1, 20); setCols(v); setGridText(`${rows}x${v}`) }} className="w-12 bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge outline-none" />
                  <span className="mx-1 text-subtle">|</span>
                  <input type="text" value={gridText} placeholder="1x5" onChange={(e) => setGridText(e.target.value)} onBlur={() => { const r = parseGrid(gridText); if (r) { setRows(r.rows); setCols(r.cols) } }} onKeyDown={(e) => { if (e.key === 'Enter') { const r = parseGrid(gridText); if (r) { setRows(r.rows); setCols(r.cols) } } }} className="flex-1 bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge outline-none" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input className="flex-1 bg-surface-hover text-gray-300 text-xs rounded px-2 py-1 border border-edge outline-none" placeholder="分图角标，{num} 引入数字编号，可留空" value={titlePattern} onChange={(e) => setTitlePattern(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <select value={autoSize ? 'auto' : cellSize} onChange={(e) => { const v = e.target.value; if (v === 'auto') setAutoSize(true); else { setAutoSize(false); setCellSize(Number(v)) } }} className="bg-surface-hover text-gray-300 text-xs rounded px-2 py-1 border border-edge outline-none flex-1" title="单格尺寸">
                  <option value="auto">自适应</option>
                  <option value={256}>256px</option>
                  <option value={512}>512px</option>
                  <option value={1024}>1024px</option>
                  <option value={2048}>2048px</option>
                </select>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} disabled={autoSize} className="bg-surface-hover text-gray-300 text-xs rounded px-2 py-1 border border-edge outline-none flex-1" title="比例" style={{ opacity: autoSize ? 0.5 : 1 }}>
                  <option value="1:1">1:1</option>
                  <option value="16:9">16:9</option>
                  <option value="4:3">4:3</option>
                  <option value="3:4">3:4</option>
                  <option value="9:16">9:16</option>
                </select>
              </div>
            </>
          )}

          {/* 长图参数 */}
          {mergeMode === 'longImage' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-caption text-gray-400">
                <span>方向</span>
                <button className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${longDirection === 'vertical' ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400'}`} onClick={() => setLongDirection('vertical')}>垂直</button>
                <button className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${longDirection === 'horizontal' ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400'}`} onClick={() => setLongDirection('horizontal')}>水平</button>
                <span className="ml-auto">{longList.length} 张</span>
              </div>
              <div className="flex items-center gap-2 text-caption text-gray-400">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={longAutoSize} onChange={(e) => setLongAutoSize(e.target.checked)} className="accent-blue-500" />
                  跟随首图
                </label>
                <span>{longDirection === 'vertical' ? '宽度' : '高度'}</span>
                <input type="number" min={64} max={4096} value={longTargetSize} onChange={(e) => setLongTargetSize(clamp(parseInt(e.target.value || '1024', 10) || 1024, 64, 4096))} disabled={longAutoSize} className="w-20 bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge outline-none disabled:opacity-50" />
                <span>间距</span>
                <input type="number" min={0} max={200} value={longGap} onChange={(e) => setLongGap(clamp(parseInt(e.target.value || '0', 10) || 0, 0, 200))} className="w-14 bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge outline-none" />
              </div>
            </div>
          )}

          {/* 叠加编辑器 */}
          {mergeMode === 'overlay' && (
            <OverlayEditor state={overlayState} onChange={setOverlayState} upstreamUrls={longList} />
          )}

          {/* 开始合成 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleMerge}
              disabled={mergeMode === 'overlay' ? overlayState.layers.length === 0 : connected.images.length === 0}
              className={`flex-1 py-1.5 rounded text-xs transition-colors ${(mergeMode === 'overlay' ? overlayState.layers.length > 0 : connected.images.length > 0) ? 'bg-blue-600 text-white hover:bg-blue-500 cursor-pointer' : 'bg-surface-hover-strong text-gray-500 cursor-not-allowed'}`}
            >
              开始合成
            </button>
          </div>
        </div>
      </div>

      <CustomHandle position="right" handleId="batch-output" variant="small" />
    </NodeShell>
  )
}