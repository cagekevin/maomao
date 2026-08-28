import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasAgentTools, getGenParams, setCurrentReferenceImages } from '../canvas/useCanvasAgentTools.js'
import { loadAgentChatModel, loadAgentHistoryTurns } from '../../base/settings/agentModelStore.js'
import { logger } from '../../base/logger.js'
import { withTimeout } from '../../base/asyncGuard.js'
import { API_BASE } from '../../base/config.js'
import { LLM_CHAT_BASE_URL, LLM_CHAT_API_KEY, LLM_CHAT_MODEL, AGENT_DEMO_MODE } from '../../base/config.js'
import { InputStateMachine } from './inputStateMachine.js'
import { generateId } from '../../base/idGen.js'

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
// 「学」：从本对话历史成功生图样本提学习块（照搬参考项目 promptLearningService），注入 buildRequestMessages
import { buildLearnedContext } from './promptLearning.js'
// 「记·长期」：按 agentKey 全局长期记忆注入块（照搬参考项目 memoryRetrieval + contextManager），注入 buildRequestMessages
import { buildProjectMemoryContextFromStore } from './memoryRetrieval.js'
// 「记·长期」持久化：memory_suggest 确认后落库（agentKey 全局）
import { saveProjectMemory, PROJECT_MEMORY_KIND_LABELS } from './projectMemoryStore.js'
// 【刷新恢复去重解析器】pending(messageId 引用) → action/text/attachments（纯函数，见 pendingRecovery.js）
import { resolvePendingRecovery } from './pendingRecovery.js'
// 「记」：分层压缩历史→memory.summary（照搬参考项目 contextCompressionService），挂 send 收尾触发
import { compressToSummary, RECENT_KEEP_COUNT } from './contextCompression.js'
// 上下文预算触发压缩（照搬参考项目 contextManager）：决策吃 messages，内部估算 token，75% 预压缩 / 90% 强制压缩
import { decideContextCompression, resolveInputBudget } from './tokenBudget.js'
// 集中配置：AI 助手上下文窗口默认值与输出预算留白比例（无模型 contextWindow 声明时的保守兜底）
import { AGENT_CONTEXT_WINDOW_DEFAULT, AGENT_CONTEXT_OUTPUT_BUDGET_RATIO } from '../../base/config.js'
// 工作流状态迁移（M2 收口：steer/起步/awaiting_confirm/终态/队列出队的纯函数，落盘仍走 patchCurrentWorkflow）
import { wfStart, wfSteer, wfFinish, wfAwaitConfirm, wfNextSteer } from './workflowState.js'
import { isAgentWorkMode } from './runModeRegistry.js'
// 消息构造/落盘 + 附件归一化（M3 下沉：appendMsg/setHistory/updateLastStreaming/endStreaming/stripStreaming → agentMessages；附件/参考图目录 → agentAttachments）
import { appendMsg, setHistory, updateLastStreaming, endStreaming, stripStreaming } from './agentMessages.js'
import { normalizeAttachmentsForSend, buildRefCatalog } from './agentAttachments.js'
import {
  ensureActiveConversation,
  setAgentKey,
  importLegacy,
  applyConversation,
  newConversation,
  switchConversation,
  deleteConversation,
  captureActiveConversation,
  getActiveConversationId,
  getCurrentSnapshot,
  setCurrentSnapshot,
  getCurrentWorkflow,
  patchCurrentWorkflow,
  getCurrentPending,
  setCurrentPending,
  makePendingRef,
  getCurrentMemory,
  setCurrentMemory,
  setSending,
  setAwaitingConfirm,
  getAwaitingConfirm,
  setActivePendingGenerations,
  getActivePendingGenerations,
  getActivePendingMemorySuggest,
  setActivePendingMemorySuggest,
  getCreditGate, clearCreditGate,
  getCurrentImageMap,
  getCurrentRunMode,
  setCurrentRunMode,
  getWorkMode,
  waitHydrated,
} from '../conversation/conversationStore.js'
// 【消息单源 P5 基座】按字段订阅 store 的 messages（含 activeId 从 store 同步读），
// 避免整包 useConversationStore() 订阅 → 流式高频更新连坐重渲染整个面板。
import { subscribe, getState } from '../conversation/conversationState.js'
import { useStoreSelector, shallowEqual } from '../../base/useStoreSelector.js'

