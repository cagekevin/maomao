import React, { useState, useMemo, useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { createPortal } from 'react-dom'
import { Box, Boxes, Camera, Maximize2, X } from 'lucide-react'
import NodeShell from './base/NodeShell.jsx'
import CustomHandle from './CustomHandle.jsx'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { toAbsoluteFileUrl, saveInlineToLocal } from './base/filesApi.js'
import { Director3DOverlay } from './director3d/App.tsx'

/**
 * 3D 导演台节点（复刻开源 storyai-3d-director-desk，与"一毛"一致）。
 *
 * 交互：
 *  - 画布上是静态缩略图节点（有 imageUrl → 预览图；无 → 占位）
 *  - 双击节点主体 → 全屏打开 3D 导演台
 *  - 退出时回写 directorProject + 截图（对齐 onCaptureToBox 送图片盒子）
 */
export default function Director3DNode({ id, data, selected }) {
  const { setNodes, getNodes, getEdges, setEdges } = useReactFlow()
  const connected = useConnectedInputs(id)
  const [open, setOpen] = useState(false)
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
  const onCaptureToBox = useCallback(
    async (images) => {
      if (!images || images.length === 0) return
      const boxes = getEdges()
        .filter((e) => e.source === id)
        .map((e) => e.target)
        .filter((tid) => getNodes().find((n) => n.id === tid)?.type === 'imageBoxNode')
      // 并发落盘：data: base64 → /files/ 绝对 URL；已是 http/绝对路径原样保留
      const persisted = await Promise.all(
        images.map(async (im) => {
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
      const newImages = persisted.map((url, i) => ({
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`,
        url,
        label: images[i]?.fileName || `导演台截图 ${i + 1}`,
        source: 'gen',
        createdAt: Date.now(),
      }))
      if (boxes.length > 0) {
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
        const me = getNodes().find((n) => n.id === id)
        const boxId = `imageBoxNode-${Date.now()}`
        const newBox = {
          id: boxId,
          type: 'imageBoxNode',
          position: { x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60, y: me?.position.y ?? 100 },
          style: { width: 420, height: 420 },
          data: { images: newImages, activeIndex: newImages.length - 1, expanded: newImages.length > 1, label: '图片盒子' },
        }
        setNodes((ns) => [...ns, newBox])
        setEdges((es) => [...es, { id: `e-${id}-${boxId}`, source: id, target: boxId, targetHandle: null }])
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, getNodes, getEdges, setNodes, setEdges]
  )

  // 退出导演台：回写工程 + 截图（缩略图落盘成 /files/ URL，刷新不破图）
  const handleExit = useCallback(
    async ({ project, thumbnailDataUrl, captures }) => {
      setOpen(false)
      // 缩略图 URL 化：data: base64 落盘成 /files/ URL（对齐官方 hi(thumbnailDataUrl)），
      // 避免长 base64 塞进节点 data 导致刷新破图；落盘失败保留原值（data: 至少能本次显示）。
      let persistedThumb = thumbnailDataUrl || null
      if (persistedThumb && persistedThumb.startsWith('data:')) {
        const fileUrl = await saveInlineToLocal(persistedThumb, 'tasks')
        if (fileUrl) persistedThumb = fileUrl
      }
      // 保存工程数据回节点（directorProject 里的全景 URL 也可能相对，读取时统一补全）
      setNodes((ns) => ns.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, directorProject: project, imageUrl: persistedThumb } }
          : n
      ))
      // 截图送图片盒子（异步落盘为 /files/ 绝对 URL）
      if (captures && captures.length > 0) {
        await onCaptureToBox(captures)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, setNodes, onCaptureToBox]
  )

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="3D 导演台"
      icon={<Box size={11} className="text-gray-500" />}
      selected={selected}
      defaultHeight={260}
      className="min-w-[260px] min-h-[220px]"
    >
      {/* 主体：静态缩略图 / 占位；双击进入全屏 */}
      <div
        className="relative flex-1 bg-[#151515] rounded-xl overflow-hidden border border-[#333] shadow-xl cursor-pointer"
        style={{ minHeight: 200 }}
        onDoubleClick={(e) => { e.stopPropagation(); setOpen(true) }}
      >
        {imageUrl ? (
          <img src={imageUrl} className="w-full h-full object-cover" alt="导演台预览" draggable={false} />
        ) : (
          <div className="flex flex-col items-center justify-center absolute inset-0 gap-2 text-gray-600 pointer-events-none">
            <Boxes size={48} strokeWidth={1.2} />
            <span className="text-xs text-gray-500">双击打开 3D 导演台</span>
          </div>
        )}
        {/* 悬浮打开按钮 */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-black/70 text-white text-xs rounded-full border border-white/15 shadow-lg opacity-0 hover:opacity-100 transition-opacity cursor-pointer nodrag"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        >
          <Maximize2 size={13} /> 打开导演台
        </div>
      </div>

      <CustomHandle type="target" position="left" variant="large" />
      <CustomHandle type="source" position="right" variant="large" />

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[9999]" onClick={(e) => e.stopPropagation()}>
            <Director3DOverlay
              initialProject={data.directorProject}
              initialPanoramaUrl={inputImage}
              onExit={handleExit}
            />
          </div>,
          document.body
        )}
    </NodeShell>
  )
}
