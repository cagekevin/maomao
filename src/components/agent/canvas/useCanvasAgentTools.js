import { useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { registerTool, getTools } from '../../base/toolRegistry.js'
import { defaultNodeData } from '../../base/NodePalette.jsx'
import { runNodeGeneration } from '../../base/taskStore.js'
import { createGroupFromNodes, deleteNodesWithCascade } from '../../base/groupNodes.js'
import { createCanvasHost } from './canvasHost.js'
import { executePlan } from './canvasPlanExecutor.js'
import {
  patchCurrentWorkflow, setCurrentMemory, getCurrentMemory,
  getActiveAiUndoStack, pushActiveAiUndo, popActiveAiUndo,
  getActivePendingGenerations, setActivePendingGenerations,
  getAwaitingConfirm, setAwaitingConfirm,
  getCurrentGlobalContract, setCurrentGlobalContract,
  getCurrentArtifacts, setCurrentArtifacts,
  getCurrentRefImages, setCurrentRefImages,
  getLastUserReferenceImages, getCurrentImageMap,
  getCurrentRunMode, getCurrentSnapshot,
  getWorkMode,
  getCreditGate, setCreditGate, clearCreditGate,
} from '../conversation/conversationStore.js'
// ═══ 补充 import（拆行放置，避免挤爆单行）═══
import { getActivePendingMemorySuggest, setActivePendingMemorySuggest } from '../conversation/conversationStore.js'
// 「记」项目记忆：记忆类别枚举 + 脱敏函数（memory_suggest 工具校验/脱敏用）
import { PROJECT_MEMORY_KINDS, sanitizeMemoryContent } from '../runtime/projectMemoryStore.js'
import { contentGet, contentSet } from '../../base/contentStore.js'
import { generateId } from '../../base/idGen.ts'
import { logger } from '../../base/logger.ts'
import { publish } from '../../base/eventBus.js'
import { CREDIT_SWITCH_KEY, CREDIT_GATE_EVENT } from '../../base/contracts.js'

/* ════════════════════════════════════════════════════════════════
 * AI 生图默认参数（genParams）—— 由 AgentPanel 生图参数区设置，execute_plan 读取。
 * ────────────────────────────────────────────────────────────────
 * 对齐大雄 canvas-agent：Agent 面板有独立的生图参数（provider/model/ratio/resolution），
 * 执行器用它作为批量出图的默认参数。这里用模块级变量传递（类似 taskStore.currentTaskId 模式）：
 *  - AgentPanel 生图参数区变化 → setGenParams() 写入
 *  - execute_plan 工具读取 genParams 传给 canvasPlanExecutor
 * 为什么用模块级而非贯穿 props：execute_plan 在工具层（非组件树），props 贯穿 AgentPanel →
 * useAgentChat → useCanvasAgentTools 链路过长、改动大。模块级单例符合 currentTaskId 既有模式。
 * 注：模型 value 用 providerId::modelId（对齐 buildAllModels/resolveProviderModel）。
 */
const GEN_PARAMS_KEY = 'canvasAgentGenParams'
const DEFAULT_GEN_PARAMS = { model: '', ratio: 'Auto', resolution: '1K' }
/** 惰性加载持久化的生图参数（对齐大雄「设为默认」持久化；刷新/重启不丢） */
function loadGenParams() {
  try {
    const parsed = contentGet(GEN_PARAMS_KEY)
    return parsed && typeof parsed === 'object' ? { ...DEFAULT_GEN_PARAMS, ...parsed } : { ...DEFAULT_GEN_PARAMS }
  } catch {
    return { ...DEFAULT_GEN_PARAMS }
  }
}
let genParams = loadGenParams()
export function setGenParams(patch = {}) {
  genParams = { ...genParams, ...patch }
  try { contentSet(GEN_PARAMS_KEY, genParams) } catch { /* 持久化失败仅降级为内存 */ }
}
export function getGenParams() {
  return genParams
}

/* ════════════════════════════════════════════════════════════════
 * 高消耗积分确认开关（creditSwitch）—— 全局、默认开（contracts.STORAGE_KEYS 登记）。
 * ────────────────────────────────────────────────────────────────
 * 三按钮收敛（docs/59、60）：任何模式下「真正烧图/视频积分那下」是否先确认，
 * 由该开关 + per-conv creditGate 决定。execute_plan 判定 credit 时读它；
 * AgentPanel 顶部开关读写它（setCreditSwitch）。默认开（undefined → true）。
 */
export function getCreditSwitch() {
  try {
    const v = contentGet(CREDIT_SWITCH_KEY)
    return v === undefined || v === null ? true : !!v
  } catch { return true }
}
export function setCreditSwitch(v) {
  try { contentSet(CREDIT_SWITCH_KEY, !!v) } catch { /* 持久化失败仅降级为内存 */ }
}

/* ════════════════════════════════════════════════════════════════
 * 当前对话「用户引用的参考图」URL 数组（对齐大雄 attachment_indices）
 * ────────────────────────────────────────────────────────────────
 * 用户选中画布带图节点/上传图片 → useAgentChat.send 时写入【当前对话】（per-conversation，
 * TASK-006 #7：改下沉到 conversationStore，切对话自动隔离，避免模块级单例跨对话泄漏旧参考图）；
 * execute_plan 工具读取它，按 AI 输出的 attachment_indices（0-based）精确取对应 URL，
 * 写进每个 generation 的 referenceImages（该步图生图参考）。
 */
export function setCurrentReferenceImages(urls = []) {
  setCurrentRefImages(urls)
}
export function getCurrentReferenceImages() {
  return getCurrentRefImages()
}

/* ════════════════════════════════════════════════════════════════
 * Skill 三阶段：阶段1 策划暂存（pendingGenerations）
 * ────────────────────────────────────────────────────────────────
 * 对齐大雄三阶段（理解→规划→执行）：
 *  - 阶段1 策划：LLM 调 show_plan_for_confirm 输出策划，前端展示给用户确认，generations 暂存当前对话。
 *  - 用户确认后（下一轮），LLM 调 execute_plan；若 execute_plan 没传 generations 则用暂存的。
 * 【Step D 下沉】原为模块级变量（多对话串话、刷新丢）。现存 conversationStore 的
 * per-conversation pendingGenerations，随对话自动落盘、刷新不丢、多对话不串。
 * 保留 setPendingGenerations/getPendingGenerations/clearPendingGenerations 导出兼容调用方，
 * 内部改走 conversationStore。
 */
export function setPendingGenerations(gens) {
  setActivePendingGenerations(Array.isArray(gens) && gens.length ? gens : null)
}
export function getPendingGenerations() {
  return getActivePendingGenerations()
}
export function clearPendingGenerations() {
  setActivePendingGenerations(null)
}

/**
 * ════════════════════════════════════════════════════════════════
 * 画布统一工具层（Canvas Agent Tools）
 * ════════════════════════════════════════════════════════════════
 *
 * 【它解决什么问题】
 * 为将来接入「AI 画布助手 Agent」（LLM function calling，见 docs/27 官方 30 工具）
 * 铺路的统一工具层。把画布操作（建/删/改节点、连线、查结构、视图）收敛成
 * 一份「可被 LLM 调用」的工具清单，而不是散落在 App.jsx 里无法被 Agent 感知。
 *
 * 【为什么这样设计（对齐 ARCHITECTURE.md）】
 *  1. 关注点分离（原则1）：独立文件放 base/，App.jsx 仍是通用画布壳，不变成垃圾场。
 *  2. 数据归属（原则2）：工具层通过 useReactFlow() 自取 getNodes/setNodes/setEdges/
 *     screenToFlowPosition/addNodes，无需 App 传参（同 useScriptBoxEngine 模式）。
 *  3. 写回可感知可预测（原则3）：所有写操作一律「不可变局部更新」，只改目标节点，
 *     非目标节点 `: n` 原样返回（引用不变 → 不重渲染）。绝不全局造新引用。
 *  4. 面向真实引擎（原则4）：每个工具返回统一信封 { ok, data | error }（对齐官方
 *     lr() 的返回形状，方便 LLM 解析）；假实现标注真链路。
 *
 * 【工具返回契约】
 *   成功：{ ok: true,  data }
 *   失败：{ ok: false, error: '原因' }   // error 永远是人话，可直接喂 LLM
 *   每个工具是「读画布快照 + 返回结果」的纯操作，不持有内部状态。
 *
 * 【返回信号铁律（新增工具必读）】
 *   每个工具必须返回「让 LLM 能判断任务是否完成」的明确信号，否则 LLM 会把没看到
 *   成果当作「没做完」而反复调用 → 死循环（撞 MAX_TOOL_ROUNDS）。
 *   - 建节点类：返回新节点 id；若节点接收了内容参数（如 prompt），回显该内容以确认已写入。
 *   - 触发生成类：返回 resultUrl / 数量 / 状态等「成果证据」，对齐 generate_node。
 *   - 改/删/连线类：返回被影响的对象 id / 数量。
 *   判据：LLM 看到本工具返回后，能否确信「任务已完成、可以停」？不能 → 补信号。
 *
 * 【工具描述平等原则（新增/修改工具必读）】
 *   AI 助手是通用助手，所有工具（及各节点类型）对 AI 同等重要，不存在「主角」。
 *   给 AI 的 description / 参数说明必须：
 *   - 句式、详略一致（一句话讲清「做什么 + 关键参数」），不要把一个工具写得很长很特殊。
 *   - 只讲「AI 该怎么用」（做什么、传什么），不泄露内部实现/机制（引擎、流程、字段映射等）。
 *   - 各节点类型平等并列说明；某类型确有特有约束可并列带出，但不单独强调。
 *   一旦某个工具被写得特殊，AI 会倾向过度使用/误用它 → 行为不稳定、出错。
 *
 * 【工具排序原则（新增工具必读）】
 *   AGENT_TOOLS 数组顺序 = 模型选择优先级（模型倾向先选靠前的工具）。
 *   常用工具放前面（频率优先），低频工具放后面；别把新工具一律塞末尾。
 *   当前顺序已按此分组：读 → 节点增删 → 改 → 连线 → 生成 → 视图 → 保护/撤销/组织。
 *
 * 【何时用 / 何时不用】
 *   用：Agent 面板、自动化脚本、测试驱动画布时统一走这里。
 *   不用：节点内部 UI 交互（那是节点自己的事）；手写一次性操作（直接 setNodes）。
 *
 * 【接真系统路径】
 *   当前所有工具操作 ReactFlow 内存画布（原型阶段）。
 *   接真引擎时：若 Agent 改走服务端，把 setNodes/setEdges 换成调 localTool 状态接口即可；
 *   工具签名与返回信封不变，LLM 侧无感知。
 *
 * ══ ★ 参考图「跨轮图记忆」数据流总览（改 execute_plan/参考图前必读）★ ══
 * 整条链路跨 useAgentChat / conversationStore / 本文件三个地方，改前先看这条流，别断线：
 *
 *   【写入侧（本轮参考图）】useAgentChat.send 构造本轮 userMsg 时（本文件 setCurrentReferenceImages）：
 *      本轮带图 → getCurrentReferenceImages()（per-conversation，覆盖写）；本轮无图则置空。
 *
 *   【读取侧（execute_plan 参考图三来源，见 executePlanTool 头注释）】
 *      ① direct_refs：LLM 显式引用历史图/上一轮生成图（url 数组），配合 getCurrentImageMap 反查「图N」。
 *      ② attachment_indices：从 refPool（= getCurrentReferenceImages()，空则回退 getLastUserReferenceImages()）按编号取图。
 *      ③ 无图不挂：use_attachments=false（对齐大雄 agentForceNoStaleLastOutputs）。
 *      ⚠️ 绝不自动挂历史生成图（use_last_outputs=false 原则）——只有 direct_refs 显式引用才用历史图。
 *
 *   【回填侧（供下轮引用上一轮生成图）】useAgentChat.runToolCalls 里 execute_plan 成功后，
 *      把结果图 url 回填到 assistant 消息的 lastResults（对齐大雄 agentLastResults）。
 *
 *   【下轮引用】conversationStore.getCurrentImageMap() 读 lastResults（上一轮生成图）+ 本轮附件，
 *      统一编号「图1~图M+N」；useAgentChat 把它传给 buildRequestMessages 的 imageCatalog 注入 LLM，
 *      LLM 就能用「图N」+ direct_refs 精确引用。token 编解码见 refToken.js。
 *
 *   【内存落盘】以上 per-conversation 状态（refImages/lastResults 所在消息/memory）都走 conversationStore，
 *      切对话自动隔离、刷新不丢。不要在别处另建模块级单例，否则多对话串话。
 * ════════════════════════════════════════════════════════════════
 */

/**
 * 每个工具定义：
 *  - name:        工具名（LLM 调用名，与官方 30 工具风格一致）
 *  - description: 中文描述（喂 LLM，让它理解何时调用）
 *  - parameters:  OpenAI function calling 参数 schema
 *  - execute:     (args, ctx) => { ok, data|error }   ctx 为 useReactFlow() 能力
 */

/** 把 args 里某字段归一为 string，缺省给 fallback */
const str = (v, fb = '') => (typeof v === 'string' && v ? v : fb)

/** 【B层日志辅助】工具参数摘要：截断过长字符串，避免 debug 刷屏（保留结构但限长） */
function stringifyArgs(args) {
  if (args == null) return ''
  try {
    const s = JSON.stringify(args)
    return s && s.length > 400 ? `${s.slice(0, 400)}…(${s.length}字符)` : (s || '')
  } catch {
    return String(args).slice(0, 200)
  }
}

/** 把 args 里某字段归一为 number（允许 '12'），非法给 fallback */
const num = (v, fb) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
}

