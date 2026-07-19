// ============================================================
// 一毛AI画布 - 自定义连接手柄
// 支持悬浮动画、跑马灯外边框、鼠标跟随偏移
// ============================================================
import { memo, useRef, useEffect } from 'react';
import { Handle, HandleProps, Position } from '@xyflow/react';

interface CustomHandleProps extends HandleProps {
  className?: string;
  title?: string;
  variant?: 'large' | 'small';
  outerOffset?: number;
  ballOutset?: number;
}

function CustomHandle({
  className = '',
  variant = 'large',
  title,
  outerOffset,
  ballOutset,
  style,
  ...handleProps
}: CustomHandleProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const isLeft = handleProps.position === Position.Left;
  const isRight = handleProps.position === Position.Right;
  const size = variant === 'large' ? 48 : 32;
  const half = size / 2;
  const offset = typeof outerOffset === 'number' ? outerOffset : 16;
  const inset = Math.max(0, Math.min(size, offset - (typeof ballOutset === 'number' ? ballOutset : 0)));

  // 鼠标跟随偏移
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      let shiftX = Math.max(-14, Math.min(14, dx * 0.35));
      let shiftY = Math.max(-14, Math.min(14, dy * 0.35));
      if (isLeft) shiftX = Math.min(0, shiftX);
      if (isRight) shiftX = Math.max(0, shiftX);
      el.style.setProperty('--cust-shift-x', `${shiftX}px`);
      el.style.setProperty('--cust-shift-y', `${shiftY}px`);
    };

    const handleMouseLeave = () => {
      el.style.setProperty('--cust-shift-x', '0px');
      el.style.setProperty('--cust-shift-y', '0px');
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isLeft, isRight]);

  const anchorX = isLeft ? `${(inset / size) * 100}%` : isRight ? `${100 - (inset / size) * 100}%` : '50%';

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 100,
    cursor: 'crosshair',
    pointerEvents: 'auto',
    transformOrigin: 'center center',
    ['--cust-shift-x' as string]: '0px',
    ['--cust-shift-y' as string]: '0px',
    ['--cust-anchor-x' as string]: anchorX,
    top: typeof style?.top === 'string' || typeof style?.top === 'number'
      ? `calc(${style.top} - ${half}px)`
      : `calc(50% - ${half}px)`,
    width: size,
    height: size,
    ...(isLeft ? { left: -offset } : {}),
    ...(isRight ? { right: -offset } : {}),
  };

  return (
    <div ref={wrapRef} className={`cust-handle-wrap ${variant === 'small' ? 'is-small' : ''}`} style={wrapperStyle} title={title}>
      <Handle
        {...handleProps}
        className={`!absolute !inset-0 !w-full !h-full !min-w-0 !min-h-0 !top-0 !left-0 !right-0 !bottom-0 !transform-none !bg-transparent !border-0 !rounded-none !opacity-0 ${className}`}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100%', height: '100%',
          minWidth: 0, minHeight: 0,
          margin: 0, transform: 'none',
          background: 'transparent', border: 0,
          borderRadius: 0, opacity: 0,
        }}
      />
      <span className="cust-handle-ring" />
      <span className="cust-handle-dot" />
      <span className="cust-handle-plus" />
    </div>
  );
}

export default memo(CustomHandle);