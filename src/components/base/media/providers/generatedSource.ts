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
import { makeMediaRef } from '../mediaRefTypes.ts';
import type { MediaRef, MediaRefQuery, MediaRefProvider } from '../mediaRefTypes.ts';

/** 生成结果的落盘目录（唯一真源口径，与 GeneratedView.tsx 一致）。 */
export const GENERATED_FOLDER = 'tasks';

/**
 * 生成的分类 = **按媒体类型**（与素材库的「按目录」维度不同 —— 各来源维度可不同，本层只搬运）。
 * 值与 `GeneratedView.tsx` 的 TYPE_FILTERS 同口径（图片/视频/音频；文本不进可引用媒体）。
 */
const GENERATED_CATEGORIES = [
  { key: 'all', label: '全部', query: {} },
  { key: 'image', label: '图片', query: { types: ['image'] as const } },
  { key: 'video', label: '视频', query: { types: ['video'] as const } },
  { key: 'audio', label: '音频', query: { types: ['audio'] as const } },
];

export const generatedSourceProvider: MediaRefProvider = {
  source: 'generated',
  label: '生成',
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
