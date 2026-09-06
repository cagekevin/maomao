import React, { useState, useRef } from 'react';
import { Play } from 'lucide-react';
import { toAbsoluteFileUrl } from '../utils/imageUrl.ts';

/**
 * 视频缩略图统一组件：静音封面 + 居中悬浮播放按钮。
 * 用于 DiscountVideoNode（节点主体，点击真正播放）、
 * TaskCenter / GeneratedView（结果/资源的视频缩略图）、
 * ImageNode（节点内视频预览，开启 playable 后可进入带 controls 的播放态）。
 *
 * 两种模式：
 *  - 默认（playable=false，缩略图）：点击播放按钮 → onActivate（父级决定播放/预览）；双击按钮 → onDoubleClick。
 *  - playable=true（节点内完整播放）：点击播放按钮 → 内部进入 controls 播放态（保留完整播放体验）；
 *    双击容器 → onContainerDoubleClick（如打开大图预览）。播放态下防 OS 全屏（playsInline + 双击拦截）。
 *
 * - 用原生 <video>，preload="metadata" 让首帧海报快速出现（比 preload="none" 快）。
 * - 播放按钮是居中悬浮的小按钮（不再铺满整个区域），点击 stopPropagation 后触发。
 * - onDoubleClick（按钮）/ onContainerDoubleClick（容器）可选。
 */

/** 视频缩略图 Props。 */
interface VideoThumbnailProps {
  /** 视频源 URL（相对路径经 toAbsoluteFileUrl 补成 file:// 绝对路径） */
  src: string;
  /** 封面图 URL（可选，留空则靠 preload=metadata 取首帧） */
  poster?: string;
  /** 是否静音（默认 true，便于自动/首屏播放） */
  muted?: boolean;
  /** 填充方式：'cover' 裁切铺满 | 'contain' 留白完整 */
  fit?: 'cover' | 'contain';
  /** 尺寸档：'lg' 大 / 'sm' 小（影响播放按钮与图标大小） */
  size?: 'lg' | 'sm';
  className?: string;
  /** 点击播放按钮触发（stopPropagation 后），父组件决定播放/预览 */
  onActivate?: () => void;
  /** 双击播放按钮触发（如打开大图预览），默认无 */
  onDoubleClick?: () => void;
  /** 双击容器触发（playable 模式用），默认无 */
  onContainerDoubleClick?: () => void;
  /** 透传 video 元素 ref */
  videoRef?: React.Ref<HTMLVideoElement>;
  /** 透传 video onLoadedMetadata（供父节点按媒体宽高比自适应形状），默认无 */
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  /** 是否启用「节点内 controls 播放态」（默认 false=缩略图模式）。
      true 时点击播放按钮进入带 controls 的播放器，双击容器触发 onContainerDoubleClick */
  playable?: boolean;
}

function VideoThumbnail({
  src,
  poster,
  muted = true,
  fit = 'cover', // 'cover' | 'contain'
  size = 'lg', // 'lg' | 'sm'
  className = '',
  onActivate,
  onDoubleClick, // 双击播放按钮（如打开大图预览）；默认无
  onContainerDoubleClick, // 双击容器（playable 模式用）
  videoRef,
  onLoadedMetadata,
  playable = false,
}: VideoThumbnailProps) {
  const btn =
    size === 'sm' ? { wrap: 'w-7 h-7', icon: 'w-3 h-3' } : { wrap: 'w-12 h-12', icon: 'w-6 h-6' };

  // 节点内播放态（仅 playable 启用）：false=封面+播放按钮，true=渲染 controls 播放器
  const [playing, setPlaying] = useState(false);
  const innerVideoRef = useRef<HTMLVideoElement | null>(null);
  const effectiveVideoRef = videoRef || innerVideoRef;

  const enterPlay = () => {
    setPlaying(true);
    // 同一用户手势里显式 play()，绕开 autoplay 政策
    try {
      const v = (effectiveVideoRef as React.RefObject<HTMLVideoElement | null>)?.current;
      v?.play?.();
    } catch {}
  };

  // playable 模式：双击容器 → 拦截原生双击全屏 + 开大图
  const handleContainerDoubleClick = (e: React.MouseEvent) => {
    if (!playable) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const v = (effectiveVideoRef as React.RefObject<HTMLVideoElement | null>)?.current;
      v?.pause?.();
    } catch {}
    setPlaying(false);
    onContainerDoubleClick?.();
  };

  return (
    <div
      className={`relative overflow-hidden bg-surface-muted ${className}`}
      onDoubleClick={handleContainerDoubleClick}
    >
      <video
        ref={effectiveVideoRef}
        src={toAbsoluteFileUrl(src || '')}
        poster={poster ? toAbsoluteFileUrl(poster) : poster}
        muted={muted}
        playsInline
        disablePictureInPicture
        disableRemotePlayback
        preload="metadata"
        controls={playable && playing}
        className={`w-full h-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} block`}
        onLoadedMetadata={onLoadedMetadata}
        onClick={(e) => {
          if (playable && playing) e.stopPropagation();
        }}
      />
      {/* 播放态（playable）不显示悬浮播放按钮；缩略图模式（默认）始终显示 */}
      {!playable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onActivate?.();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDoubleClick?.();
          }}
          className={`${btn.wrap} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm opacity-70 group-hover:opacity-100 group-hover:bg-black/70 transition-all`}
          aria-label="播放视频"
          title="播放视频"
        >
          <Play className={`text-white ${btn.icon}`} fill="currentColor" />
        </button>
      )}
      {/* playable 封面态：显示封面 + 播放按钮（点击进入 controls 播放态） */}
      {playable && !playing && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            enterPlay();
          }}
          className={`${btn.wrap} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm opacity-70 group-hover:opacity-100 group-hover:bg-black/70 transition-all`}
          aria-label="播放视频"
          title="播放视频"
        >
          <Play className={`text-white ${btn.icon}`} fill="currentColor" />
        </button>
      )}
    </div>
  );
}

export default React.memo(VideoThumbnail);