/**
 * 提取节点「主图 URL」（纯函数，导出供 AgentPanel/App 引用带图节点用）。
 * 覆盖常见图字段形态：data.imageUrl / data.url（字符串）、data.images / data.imageUrls（数组）。
 * images 数组元素兼容字符串（url）与对象（{ url } 或 { imageUrl }）。无图返回空串。
 * 设计取舍：只取「主图」一个 URL（用户选中节点即引用其首图），保证简单、可复用现有图片附件链路。
 */
export function getNodeImageUrl(node) {
  const d = node?.data || {}
  for (const key of ['imageUrl', 'url']) {
    if (typeof d[key] === 'string' && d[key]) return d[key]
  }
  for (const key of ['images', 'imageUrls']) {
    const arr = Array.isArray(d[key]) ? d[key] : []
    for (const item of arr) {
      if (typeof item === 'string' && item) return item
      if (item && typeof item === 'object') {
        const u = item.url || item.imageUrl
        if (typeof u === 'string' && u) return u
      }
    }
  }
  return ''
}

/* ════════════════════════════════════════════════════════════════
 * AI 独立撤回（undo_ai）—— 与用户手动撤销【完全隔离】
 * ────────────────────────────────────────────────────────────────
 * 【为什么单独做一套，而不是复用 App 的 useCanvasHistory（Ctrl+Z）】
 *  1. 用户撤销（Ctrl+Z）撤销的是【用户手动】的操作，走 useCanvasHistory；
 *     AI 通过工具改画布是 setNodes/setEdges 直接改，不会进用户的撤销栈。
 *  2. 若让 AI 也写用户的撤销栈，会出现「AI 改 → 用户按 Ctrl+Z 把 AI 的改动也撤了」，
 *     两套语义混在一起，用户分不清撤的是谁的，后续维护也难。
 *  3. 所以拆成两套：用户撤销管用户的，AI 撤回只管 AI 自己的，互不污染。
 *
 * 【升级为分组事务（多步快照栈）】
 *  早期只存"最近一步"快照（undo_ai 只能撤一步）。但 execute_plan 一次会改多个节点
 *  （一次编排 = 建多个节点+连线+触发），用户要能【整体撤回整个编排】。故升级为
 *  aiUndoStack 快照栈：每个写工具执行前 push 改前快照，undo_ai 弹出最近一个恢复，
 *  上限 MAX_AI_UNDO 步。这样 execute_plan 作为一个写操作 push 一次，undo_ai 整体撤回。
 *
 * 【实现】在 buildCanvasAgentTools 里对"会改画布的写工具"统一 wrap：
 *  执行前捕获 { nodes, edges } push 进 aiUndoStack。集中在 wrap 一处，不碰每个工具内部。
 */
const MUTATING_TOOLS = new Set([
  'create_node', 'batch_create_nodes',
  'delete_node', 'batch_delete_nodes',
  'update_node', 'update_node_any_field',
  'connect_nodes', 'batch_connect_nodes', 'delete_edge',
  'move_node', 'group_nodes', 'lock_node',
  'execute_plan', // 多步编排：一次改多个节点，整体入 AI 撤销栈（undo_ai 可整体撤回）
])
/** AI 撤销栈上限（分组事务可回滚步数）；【Step D】栈存在 conversationStore per-conversation，不再模块级 */
const MAX_AI_UNDO = 20

// update_node 白名单字段（对齐官方 update_node，防 LLM 乱改任意 data 造成失同步）。
// 提为模块常量：避免每次 execute 重建数组；description/parameters 与之一致（含 locked）。
const UPDATE_NODE_WHITELIST = ['prompt', 'label', 'selectedModel', 'aspectRatio', 'resolution', 'seconds', 'text', 'locked']

/** P6：中文数字 → 阿拉伯数字映射（图一~图十 → 图1~图10）。提为模块常量，避免 execute_plan 每次重建。 */
const CN_TO_ARABIC = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9', '十': '10' }
/** P6：按「图N」编号缓存对应正则（entry.num 动态插值），避免 refs.forEach 内重复 new RegExp。编号取值有限，天然防膨胀。 */
const FIG_NUM_RE_CACHE = new Map()
function getFigNumRegex(num) {
  let re = FIG_NUM_RE_CACHE.get(num)
  if (!re) {
    re = new RegExp(`图\\s*${num}(?![0-9])`, 'g')
    FIG_NUM_RE_CACHE.set(num, re)
  }
  return re
}

/**
 * 分辨率 → 画质档位（imageSize）映射。PromptNode 的画质档是 1K/2K/4K，
 * LLM 可能传 720p/1080p/1440p/2K/4K，这里统一归一：1080p→1K、1440p/2K→2K、4K→4K，
 * 兜底 1K。未知/空值返回 null（调用方不设置）。
 */
function normalizeResolution(res) {
  if (!res) return null
  const r = String(res).trim().toLowerCase()
  if (r.includes('4k')) return '4K'
  if (r.includes('1440') || r.includes('2k')) return '2K'
  return '1K' // 720p / 1080p / 默认
}

/** 取节点宽度（ReactFlow 测量后）：优先 width，其次 measured.width，兜底 280（对齐参考项目 nodeRect 兜底 w=280） */
function nodeWidth(n) {
  const w = Number(n?.width) || Number(n?.measured?.width) || 0
  return w > 0 ? w : 280
}

/**
 * 新建节点默认位置 —— 对齐参考项目（daxiong-canvas-plugins canvas-agent 的 viewportAnchor）。
 * 1) 有选中节点：放在「选中区最右边界 + 100px」处，y 对齐选中区顶部（水平排列、顶部对齐）。
 * 2) 无选中：放视口中心（screenToFlowPosition 屏幕中心 → 画布世界坐标）。
 */
function computeCreatePosition(nodes, screenToFlowPosition, vw, vh) {
  const selected = (nodes || []).filter((n) => n.selected)
  if (selected.length > 0) {
    const right = Math.max(...selected.map((n) => Number(n.position?.x || 0) + nodeWidth(n)))
    const top = Math.min(...selected.map((n) => Number(n.position?.y || 0)))
    return { x: right + 100, y: top }
  }
  // 无选中 → 视口中心（浏览器环境；非浏览器/测试兜底 {0,0}）
  return screenToFlowPosition?.({ x: (vw || 0) / 2, y: (vh || 0) / 2 }) || { x: 0, y: 0 }
}

/**
 * P11：建节点的纯构建函数（无副作用）。create_node / batch_create_nodes 共用，
 * 避免批量建在循环内逐条 setNodes（N 个节点触发 N 次全量重渲染）。
 * @param currentNodes 当前节点快照（批量时传「虚拟增长」的数组，保持横向自动布局）
 * @returns { error? } 或 { id, newNode, edges }
 */
