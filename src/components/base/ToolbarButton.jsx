import React from 'react'

/**
 * hover 操作栏里的小图标按钮（统一样式，复刻各节点按钮 class 规律）。
 *
 * @param icon 图标节点
 * @param title tooltip
 * @param hoverClass hover 时的颜色/背景 class（默认灰色→白）
 * @param onClick 点击回调
 */
export default function ToolbarButton({ icon, title, hoverClass = 'hover:text-white', onClick }) {
  return (
    <button
      type="button"
      className={`p-1.5 text-gray-400 hover:bg-surface-hover-strong rounded-md transition-colors ${hoverClass}`}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
    >
      {icon}
    </button>
  )
}
