/**
 * ════════════════════════════════════════════════════════════════
 * agentCore —— AI 助手「纯函数层 + 常量 + 系统提示词」下沉模块
 * ════════════════════════════════════════════════════════════════
 *
 * 【职责】从 useAgentChat.ts 抽出的「无副作用 / 可独立单测」部分：
 *   - 系统提示词常量：CANVAS_AGENT_RULES / SKILL_EXECUTION_RULES（值已收口至 ../agentConfig.js AGENT_PROMPTS，此处别名 re-export）
 *   - 工具循环常量：MAX_TOOL_ROUNDS / ENABLE_TOOLS_ON_NON_STREAM（值已收口至 ../agentConfig.js，此处 re-export）
 *   - 纯函数：
 *     · parseSSEChunk            SSE 流式增量解析（复刻官方 dr 内 v）
 *     · parseGenerationsFromReply 从 LLM 回复正文解析 plan + generations
 *     · buildRequestMessages     fresh-task 发 LLM 消息组装（协议核心）
 *     · parseAgentError          统一解析 Agent 请求错误
 *     · demoPlan                 Demo 规则引擎
 *     · imageModeLooksLikePerReferenceEdit  图像模式「分别改图」语义判断
 *     · buildPerReferenceGenerations        每参考图一对一 generation 构造
 *     · historyKey / loadHistory 旧单会话历史迁移
 *
 * 【为何独立】这些函数不依赖 React hook 生命周期、不触碰 messagesRef/
 * sendingRef/abortRef 等可变 ref 闭包，抽出来零行为变化、可被 useAgentChat.ts
 * 与单测共同引用（re-export 保测试契约）。改动优先级低于 hook 核心。
 *
 * 【测试契约】useAgentChat.ts 会 re-export 本模块全部导出，既有单测
 * （agentLogic.test.js / demoPlan.test.js / imageModeSplit.test.js /
 * useAgentChat.hook.test.js / scripts/test_agent_tools.cjs）import 路径不变。
 * ════════════════════════════════════════════════════════════════
 */
import type { WorkMode } from './runModeRegistry.ts'
import { contentGet } from '../../base/contentStore.ts'
import { logger } from '../../base/logger.ts'
import { toImageContentBlocks } from '../../base/imageUrl.ts'
import { getSystemPromptForWorkMode, RUN_MODE_IDS } from './runModeRegistry.ts'
import { AGENT_PROMPTS } from '../agentConfig.ts'
import type { ImageMapEntry } from '../conversation/conversationImageMap.ts'

/** 单条工具调用（对齐 OpenAI chat tool_calls 形态）。 */
export interface ToolCall {
  id?: string
  type?: 'function'
  function?: { name: string; arguments: string }
  index?: number
}

/** 单条对话消息（覆盖 LLM 协议各角色，字段按实际取值宽松可选）。 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | Array<{ type: string; [k: string]: unknown }>
  tool_calls?: ToolCall[]
  tool_call_id?: string
  reasoning?: string
  attachments?: Array<{ url?: string; x?: number; y?: number; [k: string]: unknown }>
  refCatalog?: string
}

/** SSE 增量累加器（parseSSEChunk 就地累加）。 */
export interface SSEAccumulator {
  content: string
  reasoning: string
  toolCalls: ToolCall[]
}

/** 启用的 Skill（buildRequestMessages 注入用）。 */
export interface SkillItem {
  name?: string
  content?: string
}

/** 对话记忆（buildRequestMessages memory 注入）。 */
export interface AgentMemory {
  summary?: string
  lastSharedStyle?: string
  facts?: Array<{ k: string; v: string }>
  notes?: string[]
  lastPlan?: { plan_text?: string; generations?: GenerationSpec[] }
  global_contract?: {
    visual_positioning?: string
    unified_style_prompt?: string
    unified_negative_prompt?: string
  }
}

/**
 * 可引用图编号目录项（对齐大雄 agentCurrentImageMap）。
 * 【单一事实来源】真实数据由 conversationImageMap.getCurrentImageMap() 生产（source 只有
 * 'gen'（上一轮生成图）/ 'att'（本轮附件）两种取值），此处直接复用生产侧定义，
 * 避免「注入侧与生产侧各写一份 → source 取值漂移」（此前本处写成 'ref'，与真实数据不符）。
 */
export type ImageRef = ImageMapEntry

/** 单个 generation（生图步骤，大雄协议核心）。 */
export interface GenerationSpec {
  id?: string
  title?: string
  prompt?: string
  ratio?: string
  resolution?: string
  depends_on_previous?: boolean
  dependency_mode?: string
  use_attachments?: boolean
  attachment_indices?: number[]
  type?: string
  [k: string]: unknown
}

// 工具循环常量已收口到 agentConfig（docs/66 §4/A 层）。此处 re-export 保持
// useAgentChat 与既有单测的 import 契约不变（re-export 保测试契约，见本文件头注释）。
export { MAX_TOOL_ROUNDS, ENABLE_TOOLS_ON_NON_STREAM } from '../agentConfig.ts'