function buildCreateNode(args, ctx, currentNodes) {
  const type = str(args.type)
  // agent 可创建的节点类型白名单（不含剧本盒等复合节点）。
  // 用白名单而非 getPaletteNode：即使调色板里新增了剧本盒等类型，agent 也不会被允许创建。
  const ALLOWED_TYPES = ['textNode', 'promptNode', 'imageNode', 'discountVideoNode', 'group']
  if (!type || !ALLOWED_TYPES.includes(type)) return { error: `未知节点类型：${type}。可选：${ALLOWED_TYPES.join('、')}` }
  const data = { ...defaultNodeData(type), ...(args.label ? { label: args.label } : {}), ...(args.prompt ? { prompt: args.prompt } : {}) }
  // textNode 内容落「生成区」（data.text，TextNode 主容器/AI 生成结果显示处），而非抽屉区（data.prompt）。
  // 显式传 text（按钮「发到画布」等）时写 data.text；AI 走 prompt（抽屉区）的历史行为保持不变。
  if (type === 'textNode' && args.text !== undefined && args.text !== null) {
    data.text = String(args.text)
  }
  // 生图类节点：把 AI 传的 aspectRatio / resolution 写进 data（PromptNode 读 data.aspectRatio / data.imageSize）。
  // 之前这两个参数被忽略，导致「让 AI 建 9:16 节点」比例不生效。
  if (['promptNode', 'discountVideoNode'].includes(type)) {
    if (args.aspectRatio) data.aspectRatio = str(args.aspectRatio)
    if (args.resolution) data.imageSize = normalizeResolution(str(args.resolution))
  }
  // 位置：优先用 LLM 显式传的 position；否则按参考项目（daxiong-canvas-plugins canvas-agent）
  // 的「空位自动计算」放新节点——有节点时在最右侧节点右侧水平追加、顶部对齐，避免重叠；
  // 画布无节点时才放视窗中心。这样 AI 建多个节点会自动横向排开，不乱叠。
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0
  const position = args.position
    ? { x: num(args.position.x, 0), y: num(args.position.y, 0) }
    : computeCreatePosition(currentNodes, ctx.screenToFlowPosition, vw, vh)
  const id = generateId(type)
  const newNode = { id, type, position: { ...position }, data }
  // 生图节点默认 420×420（对齐 App.jsx addNode，避免端口跑偏）
  if (type === 'promptNode') Object.assign(newNode, { width: 420, height: 420, style: { width: 420, height: 420 } })

  let edges = []
  if (args.connectFrom) {
    const src = currentNodes.find((n) => n.id === args.connectFrom)
    if (src) {
      edges = [{ id: `e-${src.id}-${id}`, source: src.id, sourceHandle: null, target: id, type: 'default', animated: false }]
    }
  }
  return { id, newNode, edges }
}

/**
 * 建节点工具（复刻官方 create_node + batch_create_nodes）。
 * type 从白名单取（textNode/promptNode/imageNode/discountVideoNode/group），默认给默认 data；prompt/label 可覆盖。
 * 返回新建节点 id 列表，供后续连线/改节点用。
 */
const createNodeTool = {
  name: 'create_node',
  description:
    '创建单个节点。type 指定节点类型（可选值见 type 参数说明），prompt 填该类型对应的内容，可选 text（仅 textNode：内容落文本生成区）、label、position、connectFrom、aspectRatio、resolution。返回新节点 id。',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['textNode', 'promptNode', 'imageNode', 'discountVideoNode', 'group'],
        description: '节点类型：textNode=文本(text=内容落生成区/prompt=内容落抽屉)/promptNode=生图(prompt=画面提示词)/imageNode=图片(label=说明)/discountVideoNode=视频(prompt=视频提示词)/group=编组'
      },
      prompt: { type: 'string', description: '提示词/内容（textNode 时落提示词抽屉）' },
      text: { type: 'string', description: '文本内容（仅 textNode：落文本生成区，优先于 prompt）' },
      label: { type: 'string', description: '节点标题（可选）' },
      aspectRatio: { type: 'string', description: '生图比例，如 9:16 / 16:9 / 1:1 / 3:4 / 4:3（仅 promptNode/discountVideoNode 生效，可选）' },
      resolution: { type: 'string', description: '生图画质档位：720p/1080p/1440p/2K/4K，会映射到 1K/2K/4K（仅 promptNode/discountVideoNode 生效，可选）' },
      position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, description: '画布坐标（可选，默认视窗中心）' },
      connectFrom: { type: 'string', description: '从该节点拉一条连线到新节点（可选）' }
    },
    required: ['type']
  },
  execute(args, ctx) {
    const host = createCanvasHost(ctx)
    const built = buildCreateNode(args, ctx, ctx.getNodes())
    if (built.error) return { ok: false, error: built.error }
    host.appendNode(built.newNode)
    if (built.edges.length) host.appendEdges(built.edges)
    return { ok: true, data: { id: built.id, position: built.newNode.position, connected: built.edges.length > 0 } }
  }
}

/** 批量建节点（batch_create_nodes）—— 复用 buildCreateNode，基于虚拟节点数组连续布局，一次写回 */
const batchCreateNodesTool = {
  name: 'batch_create_nodes',
  description: '批量创建多个节点（元素结构与 create_node 相同）。适合一次搭建整条流程。返回全部新节点 id。',
  parameters: {
    type: 'object',
    properties: {
      nodes: { type: 'array', items: { type: 'object' }, description: '节点数组，每个元素 { type, prompt?, label?, position?, connectFrom? }' }
    },
    required: ['nodes']
  },
  execute(args, ctx) {
    if (!Array.isArray(args.nodes) || args.nodes.length === 0) return { ok: false, error: 'nodes 数组为空' }
    const host = createCanvasHost(ctx)
    // P11：批量建——先基于「虚拟节点数组」逐条构建（保持横向自动布局，与逐条 create_node 位置一致），
    // 收集全部新建节点后，用 host.appendMany 单次 setNodes/setEdges 写回，
    // 避免 N 个节点触发 N 次全量 setNodes（ReactFlow 重渲染风暴）。
    // 注意点：单次 setNodes 节点极多时仍可能卡，必要时分批（每批 ≤50）用 rAF 切帧（见收口方案 P11）。
    let virtual = ctx.getNodes()
    const ids = []
    const createdNodes = []
    const newEdges = []
    let lastError = null
    for (const one of args.nodes) {
      const built = buildCreateNode(one, ctx, virtual)
      if (built.error) { lastError = built.error; continue }
      virtual = [...virtual, built.newNode]
      ids.push(built.id)
      createdNodes.push(built.newNode)
      if (built.edges.length) newEdges.push(...built.edges)
    }
    if (createdNodes.length) {
      host.appendMany({ nodes: createdNodes, edges: newEdges })
    }
    return { ok: ids.length > 0, data: { ids }, ...(lastError && ids.length === 0 ? { error: lastError } : {}) }
  }
}

/** 删除节点（delete_node）—— 连带删除相连边 */
const deleteNodeTool = {
  name: 'delete_node',
  description: '删除指定节点及其所有相连连线。删除后 id 失效。',
  parameters: {
    type: 'object',
    properties: { nodeId: { type: 'string', description: '要删除的节点 id' } },
    required: ['nodeId']
  },
  execute(args, ctx) {
    const host = createCanvasHost(ctx)
    const id = str(args.nodeId)
    const exists = host.getNodes().some((n) => n.id === id)
    if (!exists) return { ok: false, error: `节点不存在：${id}` }
    // R3：级联删除该节点及其子孙（删 group 不留孤儿子节点）
    const deleted = host.deleteNodes(id)
    return { ok: true, data: { id, deletedCount: deleted.length } }
  }
}

/** 批量删除节点（batch_delete_nodes） */
const batchDeleteNodesTool = {
  name: 'batch_delete_nodes',
  description: '批量删除多个节点（连带其相连边）。',
  parameters: {
    type: 'object',
    properties: { nodeIds: { type: 'array', items: { type: 'string' }, description: '要删除的节点 id 数组' } },
    required: ['nodeIds']
  },
  execute(args, ctx) {
    const ids = Array.isArray(args.nodeIds) ? args.nodeIds.map(String) : []
    if (!ids.length) return { ok: false, error: 'nodeIds 数组为空' }
    const host = createCanvasHost(ctx)
    // R3：批量删除也级联删选中 group 的子孙节点
    const deleted = host.deleteNodes(ids)
    return { ok: true, data: { deleted, deletedCount: deleted.length } }
  }
}

/**
 * 改节点（update_node）—— 白名单字段不可变写回。
 * 对齐官方 update_node 的白名单：prompt/label/selectedModel/aspectRatio/resolution/seconds/text。
 * 只改目标节点 data，非目标节点原样返回（引用不变，不重渲染）。
 */
const updateNodeTool = {
  name: 'update_node',
  description: '更新节点可编辑字段（白名单）。可改：prompt(提示词)、label(标题)、selectedModel(模型)、aspectRatio(宽高比 16:9/9:16/1:1)、resolution(720p/1080p)、seconds(秒数)、text(文本)、locked(锁定)。只改传入字段。',
  parameters: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: '目标节点 id' },
      prompt: { type: 'string' },
      label: { type: 'string' },
      selectedModel: { type: 'string' },
      aspectRatio: { type: 'string', description: '如 16:9 / 9:16 / 1:1' },
      resolution: { type: 'string', description: '如 720p / 1080p' },
      seconds: { type: 'string', description: '视频秒数' },
      text: { type: 'string', description: '文本节点内容' },
      locked: { type: 'boolean', description: '锁定状态（true=锁定）' }
    },
    required: ['nodeId']
  },
  execute(args, ctx) {
    const host = createCanvasHost(ctx)
    const id = str(args.nodeId)
    const node = host.getNode(id)
    if (!node) return { ok: false, error: `节点不存在：${id}` }
    const patch = {}
    for (const k of UPDATE_NODE_WHITELIST) {
      if (args[k] !== undefined) patch[k] = args[k]
    }
    // 生图画质：LLM 传 resolution（720p/1080p/2K/4K）→ 映射到组件实际读取的 imageSize（1K/2K/4K）。
    // 否则写 data.resolution 组件不读，比例/画质改动对用户不可见。
    if (patch.resolution !== undefined) {
      const norm = normalizeResolution(patch.resolution)
      if (norm) patch.imageSize = norm
      delete patch.resolution
    }
    if (Object.keys(patch).length === 0) return { ok: true, data: { id, unchanged: true } }
    host.updateNodeData(id, patch)
    return { ok: true, data: { id, updated: Object.keys(patch) } }
  }
}

/**
 * 更新节点任意原始字段（update_node_any_field）—— 高级。
 * 对齐官方 update_node_raw（原型改名 update_node_any_field）：nodeId + patch 直接合并进 data。⚠️ 只改必要字段，避免覆盖其他数据。
 */
const updateNodeRawTool = {
  name: 'update_node_any_field',
  description: '直接改节点任意原始 data 字段（高级）。patch 整体合并进 node.data，仅改必要字段避免覆盖。',
  parameters: {
    type: 'object',
    properties: {
      nodeId: { type: 'string' },
      patch: { type: 'object', description: '要合并进 node.data 的字段' }
    },
    required: ['nodeId', 'patch']
  },
  execute(args, ctx) {
    const host = createCanvasHost(ctx)
    const id = str(args.nodeId)
    const node = host.getNode(id)
    if (!node) return { ok: false, error: `节点不存在：${id}` }
    const patch = args.patch && typeof args.patch === 'object' ? args.patch : null
    if (!patch || Object.keys(patch).length === 0) return { ok: false, error: 'patch 为空' }
    host.updateNodeData(id, patch)
    return { ok: true, data: { id, updated: Object.keys(patch) } }
  }
}

/**
 * P11：连线的纯构建函数（无副作用）。connect_nodes / batch_connect_nodes 共用。
 * @param currentEdges 当前边快照（批量时传「虚拟增长」数组，保证去重语义与逐条一致）
 * @returns { status: 'created', edge } | { status: 'already' } | { status: 'error', error }
 */
