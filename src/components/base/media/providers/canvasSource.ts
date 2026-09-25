/**
 * 来源 provider · 画布（`source='canvas'`）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【本文件只做映射，不重实现】（docs/136 §一 普查结论 ①–⑦ 全部复用）
 *  · 取节点媒体：复用 `base/utils/media/nodeMedia.ts::getNodeMedia`（**只取主媒体**，
 *    与 AgentPanel 待发送区口径一致）；
 *  · contentId → resource.url：**已收在 `getNodeMedia` 内部**（它委托唯一读入口
 *    `assetUrl.ts::resolveAssetDisplayUrl`，认 `contentId`/`assetUrl`/`url` 三形态）。
 *    故本文件传入解析器即可，**不再自己解析一遍**；
 *  · URL 归一：复用 `base/core/utils.ts::toAbsoluteFileUrl`。
 *
 * 【2026-09-25：删掉"再解析一次"的兜底（TD-16-23 收尾）】
 * 原文在拿到 `getNodeMedia` 之后**又**调了一次 `resolveAssetDisplayUrl` 兜底 —— 那是因为
 * `getNodeMedia` 当时不认识 `contentId`，只持 contentId 的文件型节点会退化为空。
 * 现在 `getNodeMedia` 自己就认（母体已治）⇒ 那层「同一次解析跑两遍」被删：
 * 同一份判据只留一处，链路少一跳。解析器同时**移出循环**（原先逐节点 `buildContentUrlResolver`
 * 重建 = O(节点数 × 资源数) 的白跑）。
 * ════════════════════════════════════════════════════════════════
 *
 * 【已知保守取舍（docs/136 §5.5 / R1）】
 * `imageBoxNode` 可能有多张图（`data.images[]`），本轮**只取主媒体**
 * （① 与 AgentPanel 一致；② 展开多图是行为扩展，不该在收口层擅自决定）。
 * 若将来要展开，应在 `nodeMedia.ts` 加 `getNodeMediaList`（**扩真源，不在此旁路**）。
 */
import { getNodeMedia } from '@/components/base/utils/media/nodeMedia';
import { buildContentUrlResolver } from '@/components/base/utils/media/assetUrl';
// 媒体类型判定的**唯一真值源**（禁在此内联重写扩展名嗅探；check-arch 有反向判据）
import { classifyAssetUrlKind } from '@/components/base/utils/media/assetType';
import { isMediaRefType } from '@/types';
import { toAbsoluteFileUrl } from '../../core/utils.ts';
import { logger } from '@/components/base/core/log/logger';
import { getResources } from '@/components/resource/resourceStore';
import { getCanvasNodesSnapshot } from '@/components/canvas/lib/canvasNodesBridge';
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
    // 解析器建**一次**（原先在循环内逐节点重建）
    const resolveContentUrl = buildContentUrlResolver(getResources());

    for (const node of nodes) {
      const data = (node.data || {}) as Record<string, unknown>;
      // 【TD-16-23 · 根因已治】取主媒体只有这一个入口（内部认 contentId 三形态）。
      const media = getNodeMedia(node, resolveContentUrl);
      const contentId = typeof data.contentId === 'string' ? data.contentId : undefined;

      if (!media.type && !media.url) {
        // 分两种，**判据不同**：
        //  · 真·非媒体节点（文本 / 生成态，画布上大多数）→ 静默跳过（**正常状态**，不是失败）；
        //  · 媒体节点但解析不出地址（典型：contentId 引用的 resource 已删，画布上已 fail-loud
        //    呈现「素材已移除」）→ **必须留痕**，否则「画布 tab 里少一个」零解释（不阻断 ≠ 不可见）。
        if (contentId) {
          logger.warn('可引用媒体源·画布', '媒体节点无可渲染地址，未纳入画布来源', {
            nodeId: node.id,
            nodeType: node.type ?? undefined,
            contentId,
          });
        }
        continue;
      }

      const rawUrl = media.url;

      // 类型：节点自报/嗅探优先；文件型节点（只持 contentId）由**唯一判型入口**按地址判。
      // 判不出（无扩展名且非 data:）→ **不猜**：留痕 + 跳过（猜一个类型会让下游按错类型渲染）。
      const candidate = media.type || classifyAssetUrlKind(toAbsoluteFileUrl(rawUrl));
      const type: MediaRefType | null = isMediaRefType(candidate) ? candidate : null;
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