/** P6：删除节点工具的动词集合——提为模块常量，避免 parseIntent 每次调用重建 Set */
const DELETE_VERBS = new Set(['删除', '移除', '删掉', 'delete'])

// ── 画布操作准则（单一来源，前端注入）──
// 原设计把准则放后端 agentChat.ts unshift，但默认路径（provider 存在）走 /api/proxy，
// 后端 agentChat.ts 不参与 → 准则在默认形态下是死代码。现改为前端在 useAgentChat 统一注入，
// 覆盖 proxy 与 agent 两条路径。工具名与 useCanvasAgentTools.js 的 AGENT_TOOLS 一一对应。
// 值已收口到 ../agentConfig.js 的 AGENT_PROMPTS.CANVAS_RULES；此处别名 re-export 保 useAgentChat/单测 import 契约。
export const CANVAS_AGENT_RULES = AGENT_PROMPTS.CANVAS_RULES

// ── Skill 执行指令（对齐大雄：Skill 驱动多步编排）──
// 当对话启用了 Skill 时，把它追加到 system，让 LLM 按 Skill 规划 generations 并交给 execute_plan 执行。
// 对齐大雄 AGENT_FORMAT_INSTRUCTION：generations 是执行唯一真相；Skill 原文无损绑定。
// 值已收口到 ../agentConfig.js 的 AGENT_PROMPTS.SKILL_EXECUTION_RULES；此处别名沿用，resolveSkillExecutionRules 不改。
export const SKILL_EXECUTION_RULES = AGENT_PROMPTS.SKILL_EXECUTION_RULES

/**
 * Skill 执行指令按三态确认粒度自适应（docs/64 R1/R6 · docs/65 M5）。
 * Skill 只编排思维路径、不改变确认粒度；确认粒度永远由三态决定。
 * auto（完全自主）时：SKILL 的【阶段2 · 等待确认】作废，展示策划后直接进阶段3 execute_plan，防 LLM 误等确认卡住。
 */
export function resolveSkillExecutionRules(workMode: WorkMode): string {
  if (String(workMode || '').toLowerCase() === RUN_MODE_IDS.AUTO) {
    return `${SKILL_EXECUTION_RULES}\n\n【确认粒度自适应 · 完全自主】当前为完全自主模式：上述【阶段2 · 等待确认】作废——展示 show_plan_for_confirm 策划后【不要】等待用户确认，直接进入【阶段3 · 执行】调用 execute_plan。`
  }
  return SKILL_EXECUTION_RULES
}
// 【已禁用·Gap E·2026-08-21】count 富字段指令暂不开放给模型：执行器 schema 虽声明了 count/type/role 等，
// 但执行链路未兑现（一次只出一张、角色/类型未实际驱动行为），开放会诱导模型输出执行器不理解/不消费的字段。
// 待想清楚「同构图多张」的确切语义后，把下面这行加回 CANVAS_AGENT_RULES 模板即可（勿加回 schema 促成模型空口承诺）：
//   - 数量：默认每步 count=1；只有用户明确要求"一次出 N 张同构图"才在某步 count>1；"5主图+8详情"是多个步骤，不是 count=13。

/** 旧单会话历史键（仅用于首次迁移到多对话；会话隔离后消息存 conversationStore） */
export const historyKey = (agentKey: string): string => `agent_history_${agentKey || 'canvas-assistant'}`

/** 从 localStorage 读旧单会话历史（首次启动迁移用，对齐大雄"messages → conversations"迁移） */
export function loadHistory(agentKey: string): ChatMessage[] {
  try {
    const arr = contentGet(historyKey(agentKey))
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** SSE 解析（复刻官方 dr 内 v 函数：按 data: 前缀解析 delta，含 content/reasoning/tool_calls）。
 *  导出供单测（AI 助手前端逻辑核心：多轮工具循环依赖它对 SSE 流式结果的解析）。 */
export function parseSSEChunk(line: string, acc: SSEAccumulator): void {
  if (!line.startsWith('data:')) return
  const payload = line.slice(5).trim()
  if (!payload || payload === '[DONE]') return
  try {
    const delta = JSON.parse(payload).choices?.[0]?.delta
    if (!delta) return
    if (delta.content) acc.content += delta.content
    if (delta.reasoning_content) acc.reasoning += delta.reasoning_content
    else if (delta.reasoning) acc.reasoning += delta.reasoning
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0
        acc.toolCalls[idx] ||= { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } }
        if (tc.id) acc.toolCalls[idx].id = tc.id
        if (tc.function?.name) acc.toolCalls[idx].function.name += tc.function.name
        if (tc.function?.arguments) acc.toolCalls[idx].function.arguments += tc.function.arguments
      }
    }
  } catch {
    /* 忽略单条解析失败 */
  }
}

/**
 * 从 LLM 回复正文里解析 plan + generations（对齐大雄 parseAgentResponse）。
 * 大雄：generations 由 LLM 在普通回复里以 JSON 输出，前端解析暂存，不走工具参数。
 * 返回 { plan, generations }；解析不到 generations 时返回空数组（不 throw）。
 */
