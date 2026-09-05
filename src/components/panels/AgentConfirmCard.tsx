import { memo, type ReactNode } from 'react'

/**
 * ════════════════════════════════════════════════════════════════
 * AI 助手 —— 统一确认卡（策划确认 / 记忆确认 / 积分确认共用）
 *
 * 【2026-09-05 标注】此确认卡 UI 框架保留，未来改造为给表格（分镜工作区）'整表/批量确认后生成'使用。
 * 当前数据源（AI 策划的 generations）在 Skill 三阶段删除后失去主要触发者，将由表格行驱动。
 * 勿删此组件，勿当死代码。现仍被 credit 积分闸 / memory_suggest 记忆确认消费。
 *
 * 统一视觉语言（与 Reasoning / GenerationStepsCard 折叠卡同源）：
 *   · 容器：surface-sunken 底 + edge-faint 边 + rounded-md
 *   · 主按钮：emerald 绿（唯一强调色，不再出现黄/琥珀）
 *   · 副按钮：中性灰；图标一律 SVG（不用 emoji）
 *   · 圆角统一 rounded-md
 * ════════════════════════════════════════════════════════════════
 */
interface AgentConfirmCardProps {
  /** 标题行图标（SVG） */
  icon?: ReactNode
  /** 卡片标题 */
  title: string
  /** 说明文案 */
  desc?: string
  /** 主按钮文案（默认「确认」） */
  confirmText?: string
  /** 副按钮文案（默认「取消」） */
  cancelText?: string
  /** 确认回调 */
  onConfirm?: () => void
  /** 取消回调（不传则不显示取消按钮） */
  onCancel?: () => void
  /** 确认按钮禁用 */
  disabled?: boolean
}

function AgentConfirmCard({ icon, title, desc, confirmText = '确认', cancelText = '取消', onConfirm, onCancel, disabled = false }: AgentConfirmCardProps) {
  return (
    <div className="mt-2 border border-edge-faint rounded-md bg-surface-sunken">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-caption-sm text-body">
        {icon && <span className="text-emerald-400 shrink-0 flex">{icon}</span>}
        <span className="font-medium truncate">{title}</span>
      </div>
      <div className="px-2.5 pb-2 border-t border-edge-subtle">
        {desc && <div className="pt-1.5 text-caption text-muted whitespace-pre-wrap break-words leading-snug">{desc}</div>}
        <div className="flex items-center gap-1.5 mt-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled || !onConfirm}
            className="inline-flex items-center gap-1 px-3 py-1 text-caption-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {confirmText}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm text-muted-2 hover:text-white hover:bg-surface rounded-md transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(AgentConfirmCard)
