'use client';

import * as React from 'react';

import { composeRefs } from '../layer/compose-refs';
import { cn } from '@/components/videoEditor/utils/ui';
import { LayerPortal } from '../layer/layer-root';
import {
  useAnchoredPosition,
  type AnchorRect,
  type LayerAlign,
  type LayerSide,
} from '../layer/use-anchored-position';
import { useDismissable, type DismissReason } from '../layer/use-dismissable';
import { Slot } from '../slot';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 菜单内核 —— `dropdown-menu` 与 `context-menu` 的**同一份列表实现**
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【为什么必须有这一层】两者只差**"怎么开"**：
 *   · 下拉菜单：点触发器 → 在触发器下面展开；
 *   · 右键菜单：`contextmenu` → 在**鼠标点**展开。
 * "展开之后"的一切（层根渲染 / 定位 / 键盘遍历 / 高亮 / 关闭与焦点）**完全同构**。
 * 早先两个文件各抄一份 Radix 包装，于是连 `data-[state=open]` 都要改两遍 ——
 * 违反本仓单一规则原则（CLAUDE.md §5.4.9）。这里收口的是**行为**；
 * **外观仍归各自文件**（两套 cva 的密度/圆角不同，那是设计语言差异，不是重复实现）。
 *
 * 【键盘（ARIA menu 规范）】容器持焦点（`role="menu"` + `tabIndex=-1`），
 * 高亮用 `data-highlighted` 表达（**不是**让每个 item 抢焦点 —— 那等于把焦点管理切成 N 份）：
 *   ↑/↓ 移动 · Home/End 首尾 · Enter/Space 激活 · →/← 展开或收起子菜单 · Esc 关整棵。
 *
 * 【关闭与焦点：只对"键盘操作"归还焦点】（踩过的坑，禁止"顺手统一"）
 *   菜单项里若挂**需要用户手势的命令式动作**（`input.click()` 开文件选择器），
 *   "选中 → 同步关层 → 同步把焦点搬回触发器"会**打断浏览器手势栈** ⇒ 文件选择器被静默丢弃
 *   （Radix 时代已踩：`assets/views/media.tsx` 的「导入」因此改为直连，**不要回退**）。
 *   ⇒ 鼠标点选**不搬焦点**；键盘激活 / Escape 才搬（键盘用户没有手势栈问题，且必须能回到触发器）。
 * ══════════════════════════════════════════════════════════════════════════════
 */
export type MenuCloseReason = 'escape' | 'select' | 'outside';

interface MenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  /** 关掉本层**并连带**关掉所有祖先层（子菜单里选中一项 ⇒ 整棵树都该收起）。 */
  closeAll: (reason: MenuCloseReason) => void;
  /** 锚点元素：下拉 = 触发器；右键菜单 = 被右键的元素；子菜单 = 子菜单触发器。 */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** 虚拟锚点（右键坐标）；非空时定位优先用它。 */
  anchorRectRef: React.RefObject<AnchorRect | null>;
  setAnchorRect: (rect: AnchorRect | null) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
  contentId: string;
  /** 最近一次交互是否来自键盘（决定关闭后是否归还焦点，见文件头）。 */
  keyboardRef: React.RefObject<boolean>;
  restoreFocusRef: React.RefObject<boolean>;
  handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  /** 菜单项 hover → 高亮（DOM 节点进、索引内部算）。 */
  highlightElement: (element: HTMLElement | null) => void;
  selectAndClose: () => void;
  /** 本层已展开的子菜单的"关掉我"集合（父层切到别的条目时收起它们）。 */
  submenuClosersRef: React.RefObject<Set<() => void>>;
  closeSubmenus: () => void;
  /** 是否子菜单（决定 ← 是"收自己"还是"什么都不做"）。 */
  isSubmenu: boolean;
}

const MenuContext = React.createContext<MenuContextValue | null>(null);

