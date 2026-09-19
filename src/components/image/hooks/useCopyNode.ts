import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { copyNodesToClipboard } from '@/components/base/utils/net/clipboard';
import { showToast } from '@/components/base/core/event/toastStore';

/**
 * 「复制节点」共享 hook —— 把当前节点序列化到系统剪贴板，用户自行 Ctrl+V 粘贴到画布。
 *
 * 【为什么抽出来】此前各节点的「复制」语义混乱：有的复制图片本身、有的没接。统一收口到
 * 本 hook + clipboard.copyNodesToClipboard（与 App.copySelectedNodes / buildNodesFromClipboard
 * 同一套 mutiwindow-nodes 格式），所有节点共用一个入口，避免重复实现与格式漂移。
 *
 * 【用法】节点组件调用 `const copyNode = useCopyNode();` 后，`copyNode(id)` 即复制该节点。
 * 必须在 ReactFlow 上下文内使用（节点组件天然满足）。
 *
 * @returns {(id: string) => Promise<void>} 复制指定 id 的节点；找不到节点/失败均 toast 提示。
 */
export function useCopyNode(): (id: string) => Promise<void> {
  const { getNode, getEdges } = useReactFlow();
  return useCallback(
    async (id: string) => {
      const node = getNode(id);
      if (!node) {
        showToast('找不到该节点', { type: 'error' });
        return;
      }
      const res = await copyNodesToClipboard([node], getEdges());
      showToast(res.msg, { type: res.ok ? 'success' : 'error' });
    },
    [getNode, getEdges],
  );
}
