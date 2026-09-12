import React, { Suspense } from 'react';
import ErrorBoundary from '../ui/ErrorBoundary.tsx';
import NodeShell from '../ui/NodeShell.tsx';
import { logger } from '../core/logger.ts';
import { NODE_HANDLE_CONTRACT } from '../core/contracts.ts';

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

/** 懒加载节点的端口契约（type → NodeShell 的 target/source handleId）。
 *
 * 【为什么占位骨架也必须声明端口】chunk 未到达前节点渲染的是本文件的占位骨架，
 * React Flow 若此刻已存在/新建指向该节点的边，会去 handleBounds 查端口位置；骨架没有
 * 端口 → 查不到 → 报 code-008（target/source handle id: null），且在节点挂载后
 * （useSizeSync/尺寸写回触发 updateNodeInternals 重算全画布边）反复刷屏。
 * 故骨架用 NodeShell 渲染，并按本表声明与真实节点一致的端口 id，保证测量期就有正确端口。
 *
 * 【TD-04-1 收口】本体已从「lazyNode 内联表」改为从 contracts.NODE_HANDLE_CONTRACT 单源派生——
 * 不再与 App.tsx / 节点文件三处手工维护（此前已漂移）。新增懒加载节点只需在 contracts 登记端口，
 * 本表自动同步；scripts/check-node-handles.mjs 对账「节点文件声明 ⊆ 契约表」。 */
const LAZY_NODE_HANDLE_CONTRACT: Record<
  string,
  { targetHandleId?: string; sourceHandleId?: string }
> = NODE_HANDLE_CONTRACT;

/** 骨架内容（纯视觉：转圈 + 文案） */
function LoadingContent({ label }: { label?: string }) {
  return (
    <div className="w-full h-full min-h-[120px] flex flex-col items-center justify-center gap-2 text-center">
      <div className="w-5 h-5 rounded-full border-2 border-edge border-t-transparent animate-spin" />
      <span className="text-caption-sm text-faint">{label ? `加载${label}…` : '加载中…'}</span>
    </div>
  );
}

/** 加载中占位：
 *  - 有 id（真实画布：ReactFlow 内）→ 用 NodeShell 外壳承载，声明与真实节点一致的端口 →
 *    chunk 未到达前 handleBounds 已就位，指向该节点的边不会报 code-008。
 *    端口契约由 LAZY_NODE_HANDLE_CONTRACT 提供（按 loader 的 type 键）。
 *  - 无 id（如单测直接 render，不在 ReactFlow 内）→ 只渲染纯骨架内容，
 *    避免 NodeShell 的 useStore/useReactFlow 在无 Provider 环境抛错。 */
function NodeLoading({
  id,
  label,
  handleContract,
}: {
  id?: string;
  label?: string;
  handleContract?: { targetHandleId?: string; sourceHandleId?: string };
}) {
  if (!id) return <LoadingContent label={label} />;
  return (
    <NodeShell
      id={id}
      defaultTitle={label || '加载中'}
      selected={false}
      resizable={false}
      {...handleContract}
    >
      <LoadingContent label={label} />
    </NodeShell>
  );
}

/**
 * 把「() => import(...)」包装成可直接放进 nodeTypes 的懒加载节点组件。
 * @param loader 动态 import（必须字面量，供 Vite 静态分析），返回 { default: ComponentType }
 * @param opts.label 用于占位文案与错误日志
 * @param opts.type  节点类型键（用于查 LAZY_NODE_HANDLE_CONTRACT 给占位骨架声明端口）
 */
export function lazyNode(
  loader: () => Promise<{ default: React.ComponentType }>,
  { label, type }: { label?: string; type?: string } = {},
) {
  const Lazy = React.lazy(() =>
    loader().catch((e) => {
      // 失败必须可见：记日志后继续抛，交给下方 ErrorBoundary 降级（不静默吞错）
      logger.error('lazyNode', '节点 chunk 加载失败', { label, error: e?.message || String(e) });
      throw e;
    }),
  );

  const handleContract = type ? LAZY_NODE_HANDLE_CONTRACT[type] : undefined;

  const LazyNode = (props: Record<string, unknown>) => (
    <ErrorBoundary variant="node">
      <Suspense
        fallback={
          <NodeLoading
            id={props.id as string | undefined}
            label={label}
            handleContract={handleContract}
          />
        }
      >
        <Lazy {...(props as object)} />
      </Suspense>
    </ErrorBoundary>
  );
  LazyNode.displayName = `LazyNode(${label || 'unknown'})`;
  return React.memo(LazyNode);
}

/**
 * 重依赖节点的 loader 表（唯一登记处）。
 *
 * 【硬约束】动态 import 的路径必须是字面量，Vite/Rollup 才能静态分析出 chunk 依赖；
 * 禁止写成 `import(`../nodes/${type}.jsx`)` —— 那会退化成运行时拼接，分析失效。
 */
export const HEAVY_NODE_LOADERS = {
  director3dNode: () => import('../../nodes/Director3DNode.tsx'),
  panoramaNode: () => import('../../nodes/PanoramaNode.tsx'),
  videoProcessNode: () => import('../../nodes/VideoProcessNode.tsx'),
};

/**
 * 预取某个重依赖节点（悬停 palette 项 / 展开分类 / 打开含该类型的画布时调用），
 * 让"真正渲染"时 chunk 已在模块缓存里，骨架屏一闪而过甚至不出现。
 * 预取失败无需处理：真正渲染时会走 ErrorBoundary 可见降级。
 */
export function prefetchHeavyNode(type: keyof typeof HEAVY_NODE_LOADERS) {
  const load = HEAVY_NODE_LOADERS[type];
  if (!load) return;
  // 【失败可见 TD-02-16】预取失败不阻断（真正渲染走 ErrorBoundary），但须留痕：预取失败=渲染时会卡
  load().catch((e) => {
    logger.warn('lazyNode', '重型节点预取失败（真正渲染时将现场加载）', {
      type,
      reason: e?.message || e,
    });
  });
}
