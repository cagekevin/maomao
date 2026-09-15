'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@videoEditor/utils/ui';

/**
 * 复选框 —— **原生 `<button role="checkbox">`，无依赖**（原 `radix-ui` 的 `Checkbox.Root`）。
 *
 * 【状态属性：`data-active`，不再是 `data-state`】Radix 输出
 * `data-state="checked|unchecked|indeterminate"`；本仓编辑器自有语言统一用
 * **`data-active`**（`.ve-tab` / `.ve-tbtn` / `.ve-pick-item` 同款）。
 * 一套 UI 里两套状态属性 ⇒ 样式作者每次要先查"这个是 Radix 的还是我们的"（母体缺陷）。
 * 语义靠 `aria-checked`（无障碍读这个），视觉靠 `data-active`（样式读这个），各司其职。
 *
 * 【键盘】原生 `<button>` 自带 Space/Enter 触发 `click` → 走同一条切换路径，
 * 无需自写键盘处理（Radix 在此也是把 Space 转发成点击）。
 */
interface CheckboxProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value'
> {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    const isChecked = checked === true;
    const isMixed = checked === 'indeterminate';

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={isMixed ? 'mixed' : isChecked}
        data-active={isChecked || isMixed || undefined}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!isChecked)}
        className={cn(
          'cursor-default bg-background peer focus-visible:ring-ring data-[active]:bg-primary data-[active]:text-primary-foreground data-[active]:border-primary size-4 shrink-0 shadow-xs rounded-sm border focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {(isChecked || isMixed) && (
          <span className="flex items-center justify-center text-current">
            <Check className="size-4" />
          </span>
        )}
      </button>
    );
  },
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
