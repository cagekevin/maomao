import React, { useState, useRef } from 'react';
import { Coins, LayoutGrid, type LucideIcon } from 'lucide-react';
import { useOutsideClick } from '@/components/base/core/interaction/uiHooks';
// 【TD-19-1】面板/行 chrome 与定位收口到共用窄原语（与 Select 同一份）
import DropdownPanel from './DropdownPanel.tsx';
import DropdownRow from './DropdownRow.tsx';

/**
 * 模型 badge 元信息：
 * - 'scheduled' → 调度（蓝）｜'third' → 三方（灰）｜'builtin'/空 → 内置（白）
 * - 其它字符串 → 直接作为标签（供应商自定义名，如 API 设置里起的名字）
 */
/** 单个模型项形状。跨厂商聚合时由 buildAllModels 产出：id=`providerId::modelId`、badge=厂商名。 */
interface ModelItem {
  id: string;
  label?: string;
  /** 'builtin' | 'third' | 'scheduled' | 其它字符串直接作标签；多 provider 聚合时为 provider 名 */
  badge?: string;
  cost?: number;
  providerId?: string;
}

/**
 * 模型选择下拉 —— 扁平列出所有模型（2026-09-03 收口）。
 *
 * 【为什么扁平（用户裁定）】节点（文本/生图/视频）模型下拉应直接显示「用户已配置的所有模型的模型清单」，
 * 一次全列、无「服务商→模型」两级与返回按钮。模型项带厂商名 badge（来自 buildAllModels 的 badge=provider 名），
 * 便于区分不同厂商同 id 模型。选中 value 形如 `providerId::modelId`，与下游 resolveProviderModel 兼容。
 */

function badgeMeta(badge: string): { label: string; className: string } {
  if (badge === 'scheduled') return { label: '调度', className: 'border-blue-400 text-blue-300' };
  if (badge === 'third') return { label: '三方', className: 'border-edge-raised text-body' };
  if (badge && badge !== 'builtin')
    return { label: badge, className: 'border-white/30 text-white/90' };
  return { label: '内置', className: 'border-white/30 text-white/90' };
}

/** 模型选择下拉 Props */
interface ModelSelectProps {
  value?: string;
  onChange: (id: string) => void;
  models?: ModelItem[];
  placeholder?: string;
  costMap?: Record<string, number>;
  popupTo?: 'up' | 'down';
  showDivider?: boolean;
  labelMaxWidth?: string;
  /**
   * 图标化触发器：只渲染一个图标按钮，不显示模型名与厂商 badge。
   * 供窄容器（如 AI 助手底部工具栏去文字化）使用；默认 false，保持原有带文字形态，
   * 其余调用方（节点模型选择等）视觉零变化。
   */
  iconOnly?: boolean;
  /** iconOnly 时的自定义图标 —— **传组件引用**（如 `icon={PackageIcon}`），**不传 element**。
      收组件引用而非 JSX 有两个硬理由（同 `NodeTitle.icon` 的契约）：
      ① 组件引用是模块级常量 ⇒ 引用天然稳定 ⇒ 不会击穿 `memo(ModelSelect)`；
      ② 图标尺寸/描边属**本组件**的呈现决定，不该由调用方各写一遍
         （此前 AgentPanel 传 `icon={<PackageIcon className="w-4 h-4" strokeWidth={1.8} />}`，
          与下方默认图标逐字同款样式 ⇒ 同一份样式两处维护）。
      【TD-04-53】改前是 `ReactNode` ⇒ 调用方**可以**传内联 element（每帧新建）⇒ memo 恒失效。
      收窄为 `LucideIcon` 后，传 element **`tsc` 直接不过** ⇒ 结构上不可能回潮（无需机器闸）。 */
  icon?: LucideIcon;
  /** iconOnly 时触发器按钮的 title（模型名放这里，避免占用横向空间） */
  triggerTitle?: string;
  /** iconOnly 时触发器是否呈激活高亮（如「已选非默认模型」） */
  active?: boolean;
}

function ModelSelect({
  value,
  onChange,
  models = [],
  placeholder = '选择模型',
  costMap = {},
  popupTo = 'up',
  showDivider = true,
  labelMaxWidth = '',
  iconOnly = false,
  icon,
  triggerTitle,
  active = false,
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  // 触发图标：调用方传组件引用则用它，否则用本组件默认（尺寸/描边归本组件所有）
  const TriggerIcon = icon ?? LayoutGrid;

  const badge = (id: string) => models.find((m) => m.id === id)?.badge || 'builtin';
  const selectedItem = models.find((m) => m.id === value);
  const selectedBadge = badgeMeta(badge(value ?? ''));

  const choose = (m: ModelItem) => {
    onChange(m.id);
    setOpen(false);
  };

  const renderModelRow = (m: ModelItem) => {
    const itemBadge = badgeMeta(m.badge || 'builtin');
    const cost = costMap[m.id];
    return (
      <DropdownRow key={m.id} selected={value === m.id} onSelect={() => choose(m)}>
        <span
          className={`shrink-0 px-1 rounded text-meta leading-[14px] border bg-white/10 ${itemBadge.className}`}
        >
          {itemBadge.label}
        </span>
        <span className="flex-1 whitespace-nowrap">{m.label || m.id}</span>
        {cost != null && (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-caption text-orange-400 tabular-nums">
            <Coins className="w-2.5 h-2.5" strokeWidth={2.5} />
            {cost}
          </span>
        )}
      </DropdownRow>
    );
  };

  return (
    <div className="relative nodrag flex items-center min-w-0" ref={ref}>
      {showDivider && <div className="w-[1px] h-3 bg-surface-3 flex-shrink-0 mr-1.5" />}
      {iconOnly ? (
        <button
          type="button"
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer ${
            active
              ? 'text-white bg-white/10'
              : 'text-muted hover:text-primary hover:bg-surface-hover'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          title={
            triggerTitle ||
            (value
              ? `生图模型：${selectedItem?.label || value}（${selectedBadge.label}）`
              : '选择生图模型')
          }
        >
          {/* 图标：默认 LayoutGrid（四宫格，更贴合"图像模型/图集"语义，替代 CPU 芯片）；
              尺寸/描边由本组件统一决定，调用方只说"用哪个图标" */}
          <TriggerIcon className="w-4 h-4" strokeWidth={1.8} />
        </button>
      ) : (
        <button
          type="button"
          className="flex items-center gap-1 h-6 px-2 min-w-0 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          title={value ? `${value}（${selectedBadge.label}）` : '选择模型'}
        >
          <span
            className={`shrink-0 px-1 rounded text-meta leading-[14px] border bg-white/10 ${selectedBadge.className}`}
          >
            {selectedBadge.label}
          </span>
          <span
            className={`whitespace-nowrap overflow-hidden text-ellipsis ${labelMaxWidth ? 'min-w-0' : ''}`}
            style={labelMaxWidth ? { maxWidth: labelMaxWidth } : undefined}
          >
            {selectedItem?.label || value || placeholder}
          </span>
        </button>
      )}

      {open && (
        <DropdownPanel popupTo={popupTo} widthClass="min-w-[17rem] w-max max-w-[29rem]">
          {models.length === 0 ? (
            <div className="px-2 py-1 text-caption-sm text-muted whitespace-nowrap">
              无可用模型（请在服务商设置中配置）
            </div>
          ) : (
            models.map(renderModelRow)
          )}
        </DropdownPanel>
      )}
    </div>
  );
}

export default React.memo(ModelSelect);
