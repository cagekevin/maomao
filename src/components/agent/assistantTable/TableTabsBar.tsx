/**
 * AI 助手表格 —— 多标签页条（spec 3.1；位置 = `.atw` 最顶部第一行，在全局风格条之上，高 40px 与 AI 助手顶栏齐平）。
 *
 * 职责：渲染所有 tab + 选中态（唯一「选中 = 当前 = 发给 AI」）；＋ 新建；双击重命名；× 关闭（最后一个禁用）；
 * 条尾 ⋯ 菜单（复制为新表 / 重命名 / 关闭，作用于当前选中表）；pointer 手写拖拽排序。
 *
 * 【视觉 · 2026-09-07 对齐面板群 panel-kit】选中 = 中性高亮（surface-hover-strong + 内描边 + 文字最亮），
 * **不用蓝** —— 蓝在本项目语义是「某开关已启用」（见 panel-kit.css 头部「语义色约定」），
 * 用蓝做「当前项」会和全站语言打架（这也正是原先观感格格不入的根因）。
 *
 * ⚠️ 反直觉（2026-09-07 修）：⋯ 菜单必须挂在条尾 `.atw-tabs-tail`，**不能挂在 tab 内**。
 *   tab 列表容器 `.atw-tabs-scroll` 是 `overflow-x:auto / overflow-y:hidden`，挂在其内部的浮层
 *   会被纵向裁掉 —— 表现就是「点了三个点没反应」（菜单其实开了，只是看不见）。条尾在滚动容器外，不受裁剪。
 *
 * ⚠️ 反直觉（2026-09-07 修）：切表 click 挂在 **tab 外层 div** 上（点 tab 主体任意处即选中，spec 3.1），
 *   而拖拽也从这个 div 起手 —— 二者靠 `useTabDragSort.consumeDrag()` 分流：
 *   真实拖拽（位移 >4px）后的那次 click 在 `onClickCapture` 阶段被吞掉，其余照常切表。
 *
 * 本组件不持有 tabs 数据，全由 props 进出；选中/增删/改名/排序的落盘由上层（AssistantTablePanel）经
 * conversationStore 唯一入口完成。styles 见 assistant-table.css（.atw-tab.is-active）。
 */
import { useRef, useState } from 'react';
import type { AssistantTableTabs, TableTab } from './assistantTable.ts';
import { useTabDragSort } from './useTabDragSort.ts';
import Icon from './icons.tsx';
import { askConfirm } from '@/components/base/core/confirmStore.ts';
import { useOutsideClick } from '@/components/base/core/uiHooks.ts';

export interface TableTabsBarProps {
  tabs: AssistantTableTabs;
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onAdd: () => void;
  onRename: (tabId: string, name: string) => void;
  onClose: (tabId: string) => void;
  onCopyAsNew: (tabId: string) => void;
  onReorder: (from: number, to: number) => void;
}

export default function TableTabsBar({
  tabs,
  activeTabId,
  onSelect,
  onAdd,
  onRename,
  onClose,
  onCopyAsNew,
  onReorder,
}: TableTabsBarProps) {
  const list = tabs.tabs || [];
  const { draggingId, onPointerDown, consumeDrag } = useTabDragSort(list.length, onReorder);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useOutsideClick(menuRef, menuOpen, () => setMenuOpen(false));

  /** ⋯ 菜单作用对象 = 当前选中表（单选模型下没有第二个候选）；恒存在（normalize 兜底 ≥1 tab） */
  const activeTab = list.find((t) => t.id === activeTabId) ?? list[0] ?? null;
  const isLast = list.length <= 1;

  const beginRename = (tabId: string, name: string) => {
    setRenameDraft(name);
    setRenamingId(tabId);
    setMenuOpen(false);
    requestAnimationFrame(() => renameRef.current?.focus());
  };
  const commitRename = () => {
    const t = renameDraft.trim();
    if (t && renamingId) onRename(renamingId, t);
    setRenamingId(null);
  };
  const confirmClose = async (tab: TableTab) => {
    const rows = Array.isArray(tab.rows) ? tab.rows.length : 0;
    const ok = await askConfirm({
      title: `关闭「${tab.name}」？`,
      message: `表内 ${rows} 行内容将被删除且无法恢复。`,
      confirmText: '关闭',
      danger: true,
    });
    if (ok) onClose(tab.id);
  };

  return (
    <div className="atw-tabsbar">
      <div className="atw-tabs-scroll" role="tablist">
        {list.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const rows = Array.isArray(tab.rows) ? tab.rows.length : 0;
          if (renamingId === tab.id) {
            return (
              <input
                key={tab.id}
                ref={renameRef}
                autoFocus
                className="atw-tab-rename"
                value={renameDraft}
                maxLength={20}
                placeholder={tab.name}
                onBlur={commitRename}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    commitRename();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setRenamingId(null);
                  }
                }}
              />
            );
          }
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              title={isActive ? tab.name : `切换到「${tab.name}」`}
              className={`atw-tab${isActive ? ' is-active' : ''}${
                draggingId === tab.id ? ' is-dragging' : ''
              }`}
              onPointerDown={(e) => onPointerDown(e, tab.id, idx, e.currentTarget)}
              onClickCapture={(e) => {
                if (consumeDrag()) {
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
              onClick={() => {
                setMenuOpen(false);
                onSelect(tab.id);
              }}
              onDoubleClick={() => beginRename(tab.id, tab.name)}
            >
              <span className="atw-tab-name">{tab.name}</span>
              {rows > 0 && <span className="atw-tab-meta">{rows}</span>}
              {!isLast && (
                <button
                  type="button"
                  className="atw-tab-x"
                  title={`关闭「${tab.name}」`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void confirmClose(tab);
                  }}
                >
                  <Icon name="x" size={11} strokeWidth={2.6} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 条尾：＋ / ⋯ 固定在滚动容器外（不随 tab 横向滚动，浮层也不被 overflow 裁掉） */}
      <div className="atw-tabs-tail" ref={menuRef}>
        <button type="button" className="atw-tab-add" title="新建标签页" onClick={onAdd}>
          <Icon name="plus" size={14} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className={`atw-tab-more${menuOpen ? ' is-on' : ''}`}
          title="当前表的更多操作"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <Icon name="more" size={14} strokeWidth={2} />
        </button>
        {menuOpen && activeTab && (
          <div className="atw-tab-menu">
            <button
              type="button"
              className="atw-tab-menu-item"
              onClick={() => {
                onCopyAsNew(activeTab.id);
                setMenuOpen(false);
              }}
            >
              <Icon name="copy" size={13} strokeWidth={2} />
              复制为新表
            </button>
            <button
              type="button"
              className="atw-tab-menu-item"
              onClick={() => beginRename(activeTab.id, activeTab.name)}
            >
              <Icon name="edit" size={13} strokeWidth={2} />
              重命名
            </button>
            <div className="atw-tab-menu-sep" />
            <button
              type="button"
              className="atw-tab-menu-item is-danger"
              disabled={isLast}
              title={isLast ? '至少要保留一个标签页' : `关闭「${activeTab.name}」`}
              onClick={() => {
                void confirmClose(activeTab);
                setMenuOpen(false);
              }}
            >
              <Icon name="trash" size={13} strokeWidth={2} />
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
