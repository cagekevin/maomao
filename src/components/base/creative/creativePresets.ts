/**
 * creativePresets —— 创作库「预设」纯逻辑层（类型 / 校验 / 字典 GC / 裁剪）。
 *
 * 职责边界：**纯逻辑，不含 React / 存储 / 网络 / 预览图 URL 落地**。
 *   - 类型：`CreativePreset`（唯一实体）与 `CreativePresetsDict`（节点 data.creativePresets 字典）。
 *   - 命名空间：`presetIdFor` / 解析 `cp_` 前缀（与胶囊序列化 `@{id:label}` 共用同一 id 规则）。
 *   - 字典 GC：`syncCreativePresets(prompt, dict)` —— 删胶囊后清理孤儿字典项（I1）。
 *   - 裁剪校验：`trimPreset` —— 只留 6 个落盘字段，丢弃 `description/medium/codes/parameters/vibe`
 *     （I4「面板内数据不外泄进快照」，§一.2）。
 *
 * 数据来源（§一.2.1）：
 *   - 风格/滤镜/运镜/MJ（catalog 4 类）：`creativeCatalog.ts` 从 `data/*.json` 归一化产出，**只读**。
 *   - 「我的提示词」（kind='prompt'）：`promptManager` 本地库，运行期写入字典。
 *   - 本层不生产任何 catalog 项，只定义口径并校验/合成。
 *
 * 胶囊 ID 命名空间（§一.2；命名空间收口见 05 区日志 TD-05-15）：
 *   `cp_style-643` / `cp_filter-714` / `cp_motion-694` / `cp_mj-char1` / `cp_prompt-<id>`
 *   統一 `cp_` 前缀（下划线，走既有 `@{id:label}` 正则 group1，禁冒号）。
 *   注意：catalog 原始 id 无前缀（`style-643`/`char1`），本层统一补齐 `cp_` 前缀。
 *
 * 文件头 JSDoc 遵守 CLAUDE.md「决策记录铁律」——单文件机制落文件头。
 */

import { promptChipRe } from '../prompt/promptChips.ts';

/** 预设分区 kind（含运行期由 promptManager 写入的 'prompt'）。 */
export const PRESET_KINDS = ['style', 'filter', 'motion', 'mj', 'prompt'] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];

/**
 * catalog 归一化只产前 4 类；'prompt' 由 promptManager 运行期写入（§一.2）。
 * `as const` 保留字面量元组类型 → 可导出 `CatalogKind` 联合（供 `catalogByKind` 签名做穷尽检查）。
 */
export const CATALOG_KINDS = ['style', 'filter', 'motion', 'mj'] as const;
/** catalog 产出的 kind 联合（真源 = `CATALOG_KINDS`，非手写第二份）。 */
export type CatalogKind = (typeof CATALOG_KINDS)[number];

/** 预设胶囊的 `cp_` 前缀（单一命名空间标记） */
export const PRESET_ID_PREFIX = 'cp_';
/** MJ 分区额外区分：`cp_mj-<n>`（mj 原始 id 无 kind 前缀，需单独映射） */
const MJ_ID_PREFIX = 'cp_mj-';

/**
 * 创作库预设唯一实体（落盘形态，仅 6 字段）。
 * §一.2：不落盘字段（description/medium/codes/parameters/vibe）由 `trimPreset` 裁剪，
 * 禁止进入节点 data 快照（I4）。
 */
export interface CreativePreset {
  /** 带命名空间前缀：`cp_style-643` 等 */
  id: string;
  /** 分区归属 */
  kind: PresetKind;
  /** 分类名（真值见 §一.5） */
  category: string;
  /** 显示名（胶囊 label） */
  name: string;
  /** 片段正文，生成时替换胶囊 */
  prompt: string;
  /** 静帧封面路径（`/creative-presets/x.webp`），可选 */
  preview?: string;
  /**
   * 动态预览（运镜专有，`/creative-presets/x.mp4`），可选。
   * 【不落盘】只在面板内供悬停播放；`trimPreset` 的白名单不含它，禁进节点快照（I4）。
   */
  video?: string;
}

