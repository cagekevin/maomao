import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Box, Plus, Link as LinkIcon, ZoomIn, Send, Copy, Download,
  Check, ListChecks, Trash2, Grid2X2, List, MoreVertical
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import NodeShell from './base/NodeShell.jsx'
import CustomHandle from './CustomHandle.jsx'
import FullscreenModal from './base/FullscreenModal.jsx'
import { useConnectedInputs } from './base/useConnectedInputs.js'
import { useMediaDegrade } from './base/useMediaDegrade.js'
import LazyImage from './base/LazyImage.jsx'
import { showToast } from './base/toastStore.js'

/**
 * 图片盒子节点（复刻官方 Rg.jsx / imageBoxNode）。
 *
 * 一个「多图容器」：单图展示 / 缩略图网格两种模式，是图片切分/拼图/全景/人脸打码等
 * 图片类节点的共同上游。核心能力：
 *  - 加图：点击/拖拽/粘贴/从上游连线一键导入（imageUrl / 其它 imageBoxNode.images / 抽帧结果）
 *  - 多图管理：单图模式上下张导航；网格模式多选（Ctrl=设默认）、全选/删已选、拖拽排序、缩略图菜单
 *  - 缩略图：添加时用 canvas 生成 256 缩略图（对齐官方 _cmp_Tr）
 *  - 端口：target「in」接上游图片、source「active」输出当前激活图
 *
 * 结构（对齐官方 Rg.jsx，NodeShell 外壳 + 自定义带 id 端口）：
 *   <NodeShell showHandles={false}>          ← 外壳（背景/边框/阴影/尺寸）
 *     <CustomHandle target id="in" />        ← 输入端口
 *     <CustomHandle source id="active" />    ← 输出端口
 *     标题行（NodeShell titleRight 插槽放全选/展开，NodeTitle 由 NodeShell 渲染，外观与其他节点一致）
 *     <div flex-1> 图片区（空态/单图+导航/网格+添加/拖拽覆盖）</div>
 *   </NodeShell>
 *   portal 缩略图更多菜单（fixed 定位）
 *   <FullscreenModal> 放大查看大图 </FullscreenModal>
 */
