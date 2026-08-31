import React, { useEffect, useRef, type CSSProperties } from 'react'
import { Handle, Position } from '@xyflow/react'
import { createRafBatch } from '../base/utils.ts'

/**
 * 自定义连接端口（复刻原 _Component12.jsx）
 * 大号（48px）用于视频生成节点，小号（32px）用于文本/图片节点。
 * position: 'left' | 'right'
 */
type CustomHandleVariant = 'large' | 'small'

interface CustomHandleProps {
  className?: string
  variant?: CustomHandleVariant
  position: Position | 'left' | 'right'
  handleId?: string
  top?: number | string
}

function CustomHandle({ className = '', variant = 'large', position, handleId, top }: CustomHandleProps) {
  const isLeft = position === 'left'
  const isRight = position === 'right'
  const size = variant === 'large' ? 48 : 32
  const half = size / 2
  const ref = useRef<HTMLDivElement | null>(null)
  // 端口圆心相对「主框边缘」的偏移：用 half（尺寸的一半）让整个圆整体外移到
  // 「圆心恰好落在主框边缘上」——左端口 left:-half、右端口 right:-half。
  // 之前固定 -16 对 large(48) 偏小 8px、且相对根 div 定位导致图片/视频节点端口偏离主框。
  // 现在 CustomHandle 已渲染在主框内部（NodeShell），-half 即可让圆心精确贴边。
  const outerOffset = half

  // 复刻 mousemove 追踪（--cust-shift-x/y）。
  // 说明：下面三个 span（.cust-handle-dot/ring/plus）的位置/位移都由 index.css 里
  // 的 CSS 变量驱动——--cust-anchor-x 固定锚点、--cust-shift-x/y 让「十字」指示器
  // 跟随鼠标轻微移动（左右端口各只往自身一侧偏，见 isLeft/isRight 限制）。
  // 改动外观时需同时看 index.css，别只改这里。
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // P3：mousemove 高频 → rAF 合并；getBoundingClientRect 从「每事件一次」降到「每帧一次」
    // （句柄 hover 期间画布不 pan，rect 在帧内取值即可，无需 pointerdown 缓存到拖拽结束）。
    const batch = createRafBatch((clientX, clientY) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      let dx = Math.max(-14, Math.min(14, (clientX - cx) * 0.35))
      let dy = Math.max(-14, Math.min(14, (clientY - cy) * 0.35))
      if (isLeft) dx = Math.min(0, dx)
      else if (isRight) dx = Math.max(0, dx)
      el.style.setProperty('--cust-shift-x', `${dx}px`)
      el.style.setProperty('--cust-shift-y', `${dy}px`)
    })
    const move = (e) => batch(e.clientX, e.clientY)
    const reset = () => {
      batch.cancel()
      el.style.setProperty('--cust-shift-x', '0px')
      el.style.setProperty('--cust-shift-y', '0px')
    }
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', reset)
    return () => {
      el.removeEventListener('mousemove', move)
      el.removeEventListener('mouseleave', reset)
      batch.cancel()
    }
  }, [isLeft, isRight])

  const wrapStyle = {
    position: 'absolute',
    top: top !== undefined ? `calc(${top} - ${half}px)` : `calc(50% - ${half}px)`,
    width: size,
    height: size,
    ...(isLeft ? { left: -outerOffset } : isRight ? { right: -outerOffset } : {}),
    // 锚点固定居中（偏移已由 left/right:-outerOffset 处理）
    '--cust-anchor-x': '50%'
  }

  return (
    <div
      ref={ref}
      className={`cust-handle-wrap ${variant === 'small' ? 'is-small' : ''}`}
      style={wrapStyle as CSSProperties}
    >
      <Handle
        type={position === 'left' ? 'target' : 'source'}
        position={(position === 'left' ? 'left' : 'right') as Position}
        id={handleId}
        className={`!absolute !inset-0 !w-full !h-full !min-w-0 !min-h-0 !top-0 !left-0 !right-0 !bottom-0 !transform-none !bg-transparent !border-0 !rounded-none !opacity-0 ${className || ''}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          margin: 0,
          transform: 'none',
          background: 'transparent',
          border: 0,
          borderRadius: 0,
          opacity: 0
        }}
      />
      <span className="cust-handle-ring" />
      <span className="cust-handle-plus" />
      <span className="cust-handle-dot" />
    </div>
  )
}
export default React.memo(CustomHandle)
