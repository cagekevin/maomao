'use client';

import * as React from 'react';

import { cn } from '@/components/videoEditor/utils/ui';
import { composeRefs } from './layer/compose-refs';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * Slot —— `asChild` 语义的唯一实现（自研，取代 `radix-ui` 的 `Slot.Root`）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【它解决什么】`<Button asChild>` 要的不是"渲染一个按钮"，而是
 * **"把我这套按钮的 props/类名/ref 合到调用点给的那个元素上"** ——
 * 于是调用点可以拿 `<a>` / `<Link>` / 自家 `<button>` 当按钮用，而不用把样式复制一遍。
 * 本编辑器 18 处 `asChild` 全靠它（`Button`、`PopoverTrigger`、`DropdownMenuTrigger`…）。
 *
 * 【合并规则（与 Radix Slot 逐条对齐，改这里必须同步这张表）】
 *   · `className`：**本仓用 `cn()`（tailwind-merge）合并**而不是字符串拼接 ——
 *     拼接的胜负由「样式表里的先后」决定（无从预测），`cn` 让**子元素显式写的类赢**，
 *     这才是"调用点的意图优先"。这是与 Radix 唯一的有意差异，且是改进。
 *   · `style`：浅合并，子元素覆盖同名键。
 *   · 事件处理（`on[A-Z]…`）：两边都有则**都跑，子元素先、槽后**
 *     （Radix 同序；之所以顺序重要：消费方 `onClick` 里可能先 `setOpen(true)`，
 *      槽的开合切换随后按"当前 props"取反 —— 顺序反了会得到相反的开关结果）。
 *   · 其余 prop：子元素显式给了就子元素赢，否则用槽的。
 *   · `ref`：两边都挂（`composeRefs`）。
 *
 * 【不支持 `Slottable`】那是 Radix 为"一个组件塞多个子节点、只把 props 落到其中一个"
 * 准备的。本仓 0 处使用 —— 不实现未使用的能力（奥卡姆）。
 */
interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

/** 从元素上取它自带的 ref（React 19 的 `ref` 在 props 上；旧位置兜底）。 */
function getElementRef(
  element: React.ReactElement<Record<string, unknown>>,
): React.Ref<unknown> | undefined {
  const fromProps = (element.props as { ref?: React.Ref<unknown> }).ref;
  if (fromProps !== undefined) return fromProps;
  return (element as { ref?: React.Ref<unknown> }).ref;
}

function mergeSlotProps(
  slotProps: Record<string, unknown>,
  childProps: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...slotProps, ...childProps };

  for (const key of Object.keys(childProps)) {
    const slotValue = slotProps[key];
    if (slotValue === undefined) continue;
    const childValue = childProps[key];

    if (
      /^on[A-Z]/.test(key) &&
      typeof slotValue === 'function' &&
      typeof childValue === 'function'
    ) {
      const slotHandler = slotValue as (...args: unknown[]) => unknown;
      const childHandler = childValue as (...args: unknown[]) => unknown;
      merged[key] = (...args: unknown[]) => {
        childHandler(...args);
        slotHandler(...args);
      };
      continue;
    }

    if (key === 'style') {
      merged[key] = { ...(slotValue as object), ...(childValue as object) };
      continue;
    }

    if (key === 'className') {
      merged[key] = cn(slotValue as string, childValue as string);
      continue;
    }

    if (childValue === undefined) merged[key] = slotValue;
  }

  return merged;
}

const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, ...slotProps }, forwardedRef) => {
    if (!React.isValidElement(children)) {
      throw new Error(
        'Slot 需要**单一** React 元素子节点（把 props 落到它身上；文本/多子节点无从落）。',
      );
    }

    const child = children as React.ReactElement<Record<string, unknown>>;
    const childProps = (child.props ?? {}) as Record<string, unknown>;
    const mergedProps = mergeSlotProps(slotProps as Record<string, unknown>, childProps);
    mergedProps.ref = composeRefs<HTMLElement>(
      forwardedRef,
      getElementRef(child) as React.Ref<HTMLElement> | undefined,
    );

    return React.cloneElement(child, mergedProps);
  },
);
Slot.displayName = 'Slot';

export { Slot };
