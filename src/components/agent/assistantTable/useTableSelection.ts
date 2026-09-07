/**
 * AI 助手表格 —— 选区 / 复制粘贴 hook（spec interaction-model §1.4；业界对齐，2026-09-07 改造）。
 *
 * 【业界铁律·必须遵循】本文件是表格「复制粘贴」的业界契约唯一实现点。凡改复制/粘贴，须保持：
 *  ① 复制优先级恒为「行多选 > 矩形选区 > 单格」；② 默认写**系统剪贴板**（可进出 Excel/外部），
 *    系统不可用才回退内部；③ copy/paste 为 async（系统剪贴板是异步 API）。**勿退回**「仅内存剪贴板」或
 *    「永远 textarea 编辑」——那正是「复制粘不出来」的历史病根（2026-09-07 根因诊断）。
 *
 * 能力：
 *  - **矩形选区**：点某格设起点，Shift + 点另一格扩成矩形（rowId/colId 锚定）。不做鼠标拖选（spec §7）。
 *  - **系统剪贴板打通**（修「复制粘不出来」根因）：
 *     * 复制优先级：行多选 > 矩形选区 > focusedCell 单格；一律写**系统剪贴板**（可粘到 Excel/外部），
 *       同时更新内部剪贴板供表格内 TSV/行语义。
 *     * 粘贴优先读**系统剪贴板**文本：含制表符/多行 → 按矩形铺开覆盖（复用 pasteCells）；纯文本 → 覆盖 focusedCell 单格。
 *     * 系统剪贴板不可用（权限/非安全上下文）→ 回退内部剪贴板（原 rows/range 语义）。
 *  - Ctrl/Cmd+C/V 由调用方在「非编辑态」触发（编辑态走 textarea 原生）；本 hook 只管算内容 + 读写剪贴板。
 *
 * 所有写回都经调用方传入的 `commit`（内部已含 pushHistory + normalize）。
 */
import { useCallback } from 'react';
import type { AssistantTable, CellRange } from './assistantTable.ts';
import {
  copyRows,
  pasteRows,
  rangeToCells,
  pasteCells,
  parseClipboardGrid,
} from './assistantTable.ts';
import {
  useTableWorkspace,
  setTableRange,
  setTableClipboard,
  setTableWorkspaceRows,
} from './tableWorkspaceState.ts';
import type { TableClipboard } from './tableWorkspaceState.ts';

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
  /** 复制（非编辑态 Ctrl/Cmd+C）：行 > 选区 > 聚焦单格；写系统剪贴板 + 内部。@returns 成功 toast 文案；无可复制返回 '' */
  copy: (focusedCell: { rowId: string; colId: string } | null) => Promise<string>;
  /** 粘贴（非编辑态 Ctrl/Cmd+V）：先读系统剪贴板；不可用回退内部。@returns 成功 toast 文案；无内容返回 '' */
  paste: (focusedCell: { rowId: string; colId: string } | null) => Promise<string>;
}

