import type { Node } from '@xyflow/react';
import {
  getNodeMedia,
  type ContentUrlResolver,
  type MediaType,
} from '@/components/base/utils/media/nodeMedia';

/* ════════════════════════════════════════════════════════════════
 * 选中派生产物（**画布语义** · 纯函数，零 React / 零 store 依赖）
 * ────────────────────────────────────────────────────────────────
 * 【为什么留在这里（2026-09-25 按件切）】
 * 本文件与 `base/utils/media/nodeMedia.ts` 原先同居 `canvas/lib/nodeMedia.ts`（一个文件两族东西）。
 * 「节点主媒体读取」只依赖 Node 数据形态 ⇒ 属**横切**，已迁 `base/utils/media/`；
 * 而本文件依赖 `node.selected` + `node.position` = **ReactFlow 画布语义** ⇒ 留在画布域。
 * 判据：**横切层不得依赖业务域；域依赖横切是正确单向**。
 * ════════════════════════════════════════════════════════════════ */

/** 选中派生产物：「选中且带媒体」节点的只读投影（AgentPanel 待发送区消费） */
export interface SelectedAsset {
  nodeId: string;
  nodeType: string | undefined;
  label: string;
  type: MediaType;
  url: string;
  x: number;
  y: number;
}

/**
 * 从 nodes **实时派生**「选中的带媒体节点」列表（纯函数）。
 *
 * 单一事实来源 = `nodes[].selected` + `data` —— 取代原「App 手工副本 + updater 内副作用同步」
 * （TD-04-24/27）。任何导致选中集变化的路径（点击选中、删除节点、undo/redo 写回）都会让
 * `nodes` 变化，调用方以「提交后 effect」重算即可覆盖全部路径，无需逐路径补同步点。
 *
 * 除 nodeId/type/label/url 外，一并带出画布坐标 position(x/y) 与媒体类型 type（对齐参考项目
 * daxiong-canvas-plugins canvas-agent agentBuildAttachmentsFromNodes）：让 LLM 感知参考素材
 * 来自画布哪个位置、是什么形态。
 *
 * @param resolveContentUrl contentId → resource url 解析器（媒体地址真源在 resource 表，由调用方注入）
 */
export function deriveSelectedAssets(
  nodes: Node[] | null | undefined,
  resolveContentUrl: ContentUrlResolver,
): SelectedAsset[] {
  return (nodes || [])
    .filter((n) => n.selected)
    .map((n) => {
      const media = getNodeMedia(n, resolveContentUrl);
      const label = (n.data?.label ?? n.data?.projectName ?? '') as string;
      return {
        nodeId: n.id,
        nodeType: n.type,
        label: label || '',
        type: media.type,
        url: media.url,
        x: Number(n.position?.x) || 0,
        y: Number(n.position?.y) || 0,
      };
    })
    .filter((a) => a.url);
}

/**
 * 选中资产的「内容签名」。只含 nodeId/type/url —— **不含 x/y**：
 * 拖动节点会让 `nodes` 每帧变化，若签名含坐标则每帧都判定「变了」→ 每帧回写 state → 下游（AgentPanel）
 * 每帧重渲（历史上曾 OOM）。坐标不参与签名，保证拖动期间引用稳定。
 */
export function selectedAssetSig(list: SelectedAsset[]): string {
  return (list || []).map((a) => `${a.nodeId}:${a.type}:${a.url}`).join('|');
}

/* 【2026-09-25 删除 · 清剿尾巴】此处原有 `selectedNodeIdsOfSig`（`selectedAssetSig` 的逆运算，
 * 自称给「剪辑器入轨」用）。取证：唯一消费者是 videoEditor 入轨，而它已随
 * `a3ffc5d0 chore: 移除 videoEditor 的 _legacy 遗留代码` 被移除 —— **函数被留下了**。
 * 全仓零生产消费（`mv-sync-refs refs` + grep + 基线三处一致，只剩自证测试）⇒ 按 `ADR-0053`
 * 第 ② 关（判存在性）+ Step 6「清剿尾巴」判死 → 删；连带删掉它的自证测试（`ADR-0049`／§7.2 形态④）。 */

/**
 * 选中节点 id 的签名（排序后拼串）。供「边关联态（relatedToSelected）」effect 用：
 * 只在**选中集真的变化**时重算边，拖动/挪点时跳过（避免每帧遍历 edges）。
 */
export function selectedNodeIdSig(nodes: Node[] | null | undefined): string {
  return (nodes || [])
    .filter((n) => n.selected)
    .map((n) => n.id)
    .sort()
    .join('|');
}
