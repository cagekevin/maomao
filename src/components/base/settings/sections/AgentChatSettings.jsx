import React from 'react'
import { Bot, Check } from 'lucide-react'
import { useProviders, load } from '../providerStore.js'
import { logger } from '../../logger.js'
import { showToast } from '../../toastStore.js'
import {
  loadAgentChatModel, saveAgentChatModel,
  loadAgentHistoryTurns, saveAgentHistoryTurns,
} from '../agentModelStore.js'
import SkillSettings from './SkillSettings.jsx'

/**
 * 设置分区 · AI 助手（样式对齐 SkillSettings 的 zinc 黑白系）。
 *  - 聊天模型：全局指定 AI 助手对话用哪个供应商 + 模型
 *  - Skill 管理：合并在此分区（左列表 + 右编辑）
 * 逻辑不变，仅样式统一到 Skill 面板风格。
 */
const selectCls = 'w-full bg-canvas border border-edge text-body text-sm px-3 py-2 rounded-xl outline-none focus:border-blue-500 transition-colors disabled:opacity-50'

export default function AgentChatSettings() {
  const { providers } = useProviders()
  const saved = loadAgentChatModel()
  const [providerId, setProviderId] = React.useState(saved?.providerId || '')
  const [modelId, setModelId] = React.useState(saved?.modelId || '')
  const [streamMode, setStreamMode] = React.useState(saved?.streamMode || 'stream')
  const [historyTurns, setHistoryTurns] = React.useState(() => String(loadAgentHistoryTurns())) // 历史回传轮数（数字输入，存字符串便于自由输入）

  React.useEffect(() => {
    if (!providers || providers.length === 0) load().catch((e) => logger.warn('provider', 'load-fail', { error: e?.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 可作聊天用的供应商（有 chat_models 或有默认模型；含内置 providerscope/主供应商）
  const chatProviders = (providers || []).filter((p) => {
    const hasChat = Array.isArray(p.chat_models) && p.chat_models.length > 0
    return hasChat || p.primary
  })

  const selectedProvider = chatProviders.find((p) => p.id === providerId) || chatProviders[0] || null
  const chatModels = (selectedProvider?.chat_models || []).map((m) => m.id || m.label || m).filter(Boolean)
  const modelOptions = Array.from(new Set(chatModels))
  const effectiveModelId = modelOptions.includes(modelId) ? modelId : (modelOptions[0] || '')

  const handleProviderChange = (pid) => {
    setProviderId(pid)
    const p = chatProviders.find((x) => x.id === pid)
    const models = (p?.chat_models || []).map((m) => m.id || m.label || m).filter(Boolean)
    const first = models[0] || ''
    setModelId(first)
    if (pid && first) {
      saveAgentChatModel({ providerId: pid, modelId: first, streamMode })
      showToast(`AI 聊天模型已设为 ${first}`, { type: 'success' })
    }
  }

  const handleModelChange = (mid) => {
    setModelId(mid)
    if (providerId && mid) {
      saveAgentChatModel({ providerId, modelId: mid, streamMode })
      showToast(`AI 聊天模型已设为 ${mid}`, { type: 'success' })
    }
  }

  const handleStreamModeChange = (mode) => {
    setStreamMode(mode)
    saveAgentChatModel({ providerId, modelId, streamMode: mode })
    showToast(mode === 'non-stream' ? '已设为非流式（不支持工具调用，仅对话）' : '已设为流式', { type: 'success' })
  }

  // 【过渡方案·2026-08-18】历史回传轮数：0=不回传、1=只上一轮、任意大=尽量多（≈不限）。
  // 允许自由输入任意非负整数；非法输入忽略不保存。实时读，下次发送立即生效。
  const handleHistoryTurnsChange = (e) => {
    const raw = e.target.value
    setHistoryTurns(raw) // 保留用户输入，允许临时为空/半输入
    if (raw === '') return // 空：暂存，不保存（等填完）
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return // 非法（负号/非数字）不保存
    saveAgentHistoryTurns(Math.floor(n))
    showToast(n === 0 ? '已设为不回传历史' : n === 1 ? '已设为只回传上一轮' : `已设为回传最近 ${Math.floor(n)} 轮`, { type: 'success' })
  }

  return (
    <>
      <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
        <div className="px-6 py-3.5 border-b border-edge-subtle flex items-baseline justify-between">
          <h3 className="settings-page-title flex items-center gap-2"><Bot size={15} className="text-secondary" /> AI 助手聊天模型</h3>
          <p className="text-xs text-muted">选择画布 AI 助手的对话模型</p>
        </div>
        <div className="px-6 py-4">
          <p className="text-xs text-muted mb-4">AI 助手在画布右侧面板的对话会用这里指定的模型。默认取聊天供应商的第一个模型；可在此手动指定。</p>

          {chatProviders.length === 0 ? (
            <div className="text-xs text-muted py-6 text-center border border-dashed border-edge rounded-xl">暂无可用的聊天供应商，请先在「第三方 API 配置」添加并拉取聊天模型</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
              <label className="block">
                <span className="block text-xs text-secondary mb-1.5">聊天供应商</span>
                <select value={selectedProvider?.id || ''} onChange={(e) => handleProviderChange(e.target.value)} className={selectCls}>
                  {chatProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}{p.primary ? '（主）' : ''}
                    </option>
                  ))}
                </select>
                {selectedProvider && modelOptions.length === 0 && (
                  <span className="block text-xs text-yellow-500 mt-1">该供应商暂无聊天模型，请先在模型清单中添加</span>
                )}
              </label>

              <label className="block">
                <span className="block text-xs text-secondary mb-1.5">聊天模型</span>
                <select
                  value={effectiveModelId}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={modelOptions.length === 0}
                  className={selectCls}
                >
                  {modelOptions.length === 0 ? (
                    <option value="">暂无模型</option>
                  ) : modelOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs text-secondary mb-1.5">响应方式</span>
                <select value={streamMode} onChange={(e) => handleStreamModeChange(e.target.value)} className={selectCls}>
                  <option value="stream">流式（推荐，支持工具调用）</option>
                  <option value="non-stream">非流式（仅对话，不支持工具）</option>
                </select>
              </label>
            </div>
          )}

          {providerId && modelId && (
            <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <Check size={12} /> 当前 AI 聊天模型：{modelId}
            </div>
          )}
        </div>
      </section>

      {/* 历史回传轮数（过渡方案·2026-08-18）：解决纯文字对话失忆 */}
      <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
        <div className="px-6 py-3.5 border-b border-edge-subtle flex items-baseline justify-between">
          <h3 className="settings-page-title flex items-center gap-2"><Bot size={15} className="text-secondary" /> 历史回传轮数</h3>
          <p className="text-xs text-muted">让 AI 记得上一轮说过什么（仅文字）</p>
        </div>
        <div className="px-6 py-4 max-w-3xl">
          <p className="text-xs text-muted mb-4">AI 助手默认只处理你最新的一句话（fresh-task 机制），可能导致「先反推提示词、再让它优化」时它忘了上文。这里可让它回传最近 N 轮对话的<b className="text-body">文字</b>。图片始终以编号引用、不会真图进上下文，不影响出图安全。</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="1"
              value={historyTurns}
              onChange={handleHistoryTurnsChange}
              className="w-32 bg-canvas border border-edge text-body text-sm px-3 py-2 rounded-xl outline-none focus:border-blue-500 transition-colors"
            />
            <span className="text-xs text-muted">
              0 = 不回传（默认行为）· 1 = 只上一轮 · 任意大 = 尽量多（约等于不限）
            </span>
          </div>
        </div>
      </section>

      {/* Skill 管理（与 AI 助手设置合并）：左列表 + 右编辑同屏 */}
      <SkillSettings />
    </>
  )
}
