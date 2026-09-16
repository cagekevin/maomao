'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/components/videoEditor/utils/ui';

/**
 * 表单标签 —— **原生 `<label>`，无依赖**（原 `radix-ui` 的 `Label.Root`）。
 *
 * 【为什么可以直接换成原生】Radix Label 的全部价值 = `htmlFor` 关联 + 点击聚焦，
 * 这两件事**原生 `<label>` 本来就做**（Radix 自己也只是渲染一个 `<label>`）。
 * 旧实现唯一的额外动作是"mousedown 时若不是控件就 preventDefault"（防双击选中文字），
 * 那是纯修饰，不是契约。
 *
 * 【样式】`text-muted-foreground` 在 `ve-tailwind-colors.ts` 里映射到
 * `rgb(var(--ve-fg) / 0.55)` —— 即 `.ve-row-label` 同一档（L2 行标签），
 * 不引入画布侧裸 token。字级统一由 `ve-theme.css` §8 归一层收口。
 */
const labelVariants = cva(
  'text-xs text-muted-foreground font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>, VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = 'Label';

export { Label };
