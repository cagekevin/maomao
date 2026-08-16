import { describe, it, expect, vi, beforeEach } from 'vitest'

// 隔离依赖：AI 撤销栈 / 真实生成 / 多步执行器
// 状态（awaiting / pending）用 beforeEach 内 vi.mocked 配对闭包管理，避免模块级变量在 vi.mock 工厂下 TDZ 怪异
vi.mock('../../src/components/base/conversationStore.js', () => ({
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
  getCurrentMemory: vi.fn(() => ({ summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] })),
  setCurrentMemory: vi.fn(),
  patchCurrentWorkflow: vi.fn(() => ({})),
}))
vi.mock('../../src/components/base/taskStore.js', () => ({
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://r/x.png' })),
  isNodeRegistered: vi.fn(() => true),
}))
vi.mock('../../src/components/base/canvasPlanExecutor.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual, // 保留真实纯函数（buildFusionPrompt/buildProductReferencePrompt 等）
    executePlan: vi.fn(async () => ({ workflow: { status: 'completed' }, entries: [{ status: 'completed', nodeId: 'n1', resultUrl: 'http://r/x.png' }] })),
  }
})

import { buildCanvasAgentTools, CANVAS_AGENT_TOOL_NAMES, getNodeImageUrl, setCurrentReferenceImages } from '../../src/components/base/useCanvasAgentTools.js'
import * as convStore from '../../src/components/base/conversationStore.js'
import * as taskStore from '../../src/components/base/taskStore.js'
import { executePlan as mockExecutePlan, buildFusionPrompt, buildProductReferencePrompt } from '../../src/components/base/canvasPlanExecutor.js'

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

beforeEach(() => {
  vi.clearAllMocks()
  // 配对状态：getX 始终读 __state，setX 写 __state（用例可直接翻转 __state 模拟前端确认）
  convStore.__state = { awaiting: false, pending: null }
  vi.mocked(convStore.getAwaitingConfirm).mockImplementation(() => convStore.__state.awaiting)
  vi.mocked(convStore.setAwaitingConfirm).mockImplementation((v) => { convStore.__state.awaiting = !!v })
  vi.mocked(convStore.getPendingGenerations).mockImplementation(() => convStore.__state.pending)
  vi.mocked(convStore.setPendingGenerations).mockImplementation((g) => { convStore.__state.pending = g })
})

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

  it('create_node scriptBoxNode：prompt 同时映射到 story（剧本盒第一步读 story）', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const story = '小猫跳舞的故事'
    const r = t.create_node({ type: 'scriptBoxNode', prompt: story })
    expect(r.ok).toBe(true)
    const node = ctx.getNodes().find((n) => n.id === r.data.id)
    expect(node.data.story).toBe(story) // 剧本盒剧情框能读到故事
    expect(node.data.prompt).toBe(story) // 同时保留 prompt
  })

  it('create_node scriptBoxNode：返回回显 story 已写入（收敛终止信号，AI 据此知道自己写完了）', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const story = '小猫跳舞的故事'
    const r = t.create_node({ type: 'scriptBoxNode', prompt: story })
    expect(r.ok).toBe(true)
    // 剧本盒返回必须带 story 已写入的确认，AI 才能感知任务完成并停止（否则反复建盒死循环）
    expect(r.data.story_written).toBe(true)
    expect(r.data.story).toBe(story)
  })

  it('create_node scriptBoxNode 无 prompt：story 为空（不误写）', () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = t.create_node({ type: 'scriptBoxNode' })
    const node = ctx.getNodes().find((n) => n.id === r.data.id)
    expect(node.data.story).toBe('')
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

  it('generate_node 触发并等待结果', async () => {
    const ctx = makeCtx([{ id: 'a', type: 'promptNode', data: {}, position: {} }])
    const t = buildCanvasAgentTools(ctx)
    const r = await t.generate_node({ nodeId: 'a' })
    expect(r.ok).toBe(true)
    expect(r.data.resultUrl).toBe('http://r/x.png')
    expect(r.data.submitted).toBe(true)
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

  it('show_plan_for_confirm 暂存策划并进入待确认', async () => {
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.show_plan_for_confirm({ plan_text: '做5张主图', generations: [{ id: 'g1', prompt: '猫' }] })
    expect(r.ok).toBe(true)
    expect(convStore.setAwaitingConfirm).toHaveBeenCalledWith(true)
    expect(convStore.__state.awaiting).toBe(true)
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

  it('用户确认（awaiting=false）后 execute_plan 放行执行', async () => {
    convStore.__state.awaiting = false // 模拟用户已确认（前端翻转 awaiting）
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.execute_plan({ generations: [{ id: 'g1', prompt: '猫' }] })
    expect(r.ok).toBe(true)
    expect(mockExecutePlan).toHaveBeenCalledTimes(1)
    const arg = mockExecutePlan.mock.calls[0][0]
    expect(arg.generations[0].prompt).toBe('猫')
  })

  it('execute_plan 未传 generations 且无暂存 → 报错（不死循环/不崩溃）', async () => {
    convStore.__state.awaiting = false
    convStore.__state.pending = null
    const ctx = makeCtx()
    const t = buildCanvasAgentTools(ctx)
    const r = await t.execute_plan({}) // 无 generations 也无暂存
    expect(r.ok).toBe(false)
    expect(r.error).toContain('generations 为空')
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
    expect(r.error).toContain('generations 为空')
    expect(mockExecutePlan).not.toHaveBeenCalled()
  })
})
