/**
 * ════════════════════════════════════════════════════════════════
 * 画布操作原语层（CanvasHost）—— 纯 JS 工厂，注入 ctx 可测，无 React hook 依赖
 * ════════════════════════════════════════════════════════════════
 *
 * 【★ 写画布走哪条路 —— 判据是「我在哪个目录」，**不需要推断你是 AI 侧还是人工侧**】
 *
 * 本仓有**两条画布写路径**，选择依据只是**文件所在目录**（可机械判定，零歧义）：
 *
 * | 你写的文件在哪 | 走哪条 | 为什么 |
 * | --- | --- | --- |
 * | `src/components/agent/canvas/**` | **必须经本模块 `AgentCanvasHost`** | 这是 AI 工具层：写操作要可批量 / 可回滚 / 可审计（undo_ai 依赖） |
 * | 其余（`nodes/` `canvas/shell/` `hooks/` … 人工/UI 侧） | **直接用 `useReactFlow().setNodes`** | UI 交互是即时、单点、由用户操作驱动的，不经 AI 的批量/回滚语义 |
 *
 * ⚠️ **不要问"这段代码算不算 AI 侧"** —— 那是要推断的问题，且必然猜错。**看目录**即可：
 * 你在 `agent/canvas/` 下就经 host，不在就直写。`scripts/check-arch.mjs` 规则 3 按同一判据
 * （`CANVAS_WRITE_SCOPE = 'src/components/agent/canvas/'`）机器守卫：该目录内裸调
 * `ctx.setNodes/setEdges/addNodes/addEdges` 一律红灯。**唯一豁免 = 本文件自身**（它就是 host 实现）。
 *
 * 【解决什么】见 docs/14 Step M1。把工具层/执行器里重复的底层 ReactFlow 写法
 * （`setNodes([...getNodes(), x])` / `setNodes((ns) => ns.map(...))` /
 *  `deleteNodesWithCascade(getNodes(), getEdges(), id)` + `setNodes` + `setEdges`）
 * 收敛成语义清晰、可复用、可批量、可回滚的画布原语。这才是可维护性/可扩展性的来源。
 *
 * 【用法】
 *   const host = createCanvasHost(ctx)   // ctx = useReactFlow() 或测试 mock
 *   host.appendNode(newNode)             // 追加单节点（函数式 setNodes）
 *   host.appendMany({ nodes, edges })    // 批量追加：一次 setNodes/setEdges 防重渲染风暴
 *   host.updateNodeData(id, patch)       // 不可变局部更新 node.data
 *   host.updateNodePosition(id, pos)     // 只改 position
 *   host.lockNodes(ids, locked)          // 锁定/解锁（data.locked + draggable/selectable）
 *   host.deleteNodes(ids)                // 级联删子孙 + 相连边，返回被删节点 id 数组
 *   host.appendEdges(edges)              // 追加边（函数式 setEdges）
 *   host.replaceNodes(nodes)             // 整体替换节点数组（undo_ai/group_nodes 用）
 *   host.restoreNodesAndEdges({nodes,edges}) // 一次性整体恢复 nodes+edges（undo_ai 快照恢复）
 *
 * 【读写纪律】写一律用函数式（读最新状态），deleteNodes 例外：先 getNodes 快照 → 整体替换，
 * 避免「先读后写」读到过期 nodes。replaceNodes/restoreNodesAndEdges 用于「整体替换」场景
 * （undo_ai 恢复快照、group_nodes 整体替换），非局部操作。host 内部保持一致，调用方无需关心。
 */
import type { Node, Edge } from '@xyflow/react';
import { deleteNodesWithCascade } from '@/components/canvas';
// ★ TD-22-68 断环（2026-09-20）：改直连**纯逻辑模块**（不再是 `@/components/creative` 域门面）。
//   门面里装的是 `CreativeLibraryButton` 等 UI 组件；只要一个纯函数却拉进整套 UI 依赖 =
//   逻辑层依赖 UI 层（与 `hooks/useNodeData` 同源问题）。`normalizeChipFieldWrite` 本就在
//   `creativePresets.ts`（纯逻辑，只依赖 promptChips）⇒ 直连它是**依赖方向摆正**。
import { normalizeChipFieldWrite } from '@/components/creative/creativePresets.ts';

/** 不传 ctx 时的安全空实现（保持「注入 ctx 即可测」语义，避免空 ctx 调用即崩）。 */
const DEFAULT_CTX: AgentCanvasHostCtx = {
  getNodes: () => [],
  setNodes: () => {},
  getEdges: () => [],
  setEdges: () => {},
};

/** 画布操作句柄所需的画布能力（useReactFlow() 或测试 mock 注入）。 */
export interface AgentCanvasHostCtx {
  getNodes: () => Node[];
  setNodes: (updater: Node[] | ((nodes: Node[]) => Node[])) => void;
  getEdges: () => Edge[];
  setEdges: (updater: Edge[] | ((edges: Edge[]) => Edge[])) => void;
}

