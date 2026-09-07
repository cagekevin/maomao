/**
 * AI 助手表格 —— tab 拖拽排序 hook（spec 3.1：pointer 手写，禁 HTML5 DnD）。
 *
 * 设计（对齐 spec §3.1「tab 拖拽排序」）：
 *  - pointerdown 起手，位移 >4px 才进入拖拽态，否则交还原生 click（点 tab = 切表）。
 *  - 拖拽中 **DOM 顺序不变**：只给被拖 tab 加 `transform:translateX` 跟随，并在落点 tab 上画
 *    一条 2px 插入指示线（`.is-drop-before` / `.is-drop-after`）；全程命令式改 DOM、零重渲，
 *    松手才 `onCommit(fromIndex, toIndex)` 一次性落盘（`moveTab`）。
 *  - pointercancel / Esc → 取消回原位（不删除、不移动）。
 *
 * ⚠️ 反直觉（2026-09-07 修）：**绝不能调 `setPointerCapture`**。
 *   指针捕获会把随后的 mouseup / **click 一并重定向到捕获元素**（这里是 `.atw-tab` 外层 div），
 *   于是 tab 内的「切表」click 与「⋯ / ×」按钮全部收不到事件 —— 表现就是「点了没反应」。
 *   故改为在 window 上挂监听；代价是需要 `consumeDrag()` 吞掉拖拽尾随的那次 click
 *   （否则松手时 mousedown/mouseup 同在 tab 上，浏览器仍会补一个 click 顺手切表）。
 *
 * ⚠️ 反直觉（2026-09-07 修）：拖拽中**不重排 DOM**，只画落点线。
 *   若拖拽中按视觉顺序重渲整条，`listEl.children` 的序号就不再是数据序号，
 *   命中判定会混用两套 index 算错落点；DOM 不动则两者恒等，`rects` 起手采一次即可。
 */
import { useRef, useState } from 'react';

const MOVE_THRESHOLD = 4; // px：位移 ≤4 判点击

export interface UseTabDragSortResult {
  /** 被拖 tab id（无拖拽 = null）。只在「进入 / 结束拖拽」两个时刻变化，不随移动而变 */
  draggingId: string | null;
  onPointerDown: (e: React.PointerEvent, tabId: string, index: number, el: HTMLElement) => void;
  /** 刚刚结束一次真实拖拽 → 紧随其后的 click 应被吞掉（防「拖完顺手切了表」） */
  consumeDrag: () => boolean;
}

export function useTabDragSort(
  total: number,
  onCommit: (from: number, to: number) => void,
): UseTabDragSortResult {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggedRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent, tabId: string, index: number, el: HTMLElement) => {
    if (e.button !== 0) return;
    const listEl = el.parentElement;
    if (!listEl) return;
    draggedRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    let to = index;
    let rects: Array<{ left: number; right: number }> = [];

    /** 落点指示：清掉旧线 + 在目标 tab 的靠拢侧画一条 2px 竖线 */
    const paintDropMark = () => {
      for (const c of Array.from(listEl.children)) {
        c.classList.remove('is-drop-before', 'is-drop-after');
      }
      if (to === index) return;
      const target = listEl.children[to];
      if (target) target.classList.add(to > index ? 'is-drop-after' : 'is-drop-before');
    };
    const clearDropMark = () => {
      for (const c of Array.from(listEl.children)) {
        c.classList.remove('is-drop-before', 'is-drop-after');
      }
    };
    /** 命中判定：DOM 序号 == 数据序号（拖拽中不重排），越界 clamp 到最后一个 tab */
    const detectTo = (clientX: number): number => {
      for (let i = 0; i < rects.length; i++) {
        if (clientX >= rects[i].left && clientX <= rects[i].right) return Math.min(total - 1, i);
      }
      return to;
    };

    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      clearDropMark();
      el.classList.remove('is-dragging');
      el.style.transform = '';
      // to = 松手时命中的 tab 的数据 index；moveTab 先 splice 出 from 再插到 to，语义正好对上
      if (commit && started && to !== index) onCommit(index, to);
      setDraggingId(null);
    };
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!started) {
        if (Math.abs(dx) + Math.abs(dy) <= MOVE_THRESHOLD) return;
        started = true;
        draggedRef.current = true;
        // DOM 顺序固定 → 起手采一次 rect 即可，不必每帧 getBoundingClientRect
        rects = Array.from(listEl.children).map((c) => c.getBoundingClientRect());
        setDraggingId(tabId);
        el.classList.add('is-dragging');
      }
      ev.preventDefault();
      el.style.transform = `translateX(${dx}px)`;
      to = detectTo(ev.clientX);
      paintDropMark();
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') finish(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
  };

  return { draggingId, onPointerDown, consumeDrag: () => draggedRef.current };
}
