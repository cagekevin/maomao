/**
 * AI 助手表格 —— 预览卡高度拖拽 hook（spec 3.2，同 useColumnResize 性能范式：拖拽中直改 DOM 不重渲）。
 *
 * clamp：min 120px，max = min(面板高 - 160px, 面板高 × 70%)（保证上方正式表格至少留 160px 可视区）。
 * 松手 setPreviewHeight 一次（运行态、不落盘）；返回 onGripPointerDown 供 grip 行。
 * 无 React state：全部走 ref + 直接改 grip 所在卡片 DOM 高度，只在松手时回调一次。
 */
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { setPreviewHeight } from './tableWorkspaceState.ts';

const PREVIEW_MIN = 120;
/** 上方正式表格须保留的最小可视高度（px） */
const TABLE_MIN_KEEP = 160;

export function usePreviewResize() {
  const cardRef = useRef<HTMLElement | null>(null);
  const resizingRef = useRef<{ startY: number; startH: number; panelH: number } | null>(null);

  const onMove = useCallback((e: PointerEvent) => {
    const r = resizingRef.current;
    if (!r) return;
    const h = Math.max(
      PREVIEW_MIN,
      Math.min(
        Math.min(r.panelH - TABLE_MIN_KEEP, Math.round(r.panelH * 0.7)),
        r.startH + (e.clientY - r.startY),
      ),
    );
    if (cardRef.current) cardRef.current.style.height = `${h}px`;
  }, []);

  const onUp = useCallback(() => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.style.userSelect = '';
    const el = cardRef.current;
    const h = el ? el.getBoundingClientRect().height : 0;
    if (Number.isFinite(h)) setPreviewHeight(Math.round(h));
    resizingRef.current = null;
  }, [onMove]);

  const onGripPointerDown = useCallback(
    (e: ReactPointerEvent, card: HTMLElement | null) => {
      e.preventDefault();
      e.stopPropagation();
      cardRef.current = card;
      const panelH = card ? (card.closest('.atw')?.getBoundingClientRect().height ?? 0) : 0;
      resizingRef.current = {
        startY: e.clientY,
        startH: card ? card.getBoundingClientRect().height : PREVIEW_MIN,
        panelH,
      };
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onMove, onUp],
  );

  return { onGripPointerDown };
}
