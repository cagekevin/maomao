import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasAgentTools, getGenParams, setCurrentReferenceImages } from './useCanvasAgentTools.js'
import { sGet } from './storageAdapter.js'
import { loadAgentChatModel } from './settings/agentModelStore.js'
import { logger } from './logger.js'
import { API_BASE } from './apiBase.js'
import { normalizeImageUrlForSend } from './imageUrl.js'
import { InputStateMachine } from './inputStateMachine.js'
import {
  ensureActiveConversation,
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
} from './conversationStore.js'

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
 */

// 复刻官方 shared.js:2536 `var ur = 8`（多轮工具循环硬上限）
const MAX_TOOL_ROUNDS = 8

// LLM 端点配置（env 可覆盖；默认走 localTool 18080，与 docs/27 一致）
const CHAT_BASE_URL = import.meta.env?.VITE_LLM_CHAT_BASE_URL || ''
const CHAT_API_KEY = import.meta.env?.VITE_LLM_CHAT_API_KEY || ''
const CHAT_MODEL = import.meta.env?.VITE_LLM_CHAT_MODEL || 'gpt-4o-mini'

// Demo 模式：VITE_AGENT_DEMO='1' 时，不发真实 LLM 请求，
// 用本地规则引擎模拟「说一句话 → 调工具 → 画布变化」。方便没配 LLM key 也能演示。
const DEMO_MODE = import.meta.env?.VITE_AGENT_DEMO === '1'

// ── 画布操作准则（单一来源，前端注入）──
// 原设计把准则放后端 agentChat.ts unshift，但默认路径（provider 存在）走 /api/proxy，
// 后端 agentChat.ts 不参与 → 准则在默认形态下是死代码。现改为前端在 useAgentChat 统一注入，
// 覆盖 proxy 与 agent 两条路径。工具名与 useCanvasAgentTools.js 的 AGENT_TOOLS 一一对应。
const CANVAS_AGENT_RULES = `你是猫猫画布助手，正在帮助用户操作当前打开的画布。

【基本原则】
- 用户有 ADHD，需要高效回复。
- 用户要求操作画布时，默认目标就是当前已打开的画布。先调用 list_nodes 了解现有节点，再执行任务；不要臆造节点 id，不要假设画布为空。
- 不要模拟鼠标点击，不要要求用户手动复制 JSON。直接用工具完成画布操作。
- 【简短收尾】工具执行完后用一句话确认结果即可，立即停止调用。

【读取】
- 操作前先 list_nodes（获取全部节点 id/type/标题/坐标）。
- 需要看节点内容时用 get_node_details；需要连线结构用 list_edges。

【创建】
- 新建节点用 create_node，type 可选：textNode（文本）/promptNode（生图）/discountVideoNode（视频）/imageNode（图片）/scriptBoxNode（剧本盒）/group（编组）。
- 内容：textNode/promptNode/discountVideoNode 填 prompt；imageNode 填 label；scriptBoxNode 填 prompt(故事文字)。各类型一个任务建 1 个即可，不要重复建同类节点。
- 批量创建多个同类节点用 batch_create_nodes；多个并行连线用 batch_connect_nodes。

【修改与生成】
- 改节点用 update_node（白名单字段 prompt/label/selectedModel/aspectRatio/resolution/seconds/text）。
- 改任意原始字段才用 update_node_any_field，且只改必要字段，不要抹掉其他 data。
- 用户要求生成内容时，用 generate_node 触发已有节点（先确保该节点有提示词），或 create_node(promptNode, prompt=...) 后 generate_node。
- 生成任务提交后应说明「已在画布开始生成」，不要在没有结果时声称「已生成」。
- 【生成即完成】generate_node 提交成功后，本轮任务即视为完成：不要再次调用 generate_node，也不要再 create_node 建同类节点或重复触发。生成是异步后台任务，你提交后停下即可，结果会自动回填节点。
- 【改图（参考图图生图）】用户引用了参考图（本轮有「参考图编号目录」）并要求改图时，用 execute_plan 批量改图：每步 generations 里填 use_attachments=true 和 attachment_indices（0-based，参考图1→0）精确指向要用哪几张参考图；prompt 只写修改意图 + 保持不变部分，不写「参考第 N 张」这类执行层编号。改图必须本轮带参考图，不要默认参考上一轮结果。若用户说「分别/各自/每张」或「图1变白、图2变黑」这类一对一改图，输出 N 个 generation（N=图数），每个 attachment_indices 只含一张。
- 【主动聚焦】生成/创建/修改某个节点后，主动调用 focus_node 把该节点居中聚焦给用户看，让用户一眼看到成果；一次对话聚焦最近操作的那个节点即可，不要频繁跳动。

【锁定】
- 用户要求锁定/解锁节点用 lock_node：传 nodeId 锁单个，传 type（如 promptNode）锁该类型全部节点。

【组织】
- 相关节点用 connect_nodes 连线表达数据流（source→target）。
- 调整布局用 move_node；删除用 delete_node（会连带删线）。
- 放大/缩小视口用 zoom_in/zoom_out；定位节点用 focus_node。

【撤回 AI 自己的操作】
- 用户说「撤回/回退 AI 刚才那步」时，用 undo_ai 撤回 AI 最近一次改画布的操作（只影响 AI 自己，与用户手动 Ctrl+Z 完全隔离）。
- 注意：undo_ai 只撤回 AI 的操作，不是用户的；不要混淆。`

