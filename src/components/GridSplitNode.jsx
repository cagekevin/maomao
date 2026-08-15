import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Grid3X3, SlidersHorizontal, Scissors, CircleCheck, RotateCcw, Expand, Trash2, X, Box, ArrowRight } from 'lucide-react'
import { useReactFlow, Handle, Position } from '@xyflow/react'
import NodeShell from './base/NodeShell.jsx'
import CustomHandle from './CustomHandle.jsx'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'
import { useNodeResize } from './base/hooks.js'
import { showToast } from './base/toastStore.js'

/* ════════════════════════════════════════════════════════════════
 * 图片切分节点（复刻官方 Lo.jsx / gridSplitNode）
 *
 * 三种切分模式：
 *  - 规则网格（grid）：预设 2×2/3×3/4×4/1×5/5×1 + 自定义行列，均匀切块
 *  - 手动（manual）：双击加水平线、Shift+双击加垂直线，拖动线移动，Shift+点击删除
 *  - 切刀（lasso）：鼠标绘制任意形状（边缘自动吸附），点编号切块，支持全屏聚焦
 *
 * 核心链路：
 *  - 上游图片（imageUrl，从 target「in」连线或 ImageBoxNode 取）
 *  - 预切图：加载源图 → 按 cells 区域 canvas 裁切 → 写 data.extractedImages
 *  - 单块切出：点击 cell → 生成 imageNode + 自动连线
 *  - 批量切分：全部块 → 生成多个 imageNode 网格 + 自动连线（或推送图片盒子）
 *
 * 端口：target「in」接图；source「batch」批量输出；source「cell-N」单块输出
 * ════════════════════════════════════════════════════════════════ */

// ---- 工具（复刻 shared.js：Do/Oo/ko/No/Po/Ao/Fo）----
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const norm = (arr) =>
  Array.from(new Set(arr.map((v) => clamp(v, 0.01, 0.99)).map((v) => Math.round(v * 10000) / 10000))).sort((a, b) => a - b)
const pairs = (arr) => {
  const t = [0, ...arr, 1]
  const out = []
  for (let i = 0; i < t.length - 1; i++) out.push([t[i], t[i + 1]])
  return out
}
const genId = () => `lasso-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const SNAP = 0.04
const snapEdge = (p) => {
  const t = p.y, b = 1 - p.y, l = p.x, r = 1 - p.x
  const m = Math.min(t, b, l, r)
  if (m > SNAP) return { x: p.x, y: p.y, edge: null }
  if (m === t) return { x: p.x, y: 0, edge: 'top' }
  if (m === b) return { x: p.x, y: 1, edge: 'bottom' }
  if (m === l) return { x: 0, y: p.y, edge: 'left' }
  return { x: 1, y: p.y, edge: 'right' }
}
const EDGE_PTS = {
  'top-right': { x: 1, y: 0 },
  'bottom-right': { x: 1, y: 1 },
  'bottom-left': { x: 0, y: 1 },
  'top-left': { x: 0, y: 0 }
}
const EDGE_ORDER = ['top', 'right', 'bottom', 'left']
const closePolygon = (pts, startEdge, endEdge) => {
  if (!startEdge || !endEdge) return pts
  const r = [...pts]
  if (startEdge === endEdge) return r
  const o = EDGE_ORDER.indexOf(endEdge)
  const s = EDGE_ORDER.indexOf(startEdge)
  let c = o
  while (c !== s) {
    const e = EDGE_ORDER[c] === 'top' ? 'top-right' : EDGE_ORDER[c] === 'right' ? 'bottom-right' : EDGE_ORDER[c] === 'bottom' ? 'bottom-left' : 'top-left'
    r.push(EDGE_PTS[e])
    c = (c + 1) % 4
  }
  return r
}
const bounds = (pts) => {
  let minX = 1, minY = 1, maxX = 0, maxY = 0
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

// ---- 不规则形状裁剪（复刻 Io.jsx：clip path + drawImage → png）----
function clipShape(src, points) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => doClip(img)
    img.onerror = () => {
      const retry = new Image()
      retry.src = src
      retry.onload = () => doClip(retry)
      retry.onerror = () => resolve(null)
    }
    img.src = src
    function doClip(srcImg) {
      try {
        const w = srcImg.naturalWidth || srcImg.width
        const h = srcImg.naturalHeight || srcImg.height
        const b = bounds(points)
        const c = b.minX * w
        const d = b.minY * h
        const cw = Math.max(1, (b.maxX - b.minX) * w)
        const ch = Math.max(1, (b.maxY - b.minY) * h)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(cw)
        canvas.height = Math.round(ch)
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.save()
        ctx.beginPath()
        points.forEach((p, i) => {
          const px = p.x * w - c
          const py = p.y * h - d
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(srcImg, -c, -d, w, h)
        ctx.restore()
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
  })
}

const GRID_PRESETS = [
  { label: '2×2', rows: 2, cols: 2 },
  { label: '3×3', rows: 3, cols: 3 },
  { label: '4×4', rows: 4, cols: 4 },
  { label: '1×5', rows: 1, cols: 5 },
  { label: '5×1', rows: 5, cols: 1 }
]
const LASSO_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='6' cy='6' r='3'/><circle cx='6' cy='18' r='3'/><line x1='20' y1='4' x2='8.12' y2='15.88'/><line x1='14.47' y1='14.48' x2='20' y2='20'/><line x1='8.12' y1='8.12' x2='12' y2='12'/></svg>") 4 4, crosshair`

