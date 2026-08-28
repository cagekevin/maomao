import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAgentChat, setGenParams, getGenParams, getCreditSwitch, setCreditSwitch, getWorkMode, setWorkMode as setWorkModeGlobal, RUN_MODE_IDS, WORK_MODE_STORAGE_KEY } from '../agent/index.js'
import { useProviders, load as loadProviders } from '../base/settings/providerStore.js'
import AgentMessage from './AgentMessage.jsx'
import AgentConfirmCard from './AgentConfirmCard.jsx'
import ModelSelect from '../base/ModelSelect.jsx'
import { buildAllModels } from '../base/providerModels.js'
import { useOutsideClick } from '../base/hooks.js'
import { loadAgentChatModel, AGENT_CHAT_MODEL_KEY } from '../base/settings/agentModelStore.js'
import { getAllSkills, markSkillUsed, repairMojibakeText, isSkillEnabled } from '../base/skillStore.js'
import { contentGet, contentSet, contentSubscribe } from '../base/contentStore.js'
import { toAbsoluteFileUrl } from '../base/filesApi.js'
import { fileToDataUrl } from '../base/imageUrl.js'
import { runNodeGeneration } from '../base/taskStore.js'
import { showToast } from '../base/toastStore.js'
import { logger } from '../base/logger.js'
import { AGENT_MODELS } from '../base/config.js'
import previewUrls from '../base/previewUrl.js'
import { subscribe } from '../base/eventBus.js'

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

// 模型列表从 config.js 读取（env VITE_AGENT_MODELS 可覆盖）
const PANEL_WIDTH_KEY = 'agent_panel_width'
const AGENT_DRAFT_KEY = 'agent_draft'
const MIN_WIDTH = 320
const MAX_WIDTH = 720
const DEFAULT_WIDTH = 400

const SHORTCUTS = [
  '生成赛博朋克猫咪图',
  '把选中节点改成 9:16',
  '锁定所有生图节点',
  '撤回刚才的操作'
]

/** 面板宽度（localStorage 记忆） */
function loadWidth() {
  try {
    const t = contentGet(PANEL_WIDTH_KEY)
    const n = t ? Number(t) : NaN
    if (Number.isFinite(n)) return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, n))
  } catch { /* ignore */ }
  return DEFAULT_WIDTH
}

