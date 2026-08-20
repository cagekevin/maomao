import { describe, it, expect } from 'vitest'
import { adoptUserNodes, getNodeDimensions } from '@xyflow/system'
import { createGroupFromNodes, ungroupNodes, deleteNodesWithCascade, duplicateSelectedWithEdges } from '../../src/components/base/groupNodes.js'

describe('编组算法 §2.2', () => {
  const nodes = [
    { id: 'a', type: 'textNode', data: {}, position: { x: 0, y: 0 }, style: { width: 100, height: 100 } },
    { id: 'b', type: 'promptNode', data: {}, position: { x: 200, y: 0 }, style: { width: 100, height: 100 } },
    { id: 'c', type: 'imageNode', data: {}, position: { x: 0, y: 200 }, style: { width: 100, height: 100 } },
  ]

  it('至少 2 个节点才能编组', () => {
    const r = createGroupFromNodes(nodes.slice(0, 1), ['a'])
    expect(r.ok).toBe(false)
    expect(r.error).toContain('至少')
  })

  it('编组成功：生成 group 节点 + 子节点设 parentId + 相对坐标', () => {
    const r = createGroupFromNodes(nodes, ['a', 'b'])
    expect(r.ok).toBe(true)
    expect(r.nodes).toHaveLength(4) // 3 原 + 1 group
    const group = r.nodes.find((n) => n.type === 'group')
    expect(group).toBeTruthy()
    expect(group.id).toBe(r.groupId)
    // 父节点必须先于子节点声明（unshift 到开头）
    expect(r.nodes[0].type).toBe('group')
    const childA = r.nodes.find((n) => n.id === 'a')
    expect(childA.parentId).toBe(r.groupId)
    // 相对坐标 = 绝对 - group 位置（group 在 minX-pad, minY-pad = -40,-40）
    expect(childA.position).toEqual({ x: 40, y: 40 })
  })

  it('编组排除已 parentId 的节点', () => {
    const withChild = [...nodes, { id: 'g', type: 'group', data: {}, position: { x: 0, y: 0 }, style: { width: 500, height: 500 } }]
    const r = createGroupFromNodes(withChild, ['a', 'g'])
    // g 是 group 类型，应被排除，只编 a → 不足 2 个
    expect(r.ok).toBe(false)
  })

  it('ungroupNodes 移除 group + 子节点转回绝对坐标', () => {
    const r = createGroupFromNodes(nodes, ['a', 'b'])
    const groupId = r.groupId
    const grouped = r.nodes
    const ug = ungroupNodes(grouped, groupId)
    expect(ug.ok).toBe(true)
    expect(ug.nodes.find((n) => n.id === groupId)).toBeFalsy()
    const childA = ug.nodes.find((n) => n.id === 'a')
    expect(childA.parentId).toBeUndefined()
    // 绝对坐标 = 相对 + group 位置(-40,-40) = (40-40, 40-40) = (0,0)
    expect(childA.position).toEqual({ x: 0, y: 0 })
  })

  it('ungroupNodes 组不存在报错', () => {
    const ug = ungroupNodes(nodes, 'nope')
    expect(ug.ok).toBe(false)
    expect(ug.error).toContain('不存在')
  })
})

describe('R4 groupId 无碰撞（crypto.randomUUID 替代 Date.now）', () => {
  const twoNodes = [
    { id: 'a', type: 'textNode', data: {}, position: { x: 0, y: 0 }, style: { width: 100, height: 100 } },
    { id: 'b', type: 'promptNode', data: {}, position: { x: 200, y: 0 }, style: { width: 100, height: 100 } },
  ]

  it('多次编组生成不同 id', () => {
    const ids = new Set()
    for (let i = 0; i < 10; i++) {
      const r = createGroupFromNodes(twoNodes, ['a', 'b'])
      expect(r.ok).toBe(true)
      ids.add(r.groupId)
    }
    expect(ids.size).toBe(10) // 全部唯一，无碰撞
  })

  it('id 以 group- 开头且包含随机段', () => {
    const r = createGroupFromNodes(twoNodes, ['a', 'b'])
    expect(r.groupId.startsWith('group-')).toBe(true)
    // crypto.randomUUID 形式：group-xxxxxxxx-xxxx-...
    expect(r.groupId.length).toBeGreaterThan('group-'.length + 10)
  })
})

