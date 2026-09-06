import React, { useRef, useState, type ReactNode } from 'react';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { useOutsideClick } from '../core/uiHooks.ts';
import './panel-kit.css';

/**
 * ════════════════════════════════════════════════════════════════
 * 面板外壳通用件（PanelBar.tsx）
 * ════════════════════════════════════════════════════════════════
 *
 * 【为什么抽】左侧栏 4 个 tab（任务 / 生成 / 素材 / 提示词）此前各自实现了一遍
 *   「副工具条 + pill 组 + ⋯ 菜单」，其中 pill 的「按住横向拖动滚动 + 拖动超阈值不误触点击」
 *   在 GeneratedView / AssetLibrary 里各写了一份（两份逻辑相同）。本文件收成唯一实现，
 *   视觉与交互统一走 panel-kit.css。
 *
 * 【边界】这里只管**外壳**（条 / pill / 菜单），不碰各面板的数据与业务：
 *   · 上传、拖到画布、新建文件夹、重命名、清理任务等动作仍由各面板自己实现并传入 onClick；
 *   · 拖拽到画布（makeAssetDragProps / useAssetCardDragProps）不在本文件，保持在各面板内。
 */

/** pill 项：key 为选中值，label 为显示文案 */
export interface PanelPillItem {
  key: string;
  label: string;
  title?: string;
}

/**
 * 可横滚的 pill 组（类型 / 目录 / 来源筛选共用）。
 * 保留既有两个行为：① 按住左右拖动 = 横向滚动；② 拖动超过 4px 时吞掉这次 click（防误触切换）。
 */
export function PanelPills({
  items,
  value,
  onChange,
  leading,
}: {
  items: PanelPillItem[];
  value: string;
  onChange: (key: string) => void;
  /** 前置项（如进入子目录后的「返回上级」），渲染在 pill 最左侧 */
  leading?: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ down: false, startX: 0, startScroll: 0, moved: false });

  const onMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = { down: true, startX: e.clientX, startScroll: el.scrollLeft, moved: false };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    const el = scrollRef.current;
    if (!d.down || !el) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 4) d.moved = true;
    el.scrollLeft = d.startScroll - dx;
  };
  const endDrag = () => {
    dragRef.current.down = false;
  };
  // 捕获阶段拦截：拖动过就把这次点击吞掉，避免"拖一下就切了筛选"
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragRef.current.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div
      ref={scrollRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onClickCapture={onClickCapture}
      className="pk-pills cursor-grab active:cursor-grabbing select-none"
    >
      {leading}
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          title={it.title}
          aria-pressed={value === it.key}
          className="pk-pill"
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** 顶栏下的副工具条（38px）：左侧放 pill / 统计，右侧放主操作与「⋯」 */
export function PanelSubBar({ children }: { children: ReactNode }) {
  return <div className="pk-sub">{children}</div>;
}

/** 列表底部统计（如「共 42 条」「已全部加载（共 6 个）」） */
export function PanelListFoot({ children }: { children: ReactNode }) {
  return <div className="pk-list-foot">{children}</div>;
}

export interface PanelMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * 「⋯」更多菜单：4 个 tab 共用（生成 / 素材 / 提示词的菜单项已合并为同一份配置形态）。
 * 视觉对齐 agent-pop（surface-1 + edge + radius 12），点击菜单外自动关闭。
 */
export function PanelMoreMenu({
  items,
  title = '更多操作',
  size = 'sm',
}: {
  items: PanelMenuItem[];
  title?: string;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClick(wrapRef, open, () => setOpen(false));

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        type="button"
        title={title}
        className={`pk-icon-btn ${size === 'sm' ? 'is-sm' : ''} ${open ? 'is-on' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={size === 'sm' ? 15 : 16} />
      </button>
      {open && (
        <div className="pk-pop is-more nowheel nopan nodrag">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <React.Fragment key={it.key}>
                {i > 0 && <div className="pk-pop-div" />}
                <button
                  type="button"
                  disabled={it.disabled}
                  className={`pk-pop-row ${it.danger ? 'is-danger' : ''}`}
                  onClick={() => {
                    setOpen(false);
                    it.onClick();
                  }}
                >
                  {Icon && <Icon size={13} />}
                  {it.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
