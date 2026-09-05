import React, { useState, useRef, type ReactNode } from 'react'
import { Coins, LayoutGrid } from 'lucide-react'
import { useOutsideClick } from '../core/uiHooks.ts'

/**
 * 模型 badge 元信息：
 * - 'scheduled' → 调度（蓝）｜'third' → 三方（灰）｜'builtin'/空 → 内置（白）
 * - 其它字符串 → 直接作为标签（供应商自定义名，如 API 设置里起的名字）
 */
/** 单个模型项形状。跨厂商聚合时由 buildAllModels 产出：id=`providerId::modelId`、badge=厂商名。 */
interface ModelItem {
  id: string
  label?: string
  /** 'builtin' | 'third' | 'scheduled' | 其它字符串直接作标签；多 provider 聚合时为 provider 名 */
  badge?: string
  cost?: number
  providerId?: string
}

/**
 * 模型选择下拉 —— 扁平列出所有模型（2026-09-03 收口）。
 *
 * 【为什么扁平（用户裁定）】节点（文本/生图/视频）模型下拉应直接显示「用户已配置的所有模型的模型清单」，
 * 一次全列、无「服务商→模型」两级与返回按钮。模型项带厂商名 badge（来自 buildAllModels 的 badge=provider 名），
 * 便于区分不同厂商同 id 模型。选中 value 形如 `providerId::modelId`，与下游 resolveProviderModel 兼容。
 */

function badgeMeta(badge: string): { label: string; className: string } {
  if (badge === 'scheduled') return { label: '调度', className: 'border-blue-400 text-blue-300' }
  if (badge === 'third') return { label: '三方', className: 'border-edge-raised text-body' }
  if (badge && badge !== 'builtin') return { label: badge, className: 'border-white/30 text-white/90' }
  return { label: '内置', className: 'border-white/30 text-white/90' }
}

/** 模型选择下拉 Props */
interface ModelSelectProps {
  value?: string
  onChange: (id: string) => void
  models?: ModelItem[]
  placeholder?: string
  costMap?: Record<string, number>
  popupTo?: 'up' | 'down'
  showDivider?: boolean
  labelMaxWidth?: string
  /**
   * 图标化触发器：只渲染一个图标按钮，不显示模型名与厂商 badge。
   * 供窄容器（如 AI 助手底部工具栏去文字化）使用；默认 false，保持原有带文字形态，
   * 其余调用方（节点模型选择等）视觉零变化。
   */
  iconOnly?: boolean
  /** iconOnly 时的自定义图标（不传则用默认 cpu 图标） */
  icon?: ReactNode
  /** iconOnly 时触发器按钮的 title（模型名放这里，避免占用横向空间） */
  triggerTitle?: string
  /** iconOnly 时触发器是否呈激活高亮（如「已选非默认模型」） */
  active?: boolean
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
  active = false
}: ModelSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutsideClick(ref, open, () => setOpen(false))

  const badge = (id: string) => models.find((m) => m.id === id)?.badge || 'builtin'
  const selectedItem = models.find((m) => m.id === value)
  const selectedBadge = badgeMeta(badge(value))

  const choose = (m: ModelItem) => { onChange(m.id); setOpen(false) }

  const renderModelRow = (m: ModelItem) => {
    const selected = value === m.id
    const itemBadge = badgeMeta(m.badge || 'builtin')
    const cost = costMap[m.id]
    return (
      <div
        key={m.id}
        role="button"
        className={`flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors cursor-pointer ${selected ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
        onMouseDown={(e) => { e.preventDefault(); choose(m) }}
      >
        <span className={`shrink-0 px-1 rounded text-meta leading-[14px] border bg-white/10 ${itemBadge.className}`}>
          {itemBadge.label}
        </span>
        <span className="flex-1 whitespace-nowrap">{m.label || m.id}</span>
        {cost != null && (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-caption text-orange-400 tabular-nums">
            <Coins className="w-2.5 h-2.5" strokeWidth={2.5} />{cost}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="relative nodrag flex items-center min-w-0" ref={ref}>
      {showDivider && <div className="w-[1px] h-3 bg-surface-3 flex-shrink-0 mr-1.5" />}
      {iconOnly ? (
        <button
          type="button"
          className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors cursor-pointer ${
            active ? 'text-[#60a5fa] bg-[#3b82f6]/10' : 'text-muted hover:text-primary hover:bg-surface-hover'
          }`}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          title={triggerTitle || (value ? `生图模型：${selectedItem?.label || value}（${selectedBadge.label}）` : '选择生图模型')}
        >
          {/* 图标：LayoutGrid（四宫格，更贴合"图像模型/图集"语义，替代 CPU 芯片） */}
          {icon || <LayoutGrid className="w-4 h-4" strokeWidth={1.8} />}
        </button>
      ) : (
        <button
          type="button"
          className="flex items-center gap-1 h-6 px-2 min-w-0 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
          title={value ? `${value}（${selectedBadge.label}）` : '选择模型'}
        >
          <span className={`shrink-0 px-1 rounded text-meta leading-[14px] border bg-white/10 ${selectedBadge.className}`}>
            {selectedBadge.label}
          </span>
          <span className={`whitespace-nowrap overflow-hidden text-ellipsis ${labelMaxWidth ? 'min-w-0' : ''}`} style={labelMaxWidth ? { maxWidth: labelMaxWidth } : undefined}>{selectedItem?.label || value || placeholder}</span>
        </button>
      )}

      {open && (
        <div
          className={`absolute ${popupTo === 'down' ? 'top-full left-0 mt-1' : 'bottom-full left-0 mb-1'} min-w-[17rem] w-max max-w-[29rem] bg-surface-1 border border-edge rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}
          onClick={(e) => e.stopPropagation()}
        >
          {models.length === 0 ? (
            <div className="px-2 py-1 text-caption-sm text-muted whitespace-nowrap">无可用模型（请在服务商设置中配置）</div>
          ) : (
            models.map(renderModelRow)
          )}
        </div>
      )}
    </div>
  )
}

export default React.memo(ModelSelect)