import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useReactFlow, useStore } from '@xyflow/react'
import { createPortal } from 'react-dom'
import { Globe, Maximize2, X, Camera, Scan, Grid3X3, CircleDot, Settings } from 'lucide-react'
import NodeShell from '../base/NodeShell.jsx'
import HoverToolbar from '../base/HoverToolbar.jsx'
import { useConnectedInputs } from '../base/useConnectedInputs.js'
import PanoViewer from '../base/PanoViewer.jsx'
import { generateId } from '../base/idGen.ts'
import { buildSpawnNodes, spawnAndCommit } from '../base/deriveNodes.ts'
import { useCanvasEdges } from '../base/CanvasEdgesContext.jsx'
import { useRenderImageResolver } from '../base/imageUrl.js'

/**
 * 720 全景图节点（复刻官方 Zl.jsx / panoramaNode）。
 *
 * 交互逻辑（对齐用户预期 + 官方）：
 *  - 主显示区：显示【完整的等距全景图】（2:1 完整图，像普通图片完整显示），
 *    用户导入后能看到整张全景，而不是球心的局部视野。
 *  - 全屏漫游：进入球体视图，从球心用 OrbitControls 旋转查看 360° 全景。
 *  - 截图：在全屏球体里选视角，输出该视角的局部截图（当前 / 四大 / 12大视角）→ spawn imageNode。
 *
 * 需 React 19 + @react-three/fiber@9 + @react-three/drei@10 + three。
 */

const RATIO_OPTIONS = ['16:9', '9:16', '1:1', 'custom']

