import React, { useState, useRef } from 'react'
import { Coins, ChevronRight } from 'lucide-react'
import { useOutsideClick } from './hooks.ts'

/**
 * 模型 badge 元信息：
 * - 'scheduled' → 调度（蓝）｜'third' → 三方（灰）｜'builtin'/空 → 内置（白）
 * - 其它字符串 → 直接作为标签（供应商自定义名，如 API 设置里起的名字）
 */
/** 单个模型项形状（与上游 providers.yaml / 各节点 modelOptions 对齐）。 */
interface ModelItem {
  id: string
  label?: string
  /** 'builtin' | 'third' | 'scheduled' | 其它字符串直接作标签；多 provider 聚合时为 provider 名 */
  badge?: string
  cost?: number
  /** 多 provider 聚合时为 providerId（providerModels.buildAllModels 产出）；无则单 supplier/utils */
  providerId?: string
}

/**
 * 【两级「服务商→模型」容器型下拉】2026-09-03。
 * 当 models 含 providerId（来自 buildAllModels，value 为 `providerId::modelId`）时：
 *   - 首层列出各服务商（badge=provider 名 + 该商模型数），点击展开二层该商模型清单；
 *   - 当前选中模型的 provider 自动展开，便于直接改同商其它模型；
 *   - 选中模型 → onChange('providerId::modelId')，与旧扁平行为完全兼容（对外签名不变）。
 * 若 models 不含 providerId（单 provider / 旧数据），回退旧「扁平"模型列表」行为，零回归。
 */

function badgeMeta(badge: string): { label: string; className: string } {
  if (badge === 'scheduled') return { label: '调度', className: 'border-blue-400 text-blue-300' }
  if (badge === 'third') return { label: '三方', className: 'border-edge-raised text-body' }
  if (badge && badge !== 'builtin') return { label: badge, className: 'border-white/30 text-white/90' }
  return { label: '内置', className: 'border-white/30 text-white/90' }
}

/**
 * 模型选择下拉（复刻各节点「内置模型」选择）。
 *
 * @param props
 *  - value       当前选中模型
 *  - onChange    选中回调
 *  - models      模型数组 [{ id, label, badge, cost }]；badge: 'builtin'|'third'|'scheduled'
 *  - placeholder 未选时文案（默认「选择模型」）
 *  - costMap     模型→币消耗映射（可选，显示在选项右侧）
 */

/** 模型选择下拉 Props。 */
interface ModelSelectProps {
  /** 当前选中模型 id */
  value?: string
  /** 选中回调 (id) */
  onChange: (id: string) => void
  /** 模型数组 [{ id, label, badge, cost }] */
  models?: ModelItem[]
  /** 未选时文案（默认「选择模型」） */
  placeholder?: string
  /** 模型→币消耗映射（可选，显示在选项右侧） */
  costMap?: Record<string, number>
  /** 弹层方向：'up' 上 / 'down' 下，默认 up */
  popupTo?: 'up' | 'down'
  /** 是否显示左侧分隔线（默认 true） */
  showDivider?: boolean
  /** 标签最大宽度（如 '8rem'），超出省略 */
  labelMaxWidth?: string
}

