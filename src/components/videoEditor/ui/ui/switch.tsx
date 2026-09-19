'use client';

import * as React from 'react';

import { cn } from '@/components/videoEditor/utils/ui';

/**
 * 开关 —— **形状与配色全部在 videoEditorTheme.css §7 的 `.ve-switch`**（一处定义）。
 *
 * 【为什么不再写布局工具类】（2026-09-15 用户："启用按钮也不对了，很丑"）
 * 组件里原本塞满了 `h-5 w-9 border-2 shadow-xs` 这类**布局与外观混在一起的工具类**：
 * 于是"开关长什么样"这件事被切碎在 9 个 class 里，主题层想统一改尺寸
 * （面板里的开关必须比同排 24px 输入框矮）得先跟这些类打架 —— 这正是补丁的来源。
 * 现在的分工：
 *   · 本组件只负责**结构与状态**（button[role=switch] + `data-active`）；
 *   · 尺寸、圆角、颜色、拇指位移全在 `.ve-switch` 一族里，改尺寸只需改那一处。
 *
 * 更新(2026-09-15 · docs/135-radix-ui依赖移除计划)：原实现是 `radix-ui` 的
 * `Switch.Root/Thumb`（依赖 `data-state="checked|unchecked"`），现换成原生
 * `<button role="switch">`，状态属性随之从 `data-state` 改为**自有 `data-active`**
 * （videoEditorTheme.css 里那三条 `[data-state=…]` 规则已同步改写）。
 * 键盘：`<button>` 自带 Space/Enter → click，无需自写。
 */
interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange' | 'value'
> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    const isChecked = checked === true;

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-active={isChecked || undefined}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!isChecked)}
        className={cn('ve-switch', className)}
        {...props}
      >
        <span className="pointer-events-none block" />
      </button>
    );
  },
);
Switch.displayName = 'Switch';

export { Switch };