/**
 * 子菜单**所在那一层**（父层）的上下文。
 *
 * 【为什么需要单独一个 context】子菜单触发器同时活在两层里：自己**是**子层的锚点，
 * 但**作为条目**住在父层的内容里（高亮要登记到父层）。两层用的是同一个 `MenuContext`，
 * 靠 `useContext` 只能拿到最近的那个（子层）⇒ 父层必须被显式再挂一份。
 */
const MenuParentContext = React.createContext<MenuContextValue | null>(null);

function useMenuContextOrNull(): MenuContextValue | null {
  return React.useContext(MenuContext);
}

function useMenuContext(componentName: string): MenuContextValue {
  const context = React.useContext(MenuContext);
  if (context === null) {
    throw new Error(`${componentName} 必须放在菜单根（DropdownMenu / ContextMenu / *Sub）内。`);
  }
  return context;
}

/** 取当前层里可导航的菜单项（跳过禁用项）。子菜单在层根里是**兄弟**，不会被误收进来。 */
function menuItems(root: HTMLElement | null): HTMLElement[] {
  if (root === null) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])'),
  );
}

interface MenuRootProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MenuRoot({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
}: MenuRootProps) {
  const parent = useMenuContextOrNull();
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolled;

  const anchorRef = React.useRef<HTMLElement | null>(null);
  const anchorRectRef = React.useRef<AnchorRect | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const keyboardRef = React.useRef(false);
  const restoreFocusRef = React.useRef(false);
  const submenuClosersRef = React.useRef<Set<() => void>>(new Set());
  const contentId = React.useId();

  const [highlighted, setHighlighted] = React.useState(-1);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const closeAll = React.useCallback(
    (reason: MenuCloseReason) => {
      /* 只有"键盘操作"或 Escape 才归还焦点（理由见文件头）。 */
      restoreFocusRef.current = reason === 'escape' || (reason === 'select' && keyboardRef.current);
      setOpen(false);
      parent?.closeAll(reason);
    },
    [setOpen, parent],
  );

  const previousOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (open === previousOpenRef.current) return;
    previousOpenRef.current = open;

    if (open) {
      keyboardRef.current = false;
      setHighlighted(-1);
      return;
    }
    /* 关闭后归还焦点：光标回到锚点（子菜单回它的触发器，右键菜单回被右键的元素）。
       子菜单先跑本效果、父层随后覆盖 ⇒ 最终落在最外层触发器上，与 Radix 一致。 */
    if (restoreFocusRef.current) anchorRef.current?.focus();
    restoreFocusRef.current = false;
  }, [open]);

  const toggle = React.useCallback(() => {
    if (open) closeAll('outside');
    else setOpen(true);
  }, [open, closeAll, setOpen]);

  /* 高亮落 DOM：`data-highlighted` 是各文件的样式钩子（`data-[highlighted]:…`）。
     命令式写属性而不是把状态透传给每个 item —— item 的嵌套层级由消费方决定，
     要透传索引就得给每个 item 外面再包一层 context，收益为零。 */
  React.useLayoutEffect(() => {
    const items = menuItems(contentRef.current);
    items.forEach((item, index) => {
      if (index === highlighted) item.setAttribute('data-highlighted', '');
      else item.removeAttribute('data-highlighted');
    });
    if (highlighted >= 0) items[highlighted]?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  const moveHighlight = React.useCallback((target: number | 'first' | 'last') => {
    const items = menuItems(contentRef.current);
    if (items.length === 0) return;
    setHighlighted((prev) => {
      if (target === 'first') return 0;
      if (target === 'last') return items.length - 1;
      if (prev < 0) return target > 0 ? 0 : items.length - 1;
      return (prev + target + items.length) % items.length;
    });
  }, []);

  const highlightElement = React.useCallback((element: HTMLElement | null) => {
    if (element === null) {
      setHighlighted(-1);
      return;
    }
    setHighlighted(menuItems(contentRef.current).indexOf(element));
  }, []);

  const closeSubmenus = React.useCallback(() => {
    for (const close of submenuClosersRef.current) close();
  }, []);

  const selectAndClose = React.useCallback(() => closeAll('select'), [closeAll]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      keyboardRef.current = true;
      const items = menuItems(contentRef.current);

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
          if (highlighted >= 0) items[highlighted]?.click();
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          closeAll('escape');
          break;
        case 'ArrowLeft':
          if (parent === null) break;
          event.preventDefault();
          event.stopPropagation();
          restoreFocusRef.current = true;
          setOpen(false);
          break;
        case 'Tab':
          /* Tab 移出菜单 = 用户想走 → 收起，但不抢焦点（焦点按 Tab 的默认行为走）。 */
          closeAll('outside');
          break;
        default:
          break;
      }
    },
    [closeAll, highlighted, moveHighlight, parent, setOpen],
  );

  /* 打开时把焦点收进容器（`role=menu` 的遍历语义要求焦点在菜单里）。 */
  React.useLayoutEffect(() => {
    if (!open) return;
    contentRef.current?.focus({ preventScroll: true });
  }, [open]);

  const contextValue = React.useMemo<MenuContextValue>(
    () => ({
      open,
      setOpen,
      toggle,
      closeAll,
      anchorRef,
      anchorRectRef,
      setAnchorRect: (rect) => {
        anchorRectRef.current = rect;
      },
      contentRef,
      contentId,
      keyboardRef,
      restoreFocusRef,
      handleKeyDown,
      highlightElement,
      selectAndClose,
      submenuClosersRef,
      closeSubmenus,
      isSubmenu: parent !== null,
    }),
    [
      open,
      setOpen,
      toggle,
      closeAll,
      contentId,
      handleKeyDown,
      highlightElement,
      selectAndClose,
      closeSubmenus,
      parent,
    ],
  );

  return <MenuContext.Provider value={contextValue}>{children}</MenuContext.Provider>;
}

