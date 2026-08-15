import React, { memo, useRef, useState, useEffect } from 'react'

/**
 * 懒加载图片（复刻官方 Lg.jsx）
 * 外层用 div 占位，IntersectionObserver（rootMargin 120px）判断进入视口附近
 * 才真正挂载 <img>，避免大画布多图节点一次性解码全部图片。
 *
 * props：
 *  - src, alt, className, onDoubleClick（透传给外层 div）
 *  - imgClassName：img 内部类名（默认 w-full h-full object-cover）
 */
function LazyImage({ src, alt = '', className, onDoubleClick, imgClassName = 'w-full h-full object-cover' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true) // 降级：无 IO 直接显示
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '120px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return (
    <div ref={ref} className={className} onDoubleClick={onDoubleClick}>
      {visible && src ? (
        <img src={src} alt={alt || ''} loading="lazy" decoding="async" draggable={false} className={imgClassName} onDragStart={(e) => e.preventDefault()} />
      ) : null}
    </div>
  )
}

export default memo(LazyImage)
