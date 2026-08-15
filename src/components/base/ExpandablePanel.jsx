import React from 'react'

/**
 * 展开面板基座（复刻各节点底部输入面板的公共结构）。
 *
 * 职责极简：仅负责面板的展开/收起过渡 + 定位。
 *  - 展开  → opacity-100 scale-100 p-4 overflow-visible
 *  - 收起  → opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden
 * 始终渲染，用 class 控制过渡，而非条件渲染（避免布局抖动）。
 *
 * 右下角「拖拽改尺寸 + 双击全屏」手柄不在本组件内统一渲染——
 * 不同节点的面板尺寸策略不同（有的改输入框、有的改主框），由各节点
 * 在 children 里自己渲染 ResizeFullscreenHandle，并通过面板的
 * absolute 定位上下文把手柄放在右下角。
 *
 * @param props
 *  - expanded      是否展开
 *  - minWidth      面板最小宽度
 *  - children      面板内容（提示词输入 + 底部参数区 + 手柄）
 *  - onClickStop   面板内部点击是否需要 stopPropagation（默认 true）
 */
export default function ExpandablePanel({
  expanded,
  minWidth = 500,
  children,
  onClickStop = true
}) {
  return (
    <div
      className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-surface-raised rounded-2xl border border-edge shadow-2xl w-max max-w-[920px] transition-all duration-300 origin-top z-40
        ${expanded ? 'opacity-100 scale-100 p-4 overflow-visible' : 'opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden'}
      `}
      style={{ minWidth: `${minWidth}px` }}
      onClick={onClickStop ? (e) => e.stopPropagation() : undefined}
    >
      {expanded && children}
    </div>
  )
}