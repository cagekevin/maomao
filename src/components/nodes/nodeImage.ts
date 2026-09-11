/**
 * 节点「主图」唯一写入口 —— docs/118 §五 C5b（收口档 1 ③）。
 *
 * 【为什么】「把新图写回节点」此前有 **2 处各自实现**（`ImageGenerate.onImageReplaced`、
 * `AssetNode.replaceImage`），且字段已经漂移：前者只写 `imageUrl`，后者 `imageUrl` + `url` 双写。
 * 收成唯一出口后，结构上不可能再出现「某条路径忘了落盘」（历史漂移：生图节点 crop 按钮漏写 onClick）。
 *
 * ⚠️ 只做两件事：写字段 + （可选）把 dims 回传调用方自己的尺寸模型。
 * **不统一尺寸/比例逻辑**：ImageGenerate 用 fitByRatio + aspectRatio:'Auto' + editedRatioRef，
 * AssetNode 用 mediaRatio（`${w}:${h}`）——两者模型不同，硬合并会改行为。尺寸仍由调用方在
 * `afterWrite(dims)` 里处理。
 */
import type { Node } from '@xyflow/react';

export interface NodeImageWrite {
  id: string;
  dataUrl: string;
  /** 画布真实尺寸（裁剪/扩图后），回传给调用方的尺寸模型用 */
  dims?: { width: number; height: number };
  /**
   * 存量兼容开关：该节点历史上写过 `data.url`（AssetNode 渲染读 url）→ 传 true 同步写 url。
   * 读侧目前仍兼容 4 形态（getNodeImageUrl），所以本提交**不停止写 url**；
   * 「字段唯一化」属档 2（先改读侧、再停写侧），别在这里一次删干净。
   */
  legacyUrlField?: boolean;
}

/**
 * 节点「主图」唯一写入口。
 *
 * @param write          { id, dataUrl, dims?, legacyUrlField? }
 * @param setNodes       React Flow 的 setNodes（不可变更新）
 * @param afterWrite     写字段之后回调（dims 原样透传；调用方在此跑自己的尺寸模型）
 */
export function replaceNodeImage(
  { id, dataUrl, dims, legacyUrlField }: NodeImageWrite,
  setNodes: (updater: (ns: Node[]) => Node[]) => void,
  afterWrite?: (dims?: { width: number; height: number }) => void,
): void {
  if (!id || !dataUrl) return;
  setNodes((ns) =>
    ns.map((n) =>
      n.id === id
        ? {
            ...n,
            data: { ...n.data, imageUrl: dataUrl, ...(legacyUrlField ? { url: dataUrl } : {}) },
          }
        : n,
    ),
  );
  afterWrite?.(dims);
}
