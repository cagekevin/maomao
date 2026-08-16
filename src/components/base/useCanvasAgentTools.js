import { useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { getPaletteNode, defaultNodeData } from './NodePalette.jsx'
import { runNodeGeneration } from './taskStore.js'
import { createGroupFromNodes } from './groupNodes.js'
import { executePlan } from './canvasPlanExecutor.js'
import {
  patchCurrentWorkflow, setCurrentMemory, getCurrentMemory,
  getActiveAiUndoStack, pushActiveAiUndo, popActiveAiUndo,
  getActivePendingGenerations, setActivePendingGenerations,
  getAwaitingConfirm, setAwaitingConfirm,
} from './conversationStore.js'

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
let genParams = { model: '', ratio: 'Auto', resolution: '1K' }
export function setGenParams(patch = {}) {
  genParams = { ...genParams, ...patch }
}
export function getGenParams() {
  return genParams
}

/* ════════════════════════════════════════════════════════════════
 * Skill 三阶段：阶段1 策划暂存（pendingGenerations）
 * ────────────────────────────────────────────────────────────────
 * 对齐大雄三阶段（理解→规划→执行）：
 *  - 阶段1 策划：LLM 调 present_plan 输出策划，前端展示给用户确认，generations 暂存当前对话。
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
 * 【何时用 / 何时不用】
 *   用：Agent 面板、自动化脚本、测试驱动画布时统一走这里。
 *   不用：节点内部 UI 交互（那是节点自己的事）；手写一次性操作（直接 setNodes）。
 *
 * 【接真系统路径】
 *   当前所有工具操作 ReactFlow 内存画布（原型阶段）。
 *   接真引擎时：若 Agent 改走服务端，把 setNodes/setEdges 换成调 localTool 状态接口即可；
 *   工具签名与返回信封不变，LLM 侧无感知。
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

/** 把 args 里某字段归一为 number（允许 '12'），非法给 fallback */
const num = (v, fb) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fb
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
  'update_node', 'update_node_raw',
  'connect_nodes', 'batch_connect_nodes', 'delete_edge',
  'move_node', 'group_nodes', 'lock_node',
  'execute_plan', // 多步编排：一次改多个节点，整体入 AI 撤销栈（undo_ai 可整体撤回）
])
/** AI 撤销栈上限（分组事务可回滚步数）；【Step D】栈存在 conversationStore per-conversation，不再模块级 */
const MAX_AI_UNDO = 20

/**
 * 建节点工具（复刻官方 create_node + batch_create_nodes）。
 * type 从 NodePalette 目录取（getPaletteNode），默认给默认 data；prompt/label 可覆盖。
 * 返回新建节点 id 列表，供后续连线/改节点用。
 */
const createNodeTool = {
  name: 'create_node',
  description:
    '在当前画布创建节点。type 枚举来自节点目录：textNode(文本)、promptNode(图片/生图)、discountVideoNode(视频)、imageNode(图片节点)、scriptBoxNode(剧本盒子)、group(编组) 等。可指定 prompt/label/position；可选 connectFrom 表示从某节点拉一条连线到新节点。返回新建节点的 id。',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['textNode', 'promptNode', 'imageNode', 'discountVideoNode', 'scriptBoxNode', 'group'], description: '节点类型' },
      prompt: { type: 'string', description: '提示词/生成内容（textNode/promptNode/discountVideoNode 适用）' },
      label: { type: 'string', description: '节点标题（可选）' },
      position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, description: '画布坐标（可选，默认视窗中心）' },
      connectFrom: { type: 'string', description: '从该节点拉一条连线到新节点（可选）' }
    },
    required: ['type']
  },
  execute(args, ctx) {
    const type = str(args.type)
    if (!type || !getPaletteNode(type)) return { ok: false, error: `未知节点类型：${type}。可选：${['textNode', 'promptNode', 'imageNode', 'discountVideoNode', 'scriptBoxNode', 'group'].join('、')}` }
    const { getNodes, setNodes, setEdges, screenToFlowPosition } = ctx
    const data = { ...defaultNodeData(type), ...(args.label ? { label: args.label } : {}), ...(args.prompt ? { prompt: args.prompt } : {}) }
    // 无 position 时用视窗中心（浏览器环境）。window 兜底：非浏览器（测试/SSR）用 {0,0}。
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0
    const position = args.position
      ? { x: num(args.position.x, 0), y: num(args.position.y, 0) }
      : screenToFlowPosition?.({ x: vw / 2, y: vh / 2 }) || { x: 0, y: 0 }
    const id = `${type}-${Date.now()}`
    const newNode = { id, type, position: { ...position }, data }
    // 生图节点默认 420×420（对齐 App.jsx addNode，避免端口跑偏）
    if (type === 'promptNode') Object.assign(newNode, { width: 420, height: 420, style: { width: 420, height: 420 } })

    const nextNodes = [...getNodes(), newNode]
    let nextEdges = []
    if (args.connectFrom) {
      const src = getNodes().find((n) => n.id === args.connectFrom)
      if (src) {
        nextEdges = [{ id: `e-${src.id}-${id}`, source: src.id, sourceHandle: null, target: id, type: 'default', animated: false }]
      }
    }
    setNodes(nextNodes)
    if (nextEdges.length) setEdges((es) => [...es, ...nextEdges])
    return { ok: true, data: { id, position: newNode.position, connected: nextEdges.length > 0 } }
  }
}

