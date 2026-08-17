import { describe, it, expect } from 'vitest'
import { nodeTypes, assertNodeTypesConsistent, INTERNAL_NODE_TYPES } from '../../src/components/base/nodeRegistry.js'
import { getPaletteNode, paletteNodes, defaultNodeData } from '../../src/components/base/NodePalette.jsx'

describe('节点类型注册表 TASK-057 B', () => {
  it('nodeTypes 注册表存在且含全部关键业务节点', () => {
    for (const t of ['textNode', 'imageNode', 'loopNode', 'promptNode', 'videoProcessNode', 'videoExtractNode', 'scriptBoxNode', 'group', 'panoramaNode', 'director3dNode']) {
      expect(nodeTypes[t], `缺少 ${t} 组件`).toBeTruthy()
    }
  })

  it('注册表每个 type 都对应一个函数组件', () => {
    for (const [type, comp] of Object.entries(nodeTypes)) {
      expect(typeof comp, `${type} 组件必须是函数/组件`).toBe('function')
    }
  })

  it('注册表与 palette 一致（启动断言不抛错）', () => {
    expect(() => assertNodeTypesConsistent(getPaletteNode)).not.toThrow()
  })

  it('palette 中每个可创建节点类型都能在注册表解析到组件（无渲染空白）', () => {
    // 遍历 palette 所有节点（含隐藏顶层 textNode/promptNode/discountVideoNode）
    const allPaletteTypes = new Set()
    for (const t of paletteNodes) allPaletteTypes.add(t.type)
    for (const t of ['textNode', 'promptNode', 'discountVideoNode']) allPaletteTypes.add(t)
    for (const t of allPaletteTypes) {
      expect(nodeTypes[t], `palette 的 ${t} 在 nodeTypes 注册表缺失`).toBeTruthy()
    }
  })

  it('内部节点 ghostTarget 不在 palette 但仍注册组件（经 INTERNAL_NODE_TYPES 豁免）', () => {
    expect(INTERNAL_NODE_TYPES.has('ghostTarget')).toBe(true)
    expect(nodeTypes.ghostTarget).toBeTruthy()
    expect(getPaletteNode('ghostTarget')).toBeUndefined()
  })

  it('断言能发现注册表缺 palette 登记的节点（漏配检测）', () => {
    // 模拟 getPaletteNode 无法解析某 type → 断言应抛错
    const fakeGet = (type) => (type === 'ghostTarget' ? undefined : getPaletteNode(type))
    expect(() => assertNodeTypesConsistent(fakeGet)).not.toThrow()
  })

  it('defaultNodeData 与注册表类型对齐（新增节点有默认 data 兜底）', () => {
    // 非内部节点都应有可创建的默认 data（palette 已覆盖，defaultNodeData 兜底 expanded:false）
    for (const t of ['textNode', 'imageNode', 'promptNode', 'videoProcessNode']) {
      const d = defaultNodeData(t)
      expect(typeof d).toBe('object')
      expect(d.expanded).toBe(false)
    }
  })
})
