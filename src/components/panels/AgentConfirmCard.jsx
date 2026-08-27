import { memo } from 'react'

/**
 * ════════════════════════════════════════════════════════════════
 * AI 助手 —— 统一确认卡（策划确认 / 记忆确认 / 积分确认共用）
 *
 * 统一视觉语言（与 Reasoning / GenerationStepsCard 折叠卡同源）：
 *   · 容器：surface-sunken 底 + edge-faint 边 + rounded-md
 *   · 主按钮：emerald 绿（唯一强调色，不再出现黄/琥珀）
 *   · 副按钮：中性灰；图标一律 SVG（不用 emoji）
 *   · 圆角统一 rounded-md
 * ════════════════════════════════════════════════════════════════
 *
 * @param {ReactNode} icon         标题行图标（SVG）
 * @param {string}    title        卡片标题
 * @param {string}    [desc]       说明文案
 * @param {string}    [confirmText] 主按钮文案（默认「确认」）
 * @param {string}    [cancelText]  副按钮文案（默认「取消」）
 * @param {Function}  onConfirm     确认回调
 * @param {Function}  [onCancel]    取消回调（不传则不显示取消按钮）
 * @param {boolean}   [disabled]    确认按钮禁用
 */
function AgentConfirmCard({ icon, title, desc, confirmText = '确认', cancelText = '取消', onConfirm, onCancel, disabled = false }) {
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