export default function GridSplitNode({ id, data, selected }) {
  const { setNodes, getNodes, setEdges, getEdges } = useReactFlow()
  const { isHidden } = useMediaDegrade()
  const { onMainBoxResize } = useNodeResize(id)

  // 内容区引用：高度自适应（内容撑多高，节点就多高，不留空白，复刻 ScriptBoxNode 自适应方案）
  const contentRef = useRef(null)

  // ---- 状态（复刻 Lo.jsx：state 名与官方逻辑一一对应）----
  const gridSize = typeof data.gridSize === 'number' ? data.gridSize : undefined
  const [splitMode, setSplitMode] = useState(data.splitMode || 'grid')
  const [rows, setRows] = useState(data.rows ?? gridSize ?? 3)
  const [cols, setCols] = useState(data.cols ?? gridSize ?? 3)
  const [hLines, setHLines] = useState(Array.isArray(data.hLines) ? norm(data.hLines) : [0.5])
  const [vLines, setVLines] = useState(Array.isArray(data.vLines) ? norm(data.vLines) : [0.5])
  const [lassoShapes, setLassoShapes] = useState(Array.isArray(data.lassoShapes) ? data.lassoShapes : [])
  const [activeLasso, setActiveLasso] = useState(null) // 当前绘制/选中的 lasso id
  const [titlePattern, setTitlePattern] = useState(data.titlePattern || '#{num}')
  const [sendToImageBox, setSendToImageBox] = useState(data.sendToImageBox ?? false)
  const [showCustom, setShowCustom] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [dragLine, setDragLine] = useState(null) // { type:'h'|'v', index } 拖动切割线

  // ---- 上游图片（复刻 Lo.jsx F：data.imageUrl 优先，否则取上游 imageUrl）----
  const connected = useConnectedInputs(id)
  const upstreamImg = connected.images[0]?.url
  const imageUrl = data.imageUrl || (typeof upstreamImg === 'string' ? upstreamImg : '') || ''

  // 画布引用
  const mainCanvasRef = useRef(null)
  const fullCanvasRef = useRef(null)
  const activeCellIdRef = useRef(null) // 当前绘制的 lasso 记录（mousemove 用）

  // ---- 高度自适应（内容撑多高，节点就多高，不留空白；对齐 ScriptBoxNode 自适应方案）----
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight
      if (!h) return
      const n = getNodes().find((x) => x.id === id)
      const curH = n?.height ?? n?.style?.height ?? 0
      if (Math.abs(h - curH) < 4) return
      const curW = n?.width ?? n?.style?.width ?? 280
      onMainBoxResize(Math.round(curW), Math.max(120, Math.round(h)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [id, getNodes, onMainBoxResize])

  // ---- 切分计算 cells（复刻 Lo.jsx I）----
  const cells = useMemo(() => {
    if (splitMode === 'grid') {
      const cellW = 1 / cols
      const cellH = 1 / rows
      const out = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          out.push({ x: c * cellW, y: r * cellH, w: cellW, h: cellH })
        }
      }
      return out
    }
    if (splitMode === 'manual') {
      const vp = pairs(vLines)
      const hp = pairs(hLines)
      const out = []
      for (const [ry, ry2] of hp) {
        for (const [rx, rx2] of vp) {
          out.push({ x: rx, y: ry, w: rx2 - rx, h: ry2 - ry })
        }
      }
      return out
    }
    return []
  }, [splitMode, rows, cols, vLines, hLines])

  // 已绘制闭合块数（复刻 Lo.jsx ee）
  const closedCount = splitMode === 'lasso' ? lassoShapes.filter((s) => s.closed && s.points.length >= 3).length : cells.length
  // 行列计数（复刻 Lo.jsx L/R）
  const rowCount = splitMode === 'grid' ? rows : splitMode === 'manual' ? hLines.length + 1 : 1
  const colCount = splitMode === 'grid' ? cols : splitMode === 'manual' ? vLines.length + 1 : closedCount

  // 每个闭合 lasso 的中心（复刻 Lo.jsx me）
  const lassoCenters = useMemo(
    () =>
      lassoShapes
        .filter((s) => s.closed && s.points.length >= 3)
        .map((s) => {
          const n = s.points.length
          let sx = 0, sy = 0
          for (const p of s.points) { sx += p.x; sy += p.y }
          return { id: s.id, cx: sx / n, cy: sy / n }
        }),
    [lassoShapes]
  )

  // ---- 预切图（复刻 Lo.jsx useEffect[F,I,...]：加载源图按 cells 裁切写 extractedImages）----
  useEffect(() => {
    if (splitMode === 'lasso') return
    if (!imageUrl) {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, extractedImages: [], rows: rowCount, cols: colCount, gridSize: Math.max(rowCount, colCount), splitMode, hLines, vLines, lassoShapes } }
            : n
        )
      )
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = imageUrl
        await new Promise((res) => {
          img.onload = res
          img.onerror = () => {
            const retry = new Image()
            retry.src = imageUrl
            retry.onload = () => res()
            retry.onerror = () => res()
          }
        })
        const iw = img.width
        const ih = img.height
        const out = []
        for (const cell of cells) {
          const sx = cell.x * iw
          const sy = cell.y * ih
          const sw = cell.w * iw
          const sh = cell.h * ih
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(sw))
          canvas.height = Math.max(1, Math.round(sh))
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
            out.push(canvas.toDataURL('image/jpeg', 0.85))
          } else {
            out.push(null)
          }
        }
        if (!cancelled) {
          setNodes((ns) =>
            ns.map((n) =>
              n.id === id
                ? { ...n, data: { ...n.data, extractedImages: out, rows: rowCount, cols: colCount, gridSize: Math.max(rowCount, colCount), splitMode, hLines, vLines, lassoShapes } }
                : n
            )
          )
        }
      } catch (e) {
        console.error('Failed to pre-crop images:', e)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, cells, rowCount, colCount, splitMode, hLines, vLines, lassoShapes])

  // ---- lasso 模式预切（复刻 Lo.jsx useEffect[F,_,...]：用 clipShape 裁闭包形状）----
  useEffect(() => {
    if (splitMode !== 'lasso' || activeCellIdRef.current) return
    if (!imageUrl) {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, extractedImages: [], rows: 1, cols: 0, gridSize: 1, splitMode, hLines, vLines, lassoShapes } } : n
        )
      )
      return
    }
    let cancelled = false
    ;(async () => {
      const closed = lassoShapes.filter((s) => s.closed && s.points.length >= 3)
      const out = []
      for (const s of closed) {
        const r = await clipShape(imageUrl, s.points)
        out.push(r)
        if (cancelled) return
      }
      if (!cancelled) {
        setNodes((ns) =>
          ns.map((n) =>
            n.id === id
              ? { ...n, data: { ...n.data, extractedImages: out, rows: 1, cols: closed.length, gridSize: Math.max(1, closed.length), splitMode, hLines, vLines, lassoShapes } }
              : n
          )
        )
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, lassoShapes, splitMode, hLines, vLines])

  // 同步外部 data 变化（复刻 Lo.jsx 各 sync effect）
  useEffect(() => {
    if (data.lassoShapes && JSON.stringify(data.lassoShapes) !== JSON.stringify(lassoShapes)) {
      setLassoShapes(data.lassoShapes)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lassoShapes])
  useEffect(() => {
    if (typeof data.rows === 'number' && data.rows !== rows) setRows(clamp(data.rows, 1, 20))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rows])
  useEffect(() => {
    if (typeof data.cols === 'number' && data.cols !== cols) setCols(clamp(data.cols, 1, 20))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.cols])
  useEffect(() => {
    if (data.splitMode && data.splitMode !== splitMode) setSplitMode(data.splitMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.splitMode])

  // 写 titlePattern / sendToImageBox 回 data（复刻 Lo.jsx useEffect）
  useEffect(() => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, titlePattern, sendToImageBox } } : n)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titlePattern, sendToImageBox])

  // 已连接的 cell 端口集合（复刻 Lo.jsx ne）
  const connectedCells = useMemo(() => {
    const s = new Set()
    getEdges()
      .filter((e) => e.source === id && e.sourceHandle?.startsWith('cell-'))
      .forEach((e) => s.add(parseInt(e.sourceHandle.replace('cell-', ''), 10)))
    return s
  }, [getEdges, id])

  // ---- 手动模式：双击加线 / Shift+双击加垂直线（复刻 Lo.jsx oe）----
  const onManualDbl = useCallback(
    (e) => {
      if (splitMode !== 'manual') return
      e.stopPropagation()
      const el = mainCanvasRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const rx = (e.clientX - rect.left) / rect.width
      const ry = (e.clientY - rect.top) / rect.height
      if (e.shiftKey) {
        setVLines((arr) => norm([...arr, rx]))
      } else {
        setHLines((arr) => norm([...arr, ry]))
      }
    },
    [splitMode]
  )

  // 拖动切割线（复刻 Lo.jsx useEffect[ie]）
  useEffect(() => {
    if (!dragLine) return
    const el = mainCanvasRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const onMove = (e) => {
      if (dragLine.type === 'h') {
        const v = clamp((e.clientY - rect.top) / rect.height, 0.01, 0.99)
        setHLines((arr) => norm(arr.map((line, i) => (i === dragLine.index ? v : line))))
      } else {
        const v = clamp((e.clientX - rect.left) / rect.width, 0.01, 0.99)
        setVLines((arr) => norm(arr.map((line, i) => (i === dragLine.index ? v : line))))
      }
    }
    const onUp = () => setDragLine(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragLine])

  // 删除切割线（复刻 Lo.jsx H/se）
  const removeHLine = useCallback((i) => setHLines((arr) => arr.filter((_, n) => n !== i)), [])
  const removeVLine = useCallback((i) => setVLines((arr) => arr.filter((_, n) => n !== i)), [])
  const resetLines = useCallback(() => {
    setHLines([0.5])
    setVLines([0.5])
  }, [])

  // ---- 切刀模式：开始绘制（复刻 Lo.jsx U）----
  const onLassoDown = useCallback(
    (e) => {
      if (splitMode !== 'lasso') return
      e.stopPropagation()
      e.preventDefault()
      const el = fullscreen ? fullCanvasRef.current : mainCanvasRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pt = snapEdge({
        x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((e.clientY - rect.top) / rect.height, 0, 1)
      })
      setActiveLasso(pt.edge)
      const nid = genId()
      setLassoShapes((arr) => [...arr, { id: nid, points: [{ x: pt.x, y: pt.y }], closed: false }])
      activeCellIdRef.current = { id: nid, lastX: pt.x, lastY: pt.y }
    },
    [splitMode, fullscreen]
  )

  // 切刀绘制 mousemove/mouseup（复刻 Lo.jsx useEffect[o,A,V]）
  useEffect(() => {
    if (splitMode !== 'lasso') return
    const el = () => (fullscreen ? fullCanvasRef.current : mainCanvasRef.current)
    const onMove = (e) => {
      const rec = activeCellIdRef.current
      if (!rec) return
      const elRef = el()
      if (!elRef) return
      const rect = elRef.getBoundingClientRect()
      const x = clamp((e.clientX - rect.left) / rect.width, 0, 1)
      const y = clamp((e.clientY - rect.top) / rect.height, 0, 1)
      const dx = x - rec.lastX
      const dy = y - rec.lastY
      if (dx * dx + dy * dy < 0.0006) return
      rec.lastX = x
      rec.lastY = y
      setLassoShapes((arr) =>
        arr.map((s) => (s.id === rec.id ? { ...s, points: [...s.points, { x, y }] } : s))
      )
    }
    const onUp = () => {
      const rec = activeCellIdRef.current
      if (!rec) return
      activeCellIdRef.current = null
      const edge = activeLasso
      setActiveLasso(null)
      setLassoShapes((arr) =>
        arr
          .map((s) => {
            if (s.id !== rec.id || s.points.length < 3) return s
            let pts = s.points.slice()
            const last = pts[pts.length - 1]
            const snapped = snapEdge(last)
            if (snapped.edge) pts[pts.length - 1] = { x: snapped.x, y: snapped.y }
            if (edge && snapped.edge) pts = closePolygon(pts, edge, snapped.edge)
            return { ...s, points: pts, closed: true }
          })
          .filter((s) => s.id !== rec.id || s.points.length >= 3)
      )
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [splitMode, fullscreen, activeLasso])

  // 全屏 Esc 关闭（复刻 Lo.jsx useEffect[D]）
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // 删除单个 lasso（复刻 Lo.jsx W）
  const removeLasso = useCallback((lid) => {
    setLassoShapes((arr) => arr.filter((s) => s.id !== lid))
    setActiveLasso((cur) => (cur === lid ? null : cur))
  }, [])
  const clearLasso = useCallback(() => {
    setLassoShapes([])
    setActiveLasso(null)
  }, [])

  // ---- 生成图片节点（复刻 H_.jsx lr/cr：创建 imageNode + 自动连线）----
  const spawnImageNodes = useCallback(
    (list) => {
      if (!list || list.length === 0) return
      const me = getNodes().find((n) => n.id === id)
      const baseX = (me?.position.x ?? 100) + (me?.measured?.width ?? 400) + 50
      const baseY = me?.position.y ?? 100
      const colsCount = Math.max(1, Math.ceil(Math.sqrt(list.length)))
      const newNodes = list.map((item, n) => {
        const r = Math.floor(n / colsCount)
        const c = n % colsCount
        return {
          id: `split-${id}-${Date.now()}-${n}-${Math.random().toString(36).slice(2, 5)}`,
          type: 'imageNode',
          position: { x: baseX + c * 330, y: baseY + r * 330 },
          data: { imageUrl: item.url, label: item.label, expanded: false },
          style: { width: 320, height: 320 }
        }
      })
      const newEdges = newNodes.map((nn) => ({ id: `e-${id}-${nn.id}`, source: id, target: nn.id }))
      setNodes((ns) => ns.concat(newNodes))
      setEdges((es) => es.concat(newEdges))
      return newNodes
    },
    [id, getNodes, setNodes, setEdges]
  )

  // ---- 批量切分（复刻 Lo.jsx G → onSplit；这里组件内直接生成）----
  const handleSplit = useCallback(() => {
    if (!imageUrl) {
      showToast('请先连接包含图片的节点')
      return
    }
    const valid = (data.extractedImages || []).filter((x) => typeof x === 'string' && !!x)
    if (valid.length === 0) {
      showToast('没有可用的切片，请先连接图片')
      return
    }
    // sendToImageBox：推送已有图片盒子，没有则新建一个（简化：统一生成 imageNode 网格）
    const items = valid.map((url, i) => ({ url, label: titlePattern.replace('{num}', String(i + 1)) }))
    spawnImageNodes(items)
    showToast(`已生成 ${items.length} 张切片`)
  }, [imageUrl, data.extractedImages, titlePattern, spawnImageNodes])

  // ---- 单块切出（复刻 Lo.jsx ue → onSplitOne）----
  const handleSplitOne = useCallback(
    (index) => {
      if (!imageUrl) {
        showToast('请先连接包含图片的节点')
        return
      }
      const list = data.extractedImages || []
      let url
      if (splitMode === 'manual' || splitMode === 'lasso') {
        url = list[index]
        if (!url) return
      } else {
        url = list[index]
      }
      if (!url) return
      const label = titlePattern.replace('{num}', String(index + 1))
      spawnImageNodes([{ url, label }])
    },
    [imageUrl, data.extractedImages, splitMode, titlePattern, spawnImageNodes]
  )

  // 标题图标
  const titleIcon = <Grid3X3 size={11} className="text-gray-500" />

  // 模式切换按钮
  const modeBtn = (mode, label, icon, title) => (
    <button
      key={mode}
      className={`px-1.5 py-0.5 rounded text-caption flex items-center gap-1 border transition-colors cursor-pointer ${
        splitMode === mode ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400 hover:text-white'
      }`}
      onClick={() => setSplitMode(mode)}
      title={title}
    >
      {icon}
      <span>{label}</span>
    </button>
  )

  // 渲染 cell 覆盖层（grid/manual）
  const renderCells = () => {
    if (splitMode === 'lasso') return null
    return cells.map((cell, i) => (
      <div
        key={i}
        className="absolute border border-white/20 hover:bg-blue-500/30 hover:border-blue-400 active:bg-blue-500/50 transition-all cursor-pointer rounded-[1px] group/cell"
        style={{ left: `${cell.x * 100}%`, top: `${cell.y * 100}%`, width: `${cell.w * 100}%`, height: `${cell.h * 100}%` }}
        onClick={(e) => {
          e.stopPropagation()
          handleSplitOne(i)
        }}
        title={`点击切出: ${titlePattern.replace('{num}', String(i + 1))}`}
      >
        <span className="absolute top-0.5 left-0.5 text-2xs text-white/90 bg-black/50 px-1 rounded-sm font-mono pointer-events-none scale-75 origin-top-left">
          {i + 1}
        </span>
        {connectedCells.has(i) && (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <CircleCheck size={16} className="text-green-500 drop-shadow-md bg-black/30 rounded-full p-0.5" />
          </span>
        )}
        <Handle
          type="source"
          position={Position.Right}
          id={`cell-${i}`}
          className="!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', right: 'auto', minWidth: '6px', minHeight: '6px' }}
        />
      </div>
    ))
  }

  // 渲染手动切割线
  const renderManualLines = () => {
    if (splitMode !== 'manual') return null
    return (
      <>
        {hLines.map((pos, i) => (
          <div
            key={`h-${i}`}
            className="absolute left-0 right-0 cursor-row-resize z-[80]"
            style={{ top: `calc(${pos * 100}% - 5px)`, height: 10 }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setDragLine({ type: 'h', index: i })
            }}
            onClick={(e) => {
              if (e.shiftKey) {
                e.stopPropagation()
                removeHLine(i)
              }
            }}
            title="拖动调整位置 / Shift+点击删除"
          >
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-blue-400/90 shadow-glow-blue" />
          </div>
        ))}
        {vLines.map((pos, i) => (
          <div
            key={`v-${i}`}
            className="absolute top-0 bottom-0 cursor-col-resize z-[80]"
            style={{ left: `calc(${pos * 100}% - 5px)`, width: 10 }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setDragLine({ type: 'v', index: i })
            }}
            onClick={(e) => {
              if (e.shiftKey) {
                e.stopPropagation()
                removeVLine(i)
              }
            }}
            title="拖动调整位置 / Shift+点击删除"
          >
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-blue-400/90 shadow-glow-blue" />
          </div>
        ))}
      </>
    )
  }

  // 渲染切刀路径
  const renderLasso = () => {
    if (splitMode !== 'lasso') return null
    return (
      <>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {lassoShapes.map((s) => {
            if (s.points.length < 2) return null
            const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`).join(' ') + (s.closed ? ' Z' : '')
            const isActive = s.id === activeLasso
            return (
              <path
                key={s.id}
                d={d}
                fill={s.closed ? (isActive ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.18)') : 'none'}
                stroke={isActive ? '#60a5fa' : '#3b82f6'}
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>
        {lassoCenters.map((c, i) => (
          <div
            key={c.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 group/cell"
            style={{ left: `${c.cx * 100}%`, top: `${c.cy * 100}%` }}
          >
            <button
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-meta font-mono cursor-pointer border ${
                activeLasso === c.id ? 'bg-blue-500 text-white border-blue-300' : 'bg-black/70 text-white border-white/30 hover:bg-blue-500/80'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                if (e.shiftKey) {
                  removeLasso(c.id)
                  return
                }
                setActiveLasso(c.id)
                handleSplitOne(i)
              }}
              title="点击切出 / Shift+点击删除"
            >
              <span>{i + 1}</span>
              {connectedCells.has(i) && <CircleCheck size={10} className="text-green-400" />}
            </button>
            <Handle
              type="source"
              position={Position.Right}
              id={`cell-${i}`}
              className="!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', right: 'auto', minWidth: '6px', minHeight: '6px' }}
            />
          </div>
        ))}
      </>
    )
  }

  return (
    <>
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="图像切分"
      icon={titleIcon}
      selected={selected}
      showHandles={false}
      titleRight={
        <div className="flex items-center gap-1 nodrag">
          {modeBtn('grid', '规则', <Grid3X3 size={11} />, '规则网格')}
          {modeBtn('manual', '手动', <SlidersHorizontal size={11} />, '手动网格 (拖动切割线)')}
          {modeBtn('lasso', '切刀', <Scissors size={11} />, '手动切刀 (任意形状 + 透明通道)')}
        </div>
      }
      className="min-w-[280px]"
    >
      <CustomHandle position="left" handleId="in" variant="small" />
      <CustomHandle position="right" handleId="batch" variant="small" />

      <div ref={contentRef} className="p-2 space-y-2 relative z-10 rounded-xl w-full">
        {/* 源图 + 切割覆盖层 */}
        {imageUrl ? (
          <div className="relative w-full">
            <div className="relative w-full h-[180px] rounded bg-black/50 overflow-hidden shadow-inner">
              {!isHidden('image') && (
                <img src={imageUrl} alt="Source" loading="lazy" decoding="async" className="w-full h-full object-contain block opacity-80 select-none pointer-events-none" draggable={false} />
              )}
              <div
                ref={mainCanvasRef}
                className="absolute inset-0 nodrag"
                style={splitMode === 'lasso' ? { cursor: LASSO_CURSOR } : undefined}
                onDoubleClick={onManualDbl}
                onMouseDown={onLassoDown}
                title={splitMode === 'manual' ? '双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除' : splitMode === 'lasso' ? '按住拖动绘制不规则形状，松开自动闭合；起/终点贴近边时自动吸附' : ''}
              >
                {renderCells()}
                {renderManualLines()}
                {renderLasso()}
              </div>
            </div>
            {splitMode === 'manual' && <div className="mt-1 text-caption text-gray-500 leading-tight">双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除。</div>}
            {splitMode === 'lasso' && <div className="mt-1 text-caption text-gray-500 leading-tight">按住鼠标在图上画一圈即可生成一个透明形状，可以画多个；点击编号切出当前块，Shift+点击删除。</div>}
          </div>
        ) : (
          <div className="h-16 flex flex-col items-center justify-center text-gray-600 bg-surface-muted rounded border border-dashed border-edge">
            <span className="text-xs">请连接图片</span>
          </div>
        )}

        {/* 控制区 */}
        <div className="space-y-2 nodrag">
          {splitMode === 'grid' && (
            <>
              <div className="flex flex-wrap items-center gap-1">
                {GRID_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={`text-caption px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                      rows === p.rows && cols === p.cols
                        ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                        : 'bg-surface-hover border-edge text-gray-400 hover:text-white hover:border-edge-strong'
                    }`}
                    onClick={() => { setRows(p.rows); setCols(p.cols) }}
                    title={`${p.rows} 行 × ${p.cols} 列`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  className={`text-caption px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    showCustom ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400 hover:text-white hover:border-edge-strong'
                  }`}
                  onClick={() => setShowCustom((v) => !v)}
                >
                  自定义
                </button>
              </div>
              {showCustom && (
                <div className="flex items-center gap-1.5 text-caption text-gray-400">
                  <span>行</span>
                  <input
                    type="number" min={1} max={20} value={rows}
                    onChange={(e) => setRows(clamp(parseInt(e.target.value || '1', 10) || 1, 1, 20))}
                    className="w-14 bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge outline-none"
                  />
                  <span>×</span>
                  <span>列</span>
                  <input
                    type="number" min={1} max={20} value={cols}
                    onChange={(e) => setCols(clamp(parseInt(e.target.value || '1', 10) || 1, 1, 20))}
                    className="w-14 bg-surface-hover text-gray-200 rounded px-1.5 py-0.5 border border-edge outline-none"
                  />
                </div>
              )}
            </>
          )}

          {splitMode === 'manual' && (
            <div className="flex items-center justify-between text-caption text-gray-400">
              <span>{rowCount} 行 × {colCount} 列 = {closedCount} 块</span>
              <button
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-surface-hover border-edge text-gray-400 hover:text-white hover:border-edge-strong cursor-pointer"
                onClick={resetLines}
                title="重置切割线"
              >
                <RotateCcw size={11} />
                <span>重置</span>
              </button>
            </div>
          )}

          {splitMode === 'lasso' && (
            <div className="flex items-center justify-between text-caption text-gray-400">
              <span>已绘制 {closedCount} 块</span>
              <div className="flex items-center gap-1">
                <button
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-surface-hover border-edge text-gray-400 hover:text-white hover:border-edge-strong cursor-pointer"
                  onClick={() => setFullscreen(true)}
                  title="全屏聚焦切刀"
                >
                  <Expand size={11} />
                  <span>全屏</span>
                </button>
                <button
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-surface-hover border-edge text-gray-400 hover:text-red-300 hover:border-red-400/60 disabled:opacity-50 cursor-pointer"
                  onClick={clearLasso}
                  disabled={lassoShapes.length === 0}
                  title="清空所有切刀"
                >
                  <Trash2 size={11} />
                  <span>清空</span>
                </button>
              </div>
            </div>
          )}

          {/* 角标模板 */}
          <div className="flex items-center gap-2">
            <input
              className="flex-1 bg-surface-hover text-gray-300 text-xs rounded px-2 py-1 border border-edge outline-none"
              placeholder="分图角标，{num} 引入数字编号，可留空"
              value={titlePattern}
              onChange={(e) => setTitlePattern(e.target.value)}
            />
          </div>

          {/* 批量切分 */}
          <div className="flex items-center gap-2">
            <label
              className={`flex items-center gap-1 px-2 py-1 rounded text-caption border cursor-pointer transition-colors ${
                sendToImageBox ? 'bg-blue-500/15 border-blue-500/60 text-blue-300' : 'bg-surface-hover border-edge text-gray-400 hover:text-white hover:border-edge-strong'
              }`}
              title="勾选后未连接图片盒子也会自动新建一个并送入；下游已连图片盒子时会直接送入"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox" checked={sendToImageBox}
                onChange={(e) => setSendToImageBox(e.target.checked)}
                className="accent-blue-500 w-3 h-3"
              />
              <Box size={12} />
              <span>图片盒子</span>
            </label>
            <button
              className={`flex-1 flex items-center justify-between bg-surface-hover rounded-full p-1 pl-3 border border-edge transition-colors cursor-pointer group/btn ${
                imageUrl ? 'hover:border-gray-500' : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={imageUrl ? handleSplit : undefined}
            >
              <span className="text-xs text-gray-300 group-hover/btn:text-white">批量切分</span>
              <span className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                <ArrowRight size={14} strokeWidth={3} />
              </span>
            </button>
          </div>
        </div>
      </div>
    </NodeShell>

    {/* 切刀全屏聚焦 */}
    {splitMode === 'lasso' && fullscreen && createPortal(
      <div
        className="fixed inset-0 z-modal bg-black/90 backdrop-blur-md flex flex-col nodrag nowheel"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <Scissors size={16} className="text-blue-400" />
            <span>切刀（全屏聚焦）</span>
            <span className="text-xs text-gray-400 ml-2">已绘制 {closedCount} 块 · 起/终点贴近边时会自动吸附</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 px-2 py-1 rounded border bg-surface-hover border-edge-muted text-gray-200 hover:text-white hover:border-[#666] text-xs disabled:opacity-50 cursor-pointer"
              onClick={clearLasso}
              disabled={lassoShapes.length === 0}
            >
              <Trash2 size={13} />
              <span>清空</span>
            </button>
            <button
              className="flex items-center gap-1 px-2 py-1 rounded border bg-surface-hover border-edge-muted text-gray-200 hover:text-white hover:border-[#666] text-xs cursor-pointer"
              onClick={() => setFullscreen(false)}
              title="退出全屏 (Esc)"
            >
              <X size={13} />
              <span>关闭</span>
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="relative max-w-full max-h-full">
            {imageUrl && <img src={imageUrl} alt="Source" className="max-w-[90vw] max-h-[80vh] object-contain block select-none pointer-events-none" draggable={false} />}
            <div ref={fullCanvasRef} className="absolute inset-0" style={{ cursor: LASSO_CURSOR }} onMouseDown={onLassoDown}>
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {lassoShapes.map((s) => {
                  if (s.points.length < 2) return null
                  const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`).join(' ') + (s.closed ? ' Z' : '')
                  const isActive = s.id === activeLasso
                  return (
                    <path
                      key={s.id}
                      d={d}
                      fill={s.closed ? (isActive ? 'rgba(59,130,246,0.30)' : 'rgba(59,130,246,0.18)') : 'none'}
                      stroke={isActive ? '#60a5fa' : '#3b82f6'}
                      strokeWidth={0.3}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                })}
              </svg>
              {lassoCenters.map((c, i) => (
                <div key={c.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${c.cx * 100}%`, top: `${c.cy * 100}%` }}>
                  <button
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono cursor-pointer border ${
                      activeLasso === c.id ? 'bg-blue-500 text-white border-blue-300' : 'bg-black/70 text-white border-white/30 hover:bg-blue-500/80'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (e.shiftKey) {
                        removeLasso(c.id)
                        return
                      }
                      setActiveLasso(c.id)
                      handleSplitOne(i)
                    }}
                    title="点击切出 / Shift+点击删除"
                  >
                    <span>{i + 1}</span>
                    {connectedCells.has(i) && <CircleCheck size={12} className="text-green-400" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-4 py-2 bg-black/60 border-t border-white/10 text-caption-sm text-gray-300 leading-snug">
          按住鼠标在图上画一圈生成一个透明形状；起点或终点贴近图片边缘时会自动吸附到该边，并沿边自动闭合多边形（适合切人物 / 主体）。Shift + 点击编号可删除形状。
        </div>
      </div>,
      document.body
    )}
    </>
  )
}