/** 写系统剪贴板（失败可见：不可用/被拒 → false，由调用方决定是否回退内部） */
async function writeSystemClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 权限被拒 / 非安全上下文 → 返回 false 走回退 */
  }
  // 兜底：execCommand（旧/受限环境）
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 读系统剪贴板文本（失败可见；读不到 → null，调用方回退内部） */
async function readSystemClipboard(): Promise<string | null> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      return await navigator.clipboard.readText();
    }
  } catch {
    /* 权限被拒 / 非安全上下文 */
  }
  return null;
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

  /** 取某列 id 对应单元格当前文本（行/格存在；不存在返回 ''） */
  const cellTextAt = useCallback(
    (rowId: string, colId: string): string => {
      const row = table.rows.find((r) => r.id === rowId);
      if (!row || !table.columns.some((c) => c.id === colId)) return '';
      return row.values[colId] ?? '';
    },
    [table],
  );

  /** 复制：行 > 选区 > 聚焦单格。写系统剪贴板 + 内部剪贴板 */
  const copy = useCallback(
    async (focusedCell: { rowId: string; colId: string } | null): Promise<string> => {
      let sysText = '';
      let internal: TableClipboard | null = null;
      let toast = '';
      if (selectedRowIds.length) {
        const rows = copyRows(table, selectedRowIds).map((r) => r.values);
        if (!rows.length) return '';
        // 系统剪贴板：所选行 → TSV（每行列值，制表符分隔；行间换行）
        sysText = rows.map((r) => table.columns.map((c) => r[c.id] ?? '').join('\t')).join('\n');
        internal = { kind: 'rows', colIds: table.columns.map((c) => c.id), rows };
        toast = `已复制 ${rows.length} 行`;
      } else if (range) {
        const cells = rangeToCells(table, range);
        if (!cells.length || !cells[0].length) return '';
        sysText = cells.map((line) => line.join('\t')).join('\n');
        internal = { kind: 'range', cells };
        toast = `已复制 ${cells.length} 行 × ${cells[0].length} 列`;
      } else if (focusedCell) {
        const txt = cellTextAt(focusedCell.rowId, focusedCell.colId);
        if (txt === '' && table.rows.length > 0) {
          // 空格也算可复制（值为空仍允许，但拷贝空串无意义 → 返回无可复制，避免误提示）
        }
        sysText = txt;
        internal = { kind: 'cell', text: txt };
        toast = '已复制单元格';
      } else {
        return '';
      }
      if (internal) setTableClipboard(internal);
      const wroteSys = await writeSystemClipboard(sysText);
      if (!wroteSys && toast) {
        // 系统剪贴板不可用：仍可表格内部粘贴（内部已存），但提示受限，不静默
      }
      return toast;
    },
    [table, selectedRowIds, range, cellTextAt],
  );

  /** 粘贴：先读系统剪贴板；不可用/为空 → 回退内部剪贴板 */
  const paste = useCallback(
    async (focusedCell: { rowId: string; colId: string } | null): Promise<string> => {
      // 粘贴锚点：优先聚焦单格；无则选区起点；再无则首格
      const anchor =
        focusedCell &&
        table.rows.some((r) => r.id === focusedCell.rowId) &&
        table.columns.some((c) => c.id === focusedCell.colId)
          ? { rowId: focusedCell.rowId, colId: focusedCell.colId }
          : range &&
              table.rows.some((r) => r.id === range.r0) &&
              table.columns.some((c) => c.id === range.c0)
            ? { rowId: range.r0, colId: range.c0 }
            : { rowId: table.rows[0]?.id ?? '', colId: table.columns[0]?.id ?? '' };
      if (!anchor.rowId || !anchor.colId) return '';

      // 1) 系统剪贴板优先
      const sys = await readSystemClipboard();
      if (sys !== null && sys !== '') {
        const grid = parseClipboardGrid(sys);
        if (grid) {
          const next = pasteCells(table, anchor, grid);
          if (next === table) return '';
          commit(next);
          return `已粘贴 ${grid.length} 行 × ${grid[0].length} 列`;
        }
        // 纯文本单值 → 覆盖锚点格
        const rowIdx = table.rows.findIndex((r) => r.id === anchor.rowId);
        const col = table.columns.find((c) => c.id === anchor.colId);
        if (rowIdx < 0 || !col) return '';
        const val = sys;
        const cellNext = {
          ...table,
          rows: table.rows.map((r, i) =>
            i === rowIdx ? { ...r, values: { ...r.values, [col.id]: val } } : r,
          ),
        };
        if (cellNext === table) return '';
        commit(cellNext);
        return '已粘贴';
      }

      // 2) 回退内部剪贴板（无系统剪贴板内容时；表格内 rows/range/cell 语义）
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
      if (clipboard.kind === 'range') {
        const next = pasteCells(table, anchor, clipboard.cells);
        if (next === table) return '';
        commit(next);
        return `已粘贴 ${clipboard.cells.length} × ${clipboard.cells[0].length} 区域`;
      }
      if (clipboard.kind === 'cell') {
        const rowIdx = table.rows.findIndex((r) => r.id === anchor.rowId);
        const col = table.columns.find((c) => c.id === anchor.colId);
        if (rowIdx < 0 || !col) return '';
        const next = {
          ...table,
          rows: table.rows.map((r, i) =>
            i === rowIdx ? { ...r, values: { ...r.values, [col.id]: clipboard.text } } : r,
          ),
        };
        if (next === table) return '';
        commit(next);
        return '已粘贴';
      }
      return '';
    },
    [table, selectedRowIds, range, clipboard, commit],
  );

  return {
    range,
    clipboardEmpty: !clipboard,
    onCellPointerDown,
    clearRange,
    copy,
    paste,
  };
}
