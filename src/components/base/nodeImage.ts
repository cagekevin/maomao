/**
 * 节点「主图」唯一写入口 —— docs/118 §五 C5b（收口档 1 ③）+ §7.3 ⑤（档 2 字段唯一化）。
 *
 * 【物理位置】坐落于 `src/components/base/`（通用地基），由各 image 节点（ImageGenerate / AssetNode …）
 * 向地基单向依赖。这是刻意的收敛点：把「写回主图」的唯一逻辑收口到地基，避免节点间横向互引
 * （触发 audit `no-nodes-cross`），也避免多节点各自实现导致字段漂移（历史：crop 按钮漏写 onClick）。
 *
 * 【为什么】「把新图写回节点」此前有 **2 处各自实现**（`ImageGenerate.onImageReplaced`、
 * `AssetNode.replaceImage`），且字段已经漂移：前者只写 `assetUrl`，后者 `assetUrl` + `url` 双写。
 * 收成唯一出口后，结构上不可能再出现「某条路径忘了落盘」（历史漂移：生图节点 crop 按钮漏写 onClick）。
 *
 * 【字段唯一化（分层收口，2026-09-11）】
 *  - **写侧只写 `assetUrl`**：`data.url` 双写已删除（本文件不再提供 legacyUrlField 开关）。
 *  - **读侧仍保留 `url` 兜底**（AssetNode 渲染 / getNodeAssetUrl / App.copyNodeImage）：
 *    存量快照里真有只带 `url` 的节点，删读兜底 = 存量破图。收口顺序就是「先读兼容、再停写值」。
 *
 * ⚠️ 只做两件事：写字段 + （可选）把 dims 回传调用方自己的尺寸模型。
 * **不统一尺寸/比例逻辑**：ImageGenerate 用 fitByRatio + aspectRatio:'Auto' + editedRatioRef，
 * AssetNode 用 mediaRatio（`${w}:${h}`）——两者模型不同，硬合并会改行为。尺寸仍由调用方在
 * `afterWrite(dims)` 里处理。
 */
import type { Node } from '@xyflow/react';
import { patchNodeDataById } from '../../hooks/useNodeData.ts';

export interface NodeImageWrite {
  id: string;
  dataUrl: string;
  /** 画布真实尺寸（裁剪/扩图后），回传给调用方的尺寸模型用 */
  dims?: { width: number; height: number };
  /**
   * 额外要合并进 `node.data` 的字段（与主图同一次不可变更新写下去）。
   * 典型场景：「上传替换节点内容」要同时把 `assetType`/`text` 置空，交回 `detectAssetType` 按 URL 判定。
   * 值写 `undefined` = **清空**该字段（JSON.stringify 落盘时自然消失）。
   */
  dataPatch?: Record<string, unknown>;
}

/**
 * 节点「主图」唯一写入口。
 *
 * @param write          { id, dataUrl, dims?, dataPatch? }
 * @param setNodes       React Flow 的 setNodes（不可变更新）
 * @param afterWrite     写字段之后回调（dims 原样透传；调用方在此跑自己的尺寸模型）
 */
export function replaceNodeImage(
  { id, dataUrl, dims, dataPatch }: NodeImageWrite,
  setNodes: (updater: (ns: Node[]) => Node[]) => void,
  afterWrite?: (dims?: { width: number; height: number }) => void,
): void {
  if (!id || !dataUrl) return;
  patchNodeDataById(setNodes, id, { assetUrl: dataUrl, ...(dataPatch || {}) });
  afterWrite?.(dims);
}
