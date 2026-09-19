'use client';

import * as React from 'react';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/components/videoEditor/utils/ui';
import { MenuItemBase, MenuRoot, MenuSubTriggerBase, MenuSurface, MenuTrigger } from './menu/menu';

/**
 * 下拉菜单 —— **自研**（原 `radix-ui` 的 `DropdownMenu.*`）。
 *
 * 【本文件只负责"外观 + 名字"】行为（定位 / 键盘遍历 / 高亮 / 关闭与焦点）全部在
 * `ui/ui/menu/menu.tsx`，与 `context-menu.tsx` 共用同一份 —— 两者只差"怎么开"。
 *
 * 【三处跟随自研口径的改名/换值，都是往唯一真源收】
 *   · `data-state="open"` → `data-open`（本仓自有状态属性；不再混用 Radix 的 `data-state`）。
 *   · `bg-popover` / `data-[highlighted]:bg-popover-hover` → `bg-background` / `bg-secondary`：
 *     前两者对应的 `--ve-popover*` 在 `videoEditorTheme.css` **从未定义** → 静默回落宿主画布色，
 *     正是 `docs/135` §三.1 明令禁止的"画布侧回落 token"。
 *   · 高亮属性仍是 `data-highlighted`（由菜单内核按键盘/悬停写入），样式钩子不变。
 */
const DropdownMenu = MenuRoot;

const DropdownMenuTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuTrigger>
>((props, ref) => <MenuTrigger ref={ref} mode="click" {...props} />);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

const dropdownMenuItemVariants = cva(
  'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground/85 outline-hidden data-[highlighted]:bg-secondary data-disabled:pointer-events-none data-disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0',
  {
    variants: {
      variant: {
        default: '',
        destructive:
          'text-destructive data-[highlighted]:bg-destructive/5 data-[highlighted]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const DropdownMenuSubTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuSubTriggerBase> & {
    inset?: boolean;
    variant?: VariantProps<typeof dropdownMenuItemVariants>['variant'];
  }
>(({ className, inset, children, variant = 'default', ...props }, ref) => (
  <MenuSubTriggerBase
    ref={ref}
    className={cn(
      dropdownMenuItemVariants({ variant }),
      'data-[open]:bg-secondary data-[open]:text-foreground',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </MenuSubTriggerBase>
));
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuSurface>
>(({ className, ...props }, ref) => (
  <MenuSurface
    ref={ref}
    side="right"
    align="start"
    sideOffset={2}
    className={cn(
      'bg-background text-foreground z-modal-raise min-w-32 overflow-hidden rounded-2xl border p-2 shadow-lg',
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuSurface>
>(({ className, sideOffset = 4, align = 'center', ...props }, ref) => (
  <MenuSurface
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      'bg-background text-foreground z-modal-raise min-w-32 overflow-hidden rounded-lg border p-2 shadow-lg',
      className,
    )}
    {...props}
  />
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

const DropdownMenuItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuItemBase> & {
    inset?: boolean;
    variant?: VariantProps<typeof dropdownMenuItemVariants>['variant'];
  }
>(({ className, inset, variant = 'default', ...props }, ref) => (
  <MenuItemBase
    ref={ref}
    className={cn(dropdownMenuItemVariants({ variant }), inset && 'pl-8', className)}
    {...props}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

const DropdownMenuCheckboxItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuItemBase> & {
    variant?: VariantProps<typeof dropdownMenuItemVariants>['variant'];
  }
>(({ className, children, checked, variant = 'default', ...props }, ref) => (
  <MenuItemBase
    ref={ref}
    role="menuitemcheckbox"
    keepOpen
    checked={checked}
    className={cn(dropdownMenuItemVariants({ variant }), 'pr-8 pl-2', className)}
    {...props}
  >
    {children}
    {checked === true && (
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <Check className="size-4" />
      </span>
    )}
  </MenuItemBase>
));
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

const DropdownMenuRadioItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuItemBase> & {
    variant?: VariantProps<typeof dropdownMenuItemVariants>['variant'];
  }
>(({ className, children, checked, variant = 'default', ...props }, ref) => (
  <MenuItemBase
    ref={ref}
    role="menuitemradio"
    keepOpen
    checked={checked}
    className={cn(dropdownMenuItemVariants({ variant }), 'pr-2 pl-8', className)}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      {checked === true && <Circle className="size-2 fill-current" />}
    </span>
    {children}
  </MenuItemBase>
));
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-3 pt-1 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    aria-orientation="horizontal"
    className={cn('bg-border/60 mx-1 my-2 h-px', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />
  );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
};
