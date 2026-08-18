// @vitest-environment jsdom
/**
 * nodeTypes 单源化测试 —— NodePalette 派生画布 nodeTypes。
 * 覆盖：buildNodeTypeComponents 覆盖全部可创建节点、值为组件函数、含 HIDDEN 顶部快捷。
 * （ghostTarget 由 App.jsx 补充，不在 palette 派生范围内，此处不测。）
 */
import { describe, it, expect } from 'vitest'

// 用顶层 await 动态 import，避免 NodePalette 顶部同步加载大量组件在收集期报错
const mod = await import('../../src/components/base/NodePalette.jsx')
const { buildNodeTypeComponents, paletteNodes, builtinNodeTypes } = mod

describe('NodePalette.buildNodeTypeComponents（nodeTypes 单源化）', () => {
  it('返回 type → 组件函数 映射', () => {
    const map = buildNodeTypeComponents()
    expect(map).toBeTypeOf('object')
    for (const [type, comp] of Object.entries(map)) {
      expect(typeof type).toBe('string')
      expect(typeof comp).toBe('function') // React 组件是函数
    }
  })

  it('覆盖 paletteNodes 全部「持 component」类型（director3dNode 例外由 App 补）', () => {
    const map = buildNodeTypeComponents()
    const types = new Set(Object.keys(map))
    for (const n of paletteNodes) {
      if (n.component) {
        expect(types.has(n.type), `palette 缺 ${n.type}`).toBe(true)
      } else {
        // director3dNode 依赖 WebGL 无法 SSR，palette 不持 component，由 App.jsx 派生后补充
        expect(n.type).toBe('director3dNode')
      }
    }
  })

  it('含顶部快捷 HIDDEN 节点（textNode/promptNode/discountVideoNode）', () => {
    const map = buildNodeTypeComponents()
    expect(map.textNode).toBeTypeOf('function')
    expect(map.promptNode).toBeTypeOf('function')
    expect(map.discountVideoNode).toBeTypeOf('function')
  })

  it('除 director3dNode 外每个 palette 目录项都有 component 字段（单源前提）', () => {
    for (const n of paletteNodes) {
      if (n.type === 'director3dNode') continue // WebGL 重依赖例外，由 App 补
      expect(n.component, `paletteNodes[${n.type}] 缺 component`).toBeTypeOf('function')
    }
  })

  it('builtinNodeTypes 是已复刻节点集合（不为空）', () => {
    expect(builtinNodeTypes.length).toBeGreaterThan(0)
  })

  it('派生结果 + App.jsx 补充 = baseline 16 类（防遗漏/防多余）', () => {
    // 与改动前 App.jsx 手写 nodeTypes 的 type 集合逐项对齐
    const baseline = [
      'textNode', 'imageNode', 'loopNode', 'promptNode', 'discountVideoNode',
      'videoExtractNode', 'imageBoxNode', 'gridSplitNode', 'gridMergeNode',
      'videoProcessNode', 'faceMosaicNode', 'panoramaNode', 'director3dNode',
      'group', 'scriptBoxNode', 'ghostTarget',
    ]
    // 模拟 App.jsx：派生 + director3dNode/ghostTarget 例外
    const derived = {
      ...buildNodeTypeComponents(),
      director3dNode: () => {},
      ghostTarget: () => {},
    }
    const types = Object.keys(derived).sort()
    expect(types).toEqual([...baseline].sort())
  })
})
