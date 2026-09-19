/**
 * 来源 provider · 画布（`source='canvas'`）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【本文件只做映射，不重实现】（docs/136 §一 普查结论 ①–⑦ 全部复用）
 *  · 取节点媒体：复用 `base/utils/nodeMedia.ts::getNodeMedia`（**只取主媒体**，
 *    与 AgentPanel 待发送区口径一致）；
 *  · 解析 contentId → resource.url：复用 `base/utils/assetUrl.ts::resolveAssetDisplayUrl`
 *    （处理 `contentId`/`url`/`assetUrl` 三形态互斥，**禁止**在此重写字段嗅探）；
 *  · URL 归一：复用 `base/core/utils.ts::toAbsoluteFileUrl`。
 *
 * 【为什么画布节点的 url 也要过 resolveAssetDisplayUrl】
 * 节点 data 可能是「文件型」（只持 contentId，url 由 resource 反查）—— 直接用
 * `getNodeMedia` 拿不到 url 时会退化为空，故用显示解析入口兜底。
 * ════════════════════════════════════════════════════════════════
 *
 * 【已知保守取舍（docs/136 §5.5 / R1）】
 * `imageBoxNode` 可能有多张图（`data.images[]`），本轮**只取主媒体**
 * （① 与 AgentPanel 一致；② 展开多图是行为扩展，不该在收口层擅自决定）。
 * 若将来要展开，应在 `nodeMedia.ts` 加 `getNodeMediaList`（**扩真源，不在此旁路**）。
 */
import { getNodeMedia } from '../../utils/nodeMedia.ts';
import { resolveAssetDisplayUrl, buildContentUrlResolver } from '../../utils/assetUrl.ts';
// 媒体类型判定的**唯一真值源**（禁在此内联重写扩展名嗅探；check-arch 有反向判据）
import { classifyAssetUrlKind } from '../../utils/assetType.ts';
import { toAbsoluteFileUrl } from '../../core/utils.ts';
import { logger } from '../../core/logger.ts';
import { getResources } from '@/components/resource/resourceStore';
import { getCanvasNodesSnapshot } from '../canvasNodesBridge.ts';
import { makeMediaRef } from '../mediaRefTypes.ts';
import type { MediaRef, MediaRefQuery, MediaRefProvider, MediaRefType } from '../mediaRefTypes.ts';

// contentId → url 解析：收口到 assetUrl.ts 的 buildContentUrlResolver（原语，履行其注释契约）。
// 此前本文件与 AssetNode 各手写一份同样的 find → 同一语义两份实现（见 assetUrl.ts 该函数头）。

/** 按关键词过滤（name 模糊匹配，忽略大小写）。
 *  更新(2026-09-17 注释改正)：原写「按 query.meta 过滤」——`MediaRefQuery` **无 `meta` 字段**（TD-02-52）。 */
function matchKeyword(name: string, keyword?: string): boolean {
  if (!keyword) return true;
  return name.toLowerCase().includes(keyword.toLowerCase());
}

export const canvasSourceProvider: MediaRefProvider = {
  source: 'canvas',
  label: '画布',
  order: 3, // 展示顺序（末位）；顺序一律由来源声明，消费方派生（TD-02-47）
  async list(query?: MediaRefQuery): Promise<MediaRef[]> {
    const nodes = getCanvasNodesSnapshot();
    const out: MediaRef[] = [];

    for (const node of nodes) {
      const data = (node.data || {}) as Record<string, unknown>;
      const media = getNodeMedia(node);
      const contentId = typeof data.contentId === 'string' ? data.contentId : undefined;

      // 【TD-16-23 修复 · **顺序**】先解析 url，再判类型。
      // 文件型节点可能只持 `contentId`（`App.handleImportPick` contentId 优先建的节点）——
      // `getNodeMedia` 读的是 assetType/url/assetUrl，**拿不到 type/url**；原顺序
      // `if (!media.type) continue` 会在解析入口**之前**把它跳过 ⇒ 画布来源凭空少几个节点且零日志
      // （母体：读侧字段嗅探不认识 contentId 互斥形态；TD-14-2 只修了 `useConnectedInputs`）。
      const resolved = resolveAssetDisplayUrl(data, buildContentUrlResolver(getResources()));

      if (!media.type && resolved.kind !== 'ok') {
        // 分两种，**判据不同**：
        //  · 真·非媒体节点（文本 / 生成态，画布上大多数）→ 静默跳过（**正常状态**，不是失败）；
        //  · 媒体节点但解析不出地址（典型：contentId 引用的 resource 已删，画布上已 fail-loud
        //    呈现「素材已移除」）→ **必须留痕**，否则「画布 tab 里少一个」零解释（不阻断 ≠ 不可见）。
        if (contentId) {
          logger.warn('可引用媒体源·画布', '媒体节点无可渲染地址，未纳入画布来源', {
            nodeId: node.id,
            nodeType: node.type ?? undefined,
            contentId,
            kind: resolved.kind,
          });
        }
        continue;
      }

      // 地址：解析结果（contentId→resource url）优先，其次节点自带 url。
      // 【原 `if (!rawUrl)` 恒假守卫已删】走到这里必是 `media.type` 非空或 `resolved.ok` 成立：
      // 前者由 `nodeMedia` 不变量（type 非空 ⟺ url 非空）保证 url 非空，后者 url 即解析结果非空
      // ⇒ 那条守卫（及其"必须留痕"日志）**永远不会触发**，是假护栏 + 死日志（TD-16-23 ②）。
      const rawUrl = resolved.kind === 'ok' ? resolved.url : media.url;

      // 类型：节点自报/嗅探优先；文件型节点（只持 contentId）由**唯一判型入口**按地址判。
      // 判不出（无扩展名且非 data:）→ **不猜**：留痕 + 跳过（猜一个类型会让下游按错类型渲染）。
      const candidate = media.type || classifyAssetUrlKind(toAbsoluteFileUrl(rawUrl));
      const type: MediaRefType | null =
        candidate === 'image' || candidate === 'video' || candidate === 'audio' ? candidate : null;
      if (!type) {
        logger.warn('可引用媒体源·画布', '节点媒体类型判不出来，未纳入画布来源', {
          nodeId: node.id,
          nodeType: node.type ?? undefined,
          url: rawUrl,
        });
        continue;
      }
      if (query?.types && !query.types.includes(type)) continue; // 正常的类型筛选（非失败，不留痕）

      const name =
        (typeof data.label === 'string' && data.label) ||
        (typeof data.name === 'string' && data.name) ||
        (typeof data.projectName === 'string' && data.projectName) ||
        '节点';
      if (!matchKeyword(name, query?.keyword)) continue;

      out.push({
        ref: makeMediaRef('canvas', node.id),
        source: 'canvas',
        name,
        type,
        url: toAbsoluteFileUrl(rawUrl),
        contentId,
        meta: { nodeType: node.type ?? undefined },
      });
    }

    return out;
  },
};
