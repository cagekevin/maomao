/**
 * 画布快照 schema —— 「**什么字段会被持久化**」的唯一物理位置（TD-02-7 第一步，2026-09-12）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么单独立此模块】
 * 此前「快照保留哪些字段」这份知识**没有物理位置**，散落 ≥6 处且互不对账：
 *   ① NodePalette.paletteNodes[].data（新建默认）
 *   ② 各节点文件本地 interface XxxData（渲染期类型）
 *   ③ useConnectedInputs 的产出契约三张表（读上游产出；2026-09-12 / TD-02-11 起为写侧显式声明）
 *   ④ nodeDefaults.NODE_TYPE_DEFAULTS / applyNodeTypeDefaults（结构默认）
 *   ⑤ projectStore.sanitizeNodes / sanitizeEdges（**落盘保留白名单** ← 本模块接管）
 *   ⑥ contracts.CANVAS_SCHEMA_VERSION（版本号）
 * （+ check-node-data.mjs 的 NODE_TYPE_TO_FILE 对账表；+ 测试里手抄的一份白名单副本）
 * 后果是复利：写侧加了字段而白名单没加 → 刷新丢字段；白名单加了而写回没走唯一入口 → 静态闸盲区。
 * 区域 04 的 TD-04-15/16/17/19 反复围绕 width/height/style/selected/label 打架，根因皆在此。
 *
 * 【本模块的定位与边界（诚实标注，避免误读）】
 * - **已收**：落盘保留白名单（NODE_KEEP / EDGE_KEEP）+ 纯函数 sanitize —— 这是「快照 schema」
 *   中最不可逆的一段（一旦写错，用户刷新即丢字段），所以**先收敛它**。
 * - **未收（后续步骤，见区域 02 架构日志 TD-02-7）**：①②③④⑥ 的 data 形状仍各自表述；
 *   收敛它们需要一份 nodeDataSchema（含每节点 data 字段 + 默认值），属更大改造，分批做。
 * - **版本号仍留在 `contracts.CANVAS_SCHEMA_VERSION`**（登记表家族，全仓统一查询口径），
 *   本模块不复制它；变更本文件的字段集时**必须同步评估是否需提升该版本号并补迁移**
 *   （spec/CONTEXT.md「画布快照 schema 版本化 P0-4 红线」）。
 * ════════════════════════════════════════════════════════════════
 */

/**
 * 落盘前清理 ReactFlow 运行时 UI 态。
 * ReactFlow 的 nodes 在交互时会带 selected / dragging / measured / handles 等运行时字段，
 * 这些是「会话态」不是「数据」，不该进 KV 快照（否则污染存储、加大体积）。
 * 白名单：只保留恢复画布必需的字段。
 * ⚠️ 必须保留 parentId 与 extent：编组后子节点以「相对父节点的坐标」存储，且带 parentId + extent:'parent'。
 * 旧白名单漏掉这俩，落盘后子节点丢失父子关系、却仍带着相对坐标被当作绝对坐标渲染，
 * 刷新后所有编组子节点跑到原点附近（位置全乱）；同时 React Flow 失去 extent 钳制约束。
 * ⚠️ 还要保留 style / initialWidth / initialHeight：group 节点的面积存在 style.width/height（渲染用）
 * 与 initialWidth/Height（React Flow getNodeDimensions fallback 用）。旧白名单漏掉它们，
 * 刷新后 group 矩形面积塌成 0×0（视觉缩成点），且框选命中判定因尺寸缺失而错乱。
 * ⚠️ data 整包透传（不做字段级过滤）：data 形状真源在①~④各处，本模块只管 node 级白名单。
 */
export const NODE_KEEP: string[] = [
  'id',
  'type',
  'position',
  'data',
  'width',
  'height',
  'parentId',
  'extent',
  'style',
  'initialWidth',
  'initialHeight',
];

/** edges 同理只保留恢复画布必需字段（source/target/handle/type/data/label）。 */
export const EDGE_KEEP: string[] = [
  'id',
  'source',
  'target',
  'sourceHandle',
  'targetHandle',
  'type',
  'data',
  'label',
];

/** 按白名单裁剪单个对象（undefined/null 视为「未设置」，不落盘）。 */
function keepFields(
  obj: Record<string, unknown>,
  keep: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keep) {
    if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  }
  return out;
}

/** 快照 node 白名单裁剪（null 原样返回，保持 loadCanvasState 的「空画布」语义）。 */
export function sanitizeSnapshotNodes(
  nodes: Record<string, unknown>[] | null,
): Record<string, unknown>[] | null {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((n) => keepFields(n, NODE_KEEP));
}

/** 快照 edge 白名单裁剪。 */
export function sanitizeSnapshotEdges(
  edges: Record<string, unknown>[] | null,
): Record<string, unknown>[] | null {
  if (!Array.isArray(edges)) return edges;
  return edges.map((e) => keepFields(e, EDGE_KEEP));
}