/** 批量建节点（batch_create_nodes）—— 复用 createNode，逐个建并返回 id 列表 */
const batchCreateNodesTool = {
  name: 'batch_create_nodes',
  description: '批量创建多个节点，适合一次搭建整条生成流程（提示词→配置→视频/图片）。每个元素结构与 create_node 相同，connectFrom 可用数组内前面建好的 id。',
  parameters: {
    type: 'object',
    properties: {
      nodes: { type: 'array', items: { type: 'object' }, description: '节点数组，每个元素 { type, prompt?, label?, position?, connectFrom? }' }
    },
    required: ['nodes']
  },
  execute(args, ctx) {
    if (!Array.isArray(args.nodes) || args.nodes.length === 0) return { ok: false, error: 'nodes 数组为空' }
    const ids = []
    let lastError = null
    for (const one of args.nodes) {
      const r = createNodeTool.execute(one, ctx)
      if (r.ok) ids.push(r.data.id)
      else lastError = r.error
    }
    return { ok: ids.length > 0, data: { ids }, ...(lastError && ids.length === 0 ? { error: lastError } : {}) }
  }
}

/** 删除节点（delete_node）—— 连带删除相连边 */
const deleteNodeTool = {
  name: 'delete_node',
  description: '删除指定节点及其相连的所有连线。删除后该节点 id 失效，不可再引用。',
  parameters: {
    type: 'object',
    properties: { nodeId: { type: 'string', description: '要删除的节点 id' } },
    required: ['nodeId']
  },
  execute(args, ctx) {
    const { getNodes, getEdges, setNodes, setEdges } = ctx
    const id = str(args.nodeId)
    const exists = getNodes().some((n) => n.id === id)
    if (!exists) return { ok: false, error: `节点不存在：${id}` }
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    return { ok: true, data: { id } }
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
    const { getNodes, setNodes, setEdges } = ctx
    setNodes((ns) => ns.filter((n) => !ids.includes(n.id)))
    setEdges((es) => es.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)))
    return { ok: true, data: { deleted: ids } }
  }
}

/**
 * 改节点（update_node）—— 白名单字段不可变写回。
 * 对齐官方 update_node 的白名单：prompt/label/selectedModel/aspectRatio/resolution/seconds/text。
 * 只改目标节点 data，非目标节点原样返回（引用不变，不重渲染）。
 */
