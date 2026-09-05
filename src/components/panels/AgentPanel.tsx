import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// AI 助手专属样式表（agent-* 前缀，只服务本面板与 AgentMessage；AgentMessage 复用同一套类，无需重复 import）
import './agent-panel.css'
import { useAgentChat, setGenParams, getGenParams, getCreditSwitch, setCreditSwitch, type UseAgentChatReturn } from '../agent/index.ts'
import { useProviders, load as loadProviders } from '../base/store/providerStore.ts'
import AgentMessage from './AgentMessage.tsx'
import AgentConfirmCard from './AgentConfirmCard.tsx'
import ModelSelect from '../base/ui/ModelSelect.tsx'
import { Package as PackageIcon, SlidersHorizontal } from 'lucide-react'
import { buildAllModels } from '../base/utils/providerModels.ts'
import { useOutsideClick } from '../base/core/uiHooks.ts'
import { loadAgentChatModel, AGENT_CHAT_MODEL_KEY } from '../base/store/agentModelStore.ts'
import { getAllSkills, markSkillUsed, repairMojibakeText, isSkillEnabled } from '../base/store/skillStore.ts'
import { contentGet, contentSet, contentSubscribe } from '../base/core/contentStore.ts'
import { toAbsoluteFileUrl } from '../base/api/index.ts'
import { fileToDataUrl } from '../base/utils/imageUrl.ts'
import { runNodeGeneration } from '../base/store/taskStore.ts'
import { showToast } from '../base/core/toastStore.ts'
import { askConfirm } from '../base/core/confirmStore.ts'
import { logger } from '../base/core/logger.ts'
import previewUrls from '../base/utils/previewUrl.ts'
import { subscribe } from '../base/core/eventBus.ts'
import { CREDIT_GATE_EVENT } from '../base/core/contracts.ts'

/**
 * ════════════════════════════════════════════════════════════════
 * 画布 AI 助手 —— 聊天面板（以人为本：消息优先，面板按需展开）
 * ════════════════════════════════════════════════════════════════
 *
 * 布局原则：
 *  1. 标题栏极简固定，不占多余高度。
 *  2. 消息区 flex-1 独占剩余垂直空间， Skill / 生图参数 / 模型
 *     全部以浮层形式按需展开，从不常驻挤压消息列表。
 *  3. 底部 OneBox 输入区：参考图以内联 chip 形式出现；工具栏
 *     整合模式、附件、模型、参数、Skill、发送。
 *  4. 空态文案极简，只保留一句核心欢迎 + 横向快捷 chips。
 * ════════════════════════════════════════════════════════════════
 */

// 模型列表来自所选厂商在设置里实际配置的 chat_models（不再用 AGENT_MODELS 兜底）
const PANEL_WIDTH_KEY = 'agent_panel_width'
const AGENT_DRAFT_KEY = 'agent_draft'
const MIN_WIDTH = 320
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 400

/** 距底部 <= 该 px 即视为「已到底」：留余量规避小数像素/缩放导致的按钮闪烁 */
const BOTTOM_EPS = 60
/** scroll 事件静默该 ms 即认定平滑滚动动画结束（不依赖固定时长，长距离滚动同样准确） */
const SCROLL_IDLE_MS = 120

/** 面板宽度（localStorage 记忆） */
function loadWidth() {
  try {
    const t = contentGet(PANEL_WIDTH_KEY)
    const n = t ? Number(t) : NaN
    if (Number.isFinite(n)) return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))
  } catch { /* ignore */ }
  return DEFAULT_WIDTH
}

