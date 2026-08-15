import { useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { getPaletteNode, defaultNodeData } from './NodePalette.jsx'
import { runNodeGeneration } from './taskStore.js'
import { createGroupFromNodes } from './groupNodes.js'

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
  description: '触发指定节点的生成任务。生成为异步过程，提交后立即返回。调用前确保该节点已有提示词。',
  parameters: { type: 'object', properties: { nodeId: { type: 'string' } }, required: ['nodeId'] },
  execute(args, ctx) {
    const id = str(args.nodeId)
    const node = ctx.getNodes().find((n) => n.id === id)
    if (!node) return { ok: false, error: `节点不存在：${id}` }
    // 通过统一契约触发真实生成（节点须已用 useNodeGeneration 注册 start）。
    const triggered = runNodeGeneration(id)
    if (!triggered) {
      return { ok: false, error: `节点 ${id} 未注册生成契约（类型 ${node.type} 暂不支持由 Agent 驱动）` }
    }
    return { ok: true, data: { id, submitted: true, note: '已触发生成（走 useNodeGeneration 统一契约）' } }
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
  fitViewTool,
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
    map[t.name] = (args) => {
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
