import React, { memo, useRef, useState, useEffect } from 'react';
import { useRenderImageResolver } from '../utils/imageUrl.ts';
import { ImageOff } from 'lucide-react';

/**
 * 懒加载图片（复刻官方 Lg.jsx）
 * 外层用 div 占位，IntersectionObserver（rootMargin 120px）判断进入视口附近
 * 才真正挂载 <img>，避免大画布多图节点一次性解码全部图片。
 *
 * 读取端破图兜底：src 若是相对 /files/ 路径（后端外置/存量数据），统一补全为
 * 绝对 URL，避免在画布环境（localhost:5180 / chrome-extension://）解析成错误源破图。
 * 统一出口：复用 useRenderImageResolver——本地文件走按需小图（渲染快，不装全分辨率），
 * 外部 http / data: / blob: 回退原绝对地址。视频/弹层不传本组件（本组件仅图片缩略显示）。
 *
 * 加载失败兜底：img onError 时显示统一「破图占位」（图标 + 文案），并保留外层
 * 容器比例/尺寸，避免浏览器默认破图裂图、或图片加载后撑开布局跳动。
 *
 * props：
 *  - src, alt, className, onDoubleClick（透传给外层 div）
 *  - imgClassName：img 内部类名（默认 w-full h-full object-cover）
 */
interface LazyImageProps {
  src?: string;
  alt?: string;
  className?: string;
  onDoubleClick?: () => void;
  imgClassName?: string;
}

function LazyImage({
  src,
  alt = '',
  className,
  onDoubleClick,
  imgClassName = 'w-full h-full object-cover',
}: LazyImageProps) {
  const resolve = useRenderImageResolver();
  const resolvedSrc = resolve(src || '');
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true); // 降级：无 IO 直接显示
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={className} onDoubleClick={onDoubleClick}>
      {visible && resolvedSrc && !failed ? (
        <img
          src={resolvedSrc}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={imgClassName}
          onDragStart={(e) => e.preventDefault()}
          onError={() => setFailed(true)}
        />
      ) : visible && failed ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-surface-2 text-faint select-none">
          <ImageOff size={20} />
          <span className="text-caption-sm">图片加载失败</span>
        </div>
      ) : null}
    </div>
  );
}

export default memo(LazyImage);
