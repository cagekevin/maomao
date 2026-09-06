/**
 * AI 助手表格 —— 列宽策略 + 拖拽 hook（从 AssistantTablePanel 剥离的顺序逻辑，可单测）。
 *
 * 背景（保留原性能设计，勿改语义）：
 *  - 估算宽只在「列结构 id 集合变化」时算一次（建表/增删列），编辑内容不重算 → 不抖动不重渲；
 *  - 用户拖拽中**只直接改 <col> DOM + 更新 ref，不 setState → 整表不重渲**，松手才 commit 一次
 *    （setColumnWidth 写回 + resizeTick 驱动单元格 textarea 按新列宽重算行高）。
 *  - 手动锁定宽（col.width）优先于估算，clamp 在 60~600。
 *
 * 返回 colElsRef（TableGrid 用它挂 <col> ref）与 resizeTick（供 CellEditor 高度重算）。
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { estimateColumnWidth, setColumnWidth } from './assistantTable.ts';
import type { AssistantTable } from './assistantTable.ts';

const COL_W_MIN = 60;
const COL_W_MAX = 600;

export function useColumnResize(sb: AssistantTable, commit: (sb: AssistantTable) => void) {
  /** 列宽拖拽完成信号：自增后驱动每个单元格 textarea 重算高度（列宽变化 → 换行宽度变 → 行高要跟着变） */
  const [resizeTick, setResizeTick] = useState(0);
  const colWidthMapRef = useRef<Record<string, number>>({});
  const colSigRef = useRef<string>('');
  const colElsRef = useRef<Array<HTMLTableColElement | null>>([]);
  const resizingRef = useRef<{
    colId: string;
    ci: number;
    startX: number;
    startW: number;
    handleEl: HTMLElement;
  } | null>(null);
  const sbRef = useRef(sb);
  sbRef.current = sb;

  const colSig = sb.columns.map((c) => c.id).join('|');
  const colWidths = useMemo(() => {
    if (colSigRef.current !== colSig) {
      const next: Record<string, number> = {};
      for (const col of sb.columns) {
        if (col.width != null && Number.isFinite(col.width)) {
          // 已手动锁定 → 用锁定值（clamp 合法范围）
          next[col.id] = Math.max(COL_W_MIN, Math.min(COL_W_MAX, col.width));
        } else if (colWidthMapRef.current[col.id] !== undefined) {
          // 已有估算记忆 → 沿用（防「插入新列」时旧列跳变抖动）
          next[col.id] = colWidthMapRef.current[col.id];
        } else {
          // 新列 → 按内容估算一次
          next[col.id] = estimateColumnWidth(col.label, sb.rows, col.id);
        }
      }
      colWidthMapRef.current = next;
      colSigRef.current = colSig;
    }
    return colWidthMapRef.current;
    // sb 进依赖只为首帧拿到最新内容；sig 不变时直接返回 ref，开销 O(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colSig, sb]);

  const onResizeMove = useCallback((e: PointerEvent) => {
    const r = resizingRef.current;
    if (!r) return;
    const w = Math.max(COL_W_MIN, r.startW + (e.clientX - r.startX));
    const el = colElsRef.current[r.ci];
    if (el) el.style.width = `${w}px`;
    colWidthMapRef.current = { ...colWidthMapRef.current, [r.colId]: w };
  }, []);

  const onResizeUp = useCallback(() => {
    const r = resizingRef.current;
    if (!r) return;
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeUp);
    document.body.style.userSelect = '';
    resizingRef.current = null;
    r.handleEl.classList.remove('active');
    const w = colWidthMapRef.current[r.colId];
    if (Number.isFinite(w) && w !== r.startW) {
      commit(setColumnWidth(sbRef.current, r.colId, w));
      // 松手后列宽已变 → 触发一次全量高度重算（内容随新宽度换行，行高应跟着收缩/撑高）
      setResizeTick((t) => t + 1);
    }
  }, [onResizeMove, commit]);

  const startResize = useCallback(
    (e: ReactPointerEvent, colId: string, ci: number) => {
      e.preventDefault();
      e.stopPropagation();
      const el = colElsRef.current[ci];
      if (!el) return;
      (e.currentTarget as HTMLElement).classList.add('active');
      resizingRef.current = {
        colId,
        ci,
        startX: e.clientX,
        startW: el.getBoundingClientRect().width,
        handleEl: e.currentTarget as HTMLElement,
      };
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onResizeMove);
      window.addEventListener('pointerup', onResizeUp);
    },
    [onResizeMove, onResizeUp],
  );

  return { colWidths, colElsRef, startResize, resizeTick };
}