/**
 * 节点 `data.creativePresets` 字典的**值**形态（§一.3）—— 字典写入的唯一条目契约。
 * 由 `toDictEntry` 生产、`CreativePresetsDict` 承载；节点 / `useNodeData.addCreativePreset`
 * 一律引用本类型，禁再手抄 `Record<string,{kind:string;...}>`（TD-05-12 母体：手抄会
 * 让 `kind` 从 `PresetKind` 退化为 `string`，快照里的 kind 便不受约束）。
 */
export interface CreativePresetEntry {
  kind: PresetKind;
  name?: string;
  prompt: string;
}

/**
 * 节点 `data.creativePresets` 字典（§一.3）。
 * `Record<id, CreativePresetEntry>` —— kind 含 'prompt'；catalog 仅前 4 类，
 * prompt 条目由 promptManager 插入时写入。只保留胶囊正文合成所需的最小信息。
 */
export interface CreativePresetsDict {
  [id: string]: CreativePresetEntry;
}

/**
 * 给某条 catalog 原始项生成规范化 id（补齐 `cp_` 前缀）。
 * - style/filter/motion：原始 id 已含 kind 前缀（`style-643`）→ `cp_style-643`
 * - mj：原始 id 无 kind（`char1`）→ `cp_mj-char1`
 * - prompt：由调用方以 `cp_prompt-<id>` 传入（本函数不处理 prompt）
 * @param kind 分区
 * @param rawId catalog 原始 id（无前缀）
 */
export function presetIdFor(kind: PresetKind, rawId: string): string {
  if (!rawId) return '';
  return kind === 'mj' ? `${MJ_ID_PREFIX}${rawId}` : `${PRESET_ID_PREFIX}${rawId}`;
}

/** 断言字符串是否带创作库预设命名空间前缀（`cp_` 开头）。 */
export function isPresetId(id: string): boolean {
  return typeof id === 'string' && id.startsWith(PRESET_ID_PREFIX);
}

/**
 * 从 prompt 文本中抽出所有 `cp_*` 胶囊 id（与序列化正则同一规则，单一真源）。
 * 用 `promptChipRe`（`@{id:label}`）解析，只取 `cp_` 前缀者 —— 不重复实现第二套正则（M3 防抄两份）。
 */
export function collectPresetIds(prompt: string): string[] {
  const ids: string[] = [];
  if (!prompt || !prompt.includes('@')) return ids;
  const re = promptChipRe();
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    const id = m[1];
    if (isPresetId(id)) ids.push(id);
  }
  return ids;
}

/**
 * 字典 GC（唯一易漏点，I1）：返回**只含 prompt 中被引用 `cp_*` id** 的字典。
 * 删胶囊后调用 → 清掉孤儿条目，防止随快照落盘。
 * 纯函数：输入 prompt 文本 + 旧字典 → 输出裁剪后字典（不修改入参）。
 *
 * 【接线位置】**唯一调用点 = `normalizeChipFieldWrite`（下方）**，它被写 data 的两条路径
 * （`useNodeData.patchData` 与 `canvasHost.updateNodeData`）共用。
 * **禁在节点 `onChange` 里调用**：那是每次击键的高频路径，GC 要跑正则扫描 + 重建对象，
 * 放那儿等于把重活塞进输入热路径（本债登记的正是"原语建了、生产没接线"）。
 * @param prompt   当前 prompt 的序列化字符串（含 `@{cp_...:...}`）
 * @param dict     旧字典（可能含已被删除胶囊的孤儿项）
 */
export function syncCreativePresets(
  prompt: string,
  dict: CreativePresetsDict,
): CreativePresetsDict {
  if (!dict) return {};
  const ids = new Set(collectPresetIds(prompt));
  const next: CreativePresetsDict = {};
  for (const id of Object.keys(dict)) {
    if (ids.has(id)) next[id] = dict[id];
  }
  return next;
}

/**
 * 可能携带 `cp_*` 胶囊的 node.data 字段（GC 的扫描面）。
 * 判据：**能被富文本编辑器改、且内容会经 `resolvePromptChips` 解析**的字段。
 * 现为 prompt / text（TextGenerate 两者皆可含胶囊，取其并集）。新增此类字段须同步登记，
 * 否则该字段里删掉的胶囊仍会留下孤儿字典项（静默复发）。
 */
