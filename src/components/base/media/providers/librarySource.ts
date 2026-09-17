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
// 分类真源：素材库目录清单（唯一一份，禁止在本 provider 另写硬编码 label/folder）。
import { FOLDERS } from '../../store/resourceStore.ts';
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

/**
 * ResourceItem → MediaRef。
 *  · 文件夹条目（`type:'folder'`）：保留为 `isFolder` 卡片（**可拖入的落点**），type 标 `'image'`
 *    仅为满足类型（消费方以 `isFolder` 分支渲染，不把它当媒体）。
 *  · 非图/视频/音频（text / 未知）返回 null（剪辑器只吃这三类）。
 */
function toMediaRef(item: ResourceItem, query?: MediaRefQuery): MediaRef | null {
  const rawUrl = item.url || '';
  if (!rawUrl) return null;

  const name = item.name || rawUrl.split('/').pop() || '素材';
  if (!matchKeyword(name, query?.keyword)) return null;

  // 文件夹卡片：不参与类型过滤（它不是媒体），直接作为落点条目返回。
  if (item.type === 'folder') {
    return {
      ref: makeMediaRef('library', item.id),
      source: 'library',
      name,
      type: 'image',
      url: toAbsoluteFileUrl(rawUrl),
      projectId: item.projectId,
      folder: item.folder,
      isFolder: true,
      meta: { folder: item.folder, keywordScope: 'loaded-page-only' },
    };
  }

  const type = detectAssetType(rawUrl);
  if (type !== 'image' && type !== 'video' && type !== 'audio') return null;
  if (query?.types && !query.types.includes(type)) return null;

  return {
    ref: makeMediaRef('library', item.id),
    source: 'library',
    name,
    type,
    url: toAbsoluteFileUrl(rawUrl),
    contentId: item.contentId,
    projectId: item.projectId,
    folder: item.folder,
    meta: { folder: item.folder, keywordScope: 'loaded-page-only' },
  };
}

/**
 * 素材库分类（**label 真源 = `resourceStore.FOLDERS`**，不在此另写一份）。
 *
 * 【为什么只取「全部/人物/场景/道具」4 项，不含 FOLDERS 里的 'generated'(tasks)】
 * tasks 目录已由**独立来源** `generated`（「生成」tab）承载 —— 若在这里再加一项，
 * 会与 tab 重复（用户裁定 2026-09-17）。
 * 故按 key 白名单过滤 FOLDERS，只保留面向用户素材的目录。
 */
const LIBRARY_CATEGORY_KEYS = ['all', 'character', 'scene', 'prop'] as const;

/**
 * 「全部」的查询 = **精确 `migrated`（不含子目录）**（用户裁定 2026-09-17）。
 *
 * 【为什么「全部」是精确而不是前缀（这是本仓有意的一次语义修正）】
 *  · 原语义（`eqOrPrefix`）= `migrated` 根 **+ 人物/场景/道具** 一锅端 —— 那与「人物」等分类重复，
 *    且让"还没归类的素材"淹没在已归类素材里；
 *  · 新语义 = 只看 `migrated` **根目录本身** ⇒ 它就是「**尚未归类**」的待办区：
 *    旁边并排显示 人物/场景/道具 三个**子文件夹卡片**，用户把文件**拖上去**即完成归类。
 *  · 用户原话：「直接把全部不要，就增加未分类了，那直接就是全部，就是这个意思呀」
 *    ⇒ **不新增「未分类」这个词**，让「全部」直接等于那个意思。
 *
 * ⚠️ 与 `folder`（前缀）的分工见 `MediaRefQuery.folderExact` 注释：二者语义相反，勿合并。
 */
const ALL_CATEGORY_QUERY: Partial<MediaRefQuery> = { folderExact: 'migrated' };

/** 从 FOLDERS 取 label（唯一真源），不另写硬编码文案。 */
function labelOf(key: string): string {
  return FOLDERS.find((f) => f.key === key)?.label ?? key;
}

export const librarySourceProvider: MediaRefProvider = {
  source: 'library',
  label: '素材库',
  categories: () =>
    (LIBRARY_CATEGORY_KEYS as readonly string[]).map((key) => ({
      key,
      label: labelOf(key),
      query:
        key === 'all'
          ? ALL_CATEGORY_QUERY
          : // 人物/场景/道具：**前缀**匹配（含该目录下的更深子目录）
            { folder: FOLDERS.find((f) => f.key === key)?.folder ?? undefined },
    })),
  async list(query?: MediaRefQuery): Promise<MediaRef[]> {
    const envelope = await fetchResources({
      // folder（前缀）/ folderExact（精确）来自 query；「生成」来源由 generatedSource 传 'tasks'。
      folder: query?.folder,
      folderExact: query?.folderExact,
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
