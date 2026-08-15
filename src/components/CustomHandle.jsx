import React, { useEffect, useRef } from 'react'
import { Handle } from '@xyflow/react'

/**
 * 自定义连接端口（复刻原 _Component12.jsx）
 * 大号（48px）用于特惠视频节点，小号（32px）用于文本/图片节点。
 * position: 'left' | 'right'
 */
export default function CustomHandle({ className = '', variant = 'large', position, handleId, top }) {
  const isLeft = position === 'left'
  const isRight = position === 'right'
  const size = variant === 'large' ? 48 : 32
  const half = size / 2
  const ref = useRef(null)
  // 端口向节点外侧偏移量（复刻 _Component12.jsx）。
  // 为什么往外移：端口圆很大（48px），若中心贴着节点边缘，圆会有一半伸到节点外、
  // 一半缩在节点内。用 left/right:-outerOffset 把整个大圆整体外移 16px，
  // 让「大圆的中心」对准节点边缘，露出的可点击/可视区域更饱满，
  // 而 ReactFlow 的连线锚点仍按节点边界计算（--cust-anchor-x 固定 50%），互不影响。
  const outerOffset = 16

  // 复刻 mousemove 追踪（--cust-shift-x/y）。
  // 说明：下面三个 span（.cust-handle-dot/ring/plus）的位置/位移都由 index.css 里
  // 的 CSS 变量驱动——--cust-anchor-x 固定锚点、--cust-shift-x/y 让「十字」指示器
  // 跟随鼠标轻微移动（左右端口各只往自身一侧偏，见 isLeft/isRight 限制）。
  // 改动外观时需同时看 index.css，别只改这里。
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      let dx = Math.max(-14, Math.min(14, (e.clientX - cx) * 0.35))
      let dy = Math.max(-14, Math.min(14, (e.clientY - cy) * 0.35))
      if (isLeft) dx = Math.min(0, dx)
      else if (isRight) dx = Math.max(0, dx)
      el.style.setProperty('--cust-shift-x', `${dx}px`)
      el.style.setProperty('--cust-shift-y', `${dy}px`)
    }
    const reset = () => {
      el.style.setProperty('--cust-shift-x', '0px')
      el.style.setProperty('--cust-shift-y', '0px')
    }
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', reset)
    return () => {
      el.removeEventListener('mousemove', move)
      el.removeEventListener('mouseleave', reset)
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
      style={wrapStyle}
    >
      <Handle
        type={position === 'left' ? 'target' : 'source'}
        position={position === 'left' ? 'left' : 'right'}
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
