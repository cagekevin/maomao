import React from 'react'
import { IconSearch } from '@tabler/icons-react'
import { cn } from '../utils/cn'

/**
 * 全仓统一搜索框（见 design system §3.4）。收口项目库/提示词库/素材库/拾取器各手写一份
 * 「搜索图标 + token 描边 + accent 聚焦 + 占位」的重复结构（高度/圆角/占位曾各不一）。
 * 宽度由调用方经 className 给（如 'w-[280px]' 或 'flex-1'）。
 */
export type DesignSearchInputProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  /** 'sm'(h-[30px] 紧凑面板) | 'md'(h-9 宽松页面)。默认 sm。 */
  size?: 'sm' | 'md'
  className?: string
}

export function DesignSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  size = 'sm',
  className,
}: DesignSearchInputProps): JSX.Element {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-nomi-line bg-nomi-paper text-nomi-ink-40',
        'transition-[border-color,box-shadow] duration-150',
        'focus-within:border-[color-mix(in_oklch,var(--nomi-accent)_55%,transparent)]',
        'focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--nomi-accent)_10%,transparent)]',
        size === 'md' ? 'h-9 px-3' : 'h-[30px] px-2.5',
        className,
      )}
    >
      <IconSearch size={size === 'md' ? 14 : 13} stroke={1.7} className="shrink-0 text-nomi-ink-30" aria-hidden />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="flex-1 min-w-0 border-0 bg-transparent outline-none text-body-sm text-nomi-ink placeholder:text-nomi-ink-30 [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  )
}
