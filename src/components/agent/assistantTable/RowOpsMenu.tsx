/**
 * AI 助手表格 —— 行尾 ⋯（三点竖）菜单（替代右侧 5 连图标，spec 3.5）。
 *
 * 菜单项：上移 / 下移 / 插入空行（下方）/ 复制行到…（跨表，spec 3.6）/ 删除行（danger）/ 发送到画布。
 * ⋯ 菜单左侧如果有多行选中，「删除」变成「删除选中行」（批量，spec 3.6）。
 *
 * 【2026-09-07 用户裁定】删掉「复制到下一行」：与「复制行到…」语义重复（同一个功能两个入口），
 * 后者更强（可跨表），只保留一个；「发送到画布去生图」→「发送到画布」（原文案过长）。
 *
 * 「复制行到…」复用 `TabTargetMenu`（与预览卡「写入到」同一份组件，spec §3.6 要求），
 * 选项 = 所有 tab（排除自己）+ 「＋ 新建标签页」。
 *
 * 本组件纯受控：所有操作经 props 回调。
 * 关闭：点菜单项自然关；**点菜单外**由 `useOutsideClick` 关（2026-09-07 补 —— 原先只能靠点某项才关，
 * 与全站 ⋯ 菜单（PanelMoreMenu）行为不一致）。
 */
import { useRef, useState } from 'react';
import Icon from './icons.tsx';
import TabTargetMenu from './TabTargetMenu.tsx';
import { useOutsideClick } from '@/components/base/core/uiHooks.ts';

export interface RowOpsMenuProps {
  /** 是否有删除行能力（最后一行也可删空——空表由空态接管，此处不限） */
  disabled?: boolean;
  /** 当前是否还有多选行（>1 删除 = 批量删选中） */
  hasMultiSelect?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertAfter: () => void;
  /** 删除当前行；若 hasMultiSelect 则父层改为删全部选中行 */
  onDelete: () => void;
  onSendToCanvas: () => void;
  /** 跨表复制：目标表（复制到其末尾） */
  onCopyToTab: (destTabId: string) => void;
  /** 跨表复制：新建标签页作为目标 */
  onCopyToNewTab: () => void;
  /** 供菜单渲染目标下拉用 */
  tabs: Array<{ id: string; name: string }>;
  /** 当前所在 tab id（目标下拉里排除自己） */
  currentTabId: string;
  /** 当前 tab 名（下拉触发器显示用） */
  currentTabName: string;
}

export default function RowOpsMenu({
  disabled = false,
  hasMultiSelect = false,
  onMoveUp,
  onMoveDown,
  onInsertAfter,
  onDelete,
  onSendToCanvas,
  onCopyToTab,
  onCopyToNewTab,
  tabs,
  currentTabId,
  currentTabName,
}: RowOpsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useOutsideClick(wrapRef, open, () => setOpen(false));

  const close = () => setOpen(false);

  return (
    <span
      ref={wrapRef}
      className="rowops"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="atw-row-ops-btn"
        title="行操作"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Icon name="more" size={13} strokeWidth={2} />
      </button>
      {open && (
        <div className="atw-rowmenu" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="atw-rowmenu-item"
            onClick={() => {
              onMoveUp();
              close();
            }}
          >
            <Icon name="chevron-up" size={12} strokeWidth={2} />
            上移
          </button>
          <button
            type="button"
            className="atw-rowmenu-item"
            onClick={() => {
              onMoveDown();
              close();
            }}
          >
            <Icon name="chevron-down" size={12} strokeWidth={2} />
            下移
          </button>
          <button
            type="button"
            className="atw-rowmenu-item"
            onClick={() => {
              onInsertAfter();
              close();
            }}
          >
            <Icon name="plus" size={12} strokeWidth={2} />
            插入空行（下方）
          </button>
          {/* 跨表复制：复用预览卡同款目标表下拉（所有 tab 除自己 + ＋ 新建标签页） */}
          <TabTargetMenu
            tabs={tabs}
            currentTabId={currentTabId}
            currentName={currentTabName}
            label="复制到："
            title="复制这些行到目标表末尾"
            triggerClassName="atw-rowmenu-item atw-rowmenu-trigger"
            icon={<Icon name="send" size={12} strokeWidth={2} />}
            onPick={(destTabId) => {
              onCopyToTab(destTabId);
              close();
            }}
            onNew={() => {
              onCopyToNewTab();
              close();
            }}
          />
          <button
            type="button"
            className="atw-rowmenu-item is-danger"
            onClick={() => {
              onDelete();
              close();
            }}
          >
            <Icon name="trash" size={12} strokeWidth={2} />
            {hasMultiSelect ? '删除选中行' : '删除行'}
          </button>
          <div className="atw-rowmenu-sep" />
          <button
            type="button"
            className="atw-rowmenu-item is-accent"
            onClick={() => {
              onSendToCanvas();
              close();
            }}
          >
            <Icon name="send" size={12} strokeWidth={2} />
            发送到画布
          </button>
        </div>
      )}
    </span>
  );
}
