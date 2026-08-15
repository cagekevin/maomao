import React from 'react'
import ToolbarButton from './ToolbarButton.jsx'

/**
 * 节点 hover 操作栏（复刻各节点悬浮胶囊操作栏的公共结构）。
 *
 * 按钮通过配置数组声明，新增节点只需列按钮，避免复制粘贴导致遗漏。
 *
 * @param props
 *  - buttons   按钮配置数组：[{ key, icon, title, hoverClass, show, onClick }]
 *  - loading   是否显示 loading 图标（可选）
 *  - loadingIcon  loading 图标节点（默认无）
 */
export default function HoverToolbar({ buttons = [], loading = false, loadingIcon = null }) {
  const visible = buttons.filter((b) => b.show !== false)
  if (visible.length === 0 && !loading) return null

  return (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4">
      <div className="flex items-center gap-1 px-3 py-2 bg-surface-raised/90 backdrop-blur-md border border-edge rounded-full shadow-lg">
        {loading && loadingIcon}
        {visible.map((b) => (
          <ToolbarButton
            key={b.key}
            icon={b.icon}
            title={b.title}
            hoverClass={b.hoverClass}
            onClick={b.onClick}
          />
        ))}
      </div>
    </div>
  )
}