// ── Skill 执行指令（对齐大雄：Skill 驱动多步编排）──
// 当对话启用了 Skill 时，把它追加到 system，让 LLM 按 Skill 规划 generations 并交给 execute_plan 执行。
// 对齐大雄 AGENT_FORMAT_INSTRUCTION：generations 是执行唯一真相；Skill 原文无损绑定。
const SKILL_EXECUTION_RULES = `【Skill 驱动的批量生图（三阶段，对齐大雄）】
当本轮启用了 Skill，你必须按 Skill 的要求用三阶段完成批量生图：
【阶段1 · 策划】：先规划 generations 数组（每张图一个步骤），每步含 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }。**在回复正文里**用代码块输出完整 generations JSON（格式见下），然后调用 show_plan_for_confirm 工具（只传 plan_text 策划说明即可，generations 可省略）把策划展示给用户确认。**不要**在阶段1直接 execute_plan。
- 正文 generations JSON 格式（用 json 代码块包裹）：
  { "plan": { "goal": "目标", "steps_summary": ["步1", "步2"] }, "generations": [ { "id": "g1", "title": "标题", "prompt": "完整可直接生图的中文视觉描述", "ratio": "1:1", "resolution": "1x", "depends_on_previous": false, "dependency_mode": "none" } ] }
- 前端会自动从你的回复正文里解析并暂存这个 generations，供阶段3 执行使用，所以你**不需要**通过 show_plan_for_confirm 参数再传一遍超大 generations。
【阶段2 · 等待确认】：展示策划后停止工具调用，输出文字请用户确认或补充。用户确认后进入阶段3。
【阶段3 · 执行】：用户确认后，调用 execute_plan 工具执行（系统已自动从阶段1 暂存的 generations 读取，**不要**再传 generations 参数）。若系统提示 generations 为空，才在 execute_plan 参数里补传。

【规划规则】
- Skill 的角色定位、页面结构、文案规则是不可覆盖的约束；不要把 Skill 当风格参考。
- 每步 prompt 必须是完整、纯净、可直接生图的中文视觉描述（含产品一致性、构图、光线、材质、配色、短文案、版式位置）。
- 用户明确指定的数量/比例/画质/语言优先于 Skill 默认值；用户未指定才用 Skill 默认。
- 需要保持前序结果一致性时，后续步骤 depends_on_previous=true、dependency_mode=product_reference（执行器会用前序成功图当参考图）。
- 数量：默认每步 count=1；只有用户明确要求"一次出 N 张同构图"才在某步 count>1；"5主图+8详情"是多个步骤，不是 count=13。
- 【统一风格契约（对齐大雄 global_contract）】阶段1 策划须先给出 global_contract 三字段：visual_positioning（视觉整体定位）、unified_style_prompt（统一风格提示词）、unified_negative_prompt（统一负面提示词），并在 show_plan_for_confirm 里传 global_contract；后续每步 prompt 头部必须原样携带这三项，不可改写、不可省略。`

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

