/**
 * 资产（媒体文件）相关共享类型。
 * 收口于 src/types/ 目录（由 index.ts barrel 统一导出），供 assetType.ts / asyncGuard.ts 及其调用方复用。
 */

/**
 * 资产类型**目录**（唯一真源）—— 「有哪几类资产、各自叫什么、算不算可引用媒体」只在这里写一次。
 *
 * 【TD-02-49 · 2026-09-17】此前这三件事散在多处并已漂移：
 *   · 类型联合手写在类型层；中文名散在 5 处（生成面板筛选 pill / `AssetNode` 的四选一三元链 /
 *     `useAssetDropPaste` 的 toast / 媒体源分类 / `MEDIA_REF_TYPE_LABELS`），措辞还不一致（"文本" vs "文本文件"）；
 *   · 「可引用媒体有哪几类」没有真源，消费方各自手抄 `['image','video','audio']`。
 * 现按**一个目录 + 字段**收口：条目自带 `label`（显示名）与 `mediaRef`（是否属可引用媒体域），
 * **谁要哪些就取哪些**（媒体源取派生出的 `MEDIA_REF_TYPES`；面板筛选自己选 key、label 仍取自本目录）。
 *
 * 只列**四类资产**：`other`（非上述类型的文件）/ `empty`（无 URL）是**状态**不是类型，故不入选。
 */
export const ASSET_TYPE_META = {
  image: { label: '图片', mediaRef: true },
  video: { label: '视频', mediaRef: true },
  audio: { label: '音频', mediaRef: true },
  text: { label: '文本', mediaRef: false }, // 文本产物不进可引用媒体（只在任务中心可见/可筛）
} as const;

/** 四类资产类型（由目录派生，勿另写联合）。 */
export type AssetContentType = keyof typeof ASSET_TYPE_META;

/** 四类资产类型清单（由目录派生；顺序 = 目录声明顺序，供 UI 分类/筛选）。 */
export const ASSET_TYPES = Object.keys(ASSET_TYPE_META) as AssetContentType[];

/** 可引用媒体类型（由目录的 `mediaRef` 标记派生 —— 域事实只此一处声明）。 */
export type MediaRefAssetType = {
  [K in AssetContentType]: (typeof ASSET_TYPE_META)[K]['mediaRef'] extends true ? K : never;
}[AssetContentType];

/** 可引用媒体类型清单（同上派生；媒体源 provider 的分类直接用它）。 */
export const MEDIA_REF_TYPES = ASSET_TYPES.filter(
  (t): t is MediaRefAssetType => ASSET_TYPE_META[t].mediaRef,
);

/** 是否为目录收录的四类内容资产（`other`/`empty` 是状态，不是内容类型）。 */
export function isAssetContentType(t: string | null | undefined): t is AssetContentType {
  return !!t && Object.prototype.hasOwnProperty.call(ASSET_TYPE_META, t);
}

/**
 * 资产类型 → 中文显示名（唯一取用口；目录未收录的状态回退 `fallback`）。
 *
 * 【TD-02-49】此前各显示出口手写中文名（`AssetNode` 的三元链甚至把 text 叫"文本文件"），
 * 措辞漂移无处对账。现一律经本函数取目录里的 `label`；要改叫法只改目录一处。
 */
export function assetTypeLabel(t: string | null | undefined, fallback = '文件'): string {
  return isAssetContentType(t) ? ASSET_TYPE_META[t].label : fallback;
}

/**
 * 资产类型判定结果（assetType.detectAssetType/detectFileType；对齐官方 xi.jsx / AssetNode 类型约定）。
 * 全库「扩展名 / mime → 类别」判定的统一取值，见 assetType.ts 的唯一真值源表。
 *  - image / video / audio / text：四类资产（= `ASSET_TYPE_META` 的键）
 *  - other：非以上类型的文件（如压缩包）；empty：无 URL/文件
 */
export type AssetType = AssetContentType | 'other' | 'empty';

/** 图片/资产 URL 加载选项（asyncGuard.loadImageWithTimeout / loadImageOrNull） */
export interface AssetLoadOptions {
  timeoutMs?: number;
  /** null = 去掉 crossOrigin（跨域图无 CORS 头时的兜底，canvas 会被污染） */
  crossOrigin?: string | null;
}

/**
 * 资产**类别**目录（唯一真源）——「剧本/素材库的资产分几类、各自中文名、落哪个磁盘目录」只在这里写一次。
 *
 * 【为什么收口（判据登记表 §五 #5／§七 #6）】此前同一事实散在 **6 处**且已漂移：
 *   · **值集合**：`StepAssets.tsx` 的 CATS 表 · `GearSettings.tsx` 的二维数组 ·
 *     `scriptBoxPrompts.ts` 与 `scriptBoxEngine.ts` **各写一份** `['character','scene','prop'].includes(…)` 校验数组；
 *   · **中文名分叉**：剧本盒三处写「角色」，素材库 `FOLDERS` 写「人物」—— 同物两名；
 *   · **类型**：`AssetCategory = string`（放宽）⇒ 校验只能手抄数组，收口后既无单一真源也无守卫。
 * 【为什么中文名统一取「人物」】`FOLDERS.folder` 是**磁盘目录名**（`migrated/人物`）⇒ 改名会破坏存量数据，
 *   只能改 label；取「人物」则 label 与磁盘目录名天然一致，不产生「名实不符」的注释负担。
 * 【与 `ASSET_TYPE_META` 的区别】**不同判据**：那是**文件媒体类型**（image/video/audio/text，判「能否被引用」），
 *   本目录是**剧本资产类别**（character/scene/prop，判「属剧情里的哪一类」）⇒ 不合并（ADR-0031）。
 */
export const ASSET_CATEGORY_META = {
  character: { label: '人物', dir: '人物' },
  scene: { label: '场景', dir: '场景' },
  prop: { label: '道具', dir: '道具' },
} as const;

/** 资产类别（由目录派生，勿另写联合）。 */
export type AssetCategory = keyof typeof ASSET_CATEGORY_META;

/** 资产类别清单（由目录派生；顺序 = 声明顺序，供 UI 渲染）。 */
export const ASSET_CATEGORIES = Object.keys(ASSET_CATEGORY_META) as AssetCategory[];

/** 是否为目录收录的资产类别（运行时守卫 · 唯一实现）。消费方**禁**再写 `['character','scene','prop'].includes(…)`。 */
export function isAssetCategory(v: unknown): v is AssetCategory {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ASSET_CATEGORY_META, v);
}

/** 资产类别 → 中文显示名（唯一取用口）。表外值**原样透出**（不吞不认识的值，便于暴露脏数据）。 */
export function assetCategoryLabel(c: string | null | undefined): string {
  return typeof c === 'string' && isAssetCategory(c) ? ASSET_CATEGORY_META[c].label : (c ?? '');
}
