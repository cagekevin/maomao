import { describe, it, expect } from 'vitest'
import { buildSpawnNodes, applySpawnSnapshot, makeChildId } from '../../src/components/base/canvas/deriveNodes.ts'

describe('buildSpawnNodes', () => {
  const parent = { id: 'p1', position: { x: 100, y: 200 } }

  it('生成子节点并自动连线（source=父,target=子，默认 id 前缀）', () => {
    const { childNodes, edges } = buildSpawnNodes(parent, [
      { type: 'imageNode', data: { label: 'a' } },
      { type: 'textNode', data: { label: 'b' } },
    ])
    expect(childNodes).toHaveLength(2)
    expect(edges).toHaveLength(2)
    expect(edges[0].source).toBe('p1')
    expect(edges[0].target).toBe(childNodes[0].id)
    expect(edges[0].id).toBe(`e-p1-${childNodes[0].id}`)
    // 子节点自动偏移（默认 x=base.x+40，y 递增）
    expect(childNodes[0].position.x).toBe(140)
    expect(childNodes[0].position.y).toBe(240)
    expect(childNodes[1].position.y).toBe(440)
  })

  it('保留显式 id 与自定义边选项（sourceHandle/targetHandle/type/animated）', () => {
    const { childNodes, edges } = buildSpawnNodes(parent, [
      { id: 'c1', type: 'imageNode', position: { x: 1, y: 2 }, data: {} },
    ], { sourceHandle: 'merged-output', targetHandle: null, type: 'default', animated: false })
    expect(childNodes[0].id).toBe('c1')
    expect(childNodes[0].position).toEqual({ x: 1, y: 2 })
    expect(edges[0].sourceHandle).toBe('merged-output')
    expect(edges[0].targetHandle).toBe(null)
    expect(edges[0].type).toBe('default')
    expect(edges[0].animated).toBe(false)
  })

  it('不传子节点位置时基于父节点偏移', () => {
    const { childNodes } = buildSpawnNodes(parent, [{ type: 'a', data: {} }])
    expect(childNodes[0].position.x).toBe(140)
    expect(childNodes[0].position.y).toBe(240)
  })
})

describe('makeChildId', () => {
  it('返回带语义前缀 + 唯一后缀的 id', () => {
    const a = makeChildId('text-split')
    const b = makeChildId('text-split')
    expect(a).toMatch(/^text-split-/)
    expect(a).not.toBe(b)
  })
})

describe('applySpawnSnapshot', () => {
  it('返回追加子节点+边后的完整快照', () => {
    const parent = { id: 'p1', position: { x: 0, y: 0 } }
    const spawned = buildSpawnNodes(parent, [{ id: 'c1', type: 'imageNode', data: {} }])
    const snap = applySpawnSnapshot(
      [{ id: 'existing', type: 'textNode', position: { x: 0, y: 0 }, data: {} }],
      [{ id: 'e0', source: 'a', target: 'b' }],
      spawned
    )
    expect(snap.nodes).toHaveLength(2)
    expect(snap.nodes[1].id).toBe('c1')
    expect(snap.edges).toHaveLength(2)
    expect(snap.edges[1].source).toBe('p1')
  })
})
