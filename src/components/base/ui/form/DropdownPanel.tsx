import type { ReactNode } from 'react';

/**
 * 下拉浮层面板（`Select` / `ModelSelect` 共用）—— **定位 + 外观 chrome 的单一真源**（TD-19-1）。
 *
 * 【为什么存在】两处「同款下拉」此前各自复刻同一串面板类名 + 同一个「上弹/下弹」定位三元表达式。
 * 任何一侧改样式（圆角/阴影/滚动层级/`nowheel nopan nodrag`/max-h/滚动条）都会与另一侧**无声漂移**
 * → 视觉不一致（用户可见缺陷）。
 *
 * 【接口刻意窄】只有 3 个 prop，**不做** `renderTrigger`/`renderItem`/`className` 透传之类 ——
 * 那会变成「宽接口薄实现」的假基座。宽度令牌是否外提见下。
 *
 * @param props
 *  - `popupTo`    弹出方向：'down'（默认，向下展开）｜'up'（向上展开）
 *  - `align`      贴哪条边：'left'（默认，面板左缘对齐触发器）｜'right'（右缘对齐触发器）。
 *                 挂在**容器右端**的触发器（例：工具条最右的 ⋯）必须用 'right'，否则面板向右溢出。
 *  - `widthClass` 面板宽度令牌（Tailwind 类）。两处下拉宽度**刻意不同**（Select 窄 / ModelSelect 宽），
 *                 属产品差异 → 外提；其余 chrome 一律本组件内定义（不外提、不可覆盖）。
 *  - `children`   面板内容（选项列表 / 空态）
 */
export interface DropdownPanelProps {
  popupTo?: 'up' | 'down';
  align?: 'left' | 'right';
  /** 面板宽度令牌（**必填**：宽度是各站点的产品决策，本组件不替调用方默认） */
  widthClass: string;
  children: ReactNode;
}

export default function DropdownPanel({
  popupTo = 'down',
  align = 'left',
  widthClass,
  children,
}: DropdownPanelProps) {
  return (
    <div
      className={`absolute ${popupTo === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'} ${
        align === 'right' ? 'right-0' : 'left-0'
      } ${widthClass} bg-surface-1 border border-edge rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
