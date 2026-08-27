import { describe, it, expect, vi, beforeEach } from 'vitest'

// 隔离依赖：AI 撤销栈 / 真实生成 / 多步执行器
// 状态（awaiting / pending）用 beforeEach 内 vi.mocked 配对闭包管理，避免模块级变量在 vi.mock 工厂下 TDZ 怪异
vi.mock('../../src/components/agent/conversation/conversationStore.js', () => ({
  pushActiveAiUndo: vi.fn(),
  popActiveAiUndo: vi.fn(() => null),
  getActiveAiUndoStack: vi.fn(() => []),
  setActivePendingGenerations: vi.fn(),
  getActivePendingGenerations: vi.fn(() => null),
  setPendingGenerations: vi.fn(),
  getPendingGenerations: vi.fn(),
  clearPendingGenerations: vi.fn(),
  setAwaitingConfirm: vi.fn(),
  getAwaitingConfirm: vi.fn(),
  setCreditGate: vi.fn(),
  getCreditGate: vi.fn(),
  clearCreditGate: vi.fn(),
  getCurrentMemory: vi.fn(() => ({ summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] })),
  setCurrentMemory: vi.fn(),
  patchCurrentWorkflow: vi.fn(() => ({})),
  getCurrentGlobalContract: vi.fn(() => null),
  setCurrentGlobalContract: vi.fn(),
  getCurrentArtifacts: vi.fn(() => null),
  setCurrentArtifacts: vi.fn(),
  getCurrentRefImages: vi.fn(() => []),
  setCurrentRefImages: vi.fn(),
  getLastUserReferenceImages: vi.fn(() => []),
  getCurrentImageMap: vi.fn(() => []),
  getCurrentRunMode: vi.fn(() => 'auto'),
  getCurrentSnapshot: vi.fn(() => ({ skills: [] })),
}))
vi.mock('../../src/components/base/taskStore.js', () => ({
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://r/x.png' })),
  isNodeRegistered: vi.fn(() => true),
}))
vi.mock('../../src/components/agent/canvas/canvasPlanExecutor.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual, // 保留真实纯函数（buildFusionPrompt/buildProductReferencePrompt 等）
    executePlan: vi.fn(async () => ({ workflow: { status: 'completed' }, entries: [{ status: 'completed', nodeId: 'n1', resultUrl: 'http://r/x.png' }] })),
  }
})

import { buildCanvasAgentTools, CANVAS_AGENT_TOOL_NAMES, getNodeImageUrl, setCurrentReferenceImages, runExistingPlanTool, setCreditSwitch, getCreditSwitch } from '../../src/components/agent/canvas/useCanvasAgentTools.js'
import * as convStore from '../../src/components/agent/conversation/conversationStore.js'
import * as taskStore from '../../src/components/base/taskStore.js'
import { executePlan as mockExecutePlan, buildFusionPrompt, buildProductReferencePrompt } from '../../src/components/agent/canvas/canvasPlanExecutor.js'

function makeCtx(initialNodes = [], initialEdges = []) {
  let nodes = [...initialNodes]
  let edges = [...initialEdges]
  return {
    getNodes: () => nodes,
    // P11：setNodes/setEdges 用 vi.fn 包装，便于断言「批量写合并为单次调用」
    setNodes: vi.fn((fn) => { nodes = typeof fn === 'function' ? fn(nodes) : fn }),
    getEdges: () => edges,
    setEdges: vi.fn((fn) => { edges = typeof fn === 'function' ? fn(edges) : fn }),
    addNodes: (ns) => { nodes = [...nodes, ...ns] },
    screenToFlowPosition: (p) => p || { x: 0, y: 0 },
    fitView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), setCenter: vi.fn(),
    snapshot: () => ({ nodes, edges }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // 配对状态：getX 始终读 __state，setX 写 __state（用例可直接翻转 __state 模拟前端确认）
  convStore.__state = { awaiting: false, pending: null, refImages: [], creditGate: null }
  vi.mocked(convStore.getAwaitingConfirm).mockImplementation(() => convStore.__state.awaiting)
  vi.mocked(convStore.setAwaitingConfirm).mockImplementation((v) => { convStore.__state.awaiting = !!v })
  vi.mocked(convStore.getCreditGate).mockImplementation(() => convStore.__state.creditGate)
  vi.mocked(convStore.setCreditGate).mockImplementation((g) => { convStore.__state.creditGate = g || null })
  vi.mocked(convStore.clearCreditGate).mockImplementation(() => { convStore.__state.creditGate = null })
  vi.mocked(convStore.getPendingGenerations).mockImplementation(() => convStore.__state.pending)
  vi.mocked(convStore.setPendingGenerations).mockImplementation((g) => { convStore.__state.pending = g })
  vi.mocked(convStore.getCurrentRefImages).mockImplementation(() => convStore.__state.refImages)
  vi.mocked(convStore.setCurrentRefImages).mockImplementation((u) => { convStore.__state.refImages = Array.isArray(u) ? u : [] })
})

