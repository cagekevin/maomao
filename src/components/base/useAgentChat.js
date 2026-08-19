import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasAgentTools, getGenParams, setCurrentReferenceImages } from './useCanvasAgentTools.js'
import { loadAgentChatModel, loadAgentHistoryTurns } from './settings/agentModelStore.js'
import { logger } from './logger.js'
import { API_BASE } from './config.js'
import { LLM_CHAT_BASE_URL, LLM_CHAT_API_KEY, LLM_CHAT_MODEL, AGENT_DEMO_MODE } from './config.js'
import { normalizeImageUrlForSend } from './imageUrl.js'
import { InputStateMachine } from './inputStateMachine.js'
import { generateId } from './idGen.js'

/**
 * 【过渡方案·2026-08-18 决策注释】回传给 LLM 的「历史纯文字」轮数（由 AI 助手设置控制，不硬编码）。
 * - 背景：fresh-task 为根治「反推图一却全反推」连历史文字也一并砍掉，导致纯文字对话
 *   （如"反推这张图提示词"→"把提示词优化一下"）第二轮失去上下文。
 * - 方案：让 buildRequestMessages 回传最近 N 轮的【纯文字】历史（图片仍编号化，绝不内联进上下文），
 *   在保「图片不撞号」安全底线的前提下恢复文字连续性。
 * - 取值（buildRequestMessages 第 7 参 historyTurns）：0=不回传、1=只上一轮、任意正数=最近 N 轮（大值≈不限）。
 * - 由 useAgentChat 在每次 buildRequestMessages 调用时【实时】经 loadAgentHistoryTurns() 读取（不缓存），
 *   用户在 AI 助手设置改「历史回传轮数」后即时生效。
 * - 为何是过渡：真正的治本是补齐 memory 自动摘要（summary/facts 自动沉淀），届时可回退为 0
 *   走纯 fresh-task + 更强 memory。当前是性价比最高的解（见 agentCore.js buildRequestMessages 头注释）。
 */
// 纯函数层 + 运行时逻辑下沉（职责模块化拆分，见 agentCore.js / agentRuntime.js 头注释）
import {
  MAX_TOOL_ROUNDS,
  ENABLE_TOOLS_ON_NON_STREAM,
  CANVAS_AGENT_RULES,
  SKILL_EXECUTION_RULES,
  historyKey,
  loadHistory,
  parseSSEChunk,
  parseGenerationsFromReply,
  buildRequestMessages,
  parseAgentError,
  demoPlan,
  imageModeLooksLikePerReferenceEdit,
  buildPerReferenceGenerations,
} from './agentCore.js'
// 运行时逻辑（依赖注入版本）。hook 内以 const roundTrip 等同名闭包封装调用，
// 故此处用别名避免与 hook 内的函数名冲突。
import { roundTrip as agentRuntimeRoundTrip, runToolCalls as agentRuntimeRunToolCalls, runDemoMode as agentRuntimeRunDemoMode } from './agentRuntime.js'
import {
  ensureActiveConversation,
  setAgentKey,
  importLegacy,
  applyConversation,
  newConversation,
  switchConversation,
  deleteConversation,
  captureActiveConversation,
  getConversations,
  getActiveConversationId,
  setCurrentSnapshot,
  getCurrentWorkflow,
  patchCurrentWorkflow,
  getCurrentPending,
  setCurrentPending,
  getCurrentMemory,
  setCurrentMemory,
  setAwaitingConfirm,
  getAwaitingConfirm,
  setActivePendingGenerations,
  getActivePendingGenerations,
  getCurrentImageMap,
} from './conversationStore.js'

// P15 列表 key 收口：给消息补稳定唯一 id（已有 id 保留）。appendMsg/setHistory 统一走它，
// 保证 AgentPanel 的 messages.map 可用 key={m.id}（此前无 id，只能 key={i}，插入/删除会错位）。
// 幂等：二次调用不改已补 id。
const withMsgId = (m) => (m && typeof m === 'object' && m.id ? m : { ...m, id: generateId('msg') })

