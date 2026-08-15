import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAgentChat } from './base/useAgentChat.js'
import { useProviders, load as loadProviders } from './base/settings/providerStore.js'
import AgentMessage from './AgentMessage.jsx'
import { sGet, sSet } from './base/storageAdapter.js'

/**
 * ════════════════════════════════════════════════════════════════
 * 画布 AI 助手 —— 聊天面板（复刻官方 _Component40.jsx）
 * ════════════════════════════════════════════════════════════════
 *
 * 【对应关系】
 *  官方 App-BX6o9fW5_components/_Component40.jsx：
 *   - 顶部标题栏（AI 图标 + 名字 + 会员标签 + 清空 + 关闭）
 *   - 消息列表（空状态欢迎语 / 消息气泡 / 思考中 / 错误）
 *   - 底部输入区（图片预览 / textarea / 模型切换 / 图片上传 / 发送·停止）
 *   - 宽度拖拽手柄（320~720px，localStorage 记忆）
 *   - 挂载时读 agent 配置（官方 ar(e) → {displayName,systemPrompt,...}；原型用静态默认）
 *
 * 【与官方的差异（原型适配）】
 *  1. 对话状态：官方用 dr() hook；本实现用 useAgentChat（见 useAgentChat.js，
 *     已把工具执行接入 useCanvasAgentTools）。
 *  2. 会员/启用校验：官方 ar(e) 校验 VIP；原型无登录，默认放行（allowed/enabled 恒 true）。
 *  3. 模型列表：官方 ze() 从后端取；原型用静态内置列表（可 env 覆盖 VITE_AGENT_MODELS）。
 *  4. 视觉模型校验：保留官方逻辑（发送/上传图片前检查模型是否支持视觉）。
 *
 * 【props 契约（对齐官方挂载点 Vr.jsx:3685）】
 *  - open / onClose / onWidthChange?(width) / onEnabledChange?(bool)
 *  - agentKey（默认 canvas-assistant）
 *  - systemPrompt（可选，注入画布操作准则）
 * ════════════════════════════════════════════════════════════════
 */

const DEFAULT_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4o-vision-preview',
  'deepseek-chat',
  'Qwen/Qwen3-14B'
]

// 内置视觉模型集合（发送图片前校验；env 可追加 VITE_AGENT_VISION_MODELS，逗号分隔）
const VISION_MODELS = (() => {
  const env = import.meta.env?.VITE_AGENT_VISION_MODELS || ''
  const base = ['gpt-4o', 'gpt-4o-vision-preview', 'gpt-4-vision-preview', 'Qwen/Qwen3-14B']
  return env ? Array.from(new Set([...base, ...env.split(',').map((s) => s.trim()).filter(Boolean)])) : base
})()

// env 覆盖模型列表
const AGENT_MODELS = (() => {
  const env = import.meta.env?.VITE_AGENT_MODELS || ''
  return env ? env.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_MODELS
})()

const PANEL_WIDTH_KEY = 'agent_panel_width'
const MIN_WIDTH = 320
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 380

/** 面板宽度（localStorage 记忆，复刻官方 yr()） */
function loadWidth() {
  try {
    const t = sGet(PANEL_WIDTH_KEY)
    const n = t ? Number(t) : NaN
    if (Number.isFinite(n)) return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))
  } catch { /* ignore */ }
  return DEFAULT_WIDTH
}