const updateNodeTool = {
  name: 'update_node',
  description: '更新节点数据。白名单字段：prompt(提示词)、label(标题)、selectedModel(模型)、aspectRatio(宽高比 如 16:9)、resolution(分辨率 如 720p)、seconds(视频秒数)、text(文本内容)。只改传入字段，不影响其他。',
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
      text: { type: 'string', description: '文本节点内容' }
    },
    required: ['nodeId']
  },
  execute(args, ctx) {
    const { getNodes, setNodes } = ctx
    const id = str(args.nodeId)
    const node = getNodes().find((n) => n.id === id)
    if (!node) return { ok: false, error: `节点不存在：${id}` }
    // 白名单字段（对齐官方 update_node，防 LLM 乱改任意 data 造成失同步）
    const WHITELIST = ['prompt', 'label', 'selectedModel', 'aspectRatio', 'resolution', 'seconds', 'text', 'locked']
    const patch = {}
    for (const k of WHITELIST) {
      if (args[k] !== undefined) patch[k] = args[k]
    }
    if (Object.keys(patch).length === 0) return { ok: true, data: { id, unchanged: true } }
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
    return { ok: true, data: { id, updated: Object.keys(patch) } }
  }
}

/**
 * 更新节点任意原始字段（update_node_raw）—— 高级。
 * 对齐官方 update_node_raw：nodeId + patch 直接合并进 data。⚠️ 只改必要字段，避免覆盖其他数据。
 */
const updateNodeRawTool = {
  name: 'update_node_raw',
  description: '直接更新节点的任意原始 data 字段（高级）。入参 patch 会整体合并进 node.data。仅改必要字段，避免覆盖其他数据。',
  parameters: {
    type: 'object',
    properties: {
      nodeId: { type: 'string' },
      patch: { type: 'object', description: '要合并进 node.data 的字段' }
    },
    required: ['nodeId', 'patch']
  },
  execute(args, ctx) {
    const { getNodes, setNodes } = ctx
    const id = str(args.nodeId)
    const node = getNodes().find((n) => n.id === id)
    if (!node) return { ok: false, error: `节点不存在：${id}` }
    const patch = args.patch && typeof args.patch === 'object' ? args.patch : null
    if (!patch || Object.keys(patch).length === 0) return { ok: false, error: 'patch 为空' }
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
    return { ok: true, data: { id, updated: Object.keys(patch) } }
  }
}

/** 连线（connect_nodes）—— source 输出流向 target */
const connectNodesTool = {
  name: 'connect_nodes',
  description: '连接两个节点表示数据流（source 的输出流向 target）。',
  parameters: {
    type: 'object',
    properties: { source: { type: 'string', description: '数据源节点 id' }, target: { type: 'string', description: '数据目标节点 id' } },
    required: ['source', 'target']
  },
  execute(args, ctx) {
    const { getNodes, getEdges, setEdges } = ctx
    const source = str(args.source)
    const target = str(args.target)
    if (!getNodes().some((n) => n.id === source)) return { ok: false, error: `源节点不存在：${source}` }
    if (!getNodes().some((n) => n.id === target)) return { ok: false, error: `目标节点不存在：${target}` }
    const exists = getEdges().some((e) => e.source === source && e.target === target)
    if (exists) return { ok: true, data: { source, target, alreadyConnected: true } }
    setEdges((es) => [...es, { id: `e-${source}-${target}-${Date.now()}`, source, sourceHandle: null, target, type: 'default', animated: false }])
    return { ok: true, data: { source, target } }
  }
}

/** 批量连线（batch_connect_nodes） */
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
    let okCount = 0
    for (const c of list) {
      const r = connectNodesTool.execute(c, ctx)
      if (r.ok) okCount++
    }
    return { ok: true, data: { connected: okCount, total: list.length } }
  }
}

