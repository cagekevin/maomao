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
import type { AssistantTable, TableRow } from './assistantTable.ts';
import CellEditor from './CellEditor.tsx';
import Icon from './icons.tsx';

export interface TableGridProps {
  table: AssistantTable;
  selectedRowIds: string[];
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
  /** 单元格：草稿优先，blur 提交 */
  const cells = (row: TableRow) =>
    table.columns.map((col) => {
      const value = cellValue(row.id, col.id, row.values[col.id] ?? '');
      return (
        <td key={col.id}>
          <CellEditor
            value={value}
            resizeTick={resizeTick}
            onChange={(v) => onCellChange(row.id, col.id, v)}
            onCommit={() => onCellCommit(row.id, col.id, value)}
          />
        </td>
      );
    });

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
          <col style={{ width: 88 }} />
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
            <tr
              key={row.id}
              className={selectedRowIds.includes(row.id) ? 'sel' : ''}
              onClick={(e) => onRowClick(e, row)}
            >
              <td className="idx">{i + 1}</td>
              {cells(row)}
              <td>{renderRowOps(row)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
