import React, { useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useOutsideClick } from '../base/core/uiHooks.ts';
// 【TD-19-1】面板/行 chrome 与定位收口到共用窄原语（与 ModelSelect 同一份）
import DropdownPanel from '../base/ui/DropdownPanel.tsx';
import DropdownRow from '../base/ui/DropdownRow.tsx';

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
  value: T;
  label: string;
}

export interface SelectProps<T extends React.Key = string> {
  /** 当前选中值 */
  value: T;
  /** 选择回调 */
  onChange: (value: T) => void;
  /** 选项列表 */
  options?: SelectOption<T>[];
  /** 未选时占位（默认「选择」） */
  placeholder?: string;
  /** 弹出方向：'down'（默认）| 'up' */
  popupTo?: 'down' | 'up';
  disabled?: boolean;
}

export default function Select<T extends React.Key = string>({
  value,
  onChange,
  options = [],
  placeholder = '选择',
  popupTo = 'down',
  disabled = false,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative nodrag min-w-0" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        className="flex items-center gap-1 h-6 px-2 min-w-0 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={12} className="shrink-0 text-muted" />
      </button>

      {open && (
        <DropdownPanel popupTo={popupTo} widthClass="min-w-[10rem] w-max max-w-[20rem]">
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-caption-sm text-muted">无可用选项</div>
          ) : (
            options.map((o) => {
              const sel = value === o.value;
              return (
                <DropdownRow
                  key={o.value}
                  selected={sel}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 whitespace-nowrap">{o.label}</span>
                  {sel && <Check size={12} className="shrink-0 text-emerald-400" />}
                </DropdownRow>
              );
            })
          )}
        </DropdownPanel>
      )}
    </div>
  );
}
