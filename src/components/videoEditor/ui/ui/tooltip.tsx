'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@videoEditor/utils/ui';
import { composeRefs } from './layer/compose-refs';
import { LayerPortal } from './layer/layer-root';
import {
  useAnchoredPosition,
  type LayerAlign,
  type LayerSide,
} from './layer/use-anchored-position';
import { Slot } from './slot';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 提示气泡 —— **自研**（原 `radix-ui` 的 `Tooltip.Provider/Root/Trigger/Content`）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【两条真实约束决定它长这样】
 *   ① **它必须在层根里**（`LayerPortal`）：原实现 Portal 到 `document.body`，
 *      而 `.ve-scope` 在编辑器根上 ⇒ 气泡拿不到 `--ve-*`，底色回落宿主画布色。
 *      （`bg-popover` 这个名字在 `ve-theme.css` 里**从未定义** → 静默回落，是本仓踩过的经典。）
 *   ② **它绝不能吞掉子元素的事件**：8 个消费方全是"图标按钮 + 气泡"，气泡抢了
 *      pointer 事件就会出现"悬停有提示、点不动按钮"。故气泡本体 `pointer-events-none`
 *      （比 Radix 的"可悬停气泡"更保守：本仓 0 处需要把鼠标移进气泡里操作）。
 *
 * 【延迟语义（与 Radix 同口径，工具条体验的关键）】
 *   · 悬停/聚焦后等 `delayDuration`（缺省 700ms，Provider 可改，Root 可覆盖）再显示 ——
 *     鼠标扫过一排按钮不该弹 7 次；
 *   · **跳过延迟**：上一个气泡刚关掉（`skipDelayDuration` 内）就移到下一个触发器 → 立即显示。
 *     没有这一条，扫描工具条时每个按钮都要重等 700ms（体验塌方）；
 *   · 关闭：离开触发器 / 失焦 / Escape / 按下（点击即认为用户已知道这里是干什么的）。
 *
 * 【焦点归还不适用】气泡不可交互、也不抢焦点（Radix 同样不给 tooltip 做焦点陷阱），
 * 所以没有"关闭后焦点回哪"的问题。
 * ══════════════════════════════════════════════════════════════════════════════
 */
interface TooltipDelayContextValue {
  delayDuration: number;
  /** 是否处于"刚关掉，接着悬停下一个可免延迟"窗口。 */
  shouldSkipDelay: () => boolean;
  markClosed: () => void;
}

const TooltipDelayContext = React.createContext<TooltipDelayContextValue | null>(null);

interface TooltipProviderProps {
  children?: React.ReactNode;
  /** 悬停到显示之间的等待（ms）。 */
  delayDuration?: number;
  /** 关掉之后多久内移到下一个触发器可免延迟（ms）。 */
  skipDelayDuration?: number;
}

function TooltipProvider({
  children,
  delayDuration = 700,
  skipDelayDuration = 300,
}: TooltipProviderProps) {
  const closedAtRef = React.useRef(0);

  const value = React.useMemo<TooltipDelayContextValue>(
    () => ({
      delayDuration,
      shouldSkipDelay: () =>
        skipDelayDuration > 0 && performance.now() - closedAtRef.current < skipDelayDuration,
      markClosed: () => {
        closedAtRef.current = performance.now();
      },
    }),
    [delayDuration, skipDelayDuration],
  );

  return <TooltipDelayContext.Provider value={value}>{children}</TooltipDelayContext.Provider>;
}

interface TooltipContextValue {
  open: boolean;
  requestOpen: () => void;
  requestClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  contentId: string;
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function useTooltipContext(componentName: string): TooltipContextValue {
  const context = React.useContext(TooltipContext);
  if (context === null) throw new Error(`${componentName} 必须放在 <Tooltip> 内使用。`);
  return context;
}

interface TooltipProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 覆盖 Provider 的延迟（单个气泡想要不同手感时用，如工具栏按钮 200ms）。 */
  delayDuration?: number;
}

function Tooltip({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  delayDuration,
}: TooltipProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolled;

  const provider = React.useContext(TooltipDelayContext);
  const effectiveDelay = delayDuration ?? provider?.delayDuration ?? 700;

  const anchorRef = React.useRef<HTMLElement | null>(null);
  const contentId = React.useId();
  const timerRef = React.useRef<number | null>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const clearTimer = React.useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const requestOpen = React.useCallback(() => {
    clearTimer();
    if (open) return;
    const delay = provider?.shouldSkipDelay() === true ? 0 : effectiveDelay;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setOpen(true);
    }, delay);
  }, [clearTimer, open, provider, effectiveDelay, setOpen]);

  const requestClose = React.useCallback(() => {
    clearTimer();
    if (!open) return;
    provider?.markClosed();
    setOpen(false);
  }, [clearTimer, open, provider, setOpen]);

  /* 卸载时清掉待触发的定时器：否则"扫过按钮后立刻切视图"会在卸载后 setState。 */
  React.useEffect(() => clearTimer, [clearTimer]);

  /* 打开期间 Escape 关闭（WAI-ARIA 要求；气泡挡住视线时用户的第一反应就是按它）。 */
  React.useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, requestClose]);

  const contextValue = React.useMemo<TooltipContextValue>(
    () => ({ open, requestOpen, requestClose, anchorRef, contentId }),
    [open, requestOpen, requestClose, contentId],
  );

  return <TooltipContext.Provider value={contextValue}>{children}</TooltipContext.Provider>;
}

