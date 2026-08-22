import React from 'react'
import { Play } from 'lucide-react'
import { toAbsoluteFileUrl } from './imageUrl.js'

/**
 * 视频缩略图统一组件：静音封面 + 居中悬浮播放按钮。
 * 用于 DiscountVideoNode（节点主体，点击真正播放）、
 * TaskCenter / GeneratedView（结果/资源的视频缩略图）。
 *
 * - 用原生 <video>，preload="metadata" 让首帧海报快速出现（比 preload="none" 快）。
 * - 播放按钮是居中悬浮的小按钮（不再铺满整个区域），点击 stopPropagation 后触发
 *   onActivate（由父组件决定：播放 / 打开预览）；其余区域点击会冒泡给父容器（如切抽屉）。
 * - onDoubleClick 可选：双击触发（如打开大图预览）。
 */
function VideoThumbnail({
  src,
  poster,
  muted = true,
  fit = 'cover', // 'cover' | 'contain'
  size = 'lg', // 'lg' | 'sm'
  className = '',
  onActivate,
  onDoubleClick, // 双击触发（如打开大图预览）；默认无
  videoRef
}) {
  const btn =
    size === 'sm'
      ? { wrap: 'w-7 h-7', icon: 'w-3 h-3' }
      : { wrap: 'w-12 h-12', icon: 'w-6 h-6' }

  return (
    <div className={`relative overflow-hidden bg-surface-muted ${className}`}>
      <video
        ref={videoRef}
        src={toAbsoluteFileUrl(src || '')}
        poster={poster ? toAbsoluteFileUrl(poster) : poster}
        muted={muted}
        playsInline
        preload="metadata"
        className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} block`}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onActivate?.()
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
          onDoubleClick?.()
        }}
        className={`${btn.wrap} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm opacity-70 group-hover:opacity-100 group-hover:bg-black/70 transition-all`}
        aria-label="播放视频"
      >
        <Play className={`text-white ${btn.icon}`} fill="currentColor" />
      </button>
    </div>
  )
}

export default React.memo(VideoThumbnail)
