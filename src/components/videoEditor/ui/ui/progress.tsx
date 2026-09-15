'use client';

import * as React from 'react';

import { cn } from '@videoEditor/utils/ui';

/**
 * 进度条 —— **原生 div + ARIA，无依赖**（原 `radix-ui` 的 `Progress.Root/Indicator`）。
 *
 * 【为什么可以直接换成原生】Radix Progress 只做两件事：
 *   ① 输出 `role="progressbar"` + `aria-valuemin/max/now`（原生 ARIA 属性，直接写）；
 *   ② 提供一个 `data-state`（`loading/complete/indeterminate`）—— 本项目无消费方使用。
 * 进度表达本身（`translateX` 位移）是**本组件自己的写法**，与 Radix 无关。
 *
 * 【`value` 语义】0–100 的百分比（两个消费方 `captions` / `export-button` 都传 0–100）。
 * `value` 为空 = 不确定态（不输出 `aria-valuenow`）。
 */
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100；缺省 = 不确定态。 */
  value?: number | null;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, ...props }, ref) => (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={typeof value === 'number' ? value : undefined}
      className={cn('bg-accent relative h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div
        className="bg-primary size-full flex-1"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  ),
);
Progress.displayName = 'Progress';

export { Progress };
