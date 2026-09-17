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
 * 「生成」= `folder:'tasks'`（AI 产出落盘处，与 `generatedSource.GENERATED_FOLDER` 同口径）；
 * 「素材库」= 用户目录 `migrated`（其「全部」分类 = **精确 migrated 根**＝未归类区，见 ALL_CATEGORY_QUERY）。
 * 二者是同一读取路径的参数差异，故**不拆两份**。
 * 更新(2026-09-17 注释改正)：原写「素材库 = folder 空（全部用户目录）」—— 该口径已被用户裁定推翻
 * （「全部」= 精确 migrated 根 = 未归类区），照实改正（TD-02-52）。
 *
 * 【分页（2026-09-17 收口 · 用户报「导入面板生成只显示 100 条」）】
 * 此前本文件写死"只取第一页（100 条）"，而消费方（导入弹窗）**既无分页 UI、也没读 `meta.hasMore`**
 * —— 算好的 hasMore 零消费 ⇒ 用户看到 100 条，界面却没有任何"还有更多"的提示
 * ＝ **静默不完整**（docs/136 §5.5 的"只取第一页"妥协已就此撤销）。
 * 现改为 **取全量**：`api/pagedList.ts::fetchAllResourcePages` 是分页读取的**唯一实现**
 * （按响应 `totalPages` 循环取齐，不抄任何上限数字）。本来源语义就是"全部可引用素材"。
 *
 * 【关键词搜索（同轮修正）】
 * 原注释称"`fetchResources` 不支持 keyword 参数"——**描述不实**：后端
 * `utils/helpers.ts::parsePagination` 一直在读 `search` 并做多列 LIKE 匹配，
 * 缺的只是前端封装没暴露该参数。现 `search` 已接到 `fetchResources`，
 * 关键词**走后端搜索**；`meta.keywordScope:'loaded-page-only'` 这个妥协同步删除。
 * ════════════════════════════════════════════════════════════════
 */
import { fetchAllResourcePages } from '../../api/pagedList.ts';
import type { ResourceItem } from '../../api/localToolApi.ts';
import { detectAssetType } from '../../utils/assetType.ts';
import { toAbsoluteFileUrl } from '../../core/utils.ts';
// 目录浏览规则（根/子目录 → 查询参数）：**唯一实现**，本 provider 只调它，不自带规则。
import { LIBRARY_ROOT, libraryBrowseArgs } from '../libraryBrowse.ts';
// 分类真源：素材库目录清单 + 面向用户素材的白名单（两处消费方共用同一份，禁止各抄一份）。
import { FOLDERS, LIBRARY_CATEGORY_KEYS } from '../../store/resourceStore.ts';
import { makeMediaRef } from '../mediaRefTypes.ts';
import type { MediaRef, MediaRefQuery, MediaRefProvider } from '../mediaRefTypes.ts';

/**
 * ResourceItem → MediaRef。
 *  · 文件夹条目（`type:'folder'`）：保留为 `isFolder` 卡片（**可拖入的落点**），type 标 `'image'`
 *    仅为满足类型（消费方以 `isFolder` 分支渲染，不把它当媒体）。
 *  · 非图/视频/音频（text / 未知）返回 null（剪辑器只吃这三类）。
 */
function toMediaRef(item: ResourceItem, query?: MediaRefQuery): MediaRef | null {
  const rawUrl = item.url || '';
  if (!rawUrl) return null;

  // 关键词不再在此过滤：已由后端 `search` 完成（前端"页内过滤"会漏掉未加载的页）。
  const name = item.name || rawUrl.split('/').pop() || '素材';

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
  };
}

/**
 * 素材库分类（**label 真源 = `resourceStore.FOLDERS`**，不在此另写一份）。
 *
 * 【为什么只取「全部/人物/场景/道具」4 项，不含 FOLDERS 里的 'generated'(tasks)】
 * tasks 目录已由**独立来源** `generated`（「生成」tab）承载 —— 若在这里再加一项，
 * 会与 tab 重复（用户裁定 2026-09-17）。
 * 故按 key 白名单过滤 FOLDERS，只保留面向用户素材的目录。
 *
 * 更新(2026-09-17 收口)：白名单**不再在本文件定义**（此前与 `ResourceLibrary.tsx` 各一份同名同值 =
 * M3 第二份）→ 归到 FOLDERS 的拥有者 `resourceStore`，两处 import 同一常量（TD-02-53）。
 */

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
const ALL_CATEGORY_QUERY: Partial<MediaRefQuery> = libraryBrowseArgs(LIBRARY_ROOT);

/** 从 FOLDERS 取 label（唯一真源），不另写硬编码文案。 */
function labelOf(key: string): string {
  return FOLDERS.find((f) => f.key === key)?.label ?? key;
}

export const librarySourceProvider: MediaRefProvider = {
  source: 'library',
  label: '素材库',
  categories: () =>
    LIBRARY_CATEGORY_KEYS.map((key) => ({
      key,
      label: labelOf(key),
      query:
        key === 'all'
          ? ALL_CATEGORY_QUERY
          : // 人物/场景/道具：**前缀**匹配（含该目录下的更深子目录）
            { folder: FOLDERS.find((f) => f.key === key)?.folder ?? undefined },
    })),
  async list(query?: MediaRefQuery): Promise<MediaRef[]> {
    // 取全量（分页读取的唯一实现负责"按 totalPages 取齐"，见文件头）；
    // keyword 透传为后端 search（不再有"只在已加载页内过滤"的妥协）。
    const items = await fetchAllResourcePages({
      // folder（前缀）/ folderExact（精确）来自 query；「生成」来源由 generatedSource 传 'tasks'。
      folder: query?.folder,
      folderExact: query?.folderExact,
      projectId: query?.projectId,
      search: query?.keyword,
    });

    const out: MediaRef[] = [];
    for (const item of items) {
      const ref = toMediaRef(item, query);
      if (!ref) continue;
      out.push(ref);
    }
    return out;
  },
};
