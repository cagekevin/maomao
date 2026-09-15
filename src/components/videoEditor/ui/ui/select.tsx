'use client';

import * as React from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@videoEditor/utils/ui';
import { composeRefs } from './layer/compose-refs';
import { LayerPortal } from './layer/layer-root';
import {
  useAnchoredPosition,
  type LayerAlign,
  type LayerSide,
} from './layer/use-anchored-position';
import { useDismissable } from './layer/use-dismissable';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 下拉选择 —— **自研**（原 `radix-ui` 的 `Select.*`）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【两条错配必须先说清（原实现的注释里已记，别改回去）】
 *   ① **触发器高度不是内容高度**：原 `SelectContent` 里写过 `h-(--radix-select-trigger-height)`
 *      —— 它把列表视口锁成触发器高（32px），9 个选项只露出一条缝，看起来"根本点不开/选不了"
 *      （用户 2026-09-15："字体不能选择"）。这里只约束**最小宽度**（跟触发器同宽），
 *      高度由内容撑开、再被 `max-h-96` 封顶后出滚动条。
 *   ② **本组件是弹层（飞出去），不是面板流内展开**：面板里的 4 项列表该用 `FontPicker`
 *      （原位展开）。两者判据不同不是不一致 —— 见 `font-picker.tsx` 头注。
 *
 * 【键盘（ARIA combobox + listbox）】触发器：↓/↑/Enter/Space 展开；
 * 列表：↑/↓ 移动高亮、Home/End 首尾、Enter/Space 选中、Esc 取消、Tab 收起。
 * 高亮与菜单同口径：**焦点留在列表容器**，高亮用 `data-highlighted` 表达
 * （`ve-theme.css` §6 的 `[role='option'][data-highlighted]` 就是它的样式落点）。
 * ══════════════════════════════════════════════════════════════════════════════
 */
interface SelectContextValue {
  value?: string;
  setValue: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  contentId: string;
  /** 选项文本登记表（`SelectValue` 靠它把"值"显示成"文本"，关着的时候也要能显示）。 */
  itemLabelsRef: React.RefObject<Map<string, () => React.ReactNode>>;
  /** 登记表变化的单调计数（ref 变化不触发渲染，用它抖一下）。 */
  itemsVersion: number;
  bumpItems: () => void;
  canScrollUp: boolean;
  canScrollDown: boolean;
  setScrollable: (up: boolean, down: boolean) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  highlightElement: (element: HTMLElement | null) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(componentName: string): SelectContextValue {
  const context = React.useContext(SelectContext);
  if (context === null) throw new Error(`${componentName} 必须放在 <Select> 内使用。`);
  return context;
}

function optionNodes(root: HTMLElement | null): HTMLElement[] {
  if (root === null) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])'),
  );
}

interface SelectProps {
  children?: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function Select({
  children,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | undefined>(
    defaultValue,
  );
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const [itemsVersion, setItemsVersion] = React.useState(0);
  const [scrollable, setScrollableState] = React.useState({ up: false, down: false });
  const [highlighted, setHighlighted] = React.useState(-1);

  const isValueControlled = valueProp !== undefined;
  const value = isValueControlled ? valueProp : uncontrolledValue;
  const isOpenControlled = openProp !== undefined;
  const open = isOpenControlled ? openProp : uncontrolledOpen;

  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const itemLabelsRef = React.useRef<Map<string, () => React.ReactNode>>(new Map());
  const contentId = React.useId();

  const setValue = React.useCallback(
    (next: string) => {
      if (!isValueControlled) setUncontrolledValue(next);
      onValueChange?.(next);
    },
    [isValueControlled, onValueChange],
  );

  const bumpItems = React.useCallback(() => setItemsVersion((prev) => prev + 1), []);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isOpenControlled, onOpenChange],
  );

  const setScrollable = React.useCallback((up: boolean, down: boolean) => {
    setScrollableState((prev) => (prev.up === up && prev.down === down ? prev : { up, down }));
  }, []);

