/**
 * 素材库「目录浏览」规则层（**唯一实现** · 零 React / 零 store 依赖）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么单独一层（2026-09-17 用户裁定：与侧边栏收口到一个地方）】
 * 「在素材库的哪个目录」→「该发什么查询」这条规则，曾被抄成 3 份：
 *   ① `providers/librarySource.ts` 的 `ALL_CATEGORY_QUERY`（「全部」= 精确根）
 *   ② `panels/ResourceLibrary.tsx` 的 `fetchArgsFor`（根 → 精确 / 子目录 → 前缀）
 *   ③ `panels/ImportMediaModal.tsx` 的 `queryFor`（弹窗自写一份）
 * ⇒ 侧边栏能点进子目录、弹窗点不进去（两套规则各自演化，漂移是必然）。
 * 现全部走本文件的 3 个纯函数：**规则只有一份，两个 UI 只持有自己的打开态与渲染**。
 *
 * 【三条规则（与后端 `/api/resources` 的 folder 语义对齐）】
 *  · 素材库根（`UPLOAD_DIRS.migrated`）= **精确**匹配（`folderExact`）＝「尚未归类」区；
 *    它下方并排的子文件夹由后端录成 `type:'folder'` 条目返回（动态落点，非硬编码清单）。
 *  · 子目录 = **前缀**匹配（`folder`），含其更深子目录（浏览语义与侧边栏一致）。
 *  · 上钻到「根的下一级」= 到顶（返回 null，由调用方决定回哪：侧边栏回根目录、弹窗回默认分类）。
 *
 * 【消费方（3 处，全部只调本文件，禁再就地写规则）】
 *  `base/media/providers/librarySource.ts` · `base/panels/ResourceLibrary.tsx` ·
 *  `base/panels/ImportMediaModal.tsx`
 * ════════════════════════════════════════════════════════════════
 */
import { UPLOAD_DIRS } from '../base/utils/uploadDirs.ts';
import type { MediaRefQuery } from '../base/media/mediaRefTypes.ts';

/** 素材库根目录（uploads 目录中央表为真源；本层与消费方一律不写 'migrated' 字面量）。 */
export const LIBRARY_ROOT = UPLOAD_DIRS.migrated;

/** 是否素材库根（根 = 「全部」= 未归类区；`null` 视为未指定 ⇒ 根）。 */
export function isLibraryRoot(folder: string | null | undefined): boolean {
  return !folder || folder === LIBRARY_ROOT;
}

/**
 * 浏览位置 → 查询参数（**唯一规则**）。
 * 根 → `{ folderExact }`（精确，不含子目录）；子目录 → `{ folder }`（前缀，含更深子目录）。
 */
export function libraryBrowseArgs(folder: string): Partial<MediaRefQuery> {
  return isLibraryRoot(folder) ? { folderExact: LIBRARY_ROOT } : { folder };
}

/**
 * 上钻一级：返回父目录路径；**到顶（父 = 根或已在根）→ null**。
 * 调用方拿到 null 时自行决定落点（侧边栏 → 根目录；弹窗 → 默认分类视图）。
 */
export function libraryUpFolder(folder: string | null | undefined): string | null {
  if (isLibraryRoot(folder)) return null;
  const parts = String(folder).split('/');
  parts.pop();
  const parent = parts.join('/');
  return parent && !isLibraryRoot(parent) ? parent : null;
}

/**
 * 「素材库根已无内容」的空态判定（**唯一判据**；TD-03-15 · 2026-09-18）。
 *
 * 【为什么需要】根 = 「尚未归类」区（精确 `migrated`）。落盘即入库之后，**系统产出**
 * （AI 生成 → `tasks`、画布外置中间图 → `canvas`）占了绝大多数行，它们**不在**根里；
 * 于是用户新装的库点开「全部」看到的是**空的**，而磁盘上其实躺着几千个文件（实测 4954）。
 * 一个只说"该目录暂无素材"的空态在这里是**误导** —— 用户会以为素材丢了 / 功能坏了。
 *
 * 【判据】① 当前在根；② 首屏已拉完（非 loading）；③ 列表为空；④ 无读失败（失败态优先，见调用方）。
 * 满足即「根确实空」—— 此时应提示"素材在别处（生成 / 各分类目录）"，而不是"这里没有素材"。
 *
 * @param opts.folder 当前浏览目录（根 = `LIBRARY_ROOT` 或空）
 * @param opts.itemCount 已加载条目数
 * @param opts.loading 首屏是否加载中
 * @param opts.hasError 是否处于读失败态（失败态优先，此函数应返回 false）
 */
export function isEmptyLibraryRoot(opts: {
  folder: string | null | undefined;
  itemCount: number;
  loading: boolean;
  hasError: boolean;
}): boolean {
  return isLibraryRoot(opts.folder) && !opts.loading && !opts.hasError && opts.itemCount === 0;
}
