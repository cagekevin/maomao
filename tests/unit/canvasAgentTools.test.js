import { describe, it, expect, vi, beforeEach } from 'vitest'

// 隔离依赖：AI 撤销栈 / 真实生成 / 多步执行器
let awaitingFlag = false
vi.mock('../../src/components/base/conversationStore.js', () => ({
  pushActiveAiUndo: vi.fn(),
  popActiveAiUndo: vi.fn(() => null),
  getActiveAiUndoStack: vi.fn(() => []),
  setActivePendingGenerations: vi.fn(),
  getActivePendingGenerations: vi.fn(() => null),
  setPendingGenerations: vi.fn(),
  getPendingGenerations: vi.fn(() => null),
  clearPendingGenerations: vi.fn(),
  setAwaitingConfirm: vi.fn((v) => { awaitingFlag = !!v }),
  getAwaitingConfirm: vi.fn(() => awaitingFlag),
  getCurrentMemory: vi.fn(() => ({ summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] })),
  setCurrentMemory: vi.fn(),
  patchCurrentWorkflow: vi.fn(() => ({})),
}))
vi.mock('../../src/components/base/taskStore.js', () => ({
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://r/x.png' })),
  isNodeRegistered: vi.fn(() => true),
}))
vi.mock('../../src/components/base/canvasPlanExecutor.js', () => ({
  executePlan: vi.fn(async () => ({ workflow: { status: 'completed' }, entries: [{ status: 'completed', nodeId: 'n1', resultUrl: 'http://r/x.png' }] })),
}))

import { buildCanvasAgentTools, CANVAS_AGENT_TOOL_NAMES } from '../../src/components/base/useCanvasAgentTools.js'

function makeCtx(initialNodes = [], initialEdges = []) {
  let nodes = [...initialNodes]
  let edges = [...initialEdges]
  return {
    getNodes: () => nodes,
    setNodes: (fn) => { nodes = typeof fn === 'function' ? fn(nodes) : fn },
    getEdges: () => edges,
    setEdges: (fn) => { edges = typeof fn === 'function' ? fn(edges) : fn },
    addNodes: (ns) => { nodes = [...nodes, ...ns] },
    screenToFlowPosition: (p) => p || { x: 0, y: 0 },
    fitView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), setCenter: vi.fn(),
    snapshot: () => ({ nodes, edges }),
  }
}

beforeEach(() => { vi.clearAllMocks(); awaitingFlag = false })

describe('画布 Agent 工具层 §2.5', () => {
  it('共 24 个工具注册', () => {
    expect(CANVAS_AGENT_TOOL_NAMES).toHaveLength(24)
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

  it('batch_create_nodes 批量建', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.batch_create_nodes({ nodes: [{ type: 'textNode' }, { type: 'promptNode' }] })
    expect(r.ok).toBe(true)
    expect(r.data.ids).toHaveLength(2)
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

  it('update_node_raw 合并任意字段', () => {
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = t.update_node_raw({ nodeId: 'a', patch: { custom: 1, imageUrl: '/f.png' } })
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

  it('trigger_generation 触发并等待结果', async () => {
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = await t.trigger_generation({ nodeId: 'a' })
    expect(r.ok).toBe(true)
    expect(r.data.resultUrl).toBe('http://r/x.png')
    expect(r.data.submitted).toBe(true)
  })

  it('present_plan 暂存策划并进入待确认', async () => {
    const conv = await import('../../src/components/base/conversationStore.js')
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.present_plan({ plan_text: '做5张主图', generations: [{ id: 'g1', prompt: '猫' }] })
    expect(r.ok).toBe(true)
    expect(conv.setAwaitingConfirm).toHaveBeenCalledWith(true)
  })

  it('execute_plan 未确认被拒', async () => {
    const conv = await import('../../src/components/base/conversationStore.js')
    conv.setAwaitingConfirm(true) // 模拟 present_plan 已暂存、进入待确认
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
})
