import React, { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * 节点标题栏（复刻原 _Component8.jsx）
 * 显示小图标 + 名称，双击可改名，支持拖拽（drag-handle）。
 *
 * onRename 回调（可选）：
 *  - 传入时，改名 commit 会写回节点数据（如 data.label），让名字流向下游素材匹配；
 *  - 不传则保持「仅本地显示」的原行为，对其他节点零影响。
 * @param {function(string):void} [onRename]
 */
interface NodeTitleProps {
  /** 当前标题（受控：外部 label 变化时同步回显） */
  label?: string;
  /** label 为空时的兜底标题 */
  defaultTitle?: string;
  /** 标题前的小图标**组件**（不是 element）。
      收组件引用而非 JSX 有两个硬理由：
      ① 组件引用是模块级常量 ⇒ 引用天然稳定 ⇒ 不会击穿 memo(NodeTitle)；
      ② 图标尺寸/颜色属**本组件**的呈现决定，不该由 16 个调用方各写一遍（本仓 PanelBar/LeftPanel 同形）。 */
  icon?: LucideIcon;
  className?: string;
  /** 浮层模式：绝对定位到节点上方（默认内联在标题栏） */
  floating?: boolean;
  /** 改名提交回调；不传则只改本地显示（保持原行为） */
  onRename?: (next: string) => void;
}

function NodeTitle({
  label,
  defaultTitle,
  icon: Icon,
  className = '',
  floating = false,
  onRename,
}: NodeTitleProps) {
  const [val, setVal] = useState(label || defaultTitle);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setVal(label || defaultTitle);
  }, [label, defaultTitle]);

  const commit = (text: string) => {
    const next = text.trim() || defaultTitle;
    setVal(next);
    if (typeof onRename === 'function') onRename(next ?? '');
  };

  return (
    <div
      className={`${floating ? 'absolute -top-6 left-0 z-30' : 'mb-1 self-start'} flex items-center gap-1.5 text-caption-sm text-secondary drag-handle cursor-move ${className || ''}`}
    >
      {/* 图标样式（11px / muted）在此**唯一**定义 —— 调用方只声明"我是哪个图标"，不重复写样式。 */}
      {Icon && <Icon size={11} className="text-muted" />}
      {editing ? (
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={(e) => {
            setEditing(false);
            commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setEditing(false);
              commit(e.currentTarget.value);
            }
            if (e.key === 'Escape') {
              setEditing(false);
              setVal(label || defaultTitle);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag nowheel nopan w-32 rounded border border-edge-muted bg-surface-black px-1.5 py-0.5 text-caption-sm text-primary outline-none focus:border-blue-500"
          autoFocus
        />
      ) : (
        <button
          type="button"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="max-w-[180px] truncate rounded px-0.5 text-left hover:text-primary hover:bg-white/5"
          title="双击修改名称"
        >
          {val || defaultTitle}
        </button>
      )}
    </div>
  );
}
export default React.memo(NodeTitle);
