/**
 * AI 助手表格 —— 表格主体渲染（纯 presentational：表头吸顶 / 行 / 格 / 行号 / 操作列）。
 *
 * 从 AssistantTablePanel 抽出的纯渲染子组件：不持任何状态/订阅，只吃 props + 回调。
 * cells()/ops() 逻辑随迁此文件；图标统一走 Icon；列宽拖拽容忍 `onStartResize`（hook 注入，命令式改 DOM）。
 * 数据真相源仍在数据层，本组件不改任何模型（所有写回都经回调）。
 */
import type { RefObject } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { ReactNode } from 'react';
import type { AssistantTable, CellRange, TableRow } from './assistantTable.ts';
import CellEditor from './CellEditor.tsx';
import Icon from './icons.tsx';

export interface TableGridProps {
  table: AssistantTable;
  selectedRowIds: string[];
  /** 单元格矩形选区（spec 3.6；null = 无） */
  range: CellRange | null;
  /** 点格子：Shift 扩选区，否则重设起点（选区与行多选互斥） */
  onCellPointerDown: (e: { shiftKey: boolean }, rowId: string, colId: string) => void;
  /** 正在编辑的格（业界模型；整表唯一）。其上的格子渲染 textarea，其余渲染只读 div */
  editingCell: { rowId: string; colId: string } | null;
  /** 当前聚焦的单格（单击选中整格；渲染高亮框，复制/粘贴默认锚点） */
  focusedCell: { rowId: string; colId: string } | null;
  /** 单击格：聚焦为当前格（选中整格，不进入编辑） */
  onFocusCell: (rowId: string, colId: string) => void;
  /** 双击格：进入编辑态 */
  onEditCell: (rowId: string, colId: string) => void;
  /** 列 id → 当前显示宽（px，估算/手动锁定混合） */
  colWidths: Record<string, number>;
  /** hook 提供的 <col> ref（拖拽中直改 DOM 不重渲） */
  colElsRef: RefObject<Array<HTMLTableColElement | null>>;
  /** 列宽拖拽完成信号：驱动每格 textarea 按新宽度重算行高 */
  resizeTick: number;
  /** 单元格草稿读：无草稿回退 backing */
  cellValue: (rowId: string, colId: string, backing: string) => string;
  onCellChange: (rowId: string, colId: string, value: string) => void;
  onCellCommit: (rowId: string, colId: string, value: string) => void;
  onRowClick: (e: ReactMouseEvent, row: TableRow) => void;
  /** 列名草稿读（colId → draft | undefined） */
  colRename: (colId: string) => string | undefined;
  onColRenameChange: (colId: string, value: string) => void;
  onColRenameCommit: (colId: string, label: string) => void;
  onInsertColumnAfter: (colId: string) => void;
  onDeleteColumn: (colId: string) => void;
  onStartResize: (e: ReactPointerEvent, colId: string, ci: number) => void;
  /** 每行的操作组（复制/上移/下移/删除/发送到画布） */
  renderRowOps: (row: TableRow) => ReactNode;
}

