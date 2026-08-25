import React, { useState, useRef, useCallback } from 'react'
import {
  Image as ImageIcon, Video, Music, FileText, Plus, Send, Download, Play
} from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import NodeShell from '../base/NodeShell.jsx'
import HoverToolbar from '../base/HoverToolbar.jsx'
import ImageZoomDialog from '../base/ImageZoomDialog.jsx'
import { detectMediaType } from '../base/mediaType.js'
import { useMediaDegrade } from '../base/useMediaDegrade.js'
import { useFitNodeRatio } from '../base/useFitNodeRatio.js'
import { useVideoPoster } from '../base/useVideoPoster.js'
import { toAbsoluteFileUrl, uploadFileToLocal } from '../base/filesApi.js'
import { UPLOAD_DIRS } from '../base/uploadDirs.js'
import { useRenderImageResolver } from '../base/imageUrl.js'
import { useImageHoverActions } from '../base/useImageHoverActions.jsx'
import { downloadUrl } from '../base/clipboard.js'
import { showToast, toastError } from '../base/toastStore.js'
import { sendToAssetLibrary } from '../base/assetStore.js'
import { openAssetLibrary } from '../base/taskStore.js'

/**
 * 图片节点（复刻原 xi.jsx / imageNode）
 * 支持 image / video / audio / text / empty 五种内容态（类型用 detectMediaType 统一判断）。
 * 已迁移到 NodeShell 基座（外壳 + 端口 + 尺寸管理统一）。
 *
 * hover 工具栏「裁剪」「编辑(标记)」→ 打开全屏 ImageEditor：
 *  - 裁剪 = initialTool='crop'
 *  - 编辑 = initialTool='pencil'
 * 保存后把 canvas dataURL 写回 data.imageUrl（useReactFlow setNodes 不可变更新）。
 *
 * 通用能力抽到 base/：useMediaDegrade（性能降级）、useFitNodeRatio（宽高比自适应）、
 * useVideoPoster（视频首帧封面）、detectMediaType（类型判断）。
 */
