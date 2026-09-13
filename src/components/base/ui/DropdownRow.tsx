import type { ReactNode } from 'react';

/**
 * 下拉选项行（`Select` / `ModelSelect` 共用）—— **行 chrome + 选中/悬浮态 + 点选协议**的单一真源（TD-19-1）。
 *
 * 【要点】点选走 `onMouseDown` + `preventDefault`（而非 `onClick`）：按下即选中且不让触发器失焦，
 * 与两处下拉既有行为一致；此处收口后**协议也只有一份**。
 *
 * @param props
 *  - `selected` 是否选中（决定高亮态）
 *  - `onSelect` 点选回调
 *  - `children` 行内容（Select=文本+勾选图标 / ModelSelect=厂商 badge+名称+费用）
 */
export interface DropdownRowProps {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

export default function DropdownRow({ selected, onSelect, children }: DropdownRowProps) {
  return (
    <div
      role="button"
      className={`flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors cursor-pointer ${selected ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
    >
      {children}
    </div>
  );
}