function buildConnect(conn, ctx, currentEdges) {
  const source = str(conn.source)
  const target = str(conn.target)
  if (!ctx.getNodes().some((n) => n.id === source)) return { status: 'error', error: `源节点不存在：${source}` }
  if (!ctx.getNodes().some((n) => n.id === target)) return { status: 'error', error: `目标节点不存在：${target}` }
  if (currentEdges.some((e) => e.source === source && e.target === target)) return { status: 'already' }
  return { status: 'created', edge: { id: generateId('e'), source, sourceHandle: null, target, type: 'default', animated: false } }
}

/** 连线（connect_nodes）—— source 输出流向 target */
const connectNodesTool = {
  name: 'connect_nodes',
  description: '连接两节点（source 输出流向 target）。',
  parameters: {
    type: 'object',
    properties: { source: { type: 'string', description: '数据源节点 id' }, target: { type: 'string', description: '数据目标节点 id' } },
    required: ['source', 'target']
  },
  execute(args, ctx) {
    const { getEdges, setEdges } = ctx
    const source = str(args.source)
    const target = str(args.target)
    const built = buildConnect(args, ctx, getEdges())
    if (built.status === 'error') return { ok: false, error: built.error }
    if (built.status === 'already') return { ok: true, data: { source, target, alreadyConnected: true } }
    setEdges((es) => [...es, built.edge])
    return { ok: true, data: { source, target } }
  }
}

/** 批量连线（batch_connect_nodes）—— 复用 buildConnect，累计新边单次 setEdges 写回 */
const batchConnectNodesTool = {
  name: 'batch_connect_nodes',
  description: '批量连接多个节点对，每个元素 { source, target }。',
  parameters: {
    type: 'object',
    properties: { connections: { type: 'array', items: { type: 'object' }, description: '连线数组 [{ source, target }]' } },
    required: ['connections']
  },
  execute(args, ctx) {
    const list = Array.isArray(args.connections) ? args.connections : []
    if (!list.length) return { ok: false, error: 'connections 为空' }
    const { setEdges } = ctx
    // P11：批量连——先累计新边，单次 setEdges 写回，避免 N 条连线触发 N 次全量 setEdges（ReactFlow 重渲染风暴）。
    let virtualEdges = ctx.getEdges()
    const newEdges = []
    let okCount = 0
    for (const c of list) {
      const built = buildConnect(c, ctx, virtualEdges)
      if (built.status === 'created') {
        virtualEdges = [...virtualEdges, built.edge]
        newEdges.push(built.edge)
        okCount++
      } else if (built.status === 'already') {
        okCount++ // 去重：已存在连线计成功（对齐原 connectNodesTool ok:true 语义）
      }
    }
    if (newEdges.length) setEdges((es) => [...es, ...newEdges])
    return { ok: true, data: { connected: okCount, total: list.length } }
  }
}

/** 删除连线（delete_edge） */
const deleteEdgeTool = {
  name: 'delete_edge',
  description: '删除指定连线。传 edgeId，或传 source+target 按两端点删。',
  parameters: {
    type: 'object',
    properties: {
      edgeId: { type: 'string', description: '连线 id（可选）' },
      source: { type: 'string', description: '源节点 id（可选，配合 target）' },
      target: { type: 'string', description: '目标节点 id（可选，配合 source）' }
    },
    required: []
  },
  execute(args, ctx) {
    const { getEdges, setEdges } = ctx
    if (args.edgeId) {
      if (!getEdges().some((e) => e.id === args.edgeId)) return { ok: false, error: `连线不存在：${args.edgeId}` }
      setEdges((es) => es.filter((e) => e.id !== args.edgeId))
      return { ok: true, data: { edgeId: args.edgeId } }
    }
    if (args.source && args.target) {
      const edge = getEdges().find((e) => e.source === args.source && e.target === args.target)
      if (!edge) return { ok: false, error: `未找到 ${args.source}→${args.target} 的连线` }
      setEdges((es) => es.filter((e) => e.id !== edge.id))
      return { ok: true, data: { edgeId: edge.id } }
    }
    return { ok: false, error: '需提供 edgeId 或 source+target' }
  }
}

/** 列出所有节点（list_nodes）—— 只读 */
const listNodesTool = {
  name: 'list_nodes',
  description: '列出全部节点（id/type/label/坐标）。改画布前先调它了解结构。',
  parameters: { type: 'object', properties: {}, required: [] },
  execute(args, ctx) {
    const nodes = ctx.getNodes().map((n) => ({
      id: n.id,
      type: n.type,
      label: n.data?.label || '',
      position: n.position || { x: 0, y: 0 }
    }))
    return { ok: true, data: { nodes } }
  }
}

/** 列出所有连线（list_edges）—— 只读 */
const listEdgesTool = {
  name: 'list_edges',
  description: '列出画布上所有连线，返回 source/target 关系。',
  parameters: { type: 'object', properties: {}, required: [] },
  execute(args, ctx) {
    const edges = ctx.getEdges().map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle || null }))
    return { ok: true, data: { edges } }
  }
}

/** 读单个节点详情（get_node_details）—— 只读 */
const getNodeDetailsTool = {
  name: 'get_node_details',
  description: '读取指定节点完整 data（提示词/模型/尺寸/结果 URL 等）。',
  parameters: { type: 'object', properties: { nodeId: { type: 'string' } }, required: ['nodeId'] },
  execute(args, ctx) {
    const id = str(args.nodeId)
    const node = ctx.getNodes().find((n) => n.id === id)
    if (!node) return { ok: false, error: `节点不存在：${id}` }
    return { ok: true, data: { id, type: node.type, data: node.data, position: node.position } }
  }
}

/** 读整个画布结构（read_canvas）—— list_nodes + list_edges 合并，供 Agent 一次看清 */
const readCanvasTool = {
  name: 'read_canvas',
  description: '一次读取画布全貌（所有节点+连线，含各节点提示词、文本内容与生成结果）。要了解全局时优先用它。',
  parameters: { type: 'object', properties: {}, required: [] },
  execute(args, ctx) {
    const nodes = ctx.getNodes().map((n) => ({
      id: n.id,
      type: n.type,
      label: n.data?.label || '',
      prompt: n.data?.prompt || '',
      text: n.data?.text || '',
      position: n.position || { x: 0, y: 0 },
      // 生成结果（打通 Agent 感知：读完画布即可看到哪个节点已出图/出视频/出音频，供多步编排）
      imageUrl: n.data?.imageUrl || undefined,
      videoUrl: n.data?.videoUrl || undefined,
      audioUrl: n.data?.audioUrl || undefined,
      resultUrl: n.data?.resultUrl || undefined,
    }))
    const edges = ctx.getEdges().map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle || null }))
    return { ok: true, data: { nodes, edges } }
  }
}

/**
 * 触发生成（generate_node）
 * 走统一生成契约：useNodeGeneration 已把各节点的 start 注册到 taskStore.retryRegistry，
 * 这里按 nodeId 调用 runNodeGeneration 即可驱动「真」生成（含进度 + 任务中心 + node.data 双写）。
 */
const triggerGenerationTool = {
  name: 'generate_node',
  description: '触发生成并等待完成，返回结果 URL（供后续做参考图/前序依赖）。调用前该节点须已有提示词。',
  parameters: { type: 'object', properties: { nodeId: { type: 'string', description: '要触发生成的节点 id' } }, required: ['nodeId'] },
  execute: async (args, ctx) => {
    const id = str(args.nodeId)
    const node = ctx.getNodes().find((n) => n.id === id)
    if (!node) {
      // 兜底自愈（2026-08-21）：LLM 可能自猜节点 id（如 promptNode_1）导致不存在。
      // 回填「当前可用节点 id」列表引导模型用真实 id，而非只报错让模型卡死/重复建节点。
      const all = ctx.getNodes()
      const candidates = (all.some((n) => n.type === 'promptNode') ? all.filter((n) => n.type === 'promptNode') : all).map((n) => n.id)
      const hint = candidates.length ? `。当前可用节点 id：${candidates.join('、')}` : ''
      return { ok: false, error: `节点不存在：${id}${hint}。请使用工具返回的真实 id（如 create_node 的 data.id），不要自行推测节点 id。` }
    }
    // 通过统一契约触发真实生成（节点须已用 useNodeGeneration 注册 start）。
    // 【异步执行器地基】runNodeGeneration 新版透传 start() 的 promise（{ ok, resultUrl }），
    // await 它可拿到已落盘的持久 resultUrl（供前序依赖/多图编排复用）。
    const res = await runNodeGeneration(id)
    if (!res) {
      // 失败也带 nodeId，供对话侧「重试此步骤」定位节点（对齐大雄 retryAgentGeneration）
      return { ok: false, error: `节点 ${id} 未注册生成契约（类型 ${node.type} 暂不支持由 Agent 驱动）`, nodeId: id }
    }
    if (res.ok === false) {
      return { ok: false, error: res.error || '生成失败', nodeId: id }
    }
    // res 可能是 { ok:true, resultUrl }（新版 start，await 到生成完成）或 true（旧回调）→ resultUrl 兜底空串
    const resultUrl = res.resultUrl || ''
    // 【收敛信号】对齐参考项目（daxiong canvas-agent）：给 AI 明确的「完成/进行中」状态，
    // 而不是一律写死"已提交等待完成"（那会误导 AI 以为没生成完 → 重复触发/重复建节点）。
    // - resultUrl 非空 → 生成已完成，明确告知"已生成"，不再需要任何重复操作。
    // - resultUrl 为空 → 已提交但仍在异步后台生成，明确告知"生成中、请勿重复触发"。
    if (resultUrl) {
      return {
        ok: true,
        data: { id, completed: true, resultUrl, note: '已在画布完成生成，结果已回填节点，无需重复操作' },
      }
    }
    return {
      ok: true,
      data: { id, completed: false, submitted: true, resultUrl: '', note: '已提交生成（异步后台进行中），请勿重复触发或重复建同类节点' },
    }
  }
}

/**
 * 多步编排（execute_plan）
 * 接收一个 generations 计划（多张图/多步骤，含前序依赖），批量建节点并执行。
 * 对齐大雄 canvas-agent：按 depends_on_previous 分独立批+依赖批，依赖批用前序结果当参考图。
 * 是 Skill（5主图+8详情 等大批量任务）的执行引擎。
 */