export default function TableGrid({
  table,
  selectedRowIds,
  range,
  onCellPointerDown,
  editingCell,
  focusedCell,
  onFocusCell,
  onEditCell,
  colWidths,
  colElsRef,
  resizeTick,
  cellValue,
  onCellChange,
  onCellCommit,
  onRowClick,
  colRename,
  onColRenameChange,
  onColRenameCommit,
  onInsertColumnAfter,
  onDeleteColumn,
  onStartResize,
  renderRowOps,
}: TableGridProps) {
  /** 选区矩形（按 index 归一）；任一锚点已不存在 → 视为无选区，不渲染高亮 */
  const rowIdx = (id: string) => table.rows.findIndex((r) => r.id === id);
  const colIdx = (id: string) => table.columns.findIndex((c) => c.id === id);
  const sel =
    range &&
    rowIdx(range.r0) >= 0 &&
    rowIdx(range.r1) >= 0 &&
    colIdx(range.c0) >= 0 &&
    colIdx(range.c1) >= 0
      ? {
          r0: Math.min(rowIdx(range.r0), rowIdx(range.r1)),
          r1: Math.max(rowIdx(range.r0), rowIdx(range.r1)),
          c0: Math.min(colIdx(range.c0), colIdx(range.c1)),
          c1: Math.max(colIdx(range.c0), colIdx(range.c1)),
        }
      : null;

  /** 单元格：编辑态格渲染 textarea，其余渲染只读 div；草稿优先，blur 提交 */
  const cells = (row: TableRow) => {
    const ri = rowIdx(row.id);
    return table.columns.map((col, ci) => {
      const value = cellValue(row.id, col.id, row.values[col.id] ?? '');
      const inRange = !!sel && ri >= sel.r0 && ri <= sel.r1 && ci >= sel.c0 && ci <= sel.c1;
      const isEditing =
        editingCell != null && editingCell.rowId === row.id && editingCell.colId === col.id;
      const isFocused =
        !isEditing &&
        focusedCell != null &&
        focusedCell.rowId === row.id &&
        focusedCell.colId === col.id;
      const tdClass =
        [inRange ? 'in-range' : '', isFocused ? 'is-focused' : '']
          .filter(Boolean)
          .join(' ')
          .trim() || undefined;
      return (
        <td
          key={col.id}
          className={tdClass}
          /* 【业界铁律·cell 交互分工，勿互换】单击 = 选中整格（focusedCell，可复制）；双击 = 编辑（editingCell）。
             二者不可合并到单击（否则退回旧「点即编辑、无法只选整格」的 textarea 病态）。
             mousedown 仍先设选区起点（Shift 扩选），且不阻止默认 —— 但选中态 cell 是 div（不聚焦），点一下不落光标。 */
          onMouseDown={(e) => onCellPointerDown(e, row.id, col.id)}
          onClick={() => onFocusCell(row.id, col.id)}
          onDoubleClick={() => onEditCell(row.id, col.id)}
        >
          <CellEditor
            value={value}
            editing={isEditing}
            resizeTick={resizeTick}
            onChange={(v) => onCellChange(row.id, col.id, v)}
            onCommit={() => onCellCommit(row.id, col.id, value)}
          />
        </td>
      );
    });
  };

  return (
    <div className="atw-body">
      <table className="atw-grid">
        <colgroup>
          <col style={{ width: 32 }} />
          {table.columns.map((col, ci) => (
            <col
              key={col.id}
              ref={(el) => {
                colElsRef.current[ci] = el;
              }}
              style={{ width: colWidths[col.id] ?? colWidths[ci] }}
            />
          ))}
          <col style={{ width: 32 }} />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            {table.columns.map((col, ci) => (
              <th key={col.id} title="点击改列名">
                <input
                  className="col-head"
                  value={colRename(col.id) ?? col.label}
                  onChange={(e) => onColRenameChange(col.id, e.target.value)}
                  onBlur={() => onColRenameCommit(col.id, col.label)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                      (e.target as HTMLInputElement).blur();
                  }}
                />
                {/* 列头操作组（hover 显示，+ / × 同款）：每个列表头都能「在该列后插入一列」/「删除该列」 */}
                <span className="col-ops">
                  <button
                    type="button"
                    className="atw-icobtn"
                    title="在该列右侧插入一列"
                    onClick={() => onInsertColumnAfter(col.id)}
                  >
                    <Icon name="plus" />
                  </button>
                  <button
                    type="button"
                    className="atw-icobtn"
                    title="删除该列"
                    onClick={() => onDeleteColumn(col.id)}
                  >
                    <Icon name="x" />
                  </button>
                </span>
                {/* 列宽拖拽手柄：hover 表头显示，拖拽只改 DOM 不重渲，松手 commit 一次 */}
                <span
                  className="col-resize"
                  title="拖拽调整列宽"
                  onPointerDown={(e) => onStartResize(e, col.id, ci)}
                />
              </th>
            ))}
            {/* 操作列表头占位：保持与每行 N+2 列对齐，否则表头下边框比每行少一格 */}
            <th className="atw-ops-head" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            // ⚠️ 行选择只挂在**行号格**（spec §0 第 7 条裁定）：点普通格子是设选区起点，
            // 若整行都可选行，两者会打架（点一下既选行又动选区）。
            <tr key={row.id} className={selectedRowIds.includes(row.id) ? 'sel' : ''}>
              <td
                className="idx"
                title="点击选中该行（Cmd/Ctrl 加选，Shift 选区间）"
                onClick={(e) => onRowClick(e, row)}
              >
                {i + 1}
              </td>
              {cells(row)}
              <td>{renderRowOps(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
