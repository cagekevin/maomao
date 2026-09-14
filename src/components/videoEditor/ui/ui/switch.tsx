'use client';

import * as React from 'react';
import { Switch as SwitchPrimitives } from 'radix-ui';

import { cn } from '@videoEditor/utils/ui';

/**
 * 开关 —— **形状与配色全部在 ve-theme.css §7 的 `.ve-switch`**（一处定义）。
 *
 * 【为什么不再写布局工具类】（2026-09-15 用户："启用按钮也不对了，很丑"）
 * 组件里原本塞满了 `h-5 w-9 border-2 shadow-xs` 这类**布局与外观混在一起的工具类**：
 * 于是"开关长什么样"这件事被切碎在 9 个 class 里，主题层想统一改尺寸
 * （面板里的开关必须比同排 24px 输入框矮）得先跟这些类打架 —— 这正是补丁的来源。
 * 现在的分工：
 *   · 本组件只负责**结构与状态**（Radix 的 Root/Thumb + data-state）；
 *   · 尺寸、圆角、颜色、拇指位移全在 `.ve-switch` 一族里，改尺寸只需改那一处。
 * 状态交给 CSS 的 `[data-state]` 选择器（Radix 原生输出），不靠 Tailwind 的变体前缀。
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root className={cn('ve-switch', className)} {...props} ref={ref}>
    <SwitchPrimitives.Thumb className="pointer-events-none block" />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
