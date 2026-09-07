/**
 * AI 助手表格 —— 单元格编辑器（业界模型双态，spec interaction-model §2.1）。
 *
 * 对齐 Excel/Sheets：每个格有「选中态」与「编辑态」两形态，整表同一时刻最多一个格在编辑。
 *  - 选中态（默认）：渲染普通 `<div class="cell cell-view">` —— 显示文本、不聚焦、不抢键，
 *    可承载将来 @ 高亮（dangerouslySetInnerHTML）。单击聚焦整格、双击进入编辑由 TableGrid 事件向上抛，
 *    本组件不自行处理（保持 presentational）。
 *  - 编辑态：渲染 `<textarea class="cell">` —— 复用现有受控编辑/自动撑高/失焦提交逻辑。
 *
 * ⚠️ 单一事实源：是否编辑由上层 `editing` 驱动（tableWorkspaceState.editingCell），本组件不自持「我在不在编辑」，
 *   杜绝多格同时编辑 / 状态分叉。编辑态 textarea 挂 `onBlur=onCommit`（提交并退出编辑回选中态）。
 */
import { useCallback, useEffect, useRef } from 'react';

export default function CellEditor({
  value,
  editing,
  resizeTick = 0,
  onChange,
  onCommit,
}: {
  value: string;
  /** true = 编辑态（textarea）；false = 选中态（div 只读展示） */
  editing: boolean;
  /** 列宽拖拽完成信号：变化时强制按新宽度重算高度（列宽变 → 换行宽度变 → 行高跟着变；仅编辑态 textarea 用） */
  resizeTick?: number;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const grow = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // 进入编辑态 → 聚焦 + 光标到末尾（业界双击进入可直接续写）
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const v = ref.current.value;
      ref.current.setSelectionRange(v.length, v.length);
      grow();
    }
  }, [editing, grow]);

  // 编辑态外部值变化（粘贴/写回/切对话）或列宽变化 → 重算高度
  useEffect(() => {
    if (editing) grow();
  }, [value, resizeTick, editing, grow]);

  // 选中态：普通 div 只读展示（不聚焦、不抢键；将来 @ 高亮在此注入富内容）
  if (!editing) {
    return <div className="cell cell-view">{value}</div>;
  }

  return (
    <textarea
      ref={ref}
      className="cell"
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onInput={grow}
      onBlur={onCommit}
      spellCheck={false}
    />
  );
}