function ModelSelect({
  value,
  onChange,
  models = [],
  placeholder = '选择模型',
  costMap = {},
  popupTo = 'up',
  showDivider = true,
  labelMaxWidth = ''
}: ModelSelectProps) {
  const [open, setOpen] = useState(false)
  // 两级模式：当前展开的服务商 id；null 表示停在首层（服务商列表）
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const ref = useRef(null)

  // 打开时点击外部自动关闭（公共 hook，见 hooks.js）
  useOutsideClick(ref, open, () => setOpen(false))

  const badge = (id: string) => {
    const item = models.find((m) => m.id === id)
    return item?.badge || 'builtin'
  }
  // 当前选中模型项（按钮上显示其 label，而不是裸 value——避免把 provider 前缀拼进去）
  const selectedItem = models.find((m) => m.id === value)
  // 当前选中模型的 badge 样式（外层按钮用）
  const selectedBadge = badgeMeta(badge(value))

  // ── 两级「服务商→模型」分组（2026-09-03）──
  // 判据：models 是否有任一含 providerId（buildAllModels 产出）→ 走分组；否则旧扁平行为。
  const hasProvider = models.some((m) => m.providerId)
  // 选中模型的 providerId：value 形如 `providerId::modelId` → 取前缀；否则从该项 providerId 取
  const selectedProviderId = React.useMemo(() => {
    if (!value) return null
    const sep = value.indexOf('::')
    if (sep > 0) return value.slice(0, sep)
    return models.find((m) => m.id === value)?.providerId || null
  }, [value, models])
  // 首层：按 providerId / badge 分组（无 providerId 时用 badge 或 'other' 兜底，防扁平项混入）
  const groups = React.useMemo(() => {
    if (!hasProvider) return []
    const map = new Map<string, ModelItem[]>()
    for (const m of models) {
      const k = (m.providerId || m.badge || 'other')
      const arr = map.get(k) || []
      arr.push(m)
      map.set(k, arr)
    }
    return [...map.entries()].map(([id, items]) => ({ id, name: items[0]?.badge || id, items }))
  }, [models, hasProvider])
  // 当前展开的服务商：用户点击优先；未点则默认展开选中模型所在商（便于直接改同商模型）
  const expandedId = activeProvider ?? selectedProviderId
  const expanded = groups.find((g) => g.id === expandedId)

  const openGroup = (id: string) => { setActiveProvider(id) }
  const backToProviders = () => { setActiveProvider(null) }
  const choose = (m: ModelItem) => { onChange(m.id); setActiveProvider(null); setOpen(false) }

  // 单个模型行（两层通用）
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
      <button
        type="button"
        className="flex items-center gap-1 h-6 px-2 min-w-0 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => { const nv = !v; if (nv) setActiveProvider(null); return nv }) }}
        title={value ? `${value}（${selectedBadge.label}）` : '选择模型'}
      >
        <span className={`shrink-0 px-1 rounded text-meta leading-[14px] border bg-white/10 ${selectedBadge.className}`}>
          {selectedBadge.label}
        </span>
        <span className={`whitespace-nowrap overflow-hidden text-ellipsis ${labelMaxWidth ? 'min-w-0' : ''}`} style={labelMaxWidth ? { maxWidth: labelMaxWidth } : undefined}>{selectedItem?.label || value || placeholder}</span>
      </button>

      {open && (
        <div
          className={`absolute ${popupTo === 'down' ? 'top-full left-0 mt-1' : 'bottom-full left-0 mb-1'} min-w-[17rem] w-max max-w-[29rem] bg-surface-1 border border-edge rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}
          onClick={(e) => e.stopPropagation()}
        >
          {!hasProvider ? (
            /* 旧扁平行为：单 provider / 无 providerId → 直接列模型（零回归） */
            models.map((m) => renderModelRow(m))
          ) : expanded ? (
            /* 二层：当前服务商的模型清单，带返回首层 */
            <>
              <div
                role="button"
                className="flex items-center gap-1 px-2 py-1 mb-1 text-caption-sm text-muted hover:text-body hover:bg-surface-hover rounded-md cursor-pointer"
                onMouseDown={(e) => { e.preventDefault(); backToProviders() }}
              >
                <ChevronRight size={12} className="-rotate-180" />
                <span>{expanded.name}</span>
              </div>
              {expanded.items.map((m) => renderModelRow(m))}
            </>
          ) : (
            /* 首层：各服务商（显示名 + 模型数） */
            groups.map((g) => {
              const current = g.id === selectedProviderId
              return (
                <div
                  key={g.id}
                  role="button"
                  className={`flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors cursor-pointer ${current ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
                  onMouseDown={(e) => { e.preventDefault(); openGroup(g.id) }}
                >
                  <span className={`shrink-0 px-1 rounded text-meta leading-[14px] border ${current ? 'border-blue-400 text-blue-300' : 'border-transparent text-body'}`}>
                    {g.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="flex-1 whitespace-nowrap">{g.name}</span>
                  <span className="shrink-0 text-caption text-muted tabular-nums">{g.items.length}</span>
                  <ChevronRight size={12} className="shrink-0 text-muted" />
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default React.memo(ModelSelect)