export default function AgentPanel({ agentKey = 'canvas-assistant', systemPrompt = '', open, onClose, onWidthChange, onEnabledChange, selectedImageNodes = [] }: {
  agentKey?: string
  systemPrompt?: string
  open?: boolean
  onClose?: () => void
  onWidthChange?: (w: number) => void
  onEnabledChange?: (enabled: boolean) => void
  selectedImageNodes?: Array<{ url: string; label?: string; nodeId?: string; nodeType?: string; x?: number; y?: number }>
}) {
  const [width, setWidth] = useState(loadWidth)
  const [dragging, setDragging] = useState(false)
  // 【设置即生效·方案 B】聊天模型配置（agent_chat_model）变更计数器。
  // 每次「设置 → AI 助手」改模型/供应商写入该键，contentSubscribe 回调自增此值，
  // 触发下方 agentProvider / agentModels / configuredModel 重算（它们原本只在挂载时算一次）。
  const [chatModelVersion, setChatModelVersion] = useState(0)

  const { providers } = useProviders()
  const primary = providers?.find((p) => p.primary) || providers?.[0] || null
  // AI 助手实际使用的 provider：优先「设置」里指定的聊天供应商，否则回退 modelscope / 主供应商
  const agentProvider = useMemo(() => {
    const cfg = loadAgentChatModel()
    if (cfg?.providerId) {
      const picked = providers?.find((p) => p.id === cfg.providerId)
      if (picked) return picked
    }
    return providers?.find((p) => p.id === 'modelscope') || primary || null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, primary, chatModelVersion])
  // AI 助手的可选模型：只用该 provider 在设置里实际配置的 chat_models。
  // 不拿硬编码 AGENT_MODELS 兜底——未配置的模型不应在 AI 助手设置里出现（用户裁定）。
  const agentModels = useMemo(() => {
    return (agentProvider?.chat_models || []).map((m) => m.id || m.label || m).filter(Boolean)
  }, [agentProvider])
  // AI 助手默认模型：优先「设置」里指定的聊天模型（用户显式选择，应直接生效，不依赖 providers 是否加载）；
  // 否则该 provider 第一个模型兜底。修复：刷新时 providers 异步加载，首次渲染若 providers 为空，
  // 配置的 modelId 会被忽略并落到 gpt-4o 兜底（见对话记录）。这里让配置的 modelId 直接优先。
  const configuredModel = useMemo(() => {
    const cfg = loadAgentChatModel()
    if (cfg?.modelId) return cfg.modelId
    return ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatModelVersion])
  // 默认模型必须是字符串模型 id（configuredModel 为 string；agentModels[0] 兜底时若为 RawModel
  //   （无 id/label 的退化项）则放弃，避免把对象当字符串传给 useAgentChat）。
  const defaultAgentModel = configuredModel ? configuredModel : (typeof agentModels[0] === 'string' ? agentModels[0] : '')

  // ── 生图参数 ──
  const genModels = useMemo(() => buildAllModels(providers || [], 'image'), [providers])
  const [genModel, setGenModel] = useState(() => getGenParams().model || '')
  const [genSize, setGenSize] = useState(() => getGenParams().resolution || '1K')
  const [genRatio, setGenRatio] = useState(() => getGenParams().ratio || 'Auto')
  const [genQuality, setGenQuality] = useState(() => (getGenParams() as { quality?: string }).quality || 'auto')
  useEffect(() => {
    if (!genModel && genModels.length > 0) {
      const first = genModels[0].id
      setGenModel(first)
      setGenParams({ model: first })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genModels])
  const onGenModel = (id) => { setGenModel(id); setGenParams({ model: id }) }
  const onGenSize = (s) => { setGenSize(s); setGenParams({ resolution: s }) }
  const onGenRatio = (r) => { setGenRatio(r); setGenParams({ ratio: r }) }
  const onGenQuality = (q) => { setGenQuality(q); setGenParams({ quality: q }) }
  const genSizeOptions = ['1K', '2K', '4K']
  const genRatioOptions = ['Auto', '1:1', '16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '21:9', '9:21', '1:3', '3:1']
  const genQualityOptions = [
    { value: 'auto', label: '自动' },
    { value: 'low', label: '低质量' },
    { value: 'medium', label: '中质量' },
    { value: 'high', label: '高质量' }
  ]
  const [genImgMenuOpen, setGenImgMenuOpen] = useState(false)
  const genImgMenuRef = useRef(null)
  useOutsideClick(genImgMenuRef, genImgMenuOpen, () => setGenImgMenuOpen(false))

  useEffect(() => {
    if (!providers || providers.length === 0) loadProviders().catch((e) => logger.warn('provider', 'load-fail', { error: e?.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Skill 系统 ──
  // 只展示已启用的 Skill（设置页中关闭的 Skill 不显示在可选列表里）
  const [allSkills, setAllSkills] = useState(() => getAllSkills().filter((s) => isSkillEnabled(s.id)))
  const [activeSkills, setActiveSkills] = useState([])
  const [skillSlashOpen, setSkillSlashOpen] = useState(false)
  const skillSlashRef = useRef(null)
  useOutsideClick(skillSlashRef, skillSlashOpen, () => setSkillSlashOpen(false))
  // 底部「Skill」按钮 → 应用 Skill 下拉（管理已移至设置页 AI 助手分区，面板只做「使用」）
  const [skillPickOpen, setSkillPickOpen] = useState(false)
  const skillPickRef = useRef(null)
  useOutsideClick(skillPickRef, skillPickOpen, () => setSkillPickOpen(false))
  // skills 变化 → 同步到 conversationStore（重构后 setCurrentSnapshot 内部自动落盘，
  // 且带 hydrated 时序守卫：挂载早期不会用空数据覆盖 localStorage 已有记录）
  useEffect(() => {
    setCurrentSnapshot({ skills: activeSkills })
  }, [activeSkills])
  const applySkill = (skill) => {
    setActiveSkills((prev) => {
      if (prev.some((s) => s.id === skill.id)) return prev
      markSkillUsed(skill.id)
      return [...prev, { id: skill.id, name: skill.name, description: skill.description, content: skill.content }]
    })
  }
  // 移除 Skill（已启用列表里去掉）：应用 Skill 后，用户可在已启用 chip 上点 ✕ 撤销
  const removeSkill = (id) => {
    setActiveSkills((prev) => prev.filter((a) => a.id !== id))
  }

  const handleConversationChange = useCallback((snap) => {
    if (snap?.skills) setActiveSkills(snap.skills)
    if (Array.isArray(snap?.attachments)) setAttachments(snap.attachments)
    if (typeof snap?.draft === 'string') {
      setInput(snap.draft)
      try { contentSet(AGENT_DRAFT_KEY, snap.draft) } catch { /* ignore */ }
    }
  }, [])

  const [chatListOpen, setChatListOpen] = useState(false)
  const chatListRef = useRef(null)
  useOutsideClick(chatListRef, chatListOpen, () => setChatListOpen(false))
  // 新建对话短锁：新建后 1s 内禁用按钮，避免用户狂点出十几个空对话
  const newChatLock = useRef(false)

  const { messages, sending, error, model, setModel, send, stop, clear, stateAction, conversations, activeConversationId, newChat, switchChat, deleteChat, sendContentToCanvas, confirmPendingMemorySuggest, getActivePendingMemorySuggest, cancelPendingConfirm, runExistingConfirm, getCreditGate, clearCreditGate,
    // 展示→编排轴薄适配（收口 store 穿透）：这 3 个由 useAgentChat 回传，UI 不再直接 import conversationStore
    setCurrentSnapshot, setAwaitingConfirm } = useAgentChat({
    agentKey,
    systemPrompt,
    defaultModel: defaultAgentModel,
    provider: agentProvider,
    skills: activeSkills,
    onConversationChange: handleConversationChange
  })

  // 【设置即生效·方案 B】订阅「设置 → AI 助手」的聊天模型键（agent_chat_model）。
  // 该键由 AgentChatSettings.saveAgentChatModel → contentSet 写入，contentSubscribe 即时回调。
  // 回调里：① 自增 chatModelVersion → 重算 agentProvider/agentModels/configuredModel（换供应商也同步）；
  //         ② setModel → 同步 useAgentChat 内部的 model（useState 初值不会因参数变化自动更新，必须显式 set）。
  // 卸载时返回的 unsubscribe 自动取消，防泄漏。
  useEffect(() => {
    const unsubscribe = contentSubscribe(AGENT_CHAT_MODEL_KEY, (cfg) => {
      setChatModelVersion((v) => v + 1)
      if (cfg && typeof cfg === 'object') {
        const c = cfg as { modelId?: string }
        if (c.modelId) setModel(c.modelId)
      }
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [input, setInput] = useState<string>(() => { try { return String(contentGet(AGENT_DRAFT_KEY) || '') } catch { return '' } })
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  // 【2026-09-05 精简】执行模型收敛恒 auto（完全自主）+ credit 积分闸：三态选择器（direct/step-confirm/auto）已删，
  // AI 助手只走 auto 完全自主。真正烧积分那下由全局积分闸 creditSwitch 拦截（见 useCanvasAgentTools.executePlanTool），
  // 与本执行模型正交——这里不掺和确认粒度。
  // attachments 变化 → 同步到 conversationStore（自动落盘，带 hydrated 时序守卫）
  useEffect(() => {
    setCurrentSnapshot({ attachments })
  }, [attachments])

  // ── 高消耗积分确认闸（creditSwitch）── 2026-08-27 简化定稿
  // 全局开关（默认开）：任何模式下，真正烧积分那下（image/video 生成）都先经用户确认。
  // 心智模型【一句话】：建节点不花积分，随便 AI 建；只有「真生成图/视频那一下」烧积分，
  //   由这个全局总闸把关——开了就等确认、关了直接跑。
  // 它：①是唯一确认闸（AI 助手恒 auto 完全自主，确认粒度只此一处）；②只控媒体生成，
  //   不管「改画布/改布局」这类零成本操作（完全自主下 AI 直接做）。
  // 判定收敛在 useCanvasAgentTools.executePlanTool 一处：creditHit = getCreditSwitch()。
  // 读写走 contracts.ts 登记的 CREDIT_SWITCH_KEY（index.js 透传 getCreditSwitch/setCreditSwitch）。
  const [creditSwitch, setCreditSwitchState] = useState(() => { try { return getCreditSwitch() } catch { return true } })
  const toggleCreditSwitch = () => {
    const next = !creditSwitch
    setCreditSwitchState(next)
    setCreditSwitch(next)
  }
  // credit 确认卡预览：跟随 per-conv creditGate 的 pending 态刷新（execute_plan 置位/补跑清除时由事件驱动）。
  const [creditGatePreview, setCreditGatePreview] = useState(() => {
    try { const g = getCreditGate(); return g?.pending === true ? g : null } catch { return null }
  })
  const [creditGateDismissed, setCreditGateDismissed] = useState(false)
  useEffect(() => {
    const unsub = subscribe(CREDIT_GATE_EVENT, (payload) => {
      const p = payload as { pending?: boolean } | null
      if (p && p.pending === true) {
        try { setCreditGatePreview(getCreditGate()) } catch { /* ignore */ }
        setCreditGateDismissed(false)
      } else {
        setCreditGatePreview(null)
      }
    })
    return unsub
  }, [])
  // 确认生成：走 runExistingPlanTool（D8 补跑唯一入口）。成功后 creditGate 被清除并广播 → 卡片自动收起。
  const handleConfirmCredit = useCallback(async () => {
    const res = await runExistingConfirm()
    if (!res?.ok) {
      if (typeof showToast === 'function') showToast(typeof res?.error === 'string' ? res.error : '补跑生成失败，已保留待确认态可重试', { type: 'error' })
      return
    }
    // 成功：节点已触发真生成；creditGate 已清、事件已广播，卡片由订阅收起。
    setCreditGatePreview(null)
    if (typeof showToast === 'function') showToast('已确认，开始生成', { type: 'success' })
  }, [runExistingConfirm])
  // 取消：放弃本次待确认生成 → 清除 creditGate（根治残留：积分确认只拦「点生成那一下」，取消即结束，不遗留状态）。
  // 节点保留在画布上（免费建的 ready 节点不删），用户仍可随时手动点节点触发生成。
  const dismissCreditCard = () => {
    setCreditGateDismissed(true)
    setCreditGatePreview(null)
    clearCreditGate()
  }
  const showCreditCard = creditGatePreview?.pending === true && !creditGateDismissed
  const creditGenCount = Array.isArray(creditGatePreview?.gens) ? creditGatePreview.gens.length : 0

  // 【选中图→待确认引用】（对齐大雄 ghost 语义，防误触）：用户选中画布带图节点时，
  // 图先进「待确认」列表（pendingImageNodes），不直接进正式附件。用户点输入框/发送时才
  // 确认转正式（confirmPendingImages），此时按输入框顺序定编号。避免拖动/查看画布误塞图。
  const [pendingImageNodes, setPendingImageNodes] = useState([])
  useEffect(() => {
    if (!Array.isArray(selectedImageNodes)) return
    setPendingImageNodes(
      selectedImageNodes.map((n) => ({ url: n.url, label: n.label || '', nodeId: n.nodeId || '', nodeType: n.nodeType || '', x: n.x || 0, y: n.y || 0 })).filter((n) => n.url)
    )
  }, [selectedImageNodes])
  // 确认待引用图 → 并入正式附件（定编号）；按 url 去重（已存在跳过）
  const confirmPendingImages = useCallback(() => {
    setPendingImageNodes((pending) => {
      if (!pending.length) return pending
      setAttachments((prev) => {
        const exist = new Set(prev.filter((a) => a.url).map((a) => a.url))
        const next = prev.slice()
        let changed = false
        for (const n of pending) {
          if (!n?.url || exist.has(n.url)) continue
          next.push({ type: 'image', url: n.url, localUrl: n.url, label: n.label || '', nodeId: n.nodeId || '', nodeType: n.nodeType || '', x: n.x || 0, y: n.y || 0 })
          exist.add(n.url)
          changed = true
        }
        return changed ? next : prev
      })
      return [] // 确认后清空待引用
    })
  }, [])

  const [modelOpen, setModelOpen] = useState(false)
  const modelRef = useRef(null)
  const fileRef = useRef(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)
  // 「回到底部」按钮：atBottom 驱动显隐；atBottomRef 供滚动副作用同步读取最新值（避免闭包读到过期 state）
  const [atBottom, setAtBottom] = useState(true)
  const atBottomRef = useRef(true)
  // 程序化滚动（自动跟随/点按钮）进行中：期间忽略位置判定。
  //   原因：smooth 滚动动画本身持续触发 scroll 事件，中间帧「距底部」很大，
  //   若不屏蔽会把 atBottomRef 误翻成 false → 流式跟随中断、按钮误弹出。
  const programmaticRef = useRef(false)
  const idleTimerRef = useRef(null)
  // 用户接管后下一帧校正位置的 rAF 句柄（抵消 wheel→scroll 之间的一帧空档，见 takeOver）
  const rafRef = useRef(null)

  useEffect(() => {
    try { contentSet(PANEL_WIDTH_KEY, String(width)) } catch { /* ignore */ }
  }, [width])
  useEffect(() => {
    if (open) onWidthChange?.(width)
  }, [open, width, onWidthChange])
  useEffect(() => {
    if (!open) onWidthChange?.(0)
  }, [open, onWidthChange])
  useEffect(() => {
    onEnabledChange?.(true)
  }, [onEnabledChange])

  // 宽度拖拽
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

  /** 标记程序化滚动开始，并在静默 SCROLL_IDLE_MS 后自动解除（动画结束探测） */
  const markProgrammatic = useCallback(() => {
    programmaticRef.current = true
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    // 兜底：若本次无需滚动（已在底部 → 不产生 scroll 事件），也能靠这个定时器解除标记
    idleTimerRef.current = setTimeout(() => { programmaticRef.current = false }, SCROLL_IDLE_MS)
  }, [])

  /** 强制贴底（流式跟随/发送/切对话/点按钮）：同步置位 atBottom → 按钮立即隐藏 */
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = true
    setAtBottom(true)
    markProgrammatic()
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [markProgrammatic])

  // 消息滚动到底部（sticky bottom：在底部时跟随流式输出自然下滚；用户上翻后交还控制权，由「回到底部」按钮接管）
  const lastMsg = messages[messages.length - 1]
  const scrollKey = (lastMsg ? (lastMsg.content?.length || 0) + (lastMsg.reasoning?.length || 0) : 0) + (messages.length) + (sending ? 1 : 0)
  useEffect(() => {
    if (!atBottomRef.current) return
    scrollToBottom('smooth')
  }, [scrollKey, scrollToBottom])

  /** 重算「是否已到底」→ 驱动快速回底按钮显隐 + 决定是否继续自动跟随 */
  const syncAtBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (programmaticRef.current) {
      // 程序化动画产生的 scroll 事件：只用来探测动画结束，不做「离开底部」判定
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => { programmaticRef.current = false }, SCROLL_IDLE_MS)
      return
    }
    const next = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_EPS
    atBottomRef.current = next
    setAtBottom(next)
  }, [])

  // 滚动 / 容器尺寸变化 → 重算是否到底
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // 面板收起(`hidden` → display:none)会让浏览器重置 scrollTop 为 0，重新展开时若此前停在底部则恢复贴底
    if (open && atBottomRef.current) scrollToBottom('auto')
    syncAtBottom()
    el.addEventListener('scroll', syncAtBottom, { passive: true })
    const ro = new ResizeObserver(syncAtBottom)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', syncAtBottom)
      ro.disconnect()
    }
  }, [syncAtBottom, scrollToBottom, open])

  // 用户主动滚动 → 立即取消程序化标记，按真实位置重算，保证平滑动画途中用户一上手就能接管。
  //   仅以下四类视为「用户主动」：滚轮 / 触摸拖动 / 拖滚动条 / 滚动键。
  //   注意：不能笼统监听 pointerdown/keydown —— 点击消息内按钮、选中文本、按 Enter 激活按钮
  //   都会冒泡到本容器，若一并取消程序化标记，会在流式动画中途误判成「用户上翻」而打断自动跟随。
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const takeOver = () => {
      if (programmaticRef.current) {
        programmaticRef.current = false
        // 掐断浏览器正在进行的平滑滚动动画（滚到当前位置=零位移，显式 instant 避免受 CSS scroll-behavior 影响）
        el.scrollTo({ top: el.scrollTop, behavior: 'instant' })
      }
      if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
      // 【堵一帧空档】wheel/touchmove 事件先于滚动生效、scroll 事件后到，中间隔约一帧。
      //   期间若恰好有流式 chunk 触发跟随，会读到尚未更新的位置（仍在底部）而把用户顶回底部，
      //   且其随后置起的 programmatic 会让用户的 scroll 事件被忽略 → 彻底抢不回来。
      //   故先按「已离开」处理挡住跟随；只改 ref 不改 state，避免按钮闪现；
      //   下一帧滚动已生效，再由 syncAtBottom 按真实位置校正（未产生位移时也会校正回原值）。
      atBottomRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        syncAtBottom()
      })
    }
    // 拖滚动条：命中容器自身 + 指针落在 clientWidth 之外（滚动条轨道区，custom-scrollbar 宽 6px 且占布局）
    const onPointerDown = (e) => {
      if (e.target !== el || e.offsetX <= el.clientWidth) return
      takeOver()
    }
    const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'])
    const onKeyDown = (e) => { if (SCROLL_KEYS.has(e.key)) takeOver() }
    const opts = { passive: true }
    el.addEventListener('wheel', takeOver, opts)
    el.addEventListener('touchmove', takeOver, opts)
    el.addEventListener('pointerdown', onPointerDown, opts)
    el.addEventListener('keydown', onKeyDown, opts)
    return () => {
      el.removeEventListener('wheel', takeOver, opts)
      el.removeEventListener('touchmove', takeOver, opts)
      el.removeEventListener('pointerdown', onPointerDown, opts)
      el.removeEventListener('keydown', onKeyDown, opts)
      if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [syncAtBottom, open])

  // 切换对话 → 强制贴底（新会话历史应停在最底部，而非沿用上个会话的滚动位置）
  useEffect(() => { scrollToBottom('auto') }, [activeConversationId, scrollToBottom])

  // 发送
  const handleSend = (overrideText?: string) => {
    // 待发图 = 正式附件 + 待确认引用（灰态），按序去重合并后随本次发出；发送后清空两者
    const allImages = [...attachments, ...pendingImageNodes]
      .filter((a) => a?.url)
      .filter((a, i, arr) => arr.findIndex((x) => x.url === a.url) === i)
    const text = (typeof overrideText === 'string' ? overrideText : input).trim()
    if ((!text && allImages.length === 0) || (sending && stateAction !== 'steer')) return
    // 【单入口 · docs/65 M7/M8】一律调 send；direct 由 send 内部第一行分流到直连生图
    //（不再由 UI 分 inputMode 调 send/sendImageMode，发送分支只存在于 send）。
    const attach = allImages.length > 0 ? allImages.map(({ url, nodeId, label, x, y }) => ({ type: 'image', url, nodeId, label, x: x || 0, y: y || 0 })) : undefined
    releaseAttachmentUrls(attachments)
    setAttachments([])
    setPendingImageNodes([])
    setInput('')
    try { contentSet(AGENT_DRAFT_KEY, '') } catch { /* ignore */ }
    scrollToBottom('smooth') // 自己发消息 → 无论当前是否已上翻，都强制贴底
    Promise.resolve(send(text, attach)).catch((e) => logger.error('Agent', 'send 失败', e))
  }

  // Skill 阶段2 确认：翻转 awaitingConfirm 并通知 LLM 按策划执行（Step F）。
  // 复用现有确认门禁接管两类确认：【记忆确认】存在待确认的项目长期记忆建议时写记忆；
  // 否则【策划确认】通知 LLM 按策划执行。
  const handleConfirmPlan = useCallback(() => {
    const pendingMemory = getActivePendingMemorySuggest()
    if (pendingMemory && typeof pendingMemory === 'object') {
      Promise.resolve(confirmPendingMemorySuggest())
        .then((r) => { if (!r?.ok && typeof showToast === 'function') showToast(r?.error || '保存长期记忆失败', { type: 'error' }) })
        .catch((e) => logger.error('Agent', '保存长期记忆失败', e))
      return
    }
    setAwaitingConfirm(false)
    try { contentSet(AGENT_DRAFT_KEY, '') } catch { /* ignore */ }
    Promise.resolve(send('已确认，请按刚才展示的策划执行。')).catch((e) => logger.error('Agent', '确认后 send 失败', e))
  }, [send, confirmPendingMemorySuggest, getActivePendingMemorySuggest])

  // 单步失败重试：点击失败 tool 卡片的「重试」，只重跑该 nodeId（复用 taskStore 已注册的生成契约，对齐大雄 retryAgentGeneration）
  const handleRetryStep = useCallback((nodeId) => {
    if (!nodeId) return
    runNodeGeneration(nodeId)
  }, [])

  // 重新生成（消息底部操作行）：往前找最近一条用户指令原样重发。
  // useAgentChat 未单独暴露 regenerate（大雄该功能依附 prompts 通道，见 useAgentChat 注释），
  // 故在 UI 层就近重发上一条 user 文本——语义等价「再问一次」，历史会多一轮，行为可预期。
  const handleRegenerate = useCallback((msg) => {
    const idx = messages.findIndex((m) => m?.id && m.id === msg?.id)
    if (idx <= 0) return
    for (let i = idx - 1; i >= 0; i--) {
      const m = messages[i]
      if (m?.role === 'user' && String(m.content || '').trim()) {
        scrollToBottom('smooth')
        Promise.resolve(send(String(m.content).trim())).catch((e) => logger.error('Agent', '重新生成失败', e))
        return
      }
    }
  }, [messages, send, scrollToBottom])

  // 快捷建议发送
  const sendShortcut = (text) => {
    setInput(text)
    handleSend(text)
  }

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        // .md/.markdown/.txt → 导入为 Skill（对齐大雄 setAgentSkillFile：文件名即 Skill 名，content 即文本）
        if (/\.(md|markdown|txt)$/i.test(f.name)) {
          try {
            const text = await readTextFile(f)
            const name = f.name.replace(/\.(md|markdown|txt)$/i, '')
            applySkill({ id: `skill_file_${Date.now()}_${i}`, name, description: '', content: String(repairMojibakeText(text)) })
            showToast(`已导入 Skill「${name}」`, { type: 'success' })
          } catch (err) {
            showToast(`Skill 导入失败：${(err as { message?: string })?.message || err}`, { type: 'error' })
          }
          continue
        }
        if (!f.type.startsWith('image/')) continue
        const localUrl = previewUrls.create(f)
        try {
          const dataUrl = await fileToDataUrl(f)
          setAttachments((prev) => [...prev, { type: 'image', url: dataUrl, localUrl }])
        } catch (err) {
          previewUrls.release(localUrl)
          showToast(`图片读取失败：${err?.message || err}`, { type: 'error' })
        }
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // 释放本地预览 blob 的 url（幂等：非 blob 预览 url 未登记，release 安全返回）
  const releaseAttachmentUrls = (list) => {
    ;(list || []).forEach((a) => { if (a?.localUrl) previewUrls.release(a.localUrl) })
  }

  const removeAttachment = (idx) => {
    setAttachments((prev) => {
      const item = prev[idx]
      if (item?.localUrl) previewUrls.release(item.localUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // 确认统一走 confirmStore（D8 横切收敛：替代 window.confirm）
  const handleClear = async () => {
    if (await askConfirm({ title: '清空当前会话的所有消息？', confirmText: '清空', danger: true })) clear()
  }

  const focusTextarea = () => textareaRef.current?.focus()

  // 输入框自适应增高：textarea 默认不随内容变高（rows 固定），需按 scrollHeight 同步。
  // min 兜底/防抖动：仅在高度确实变化时写入，避免每击键都触发布局抖动。
  const fitInputHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    // 先归零再取 scrollHeight，保证换行时能正确收缩回 min 高度
    el.style.height = '0px'
    const next = Math.min(Math.max(el.scrollHeight, 72), 160)
    el.style.height = `${next}px`
  }, [])
  // input 变化（含流式回调 setInput）→ 增高；发送清空后由下方 handleSend 里的 setInput('') 触发同样回落
  useEffect(() => { fitInputHeight() }, [input, fitInputHeight])

  // 【docs/25 阶段1C】不再条件卸载（if !open return null）——面板常驻 DOM，open 控制 CSS 显隐。
  //   这样 useAgentChat 始终挂载、运行态（流式/状态机）不因面板收起而断流（配合"切页不中断"）。
  //   注意：open=false 时 onWidthChange 仍会报 0（见上 effect），保持宽度同步，勿删除。
  //

  /** 空态标识（顶栏已去掉 logo，仅空态保留） */
  const AI_ICON = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v1h1.5a2.5 2.5 0 0 1 2.5 2.5v1.5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V8.5A2.5 2.5 0 0 1 7.5 6H9V5a3 3 0 0 1 3-3z" />
      <path d="M9 14h6" />
      <path d="M10 18h4" />
      <path d="M12 14v4" />
    </svg>
  )

  /** 顶栏标题 = 当前会话标题（首条用户消息优先，未命名则回退 c.title / “新对话”） */
  const activeTitle = useMemo(() => {
    const c = (conversations || []).find((x) => x?.id === activeConversationId)
    const firstUser = (c?.messages || []).find((m) => m?.role === 'user' && m?.content)
    if (firstUser?.content) return String(firstUser.content).slice(0, 18)
    return c?.title || '新对话'
  }, [conversations, activeConversationId])

  // 未配 AI 供应商 → 禁用发送（禁止静默失败，见 L3b）。canSend 网关 provider 存在。
  const noProvider = !agentProvider
  const canSend = (input.trim() || attachments.length > 0) && stateAction !== 'stopping' && !noProvider

  return (
    <div className={`agent-panel absolute top-0 right-0 bottom-0 z-30 ${open ? '' : 'hidden'} ${dragging ? 'select-none' : ''}`} style={{ width }}>
      {/* 宽度拖拽手柄 */}
      <div
        onMouseDown={startDrag}
        className={`agent-grip ${dragging ? 'is-dragging' : ''}`}
        title="拖动调整宽度"
      />

      {/* 顶部：对话标题即会话列表入口 + 3 个图标。
          收口说明：原「AI 图标 / “AI 助手”文字 / 积分胶囊 / 独立列表按钮 / 独立清空按钮」共 6 个视觉元素，
          现压到「1 标题 + 3 图标」——积分→盾牌图标；列表→标题下拉（下拉底部另挂积分开关与清空对话）。 */}
      <header className="agent-header">
        <span ref={chatListRef} className="relative">
          <button
            type="button"
            onClick={() => setChatListOpen((v) => !v)}
            disabled={sending}
            className="agent-title-btn"
            title="对话列表"
          >
            <span className="agent-title-text">{activeTitle}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {chatListOpen && (
            <div className="agent-pop is-conv">
              <div style={{ maxHeight: '240px', overflowY: 'auto' }} className="custom-scrollbar">
                {conversations.length === 0 ? (
                  <div className="agent-pop-empty">暂无对话</div>
                ) : conversations.map((c) => {
                  const isActive = c.id === activeConversationId
                  const firstUser = (c.messages || []).find((m) => m.role === 'user' && m.content)
                  const title = (firstUser?.content ? String(firstUser.content).slice(0, 18) : (c.title || '对话'))
                  return (
                    <div key={c.id} className="agent-row-wrap">
                      <button
                        type="button"
                        onClick={() => { switchChat(c.id); setChatListOpen(false) }}
                        className={`agent-row ${isActive ? 'is-active' : ''}`}
                        title={c.title}
                      >
                        <span className="agent-row-name">{title}</span>
                        {isActive && (
                          <span className="agent-row-check">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                      </button>
                      <span className="agent-row-ops">
                        <button
                          type="button"
                          onClick={async (e) => { e.stopPropagation(); if (await askConfirm({ title: `删除对话「${title}」？`, confirmText: '删除', danger: true })) { deleteChat(c.id); setChatListOpen(false) } }}
                          title="删除对话"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="agent-pop-divider" />
              <button
                type="button"
                onClick={handleClear}
                disabled={sending || messages.length === 0}
                className="agent-row"
                title="清空对话"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span className="agent-row-name">清空当前对话</span>
              </button>
              {/* 积分开关（与顶栏盾牌同一状态，下拉内再给一次带文字的显式入口） */}
              <button
                type="button"
                onClick={toggleCreditSwitch}
                disabled={sending}
                className="agent-switch-row"
                title={creditSwitch ? '生成前先确认，避免意外消耗积分。点击关闭' : '生成直接放行。点击开启'}
              >
                <span>生成前确认积分</span>
                <span className={`agent-switch ${creditSwitch ? 'is-on' : ''}`} />
              </button>
            </div>
          )}
        </span>

        <div className="agent-header-actions">
          {/* 高消耗积分确认闸（creditSwitch）：全局、默认开。AI 助手恒 auto 完全自主，
              确认粒度只此一处——真烧积分那下（image/video 生成）先经用户确认。图标化：亮=开，灰=关。 */}
          <button
            type="button"
            onClick={toggleCreditSwitch}
            disabled={sending}
            className={`agent-icon-btn ${creditSwitch ? 'is-on' : ''}`}
            title={creditSwitch ? '积分确认已开启：生成前先确认，避免意外消耗积分。点击关闭' : '积分确认已关闭：生成直接放行。点击开启'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </button>
          <button
            type="button"
            disabled={sending || newChatLock.current}
            onClick={() => {
              if (newChatLock.current) return
              newChat()
              showToast('已新建对话', { type: 'success' })
              newChatLock.current = true
              setTimeout(() => { newChatLock.current = false }, 1000)
            }}
            className="agent-icon-btn"
            title="新建对话"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button type="button" onClick={onClose} className="agent-icon-btn" title="关闭">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* 消息区（外层 relative 定位 + 内层滚动，回底按钮置于外层避免被滚动裁剪） */}
      <div className="flex-1 relative flex flex-col min-h-0">
        <div ref={scrollRef} className="agent-messages custom-scrollbar">
          {messages.length === 0 && (
            <div className="agent-empty" onClick={focusTextarea}>
              <div className="agent-empty-mark">{AI_ICON}</div>
              <h3>有什么可以帮你？</h3>
              <p>创建节点、生图、改布局，一句话的事</p>
              {/* Skill 快捷入口：最多 3 个，其余从工具栏 Skill 图标进入 */}
              {allSkills.length > 0 && (
                <div className="agent-chips">
                  {allSkills.slice(0, 3).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => applySkill(s)}
                      className="agent-chip"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((m) => (
            <AgentMessage
              key={m.id}
              message={m}
              onConfirmPlan={handleConfirmPlan}
              onCancelPlan={cancelPendingConfirm}
              onRetryStep={handleRetryStep}
              onSendToCanvas={sendContentToCanvas}
              onRegenerate={() => handleRegenerate(m)}
            />
          ))}
          {/* 高消耗积分确认卡（跟随消息流末尾，与策划/记忆确认共用 AgentConfirmCard 统一样式）：
              credit 命中（任一模式 + 开关开）时，execute_plan 已建好节点（status='ready'）、真生成未触发；
              确认 → runExistingPlanTool 补跑；取消 → 仅收起卡片、保留待确认态（不删节点，节点已在画布上）。 */}
          {showCreditCard && (
            <AgentConfirmCard
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              }
              title={creditGenCount > 0 ? `确认生成 ${creditGenCount} 张图/视频` : '确认生成'}
              desc="节点已建好，确认后开始生成（预计消耗积分）。取消可稍后手动点节点触发。"
              confirmText="确认生成"
              cancelText="取消"
              onConfirm={handleConfirmCredit}
              onCancel={dismissCreditCard}
              disabled={sending}
            />
          )}
          {sending && (
            <div className="agent-thinking">
              <i /><i /><i />
              <span>思考中...</span>
            </div>
          )}
          {error && <div className="agent-error">{error}</div>}
        </div>

        {/* 快速回到底部：离开底部时淡入，点击平滑贴底后自动淡出。
            置于外层 relative 容器（非滚动容器内），避免随消息一起被滚走/裁剪。 */}
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          aria-label="回到底部"
          title="回到底部"
          tabIndex={atBottom ? -1 : 0}
          // 用 inert 替代 aria-hidden：aria-hidden 包裹可获得焦点的元素会触发
          // 「focused element under aria-hidden」警告（辅助技术无法访问），
          // 且 aria-hidden 本身不阻止焦点。inert 既阻止焦点又不被辅助技术识别。
          inert={atBottom || undefined}
          className={`agent-to-bottom ${atBottom ? 'is-hidden' : 'is-shown'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
        </button>
      </div>

      {/* 底部输入区（OneBox：附件 chips → 输入框 → 纯图标工具栏） */}
      <div className="agent-composer">
        <div className="agent-box">
          {/* 参考图 chips（内联在输入框上方） */}
          {(attachments.length > 0 || uploading) && (
            <div className="agent-att-row">
              {attachments.map((a, i) => (
                <span key={i} className="agent-att">
                  <img src={toAbsoluteFileUrl(a.localUrl || a.url)} alt="" />
                  <button type="button" className="agent-att-remove" onClick={() => removeAttachment(i)} title="移除">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
              {uploading && <span className="agent-att-loading"><span className="agent-spinner" /></span>}
            </div>
          )}

          {/* 待确认引用（选中画布图未确认，防误触）：点输入框/发送才并入正式附件 */}
          {pendingImageNodes.length > 0 && (
            <div className="agent-att-row">
              <span className="agent-att-note">待引用：</span>
              {pendingImageNodes.map((a, i) => (
                <span key={`${a.url}-${i}`} className="agent-att">
                  <img src={toAbsoluteFileUrl(a.url)} alt="" />
                  <button type="button" className="agent-att-remove" onClick={() => setPendingImageNodes((prev) => prev.filter((_, j) => j !== i))} title="移除该待引用图">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 输入框 */}
          <textarea
            ref={textareaRef}
            value={input}
            onFocus={confirmPendingImages}
            onChange={(e) => {
              const v = e.target.value
              setInput(v)
              try { contentSet(AGENT_DRAFT_KEY, v) } catch { /* ignore */ }
              setSkillSlashOpen(v === '/')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && skillSlashOpen) { e.preventDefault(); setSkillSlashOpen(false); return }
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend() }
            }}
            placeholder={noProvider ? '请先在「API/供应商设置」配置 AI 聊天供应商及模型' : '描述你想做的事，回车发送，Shift+Enter 换行'}
            rows={1}
            disabled={sending || noProvider}
            className="agent-textarea"
          />
          {/* 未配供应商引导：禁止静默失败，指引用户去设置（L3b） */}
          {noProvider && (
            <div className="agent-hint">尚未配置 AI 聊天供应商，发送已禁用。请到「设置 → API/供应商」添加 OpenAI 兼容等供应商并选择聊天模型后使用。</div>
          )}

          {/* Skill / 快捷调用下拉：锚定在输入框正下方，向上弹出紧贴 textarea */}
          {skillSlashOpen && (
            <div ref={skillSlashRef} className="relative">
              <div className="agent-pop is-slash" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                {allSkills.length === 0 ? (
                  <div className="agent-pop-empty">暂无 Skill</div>
                ) : allSkills.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { applySkill(s); setInput(''); setSkillSlashOpen(false) }}
                    className="agent-row"
                  >
                    <span style={{ color: 'rgb(var(--mao-text-faint))' }}>/</span>
                    <span className="agent-row-name">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 工具栏：纯图标化（Skill / 生图参数 / 生图模型），去掉全部文字标签 */}
          <div className="agent-tools">
              {/* ────────────────────────────────────────────────────────────
                  【已注释】左下角聊天模型（AI 助手对话模型）选择按钮。
                  为什么去掉：AI 助手的聊天模型已在「设置 → AI 助手」分区统一指定，
                  这里再放一个聊天模型下拉会和设置页功能重复，用户不易区分。
                  保留生图模型选择（下方 ModelSelect）——那是选择「用哪个图像模型来生图」，
                  与聊天模型是两回事，需随时切换，故保留在工具栏。
                  如需恢复，取消注释即可。
              ──────────────────────────────────────────────────────────── */}
              {/* <span ref={modelRef} className="relative">
                <button
                  type="button"
                  onClick={() => setModelOpen(!modelOpen)}
                  disabled={sending}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-secondary hover:text-primary hover:bg-surface rounded-md transition-colors disabled:opacity-50"
                  title="切换对话模型"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <rect x="9" y="9" width="6" height="6" rx="1" />
                    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
                  </svg>
                  <span className="truncate max-w-[80px]">{model}</span>
                </button>
                {modelOpen && (
                  <div className="absolute bottom-full left-0 mb-1 w-[260px] max-h-[280px] overflow-y-auto bg-surface border border-edge rounded-lg shadow-2xl z-50 py-1 custom-scrollbar">
                    {agentModels.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted text-center">暂无可用模型</div>
                    ) : agentModels.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setModel(id); setModelOpen(false) }}
                        className={`w-full flex items-center gap-1.5 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors ${id === model ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
                        title={id}
                      >
                        <span className="shrink-0 px-1 rounded text-meta leading-[14px] border bg-white/10 text-white/90 border-white/30">{agentProvider?.name || '内置'}</span>
                        <span className="flex-1 truncate font-mono">{id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </span> */}

              {/* 生图模型选择：第1位（最左）——选择用哪个图像模型来生图，随时可切换。
                  iconOnly：包裹图标表示「模型资产」（生图/3D 模型包），模型名收进 title（工具栏去文字化） */}
              <span className="relative">
                <ModelSelect
                  value={genModel}
                  onChange={onGenModel}
                  models={genModels}
                  placeholder="生图模型"
                  popupTo="up"
                  showDivider={false}
                  iconOnly
                  icon={<PackageIcon className="w-4 h-4" strokeWidth={1.8} />}
                  active={!!genModel}
                  triggerTitle={genModel ? `生图模型：${genModel}` : '选择生图模型'}
                />
              </span>

              {/* 生图参数：第2位——选择画质/比例/渲染质量。图标化，当前值收进 title */}
              <span ref={genImgMenuRef} className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setGenImgMenuOpen((v) => !v) }}
                  className={`agent-icon-btn is-sm ${genImgMenuOpen ? 'is-active' : ''}`}
                  title={`生图参数：${genSize} · ${genRatio}`}
                >
                  <SlidersHorizontal className="w-4 h-4" strokeWidth={1.8} />
                </button>
                {genImgMenuOpen && (
                  <div className="agent-pop is-gen" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
                    <div className="agent-gen-group">
                      <div className="agent-gen-label">画质</div>
                      <div className="agent-opts">{genSizeOptions.map((s) => (
                        <button key={s} type="button" className={`agent-opt ${genSize === s ? 'is-on' : ''}`} onClick={() => onGenSize(s)}>{s}</button>
                      ))}</div>
                    </div>
                    <div className="agent-gen-group">
                      <div className="agent-gen-label">比例</div>
                      <div className="agent-opts">{genRatioOptions.map((r) => (
                        <button key={r} type="button" className={`agent-opt ${genRatio === r ? 'is-on' : ''}`} onClick={() => onGenRatio(r)}>{r}</button>
                      ))}</div>
                    </div>
                    <div className="agent-gen-group">
                      <div className="agent-gen-label">渲染质量</div>
                      <div className="agent-opts">{genQualityOptions.map((q) => (
                        <button key={q.value} type="button" className={`agent-opt ${genQuality === q.value ? 'is-on' : ''}`} onClick={() => onGenQuality(q.value)}>{q.label}</button>
                      ))}</div>
                    </div>
                  </div>
                )}
              </span>

              {/* Skill：第3位（最右）——点击弹「应用/取消 Skill」下拉（管理已移至设置页 AI 助手分区）。
                  Skill 用文字按钮而非纯图标（用户裁定）：未启用显示「Skill」，启用显示「Skill·首个名」，图标保留辅助。 */}
              <span ref={skillPickRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSkillPickOpen((v) => !v)}
                  disabled={sending}
                  className={`agent-skill-btn ${activeSkills.length > 0 ? 'is-active' : ''}`}
                  title={activeSkills.length > 0 ? `已启用 ${activeSkills.map((s) => s.name).join('、')}` : '应用 Skill'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  {activeSkills.length === 0
                    ? 'Skill'
                    : `Skill·${(activeSkills[0]?.name || '').slice(0, 5)}`}
                </button>
                {skillPickOpen && (
                  <div className="agent-pop is-slash" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {allSkills.length === 0 ? (
                      <div className="agent-pop-empty">暂无 Skill</div>
                    ) : allSkills.map((s) => {
                      const on = activeSkills.some((a) => a.id === s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            if (on) removeSkill(s.id)
                            else applySkill(s)
                            setSkillPickOpen(false)
                          }}
                          className={`agent-row ${on ? 'is-active' : ''}`}
                        >
                          <span className="agent-row-name">{s.name}</span>
                          <span className="agent-step-meta" style={{ marginLeft: 0 }}>{s.builtin ? '内置' : ''}</span>
                          {on && (
                            <span className="agent-row-check">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </span>

              {/* 图片上传：暂时隐藏（如需恢复，取消下方注释即可） */}
              {/*
              <input ref={fileRef} type="file" accept="image/*,.md,.markdown,.txt" multiple onChange={handleFiles} className="hidden" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || sending}
                className="p-1.5 rounded-md transition-colors text-secondary hover:text-primary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                title="上传参考图"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>
              */}
            <span className="agent-spacer" />

            {/* 发送/停止 */}
            {sending && stateAction !== 'steer' ? (
              <button type="button" onClick={stop} className="agent-send agent-stop" title="停止">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!canSend}
                className="agent-send"
                title="发送"
              >
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

/** File → text（用于 .md/.markdown/.txt Skill 导入） */
function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsText(file, 'utf-8')
  })
}
