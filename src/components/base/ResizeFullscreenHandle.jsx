import React, { useState, useCallback } from 'react'

/**
 * 右下角「拖拽改尺寸 + 双击全屏」手柄（复刻 _Component23.jsx）。
 *
 * 被文本/图片/视频等所有内容型节点共用，位于主框或输入框右下角。
 *  - 拖拽：实时改 targetRef 的 width/height（带 ReactFlow 缩放修正 scale），
 *    松开后回调 onResizeEnd(offsetWidth, offsetHeight)
 *  - 双击：触发 onRequestFullscreen（通常打开全屏弹层）
 *  - hover：右下角显示 tooltip「拖动改尺寸 · 双击全屏」
 *
 * ── 职责边界（重要，别把它写成"改 ReactFlow 节点"）──
 * 本组件是个「纯 DOM 手柄」：拖拽时只临时改 targetRef 元素的 inline width/height
 * （即时预览），松手后把最终尺寸通过 onResizeEnd 交出去，自己不做任何状态持久化。
 * 「最终尺寸怎么写回 ReactFlow（让 wrapper 跟随、端口不错位）」由调用方决定，
 * 各节点统一走 useNodeResize(id)：
 *   - 主框手柄   → onMainBoxResize(w,h)：写回 node.width/height + updateNodeInternals
 *   - 输入框手柄 → onInputResize(w,h)：写回 node.data.inputWidth/inputHeight
 * 这样拖拽的目标（DOM）和 ReactFlow 的尺寸源保持同步，避免出现"拖了但 wrapper 不跟、
 * 端口跑偏"的旧坑。
 *
 * ── scale 缩放修正（为什么要有）──
 * ReactFlow 画布可缩放。getBoundingClientRect() 返回的是「屏幕像素」，offsetWidth 是
 * 「逻辑像素」。若画布放大 2 倍，鼠标移动 2px 只应让元素变大 1px，所以用
 * scale = rect.width / offsetWidth 把鼠标位移换算回逻辑尺寸，保证手感不受缩放影响。
 *
 * @param props
 *  - targetRef        要改尺寸的 DOM 元素 ref
 *  - onRequestFullscreen  双击全屏回调
 *  - onResizeEnd      (width, height) 拖拽结束回调（最终尺寸交给调用方持久化）
 *  - minWidth / maxWidth / minHeight / maxHeight
 *  - className        附加类
 */
export default function ResizeFullscreenHandle({
  targetRef,
  onRequestFullscreen,
  onResizeEnd,
  minWidth = 360,
  maxWidth = 900,
  minHeight = 60,
  maxHeight = 9999,
  className = ''
}) {
  const [hovered, setHovered] = useState(false)

  // 拖拽改尺寸（复刻 _Component23 u 函数）
  const onMouseDown = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      const el = targetRef?.current
      if (!el) return

      const startX = e.clientX
      const startY = e.clientY
      const rect = el.getBoundingClientRect()
      const baseW = el.offsetWidth
      const baseH = el.offsetHeight
      // ReactFlow 缩放修正：getBoundingClientRect 是屏幕尺寸，需换算回逻辑尺寸
      const scaleX = baseW ? rect.width / baseW : 1
      const scaleY = baseH ? rect.height / baseH : 1

      const move = (ev) => {
        const dw = (ev.clientX - startX) / (scaleX || 1)
        const dh = (ev.clientY - startY) / (scaleY || 1)
        el.style.width = `${Math.max(minWidth, Math.min(maxWidth, baseW + dw))}px`
        el.style.height = `${Math.max(minHeight, Math.min(maxHeight, baseH + dh))}px`
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        onResizeEnd?.(el.offsetWidth, el.offsetHeight)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [targetRef, minWidth, maxWidth, minHeight, maxHeight, onResizeEnd]
  )

  return (
    <div
      className={`absolute right-1.5 bottom-1.5 w-5 h-5 flex items-end justify-end cursor-nwse-resize select-none nodrag nopan nowheel z-30 ${className}`}
      title="拖动调整大小，双击全屏编辑"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onRequestFullscreen?.()
      }}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" className="block text-gray-400 hover:text-blue-400 transition-colors pointer-events-none" aria-hidden="true">
        <line x1="14" y1="6" x2="6" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="14" y1="9.5" x2="9.5" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="14" y1="13" x2="13" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {hovered && (
        <span className="absolute top-full right-0 mt-1 whitespace-nowrap px-2 py-1 rounded bg-black/85 text-white text-caption leading-none shadow-lg pointer-events-none z-40">
          拖动改尺寸 · 双击全屏
        </span>
      )}
    </div>
  )
}
