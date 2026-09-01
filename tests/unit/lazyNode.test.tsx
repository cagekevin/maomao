// @vitest-environment jsdom
/**
 * 重依赖节点按需加载（lazyNode）护栏。
 *
 * 判定红线：本文件的断言必须在「有人把静态 import 加回 NodePalette / App」时变红——
 * 那是首屏重回 +1.7MB 的唯一失效路径，必须可拦截。
 *
 * 覆盖：
 *  - lazyNode 提供 Suspense 占位（未就绪时显示骨架屏，而非空白/崩溃）
 *  - lazyNode 加载失败时降级为节点内错误框（失败可见，不静默吞错）
 *  - prefetchHeavyNode 调用链路
 *  - 【源码级】NodePalette 不得再静态 import 重依赖节点
 *  - 【App 级】App.jsx 不得再静态 import Director3DNode
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { lazyNode, HEAVY_NODE_LOADERS, prefetchHeavyNode } = await import(
  '../../src/components/base/lazyNode.tsx'
)

// 测试源码文本（用于拦截「静态 import 回归」）
const readSrc = (rel) => fs.readFileSync(path.resolve(__dirname, '../../', rel), 'utf-8')

describe('lazyNode · 占位与失败降级', () => {
  it('未就绪时显示加载占位（而非空白）', () => {
    // 永不 resolve 的 loader：确保稳定处于 pending，不受模块缓存影响
    const Pending = lazyNode(() => new Promise(() => {}), { label: '测试节点' })
    render(<Pending />)
    expect(screen.getByText(/加载测试节点/), '应显示加载占位文案').toBeTruthy()
  })

  it('加载失败 → 降级为节点内错误框（失败可见，不静默吞错）', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {}) // React 会打印未捕获错误，压噪音
    const Boom = lazyNode(() => Promise.reject(new Error('chunk 404')), { label: '爆裂节点' })
    render(<Boom />)
    // ErrorBoundary(variant="node") 的降级文案
    await waitFor(() => {
      expect(screen.getByText(/该节点渲染出错/), '应显示节点级错误框').toBeTruthy()
    })
    spy.mockRestore()
  })

  it('loader 成功后渲染真实组件内容', async () => {
    const Real = () => <div>真实内容</div>
    const Ok = lazyNode(async () => ({ default: Real }), { label: '正常节点' })
    render(<Ok />)
    await waitFor(() => {
      expect(screen.getByText('真实内容')).toBeTruthy()
    })
  })
})

describe('prefetchHeavyNode', () => {
  it('未知类型直接返回，不抛', () => {
    expect(() => prefetchHeavyNode('notExist' as unknown as Parameters<typeof prefetchHeavyNode>[0])).not.toThrow()
    expect(() => prefetchHeavyNode(undefined)).not.toThrow()
  })

  it('已知类型触发对应 loader（此处 mock，避免真的拉起 three/mediabunny）', () => {
    const key = 'panoramaNode'
    const orig = HEAVY_NODE_LOADERS[key]
    const spy = vi.fn().mockResolvedValue({ default: () => null })
    HEAVY_NODE_LOADERS[key] = spy
    try {
      prefetchHeavyNode(key)
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      HEAVY_NODE_LOADERS[key] = orig // 必须还原，否则污染后续用例
    }
  })

  it('登记表齐全：3D 导演台 / 全景图 / 视频处理', () => {
    expect(Object.keys(HEAVY_NODE_LOADERS).sort()).toEqual(
      ['director3dNode', 'panoramaNode', 'videoProcessNode'].sort()
    )
    for (const [type, load] of Object.entries(HEAVY_NODE_LOADERS)) {
      expect(typeof load, `${type} 的 loader 必须是函数`).toBe('function')
    }
  })
})

// ══════════════════════════════════════════════════════════════
// 源码级护栏：静态 import 一旦回来，首屏立刻 +1.7MB
// ══════════════════════════════════════════════════════════════
describe('按需加载 · 静态 import 回归拦截', () => {
  const staticImportsOf = (src) =>
    src.split('\n').filter((l) => /^\s*import\s.+from\s/.test(l))

  it('NodePalette 不得静态 import 重依赖节点（否则 vendor-3d/media 进首屏）', () => {
    const imports = staticImportsOf(readSrc('src/components/base/NodePalette.ts'))
    const offenders = imports.filter((l) =>
      /VideoProcessNode|PanoramaNode|Director3DNode/.test(l)
    )
    expect(
      offenders,
      `NodePalette 静态 import 了重依赖节点：${offenders.join(' | ')}\n` +
        '静态 import 会让 vendor-3d(1.06MB)/vendor-media(705KB) 首屏必载，请改用 lazyNode 动态 import'
    ).toEqual([])
  })

  it('App.tsx 不得静态 import Director3DNode', () => {
    const imports = staticImportsOf(readSrc('src/App.tsx'))
    const offenders = imports.filter((l) => /Director3DNode/.test(l))
    expect(
      offenders,
      `App.tsx 静态 import 了 Director3DNode：${offenders.join(' | ')}`
    ).toEqual([])
  })

  it('重依赖 loader 必须是字面量动态 import（供 Vite 静态分析出 chunk）', () => {
    const src = readSrc('src/components/base/lazyNode.tsx')
    // 先剥离注释：文档里会写「禁止的反例」（import(`../nodes/${type}.jsx`)），
    // 不剥离会被下面的检测误判成违规。
    const stripComments = (s) =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
    const loaderBlock = stripComments(
      src.slice(src.indexOf('HEAVY_NODE_LOADERS'), src.indexOf('export function prefetchHeavyNode'))
    )
    // 每个 loader 形如 `xxx: () => import('../nodes/X.jsx')`
    const loaders = [...loaderBlock.matchAll(/(\w+):\s*\(\)\s*=>\s*import\(/g)].map((m) => m[1])
    expect(loaders.sort()).toEqual(
      ['director3dNode', 'panoramaNode', 'videoProcessNode'].sort()
    )
    // 禁止模板字符串拼接：那会让 Rollup 无法静态分析，chunk 拆分失效
    for (const arg of [...loaderBlock.matchAll(/import\(([^)]*)\)/g)].map((m) => m[1])) {
      expect(arg, `动态 import 路径必须是字面量：import(${arg})`).not.toMatch(/\$\{/)
    }
  })
})
