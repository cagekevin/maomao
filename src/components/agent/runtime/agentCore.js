/**
 * ════════════════════════════════════════════════════════════════
 * agentCore —— AI 助手「纯函数层 + 常量 + 系统提示词」下沉模块
 * ════════════════════════════════════════════════════════════════
 *
 * 【职责】从 useAgentChat.js 抽出的「无副作用 / 可独立单测」部分：
 *   - 系统提示词常量：CANVAS_AGENT_RULES / SKILL_EXECUTION_RULES
 *   - 工具循环常量：MAX_TOOL_ROUNDS / ENABLE_TOOLS_ON_NON_STREAM
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
 * sendingRef/abortRef 等可变 ref 闭包，抽出来零行为变化、可被 useAgentChat.js
 * 与单测共同引用（re-export 保测试契约）。改动优先级低于 hook 核心。
 *
 * 【测试契约】useAgentChat.js 会 re-export 本模块全部导出，既有单测
 * （agentLogic.test.js / demoPlan.test.js / imageModeSplit.test.js /
 * useAgentChat.hook.test.js / scripts/test_agent_tools.cjs）import 路径不变。
 * ════════════════════════════════════════════════════════════════
 */
import { contentGet } from '../../base/contentStore.js'
import { logger } from '../../base/logger.js'
import { toImageContentBlocks } from '../../base/imageUrl.js'

// 复刻官方 shared.js:2536 `var ur = 8`（多轮工具循环硬上限）
export const MAX_TOOL_ROUNDS = 8

// 【非流式模型工具调用开关】
// - true ：非流式模型也传 tools/tool_choice，并在响应里解析 tool_calls（用于测试模型/网关是否支持 function calling）。
// - false：非流式模型不传 tools，仅纯对话（默认，兼容不支持 function calling 的非流式模型）。
// 一键切换，改这一处即可。
export const ENABLE_TOOLS_ON_NON_STREAM = false

/** P6：删除节点工具的动词集合——提为模块常量，避免 parseIntent 每次调用重建 Set */
const DELETE_VERBS = new Set(['删除', '移除', '删掉', 'delete'])