const presentPlanTool = {
  name: 'show_plan_for_confirm',
  description: '把生成策划展示出来（execute_plan 前调用，展示规划文字与步骤）。是否需用户确认由运行模式决定：半自动需确认后才可执行（execute_plan 会被拒到用户确认）；全自动直接执行（本工具返回 awaiting_confirm:false，你可直接继续 execute_plan）。可传 global_contract（统一风格契约三字段，逐字锁定每步）与 artifacts（跨步成果资产声明）。',
  parameters: {
    type: 'object',
    properties: {
      plan_text: { type: 'string', description: '策划说明（给用户看的规划摘要：目标、几步、每步用途）' },
      generations: {
        type: 'array',
        description: '【可选】步骤数组。每项 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }。此参数仅作冗余兜底：主通道是你在回复正文里输出 generations JSON（对齐大雄：generations 不强制随工具参数传输）。若正文已给出，此处可省略。',
        items: { type: 'object' }
      },
      global_contract: {
        type: 'object',
        description: '统一风格契约 { visual_positioning, unified_style_prompt, unified_negative_prompt }，阶段1产出、逐字锁定每步',
        properties: {
          visual_positioning: { type: 'string' },
          unified_style_prompt: { type: 'string' },
          unified_negative_prompt: { type: 'string' },
        }
      },
      artifacts: {
        type: 'array',
        description: '跨步成果资产声明 [{id,type,title,description}]，id 被后续步 input_artifact_ids 引用',
        items: { type: 'object' }
      }
    },
    // 对齐大雄：门禁只依赖 plan_text（几十字文本，永不因超大 JSON 传输失败）。
    // generations 不再是 required，避免把 11 个长 prompt 塞进 tool_calls.arguments 导致 SSE 解析失败。
    required: ['plan_text']
  },
  execute(args, ctx) {
    const gens = Array.isArray(args.generations) ? args.generations : []
    const planText = String(args.plan_text || '').trim()
    if (!planText) return { ok: false, error: 'plan_text 为空' }
    // 暂存统一风格契约 + 跨步成果资产（per-conversation，供 execute_plan 消费/续轮回灌，对齐大雄 global_contract/artifacts）
    const gc = args.global_contract && typeof args.global_contract === 'object' ? args.global_contract : null
    if (gc) setCurrentGlobalContract(gc)
    if (Array.isArray(args.artifacts) && args.artifacts.length) setCurrentArtifacts(args.artifacts)
    // 【Gap A 修复】generations 主通道是「回复正文 JSON」（见本工具 description 与 useAgentChat 正文解析），
    // 工具参数仅作冗余兜底。故仅当工具实参真带了非空 generations 才覆盖暂存；
    // 否则严禁用空数组覆盖正文通道已暂存的计划——否则正文里排好的计划会被空参 execute_plan 抹掉（所有步骤无源可查）。
    if (Array.isArray(args.generations) && args.generations.length > 0) {
      setPendingGenerations(gens)
    }
    // 【docs/65 M6】确认粒度由三态 workMode 单一真源决定（runModeRegistry）：是否进入"待确认"门禁
    //   - workMode==='step-confirm'：进入 awaiting（分步确认：规划后确认再执行，对齐大雄 6282/7774）。
    //   - workMode==='auto'（或 direct）：不进入 awaiting（完全自主/直接生图：规划后直接执行）。
    //   Skill 是独立轴、不改变确认粒度（docs/64 D7/R6）；「完全自主 + 有媒体 + 积分开关开」改由
    //   execute_plan 通用积分闸（credit）拦截，不在此设 awaitingConfirm（两条门禁互相独立）。
    const hasSkillNow = Array.isArray(getCurrentSnapshot()?.skills) && getCurrentSnapshot().skills.length > 0
    const needConfirm = getWorkMode() === 'step-confirm'
    setAwaitingConfirm(needConfirm)
    // memory 提炼（对齐大雄 conv.memory.lastPlan）：把阶段1策划记入当前对话，供多轮上下文
    const mem = getCurrentMemory()
    setCurrentMemory({ ...mem, lastPlan: { plan_text: planText, generations: gens, ts: Date.now() } })
    // 【plan debug】阶段1 策划展示诊断（受 agent 模块 debug 开关控制）：
    //   关注 gensCount 是否为 0（plan 没带步骤）、needConfirm 是否符合预期（Skill/semi 与否）。
    logger.debug('AI助手', '[plan] show_plan_for_confirm', {
      planTextLen: planText.length,
      gensCount: gens.length,
      gensIds: gens.map((g) => String(g?.id ?? g?.title ?? '').slice(0, 24)).filter(Boolean).slice(0, 40),
      gensViaParam: Array.isArray(args.generations) && args.generations.length > 0,
      hasSkill: hasSkillNow,
      runMode: getCurrentRunMode(),
      needConfirm,
      gcApplied: !!gc,
      artifactsCount: Array.isArray(args.artifacts) ? args.artifacts.length : 0,
    }, { module: 'agent' })
    return { ok: true, data: { presented: true, plan_text: planText, generations: gens, generations_count: gens.length, awaiting_confirm: needConfirm } }
  }
}

/**
 * 多步编排（execute_plan）
 * 接收一个 generations 计划（多张图/多步骤，含前序依赖），批量建节点并执行。
 * 对齐大雄 canvas-agent：按 depends_on_previous 分独立批+依赖批，依赖批用前序结果当参考图。
 * 是 Skill（5主图+8详情 等大批量任务）的执行引擎。
 *
 * ── 参考图解析的完整逻辑（对齐大雄执行层，含优先级）──
 * ① direct_refs（优先，仅独立步骤）：LLM 在 generation 带 direct_refs（引用历史图/上一轮生成图 url），
 *    本工具用 getCurrentImageMap() 把 url 反查成「图N」，把 prompt 里的「图N」翻译成「第X张参考图」，
 *    referenceImages 精确取该 url。对齐大雄 10638：`direct_refs && !isPrevDep`。
 * ② attachment_indices（use_attachments + 0-based 索引取 refPool）：本轮 user 带图 → send 写入
 *    getCurrentReferenceImages；本轮无图 → 回退 getLastUserReferenceImages()（对齐 agentLastUserAttachments）。
 *    对齐大雄 10649-10669：use_attachments 且按索引取本轮/回退的参考图。
 * ③ 无参考图：不挂任何图，use_attachments=false（对齐 agentForceNoStaleLastOutputs）。
 *    ⚠️ 跨轮生成结果图（agentLastResults / getLastGeneratedImages）绝不自动挂——对齐大雄 use_last_outputs=false
 *    「跨轮 lastResults 彻底关闭」，只有 direct_refs 明确引用历史图时才用。
 *
 * ── 大雄完整字段模型（daxiong-canvas-plugins/canvas-agent，权威对照）──
 * generations 每项（748/834 行 JSON 格式）：
 *   { id, title, type(three_view|main|detail|variant|edit|fusion|other), role(product_hero|main|detail|...),
 *     prompt, count, ratio, resolution, use_last_outputs, use_attachments, attachment_indices:[],
 *     depends_on_previous, dependency_mode(none|product_reference|fusion), notes, input_artifact_ids, output_artifact_id }
 * 参考图解析优先级（agentForceNoStaleLastOutputs 2958 + 无Skill 路径 10634）：
 *   独立步骤(非 depends_on_previous/use_previous_results/product_reference/fusion)：
 *     direct_refs 非空 → 用 direct_refs；否则 use_attachments → attachment_indices 取参考图；否则不挂。
 *   依赖前序步骤：depends_on_previous=true, use_previous_results=true，挂用户参考图(attachment_indices) + 前序结果。
 *   use_last_outputs 恒 false（跨轮 lastResults 彻底关闭，防"无参考图却挂历史图"）。
 * 跨轮回退（仅 Skill 路径 runAgentGenerations 8697）：
 *   attachRefs = 本轮图 ? 本轮图 : agentLastUserAttachments()（上一轮用户带的图）。
 * 无 Skill 路径（agentCollectRunAttachments 10465）：只认本轮用户明确提供的参考图，禁止历史附件自动挂。
 *
 * ── 我们对齐前的问题（"反推图一却全反推" 反复改不对的根因之一）──
 *   1. direct_refs 与 attachment_indices 优先级搞反（大雄 direct_refs 优先、仅独立步骤）。
 *   2. attachment_indices 未严格按 use_attachments 语义（大雄：无附件时清空 attachment_indices）。
 *   3. 曾考虑自动挂历史生成图——违反大雄 use_last_outputs=false 原则。
 *   对齐后：严格按上述 ①②③ 解析，优先级与清空规则与大雄一致。
 */
