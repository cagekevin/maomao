import React, { useState, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { useOutsideClick } from './hooks.ts'

/**
 * 通用下拉菜单（与 ModelSelect 同款交互/配色，供工作流等「少数固定选项」选择用）。
 *
 * 为什么自建而非原生 <select>：页面其它下拉（模型选择等）都是自定义面板风格，
 * 为视觉统一这里复刻同一套样式（触发器 + bg-surface-1 面板 + hover/选中态）。
 *
 * @param props
 *  - value       当前选中值
 *  - onChange    选择回调
 *  - options     [{ value, label }]
 *  - placeholder 未选时占位（默认「选择」）
 *  - popupTo     'down'（默认）| 'up'
 */
export interface SelectOption<T extends React.Key = string> {
  value: T
  label: string
}

export interface SelectProps<T extends React.Key = string> {
  /** 当前选中值 */
  value: T
  /** 选择回调 */
  onChange: (value: T) => void
  /** 选项列表 */
  options?: SelectOption<T>[]
  /** 未选时占位（默认「选择」） */
  placeholder?: string
  /** 弹出方向：'down'（默认）| 'up' */
  popupTo?: 'down' | 'up'
  disabled?: boolean
}

export default function Select<T extends React.Key = string>({ value, onChange, options = [], placeholder = '选择', popupTo = 'down', disabled = false }: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, open, () => setOpen(false))

  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative nodrag min-w-0" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        className="flex items-center gap-1 h-6 px-2 min-w-0 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
      >
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">{selected?.label ?? placeholder}</span>
        <ChevronDown size={12} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div
          className={`absolute ${popupTo === 'down' ? 'top-full left-0 mt-1' : 'bottom-full left-0 mb-1'} min-w-[10rem] w-max max-w-[20rem] bg-surface-1 border border-edge rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}
          onClick={(e) => e.stopPropagation()}
        >
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-caption-sm text-muted">无可用选项</div>
          ) : options.map((o) => {
            const sel = value === o.value
            return (
              <div
                key={o.value}
                role="button"
                className={`flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors cursor-pointer ${sel ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
                onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false) }}
              >
                <span className="flex-1 whitespace-nowrap">{o.label}</span>
                {sel && <Check size={12} className="shrink-0 text-emerald-400" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}