  /* 高亮落 DOM（与菜单同一口径）：`data-highlighted` 是样式钩子。 */
  React.useLayoutEffect(() => {
    const options = optionNodes(contentRef.current);
    options.forEach((option, index) => {
      if (index === highlighted) option.setAttribute('data-highlighted', '');
      else option.removeAttribute('data-highlighted');
    });
    if (highlighted >= 0) options[highlighted]?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  /* 打开时把高亮落到"当前值"上（Radix 同口径：展开即定位到已选项，而不是从头开始翻）。 */
  React.useLayoutEffect(() => {
    if (!open) {
      setHighlighted(-1);
      return;
    }
    contentRef.current?.focus({ preventScroll: true });
    const options = optionNodes(contentRef.current);
    const currentIndex = options.findIndex((option) => option.dataset.value === value);
    setHighlighted(currentIndex >= 0 ? currentIndex : 0);
  }, [open, value, itemsVersion]);

  const moveHighlight = React.useCallback((target: number | 'first' | 'last') => {
    const options = optionNodes(contentRef.current);
    if (options.length === 0) return;
    setHighlighted((prev) => {
      if (target === 'first') return 0;
      if (target === 'last') return options.length - 1;
      if (prev < 0) return target > 0 ? 0 : options.length - 1;
      return (prev + target + options.length) % options.length;
    });
  }, []);

  /** 关闭并把焦点还给触发器 —— 下拉的语义就是"选完回到原处"（与菜单不同：菜单有手势栈顾虑）。 */
  const closeAndReturnFocus = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [setOpen]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const options = optionNodes(contentRef.current);
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          moveHighlight(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          moveHighlight(-1);
          break;
        case 'Home':
          event.preventDefault();
          moveHighlight('first');
          break;
        case 'End':
          event.preventDefault();
          moveHighlight('last');
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (highlighted >= 0) options[highlighted]?.click();
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          closeAndReturnFocus();
          break;
        case 'Tab':
          closeAndReturnFocus();
          break;
        default:
          break;
      }
    },
    [closeAndReturnFocus, highlighted, moveHighlight],
  );

  const highlightElement = React.useCallback((element: HTMLElement | null) => {
    if (element === null) {
      setHighlighted(-1);
      return;
    }
    setHighlighted(optionNodes(contentRef.current).indexOf(element));
  }, []);

  const contextValue = React.useMemo<SelectContextValue>(
    () => ({
      value,
      setValue,
      open,
      setOpen,
      disabled,
      triggerRef,
      contentRef,
      contentId,
      itemLabelsRef,
      itemsVersion,
      bumpItems,
      canScrollUp: scrollable.up,
      canScrollDown: scrollable.down,
      setScrollable,
      handleKeyDown,
      highlightElement,
    }),
    [
      value,
      setValue,
      open,
      setOpen,
      disabled,
      contentId,
      itemsVersion,
      bumpItems,
      scrollable,
      setScrollable,
      handleKeyDown,
      highlightElement,
    ],
  );

  return <SelectContext.Provider value={contextValue}>{children}</SelectContext.Provider>;
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, onClick, onKeyDown, ...props }, ref) => {
  const context = useSelectContext('SelectTrigger');
  const { open, setOpen, disabled, triggerRef, contentId } = context;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    setOpen(!open);
  };

  return (
    <button
      ref={composeRefs<HTMLButtonElement>(triggerRef, ref)}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      disabled={disabled}
      data-open={open ? 'true' : undefined}
      onClick={handleClick}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || disabled) return;
        if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        setOpen(true);
      }}
      className={cn(
        'bg-accent ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex h-8 w-auto cursor-pointer items-center justify-between gap-1 rounded-md px-3 py-2 text-sm whitespace-nowrap focus:ring-1 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
        'focus:border-primary focus:ring-4 focus:ring-primary/10 border-transparent transition-none',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="size-3 opacity-50" />
    </button>
  );
});
SelectTrigger.displayName = 'SelectTrigger';

interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

