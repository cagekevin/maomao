/**
 * AI 助手表格 —— 「目标标签页」下拉（spec 3.3 / 3.6 共用的唯一实现）。
 *
 * 两处使用：① 预览卡「写入到：表X ▾」；② 行尾 ⋯ →「复制行到…」。
 * spec §3.6 明确要求「复用 3.3 的下拉组件」，此前两处各写一份（.atw-pv-target-* / .atw-rowmenu-target-*），
 * 组件与样式双份、值还有 20px 差异，故抽成本组件。
 *
 * ⚠️ 反直觉（2026-09-07）：`useOutsideClick` 必须放在**本组件内部**包住「触发器 + 菜单」，
 *   而不是由调用方管 —— 调用方（预览卡）原先没接，导致下拉只能靠再点按钮才能收起，与全站 ⋯ 菜单不一致。
 *   同理，菜单祖先若有 `overflow:hidden`（如 `.atw-pv`）会纵向裁掉浮层，表现为「点了没反应」；
 *   CSS 侧已把 `.atw-pv` 的 overflow 放开（见 assistant-table.css）。
 */
import { useRef, useState, type ReactNode } from 'react';
import Icon from './icons.tsx';
import { useOutsideClick } from '@/components/base/core/uiHooks.ts';

export interface TabTargetOption {
  id: string;
  name: string;
}

export interface TabTargetMenuProps {
  /** 可选项（所有 tab） */
  tabs: TabTargetOption[];
  /** 当前所在 tab id（「复制行到…」场景要排除自己，避免复制到自己） */
  currentTabId?: string;
  /** 触发器里显示的当前目标名 */
  currentName: string;
  /** 触发器前缀文案（「写入到：」/「复制到：」） */
  label: string;
  title?: string;
  onPick: (tabId: string) => void;
  /** 「＋ 新建标签页」；不传则不渲染该项 */
  onNew?: () => void;
  /** 触发器额外样式（预览卡用 atw-pv-target，行菜单用 atw-rowmenu-trigger） */
  triggerClassName?: string;
  /** 触发器图标（默认 target） */
  icon?: ReactNode;
}

export default function TabTargetMenu({
  tabs,
  currentTabId,
  currentName,
  label,
  title,
  onPick,
  onNew,
  triggerClassName = 'atw-pv-target',
  icon,
}: TabTargetMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useOutsideClick(wrapRef, open, () => setOpen(false));
  const options = tabs.filter((t) => t.id !== currentTabId);

  return (
    <span className="atw-target-wrap" ref={wrapRef}>
      <button
        type="button"
        className={triggerClassName}
        title={title ?? '选择目标标签页'}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ?? <Icon name="target" size={11} strokeWidth={2} />}
        {label}
        {currentName || '当前'}
        <Icon name="chevron-down" size={10} strokeWidth={2.2} />
      </button>
      {open && (
        <div className="atw-target-menu custom-scrollbar">
          {options.map((t) => (
            <button
              key={t.id}
              type="button"
              className="atw-target-item"
              title={t.name}
              onClick={() => {
                onPick(t.id);
                setOpen(false);
              }}
            >
              <Icon name="table" size={11} strokeWidth={2} />
              {t.name}
            </button>
          ))}
          {options.length === 0 && <div className="atw-target-empty">没有其它标签页</div>}
          {onNew && (
            <button
              type="button"
              className="atw-target-item is-add"
              onClick={() => {
                onNew();
                setOpen(false);
              }}
            >
              <Icon name="plus" size={11} strokeWidth={2.2} />
              新建标签页
            </button>
          )}
        </div>
      )}
    </span>
  );
}