export function parseGenerationsFromReply(content = '') {
  const text = String(content || '')
  let plan = null
  let generations = []
  // 1) 优先提取 ```json ... ``` 代码块
  let jsonStr = ''
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (blockMatch && blockMatch[1] && blockMatch[1].trim()) {
    jsonStr = blockMatch[1].trim()
  }
  // 2) 没有代码块，尝试找最大的 {...} 或 [...] JSON
  if (!jsonStr) {
    const objMatch = text.match(/\{[\s\S]*\}/)
    if (objMatch) jsonStr = objMatch[0]
  }
  if (!jsonStr) return { plan: null, generations: [] }
  let parsed = null
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    // 3) 解析失败：剥离 markdown 围栏再试
    try {
      parsed = JSON.parse(jsonStr.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim())
    } catch (e2) {
      return { plan: null, generations: [] }
    }
  }
  if (parsed && typeof parsed === 'object') {
    if (parsed.plan && typeof parsed.plan === 'object') plan = parsed.plan
    if (Array.isArray(parsed.generations)) generations = parsed.generations.filter((g) => g && typeof g === 'object')
  }
  return { plan, generations }
}

/** ══════════════════════════════════════════════════════════════════════════════
 *  buildRequestMessages —— AI 助手「发 LLM 的 messages」组装核心（fresh-task）
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * 【一句话】把「本轮 user 消息 + system 注入（准则/Skill/memory/可引用图编号）」组装成发给 LLM 的
 *   messages；历史轮次消息（含文字与图）一律不进 LLM 上下文——彻底对齐大雄 fresh-task。
 *
 * ── 完整逻辑（数据流）──
 * 1. system 注入（按序）：
 *    a. CANVAS_AGENT_RULES 画布准则（无条件，enhance=true 时）＋ 外部 systemPrompt；
 *    b. 启用的 Skill 无损注入（content 原文 + SKILL_EXECUTION_RULES）；
 *    c. memory 注入（对齐大雄 agentMemoryPromptBlock）：摘要 / 统一风格 / 已确认信息 / 备注
 *       ＋ lastPlan（最近策划）＋ global_contract（统一风格契约）——跨轮记忆全靠它承载；
 *    d. 当前可引用图编号目录（对齐大雄 agentCurrentImageMap）：上一轮生成图(图1~M) + 本轮参考图(图M+1~N)，
 *       让 LLM 能在 generations 里用「图N」+ direct_refs 精确引用历史图/生成图。
 * 2. 主体消息：只保留「本轮」user 消息（messages 里最后一个 user = 本轮，send 开头刚 setHistory 追加）
 *    及同轮工具循环产生的 assistant/tool。本轮带图则内联本轮图 image_url + refCatalog（attachment_indices）；
 *    本轮不带图则不内联任何历史图。
 *
 * ── 为什么这样设计（「反推图一却全反推」的根治）──
 * 历史轮次的图与 refCatalog 若进入 LLM 上下文，会同时触发两个放大器：
 *   - 真图堆积：各轮真图全部 image_url 内联，模型"看得见"就会处理；
 *   - 撞号：各轮 refCatalog 都从「1」重编，多个「参考图1」并存，模型无法消歧 → 全反推。
 * 本函数彻底阻断二者：历史轮次（含图、含 refCatalog、含文字）一律不进上下文，故不撞号、不堆积。
 *
 * ── 与参考项目大雄（daxiong-canvas-plugins/canvas-agent）的差距对照 ──
 * 差距① 发送层（本函数解决）：大雄 agentFreshTaskHistoryMessages() 恒返回 []（历史不回传），
 *        本轮图在顶层 images 由后端转 OpenAI；我们历史一度全量含图回传。现对齐为 fresh-task。
 * 差距② 表示层（refToken.js + 执行层解决）：大雄把历史图编码成
 *        [参考图1:name]{{agent-ref url=... name=... node=... x=.. y=..}} token 存历史文本，
 *        用 agentCollectKnownRefCatalog + agentParseRefTokensFromText 反查原图；LLM 上下文里
 *        一张历史图都没有。我们历史上直接堆原图 URL 进上下文。现新增 refToken.js（encodeRefToken /
 *        parseRefTokensFromText）对齐 token 化，历史图仍不进 LLM 上下文。
 * 差距③ 执行层（useCanvasAgentTools.execute_plan 解决）：大雄 agentLastUserAttachments（本轮无图回退
 *        上一轮用户图）+ agentLastResults（最近生成结果图）+ agentCurrentImageMap（统一编号图1~M+N）
 *        支撑「改上一张图」；execute_plan 用 direct_refs/「图N」反查原图。我们 execute_plan 现也实现
 *        跨轮回退 + direct_refs 解析，跨轮用图靠执行层反查，不进 LLM 上下文。
 *
 * 【结论】大雄靠「fresh-task + memory 注入 + token 化 + 执行层反查」四件套实现跨轮记忆；
 *   我们已完整对齐这套架构，唯一差异是传输层（大雄顶层 images、我们 image_url 内联，最终都是 OpenAI 格式）。
 *
 *  @param {Array}  messages       完整对话历史（send 时含本轮 user；本函数只取「最近 historyTurns 轮」）
 *  @param {string} systemPrompt   外部 systemPrompt（拼接在画布准则之后）
 *  @param {boolean} enhance        是否注入画布准则（默认 true）
 *  @param {Array}  skills         启用的 Skill 数组 [{name, content}]
 *  @param {object} memory         对话记忆 { summary?, facts?, lastSharedStyle?, notes?, lastPlan?, global_contract? }
 *  @param {Array}  [imageCatalog] 当前可引用图编号目录 [{num,url,name,source}]（对齐大雄 agentCurrentImageMap）
 *  @param {number} [historyTurns] 回传最近 N 轮「纯文字」历史的轮数上限（默认 0 = 维持 fresh-task，只发本轮）。
 *                                  ⚠️【过渡方案·目前最优解·2026-08-18 决策注释】：
 *                                  historyTurns>0 是解决「纯文字对话（如反推提示词→再优化）失忆」的过渡手段：
 *                                  - 解决：上一轮 user/assistant 的纯文字不再被 fresh-task 砍掉，LLM 能接着上下文；
 *                                  - 安全边界：只回传【文字】。历史轮次所有【图片附件一律不内联、图仍走 imageCatalog 编号 +
 *                                    执行层 direct_refs 反查】——绝不把历史真图堆进 LLM 上下文（否则复发
 *                                    「跨轮真图堆积 + refCatalog 每轮从 1 重编撞号 → 反推图一却全反推」）。
 *                                  - 为什么是过渡：它直接放宽 fresh-task 的「连文字也砍」，但没治本。真正的治本是
 *                                    补齐 memory 自动摘要（summary/facts 自动沉淀）+ 结构性历史，届时可移除本参数
 *                                    回到纯 fresh-task + 更强 memory。当前在 memory 摘要未落地前，它是性价比最高的解。
 *                                  - 调用方传 0（默认）→ 行为与旧版完全一致，不破坏既有单测与链路的反推安全。
 *  @param {string} [learnedContext] 可选「学」注入块：调用方用 buildLearnedContext 预提取的本对话历史
 *                                   成功生图样本（脱敏/限 token/按意图相似度排序）。空串=不注入。
 *  @param {string} [projectMemoryContext] 可选「记」注入块：调用方用 buildProjectMemoryContextFromStore
 *                                   提取的按 agentKey 全局长期记忆（MMR 排序/限 token）。空串=不注入。
 *  导出供单测（AI 助手前端逻辑核心：确认发给 LLM 的 messages 组装正确）。 */