function ImageNode({ id, data, selected }) {
  const fileRef = useRef(null)
  const videoRef = useRef(null) // 播放视频元素（大播放按钮手势触发的 play() 用）
  // 读取端兜底：相对 /files/ 路径统一补全为绝对 URL，刷新不破图
  const url = toAbsoluteFileUrl(data.imageUrl || data.url || '') || ''
  const { setNodes } = useReactFlow()
  // 订阅「画布显示缩略图」设置：显示地址实时随开关（见 docs/18）
  const render = useRenderImageResolver()

  // 视频播放态（复刻官方 xi.jsx `s`）：false=显示海报+播放按钮，true=渲染 <video controls autoPlay>
  const [playing, setPlaying] = useState(false)

  // 查看大图：原生 <dialog> 弹层（双击图片 → showModal，点图/Esc 关闭，无外框/标题栏）。
  const dialogRef = useRef(null)

  // 内容类型：优先显式 data.mediaType（blob: 等无扩展名/前缀的 URL 无法靠字符串判断，
  // 由产出方明确标注，如视频处理节点的 audio/video 输出），否则统一走 detectMediaType
  const type = data.mediaType || detectMediaType(url)

  // 性能模式媒体降级（hideMedia：'image' / 'image video audio' / ''，见 useMediaDegrade）
  const { hideMedia } = useMediaDegrade()

  // 节点按媒体宽高比自适应（图片 img / 视频 video 共用）
  const { fitFromImage, fitFromVideo } = useFitNodeRatio(id)

  // 视频首帧封面（未播放时显示首帧，避免视频 URL 当 img 破图）
  const posterUrl = useVideoPoster(url, type === 'video' && !playing)

  // 编辑器/压缩保存 → 写回节点图片（不可变更新，与 HoverToolbar 统一机制共享）。
  const replaceImage = useCallback(
    (dataUrl) => {
      if (!dataUrl) return
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, imageUrl: dataUrl, url: dataUrl } } : n
        )
      )
    },
    [id, setNodes]
  )

  // 共享图片 hover 能力（裁剪/标记/压缩）：写回走 replaceImage
  const { editor, setEditor, renderEditor, renderInlineCropper, imageButtons } = useImageHoverActions({
    id,
    url,
    hasImage: type === 'image',
    label: data.label,
    onImageReplaced: replaceImage,
  })

  // 下载当前内容（图片/视频/音频/文本共用）。用 <a download> 触发浏览器保存，
  // 文件名优先用节点 label，其次是 URL 里的文件名；无扩展名时按类型补扩展名。
  const handleDownload = useCallback(() => {
    if (!url) return
    const extMap = { image: 'png', video: 'mp4', audio: 'm4a', text: 'txt' }
    let filename = data.label || ''
    try {
      const fromUrl = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
      if (fromUrl && !/^blob:|^data:/.test(url)) filename = filename || fromUrl
    } catch {}
    const ext = (filename.match(/\.[a-z0-9]{2,5}$/i) || [])[0] || (type !== 'image' ? `.${extMap[type] || 'bin'}` : '')
    if (filename && !ext) filename += ext
    if (!filename) filename = `image-${type || 'content'}${ext || '.png'}`
    downloadUrl(url, filename)
  }, [url, data.label, type])

  // 「上传/替换」真正读取所选文件（修复：此前 fileRef input 无 onChange，选完不读 → 上传按钮失效）。
  // 图片/视频/音频：优先上传 localTool 成 /files/ 持久 URL（刷新不丢），失败回退 dataURL 内联（仍可显示，靠 base64 外置兜底）。
  // 文本文件：读文本写回 data.text，节点切到文本态。
  const handleFileSelect = useCallback(async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.type.startsWith('text/') || detectMediaType(f.name) === 'text') {
      const fr = new FileReader()
      fr.onload = () => {
        setNodes((ns) =>
          ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, text: fr.result, mediaType: 'text', imageUrl: undefined, url: undefined } } : n))
        )
        // 节点已切到文本态，结果可见，无需 toast
      }
      fr.readAsText(f)
      return
    }
    // 图片/视频/音频：上传落盘（mediaType 交由 detectMediaType 由 URL 判断）
    let url = await uploadFileToLocal(f, UPLOAD_DIRS.canvasDrop, f.name)
    if (!url) {
      url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(f) })
    }
    if (!url) { toastError('上传失败'); return }
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, imageUrl: url, url, mediaType: undefined, text: undefined } } : n))
    )
    // 节点已显示新图，结果可见，无需 toast
  }, [id, setNodes])

  const DEMO_IMAGE = data.demoImage || 'https://picsum.photos/seed/imagenode/400/260'
  const defaultTitle = type === 'video' ? '视频' : type === 'audio' ? '音频' : type === 'text' ? '文本文件' : '图片'
  const titleIcon = type === 'video' ? <Video size={11} /> : type === 'audio' ? <Music size={11} /> : type === 'text' ? <FileText size={11} /> : <ImageIcon size={11} />
  // 画布内显示地址：图片走按需小图（END 收口治全分辨率解码卡顿），缩放弹层/发送仍用原图 url。
  // render scope 仅对本地 /files/ 出小图；外部 http/data/blob 回退原图，绝不破图。
  const renderUrl = type === 'image' ? render(url) : ''
  const displayUrl = type === 'image' ? url : data.poster || ''

  // hover 操作栏按钮：图片类共享能力(crop/edit/compress)走 useImageHoverActions，
  // upload/send/download 按本节点多类型语义各自声明。
  const toolbarButtons = [
    {
      key: 'upload',
      icon: <Plus size={14} />,
      title: '上传/替换',
      onClick: () => fileRef.current?.click()
    },
    ...imageButtons,
    {
      key: 'send',
      icon: <Send size={14} />,
      title: '发送到素材库',
      hoverClass: 'hover:text-blue-400',
      onClick: () => {
        if (!url) { toastError('没有可发送的素材'); return }
        const name = (data.label && String(data.label).trim()) || ''
        sendToAssetLibrary(url, { name, type })
        openAssetLibrary()
        showToast('已发送到素材库', { type: 'success' })
      }
    },
    { key: 'download', icon: <Download size={14} />, title: '下载', onClick: handleDownload, show: !!url }
  ]

  return (
    <>
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle={defaultTitle}
      icon={titleIcon}
      selected={selected}
      handleVariant="small"
      aspectRatio={null}
      className="min-w-[120px] min-h-[80px]"
    >
      <HoverToolbar buttons={toolbarButtons} />

      <input
        type="file"
        ref={fileRef}
        style={{ display: 'none' }}
        accept="image/*,video/*,audio/*,text/plain"
        multiple
        onChange={handleFileSelect}
      />

      {/* 主容器：背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局。
          relative 必须保留——内部空态/播放图标是 absolute inset-0 定位，依赖本容器做定位上下文 */}
      <div className="relative w-full flex flex-col flex-1">
        {/* 就地裁剪浮层：覆盖在节点内容区之上，不跳全屏 */}
        {renderInlineCropper()}
        <div
          className="flex-1 p-0 bg-surface-strong flex items-center justify-center relative overflow-hidden"
          style={{ minHeight: 160 }}
        >
          {/* 性能模式媒体降级：缩小时隐藏图片/视频/音频（复刻官方"图片视频已隐藏"） */}
          {hideMedia && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-strong">
              <div className="flex flex-col items-center gap-1 opacity-60">
                <ImageIcon size={18} className="text-muted-2" />
                <span className="text-meta text-muted">性能模式已隐藏</span>
              </div>
            </div>
          )}
          {/* 图片（onLoad 按实际比例自适应节点形状；双击查看大图，复刻官方 onDoubleClick→onZoom） */}
          {type === 'image' && !hideMedia.includes('image') && renderUrl && (
            <img src={renderUrl} alt="Content" loading="lazy" decoding="async"
              onLoad={fitFromImage}
              onDoubleClick={(e) => { e.stopPropagation(); dialogRef.current?.showModal() }}
              className="w-full h-full object-contain cursor-pointer rounded-lg" draggable={false} />
          )}
          {/* 视频（复刻官方 xi.jsx：未播放显示海报+播放按钮，点击播放 → <video controls autoPlay>）
              无论是否播放都渲染一个 <video preload="metadata"> 读真实宽高 → onLoadedMetadata 调
              fitFromVideo 按视频宽高自适应节点形状（useFitNodeRatio）。
              未播放时该 video 隐藏（仅读元数据），海报用 <img> 显示；播放时显示 controls。 */}
          {type === 'video' && !hideMedia.includes('video') && (
            <div className="w-full h-full relative">
              {/* 元数据读取器 / 播放器：始终存在（未播放时隐藏），loadedmetadata 触发节点比例自适应。
                  播放由大播放按钮手势触发 video.play()（避免 autoplay 政策拦截带声音视频） */}
              <video
                ref={videoRef}
                src={url}
                preload="metadata"
                className={playing ? 'max-w-full w-full h-full object-contain block rounded-lg' : 'hidden'}
                controls={playing}
                onLoadedMetadata={fitFromVideo}
                onClick={(e) => e.stopPropagation()}
              />
              {/* 未播放：首帧封面 + 播放按钮。封面用抓取的 posterUrl（首帧 dataURL），
                  避免用视频 URL 当 <img> src 导致破图（官方用 localTool _frame1.jpg）。
                  点击大播放按钮：setPlaying(true) 显示 controls，并在同一用户手势里调 play()，
                  这样不用再点视频左下角的小播放按钮（autoplay 政策拦的是无手势的自动播放，
                  用户点击触发 play() 是允许的）。 */}
              {!playing && (
                <>
                  {posterUrl ? (
                    <img src={posterUrl} alt="video poster" loading="lazy" decoding="async"
                      draggable={false} className="w-full h-full object-contain cursor-pointer rounded-lg" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface-muted">
                      <Video size={32} className="text-gray-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto cursor-pointer"
                      title="播放视频"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPlaying(true)
                        // 同一用户手势里显式 play()，绕开 autoplay 政策（带声音视频不被自动播放拦截）
                        try { videoRef.current?.play?.() } catch {}
                      }}
                    >
                      <Play className="text-white w-6 h-6" fill="currentColor" />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {/* 音频 */}
          {type === 'audio' && !hideMedia.includes('audio') && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-surface p-2 gap-2">
              <Music size={24} className="text-blue-500 mb-2" />
              <audio src={url} controls className="w-full max-w-[200px] h-8" />
            </div>
          )}
          {/* 文本文件 */}
          {type === 'text' && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-surface p-2">
              <FileText size={24} className="text-secondary mb-2" />
              <span className="text-caption text-muted">文本/数据文件</span>
            </div>
          )}
          {/* 空态 */}
          {type === 'empty' && (
            <div
              className="flex flex-col items-center justify-center absolute inset-0 bg-surface-muted hover:bg-surface transition-colors cursor-pointer group"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}
            >
              <div className="w-12 h-12 rounded-xl bg-surface-1 border border-dashed border-edge-muted group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all">
                <ImageIcon size={20} className="text-muted-2 group-hover:text-blue-500/80 transition-colors" />
              </div>
            </div>
          )}
        </div>
      </div>
    </NodeShell>

    {/* 全屏图片编辑器（裁剪/标记入口）：用当前显示图作为编辑源 */}
    {/* 图片编辑器（裁剪/标记）：统一机制渲染，editor 关闭时返回 null */}
    {renderEditor()}

    {/* 查看大图：共享 ImageZoomDialog（滚轮缩放/拖拽/双击关闭 + 复制图片/下载） */}
    <ImageZoomDialog ref={dialogRef} url={displayUrl} />
    </>
  )
}
export default React.memo(ImageNode)
