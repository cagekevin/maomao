/**
 * 来源 provider · 画布（`source='canvas'`）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【本文件只做映射，不重实现】（docs/136 §一 普查结论 ①–⑦ 全部复用）
 *  · 取节点媒体：复用 `base/canvas/nodeMedia.ts::getNodeMedia`（**只取主媒体**，
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
import { getNodeMedia } from '../../canvas/nodeMedia.ts';
import { resolveAssetDisplayUrl, buildContentUrlResolver } from '../../utils/assetUrl.ts';
import { toAbsoluteFileUrl } from '../../core/utils.ts';
import { getResources } from '../../store/resourceStore.ts';
import { getCanvasNodesSnapshot } from '../canvasNodesBridge.ts';
import { makeMediaRef } from '../mediaRefTypes.ts';
import type { MediaRef, MediaRefQuery, MediaRefProvider } from '../mediaRefTypes.ts';

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
  async list(query?: MediaRefQuery): Promise<MediaRef[]> {
    const nodes = getCanvasNodesSnapshot();
    const out: MediaRef[] = [];

    for (const node of nodes) {
      const media = getNodeMedia(node);
      // 过滤：无媒体的节点不收录（type 为空串 = 该节点没有媒体）。
      if (!media.type) continue;
      if (query?.types && !query.types.includes(media.type)) continue;

      // 用「渲染解析唯一入口」补齐文件型节点（只持 contentId）的 url。
      const data = (node.data || {}) as Record<string, unknown>;
      const resolved = resolveAssetDisplayUrl(data, buildContentUrlResolver(getResources()));
      const rawUrl = resolved.kind === 'ok' ? resolved.url : media.url;
      if (!rawUrl) continue;

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
        type: media.type,
        url: toAbsoluteFileUrl(rawUrl),
        contentId: typeof data.contentId === 'string' ? data.contentId : undefined,
        meta: { nodeType: node.type ?? undefined },
      });
    }

    return out;
  },
};
