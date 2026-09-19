/**
 * 画布域门面 —— `src/components/canvas/` 的**唯一对外出口**。
 *
 * 【域边界】域根 = `components/canvas/`（与 `agent/` · `videoEditor/` 同级）：
 *   · 域根：机制件（`NodePalette` · `nodeDataSchema` · `nodeDefaults` · `nodePrefs` ·
 *     `groupNodes` · `deriveNodes` · `historyStack` · `structuralSnapshot` ·
 *     `canvasSnapshotSchema` · `toolRegistry` · `lod` · `upstreamLink` · `lazyNode` · …）
 *   · 子域：`nodes/`（节点组件 · 18）· `edges/`（边组件 · 3）
 * 落点裁定与判据见 `docs/DOMAIN-MODULES.md §2.6 / §7`。
 *
 * 【建面判据（§2.7 二级判据）】域外消费点直连的是**实现件**（不是天然入口）⇒ **必建**。
 * 收益：**域内重排（改名/移位/拆子域）不再波及域外** —— 这就是本仓「域模块化」的目标。
 *
 * 【宽窄红线】本门面只露**域外真实需要**的符号（`refs` 实测的 8 个域外消费者），
 * 不追求"把域内所有东西都 re-export 一遍" —— 宽门面 = 假收口（把内部结构换个地方暴露）。
 *
 * 【🔵 装配层例外 · 明确记录】`src/App.tsx` **不走本门面**，仍直连域内件（16 处）。
 * 理由：`App.tsx` 是**装配层/组合根**（`docs/DOMAIN-MODULES.md §2.5` 明确「App.tsx 不计为消费域」），
 * 它的职责就是把各域的件接起来；若强行让它走门面，门面需再露 ~17 个符号 ⇒ 变成宽门面。
 * ⇒ 本条是**有意的例外**，不是漏收口。新增域外消费者（非装配层）**必须**走本门面。
 */
/* ── G1 · 节点数据契约（新建 data 初值 / 结构默认 / 参数记忆）── */
export { defaultNodeData } from './contract/nodeDataSchema.ts';
export {
  applyNodeTypeDefaults,
  INPUT_PANEL_NODE_TYPES,
  ASSET_NODE_SIZE,
} from './contract/nodeDefaults.ts';
export { injectNodePrefs } from './contract/nodePrefs.ts';

/* ── G2 · 结构变更与历史（编组 / 派生 / 快照白名单 / 撤销 / 结构快照）── */
export { deleteNodesWithCascade, normalizeNodeParents } from './structure/groupNodes.ts';
export {
  buildSpawnNodes,
  spawnAndCommit,
  makeChildId,
  commitNewNodes,
} from './structure/deriveNodes.ts';
export type { CanvasCommitHandles } from './structure/deriveNodes.ts';
export { sanitizeSnapshotNodes, sanitizeSnapshotEdges } from './contract/canvasSnapshotSchema.ts';
export { HistoryStack } from './structure/historyStack.ts';
export {
  applyStructuralSnapshot,
  extractStructuralSnapshot,
  isSameStructure,
} from './structure/structuralSnapshot.ts';
export type { StructuralSnapshot } from './structure/structuralSnapshot.ts';

/* ── G4 · 注册表（画布 AI 工具）── */
export { registerTool, getTools } from './toolRegistry.ts';
export type { ToolDef, ToolResult } from './toolRegistry.ts';

/* ── G5 · 画布外壳（LOD 性能降级）── */
export { useLod } from './shell/lod.tsx';