interface MenuSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: LayerSide;
  align?: LayerAlign;
  sideOffset?: number;
  alignOffset?: number;
}

/**
 * 菜单内容面（`role="menu"`）—— **只管行为**：层根渲染 + 定位 + 关闭协议 + 键盘入口。
 * 外观（底色、圆角、内边距）由 `dropdown-menu.tsx` / `context-menu.tsx` 传 className。
 */
export const MenuSurface = React.forwardRef<HTMLDivElement, MenuSurfaceProps>((props, ref) => {
  const context = useMenuContextOrNull();
  if (context === null || !context.open) return null;
  return <MenuSurfaceImpl {...props} forwardedRef={ref} context={context} />;
});
MenuSurface.displayName = 'MenuSurface';

function MenuSurfaceImpl({
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
}: MenuSurfaceProps & {
  forwardedRef: React.Ref<HTMLDivElement>;
  context: MenuContextValue;
}) {
  const { contentRef, anchorRef, anchorRectRef, closeAll, handleKeyDown } = context;

  /* ⚠️ 定位 hook 返回的 `contentRef` 必须**真的挂到那个节点上**（与层/键盘共用一个 DOM）。
     漏挂的后果不是报错，而是 `update()` 永远早退 ⇒ 弹层停在 `visibility:hidden`
     ⇒ `getByRole('menu')` 都查不到（"菜单打不开"的假象）。 */
  const {
    contentRef: measureRef,
    style: positionStyle,
    side: resolvedSide,
  } = useAnchoredPosition({
    open: true,
    anchorRef,
    anchorRectRef,
    side,
    align,
    sideOffset,
    alignOffset,
  });

  const handleDismiss = React.useCallback(
    (reason: DismissReason) => closeAll(reason === 'escape' ? 'escape' : 'outside'),
    [closeAll],
  );

  useDismissable({ enabled: true, contentRef, triggerRef: anchorRef, onDismiss: handleDismiss });

  return (
    <LayerPortal>
      <div
        ref={composeRefs<HTMLDivElement>(measureRef, contentRef, forwardedRef)}
        id={context.contentId}
        role="menu"
        tabIndex={-1}
        data-open="true"
        data-side={resolvedSide}
        style={{ ...positionStyle, ...style }}
        onKeyDown={handleKeyDown}
        /* `pointer-events-auto`：层根整体 `pointer-events:none`（见 layer-root 头注），
           菜单必须自己收回来，否则整个菜单点不动。 */
        className={cn('pointer-events-auto', className)}
        {...props}
      >
        {children}
      </div>
    </LayerPortal>
  );
}

