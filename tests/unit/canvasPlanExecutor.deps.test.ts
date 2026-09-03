import { describe, it, expect, vi, beforeEach } from 'vitest'

// 隔离真实生图（TASK-012 依赖批调用层补全）
vi.mock('../../src/components/base/store/taskStore.ts', () => ({
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://r/ok.png' })),
  isNodeRegistered: vi.fn(() => true),
}))

import { executePlan } from '../../src/components/agent/canvas/canvasPlanExecutor.ts'
import type { CanvasHostCtx } from '../../src/components/agent/canvas/canvasHost.ts'
import type { Node, Edge } from '@xyflow/react'
import { runNodeGeneration } from '../../src/components/base/store/taskStore.ts'

// 本地对齐 canvasPlanExecutor.GenerationStep 的形状（未导出），仅用于测试构造入参
type GenStep = {
  id?: string
  title?: string
  prompt?: string
  index?: number
  ratio?: string
  resolution?: string
  quality?: string
  depends_on_previous?: boolean
  use_previous_results?: boolean
  use_attachments?: boolean
  depends_on_steps?: string[]
  dependency_mode?: string
  referenceImages?: unknown[]
  input_artifact_ids?: string[]
}

type MockCtx = CanvasHostCtx & { nodes: () => Node[]; edges: () => Edge[] }
function makeCtx(): MockCtx {
  let nodes = []
  let edges = []
    return {
      nodes: () => nodes,
      edges: () => edges,
      getNodes: () => nodes,
      addNodes: (ns) => { nodes = [...nodes, ...ns] },
      addEdges: (es) => { edges = [...edges, ...es] },
      setNodes: (fn) => { nodes = typeof fn === 'function' ? fn(nodes) : fn },
      setEdges: (fn) => { edges = typeof fn === 'function' ? fn(edges) : fn },
    } as unknown as MockCtx
  }

beforeEach(() => { vi.clearAllMocks() })

describe('TASK-012 依赖批改写调用层补全', () => {
  it('缺口 1：product_reference 步强制 use_attachments=false，data.images 不写用户参考图', async () => {
    const ctx = makeCtx()
    await executePlan({
      ctx,
      // 独立批：产品定稿；依赖批：主图（product_reference）
      generations: [
        { id: 'product', prompt: '产品定稿' },
        { id: 'page1', prompt: '主图', dependency_mode: 'product_reference', depends_on_previous: true, attachment_indices: [0] },
      ] as GenStep[],
      referenceImages: ['http://user/ref.png'], // 用户上传参考图
    })
    // 独立批产品定稿先建（nodes[0]），依赖批主图（nodes[1]）的 data.images 应为空（不写用户参考图）
    const mainNode = ctx.nodes()[1]
    expect(mainNode.data.images).toBeUndefined()
    // 产品定稿节点被连线到主图（靠连线挂产品定稿）
    expect(ctx.edges()).toHaveLength(1)
  })

  it('缺口 2：userText 含"详情页套图"且依赖步未标 dependency_mode → 强制 product_reference', async () => {
    const ctx = makeCtx()
    await executePlan({
      ctx,
      userText: '生成一套电商详情页套图，产品保持一致性',
      generations: [
        { id: 'product', prompt: '产品定稿' },
        { id: 'page1', prompt: '详情页1', depends_on_previous: true }, // 未标 dependency_mode
      ],
    })
    const mainNode = ctx.nodes()[1]
    // 被改写为 product_reference：prompt 含产品一致性约束特征
    expect(mainNode.data.prompt).toContain('严格参考图1')
    // use_attachments 生效：data.images 为空
    expect(mainNode.data.images).toBeUndefined()
  })

  it('缺口 2：userText 含「5主图+8详情页」数量表达 → 强制 product_reference（最常见电商套图表达）', async () => {
    const ctx = makeCtx()
    await executePlan({
      ctx,
      userText: '生成5主图+8详情页套图',
      generations: [
        { id: 'product', prompt: '产品定稿' },
        { id: 'page1', prompt: '详情页1', depends_on_previous: true }, // 未标 dependency_mode
      ],
    })
    const mainNode = ctx.nodes()[1]
    // 被改写为 product_reference：prompt 含产品一致性约束特征
    expect(mainNode.data.prompt).toContain('严格参考图1')
    expect(mainNode.data.images).toBeUndefined()
  })

  it('缺口 3：userText 含"融合"但无 fusion 步 → 自动追加融合步', async () => {
    const ctx = makeCtx()
    await executePlan({
      ctx,
      userText: '把这两张猫和狗融合在一起',
      generations: [
        { id: 'a', prompt: '一只黑猫' },
        { id: 'b', prompt: '一只白狗' },
      ],
    })
    // 自动追加一个融合依赖步 → 共 3 个节点（2 独立 + 1 融合）
    expect(ctx.nodes()).toHaveLength(3)
    const fusionNode = ctx.nodes()[2]
    expect(fusionNode.data.prompt).toContain('融合')
    // 融合步连线到两个独立节点
    expect(ctx.edges().filter((e) => e.target === fusionNode.id)).toHaveLength(2)
  })

  it('缺口 3 回归：已有显式 fusion 步时不再重复追加', async () => {
    const ctx = makeCtx()
    await executePlan({
      ctx,
      userText: '把猫狗融合在一起',
      generations: [
        { id: 'a', prompt: '一只黑猫' },
        { id: 'b', prompt: '融合', dependency_mode: 'fusion', depends_on_previous: true },
      ],
    })
    // 已有 fusion 依赖步，不追加 → 共 2 个节点
    expect(ctx.nodes()).toHaveLength(2)
  })

  it('回归：显式 fusion 分支行为不变（prompt 被 buildFusionPrompt 改写）', async () => {
    const ctx = makeCtx()
    await executePlan({
      ctx,
      userText: '',
      generations: [
        { id: 'a', prompt: '一只黑猫' },
        { id: 'b', prompt: '融合', dependency_mode: 'fusion', depends_on_previous: true },
      ],
    })
    const fusionNode = ctx.nodes()[1]
    expect(fusionNode.data.prompt).toContain('融合')
    expect(fusionNode.data.prompt).toContain('参考')
  })
})