/** 旧单会话历史键（仅用于首次迁移到多对话；会话隔离后消息存 conversationStore） */
const historyKey = (agentKey) => `agent_history_${agentKey || 'canvas-assistant'}`

/** 从 localStorage 读旧单会话历史（首次启动迁移用，对齐大雄"messages → conversations"迁移） */
function loadHistory(agentKey) {
  try {
    const raw = sGet(historyKey(agentKey))
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** SSE 解析（复刻官方 dr 内 v 函数：按 data: 前缀解析 delta，含 content/reasoning/tool_calls）。
 *  导出供单测（AI 助手前端逻辑核心：多轮工具循环依赖它对 SSE 流式结果的解析）。 */
export function parseSSEChunk(line, acc) {
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

/** 把消息数组转成请求体 messages（复刻官方 dr:2584-2623，含附件转 image_url）。
 *  画布操作准则在前端统一注入（单一来源，覆盖 proxy/agent 两条路径）：
 *   - enhance 默认开：unshift CANVAS_AGENT_RULES；
 *   - 若调用方显式传 systemPrompt（外部应用/未来 Skill），拼接在准则之后；
 *   - 启用的 Skill 无损注入（content 原文 + SKILL_EXECUTION_RULES，对齐大雄）；
 *   - memory（对话记忆，对齐大雄 conv.memory）注入最近策划 lastPlan，供多轮上下文；
 *   - 消息里已有 system（历史恢复）则跳过注入，避免重复。
 *  @param {Array} skills 启用的 Skill 数组 [{name, content}]
 *  @param {object} memory 对话记忆 { lastPlan? }
 *  导出供单测（AI 助手前端逻辑核心：确认发给 LLM 的 messages 组装正确）。 */
export function buildRequestMessages(messages, systemPrompt, enhance = true, skills = [], memory = null) {
  const out = []
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
    out.push({ role: 'system', content: `${skillTexts.join('\n\n')}\n\n${SKILL_EXECUTION_RULES}` })
  }
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
  for (const m of messages) {
    // 历史 system 保留（不再 continue 丢弃）：恢复旧对话时保留旧的用户/上下文 system，
    // 画布准则已在上方无条件注入，两者语义互补不冲突。
    if (m.role === 'user' && m.attachments && m.attachments.length > 0) {
      const content = m.attachments.map((a) => ({ type: 'image_url', image_url: { url: a.url } }))
      // 参考图编号目录（对齐大雄）：附加给 AI，让它能用 attachment_indices 精确引用第几张参考图。
      // 对齐参考项目（daxiong-canvas-plugins canvas-agent）：参考图附件带画布坐标 x/y，
      // 这里把坐标以文本形式附给 LLM，让它感知每张参考图来自画布哪个位置。
      const coordLines = m.attachments
        .map((a, i) => (a.x != null || a.y != null ? `参考图${i + 1}：画布坐标 x=${Number(a.x) || 0}, y=${Number(a.y) || 0}` : ''))
        .filter(Boolean)
      if (m.refCatalog) content.push({ type: 'text', text: `${m.refCatalog}\n${coordLines.join('\n')}\n${m.content || ''}` })
      else if (coordLines.length > 0) content.push({ type: 'text', text: `${coordLines.join('\n')}\n${m.content || ''}` })
      else if (m.content) content.push({ type: 'text', text: m.content })
      out.push({ role: 'user', content })
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
        const obj = { role: m.role, content: m.content || '', tool_calls: realCalls }
        if (m.reasoning) obj.reasoning = m.reasoning
        out.push(obj)
      }
      // 空/无 tool_calls 的 assistant：直接透传（不带 tool_calls 字段）
      else {
        const obj = { role: m.role, content: m.content || '' }
        if (m.reasoning) obj.reasoning = m.reasoning
        out.push(obj)
      }
      continue
    }
    if (m.role === 'tool') {
      // tool 消息必须能匹配前面声明的 tool_call_id，否则是孤儿，丢弃（否则后端报错）
      if (!m.tool_call_id || !pendingToolIds.has(m.tool_call_id)) continue
      pendingToolIds.delete(m.tool_call_id)
      out.push({ role: 'tool', content: m.content || '', tool_call_id: m.tool_call_id })
      continue
    }
    const obj = { role: m.role, content: m.content || '' }
    if (m.tool_call_id) obj.tool_call_id = m.tool_call_id
    out.push(obj)
  }
  return out
}

/** 统一解析 Agent 请求的错误响应（proxy / agent 两条路径共用）。
 *  从非 2xx 响应体提取可读错误信息（兼容 OpenAI {error:{message}} 与本地 {error} 两种形态），
 *  失败/非 JSON 回退到默认文案。避免两条路径各写一套错误处理。 */
async function parseAgentError(res, fallback = '调用失败') {
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
export function demoPlan(text, callTool) {
  const t = text.trim().toLowerCase()

  // 识别节点类型关键词 → type
  const typeMap = [
    [/生图|图片|画(?:一张|个)?|生成.*图|image|prompt/i, 'promptNode'],
    [/视频|video/i, 'discountVideoNode'],
    [/文本|text/i, 'textNode'],
    [/剧本|脚本盒|script/i, 'scriptBoxNode'],
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
    const DELETE_VERBS = new Set(['删除', '移除', '删掉', 'delete'])
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

/* ════════════════════════════════════════════════════════════════
 * 图像模式「每参考图一对一改图」拆分（对齐大雄 agentLooksLikePerReferenceEdit
 * L2259 + agentExpandPerReferenceGenerations L2334）。纯函数、无副作用。
 * ────────────────────────────────────────────────────────────────
 * 用户说「分别把图1变白、图2变黑」「每张各自生成一张」这类语义时，
 * 把整批参考图拆成 N 个独立 generation，每步 attachment_indices:[i] 只挂自己那张，
 * 让底层 execute_plan / canvasPlanExecutor 按步精确图生图。非分别语义保持原单 generation 行为。
 */
export function imageModeLooksLikePerReferenceEdit(text = '', attachCount = 0) {
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
export function buildPerReferenceGenerations(referenceImages = [], prompt = '', panel = {}) {
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
    setMessages((prev) => [...prev, msg])
    messagesRef.current = [...messagesRef.current, msg]
  }, [])

  // 整体替换历史（同步 state + ref）
  const setHistory = useCallback((next) => {
    setMessages(next)
    messagesRef.current = next
  }, [])

  // 更新最后一条 streaming assistant 的增量（不新增，原地改最后一条）
  const updateLastStreaming = useCallback((delta) => {
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
    setMessages((prev) => {
      const next = [...prev]
      next[next.length - 1] = { ...assistant, streaming: false }
      messagesRef.current = next
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
   *  - 非流式：AI 助手设置里标注「非流式」时走这里——模型不支持工具调用，
   *    故不传 tools，按普通 JSON 响应解析（choices[0].message.content），仅纯对话。 */
  const roundTrip = useCallback(
    async (requestMessages, signal, onStream) => {
      // 读取 AI 助手聊天模型配置：判断是否非流式（non-stream 模型不支持工具，仅对话）
      const streamMode = loadAgentChatModel()?.streamMode || 'stream'
      const isNonStream = streamMode === 'non-stream'

      // 非流式：不传 tools/tool_choice（模型不支持，传了也没用）；stream 置 false。
      const llmBody = {
        model,
        messages: requestMessages,
        stream: !isNonStream,
        temperature: 0.6,
        ...(isNonStream
          ? {}
          : { tools: toolSchemas, tool_choice: 'auto' })
      }
      // 是否走「多 provider /api/proxy 转发」：provider 存在时（如魔搭，支持 function calling）
      const useProxy = !!provider
      // 非流式响应是普通 JSON，Accept 无需 text/event-stream
      const accept = isNonStream ? 'application/json' : 'text/event-stream'
      // 【链路日志】请求到网关：走 proxy 还是直接 /api/agent，模型、流式模式、消息数、是否带工具
      logger.info('AI助手', '请求', { via: useProxy ? 'proxy' : 'agent', provider: provider?.id || '', model, stream: !isNonStream, msgCount: requestMessages.length, tools: isNonStream ? 0 : (toolSchemas || []).length })
      const res = useProxy
        ? await fetch(`${API_BASE}/api/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: accept },
            body: JSON.stringify({
              url: (provider?.protocol === 'openai' ? 'openai://chat/completions' : (provider?.base_url || '').replace(/\/$/, '') + '/v1/chat/completions'),
              providerId: provider?.id,
              method: 'POST',
              body: JSON.stringify(llmBody)
            }),
            signal
          })
        : await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: accept,
              ...(CHAT_API_KEY ? { Authorization: `Bearer ${CHAT_API_KEY}` } : {})
            },
            body: JSON.stringify(llmBody),
            signal
          })
      if (!res.ok) {
        // 【链路日志】请求失败：状态码
        logger.error('AI助手', '请求失败', { status: res.status, via: useProxy ? 'proxy' : 'agent', model })
        throw new Error(await parseAgentError(res, useProxy ? '代理转发失败' : '调用失败'))
      }
      // 【链路日志】到网关成功拿到响应头（HTTP 状态）
      logger.info('AI助手', '响应', { status: res.status, via: useProxy ? 'proxy' : 'agent', stream: !isNonStream })

      // ── 非流式：普通 JSON 响应，直接解析 choices[0].message ──
      if (isNonStream) {
        const json = await res.json().catch(() => ({}))
        const msg = json?.choices?.[0]?.message || {}
        const assistant = { role: 'assistant', content: String(msg.content || ''), model, createdAt: Date.now() }
        onStream?.({ content: assistant.content, reasoning: '', toolCalls: [] })
        logger.info('AI助手', '非流式结果', { contentLen: assistant.content.length })
        return assistant
      }

      // ── 流式：SSE 逐块解析 ──
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      const acc = { content: '', reasoning: '', toolCalls: [] }

      // 流式回调（节流 50ms，复刻官方 v）
      let lastFlush = 0
      let pendingFlush = false
      const flush = () => {
        lastFlush = Date.now()
        pendingFlush = false
        onStream?.({
          content: acc.content,
          reasoning: acc.reasoning,
          toolCalls: [...acc.toolCalls]
        })
      }
      const scheduleFlush = () => {
        const now = Date.now()
        if (now - lastFlush >= 50) flush()
        else if (!pendingFlush) {
          pendingFlush = true
          setTimeout(flush, 50 - (now - lastFlush))
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const chunk of parts) {
          const before = acc.content.length + acc.reasoning.length + acc.toolCalls.length
          parseSSEChunk(chunk, acc)
          if (acc.content.length + acc.reasoning.length + acc.toolCalls.length > before) scheduleFlush()
        }
      }
      buffer += decoder.decode()
      if (buffer.trim()) parseSSEChunk(buffer, acc)
      flush()

      const assistant = { role: 'assistant', content: acc.content || '', model, createdAt: Date.now() }
      if (acc.reasoning) assistant.reasoning = acc.reasoning
      // 【根因修复】必须基于「过滤后的真实 tool_calls」判断，而非 acc.toolCalls.length。
      // parseSSEChunk 会为每段 tool_calls 创建占位（name 可能为空），若流里 tool_calls 的 name
      // 未拼全/为空，acc.toolCalls 有占位但 filter 后为空 → 旧代码 `if(acc.toolCalls.length>0)`
      // 仍设 `tool_calls:[]`（空数组）→ 存进历史 → 下次发给 LLM 报 Empty tool_calls。
      // 改为：filter 后非空才设，空则完全不设，杜绝空数组。
      const realCalls = acc.toolCalls.filter((t) => t.function?.name)
      if (realCalls.length > 0) assistant.tool_calls = realCalls
      // 【链路日志】流式响应完成：内容长度 + 触发的工具调用
      logger.info('AI助手', '流式结果', { contentLen: assistant.content.length, toolCallCount: realCalls.length, toolNames: realCalls.map((t) => t.function?.name) })
      return assistant
    },
    [endpoint, model, toolSchemas, provider]
  )

  /** 执行一批工具调用并回填 tool 消息（send 的真实分支与 Demo 分支共用）。
   *  tools: [{ name, args, callId? }] → 逐个 callTool，把 tool 消息 append 到历史。
   *  【TASK-006 #1 修复】execute_plan/generate_node/trigger_generation 等是 async 工具，
   *  callTool 返回 Promise。旧实现同步 for 循环拿 `result.ok` 全是 undefined →
   *  回填 LLM `{ok:false,error:undefined}` → 误判失败 → 撞 MAX_TOOL_ROUNDS 死循环 + 重复建节点。
   *  改为 async + 逐个 await，确保回填真实结果（await 普通对象/值也安全，不改变行为）。 */
  const runToolCalls = useCallback(async (tools, callIdFor = () => '') => {
    for (const tc of tools) {
      let args = {}
      if (tc.function?.arguments) {
        try { args = JSON.parse(tc.function.arguments) } catch (e) { console.warn('[Agent] 工具参数 JSON.parse 失败:', tc.function?.name, tc.function?.arguments, e) }
      }
      const result = await callTool(tc.function?.name, args)
      // 【链路日志】工具执行结果：工具名 + 成功/失败（失败带 error），供排查 AI 调工具环节
      if (result?.ok) logger.info('AI助手', '工具', { name: tc.function?.name, ok: true })
      else logger.error('AI助手', '工具失败', { name: tc.function?.name, error: result?.error || '' })
      appendMsg({
        role: 'tool',
        // 失败时也携带 result.nodeId（若工具失败返回了），供对话侧「重试此步骤」定位节点（对齐大雄）
        content: result?.ok ? JSON.stringify({ ok: true, ...(result.data || {}) }) : JSON.stringify({ ok: false, error: result?.error, ...(result?.nodeId ? { nodeId: result.nodeId } : {}) }),
        tool_call_id: callIdFor(tc),
        createdAt: Date.now()
      })
      // Skill 三阶段阶段1：show_plan_for_confirm 把策划展示给用户（作为一条 assistant 消息，可见规划）
      // 门禁只依赖工具成功（result?.ok），与 plan_text/generations 传输彻底解耦（对齐大雄：门禁由前端本地构造）。
      if (tc.function?.name === 'show_plan_for_confirm' && result?.ok) {
        const planText = result.data?.plan_text || '（策划已生成，请确认）'
        // 【对齐大雄】generations 挂到确认消息上，供前端渲染步骤卡片（agentGenCardHtml 等价物）。
        // 来源优先级：回复正文解析暂存（主） > 工具参数传入。都来自 per-conversation pendingGenerations。
        const confirmGens = Array.isArray(result.data?.generations) && result.data.generations.length
          ? result.data.generations
          : (getActivePendingGenerations() || [])
        appendMsg({ role: 'assistant', content: `生成策划：\n${planText}`, generations: confirmGens, model, createdAt: Date.now(), awaiting_confirm: true })
      }
      // 【TASK-009 执行摘要】execute_plan 返回 logs → 渲染一条带逐步进度的「执行摘要」消息（对齐大雄折叠面板）
      // 修复 #1 后 result 是真对象，此判断才真正生效
      if (tc.function?.name === 'execute_plan' && result?.ok && Array.isArray(result.data?.logs) && result.data.logs.length > 0) {
        const lines = result.data.logs.map((l) => {
          const mark = l.level === 'error' ? '❌' : l.level === 'warn' ? '⚠️' : l.level === 'ok' ? '✅' : '·'
          return `${mark} ${l.message}`
        })
        appendMsg({ role: 'assistant', content: `执行摘要：\n${lines.join('\n')}`, model, createdAt: Date.now(), execution_summary: true })
      }
    }
  }, [callTool, appendMsg, model])

  /**
   * Demo 模式（VITE_AGENT_DEMO='1'）：本地规则引擎模拟，不走真实 LLM。
   * 抽独立函数让 send 主流程更清晰（send 里只剩「保护 → steer → 准备 → 真实循环 → 收尾」）。
   * @returns {boolean} true = 已走 Demo 分支处理完，调用方应提前 return（收尾交给 finally）
   */
  const runDemoMode = useCallback(async (text) => {
    const plan = demoPlan(text, callTool)
    if (plan.length > 0) {
      // 模拟 assistant 决策（工具调用）
      const assistantMsg = {
        role: 'assistant', content: '', model,
        tool_calls: plan.map((p, i) => ({
          id: `call_demo_${Date.now()}_${i}`, type: 'function',
          function: { name: p.name, arguments: JSON.stringify(p.args) }
        })),
        createdAt: Date.now()
      }
      appendMsg(assistantMsg)
      // 执行每个工具并回填 tool 结果（TASK-006 #1：await 异步工具，避免 Promise 被序列化）
      for (const [i, p] of plan.entries()) {
        const r = await callTool(p.name, p.args)
        appendMsg({
          role: 'tool',
          content: r?.ok ? JSON.stringify({ ok: true, ...(r.data || {}) }) : JSON.stringify({ ok: false, error: r?.error }),
          tool_call_id: assistantMsg.tool_calls[i].id,
          createdAt: Date.now()
        })
      }
      // 最后补一条 assistant 总结
      const done = plan.map((p) => p.name).join('、')
      appendMsg({
        role: 'assistant',
        content: `已执行画布操作：${done}。${plan.some((p) => p.name === 'create_node') ? '新节点已创建。' : ''}${plan.some((p) => p.name === 'connect_nodes') ? '已建立连线。' : ''}${plan.some((p) => p.name === 'delete_node') ? '节点已删除。' : ''}`,
        model, createdAt: Date.now()
      })
    } else {
      appendMsg({ role: 'assistant', content: '（演示模式）我暂时只会演示这些画布操作：创建节点（生图/视频/文本）、连接两个节点、删除节点、查看画布、适配视图。试试说「创建一个生图节点」或「连接 text-1 和 image-1」。', model, createdAt: Date.now() })
    }
    // Demo 分支落盘交给 finally 统一处理（captureActiveConversation），这里只 return
    abortRef.current = null
    return true
  }, [appendMsg, callTool, model])

  /** 发送（复刻官方 dr:2786-2895 的 send：SSE + 多轮工具循环） */
  const send = useCallback(
    async (text, attachments) => {
      // ── 保护：空内容直接返回 ──
      if (!text.trim() && (!attachments || attachments.length === 0)) return

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
      try {
        // ── Demo 模式（VITE_AGENT_DEMO='1'）：本地规则引擎模拟，不走真实 LLM（逻辑抽到 runDemoMode）──
        if (DEMO_MODE) {
          if (await runDemoMode(text)) return // 收尾交给 finally
        }

        // ── 真实模式：多轮工具循环（≤ MAX_TOOL_ROUNDS）──
        let round = 0
        let assistant // 提升到循环外：供循环结束后判断是否「走满上限仍不收敛」（否则访问 for 块级变量会 ReferenceError）
        // 【三阶段门禁】是否因 show_plan_for_confirm（待用户确认策划）而提前暂停循环。
        // 对齐大雄 awaiting_confirm：展示策划后 stop 工具循环，等用户确认，不再让 AI 继续自言自语/重复推演。
        for (; round < MAX_TOOL_ROUNDS; round++) {
          // 追加流式 assistant 占位（复刻官方）
          appendMsg({ role: 'assistant', content: '', model, streaming: true, createdAt: Date.now() })

          assistant = await roundTrip(
            buildRequestMessages(messagesRef.current, systemRef.current, true, skillsRef.current, getCurrentMemory()),
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

  return { messages, sending, error, model, setModel, send, sendImageMode, stop, clear, stateAction, conversations, activeConversationId, newChat, switchChat, deleteChat, refreshConversations }
}
