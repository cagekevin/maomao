/**
 * AI 助手表格 —— 单元格编辑器（受控 textarea，随内容自动撑高）。
 *
 * 原内联在 AssistantTablePanel 内，抽为独立文件便于复用与单测。
 * grow：把 height 置 auto 再置 scrollHeight（多行换行对齐 mockup）；外部值变化 / 列宽变化(resizeTick) 都触发重算。
 * blur 提交（onCommit 由上层写回数据层并清草稿）。
 */
import { useCallback, useEffect, useRef } from 'react';

export default function CellEditor({
  value,
  resizeTick = 0,
  onChange,
  onCommit,
}: {
  value: string;
  /** 列宽拖拽完成信号：变化时强制按新宽度重算高度（列宽变 → 换行宽度变 → 行高跟着变） */
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
  // 外部值变化（粘贴/写回/切对话）或列宽变化（resizeTick）→ 重算高度
  useEffect(() => {
    grow();
  }, [value, resizeTick, grow]);
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
