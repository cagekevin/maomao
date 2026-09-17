import { memo, useRef, useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';
import { useImageFallbackSrc } from '../utils/useImageFallbackSrc.ts';

/**
 * 懒加载图片
 * 外层用 div 占位，IntersectionObserver（rootMargin 120px）判断进入视口附近
 * 才真正挂载 <img>，避免大画布多图节点一次性解码全部图片。
 *
 * 读取端破图兜底：src 若是相对 /files/ 路径（后端外置/存量数据），统一补全为
 * 绝对 URL，避免在画布环境（localhost:5180 / chrome-extension://）解析成错误源破图。
 * 统一出口：复用 useRenderAssetResolver——本地文件走按需小图（渲染快，不装全分辨率），
 * 外部 http / data: / blob: 回退原绝对地址。视频/弹层不传本组件（本组件仅图片缩略显示）。
 *
 * 加载失败兜底：走唯一实现 useImageFallbackSrc —— 小图失败**先回退原图**，原图也失败才显示
 * 统一「破图占位」（图标 + 文案），并保留外层容器比例/尺寸，避免浏览器默认破图裂图、
 * 或图片加载后撑开布局跳动。（更新 2026-09-17：原为「失败即占位」，缺回退原图这一段。）
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
  /**
   * 立即加载（跳过 IntersectionObserver 门槛）。
   * 用于**小尺寸**缩略图：解码成本≈0，而懒加载一旦不触发（画布 `transform: scale()` 容器里
   * IO 可见性判定本就脆弱）会**永久空白**——懒加载是优化，不该成为「能否显示」的前提。
   */
  eager?: boolean;
}

function LazyImage({
  src,
  alt = '',
  className,
  onDoubleClick,
  imgClassName = 'w-full h-full object-cover',
  eager = false,
}: LazyImageProps) {
  // 显示地址 + 两段失败回退（小图 → 原图 → 显式占位）收口在唯一实现，见 useImageFallbackSrc 文件头。
  // 更新(2026-09-17)：此前本组件只做「失败 → 占位」，**没有回退原图** → 缩略图端点对不可缩源
  // （webp 等 Jimp 不可编码格式）返回 4xx/5xx 时，画布节点能显示而助手气泡只显示占位。
  const { src: resolvedSrc, failed, onError } = useImageFallbackSrc(src || '');
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  // eager = 跳过懒加载门槛（小尺寸缩略图）：懒加载是优化，不得成为「能否显示」的前提
  const show = eager || visible;

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
      {show && resolvedSrc && !failed ? (
        <img
          src={resolvedSrc}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          draggable={false}
          className={imgClassName}
          onDragStart={(e) => e.preventDefault()}
          onError={onError}
        />
      ) : show && failed ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-surface-2 text-faint select-none">
          <ImageOff size={20} />
          <span className="text-caption-sm">图片加载失败</span>
        </div>
      ) : null}
    </div>
  );
}

export default memo(LazyImage);
