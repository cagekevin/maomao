import React, { useState, useMemo, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { createPortal } from 'react-dom'
import { Orbit, Maximize2 } from 'lucide-react'
import NodeShell from '../base/NodeShell.tsx'
import { useConnectedInputs } from '../../hooks/useConnectedInputs.ts'
import { toAbsoluteFileUrl, saveInlineToLocal } from '../base/api/index.ts'
import { useRenderImageResolver } from '../base/imageUrl.ts'
import { Director3DOverlay } from '../director3d/Director3DOverlay.tsx'
import { uploadFileToLocal } from '../base/api/index.ts'
import { generateId } from '../base/idGen.ts'
import { buildSpawnNodes, applySpawnSnapshot } from '../base/deriveNodes.ts'
import { useCanvasEdges } from '../base/CanvasEdgesContext.tsx'

/**
 * 3D 导演台节点（复刻开源 storyai-3d-director-desk，与"一毛"一致）。
 *
 * 交互：
 *  - 画布上是静态缩略图节点（有 imageUrl → 预览图；无 → 占位）
 *  - 双击节点主体 → 全屏打开 3D 导演台
 *  - 退出时回写 directorProject + 截图（对齐 onCaptureToBox 送图片盒子）
 */
interface Director3DNodeData {
  label?: string
  imageUrl?: string
  images?: Array<{ url?: string; [key: string]: unknown }>
  directorProject?: unknown
  [key: string]: unknown
}
interface Director3DNodeProps {
  id: string
  data: Director3DNodeData
  selected?: boolean
}
function Director3DNode({ id, data, selected }: Director3DNodeProps) {
  const { setNodes, getNodes, getNode, getEdges, setEdges } = useReactFlow()
  // 标题改名 → 写回 data.label，让下游 @名 匹配 / 素材条显示跟随
  const rename = useCallback((name: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: name } } : n)))
  }, [id, setNodes])
  const history = useCanvasEdges()
  const connected = useConnectedInputs(id)
  const [open, setOpen] = useState(false)
  const render = useRenderImageResolver()
  // 缩略图显示：兼容相对 /files/ 路径（刷新后需补全为绝对 URL 才不破图）
  const imageUrl = toAbsoluteFileUrl(data.imageUrl || '') || null

  // 输入全景图 URL：连接上游图片 或 已保存
  const inputImage = useMemo(() => {
    // 上游图片（图片节点 / 图片盒子 / 视频抽帧等）作为全景背景。
    // 兼容三种形式：http(s) URL / data: base64 / 相对 /files/ 路径（补全为绝对 URL）。
    const src = connected.images?.find((im) => im?.url)?.url
    return toAbsoluteFileUrl(src || '') || null
  }, [connected])

  // 截图输出到图片盒子（对齐全景图节点 / 官方 onCaptureToBox）。
  // 截图是 data: base64，直接塞进图片盒子 → 后端 KV 会外置成相对 /files/ 路径 → 刷新破图。
  // 这里先把每张截图落盘成「绝对」/files/ URL（saveInlineToLocal），刷新不破图且快照变小。
  interface CaptureImage {
    blob?: Blob
    dataUrl?: string
    url?: string
    fileName?: string
  }
  const onCaptureToBox = useCallback(
    async (images: CaptureImage[]) => {
      if (!images || images.length === 0) return
      const boxes = getEdges()
        .filter((e) => e.source === id)
        .map((e) => e.target)
        .filter((tid) => getNode(tid)?.type === 'imageBoxNode')
      // 并发落盘：Blob 直传 / data: base64 → /files/ 绝对 URL；已是 http/绝对路径原样保留
      const persisted = await Promise.all(
        images.map(async (im) => {
          if (im.blob) {
            const fileUrl = await uploadFileToLocal(im.blob, 'tasks', im.fileName || 'director3d-shot.png')
            return fileUrl || null
          }
          const raw = im.dataUrl || im.url
          let url = raw
          if (raw && raw.startsWith('data:')) {
            const fileUrl = await saveInlineToLocal(raw, 'tasks')
            if (fileUrl) url = fileUrl
          } else {
            url = toAbsoluteFileUrl(raw || '')
          }
          return url
        })
      )
      const newImages = persisted
        .filter((url) => Boolean(url))
        .map((url, i) => ({
          id: `img-${generateId('img')}-${i}`,
          url,
          label: images[i]?.fileName || `导演台截图 ${i + 1}`,
          source: 'gen',
          createdAt: Date.now(),
        }))
      if (boxes.length > 0) {
        const boxId = boxes[0]
        setNodes((ns) => ns.map((n) => {
          if (n.id !== boxId) return n
          const existing = (n.data?.images as Array<{ url?: string }> | undefined) || []
          const existingUrls = new Set(existing.map((x) => x.url))
          const fresh = newImages.filter((x) => !existingUrls.has(x.url))
          const merged = [...existing, ...fresh]
          return { ...n, data: { ...n.data, images: merged, activeIndex: merged.length - 1 } }
        }))
      } else {
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
        const snapshot = applySpawnSnapshot(getNodes(), getEdges(), spawned)
        setNodes((ns) => ns.concat(spawned.childNodes))
        setEdges((es) => es.concat(spawned.edges))
        history?.record(snapshot)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, getNodes, getEdges, setNodes, setEdges, history]
  )

  // 视频回写到 ImageNode（图片视频素材节点）：落盘 /files/*.mp4 → 写 imageUrl + mediaType:'video'
  interface CaptureVideo {
    blob?: Blob
    fileName?: string
  }
  const onVideoToImageNode = useCallback(
    async (videos: CaptureVideo[]) => {
      if (!videos || videos.length === 0) return
      // 落盘全部视频，取最后一个作为 ImageNode 展示（ImageNode 单媒体）
      let lastUrl = null
      let lastFile = null
      for (const v of videos) {
        if (!v.blob) continue
        const fileUrl = await uploadFileToLocal(v.blob, 'tasks', v.fileName || 'director3d-video.mp4')
        if (fileUrl) { lastUrl = fileUrl; lastFile = v.fileName || 'director3d-video.mp4' }
      }
      if (!lastUrl) return
      const targets = getEdges()
        .filter((e) => e.source === id)
        .map((e) => e.target)
        .filter((tid) => getNode(tid)?.type === 'imageNode')
      if (targets.length > 0) {
        // 已有下游 ImageNode：写最近导出视频
        const targetId = targets[0]
        setNodes((ns) => ns.map((n) =>
          n.id === targetId ? { ...n, data: { ...n.data, imageUrl: lastUrl, url: lastUrl, mediaType: 'video' } } : n
        ))
      } else {
        // 无下游 ImageNode：新建并连线
        const me = getNode(id)
        const imageId = generateId('imageNode')
        const spawned = buildSpawnNodes(
          { id, position: { x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60, y: (me?.position.y ?? 100) + 320 } },
          [{
            id: imageId,
            type: 'imageNode',
            position: { x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60, y: (me?.position.y ?? 100) + 320 },
            data: { imageUrl: lastUrl, url: lastUrl, mediaType: 'video', label: lastFile, images: [] },
          }],
          { targetHandle: null }
        )
        const snapshot = applySpawnSnapshot(getNodes(), getEdges(), spawned)
        setNodes((ns) => ns.concat(spawned.childNodes))
        setEdges((es) => es.concat(spawned.edges))
        history?.record(snapshot)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, getNodes, getEdges, setNodes, setEdges, history]
  )

  // 退出导演台：缩略图落盘 /files/ 写节点 imageUrl，彻底删除旧 directorProject；
  // 图片截图 → 图片盒子，视频 → ImageNode（有则写，无则新建并连线）
  interface Director3DCapture {
    type: 'image' | 'video'
    blob?: Blob
    dataUrl?: string
    url?: string
    fileName?: string
  }
  const handleExit = useCallback(
    async ({ thumbnailDataUrl, captures }: { thumbnailDataUrl?: string; captures?: Director3DCapture[] }) => {
      setOpen(false)
      // 缩略图 URL 化：blob:/data: 落盘成 /files/ 绝对 URL（刷新不破图）
      let persistedThumb = thumbnailDataUrl || null
      if (persistedThumb && persistedThumb.startsWith('blob:')) {
        try {
          const blobRes = await fetch(persistedThumb)
          const blob = await blobRes.blob()
          const fileUrl = await uploadFileToLocal(blob, 'tasks', 'director3d-thumb.png')
          if (fileUrl) persistedThumb = fileUrl
        } catch { /* 落盘失败保留原值 */ }
      } else if (persistedThumb && persistedThumb.startsWith('data:')) {
        const fileUrl = await saveInlineToLocal(persistedThumb, 'tasks')
        if (fileUrl) persistedThumb = fileUrl
      }
      // 写回节点：imageUrl 存缩略图，彻底移除旧 directorProject 字段
      setNodes((ns) => ns.map((n) => {
        if (n.id !== id) return n
        const next = { ...n.data, imageUrl: persistedThumb || n.data.imageUrl || null } as Record<string, unknown>
        delete next.directorProject
        return { ...n, data: next }
      }))
      // 分类回写：图片 → 图片盒子；视频 → ImageNode
      if (captures && captures.length > 0) {
        const imageCaptures = captures.filter((c) => c.type === 'image')
        const videoCaptures = captures.filter((c) => c.type === 'video')
        if (imageCaptures.length > 0) await onCaptureToBox(imageCaptures)
        if (videoCaptures.length > 0) await onVideoToImageNode(videoCaptures)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, setNodes, onCaptureToBox, onVideoToImageNode]
  )

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="3D 导演台"
      icon={<Orbit size={11} className="text-muted" />}
      selected={selected}
      handleVariant="small"
      defaultHeight={260}
      onRename={rename}
    >
      {/* 主显示框（模板写法：背景/圆角/边框/阴影由 NodeShell 提供，children 只写业务内容）
          主体：静态缩略图 / 占位；双击进入全屏 */}
      <div
        className="relative flex flex-col w-full flex-1 min-h-0 cursor-pointer overflow-hidden rounded-xl"
        onDoubleClick={(e) => { e.stopPropagation(); setOpen(true) }}
      >
        {imageUrl ? (
          <img src={render(imageUrl)} className="w-full h-full object-cover rounded-xl" alt="导演台预览" draggable={false} />
        ) : (
          <div className="flex flex-col items-center justify-center absolute inset-0 gap-2 text-muted-2 pointer-events-none bg-surface-muted">
            <Orbit size={64} strokeWidth={1.2} />
            <span className="text-caption text-muted">双击打开 3D 导演台</span>
          </div>
        )}
        {/* 悬浮打开按钮（token 化，去裸色） */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-overlay text-primary text-caption rounded-full border border-edge-strong shadow-popover opacity-0 hover:opacity-100 transition-opacity cursor-pointer nodrag"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        >
          <Maximize2 size={13} /> 打开导演台
        </div>
      </div>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-modal" onClick={(e) => e.stopPropagation()}>
            <Director3DOverlay
              nodeId={id}
              onExit={handleExit}
            />
          </div>,
          document.body
        )}
    </NodeShell>
  )
}
export default React.memo(Director3DNode)
