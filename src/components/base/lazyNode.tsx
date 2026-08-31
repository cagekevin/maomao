import React, { Suspense } from 'react'
import ErrorBoundary from './ErrorBoundary.tsx'
import { logger } from './logger.ts'

/**
 * 重依赖节点的「按需加载」包装（3D 引擎 / 视频处理等）。
 *
 * 【为什么存在】manualChunks 只把代码拆成多个文件，**不改变加载时机**：
 * 只要 palette / App 对重依赖节点是静态 import，那些 chunk 就会在首屏被强制下载
 * （vendor-3d ~1.06MB + vendor-media ~705KB，与画布是否用到 3D/视频处理无关）。
 * 只有把静态 import 换成 React.lazy，manualChunks 拆出来的 chunk 才真正变成按需。
 *
 * 【为什么是 React.lazy 预注册，而不是"画布上出现该类型才注册"】
 * 后者会让 nodeTypes 对象的引用动态变化 → ReactFlow 重渲染/重挂载 + 竞态；
 * 而 React.lazy 让 nodeTypes 一次性构建、引用恒定，由 React 在**该类型节点首次渲染时**
 * 才发起 chunk 请求。空画布 → 永不下载。
 *
 * 【失败可见】chunk 加载失败（网络抖动 / 发版后旧 chunk 404）不能白屏或静默：
 * 由 ErrorBoundary(variant="node") 降级为节点内错误框（含「重新载入」），并记 logger。
 *
 * 【用法】palette 目录项：`component: lazyNode(HEAVY_NODE_LOADERS.xxx, { label: '3D导演台' })`
 */

/** 加载中占位：占满节点内容区，不破坏节点尺寸与端口定位（对齐 ErrorBoundary node 粒度） */
function NodeLoading({ label }: { label?: string }) {
  return (
    <div className="w-full h-full min-h-[120px] flex flex-col items-center justify-center gap-2 text-center">
      <div className="w-5 h-5 rounded-full border-2 border-edge border-t-transparent animate-spin" />
      <span className="text-caption-sm text-faint">{label ? `加载${label}…` : '加载中…'}</span>
    </div>
  )
}

/**
 * 把「() => import(...)」包装成可直接放进 nodeTypes 的懒加载节点组件。
 * @param loader 动态 import（必须字面量，供 Vite 静态分析），返回 { default: ComponentType }
 * @param opts.label 用于占位文案与错误日志
 */
export function lazyNode(loader: () => Promise<{ default: React.ComponentType }>, { label }: { label?: string } = {}) {
  const Lazy = React.lazy(() =>
    loader().catch((e) => {
      // 失败必须可见：记日志后继续抛，交给下方 ErrorBoundary 降级（不静默吞错）
      logger.error('lazyNode', '节点 chunk 加载失败', { label, error: e?.message || String(e) })
      throw e
    })
  )

  const LazyNode = (props: Record<string, unknown>) => (
    <ErrorBoundary variant="node">
      <Suspense fallback={<NodeLoading label={label} />}>
        <Lazy {...(props as object)} />
      </Suspense>
    </ErrorBoundary>
  )
  LazyNode.displayName = `LazyNode(${label || 'unknown'})`
  return React.memo(LazyNode)
}

/**
 * 重依赖节点的 loader 表（唯一登记处）。
 *
 * 【硬约束】动态 import 的路径必须是字面量，Vite/Rollup 才能静态分析出 chunk 依赖；
 * 禁止写成 `import(`../nodes/${type}.jsx`)` —— 那会退化成运行时拼接，分析失效。
 */
export const HEAVY_NODE_LOADERS = {
  director3dNode: () => import('../nodes/Director3DNode.tsx'),
  panoramaNode: () => import('../nodes/PanoramaNode.tsx'),
  videoProcessNode: () => import('../nodes/VideoProcessNode.tsx'),
}

/**
 * 预取某个重依赖节点（悬停 palette 项 / 展开分类 / 打开含该类型的画布时调用），
 * 让"真正渲染"时 chunk 已在模块缓存里，骨架屏一闪而过甚至不出现。
 * 预取失败无需处理：真正渲染时会走 ErrorBoundary 可见降级。
 */
export function prefetchHeavyNode(type: keyof typeof HEAVY_NODE_LOADERS) {
  const load = HEAVY_NODE_LOADERS[type]
  if (!load) return
  load().catch(() => {})
}
