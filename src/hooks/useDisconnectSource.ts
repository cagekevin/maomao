import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

/**
 * 断开「某上游节点 → 本节点」的连线：删除 `source === sourceNodeId && target === 本节id` 的边。
 *
 * 【为什么要有它】同一段「按 (source, target) 对过滤删除入边」的回调在 4 个节点逐字重复
 *   （ImageGenerate / ScriptBoxNode / TextGenerate / VideoGenerate），仅 TS 类型标注有无之差：
 *     const disconnectSource = useCallback((sourceNodeId) => {
 *       if (!sourceNodeId) return;
 *       setEdges((es) => es.filter((e) => !(e.source === sourceNodeId && e.target === id)));
 *     }, [id, setEdges]);
 *   属「同一语义多实现」（CLAUDE §5.4·9 单一规则原则），收敛为本 hook。
 *
 * 【用法】点击只读素材区/上游缩略图的红色 ✕ →
 *   const disconnectSource = useDisconnectSource(id);
 *   onClick={() => disconnectSource(otherNodeId)}
 *
 * 【边界】只删边、不动节点/历史（与各节点原实现逐字等价，非破坏）。
 *   必须在 ReactFlowProvider 树内调用（经 useReactFlow 取 setEdges），节点天然满足。
 */
export function useDisconnectSource(nodeId: string): (sourceNodeId: string | undefined) => void {
  const { setEdges } = useReactFlow();
  return useCallback(
    (sourceNodeId: string | undefined) => {
      if (!sourceNodeId) return;
      setEdges((es) => es.filter((e) => !(e.source === sourceNodeId && e.target === nodeId)));
    },
    [nodeId, setEdges],
  );
}
