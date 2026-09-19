/**
 * 画布**结构化撤销**快照 —— 「撤销一次该退多少」的唯一物理位置（TD-04-31）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么需要它（对标对方 plans/2026-07-24-project-scoped-history）】
 * 原撤销栈存**全量节点**（`CanvasSnapshot = { nodes: Node[], edges: Edge[] }`，含
 * `position` / `width` / `height` / 普通 `data`）→ 两个问题：
 *   ① **过捕获**：撤销一次会把「刚拖好的位置、刚改的内容」一并回退到旧值；
 *   ② **快照膨胀**：每步都存一份全量节点，大画布（几十上百节点）内存占用显著。
 *
 * 结构化撤销只回答一个问题：**「这次变化里，结构（谁存在 / 连了谁 / 归谁管）变了没有」**。
 * 结构 = { 节点 id / type / parentId ＋ 边 id / source / target / sourceHandle / targetHandle }。
 * 位置、尺寸、普通内容**不属结构** → 不进快照、撤销时**保留当前值**。
 *
 * 【与执行层的关系（重要）】
 * 调用方（App.addNode / deleteNode / 编组…）**本就在结构操作时才 record**，拖动位置与
 * 改内容从不 record → 「只有结构变化才入栈」这一半**已天然满足**；本模块补齐的是
 * **栈内快照的形状与恢复语义**（另一半）。
 *
 * 【恢复语义 = 以当前画布为底做结构增删】
 * `applyStructuralSnapshot` **不得**整体替换 nodes（那会把位置也带回旧值）。正确做法：
 *   - 结构快照里**存在**的节点 → 保留当前对象（当前位置/尺寸/内容）；若当前没有 → 按给的结构新建；
 *   - 结构快照里**不存在**的节点 → 从当前画布移除；
 *   - 顺序以结构快照为准（保证渲染层顺序稳定、可复现）。
 * 边同理（边无「普通位置」，直接按结构替换即可）。
 * ════════════════════════════════════════════════════════════════
 */
import type { Edge, Node } from '@xyflow/react';

/** 结构快照里的节点（只留结构字段；其余字段在撤销时保留「当前值」）。 */
export interface StructuralNode {
  id: string;
  type: string;
  /** 分组归属（编组子节点以相对父节点坐标存储，故归属属结构）。 */
  parentId?: string;
}

/** 结构快照里的边（边无普通内容，结构即全部）。 */
export interface StructuralEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** 一次**结构化**画布快照：只描述「结构」，不含位置/尺寸/普通内容。 */
export interface StructuralSnapshot {
  nodes: StructuralNode[];
  edges: StructuralEdge[];
}

/**
 * 从全量节点/边**提取**结构快照（纯函数）。
 *
 * 只取结构字段 —— 这是「快照膨胀」的根治点：无论节点 data 多大（内联 base64 / 长文本），
 * 结构快照的体积都只与「节点数」相关。
 */
export function extractStructuralSnapshot(
  nodes: readonly Node[],
  edges: readonly Edge[],
): StructuralSnapshot {
  return {
    nodes: nodes.map((n) => {
      const out: StructuralNode = { id: String(n.id), type: String(n.type ?? '') };
      // parentId 缺省视为「无归属」——不写 undefined，保持快照可比对（JSON 友好）
      if (n.parentId != null) out.parentId = String(n.parentId);
      return out;
    }),
    edges: edges.map((e) => {
      const out: StructuralEdge = {
        id: String(e.id),
        source: String(e.source),
        target: String(e.target),
      };
      if (e.sourceHandle != null) out.sourceHandle = e.sourceHandle;
      if (e.targetHandle != null) out.targetHandle = e.targetHandle;
      return out;
    }),
  };
}

/**
 * 结构**相等**判定（纯函数）—— 用于「结构没变则不重复入栈」。
 *
 * 比较顺序无关？**有关**：顺序属渲染层可见结构（节点叠放顺序），故按序比较。
 */
