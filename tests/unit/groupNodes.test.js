import { describe, it, expect } from 'vitest'
import { createGroupFromNodes, ungroupNodes } from '../../src/components/base/groupNodes.js'

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
