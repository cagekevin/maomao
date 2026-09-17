/**
 * 来源 provider · 素材库（`source='library'`）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【本文件只做映射，不重实现】（docs/136 §一 普查结论 ①–⑦ 全部复用）
 *  · 列表真源：`base/api/localToolApi.ts::fetchResources`（后端真相，**分页**）；
 *  · URL 归一：`base/core/utils.ts::toAbsoluteFileUrl`；
 *  · 类型判定：`base/utils/assetType.ts::detectAssetType`（扩展名/mime 唯一真值源）。
 *
 * 【folder 参数：素材库 / 生成 共用本 provider】
 * 「生成」= `folder:'tasks'`（AI 产出落盘处，GeneratedView.tsx:176 同口径）；
 * 「素材库」= folder 空（全部用户目录）。二者是同一读取路径的参数差异，故**不拆两份**。
 *
 * 【分页（必须诚实面对 · docs/136 §5.5 / R2）】
 * 本轮**只取第一页**（页大小由下方常量定），并在 `meta` 里带 `{ page, pageSize, hasMore }`。
 * **不实现**无限滚动/全量拉取 —— 那是 UI 层的事（消费方拿 `hasMore` 决定要不要"加载更多"）。
 * 若消费方需要全量，应在此**循环拉取**（而不是让每个消费方自己写分页循环）。
 *
 * 【关键词搜索的诚实边界（docs/136 P1-3 / R12）】
 * `fetchResources` **不支持 keyword 参数** → 关键词只能在**已加载的第一页**内过滤。
 * 故 `meta` 里如实标注 `keywordScope:'loaded-page-only'`，**绝不假装搜了全部**
 * （静默不完整是最坏的失败形态）。
 * ════════════════════════════════════════════════════════════════
 */
import { fetchResources } from '../../api/localToolApi.ts';
import type { ResourceItem } from '../../api/localToolApi.ts';
import { detectAssetType } from '../../utils/assetType.ts';
import { toAbsoluteFileUrl } from '../../core/utils.ts';
import { makeMediaRef } from '../mediaRefTypes.ts';
import type { MediaRef, MediaRefQuery, MediaRefProvider } from '../mediaRefTypes.ts';

/** 单页大小（本轮固定；消费方按 meta.hasMore 决定是否加载更多）。 */
const PAGE_SIZE = 100;
const PAGE = 1;

/** 关键词匹配（后端不支持 keyword，故仅在已加载页内过滤；忽略大小写）。 */
function matchKeyword(name: string, keyword?: string): boolean {
  if (!keyword) return true;
  return name.toLowerCase().includes(keyword.toLowerCase());
}

/** ResourceItem → MediaRef；非图/视频/音频（text / 未知）返回 null（剪辑器只吃这三类）。 */
function toMediaRef(item: ResourceItem, query?: MediaRefQuery): MediaRef | null {
  const rawUrl = item.url || '';
  if (!rawUrl) return null;

  const type = detectAssetType(rawUrl);
  if (type !== 'image' && type !== 'video' && type !== 'audio') return null;
  if (query?.types && !query.types.includes(type)) return null;

  const name = item.name || rawUrl.split('/').pop() || '素材';
  if (!matchKeyword(name, query?.keyword)) return null;

  return {
    ref: makeMediaRef('library', item.id),
    source: 'library',
    name,
    type,
    url: toAbsoluteFileUrl(rawUrl),
    contentId: item.contentId,
    projectId: item.projectId,
    meta: { folder: item.folder, keywordScope: 'loaded-page-only' },
  };
}

export const librarySourceProvider: MediaRefProvider = {
  source: 'library',
  label: '素材库',
  async list(query?: MediaRefQuery): Promise<MediaRef[]> {
    const envelope = await fetchResources({
      // folder 来自 query（空 = 全部目录）；「生成」来源由 generatedSource 传 'tasks'。
      folder: query?.folder,
      page: PAGE,
      pageSize: PAGE_SIZE,
      projectId: query?.projectId,
    });
    const data = envelope?.data;
    const items = Array.isArray(data?.items) ? data.items : [];
    const totalPages = typeof data?.totalPages === 'number' ? data.totalPages : PAGE;

    const out: MediaRef[] = [];
    for (const item of items) {
      const ref = toMediaRef(item, query);
      if (!ref) continue;
      out.push({
        ...ref,
        meta: { ...ref.meta, page: PAGE, pageSize: PAGE_SIZE, hasMore: totalPages > PAGE },
      });
    }
    return out;
  },
};