/** createCanvasHost 返回的操作句柄。 */
export interface AgentCanvasHost {
  getNode: (id: string) => Node | null;
  getNodes: () => Node[];
  getEdges: () => Edge[];
  appendNode: (newNode: Node) => void;
  appendMany: (payload: { nodes?: Node[]; edges?: Edge[] }) => void;
  appendEdges: (edges: Edge[]) => void;
  removeEdges: (ids: string | string[]) => void;
  updateNodeData: (id: string, patch: Partial<Node['data']>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  lockNodes: (ids: string[], locked: boolean) => void;
  deleteNodes: (ids: string | string[]) => string[];
  replaceNodes: (nodes: Node[]) => void;
  replaceEdges: (edges: Edge[]) => void;
  restoreNodesAndEdges: (payload: { nodes?: Node[]; edges?: Edge[] }) => void;
}

/**
 * 创建画布操作句柄。
 * @param ctx 画布能力（useReactFlow() 或测试 mock）：
 *   { getNodes, setNodes, getEdges, setEdges, ... }
 */
export function createAgentCanvasHost(ctx: AgentCanvasHostCtx = DEFAULT_CTX): AgentCanvasHost {
  // ── 读 ──
  const getNode = (id: string): Node | null => ctx.getNodes().find((n) => n.id === id) || null;
  const getNodes = (): Node[] => ctx.getNodes();
  const getEdges = (): Edge[] => ctx.getEdges();

  // ── 写（语义原语，内部封装 ReactFlow 函数式写法）──
  const appendNode = (newNode: Node): void => ctx.setNodes((ns) => [...ns, newNode]);

  // 批量追加：单次 setNodes/setEdges，避免 N 次全量重渲染（P11 防渲染风暴关键，勿退化逐条 append）
  const appendMany = ({ nodes, edges }: { nodes?: Node[]; edges?: Edge[] }): void => {
    if (nodes?.length) ctx.setNodes((ns) => [...ns, ...nodes]);
    if (edges?.length) ctx.setEdges((es) => [...es, ...edges]);
  };

  // 更新单个节点 data（不可变局部更新，非目标节点引用不变不重渲染）。
  // 合并后过一道 `normalizeChipFieldWrite`：Agent 写 prompt/text（典型：改掉带胶囊的提示词）
  // 时把孤儿 creativePresets 一并裁掉（TD-05-13 · I1）。对无该字段的节点是零成本 no-op。
  const updateNodeData = (id: string, patch: Partial<Node['data']>): void =>
    ctx.setNodes((ns) =>
      ns.map((n) => {
        if (n.id !== id) return n;
        const merged = { ...n.data, ...patch } as Record<string, unknown>;
        return { ...n, data: normalizeChipFieldWrite(merged, patch as Record<string, unknown>) };
      }),
    );

  // 只改 position（保留 data/其它字段）
  const updateNodePosition = (id: string, position: { x: number; y: number }): void =>
    ctx.setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, position } : n)));

  // 锁定/解锁：data.locked + draggable/selectable 一起写，让 NodeShell 真正消费锁定效果
  const lockNodes = (ids: string[], locked: boolean): void =>
    ctx.setNodes((ns) =>
      ns.map((n) =>
        ids.includes(n.id)
          ? { ...n, data: { ...n.data, locked }, draggable: !locked, selectable: !locked }
          : n,
      ),
    );

  // 删除节点（族谱级联删子孙 + 相连边）；先快照后整体替换
  const deleteNodes = (ids: string | string[]): string[] => {
    const idArr = Array.isArray(ids) ? ids : [ids];
    const { nodes, edges, deleted } = deleteNodesWithCascade(ctx.getNodes(), ctx.getEdges(), idArr);
    ctx.setNodes(nodes);
    ctx.setEdges(edges);
    return deleted;
  };

  const appendEdges = (edges: Edge[]): void => ctx.setEdges((es) => [...es, ...edges]);

  /** 按 id 批量删除连线（connect/delete_edge 收口用；单次 setEdges，不逐条） */
  const removeEdges = (ids: string | string[]): void => {
    const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
    ctx.setEdges((es) => es.filter((e) => !idSet.has(e.id)));
  };

  // ── 整体替换（undo_ai 恢复快照 / group_nodes 整体替换节点数组）──
  // 这两个场景是「整数组替换」而非「局部操作」，host 之前只覆盖局部原语，导致 undo_ai / group_nodes
  // 只能裸 ctx.setNodes。收口后统一走此原语（见实施计划 M1 C1-1 验收：工具层零裸 useReactFlow）。
  const replaceNodes = (nodes: Node[]): void => ctx.setNodes(nodes);
  const replaceEdges = (edges: Edge[]): void => ctx.setEdges(edges);
  // undo_ai 恢复 AI 快照：一次性整体替换 nodes + edges（快照来自 pushActiveAiUndo 记录的原值）
  const restoreNodesAndEdges = ({ nodes, edges }: { nodes?: Node[]; edges?: Edge[] }): void => {
    if (nodes) ctx.setNodes(nodes);
    if (edges) ctx.setEdges(edges);
  };

  return {
    getNode,
    getNodes,
    getEdges,
    appendNode,
    appendMany,
    appendEdges,
    removeEdges,
    updateNodeData,
    updateNodePosition,
    lockNodes,
    deleteNodes,
    replaceNodes,
    replaceEdges,
    restoreNodesAndEdges,
  };
}