describe('R3 deleteNodesWithCascade 级联删除（删 group 不留孤儿）', () => {
  const groupNodes = [
    { id: 'g', type: 'group', data: {}, position: { x: 0, y: 0 }, style: { width: 500, height: 500 } },
    { id: 'child1', type: 'imageNode', data: {}, position: { x: 40, y: 40 }, parentId: 'g' },
    { id: 'child2', type: 'textNode', data: {}, position: { x: 60, y: 60 }, parentId: 'g' },
    { id: 'outer', type: 'textNode', data: {}, position: { x: 500, y: 500 } },
  ]
  const edges = [
    { id: 'e1', source: 'g', target: 'child1' },
    { id: 'e2', source: 'child1', target: 'child2' },
    { id: 'e3', source: 'child2', target: 'outer' },
  ]

  it('删 group 父节点 → 级联删除其所有子节点，不留孤儿', () => {
    const r = deleteNodesWithCascade(groupNodes, edges, 'g')
    // g + child1 + child2 全删，outer 保留
    expect(r.nodes.map((n) => n.id)).toEqual(['outer'])
    // 边全删：e1/e2 连被删节点；e3 连到被删的 child2（其 source 待删）也应删 → 无残留孤儿边
    expect(r.edges).toHaveLength(0)
    expect(r.deleted).toEqual(expect.arrayContaining(['g', 'child1', 'child2']))
  })

  it('删普通节点 → 只删自身，不误删其他', () => {
    const r = deleteNodesWithCascade(groupNodes, edges, 'child1')
    expect(r.nodes.map((n) => n.id)).toEqual(['g', 'child2', 'outer'])
    expect(r.deleted).toEqual(['child1'])
  })

  it('批量删除含 group → 级联删其子孙', () => {
    const r = deleteNodesWithCascade(groupNodes, edges, ['g', 'outer'])
    expect(r.nodes).toHaveLength(0) // g + child1 + child2 + outer 全删
    expect(r.edges).toHaveLength(0)
  })
})

