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
import { toAbsoluteFileUrl, fileNameFromUrl } from '../../core/utils.ts';
// 目录浏览规则（根/子目录 → 查询参数）：**唯一实现**，本 provider 只调它，不自带规则。
import { LIBRARY_ROOT, libraryBrowseArgs } from '../libraryBrowse.ts';
// 分类真源：素材库目录清单 + 「静态基底 ∪ 磁盘实有子目录」的派生判据（两处消费方共用同一份，禁止各抄一份）。
import { libraryFoldersOf } from '../../store/resourceStore.ts';
import { makeMediaRef } from '../mediaRefTypes.ts';
import type { MediaRefEntry, MediaRefQuery, MediaRefProvider } from '../mediaRefTypes.ts';

/**
 * ResourceItem → MediaRef（**禁止静默丢弃**）。
 *
 * 【职责边界（2026-09-17 收口）】「呈现哪几类」是**消费方的声明**，不是 provider 的私判：
 *  · 此前本函数自持一条「非图/视频/音频 → return null」的白名单 —— provider 替消费方决定了可见性；
 *  · 更坏的是**丢弃是静默的**：调用方只看到"列表里没有这条"，看不到"为什么没有"
 *    ＝ 静默不完整（用户报「生成里的图导不进来、还不报错」正是这种形态）。
 *  · 现在：`null` 的语义**收窄为唯一一种** —— 「被消费方显式声明的 `query.types` 过滤掉」（合法过滤）；
 *    其它一切异常一律**抛错**（数据违约必须可见）。
 *  · 数据违约（缺 url）→ **抛错**：后端 `resources.url` 是物理定位真源（`relativePathFromFileUrl` 依赖它），
 *    缺它说明后端行坏了 —— 悄悄跳过只会让"库里有、列表没有"变成无从诊断的谜。
 *  · 文件夹条目：返回 `MediaRefFolder`（**可拖入的落点**，不是媒体），不参与媒体类型过滤。
 */
function toMediaRef(item: ResourceItem, query?: MediaRefQuery): MediaRefEntry | null {
  const rawUrl = item.url || '';
  if (!rawUrl) {
    throw new Error(
      `[librarySource] 资源行缺 url（后端契约违约，拒绝静默跳过）：id=${item.id} name=${item.name}`,
    );
  }

  // 关键词不再在此过滤：已由后端 `search` 完成（前端"页内过滤"会漏掉未加载的页）。
  const name = item.name || fileNameFromUrl(rawUrl) || '素材';

  // 文件夹卡片：不参与类型过滤（它不是媒体），直接作为落点条目返回。
  // 【TD-02-46 收口】原实现**谎报 `type:'image'`**（注释自述"仅为满足类型"）—— 现返回
  // `MediaRefFolder`（独立类型，**没有** `type` 字段）：漏判 `isFolder` 的消费方想拿 `type` 会编译不过，
  // 不能再把目录当图片（那会建出指向目录的"图片"节点 / 请求打到目录上）。
  if (item.type === 'folder') {
    return {
      ref: makeMediaRef('library', item.id),
      source: 'library',
      name,
      url: toAbsoluteFileUrl(rawUrl),
      projectId: item.projectId,
      folder: item.folder,
      isFolder: true,
    };
  }

  const type = detectAssetType(rawUrl);
  // 【类型契约的落地，**不是** provider 私判】`MediaRefType` 本身只含 image／video／audio ——
  // 「可引用媒体」这个概念的边界由**类型层**定义（text／other 从类型上就进不来 MediaRef）。
  // 故这里必须过滤掉非三类，否则编译期就过不去（曾试过放开 text → TS2345）。
  if (type !== 'image' && type !== 'video' && type !== 'audio') return null;
  // 消费方显式声明的类型白名单（合法过滤，与上面的类型契约过滤是两件事）
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

/** 「全部」分类的 key（= 静态基底首项；契约要求它排首位 ⇒ 即默认分类）。 */
const ALL_KEY = 'all';

export const librarySourceProvider: MediaRefProvider = {
  source: 'library',
  label: '素材库',
  order: 2, // 展示顺序（生成在其前：用户裁定 2026-09-17）；缺省顺序由注册表按 order 派生（TD-02-47）
  /**
   * 分类清单 = 静态基底 ∪ **磁盘实有子目录**（TD-03-15）。
   *
   * 【为什么吃 `entries`（重要）】用户自建的目录（实测 `颜色`／`HKH其他产品`）不在静态清单里，
   * 只能从**已拉到的** `type:'folder'` 条目发现 —— 而这些条目由**消费方**在 `list()` 后持有。
   * 故契约把"最近一次列表"作为可选入参传进来，本 provider**只读它、不为此另发请求**
   * （若自己再 fetch 一次，分类清单与条目列表就来自两次查询 ⇒ 同一真相两份，会不一致）。
   *
   * 【缺省 `[]` 时】只返回静态基底 —— 首屏/未拉取时结构稳定，拉到后自动补齐磁盘项。
   *
   * 分类 → query 的**唯一映射**：`all` → 精确根（未归类区）；其余 → **前缀**（含更深子目录）。
   * query 一律由 `folders` 的 `folder` 字段决定，故静态项与磁盘项走**同一份代码**（无第二套判据）。
   */
  categories: (entries = []) => {
    const folders = libraryFoldersOf(entries.filter((e) => e.isFolder));
    return folders.map((f) => ({
      key: f.key,
      label: f.label,
      query:
        f.key === ALL_KEY
          ? ALL_CATEGORY_QUERY
          : // 子目录：**前缀**匹配（含该目录下的更深子目录）；`folder` 由 libraryFoldersOf 派生
            { folder: f.folder ?? undefined },
    }));
  },
  async list(query?: MediaRefQuery): Promise<MediaRefEntry[]> {
    // 取全量（分页读取的唯一实现负责"按 totalPages 取齐"，见文件头）；
    // keyword 透传为后端 search（不再有"只在已加载页内过滤"的妥协）。
    const items = await fetchAllResourcePages({
      // folder（前缀）/ folderExact（精确）来自 query；「生成」来源由 generatedSource 传 'tasks'。
      folder: query?.folder,
      folderExact: query?.folderExact,
      projectId: query?.projectId,
      search: query?.keyword,
    });

    // 【TD-02-59 收口：本 provider **只读不写**】此处曾 `mergeResourcesFromBackend(items)` —— 那让
    // `list()`（一个**纯查询**）带上了写全局 store 的副作用，于是「后端资源镜像完不完整」取决于
    // **用户有没有打开导入弹窗** ⇒ `contentId → url` 解析随时序静默失效。
    // 现镜像填充归还其所有方：`resourceStore.refreshFromBackend()`（存储就绪后自刷一次）——
    // 契约层（`base/media/**`）**零 store 写入**。
    // （另：画布入口早已不再依赖该时序 —— TD-02-55 起 `assetNode` 同时持 `assetUrl` 与 `contentId`，
    //  镜像缺行时 `resolveAssetDisplayUrl` 自动回落到 `assetUrl`，不会渲染成 MISSING。）
    const out: MediaRefEntry[] = [];
    for (const item of items) {
      const ref = toMediaRef(item, query);
      // `null` 的两种成因都是**预期内的过滤**（非可引用媒体类型 / 消费方声明的 types）——
      // 见 toMediaRef 内注释。而**数据违约（缺 url）已在 toMediaRef 里抛错**，不会被这里吞掉。
      if (!ref) continue;
      out.push(ref);
    }
    return out;
  },
};
