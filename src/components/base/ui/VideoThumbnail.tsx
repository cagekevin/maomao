import React, { useState, useRef } from 'react';
import { Play, ImageOff } from 'lucide-react';
import { toAbsoluteFileUrl } from '../utils/assetUrl.ts';
import { useMediaLoadFailed } from '../utils/useMediaLoadFailed.ts';

/**
 * 媒体控制（play / pause）的**唯一实现**：被浏览器拒绝属**策略性**预期，不阻断 UI。
 *
 * 【为什么收口（TD-18-14）】同一段「取 ref → 调媒体方法 → 吞掉策略性拒绝」的判据此前在本文件
 *   **逐字写了两遍**（各带一份同样的 `catch-ok: BROWSER_API` 文案）。同一判据两份实现必然漂移 ⇒ 收口为一份。
 *
 * 【为什么不留痕】这是**策略性拒绝**（autoplay 政策 / 元素已卸载），不是"我们的动作失败"：
 *   ① 调用方紧接着用 `setPlaying(...)` 把**真实状态**呈现给用户（读者已对，不是静默）；
 *   ② 在 Chrome 的 autoplay 政策下这是**常态**，留痕只会把正常路径刷成噪音。
 *   判据同「探测语义」（见 `core/degrade.ts` 头注：失败与"不可用"对调用方是同一答案时不留痕）。
 */
function quietMediaControl(
  ref: React.RefObject<HTMLVideoElement | null> | undefined,
  act: (v: HTMLVideoElement) => void,
): void {
  try {
    const v = ref?.current;
    if (v) act(v);
  } catch {
    // catch-ok: BROWSER_API —— 本处即该判据的唯一实现：媒体控制被浏览器拒绝属策略预期
    // （autoplay 政策 / 元素已卸载），真实结果由调用方以 UI 状态呈现（`setPlaying`）。
  }
}

/**
 * 视频缩略图统一组件：静音封面 + 居中悬浮播放按钮。
 * 用于 VideoGenerate（节点主体，点击真正播放）、
 * TaskCenter / GeneratedView（结果/资源的视频缩略图）、
 * AssetNode（节点内视频预览，开启 playable 后可进入带 controls 的播放态）。
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
  // 加载失败 → 显式占位（原为裸 <video>，失败只剩黑框，见下方 onError 注释）
  const videoError = useMediaLoadFailed(src, '视频缩略图', { src });
  const innerVideoRef = useRef<HTMLVideoElement | null>(null);
  const effectiveVideoRef = videoRef || innerVideoRef;

  const enterPlay = () => {
    setPlaying(true);
    // 同一用户手势里显式 play()，绕开 autoplay 政策（失败处置见 quietMediaControl）
    quietMediaControl(effectiveVideoRef as React.RefObject<HTMLVideoElement | null>, (v) =>
      v.play(),
    );
  };

  // playable 模式：双击容器 → 拦截原生双击全屏 + 开大图
  const handleContainerDoubleClick = (e: React.MouseEvent) => {
    if (!playable) return;
    e.preventDefault();
    e.stopPropagation();
    quietMediaControl(effectiveVideoRef as React.RefObject<HTMLVideoElement | null>, (v) =>
      v.pause(),
    );
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
        onError={videoError.onError}
        onClick={(e) => {
          if (playable && playing) e.stopPropagation();
        }}
      />
      {/* 【2026-09-17 TD-16-29②】视频加载失败（素材缺失 / 4xx / 解码失败）→ 显式占位。
          此前 `onError` **完全没有**：失败只剩黑框，用户与开发者都无法区分「加载中」与「已损坏」。
          这里不弹 toast（本组件被列表/网格多次挂载），只呈现占位 + 留痕（hook 内 logger.warn）。 */}
      {videoError.failed && (
        <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1 bg-black/70 text-white">
          <ImageOff className={size === 'sm' ? 'size-4' : 'size-6'} />
          <span className={size === 'sm' ? 'text-[10px]' : 'text-xs'}>视频加载失败</span>
        </div>
      )}
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