export default function ImageBoxNode({ id, data, selected }) {
  const { setNodes } = useReactFlow()
  const { isHidden } = useMediaDegrade()
  const hideImage = isHidden('image')

  const fileRef = useRef(null)
  // 直接从官方 Rg.jsx 借 state 命名：d=拖拽中, m=打开的缩略图下标, _=菜单定位, y=拖拽源, x=拖拽目标
  const [dragOver, setDragOver] = useState(false)
  const [menuIndex, setMenuIndex] = useState(null)
  const [menuPos, setMenuPos] = useState(null)
  const [dragFrom, setDragFrom] = useState(null)
  const [dragTo, setDragTo] = useState(null)
  // 放大查看大图（官方 onZoom）
  const [zoomView, setZoomView] = useState(null) // 当前放大的图片 url

  // ---- 从 data 读状态（与官方 Rg.jsx 一致，不复制到本地 state，避免失控）----
  const images = data.images || []
  const activeIndex = Math.min(Math.max(0, data.activeIndex ?? 0), Math.max(0, images.length - 1))
  const expanded = data.expanded ?? false
  const selectedIds = data.selectedIds || []
  const current = images[activeIndex]

  // ---- data 写回（统一用 setNodes 不可变更新，与 ImageNode 一致）----
  const updateData = useCallback(
    (patch) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
    },
    [id, setNodes]
  )

  // ---- 缩略图生成（对齐官方 _cmp_Tr(url, 256, 0.7)：canvas 等比缩到 max 256，jpg 0.7）----
  const makeThumb = useCallback((url, max = 256, quality = 0.7) => {
    return new Promise((resolve) => {
      if (!url) return resolve(undefined)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width
          let h = img.naturalHeight || img.height
          if (!w || !h) return resolve(undefined)
          if (w > max || h > max) {
            if (w > h) { h = Math.round(h * max / w); w = max }
            else { w = Math.round(w * max / h); h = max }
          }
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(undefined)
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch {
          resolve(undefined)
        }
      }
      img.onerror = () => resolve(undefined)
      img.src = url
    })
  }, [])

  // ---- 批量添加图片（生成缩略图 + 追加 + activeIndex 指向最后一张）----
  const addImages = useCallback(
    async (items) => {
      if (!items || items.length === 0) return
      const enriched = await Promise.all(
        items.map(async (it) => {
          let thumb
          try { thumb = await makeThumb(it.url) } catch { thumb = undefined }
          return {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            url: it.url,
            thumb,
            label: it.label || '',
            source: it.source || 'upload',
            createdAt: Date.now()
          }
        })
      )
      const next = [...images, ...enriched]
      updateData({ images: next, activeIndex: next.length - 1 })
    },
    [images, updateData, makeThumb]
  )

  // ---- 删除单个（对齐官方 k）----
  const removeAt = useCallback(
    (index) => {
      const target = images[index]
      const rest = images.filter((_, n) => n !== index)
      updateData({
        images: rest,
        activeIndex: Math.min(activeIndex, Math.max(0, rest.length - 1)),
        selectedIds: target ? selectedIds.filter((x) => x !== target.id) : selectedIds
      })
    },
    [images, activeIndex, selectedIds, updateData]
  )

  // ---- 删除已选（对齐官方 A）----
  const removeSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    const set = new Set(selectedIds)
    const rest = images.filter((n) => !set.has(n.id))
    updateData({ images: rest, activeIndex: Math.min(activeIndex, Math.max(0, rest.length - 1)), selectedIds: [] })
  }, [selectedIds, images, activeIndex, updateData])

  // ---- 设默认图 / 切换选中（对齐官方 j / w）----
  const setActive = useCallback(
    (index) => {
      if (index >= 0 && index < images.length) updateData({ activeIndex: index })
    },
    [images.length, updateData]
  )
  const toggleSelect = useCallback(
    (imageId) => {
      const set = new Set(selectedIds)
      if (set.has(imageId)) set.delete(imageId)
      else set.add(imageId)
      updateData({ selectedIds: Array.from(set) })
    },
    [selectedIds, updateData]
  )

  // ---- 全选/取消全选（对齐官方 D）----
  const allSelected = images.length > 0 && selectedIds.length === images.length
  const toggleSelectAll = useCallback(() => {
    updateData({ selectedIds: allSelected ? [] : images.map((n) => n.id) })
  }, [allSelected, images, updateData])

  // ---- 上下张导航（对齐官方 P / F）----
  const prev = useCallback(() => {
    if (images.length <= 1) return
    setActive((activeIndex - 1 + images.length) % images.length)
  }, [images.length, activeIndex, setActive])
  const next = useCallback(() => {
    if (images.length <= 1) return
    setActive((activeIndex + 1) % images.length)
  }, [images.length, activeIndex, setActive])

  // ---- 展开/折叠（对齐官方 I）----
  const toggleExpand = useCallback(() => updateData({ expanded: !expanded }), [expanded, updateData])

  // ---- 拖拽排序（对齐官方 M）----
  const reorder = useCallback(
    (from, to) => {
      if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return
      const arr = images.slice()
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      let newActive = activeIndex
      const curId = images[activeIndex]?.id
      if (curId) {
        newActive = arr.findIndex((n) => n.id === curId)
        if (newActive < 0) newActive = 0
      }
      updateData({ images: arr, activeIndex: newActive })
    },
    [images, activeIndex, updateData]
  )

  // ---- 从上游连线取图（对齐官方 ie：imageUrl / imageBoxNode.images / videoExtractNode.extractedImages）----
  const connected = useConnectedInputs(id)
  const upstreamImages = useCallback(() => {
    const list = []
    // 直接上游 imageUrl（imageNode / promptNode 等）
    connected.images.forEach((img) => {
      if (typeof img.url === 'string' && (img.url.startsWith('http') || img.url.startsWith('data:image'))) {
        list.push({ id: `up-${img.id}`, url: img.url })
      }
    })
    // 上游如果是图片盒子 → 取它全部 images
    // 上游如果是视频抽帧 → 取它 extractedImages（connected.images 已含 resultUrl 产出，兜底）
    return list
  }, [connected])

  const importFromConnection = useCallback(() => {
    const ups = upstreamImages()
    if (ups.length === 0) {
      showToast('当前没有上游连线提供图片')
      return
    }
    const existing = new Set(images.map((n) => n.url))
    const fresh = ups.filter((n) => !existing.has(n.url))
    if (fresh.length === 0) {
      showToast('上游连线图片已全部导入')
      return
    }
    addImages(fresh.map((n) => ({ url: n.url, source: 'connect' })))
    showToast(`已导入 ${fresh.length} 张连线图`)
  }, [upstreamImages, images, addImages])

  // ---- 文件读取（对齐官方 te/ne：只收 image/，读成 dataURL）----
  const readFiles = useCallback((files) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    return Promise.all(
      list.map(
        (f) =>
          new Promise((resolve) => {
            const fr = new FileReader()
            fr.onload = () => resolve({ url: fr.result, label: f.name })
            fr.onerror = () => resolve(null)
            fr.readAsDataURL(f)
          })
      )
    ).then((r) => r.filter(Boolean))
  }, [])

  const onFileInput = useCallback(
    async (e) => {
      if (e.target.files) {
        const items = await readFiles(e.target.files)
        if (items.length > 0) addImages(items.map((n) => ({ ...n, source: 'upload' })))
        e.target.value = ''
      }
    },
    [readFiles, addImages]
  )

  // ---- 粘贴（选中时监听 window paste，复刻官方 Rg.jsx useEffect）----
  useEffect(() => {
    if (!selected) return
    const onPaste = async (e) => {
      if (!e.clipboardData) return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const files = Array.from(e.clipboardData.items)
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean)
      if (files.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const items = await readFiles(files)
        if (items.length > 0) addImages(items.map((n) => ({ ...n, source: 'paste' })))
        return
      }
      const text = e.clipboardData.getData('text/plain').trim()
      if (text && (text.startsWith('http') || text.startsWith('data:image/'))) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        addImages([{ url: text, source: 'paste' }])
      }
    }
    window.addEventListener('paste', onPaste, true)
    return () => window.removeEventListener('paste', onPaste, true)
  }, [selected, readFiles, addImages])

  // ---- 拖拽（对齐官方 B/re/V：文件或 URL，及盒子内排序）----
  const onDrop = useCallback(
    async (e) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      if (dragFrom !== null) {
        setDragFrom(null)
        setDragTo(null)
        return
      }
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const items = await readFiles(e.dataTransfer.files)
        if (items.length > 0) {
          addImages(items.map((n) => ({ ...n, source: 'drop' })))
          return
        }
      }
      const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list')
      if (text && (text.startsWith('http') || text.startsWith('data:image/'))) {
        addImages([{ url: text, source: 'drop' }])
      }
    },
    [dragFrom, readFiles, addImages]
  )
  const onDragOver = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (dragFrom === null && !dragOver) setDragOver(true)
    },
    [dragFrom, dragOver]
  )
  const onDragLeave = useCallback((e) => {
    if (e.currentTarget === e.target) setDragOver(false)
  }, [])

  // ---- 菜单：点击外部关闭（对齐官方 Rg.jsx useEffect）----
  useEffect(() => {
    if (menuIndex === null) return
    const close = (e) => {
      if (!e.target.closest('[data-thumb-menu]') && !e.target.closest('[data-thumb-menu-portal]')) {
        setMenuIndex(null)
        setMenuPos(null)
      }
    }
    const timer = window.setTimeout(() => {
      window.addEventListener('mousedown', close, true)
      window.addEventListener('click', close, true)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('mousedown', close, true)
      window.removeEventListener('click', close, true)
    }
  }, [menuIndex])

  // ---- 复制图片到剪贴板（对齐官方 ce：画布转 blob 写 image/png，失败退化为写链接）----
  const copyImage = useCallback(async (url) => {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = () => rej(new Error('image load failed'))
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas ctx')
      ctx.drawImage(img, 0, 0)
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('blob null')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      showToast('图片已复制，可以在画布中粘贴')
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        showToast('图片链接已复制（直接复制图片失败）')
      } catch {
        showToast('复制失败，可能因跨域或权限限制')
      }
    }
  }, [])

  // ---- 下载（对齐官方 W / ae）----
  const downloadUrl = useCallback((url, name) => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = name || `image-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [])

  // 标题图标（对齐官方 _Component30）
  const titleIcon = <Box size={11} className="text-gray-500" />
  // 端口：target「in」/ source「active」（对齐官方 _Component12 id）
  const smallHandle = 'small'

  return (
    <>
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="图片盒子"
      icon={titleIcon}
      selected={selected}
      handleVariant={smallHandle}
      showHandles={false}
      titleRight={(
        <div className="flex items-center gap-1 nodrag">
          {expanded && images.length > 0 && (
            <>
              <button className="px-1.5 py-0.5 rounded hover:bg-surface-hover-strong text-gray-400 hover:text-white inline-flex items-center gap-1 text-caption cursor-pointer border-none" title={allSelected ? '取消全选' : '全选'} onClick={(e) => { e.stopPropagation(); toggleSelectAll() }}>
                {allSelected ? <ListChecks size={10} /> : <Check size={10} />}
                <span>全选</span>
              </button>
              {selectedIds.length > 0 && (
                <>
                  <span className="text-gray-300 text-caption">已选 {selectedIds.length}</span>
                  <button className="px-1.5 py-0.5 rounded hover:bg-surface-hover-strong hover:text-red-400 text-gray-400 inline-flex items-center gap-1 text-caption cursor-pointer border-none" title="删除已选" onClick={(e) => { e.stopPropagation(); removeSelected() }}>
                    <Trash2 size={10} />
                  </button>
                </>
              )}
            </>
          )}
          <button className="px-1.5 py-0.5 rounded hover:bg-surface-hover-strong text-gray-400 hover:text-white inline-flex items-center gap-1 text-caption transition-colors cursor-pointer border-none" title={expanded ? '折叠为单图' : '展开为缩略图网格'} onClick={(e) => { e.stopPropagation(); toggleExpand() }}>
            {expanded ? <List size={11} /> : <Grid2X2 size={11} />}
            <span>{expanded ? '折叠' : '展开'}</span>
          </button>
        </div>
      )}
      className="min-w-[240px] min-h-[200px]"
    >
      {/* 自定义端口：target「in」（左上） / source「active」（右中） */}
      <CustomHandle position="left" handleId="in" variant={smallHandle} />
      <CustomHandle position="right" handleId="active" variant={smallHandle} />

      {/* 隐藏文件输入 */}
      <input type="file" ref={fileRef} accept="image/*" multiple style={{ display: 'none' }} onChange={onFileInput} />

      {/* 顶部悬浮操作栏（hover 显示，对齐官方 Component2292） */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4">
        <div className="flex items-center gap-1 px-3 py-2 bg-surface-raised/90 backdrop-blur-md border border-edge rounded-full shadow-lg">
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover-strong rounded-md cursor-pointer border-none" title="从连线图一键导入" onClick={(e) => { e.stopPropagation(); importFromConnection() }}>
            <LinkIcon size={14} />
          </button>
          <button className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover-strong rounded-md cursor-pointer border-none" title="添加本地图片" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>
            <Plus size={14} />
          </button>
          {!expanded && current && (
            <>
              <div className="w-px h-4 bg-surface-hover-strong mx-1" />
              <button className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover-strong rounded-md cursor-pointer border-none" title="放大" onClick={(e) => { e.stopPropagation(); if (current) setZoomView(current.url) }}>
                <ZoomIn size={14} />
              </button>
              <button className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover-strong rounded-md cursor-pointer border-none" title="复制当前图片到剪贴板" onClick={(e) => { e.stopPropagation(); if (current) copyImage(current.url) }}>
                <Copy size={14} />
              </button>
              <button className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover-strong rounded-md cursor-pointer border-none" title="下载当前图片" onClick={(e) => { e.stopPropagation(); downloadUrl(current.url, current.label) }}>
                <Download size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 图片区（对齐官方 Component2319：单图 / 网格 / 空态 / 拖拽覆盖）。
          背景/边框/圆角由 NodeShell 主容器统一提供，这里不重复加 border/bg，
          保证外框颜色与其它节点完全一致 */}
      <div
        className="relative w-full flex-1 min-h-0 overflow-hidden flex flex-col"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        {/* 内容容器 */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* 空态 */}
          {images.length === 0 && (
            <div className="flex flex-col items-center justify-center absolute inset-0 bg-surface-muted hover:bg-surface transition-colors cursor-pointer group" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>
              <div className="w-12 h-12 rounded-xl bg-surface-1 border border-dashed border-edge-muted group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all">
                <Plus size={20} className="text-gray-600 group-hover:text-blue-500/80 transition-colors" />
              </div>
              <span className="text-caption text-gray-500 mt-2">拖拽 / 粘贴 / 点击添加图片</span>
            </div>
          )}

          {/* 单图模式 */}
          {!expanded && current && (
            <>
              {!hideImage && (
                <img
                  src={current.url}
                  alt={current.label || `图片 ${activeIndex + 1}`}
                  className="w-full h-full object-contain cursor-pointer"
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  onDoubleClick={(e) => { e.stopPropagation(); setZoomView(current.url) }}
                />
              )}
              {images.length > 1 && (
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-1.5 py-1 rounded-full bg-black/60 backdrop-blur-sm opacity-0 group-hover/node:opacity-100 transition-opacity">
                  <button className="w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer border-none" title="上一张" onClick={(e) => { e.stopPropagation(); prev() }}>
                    <ChevronLeftIcon />
                  </button>
                  <span className="px-1 text-caption text-white tabular-nums select-none">{activeIndex + 1}/{images.length}</span>
                  <button className="w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer border-none" title="下一张" onClick={(e) => { e.stopPropagation(); next() }}>
                    <ChevronRightIcon />
                  </button>
                </div>
              )}
            </>
          )}

          {/* 网格模式 */}
          {expanded && images.length > 0 && (
            <div className="absolute inset-0 overflow-auto p-2 nowheel">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}>
                {images.map((img, index) => {
                  const isSel = selectedIds.includes(img.id)
                  const isActive = index === activeIndex
                  return (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        e.dataTransfer.effectAllowed = 'move'
                        try { e.dataTransfer.setData('text/plain', String(index)) } catch {}
                        setDragFrom(index)
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault(); e.stopPropagation()
                        if (dragFrom !== null && dragFrom !== index) setDragTo(index)
                      }}
                      onDragOver={(e) => {
                        if (dragFrom !== null) {
                          e.preventDefault(); e.stopPropagation()
                          e.dataTransfer.dropEffect = 'move'
                          if (dragTo !== index) setDragTo(index)
                        }
                      }}
                      onDragLeave={(e) => {
                        if (dragFrom !== null) e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        if (dragFrom !== null) {
                          e.preventDefault(); e.stopPropagation()
                          if (dragFrom !== index) reorder(dragFrom, index)
                          setDragFrom(null); setDragTo(null)
                        }
                      }}
                      onDragEnd={(e) => {
                        e.stopPropagation()
                        setDragFrom(null); setDragTo(null)
                      }}
                      className={`relative aspect-square rounded-md overflow-hidden border cursor-grab active:cursor-grabbing group/thumb transition-all nodrag ${dragTo === index && dragFrom !== null && dragFrom !== index ? 'border-blue-400 ring-2 ring-blue-400/60 scale-[1.03]' : isActive ? 'border-blue-500' : isSel ? 'border-emerald-500' : 'border-edge'} ${dragFrom === index ? 'opacity-40' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (e.shiftKey || e.ctrlKey || e.metaKey) setActive(index)
                        else toggleSelect(img.id)
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setZoomView(img.url)
                      }}
                      title={img.label || (isSel ? '点击取消选择' : '点击选择 (按住 Ctrl 设为默认图)')}
                    >
                      <LazyImage src={img.thumb || img.url} alt={img.label || ''} className="w-full h-full" imgClassName="w-full h-full object-cover bg-[#0e0e0e]" />
                      <button
                        className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer border-none ${isSel ? 'bg-emerald-500 text-white' : 'bg-black/50 text-gray-300 group-hover/thumb:bg-black/70'}`}
                        onClick={(e) => { e.stopPropagation(); toggleSelect(img.id) }}
                        title={isSel ? '取消选择' : '选择'}
                      >
                        {isSel ? <Check size={10} /> : <Plus size={10} />}
                      </button>
                      {isActive && <span className="absolute bottom-1 left-1 px-1 py-px rounded bg-blue-500 text-white text-2xs font-medium">默认</span>}
                      <div className="absolute top-1 right-1" data-thumb-menu>
                        <button
                          className={`w-4 h-4 rounded bg-black/60 text-gray-200 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-opacity cursor-pointer border-none ${menuIndex === index ? 'opacity-100' : 'opacity-0 group-hover/thumb:opacity-100'}`}
                          title="更多操作"
                          onMouseDown={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (menuIndex === index) { setMenuIndex(null); setMenuPos(null) }
                            else {
                              const rect = e.currentTarget.getBoundingClientRect()
                              let left = rect.right - 130
                              if (left < 8) left = 8
                              if (left + 130 > window.innerWidth - 8) left = window.innerWidth - 8 - 130
                              let top = rect.bottom + 4
                              if (top + 220 > window.innerHeight - 8) top = rect.top - 220 - 4
                              setMenuIndex(index)
                              setMenuPos({ top, left })
                            }
                          }}
                        >
                          <MoreVertical size={10} />
                        </button>
                      </div>
                    </div>
                  )
                })}
                {/* 添加图片方块 */}
                <button
                  className="aspect-square rounded-md border border-dashed border-edge-muted hover:border-blue-500/50 hover:bg-surface text-gray-500 hover:text-blue-400 flex items-center justify-center transition-colors nodrag cursor-pointer"
                  title="添加图片"
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {/* 拖拽覆盖层 */}
          {dragOver && (
            <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
              <div className="px-3 py-1.5 rounded-md bg-surface-raised border border-blue-500/40 text-blue-300 text-xs flex items-center gap-1.5">
                <Plus size={12} /> 松开以加入图片盒子
              </div>
            </div>
          )}
        </div>
      </div>
    </NodeShell>

    {/* 缩略图更多菜单（portal 到 body，对齐官方 Fn.createPortal） */}
    {menuIndex !== null && menuPos && images[menuIndex] && (
      createPortal(
        <div
          data-thumb-menu-portal
          className="fixed z-overlay-error min-w-[130px] bg-surface-raised border border-edge rounded-md shadow-2xl p-1 nodrag nowheel"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {(() => {
            const idx = menuIndex
            const img = images[idx]
            const close = () => { setMenuIndex(null); setMenuPos(null) }
            return (
              <>
                <button className="w-full text-left px-2 py-1.5 text-caption-sm text-gray-300 hover:bg-surface-hover-strong hover:text-white rounded flex items-center gap-2 cursor-pointer" onClick={() => { copyImage(img.url); close() }}>
                  <Copy size={11} className="text-gray-400" />
                  <span>复制图片</span>
                </button>
                <button className="w-full text-left px-2 py-1.5 text-caption-sm text-gray-300 hover:bg-surface-hover-strong hover:text-white rounded flex items-center gap-2 cursor-pointer" onClick={() => { downloadUrl(img.url, img.label); close() }}>
                  <Download size={11} className="text-gray-400" />
                  <span>下载</span>
                </button>
                <button className="w-full text-left px-2 py-1.5 text-caption-sm text-gray-300 hover:bg-surface-hover-strong hover:text-white rounded flex items-center gap-2 cursor-pointer" onClick={() => { setZoomView(img.url); close() }}>
                  <ZoomIn size={11} className="text-gray-400" />
                  <span>放大查看</span>
                </button>
                {idx !== activeIndex && (
                  <button className="w-full text-left px-2 py-1.5 text-caption-sm text-gray-300 hover:bg-surface-hover-strong hover:text-white rounded flex items-center gap-2 cursor-pointer" onClick={() => { setActive(idx); close() }}>
                    <Grid2X2 size={11} className="text-gray-400" />
                    <span>设为默认</span>
                  </button>
                )}
                <div className="h-[1px] bg-surface-hover-strong my-1" />
                <button className="w-full text-left px-2 py-1.5 text-caption-sm text-red-400 hover:bg-surface-hover-strong rounded flex items-center gap-2 cursor-pointer" onClick={() => { removeAt(idx); close() }}>
                  <Trash2 size={11} />
                  <span>从盒子删除</span>
                </button>
              </>
            )
          })()}
        </div>,
        document.body
      )
    )}

    {/* 放大查看大图 */}
    <FullscreenModal open={!!zoomView} title="查看大图" onClose={() => setZoomView(null)}>
      <div className="w-full h-full flex items-center justify-center bg-canvas">
        {zoomView && <img src={zoomView} alt="大图" className="max-w-full max-h-full object-contain" draggable={false} />}
      </div>
    </FullscreenModal>
    </>
  )
}

// 左右导航箭头（官方 _Component114 / _Component63，用 lucide 等价内联轻量实现）
function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}