/**
 * ════════════════════════════════════════════════════════════════
 * 画布 AI 助手 —— 对话 hook（复刻官方 shared.js `dr`，接入工具层）
 * ════════════════════════════════════════════════════════════════
 *
 * 【对应关系】
 * 官方 App-BX6o9fW5_components/shared.js `dr(e)`（2537-2908）：
 *  - 消息状态 messages / sending / error / model / setModel
 *  - send(text, attachments)   → SSE 流式 + 多轮工具循环（≤ ur=8 轮）
 *  - stop() / clear()          → 中止 / 清空
 *  - 工具执行：官方用 `lr(name,args,canvasHandleRef)`；本实现改用
 *    useCanvasAgentTools 的 callTool（即刚建好的统一画布工具层）。
 *
 * 【与官方的差异（均为原型适配）】
 *  1. 工具执行器：lr → callTool（useCanvasAgentTools），LLM 侧无感知，返回信封不变。
 *  2. 鉴权：官方 We() 取登录 token；原型无登录，直接发请求。
 *  3. 历史持久化：官方 nr(n)/ir(n) 走后端；原型用 localStorage（键 = `agent_history_${agentKey}`）。
 *  4. LLM 端点：读 env（VITE_*，见下），默认走 localTool 18080 的 /api/agent/:id/chat，
 *     与 docs/27 一致（localTool 已落地支持 function calling 的 LLM 中转）。
 *
 * 【LLM 端点配置（.env 或 import.meta.env）】
 *  - VITE_LLM_CHAT_BASE_URL  默认 'http://127.0.0.1:18080/api/agent/{agentKey}/chat'
 *      （指向 localTool；localTool 再转发到支持 function calling 的 LLM，见 docs/27 §3/§11）
 *  - VITE_LLM_CHAT_API_KEY   可选，Bearer 鉴权
 *  - VITE_LLM_CHAT_MODEL     默认 'gpt-4o-mini'（localTool 会按配置覆盖，见 docs/27 §11.3）
 *  - 若想直接连某个 OpenAI 兼容端点：把 BASE_URL 设成该端点 /v1/chat/completions 即可。
 *
 * 【消息契约（对齐官方 + LLM 可解析）】
 *  - user:      { role:'user', content, attachments?:[{type,url}], createdAt }
 *  - assistant: { role:'assistant', content, reasoning?, tool_calls?, streaming?, model, createdAt }
 *  - tool:      { role:'tool', content:JSON字符串, tool_call_id, createdAt }
 *  - system:    { role:'system', content }
 *
 * 【本实现的关键设计：统一消息同步】
 *  messages（React state，驱动 UI 渲染）与 messagesRef（ref，供异步闭包读取最新历史）
 *  必须始终保持一致。所有「追加/替换/清空」一律走下方辅助函数（appendMsg/setHistory/
 *  updateLastStreaming/stripStreaming），杜绝"改 setMessages 忘改 ref"导致的 ref 漂移
 *  ——那是过去"一改就崩"的根源。
 * ════════════════════════════════════════════════════════════════
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★★ 与参考项目大雄（daxiong-canvas-plugins/canvas-agent）的全部路径对齐设计 ★★★
 * ══════════════════════════════════════════════════════════════════════════════
 * 本文件是 AI 助手的「唯一发送入口」；大雄有独立多条发送路径，我们用「工具循环 + 三阶段门禁」
 * 做了架构级简化统一。下表是权威地图：每条路径大雄怎么走、我们怎么走、对齐状态。改动前先看表，
 * 不要凭记忆改——过去反复推翻就是因为缺这张地图。
 *
 * ── 一、发送路径（大雄 sendAgentMessage 8170 入口；我们统一在 send/sendImageMode）──
 * | 大雄路径 | 大雄入口 | 我们实现 | 对齐状态 |
 * |---|---|---|---|
 * | 图像模式直连生图 | agentSendDirectImageMessage(8132) | sendImageMode(本文件) 直连 execute_plan | ✅ 已对齐 |
 * | 常规：理解→规划→执行 | agentRunUnderstandingStage(6806)→plan→execute | send + 工具循环(≤8轮) + 三阶段门禁 | ✅ 已对齐 |
 * | 常规：无 Skill 单阶段直出 | agentRunPlanningFromUnderstanding(6996) | 同上（工具循环内 execute_plan） | ✅ 已对齐 |
 * | 修改意见（不重跑理解） | agentApplyRevisePlanning(6595, messages:[]) | steer 队列(823) + 新 send | ⚠️ 简化对齐 |
 * | 重新生成某条 prompt | regenerateAgentPrompts(8619) | 未单独实现（靠工具循环重发） | ⚠️ 大雄该功能依附已废弃的 prompts 通道 |
 * | prompts 逐条确认/编辑/反悔/全确认 | confirm/edit/save-edit/reopen/confirm-all(8500-8577) | 【大雄已废弃】见下 | 🟡 保留为可选能力，当前不激活 |
 *
 * > ⚠️ prompts 逐条确认通道是大雄「思维模式」遗留，当前大雄 thinkingModeOn=false（5262/7302/9723）、
 * > 主要路径清空 prompts（7690/7725/7784），该通道是死代码；大雄当前走 generations 快速执行（我们已对齐）。
 * > 我们保留 promptFlow.js + PromptConfirmCard.jsx 作为可选增强，但 assistant 消息默认不带 prompts、
 * > 不走该通道。详见 promptFlow.js 文件头「★ 重要」。
 * > 【追加：保留决策已确认，2026-08-18】人类明确决策**不删、也不接入/补全**，维持保留。后续 AI 直接跳过此通道，勿当待办。
 *
 * ── 二、执行分级 runMode（对齐大雄 agentGetRunMode/agentSetRunMode）★ 为什么简单任务不 plan ★ ──
 *   用户反馈「发个信息它就执行 plan」的根因：我们此前所有任务都让 LLM 调 show_plan_for_confirm 并强制
 *   进入 awaiting 确认态（plan），而大雄是有分级的，不是每个任务都要确认。对齐后（实现见
 *   useCanvasAgentTools.js presentPlanTool）：show_plan_for_confirm 仍保留（规划文字/步骤卡片照常展示），
 *   但「是否进入 awaiting 确认门禁」按 runMode + Skill 决定：
 *   - runMode 存 conversationStore（per-conversation，默认 'auto'），AgentPanel 有切换（全自动/半自动）。
 *   - 全自动 auto（默认，对齐大雄 6283「一次规划后直接执行」）：无 Skill 时 show_plan_for_confirm
 *     **不进入 awaiting** → 规划照常展示，但不弹确认按钮，LLM 继续 execute_plan 直接执行。
 *   - 半自动 semi（对齐大雄 6282「完整规划和提示词生成后，确认再执行」）：无 Skill 时进入 awaiting →
 *     展示确认门禁，用户确认后才 execute_plan（对齐大雄 7774 semi 门禁）。
 *   - Skill：无论 runMode 都走三阶段（理解→规划→执行），进入 awaiting（Skill 需要策划确认）。
 *   对应大雄：auto 模式规划后直接执行（7774 只在 semi 才展示门禁）；Skill 三阶段独立确认。
 *
 * ── 三、三阶段流（大雄：理解→规划→执行；我们：工具循环内）──
 *   阶段1 理解：LLM 输出自然语言直出 + generations JSON（回复正文解析暂存，对齐大雄 6828/995）。
 *   阶段2 规划确认：show_plan_for_confirm 展示策划，进入 awaiting_confirm 门禁停循环（对齐大雄 923-926）。
 *   阶段3 执行：用户确认后 execute_plan 读取暂存 generations 批量生图（对齐大雄 738-744）。
 *
 * ── 三、fresh-task（所有 LLM 发送路径，最核心）──
 *   大雄 agentFreshTaskHistoryMessages() 恒返回 []（5 个发送点 6806/6996/8306/8619/6595 全用它）；
 *   历史消息（含文字+图）不进 LLM 上下文。我们 buildRequestMessages 是唯一组装点，统一 fresh-task：
 *   只发本轮 user + memory 注入（agentMemoryPromptBlock 对应物：摘要/风格/已确认/备注 + lastPlan +
 *   global_contract）+ 当前可引用图编号（agentCurrentImageMap）。详见 buildRequestMessages 头注释。
 *
 * ── 四、执行层跨轮图（对齐大雄 executeAgentGenerations 8695 / 无Skill 10634）──
 *   参考图解析优先级（execute_plan 实现，见 useCanvasAgentTools.js）：
 *   ① direct_refs 优先（仅独立步骤，agentCurrentImageMap 翻译「图N」）；② attachment_indices
 *   （use_attachments + 取 refPool）；③ 无图不挂（agentForceNoStaleLastOutputs）。
 *   跨轮 lastResults 彻底关闭（use_last_outputs=false）——绝不自动挂历史生成图。
 *
 * ── 五、记录在案的历史反复（为什么之前改了多轮）──
 *   1. 初版全量历史含图回传（buildRequestMessages 遍历所有 messages 内联 image_url）→「全反推」。
 *   2. 曾用 isCurrent 标记区分本轮——历史消息残留该标记，判断失效（已弃用）。
 *   3. execute_plan 参考图优先级曾搞反（attachment_indices 优先于 direct_refs）——已按大雄修正。
 *   4. 曾考虑自动挂历史生成图——违反 use_last_outputs=false 原则（已避免）。
 *   本轮已把这三处根治，并在此留档，勿再推翻。
 * ══════════════════════════════════════════════════════════════════════════════
 */

