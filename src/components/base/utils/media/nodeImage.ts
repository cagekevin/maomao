/**
 * 节点「主图」唯一写入口 —— docs/118 §五 C5b（收口档 1 ③）+ §7.3 ⑤（档 2 字段唯一化）。
 *
 * 【物理位置 · 2026-09-25 收口后重判】`base/utils/media/`（**横切层**）。
 *  判据 = `ADR-0040`：零业务语义（"写一份新图进主图字段 + 让旧身份失效"）**且**消费方跨 ≥2 域。
 *  实测消费域 = **3 个**：`image`（AssetNode / ImageGenerate / PanoramaNode / GridMergeNode）·
 *  `canvas`（Director3DNode）· `agent`（canvasPlanExecutor）。
 *  ⇒ 放 `image/lib/`（当时只有 image 一个消费域时的裁定）会让 canvas/agent **域外直连内部件**，
 *    而 `image/` **没有域门面**（`src/components/image/` 下无 `index.ts`）⇒ 只能靠横切层消解。
 *  同址理由：**读侧**「媒体字段解析」`resolveAssetDisplayUrl` 就在同目录 `assetUrl.ts` —— 读写同族同处。
 *  历史：本件原在 `base/`，被「域归位」按**当时的**单域事实迁去 `image/lib/`；收口改变事实后迁回。
 *
 *  ⚠️ 2026-09-25 回改：原头注写「避免节点间横向互引（触发 audit `no-cross`）」—— **该 audit 全仓不存在**
 *  （悬空引用，M4 描述层无对账），已删；真实理由是上面那条归属判据。
 *
 * 【为什么】「把新图写回节点」此前有 **2 处各自实现**（`ImageGenerate.onImageReplaced`、
 * `AssetNode.replaceImage`），且字段已经漂移：前者只写 `assetUrl`，后者 `assetUrl` + `url` 双写。
 * 收成唯一出口后，结构上不可能再出现「某条路径忘了落盘」（历史漂移：生图节点 crop 按钮漏写 onClick）。
 *
 * 【字段唯一化（分层收口，2026-09-11）】
 *  - **写侧只写 `assetUrl`**：`data.url` 双写已删除（本文件不再提供 legacyUrlField 开关）。
 *  - **读侧仍保留 `url` 兜底**（`resolveAssetDisplayUrl` 的第 ③ 顺位；全仓读取一律经它）：
 *    存量快照里真有只带 `url` 的节点，删读兜底 = 存量破图。收口顺序就是「先读兼容、再停写值」。
 *  ⚠️ 2026-09-25：读侧「媒体地址解析」已收口为 `assetUrl.ts::resolveAssetDisplayUrl` 一处 ——
 *    `getNodeAssetUrl` / `getNodeMedia`（`base/utils/media/nodeMedia.ts`）与 `App.copyNodeImage`
 *    一律**委托**它，不再各自嗅探字段（母体见 `nodeMedia.ts` 头注：TD-14-2 / TD-16-23）。
 *
 * ⚠️ 只做三件事：写字段 + **让旧内容的身份失效**（清 `contentId`，见下）+ （可选）把 dims 回传调用方自己的尺寸模型。
 * **不统一尺寸/比例逻辑**：ImageGenerate 用 fitByRatio + aspectRatio:'Auto' + editedRatioRef，
 * AssetNode 用 mediaRatio（`${w}:${h}`）——两者模型不同，硬合并会改行为。尺寸仍由调用方在
 * `afterWrite(dims)` 里处理。
 *
 * 【主图写回的完整语义（2026-09-25 补）】写新图**不只是**写 `assetUrl` —— 必须让「读侧会抢先命中的
 * 旧字段」一起失效，否则新图写了也读不到（见函数内长注）。
 */
import type { Node } from '@xyflow/react';
import { patchNodeDataById } from '@/hooks/useNodeData';

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
  patchNodeDataById(setNodes, id, {
    assetUrl: dataUrl,
    // 【主图换新 ⇒ 旧内容的身份必须失效 · 2026-09-25 修（用户实测：「原图纹丝不动」）】
    // 读侧 `resolveAssetDisplayUrl` 优先级 = `contentId > assetUrl > url`，新图写在 `assetUrl` 这一格；
    // `patchNodeDataById` 是**浅合并**（旧字段不丢）⇒ 排在它前面的旧身份字段必须一并清掉，否则：
    //  · 旧 `contentId`（指向**被替换掉的那张图**）→ 经 resource 解析出**旧图 url** ⇒ 显示原图不变。
    //    实证：素材库拖入 / 拖文件建的节点带 contentId（那张 JPG 的 sha1）⇒ 抠图后的透明 PNG 写进了
    //    assetUrl 却永远读不到，界面上仍显示 JPG（用户观察到的「JPG 换 PNG 还是显 JPG」即此）。
    //  · 旧 `url`（存量双写遗留）→ 排在 `assetUrl` 之后**不再短路**（2026-09-25 已回改读侧顺序），
    //    但仍属「旧内容的身份」⇒ 一并清，保持"写新图 = 旧身份整体失效"这条不变式的完整。
    // 要用新身份时由调用方经 `dataPatch` 显式写（如「上传换图」传新 contentId）—— 它排在后面，可覆盖本行。
    contentId: undefined,
    url: undefined,
    ...(dataPatch || {}),
  });
  afterWrite?.(dims);
}

/**
 * 清空节点「主图」（切文本态 / 封面无内容）—— 与写新图**同一条不变式**。
 *
 * ⚠️ 读侧 `resolveAssetDisplayUrl` 优先级 = `contentId > url > assetUrl` ⇒ **只清 `assetUrl` 会被
 * 更高优先级的旧字段读回旧图**。实证（2026-09-25 同轮）：`AssetNode` 切文本态只清了 `assetUrl`/`url`，
 * **漏清 `contentId`** ⇒ 文本态节点仍显示旧图（它注释里还写着"两者都必须清"—— 那份知识已过期，
 * `contentId` 才是第一优先级）。故三者必须一并清。
 *
 * @param dataPatch 同一次不可变更新要合并的其它字段（如 `{ assetType: 'text', text }`）
 */
export function clearNodeMainImage(
  id: string,
  setNodes: (updater: (ns: Node[]) => Node[]) => void,
  dataPatch?: Record<string, unknown>,
): void {
  if (!id) return;
  patchNodeDataById(setNodes, id, {
    assetUrl: undefined,
    url: undefined,
    contentId: undefined,
    ...(dataPatch || {}),
  });
}
