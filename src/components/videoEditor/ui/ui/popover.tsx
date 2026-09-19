'use client';

import * as React from 'react';

import { cn } from '@/components/videoEditor/utils/ui';
import { composeRefs } from './layer/compose-refs';
import { LayerPortal } from './layer/layer-root';
import {
  useAnchoredPosition,
  type LayerAlign,
  type LayerSide,
} from './layer/use-anchored-position';
import { useDismissable, type DismissReason } from './layer/use-dismissable';
import { Slot } from './slot';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 弹出层 —— **自研**（原 `radix-ui` 的 `Popover.Root/Trigger/Content`）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【与原实现的三处实质差异，都是"往唯一真源收"，不是"换一个黑盒"】
 *   ① **渲染进编辑器层根**（`LayerPortal`），不再 Portal 到 `document.body`：
 *      弹层从此天生在 `.ve-scope` 里，`--ve-*` 全部命中 —— 不再依赖"给 body 挂主题类"的补丁。
 *   ② **底色取 `--ve-bg`**（`bg-background`）：原类名是 `bg-popover` → `--ve-popover`
 *      **在 `videoEditorTheme.css` 里从未定义** → 静默回落宿主画布色（`docs/135` §三.1 明令禁止）。
 *      编辑器铁律是"只有一个背景值 `--ve-bg`"（videoEditorTheme.css 头注）—— 弹层与面板同底才对。
 *   ③ **状态属性 `data-open`**（自有语言），不再输出 Radix 的 `data-state="open|closed"`。
 *
 * 【保留的行为（逐条对齐 Radix，都有真实理由）】
 *   · 触发器 `onClick` **切换**（不是"只开不关"）；`aria-haspopup="dialog"` + `aria-expanded` + `aria-controls`；
 *   · `asChild`：消费方把自家 `<button>` 当触发器用，样式/事件不复制；
 *   · Escape 关闭 + **焦点归还触发器**；点击外部关闭但**不抢焦点**（用户点哪就留哪）；
 *   · 关层即卸载（无退出动画 → 不存在"动画期间还占位"）。
 *
 * 【`asChild` 的事件顺序】子元素 `onClick` 先跑、触发器的切换后跑（与 Radix Slot 同序）。
 * 顺序不能反：export-button 的子 `onClick` 会 `setOpen(true)`，切换再按**当次渲染的 `open`** 取反 ——
 * 若反过来，就得到"点了没反应"（true → false）。这条已由 `slot.tsx` 的合并规则保证。
 * ══════════════════════════════════════════════════════════════════════════════
 */
interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** 触发器节点：定位锚点 + "点击外部"要排除的节点 + 关闭后焦点的归属。 */
  anchorRef: React.RefObject<HTMLElement | null>;
  contentId: string;
  /** 关闭时是否把焦点还给触发器（"点到别处去了"不该抢，见 `use-dismissable` 头注）。 */
  restoreFocusRef: React.RefObject<boolean>;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopoverContext(componentName: string): PopoverContextValue {
  const context = React.useContext(PopoverContext);
  if (context === null) throw new Error(`${componentName} 必须放在 <Popover> 内使用。`);
  return context;
}