/** 当前值 → 显示文本（关着的时候也要显示 ⇒ 靠选项登记表，不靠已渲染的 DOM）。 */
const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ placeholder, className }, ref) => {
    const context = useSelectContext('SelectValue');
    /* `itemsVersion` 参与渲染（下面的 `void` 即"读到它"）：登记表是 ref，
       选项挂载后必须重渲一次才拿得到文本 —— 少了这句，"值已选好但显示占位符"。 */
    void context.itemsVersion;
    const getLabel =
      context.value === undefined ? undefined : context.itemLabelsRef.current.get(context.value);

    return (
      <span ref={ref} className={cn('truncate', className)}>
        {getLabel?.() ?? <span className="text-muted-foreground">{placeholder}</span>}
      </span>
    );
  },
);
SelectValue.displayName = 'SelectValue';

const selectItemVariants = cva(
  'relative flex cursor-pointer select-none items-center gap-2 text-sm text-foreground/85 outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0',
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

const SelectScrollUpButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const context = useSelectContext('SelectScrollUpButton');
  if (!context.canScrollUp) return null;
  return (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      aria-label="向上滚动"
      className={cn('flex w-full cursor-default items-center justify-center py-1', className)}
      onClick={() => context.contentRef.current?.scrollBy({ top: -160 })}
      {...props}
    >
      <ChevronUp className="size-4" />
    </button>
  );
});
SelectScrollUpButton.displayName = 'SelectScrollUpButton';

const SelectScrollDownButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const context = useSelectContext('SelectScrollDownButton');
  if (!context.canScrollDown) return null;
  return (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      aria-label="向下滚动"
      className={cn('flex w-full cursor-default items-center justify-center py-1', className)}
      onClick={() => context.contentRef.current?.scrollBy({ top: 160 })}
      {...props}
    >
      <ChevronDown className="size-4" />
    </button>
  );
});
SelectScrollDownButton.displayName = 'SelectScrollDownButton';

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: LayerSide;
  align?: LayerAlign;
  sideOffset?: number;
  alignOffset?: number;
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>((props, ref) => {
  const context = useSelectContext('SelectContent');

  /* 关闭时**不渲染列表**，但要留一份 `hidden` 的选项副本 —— 只为"值 → 文本"登记。
     为什么不能索性不渲染：`<SelectValue placeholder>` 在没有子节点时要显示**当前值的文本**，
     而文本只有选项知道；选项不挂载 ⇒ 只能显示占位符 ⇒ "选了但显示没选"（本仓级功能回归）。
     原 Radix 用 `SelectContentFragment`（把子节点 Portal 进触发器里的 value node）解决同一问题，
     这里用更直白的形式：`hidden`（= `display:none`）⇒ 零布局、不进无障碍树，
     于是"关闭时查不到 listbox / option"的语义仍然成立（下面的行为锁就断言这一点）。 */
  if (!context.open) return <div hidden>{props.children}</div>;
  return <SelectContentImpl {...props} forwardedRef={ref} context={context} />;
});
SelectContent.displayName = 'SelectContent';