// LLM 端点配置（从 config.js 读取，env 可覆盖；默认走 localTool 18080，与 docs/27 一致）
const CHAT_BASE_URL = LLM_CHAT_BASE_URL
const CHAT_API_KEY = LLM_CHAT_API_KEY
const CHAT_MODEL = LLM_CHAT_MODEL

// Demo 模式：AGENT_DEMO_MODE 为 true 时，不发真实 LLM 请求，
// 用本地规则引擎模拟「说一句话 → 调工具 → 画布变化」。方便没配 LLM key 也能演示。
const DEMO_MODE = AGENT_DEMO_MODE

// ── 职责模块化拆分（commit 待补）──
// 以下常量/系统提示词/纯函数已下沉到 agentCore.js，本文件保留 re-export 以维持既有测试契约
// （agentLogic.test.js / demoPlan.test.js / imageModeSplit.test.js / useAgentChat.hook.test.js /
//  scripts/test_agent_tools.cjs 仍从 useAgentChat.js import）。
//   · MAX_TOOL_ROUNDS / ENABLE_TOOLS_ON_NON_STREAM / CANVAS_AGENT_RULES / SKILL_EXECUTION_RULES
//   · historyKey / loadHistory / parseSSEChunk / parseGenerationsFromReply / buildRequestMessages
//   · parseAgentError / demoPlan / imageModeLooksLikePerReferenceEdit / buildPerReferenceGenerations
export {
  MAX_TOOL_ROUNDS,
  ENABLE_TOOLS_ON_NON_STREAM,
  CANVAS_AGENT_RULES,
  SKILL_EXECUTION_RULES,
  historyKey,
  loadHistory,
  parseSSEChunk,
  parseGenerationsFromReply,
  buildRequestMessages,
  parseAgentError,
  demoPlan,
  imageModeLooksLikePerReferenceEdit,
  buildPerReferenceGenerations,
}

/**
 * 主 hook。
 * @param {object} opts
 *  - agentKey:     助手标识（默认 canvas-assistant）
 *  - systemPrompt: 注入的 system 提示词（可叠加画布操作准则）
 *  - defaultModel: 默认模型名
 *  - provider:     可选，AI 助手实际使用的供应商（来自 API 设置）。传了则经 /api/proxy
 *                  转发到该供应商（保留 function calling + SSE），选的模型才真正生效；
 *                  不传则回退走 localTool /api/agent/:id/chat（env 配的 LLM）。
 * @returns { messages, sending, error, model, setModel, send, stop, clear, ... }
 */

