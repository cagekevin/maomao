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
 *       本层把它们放进 `MjPreset` 富形态（UI 用），插入字典时经 `trimPreset` 裁剪（I4）。
 *
 * 本层只产 catalog 前 4 类（style/filter/motion/mj）；`cp_prompt-*` 由 promptManager 运行期写入（§一.2.1）。
 */

import type { CreativePreset, PresetKind } from './creativePresets.ts';
import { presetIdFor } from './creativePresets.ts';
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

/** MJ 原始 JSON 的形状（面略字段 = 不落盘字段，I4 裁剪依据）。 */
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

/** MJ 富形态（含面板详情所需的不落盘字段）；插入字典前须 `trimPreset` 裁剪。 */
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

/** catalog 活类型：风格/滤镜/运镜 = CreativePreset；MJ = MjPreset（带面略字段）。 */
export type CatalogPreset = CreativePreset | MjPreset;

/** 判定是否为 MjPreset（带 codes）。 */
function isMj(p: CatalogPreset): p is MjPreset {
  return p.kind === 'mj';
}

function norPref(kind: PresetKind, rawId?: string): string {
  return presetIdFor(kind, rawId || '');
}

/** 归一化 风格/滤镜/运镜（构成 preview；motion 带 poster 作封面）。 */
function normalizeCreative(r: RawCreative): CreativePreset {
  const kind = (r.kind as PresetKind) || 'style';
  return {
    id: norPref(kind, r.id),
    kind,
    category: r.category || '',
    name: r.name || '',
    prompt: r.prompt || '',
    preview: r.preview || r.poster || undefined,
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

/** 四类目录全量（供外壳一次渲染）。 */
export const ALL_CATALOG: CatalogPreset[] = [
  ...STYLE_PRESETS,
  ...FILTER_PRESETS,
  ...MOTION_PRESETS,
  ...MJ_PRESETS,
];

/** 按 kind 取目录（目录内分类导航的单一入口）。 */
export function catalogByKind(kind: 'style' | 'filter' | 'motion' | 'mj'): CatalogPreset[] {
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

export { isMj }; // re-export 供 UI 层类型收窄（trimPreset 前判断富字段可用）
export type { RawCreative, RawMj }; // 供测试/构建脚本引用原始形状
