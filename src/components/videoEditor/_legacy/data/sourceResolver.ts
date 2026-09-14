/**
 * 素材 URL **唯一出口** —— `docs/123` §一.2 R1 + §二.7 P4 · `docs/120` C3。
 *
 * ── 它解决的那个母体 ──
 * 「这个片段能不能读」与「读它的 URL 是什么」如果各自实现，必然漂（一处说能读、一处说读不到）。
 * 故本模块**一个原语同时回答这两问**（`docs/123` §二.7 P4 的裁定）：
 * 返回 `{ status:'ok', url }` 或 `{ status:'broken', reason }`，**没有第三个判点**。
 *
 * ── 三源归一（C3）──
 *  1. `sourceUrl`：画布节点产物 URL / 本机导入落盘 `/files/…`（入轨时就已存为 `sourceUrl`）；
 *  2. `assetId`：素材库资源，**经素材库记录解析**（不是裸拼路径）；
 *  3. 两者皆不可用 → **断链**（处置只走 `docs/120` C13：片段红标 = 持续状态，不是 toast）。
 *
 * `nodeId` **不参与寻址**（`docs/123` §一.2 R2：只读溯源标记）。
 * 因此「来源画布节点被删」**不会**把片段判成断链 —— `sourceUrl` 在入轨时已持久化（§一.9 Q5：
 * 节点消失只提示不判红）。
 *
 * ── 为什么不用 `resolveAssetUrl(scope:'render')` 这个"统一出口" ──
 * `base/utils/assetUrl.ts` 的 `resolveAssetUrl` 在 `scope:'render'` 下会把**任何**本地文件 URL
 * 改写成按需出图端点 `/files/thumbnail?url=…`（`assetUrl.ts:179`）—— 那个端点由 Jimp 出图，
 * **只服务图片**（`SUPPORTED_THUMB_FORMATS` 白名单）。剪辑器要的是**原文件**
 * （预览播放 + 导出搬运），把视频 URL 交给出图端点会静默拿到错误结果。
 * 故此处用更底层的 `toAbsoluteFileUrl`（相对 `/files/` → 可访问绝对地址，其余原样）。
 */
import { toAbsoluteFileUrl } from '../../base/core/utils.ts';
import { getResources } from '../../base/store/resourceStore.ts';

/**
 * 素材可读性判定所需的**最小字段**（窄结构类型：`videoEditor/core` 的 `Clip` 天然满足，
 * 无需 data 层反向依赖 core 的完整模型）。
 */
export interface ClipSourceRef {
  sourceUrl?: string;
  /** 素材库资源 id（`Resource.id`）。 */
  assetId?: string;
  /** 来源画布节点 id —— **只读溯源，不参与解析**。 */
  nodeId?: string;
}

/**
 * 探测结果（由探测层 `hooks/useEditorSources` 产生，见 `docs/120` C3.2）。
 * 传进来是为了让「断链」只有一个裁决点：**探测失败也是断链的一个触发点**（§一.9 Q5）。
 */
export type SourceProbe = { status: 'ok' } | { status: 'failed'; reason: string };

/** 解析结果：能读 → `ok`；读不到 → `broken`（带原因，供 UI tooltip 与日志）。 */
export type ClipSource = { status: 'ok'; url: string } | { status: 'broken'; reason: string };

/**
 * 解析片段素材地址 = **判定可读性**（同一件事实）。
 *
 * @param ref   片段来源引用（`sourceUrl` / `assetId` / `nodeId`）
 * @param probe 探测结果；缺省表示「尚未探测」（此时只做结构判定，不假装知道能不能读）
 */
export function resolveClipSource(ref: ClipSourceRef, probe?: SourceProbe): ClipSource {
  const structural = resolveStructural(ref);
  if (structural.status === 'broken') return structural;
  if (probe?.status === 'failed') {
    return { status: 'broken', reason: `素材读取失败：${probe.reason}` };
  }
  return structural;
}

function resolveStructural(ref: ClipSourceRef): ClipSource {
  const direct = typeof ref.sourceUrl === 'string' ? ref.sourceUrl.trim() : '';
  if (direct) return { status: 'ok', url: toAbsoluteFileUrl(direct) };

  const assetId = typeof ref.assetId === 'string' ? ref.assetId.trim() : '';
  if (assetId) {
    const hit = getResources().find((r) => r.id === assetId);
    if (hit && typeof hit.url === 'string' && hit.url) {
      return { status: 'ok', url: toAbsoluteFileUrl(hit.url) };
    }
    return { status: 'broken', reason: `素材库中找不到该资源（assetId=${assetId}）` };
  }

  return { status: 'broken', reason: '片段没有素材来源（sourceUrl / assetId 均为空）' };
}
