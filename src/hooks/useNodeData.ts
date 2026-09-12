import { useCallback, useEffect, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { debounce } from '../components/base/core/utils.ts';
import { NODE_PATCH_DEBOUNCE_MS } from '../components/base/core/config.ts';

/**
 * 节点级字段不可变写回纯函数（通用：覆盖 node.data 与 node 本体字段 width/height/style/selected/...）。
 * 语义：把 patch 浅合并进 id 节点；patch.data 单独与 n.data 浅合并（不覆盖整个 data 对象）。
 * 节点不存在时原样返回，天然安全。这是 useNodeResize / App 批量命令 / 各节点写回的统一底层，
 * 与 patchNodeDataById 共用同一不可变不变式（见 TD-04-16，2026-09-12）。
 *
 * 【用法】
 *   patchNodeById(setNodes, id, { width, height, style })   // node 本体字段
 *   patchNodeById(setNodes, id, { data: { label } })        // 等价于 patchNodeDataById
 */
type NodeFieldPatch = Partial<Node> & { data?: Record<string, unknown> };

/** computePatchNodeById：纯函数版（返回新数组，不触发 setNodes），供需先拿到结果再 record 历史的调用方复用 */
export function computePatchNodeById(nodes: Node[], id: string, patch: NodeFieldPatch): Node[] {
  if (!nodes || !id || !patch) return nodes;
  const { data, ...rest } = patch;
  return nodes.map((n) =>
    n.id === id ? { ...n, ...rest, data: data ? { ...n.data, ...data } : n.data } : n,
  );
}

/** computePatchNodesById：批量版（predicate 命中即写回，用于「按类型/条件」批量命令，如展开面板） */
export function computePatchNodesById(
  nodes: Node[],
  predicate: (n: Node) => boolean,
  patch: NodeFieldPatch,
): Node[] {
  if (!nodes || !predicate || !patch) return nodes;
  const { data, ...rest } = patch;
  return nodes.map((n) =>
    predicate(n) ? { ...n, ...rest, data: data ? { ...n.data, ...data } : n.data } : n,
  );
}

export function patchNodeById(
  setNodes: (updater: (ns: Node[]) => Node[]) => void,
  id: string,
  patch: NodeFieldPatch,
): void {
  if (!setNodes || !id || !patch) return;
  setNodes((ns) => computePatchNodeById(ns, id, patch));
}

/**
 * 节点 data 不可变写回纯函数（节点 data 写回唯一入口，useNodeData.patchData 与宿主通用写回共用）。
 * 语义：把 patch 合并进 id 节点的 data（不可变更新）；节点不存在（如已删除）时原样返回，天然安全。
 * 底层复用通用 patchNodeById（见上），保持既有签名向后兼容。
 * setNodes 用 reactflow Node[] 泛型（与 useReactFlow().setNodes 及 App.jsx 传入的 setNodes 一致）。
 */
export function patchNodeDataById(
  setNodes: (updater: (ns: Node[]) => Node[]) => void,
  id: string,
  patch: Record<string, unknown>,
): void {
  if (!setNodes || !id || !patch) return;
  patchNodeById(setNodes, id, { data: patch });
}

/** patch 载荷（节点 data 局部字段合并对象） */
type Patch = Record<string, unknown>;
/** useNodeData.patchDebounced 返回形态（utils.debounce 的结构化子集，仅本模块用，就地定义） */
type PatchDebouncedFn = {
  (patch: Patch): void;
  cancel(): void;
  flush(): void;
};

/**
 * 节点 data 统一写回 hook（P0-2 收口）。
 *
 * 【为什么要有它】此前每个节点手写同一份「不可变局部更新 node.data」样板
 *   const patchData = useCallback((patch) => setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)), [id])
 *   + 同款 debouncedPatch（debounce(patchData, 200)）。实测 6+ 处逐字重复
 *   （TextGenerate / VideoGenerate / ImageGenerate / TemplateNode / LoopNode / ImageBoxNode）。
 * 本 hook 统一收口，节点只需 `const { patchData, patchDebounced } = useNodeData(id)`。
 *
 * 【用法】
 *   const { patchData, patchDebounced } = useNodeData(id)
 *   patchData({ imageUrl: r.url })                 // 立即写回（成功/确认回填等关键路径）
 *   patchDebounced({ prompt })                      // 防抖写回（编辑器高频输入用）
 *
 * 【说明】
 *  - patchData 稳定性：setNodes（reactflow）与 id 均为稳定引用 → patchData 引用稳定，
 *    一次 useMemo 构造的防抖即可复用，无需每次渲染重建。
 *  - patchDebounced 卸载时自动 flush：把窗口内最后一次待提交写出，避免丢数据。
 *  - 必须在 ReactFlowProvider 树内调用（经 useReactFlow 取 setNodes），节点天然满足。
 *  - 纯逻辑不写 UI，可覆盖单测（patchData 不可变更新 / patchDebounced 防抖 + flush）。
 */
export function useNodeData(id: string): {
  patchData: (patch: Patch) => void;
  patchDebounced: PatchDebouncedFn;
} {
  const { setNodes } = useReactFlow();
  const patchData = useCallback<(patch: Patch) => void>(
    (patch) => patchNodeDataById(setNodes, id, patch),
    [id, setNodes],
  );
  const patchDebounced = useMemo(() => debounce(patchData, NODE_PATCH_DEBOUNCE_MS), [patchData]);
  useEffect(() => () => patchDebounced.flush(), [patchDebounced]);
  return { patchData, patchDebounced };
}
