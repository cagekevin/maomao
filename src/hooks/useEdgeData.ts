import type { Edge } from '@xyflow/react';

/**
 * edge 级字段不可变写回纯函数（通用：覆盖 edge.data 与 edge 本体字段 selected/...）。
 * 语义：把 patch 浅合并进目标 edge；patch.data 单独与 e.data 浅合并（不覆盖整个 data 对象）。
 * 与 node 版 useNodeData 的 patchNodeById 同构（见 TD-04-17，2026-09-12）。
 *
 * 这是 edge.data 写回（relatedToSelected 等）与 edge 批量命令（selectAll / duplicateSelected 取消选中）
 * 的统一底层，杜绝手写 `setEdges(es => es.map(e => ...{...e.data, ...patch}))` 样板
 * （同语义多实现、易漂移项）。
 *
 * 【用法】
 *   patchEdgeData(e, { data: { relatedToSelected: true } })     // 单 edge（按 per-edge 不同值重建时用）
 *   computePatchEdgesById(edges, pred, { selected: true })      // 批量按条件写 edge 本体字段
 *
 * ★清理（2026-09-14）：删掉三个**零引用**的 `setEdges` 包装层
 * （`patchEdgeById` / `patchEdgesById` / 其私有依赖 `computePatchEdgeById`）。
 * 它们与上面的纯函数版**同语义**，但全库 0 处 import（实测：唯一的消费方 `App.tsx:28`
 * 只取 `computePatchEdgesById` + `patchEdgeData`）——
 * 属「收口时顺手留的对称 API，实际没人用」的预支接口（7 步法 A8）。
 * 保留原因若将来出现「需要直接 setEdges 的调用点」，那时再加（届时它**有**消费方，就不是死代码）。
 */

type EdgeFieldPatch = Partial<Edge> & { data?: Record<string, unknown> };

/** patchEdgeData：单 edge 纯函数版（按 per-edge 不同值写回时用，如 relatedToSelected 重建） */
export function patchEdgeData(e: Edge, patch: EdgeFieldPatch): Edge {
  if (!e || !patch) return e;
  const { data, ...rest } = patch;
  return { ...e, ...rest, data: data ? { ...e.data, ...data } : e.data };
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
