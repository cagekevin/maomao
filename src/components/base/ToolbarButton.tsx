import React from 'react'

/**
 * hover 操作栏里的小图标按钮（统一样式，复刻各节点按钮 class 规律）。
 *
 * @param icon 图标节点
 * @param title tooltip
 * @param hoverClass hover 时的颜色/背景 class（默认灰色→白）
 * @param onClick 点击回调
 */
export interface ToolbarButtonProps {
  /** 图标节点 */
  icon: React.ReactNode
  /** tooltip */
  title: string
  /** hover 时的颜色/背景 class（默认灰色→白） */
  hoverClass?: string
  /** 点击回调（已 stopPropagation） */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
}

function ToolbarButton({ icon, title, hoverClass = 'hover:text-white', onClick }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`p-1.5 text-secondary hover:bg-surface-hover-strong rounded-md transition-colors ${hoverClass}`}
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

export default React.memo(ToolbarButton)
