import { describe, it, expect, vi, beforeEach } from 'vitest'

// 多步编排执行器：隔离 runNodeGeneration（真实生图 → 落盘 resultUrl）与 isNodeRegistered
vi.mock('../../src/components/base/taskStore.js', () => ({
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://r/ok.png' })),
  isNodeRegistered: vi.fn(() => true),
}))

import { executePlan } from '../../src/components/base/canvasPlanExecutor.js'
import { runNodeGeneration } from '../../src/components/base/taskStore.js'

// 最小 ctx：addNodes 记录、addEdges 记录、setNodes 写回 imageUrl、getNodes 反映最新
function makeCtx(initialNodes = []) {
  let nodes = [...initialNodes]
  let edges = []
  return {
    nodes: () => nodes,
    edges: () => edges,
    getNodes: () => nodes,
    addNodes: (ns) => { nodes = [...nodes, ...ns] },
    addEdges: (es) => { edges = [...edges, ...es] },
    setNodes: (fn) => { nodes = typeof fn === 'function' ? fn(nodes) : fn },
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('多步编排执行器 executePlan §2.5/2.6', () => {
  it('空计划 → workflow 失败 + 空 entries', async () => {
    const ctx = makeCtx()
    const r = await executePlan({ ctx, generations: [] })
    expect(r.workflow.status).toBe('failed')
    expect(r.entries).toEqual([])
    expect(runNodeGeneration).not.toHaveBeenCalled()
  })

  it('无 prompt/title 的步骤被过滤', async () => {
    const ctx = makeCtx()
    const r = await executePlan({ ctx, generations: [{ id: 'x' }, { id: 'y', prompt: '猫' }] })
    expect(r.entries).toHaveLength(1)
  })

  it('独立批（Wave1）：并行建节点 + 触发 + 写回 imageUrl，status=completed', async () => {
    const ctx = makeCtx()
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'g1', prompt: '猫', ratio: 'square' },
        { id: 'g2', prompt: '狗', ratio: 'story' },
      ],
    })
    expect(ctx.nodes()).toHaveLength(2)
    expect(ctx.nodes().every((n) => n.type === 'promptNode')).toBe(true)
    // 比例归一：square→1:1，story→9:16
    expect(ctx.nodes()[0].data.aspectRatio).toBe('1:1')
    expect(ctx.nodes()[1].data.aspectRatio).toBe('9:16')
    // 每个节点生成结果已写回 imageUrl
    expect(ctx.nodes().every((n) => n.data.imageUrl === 'http://r/ok.png')).toBe(true)
    expect(r.entries).toHaveLength(2)
    expect(r.entries.every((e) => e.status === 'completed' && e.resultUrl === 'http://r/ok.png')).toBe(true)
    expect(r.workflow.status).toBe('completed')
    expect(runNodeGeneration).toHaveBeenCalledTimes(2)
  })

  it('依赖批（Wave2）：前置全部成功时与前序节点连线，并触发', async () => {
    const ctx = makeCtx()
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'g1', prompt: '主图', depends_on_previous: true }, // 依赖批（此处无独立批，应被跳过）
      ],
    })
    // 无独立批成功 → 依赖批无前序，跳过
    expect(r.entries[0].status).toBe('failed')
    expect(r.entries[0].error).toContain('无前序成功结果')

    // 独立批成功 + 依赖批成功
    vi.clearAllMocks()
    const ctx2 = makeCtx()
    const r2 = await executePlan({
      ctx: ctx2,
      generations: [
        { id: 'base', prompt: '底图' },
        { id: 'dep', prompt: '变体', depends_on_previous: true },
      ],
    })
    expect(r2.entries[0].status).toBe('completed')
    expect(r2.entries[1].status).toBe('completed')
    // 建了 1 条连线：base → dep
    expect(ctx2.edges()).toHaveLength(1)
    expect(ctx2.edges()[0].source).toBe(r2.entries[0].nodeId)
    expect(ctx2.edges()[0].target).toBe(r2.entries[1].nodeId)
  })

  it('依赖批：前置任一步失败 → 整批跳过（不生成）', async () => {
    const ctx = makeCtx()
    // 强制第一个节点生成失败
    runNodeGeneration.mockImplementationOnce(async () => ({ ok: false, error: '生成失败' }))
    const r = await executePlan({
      ctx,
      generations: [
        { id: 'base', prompt: '底图' },
        { id: 'dep', prompt: '变体', depends_on_previous: true },
      ],
    })
    expect(r.entries[0].status).toBe('failed')
    expect(r.entries[1].status).toBe('failed')
    expect(r.entries[1].error).toContain('前置步骤未全部成功')
    // 没为 dep 建连线
    expect(ctx.edges()).toHaveLength(0)
  })

  it('autoRun=false：只建节点不触发，status=ready', async () => {
    const ctx = makeCtx()
    const r = await executePlan({
      ctx,
      autoRun: false,
      generations: [{ id: 'g1', prompt: '猫' }],
    })
    expect(ctx.nodes()).toHaveLength(1)
    expect(ctx.nodes()[0].data.imageUrl).toBeUndefined()
    expect(r.entries[0].status).toBe('ready')
    expect(r.workflow.status).toBe('ready')
    expect(runNodeGeneration).not.toHaveBeenCalled()
  })

  it('参考图：写进每个生图节点 data.images', async () => {
    const ctx = makeCtx()
    const r = await executePlan({
      ctx,
      generations: [{ id: 'g1', prompt: '猫' }],
      referenceImages: ['http://r/ref.png'],
    })
    const imgs = ctx.nodes()[0].data.images
    expect(imgs).toHaveLength(1)
    expect(imgs[0].url).toBe('http://r/ref.png')
  })

  it('模型/比例/分辨率：每步显式 > 面板 defaults > 内置默认', async () => {
    const ctx = makeCtx()
    const r = await executePlan({
      ctx,
      model: 'gpt-image-2',
      defaults: { model: 'default-model', ratio: 'landscape', resolution: '2K' },
      generations: [
        { id: 'explicit', prompt: '猫', ratio: 'portrait', resolution: '4K' }, // 显式优先
        { id: 'inherit', prompt: '狗' }, // 继承 defaults
      ],
    })
    const byId = Object.fromEntries(r.entries.map((e) => [e.id, ctx.nodes().find((n) => n.id === e.nodeId)]))
    expect(byId.explicit.data.aspectRatio).toBe('3:4') // portrait→3:4
    expect(byId.explicit.data.imageSize).toBe('4K')
    expect(byId.explicit.data.selectedModel).toBe('gpt-image-2')
    expect(byId.inherit.data.aspectRatio).toBe('16:9') // landscape→16:9
    expect(byId.inherit.data.imageSize).toBe('2K')
  })
})