/** 删除连线（delete_edge） */
const deleteEdgeTool = {
  name: 'delete_edge',
  description: '删除指定连线。可传 edgeId，或传 source+target 按端点删除。',
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
  description: '列出画布上所有节点，返回每个节点的 id/type/label/坐标。操作画布前应先调用本工具了解现有结构。',
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
  description: '读取指定节点的完整 data（提示词、模型、尺寸、生成结果 URL 等）。',
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
  description: '读取整个画布当前结构（所有节点 + 所有连线），用于了解画布全貌后再执行操作。',
  parameters: { type: 'object', properties: {}, required: [] },
  execute(args, ctx) {
    const nodes = ctx.getNodes().map((n) => ({
      id: n.id,
      type: n.type,
      label: n.data?.label || '',
      prompt: n.data?.prompt || '',
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
 * 触发节点生成（trigger_generation）
 * 走统一生成契约：useNodeGeneration 已把各节点的 start 注册到 taskStore.retryRegistry，
 * 这里按 nodeId 调用 runNodeGeneration 即可驱动「真」生成（含进度 + 任务中心 + node.data 双写）。
 */
const triggerGenerationTool = {
  name: 'trigger_generation',
  description: '触发指定节点的生成任务并等待其完成，返回结果 URL。生成为异步过程，本工具会一直等到图生成完成。调用前确保该节点已有提示词。返回 resultUrl 供后续步骤用作参考图/前序依赖。',
  parameters: { type: 'object', properties: { nodeId: { type: 'string', description: '要触发生成的节点 id' } }, required: ['nodeId'] },
  execute: async (args, ctx) => {
    const id = str(args.nodeId)
    const node = ctx.getNodes().find((n) => n.id === id)
    if (!node) return { ok: false, error: `节点不存在：${id}` }
    // 通过统一契约触发真实生成（节点须已用 useNodeGeneration 注册 start）。
    // 【异步执行器地基】runNodeGeneration 新版透传 start() 的 promise（{ ok, resultUrl }），
    // await 它可拿到已落盘的持久 resultUrl（供前序依赖/多图编排复用）。
    const res = await runNodeGeneration(id)
    if (!res) {
      return { ok: false, error: `节点 ${id} 未注册生成契约（类型 ${node.type} 暂不支持由 Agent 驱动）` }
    }
    if (res.ok === false) {
      return { ok: false, error: res.error || '生成失败' }
    }
    // res 可能是 { ok:true, resultUrl }（新版 start）或 true（旧回调）→ resultUrl 兜底空串
    const resultUrl = res.resultUrl || ''
    return { ok: true, data: { id, submitted: true, resultUrl, note: '已触发生成并等待完成' } }
  }
}

/**
 * 多步编排（execute_plan）
 * 接收一个 generations 计划（多张图/多步骤，含前序依赖），批量建节点并执行。
 * 对齐大雄 canvas-agent：按 depends_on_previous 分独立批+依赖批，依赖批用前序结果当参考图。
 * 是 Skill（5主图+8详情 等大批量任务）的执行引擎。
 */
const presentPlanTool = {
  name: 'present_plan',
  description: '展示你的生成策划给用户确认（Skill 阶段1）。在调用 execute_plan 之前，先调本工具把规划说明和 generations 计划呈现给用户。前端会把 plan_text 显示为策划，用户确认后再执行。',
  parameters: {
    type: 'object',
    properties: {
      plan_text: { type: 'string', description: '策划说明（给用户看的规划摘要：目标、几步、每步用途）' },
      generations: {
        type: 'array',
        description: '步骤数组。每项 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }',
        items: { type: 'object' }
      }
    },
    required: ['plan_text', 'generations']
  },
  execute(args, ctx) {
    const gens = Array.isArray(args.generations) ? args.generations : []
    const planText = String(args.plan_text || '').trim()
    if (!planText) return { ok: false, error: 'plan_text 为空' }
    // 暂存 generations（用户确认后 execute_plan 可用）；plan_text 由 useAgentChat 展示为用户可见策划
    setPendingGenerations(gens)
    // 【Step D 确认态】present_plan 后进入"待确认"，execute_plan 未确认时被拒（防止 LLM 直接出图）
    setAwaitingConfirm(true)
    // memory 提炼（对齐大雄 conv.memory.lastPlan）：把阶段1策划记入当前对话，供多轮上下文
    const mem = getCurrentMemory()
    setCurrentMemory({ ...mem, lastPlan: { plan_text: planText, generations: gens, ts: Date.now() } })
    return { ok: true, data: { presented: true, plan_text: planText, generations_count: gens.length, awaiting_confirm: true } }
  }
}

/**
 * 多步编排（execute_plan）
 * 接收一个 generations 计划（多张图/多步骤，含前序依赖），批量建节点并执行。
 * 对齐大雄 canvas-agent：按 depends_on_previous 分独立批+依赖批，依赖批用前序结果当参考图。
 * 是 Skill（5主图+8详情 等大批量任务）的执行引擎。
 */
const executePlanTool = {
  name: 'execute_plan',
  description: '批量执行一个生成计划（多张图/多步骤）。输入 generations 数组，每步含 prompt、比例、分辨率、是否依赖前序结果。执行器会按依赖分批建节点并触发生成，返回每步结果 URL。适合"做5张主图+8张详情页"这类大批量任务。',
  parameters: {
    type: 'object',
    properties: {
      generations: {
        type: 'array',
        description: '步骤数组。每项 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }',
        items: { type: 'object' }
      },
      auto_run: { type: 'boolean', description: '是否自动触发生成（默认 true）。false 时只建节点不跑，供用户确认' },
      model: { type: 'string', description: '生图默认模型（可选）' },
      referenceImages: { type: 'array', items: { type: 'string' }, description: '参考图 url 数组（可选；写进生图节点作图生图参考，对齐大雄图像模式）' }
    },
    required: ['generations']
  },
  execute: async (args, ctx) => {
    try {
      // 【Step F 确认态硬约束】present_plan 后 awaitingConfirm=true，未确认前拒绝 execute_plan
      // （无论是否带 generations），防止 LLM 在用户未确认时直接出图。仅前端确认按钮翻转。
      if (getAwaitingConfirm()) {
        return { ok: false, error: '策划尚未确认，请先确认后再执行。' }
      }
      // 优先用本次传入的 generations；若空则用阶段1 present_plan 暂存的（Skill 三阶段）
      let gens = Array.isArray(args.generations) ? args.generations : []
      if (gens.length === 0) {
        const pending = getPendingGenerations()
        gens = pending || []
        clearPendingGenerations()
      }
      if (gens.length === 0) return { ok: false, error: 'generations 为空' }
      const autoRun = args.auto_run !== false
      // 【模型锁定】用面板生图参数区（getGenParams）作为默认；LLM 显式传 model 则优先。
      const panel = getGenParams()
      const model = str(args.model) || panel.model
      // workflow 贯穿（对齐大雄）：执行开始 → running；执行结束 → completed/failed。状态写入当前对话 workflow。
      patchCurrentWorkflow({ status: 'running', updatedAt: Date.now() })
      const refImgs = Array.isArray(args.referenceImages) ? args.referenceImages.filter(Boolean) : []
      const result = await executePlan({ ctx, generations: gens, autoRun, model, defaults: panel, referenceImages: refImgs })
      if (!result || !result.entries) {
        patchCurrentWorkflow({ status: 'failed', updatedAt: Date.now() })
        return { ok: false, error: '计划执行失败' }
      }
      const anyFailed = result.entries.some((e) => e.status === 'failed')
      patchCurrentWorkflow({ status: anyFailed ? 'completed_with_errors' : 'completed', updatedAt: Date.now() })
      // memory 提炼：把执行计划记入当前对话（对齐大雄 conv.memory.lastPlan）
      const mem = getCurrentMemory()
      setCurrentMemory({ ...mem, lastPlan: { plan_text: args.plan_text || mem?.lastPlan?.plan_text || '', generations: gens, ts: Date.now() } })
      return { ok: true, data: { workflow: result.workflow, entries: result.entries } }
    } catch (e) {
      patchCurrentWorkflow({ status: 'failed', updatedAt: Date.now() })
      return { ok: false, error: `计划执行异常：${e?.message || e}` }
    }
  }
}

/** 视图适配（fit_view）—— zoom 到能看到所有节点 */
const fitViewTool = {
  name: 'fit_view',
  description: '缩放画布视图以显示所有节点（类似 Ctrl+L 前的适配）。',
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
  description: '把画布视口居中到指定节点并适度放大，便于聚焦查看该节点。',
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
  description: '锁定或解锁节点。传 nodeId 锁定单个节点；传 type（如 promptNode/imageNode）锁定该类型全部节点。锁定后节点不可拖动、不可编辑。',
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
    const locked = args.locked !== false
    const { getNodes, setNodes } = ctx
    let targets = []
    if (str(args.nodeId)) {
      const n = getNodes().find((x) => x.id === args.nodeId)
      if (!n) return { ok: false, error: `节点不存在：${args.nodeId}` }
      targets = [n]
    } else if (str(args.type)) {
      targets = getNodes().filter((n) => n.type === args.type)
      if (targets.length === 0) return { ok: false, error: `没有 ${args.type} 类型的节点` }
    } else {
      return { ok: false, error: '需提供 nodeId 或 type' }
    }
    const ids = targets.map((n) => n.id)
    setNodes((ns) => ns.map((n) => (ids.includes(n.id) ? { ...n, data: { ...n.data, locked }, draggable: !locked, selectable: !locked } : n)))
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
  description: '撤回 AI 刚才那步画布操作（只影响 AI 自己通过工具改的画布，与用户手动 Ctrl+Z 撤销完全隔离）。可逐次撤回 AI 的写操作（含一次多步编排）。',
  parameters: { type: 'object', properties: {}, required: [] },
  execute(args, ctx) {
    const snap = popActiveAiUndo() // 当前对话的 AI 撤销栈（Step D，多对话不串）
    if (!snap) return { ok: false, error: '没有可撤回的 AI 操作' }
    ctx.setNodes(snap.nodes)
    ctx.setEdges(snap.edges)
    return { ok: true, data: { reverted: snap.action || '上一步操作', remaining: getActiveAiUndoStack().length } }
  }
}

/** 移动节点（move_node） */
const moveNodeTool = {
  name: 'move_node',
  description: '移动指定节点到新坐标。',
  parameters: {
    type: 'object',
    properties: { nodeId: { type: 'string' }, position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] } },
    required: ['nodeId', 'position']
  },
  execute(args, ctx) {
    const { getNodes, setNodes } = ctx
    const id = str(args.nodeId)
    if (!getNodes().some((n) => n.id === id)) return { ok: false, error: `节点不存在：${id}` }
    const pos = { x: num(args.position?.x, 0), y: num(args.position?.y, 0) }
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, position: pos } : n)))
    return { ok: true, data: { id, position: pos } }
  }
}

