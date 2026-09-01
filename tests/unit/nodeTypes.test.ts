// @vitest-environment jsdom
// @ts-nocheck
/**
 * nodeTypes 单源化测试 —— NodePalette 派生画布 nodeTypes。
 * 覆盖：buildNodeTypeComponents 覆盖全部可创建节点、值为组件函数、含 HIDDEN 顶部快捷。
 * （ghostTarget 由 App.jsx 补充，不在 palette 派生范围内，此处不测。）
 */
import { describe, it, expect } from 'vitest'

// 用顶层 await 动态 import，避免 NodePalette 顶部同步加载大量组件在收集期报错
const mod = await import('../../src/components/base/NodePalette.ts')
const { buildNodeTypeComponents, paletteNodes, builtinNodeTypes } = mod

// React.memo/forwardRef 在 React 19 返回带 $$typeof 标记的对象而非裸函数，
// P1 节点 memo 化后 nodeTypes 值仍是合法 React 组件类型，故用「函数 或 React 元素类型」判断。
const isReactComponent = (v) =>
  typeof v === 'function' ||
  (typeof v === 'object' && v !== null && typeof v.$$typeof === 'symbol')

describe('NodePalette.buildNodeTypeComponents（nodeTypes 单源化）', () => {
  it('返回 type → 组件函数 映射', () => {
    const map = buildNodeTypeComponents()
    expect(map).toBeTypeOf('object')
    for (const [type, comp] of Object.entries(map)) {
      expect(typeof type).toBe('string')
      expect(isReactComponent(comp), `${type} 不是合法 React 组件类型`).toBe(true) // React 组件类型（函数 或 memo/forwardRef）
    }
  })

  it('覆盖 paletteNodes 全部类型（重依赖节点亦持 component，为 lazyNode 包装）', () => {
    const map = buildNodeTypeComponents()
    const types = new Set(Object.keys(map))
    for (const n of paletteNodes) {
      // 3D/视频处理等重依赖节点的 component 是 lazyNode 包装（动态 import），仍属「持 component」
      expect(isReactComponent(n.component), `paletteNodes[${n.type}] 缺 component`).toBe(true)
      expect(types.has(n.type), `palette 缺 ${n.type}`).toBe(true)
    }
  })

  it('含顶部快捷 HIDDEN 节点（textNode/promptNode/discountVideoNode）', () => {
    const map = buildNodeTypeComponents()
    expect(isReactComponent(map.textNode), 'textNode 非合法组件类型').toBe(true)
    expect(isReactComponent(map.promptNode), 'promptNode 非合法组件类型').toBe(true)
    expect(isReactComponent(map.discountVideoNode), 'discountVideoNode 非合法组件类型').toBe(true)
  })

  it('每个 palette 目录项都有 component 字段（单源前提，重依赖为 lazy 包装）', () => {
    for (const n of paletteNodes) {
      expect(isReactComponent(n.component), `paletteNodes[${n.type}] 缺 component`).toBe(true)
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
    // 模拟 App.jsx：palette 派生（含 lazyNode 包装的重依赖）+ ghostTarget 占位例外
    const derived = {
      ...buildNodeTypeComponents(),
      ghostTarget: () => {},
    }
    const types = Object.keys(derived).sort()
    expect(types).toEqual([...baseline].sort())
  })
})
