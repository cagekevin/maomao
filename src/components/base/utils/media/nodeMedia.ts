import type { Node } from '@xyflow/react';
import { classifyUrl } from '@/components/base/utils/media/assetType';
import { resolveAssetDisplayUrl } from '@/components/base/utils/media/assetUrl';
import { isMediaRefType, type MediaRefAssetType } from '@/types';

/* ════════════════════════════════════════════════════════════════
 * 节点「主媒体」读取（**横切层** · 纯函数，零 React / 零 store 依赖）
 * ────────────────────────────────────────────────────────────────
 * 【为什么与 `assetUrl.ts` / `nodeImage.ts` 同址（2026-09-25 按件切）】
 * 「读」与「写」是同一条判据的两个方向：**写侧清掉旧身份，正因为读侧按优先级认身份**。
 *   - 读（渲染解析）· `assetUrl.ts::resolveAssetDisplayUrl`
 *   - 写（唯一入口）· `nodeImage.ts::replaceNodeImage` / `clearNodeMainImage`
 *   - 读（主媒体投影）· 本文件 —— 三者同处 `base/utils/media/`（横切）。
 * 本件此前住 `canvas/lib/`：`docs/plan/136` §一、`canvasSource.ts` 头注、本文件旧头注**三处都写
 * `base/utils/nodeMedia.ts`**，唯独文件不在那儿（M4 描述层无对账）⇒ 本次把事实改回描述。
 * 只留「读」；「选中派生」（依赖 `node.selected` + `position` = **画布语义**，非横切）
 * 已按件切去 `canvas/lib/selectedAssets.ts`（域依赖横切，单向合法）。
 *
 * 【字段优先级 · 唯一判据在 `resolveAssetDisplayUrl`】
 * 本文件**不再自己定顺序** —— 旧实现是 `assetUrl > url` 且**不认识 `contentId`**：
 * 同一个「节点主媒体地址」于是有两份判据（且顺序相反），造成两笔已登账事故：
 *   · TD-14-2：`useConnectedInputs` 读不到 contentId 型产出 ⇒ 上游缩略图静默空白；
 *   · TD-16-23：`canvasSource` 静默漏「只持 contentId 的文件型节点」⇒ 画布来源少节点且零日志。
 * 两次都是在**消费方各绕一次**，母体未治 ⇒ 收口为「全部委托唯一入口」。
 * ════════════════════════════════════════════════════════════════ */

/** contentId → resource url 的解析器（由调用方注入，如 `buildContentUrlResolver(getResources())`）。
 *  **必填**：可选就会有人不传 ⇒ 静默读不到 contentId 型节点 —— 那正是本次要消灭的母体。 */
export type ContentUrlResolver = (contentId: string) => string | null;

/**
 * 提取节点「主图 URL」（纯函数，供 AgentPanel / App 引用带图节点用）。
 *
 * 字段优先级**委托** `resolveAssetDisplayUrl`（`contentId > assetUrl > url`）；本函数只在其上补
 * **多图节点的字段形态映射**（`data.images` / `data.assetUrls` 数组，元素兼容字符串与 `{url}`/`{assetUrl}`）。
 * 无图返回空串。
 */
export function getNodeAssetUrl(node: Node | null, resolveContentUrl: ContentUrlResolver): string {
  const d = (node?.data || {}) as Record<string, unknown>;
  // ① 单字段形态：唯一判据（含 contentId → resource url 一跳）
  const single = resolveAssetDisplayUrl(d, resolveContentUrl);
  if (single.kind === 'ok') return single.url;
  // ② 多图形态（imageBoxNode）：**字段形态映射，不是第二份优先级判据** —— 优先级仍只有 ① 那一处
  for (const key of ['images', 'assetUrls']) {
    const arr = Array.isArray(d[key]) ? (d[key] as unknown[]) : [];
    for (const item of arr) {
      if (typeof item === 'string' && item) return item;
      if (item && typeof item === 'object') {
        const o = item as { url?: unknown; assetUrl?: unknown };
        const u =
          (typeof o.url === 'string' && o.url) ||
          (typeof o.assetUrl === 'string' && o.assetUrl) ||
          '';
        if (u) return u;
      }
    }
  }
  return '';
}

export type MediaType = MediaRefAssetType | '';

/**
 * 提取节点的「主媒体」（纯函数，供 AgentPanel 待发送区 / 可引用媒体源消费）。
 * 与 getNodeAssetUrl 的区别：视频/音频节点返回【本体】URL 而非封面图，并标记媒体类型。
 * 判定顺序（对齐 AssetNode：`data.assetType || detectAssetType`）：
 *   1. 显式 `data.assetType==='video'|'audio'` → 取本体 url（videoUrl/audioUrl/url/assetUrl）；
 *   2. 存在 `data.videoUrl` / `data.audioUrl` → 判 video / audio（视频生成/提取/处理等节点）；
 *   3. 退化为主图（`getNodeAssetUrl` → 唯一读入口，**认 `contentId`**）→ 按扩展名判型。
 * 只返回可作 AI 多模态上下文的媒体（image / video / audio），text / 空返回 `{ type:'', url:'' }`。
 */
export function getNodeMedia(
  node: Node | null,
  resolveContentUrl: ContentUrlResolver,
): { type: MediaType; url: string } {
  const d = (node?.data || {}) as {
    assetType?: string;
    videoUrl?: string;
    audioUrl?: string;
    url?: string;
    assetUrl?: string;
    [k: string]: unknown;
  };
  let explicit: MediaRefAssetType | '' = '';
  let url = '';
  // 「声明了 video/audio 本体」= 可引用媒体白名单派生（image 走主图字段，不取本体字段）
  if (isMediaRefType(d.assetType) && d.assetType !== 'image') {
    explicit = d.assetType;
    url = d.videoUrl || d.audioUrl || d.url || d.assetUrl || '';
  } else if (typeof d.videoUrl === 'string' && d.videoUrl) {
    explicit = 'video';
    url = d.videoUrl;
  } else if (typeof d.audioUrl === 'string' && d.audioUrl) {
    explicit = 'audio';
    url = d.audioUrl;
  }
  if (url) return { type: explicit || classifyUrl(url), url };
  const image = getNodeAssetUrl(node, resolveContentUrl);
  if (!image) return { type: '', url: '' };
  return { type: classifyUrl(image), url: image };
}
