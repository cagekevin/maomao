import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { patchNodeDataById } from './useNodeData.ts';

/**
 * 节点标题改名 → 写回 data.label（下游 @名 匹配 / 素材条显示跟随）。节点 data 写回唯一实现。
 *
 * 【为什么要有它】同一段样板在 8 个节点里逐字重复（连注释都是复制的）：
 *   const rename = useCallback((name) => setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, label: name } } : n)), [id, setNodes]);
 *   （VideoProcessNode / VideoGenerate / PanoramaNode / LoopNode / ImageGenerate /
 *     FaceMosaicNode / Director3DNode / AssetNode）
 * 本 hook 复用 useNodeData 的不可变写回纯函数 patchNodeDataById，节点只需：
 *   const rename = useNodeRename(id);
 *
 * 【说明】
 *  - 不直接复用 useNodeData(id).patchData：那会为每个节点多建一个防抖实例 + 卸载 flush effect，
 *    而改名是低频即时写回，不需要防抖。
 *  - 必须在 ReactFlowProvider 树内调用（经 useReactFlow 取 setNodes），节点天然满足。
 *  - 节点不存在（已删除）时 patchNodeDataById 原样返回，天然安全。
 */
export function useNodeRename(id: string): (name: string) => void {
  const { setNodes } = useReactFlow();
  return useCallback(
    (name: string) => patchNodeDataById(setNodes, id, { label: name }),
    [id, setNodes],
  );
}