const CHIP_BEARING_FIELDS = ['prompt', 'text'] as const;

/**
 * 写 data 后的**字典归一化**（I1 接线点 · TD-05-13）—— 「写字段 + 清孤儿」收成一个不可分动作。
 *
 * 合并后的 data 若含 `creativePresets` 且本次 patch 触及 chip 字段（prompt/text），
 * 则把字典重算为「仍被胶囊引用」的子集；否则**原样返回**（无 dict 的节点零开销、不引入空字段）。
 *
 * 【为什么下沉为本层导出】原实现在 `useNodeData` 私有，但写 data 有**两条**路径
 * （界面写回 `useNodeData.patchData` / Agent 写回 `canvasHost.updateNodeData`），
 * 各写一半就会漏 —— 这属「探测/归一化重复」而非「判据重复」，故收口为唯一纯函数两处共用
 * （TD-05-13 症状原文即点名「含 Agent `update_node_any_field`」）。
 *
 * 【为什么是 no-op 安全的】通用画布原语（canvasHost / patchNodeDataById）不持有 creative 语义，
 * 本函数对「无 creativePresets 字段」的 data 直接返回原引用 → 通用路径零成本、零副作用。
 * @param data  合并后的完整 data
 * @param patch 本次 patch（只有触及 chip 字段才重算）
 * @returns 归一化后的 data（未触发时返回**同一引用**，供调用方做变更判定）
 */
export function normalizeChipFieldWrite(
  data: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  if (!CHIP_BEARING_FIELDS.some((f) => f in patch)) return data;
  const dict = data.creativePresets as CreativePresetsDict | undefined;
  if (!dict || Object.keys(dict).length === 0) return data; // 无字典 = 无孤儿可清
  // chip 字段可能多个（prompt / text），取并集后统一裁剪：任一字段仍引用即保留。
  const merged = CHIP_BEARING_FIELDS.map((f) => String(data[f] ?? '')).join('\n');
  return { ...data, creativePresets: syncCreativePresets(merged, dict) };
}

/**
 * 裁剪校验：把任意「可能带面板内字段」的对象收敛为只含 6 个落盘字段的 `CreativePreset`。
 * 丢弃：description / medium / codes / parameters / vibe / **video**（I4 + §一.2 验证口径）。
 *   注：`video`（运镜的 .mp4）是 2026-09-15 新增的**面板内**字段——走白名单挑选，
 *   本函数不显式列它，故天然被裁掉；新增字段务必确认不在此白名单内，否则破 I4。
 * 未知/缺字段不强行补（本函数只做「挑白名单字段」，不做合法性校验；
 *   需校验字典条目时用同文件的 `isValidPresetEntry`）。
 */
export function trimPreset(src: object): CreativePreset {
  const s = src as Record<string, unknown>;
  return {
    id: String(s.id ?? ''),
    kind: s.kind as PresetKind,
    category: String(s.category ?? ''),
    name: String(s.name ?? ''),
    prompt: String(s.prompt ?? ''),
    preview: s.preview !== undefined && s.preview !== null ? String(s.preview) : undefined,
  };
}

/**
 * 字典值校验（运行期防线）：非 `cp_*` 键 / 缺 prompt / kind 非法 → false。
 * 归一味用于「是否该把这条写入节点 data.creativePresets」。
 */
export function isValidPresetEntry(
  id: string,
  entry: { kind?: unknown; prompt?: unknown },
): boolean {
  return (
    !!isPresetId(id) &&
    entry !== null &&
    typeof entry === 'object' &&
    typeof entry.prompt === 'string' &&
    entry.prompt.length > 0
  );
}

/**
 * 生产字典值（把一条 CreativePreset 压成 `data.creativePresets` 所需的 `CreativePresetEntry` 形态）。
 * **字典写入的唯一入口**：节点 / 面板禁再手写 `{kind, name, prompt}` 字面量（TD-05-12）。
 */
export function toDictEntry(preset: CreativePreset): CreativePresetEntry {
  return { kind: preset.kind, name: preset.name, prompt: preset.prompt };
}
