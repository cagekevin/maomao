import React from 'react'
import { cn } from '../utils/cn'

/**
 * 全仓统一空态（见 design system §3.3）。收口此前各面板（项目库/提示词库/素材库/拾取器…）
 * 各手写一份「居中 icon + 标题 + 说明 + 可选行动」的重复结构（措辞「还没有/暂无/没有匹配」也曾不一）。
 * icon 由调用方传好尺寸/色（如 <IconPhoto size={34} className="text-nomi-ink-30" />），组件只管布局与排版。
 */
export type DesignEmptyStateProps = {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** 可选行动（按钮等），置于说明下方。 */
  action?: React.ReactNode
  /** 垂直密度：'panel'（py-20，独立面板空态）｜'inline'（py-12，过滤/内嵌空态）。默认 panel。 */
  density?: 'panel' | 'inline'
  className?: string
}

export function DesignEmptyState({
  icon,
  title,
  description,
  action,
  density = 'panel',
  className,
}: DesignEmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2.5 px-6 text-center',
        density === 'inline' ? 'py-12' : 'py-20',
        className,
      )}
    >
      {icon}
      <div className="text-body font-medium text-nomi-ink">{title}</div>
      {description ? <div className="text-caption text-nomi-ink-40 leading-relaxed max-w-[320px]">{description}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}