/** 编组（group_nodes）—— 把多个节点放进一个编组（真实现：与右键「编组」共用 createGroupFromNodes） */
const groupNodesTool = {
  name: 'group_nodes',
  description: '把多个节点编入一个编组。节点需至少 2 个且均非 group 类型、未在其它组内。',
  parameters: { type: 'object', properties: { nodeIds: { type: 'array', items: { type: 'string' } } }, required: ['nodeIds'] },
  execute(args, ctx) {
    const ids = Array.isArray(args.nodeIds) ? args.nodeIds.map(String) : []
    if (ids.length < 2) return { ok: false, error: 'nodeIds 至少 2 个' }
    const res = createGroupFromNodes(ctx.getNodes(), ids)
    if (!res.ok) return { ok: false, error: res.error || '编组失败' }
    ctx.setNodes(res.nodes)
    return { ok: true, data: { groupId: res.groupId, grouped: ids } }
  }
}

/**
 * 工具清单（统一注册表）。新增画布工具在此加一行：
 *  - 定义工具对象（name/description/parameters/execute）放在上面；
 *  - 在此数组登记。
 * Agent / 测试 / 脚本统一从这里取（getAgentTools）。
 */
const AGENT_TOOLS = [
  createNodeTool,
  batchCreateNodesTool,
  deleteNodeTool,
  batchDeleteNodesTool,
  updateNodeTool,
  updateNodeRawTool,
  connectNodesTool,
  batchConnectNodesTool,
  deleteEdgeTool,
  listNodesTool,
  listEdgesTool,
  getNodeDetailsTool,
  readCanvasTool,
  triggerGenerationTool,
  presentPlanTool,
  executePlanTool,
  fitViewTool,
  zoomInTool,
  zoomOutTool,
  focusNodeTool,
  lockNodeTool,
  undoAiTool,
  moveNodeTool,
  groupNodesTool
]

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
    const isMutating = MUTATING_TOOLS.has(t.name)
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
      const fn = tools[name]
      if (!fn) return { ok: false, error: `未知工具：${name}。可用：${AGENT_TOOLS.map((t) => t.name).join('、')}` }
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