export function buildRequestMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  enhance: boolean = true,
  skills: SkillItem[] = [],
  memory: AgentMemory | null = null,
  imageCatalog: ImageRef[] = [],
  historyTurns: number = 0,
  learnedContext: string = '',
  projectMemoryContext: string = '',
  workMode: WorkMode = RUN_MODE_IDS.AUTO,
) {
  const out: ChatMessage[] = []
  // 工具消息配对：assistant 声明 tool_calls 时登记其 id，后续 tool 消息需命中才保留（防孤儿 tool 消息）
  const pendingToolIds = new Set()
  // 画布准则（CANVAS_AGENT_RULES）始终注入（enhance 控制），不因历史已含 system 而跳过。
  // 【bug 修复】旧实现 `hasSystem=messages.some(system)` 为真时：既不注入准则（L186 不满足），
  //   又在遍历时 `if(role==='system') continue` 把历史 system 一并丢弃 → 恢复旧对话时 LLM 收到 0 条 system、
  //   画布准则丢失。现改为：准则无条件注入 + 历史 system 在遍历中保留（见下方不再 continue 跳过）。
  if (enhance) {
    out.push({ role: 'system', content: CANVAS_AGENT_RULES })
    if (systemPrompt) out.push({ role: 'system', content: systemPrompt })
  } else if (systemPrompt) {
    out.push({ role: 'system', content: systemPrompt })
  }
  // Skill 无损注入（对齐大雄：原文包成 ==== Skill 文档 ==== 直接给 LLM，不 rewrite）
  const skillTexts = (skills || [])
    .map((s) => (s && s.content ? `===== Skill 文档开始：${s.name || 'Skill'} =====\n${s.content}\n===== Skill 文档结束：${s.name || 'Skill'} =====` : ''))
    .filter(Boolean)
  if (skillTexts.length > 0) {
    // 阶段2 是否等待确认按三态自适应（docs/65 M5）：auto 时不等待、直接阶段3
    out.push({ role: 'system', content: `${skillTexts.join('\n\n')}\n\n${resolveSkillExecutionRules(workMode)}` })
  }
  // 三态确认粒度分流段（docs/64 §6 / docs/65 M5）：direct→''不注入（不经 LLM）；
  // step-confirm/auto 注入引导 show_plan_for_confirm 可调性——修复根因：无 Skill 常规任务下 LLM 无 plan 使用指引 → plan 调不了。
  // enhance=false（最小请求）时不注入，保持「完全不注入 system」的契约不变。
  if (enhance) {
    const runModePrompt = getSystemPromptForWorkMode(workMode)
    if (runModePrompt) out.push({ role: 'system', content: runModePrompt })
  }
  // memory 注入（对齐大雄 agentMemoryPromptBlock）：让 LLM 记住本对话历史与记忆，而不靠原始消息回传。
  // 【彻底对齐大雄】本函数采用 fresh-task：只把「本轮」user 消息 + memory 注入给 LLM，
  // 历史轮次的消息（含文字与图）一律不回传（对齐大雄 agentFreshTaskHistoryMessages() => []）。
  // 跨轮记忆靠下面 memory 注入（摘要/统一风格/已确认信息/备注/最近策划/统一风格契约）承载。
  const memLines = []
  if (memory && typeof memory === 'object') {
    if (memory.summary) memLines.push(`【本对话摘要】${memory.summary}`)
    if (memory.lastSharedStyle) memLines.push(`【本对话统一风格】${memory.lastSharedStyle}`)
    if (Array.isArray(memory.facts) && memory.facts.length) {
      memLines.push(`【本对话已确认信息】\n${memory.facts.slice(-12).map((f) => `- ${f.k}: ${f.v}`).join('\n')}`)
    }
    if (Array.isArray(memory.notes) && memory.notes.length) {
      memLines.push(`【本对话备注】${memory.notes.slice(-8).join('；')}`)
    }
  }
  if (memLines.length > 0) out.push({ role: 'system', content: memLines.join('\n') })
  // memory 注入（对齐大雄 conv.memory.lastPlan）：让 LLM 记住本对话最近策划过什么
  if (memory && memory.lastPlan && (memory.lastPlan.plan_text || memory.lastPlan.generations?.length)) {
    const planLines = (memory.lastPlan.generations || []).map((g) => `- ${g.title || g.id || ''}: ${String(g.prompt || '').slice(0, 80)}`).join('\n')
    out.push({
      role: 'system',
      content: `【本对话最近策划（供延续/补充，非本轮任务）】\n${memory.lastPlan.plan_text || ''}${planLines ? `\n步骤：\n${planLines}` : ''}`,
    })
  }
  // global_contract 回灌（对齐大雄）：本对话已锁定的统一风格契约，续轮时逐字回灌，保证每步仍携带
  if (memory && memory.global_contract && (memory.global_contract.visual_positioning || memory.global_contract.unified_style_prompt)) {
    const gc = memory.global_contract
    out.push({
      role: 'system',
      content: `【本对话统一风格契约（逐字锁定，每步必须原样带入 prompt 头部）】\n视觉整体定位：${gc.visual_positioning || ''}\n统一风格提示词：${gc.unified_style_prompt || ''}\n统一负面提示词：${gc.unified_negative_prompt || ''}`,
    })
  }
  // 【对齐大雄 agentCurrentImageMap】把「当前可引用的图」以统一编号注入 system，让 LLM 能在 generations 里用
  // 「图N」+ direct_refs 精确引用历史图/上一轮生成图（图本体不进 LLM 上下文，执行层按编号反查原图）。
  // 图1~图M = 上一轮生成结果图；图M+1~图M+N = 本轮用户带的参考图。
  if (Array.isArray(imageCatalog) && imageCatalog.length > 0) {
    const lines = ['【当前可引用的图（供图生图时精确引用，用「图N」编号）】']
    imageCatalog.forEach((img) => {
      lines.push(`图${img.num}：${img.name || `图${img.num}`}${img.source === 'gen' ? '（上一轮生成）' : '（本轮参考图）'}`)
    })
    lines.push('在 generations 某步里，若需引用这些图，把其 url 填进该步的 direct_refs 数组，并在 prompt 里写「图N」；执行层会自动把它当作该步参考图。')
    out.push({ role: 'system', content: lines.join('\n') })
  }
  // 【对齐参考项目 promptLearningService】「学」：注入「本对话历史成功生图样本」为不可信上下文。
  // 样本由调用方用 buildLearnedContext 预提取（含脱敏/限 token/相似度排序），本函数仅透传装配。
  // 空串=无需注入，不污染上下文；即便有样本也只作只读学习，不改变任何规则或权限（见样本自带约束说明）。
  if (learnedContext && typeof learnedContext === 'string' && learnedContext.trim()) {
    out.push({ role: 'system', content: learnedContext })
  }
  // 【对齐参考项目 contextManager 的记忆注入】「记」长期记忆：写入用户已确认的按 agentKey 全局记忆。
  // 块由调用方用 buildProjectMemoryContextFromStore 预提取（MMR 排序/脱敏/限 token），本函数仅透传装配。
  // 空串=无需注入，不污染上下文。置于「学」之后，作为补充事实而非新指令（见块自带约束说明）。
  if (projectMemoryContext && typeof projectMemoryContext === 'string' && projectMemoryContext.trim()) {
    out.push({ role: 'system', content: projectMemoryContext })
  }
  // ── 上下文范围：fresh-task（historyTurns=0） 或 回传最近 N 轮纯文字（historyTurns>0）──
  // 【过渡方案·2026-08-18 决策注释】默认 historyTurns=0 严格维持 fresh-task（对齐大雄
  // agentFreshTaskHistoryMessages() => []）：历史轮次消息（含文字与图）一律不进 LLM 上下文。
  // 但当 historyTurns>0 时，我们把「最近 historyTurns 轮」的历史【文字】回传给 LLM，以解决
  // 「纯文字对话失忆」（如：先"反推这张图提示词"、再"把提示词优化一下"——后者必须知道前者
  // 反推出的提示词文本）。安全边界（不可破坏）：图片永远只走上方 imageCatalog 编号 + 执行层
  // direct_refs 反查，历史轮次【图片附件绝不内联进上下文】——否则复发「反推图一却全反推」。
  // 详见函数头 JSDoc 的「过渡方案」说明。算 startIdx：定位最后一个 user（=本轮），
  // 再向前多回溯 historyTurns 个 user 的起点，确保带上最近 N 轮（含每轮 assistant 文字）。
  let lastUserIdx = -1
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') lastUserIdx = i
  }
  const lastUser = lastUserIdx >= 0 ? messages[lastUserIdx] : null
  const currentHasImages = !!lastUser && lastUser.attachments && lastUser.attachments.length > 0

  // 计算回传起始下标：
  //  - historyTurns<=0：startIdx = lastUserIdx（只发本轮 + 本轮工具循环）——即旧 fresh-task；
  //  - historyTurns>0 ：从「最后一个 user 往前数 historyTurns 个 user」那个 user 处开始，
  //    使最近 N 轮的 user + assistant 文字都能进上下文（tool 消息配对逻辑在后面逐条处理，不受影响）。
  let startIdx = lastUserIdx < 0 ? 0 : lastUserIdx
  if (historyTurns > 0 && lastUserIdx >= 0) {
    let count = 0
    for (let i = lastUserIdx; i >= 0; i--) {
      if (messages[i].role === 'user') count++
      if (count >= historyTurns) { startIdx = i; break }
      if (i === 0) startIdx = 0
    }
  }
  let droppedOrphanTools = 0 // 【B层】被丢弃的孤儿 tool 消息数（配对失败）
  for (let i = startIdx; i < messages.length; i++) {
    const m = messages[i]
    if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
      if (currentHasImages && i === lastUserIdx) {
        // 本轮：内联本轮图 + refCatalog/坐标（供 attachment_indices 精确引用）
        // 收口：图片 content block 统一用 toImageContentBlocks（见 imageUrl.js），与 chatApi 保持一致，禁散写。
        const content: Array<{ type: string; text?: string; url?: string; image_url?: { url: string }; [k: string]: unknown }> = toImageContentBlocks(m.attachments.map((a) => a.url).filter(Boolean))
        // 参考图编号目录（对齐大雄）：附加给 AI，让它能用 attachment_indices 精确引用第几张参考图。
        // 对齐参考项目（daxiong-canvas-plugins canvas-agent）：参考图附件带画布坐标 x/y，
        // 这里把坐标以文本形式附给 LLM，让它感知每张参考图来自画布哪个位置。
        const coordLines = m.attachments
          .map((a, i) => (a.x != null || a.y != null ? `参考图${i + 1}：画布坐标 x=${Number(a.x) || 0}, y=${Number(a.y) || 0}` : ''))
          .filter(Boolean)
        if (m.refCatalog) content.push({ type: 'text', text: `${m.refCatalog}\n${coordLines.join('\n')}\n${String(m.content || '')}` })
        else if (coordLines.length > 0) content.push({ type: 'text', text: `${coordLines.join('\n')}\n${String(m.content || '')}` })
        else if (m.content) content.push({ type: 'text', text: String(m.content) })
        out.push({ role: 'user', content })
      } else {
        // 历史 user 消息（含 historyTurns 回溯范围内的）：图一律不进上下文，仅保留纯文字
        // （不含 refCatalog/坐标，避免撞号干扰；也无 image_url，杜绝历史真图堆积）。
        out.push({ role: 'user', content: m.content || '' })
      }
      continue
    }
    // 【工具消息配对】OpenAI 协议要求 role:'tool' 消息必须紧跟一条带 tool_calls 的
    // assistant 消息，且 tool_call_id 能匹配到某个 tool_call。历史里可能残留「孤儿 tool 消息」
    // （其对应 assistant 的 tool_calls 因空/异常被过滤，或消息序列不完整），若不处理会触发后端
    // `messages with role "tool" must be a response to a preceeding message with "tool_calls"`。
    // 这里维护待配对集合：assistant 声明 tool_calls → 登记 id；tool 消息需命中才保留，否则丢弃。
    // tool_call_id 集合（含已声明待消费的 id），跨消息累积，直到被 tool 消息消费。
    if (m.role === 'assistant') {
      const realCalls = (m.tool_calls || []).filter((t) => t && t.function && t.function.name)
      // 只带「非空」的 tool_calls：空数组([])是 truthy，若不过滤会原样发给 LLM，
      // 触发后端 `Empty tool_calls is not supported in message`。
      if (realCalls.length > 0) {
        for (const t of realCalls) if (t.id) pendingToolIds.add(t.id)
        const obj: ChatMessage = { role: m.role, content: m.content || '', tool_calls: realCalls }
        if (m.reasoning) obj.reasoning = m.reasoning
        out.push(obj)
      }
      // 空/无 tool_calls 的 assistant：直接透传（不带 tool_calls 字段）
      else {
        const obj: ChatMessage = { role: m.role, content: m.content || '' }
        if (m.reasoning) obj.reasoning = m.reasoning
        out.push(obj)
      }
      continue
    }
    if (m.role === 'tool') {
      // tool 消息必须能匹配前面声明的 tool_call_id，否则是孤儿，丢弃（否则后端报错）
      if (!m.tool_call_id || !pendingToolIds.has(m.tool_call_id)) { droppedOrphanTools++; continue }
      pendingToolIds.delete(m.tool_call_id)
      out.push({ role: 'tool', content: m.content || '', tool_call_id: m.tool_call_id })
      continue
    }
    // 【过渡方案·2026-08-18】历史 system 一律不回传：historyTurns>0 提前 startIdx 后，
    // 历史 system（旧注入/脏数据）可能落入循环范围，这里显式跳过——system 只认前置注入
    // （CANVAS_AGENT_RULES / systemPrompt / Skill / memory / imageCatalog），历史 system 不回传，
    // 保持与 fresh-task（historyTurns=0）一致的行为，避免「旧 system 覆盖新准则」。
    if (m.role === 'system') continue
    const obj: ChatMessage = { role: m.role, content: m.content || '' }
    if (m.tool_call_id) obj.tool_call_id = m.tool_call_id
    out.push(obj)
  }
  // 【B层】发给 LLM 的消息组装结果：总消息数 + 丢弃的孤儿 tool 数 + 每条 role——定位 fresh-task/消息配对
  logger.debug('AI助手', '[消息组装]', { outCount: out.length, droppedOrphanTools, historyTurns, startIdx, roles: out.map((m) => m.role) }, { module: 'agent' })
  return out
}

