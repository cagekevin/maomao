'use client';

import * as React from 'react';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * 锚定定位 —— 触发元素 rect → 弹层 fixed 坐标（含视口碰撞翻转与夹取）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【为什么自研而不用 floating-ui】本仓已有裁定：弹层不许换一个黑盒（docs/135 §三.6）。
 * 弹层定位的**真实需求**只有三条：① 贴哪个边（side）② 交叉轴对齐（align）③ 出界就翻。
 * 三条都是 rect 算术，没有"需要调参的物理模型"—— 引入 floating-ui 换来的是
 * 又一份不能改的内部实现 + 一份新的依赖面。
 *
 * 【为什么必须 fixed 而不是 absolute】弹层渲染在层根（`position:fixed; inset:0`）里，
 * 若用 absolute，坐标参照就变成层根而不是视口 —— 层根恰好铺满视口且不滚动，两者等价；
 * 但一旦宿主给层根加任何 transform/padding，absolute 的参照立刻漂移。
 * 取 `fixed` + 视口坐标 = **坐标系恒定为 viewport**，与层根样式解耦。
 *
 * 【什么时候重算】① 打开时；② `resize`（窗口）；③ `scroll`（捕获阶段 —— 任意滚动祖先都要跟上）；
 * ④ 任意 `pointerup`（面板拖动改宽/改高后**松手即归位**：`react-resizable-panels` 拖动
 *    不会触发 `resize` 事件，若不监听松手，弹层会停在拖动前的旧位置 —— 这是"定位错位"风险的真实来源）。
 *
 * 【首帧怎么不闪】未测量前返回 `visibility: hidden`（元素仍参与布局，能测到尺寸），
 * 测完立刻换成真实坐标。于是永远不会出现"先在左上角画一下再跳过去"。
 */
export type LayerSide = 'top' | 'right' | 'bottom' | 'left';
export type LayerAlign = 'start' | 'center' | 'end';

/** 锚点矩形 —— 与 `DOMRect` 同形状（只需这 6 个数），便于传"虚拟锚点"（如右键坐标）。 */
export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface AnchoredPositionOptions {
  /** 是否正在展开（关闭时不测量、清空结果）。 */
  open: boolean;
  /**
   * 锚点元素的 **ref**（不是元素本身）。
   *
   * 【为什么必须是 ref】`anchorRef.current` 在触发器挂载后才被赋值，而"弹层首次渲染"
   * 与"触发器挂载"的先后是不确定的（`defaultOpen` 时弹层先渲染）。传元素本身 ⇒ 首帧拿到
   * `null` ⇒ 测量回调的依赖里锁死一个 `null` 且永不更新 ⇒ 弹层**永远停在 `visibility:hidden`**。
   * 传 ref ⇒ 每次测量现取，挂载顺序无关。
   */
  anchorRef: React.RefObject<HTMLElement | null>;
  /**
   * 虚拟锚点矩形（可选）：非空时**优先于** `anchorRef`。
   * 右键菜单要的锚点是"鼠标点"而不是"某个元素"——造一个 0×0 的矩形即可同构表达。
   */
  anchorRectRef?: React.RefObject<AnchorRect | null>;
  side?: LayerSide;
  align?: LayerAlign;
  sideOffset?: number;
  alignOffset?: number;
}

interface AnchoredPositionState {
  top: number;
  left: number;
  /** 实际使用的边（发生翻转时与传入的 `side` 不同）。 */
  side: LayerSide;
  /** 锚点宽度 —— 弹层要"至少与触发器同宽"时（下拉）用它。 */
  anchorWidth: number;
}

/** 与视口至少留这么多边距（贴边即"看起来被切掉"，比留白更糟）。 */
const VIEWPORT_MARGIN = 8;

export function useAnchoredPosition({
  open,
  anchorRef,
  anchorRectRef,
  side = 'bottom',
  align = 'center',
  sideOffset = 0,
  alignOffset = 0,
}: AnchoredPositionOptions) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [state, setState] = React.useState<AnchoredPositionState | null>(null);

  const update = React.useCallback(() => {
    const content = contentRef.current;
    if (content === null) return;

    const virtualRect = anchorRectRef?.current ?? null;
    const anchor = virtualRect === null ? anchorRef.current : null;
    if (virtualRect === null && anchor === null) return;

    const a: AnchorRect = virtualRect ?? anchor!.getBoundingClientRect();
    const c = content.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ① 主轴：请求的边放不下、且对侧放得下 → 翻转（对侧也放不下就保持请求边，交给夹取）
    let resolved: LayerSide = side;
    if (
      side === 'bottom' &&
      a.bottom + sideOffset + c.height > vh &&
      a.top - sideOffset - c.height > 0
    ) {
      resolved = 'top';
    } else if (
      side === 'top' &&
      a.top - sideOffset - c.height < 0 &&
      a.bottom + sideOffset + c.height <= vh
    ) {
      resolved = 'bottom';
    } else if (
      side === 'right' &&
      a.right + sideOffset + c.width > vw &&
      a.left - sideOffset - c.width > 0
    ) {
      resolved = 'left';
    } else if (
      side === 'left' &&
      a.left - sideOffset - c.width < 0 &&
      a.right + sideOffset + c.width <= vw
    ) {
      resolved = 'right';
    }

    // ② 主轴坐标
    let top = 0;
    let left = 0;
    if (resolved === 'bottom') top = a.bottom + sideOffset;
    else if (resolved === 'top') top = a.top - sideOffset - c.height;
    else if (resolved === 'right') left = a.right + sideOffset;
    else left = a.left - sideOffset - c.width;

    // ③ 交叉轴对齐
    if (resolved === 'top' || resolved === 'bottom') {
      if (align === 'start') left = a.left + alignOffset;
      else if (align === 'end') left = a.right - c.width + alignOffset;
      else left = a.left + a.width / 2 - c.width / 2 + alignOffset;
    } else {
      if (align === 'start') top = a.top + alignOffset;
      else if (align === 'end') top = a.bottom - c.height + alignOffset;
      else top = a.top + a.height / 2 - c.height / 2 + alignOffset;
    }

    // ④ 视口夹取：宁可偏移，也不让弹层被视口吃掉一角
    left = Math.min(
      Math.max(VIEWPORT_MARGIN, left),
      Math.max(VIEWPORT_MARGIN, vw - c.width - VIEWPORT_MARGIN),
    );
    top = Math.min(
      Math.max(VIEWPORT_MARGIN, top),
      Math.max(VIEWPORT_MARGIN, vh - c.height - VIEWPORT_MARGIN),
    );

    setState((prev) =>
      prev !== null &&
      prev.top === top &&
      prev.left === left &&
      prev.side === resolved &&
      prev.anchorWidth === a.width
        ? prev
        : { top, left, side: resolved, anchorWidth: a.width },
    );
  }, [anchorRef, anchorRectRef, side, align, sideOffset, alignOffset]);

  React.useLayoutEffect(() => {
    if (!open) {
      setState(null);
      return undefined;
    }

    update();

    const handle = () => update();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    window.addEventListener('pointerup', handle);

    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('pointerup', handle);
    };
  }, [open, update]);

  const style: React.CSSProperties =
    state === null
      ? { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }
      : { position: 'fixed', top: state.top, left: state.left };

  return {
    contentRef,
    style,
    side: state?.side ?? side,
    anchorWidth: state?.anchorWidth ?? 0,
    measured: state !== null,
  };
}
