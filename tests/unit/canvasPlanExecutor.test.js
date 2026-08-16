import { describe, it, expect, vi, beforeEach } from 'vitest'

// 隔离 taskStore（真实生成需后端），用 fake 立即成功
vi.mock('../../src/components/base/taskStore.js', () => ({
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://result/x.png' })),
  isNodeRegistered: vi.fn(() => true),
}))

import { executePlan } from '../../src/components/base/canvasPlanExecutor.js'

function makeCtx(initialNodes = []) {
  let nodes = [...initialNodes]
  let edges = []
  return {
    getNodes: () => nodes,
    addNodes: (ns) => { nodes = [...nodes, ...ns] },
    addEdges: (es) => { edges = [...edges, ...es] },
    setNodes: (fn) => { nodes = typeof fn === 'function' ? fn(nodes) : fn },
    _getEdges: () => edges,
    _getNodes: () => nodes,
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('canvasPlanExecutor.executePlan §2.15', () => {
  it('空计划 → {status:"failed",error:"计划为空"}', async () => {
    const r = await executePlan({ ctx: makeCtx(), generations: [], autoRun: true })
    expect(r.workflow.status).toBe('failed')
    expect(r.workflow.error).toBe('计划为空')
    expect(r.entries).toEqual([])
  })

  it('独立批并行建节点 + 触发生成 + 写回 resultUrl', async () => {
    const ctx = makeCtx()
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'g1', prompt: '猫', ratio: 'square', resolution: '1k' },
        { id: 'g2', prompt: '狗', ratio: 'story' },
      ],
      autoRun: true,
    })
    expect(r.entries).toHaveLength(2)
    expect(r.entries.every((e) => e.status === 'completed')).toBe(true)
    // 节点已建（promptNode × 2）
    const nodes = ctx._getNodes()
    expect(nodes.filter((n) => n.type === 'promptNode')).toHaveLength(2)
    // ratio 归一：square→1:1, story→9:16；resolution 1k→1K
    const byData = nodes.find((n) => n.data.prompt === '猫')
    expect(byData.data.aspectRatio).toBe('1:1')
    expect(byData.data.imageSize).toBe('1K')
    const dog = nodes.find((n) => n.data.prompt === '狗')
    expect(dog.data.aspectRatio).toBe('9:16')
  })

  it('依赖批在独立批全部成功时建「前序→本步」连线（下游自动读参考图）', async () => {
    const ctx = makeCtx()
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'g1', prompt: '底图', ratio: 'landscape' },
        { id: 'g2', prompt: '变体', depends_on_previous: true },
      ],
      autoRun: true,
    })
    expect(r.entries).toHaveLength(2)
    const edges = ctx._getEdges()
    // g1 成功 → g2 应有一条来自 g1 节点的边
    expect(edges.length).toBe(1)
    const g1Node = ctx._getNodes().find((n) => n.data.prompt === '底图')
    expect(edges[0].source).toBe(g1Node.id)
  })

  it('独立批有失败 → 依赖批跳过（不建边、状态 failed）', async () => {
    const { runNodeGeneration } = await import('../../src/components/base/taskStore.js')
    runNodeGeneration.mockImplementation(async (id) => ({ ok: false, error: '生成失败' }))
    const ctx = makeCtx()
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'g1', prompt: '底图' },
        { id: 'g2', prompt: '变体', depends_on_previous: true },
      ],
      autoRun: true,
    })
    expect(r.entries[0].status).toBe('failed')
    expect(r.entries[1].status).toBe('failed')
    expect(r.entries[1].error).toContain('前置步骤未全部成功')
    expect(ctx._getEdges().length).toBe(0)
  })

  it('autoRun=false 只建节点不触发生成（ready 态）', async () => {
    const ctx = makeCtx()
    const r = await executePlan({
      ctx,
      generations: [{ id: 'g1', prompt: '草图' }],
      autoRun: false,
    })
    expect(r.workflow.status).toBe('ready')
    expect(r.entries[0].status).toBe('ready')
    expect(ctx._getNodes().filter((n) => n.type === 'promptNode')).toHaveLength(1)
  })

  it('锚点就近排布：每 3 个换一行（列×480 / 行×520）', async () => {
    const ctx = makeCtx()
    await executePlan({
      ctx,
      generations: [{ id: 'a', prompt: '1' }, { id: 'b', prompt: '2' }, { id: 'c', prompt: '3' }, { id: 'd', prompt: '4' }],
      autoRun: false,
    })
    const nodes = ctx._getNodes().filter((n) => n.type === 'promptNode')
    // 第1个在第0列，第4个应换到第0列下一行（row=1）
    expect(nodes[0].position.x).toBe(120) // base.x = maxX(0)+120
    expect(nodes[3].position.y).toBe(40 + 520) // 第二行
  })

  it('参考图写入节点 data.images（图生图）', async () => {
    const ctx = makeCtx()
    await executePlan({
      ctx,
      generations: [{ id: 'g1', prompt: '猫', ratio: '1:1' }],
      autoRun: false,
      referenceImages: ['/files/ref.png'],
    })
    const node = ctx._getNodes().find((n) => n.data.prompt === '猫')
    expect(node.data.images[0]).toMatchObject({ url: '/files/ref.png', name: 'reference' })
  })
})