interface TooltipTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  (
    { asChild = false, onPointerDown, onPointerEnter, onPointerLeave, onFocus, onBlur, ...props },
    ref,
  ) => {
    const context = useTooltipContext('TooltipTrigger');
    const { anchorRef, requestOpen, requestClose, contentId, open } = context;

    const anchorComposedRef = React.useMemo(
      () => composeRefs<HTMLElement>(anchorRef, ref),
      [anchorRef, ref],
    );

    /* 触发事件一律**先让调用点自己的处理跑**（`props` 里那些），再决定开合：
       否则调用点 `onPointerEnter` 里 `preventDefault` 也拦不住我们的定时器。 */
    const triggerProps = {
      'aria-describedby': open ? contentId : undefined,
      'data-open': open ? 'true' : undefined,
      onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
        onPointerEnter?.(event as React.PointerEvent<HTMLButtonElement>);
        if (!event.defaultPrevented) requestOpen();
      },
      onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
        onPointerLeave?.(event as React.PointerEvent<HTMLButtonElement>);
        if (!event.defaultPrevented) requestClose();
      },
      onFocus: (event: React.FocusEvent<HTMLElement>) => {
        onFocus?.(event as React.FocusEvent<HTMLButtonElement>);
        if (!event.defaultPrevented) requestOpen();
      },
      onBlur: (event: React.FocusEvent<HTMLElement>) => {
        onBlur?.(event as React.FocusEvent<HTMLButtonElement>);
        if (!event.defaultPrevented) requestClose();
      },
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        onPointerDown?.(event as React.PointerEvent<HTMLButtonElement>);
        if (!event.defaultPrevented) requestClose();
      },
    };

    if (asChild) {
      return <Slot ref={anchorComposedRef} {...triggerProps} {...props} />;
    }

    return <button ref={anchorComposedRef} type="button" {...triggerProps} {...props} />;
  },
);
TooltipTrigger.displayName = 'TooltipTrigger';

/* 变体表：底色/文字全部走 `--ve-*`（`bg-popover` 在 `ve-theme.css` 里未定义 → 会回落宿主色）。
   后 6 个语义变体（destructive/important/promotions/…）是画布侧遗留配色，编辑器内当前只用
   `default` 与 `sidebar`——保留导出面不动，避免外部调用点受影响。 */
const tooltipVariants = cva('overflow-visible rounded-sm text-sm shadow-md', {
  variants: {
    variant: {
      default: 'bg-background text-foreground border px-3 py-1.5',
      destructive:
        'bg-destructive/10 text-destructive dark:bg-destructive/20 border-destructive [border-width:0.5px]',
      outline: 'border-border',
      important:
        'bg-amber-100/90 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300 border-amber-900 [border-width:0.5px]',
      promotions:
        'bg-red-100/90 text-red-900 dark:bg-red-900/20 dark:text-red-300 border-red-900 [border-width:0.5px]',
      personal:
        'bg-green-100/90 text-green-900 dark:bg-green-900/20 dark:text-green-300 border-green-900 [border-width:0.5px]',
      updates:
        'bg-purple-100/90 text-purple-900 dark:bg-purple-900/20 dark:text-purple-300 border-purple-900 [border-width:0.5px]',
      forums:
        'bg-blue-100/90 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300 border-blue-900 [border-width:0.5px]',
      sidebar: 'bg-background text-foreground border border-border p-2.5 flex flex-col gap-2',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface TooltipContentProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof tooltipVariants> {
  side?: LayerSide;
  align?: LayerAlign;
  sideOffset?: number;
  alignOffset?: number;
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>((props, ref) => {
  const context = React.useContext(TooltipContext);
  if (context === null) return null;
  if (!context.open) return null;
  return <TooltipContentImpl {...props} forwardedRef={ref} context={context} />;
});
TooltipContent.displayName = 'TooltipContent';

function TooltipContentImpl({
  className,
  style,
  variant,
  side = 'top',
  align = 'center',
  sideOffset = 4,
  alignOffset = 0,
  children,
  forwardedRef,
  context,
  ...props
}: TooltipContentProps & {
  forwardedRef: React.Ref<HTMLDivElement>;
  context: TooltipContextValue;
}) {
  const {
    contentRef,
    style: positionStyle,
    side: resolvedSide,
  } = useAnchoredPosition({
    open: true,
    anchorRef: context.anchorRef,
    side,
    align,
    sideOffset,
    alignOffset,
  });

  return (
    <LayerPortal>
      <div
        ref={composeRefs<HTMLDivElement>(contentRef, forwardedRef)}
        id={context.contentId}
        role="tooltip"
        data-open="true"
        data-side={resolvedSide}
        style={{ ...positionStyle, ...style }}
        /* `pointer-events-none`：气泡**永不**参与命中测试（见文件头 ②）。 */
        className={cn('pointer-events-none z-modal-raise', tooltipVariants({ variant }), className)}
        {...props}
      >
        {variant === 'sidebar' && (
          <svg
            width="6"
            height="10"
            viewBox="0 0 6 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute top-1/2 left-[-6px] -translate-y-1/2"
          >
            <path d="M6 0L0 5L6 10V0Z" className="fill-white/80 dark:fill-[#413F3E]" />
          </svg>
        )}
        {children}
      </div>
    </LayerPortal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
