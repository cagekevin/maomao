/**
 * 画布域门面 —— `src/components/canvas/` 的**唯一对外出口**。
 *
 * 【域边界】域根 = `components/canvas/`（与 `agent/` · `videoEditor/` 同级）：
 *   · 域根：机制件（`NodePalette` · `nodeDataSchema` · `nodeDefaults` · `nodePrefs` ·
 *     `groupNodes` · `deriveNodes` · `historyStack` · `structuralSnapshot` ·
 *     `canvasSnapshotSchema` · `toolRegistry` · `upstreamLink` · `lazyNode` · …，清单以目录现测为准）
 *   · 子域：`nodes/`（节点组件）· `edges/`（边组件）· `shell/`（画布外壳件）
 * 落点裁定与判据见 `docs/DOMAIN-MODULES.md §2.6 / §7`。
 *
 * 【建面判据（§2.7 二级判据）】域外消费点直连的是**实现件**（不是天然入口）⇒ **必建**。
 * 收益：**域内重排（改名/移位/拆子域）不再波及域外** —— 这就是本仓「域模块化」的目标。
 *
 * 【宽窄红线】本门面只露**域外真实需要**的符号（域外消费者清单以
 * `node scripts/mv-sync-refs.mjs refs` 现测为准，不在此写死数字 —— 计数会漂移），
 * 不追求"把域内所有东西都 re-export 一遍" —— 宽门面 = 假收口（把内部结构换个地方暴露）。
 * 【2026-11-06 · 152 第六批】`HistoryStack` / `applyStructuralSnapshot` / `extractStructuralSnapshot`
 * / `isSameStructure` / `StructuralSnapshot` 曾挂在本门面但**零域外消费者**（唯一消费者
 * `useCanvasHistory` 属域内，已改直连实现件）⇒ 从门面摘除（`createStructuralSnapshot` 更早已删）。
 * 域外若未来真要消费，届时再按建面判据加回。
 *
 * 【🔵 装配层例外 · 明确记录】`src/App.tsx` **不走本门面**，仍直连域内件（处数以 refs 现测为准）。
 * 理由：`App.tsx` 是**装配层/组合根**（`docs/DOMAIN-MODULES.md §2.5` 明确「App.tsx 不计为消费域」），
 * 它的职责就是把各域的件接起来；若强行让它走门面，门面需再露十几个符号 ⇒ 变成宽门面。
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
/* 【2026-11-06 · 152 第六批】原此处 export 的 HistoryStack / structuralSnapshot 一族
   （applyStructuralSnapshot / extractStructuralSnapshot / isSameStructure / StructuralSnapshot 类型）
   已摘除 —— 零域外消费者（详见文件头「宽窄红线」段）。 */

/* ── G4 · 注册表（画布 AI 工具）── */
export { registerTool, getTools } from './toolRegistry.ts';
export type { ToolDef, ToolResult } from './toolRegistry.ts';

/* ── G5 · 画布外壳 ── */
/* 【2026-09-30】原 `export { useLod } from './shell/lod.tsx'` 已删 ——
   lod 分档整体退役（docs/plan/139），降级改由 `.react-flow.perf-on` 的 CSS 承接。 */