const executePlanTool = {
  name: 'execute_plan',
  description: '按计划批量建节点并生成（多图/多步骤）。输入 generations（每步含 prompt/比例/分辨率/是否依赖前序），按依赖分批执行，返回每步结果 URL。引用参考图有两种方式：①本轮用户参考图用 attachment_indices（0-based，参考图1→0）；②引用历史图/上一轮生成图用 direct_refs（把 system 里「当前可引用的图」中对应图的 url 填进该步 direct_refs 数组，prompt 里写「图N」，执行层自动反查）。适合大批量任务。',
  parameters: {
    type: 'object',
    properties: {
      generations: {
        type: 'array',
        description: '【可选】步骤数组。每项 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode, use_attachments, attachment_indices, direct_refs }。attachment_indices 是 0-based 数组，指向本轮用户参考图的编号（参考图1→0，参考图2→1），仅当该步要基于某参考图图生图时填。direct_refs 是数组，项 { url, name? }，引用 system 里「当前可引用的图」（图N，含上一轮生成图），prompt 里用「图N」指代。此参数仅作兜底：若阶段1 已把 generations 暂存（回复正文/ show_plan_for_confirm），这里可省略，系统自动从暂存读取。',
        items: { type: 'object' }
      },
      auto_run: { type: 'boolean', description: '是否自动触发生成（默认 true）。false 时只建节点不跑，供用户确认' },
      model: { type: 'string', description: '生图默认模型（可选）' },
      referenceImages: { type: 'array', items: { type: 'string' }, description: '参考图 url 数组（可选；整批共享，写进所有生图节点作参考。若用 attachment_indices 则按步精确指定，优先于它）' },
      global_contract: { type: 'object', description: '统一风格契约 {visual_positioning, unified_style_prompt, unified_negative_prompt}，逐字锁定每步 prompt 头部' },
      artifacts: { type: 'array', items: { type: 'object' }, description: '跨步成果资产 [{id,type,title,description,nodeId?,url?}]，供依赖步 input_artifact_ids 注入参考图' }
    },
    // 对齐大雄：generations 主通道是阶段1 暂存（回复正文解析），execute_plan 不再 required。
    // 仅当暂存为空时才要求 LLM 在参数里补传（兜底）。
    required: []
  },
  execute: async (args, ctx) => {
    try {
      // 【Step F 确认态硬约束】show_plan_for_confirm 后 awaitingConfirm=true，未确认前拒绝 execute_plan
      // （无论是否带 generations），防止 LLM 在用户未确认时直接出图。仅前端确认按钮翻转。
      if (getAwaitingConfirm()) {
        return { ok: false, error: '策划尚未确认，请先确认后再执行。' }
      }
      // 【D缺口·统一计划校验/兜底】generations 全源统一在此收敛判定，确保放行前「至少一个来源有货」：
      //   主来源①「阶段1 暂存 pendingGenerations」（回复正文解析 / show_plan_for_confirm 传入，内存优先，避免阶段3
      //   再让 LLM 扛超大 JSON）；兜底来源②execute_plan 本次参数 args.generations。
      //   二者皆空 → 明确错误透传并给出引导（error 级日志，不静默，透传真实原因），杜绝「有意图却无计划的可执行源」被静默吞掉。
      const pending = getPendingGenerations()
      const argsGens = Array.isArray(args.generations) ? args.generations : []
      const pendingUsed = Array.isArray(pending) && pending.length > 0
      const hasPlanSource = pendingUsed || argsGens.length > 0
      if (!hasPlanSource) {
        logger.error('AI助手', '[plan] execute_plan 拒绝：无有效计划来源', {
          pendingExists: Array.isArray(pending) && pending.length > 0,
          argsGenCount: argsGens.length,
        }, { module: 'agent' })
        return {
          ok: false,
          error: '未找到生成计划。请确保本次生图已有计划来源：\n1. AI 在回复正文用 ```json 输出 generations 数组，或\n2. 调用 show_plan_for_confirm / 在 execute_plan 的 generations 参数中提供每步计划。\n（若走 Skill 流程，需先完成阶段1 策划确认。）',
        }
      }
      let gens = pendingUsed ? pending : argsGens
      clearPendingGenerations()
      // 【D3/D4 积分闸判定 · 2026-08-27 简化（架构决策）】credit = creditSwitch（全局总闸，与模式正交）。
      // 删掉旧版 runMode!=='semi' 特殊分支：它把「分步确认残留的 semi」与「直接生图」混为一谈，
      // 导致切过「分步确认」后回「直接生图」时积分闸被永久短路（bug，见 tests/unit/creditGateModes.test.js）。
      // 心智模型：积分开关就是通用总闸，开了就拦、关了就放，对「直接生图/分步确认/完全自主」一视同仁（PRD §3.2）。
      // 命中 → 强制 autoRun=false：只建节点（免费，status='ready'），真正的「点生成烧积分那下」留待
      // 用户点确认 → runExistingPlanTool 补跑。绝不放行 LLM 的 auto_run:true 直接真生成（红线 §6.4）。
      // 注：分步确认（step-confirm）在开关开时也会再经一次积分确认（不算 D2 的「不叠」）——这是「通用闸一视同仁」的直接结果。
      const creditHit = getCreditSwitch()
      const autoRun = creditHit ? false : (args.auto_run !== false)
      // 【模型锁定】用面板生图参数区（getGenParams）作为默认；LLM 显式传 model 则优先。
      const panel = getGenParams()
      const model = str(args.model) || panel.model
      // workflow 贯穿（对齐大雄）：执行开始 → running；执行结束 → completed/failed。状态写入当前对话 workflow。
      patchCurrentWorkflow({ status: 'running', updatedAt: Date.now() })
      // 【参考图解析】本轮用户参考图池（useAgentChat.send 时写入）+ 跨轮回退。
      // 【对齐大雄 agentLastUserAttachments】本轮无图时回退到「当前对话最近一条带图 user 消息」的图，
      //   让"改上一张图"在本轮无图时也能执行（跨轮图记忆靠执行层反查，不进 LLM 上下文）。
      let refPool = getCurrentReferenceImages()
      if (!Array.isArray(refPool) || refPool.length === 0) refPool = getLastUserReferenceImages()
      const globalRefs = Array.isArray(args.referenceImages) ? args.referenceImages.filter(Boolean) : []
      // 【对齐大雄 direct_refs + agentCurrentImageMap + agentForceNoStaleLastOutputs】参考图解析优先级：
      //   ① 独立步骤（非依赖前序）且带 direct_refs → 直接用 direct_refs（引用历史图/上一轮生成图 url），
      //      用 agentCurrentImageMap 统一编号把 prompt 里的「图N」翻译成「第X张参考图」；
      //   ② 否则走 attachment_indices 挂本轮/回退的参考图（refPool）。
      //   ③ 跨轮生成结果图（agentLastResults）绝不自动挂——对齐大雄 use_last_outputs=false「跨轮 lastResults 彻底关闭」，
      //      只有 direct_refs 明确引用历史图时才用（大雄无 Skill 路径如此）。
      const imgMap = getCurrentImageMap()
      const resolvedGens = (gens || []).map((g) => {
        const isPrevDep = !!(g?.depends_on_previous || g?.use_previous_results || g?.dependency_mode === 'product_reference' || g?.dependency_mode === 'fusion')
        // ① 独立步骤 + direct_refs → 优先用 direct_refs（对齐大雄 10638：`direct_refs && !isPrevDep`）
        if (!isPrevDep && Array.isArray(g?.direct_refs) && g.direct_refs.length > 0) {
          const refs = g.direct_refs.filter((r) => r && r.url)
          if (refs.length > 0) {
            let prompt = String(g.prompt || '')
            prompt = prompt.replace(/图\s*([一二三四五六七八九十])/g, (m, cn) => `图${CN_TO_ARABIC[cn] || cn}`)
            const roleDescs = []
            refs.forEach((ref, i) => {
              const entry = imgMap.find((m) => m.url === ref.url)
              if (entry) {
                const re = getFigNumRegex(entry.num)
                prompt = prompt.replace(re, `第${i + 1}张参考图`)
              }
              roleDescs.push(`第${i + 1}张`)
            })
            if (roleDescs.length > 1) prompt = `[参考图顺序：${roleDescs.join('、')}，与下方参考图数组一一对应]\n${prompt}`
            return { ...g, prompt, referenceImages: refs.map((r) => r.url).filter(Boolean) }
          }
        }
        // ② attachment_indices → 挂本轮/回退的参考图（对齐大雄 10649-10669：use_attachments 且按索引取 refPool）
        const idxs = Array.isArray(g?.attachment_indices) ? g.attachment_indices.map((i) => Number(i)).filter((i) => Number.isFinite(i) && i >= 0) : []
        const useAttach = (refPool.length > 0) && (g?.use_attachments === true || idxs.length > 0)
        if (useAttach) {
          return { ...g, referenceImages: (idxs.length ? idxs : Array.from({ length: refPool.length }, (_, i) => i))
            .filter((i) => i >= 0 && i < refPool.length).map((i) => refPool[i]).filter(Boolean) }
        }
        // ③ 无参考图：不挂任何图（对齐大雄 agentForceNoStaleLastOutputs：无附件时 use_attachments=false、清空 attachment_indices）
        return { ...g, use_attachments: false, referenceImages: undefined }
      })
      // 【统一风格契约 global_contract】（对齐大雄）：取阶段1/本次的契约，把三字段逐字锁到每个 generation 的 prompt 头部，
      // 保证电商套图（13张同品牌）每步都带统一风格/负面提示词。
      const gc = args.global_contract && typeof args.global_contract === 'object' ? args.global_contract : (getCurrentGlobalContract() || {})
      const gcText = [gc.visual_positioning, gc.unified_style_prompt, gc.unified_negative_prompt]
        .filter(Boolean)
        .map((t, i) => ['视觉整体定位：', '统一风格提示词：', '统一负面提示词：'][i] + t)
        .join('\n')
      const lockedGens = gcText
        ? resolvedGens.map((g) => ({ ...g, prompt: `[统一风格锁定]\n${gcText}\n\n${g.prompt || ''}` }))
        : resolvedGens
      const artifactTable = Array.isArray(args.artifacts) && args.artifacts.length ? args.artifacts : (getCurrentArtifacts() || [])
      // 【TASK-012】套图/融合兜底需要用户原文（seriesHint/fusionIntent）。优先 LLM 带 user_text，否则用阶段1策划 plan_text 兜底。
      const userText = String(args.user_text || getCurrentMemory()?.lastPlan?.plan_text || '').trim()
      // 【TASK-009 进度日志】executor 逐步 onLog → 收集进 logs，随结果返回，供 useAgentChat 渲染折叠「执行摘要」（对齐大雄 workflowLogs）
      const logs = []
      // 【plan debug】阶段3 执行诊断（受 agent 模块 debug 开关控制）：
      //   · gensSource        步骤来自「阶段1暂存」还是「本次参数」；
      //   · refTypePerStep    每步参考图来源：direct_refs / attachment_indices / none（定位"图没挂上/挂错图"）；
      //   · refMetrics         每步实际挂的参考图数量与首图 url 头（诊断引用错位）。
      logger.debug('AI助手', '[plan] execute_plan 入参', {
        gensSource: pendingUsed ? 'pending(阶段1暂存)' : 'args(本次参数)',
        gensCount: gens.length,
        stepIds: gens.map((g) => String(g?.id ?? g?.title ?? '').slice(0, 24)).filter(Boolean).slice(0, 40),
        autoRun, model,
        awaited: getAwaitingConfirm(),
        refPoolLen: refPool.length, globalRefsLen: globalRefs.length,
        gcApplied: !!gcText, artifactsCount: artifactTable.length,
        refTypePerStep: resolvedGens.map((g) => g?.direct_refs?.length && !g?.depends_on_previous ? 'direct_refs' : (Array.isArray(g.referenceImages) && g.referenceImages.length ? 'attachment_indices' : 'none')),
        refMetrics: resolvedGens.map((g) => ({
          id: String(g?.id ?? g?.title ?? '').slice(0, 16),
          n: Array.isArray(g.referenceImages) ? g.referenceImages.length : 0,
          head: Array.isArray(g.referenceImages) && g.referenceImages[0] ? String(g.referenceImages[0]).slice(0, 48) : '',
        })).slice(0, 40),
      }, { module: 'agent' })
      const result = await executePlan({ ctx, generations: lockedGens, autoRun, model, defaults: panel, referenceImages: globalRefs, globalContract: gc, artifacts: artifactTable, onLog: (it) => { try { logs.push(it) } catch { /* 忽略 */ } }, userText })
      if (!result || !result.entries) {
        logger.debug('AI助手', '[plan] execute_plan 失败：无 entries', { result }, { module: 'agent' })
        patchCurrentWorkflow({ status: 'failed', updatedAt: Date.now() })
        return { ok: false, error: '计划执行失败' }
      }
      // 【D4/D1b 积分闸命中后处理】creditHit → 节点已建好（ready）、真生成未触发。
      // 提取 steps↔nodeId 映射 → 置 per-conv creditGate（pending:true + gens + map，随 conv 持久化可恢复），
      // 广播 credit-gate 事件（AgentPanel 刷新「确认生成」卡片）。返回 awaited:'credit'，不声称「已生成」（红线 §6.4）。
      if (creditHit) {
        patchCurrentWorkflow({ status: 'ready', updatedAt: Date.now() })
        if (result.entries.length === 0) {
          logger.error('AI助手', '[plan] execute_plan 命中积分闸但未建出节点', {}, { module: 'agent' })
          return { ok: false, error: '计划未能建出节点，未进入积分确认' }
        }
        const map = {}
        result.entries.forEach((e) => { if (e.nodeId) map[String(e.stepId ?? e.id)] = e.nodeId })
        setCreditGate({ pending: true, gens: lockedGens, map })
        publish(CREDIT_GATE_EVENT, { pending: true })
        logger.info('AI助手', '[plan] execute_plan 命中积分闸（节点已建好待确认）', { entriesCount: result.entries.length, awaited: 'credit' })
        return { ok: true, data: { awaited: 'credit', steps: result.entries, note: '节点已建好，生成待积分确认，确认后自动生成' } }
      }
      const anyFailed = result.entries.some((e) => e.status === 'failed')
      // 【plan debug】执行结果摘要：每步状态 + 失败详情 + 产出日志数。
      logger.debug('AI助手', '[plan] execute_plan 完成', {
        entriesCount: result.entries.length,
        anyFailed,
        status: result.workflow?.status,
        stepStatuses: result.entries.map((e) => ({ id: String(e?.id ?? e?.stepId ?? '').slice(0, 16), status: e?.status, hasUrl: !!e?.resultUrl })).slice(0, 40),
        logCount: logs.length,
      }, { module: 'agent' })
      patchCurrentWorkflow({ status: anyFailed ? 'completed_with_errors' : 'completed', updatedAt: Date.now() })
      // memory 提炼：把执行计划记入当前对话（对齐大雄 conv.memory.lastPlan）
      const mem = getCurrentMemory()
      setCurrentMemory({ ...mem, lastPlan: { plan_text: args.plan_text || mem?.lastPlan?.plan_text || '', generations: gens, ts: Date.now() } })
      return { ok: true, data: { workflow: result.workflow, entries: result.entries, logs } }
    } catch (e) {
      patchCurrentWorkflow({ status: 'failed', updatedAt: Date.now() })
      logger.error('AI助手', '[plan] execute_plan 异常', { message: e?.message || String(e) })
      return { ok: false, error: `计划执行异常：${e?.message || e}` }
    }
  }
}