/** 统一解析 Agent 请求的错误响应（proxy / agent 两条路径共用）。
 *  从非 2xx 响应体提取可读错误信息（兼容 OpenAI {error:{message}} 与本地 {error} 两种形态），
 *  失败/非 JSON 回退到默认文案。避免两条路径各写一套错误处理。 */
export async function parseAgentError(res: Response, fallback: string = '调用失败'): Promise<string> {
  let msg = `${fallback} (${res.status})`
  try {
    const text = await res.text()
    const parsed = JSON.parse(text)
    msg = parsed?.error?.message || parsed?.error || (typeof parsed === 'string' ? parsed : text)
  } catch {
    /* 保留默认文案 */
  }
  return msg
}

/**
 * Demo 规则引擎（仅 VITE_AGENT_DEMO='1' 时用）。
 * 模拟 LLM：把「自然语言一句话」映射成一系列工具调用，驱动画布变化。
 * 返回 [{ name, args }, ...]；不认识的话返回 []（assistant 纯文字答复）。
 * 说明：这是原型演示用的简化规则，真实对话应走 roundTrip（真实 LLM）。
 */
export function demoPlan(text: string, callTool?: unknown): Array<{ name: string; args: Record<string, unknown> }> {
  const t = text.trim().toLowerCase()

  // 识别节点类型关键词 → type
  const typeMap: Array<[RegExp, string]> = [
    [/生图|图片|画(?:一张|个)?|生成.*图|image|prompt/i, 'promptNode'],
    [/视频|video/i, 'discountVideoNode'],
    [/文本|text/i, 'textNode'],
    [/编组|group/i, 'group']
  ]
  let type = null
  for (const [re, ty] of typeMap) {
    if (re.test(t)) { type = ty; break }
  }

  // 提取中文/英文引号内容作为 prompt（如「帮我生成一张「赛博朋克」图」）
  let prompt = ''
  const qm = text.match(/[「『"“']([^」』"”']+)[」』"”']/)
  if (qm) prompt = qm[1]
  else if (/生成|创建|画/.test(t)) {
    // 兜底：取「一张…图」等
    const pm = text.match(/(?:一张|一个|一段)?\s*([^，。,．.！？!?\s]{2,30})/i)
    if (pm && pm[1] && !/节点|画布/.test(pm[1])) prompt = pm[1]
  }

  const calls = []

  // 1) 创建节点
  if (/创建|新建|生成|添加|画|放一个|建一个|帮我.*(节点|图|视频)/i.test(t) && type) {
    const label = type === 'promptNode' ? '生图节点' : type === 'discountVideoNode' ? '视频节点' : '文本节点'
    calls.push({ name: 'create_node', args: { type, ...(prompt ? { prompt } : {}), label } })
  }

  // 2) 连接：「把 A 连到 B」「连接 text-1 和 prompt-1」
  if (/连接|连到|连线|connect/i.test(t)) {
    const ids = text.match(/([a-zA-Z0-9_-]+-?\d*)/g)?.filter((s) => s !== t)
    // 匹配「连接 A 和 B」里的两个节点标识
    const m = text.match(/([\w-]+)(?:\s*(?:和|与|到|to)\s*([\w-]+))?/)
    if (m) {
      const a = m[1]
      const b = m[2] || ids?.[1]
      if (a && b && a !== b) calls.push({ name: 'connect_nodes', args: { source: a, target: b } })
    }
  }

  // 3) 删除：「删除 X」。中文删除动词不被 [\w-]+ 匹配，故在全部 token 里取第一个非动词的当节点 id。
  //    （例：删除 text-1 → ['删除','text-1'] → text-1；把 text-1 删掉 → ['text-1'] → text-1）
  if (/删除|移除|删掉|delete/i.test(t)) {
    const tokens = text.match(/([\w-]+)/g) || []
    const id = tokens.find((s) => !DELETE_VERBS.has(s.toLowerCase()))
    if (id) calls.push({ name: 'delete_node', args: { nodeId: id } })
  }

  // 4) 查看画布
  if (/看看|列出|有哪些|查看|list|结构/i.test(t)) {
    calls.push({ name: 'read_canvas', args: {} })
  }

  // 5) 适配视图
  if (/适配|全览|全部显示|fit/i.test(t)) {
    calls.push({ name: 'fit_view', args: {} })
  }

  return calls
}

