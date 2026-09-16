'use client';

import * as React from 'react';
import { Circle } from 'lucide-react';

import { cn } from '@/components/videoEditor/utils/ui';

/**
 * 单选组 —— **原生 `div[role=radiogroup]` + `button[role=radio]`，无依赖**
 * （原 `radix-ui` 的 `RadioGroup.Root/Item`，自研 `Indicator`）。
 *
 * 【为什么需要 context】单选是**组语义**：item 不知道自己是不是被选中的那一个，
 * 也不该自己去改组的值。原 Radix 用 context 传 `value/onValueChange`，这里同样用
 * context —— 换成"给每个 item 手动传 checked"会让调用点从 2 个 prop 涨到 4 个，
 * 且多选互斥逻辑会散到调用点（本该是原语职责）。
 *
 * 【状态属性：`data-active`】与 Checkbox/Switch 同一口径；不再引入 `data-state`。
 *
 * 【键盘（ARIA radiogroup 规范，Radix 同款）】
 *   · 组内 **roving tabindex**：选中的那个 `tabIndex=0`，其余 `-1`（Tab 进组只落一次）；
 *   · 方向键在组内移动焦点**并立即选中**（不是"移动后再按空格"）；
 *   · 到端点**环绕**。
 */
interface RadioGroupContextValue {
  value?: string;
  select: (value: string) => void;
  disabled: boolean;
  name: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, defaultValue, onValueChange, disabled = false, ...props }, ref) => {
    const [uncontrolled, setUncontrolled] = React.useState<string | undefined>(defaultValue);
    const isControlled = value !== undefined;
    const current = isControlled ? value : uncontrolled;
    const name = React.useId();

    const select = React.useCallback(
      (next: string) => {
        if (!isControlled) setUncontrolled(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const contextValue = React.useMemo<RadioGroupContextValue>(
      () => ({ value: current, select, disabled, name }),
      [current, select, disabled, name],
    );

    return (
      <RadioGroupContext.Provider value={contextValue}>
        <div ref={ref} role="radiogroup" className={cn('grid gap-2', className)} {...props} />
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = 'RadioGroup';

interface RadioGroupItemProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'value' | 'onChange'
> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, value, disabled, onClick, onKeyDown, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    const groupValue = ctx?.value;
    const isChecked = groupValue !== undefined && groupValue === value;
    const isDisabled = disabled || ctx?.disabled === true;
    /** 组内一个都没选时，所有 item 都可 Tab 命中（否则整组不可达）。 */
    const isTabStop = isChecked || (ctx !== null && groupValue === undefined);

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isChecked}
        data-active={isChecked || undefined}
        data-value={value}
        disabled={isDisabled}
        tabIndex={isDisabled ? -1 : isTabStop ? 0 : -1}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !isDisabled) ctx?.select(value);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || isDisabled) return;
          if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;

          const group = event.currentTarget.closest('[role="radiogroup"]');
          if (!group) return;
          const items = Array.from(
            group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])'),
          );
          const index = items.indexOf(event.currentTarget);
          if (index < 0 || items.length === 0) return;

          const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
          const next = items[(index + (forward ? 1 : -1) + items.length) % items.length];
          if (!next) return;

          event.preventDefault();
          next.focus();
          const nextValue = next.dataset.value;
          if (nextValue !== undefined) ctx?.select(nextValue);
        }}
        className={cn(
          'border-primary text-primary focus-visible:ring-ring aspect-square size-4 rounded-full border shadow-sm focus:outline-hidden focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {isChecked && (
          <span className="flex items-center justify-center">
            <Circle className="fill-primary size-3.5" />
          </span>
        )}
      </button>
    );
  },
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