/**
 * runExistingPlanTool —— 补跑唯一入口（D8）。
 * 用户点「确认生成」后，对 execute_plan 已建好、处于 ready 的节点真正触发生成（真正烧积分）。
 * 前提：per-conv creditGate?.pending===true 且 map 存在（幂等防线：缺失拒绝、连点只生效一次）。
 * 允许复跑，但补跑失败保留待确认态可重试；成功才清 creditGate（红线 §6.7 置位/清除成对）。
 * 禁止任何路径手写 setNodes/逐节点触发——一律汇入这里（红线 §6.8/6.9 补跑=点生成）。
 * @param {object} ctx  useReactFlow() 能力（与首次 execute_plan 同源）
 */
export async function runExistingPlanTool(ctx) {
  const gate = getCreditGate()
  if (!gate || gate.pending !== true || !gate.map || typeof gate.map !== 'object') {
    return { ok: false, error: '无待点生成的计划（积分确认未置位或已清空），已拒绝补跑' }
  }
  const result = await executePlan({
    ctx,
    generations: Array.isArray(gate.gens) ? gate.gens : [],
    autoRun: true,
    mode: 'runExisting',
    nodeMappings: gate.map,
    defaults: getGenParams(),
  })
  // executePlan 内部走全局单飞锁 + 超时兜底；失败保留待重试、原样透传（不吞、不静默清态）
  if (!result || !result.entries) {
    return { ok: false, error: result?.workflow?.error || '补跑失败', workflow: result?.workflow }
  }
  const anyFailed = result.entries.some((e) => e.status === 'failed')
  const anyDone = result.entries.some((e) => e.status === 'completed')
  if (!anyFailed) {
    clearCreditGate()
    publish(CREDIT_GATE_EVENT, { pending: false })
  }
  const status = anyFailed && anyDone ? 'completed_with_errors' : anyFailed ? 'failed' : 'completed'
  return { ok: true, data: { workflow: { ...(result.workflow || {}), status }, entries: result.entries } }
}

/**
 * run_existing_plan 工具（D8 补跑唯一入口的 callTool 封装）。
 * 供 AgentPanel「确认生成」按钮与 runDirectBranch(直连)/executePlanDirect 确认回调共用；
 * 触发逻辑全部走 runExistingPlanTool(ctx)，禁止任何路径手写 setNodes/逐节点触发。
 * 非 LLM 常规编排工具（creditGate.pending 才放行），注册进 callTool 分发即可。
 */
const runExistingPlanToolDef = {
  name: 'run_existing_plan',
  description: '对已建好、待点生成的节点补跑触发生成（需先有积分确认待确认态）。仅供确认「确认生成」时调用。',
  parameters: { type: 'object', properties: {}, required: [] },
  execute: (args, ctx) => runExistingPlanTool(ctx),
}

/** 视图适配（fit_view）—— zoom 到能看到所有节点 */
const fitViewTool = {
  name: 'fit_view',
  description: '缩放视口以显示全部节点。',
  parameters: { type: 'object', properties: { padding: { type: 'number', description: '留白比例，默认 0.2' } }, required: [] },
  execute(args, ctx) {
    const padding = num(args.padding, 0.2)
    ctx.fitView?.({ padding, duration: 300 })
    return { ok: true, data: { fit: true } }
  }
}

/** 放大视口（zoom_in）—— 补齐幽灵工具，避免后端准则调用它时报"未知工具" */
const zoomInTool = {
  name: 'zoom_in',
  description: '放大画布视口（zoom in）。',
  parameters: { type: 'object', properties: { factor: { type: 'number', description: '放大倍数（可选，默认 1.2）' } }, required: [] },
  execute(args, ctx) {
    const factor = num(args.factor, 1.2)
    ctx.zoomIn?.({ duration: 200, factor: factor <= 0 ? 1.2 : factor })
    return { ok: true, data: { zoomed: 'in', factor } }
  }
}

/** 缩小视口（zoom_out） */
const zoomOutTool = {
  name: 'zoom_out',
  description: '缩小画布视口（zoom out）。',
  parameters: { type: 'object', properties: { factor: { type: 'number', description: '缩小倍数（可选，默认 1.2）' } }, required: [] },
  execute(args, ctx) {
    const factor = num(args.factor, 1.2)
    ctx.zoomOut?.({ duration: 200, factor: factor <= 0 ? 1.2 : factor })
    return { ok: true, data: { zoomed: 'out', factor } }
  }
}

/** 定位/聚焦某节点（focus_node）—— 居中视口到指定节点 */
const focusNodeTool = {
  name: 'focus_node',
  description: '视口居中到指定节点并放大，聚焦查看。',
  parameters: { type: 'object', properties: { nodeId: { type: 'string', description: '要聚焦的节点 id' }, zoom: { type: 'number', description: '聚焦后的缩放级别（可选，默认 1.0）' } }, required: ['nodeId'] },
  execute(args, ctx) {
    const id = str(args.nodeId)
    const node = ctx.getNodes().find((n) => n.id === id)
    if (!node) return { ok: false, error: `节点不存在：${id}` }
    const pos = node.position || { x: 0, y: 0 }
    const w = (node.measured?.width ?? 0) / 2
    const h = (node.measured?.height ?? 0) / 2
    const zoom = num(args.zoom, 1.0)
    ctx.setCenter?.(pos.x + w, pos.y + h, { zoom: zoom <= 0 ? 1.0 : zoom, duration: 300 })
    return { ok: true, data: { id, centered: { x: pos.x, y: pos.y }, zoom } }
  }
}

/**
 * 锁定/解锁节点（lock_node）。
 * - 支持按 nodeId 锁单个，或按 type 锁该类型所有节点（如「把所有生图节点锁定」）。
 * - 同时写 data.locked + node.draggable/selectable=false，让 NodeShell 真正消费锁定效果
 *   （渲染锁图标 + 禁拖动/编辑），避免"locked 只是死字段、节点还能拖"的假能力。
 */
const lockNodeTool = {
  name: 'lock_node',
  description: '锁定/解锁节点：传 nodeId 锁单个，或传 type 锁该类型全部。锁定后不可拖动/编辑。',
  parameters: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: '要锁定的节点 id（可选；与 type 二选一）' },
      type: { type: 'string', description: '按节点类型批量锁定，如 promptNode（生图）/imageNode（图片）/textNode（文本）（可选）' },
      locked: { type: 'boolean', description: 'true=锁定，false=解锁，默认 true' }
    },
    required: []
  },
  execute(args, ctx) {
    const host = createCanvasHost(ctx)
    const locked = args.locked !== false
    let targets = []
    if (str(args.nodeId)) {
      const n = host.getNode(args.nodeId)
      if (!n) return { ok: false, error: `节点不存在：${args.nodeId}` }
      targets = [n]
    } else if (str(args.type)) {
      targets = host.getNodes().filter((n) => n.type === args.type)
      if (targets.length === 0) return { ok: false, error: `没有 ${args.type} 类型的节点` }
    } else {
      return { ok: false, error: '需提供 nodeId 或 type' }
    }
    const ids = targets.map((n) => n.id)
    host.lockNodes(ids, locked)
    return { ok: true, data: { locked, ids } }
  }
}

/**
 * 撤回 AI 刚才那步操作（undo_ai）。
 * 与用户 Ctrl+Z 完全隔离：从 aiUndoStack 弹出最近一次 AI 写操作前的快照并恢复。
 * 支持分组事务：execute_plan 一次编排（建多节点+连线+触发）push 一次，undo_ai 整体撤回。
 * 见文件头部 MUTATING_TOOLS / aiUndoStack 的抉择说明。
 */
const undoAiTool = {
  name: 'undo_ai',
  description: '撤回 AI 上一步画布操作（仅 AI 自己改的，与用户 Ctrl+Z 隔离）。',
  parameters: { type: 'object', properties: {}, required: [] },
  execute(args, ctx) {
    const snap = popActiveAiUndo() // 当前对话的 AI 撤销栈（Step D，多对话不串）
    if (!snap) return { ok: false, error: '没有可撤回的 AI 操作' }
    // 整体恢复快照（undo_ai 是整数组替换，走 host.restoreNodesAndEdges，收口裸 ctx.setNodes/setEdges，见 M1 C1-1）
    createCanvasHost(ctx).restoreNodesAndEdges(snap)
    return { ok: true, data: { reverted: snap.action || '上一步操作', remaining: getActiveAiUndoStack().length } }
  }
}

