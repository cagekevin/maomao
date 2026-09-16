'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ArrowRight, Check, Circle } from 'lucide-react';

import { cn } from '@/components/videoEditor/utils/ui';
import {
  MenuItemBase,
  MenuRoot,
  MenuSub,
  MenuSubTriggerBase,
  MenuSurface,
  MenuTrigger,
} from './menu/menu';

/**
 * 右键菜单 —— **自研**（原 `radix-ui` 的 `ContextMenu.*`）。
 *
 * 【与 `dropdown-menu.tsx` 的关系】"展开之后"的一切共用 `ui/ui/menu/menu.tsx`
 * （**没有第二份列表实现**，这是 `docs/135` §四.C 的硬要求）；本文件只负责：
 *   · 触发器用 `contextmenu` 模式（锚点 = 鼠标点，不是元素）；
 *   · 这套菜单的密度与配色（比下拉更松：`px-4 py-1.5`、`min-w-48`、`py-2.5`）。
 *
 * 【高亮从 `focus:` 改为 `data-[highlighted]:`】这是**必须**跟着改的：Radix 用"把焦点放到每一项"
 * 来实现高亮，故原样式写的是 `focus:bg-accent/35`；自研把焦点留在容器上（`role=menu` 的遍历语义），
 * 高亮由内核写 `data-highlighted` ⇒ 若沿用 `focus:`，**悬停/键盘移动都不会有任何反馈**（静默失效）。
 */
const ContextMenu = MenuRoot;

const ContextMenuTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuTrigger>
>((props, ref) => <MenuTrigger ref={ref} mode="contextmenu" {...props} />);
ContextMenuTrigger.displayName = 'ContextMenuTrigger';

const ContextMenuSub = MenuSub;

const contextMenuItemVariants = cva(
  'relative flex cursor-pointer select-none items-center gap-2.5 px-4 py-1.5 text-base outline-hidden last:pb-1 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'data-[highlighted]:bg-accent/35 data-[highlighted]:text-foreground [&_svg]:text-muted-foreground',
        destructive:
          'text-destructive data-[highlighted]:bg-destructive/5 data-[highlighted]:text-destructive [&_svg]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const ContextMenuSubTrigger = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuSubTriggerBase> & {
    inset?: boolean;
    variant?: VariantProps<typeof contextMenuItemVariants>['variant'];
    icon?: React.ReactNode;
  }
>(({ className, inset, children, variant = 'default', icon, ...props }, ref) => (
  <MenuSubTriggerBase
    ref={ref}
    className={cn(
      contextMenuItemVariants({ variant }),
      'data-[open]:bg-primary data-[open]:text-primary-foreground',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {icon && <span className="size-4 shrink-0 text-muted-foreground">{icon}</span>}
    {children}
    <ArrowRight className="ml-auto text-muted-foreground/80" />
  </MenuSubTriggerBase>
));
ContextMenuSubTrigger.displayName = 'ContextMenuSubTrigger';

const ContextMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuSurface>
>(({ className, ...props }, ref) => (
  <MenuSurface
    ref={ref}
    side="right"
    align="start"
    sideOffset={2}
    className={cn(
      'bg-background text-foreground z-modal-raise min-w-48 overflow-hidden rounded-lg border py-2.5 shadow-xl',
      className,
    )}
    {...props}
  />
));
ContextMenuSubContent.displayName = 'ContextMenuSubContent';

const ContextMenuContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof MenuSurface>
>(({ className, ...props }, ref) => (
  <MenuSurface
    ref={ref}
    className={cn(
      'bg-background text-foreground z-modal-raise min-w-48 overflow-hidden rounded-lg border py-2.5 shadow-xl',
      className,
    )}
    {...props}
  />
));
ContextMenuContent.displayName = 'ContextMenuContent';

const ContextMenuItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuItemBase> & {
    inset?: boolean;
    variant?: VariantProps<typeof contextMenuItemVariants>['variant'];
    icon?: React.ReactNode;
    textRight?: string;
  }
>(({ className, inset, variant = 'default', icon, children, textRight, ...props }, ref) => (
  <MenuItemBase
    ref={ref}
    className={cn(contextMenuItemVariants({ variant }), inset && 'pl-8', className)}
    {...props}
  >
    {icon && <span className="[&_svg]:size-4 [&_svg]:shrink-0">{icon}</span>}
    {children}
    {textRight && (
      <span className="ml-auto mb-0.5 text-[0.60rem] tracking-widest text-muted-foreground/80">
        {textRight}
      </span>
    )}
  </MenuItemBase>
));
ContextMenuItem.displayName = 'ContextMenuItem';

const ContextMenuCheckboxItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuItemBase> & {
    variant?: VariantProps<typeof contextMenuItemVariants>['variant'];
    icon?: React.ReactNode;
  }
>(({ className, children, checked, variant = 'default', icon, ...props }, ref) => (
  <MenuItemBase
    ref={ref}
    role="menuitemcheckbox"
    keepOpen
    checked={checked}
    className={cn(contextMenuItemVariants({ variant }), 'pr-2 pl-8', className)}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      {checked === true && <Check className="size-4" />}
    </span>
    {icon && <span className="size-4 shrink-0 text-muted-foreground">{icon}</span>}
    {children}
  </MenuItemBase>
));
ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem';

const ContextMenuRadioItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof MenuItemBase> & {
    variant?: VariantProps<typeof contextMenuItemVariants>['variant'];
    icon?: React.ReactNode;
  }
>(({ className, children, checked, variant = 'default', icon, ...props }, ref) => (
  <MenuItemBase
    ref={ref}
    role="menuitemradio"
    keepOpen
    checked={checked}
    className={cn(contextMenuItemVariants({ variant }), 'pr-2 pl-8', className)}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      {checked === true && <Circle className="size-2 fill-current" />}
    </span>
    {icon && <span className="size-4 shrink-0 text-muted-foreground">{icon}</span>}
    {children}
  </MenuItemBase>
));
ContextMenuRadioItem.displayName = 'ContextMenuRadioItem';

const ContextMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean; icon?: React.ReactNode }
>(({ className, inset, icon, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center gap-2.5 px-4 py-1.5 text-sm font-semibold text-foreground',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {icon && <span className="size-4 shrink-0 text-muted-foreground">{icon}</span>}
    {children}
  </div>
));
ContextMenuLabel.displayName = 'ContextMenuLabel';

const ContextMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      aria-orientation="horizontal"
      className={cn('bg-border my-2 h-px', className)}
      {...props}
    />
  ),
);
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest text-muted-foreground opacity-60', className)}
      {...props}
    />
  );
};
ContextMenuShortcut.displayName = 'ContextMenuShortcut';

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
};
