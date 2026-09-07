/**
 * AI 助手表格 —— 选区 / 内部剪贴板 hook（spec 3.6，2026-09-07 补齐）。
 *
 * 能力：
 *  - **矩形选区**：点某格设起点，Shift + 点另一格扩成矩形（rowId/colId 锚定，增删行不串位）。
 *    ❌ 不做鼠标拖选（spec §7 明令：与 textarea/滚动冲突面大，宁可少功能不出 bug）。
 *  - **内部剪贴板** `clipboard: {kind:'rows'|'range'}`，仅内存、不落盘、不依赖系统剪贴板权限。
 *  - Ctrl/Cmd+C = 复制（有多选行 → 复制行；否则有选区 → 复制区域）；Ctrl/Cmd+V = 粘贴。
 *  - Esc / 点空白 = 取消选区（由 AssistantTablePanel 的 keydown 承接）。
 *
 * ⚠️ 反直觉：选区与「行多选」是两套互斥信号 —— 点**行号格**（最左列）才是选行（spec §0 第 7 条裁定：
 *   原先点整行任意格都选行，会和「点格子设选区起点」打架）；点普通格子只动选区。
 *
 * 所有写回都经调用方传入的 `commit`（内部已含 pushHistory + normalize）。
 */
import { useCallback } from 'react';
import type { AssistantTable, CellRange } from './assistantTable.ts';
import { copyRows, pasteRows, rangeToCells, pasteCells } from './assistantTable.ts';
import {
  useTableWorkspace,
  setTableRange,
  setTableClipboard,
  setTableWorkspaceRows,
} from './tableWorkspaceState.ts';

export interface UseTableSelectionParams {
  /** 当前活动 tab 的表（选区/复制的源与目标） */
  table: AssistantTable;
  /** 当前多选行（复制优先级高于选区） */
  selectedRowIds: string[];
  /** 唯一写回入口（内部含 pushHistory） */
  commit: (sb: AssistantTable) => void;
}

export interface UseTableSelectionResult {
  range: CellRange | null;
  clipboardEmpty: boolean;
  /** 点普通格子：Shift = 扩成矩形，否则重设起点（并清掉行多选，二者互斥） */
  onCellPointerDown: (e: { shiftKey: boolean }, rowId: string, colId: string) => void;
  clearRange: () => void;
  /** Ctrl/Cmd+C：返回 toast 文案；无可选内容返回 '' */
  copy: () => string;
  /** Ctrl/Cmd+V：返回 toast 文案；无剪贴板内容返回 '' */
  paste: () => string;
}

export function useTableSelection({
  table,
  selectedRowIds,
  commit,
}: UseTableSelectionParams): UseTableSelectionResult {
  const { range, clipboard } = useTableWorkspace();

  const onCellPointerDown = useCallback(
    (e: { shiftKey: boolean }, rowId: string, colId: string) => {
      setTableRange(
        e.shiftKey && range
          ? { ...range, r1: rowId, c1: colId }
          : { r0: rowId, c0: colId, r1: rowId, c1: colId },
      );
      // 选区与行多选互斥：动选区即清行选中（否则 Delete 会误删整行）
      if (selectedRowIds.length) setTableWorkspaceRows([]);
    },
    [range, selectedRowIds.length],
  );

  const clearRange = useCallback(() => setTableRange(null), []);

  const copy = useCallback((): string => {
    if (selectedRowIds.length) {
      const rows = copyRows(table, selectedRowIds).map((r) => r.values);
      if (!rows.length) return '';
      setTableClipboard({ kind: 'rows', colIds: table.columns.map((c) => c.id), rows });
      return `已复制 ${rows.length} 行`;
    }
    if (range) {
      const cells = rangeToCells(table, range);
      if (!cells.length || !cells[0].length) return '';
      setTableClipboard({ kind: 'range', cells });
      return `已复制 ${cells.length} 行 × ${cells[0].length} 列`;
    }
    return '';
  }, [table, selectedRowIds, range]);

  const paste = useCallback((): string => {
    if (!clipboard) return '';
    if (clipboard.kind === 'rows') {
      const anchorRowId = selectedRowIds.length
        ? selectedRowIds[selectedRowIds.length - 1]
        : undefined;
      const next = pasteRows(
        table,
        clipboard.rows.map((values) => ({ id: '', values })),
        anchorRowId,
      );
      if (next === table) return '';
      commit(next);
      return `已粘贴 ${clipboard.rows.length} 行`;
    }
    // 区域粘贴：锚点 = 当前选区起点，无选区则落在首格
    const anchor =
      range &&
      table.rows.some((r) => r.id === range.r0) &&
      table.columns.some((c) => c.id === range.c0)
        ? { rowId: range.r0, colId: range.c0 }
        : { rowId: table.rows[0]?.id ?? '', colId: table.columns[0]?.id ?? '' };
    if (!anchor.rowId || !anchor.colId) return '';
    const next = pasteCells(table, anchor, clipboard.cells);
    if (next === table) return '';
    commit(next);
    return `已粘贴 ${clipboard.cells.length} × ${clipboard.cells[0].length} 区域`;
  }, [clipboard, table, selectedRowIds, range, commit]);

  return {
    range,
    clipboardEmpty: !clipboard,
    onCellPointerDown,
    clearRange,
    copy,
    paste,
  };
}