function SelectContentImpl({
  className,
  style,
  children,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  alignOffset = 0,
  forwardedRef,
  context,
  ...props
}: SelectContentProps & {
  forwardedRef: React.Ref<HTMLDivElement>;
  context: SelectContextValue;
}) {
  const { contentRef, triggerRef, setOpen, setScrollable, handleKeyDown } = context;

  /* ⚠️ 定位 hook 返回的 `contentRef` 必须真的挂到那个节点上（见 menu.tsx 同处注释：
     漏挂 ⇒ `update()` 永远早退 ⇒ 弹层停在 `visibility:hidden` ⇒ "下拉打不开"的假象）。 */
  const {
    contentRef: measureRef,
    style: positionStyle,
    side: resolvedSide,
    anchorWidth,
  } = useAnchoredPosition({
    open: true,
    anchorRef: triggerRef,
    side,
    align,
    sideOffset,
    alignOffset,
  });

  const handleDismiss = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [setOpen, triggerRef]);

  useDismissable({
    enabled: true,
    contentRef,
    triggerRef,
    onDismiss: handleDismiss,
  });

  /* 上下滚动提示：只有真的滚得动时才渲染那两个箭头（否则会凭空多出两条，视觉回归）。 */
  React.useEffect(() => {
    const node = contentRef.current;
    if (node === null) return undefined;
    const updateScrollable = () => {
      const canUp = node.scrollTop > 0;
      const canDown = node.scrollTop + node.clientHeight < node.scrollHeight - 1;
      setScrollable(canUp, canDown);
    };
    updateScrollable();
    node.addEventListener('scroll', updateScrollable);
    const observer = new ResizeObserver(updateScrollable);
    observer.observe(node);
    return () => {
      node.removeEventListener('scroll', updateScrollable);
      observer.disconnect();
    };
  }, [contentRef, setScrollable]);

  return (
    <LayerPortal>
      <div
        ref={composeRefs<HTMLDivElement>(measureRef, contentRef, forwardedRef)}
        id={context.contentId}
        role="listbox"
        tabIndex={-1}
        data-open="true"
        data-side={resolvedSide}
        style={{
          ...positionStyle,
          /* 至少与触发器同宽（原 `min-w-(--radix-select-trigger-width)` 的等价物）：
             短选项不该把弹层缩得比触发器还窄。高度一律不要在这里出现（见文件头 ①）。 */
          minWidth: anchorWidth || undefined,
          ...style,
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          've-select-content pointer-events-auto bg-background text-foreground z-modal-raise max-h-96 min-w-32 overflow-y-auto rounded-2xl border p-2 shadow-lg',
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        {children}
        <SelectScrollDownButton />
      </div>
    </LayerPortal>
  );
}

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-3 pt-1 pb-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase',
        className,
      )}
      {...props}
    />
  ),
);
SelectLabel.displayName = 'SelectLabel';

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
  variant?: VariantProps<typeof selectItemVariants>['variant'];
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  (
    {
      className,
      children,
      value,
      disabled = false,
      variant = 'default',
      onClick,
      onPointerEnter,
      ...props
    },
    ref,
  ) => {
    const context = useSelectContext('SelectItem');
    const { itemLabelsRef, bumpItems, setValue, setOpen, triggerRef, highlightElement } = context;
    const isSelected = context.value !== undefined && context.value === value;

    /* 文本登记：`SelectValue` 在**关闭**状态下也要显示当前值，所以选项得把"值 → 文本"报上去。
       ⚠️ `children` 每次渲染都是新元素，绝不能进 effect 依赖 —— 否则渲染→登记→渲染的死循环。
       故用 ref 存最新值，只按 `value` 登记 / 注销。 */
    const labelRef = React.useRef(children);
    labelRef.current = children;
    React.useEffect(() => {
      /* 表在 effect 内取一次交给闭包（清理函数里再读 `ref.current` 可能在卸载后被换掉）。 */
      const labels = itemLabelsRef.current;
      labels.set(value, () => labelRef.current);
      bumpItems();
      return () => {
        labels.delete(value);
        bumpItems();
      };
    }, [value, itemLabelsRef, bumpItems]);

    return (
      <div
        ref={ref}
        role="option"
        data-value={value}
        aria-selected={isSelected}
        aria-disabled={disabled || undefined}
        data-disabled={disabled ? '' : undefined}
        onClick={(event) => {
          onClick?.(event);
          if (disabled || event.defaultPrevented) return;
          setValue(value);
          setOpen(false);
          triggerRef.current?.focus();
        }}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          if (disabled) return;
          highlightElement(event.currentTarget);
        }}
        className={cn(selectItemVariants({ variant }), 'pr-8 pl-2', className)}
        {...props}
      >
        <span className="absolute right-2 flex size-3.5 items-center justify-center">
          {isSelected && <Check className="size-4" />}
        </span>
        {children}
      </div>
    );
  },
);
SelectItem.displayName = 'SelectItem';

const SelectSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      aria-orientation="horizontal"
      className={cn('bg-border mx-1 my-2 h-px', className)}
      {...props}
    />
  ),
);
SelectSeparator.displayName = 'SelectSeparator';

export {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