interface MenuTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  /** `click` = 下拉菜单；`contextmenu` = 右键菜单（锚点是鼠标点，不是元素）。 */
  mode?: 'click' | 'contextmenu';
}

/** 菜单触发器 —— 两种开法共用一份，差别只在挂哪个事件。 */
export const MenuTrigger = React.forwardRef<HTMLElement, MenuTriggerProps>(
  ({ asChild = false, mode = 'click', onContextMenu, onPointerDown, onKeyDown, ...props }, ref) => {
    const context = useMenuContext('MenuTrigger');
    const { anchorRef, setAnchorRect, setOpen, toggle, open, contentId } = context;

    const anchorComposedRef = React.useMemo(
      () => composeRefs<HTMLElement>(anchorRef, ref),
      [anchorRef, ref],
    );

    const triggerProps =
      mode === 'contextmenu'
        ? {
            'data-open': open ? 'true' : undefined,
            onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
              onContextMenu?.(event);
              if (event.defaultPrevented) return;
              event.preventDefault();
              /* 锚点 = 鼠标点（0×0 矩形），与"元素锚点"同构表达。 */
              setAnchorRect({
                left: event.clientX,
                top: event.clientY,
                right: event.clientX,
                bottom: event.clientY,
                width: 0,
                height: 0,
              });
              setOpen(true);
            },
          }
        : {
            'aria-haspopup': 'menu' as const,
            'aria-expanded': open,
            'aria-controls': open ? contentId : undefined,
            'data-open': open ? 'true' : undefined,
            /* 开合挂在 **pointerdown**（不是 click）：菜单在"按下即展开"是桌面惯例，
               且 disabled 触发器 pointer-events:none 会让 click 也收不到（本仓曾因此
               "菜单打不开"）—— pointerdown 判定更早，问题暴露得更早。
               调用点自己的 `onPointerDown`（如嵌套 Tooltip 的收起）先跑，被它 preventDefault 就不开。 */
            onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
              onPointerDown?.(event);
              /* `button > 0` = 中键/右键：那两种手势不该开这个菜单。 */
              if (event.defaultPrevented || event.button > 0) return;
              toggle();
            },
            onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
              onKeyDown?.(event);
              if (event.defaultPrevented) return;
              /* 键盘用户"按下箭头即展开"（落到第一项由内容面的初始高亮负责）；
                 Enter/Space 由原生 button 转成 pointerdown 之外的默认行为 —— 不走这里。 */
              if (event.key !== 'ArrowDown') return;
              event.preventDefault();
              setOpen(true);
            },
          };

    if (asChild) return <Slot ref={anchorComposedRef} {...triggerProps} {...props} />;

    return (
      <button
        ref={anchorComposedRef as React.Ref<HTMLButtonElement>}
        type="button"
        {...triggerProps}
        {...props}
      />
    );
  },
);
MenuTrigger.displayName = 'MenuTrigger';

interface MenuItemBaseProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  disabled?: boolean;
  role?: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';
  checked?: boolean;
  /** `true` = 选中后**不**关菜单（复选框/单选项的默认语义：连着调几项）。 */
  keepOpen?: boolean;
}

/**
 * 菜单项的**行为**（外观仍由消费方 className 决定）：hover → 高亮；激活 → 关菜单。
 *
 * 禁用用 `aria-disabled` 而**不用 `disabled` 属性**：菜单项必须始终可被遍历，
 * `disabled` 会让它从无障碍树里消失 —— 菜单"少一项"对读屏是信息丢失。
 */