// P15 列表 key 收口（收口在 agentMessages.js：appendMsg/setHistory 统一 withMsgId 补稳定唯一 id）

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
 * 【本实现的关键设计：消息单源化（阶段1A）】
 *  store（conversationState.states[agentKey].conversations[activeId].messages）是消息唯一真相。
 *  渲染：useStoreSelector(subscribe, getState) 按字段订阅 messages，流式高频更新只重渲染消息订阅者。
 *  写入：一律走下方辅助函数（appendMsg/setHistory/updateLastStreaming/endStreaming/stripStreaming）——
 *    低频（appendMsg/setHistory/stripStreaming）走 setCurrentSnapshot（落盘）；
 *    高频流式（updateLastStreaming/endStreaming）走 patchCurrentMessages（仅通知不落盘，finally 统一落盘）。
 *  异步闭包读最新历史：统一 getCurrentSnapshot().messages（commit 同步更新 store，无 ref 漂移问题）。
 * ════════════════════════════════════════════════════════════════
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ★★★ 与参考项目大雄（daxiong-canvas-plugins/canvas-agent）的全部路径对齐设计 ★★★
 * ══════════════════════════════════════════════════════════════════════════════
 * 本文件是 AI 助手的「唯一发送入口」；大雄有独立多条发送路径，我们用「工具循环 + 三阶段门禁」
 * 做了架构级简化统一。下表是权威地图：每条路径大雄怎么走、我们怎么走、对齐状态。改动前先看表，
 * 不要凭记忆改——过去反复推翻就是因为缺这张地图。
 *
 * ── 一、发送路径（大雄 sendAgentMessage 8170 入口；我们统一在 send 单入口）──
 * | 大雄路径 | 大雄入口 | 我们实现 | 对齐状态 |
 * |---|---|---|---|
 * | 图像模式直连生图 | agentSendDirectImageMessage(8132) | send 内 runDirectBranch 直连 execute_plan（docs/65 M7：workMode=direct 时第一行分流） | ✅ 已对齐 |
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
 * ── 二、执行分级 workMode（三态单一真源，runModeRegistry，docs/64 §3/§5 + docs/65 M1-M8）★ 为什么简单任务不 plan ★ ──
 *   用户反馈「发个信息它就执行 plan / 完全自主下 plan 调不了」的根因：此前确认粒度散落推导、且无 Skill 任务
 *   的 system 没引导 show_plan_for_confirm。文档/64 收口为三正交轴：三态轴 / Skill 编排轴 / 积分轴互不进分支。
 *   workMode 是单一真源（runModeRegistry），inputMode / per-conversation runMode 都是 setWorkMode 原子同步的兼容派生物；
 *   确认粒度**永远由 workMode 决定**，Skill 只编排思维路径、不改变确认粒度。
 *   - auto 完全自主（默认）：可用 show_plan_for_confirm 展示规划但**不卡确认**，直接 execute_plan（prompt 已引导，见 agentCore buildRequestMessages）。
 *   - step-confirm 分步确认：调 show_plan_for_confirm 进入 awaiting 门禁，用户确认后才 execute_plan。
 *   - direct 直接生图：send 内部第一行 bypass LLM，直连 execute_plan（runDirectBranch），不经 LLM 编排。
 *   - Skill：独立轴。阶段2 是否等确认按三态自适应（docs/65 M5 resolveSkillExecutionRules）；auto+Skill 不等待，确认粒度仍由三态决定。
 *   积分闸 creditSwitch 与三态正交，只拦真生成那下（docs/64 §2/R6）。
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
  // ── 消息单源（阶段1A）：不再自持 messages state，改为按字段订阅 store 的
  //    conversations[activeId].messages。流式高频更新只重渲染消息订阅者，其余字段不连坐。
  const messages = useStoreSelector(subscribe, getState, (s) => {
    const cur = (s.conversations || []).find((c) => c.id === s.activeId)
    return cur?.messages ?? []
  }, shallowEqual)
  // ── 阶段1D·薄壳化：sending / activeConversationId / conversations 改为 store 字段订阅（非本地 useState）──
  const sending = useStoreSelector(subscribe, getState, (s) => !!s.sending, shallowEqual)
  const [error, setError] = useState(null)
  const [model, setModel] = useState(defaultModel)
  // ── 会话隔离（#9）：当前对话 id + 对话列表由 store 字段订阅（薄壳化，删本地 state + refreshConversations）──
  const activeConversationId = useStoreSelector(subscribe, getState, (s) => s.activeId || '', shallowEqual)
  const conversations = useStoreSelector(subscribe, getState, (s) => s.conversations || [], shallowEqual)

  // 工具层（替代官方 lr()）
  const { toolSchemas, callTool } = useCanvasAgentTools()

  // ref 缓存（避免闭包旧值，对齐官方 g.current/h.current）
  const systemRef = useRef(systemPrompt)
  const skillsRef = useRef(skills)
  const abortRef = useRef(null)
  // 【复合忙判定】对齐大雄 agentIsTaskBusy：发送锁（store.sending）+ 状态机是否运行中。
  // 2026-08-21 消除 sendingRef 双源：异步闭包用 getState().sending 同步读最新（setSending → commit 同步更新 store，
  // 无需依赖渲染；与旧 sendingRef 的"同步读防并发"语义等价，单一真相收口到 store）。
  // 注意：store.sending 是 per-agentKey（跨实例可见）——当前 AgentPanel 单实例无差，多实例时更严格防并发。
  const isAgentBusy = useCallback(() => {
    return !!getState().sending || !!stateMachineRef.current?.isRunning?.()
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

  /**
   * ── 消息同步辅助（M3 下沉至 agentMessages.js：唯一入口，全部落 store；无第二份可变数组）──
   * 低频动作（appendMsg/setHistory/stripStreaming）走 setCurrentSnapshot（落盘）；
   * 高频流式（updateLastStreaming/endStreaming）走 patchCurrentMessages（仅通知不落盘）。
   */

  // 初始加载会话（对齐大雄：从 conversations 恢复当前对话；旧单会话数据迁移一次）。
  // 注：会话键已迁 KV（见 AI助手会话存储迁移-KV收口事实记录.md §2.5），水化为异步——
  //    恢复前必须先等水化完成，否则会在空壳上读取/建空对话，导致刷新后聊天记录丢失。
  useEffect(() => {
    let cancelled = false
    // 0) 先把 conversationStore 的 currentAgentKey 同步到本 hook 的 agentKey 并触发异步水化。
    //    根因（保留原注释）：store 的 currentAgentKey 由 App 的 syncAgentKey effect 异步设置，而本 effect 同步执行；
    //    若 agentKey 在挂载期变化（如 activeProjectId 首帧 undefined → 真实 id），二者可能错位。
    setAgentKey(agentKey)

    // 1) 等异步水化完成（带兜底超时，避免首屏因 KV 未就绪而卡死）：完成后才能读到真实会话数据
    withTimeout(waitHydrated(agentKey), 5000, '会话水化等待超时')
      .catch((e) => {
        // 超时/失败：按「无存量」继续（数据会由后续触发补迁），失败可见不静默
        logger.warn('AI助手', '等待会话水化超时/失败，按当前状态恢复', { agentKey, error: e?.message || String(e) })
      })
      .then(() => {
        if (cancelled) return
        // 2) 确保至少一个对话
        const activeId = ensureActiveConversation()
        // 3) 旧单会话数据迁移：conversations 为空且存在旧历史时，迁成一个对话
        const hist = loadHistory(agentKey)
        const migrated = hist.length > 0 ? importLegacy({ messages: hist, skills: skillsRef.current }) : null
        const snap = migrated || applyConversation(activeId)
        // 4) 同步内存态：activeId / conversations 由 store 字段订阅（阶段1D 薄壳化，无需本地 state）
        setHistory(snap.messages)
        // 5) 把当前对话的 skills/draft/attachments 交给 UI 层（AgentPanel 据此恢复 activeSkills、输入框草稿与参考图）
        if (snap.skills?.length || snap.draft || snap.attachments?.length) onConversationChangeRef.current?.(snap)
        // 6) 状态机按当前对话加载
        stateMachineRef.current.load(getActiveConversationId())
        // 7) pending 恢复（对齐大雄"刷新恢复上次操作"）：刷新前有未完成任务 → 自动重发
        //   【P1a 去重】解析逻辑收敛到 resolvePendingRecovery（纯函数可单测）：按 messageId 找回正文、
        //   优先原始 attachments、dangling-safe（消息被裁剪/未建成）则不空转。
        const rec = resolvePendingRecovery({ pending: getCurrentPending(), messages: getCurrentSnapshot().messages, activeConversationId: getActiveConversationId() })
        if (rec.action === 'send') {
          queueMicrotask(() => {
            // 在对话里插入一条"恢复中"占位提示（对齐大雄占位）
            appendMsg({ role: 'assistant', content: '正在恢复上次未完成的操作…', createdAt: Date.now() })
            sendRef.current?.(rec.text, rec.attachments || [])
          })
        } else if (rec.action === 'drop') {
          // dangling-safe：被引用用户消息已被 AGENT_MSG_MAX 裁剪或尚未建成（崩溃窗口）→ 清 pending 提示重发
          setCurrentPending(null)
          appendMsg({ role: 'assistant', content: '上一段长任务已中断，该段内容因过长被收口清理或尚未保存，请重新输入后发送。', createdAt: Date.now() })
        }
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentKey])

  // 【阶段1B】切 agentKey：中断旧 key 进行中的流（与卸载 abort 分离——卸载不 abort，切页/卸载不断流）。
  // 背景：原实现用「依赖 [agentKey] 的 cleanup abort」，cleanup 在"组件卸载"与"agentKey 变化"都会触发，
  // 误伤了"切页/面板关闭"场景（阶段1C 让 AgentPanel 常驻后卸载本不该断流）。故改为：
  //  - 卸载：不 abort（本 effect 无 cleanup，组件卸载静默结束，异步流继续跑最终落 store）；
  //  - 切 key：用 prevRef 对比只在「agentKey 真正变化」时显式中止旧流，防两个项目流串台。
  // stop()/clear() 的显式 abort 不受影响；send 内 AbortController 生命周期不变。
  const prevAgentKeyRef = useRef(agentKey)
  useEffect(() => {
    if (prevAgentKeyRef.current !== agentKey) {
      abortRef.current?.abort()
      abortRef.current = null
    }
    prevAgentKeyRef.current = agentKey
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

  // ── 「记」：分层压缩历史→memory.summary（照搬参考项目，fire-and-forget，不阻塞主流程）──
  // 节流：同一次会话中短间隔不重复压缩；门槛：历史消息足够多才有压缩价值。
  // 失败/超时只记日志（保留旧摘要），绝不静默吞错也绝不打断发送链路。
  const lastSummaryCompressTsRef = useRef(0)
  const COMPRESS_THROTTLE_MS = 60_000
  const maybeCompressSummary = useCallback(() => {
    const messages = getCurrentSnapshot().messages || []
    const now = Date.now()
    if (messages.length <= RECENT_KEEP_COUNT) return
    if (now - lastSummaryCompressTsRef.current < COMPRESS_THROTTLE_MS) return
    lastSummaryCompressTsRef.current = now
    const prevSummary = getCurrentMemory()?.summary || ''
    const conversationId = getActiveConversationId()
    compressToSummary({ provider, model, messages, previousSummary: prevSummary })
      .then((summary) => {
        if (!summary) return
        // 只写回本对话（防竞态：若用户已切走对话则不覆盖别人的 summary）
        if (getActiveConversationId() !== conversationId) return
        setCurrentMemory({ ...getCurrentMemory(), summary })
      })
      .catch((e) => logger.error('AI助手', '[记] 摘要写回失败', { err: e?.message }))
  }, [provider, model])

  /** 发送（复刻官方 dr:2786-2895 的 send：SSE + 多轮工具循环） */
  const send = useCallback(
    async (text, attachments) => {
      // ── 保护：空内容直接返回 ──
      if (!text.trim() && (!attachments || attachments.length === 0)) return

      // 【三态分流 · docs/65 M7】direct（直接生图）在 send 内部第一行 bypass LLM：
      // 不走 steer 队列、不经 LLM 工具循环，直连 execute_plan（复用内部 runDirectBranch 分支）。
      // runDirectBranch 前向引用：仅在本次调用时求值，此时已初始化（行为与原同：忙碌静默返回）。
      if (!isAgentWorkMode(getWorkMode())) return runDirectBranch(text, attachments)

      // 【B层】发送入口：原文摘要 + 附件数 + 模型/供应商——定位一次 send 的完整入参
      logger.debug('AI助手', '[发送] 入口', { text: String(text).slice(0, 100), attachCount: (attachments || []).length, model, provider: provider?.id || '', busy: isAgentBusy() }, { module: 'agent' })

      // ── steer（补充指令，#7）：任务进行中再发送 → 排入当前对话 workflow.steerQueue（per-conversation），
      //    不打断当前任务，结束后自动执行。队列挂在 workflow 上，切换对话不串台（对齐大雄）。──
      //    忙判定用复合 isAgentBusy()（store.sending 发送锁 + 状态机 running），防发送未收尾时并发双发。
      if (isAgentBusy()) {
        patchCurrentWorkflow(wfSteer(text, attachments))
        appendMsg({ role: 'user', content: text, createdAt: Date.now(), steer: true, statusLabel: '已排队' })
        try { captureActiveConversation() } catch (e) { logger.warn('AI助手', '会话落盘失败', { error: e?.message || String(e) }) } // 落盘队列，切对话不丢
        return
      }

      // ── 准备：锁定发送（store.sending 同步置位，防附件 await 期间并发双发）、置 planning、写 pending ──
      setSending(true)
      setError(null)
      stateMachineRef.current.start({ status: 'planning' })
      setCurrentSnapshot({ messages: getCurrentSnapshot().messages, skills: skillsRef.current, draft: '', attachments: [] })
      patchCurrentWorkflow(wfStart())

      // 构造 user 消息（附件归一化：blob→data、相对→绝对；只认 base64 的 provider 转 base64）
      // 显式补稳定 id：供 setCurrentPending 以 messageId 引用；恢复时按 id 从 messages 找回正文（去重，不再在 pending 存 text 副本）
      const userMsg = { id: generateId('msg'), role: 'user', content: text, createdAt: Date.now(), skills: skillsRef.current.slice() }
      if (attachments && attachments.length > 0) {
        // 发送统一出口守卫：附件图必经归一（含缩略图端点自动还原原图），禁止发 render 小图。见 agentAttachments.js
        userMsg.attachments = await normalizeAttachmentsForSend(attachments, { preferBase64: provider?.refFormat === 'base64' })
        // 【参考图编号目录】对齐大雄：给 AI 参考图顺序编号（按输入框从左到右），
        // AI 才能在 generations 里用 attachment_indices 精确引用「第几张图」（0-based）。
        // 只对「图片附件」编号（含来自画布选中节点的图）；nodeId 记录来源便于执行器定位。
        const imgAtts = userMsg.attachments.filter((a) => a.type !== 'node')
        if (imgAtts.length > 0) {
          userMsg.refCatalog = buildRefCatalog(imgAtts)
        }
        // 参考图 URL 池写入模块级：execute_plan 工具按 AI 的 attachment_indices 精确取用（对齐大雄）
        setCurrentReferenceImages(imgAtts.map((a) => a.url).filter(Boolean))
      }
      setHistory([...getCurrentSnapshot().messages, userMsg])
      // 【P1a 去重】pending 不再存 text 副本，改引用 userMsg.id；保留【原始】attachments（恢复重发经 send 归一化一次，
      //   避免对已归一 base64/绝对 URL 二次压缩）。正文/路径契约见 makePendingRef/normalizePending/pendingRecovery。
      setCurrentPending(makePendingRef({ conversationId: getActiveConversationId(), messageId: userMsg.id, attachments }))

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
        let forcedCompressed = false // 本轮 send 是否已做「请求前强制压缩」（只允许一次，避免工具循环里反复压缩）
        // 上下文预算：输入预算 = 窗口 × (1 − 输出留白比例)。用于估算当前请求是否接近模型上限。
        const budgetInput = resolveInputBudget({ contextWindow: AGENT_CONTEXT_WINDOW_DEFAULT, outputBudgetRatio: AGENT_CONTEXT_OUTPUT_BUDGET_RATIO })
        // 【对齐大雄 runMode 分级】执行分级决定「是否弹执行确认门禁」：
        //   - 完全自主 auto（默认，对齐大雄 agentSetRunMode 6283）：完整规划后直接执行——show_plan_for_confirm
        //     仍会输出规划/generations 供展示，但**不进入 awaiting 确认态**，LLM 继续 execute_plan 直接执行（不弹确认按钮）。
        //   - 分步确认 step-confirm（对齐大雄 6282）：show_plan_for_confirm 进入 awaiting 确认态，展示确认门禁，用户确认后才 execute_plan。
        //   - Skill：无论 runMode 都走三阶段确认（Skill 需要用户确认策划）。
        // 具体「是否进入 awaiting」由 useCanvasAgentTools 的 show_plan_for_confirm 按 runMode 决定（见 presentPlanTool）。
        // 【三阶段门禁】是否因 show_plan_for_confirm（待用户确认策划）而提前暂停循环。
        // 对齐大雄 awaiting_confirm：展示策划后 stop 工具循环，等用户确认，不再让 AI 继续自言自语/重复推演。
        for (; round < MAX_TOOL_ROUNDS; round++) {
          // 追加流式 assistant 占位（复刻官方）
          appendMsg({ role: 'assistant', content: '', model, streaming: true, createdAt: Date.now() })

          // 【过渡方案·2026-08-18】historyTurns 实时读取（AI 助手设置可配）：
          // 0=不回传、1=只上一轮、N=最近 N 轮纯文字历史（图片仍编号化 imageCatalog 图N，不内联，不破坏
          // 「反推图一却全反推」安全底线）。见文件顶部注释 + agentCore.js buildRequestMessages 头注释。
          const makeContextMessages = () => buildRequestMessages(getCurrentSnapshot().messages, systemRef.current, true, skillsRef.current, getCurrentMemory(), getCurrentImageMap(), loadAgentHistoryTurns(), buildLearnedContext(getCurrentMemory(), text), buildProjectMemoryContextFromStore(agentKey, '', text), getWorkMode())
          // ── 上下文预算触发压缩（照搬 contextManager）：估算当前请求，按 inputBudget 决定预/强制压缩 ──
          //  force  → 请求前强制压缩：await 压缩写回 summary 后用新摘要重新组装（压缩失败只记日志，不发超限请求前先尝试）；
          //  precompress → 后台预压缩（复用 maybeCompressSummary 节流），不阻塞本次请求；
          //  none  → 直接发送。goal：长对话避免请求逼近/超过模型输入预算导致失败。
          let contextMessages = makeContextMessages()
          // 估算 + 决策一步到位；force→请求前强制压缩（await 压缩写回后用新摘要重装一次，防反复压缩），
          //         precompress→后台预压缩（复用 maybeCompressSummary 节流，不阻塞），none→直发。
          const action = decideContextCompression({ messages: contextMessages, inputBudget: budgetInput })
          if (action === 'force' && !forcedCompressed) {
            forcedCompressed = true
            logger.info('AI助手', '[预算] 触发强制压缩', { round }, { module: 'agent' })
            const summary = await compressToSummary({ provider, model, messages: getCurrentSnapshot().messages, previousSummary: getCurrentMemory()?.summary || '' })
            if (summary) {
              setCurrentMemory({ ...getCurrentMemory(), summary })
              lastSummaryCompressTsRef.current = Date.now() // 刚压缩过，压制收尾节流的重复压缩
              contextMessages = makeContextMessages() // 用新摘要重新组装（更小）
            }
          } else if (action === 'precompress' && !forcedCompressed) {
            logger.debug('AI助手', '[预算] 触发后台预压缩', { round }, { module: 'agent' })
            maybeCompressSummary()
          }
          assistant = await roundTrip(
            contextMessages,
            controller.signal,
            (delta) => updateLastStreaming(delta)
          )
          // 结束流式（把占位替换为完整 assistant）
          endStreaming(assistant)
          // ── [debug] 非流式链路 · 跳④：roundTrip 返回（定位"前端拿到什么"） ──
          logger.debug('AI助手', '[非流式] 跳④返回', {
            contentLen: (assistant?.content || '').length,
            hasToolCalls: Array.isArray(assistant?.tool_calls) && assistant.tool_calls.length > 0,
            toolNames: (assistant?.tool_calls || []).map((t) => t.function?.name),
            round,
            roundTripOk: true,
          }, { module: 'agent' })

          // 【对齐大雄】阶段1 的 generations 主通道：从 LLM 回复正文解析并暂存（不走工具参数超大 JSON）。
          // 若正文含 plan+generations JSON，解析后写入 per-conversation 暂存，供阶段3 execute_plan 从内存读。
          const { generations: replyGens } = parseGenerationsFromReply(assistant.content)
          if (Array.isArray(replyGens) && replyGens.length > 0) {
            setActivePendingGenerations(replyGens)
          }

          // 无工具调用 → 结束
          logger.debug('AI助手', '[非流式] 跳④循环判定', {
            toolCallsCount: assistant?.tool_calls?.length ?? 0,
            willBreak: !assistant.tool_calls || assistant.tool_calls.length === 0,
            round,
          }, { module: 'agent' })
          if (!assistant.tool_calls || assistant.tool_calls.length === 0) break

          // 执行工具并回填结果（TASK-006 #1：await 异步工具，确保回填真实结果而非 Promise）。
          // 返回 creditHeld：本轮是否「execute_plan 命中积分闸」（awaited:'credit'）。
          const { creditHeld } = await runToolCalls(assistant.tool_calls, (tc) => tc.id)

          // 门禁停循环（仅两类「本轮真走到待确认临界点」才停）——
          //   ① 分步确认（show_plan_for_confirm）→ awaitingConfirm=true。
          //   ② 积分闸（execute_plan 命中 credit 返回 awaited:'credit'）→ 本轮已建好节点、真生成被拦，等用户点生成。
          // 注意：**不用全局 getCreditGate()?.pending** —— 它是可能残留的会话状态（取消/挂起不清），
          // 会让后续「与本轮无关」的工具循环（list_nodes/get_node_details/create_node 等）在第一个工具后就误停。
          // 积分闸只拦「点生成那一下」，绝不打断其它任何工具（用户裁定）。见 agentRuntime.runToolCalls creditHeld。
          if (getAwaitingConfirm() || creditHeld) {
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
        setCurrentSnapshot({ messages: getCurrentSnapshot().messages, skills: skillsRef.current, draft: '' })
        // 更新 workflow 终态（completed/failed/stopped）；清除 pending（任务已有结果，不再需要刷新恢复）
        const wfStatus = !ok ? (aborted ? 'stopped' : 'failed') : 'completed'
        // 【三阶段门禁】展示策划后暂停：workflow 置 awaiting_confirm，状态机同步，等待用户确认按钮。
        // 不清空 pending（用户确认后 send('已确认，请按策划执行') 会重建），也不再自动执行 steer 队列。
        if (pausedForConfirm) {
          patchCurrentWorkflow(wfAwaitConfirm())
          try { captureActiveConversation() } catch (e) { logger.warn('AI助手', '会话落盘失败', { error: e?.message || String(e) }) }
          stateMachineRef.current.setStatus('awaiting_confirm')
          setSending(false)
          abortRef.current = null
          return
        }
        patchCurrentWorkflow(wfFinish(ok, aborted))
        logger.debug('AI助手', '[发送] 终态', { status: wfStatus, rounds: round, pausedForConfirm, steerQueueLen: (getCurrentWorkflow()?.steerQueue || []).length }, { module: 'agent' })
        setCurrentPending(null)
        try { captureActiveConversation() } catch (e) { logger.warn('AI助手', '会话落盘失败', { error: e?.message || String(e) }) }
        stateMachineRef.current.setStatus(ok ? 'idle' : 'failed')
        setSending(false)
        abortRef.current = null
        // ── 「记」：本轮对话收尾后异步压缩历史→memory.summary（失败/超时只记日志，不影响主流程）──
        maybeCompressSummary()
        // ── steer 队列：当前任务结束，自动执行下一条补充指令（per-conversation workflow.steerQueue）──
        const { next, patch: wfNextCtx } = wfNextSteer(wfStatus)
        patchCurrentWorkflow(wfNextCtx)
        try { captureActiveConversation() } catch (e) { logger.warn('AI助手', '会话落盘失败', { error: e?.message || String(e) }) }
        if (next) sendRef.current?.(next.text, next.attachments)
      }
    },
    // 依赖：roundTrip 闭包了 model/provider/toolSchemas；sendRef 用于 steer 续跑（下方 useRef 保持最新）
    // runDirectBranch 不在 deps：它在 send 之后声明（前向引用），且仅靠稳定 deps（callTool/store），
    // 放在 deps 数组会在声明时求值触发 TDZ；body 为懒求值，运行时已初始化，安全。
    [sending, model, roundTrip, callTool, runToolCalls, runDemoMode, appendMsg, setHistory, updateLastStreaming, endStreaming, stripStreaming, agentKey, provider, isAgentBusy, maybeCompressSummary]
  )

  /** 保存 send 引用，供 finally 里自动处理 steer 队列（useCallback 无法自调用） */
  const sendRef = useRef(send)
  sendRef.current = send

  /**
   * 直接生图分支（内部私有，docs/65 M7 并入 send；对齐大雄 agentSendDirectImageMessage）：
   * 参考图 + 最终提示词直连生图，不经过 LLM。由 send 在三态=direct 时第一行分流调用。
   * 把用户提示词 + 参考图构造为一个 generation 步骤，复用 execute_plan（canvasPlanExecutor）在画布直接生图。
   * @param {string} text 最终生图提示词
   * @param {Array}  attachments 参考图 [{ type:'image', url }]
   */
  const runDirectBranch = useCallback(
    async (text, attachments = []) => {
      const prompt = String(text || '').trim()
      if (!prompt && (!attachments || attachments.length === 0)) return
      if (isAgentBusy()) return // 复合忙判定（发送锁 + 状态机 running），防并发双发
      if (!prompt) { setError('图像模式请输入最终生图提示词'); return }
      setSending(true) // 同步锁（store.sending），防附件 await 期间并发
      setError(null)
      stateMachineRef.current.start({ status: 'running' })

      const userMsg = { role: 'user', content: prompt, createdAt: Date.now(), mode: 'image', skills: [] }
      if (attachments && attachments.length > 0) {
        // 发送统一出口守卫：附件图必经归一（含缩略图端点自动还原原图），禁止发 render 小图。见 agentAttachments.js
        userMsg.attachments = await normalizeAttachmentsForSend(attachments, { preferBase64: provider?.refFormat === 'base64' })
      }
      setHistory([...getCurrentSnapshot().messages, userMsg])

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
            // 【图生图·单图修复 2026-08-27】直连模式带参考图时必须声明 use_attachments（对齐多图路径
            // buildPerReferenceGenerations），否则 execute_plan 的参考图解析分支③（useCanvasAgentTools.js）
            // 会把本步作废为 use_attachments:false → 参考图不会写入节点 data.images，图生图失效。
            // 有参考图 → 整批共享（无 attachment_indices，execute_plan 按 use_attachments=true 全量挂 refPool）。
            ...(referenceImages.length ? { use_attachments: true } : {}),
          }]

      // 【积分闸】try 内未赋值时 finally 仍需安全引用（防抛错后 ReferenceError）
      let creditAwaited = false
      try {
        // 复用 execute_plan 工具（canvasPlanExecutor）在画布建节点 + 带参考图直连生图
        const res = await callTool('execute_plan', { generations: gens, auto_run: true, model: panel.model, referenceImages })
        const ok = res && (res.ok === true || (res.ok === undefined && !res.error))
        // 【积分闸兼容】credit 命中 → data.awaited==='credit'：节点建好、未真生成、待点生成。
        // 不复用"已生成"语义（不写「已在画布生图」）、不再次 execute_plan；creditGate 已由 execute_plan 置位并广播，AgentPanel 接 runExistingPlanTool（T10/红线 §6.4）。
        creditAwaited = ok && res?.data?.awaited === 'credit'
        // 【A层】图像模式结果：成功/失败 + 出图数——高价值，供排查图生图链路
        logger.info('AI助手', '图像模式结果', { ok, awaited: res?.data?.awaited || '', entries: (res?.data?.entries || []).length, error: res?.error || '' })
        const entries = res?.data?.entries || []
        const doneCount = entries.filter((e) => e.status === 'completed').length
        const logs = Array.isArray(res?.data?.logs) ? res.data.logs : []
        const summary = creditAwaited
          ? `节点已建好，生成待积分确认，确认后自动生成`
          : ok
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
        setCurrentSnapshot({ messages: getCurrentSnapshot().messages, skills: skillsRef.current, draft: '' })
        // 积分闸待确认时不要标记为"完成"（execute_plan 已置 workflow='ready'）；其余路径正常收尾
        if (!creditAwaited) patchCurrentWorkflow(wfFinish(true))
        setCurrentPending(null)
        try { captureActiveConversation() } catch { /* ignore */ }
        stateMachineRef.current.setStatus('idle')
        setSending(false)
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
    // 【积分闸】清空对话时一并清除 creditGate（含映射），防残留"待点生成"永久拒（对齐 awaitingConfirm 同清理）
    clearCreditGate()
    // 落盘当前对话为空（messages/attachments/workflow/pending/memory 一并清空）
    setCurrentSnapshot({ messages: [], skills: skillsRef.current, draft: '', attachments: [], workflow: null, pending: null, memory: { summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] }, pendingGenerations: null, awaitingConfirm: false })
    try { captureActiveConversation() } catch { /* ignore */ }
    stateMachineRef.current.setStatus('idle')
  }, [agentKey, setHistory, setAwaitingConfirm, clearCreditGate])

  /** 确认「记」长期记忆：memory_suggest 门禁卡片点确认后落库（agentKey 全局，不分项目）。
   *  从会话暂存读建议 → saveProjectMemory 落库 → 清暂存 + 关确认门禁。
   *  @returns {Promise<{ok:boolean, error?:string}>} ok=true 表示已确认并落库（UI 应停止原策划确认动作）
   */
  const confirmPendingMemorySuggest = useCallback(async () => {
    const suggest = getActivePendingMemorySuggest()
    if (!suggest || typeof suggest !== 'object') return { ok: false, error: '没有待确认的项目记忆建议' }
    const saved = await saveProjectMemory(agentKey, {
      kind: suggest.kind,
      content: suggest.content,
      source: { conversationId: getActiveConversationId() },
    })
    setActivePendingMemorySuggest(null)
    setAwaitingConfirm(false)
    const label = (PROJECT_MEMORY_KIND_LABELS[saved.kind] || saved.kind) || ''
    appendMsg({ role: 'assistant', content: `已保存长期记忆：[${label}] ${saved.content}`, model, createdAt: Date.now() })
    try { captureActiveConversation() } catch { /* ignore */ }
    logger.info('AI助手', '[记] 确认落库', { kind: saved.kind, contentLen: (saved.content || '').length }, { module: 'agent' })
    return { ok: true }
  }, [agentKey, model, appendMsg])

  // 对话切换公共流程（#9）：capture 当前 → 经 store 得到新对话 → 重置 error，重载状态机
  //（load 隔离各对话状态），通知 UI 层恢复 skills/草稿。
  //【阶段1D·薄壳化】activeId / conversations 改由 store 字段订阅（newChat/switchChat/deleteChat 内部 commit
  // 已更新 store.activeId + conversations），不再需要本地 state 同步 → 移除 setActiveConversationId / refreshConversations。
  // 注意：切换前只 setCurrentSnapshot（暂存），与 switchConversation 内部的落盘逻辑配合，勿额外 captureActiveConversation。
  const applyConversationState = useCallback((targetId, snapshot) => {
    setHistory(snapshot.messages)
    setError(null)
    stateMachineRef.current.load(targetId)
    onConversationChangeRef.current?.(snapshot)
  }, [setHistory])

  /** 新建对话（#9）：capture 当前 → 建空对话并切换；通知 UI 层更新 skills/草稿 */
  const newChat = useCallback(() => {
    if (getState().sending) return
    setCurrentSnapshot({ messages: getCurrentSnapshot().messages, skills: skillsRef.current, draft: '' })
    const { id, snapshot } = newConversation()
    applyConversationState(id, snapshot)
  }, [applyConversationState])

  /** 切换对话（#9） */
  const switchChat = useCallback((id) => {
    if (getState().sending || !id || id === getActiveConversationId()) return
    setCurrentSnapshot({ messages: getCurrentSnapshot().messages, skills: skillsRef.current, draft: '' })
    const snapshot = switchConversation(id)
    applyConversationState(id, snapshot)
  }, [applyConversationState])

  /** 删除对话（#9）：删除后自动切到下一个；若全删空则建新对话 */
  const deleteChat = useCallback((id) => {
    if (getState().sending) return
    setCurrentSnapshot({ messages: getCurrentSnapshot().messages, skills: skillsRef.current, draft: '' })
    const { activeId, snapshot } = deleteConversation(id)
    applyConversationState(activeId, snapshot)
  }, [applyConversationState])

  // 【对齐大雄 prompts 逐条确认通道】更新某条 assistant 消息的字段（如 prompts 确认状态），
  //   同步 state + ref + 落盘。供 AgentPanel 的 PromptConfirmCard 在确认/修改/反悔后写回。
  //   @param {string} assistantContent 定位该 assistant 消息（用内容做弱标识，防消息结构漂移）
  //   @param {object} patch            要更新的字段（如 { prompts: [...], requestedCount }）
  const updateMessageByContent = useCallback((assistantContent, patch) => {
    if (!assistantContent) return
    const next = getCurrentSnapshot().messages.map((m) =>
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
    // 【积分闸兼容 · 2026-08-27 简化】credit=creditSwitch 是全局总闸，与 runMode 正交。
    // 这一直连点（prompts 确认通道）不自动声称「已生成」：若 execute_plan 返回 awaited:'credit'
    // （积分总闸拦截，节点已建好待点生成），如实透出，调用方(AgentPanel)据此展示「待确认」，绝不二次 execute_plan。
    return { ok, error: res?.error || '', awaited: res?.data?.awaited || null, entries: res?.data?.entries || [] }
  }, [callTool])

  // 【补跑唯一入口（D8）】对「节点已建好、待点生成」的积分确认态真正触发生成。
  // 只走 runExistingPlanTool（由 run_existing_plan 工具分发，ctx 由 useCanvasAgentTools 持有）。
  // 供 AgentPanel「确认生成」按钮 / runDirectBranch(直连) / executePlanDirect 确认回调共用，禁止手写 setNodes/逐节点触发。
  // @returns {Promise<{ok, error?, data?}>}
  const runExistingConfirm = useCallback(async () => {
    const res = await callTool('run_existing_plan', {})
    const ok = res && (res.ok === true || (res.ok === undefined && !res.error))
    return { ok, error: res?.error || '', data: res?.data || null }
  }, [callTool])

  // 【统一确认卡 · 取消】放弃当前待确认（策划/记忆共用）：清记忆暂存 + 翻转 awaitingConfirm 门禁，
  // 并把对应 assistant 消息的 awaiting_confirm 清掉（收起确认卡 + 落盘持久），
  // 避免取消后 execute_plan 被永久拒、也避免残留 pendingMemorySuggest 导致下次确认误判成「记忆确认」。
  // 不通知 LLM（用户放弃本次策划/记忆，可重新输入指令）。
  const cancelPendingConfirm = useCallback((assistantContent) => {
    setActivePendingMemorySuggest(null)
    setAwaitingConfirm(false)
    if (assistantContent) updateMessageByContent(assistantContent, { awaiting_confirm: false })
  }, [setActivePendingMemorySuggest, setAwaitingConfirm, updateMessageByContent])

  // 【发到画布】把一段文本内容建成 textNode（内容落生成区 data.text，抽屉收起）。
  // 复用 AI 操作画布的现成工具链路（create_node → canvasHost），而非裸写 setNodes。
  // 供 AgentPanel「回复右下角箭头」按钮调用；空文本直接忽略。
  const sendContentToCanvas = useCallback((content) => {
    const text = String(content ?? '').trim()
    if (!text) return { ok: false, error: '内容为空' }
    return callTool('create_node', { type: 'textNode', text })
  }, [callTool])

  return { messages, sending, error, model, setModel, send, stop, clear, stateAction, conversations, activeConversationId, newChat, switchChat, deleteChat, updateMessageByContent, executePlanDirect, sendContentToCanvas, confirmPendingMemorySuggest, getActivePendingMemorySuggest, cancelPendingConfirm, runExistingConfirm, getCreditGate, clearCreditGate,
    // 【展示→编排轴薄适配（收口 AgentPanel 的 store 穿透）】回传 UI 会用到的 store 原子能力，
    // 使 AgentPanel 不再直接 import conversationStore（唯一入口收敛到本 hook）。这些是 store 的稳定
    // 模块级函数（透传引用，非拷贝），消息单源下已满足"UI 不直连持久层"的一步；未来如需可再 action 化。
    setCurrentSnapshot, setAwaitingConfirm, getCurrentRunMode, setCurrentRunMode }
}