/* ════════════════════════════════════════════════════════════════
 * 图像模式「每参考图一对一改图」拆分（对齐大雄 agentLooksLikePerReferenceEdit
 * L2259 + agentExpandPerReferenceGenerations L2334）。纯函数、无副作用。
 * ────────────────────────────────────────────────────────────────
 * 用户说「分别把图1变白、图2变黑」「每张各自生成一张」这类语义时，
 * 把整批参考图拆成 N 个独立 generation，每步 attachment_indices:[i] 只挂自己那张，
 * 让底层 execute_plan / canvasPlanExecutor 按步精确图生图。非分别语义保持原单 generation 行为。
 */
export function imageModeLooksLikePerReferenceEdit(text: string = '', attachCount: number = 0): boolean {
  if (attachCount < 2) return false // 单张/无图不拆（对齐大雄 L2262）
  const t = String(text || '')
  // 情况 A：直接「分别/各自/逐一/逐个/每张/各出/各改…」（对齐大雄 L2263）
  if (/(分别|各自|逐一|逐个|每张|各出|各改|各变成|分别改成|分别变成|分别做成)/.test(t)) return true
  // 情况 B：多对象 + 分别/都/各自/改成/变成/换成（对齐大雄 L2264）
  if (/(这两|这两张|这两个|这几张|这几个|全部|两只|两张|两个|几只|几张).{0,16}(分别|都|各自|改成|变成|换成)/.test(t)) return true
  // 情况 C：都/全部改成/变成/换成（对齐大雄 L2265）
  if (/(都改成|都变成|都换成|全部改成|全部变成)/.test(t)) return true
  // 情况 D：多个「目标 + 变化动词」逐一改（对齐大雄 L2266-2267，补强单字「变」与无标点并列）
  //   - 覆盖「图1变白、图2变黑」「图1变成红色图2变成蓝色」「第1张变X、第2张变Y」等
  const perTargets = t.match(/图\s*\d+\s*(?:变成|改成|换成|变为|变)|第\s*\d+\s*张\s*(?:变成|改成|换成|变为|变)/g) || []
  if (perTargets.length >= 2) return true
  // 情况 E：逗号分隔的多个「变成X」目标（对齐大雄 L2266-2267 原逻辑）
  const targets = t.match(/变成[^，,。；;\n]{1,12}/g) || []
  if (targets.length >= 2) return true
  return false
}

/** 构造「每参考图一对一」的 N 个 generation（对齐大雄 agentExpandPerReferenceGenerations L2334） */
export function buildPerReferenceGenerations(referenceImages: string[] = [], prompt: string = '', panel: { ratio?: string; resolution?: string } = {}): GenerationSpec[] {
  return referenceImages.map((url, i) => ({
    id: `direct_image_${Date.now()}_ref${i + 1}`,
    title: `参考图${i + 1}`,
    prompt: String(prompt || '').trim() || '基于该参考图生成一张图',
    ratio: panel.ratio || 'Auto',
    resolution: panel.resolution || '1K',
    depends_on_previous: false,
    dependency_mode: 'none',
    use_attachments: true,
    attachment_indices: [i],
  }))
}
