import React, { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, X } from 'lucide-react'

/**
 * 全屏弹层组件（复刻 Ai.jsx）。
 *
 * 双击节点/输入框的「全屏编辑」落点。通过 createPortal 挂到 body，
 * 以 `fixed inset-0` 全屏遮罩展示 children 内容，供大空间编辑。
 *
 * - Esc 或点击空白处关闭
 * - 初始尺寸 = min(1152, innerWidth*0.8) × innerHeight*0.8
 * - 右下角可拖拽改尺寸（最小 480×320，最大窗口-40）
 *
 * @param props
 *  - open        是否打开
 *  - title       标题
 *  - onClose     关闭回调
 *  - children    全屏编辑内容
 */
export default function FullscreenModal({ open, title = '编辑输入', onClose, children }) {
  // 初始尺寸：占屏幕约 80%（各边留约 10% 边距），随屏幕自适应。
  // SSR 环境下 window 不存在，需守卫。
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return { w: 1000, h: 700 }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.max(480, Math.round(vw * 0.8))
    const h = Math.max(320, Math.round(vh * 0.8))
    return { w, h }
  })
  const panelRef = useRef(null)

  // Esc 关闭（复刻 Ai.jsx useEffect）
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // 右下角拖拽改尺寸（复刻 Ai.jsx s 函数）
  const onPanelResize = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const baseW = panelRef.current?.offsetWidth ?? size.w
      const baseH = panelRef.current?.offsetHeight ?? size.h
      const move = (ev) => {
        setSize({
          w: Math.max(480, Math.min(window.innerWidth - 40, baseW + (ev.clientX - startX))),
          h: Math.max(320, Math.min(window.innerHeight - 40, baseH + (ev.clientY - startY)))
        })
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    [size.w, size.h]
  )

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-ceiling-2 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 input-panel-fullscreen-root"
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="relative bg-surface-raised border border-edge rounded-xl shadow-2xl flex flex-col overflow-visible"
        style={{ width: size.w, height: size.h, maxWidth: '95vw', maxHeight: '95vh' }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge-faint bg-surface-1 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-gray-200">
            <Pencil size={14} className="text-blue-400" />
            <span>{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-caption-sm text-gray-500">Esc 关闭 · 点击空白处关闭</span>
            <button className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors" onClick={onClose} title="关闭全屏">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 内容区：flex-1 填满弹层剩余高度，内容可纵向填充 */}
        <div className="flex-1 min-h-0 p-5 overflow-hidden custom-scrollbar flex flex-col">
          {children}
        </div>

        {/* 右下角拖拽手柄 */}
        <div
          className="absolute right-1 bottom-1 w-5 h-5 flex items-end justify-end cursor-nwse-resize select-none z-10"
          title="拖动调整窗口大小"
          onMouseDown={onPanelResize}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" className="block text-gray-500 hover:text-blue-400 transition-colors pointer-events-none" aria-hidden="true">
            <line x1="14" y1="6" x2="6" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="14" y1="9.5" x2="9.5" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="14" y1="13" x2="13" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>,
    document.body
  )
}