// ── 画布操作准则（单一来源，前端注入）──
// 原设计把准则放后端 agentChat.ts unshift，但默认路径（provider 存在）走 /api/proxy，
// 后端 agentChat.ts 不参与 → 准则在默认形态下是死代码。现改为前端在 useAgentChat 统一注入，
// 覆盖 proxy 与 agent 两条路径。工具名与 useCanvasAgentTools.js 的 AGENT_TOOLS 一一对应。
export const CANVAS_AGENT_RULES = `你是猫猫画布助手，正在帮助用户操作当前打开的画布。

【基本原则】
- 用户有 ADHD，需要高效回复。
- 不要模拟鼠标点击，不要要求用户手动复制 JSON。直接用工具完成画布操作。
- 【简短收尾】工具执行完后用一句话确认结果即可，立即停止调用。

【第一步 · 意图识别与分流（每次响应的强制首步，先判断再动手）】
在回复用户之前，先停下来判断这一轮用户到底要我做什么，**并根据意图分流到下方对应流程**。不要跳过这一步。

| 用户意图 | 分流到 | 动作 |
|---------|--------|------|
| **纯聊天/无操作意图**（打招呼/闲聊/测试/表达情绪，如「你好」「测试」「随便聊聊」「啊啊啊」） | 【终止】 | 只做简洁文字回应，**不调用任何画布工具**（含 list_nodes），更不建节点/生图/改图 |
| **查看/了解画布**（看看有哪些节点/结构/内容） | 【读取】流程 | 先 list_nodes 了解画布 |
| **新建节点**（创建/添加文本/生图/视频/图片节点） | 【创建】流程 | 按【创建】执行 |
| **生成/改图**（要生成图片、改图、批量生图） | 【修改与生成】流程 | 按【修改与生成】执行 |
| **连线/布局/删除/缩放** | 【组织】流程 | 按【组织】执行 |
| **锁定/解锁** | 【锁定】流程 | 按【锁定】执行 |
| **撤回 AI 刚才的操作** | 【撤回】流程 | 按【撤回】执行 |
| **意图不明确/含糊** | 【询问】 | 先问一句确认，不要靠猜直接动手 |

【意图识别铁律】
- **只执行用户亲口说出的需求**，绝不脑补或推断用户没说过的任务（例如用户说「你好」，绝不能脑补成「要生成一张图」去建节点生图）。
- 用户没有表达明确意图时，一律只做文字回应，绝不调用工具。
- 识别出意图后，**只走对应流程**，不要跨流程做无关操作。

【读取】
- 操作前先 list_nodes（获取全部节点 id/type/标题/坐标）。
- 需要看节点内容时用 get_node_details；需要连线结构用 list_edges。

【创建】
- 新建节点用 create_node，type 可选：textNode（文本）/promptNode（生图）/discountVideoNode（视频）/imageNode（图片）/group（编组）。
- 内容：textNode/promptNode/discountVideoNode 填 prompt；imageNode 填 label。各类型一个任务建 1 个即可，不要重复建同类节点。
- 批量创建多个同类节点用 batch_create_nodes；多个并行连线用 batch_connect_nodes。
- ⚠️【节点 id 必须用工具返回值，禁止自猜】create_node / batch_create_nodes 会在返回结果的 data.id / ids 里给出新节点《真实 id》（形如 promptNode_时间戳_随机码）。后续改/连/聚焦/生成该节点时，必须原样使用工具返回的真实 id；【禁止】按节点类型名自猜序号（如 promptNode_1 / textNode_2），这类 id 在画布上不存在。若不确定某节点 id，先 list_nodes 查画布当前所有节点再引用。

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
export const SKILL_EXECUTION_RULES = `【Skill 驱动的批量生图（三阶段，对齐大雄）】
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
- 【统一风格契约（对齐大雄 global_contract）】阶段1 策划须先给出 global_contract 三字段：visual_positioning（视觉整体定位）、unified_style_prompt（统一风格提示词）、unified_negative_prompt（统一负面提示词），并在 show_plan_for_confirm 里传 global_contract；后续每步 prompt 头部必须原样携带这三项，不可改写、不可省略。`
// 【已禁用·Gap E·2026-08-21】count 富字段指令暂不开放给模型：执行器 schema 虽声明了 count/type/role 等，
// 但执行链路未兑现（一次只出一张、角色/类型未实际驱动行为），开放会诱导模型输出执行器不理解/不消费的字段。
// 待想清楚「同构图多张」的确切语义后，把下面这行加回 CANVAS_AGENT_RULES 模板即可（勿加回 schema 促成模型空口承诺）：
//   - 数量：默认每步 count=1；只有用户明确要求"一次出 N 张同构图"才在某步 count>1；"5主图+8详情"是多个步骤，不是 count=13。

/** 旧单会话历史键（仅用于首次迁移到多对话；会话隔离后消息存 conversationStore） */
export const historyKey = (agentKey) => `agent_history_${agentKey || 'canvas-assistant'}`

/** 从 localStorage 读旧单会话历史（首次启动迁移用，对齐大雄"messages → conversations"迁移） */
export function loadHistory(agentKey) {
  try {
    const arr = contentGet(historyKey(agentKey))
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
 *  导出供单测（AI 助手前端逻辑核心：确认发给 LLM 的 messages 组装正确）。 */
export function buildRequestMessages(messages, systemPrompt, enhance = true, skills = [], memory = null, imageCatalog = [], historyTurns = 0) {
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
        const content = toImageContentBlocks(m.attachments.map((a) => a.url).filter(Boolean))
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
    const obj = { role: m.role, content: m.content || '' }
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
export async function parseAgentError(res, fallback = '调用失败') {
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