export function isSameStructure(a: StructuralSnapshot, b: StructuralSnapshot): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  for (let i = 0; i < a.nodes.length; i++) {
    const x = a.nodes[i];
    const y = b.nodes[i];
    if (x.id !== y.id || x.type !== y.type || (x.parentId ?? '') !== (y.parentId ?? '')) {
      return false;
    }
  }
  for (let i = 0; i < a.edges.length; i++) {
    const x = a.edges[i];
    const y = b.edges[i];
    if (
      x.id !== y.id ||
      x.source !== y.source ||
      x.target !== y.target ||
      (x.sourceHandle ?? '') !== (y.sourceHandle ?? '') ||
      (y.targetHandle ?? '') !== (y.targetHandle ?? '')
    ) {
      return false;
    }
  }
  return true;
}

/**
 * 把一个结构快照**应用**到当前画布（纯函数，返回新数组；不 mutate 入参）。
 *
 * **核心语义（勿改）**：对「结构快照里仍存在」的节点，**保留当前对象的当前位置/尺寸/内容**
 * —— 这是「撤销不回退位置/尺寸/普通内容」的落点。仅对：
 *   - 当前画布缺该节点（撤销一次「删除」）→ 用给的结构新建（结构字段有，位置缺省，由调用方/渲染层兜底）；
 *   - 当前画布多该节点（撤销一次「新建」）→ 移除。
 *
 * @param currentNodes 当前画布节点（真源）
 * @param currentEdges 当前画布边
 * @param snapshot     目标结构快照
 * @param materialize  可选：把 `StructuralNode` 变回完整 `Node` 的工厂（缺失节点重建时用；
 *                     缺省则产最小 Node 交给上层 applyNodeTypeDefaults 补结构默认）
 */
export function applyStructuralSnapshot(
  currentNodes: readonly Node[],
  currentEdges: readonly Edge[],
  snapshot: StructuralSnapshot,
  materialize?: (n: StructuralNode) => Node,
): { nodes: Node[]; edges: Edge[] } {
  const currentNodeById = new Map(currentNodes.map((n) => [String(n.id), n]));
  const nodes: Node[] = snapshot.nodes.map((s) => {
    const cur = currentNodeById.get(s.id);
    // 仍存在 → 保留当前对象（当前位置/尺寸/内容），但结构字段以快照为准（type/parentId 可能被改）
    if (cur) {
      return {
        ...cur,
        id: s.id,
        type: s.type,
        ...(s.parentId != null ? { parentId: s.parentId } : {}),
      };
    }
    // 已不存在（撤销一次删除）→ 重建。
    // 【勿漏 parentId】归属是结构的一部分：漏了会让「撤销删除编组子节点」后它变回顶层节点
    // （位置语义随之从「相对父节点」漂成「绝对坐标」）—— 实测由 structuralSnapshot.test.ts 捕获。
    const rebuilt = {
      id: s.id,
      type: s.type,
      position: { x: 0, y: 0 },
      data: {},
      ...(s.parentId != null ? { parentId: s.parentId } : {}),
    } as unknown as Node;
    return materialize ? materialize(s) : rebuilt;
  });

  const currentEdgeById = new Map(currentEdges.map((e) => [String(e.id), e]));
  const edges: Edge[] = snapshot.edges.map((s) => {
    const cur = currentEdgeById.get(s.id);
    // 边保留当前对象（可能带 selected 等会话态），结构字段以快照为准
    if (cur) {
      return {
        ...cur,
        id: s.id,
        source: s.source,
        target: s.target,
        sourceHandle: s.sourceHandle ?? null,
        targetHandle: s.targetHandle ?? null,
      };
    }
    return {
      id: s.id,
      source: s.source,
      target: s.target,
      sourceHandle: s.sourceHandle ?? null,
      targetHandle: s.targetHandle ?? null,
    };
  });

  return { nodes, edges };
}