export function useAgentChat({ agentKey = 'canvas-assistant', systemPrompt = '', defaultModel = CHAT_MODEL, provider = null, skills = [], onConversationChange = null } = {}) {
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [model, setModel] = useState(defaultModel)
  // ── 会话隔离（#9）：多对话 + 当前对话 id + 对话列表 ──
  const [activeConversationId, setActiveConversationId] = useState('')
  const [conversations, setConversations] = useState([])

  // 工具层（替代官方 lr()）
  const { toolSchemas, callTool } = useCanvasAgentTools()

  // ref 缓存（避免闭包旧值，对齐官方 g.current/h.current）
  const systemRef = useRef(systemPrompt)
  const skillsRef = useRef(skills)
  const messagesRef = useRef([])
  const abortRef = useRef(null)
  // 同步的发送态，防「sending state 是异步更新、快速双击读到旧值」导致的并发双发
  const sendingRef = useRef(false)
  // 【复合忙判定】对齐大雄 agentIsTaskBusy：不只是发送锁，还复合「状态机是否运行中」。
  // 防止 sendingRef 异常提前释放、或上轮任务尚未真正收尾时，用户又开新一轮（并发双发/插话串台）。
  // 读 ref 不依赖渲染，可直接在 async send/sendImageMode 闭包里安全调用。
  const isAgentBusy = useCallback(() => {
    return sendingRef.current || !!stateMachineRef.current?.isRunning?.()
  }, [])
  // 输入状态机（#7）：推导 send/stop/steer/retry/idle；每次状态变化回写 action
  const stateMachineRef = useRef(new InputStateMachine({ onChange: (snap, action) => {
    setStateAction(action)
  } }))
  // 状态机推导的当前可用动作（send/stop/steer/retry/idle/stopping）
  const [stateAction, setStateAction] = useState('idle')
  // 切换对话回调（把目标对话的 skills/draft 交给 UI 层，如 AgentPanel 恢复 activeSkills 与输入框草稿）
  const onConversationChangeRef = useRef(onConversationChange)
  useEffect(() => { onConversationChangeRef.current = onConversationChange }, [onConversationChange])

  useEffect(() => { systemRef.current = systemPrompt }, [systemPrompt])
  useEffect(() => { skillsRef.current = skills }, [skills])
  useEffect(() => { messagesRef.current = messages }, [messages])

  /**
   * ── 消息同步辅助（唯一入口，杜绝 ref 与 state 漂移）──
   * messages 是 React state（驱动 UI），messagesRef 是 ref（供异步闭包读最新历史）。
   * 所有对消息的修改必须经这里，保证两者始终一致。
   */
  // 追加一条消息（同步 state + ref）
  const appendMsg = useCallback((msg) => {
    const m = withMsgId(msg)
    setMessages((prev) => [...prev, m])
    messagesRef.current = [...messagesRef.current, m]
  }, [])

  // 整体替换历史（同步 state + ref；P15：统一补稳定消息 id，保证 AgentPanel 列表 key 稳定）
  const setHistory = useCallback((next) => {
    const normalized = (Array.isArray(next) ? next : []).map(withMsgId)
    setMessages(normalized)
    messagesRef.current = normalized
  }, [])

  // 更新最后一条 streaming assistant 的增量（不新增，原地改最后一条）
  const updateLastStreaming = useCallback((delta) => {
    // 【与 endStreaming 同源修复】同步更新 messagesRef.current，避免异步回调导致落盘读到空占位。
    messagesRef.current = messagesRef.current.map((m, i) => {
      if (i !== messagesRef.current.length - 1 || m.role !== 'assistant' || !m.streaming) return m
      const realCalls = delta.toolCalls.filter((t) => t.function?.name)
      return {
        ...m,
        content: delta.content,
        reasoning: delta.reasoning || undefined,
        ...(realCalls.length > 0 ? { tool_calls: realCalls } : {})
      }
    })
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant' && last.streaming) {
        // 只保留真实 tool_calls（name 非空）；为空则不设该字段，杜绝空数组进历史 → LLM 报 Empty tool_calls
        const realCalls = delta.toolCalls.filter((t) => t.function?.name)
        next[next.length - 1] = {
          ...last,
          content: delta.content,
          reasoning: delta.reasoning || undefined,
          ...(realCalls.length > 0 ? { tool_calls: realCalls } : {})
        }
      }
      return next
    })
  }, [])

  // 结束流式：把最后一条 streaming 占位替换为完整 assistant
  const endStreaming = useCallback((assistant) => {
    // 【修复】必须在回调外同步更新 messagesRef.current：send 的 finally 落盘时同步读取 ref，
    //   若更新放在 setMessages 回调内（异步），落盘会拿到空的 streaming 占位 → AI 回复丢失。
    //   与 appendMsg/setHistory 一致：ref 始终同步、立即可用。
    // 【key 稳定修复】替换时必须保留原占位消息的 id（assistant 对象可能无 id）——
    //   否则 key={m.id} 变 undefined，AI 发消息（流式结束）时触发 React「列表缺 key」警告。
    messagesRef.current = messagesRef.current.map((m, i) =>
      i === messagesRef.current.length - 1 ? { ...assistant, id: m.id, streaming: false } : m
    )
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      next[next.length - 1] = { ...assistant, id: last?.id, streaming: false }
      return next
    })
  }, [])

  // 清理所有 streaming 残留占位（循环中途出错可能残留多轮 streaming:true 占位）
  const stripStreaming = useCallback(() => {
    setMessages((prev) => {
      const next = prev.filter((m) => !m.streaming)
      messagesRef.current = next
      return next
    })
  }, [])

  // 初始加载会话（对齐大雄：从 conversations 恢复当前对话；旧单会话数据迁移一次）。
  useEffect(() => {
    // 0) 【修复刷新丢记录】先把 conversationStore 的 currentAgentKey 同步到本 hook 的 agentKey。
    //    根因：store 的 currentAgentKey 由 App 的 syncAgentKey effect 异步设置，而本 effect 同步执行；
    //    若 agentKey 在挂载期变化（如 activeProjectId 首帧 undefined → 真实 id），二者可能错位，
    //    导致 ensureActiveConversation/applyConversation 在错误的 key 上读/建空对话，真实数据
    //    （存在正确 key 的 localStorage）未被加载 → 表现为「刷新后聊天记录丢失」。
    //    这里在恢复前强制对齐 key，彻底消除该竞态（setAgentKey 内部已做 key 相同则跳过）。
    setAgentKey(agentKey)
    // 1) 确保至少一个对话
    const activeId = ensureActiveConversation()
    // 2) 旧单会话数据迁移：conversations 为空且存在旧历史时，迁成一个对话
    const hist = loadHistory(agentKey)
    const migrated = hist.length > 0 ? importLegacy({ messages: hist, skills: skillsRef.current }) : null
    const snap = migrated || applyConversation(activeId)
    // 3) 同步内存态（当前对话的 messages）到本 hook state
    setActiveConversationId(getActiveConversationId())
    setHistory(snap.messages)
    setConversations(getConversations())
    // 4) 把当前对话的 skills/draft/attachments 交给 UI 层（AgentPanel 据此恢复 activeSkills、输入框草稿与参考图）
    if (snap.skills?.length || snap.draft || snap.attachments?.length) onConversationChangeRef.current?.(snap)
    // 5) 状态机按当前对话加载
    stateMachineRef.current.load(getActiveConversationId())
    // 6) pending 恢复（对齐大雄"刷新恢复上次操作"）：刷新前有未完成任务 → 自动重发
    const pending = getCurrentPending()
    if (pending && pending.text && pending.conversationId === getActiveConversationId()) {
      queueMicrotask(() => {
        // 在对话里插入一条"恢复中"占位提示（对齐大雄占位）
        appendMsg({ role: 'assistant', content: '正在恢复上次未完成的操作…', createdAt: Date.now() })
        sendRef.current?.(pending.text, pending.attachments || [])
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey])

  // 卸载时中止进行中的请求（复刻官方 dr:2571-2575）
  useEffect(() => {
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey])

  // 组装端点：默认走 localTool /api/agent/{agentKey}/chat；env 可覆盖
  const endpoint = CHAT_BASE_URL || `${API_BASE}/api/agent/${encodeURIComponent(agentKey)}/chat`

  /** 单次 SSE 请求，返回 { role:'assistant', content, reasoning?, tool_calls? }（复刻官方 dr:2579-2778 的 v）。
   *  支持流式（stream:true + SSE）与非流式（stream:false + 普通 JSON）两种模型：
   *  - 流式（默认）：传 tools（function calling），SSE 逐块解析。
   *  - 非流式：AI 助手设置里标注「非流式」时走普通 JSON 响应解析。默认不开工具（部分模型
   *    不支持 function calling）；若模型/网关支持，可把下方 enableToolsOnNonStream 置 true 测试。 */
  // 【职责模块化】roundTrip 已下沉到 agentRuntime.js（依赖注入）。此处只构造 ctx 并转发，
  // 逻辑与拆分前完全一致（LLM 通信：流式 SSE / 非流式 JSON 双模式 + 双链路 proxy/agent）。
  const roundTrip = useCallback(
    async (requestMessages, signal, onStream) => {
      return agentRuntimeRoundTrip(
        {
          endpoint, model, toolSchemas, provider, apiBase: API_BASE,
          chatApiKey: CHAT_API_KEY, logger,
          loadAgentChatModel, parseAgentError, parseSSEChunk,
          ENABLE_TOOLS_ON_NON_STREAM,
        },
        requestMessages, signal, onStream
      )
    },
    [endpoint, model, toolSchemas, provider]
  )

  /** 执行一批工具调用并回填 tool 消息（send 的真实分支与 Demo 分支共用）。
   *  tools: [{ name, args, callId? }] → 逐个 callTool，把 tool 消息 append 到历史。
   *  【TASK-006 #1 修复】execute_plan/generate_node/trigger_generation 等是 async 工具，
   *  callTool 返回 Promise。旧实现同步 for 循环拿 `result.ok` 全是 undefined →
   *  回填 LLM `{ok:false,error:undefined}` → 误判失败 → 撞 MAX_TOOL_ROUNDS 死循环 + 重复建节点。
   *  改为 async + 逐个 await，确保回填真实结果（await 普通对象/值也安全，不改变行为）。
   *  【职责模块化】逻辑已下沉到 agentRuntime.runToolCalls（依赖注入），此处只构造 ctx 转发。 */
  const runToolCalls = useCallback(async (tools, callIdFor = () => '') => {
    return agentRuntimeRunToolCalls(
      { callTool, appendMsg, model, logger, getActivePendingGenerations },
      tools,
      callIdFor
    )
  }, [callTool, appendMsg, model])

  /**
   * Demo 模式（VITE_AGENT_DEMO='1'）：本地规则引擎模拟，不走真实 LLM。
   * 抽独立函数让 send 主流程更清晰（send 里只剩「保护 → steer → 准备 → 真实循环 → 收尾」）。
   * @returns {boolean} true = 已走 Demo 分支处理完，调用方应提前 return（收尾交给 finally）
   * 【职责模块化】逻辑已下沉到 agentRuntime.runDemoMode（依赖注入），此处只构造 ctx 转发；
   *  abortRef 收尾是 hook 持有 ref 的职责，保留在 hook 侧。
   */
  const runDemoMode = useCallback(async (text) => {
    const done = await agentRuntimeRunDemoMode(
      { callTool, appendMsg, model, demoPlan },
      text
    )
    abortRef.current = null
    return done
  }, [appendMsg, callTool, model])

  /** 发送（复刻官方 dr:2786-2895 的 send：SSE + 多轮工具循环） */
  const send = useCallback(
    async (text, attachments) => {
      // ── 保护：空内容直接返回 ──
      if (!text.trim() && (!attachments || attachments.length === 0)) return

      // 【B层】发送入口：原文摘要 + 附件数 + 模型/供应商——定位一次 send 的完整入参
      logger.debug('AI助手', '[发送] 入口', { text: String(text).slice(0, 100), attachCount: (attachments || []).length, model, provider: provider?.id || '', busy: isAgentBusy() }, { module: 'agent' })

      // ── steer（补充指令，#7）：任务进行中再发送 → 排入当前对话 workflow.steerQueue（per-conversation），
      //    不打断当前任务，结束后自动执行。队列挂在 workflow 上，切换对话不串台（对齐大雄）。──
      //    忙判定用复合 isAgentBusy()（发送锁 + 状态机 running），防 sendingRef 异常/未收尾时并发双发。
      if (isAgentBusy()) {
        const wf = getCurrentWorkflow() || patchCurrentWorkflow({ status: 'running' })
        patchCurrentWorkflow({ steerQueue: [...(wf.steerQueue || []), { text, attachments: attachments || [] }] })
        appendMsg({ role: 'user', content: text, createdAt: Date.now(), steer: true, statusLabel: '已排队' })
        try { captureActiveConversation() } catch { /* 忽略 */ } // 落盘队列，切对话不丢
        return
      }

      // ── 准备：锁定发送、置 planning、写 pending（供刷新恢复）──
      sendingRef.current = true
      setError(null)
      stateMachineRef.current.start({ status: 'planning' })
      setCurrentSnapshot({ messages: messagesRef.current, skills: skillsRef.current, draft: '', attachments: [] })
      patchCurrentWorkflow({ status: 'planning', steerQueue: getCurrentWorkflow()?.steerQueue || [], startedAt: Date.now() })
      setCurrentPending({ conversationId: getActiveConversationId(), text, attachments: attachments || [] })

      // 构造 user 消息（附件归一化：blob→data、相对→绝对；只认 base64 的 provider 转 base64）
      const userMsg = { role: 'user', content: text, createdAt: Date.now(), skills: skillsRef.current.slice() }
      if (attachments && attachments.length > 0) {
        userMsg.attachments = await Promise.all(
          attachments.map(async (a) => ({ ...a, url: await normalizeImageUrlForSend(a?.url, { preferBase64: provider?.refFormat === 'base64' }) }))
        )
        // 【参考图编号目录】对齐大雄：给 AI 参考图顺序编号（按输入框从左到右），
        // AI 才能在 generations 里用 attachment_indices 精确引用「第几张图」（0-based）。
        // 只对「图片附件」编号（含来自画布选中节点的图）；nodeId 记录来源便于执行器定位。
        const imgAtts = userMsg.attachments.filter((a) => a.type !== 'node')
        if (imgAtts.length > 0) {
          const lines = ['【本轮参考图顺序（仅作为编号数据）】']
          imgAtts.forEach((a, i) => {
            lines.push(`参考图${i + 1}：${a.label || a.name || `Image${i + 1}`}` + (a.nodeId ? `（画布节点 ${a.nodeId}）` : ''))
          })
          lines.push('编号固定按输入框从左到右排列。引用某张图做图生图时，在 generations 里用 attachment_indices 指向其编号（0-based：参考图1→0）。')
          userMsg.refCatalog = lines.join('\n')
        }
        // 参考图 URL 池写入模块级：execute_plan 工具按 AI 的 attachment_indices 精确取用（对齐大雄）
        setCurrentReferenceImages(imgAtts.map((a) => a.url).filter(Boolean))
      }
      setHistory([...messagesRef.current, userMsg])
      setSending(true)

      // 【链路日志】AI 助手发送：内容摘要 + 附件（图片）数，供排查发送环节
      logger.info('AI助手', '发送', { text: String(text).slice(0, 80), attachCount: (userMsg.attachments || []).length, skillCount: (userMsg.skills || []).length })

      const controller = new AbortController()
      abortRef.current = controller
      let ok = true // 标记本次发送是否成功（finally 据此写 workflow.status）
      let aborted = false // 标记是否被用户停止（区分 stopped/failed）
      let pausedForConfirm = false // 三阶段门禁：show_plan_for_confirm 后是否暂停等用户确认（需在 try 外声明，finally 才可访问且避免 TDZ）
      let round = 0 // 工具循环轮数（提升到 try 外：Demo/异常提前 return 时 finally 的 debug 也安全，否则 TDZ）
      try {
        // ── Demo 模式（VITE_AGENT_DEMO='1'）：本地规则引擎模拟，不走真实 LLM（逻辑抽到 runDemoMode）──
        if (DEMO_MODE) {
          if (await runDemoMode(text)) return // 收尾交给 finally
        }

        // ── 真实模式：多轮工具循环（≤ MAX_TOOL_ROUNDS）──
        let assistant // 提升到循环外：供循环结束后判断是否「走满上限仍不收敛」（否则访问 for 块级变量会 ReferenceError）
        // 【对齐大雄 runMode 分级】执行分级决定「是否弹执行确认门禁」：
        //   - 全自动 auto（默认，对齐大雄 agentSetRunMode 6283）：完整规划后直接执行——show_plan_for_confirm
        //     仍会输出规划/generations 供展示，但**不进入 awaiting 确认态**，LLM 继续 execute_plan 直接执行（不弹确认按钮）。
        //   - 半自动 semi（对齐大雄 6282）：show_plan_for_confirm 进入 awaiting 确认态，展示确认门禁，用户确认后才 execute_plan。
        //   - Skill：无论 runMode 都走三阶段确认（Skill 需要用户确认策划）。
        // 具体「是否进入 awaiting」由 useCanvasAgentTools 的 show_plan_for_confirm 按 runMode 决定（见 presentPlanTool）。
        // 【三阶段门禁】是否因 show_plan_for_confirm（待用户确认策划）而提前暂停循环。
        // 对齐大雄 awaiting_confirm：展示策划后 stop 工具循环，等用户确认，不再让 AI 继续自言自语/重复推演。
        for (; round < MAX_TOOL_ROUNDS; round++) {
          // 追加流式 assistant 占位（复刻官方）
          appendMsg({ role: 'assistant', content: '', model, streaming: true, createdAt: Date.now() })

          assistant = await roundTrip(
            // 【过渡方案·2026-08-18】historyTurns 实时读取（AI 助手设置可配）：
            // 0=不回传、1=只上一轮、N=最近 N 轮纯文字历史（图片仍编号化 imageCatalog 图N，不内联，不破坏
            // 「反推图一却全反推」安全底线）。见文件顶部注释 + agentCore.js buildRequestMessages 头注释。
            buildRequestMessages(messagesRef.current, systemRef.current, true, skillsRef.current, getCurrentMemory(), getCurrentImageMap(), loadAgentHistoryTurns()),
            controller.signal,
            (delta) => updateLastStreaming(delta)
          )
          // 结束流式（把占位替换为完整 assistant）
          endStreaming(assistant)

          // 【对齐大雄】阶段1 的 generations 主通道：从 LLM 回复正文解析并暂存（不走工具参数超大 JSON）。
          // 若正文含 plan+generations JSON，解析后写入 per-conversation 暂存，供阶段3 execute_plan 从内存读。
          const { generations: replyGens } = parseGenerationsFromReply(assistant.content)
          if (Array.isArray(replyGens) && replyGens.length > 0) {
            setActivePendingGenerations(replyGens)
          }

          // 无工具调用 → 结束
          if (!assistant.tool_calls || assistant.tool_calls.length === 0) break

          // 执行工具并回填结果（TASK-006 #1：await 异步工具，确保回填真实结果而非 Promise）
          await runToolCalls(assistant.tool_calls, (tc) => tc.id)

          // 三阶段门禁：本轮执行了 show_plan_for_confirm → 进入"待确认"，立即停循环等用户确认。
          // 否则 AI 会在下一轮继续调 execute_plan（被拒）或继续输出 → 自言自语。
          if (getAwaitingConfirm()) {
            pausedForConfirm = true
            break
          }
        }
        // 多轮工具循环走满上限仍未收敛（LLM 反复调工具不自收敛）→ 提示用户，避免"停住但无说明"
        if (round === MAX_TOOL_ROUNDS && assistant.tool_calls && assistant.tool_calls.length > 0) {
          appendMsg({ role: 'assistant', content: `已连续执行 ${MAX_TOOL_ROUNDS} 轮工具调用仍未完成，已自动停止（避免死循环）。你可以告诉我下一步，或继续补充指令。`, model, createdAt: Date.now() })
        }
      } catch (e) {
        ok = false
        if (e?.name === 'AbortError') {
          aborted = true
          setError('已停止')
          stateMachineRef.current.setStatus('idle')
        } else {
          setError(e?.message || '发送失败')
          stateMachineRef.current.setStatus('failed') // #7 失败态 → 可重试（retry）
        }
        // 清理所有 streaming 残留占位（不只最后一个）：循环中途出错可能残留多轮 streaming:true 占位
        stripStreaming()
      } finally {
        // 无论成功/失败/中止都落盘当前对话（对齐大雄：capture 快照到 conversations，per-conversation 持久化）
        setCurrentSnapshot({ messages: messagesRef.current, skills: skillsRef.current, draft: '' })
        // 更新 workflow 终态（completed/failed/stopped）；清除 pending（任务已有结果，不再需要刷新恢复）
        const wfStatus = !ok ? (aborted ? 'stopped' : 'failed') : 'completed'
        // 【三阶段门禁】展示策划后暂停：workflow 置 awaiting_confirm，状态机同步，等待用户确认按钮。
        // 不清空 pending（用户确认后 send('已确认，请按策划执行') 会重建），也不再自动执行 steer 队列。
        if (pausedForConfirm) {
          patchCurrentWorkflow({ status: 'awaiting_confirm', updatedAt: Date.now() })
          try { captureActiveConversation() } catch { /* 忽略 */ }
          stateMachineRef.current.setStatus('awaiting_confirm')
          setSending(false)
          sendingRef.current = false
          abortRef.current = null
          return
        }
        patchCurrentWorkflow({ status: wfStatus, updatedAt: Date.now() })
        logger.debug('AI助手', '[发送] 终态', { status: wfStatus, rounds: round, pausedForConfirm, steerQueueLen: (getCurrentWorkflow()?.steerQueue || []).length }, { module: 'agent' })
        setCurrentPending(null)
        try { captureActiveConversation() } catch { /* 落盘失败忽略 */ }
        stateMachineRef.current.setStatus(ok ? 'idle' : 'failed')
        setSending(false)
        sendingRef.current = false
        abortRef.current = null
        // ── steer 队列：当前任务结束，自动执行下一条补充指令（per-conversation workflow.steerQueue）──
        const wf = getCurrentWorkflow()
        const steerQ = wf?.steerQueue || []
        const next = steerQ.shift()
        patchCurrentWorkflow({ steerQueue: steerQ, status: next ? 'planning' : wfStatus, updatedAt: Date.now() })
        try { captureActiveConversation() } catch { /* 忽略 */ }
        if (next) sendRef.current?.(next.text, next.attachments)
      }
    },
    // 依赖：roundTrip 闭包了 model/provider/toolSchemas；sendRef 用于 steer 续跑（下方 useRef 保持最新）
    [sending, model, roundTrip, callTool, runToolCalls, runDemoMode, appendMsg, setHistory, updateLastStreaming, endStreaming, stripStreaming, agentKey, provider, isAgentBusy]
  )

  /** 保存 send 引用，供 finally 里自动处理 steer 队列（useCallback 无法自调用） */
  const sendRef = useRef(send)
  sendRef.current = send

  /**
   * 图像模式（对齐大雄 agentSendDirectImageMessage）：参考图 + 最终提示词直连生图，不经过 LLM。
   * 把用户提示词 + 参考图构造为一个 generation 步骤，复用 execute_plan（canvasPlanExecutor）在画布直接生图。
   * @param {string} text 最终生图提示词
   * @param {Array}  attachments 参考图 [{ type:'image', url }]
   */
  const sendImageMode = useCallback(
    async (text, attachments = []) => {
      const prompt = String(text || '').trim()
      if (!prompt && (!attachments || attachments.length === 0)) return
      if (isAgentBusy()) return // 复合忙判定（发送锁 + 状态机 running），防并发双发
      if (!prompt) { setError('图像模式请输入最终生图提示词'); return }
      sendingRef.current = true
      setSending(true)
      setError(null)
      stateMachineRef.current.start({ status: 'running' })

      const userMsg = { role: 'user', content: prompt, createdAt: Date.now(), mode: 'image', skills: [] }
      if (attachments && attachments.length > 0) {
        userMsg.attachments = await Promise.all(
          attachments.map(async (a) => ({ ...a, url: await normalizeImageUrlForSend(a?.url, { preferBase64: provider?.refFormat === 'base64' }) }))
        )
      }
      setHistory([...messagesRef.current, userMsg])

      // 参考图 url（供图生图）
      const referenceImages = (userMsg.attachments || []).map((a) => a.url).filter(Boolean)
      // 【链路日志】图像模式发送：提示词摘要 + 参考图数（供排查图生图链路）
      logger.info('AI助手', '图像发送', { prompt: prompt.slice(0, 80), refImageCount: referenceImages.length })
      const panel = getGenParams()
      // 【TASK-008】多参考图「分别改图」拆分（对齐大雄）：命中「分别/各自/每张/都改成…」语义时，
      // 拆成 N 个独立 generation（每步 attachment_indices:[i] 只挂自己那张），否则整批塞单 generation。
      // 必须先把参考图写入模块级 refPool，execute_plan 的 attachment_indices 才能按编号取到图。
      setCurrentReferenceImages(referenceImages)
      const perRef = referenceImages.length >= 2 && imageModeLooksLikePerReferenceEdit(prompt, referenceImages.length)
      // 【B层】图像模式：是否触发「分别改图」拆分 + 拆出的 generation 数——定位多参考图链路
      logger.debug('AI助手', '[图像] 拆分判定', { perRef, genCount: perRef ? gens.length : 1, refImageCount: referenceImages.length }, { module: 'agent' })
      const gens = perRef
        ? buildPerReferenceGenerations(referenceImages, prompt, panel)
        : [{
            id: `direct_image_${Date.now()}`,
            title: '直接生图',
            prompt,
            ratio: panel.ratio || 'Auto',
            resolution: panel.resolution || '1K',
            depends_on_previous: false,
            dependency_mode: 'none',
          }]

      try {
        // 复用 execute_plan 工具（canvasPlanExecutor）在画布建节点 + 带参考图直连生图
        const res = await callTool('execute_plan', { generations: gens, auto_run: true, model: panel.model, referenceImages })
        const ok = res && (res.ok === true || (res.ok === undefined && !res.error))
        // 【A层】图像模式结果：成功/失败 + 出图数——高价值，供排查图生图链路
        logger.info('AI助手', '图像模式结果', { ok, entries: (res?.data?.entries || []).length, error: res?.error || '' })
        const entries = res?.data?.entries || []
        const doneCount = entries.filter((e) => e.status === 'completed').length
        const logs = Array.isArray(res?.data?.logs) ? res.data.logs : []
        const summary = ok
          ? `已在画布生图：${entries.length} 张${doneCount ? `，完成 ${doneCount} 张` : ''}`
          : `生图失败：${res?.error || ''}`
        // 【TASK-009】图像模式也展示执行摘要（对齐大雄 workflowLogs）：多参考图拆分/依赖批时有逐步进度可见
        const withLogs = logs.length
          ? `${summary}\n\n执行摘要：\n${logs.map((l) => `${l.level === 'error' ? '❌' : l.level === 'warn' ? '⚠️' : l.level === 'ok' ? '✅' : '·'} ${l.message}`).join('\n')}`
          : summary
        appendMsg({ role: 'assistant', content: withLogs, mode: 'image', createdAt: Date.now(), ...(logs.length ? { execution_summary: true } : {}) })
        if (!ok) setError(res?.error || '图像模式生图失败')
      } catch (e) {
        setError(e?.message || '图像模式生图失败')
        appendMsg({ role: 'assistant', content: `生图异常：${e?.message || e}`, mode: 'image', createdAt: Date.now() })
      } finally {
        setCurrentSnapshot({ messages: messagesRef.current, skills: skillsRef.current, draft: '' })
        patchCurrentWorkflow({ status: 'completed', updatedAt: Date.now() })
        setCurrentPending(null)
        try { captureActiveConversation() } catch { /* ignore */ }
        stateMachineRef.current.setStatus('idle')
        setSending(false)
        sendingRef.current = false
      }
    },
    [callTool, provider, appendMsg, setHistory, isAgentBusy]
  )

  /** 停止（复刻官方 stop）：状态机置 stopping，中止当前请求 */
  const stop = useCallback(() => {
    stateMachineRef.current.setStatus('stopping')
    abortRef.current?.abort()
  }, [])

  /** 清空当前对话（#9：只清当前对话，其他对话不受影响；workflow/pending/memory 一并重置，对齐大雄 clear） */
  const clear = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setHistory([])
    setError(null)
    // 【TASK-006 #6】清空时一并重置 awaitingConfirm + pendingGenerations，否则 clear 后 execute_plan 永久被拒（策划未确认残留）
    setAwaitingConfirm(false)
    // 落盘当前对话为空（messages/attachments/workflow/pending/memory 一并清空）
    setCurrentSnapshot({ messages: [], skills: skillsRef.current, draft: '', attachments: [], workflow: null, pending: null, memory: { summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] }, pendingGenerations: null, awaitingConfirm: false })
    try { captureActiveConversation() } catch { /* ignore */ }
    stateMachineRef.current.setStatus('idle')
  }, [agentKey, setHistory, setAwaitingConfirm])

  /** 刷新对话列表 state（供 UI 渲染） */
  const refreshConversations = useCallback(() => {
    setConversations(getConversations())
  }, [])

  // 对话切换公共流程（#9）：capture 当前 → 经 store 得到新对话 → 同步本 hook 的
  // messages/ref/activeId，重置 error，重载状态机（load 隔离各对话状态），通知 UI 层恢复 skills/草稿。
  // newChat/switchChat/deleteChat 三者的差异仅是"store 调用 + 新 id 来源"，故收敛成一个辅助。
  // 注意：切换前只 setCurrentSnapshot（暂存），与 switchConversation 内部的落盘逻辑配合，勿额外 captureActiveConversation。
  const applyConversationState = useCallback((targetId, snapshot) => {
    setActiveConversationId(targetId)
    setHistory(snapshot.messages)
    setError(null)
    refreshConversations()
    stateMachineRef.current.load(targetId)
    onConversationChangeRef.current?.(snapshot)
  }, [setHistory, refreshConversations])

  /** 新建对话（#9）：capture 当前 → 建空对话并切换；通知 UI 层更新 skills/草稿 */
  const newChat = useCallback(() => {
    if (sendingRef.current) return
    setCurrentSnapshot({ messages: messagesRef.current, skills: skillsRef.current, draft: '' })
    const { id, snapshot } = newConversation()
    applyConversationState(id, snapshot)
  }, [applyConversationState])

  /** 切换对话（#9） */
  const switchChat = useCallback((id) => {
    if (sendingRef.current || !id || id === getActiveConversationId()) return
    setCurrentSnapshot({ messages: messagesRef.current, skills: skillsRef.current, draft: '' })
    const snapshot = switchConversation(id)
    applyConversationState(id, snapshot)
  }, [applyConversationState])

  /** 删除对话（#9）：删除后自动切到下一个；若全删空则建新对话 */
  const deleteChat = useCallback((id) => {
    if (sendingRef.current) return
    setCurrentSnapshot({ messages: messagesRef.current, skills: skillsRef.current, draft: '' })
    const { activeId, snapshot } = deleteConversation(id)
    applyConversationState(activeId, snapshot)
  }, [applyConversationState])

  // 【对齐大雄 prompts 逐条确认通道】更新某条 assistant 消息的字段（如 prompts 确认状态），
  //   同步 state + ref + 落盘。供 AgentPanel 的 PromptConfirmCard 在确认/修改/反悔后写回。
  //   @param {string} assistantContent 定位该 assistant 消息（用内容做弱标识，防消息结构漂移）
  //   @param {object} patch            要更新的字段（如 { prompts: [...], requestedCount }）
  const updateMessageByContent = useCallback((assistantContent, patch) => {
    if (!assistantContent) return
    const next = messagesRef.current.map((m) =>
      (m.role === 'assistant' && m.content === assistantContent) ? { ...m, ...patch } : m
    )
    setHistory(next)
    setCurrentSnapshot({ messages: next, skills: skillsRef.current, draft: '' })
    try { captureActiveConversation() } catch { /* ignore */ }
  }, [setHistory])

  // 【对齐大雄 runAgentGenerations（prompts 通道）】prompts 逐条确认全部确认后，把生成的
  //   generations 直接交给 execute_plan 触发生图（不走 LLM，对齐大雄 confirmed prompts → runAgentGenerations）。
  //   @param {Array} generations 从 prompts 转换的生图计划
  //   @returns {Promise<{ok:boolean, error?:string}>}
  const executePlanDirect = useCallback(async (generations) => {
    if (!Array.isArray(generations) || generations.length === 0) return { ok: false, error: 'generations 为空' }
    const res = await callTool('execute_plan', { generations, auto_run: true })
    const ok = res && (res.ok === true || (res.ok === undefined && !res.error))
    return { ok, error: res?.error || '' }
  }, [callTool])

  return { messages, sending, error, model, setModel, send, sendImageMode, stop, clear, stateAction, conversations, activeConversationId, newChat, switchChat, deleteChat, refreshConversations, updateMessageByContent, executePlanDirect }
}
