import { memo, useState } from 'react'
import {
  ensureCurrentPrompt, confirmPrompt, editPrompt, savePromptEdit,
  cancelPromptEdit, reopenPrompt, confirmAllPrompts, PROMPT_STATUS,
} from '../base/promptFlow.js'

const P = PROMPT_STATUS

/** 状态图标（SVG，不用 emoji/字符）：✓ 已确认 / × 已跳过 / ▶ 进行中 / ○ 待处理 */
const StatusIcon = memo(function StatusIcon({ status }) {
  const s = 'shrink-0'
  if (status === P.CONFIRMED) {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-emerald-400 ${s}`}><polyline points="20 6 9 17 4 12" /></svg>
  }
  if (status === P.SKIPPED) {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-500 ${s}`}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  }
  if (status === P.CURRENT || status === P.EDITING) {
    return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className={`text-sky-400 ${s}`}><polygon points="5 3 19 12 5 21 5 3" /></svg>
  }
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-gray-600 ${s}`}><circle cx="12" cy="12" r="9" /></svg>
})

/**
 * ════════════════════════════════════════════════════════════════
 * prompts 逐条确认卡片（对齐大雄 agentMessageHtml 3832-3874 的「提示词确认」UI）
 * ════════════════════════════════════════════════════════════════
 *
 * 【它解决什么】大雄在「无 Skill / 模糊需求 / 单次直出」场景让 LLM 直接输出 prompts 数组，
 *   用户逐条确认/修改/重新生成，全部确认后才转 generations 生图。本组件是该交互的 React 版：
 *   - 每条 prompt 一个列表项，状态图标 + 序号 + 文本；
 *   - current：确认 / 修改 / 重新生成 三按钮（对齐大雄 3857）；
 *   - editing：textarea 内联编辑 + 保存并确认 / 取消（对齐大雄 3858-3863）；
 *   - confirmed/skipped：点击整项可反悔 reopen（对齐大雄 3852-3853 + reopenAgentPrompt 8573）；
 *   - 底部：全部确认并生成 + 全部取消（对齐大雄 3866-3872）。
 *
 * 【状态机】复用 promptFlow.js（纯逻辑、可单测）。每次操作调用 promptFlow 返回新数组，
 *   通过 onUpdatePrompts 写回消息；操作触发「全部确认转生图」时调用 onGenerate(generations)。
 *
 * 【 props 】
 *  @param {Array} prompts   规范化后的 prompts 数组 [{prompt,count,status,attachment_indices}]
 *  @param {Function} onUpdatePrompts(newPrompts) 更新消息里的 prompts（写回 history）
 *  @param {Function} onGenerate(generations)     全部确认后触发生图（执行 generations）
 *  @param {number} [requestedCount] 用户请求数量（用于数量校验提示，对齐大雄 3838）
 */
function PromptConfirmCard({ prompts = [], onUpdatePrompts, onGenerate, requestedCount = 0 }) {
  const [draft, setDraft] = useState('') // 当前 editing 项的编辑草稿
  if (!Array.isArray(prompts) || prompts.length === 0) return null

  const currentIdx = prompts.findIndex((p) => p.status === P.CURRENT || p.status === P.EDITING)
  const hasUnresolved = prompts.some((p) => p.status === P.PENDING || p.status === P.CURRENT || p.status === P.EDITING)
  const confirmedCount = prompts.filter((p) => p.status === P.CONFIRMED).length
  const skippedCount = prompts.filter((p) => p.status === P.SKIPPED).length
  const countHint = (requestedCount > 0 && requestedCount !== prompts.length) ? ` · 请求${requestedCount}张/返回${prompts.length}条` : ''
  const progressParts = []
  if (confirmedCount > 0) progressParts.push(`${confirmedCount}已确认`)
  if (skippedCount > 0) progressParts.push(`${skippedCount}已跳过`)
  const progress = progressParts.length ? ` · ${progressParts.join(' · ')}` : ''

  // 更新 prompts 到消息；若 done 则转生图
  const apply = (res, genPrompt) => {
    if (!res) return
    if (typeof onUpdatePrompts === 'function') onUpdatePrompts(res.prompts)
    if (res.done && res.generations && res.generations.length && typeof onGenerate === 'function') {
      onGenerate(res.generations, genPrompt)
    }
  }

  return (
    <div className="mt-2 border border-edge-faint rounded-md bg-surface-sunken">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-caption-sm text-body border-b border-edge-subtle">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span className="font-medium">提示词确认</span>
        {(countHint || progress) && <span className="ml-auto text-caption text-muted-2">{countHint}{progress}</span>}
      </div>
      <div className="divide-y divide-edge-subtle">
        {prompts.map((p, i) => {
          const shortText = (p.prompt || '').length > 40 ? (p.prompt || '').slice(0, 40) + '…' : (p.prompt || '')
          const canReopen = p.status === P.CONFIRMED || p.status === P.SKIPPED
          const itemClass = p.status === P.CONFIRMED ? 'bg-emerald-950/10' : p.status === P.SKIPPED ? 'opacity-50' : p.status === P.CURRENT || p.status === P.EDITING ? 'bg-sky-950/10' : ''
          return (
            <div
              key={i}
              className={`px-2.5 py-1.5 ${itemClass} ${canReopen ? 'cursor-pointer' : ''}`}
              onClick={canReopen ? () => apply(reopenPrompt(prompts, i)) : undefined}
              title={canReopen ? '点击反悔重新处理' : undefined}
            >
              <div className="flex items-center gap-1.5 text-caption-sm">
                <StatusIcon status={p.status} />
                <span className="text-muted">#{i + 1}</span>
                <span className="text-body truncate flex-1">{shortText}</span>
              </div>
              {p.status === P.EDITING && (
                <textarea
                  className="mt-1 w-full text-caption-sm text-primary bg-surface border border-edge rounded-md px-2.5 py-1.5 focus:outline-none focus:border-sky-500"
                  rows={3}
                  defaultValue={p.prompt || ''}
                  onChange={(e) => setDraft(e.target.value)}
                />
              )}
              {p.status === P.CURRENT && (
                <div className="mt-1 flex items-center gap-1.5">
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer" onClick={() => apply(confirmPrompt(prompts))}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    确认
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-surface hover:bg-surface-hover text-body border border-edge rounded-md cursor-pointer" onClick={() => { setDraft(p.prompt || ''); onUpdatePrompts?.(editPrompt(prompts, i)) }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    修改
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-surface hover:bg-surface-hover text-body border border-edge rounded-md cursor-pointer" title="重新生成此条提示词">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                    重新生成
                  </button>
                </div>
              )}
              {p.status === P.EDITING && (
                <div className="mt-1 flex items-center gap-1.5">
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer" onClick={() => apply(savePromptEdit(prompts, i, draft))}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    保存并确认
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-surface hover:bg-surface-hover text-body border border-edge rounded-md cursor-pointer" onClick={() => onUpdatePrompts?.(cancelPromptEdit(prompts, i))}>
                    取消
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {hasUnresolved && (
        <div className="px-2.5 py-1.5 border-t border-edge-subtle flex items-center gap-1.5">
          {prompts.length >= 2 && (
            <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer" onClick={() => apply(confirmAllPrompts(prompts))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              全部确认并生成
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default memo(PromptConfirmCard)