export default function AgentPanel({ agentKey = 'canvas-assistant', systemPrompt = '', open, onClose, onWidthChange, onEnabledChange }) {
  // 面板宽度 + 拖拽态
  const [width, setWidth] = useState(loadWidth)
  const [dragging, setDragging] = useState(false)

  // 供应商配置（多 provider）：AI 助手需要「支持 function calling」的模型才能操作画布。
  // 优先用魔搭（modelscope，OpenAI 兼容且支持 tools）；找不到再回退主供应商 chat_models；最后内置兜底。
  const { providers } = useProviders()
  const primary = providers?.find((p) => p.isPrimary) || providers?.[0] || null
  // AI 助手实际使用的 provider：优先 modelscope（支持 tools），否则主供应商
  const agentProvider = useMemo(
    () => providers?.find((p) => p.id === 'modelscope') || primary || null,
    [providers, primary]
  )
  // 模型列表：优先 AI 助手 provider（魔搭）的 chat_models；无则回退内置列表
  const agentModels = useMemo(() => {
    const fromProvider = (agentProvider?.chat_models || []).map((m) => m.id || m.label || m).filter(Boolean)
    return fromProvider.length > 0 ? fromProvider : (AGENT_MODELS.length > 0 ? AGENT_MODELS : DEFAULT_MODELS)
  }, [agentProvider])

  // 挂载时确保供应商已加载（若未打开设置页，providers 为空 → 拉取主供应商；load 幂等）
  useEffect(() => {
    if (!providers || providers.length === 0) loadProviders().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 对话状态（替代官方 dr）；默认模型用 AI 助手 provider（魔搭）第一个 chat_model。
  // 传 provider 让 useAgentChat 经 /api/proxy 转发到该供应商（保留 function calling 画布操作）。
  const { messages, sending, error, model, setModel, send, stop, clear } = useAgentChat({
    agentKey,
    systemPrompt,
    defaultModel: agentModels[0],
    provider: agentProvider
  })

  // 输入 + 图片
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)

  // 模型下拉
  const [modelOpen, setModelOpen] = useState(false)
  const modelRef = useRef(null)

  // 图片上传 input ref
  const fileRef = useRef(null)

  // 消息滚动
  const scrollRef = useRef(null)

  // 当前模型是否支持视觉
  const isVision = useMemo(() => VISION_MODELS.includes(model), [model])

  // 宽度持久化 + 通知
  useEffect(() => {
    try { sSet(PANEL_WIDTH_KEY, String(width)) } catch { /* ignore */ }
  }, [width])
  useEffect(() => {
    if (open) onWidthChange?.(width)
  }, [open, width, onWidthChange])
  useEffect(() => {
    if (!open) onWidthChange?.(0)
  }, [open, onWidthChange])

  // 启用通知（原型恒放行）
  useEffect(() => {
    onEnabledChange?.(true)
  }, [onEnabledChange])

  // 宽度拖拽（复刻官方 N：左边缘 6px 手柄）
  const startDrag = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
    const onMove = (ev) => {
      const w = window.innerWidth - ev.clientX
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)))
    }
    const onUp = () => {
      setDragging(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // 点击外部关闭模型下拉
  useEffect(() => {
    if (!modelOpen) return
    const handler = (e) => {
      if (modelRef.current && !modelRef.current.contains(e.target)) setModelOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [modelOpen])

  // 消息滚动到底部
  const lastMsg = messages[messages.length - 1]
  const scrollKey = (lastMsg ? (lastMsg.content?.length || 0) + (lastMsg.reasoning?.length || 0) : 0) + (messages.length) + (sending ? 1 : 0)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [scrollKey])

  // 发送
  const handleSend = () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || sending) return
    if (attachments.length > 0 && !isVision) {
      const fallback = VISION_MODELS[0]
      alert(`当前模型 ${model} 不支持视觉，请切换到 ${fallback} 等视觉模型后再发送`)
      return
    }
    const attach = attachments.length > 0 ? attachments.map(({ type, url }) => ({ type, url })) : undefined
    setAttachments([])
    setInput('')
    Promise.resolve(send(text, attach)).catch((e) => console.error('[Agent] send 失败:', e))
  }

  // 选择图片（复刻官方 pe：仅 image/*，逐张上传）
  const handleFiles = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (!isVision) {
      const fallback = VISION_MODELS[0]
      alert(`当前模型 ${model} 不支持视觉，请先切换到 ${fallback} 等视觉模型`)
      e.target.value = ''
      return
    }
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        if (!f.type.startsWith('image/')) continue
        const localUrl = URL.createObjectURL(f)
        // 原型：图片以 dataURL 作为 url（不走后端上传）。接真系统：调 localTool /api/upload 拿 CDN url。
        try {
          const dataUrl = await blobToDataURL(f)
          setAttachments((prev) => [...prev, { type: 'image', url: dataUrl, localUrl }])
        } catch (err) {
          URL.revokeObjectURL(localUrl)
          alert(`图片读取失败：${err?.message || err}`)
        }
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeAttachment = (idx) => {
    setAttachments((prev) => {
      const item = prev[idx]
      if (item?.localUrl) URL.revokeObjectURL(item.localUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // 清空（复刻官方：confirm 后 clear）
  const handleClear = () => {
    if (window.confirm('清空当前会话的所有消息？')) clear()
  }

  if (!open) return null

  const AI_ICON = (
    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border border-edge flex items-center justify-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    </span>
  )

  return (
    <div className={`absolute top-0 right-0 bottom-0 bg-surface-deep border-l border-edge-faint flex flex-col z-30 shadow-2xl ${dragging ? 'select-none' : ''}`} style={{ width }}>
      {/* 宽度拖拽手柄 */}
      <div
        onMouseDown={startDrag}
        className={`absolute left-[-3px] top-0 bottom-0 w-[6px] cursor-col-resize z-40 hover:bg-blue-500/30 ${dragging ? 'bg-blue-500/40' : ''}`}
        title="拖动调整宽度"
      />

      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-edge-faint">
        <div className="flex items-center gap-2">
          {AI_ICON}
          <div>
            <div className="text-white text-sm font-medium">AI 助手</div>
            <div className="text-caption text-yellow-500 font-medium">画布助手</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={handleClear} disabled={sending || messages.length === 0} className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="清空对话">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover rounded-md transition-colors" title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-gray-500 text-xs text-center mt-8">
            <div className="mb-1">你好！我是画布 AI 助手</div>
            <div className="text-gray-600 mb-3 leading-relaxed">说一句话，我就能在画布上帮你创建节点、连接数据流、触发图片/文本/视频生成，还能批量整理、聚焦视口、撤销重做。</div>
            <div className="text-gray-600">试试说：</div>
            <div className="mt-2 space-y-1 text-gray-500">
              <div className="bg-canvas border border-edge-faint rounded-md px-3 py-2">「帮我生成一张赛博朋克风格的猫咪图」</div>
              <div className="bg-canvas border border-edge-faint rounded-md px-3 py-2">「把选中的节点改成 9:16」</div>
              <div className="bg-canvas border border-edge-faint rounded-md px-3 py-2">「把文本节点连到生图节点并生成」</div>
              <div className="bg-canvas border border-edge-faint rounded-md px-3 py-2">「把所有生图节点锁定，并聚焦到第一个」</div>
              <div className="bg-canvas border border-edge-faint rounded-md px-3 py-2">「撤销刚才的操作」</div>
            </div>
          </div>
        )}
        {messages.map((m, i) => <AgentMessage key={i} message={m} />)}
        {sending && (
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span>思考中...</span>
          </div>
        )}
        {error && <div className="text-red-400 text-xs bg-red-950/30 border border-red-800/30 rounded-md px-3 py-2">{error}</div>}
      </div>

      {/* 输入区 */}
      <div className="px-3 py-3 border-t border-edge-faint">
        <div className="bg-canvas border border-edge rounded-lg focus-within:border-blue-500 transition-colors">
          {(attachments.length > 0 || uploading) && (
            <div className="flex flex-wrap gap-2 px-2 pt-2">
              {attachments.map((a, i) => (
                <span key={i} className="relative w-12 h-12 rounded-md overflow-hidden border border-edge group">
                  <img src={a.localUrl || a.url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeAttachment(i)} className="absolute top-0 right-0 w-4 h-4 bg-black/70 hover:bg-black text-white text-caption flex items-center justify-center rounded-bl-md" title="移除">×</button>
                </span>
              ))}
              {uploading && (
                <span className="w-12 h-12 rounded-md border border-edge bg-surface flex items-center justify-center">
                  <span className="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
                </span>
              )}
            </div>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="输入消息，回车发送，Shift+Enter 换行"
            rows={2}
            disabled={sending}
            className="w-full bg-transparent text-gray-200 text-sm px-3 py-2 resize-none focus:outline-none disabled:opacity-60"
            style={{ minHeight: '60px', maxHeight: '160px' }}
          />
          <div className="flex items-center justify-between px-1.5 py-1.5 border-t border-edge-faint">
            <div className="flex items-center gap-1">
              {/* 模型切换 */}
              <span ref={modelRef} className="relative">
                <button type="button" onClick={() => setModelOpen(!modelOpen)} disabled={sending} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-surface rounded transition-colors disabled:opacity-50 max-w-[200px]" title="切换模型">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                  </svg>
                  <span className="shrink-0 px-1 rounded text-meta leading-[14px] border bg-white/10 text-white/90 border-white/30">{agentProvider?.name || '内置'}</span>
                  <span className="truncate">{model}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${modelOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {modelOpen && (
                  <div className="absolute bottom-full left-0 mb-1 w-[260px] max-h-[280px] overflow-y-auto bg-surface border border-edge rounded-lg shadow-2xl z-50 py-1 custom-scrollbar">
                    {agentModels.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-gray-500 text-center">暂无可用模型</div>
                    ) : agentModels.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setModel(id); setModelOpen(false) }}
                        className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors ${id === model ? 'bg-surface-hover-strong text-white' : 'text-gray-400 hover:bg-surface-hover hover:text-gray-200'}`}
                        title={id}
                      >
                        <span className="shrink-0 px-1 rounded text-meta leading-[14px] border bg-white/10 text-white/90 border-white/30">{agentProvider?.name || '内置'}</span>
                        <span className="flex-1 truncate font-mono">{id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </span>

              {/* 图片上传 */}
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!isVision || uploading || sending}
                className={`p-1.5 rounded transition-colors ${isVision ? 'text-gray-400 hover:text-gray-200 hover:bg-surface' : 'text-gray-600 cursor-not-allowed'} disabled:cursor-not-allowed`}
                title={isVision ? '上传参考图' : `当前模型不支持视觉，请切换到 ${VISION_MODELS[0]} 等`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
            </div>

            {sending ? (
              <button type="button" onClick={stop} className="w-7 h-7 flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white rounded-full transition-colors cursor-pointer" title="停止">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button type="button" onClick={handleSend} className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer ${input.trim() || attachments.length > 0 ? 'bg-white hover:bg-gray-200 text-black' : 'bg-surface-hover text-gray-500 cursor-not-allowed'}`} title="发送">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** File → dataURL（原型本地图片转 url；接真系统可改走上传接口拿 CDN url） */
function blobToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}
