/**
 * 来源 provider · 生成（`source='generated'`）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【与「素材库」是**不同数据源**（用户裁定 2026-09-17）】
 *  · 生成 = `fetchResources({ folder:'tasks' })` —— AI 产出落盘处
 *    （与 GeneratedView 面板同口径，**硬编码 tasks 目录**）；
 *  · 素材库 = `fetchResources({ folder: 空 })` —— 用户自己的目录（migrated/…）。
 *  **画布里的图与生成结果未必是同一批**（生成产出会落 tasks 目录并登记），故独立成来源。
 *
 * 【为什么是 provider 而不是复制一份映射逻辑】
 * 二者读取路径完全相同（都是 `fetchResources` → `ResourceItem` → `MediaRef`），
 * 差异**只有一个 folder 字面量**。故本 provider **委托 `librarySourceProvider.list`**
 * 并注入 `folder:'tasks'`（M3 母体：同一映射不抄第二份）。
 * `source` 与 `ref` 前缀标 `'generated'`（去重身份与素材库区分开）。
 * ════════════════════════════════════════════════════════════════
 */
import { librarySourceProvider } from './librarySource.ts';
import { makeMediaRef, MEDIA_REF_TYPES } from '../mediaRefTypes.ts';
// 显示名一律取自**资产类型目录**（唯一真源），本文件不再自持中文名
import { ASSET_TYPE_META } from '@/types';
import type { MediaRef, MediaRefQuery, MediaRefProvider } from '../mediaRefTypes.ts';

/** 生成结果的落盘目录（唯一真源口径，与 GeneratedView.tsx 一致）。 */
export const GENERATED_FOLDER = 'tasks';

/**
 * 生成的分类 = **按媒体类型**（与素材库的「按目录」维度不同 —— 各来源维度可不同，本层只搬运）。
 *
 * 【清单来源（TD-02-49 · 2026-09-17）】两项都**派生自资产类型目录**（`@/types` 的 `ASSET_TYPE_META`）：
 * 分类项 = 目录里 `mediaRef: true` 的成员（`MEDIA_REF_TYPES`），显示名 = 条目自带 `label`。
 * ⇒ 新增一类可引用媒体只改目录一处，这里自动跟上；**不存在"本文件与别处各写一份中文名"**。
 *
 * ⚠️ **不要**再去"对齐" `GeneratedView.tsx` 的 `TYPE_FILTERS` —— 两者**语义不同**：
 *   · 本清单 = **可引用媒体**（目录 `mediaRef:true`：图/视频/音频，**无 text**）；
 *   · `TYPE_FILTERS` = 生成**面板内的文件类型筛选**（作用于 tasks 目录里的文件，**含 text**，音频无筛选需求）。
 * 两处的**域选取**可以不同，但**显示名都取自同一目录**（这才是"谁要哪些取哪些"）。
 *
 * 【「全部」为什么不带 types】「可引用媒体只有 image/video/audio」由目录的 `mediaRef` 标记定义，
 * `librarySource.toMediaRef` 已按该契约过滤 —— 此处再声明一次 `types` 就是**第二份真相**（M3）。
 */
const GENERATED_CATEGORIES: Array<{ key: string; label: string; query: Partial<MediaRefQuery> }> = [
  { key: 'all', label: '全部', query: {} },
  ...MEDIA_REF_TYPES.map((t) => ({
    key: t,
    label: ASSET_TYPE_META[t].label,
    query: { types: [t] } as Partial<MediaRefQuery>,
  })),
];

export const generatedSourceProvider: MediaRefProvider = {
  source: 'generated',
  label: '生成',
  // 展示顺序（用户裁定 2026-09-17：生成在素材库之前）—— 顺序由**来源自己声明**，
  // 消费方按 listMediaRefSources() 派生，不再自持顺序清单（TD-02-47）。
  order: 1,
  categories: () =>
    GENERATED_CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      query: c.query as Partial<MediaRefQuery>,
    })),
  async list(query?: MediaRefQuery): Promise<MediaRef[]> {
    // folderExact 由「素材库」专用（未分类语义），生成源始终按前缀扫 tasks ⇒ 显式剔除。
    const { folderExact: _drop, ...rest } = query ?? {};
    const items = await librarySourceProvider.list({ ...rest, folder: GENERATED_FOLDER });
    // 【过滤文件夹卡片】生成的分类维度是「媒体类型」，目录卡片在此无意义
    // （且 tasks 下的子目录是产出分组织，不是"待归类"落点）。
    // 只改 source 与 ref 前缀（映射/过滤/归一全部复用 library provider）；
    // ref 必须经 makeMediaRef 重造（禁止手拼 —— 契约铁律 2）。
    return items
      .filter((it) => !it.isFolder)
      .map((it) => ({
        ...it,
        source: 'generated' as const,
        ref: makeMediaRef('generated', it.ref.replace(/^library:/, '')),
      }));
  },
};
