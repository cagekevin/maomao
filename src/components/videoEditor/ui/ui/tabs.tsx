'use client';

import * as React from 'react';

import { cn } from '@/components/videoEditor/utils/ui';

/**
 * 页签 —— **自研，无依赖**（原 `radix-ui` 的 `Tabs.Root/List/Trigger/Content`）。
 *
 * ══════════════════════════════════════════════════════════════════════════
 * 【为什么必须自研：`hidden` 属性靠不住】（2026-09-15 事故根因）
 * Radix 用 `hidden` **属性**隐藏非激活面板（`@radix-ui/react-tabs`：`hidden: !present`），
 * 它依赖的是 **UA 样式表的 `[hidden] { display: none }`** —— 而 UA 样式会被
 * **任何作者 `display` 类覆盖**。于是调用点只要写 `className="flex flex-1 …"`，
 * 那个**空容器**就继续以 `display:flex` 参与布局，与激活面板**平分高度** ⇒
 * N 个 tab 时内容只占 1/N、其余是空白，且空白在内容上方还是下方取决于当前是第几个 tab。
 *
 * 【本实现的口径：非激活 = 不渲染】（本原语最重要的一条）
 *   `if (ctx === null || ctx.value !== value) return null;`   ← `TabsContent` 实现体第一句
 * 不渲染就不存在布局 —— **不需要与 CSS 优先级搏斗**，也就不需要调用点"记得别写 display 类"。
 * 这正好对上本仓已判定的母体缺陷 M2：凡是"靠人记得"的约定，都要换成机器可判定的实现。
 * （Radix 那边同样有 `Presence` 卸载，但它额外给了 `hidden` 这条可被压掉的兜底路径，
 *   并默认把"防占位"的责任推给调用点的 CSS。）
 *
 * 【状态属性：`data-active`】与 Checkbox/Switch/Radio 同一口径；不再引入 `data-state`。
 * 【键盘】方向键在 tab 间移动**并立即切换**（ARIA 的 automatic activation，Radix 默认档）；
 *   `Home`/`End` 跳首尾；`aria-controls` / `aria-labelledby` 成对。
 * ══════════════════════════════════════════════════════════════════════════
 */
interface TabsContextValue {
  value?: string;
  setValue: (value: string) => void;
  baseId: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

interface TabsProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'defaultValue'
> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, defaultValue, onValueChange, children, ...props }, ref) => {
    const [uncontrolled, setUncontrolled] = React.useState<string | undefined>(defaultValue);
    const isControlled = value !== undefined;
    const current = isControlled ? value : uncontrolled;
    const baseId = React.useId();

    const setValue = React.useCallback(
      (next: string) => {
        if (!isControlled) setUncontrolled(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const contextValue = React.useMemo<TabsContextValue>(
      () => ({ value: current, setValue, baseId }),
      [current, setValue, baseId],
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, onKeyDown, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;

        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
        );
        if (items.length === 0) return;

        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        let next: HTMLButtonElement | undefined;
        if (event.key === 'ArrowRight') next = items[(index + 1 + items.length) % items.length];
        else if (event.key === 'ArrowLeft') next = items[(index - 1 + items.length) % items.length];
        else if (event.key === 'Home') next = items[0];
        else if (event.key === 'End') next = items[items.length - 1];
        if (!next) return;

        event.preventDefault();
        next.focus();
        /* automatic activation：方向键移动焦点即切换（Radix 默认档）。
           用 `click()` 而不是直接 setValue：禁用态/调用点自己的 onClick 一并生效，语义单一。 */
        next.click();
      }}
      className={cn(
        'text-muted-foreground inline-flex h-auto items-center justify-center gap-2 rounded-lg bg-transparent p-0',
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = 'TabsList';

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled, onClick, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    const isActive = ctx?.value === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={ctx ? `${ctx.baseId}-tab-${value}` : undefined}
        aria-controls={ctx ? `${ctx.baseId}-panel-${value}` : undefined}
        aria-selected={isActive}
        data-active={isActive || undefined}
        disabled={disabled}
        /* roving tabindex：只有激活的 tab 是 Tab 停靠点（ARIA tablist 规范）。 */
        tabIndex={isActive ? 0 : -1}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !disabled) ctx?.setValue(value);
        }}
        className={cn(
          'ring-offset-background focus-visible:ring-ring data-[active]:bg-primary data-[active]:text-primary-foreground inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-1 text-sm font-medium whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = 'TabsTrigger';

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);

    /* ★ 非激活 = **不渲染**（本原语存在的理由，见文件头）。
       ⚠️ 不要改回 `<div hidden …>`：`hidden` 是 UA 样式，任何作者 `display` 类都能压掉它，
       那正是"各 tab 参差 / 互相遮挡 / 内容前空一截"的来源。 */
    if (ctx === null || ctx.value !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${ctx.baseId}-panel-${value}`}
        aria-labelledby={`${ctx.baseId}-tab-${value}`}
        tabIndex={0}
        className={cn(
          'ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden',
          className,
        )}
        {...props}
      />
    );
  },
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
