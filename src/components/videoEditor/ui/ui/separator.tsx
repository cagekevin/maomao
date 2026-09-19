'use client';

import * as React from 'react';

import { cn } from '@/components/videoEditor/utils/ui';

/**
 * 分隔线 —— **原生 div + role，无依赖**（原 `@radix-ui/react-separator`）。
 *
 * 【为什么可以直接换成原生】Radix Separator 产出的是
 * `<div role="separator" aria-orientation data-orientation>`（`decorative` 时 `role="none"`）——
 * 纯静态元素、无状态、无键盘、无 Portal，自研成本为零。
 *
 * 【属性口径与 Radix 一致】`data-orientation` 保留（`videoEditorTheme.css` §6 的分隔线规则按
 * `[orientation='vertical']` 判向，这里同时给 `data-orientation` 让后续可按需收口）；
 * `decorative`（默认 `true`）= 纯装饰，对屏幕阅读器隐藏。
 */
interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  /** `true`（默认）= 装饰线，不进无障碍树；`false` = 语义分隔，暴露 `role="separator"`。 */
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? 'none' : 'separator'}
      aria-orientation={decorative ? undefined : orientation}
      data-orientation={orientation}
      /* 尺寸/颜色：横 `h-px w-full` / 纵 `h-full w-px`；`bg-border` 在 ve 映射里 = `--ve-border`。 */
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = 'Separator';

export { Separator };