/** 移动节点（move_node） */
const moveNodeTool = {
  name: 'move_node',
  description: '把指定节点移动到新坐标 (x, y)。',
  parameters: {
    type: 'object',
    properties: { nodeId: { type: 'string' }, position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] } },
    required: ['nodeId', 'position']
  },
  execute(args, ctx) {
    const host = createCanvasHost(ctx)
    const id = str(args.nodeId)
    if (!host.getNodes().some((n) => n.id === id)) return { ok: false, error: `节点不存在：${id}` }
    const pos = { x: num(args.position?.x, 0), y: num(args.position?.y, 0) }
    // 【R3】AI 移动 group 子节点时：React Flow 里子节点 position 是相对父组的坐标，但 move_node
    // 传的是绝对坐标。若目标在组内，需换算成相对父组坐标，否则视觉错位（对齐用户侧 handleNodeDragStop）。
    const target = host.getNode(id)
    let finalPos = pos
    if (target?.parentId) {
      let px = 0, py = 0, pid = target.parentId, guard = 0
      const all = host.getNodes()
      while (pid && guard++ < 20) {
        const p = all.find((n) => n.id === pid)
        if (!p) break
        px += p.position.x; py += p.position.y
        pid = p.parentId
      }
      finalPos = { x: pos.x - px, y: pos.y - py }
    }
    host.updateNodePosition(id, finalPos)
    return { ok: true, data: { id, position: finalPos } }
  }
}

/** 编组（group_nodes）—— 把多个节点放进一个编组（真实现：与右键「编组」共用 createGroupFromNodes） */
const groupNodesTool = {
  name: 'group_nodes',
  description: '把多个节点编成一组（至少 2 个，均非 group 且未在其它组内）。',
  parameters: { type: 'object', properties: { nodeIds: { type: 'array', items: { type: 'string' } } }, required: ['nodeIds'] },
  execute(args, ctx) {
    const ids = Array.isArray(args.nodeIds) ? args.nodeIds.map(String) : []
    if (ids.length < 2) return { ok: false, error: 'nodeIds 至少 2 个' }
    const host = createCanvasHost(ctx)
    const res = createGroupFromNodes(host.getNodes(), ids)
    if (!res.ok) return { ok: false, error: res.error || '编组失败' }
    host.replaceNodes(res.nodes) // 整体替换节点数组（收口裸 ctx.setNodes，见 M1 C1-1）
    return { ok: true, data: { groupId: res.groupId, grouped: ids } }
  }
}

/**
 * 提议保存项目记忆（memory_suggest）—— 照搬参考项目 memoryTools.ts 的 memory_suggest。
 *
 * 只在用户表达稳定偏好/确定事实/明确约束/做出决定时调用；内容必须精简成一句话。
 * 执行动作：【暂存建议 + 进入 awaiting 门禁】，不直接落库——真正写入在看板确认链（AgentMessage 确认按钮）。
 * execute 仅做校验/脱敏/暂存，返回 awaiting_confirm 供 runToolCalls 渲染确认卡片；
 * 用户确认后由 UI 侧调用 saveProjectMemory 落库（见 useAgentChat / AgentPanel 确认流）。
 *
 * 与 show_plan_for_confirm 的关系：两者都复用"确认门禁"（awaitingConfirm），
 * 但 memory_suggest 确认动作是"写长期记忆"，而非"执行策划"。
 */
const memorySuggestTool = {
  name: 'memory_suggest',
  description: '提议保存一条项目长期记忆（仅在用户表达稳定偏好、确定事实、明确约束或做出决定时调用；内容精简成一句话）。禁止把文件全文/网页正文/密钥/绝对路径或临时结果作为记忆内容。调用后本工具进入"待确认"门禁，用户确认后才真正保存。',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['preference', 'fact', 'constraint', 'decision'], description: '记忆类别：preference偏好/fact事实/constraint约束/decision决定' },
      content: { type: 'string', minLength: 1, maxLength: 500, description: '一句话长期记忆内容（写前会脱敏密钥/凭据/本地路径并截断）' },
    },
    required: ['kind', 'content']
  },
  execute(args) {
    const kind = String(args.kind || '')
    const rawContent = String(args.content || '').trim()
    // 【脱敏】写入前统一脱敏（复用 projectMemoryStore.sanitizeMemoryContent，纯函数）
    const content = sanitizeMemoryContent(rawContent)
    if (!PROJECT_MEMORY_KINDS.includes(kind)) return { ok: false, error: `kind 非法：${kind}。应为 ${PROJECT_MEMORY_KINDS.join('/')}` }
    if (!content) return { ok: false, error: 'content 为空' }
    // 暂存建议（待确认），并进入 awaiting 门禁（复用 show_plan_for_confirm 的确认交互）
    setActivePendingMemorySuggest({ kind, content })
    setAwaitingConfirm(true)
    return { ok: true, data: { awaiting_confirm: true, kind, content, suggested: true } }
  }
}

/**
 * 工具清单（统一注册表）。新增画布工具在此加一行：
 *  - 定义工具对象（name/description/parameters/execute）放在上面；
 *  - 在此数组登记。
 * Agent / 测试 / 脚本统一从这里取（getAgentTools）。
 */
// 工具顺序 = 暴露给模型的重要性优先级（模型倾向先选靠前的工具）。
// 【排序原则】常用工具放前面（频率优先），低频工具放后面。
// 当前分组：①读（操作前先了解画布，几乎每次任务都用）②节点增删（建节点最高频）
// ③节点改 ④连线 ⑤生成/编排 ⑥视图/聚焦（低频）⑦保护/撤销/组织（最低频）。
// 新增工具时按使用频率插入对应分组，别一股脑塞末尾——放前面 AI 才更可能选到。
/**
 * 工具轴注册表初始化（docs/25 · 阶段2）：模块加载时按优先级顺序注册全部工具。
 * 顺序即模型选择优先级（常用在前、低频在后）——重构不得打乱分组顺序。
 * AGENT_TOOLS 兼容别名 = getTools()（注册表 live 数组），下方
 * buildCanvasAgentTools / buildCanvasAgentToolSchemas / CANVAS_AGENT_TOOL_NAMES / callTool 可用列表
 * 全部继续读 AGENT_TOOLS 即可，加新工具只在下方 defs 里 registerTool 一条。
 */
const AGENT_TOOLS = (() => {
  const defs = [
    // ① 读（操作前先了解画布）
    readCanvasTool,
    listNodesTool,
    listEdgesTool,
    getNodeDetailsTool,
    // ② 节点增删
    createNodeTool,
    batchCreateNodesTool,
    deleteNodeTool,
    batchDeleteNodesTool,
    // ③ 节点改
    updateNodeTool,
    updateNodeRawTool,
    // ④ 连线
    connectNodesTool,
    batchConnectNodesTool,
    deleteEdgeTool,
    // ⑤ 生成/编排
    triggerGenerationTool,
    executePlanTool,
    presentPlanTool,
    runExistingPlanToolDef,
    // ⑥ 视图/聚焦
    focusNodeTool,
    fitViewTool,
    zoomInTool,
    zoomOutTool,
    // ⑦ 保护/撤销/组织
    lockNodeTool,
    undoAiTool,
    moveNodeTool,
    groupNodesTool,
    // ⑧ 「记」长期记忆（memory_suggest：待确认门禁，低频）
    memorySuggestTool
  ]
  for (const def of defs) {
    // mutating 从 MUTATING_TOOLS 派生入注册条目（唯一真源）；write 工具统一压 AI 撤销栈
    registerTool({ ...def, mutating: MUTATING_TOOLS.has(def.name) })
  }
  return getTools()
})()

/**
 * 构建工具 Map（纯函数，脱离 React 可测）。
 * @param ctx useReactFlow() 能力（或测试用 mock）：getNodes/setNodes/getEdges/setEdges/addNodes/screenToFlowPosition/fitView...
 * @returns { [name]: (args) => { ok, data|error } }
 * 每个工具执行带 try/catch，异常包成 { ok:false, error }，绝不让异常冒泡到 Agent 层。
 */
export function buildCanvasAgentTools(ctx) {
  const map = {}
  for (const t of AGENT_TOOLS) {
    const execute = t.execute
    // 【docs/25 阶段2】mutating 由注册条目的 toolDef.mutating 派生（注册时从 MUTATING_TOOLS 派生），
    //   取代旧的 MUTATING_TOOLS.has(t.name) 运行时判断，保证「写画布工具压撤销栈」与注册表单一真源一致。
    const isMutating = !!t.mutating
    map[t.name] = (args) => {
      // 对"会改画布的写工具"统一捕获改前快照，push 进当前对话的 AI 撤销栈（集中一处，不散落到各工具）
      if (isMutating) {
        pushActiveAiUndo({ nodes: ctx.getNodes(), edges: ctx.getEdges(), action: t.name })
      }
      try {
        return execute(args, ctx)
      } catch (e) {
        return { ok: false, error: `${t.name} 执行异常：${e?.message || e}` }
      }
    }
  }
  return map
}

/** OpenAI function calling schema 数组（直接喂 LLM，让模型学会调这些工具） */
export function buildCanvasAgentToolSchemas() {
  return AGENT_TOOLS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters }
  }))
}

/**
 * 主 hook：拿到统一工具层（React 侧封装 buildCanvasAgentTools，ctx 即 useReactFlow()）。
 * @returns
 *  - tools:            工具实现 Map：{ [name]: (args) => {ok,data|error} }
 *  - toolSchemas:      OpenAI function calling 格式的工具 schema 数组（直接喂 LLM）
 *  - callTool(name,args): 按名字调用单个工具，未知工具返回 { ok:false, error }
 *  - execute(args):    支持批量执行 [{name,args},...]，逐个调用并聚合结果
 */
export function useCanvasAgentTools() {
  const flow = useReactFlow()

  const tools = useMemo(() => buildCanvasAgentTools(flow), [flow])
  const toolSchemas = useMemo(() => buildCanvasAgentToolSchemas(), [])

  const callTool = useCallback(
    (name, args = {}) => {
      // 【B层】每个工具分发：工具名 + 参数摘要（截断防超大 JSON 刷屏）——定位 AI 调了哪个工具、传了什么
      logger.debug('AI助手', '[工具] 分发', { name, args: stringifyArgs(args) }, { module: 'agent' })
      const fn = tools[name]
      if (!fn) {
        // 【A层】未知工具：模型幻觉调了不存在的工具（异常，值得留痕）
        logger.warn('AI助手', '未知工具', { name, available: AGENT_TOOLS.map((t) => t.name) })
        return { ok: false, error: `未知工具：${name}。可用：${AGENT_TOOLS.map((t) => t.name).join('、')}` }
      }
      return fn(args)
    },
    [tools]
  )

  // 批量执行（支持 Agent 多步编排/测试脚本）
  const execute = useCallback(
    (spec) => {
      const list = Array.isArray(spec) ? spec : [{ name: spec?.name, args: spec?.args }]
      const results = []
      for (const item of list) {
        results.push({ name: item?.name, ...callTool(item?.name, item?.args) })
      }
      return { ok: true, data: results }
    },
    [callTool]
  )

  return { tools, toolSchemas, callTool, execute }
}

/** 导出工具清单（供非 hook 环境 / 测试 / 文档使用） */
export const CANVAS_AGENT_TOOL_NAMES = AGENT_TOOLS.map((t) => t.name)