export const MenuItemBase = React.forwardRef<HTMLElement, MenuItemBaseProps>(
  (
    {
      asChild = false,
      disabled = false,
      role = 'menuitem',
      checked,
      keepOpen = false,
      onClick,
      onPointerEnter,
      ...props
    },
    ref,
  ) => {
    const context = useMenuContext('MenuItemBase');
    const elementRef = React.useRef<HTMLElement | null>(null);
    const composedRef = React.useMemo(() => composeRefs<HTMLElement>(elementRef, ref), [ref]);

    const itemProps = {
      role,
      'aria-disabled': disabled || undefined,
      'aria-checked': checked,
      'data-disabled': disabled ? '' : undefined,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        onClick?.(event);
        if (disabled || event.defaultPrevented) return;
        if (!keepOpen) context.selectAndClose();
      },
      onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
        onPointerEnter?.(event);
        if (disabled) return;
        context.highlightElement(event.currentTarget);
        /* 移到别的条目上 ⇒ 已展开的子菜单收起（否则两个面板同时挂着）。 */
        context.closeSubmenus();
      },
    };

    if (asChild) return <Slot ref={composedRef} {...itemProps} {...props} />;
    return <div ref={composedRef} {...itemProps} {...props} />;
  },
);
MenuItemBase.displayName = 'MenuItemBase';

interface MenuSubTriggerBaseProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean;
  disabled?: boolean;
}

/** 子菜单触发器：hover / → 展开，← 收起（Esc 由整棵树处理）。它自己就是子层的锚点。 */
export const MenuSubTriggerBase = React.forwardRef<HTMLElement, MenuSubTriggerBaseProps>(
  ({ asChild = false, disabled = false, onClick, onPointerEnter, onKeyDown, ...props }, ref) => {
    const context = useMenuContext('MenuSubTriggerBase');
    /* 作为**条目**，它住在父层的内容里（高亮要登记给父层）；作为**锚点**，它属于子层。 */
    const parentMenu = React.useContext(MenuParentContext);
    const elementRef = React.useRef<HTMLElement | null>(null);
    const composedRef = React.useMemo(
      () => composeRefs<HTMLElement>(elementRef, context.anchorRef, ref),
      [context.anchorRef, ref],
    );

    const itemProps = {
      role: 'menuitem',
      'aria-haspopup': 'menu' as const,
      'aria-expanded': context.open,
      'aria-disabled': disabled || undefined,
      'data-open': context.open ? 'true' : undefined,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        onClick?.(event);
        if (disabled || event.defaultPrevented) return;
        context.setOpen(!context.open);
      },
      onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
        onPointerEnter?.(event);
        if (disabled) return;
        parentMenu?.highlightElement(event.currentTarget);
        context.setOpen(true);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        onKeyDown?.(event);
        if (disabled || event.defaultPrevented) return;
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          event.stopPropagation();
          context.setOpen(true);
        } else if (event.key === 'ArrowLeft' && context.open) {
          event.preventDefault();
          event.stopPropagation();
          context.setOpen(false);
        }
      },
    };

    if (asChild) return <Slot ref={composedRef} {...itemProps} {...props} />;
    return <div ref={composedRef} {...itemProps} {...props} />;
  },
);
MenuSubTriggerBase.displayName = 'MenuSubTriggerBase';

/**
 * 子菜单 —— 一个**独立的 `MenuRoot`**（锚点是它的触发器，见 `MenuSubTriggerBase`）。
 * 另外接管两件事：
 *   · 把自己登记进**父层**的 `submenuClosersRef` ⇒ 父层切到别的条目时子菜单收起；
 *   · 父层关闭 ⇒ 子菜单跟着关（父层内容卸载会带走整棵子树，这里兜住"父层还开着但要求收子菜单"）。
 */
export function MenuSub({ children }: { children?: React.ReactNode }) {
  const parent = useMenuContextOrNull();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const closers = parent?.submenuClosersRef.current;
    if (closers === undefined) return undefined;
    const closer = () => setOpen(false);
    closers.add(closer);
    return () => {
      closers.delete(closer);
    };
  }, [parent]);

  React.useEffect(() => {
    if (parent !== null && !parent.open) setOpen(false);
  }, [parent]);

  return (
    <MenuParentContext.Provider value={parent}>
      <MenuRoot open={open} onOpenChange={setOpen}>
        {children}
      </MenuRoot>
    </MenuParentContext.Provider>
  );
}
