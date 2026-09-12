import type { Edge } from '@xyflow/react';

/**
 * edge 级字段不可变写回纯函数（通用：覆盖 edge.data 与 edge 本体字段 selected/...）。
 * 语义：把 patch 浅合并进目标 edge；patch.data 单独与 e.data 浅合并（不覆盖整个 data 对象）。
 * 与 node 版 useNodeData 的 patchNodeById 同构（见 TD-04-17，2026-09-12）。
 *
 * 这是 edge.data 写回（relatedToSelected 等）与 edge 批量命令（selectAll / duplicateSelected 取消选中）
 * 的统一底层，杜绝手写 `setEdges(es => es.map(e => ...{...e, data:{...e.data, ...patch}}))` 样板
 * （同语义多实现、易漂移项）。
 *
 * 【用法】
 *   patchEdgeById(setEdges, id, { data: { relatedToSelected: true } })   // 按 id 写 edge.data
 *   computePatchEdgesById(edges, pred, { selected: true })                // 批量按条件写 edge 本体字段
 */

type EdgeFieldPatch = Partial<Edge> & { data?: Record<string, unknown> };

/** patchEdgeData：单 edge 纯函数版（按 per-edge 不同值写回时用，如 relatedToSelected 重建） */
export function patchEdgeData(e: Edge, patch: EdgeFieldPatch): Edge {
  if (!e || !patch) return e;
  const { data, ...rest } = patch;
  return { ...e, ...rest, data: data ? { ...e.data, ...data } : e.data };
}

/** computePatchEdgeById：按 id 写回，返回新数组（纯函数，不触发 setEdges） */
export function computePatchEdgeById(edges: Edge[], id: string, patch: EdgeFieldPatch): Edge[] {
  if (!edges || !id || !patch) return edges;
  const { data, ...rest } = patch;
  return edges.map((e) =>
    e.id === id ? { ...e, ...rest, data: data ? { ...e.data, ...data } : e.data } : e,
  );
}

/** computePatchEdgesById：批量版（predicate 命中即写回，用于「按条件」批量命令，如选中态/取消选中） */
export function computePatchEdgesById(
  edges: Edge[],
  predicate: (e: Edge) => boolean,
  patch: EdgeFieldPatch,
): Edge[] {
  if (!edges || !predicate || !patch) return edges;
  const { data, ...rest } = patch;
  return edges.map((e) =>
    predicate(e) ? { ...e, ...rest, data: data ? { ...e.data, ...data } : e.data } : e,
  );
}

export function patchEdgeById(
  setEdges: (updater: (es: Edge[]) => Edge[]) => void,
  id: string,
  patch: EdgeFieldPatch,
): void {
  if (!setEdges || !id || !patch) return;
  setEdges((es) => computePatchEdgeById(es, id, patch));
}

export function patchEdgesById(
  setEdges: (updater: (es: Edge[]) => Edge[]) => void,
  predicate: (e: Edge) => boolean,
  patch: EdgeFieldPatch,
): void {
  if (!setEdges || !predicate || !patch) return;
  setEdges((es) => computePatchEdgesById(es, predicate, patch));
}
