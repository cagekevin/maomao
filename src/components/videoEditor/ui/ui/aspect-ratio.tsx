'use client';

import * as React from 'react';

/**
 * 定比容器 —— **原生 CSS `aspect-ratio`，无依赖**（原 `radix-ui` 的 `AspectRatio.Root`）。
 *
 * 【为什么换掉 Radix 的实现（2026-09-15 · docs/135-radix-ui依赖移除计划）】
 * Radix 用的是 **padding-bottom 补丁**：外层 `padding-bottom: 100/ratio%` 撑高，
 * 内层用 `position:absolute; inset:0` 填满，于是调用点传的 `ref`/`className`
 * 落在**内层**（`data-radix-aspect-ratio-wrapper` 是外层）。同一件事多一层 DOM、
 * 多一层定位，且"ratio 变了要重算百分比"。
 * `aspect-ratio` 是原生属性，宽高比交给布局引擎算 —— 一个 div，一个 prop。
 *
 * 【API 兼容】`ratio` 缺省 `1`（Radix 同值）；`className`/`ref`/`style` 仍然透传到
 * **同一个可见盒子**上（旧实现落内层、新实现落本体，视觉盒等价）。
 */
interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 宽高比 = 宽 / 高。`1` 正方形，`16/9` 宽屏。 */
  ratio?: number;
}

const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ className, ratio = 1, style, ...props }, ref) => (
    <div
      ref={ref}
      className={className}
      /* `position:relative` + `width:100%` 与旧实现同口径（abs 子元素与百分比宽有参照）；
         放在 `...style` 之前 → 调用点传的 style 仍可覆盖。 */
      style={{ position: 'relative', width: '100%', aspectRatio: String(ratio), ...style }}
      {...props}
    />
  ),
);
AspectRatio.displayName = 'AspectRatio';

export { AspectRatio };