function PanoramaNode({ id, data, selected }) {
  const { setNodes, getNodes, getNode, getEdges, setEdges } = useReactFlow()
  // 标题改名 → 写回 data.label，让下游 @名 匹配 / 素材条显示跟随
  const rename = useCallback((name) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: name } } : n)))
  }, [id, setNodes])
  const history = useCanvasEdges()
  const connected = useConnectedInputs(id)
  const thumbResolve = useRenderImageResolver()
  const [panoType, setPanoType] = useState(data.panoType || 'sphere') // 球/柱
  const [fullscreen, setFullscreen] = useState(false) // 全景漫游（球体视图）
  const [capturing, setCapturing] = useState(false)
  const [shotKind, setShotKind] = useState(null) // 'current'|'four'|'twelve'
  const [toast, setToast] = useState(null)
  const [imgError, setImgError] = useState(false) // 【R2 治理】主全景图加载失败占位（TASK-018#4 静默）
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || '16:9')
  const [customDim, setCustomDim] = useState({ w: 16, h: 9 })
  const [configOpen, setConfigOpen] = useState(false)
  const viewerRef = useRef(null)
  const orbitRef = useRef(null)

  const ratioStr = aspectRatio === 'custom' ? `${customDim.w}/${customDim.h}` : aspectRatio.replace(':', '/')

  // 输入全景图 URL：连接上游图片 或 data.imageUrl
  const panoUrl = (() => {
    const src = connected.images?.find((im) => im?.url)?.url
    if (src) return src
    return data.imageUrl || null
  })()

  // 【R2 治理】panoUrl 变化时重置图片错误态（换图后可重试加载）
  const prevPanoRef = useRef(panoUrl)
  useEffect(() => {
    if (prevPanoRef.current !== panoUrl) {
      prevPanoRef.current = panoUrl
      setImgError(false)
    }
  }, [panoUrl])

  // 截图（复刻官方 F：在全屏球体里选视角裁切输出局部）
  const doCapture = useCallback(
    async (angles = [0]) => {
      if (!viewerRef.current) return
      setShotKind(angles.length >= 12 ? 'twelve' : angles.length >= 4 ? 'four' : 'current')
      setToast(angles.length >= 12 ? '正在截取12大视角…' : angles.length >= 4 ? '正在截取四大视角…' : '正在截取当前视角…')
      setCapturing(true)
      try {
        const shots = await viewerRef.current.capture(angles, ratioStr)
        if (shots && shots.length > 0) {
          if (angles.length === 1 && shots[0]) {
            setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, imageUrl: shots[0] } } : n)))
          }
          // 输出到图片盒子（对齐官方 onCaptureToBox / H_.jsx xr）：
          //  1) 有连接到本节点的 imageBoxNode 下游 → 把截图追加到该图片盒子的 images
          //  2) 没有 → 新建 imageBoxNode（420×420），截图作为 images，自动连线本节点 → 图片盒子
          const boxes = getEdges()
            .filter((e) => e.source === id)
            .map((e) => e.target)
            .filter((tid) => getNode(tid)?.type === 'imageBoxNode')
          const newImages = shots.map((url, i) => ({
            id: `img-${generateId('img')}-${i}`,
            url,
            label: `全景截图 ${angles[i] || 0}度`,
            source: 'gen',
            createdAt: Date.now(),
          }))
          if (boxes.length > 0) {
            // 有图片盒子下游：追加到第一个盒子
            const boxId = boxes[0]
            setNodes((ns) => ns.map((n) => {
              if (n.id !== boxId) return n
              const existing = n.data?.images || []
              const existingUrls = new Set(existing.map((x) => x.url))
              const fresh = newImages.filter((x) => !existingUrls.has(x.url))
              const merged = [...existing, ...fresh]
              return { ...n, data: { ...n.data, images: merged, activeIndex: merged.length - 1 } }
            }))
          } else {
            // 无图片盒子下游：新建图片盒子 + 自动连线
            const me = getNode(id)
            const boxId = generateId('imageBoxNode')
            const spawned = buildSpawnNodes(
              { id, position: { x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60, y: me?.position.y ?? 100 } },
              [{
                id: boxId,
                type: 'imageBoxNode',
                position: { x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60, y: me?.position.y ?? 100 },
                style: { width: 420, height: 420 },
                data: { images: newImages, activeIndex: newImages.length - 1, expanded: newImages.length > 1, label: '图片盒子' },
              }],
              { targetHandle: null }
            )
            spawnAndCommit(spawned, { getNodes, getEdges, setNodes, setEdges, history })
          }
          setToast('截图已放入图片盒子')
        }
      } catch {
        setToast('截图失败，请重试')
      } finally {
        setCapturing(false)
        setShotKind(null)
        setTimeout(() => setToast(null), 2500)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, ratioStr, setNodes, getNodes, getEdges, setEdges]
  )

  // 截图比例选择器（复刻官方 Component1784 / Component1845）
  const renderRatioSelect = () => (
    <>
      <span className="text-caption-sm text-secondary px-2 whitespace-nowrap shrink-0">截图比例</span>
      <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="bg-transparent text-primary text-caption-sm pl-1 pr-4 py-0.5 outline-none cursor-pointer text-center font-bold">
        {RATIO_OPTIONS.map((r) => <option key={r} value={r} className="bg-surface-1">{r === 'custom' ? '自定义' : r}</option>)}
      </select>
      {aspectRatio === 'custom' && (
        <div className="flex items-center gap-1 ml-2 mr-2 border-l border-white/20 pl-2 shrink-0">
          <input type="number" value={customDim.w} onChange={(e) => setCustomDim((d) => ({ ...d, w: Number(e.target.value) }))} className="w-8 bg-transparent text-primary text-caption-sm outline-none text-center border-b border-transparent focus:border-white/50" />
          <span className="text-muted">:</span>
          <input type="number" value={customDim.h} onChange={(e) => setCustomDim((d) => ({ ...d, h: Number(e.target.value) }))} className="w-8 bg-transparent text-primary text-caption-sm outline-none text-center border-b border-transparent focus:border-white/50" />
        </div>
      )}
    </>
  )

  // 截图按钮组（全屏球体里，始终显示）
  const renderShotButtons = ({ size = 20 }) => (
    <div className="absolute top-1/2 left-2 -translate-y-1/2 flex flex-col items-center gap-1 z-30 bg-black/60 p-1.5 rounded-xl backdrop-blur-md border border-white/10 shadow-popover nodrag" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => doCapture([0])} title="当前视角截图" className={`p-2.5 text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 cursor-pointer ${shotKind === 'current' ? 'text-white bg-white/10' : ''}`}>
        <CircleDot size={size} className={shotKind === 'current' ? 'animate-spin' : ''} />
      </button>
      <button onClick={() => doCapture([90, 180, 270, 0])} title="四大视角截图 (90,180,270,0度)" className={`p-2.5 text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 cursor-pointer ${shotKind === 'four' ? 'text-white bg-white/10' : ''}`}>
        <Grid3X3 size={size} className={shotKind === 'four' ? 'animate-spin' : ''} />
      </button>
      <button onClick={() => doCapture([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330])} title="12大视角截图 (每30度)" className={`p-2.5 text-secondary hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 cursor-pointer ${shotKind === 'twelve' ? 'text-white bg-white/10' : ''}`}>
        <Scan size={size} className={shotKind === 'twelve' ? 'animate-spin' : ''} />
      </button>
    </div>
  )

  // 截图处理中遮罩
  const renderCapturingOverlay = () => (
    capturing && (
      <div className="absolute inset-0 z-40 pointer-events-none nodrag flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
        <div className="bg-black/80 border border-white/20 rounded-2xl px-5 py-3 shadow-popover flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <span className="text-white text-sm font-semibold">截图处理中…</span>
        </div>
      </div>
    )
  )

  // 截图比例虚线遮罩
  const renderRatioOverlay = () => (
    !capturing && (
      <div className="absolute inset-0 pointer-events-none z-dropdown" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="border-[2px] border-dashed border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" style={{ aspectRatio: ratioStr, height: '100%', maxHeight: '100%', maxWidth: '100%' }} />
      </div>
    )
  )

  // 全屏球体漫游（复刻官方 Component1861）
  const renderFullscreen = () => (
    fullscreen && panoUrl && createPortal(
      <div className="fixed inset-0 z-modal bg-surface-sunken flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button onClick={() => doCapture([0])} className="bg-white hover:bg-gray-200 text-black px-5 py-2.5 rounded-lg flex items-center gap-2 shadow cursor-pointer border-none">
            <Camera size={18} /> 截图
          </button>
          <button onClick={() => setFullscreen(false)} className="bg-black/50 hover:bg-white/10 text-white p-2.5 rounded-lg backdrop-blur border border-white/10 transition-colors cursor-pointer">
            <X size={22} />
          </button>
        </div>

        {/* 截图比例选择器（全屏） */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-1 shadow-popover nodrag" onClick={(e) => e.stopPropagation()}>
          {renderRatioSelect()}
        </div>

        <div className="flex-1 w-full h-full flex items-center justify-center p-8">
          <div className="relative shadow-[0_0_50px_rgba(0,0,0,0.8)]" style={{ aspectRatio: '16/9', width: '100%', maxHeight: 'calc(100vh - 6rem)', maxWidth: 'calc((100vh - 6rem) * (16/9))', margin: 'auto' }}>
            {/* 球体全景（可旋转查看 360°） */}
            <div className="absolute inset-0" style={{ width: '100%', height: '100%' }}>
              <Canvas
                resize={{ debounce: 0 }}
                dpr={1.5}
                gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, powerPreference: 'high-performance' }}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              >
                <PanoViewer ref={viewerRef} url={panoUrl} panoType={panoType} fov={75} highQuality={false} orbitControlsRefLocal={orbitRef} />
              </Canvas>
            </div>
            {renderShotButtons({ size: 20 })}
            {renderCapturingOverlay()}
            {renderRatioOverlay()}
          </div>
        </div>
      </div>,
      document.body
    )
  )

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="720全景图"
      icon={<Globe size={11} className="text-muted" />}
      selected={selected}
      keepAspect
      aspectRatio="16:9"
      defaultHeight={360}
      handleVariant="small"
      className="min-w-[320px] min-h-[240px]"
      onRename={rename}
      titleRight={(
        panoUrl ? (
          <div className="flex items-center gap-2 nodrag">
            <button onClick={() => setConfigOpen((v) => !v)} className="node-btn-settings" title="全景设置">
              <Settings size={12} />
              <span>{configOpen ? '收起设置' : '全景设置'}</span>
            </button>
            {configOpen && (
              <select
                value={panoType}
                onChange={(e) => { setPanoType(e.target.value); setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, panoType: e.target.value } } : n))) }}
                className="bg-surface-black text-body text-caption px-1 py-0.5 rounded border border-edge-muted outline-none cursor-pointer"
              >
                <option value="sphere">球状全景</option>
                <option value="cylinder">柱状全景</option>
              </select>
            )}
          </div>
        ) : null
      )}
    >
      <HoverToolbar buttons={[]} />

      {/* 主显示区（照模板：只布局，圆角/裁剪在内部显示框） */}
      <div className="relative flex flex-col w-full flex-1 min-h-0 group/image">
        {panoUrl ? (
          <div className="flex-1 relative overflow-hidden rounded-xl bg-surface-black">
            {/* 完整全景图（等距展开）；加载失败显示占位（R2：不再静默空白） */}
            {imgError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-red-400/80 bg-surface-muted">
                <span className="text-body font-medium">全景图加载失败</span>
                <span className="text-caption mt-1 text-red-400/60">图片可能已失效或跨域不可访问</span>
              </div>
            ) : (
              <img
                src={thumbResolve(panoUrl)}
                alt="全景图"
                draggable={false}
                onError={() => setImgError(true)}
                onLoad={() => setImgError(false)}
                className="w-full h-full object-cover"
              />
            )}

            {/* 顶部拖拽 grip */}
            <div className="absolute top-0 left-0 w-full h-8 z-20 flex items-start justify-center pt-2 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors opacity-0 group-hover/image:opacity-100 pointer-events-none">
              <div className="w-12 h-1.5 bg-white/20 rounded-full pointer-events-none" />
            </div>

            {/* toast */}
            {toast && (
              <div className="absolute top-0 left-1/2 z-50 pointer-events-none nodrag flex items-center justify-center">
                <div className="animate-[dropIn_2.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] bg-surface-sunken/90 backdrop-blur-xl border border-white/30 px-6 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-2 mt-12">
                  <span className="text-white font-bold tracking-wider text-sm">{toast}</span>
                </div>
              </div>
            )}

            {/* 全景漫游按钮（hover 显示，进入球体旋转裁切） */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFullscreen(true) }}
              title="全景漫游（旋转查看 360° 并裁切）"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 bg-black/70 text-white hover:bg-white/20 rounded-full backdrop-blur-md border border-white/20 nodrag cursor-pointer shadow-popover opacity-0 group-hover/image:opacity-100 transition-opacity duration-300"
            >
              <Globe size={16} /> 全景漫游
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-2 bg-surface-muted rounded-xl">
            <Globe size={64} strokeWidth={1.2} className="mb-2" />
            <div className="text-caption text-muted">连接图片节点以显示全景</div>
          </div>
        )}
      </div>

      {renderFullscreen()}
    </NodeShell>
  )
}
export default React.memo(PanoramaNode)
