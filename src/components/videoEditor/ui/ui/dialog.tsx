'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@videoEditor/utils/ui';
import { composeRefs } from './layer/compose-refs';
import { LayerPortal } from './layer/layer-root';
import { useDismissable } from './layer/use-dismissable';
import { Slot } from './slot';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 对话框 —— **自研**（原 `radix-ui` 的 `Dialog.*`）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【四件事，缺一即不算对话框】
 *   ① **层根渲染**（`LayerPortal`）：原先 Portal 到 `document.body` ⇒ 出 `.ve-scope` ⇒
 *      `--ve-*` 全失效（靠"给 body 挂主题类"的补丁兜着）。现在与面板同作用域。
 *   ② **遮罩**：`DialogOverlay`（同时在，点它 = 点在内容外 ⇒ 关闭）。
 *   ③ **焦点陷阱**：打开即把焦点收进内容；Tab / Shift+Tab 在内容内**循环**（不逃到编辑器面板）。
 *      这是模态对话框的可访问性底线 —— 焦点跑到背后的面板上，鼠标用户只是"感觉怪"，
 *      键盘用户则是**完全失控**。
 *   ④ **Escape 关闭** + 关闭后**不抢焦点**：原实现在 `onCloseAutoFocus` 里
 *      `preventDefault + stopPropagation`（显式关闭"焦点归还"），本实现保持同一口径
 *      —— 归还与否是消费方的策略，不是原语的默认。
 *
 * 【明确不做】`alert-dialog` 那套"必须点按钮才能关"的强模态语义（本仓 0 处使用）；
 * 不做进出场动画（Radix 的动画靠 `data-state` + 动画库，本仓已删浮层动效依赖）。
 * ══════════════════════════════════════════════════════════════════════════════
 */
interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  titleId: string;
  descriptionId: string;
  triggerRef: React.RefObject<HTMLElement | null>;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(componentName: string): DialogContextValue {
  const context = React.useContext(DialogContext);
  if (context === null) throw new Error(`${componentName} 必须放在 <Dialog> 内使用。`);
  return context;
}

interface DialogProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function Dialog({ children, open: openProp, defaultOpen = false, onOpenChange }: DialogProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolled;

  const triggerRef = React.useRef<HTMLElement | null>(null);
  const contentId = React.useId();
  const titleId = React.useId();
  const descriptionId = React.useId();

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const contextValue = React.useMemo<DialogContextValue>(
    () => ({ open, setOpen, contentId, titleId, descriptionId, triggerRef }),
    [open, setOpen, contentId, titleId, descriptionId],
  );

  return <DialogContext.Provider value={contextValue}>{children}</DialogContext.Provider>;
}

interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ asChild = false, onClick, ...props }, ref) => {
    const context = useDialogContext('DialogTrigger');
    const composedRef = React.useMemo(
      () => composeRefs<HTMLElement>(context.triggerRef, ref),
      [context.triggerRef, ref],
    );

    const triggerProps = {
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': context.open,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        onClick?.(event as React.MouseEvent<HTMLButtonElement>);
        if (event.defaultPrevented) return;
        context.setOpen(true);
      },
    };

    if (asChild) return <Slot ref={composedRef} type="button" {...triggerProps} {...props} />;
    return (
      <button
        ref={composedRef as React.Ref<HTMLButtonElement>}
        type="button"
        {...triggerProps}
        {...props}
      />
    );
  },
);
DialogTrigger.displayName = 'DialogTrigger';

/** 弹层容器：统一进编辑器层根（不再 `document.body`）。 */
function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <LayerPortal>{children}</LayerPortal>;
}

const DialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-open="true"
      className={cn(
        'pointer-events-auto fixed inset-0 z-modal-raise bg-black/10 backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  ),
);
DialogOverlay.displayName = 'DialogOverlay';

/**
 * 可聚焦元素（按 DOM 顺序）—— 焦点陷阱用。
 *
 * 【可见性判定为什么不用 `offsetParent`】那是最常见的写法，但它有两个坑：
 * ① `position: fixed` 元素自身的 `offsetParent` 恒为 `null`（本对话框就是 fixed）；
 * ② jsdom 里 `offsetParent` **永远是 null** ⇒ 过滤后只剩"当前已聚焦那一个" ⇒
 *    焦点陷阱在测试里静默退化（假绿），而真机上行为不同 —— 正是本仓最忌讳的"判据与真身不一致"。
 * 改用**语义判据**：`hidden` 属性 / `aria-hidden="true"` 的后代不算可聚焦。
 */
function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (node) => node.closest('[hidden]') === null && node.closest('[aria-hidden="true"]') === null,
  );
}

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    /** Radix 同名的开层前钩子；`preventDefault()` = 不要自动聚焦（本项目删除确认框在用）。 */
    onOpenAutoFocus?: (event: Event) => void;
  }
>(function DialogContent({ className, children, onOpenAutoFocus, onKeyDown, ...props }, ref) {
  const context = useDialogContext('DialogContent');
  if (!context.open) return null;
  return (
    <DialogContentImpl
      {...props}
      className={className}
      onKeyDown={onKeyDown}
      onOpenAutoFocus={onOpenAutoFocus}
      forwardedRef={ref}
      context={context}
    >
      {children}
    </DialogContentImpl>
  );
});
DialogContent.displayName = 'DialogContent';

function DialogContentImpl({
  className,
  children,
  onOpenAutoFocus,
  onKeyDown,
  forwardedRef,
  context,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  onOpenAutoFocus?: (event: Event) => void;
  forwardedRef: React.Ref<HTMLDivElement>;
  context: DialogContextValue;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  const handleDismiss = React.useCallback(() => context.setOpen(false), [context]);

  useDismissable({
    enabled: true,
    contentRef,
    triggerRef: context.triggerRef,
    onDismiss: handleDismiss,
  });

  /* 打开即聚焦（可被 `onOpenAutoFocus` 拦下）：模态的第一条是"焦点在对话框里"。 */
  React.useLayoutEffect(() => {
    const node = contentRef.current;
    if (node === null) return;
    const event = new Event('openautofocus', { cancelable: true });
    onOpenAutoFocus?.(event);
    if (event.defaultPrevented) return;
    const focusables = focusableIn(node);
    (focusables[0] ?? node).focus();
  }, [onOpenAutoFocus]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== 'Tab') return;

    const node = contentRef.current;
    if (node === null) return;
    const focusables = focusableIn(node);
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    /* 焦点陷阱：在两端把 Tab 折回另一端（不靠"多插两个哨兵节点"，那会污染 DOM）。 */
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !node.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay onPointerDown={() => context.setOpen(false)} />
      <div
        ref={composeRefs<HTMLDivElement>(contentRef, forwardedRef)}
        id={context.contentId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={context.titleId}
        aria-describedby={context.descriptionId}
        data-open="true"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        /* `bg-popover` → `bg-background`：前者在 ve-theme 里**未定义**（回落宿主画布色）。
           （`ve-theme.css` §6 另有 `[role='dialog']` 规则兜底同一套底色/发丝边/投影。） */
        className={cn(
          'bg-background pointer-events-auto fixed top-[50%] left-[50%] z-modal-raise grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border shadow-lg duration-200',
          className,
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          aria-label="关闭"
          onClick={() => context.setOpen(false)}
          className="ring-offset-background focus:ring-ring absolute top-6 right-6 cursor-pointer opacity-70 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
        >
          <X className="size-5 text-muted-foreground" />
        </button>
      </div>
    </DialogPortal>
  );
}

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-2 border-b p-6 pb-0 text-left', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-6 p-6', className)} {...props} />
);
DialogBody.displayName = 'DialogBody';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-3 border-t p-6 py-5 sm:flex-row sm:justify-end',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

/** 标题 / 说明：id 由 `Dialog` 根分配，`DialogContent` 用 `aria-labelledby` 关联（读屏靠这条链）。 */
const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const context = useDialogContext('DialogTitle');
    return (
      <h2
        ref={ref}
        id={context.titleId}
        className={cn('text-lg leading-none font-semibold tracking-tight', className)}
        {...props}
      />
    );
  },
);
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const context = useDialogContext('DialogDescription');
  return (
    <p
      ref={ref}
      id={context.descriptionId}
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
});
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