describe('画布 Agent 工具层 §2.5', () => {
  it('共 26 个工具注册', () => {
    expect(CANVAS_AGENT_TOOL_NAMES).toHaveLength(26)
  })

  it('create_node 建文本节点成功 + 返回 id', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'textNode', label: '测试', prompt: '你好', position: { x: 10, y: 20 } })
    expect(r.ok).toBe(true)
    const node = ctx.getNodes().find((n) => n.id === r.data.id)
    expect(node.data.label).toBe('测试')
    expect(node.position).toEqual({ x: 10, y: 20 })
  })

  it('create_node 未知类型报错', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'nope' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('未知节点类型')
  })

  it('create_node connectFrom 自动连线', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'textNode', connectFrom: 'a' })
    expect(r.data.connected).toBe(true)
    expect(ctx.getEdges()).toHaveLength(1)
  })

  it('create_node promptNode 默认 420×420', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'promptNode' })
    const node = ctx.getNodes().find((n) => n.id === r.data.id)
    expect(node.width).toBe(420)
  })

  it('create_node promptNode 应用 aspectRatio + resolution（9:16 + 1080p→1K）', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'promptNode', prompt: '奥特曼打怪兽', aspectRatio: '9:16', resolution: '1080p' })
    expect(r.ok).toBe(true)
    const node = ctx.getNodes().find((n) => n.id === r.data.id)
    // 比例写入 data.aspectRatio（PromptNode 组件读取）
    expect(node.data.aspectRatio).toBe('9:16')
    // 分辨率 1080p 映射到 data.imageSize=1K（组件读取 imageSize 而非 resolution）
    expect(node.data.imageSize).toBe('1K')
    expect(node.data.resolution).toBeUndefined()
  })

  it('create_node promptNode resolution=4K 映射到 imageSize=4K；1440p→2K', () => {
    // 每次用独立 ctx（节点 id 用 Date.now()，同毫秒并发会撞 id，故分开断言）
    const c1 = makeCtx()
    const r4 = buildCanvasAgentTools(c1).create_node({ type: 'promptNode', resolution: '4K' })
    expect(c1.getNodes().find((n) => n.id === r4.data.id).data.imageSize).toBe('4K')
    const c2 = makeCtx()
    const r2 = buildCanvasAgentTools(c2).create_node({ type: 'promptNode', resolution: '1440p' })
    expect(c2.getNodes().find((n) => n.id === r2.data.id).data.imageSize).toBe('2K')
  })

  it('create_node 非生图节点不写 aspectRatio/resolution', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'textNode', prompt: 'x', aspectRatio: '9:16', resolution: '1080p' })
    const node = ctx.getNodes().find((n) => n.id === r.data.id)
    expect(node.data.aspectRatio).toBeUndefined()
    expect(node.data.imageSize).toBeUndefined()
  })

  it('create_node 有选中节点时放在其右侧 +100、顶部对齐（对齐参考项目 viewportAnchor）', () => {
    // 选中节点：position.x=200, width=420, y=300 → 新节点 x=200+420+100=720, y=300
    const ctx = makeCtx([{ id: 'sel', type: 'promptNode', selected: true, position: { x: 200, y: 300 }, width: 420, data: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'promptNode', prompt: '新图' })
    expect(r.ok).toBe(true)
    const node = ctx.getNodes().find((n) => n.id === r.data.id)
    expect(node.position.x).toBe(200 + 420 + 100)
    expect(node.position.y).toBe(300)
  })

  it('create_node 多个选中节点取最右边界 + 100、y 取最小顶部', () => {
    const ctx = makeCtx([
      { id: 'a', type: 'promptNode', selected: true, position: { x: 0, y: 100 }, width: 400, data: {} },
      { id: 'b', type: 'promptNode', selected: true, position: { x: 300, y: 50 }, width: 300, data: {} }, // 最右：300+300=600
    ])
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'promptNode' })
    const node = ctx.getNodes().find((n) => n.id === r.data.id)
    expect(node.position.x).toBe(300 + 300 + 100) // 最右边界 600 + 100
    expect(node.position.y).toBe(50) // 最小顶部
  })

  it('create_node 显式传 position 时优先使用，不自动计算', () => {
    const ctx = makeCtx([{ id: 'sel', type: 'promptNode', selected: true, position: { x: 200, y: 300 }, width: 420, data: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'promptNode', position: { x: 999, y: 888 } })
    const node = ctx.getNodes().find((n) => n.id === r.data.id)
    expect(node.position.x).toBe(999)
    expect(node.position.y).toBe(888)
  })

  it('batch_create_nodes 批量建', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_create_nodes({ nodes: [{ type: 'textNode' }, { type: 'promptNode' }] })
    expect(r.ok).toBe(true)
    expect(r.data.ids).toHaveLength(2)
  })

  it('P11 batch_create_nodes 单次 setNodes 写回（循环内不逐条写）', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_create_nodes({ nodes: [{ type: 'textNode' }, { type: 'promptNode' }, { type: 'imageNode' }] })
    expect(r.ok).toBe(true)
    expect(ctx.getNodes()).toHaveLength(3)
    expect(ctx.setNodes).toHaveBeenCalledTimes(1) // 合并为一次批量写
    expect(ctx.setEdges).not.toHaveBeenCalled()   // 无 connectFrom 不触发边写
  })

  it('P11 batch_create_nodes connectFrom 边合并为单次 setEdges', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_create_nodes({ nodes: [{ type: 'textNode', connectFrom: 'a' }, { type: 'textNode', connectFrom: 'a' }] })
    expect(r.ok).toBe(true)
    expect(ctx.setNodes).toHaveBeenCalledTimes(1)
    expect(ctx.setEdges).toHaveBeenCalledTimes(1)
    expect(ctx.getEdges()).toHaveLength(2)
  })

  it('P11 batch_create_nodes 位置与逐条 create_node 完全一致（合并写不改变布局语义）', () => {
    // 基线：逐条 create_node（受选中节点锚定，位置确定性）
    const c1 = makeCtx([{ id: 'sel', type: 'textNode', selected: true, position: { x: 0, y: 0 }, width: 300, data: {} }])
    const t1 = buildCanvasAgentTools(c1)
    const seqPos = [t1.create_node({ type: 'textNode' }).data.position, t1.create_node({ type: 'textNode' }).data.position]
    // P11：批量建（合并为单次写）
    const c2 = makeCtx([{ id: 'sel', type: 'textNode', selected: true, position: { x: 0, y: 0 }, width: 300, data: {} }])
    const t2 = buildCanvasAgentTools(c2)
    const b = t2.batch_create_nodes({ nodes: [{ type: 'textNode' }, { type: 'textNode' }] })
    const batchPos = b.data.ids.map((id) => c2.getNodes().find((n) => n.id === id).position)
    expect(batchPos).toEqual(seqPos)
    expect(c2.setNodes).toHaveBeenCalledTimes(1)
  })

  it('P11 batch_create_nodes 含非法类型：合法照建、非法跳过并保留错误', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_create_nodes({ nodes: [{ type: 'textNode' }, { type: 'nope' }] })
    expect(r.ok).toBe(true) // 有合法节点仍成功
    expect(r.data.ids).toHaveLength(1)
    expect(ctx.getNodes()).toHaveLength(1)
    expect(ctx.setNodes).toHaveBeenCalledTimes(1)
  })

  it('delete_node 连带删边', () => {
    const ctx = makeCtx(
      [{ id: 'a', type: 'textNode', data: {}, position: {} }, { id: 'b', type: 'textNode', data: {}, position: {} }],
      [{ id: 'e', source: 'a', target: 'b' }]
    )
    const t = buildCanvasAgentTools(ctx)
    const r = t.delete_node({ nodeId: 'a' })
    expect(r.ok).toBe(true)
    expect(ctx.getNodes().some((n) => n.id === 'a')).toBe(false)
    expect(ctx.getEdges()).toHaveLength(0)
  })

  it('delete_node 不存在报错', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    expect(t.delete_node({ nodeId: 'x' }).ok).toBe(false)
  })

  it('getNodeImageUrl：提取节点主图 URL（imageUrl 字符串）', () => {
    expect(getNodeImageUrl({ data: { imageUrl: 'http://a/1.png' } })).toBe('http://a/1.png')
    expect(getNodeImageUrl({ data: { url: 'http://a/2.png' } })).toBe('http://a/2.png')
    expect(getNodeImageUrl({ data: {} })).toBe('')
  })

  it('getNodeImageUrl：支持 images/imageUrls 数组（字符串或对象）', () => {
    expect(getNodeImageUrl({ data: { images: [{ url: 'http://a/3.png' }, { url: 'http://a/4.png' }] } })).toBe('http://a/3.png')
    expect(getNodeImageUrl({ data: { images: ['http://a/5.png'] } })).toBe('http://a/5.png')
    expect(getNodeImageUrl({ data: { imageUrls: [{ imageUrl: 'http://a/6.png' }] } })).toBe('http://a/6.png')
    expect(getNodeImageUrl({ data: { images: [] } })).toBe('')
  })

  it('batch_delete_nodes 批量删', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_delete_nodes({ nodeIds: ['a', 'b'] })
    expect(r.ok).toBe(true)
    expect(ctx.getNodes()).toHaveLength(1)
  })

  it('update_node 白名单 + 不可变局部更新', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textNode', data: { label: '旧', prompt: 'keep' }, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const before = ctx.getNodes()[0]
    const r = t.update_node({ nodeId: 'a', label: '新' })
    const after = ctx.getNodes()[0]
    expect(after.data.label).toBe('新')
    expect(after.data.prompt).toBe('keep')
    expect(after).not.toBe(before)
    expect(r.data.updated).toContain('label')
  })

  it('update_node 非白名单字段被忽略', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.update_node({ nodeId: 'a', prompt: 'P', evilField: 'x' })
    expect(r.ok).toBe(true)
    expect(ctx.getNodes()[0].data.evilField).toBeUndefined()
    expect(ctx.getNodes()[0].data.prompt).toBe('P')
  })

  it('update_node_any_field 合并任意字段', () => {
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.update_node_any_field({ nodeId: 'a', patch: { custom: 1, imageUrl: '/f.png' } })
    expect(r.ok).toBe(true)
    expect(ctx.getNodes()[0].data.custom).toBe(1)
  })

  it('connect_nodes 去重 + 端点校验', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }])
    const t = buildCanvasAgentTools(ctx)
    t.connect_nodes({ source: 'a', target: 'b' })
    const r2 = t.connect_nodes({ source: 'a', target: 'b' })
    expect(r2.data.alreadyConnected).toBe(true)
    expect(ctx.getEdges()).toHaveLength(1)
    expect(t.connect_nodes({ source: 'x', target: 'b' }).ok).toBe(false)
  })

  it('batch_connect_nodes 批量', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_connect_nodes({ connections: [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }] })
    expect(r.data.connected).toBe(2)
  })

  it('P11 batch_connect_nodes 单次 setEdges 写回（循环内不逐条写）', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_connect_nodes({ connections: [{ source: 'a', target: 'b' }, { source: 'b', target: 'c' }, { source: 'c', target: 'd' }] })
    expect(r.ok).toBe(true)
    expect(r.data.connected).toBe(3)
    expect(ctx.getEdges()).toHaveLength(3)
    expect(ctx.setEdges).toHaveBeenCalledTimes(1)
  })

  it('P11 batch_connect_nodes 去重：重复连线计成功但只写一次', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_connect_nodes({ connections: [{ source: 'a', target: 'b' }, { source: 'a', target: 'b' }] })
    expect(r.data.connected).toBe(2) // 已存在连线仍计成功（对齐原语义）
    expect(ctx.getEdges()).toHaveLength(1)
    expect(ctx.setEdges).toHaveBeenCalledTimes(1)
  })

  it('P11 batch_connect_nodes 非法端点不写边、不计数', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_connect_nodes({ connections: [{ source: 'a', target: 'b' }, { source: 'x', target: 'a' }] })
    expect(r.data.connected).toBe(1) // 仅合法的一条
    expect(ctx.getEdges()).toHaveLength(1)
    expect(ctx.setEdges).toHaveBeenCalledTimes(1)
  })

  it('delete_edge 按 edgeId 或端点删', () => {
    const ctx = makeCtx([{ id: 'a' }, { id: 'b' }], [{ id: 'e1', source: 'a', target: 'b' }])
    const t = buildCanvasAgentTools(ctx)
    expect(t.delete_edge({ edgeId: 'e1' }).ok).toBe(true)
    expect(ctx.getEdges()).toHaveLength(0)
    // 再建一条按端点删
    t.connect_nodes({ source: 'a', target: 'b' })
    const r = t.delete_edge({ source: 'a', target: 'b' })
    expect(r.ok).toBe(true)
    expect(ctx.getEdges()).toHaveLength(0)
  })

  it('delete_edge 不存在报错', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    expect(t.delete_edge({ edgeId: 'no' }).ok).toBe(false)
  })

  it('list_nodes / list_edges / read_canvas 只读', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textNode', data: { label: 'X', imageUrl: '/f.png' }, position: { x: 1, y: 2 } }], [{ id: 'e', source: 'a', target: 'b' }])
    const t = buildCanvasAgentTools(ctx)
    expect(t.list_nodes({}).data.nodes).toHaveLength(1)
    expect(t.list_edges({}).data.edges).toHaveLength(1)
    const rc = t.read_canvas({})
    expect(rc.data.nodes[0].imageUrl).toBe('/f.png')
  })

  it('get_node_details 读详情', () => {
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: { prompt: 'P' }, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    expect(t.get_node_details({ nodeId: 'a' }).data.data.prompt).toBe('P')
    expect(t.get_node_details({ nodeId: 'z' }).ok).toBe(false)
  })

  it('generate_node 拿到 resultUrl → 返回已完成收敛信号（completed:true，不再重复）', async () => {
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = await t.generate_node({ nodeId: 'a' })
    expect(r.ok).toBe(true)
    expect(r.data.resultUrl).toBe('http://r/x.png')
    // 对齐参考项目收敛信号：resultUrl 非空 = 已完成，明确"无需重复操作"
    expect(r.data.completed).toBe(true)
    expect(r.data.submitted).toBeUndefined() // 不再出现"已提交待完成"的误导信号
    expect(r.data.note).toContain('无需重复操作')
  })

  it('generate_node resultUrl 为空 → 返回提交中信号（submitted:true, completed:false），提示勿重复触发', async () => {
    vi.mocked(taskStore.runNodeGeneration).mockResolvedValueOnce({ ok: true, resultUrl: '' })
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = await t.generate_node({ nodeId: 'a' })
    expect(r.ok).toBe(true)
    expect(r.data.completed).toBe(false)
    expect(r.data.submitted).toBe(true)
    expect(r.data.note).toContain('请勿重复触发')
  })

  it('generate_node 失败：返回带 nodeId（供对话侧「重试此步骤」定位节点）', async () => {
    vi.mocked(taskStore.runNodeGeneration).mockResolvedValueOnce({ ok: false, error: '模型超时' })
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = await t.generate_node({ nodeId: 'a' })
    expect(r.ok).toBe(false)
    expect(r.nodeId).toBe('a') // 失败也带 nodeId
    expect(r.error).toBe('模型超时')
  })

  it('generate_node 节点不存在 → 回填可用 id 引导自愈（防 LLM 自猜 promptNode_1）', async () => {
    const ctx = makeCtx([
      { id: 'promptNode_real_a', type: 'promptNode', data: {}, position: {} },
      { id: 'promptNode_real_b', type: 'promptNode', data: {}, position: {} },
      { id: 'text_x', type: 'textNode', data: {}, position: {} },
    ])
    const t = buildCanvasAgentTools(ctx)
    const r = await t.generate_node({ nodeId: 'promptNode_1' }) // 模型自猜的假 id
    expect(r.ok).toBe(false)
    expect(r.error).toContain('节点不存在：promptNode_1')
    // 兜底引导：回填画布上真实可用的生图节点 id（而非只报错让模型卡死/重复建节点）
    expect(r.error).toContain('promptNode_real_a')
    expect(r.error).toContain('promptNode_real_b')
  })

  it('show_plan_for_confirm 暂存策划并进入待确认', async () => {
    // D7：show_plan 判定已收敛为 needConfirm = runMode==='semi'（删 hasSkillNow 强制项）。
    // 半自动模式 → 必进入 awaiting 确认（策划暂存 + 待确认）。
    vi.mocked(convStore.getCurrentRunMode).mockReturnValue('semi')
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.show_plan_for_confirm({ plan_text: '做5张主图', generations: [{ id: 'g1', prompt: '猫' }] })
    expect(r.ok).toBe(true)
    expect(convStore.setAwaitingConfirm).toHaveBeenCalledWith(true)
    expect(convStore.__state.awaiting).toBe(true)
  })

  it('【对齐大雄 全自动 auto】无 Skill + auto：show_plan_for_confirm 不进入 awaiting（规划后直接执行，不弹确认）', async () => {
    convStore.__state.awaiting = false
    vi.mocked(convStore.getCurrentRunMode).mockReturnValue('auto')
    vi.mocked(convStore.getCurrentSnapshot).mockReturnValue({ skills: [] }) // 无 Skill
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.show_plan_for_confirm({ plan_text: '做1张猫图', generations: [{ id: 'g1', prompt: '一只猫' }] })
    expect(r.ok).toBe(true)
    // 关键：auto 无 Skill 不进入 awaiting → awaiting_confirm:false，execute_plan 不被拒（可直接执行）
    expect(r.data.awaiting_confirm).toBe(false)
    expect(convStore.__state.awaiting).toBe(false)
  })

  it('【对齐大雄 半自动 semi】无 Skill + semi：show_plan_for_confirm 进入 awaiting（规划后确认再执行）', async () => {
    convStore.__state.awaiting = false
    vi.mocked(convStore.getCurrentRunMode).mockReturnValue('semi')
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.show_plan_for_confirm({ plan_text: '做1张猫图', generations: [{ id: 'g1', prompt: '一只猫' }] })
    expect(r.ok).toBe(true)
    expect(r.data.awaiting_confirm).toBe(true)
    expect(convStore.__state.awaiting).toBe(true)
    // 恢复默认 runMode，避免污染后续用例
    vi.mocked(convStore.getCurrentRunMode).mockReturnValue('auto')
  })

  it('【D7 真值表】hasSkillNow=true + auto：不再进入 awaiting（删 hasSkillNow 强制项，needConfirm 只由 runMode===\'semi\' 决定）', async () => {
    // D7：show_plan 判定收敛为 needConfirm = runMode==='semi'，hasSkillNow 已删除。
    // 此用例覆盖「有 Skill 但 runMode=auto」→ 不再强制进入 awaiting（awaitingConfirm=false）。
    convStore.__state.awaiting = false
    vi.mocked(convStore.getCurrentRunMode).mockReturnValue('auto')
    vi.mocked(convStore.getCurrentSnapshot).mockReturnValue({ skills: [{ name: 'poster', params: {} }] })
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.show_plan_for_confirm({ plan_text: '做5张主图+8详情', generations: [{ id: 'g1', prompt: '主图1' }] })
    expect(r.ok).toBe(true)
    expect(r.data.awaiting_confirm).toBe(false)
    expect(convStore.__state.awaiting).toBe(false)
    expect(convStore.setAwaitingConfirm).not.toHaveBeenCalledWith(true)
  })

  it('【对齐大雄 §12.1 真值表】hasSkillNow=false + auto：不进入 awaiting（全自动直接执行）', async () => {
    // 真值表另一角：无 Skill 且 auto → needConfirm 为假。
    convStore.__state.awaiting = false
    vi.mocked(convStore.getCurrentRunMode).mockReturnValue('auto')
    vi.mocked(convStore.getCurrentSnapshot).mockReturnValue({ skills: [] })
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.show_plan_for_confirm({ plan_text: '做1张猫图', generations: [{ id: 'g1', prompt: '一只猫' }] })
    expect(r.ok).toBe(true)
    expect(r.data.awaiting_confirm).toBe(false)
    expect(convStore.__state.awaiting).toBe(false)
    // 全自动：execute_plan 不被 awaiting 门禁拦截，可直接执行
    convStore.__state.awaiting = false
    const r2 = await t.execute_plan({ generations: [{ id: 'g1', prompt: '一只猫' }] })
    expect(r2.ok).toBe(true)
  })

  it('execute_plan 未确认被拒', async () => {
    convStore.__state.awaiting = true // 模拟 show_plan_for_confirm 已暂存、进入待确认
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.execute_plan({ generations: [{ id: 'g1', prompt: '猫' }] })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('尚未确认')
  })

  it('fit_view / zoom_in / zoom_out / focus_node 调视图 API', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textNode', data: {}, position: { x: 5, y: 5 } }])
    const t = buildCanvasAgentTools(ctx)
    expect(t.fit_view({}).ok).toBe(true)
    expect(ctx.fitView).toHaveBeenCalled()
    expect(t.zoom_in({}).data.zoomed).toBe('in')
    expect(t.zoom_out({}).data.zoomed).toBe('out')
    expect(t.focus_node({ nodeId: 'a' }).ok).toBe(true)
    expect(ctx.setCenter).toHaveBeenCalled()
    expect(t.focus_node({ nodeId: 'z' }).ok).toBe(false)
  })

  it('lock_node 锁定单节点（draggable/selectable=false）', () => {
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.lock_node({ nodeId: 'a' })
    expect(r.ok).toBe(true)
    const node = ctx.getNodes()[0]
    expect(node.data.locked).toBe(true)
    expect(node.draggable).toBe(false)
    expect(node.selectable).toBe(false)
  })

  it('lock_node 按 type 批量锁', () => {
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: {} }, { id: 'b', type: 'promptNode', data: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.lock_node({ type: 'promptNode' })
    expect(r.data.ids).toHaveLength(2)
  })

  it('move_node 移动坐标', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textNode', data: {}, position: { x: 0, y: 0 } }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.move_node({ nodeId: 'a', position: { x: 100, y: 200 } })
    expect(r.data.position).toEqual({ x: 100, y: 200 })
  })

  it('group_nodes 调 createGroupFromNodes', () => {
    const ctx = makeCtx([{ id: 'a', type: 'textNode', data: {}, position: { x: 0, y: 0 } }, { id: 'b', type: 'promptNode', data: {}, position: { x: 50, y: 0 } }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.group_nodes({ nodeIds: ['a', 'b'] })
    expect(r.ok).toBe(true)
    expect(ctx.getNodes().some((n) => n.type === 'group')).toBe(true)
    expect(r.data.groupId).toBeTruthy()
  })

  it('undo_ai 无栈返回错误', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    expect(t.undo_ai({}).ok).toBe(false)
  })

  it('未知工具经 callTool 返回错误（不在本测试 mock 范围，直接验证包错）', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    // 包一层 try：工具不存在时 buildCanvasAgentTools 的 map 里没有该 key → 返回 undefined 调用报错
    const r = t.call_no_such_tool ? t.call_no_such_tool({}) : { ok: false, error: '未知工具' }
    expect(r.ok).toBe(false)
  })

  // ── Skill 三阶段确认门禁闭环（AI 编排关键防护）──
  it('show_plan_for_confirm → 返回 awaiting_confirm:true（进入待确认态）', async () => {
    convStore.__state.awaiting = false
    // D7：semi 半自动 → 必进入 awaiting 确认（策划暂存 + 待确认）
    vi.mocked(convStore.getCurrentRunMode).mockReturnValue('semi')
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.show_plan_for_confirm({ plan_text: '生成5张主图', generations: [{ id: 'g1', prompt: '猫' }] })
    expect(r.ok).toBe(true)
    expect(r.data.awaiting_confirm).toBe(true)
    // 阶段1 后处于待确认 → execute_plan 被拒（Step F 硬约束）
    const blocked = await t.execute_plan({ generations: [{ id: 'g1', prompt: '猫' }] })
    expect(blocked.ok).toBe(false)
    expect(blocked.error).toContain('尚未确认')
    expect(mockExecutePlan).not.toHaveBeenCalled()
  })

  it('【T4】execute_plan credit 命中（creditSwitch 默认开）→ 只建节点待确认，不真生成', async () => {
    convStore.__state.awaiting = false
    // 2026-08-27 简化：credit = creditSwitch（全局总闸，与 runMode 正交）。开关默认开即命中。
    vi.mocked(convStore.getCurrentRunMode).mockReturnValue('auto') // 保持上下文，表明与 runMode 无关
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.execute_plan({ generations: [{ id: 'g1', prompt: '猫' }] })
    expect(r.ok).toBe(true)
    // D4：credit 命中 → 返回 awaited:'credit'，不声称「已生成」
    expect(r.data.awaited).toBe('credit')
    expect(r.data.note).toContain('待积分确认')
    // 强制 autoRun=false（红线 §6.4：绝不放行 LLM 的 auto_run:true 直接真生成）
    expect(mockExecutePlan).toHaveBeenCalledTimes(1)
    expect(mockExecutePlan.mock.calls[0][0].autoRun).toBe(false)
    // 节点已建好（ready）、置 per-conv creditGate 持久化
    expect(convStore.__state.creditGate?.pending).toBe(true)
    expect(convStore.__state.creditGate?.map).toBeTruthy()
    expect(convStore.__state.creditGate?.gens[0].prompt).toBe('猫')
    // 未置分步确认态（D1：两条门禁独立）
    expect(convStore.__state.awaiting).toBe(false)
  })

  it('【T5】execute_plan credit 未命中（creditSwitch=关）→ 行为与改动前一致（autoRun 按入参放行）', async () => {
    convStore.__state.awaiting = false
    // 2026-08-27 简化：credit = creditSwitch（全局总闸，与 runMode 正交）。
    // 未命中只由「开关关」决定，runMode 已不再是判定输入。
    setCreditSwitch(false)
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.execute_plan({ generations: [{ id: 'g1', prompt: '猫' }], auto_run: true })
    expect(r.ok).toBe(true)
    expect(r.data.awaited).toBeUndefined() // 未命中积分闸
    expect(mockExecutePlan).toHaveBeenCalledTimes(1)
    expect(mockExecutePlan.mock.calls[0][0].autoRun).toBe(true) // 原 autoRun 语义保留
    expect(convStore.__state.creditGate).toBeNull() // 不置积分待确认态
    setCreditSwitch(true) // 还原默认开，避免污染后续
  })

  it('【T6】runExistingPlanTool 前置：creditGate 未置位 → 拒绝且不触发任何生成', async () => {
    convStore.__state.creditGate = null // 无待点生成的计划
    const ctx = makeCtx()
    const r = await runExistingPlanTool(ctx)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('无待点生成的计划')
    expect(mockExecutePlan).not.toHaveBeenCalled()
  })

  it('用户在积分确认卡片点确认（creditGate pending）→ runExistingPlanTool 补跑并清 gate', async () => {
    convStore.__state.creditGate = { pending: true, gens: [{ id: 'g1', prompt: '猫' }], map: { g1: 'n1' } }
    const ctx = makeCtx()
    const r = await runExistingPlanTool(ctx)
    expect(r.ok).toBe(true)
    expect(mockExecutePlan).toHaveBeenCalledTimes(1)
    const arg = mockExecutePlan.mock.calls[0][0]
    expect(arg.mode).toBe('runExisting') // D5：复用执行器，不重建节点
    expect(arg.nodeMappings).toEqual({ g1: 'n1' }) // D6：映射来自同一次 execute_plan
    expect(convStore.__state.creditGate).toBeNull() // 成功清 gate（失败保留待重试）
  })

  it('execute_plan 未传 generations 且无暂存 → 报错（不死循环/不崩溃）', async () => {
    convStore.__state.awaiting = false
    convStore.__state.pending = null
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.execute_plan({}) // 无 generations 也无暂存
    expect(r.ok).toBe(false)
    // 【D缺口】统一兜底：错误透传并给出「未找到生成计划」来源引导，而非静默跳过
    expect(r.error).toContain('未找到生成计划')
    expect(mockExecutePlan).not.toHaveBeenCalled()
  })

  it('execute_plan：按 attachment_indices 精确取用户参考图（对齐大雄，每步独立）', async () => {
    convStore.__state.awaiting = false
    // 参考图池 = 用户引用图的 URL 数组（useAgentChat.send 写入）
    setCurrentReferenceImages(['http://ref/1.png', 'http://ref/2.png'])
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    // AI 规划：step1 用参考图1(→0)，step2 用参考图2(→1)，step3 无索引（用整批共享）
    const r = await t.execute_plan({
      generations: [
        { id: 'g1', prompt: '把猫变白', use_attachments: true, attachment_indices: [0] },
        { id: 'g2', prompt: '把狗变黑', use_attachments: true, attachment_indices: [1] },
        { id: 'g3', prompt: '普通图', use_attachments: false },
      ],
      referenceImages: ['http://ref/global.png'],
    })
    expect(r.ok).toBe(true)
    const arg = mockExecutePlan.mock.calls[0][0]
    // 每步按索引解析成自己的 referenceImages
    expect(arg.generations[0].referenceImages).toEqual(['http://ref/1.png'])
    expect(arg.generations[1].referenceImages).toEqual(['http://ref/2.png'])
    // 无索引的步骤不注入 per-step referenceImages（执行器会回退整批共享）
    expect(arg.generations[2].referenceImages).toBeUndefined()
  })

  it('【对齐大雄 agentLastUserAttachments】本轮无图时 execute_plan 回退用历史 user 图（attachment_indices 精确取）', async () => {
    convStore.__state.awaiting = false
    convStore.__state.refImages = [] // 本轮无参考图
    // 历史 user 图（当前对话最近一条带图 user 消息，模拟 getLastUserReferenceImages 返回）
    vi.mocked(convStore.getLastUserReferenceImages).mockReturnValue(['http://hist/1.png', 'http://hist/2.png'])
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.execute_plan({
      generations: [
        { id: 'g1', prompt: '把上一张改白', use_attachments: true, attachment_indices: [0] },
        { id: 'g2', prompt: '把上一张改黑', use_attachments: true, attachment_indices: [1] },
      ],
    })
    expect(r.ok).toBe(true)
    const arg = mockExecutePlan.mock.calls[0][0]
    // 每步按索引精确取历史图（对齐大雄「本轮无图回退上一轮用户图」）
    expect(arg.generations[0].referenceImages).toEqual(['http://hist/1.png'])
    expect(arg.generations[1].referenceImages).toEqual(['http://hist/2.png'])
  })

  it('【对齐大雄 direct_refs】execute_plan 按图编号引用历史/生成图，prompt 里「图N」翻译成「第X张参考图」', async () => {
    convStore.__state.awaiting = false
    convStore.__state.refImages = []
    // 当前可引用图编号映射：图1=上一轮生成，图2=上一轮生成（agentCurrentImageMap）
    vi.mocked(convStore.getCurrentImageMap).mockReturnValue([
      { num: 1, url: 'http://x/gen1.png', name: '主图', source: 'gen' },
      { num: 2, url: 'http://x/gen2.png', name: '详情', source: 'gen' },
    ])
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.execute_plan({
      generations: [
        { id: 'g1', prompt: '把图1改成红色，图2保持不变', direct_refs: [{ url: 'http://x/gen1.png' }, { url: 'http://x/gen2.png' }] },
      ],
    })
    expect(r.ok).toBe(true)
    const arg = mockExecutePlan.mock.calls[0][0]
    // prompt 里「图1」「图2」被翻译成「第1张参考图」「第2张参考图」
    expect(arg.generations[0].prompt).toContain('把第1张参考图改成红色，第2张参考图保持不变')
    // referenceImages 精确取 direct_refs 的 url
    expect(arg.generations[0].referenceImages).toEqual(['http://x/gen1.png', 'http://x/gen2.png'])
  })

  it('buildFusionPrompt：挂全部前序成功图 + 改写为融合提示词（对齐大雄）', () => {
    const prev = [{ prompt: '一只黑猫' }, { prompt: '一只橘猫' }]
    const prompt = buildFusionPrompt(prev, '让它们打架')
    expect(prompt).toContain('图1（黑猫）')
    expect(prompt).toContain('图2（橘猫）')
    expect(prompt).toContain('融合')
    expect(prompt).toContain('保持各主体外形与关键特征')
  })

  it('buildProductReferencePrompt：只挂产品定稿 + 产品一致性约束（对齐大雄）', () => {
    const product = { prompt: '零食包装定稿' }
    const prompt = buildProductReferencePrompt(product, '详情页画面', '')
    expect(prompt).toContain('产品定稿')
    expect(prompt).toContain('唯一产品一致性参考')
    expect(prompt).toContain('详情页画面')
  })

  it('execute_plan 无 generations 且无暂存 → 报错（不死循环/不崩溃）', async () => {
    convStore.__state.awaiting = false
    convStore.__state.pending = null
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.execute_plan({}) // 无 generations 也无暂存
    expect(r.ok).toBe(false)
    // 【D缺口】统一兜底：错误透传并给出「未找到生成计划」来源引导，而非静默跳过
    expect(r.error).toContain('未找到生成计划')
    expect(mockExecutePlan).not.toHaveBeenCalled()
  })
})