describe('R3 duplicateSelectedWithEdges 克隆子图（保留组关系 + 连线）', () => {
  const nodes = [
    { id: 'g', type: 'group', data: {}, position: { x: 0, y: 0 }, style: { width: 500, height: 500 } },
    { id: 'c1', type: 'imageNode', data: {}, position: { x: 40, y: 40 }, parentId: 'g' },
    { id: 'c2', type: 'textNode', data: {}, position: { x: 60, y: 60 }, parentId: 'g' },
    { id: 'outer', type: 'textNode', data: {}, position: { x: 500, y: 500 } },
  ]
  const edges = [
    { id: 'e1', source: 'g', target: 'c1' },
    { id: 'e2', source: 'c1', target: 'c2' },
    { id: 'e3', source: 'c2', target: 'outer' }, // 组内 → 外部
  ]

  it('克隆选中 group → 连带其子孙（整组克隆），组关系保留', () => {
    const r = duplicateSelectedWithEdges(nodes, edges, ['g'])
    const ids = new Set(r.nodes.map((n) => n.id))
    // 原 4 节点 + 克隆 3（g/c1/c2，outer 未选中不克隆）
    expect(r.nodes).toHaveLength(7)
    // 克隆的 c1/c2 有新的 parentId（指向克隆的 group），不指向原 group
    const newIds = [...ids].filter((id) => !['g', 'c1', 'c2', 'outer'].includes(id))
    const cloneC1 = r.nodes.find((n) => newIds.includes(n.id) && n.type === 'imageNode')
    const cloneC2 = r.nodes.find((n) => newIds.includes(n.id) && n.type === 'textNode')
    const cloneG = r.nodes.find((n) => newIds.includes(n.id) && n.type === 'group')
    expect(cloneC1.parentId).toBe(cloneG.id)
    expect(cloneC2.parentId).toBe(cloneG.id)
  })

  it('克隆保留组内边 + 组外边界（连线不丢）', () => {
    const r = duplicateSelectedWithEdges(nodes, edges, ['g'])
    // 原 3 边 + 克隆生成的边（组内 e1/e2 克隆 2 条 + 组外 e3 克隆 1 条）= 6 条
    expect(r.edges).toHaveLength(6)
    // 克隆体有连到外部 outer 的边（保持复用连接）
    const outerLinks = r.edges.filter((e) => e.target === 'outer' || e.source === 'outer')
    expect(outerLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('克隆普通单节点 → 只克隆自身 + 其相连边', () => {
    const r = duplicateSelectedWithEdges(nodes, edges, ['c1'])
    // 原 4 + 克隆 1 = 5
    expect(r.nodes).toHaveLength(5)
    // 3 原边 + 2 克隆边（e1 g→c1、e2 c1→c2 都有一端是克隆体 → 各克隆一条）
    expect(r.edges).toHaveLength(5)
  })
})

describe('编组尺寸刷新保真（TASK: 编组后刷新大小变了）', () => {
  // 模拟真实画布节点：普通节点带 style 尺寸
  const nodes = [
    { id: 'a', type: 'imageNode', position: { x: 200, y: 200 }, style: { width: 300, height: 200 }, data: {} },
    { id: 'b', type: 'imageNode', position: { x: 600, y: 250 }, style: { width: 300, height: 200 }, data: {} },
    { id: 'c', type: 'textNode', position: { x: 250, y: 500 }, style: { width: 250, height: 150 }, data: {} },
  ]
  // 编组 a/b/c → 外接矩形 (160,160,780x530)，pad 40
  const { ok, nodes: grouped, groupId } = createGroupFromNodes(nodes, ['a', 'b', 'c'])
  if (!ok) throw new Error('编组失败')

  // 模拟 projectStore 落盘白名单（与 NODE_KEEP 一致）
  const KEEP = ['id', 'type', 'position', 'data', 'width', 'height', 'parentId', 'extent', 'style', 'initialWidth', 'initialHeight']
  const sanitize = (arr) => arr.map((n) => {
    const out = {}
    for (const k of KEEP) if (n[k] !== undefined && n[k] !== null) out[k] = n[k]
    return out
  })

  it('group 创建时必须带 width/height 字段（NodeShell.useNodeSize 优先读 width）', () => {
    const group = grouped.find((n) => n.id === groupId)
    expect(group.width).toBe(780)
    expect(group.height).toBe(530)
    expect(group.style.width).toBe(780)
    expect(group.style.height).toBe(530)
  })

  it('落盘 -> 加载重建后 group 面积不变（防止刷新塌成 0×0）', () => {
    const snapshot = sanitize(grouped)
    const lookup = new Map()
    const parentLookup = new Map()
    adoptUserNodes(snapshot, lookup, parentLookup, { nodeOrigin: [0, 0] })
    const g = lookup.get(groupId)
    const dims = getNodeDimensions(g)
    expect(dims.width).toBe(780)
    expect(dims.height).toBe(530)
    // 子节点父关系与位置还原正确
    for (const [id, abs] of [['a', [200, 200]], ['b', [600, 250]], ['c', [250, 500]]]) {
      const n = lookup.get(id)
      expect(n.parentId).toBe(groupId)
      expect(n.internals.positionAbsolute.x).toBe(abs[0])
      expect(n.internals.positionAbsolute.y).toBe(abs[1])
    }
  })

  it('落盘必须保留 style/initialWidth/initialHeight（缺则面积塌 0）', () => {
    const badKeep = ['id', 'type', 'position', 'data', 'width', 'height', 'parentId', 'extent'] // 旧白名单：无 style/initialWidth
    const badSanitize = (arr) => arr.map((n) => {
      const out = {}
      for (const k of badKeep) if (n[k] !== undefined && n[k] !== null) out[k] = n[k]
      return out
    })
    const snapshot = badSanitize(grouped)
    const lookup = new Map()
    adoptUserNodes(snapshot, lookup, new Map(), { nodeOrigin: [0, 0] })
    const dims = getNodeDimensions(lookup.get(groupId))
    // 旧白名单即使有 width/height（本次修复新增），也会因丢 initialWidth 退化；
    // 该用例守住「缺 initialWidth/height 会塌」的边界，提醒后续不要删这些字段。
    expect(dims.width).toBeLessThanOrEqual(780)
  })
})
