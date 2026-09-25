/**
 * creativeCatalog —— 创作库 catalog 归一化层（把 `data/*.json` 真值 → `CreativePreset[]`）。
 *
 * 数据真值（SSOT，§〇）：`data/creativeCatalog.json`（217 style / 51 motion / 17 filter）与
 * `data/mjStyleCatalog.json`（493，三组 char/scene/juwu）。随包发布、只读、同步。本文件是
 * 唯一把「原始 JSON 形状」→「CreativePreset 内部口径」的转换点。
 *
 * 归一化（对照 JSON 真实字段，2026-09-15 实测）：
 *   - creative 项原始字段：id/kind/category/name/description/prompt/preview(/poster)。
 *     · 原始 id 无前缀（`style-643`）→ `presetIdFor` 补 `cp_`（`cp_style-643`）。
 *     · kind 直接沿用（style/filter/motion）。
 *     · preview 照搬（motion 是 mp4 时，`poster` 供封面）。
 *   - mj 项原始字段：id/group/category/name/mixed/medium/codes/parameters/prompt/vibe/thumbnail/preview。
 *     · 原始 id 无 kind 前缀（`char1`）→ `presetIdFor('mj')` → `cp_mj-char1`。
 *     · kind='mj'。category 沿用（34 个真分类）。preview 用缩略图（详情态的大图另见 mjCatalog 富字段）。
 *     · 面板详情需要的 medium/codes/parameters/vibe/mixed 属「不落盘字段」（§一.2）——
 *       本层把它们放进 `MjPreset` 富形态（UI 用），插入字典时经 `toDictEntry` 白名单裁剪（I4）。
 *
 * 本层只产 catalog 前 4 类（style/filter/motion/mj）；`cp_prompt-*` 由 promptManager 运行期写入（§一.2.1）。
 */

import type { CatalogKind, CreativePreset, PresetKind } from './creativePresets.ts';
import { presetIdFor } from './creativePresets.ts';
import { classifyAssetUrlKind } from '../base/utils/media/assetType.ts';
import creativeData from './data/creativeCatalog.json';
import mjData from './data/mjStyleCatalog.json';

/** THE 原始 catalog JSON 的形状（字段实测 2026-09-15，见文件头）。 */
interface RawCreative {
  id?: string;
  kind?: string;
  category?: string;
  name?: string;
  description?: string;
  prompt?: string;
  preview?: string;
  poster?: string;
}

/** MJ 原始 JSON 的形状（mixed/medium/codes/parameters/vibe 等 = 不落盘字段，I4 裁剪依据）。 */
interface RawMj {
  id?: string;
  group?: string;
  category?: string;
  name?: string;
  mixed?: boolean;
  medium?: string;
  codes?: string;
  parameters?: string;
  prompt?: string;
  vibe?: string;
  thumbnail?: string;
  preview?: string;
}

/** MJ 富形态（含面板详情所需的不落盘字段）；插入字典前须经 `toDictEntry` 白名单裁剪。 */
export interface MjPreset extends CreativePreset {
  /** 素材类型组：char（角色人像）/ scene（场景环境）/ juwu（巨物怪兽）。两轴交叉过滤的「素材类型」轴 */
  group: string;
  mixed?: boolean;
  medium?: string;
  codes?: string;
  parameters?: string;
  vibe?: string;
  /** 详情大图（原始 preview，比网格缩略图大） */
  bigPreview?: string;
}

/** catalog 活类型：风格/滤镜/运镜 = CreativePreset；MJ = MjPreset（带面板详情用的不落盘字段）。 */
export type CatalogPreset = CreativePreset | MjPreset;

/** 补齐 `cp_` 前缀的便捷包装（catalog 原始 id 无前缀）。 */
function normalizedPresetId(kind: PresetKind, rawId?: string): string {
  return presetIdFor(kind, rawId || '');
}

/** 归一化 风格/滤镜/运镜（构成 preview；motion 带 poster 作封面）。 */
function normalizeCreative(r: RawCreative): CreativePreset {
  const kind = (r.kind as PresetKind) || 'style';
  const rawPreview = r.preview || '';
  // 运镜的 preview 是 .mp4（实测 51/51 全是 mp4 + 独立 poster）。
  // 若不分开保存，UI 会拿 .mp4 去当 <img> 的 src（破图），且无从判断「这是视频卡」。
  // 故：video 单独存，preview 统一收敛为**静帧封面**（poster 优先）。
  // 【TD-16-4 收口 2026-09-16】原为内联 `/\.(mp4|webm|mov)(\?|$)/`（漏 mkv/avi/m4v/ogv，
  // 且 `?` 未剥纯 `#` 锚点）→ 统一走 assetType 真值源（EXT_KIND 全表 + 剥 ?#）。
  const isVideo = classifyAssetUrlKind(rawPreview) === 'video';
  return {
    id: normalizedPresetId(kind, r.id),
    kind,
    category: r.category || '',
    name: r.name || '',
    prompt: r.prompt || '',
    preview: isVideo ? r.poster || undefined : rawPreview || r.poster || undefined,
    video: isVideo ? rawPreview : undefined,
  };
}

/** 归一化 MJ 为 MjPreset（网格用缩略图 preview；详情大图 = bigPreview）。 */
function normalizeMj(r: RawMj): MjPreset {
  return {
    id: presetIdFor('mj', r.id || ''),
    kind: 'mj',
    group: r.group || 'char',
    category: r.category || '',
    name: r.name || '',
    prompt: r.prompt || '',
    preview: r.thumbnail || r.preview || undefined,
    mixed: !!r.mixed,
    medium: r.medium,
    codes: r.codes,
    parameters: r.parameters,
    vibe: r.vibe,
    bigPreview: r.preview || undefined,
  };
}

/** 全部风格预设（217）。 */
export const STYLE_PRESETS: CreativePreset[] = (creativeData as RawCreative[])
  .filter((r) => r.kind === 'style')
  .map(normalizeCreative);

/** 全部滤镜预设（17）。 */
export const FILTER_PRESETS: CreativePreset[] = (creativeData as RawCreative[])
  .filter((r) => r.kind === 'filter')
  .map(normalizeCreative);

/** 全部运镜预设（51）。 */
export const MOTION_PRESETS: CreativePreset[] = (creativeData as RawCreative[])
  .filter((r) => r.kind === 'motion')
  .map(normalizeCreative);

/** 全部 MJ 码图预设（493）。 */
export const MJ_PRESETS: MjPreset[] = (mjData as RawMj[]).map(normalizeMj);

/**
 * 按 kind 取目录 —— **catalog 分类导航的单一入口**（TD-05-14 接线：原为 0 消费的幽灵 API，
 * 外壳却手写了等价的 `catalog3` 且组件体内每 render 重建 → `useMemo` deps 恒失效）。
 *
 * 返回的是**模块级常量引用**（不是每次新建数组）→ 可安全用作 `useMemo` deps。
 * 参数类型用 `CATALOG_KINDS` 的联合（4 类，不含运行期才有的 'prompt'）：新增 catalog 类时
 * 此 switch 会因穷尽性检查报警，防「加了数据忘了接线」。
 */
export function catalogByKind(kind: CatalogKind): CatalogPreset[] {
  switch (kind) {
    case 'style':
      return STYLE_PRESETS;
    case 'filter':
      return FILTER_PRESETS;
    case 'motion':
      return MOTION_PRESETS;
    case 'mj':
      return MJ_PRESETS;
  }
}

export type { RawCreative, RawMj }; // 供测试/构建脚本引用原始形状
