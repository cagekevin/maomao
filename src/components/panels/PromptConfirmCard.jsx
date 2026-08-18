import { useState } from 'react'
import {
  ensureCurrentPrompt, confirmPrompt, editPrompt, savePromptEdit,
  cancelPromptEdit, reopenPrompt, confirmAllPrompts, PROMPT_STATUS,
} from '../base/promptFlow.js'

const P = PROMPT_STATUS

/** 状态图标（对齐大雄 3848：✓/×/▶/○） */
function StatusIcon({ status }) {
  if (status === P.CONFIRMED) return <span className="text-emerald-400">✓</span>
  if (status === P.SKIPPED) return <span className="text-gray-500">×</span>
  if (status === P.CURRENT || status === P.EDITING) return <span className="text-sky-400">▶</span>
  return <span className="text-gray-600">○</span>
}

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
export default function PromptConfirmCard({ prompts = [], onUpdatePrompts, onGenerate, requestedCount = 0 }) {
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
    <div className="mt-2 border border-edge-faint rounded-md bg-[#0a0a0a]">
      <div className="px-2.5 py-1.5 text-caption-sm text-gray-400 border-b border-edge-subtle">
        📝 提示词确认{countHint}{progress}
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
                <span className="text-gray-500">#{i + 1}</span>
                <span className="text-gray-300 truncate flex-1">{shortText}</span>
              </div>
              {p.status === P.EDITING && (
                <textarea
                  className="mt-1 w-full text-caption-sm text-gray-200 bg-surface border border-edge rounded-md px-2 py-1.5 focus:outline-none focus:border-sky-500"
                  rows={3}
                  defaultValue={p.prompt || ''}
                  onChange={(e) => setDraft(e.target.value)}
                />
              )}
              {p.status === P.CURRENT && (
                <div className="mt-1 flex items-center gap-1.5">
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer" onClick={() => apply(confirmPrompt(prompts))}>
                    ✓ 确认
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-surface hover:bg-surface-hover text-gray-300 border border-edge rounded-md cursor-pointer" onClick={() => { setDraft(p.prompt || ''); onUpdatePrompts?.(editPrompt(prompts, i)) }}>
                    ✎ 修改
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-surface hover:bg-surface-hover text-gray-300 border border-edge rounded-md cursor-pointer" title="重新生成此条提示词">
                    ⟳ 重新生成
                  </button>
                </div>
              )}
              {p.status === P.EDITING && (
                <div className="mt-1 flex items-center gap-1.5">
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer" onClick={() => apply(savePromptEdit(prompts, i, draft))}>
                    ✓ 保存并确认
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 px-2 py-1 text-caption-sm bg-surface hover:bg-surface-hover text-gray-300 border border-edge rounded-md cursor-pointer" onClick={() => onUpdatePrompts?.(cancelPromptEdit(prompts, i))}>
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
              全部确认并生成
            </button>
          )}
        </div>
      )}
    </div>
  )
}