interface PopoverProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function Popover({ children, open: openProp, defaultOpen = false, onOpenChange }: PopoverProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolled;

  const anchorRef = React.useRef<HTMLElement | null>(null);
  const restoreFocusRef = React.useRef(true);
  const contentId = React.useId();

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  /* 切换按**当次渲染的 `open`** 取反：受控模式下必须看 props 而不是内部 state
     （`setOpen(prev => !prev)` 会在"子元素先 setOpen(true)"之后拿到 true ⇒ 又变回 false，同 Radix 的坑）。 */
  const toggle = React.useCallback(() => setOpen(!open), [setOpen, open]);

  const previousOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (open === previousOpenRef.current) return;
    previousOpenRef.current = open;

    if (open) {
      restoreFocusRef.current = true;
      return;
    }
    /* 关闭：只在"非外部点击"时归还焦点。置位与 `setOpen(false)` 在同一个事件处理里同步发生，
       故此处读到的就是本次关闭的原因（无竞态）。 */
    if (restoreFocusRef.current) anchorRef.current?.focus();
    restoreFocusRef.current = true;
  }, [open]);

  const contextValue = React.useMemo<PopoverContextValue>(
    () => ({ open, setOpen, toggle, anchorRef, contentId, restoreFocusRef }),
    [open, setOpen, toggle, contentId],
  );

  return <PopoverContext.Provider value={contextValue}>{children}</PopoverContext.Provider>;
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ className, asChild = false, onClick, ...props }, ref) => {
    const context = usePopoverContext('PopoverTrigger');
    const { anchorRef, toggle } = context;

    /* 锚点用**普通 ref 对象**收集（不用"回调 ref + state"）：回调 ref 的标识每次渲染都会变，
       会引出"卸载(null) → 重挂(node)"的状态抖动，一旦 setState 掺进来就自激成死循环。
       普通 ref 不触发渲染 —— 弹层在 `open` 翻真的那次渲染里直接读 `anchorRef.current` 即可。 */
    const anchorComposedRef = React.useMemo(
      () => composeRefs<HTMLElement>(anchorRef, ref),
      [anchorRef, ref],
    );

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
      onClick?.(event as React.MouseEvent<HTMLButtonElement>);
      if (!event.defaultPrevented) toggle();
    };

    const triggerProps = {
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': context.open,
      'aria-controls': context.open ? context.contentId : undefined,
      onClick: handleClick,
    };

    if (asChild) {
      return <Slot ref={anchorComposedRef} type="button" {...triggerProps} {...props} />;
    }

    return (
      <button
        ref={anchorComposedRef}
        type="button"
        {...triggerProps}
        {...props}
        className={cn(className)}
      />
    );
  },
);
PopoverTrigger.displayName = 'PopoverTrigger';

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: LayerSide;
  align?: LayerAlign;
  sideOffset?: number;
  alignOffset?: number;
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>((props, ref) => {
  const context = usePopoverContext('PopoverContent');
  /* 关闭即卸载（Radix 用 `Presence`；我们无退出动画 → 直接不渲染）。
     hooks 全在下面那个实现组件里；此处只有 `useContext` 与早退，不违反 hooks 规则。 */
  if (!context.open) return null;
  return <PopoverContentImpl {...props} forwardedRef={ref} context={context} />;
});
PopoverContent.displayName = 'PopoverContent';

function PopoverContentImpl({
  className,
  style,
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 4,
  alignOffset = 0,
  forwardedRef,
  context,
  ...props
}: PopoverContentProps & {
  forwardedRef: React.Ref<HTMLDivElement>;
  context: PopoverContextValue;
}) {
  const { setOpen, anchorRef, contentId, restoreFocusRef } = context;

  const {
    contentRef,
    style: positionStyle,
    side: resolvedSide,
  } = useAnchoredPosition({
    open: true,
    anchorRef,
    side,
    align,
    sideOffset,
    alignOffset,
  });

  const handleDismiss = React.useCallback(
    (reason: DismissReason) => {
      if (reason === 'outside-pointer') restoreFocusRef.current = false;
      setOpen(false);
    },
    [restoreFocusRef, setOpen],
  );

  useDismissable({ enabled: true, contentRef, triggerRef: anchorRef, onDismiss: handleDismiss });

  return (
    <LayerPortal>
      <div
        ref={composeRefs<HTMLDivElement>(contentRef, forwardedRef)}
        id={contentId}
        role="dialog"
        data-open="true"
        data-side={resolvedSide}
        style={{ ...positionStyle, ...style }}
        /* `pointer-events-auto`：层根整体 `pointer-events:none`（见 layer-root 头注），
           弹层必须自己收回来，否则整个弹层点不动。 */
        className={cn(
          'bg-background text-foreground pointer-events-auto z-modal-raise w-72 rounded-md border p-4 shadow-[0_0_10px_rgba(0,0,0,0.15)] outline-hidden',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </LayerPortal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