export default function AgentPanel({ agentKey = 'canvas-assistant', systemPrompt = '', open, onClose, onWidthChange, onEnabledChange, selectedImageNodes = [] }) {
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
  // AI 助手的可选模型：该 provider 的 chat_models；无则内置列表兜底
  const agentModels = useMemo(() => {
    const fromProvider = (agentProvider?.chat_models || []).map((m) => m.id || m.label || m).filter(Boolean)
    return fromProvider.length > 0 ? fromProvider : AGENT_MODELS
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
  const defaultAgentModel = configuredModel ? configuredModel : agentModels[0]

  // ── 生图参数 ──
  const genModels = useMemo(() => buildAllModels(providers || [], 'image'), [providers])
  const [genModel, setGenModel] = useState(() => getGenParams().model || '')
  const [genSize, setGenSize] = useState(() => getGenParams().resolution || '1K')
  const [genRatio, setGenRatio] = useState(() => getGenParams().ratio || 'Auto')
  const [genQuality, setGenQuality] = useState(() => getGenParams().quality || 'auto')
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

  const { messages, sending, error, model, setModel, send, stop, clear, stateAction, conversations, activeConversationId, newChat, switchChat, deleteChat, updateMessageByContent, executePlanDirect, sendContentToCanvas, confirmPendingMemorySuggest, getActivePendingMemorySuggest, cancelPendingConfirm, runExistingConfirm, getCreditGate, clearCreditGate,
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
      if (cfg && typeof cfg === 'object' && cfg.modelId) setModel(cfg.modelId)
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [input, setInput] = useState(() => { try { return contentGet(AGENT_DRAFT_KEY) || '' } catch { return '' } })
  const [attachments, setAttachments] = useState([])
  const [uploading, setUploading] = useState(false)
  // 【三态收敛 · docs/65 M8】workMode 由注册表单一真源驱动（getWorkMode 读 / setWorkModeGlobal 原子写三处）。
  // 组件用本地 state 保持响应式渲染；写走注册表（同时同步 inputMode 与当前会话 runMode 兼容字段）。
  //   direct        直接生图：send 内部第一行 bypass LLM，直连 execute_plan
  //   step-confirm  分步确认：LLM 编排，调 show_plan_for_confirm 卡 awaiting 确认
  //   auto          完全自主：LLM 编排，可调 plan 展示但不卡确认，直 execute_plan
  //  ⚠️ 积分闸判定（credit=creditSwitch）与三态正交（见 execute_plan / creditSwitch 注释），这里不掺和。
  const [workMode, setWorkModeState] = useState(() => { try { return getWorkMode() } catch { return RUN_MODE_IDS.AUTO } })
  const applyWorkMode = (mode) => { setWorkModeState(setWorkModeGlobal(mode)) }
  // 【docs/65 M8】订阅 agent_work_mode 外部变更：其它入口（如未来设置页）改动时，本面板本地 state 同步跟随，
  // 避免「两个入口各改各的、UI 不跟随」的交叉。回调读注册表真源；本处只写本地 state，不回写 store，无循环。
  useEffect(() => {
    return contentSubscribe(WORK_MODE_STORAGE_KEY, () => { try { setWorkModeState(getWorkMode()) } catch { /* ignore */ } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // attachments 变化 → 同步到 conversationStore（自动落盘，带 hydrated 时序守卫）
  useEffect(() => {
    setCurrentSnapshot({ attachments })
  }, [attachments])

  // ── 高消耗积分确认闸（creditSwitch）── 2026-08-27 简化定稿
  // 全局开关（默认开）：任何模式下，真正烧积分那下（image/video 生成）都先经用户确认。
  // 心智模型【一句话】：建节点不花积分，随便 AI 建；只有「真生成图/视频那一下」烧积分，
  //   由这个全局总闸把关——开了就等确认、关了直接跑。
  // 它：①与三态选择器完全正交（在直接生图/分步确认/完全自主下一视同仁）；②只控媒体生成，
  //   不管「改画布/改布局」这类零成本操作（那由三态决定）。
  // 判定收敛在 useCanvasAgentTools.executePlanTool 一处：creditHit = getCreditSwitch()。
  // 读写走 contracts.js 登记的 CREDIT_SWITCH_KEY（index.js 透传 getCreditSwitch/setCreditSwitch）。
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
    const unsub = subscribe('agent:credit-gate', (payload) => {
      if (payload && payload.pending === true) {
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
      if (typeof showToast === 'function') showToast(res?.error || '补跑生成失败，已保留待确认态可重试', { type: 'error' })
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

  // 消息滚动到底部
  const lastMsg = messages[messages.length - 1]
  const scrollKey = (lastMsg ? (lastMsg.content?.length || 0) + (lastMsg.reasoning?.length || 0) : 0) + (messages.length) + (sending ? 1 : 0)
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [scrollKey])

  // 发送
  const handleSend = (overrideText) => {
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

  // 【对齐大雄 prompts 逐条确认通道 · 保留为可选能力，当前不激活】
  //  大雄 prompts 逐条确认是其「思维模式」遗留（thinkingModeOn=false 已废弃，见 promptFlow.js 头「★ 重要」），
  //  大雄当前走 generations 快速执行（我们已对齐）。此 handler 仅在 assistant 消息带 prompts 时被
  //  PromptConfirmCard 触发；默认不触发（走 generations 通道）。若未来要恢复逐条确认，此链路已就绪。
  //  【追加：保留决策已确认，2026-08-18】人类明确决策**不删、也不接入/补全**，维持保留。后续 AI 直接跳过，勿当待办。
  //  - update：把确认后的 prompts 写回对应 assistant 消息（updateMessageByContent，渲染同步 + 落盘）
  //  - generate：全部确认后把 prompts 转的 generations 交给 execute_plan 直接生图（executePlanDirect，对齐大雄 runAgentGenerations）
  const handlePromptAction = useCallback(({ action, assistantContent, prompts, generations }) => {
    if (action === 'update') {
      updateMessageByContent(assistantContent, { prompts })
    } else if (action === 'generate') {
      if (typeof showToast === 'function') showToast('正在执行全部提示词…', { type: 'info' })
      Promise.resolve(executePlanDirect(generations))
        .then((r) => { if (!r.ok && typeof showToast === 'function') showToast(r.error || '生成失败', { type: 'error' }) })
        .catch((e) => logger.error('Agent', 'prompts 全确认生图失败', e))
    }
  }, [updateMessageByContent, executePlanDirect])

  // 单步失败重试：点击失败 tool 卡片的「重试」，只重跑该 nodeId（复用 taskStore 已注册的生成契约，对齐大雄 retryAgentGeneration）
  const handleRetryStep = useCallback((nodeId) => {
    if (!nodeId) return
    runNodeGeneration(nodeId)
  }, [])

  // 快捷建议发送
  const sendShortcut = (text) => {
    setInput(text)
    handleSend(text)
  }

  const handleFiles = async (e) => {
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
            applySkill({ id: `skill_file_${Date.now()}_${i}`, name, description: '', content: repairMojibakeText(text) })
            showToast(`已导入 Skill「${name}」`, { type: 'success' })
          } catch (err) {
            showToast(`Skill 导入失败：${err?.message || err}`, { type: 'error' })
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

  const handleClear = () => {
    if (window.confirm('清空当前会话的所有消息？')) clear()
  }

  const focusTextarea = () => textareaRef.current?.focus()

  // 【docs/25 阶段1C】不再条件卸载（if !open return null）——面板常驻 DOM，open 控制 CSS 显隐。
  //   这样 useAgentChat 始终挂载、运行态（流式/状态机）不因面板收起而断流（配合"切页不中断"）。
  //   注意：open=false 时 onWidthChange 仍会报 0（见上 effect），保持宽度同步，勿删除。
  //

  const AI_ICON = (
    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-surface-hover to-surface-deep border border-edge flex items-center justify-center">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
        <path d="M12 2a3 3 0 0 1 3 3v1h1.5a2.5 2.5 0 0 1 2.5 2.5v1.5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5V8.5A2.5 2.5 0 0 1 7.5 6H9V5a3 3 0 0 1 3-3z" />
        <path d="M9 14h6" />
        <path d="M10 18h4" />
        <path d="M12 14v4" />
      </svg>
    </span>
  )

  const canSend = (input.trim() || attachments.length > 0) && stateAction !== 'stopping'

  return (
    <div className={`absolute top-0 right-0 bottom-0 bg-surface-deep border-l border-edge-faint flex flex-col z-30 shadow-2xl ${open ? '' : 'hidden'} ${dragging ? 'select-none' : ''}`} style={{ width }}>
      {/* 宽度拖拽手柄 */}
      <div
        onMouseDown={startDrag}
        className={`absolute left-[-3px] top-0 bottom-0 w-[6px] cursor-col-resize z-40 hover:bg-blue-500/30 ${dragging ? 'bg-blue-500/40' : ''}`}
        title="拖动调整宽度"
      />

      {/* 顶部标题栏 */}
      <header className="shrink-0 flex items-center justify-between px-3 h-12 border-b border-edge-faint">
        <div className="flex items-center gap-2">
          {AI_ICON}
          <span className="text-white text-sm font-medium">AI 助手</span>
          {/* 高消耗积分确认开关（creditSwitch）：全局、默认开。任何模式下，真烧积分那下（image/video 生成）
              都先经用户确认，确认前不烧积分。独立于三态选择器；分步确认（step-confirm）不叠此闸（D2）。 */}
          <button
            type="button"
            onClick={toggleCreditSwitch}
            disabled={sending}
            className={`flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full border text-caption-sm transition-colors disabled:opacity-50 ${
              creditSwitch ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-surface/60 border-edge-faint text-muted'
            }`}
            title={creditSwitch ? '积分确认已开启：生成前先确认，避免意外消耗积分。点击关闭' : '积分确认已关闭：生成直接放行。点击开启'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <line x1="6" y1="10" x2="6" y2="14" />
              <line x1="10" y1="10" x2="10" y2="14" />
            </svg>
            <span>{creditSwitch ? '积分确认' : '已关闭'}</span>
          </button>
        </div>
        <div className="flex items-center gap-0.5">
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
            className="p-1.5 text-secondary hover:text-white hover:bg-surface-hover rounded-md transition-colors disabled:opacity-40"
            title="新建对话"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <span ref={chatListRef} className="relative">
            <button type="button" onClick={() => setChatListOpen((v) => !v)} disabled={sending} className="p-1.5 text-secondary hover:text-white hover:bg-surface-hover rounded-md transition-colors disabled:opacity-40" title="对话列表">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
            {chatListOpen && (
              <div className="absolute top-full right-0 mt-1 w-[220px] max-h-[280px] overflow-y-auto bg-surface border border-edge rounded-lg shadow-2xl z-50 py-1 custom-scrollbar">
                {conversations.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted text-center">暂无对话</div>
                ) : conversations.map((c) => {
                  const isActive = c.id === activeConversationId
                  const firstUser = (c.messages || []).find((m) => m.role === 'user' && m.content)
                  const title = (firstUser?.content ? String(firstUser.content).slice(0, 18) : (c.title || '对话'))
                  return (
                    <div key={c.id} className="flex items-center group">
                      <button
                        type="button"
                        onClick={() => { switchChat(c.id); setChatListOpen(false) }}
                        className={`flex-1 flex items-center gap-2 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors ${isActive ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
                        title={c.title}
                      >
                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                        <span className="flex-1 truncate">{title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (window.confirm(`删除对话「${title}」？`)) { deleteChat(c.id); setChatListOpen(false) } }}
                        className="shrink-0 p-1 text-muted-2 hover:text-red-400 hover:bg-surface rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="删除对话"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </span>
          <button type="button" onClick={handleClear} disabled={sending || messages.length === 0} className="p-1.5 text-secondary hover:text-white hover:bg-surface-hover rounded-md transition-colors disabled:opacity-40" title="清空对话">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
          <button type="button" onClick={onClose} className="p-1.5 text-secondary hover:text-white hover:bg-surface-hover rounded-md transition-colors" title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* 消息区（外层 relative 定位 + 内层滚动，浮层置于外层避免被滚动裁剪） */}
      <div className="flex-1 relative flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 custom-scrollbar">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center px-4 text-center" onClick={focusTextarea}>
              <div className="mb-3">{AI_ICON}</div>
              <div className="text-white text-base font-medium mb-1">有什么可以帮你？</div>
              <div className="text-muted text-xs mb-5">创建节点、生图、改布局，一句话的事</div>
              <div className="flex flex-wrap justify-center gap-2 max-w-[320px]">
                {SHORTCUTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendShortcut(s)}
                    className="px-3 py-1.5 text-xs text-secondary bg-canvas border border-edge-faint rounded-full hover:border-edge hover:text-primary hover:bg-surface transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
              {allSkills.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-1.5 max-w-[320px]">
                  {allSkills.slice(0, 3).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => applySkill(s)}
                      className="inline-flex items-center gap-1 text-caption-sm text-body bg-surface border border-edge-faint rounded-full px-2.5 py-1 hover:bg-surface-hover hover:border-edge transition-colors cursor-pointer"
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
                  <span className="text-caption text-muted-2 px-2 py-1">输入 / 可快速调用更多 Skill</span>
                </div>
              )}
            </div>
          )}
          {messages.map((m) => <AgentMessage key={m.id} message={m} onConfirmPlan={handleConfirmPlan} onCancelPlan={cancelPendingConfirm} onRetryStep={handleRetryStep} onPromptAction={handlePromptAction} onSendToCanvas={sendContentToCanvas} />)}
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
            <div className="flex items-center gap-2 text-muted text-xs">
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
      </div>

      {/* 底部 OneBox 输入区 */}
      <div className="shrink-0 px-3 py-3 border-t border-edge-faint bg-surface-deep">
        <div className="bg-canvas border border-edge rounded-xl focus-within:border-edge-strong transition-colors">
          {/* 参考图 chips（内联在输入框上方） */}
          {(attachments.length > 0 || uploading) && (
            <div className="flex flex-wrap gap-2 px-3 pt-2.5">
              {attachments.map((a, i) => (
                <span key={i} className="relative w-10 h-10 rounded-lg overflow-hidden border border-edge group">
                  <img src={toAbsoluteFileUrl(a.localUrl || a.url)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeAttachment(i)} className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity" title="移除">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
              {uploading && (
                <span className="w-10 h-10 rounded-lg border border-edge bg-surface flex items-center justify-center">
                  <span className="w-4 h-4 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
                </span>
              )}
            </div>
          )}

          {/* 待确认引用（选中画布图未确认，防误触）：点输入框/发送才并入正式附件 */}
          {pendingImageNodes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5">
              <span className="text-caption text-muted">待引用：</span>
              {pendingImageNodes.map((a, i) => (
                <span key={`${a.url}-${i}`} className="relative w-10 h-10 rounded-lg overflow-hidden border border-edge group">
                  <img src={toAbsoluteFileUrl(a.url)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setPendingImageNodes((prev) => prev.filter((_, j) => j !== i))} className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity" title="移除该待引用图">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 三态选择器（直接生图 / 分步确认 / 完全自主）：合并「智能/图像 × 分步确认/完全自主」两个正交维度，
              从用户精力出发切分——直接生图=一输就出图（直连生图，不经 LLM 编排工具，自动执行）；
              分步确认=AI 调工具前先展示策划，逐步确认再执行；完全自主=AI 自主操作、无需逐步确认。
              workMode 由注册表单一真源驱动（docs/65 M8），inputMode/runMode 为 setWorkMode 原子同步的兼容派生态。 */}
          <div className="flex items-center gap-1 px-2.5 pt-2">
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface/50 border border-edge-faint shrink-0">
              <button
                type="button"
                onClick={() => applyWorkMode(RUN_MODE_IDS.DIRECT)}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 text-caption-sm rounded-md transition-colors ${workMode === RUN_MODE_IDS.DIRECT ? 'bg-surface-hover-strong text-white' : 'text-muted hover:text-body'}`}
                title="直接生图：提示词 + 参考图直接出图，不经 AI 编排；烧积分那下受全局积分确认总闸约束（开则先确认）"
              >直接生图</button>
              <button
                type="button"
                onClick={() => applyWorkMode(RUN_MODE_IDS.STEP_CONFIRM)}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 text-caption-sm rounded-md transition-colors ${workMode === RUN_MODE_IDS.STEP_CONFIRM ? 'bg-surface-hover-strong text-white' : 'text-muted hover:text-body'}`}
                title="分步确认：AI 调用工具修改画布前先展示策划，等你确认再执行"
              >分步确认</button>
              <button
                type="button"
                onClick={() => applyWorkMode(RUN_MODE_IDS.AUTO)}
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 text-caption-sm rounded-md transition-colors ${workMode === RUN_MODE_IDS.AUTO ? 'bg-surface-hover-strong text-white' : 'text-muted hover:text-body'}`}
                title="完全自主：AI 自主操作画布，无需逐步确认（含 Skill 场景）"
              >完全自主</button>
            </div>
          </div>

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
            placeholder={workMode === RUN_MODE_IDS.DIRECT ? '输入最终生图提示词，回车直接生图…' : '输入消息，回车发送，Shift+Enter 换行…'}
            rows={1}
            disabled={sending}
            className="w-full bg-transparent text-primary text-sm px-3 py-2.5 resize-none focus:outline-none disabled:opacity-60"
            style={{ minHeight: '72px', maxHeight: '160px' }}
          />

          {/* Skill / 快捷调用下拉：锚定在输入框正下方，向上弹出紧贴 textarea */}
          {skillSlashOpen && (
            <div ref={skillSlashRef} className="relative">
              <div className="absolute bottom-full left-0 mb-1 w-[240px] max-h-[240px] overflow-y-auto bg-surface border border-edge rounded-lg shadow-2xl z-50 py-1 custom-scrollbar">
                {allSkills.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted text-center">暂无 Skill</div>
                ) : allSkills.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { applySkill(s); setInput(''); setSkillSlashOpen(false) }}
                    className="w-full flex items-center gap-2 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors text-body hover:bg-surface-hover hover:text-white"
                  >
                    <span className="shrink-0 w-4 text-muted-2">/</span>
                    <span className="flex-1 truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 工具栏 */}
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-0.5 min-w-0">
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

              {/* Skill 应用按钮：第1位（最左）——点击弹「应用/取消 Skill」下拉（管理已移至设置页 AI 助手分区） */}
              <span ref={skillPickRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSkillPickOpen((v) => !v)}
                  disabled={sending}
                  className={`shrink-0 flex items-center gap-1 px-1.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap disabled:opacity-50 ${activeSkills.length > 0 ? 'text-emerald-300 hover:bg-surface' : 'text-secondary hover:text-primary hover:bg-surface'}`}
                  title={activeSkills.length > 0 ? `已启用 ${activeSkills.map((s) => s.name).join('、')}` : '应用 Skill'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>{activeSkills.length === 0
                    ? 'Skill'
                    : `Skill·${activeSkills.map((s) => (s.name || '').slice(0, 4)).join('、')}`}
                  </span>
                </button>
                {skillPickOpen && (
                  <div className="absolute bottom-full left-0 mb-1 w-[240px] max-h-[280px] overflow-y-auto bg-surface border border-edge rounded-lg shadow-2xl z-50 py-1 custom-scrollbar">
                    {allSkills.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted text-center">暂无 Skill</div>
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
                          className={`w-full flex items-center gap-2 text-left px-2 py-1.5 text-caption-sm rounded-md transition-colors ${on ? 'text-emerald-300' : 'text-body hover:bg-surface-hover hover:text-white'}`}
                          >
                          <span className="shrink-0 w-4 flex items-center text-emerald-400">{on ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                          ) : ''}</span>
                          <span className="flex-1 truncate">{s.name}</span>
                          <span className="text-caption text-muted-2 shrink-0">{s.builtin ? '内置' : ''}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </span>

              {/* 生图参数按钮：第2位——选择画质/比例/渲染质量 */}
              <span ref={genImgMenuRef} className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setGenImgMenuOpen((v) => !v) }}
                  className="shrink-0 flex items-center gap-1 px-1.5 py-1 text-xs text-secondary hover:text-primary hover:bg-surface rounded-md transition-colors whitespace-nowrap"
                  title="生图参数"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span className="hidden sm:inline truncate max-w-[70px]">{genSize} · {genRatio}</span>
                </button>
                {genImgMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-1 w-60 max-h-[calc(100vh-200px)] overflow-y-auto bg-surface-1 border border-edge rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 custom-scrollbar" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <div className="text-caption text-muted mb-2">画质</div>
                      <div className="flex gap-1.5">{genSizeOptions.map((s) => (
                        <button key={s} type="button" className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${genSize === s ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-secondary hover:bg-surface-hover'}`} onClick={() => onGenSize(s)}>{s}</button>
                      ))}</div>
                    </div>
                    <div>
                      <div className="text-caption text-muted mb-2">比例</div>
                      <div className="flex flex-wrap gap-1.5">{genRatioOptions.map((r) => (
                        <button key={r} type="button" className={`px-2.5 py-1 text-caption-sm rounded-md border transition-colors ${genRatio === r ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-secondary hover:bg-surface-hover'}`} onClick={() => onGenRatio(r)}>{r}</button>
                      ))}</div>
                    </div>
                    <div>
                      <div className="text-caption text-muted mb-2">渲染质量</div>
                      <div className="flex gap-1.5">{genQualityOptions.map((q) => (
                        <button key={q.value} type="button" className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${genQuality === q.value ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-secondary hover:bg-surface-hover'}`} onClick={() => onGenQuality(q.value)}>{q.label}</button>
                      ))}</div>
                    </div>
                  </div>
                )}
              </span>

              {/* 生图模型选择：第3位——选择用哪个图像模型来生图，随时可切换。
                  labelMaxWidth 限制按钮上模型名的显示宽度，超长省略号，避免撑出输入框 */}
              <span className="min-w-0" title="选择生图模型">
                <ModelSelect
                  value={genModel}
                  onChange={onGenModel}
                  models={genModels}
                  placeholder="生图模型"
                  popupTo="up"
                  showDivider={false}
                  labelMaxWidth="100px"
                />
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
            </div>

            {/* 发送/停止（z-[60] 高于 ModelSelect 弹层 z-50，避免被向上弹出的模型下拉盖住） */}
            {sending && stateAction !== 'steer' ? (
              <button type="button" onClick={stop} className="relative z-[60] w-8 h-8 flex items-center justify-center bg-surface-active-2 hover:bg-surface-raised-2 text-white rounded-full transition-colors cursor-pointer" title="停止">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={`relative z-[60] w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer ${canSend ? 'bg-white hover:bg-gray-200 text-black' : 'bg-surface-hover text-muted cursor-not-allowed'}`}
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
function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsText(file, 'utf-8')
  })
}
