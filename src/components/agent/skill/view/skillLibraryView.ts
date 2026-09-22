/**
 * Skill 库的**列表视图（纯函数）** —— "行 = 磁盘包 ∪ 索引状态"的唯一判定中枢。
 *
 * 【本模块存在的理由（TD-11-44）】此前界面把同一批技能画成了**两个列表**：
 * 上方「磁盘技能库」面板（直读磁盘、只读）与左栏「Skills 列表」（读索引、可编辑）
 * —— 用户看到两份几乎一样的清单，却不知道以哪份为准、该编辑哪个。
 * 根因是**列表骨架取自索引（投影）**：于是"磁盘上已删除的包"仍会以正常行出现，
 * 而"磁盘上有、索引没有"的包（缺 id）又只能在另一个列表里看见。
 *
 * 【本模块的口径】列表骨架 = **磁盘包**（真相源，ADR-0056 Q2）；索引只负责给行**补状态**。
 * 形状、状态、可用性全部只在这里判一次 —— 设置页列表、AI 面板下拉、（将来的）任何入口共用，
 * 不许各自再写一份（本仓典型事故形态：同一判据两处实现）。
 *
 * 【为什么不在这里读盘】纯函数：入参即"已经拿到的磁盘清单 / 索引条目 / 启用态"。读盘与重试
 * 属调用方（`skillApi` / `skillHydrate`），这样本文件可以零依赖单测，且"怎么算"与"怎么取"解耦。
 *
 * 【本文件只管"行怎么判、组怎么摆"（TD-11-68 拆后的边界）】
 *  · 组名/语义/措辞/排序 → `skillGroup.ts`（共享语义，两个用例都 import 它）
 *  · 选用入口（AI 面板下拉）的形状 → `skillPickerView.ts`
 * 变更理由因此独立：新增一个**行状态**不许碰到下拉的契约；改下拉的契约也不许动行状态机。
 */
import { contentFingerprint } from '@/components/base/core/utils.ts';
import { parseSkillMarkdown } from '../rules/skillManifest.ts';
import { findSkillEntryFile, skillEntryRelPath } from '../rules/skillEntry.ts';
import { isSkillEnabledIn } from '../store/skillRepository.ts';
import { extractResourcePaths } from '../rules/skillResourcePath.ts';
import {
  INDEX_ONLY_GROUP,
  OFFICIAL_GROUP,
  UNSORTED_GROUP,
  categoryInputOf,
  compareSkillGroups,
  kindOfGroup,
  labelOfGroup,
} from '../rules/skillGroup.ts';
import type { SkillGroupKind } from '../rules/skillGroup.ts';
import type { SkillLibrary } from '../skillTypes.ts';

/** 行状态（**状态在行上**，不需要第二个列表来告诉你"磁盘上没有这个"） */
export type SkillRowState =
  /** 磁盘有 + frontmatter 有 id + 索引里有 ⇒ 正常可用（可编辑） */
  | 'ok'
  /** 磁盘有、但 frontmatter 没有 id ⇒ 未纳入索引，只给「补齐 id」 */
  | 'missing-id'
  /** 磁盘有、有 id，但索引里没有（hydrate 还没收敛到它）⇒ 只给「重读」 */
  | 'not-indexed'
  /** 磁盘上那个目录在，但 `SKILL.md` 读不到 / 不是文本 ⇒ 只给「打开该包」 */
  | 'unreadable'
  /** 索引里有、磁盘上已没有 ⇒ 只给「恢复（写回磁盘）」「丢弃」（正文可能只剩索引这一份） */
  | 'index-only';

export interface SkillRow {
  /** 稳定键（缺 id / 读不到的行用它做 key）：有 id 用 id，否则 `<分组>/<目录名>` */
  key: string;
  /** frontmatter id（缺 id / 读不到 ⇒ `''`） */
  id: string;
  name: string;
  description: string;
  version?: string;
  /** 分组 = 磁盘一级目录名（内置 = 官方哨兵；**数据，不是给界面分支用的**） */
  group: string;
  groupLabel: string;
  /**
   * 分组输入框的**预填值**（编辑器直接用它）。
   * 兜底组（`_未分类`）⇒ 空串（它不是一个用户要填的组名）；不可编辑的行没有输入框 ⇒ 也空串。
   * 【为什么给这个字段】界面此前自己比 `UNSORTED_GROUP` 哨兵来折叠（`prefillCategory`）——
   * 与 TD-11-62 同族：哨兵是模块内部约定，泄漏出去 ⇒ 改哨兵值即静默失效。
   */
  categoryInput: string;
  /** 包目录名（内置为空） */
  slug: string;
  /** 相对技能库根的路径（内置为空 —— 它没有磁盘包） */
  relPath: string;
  state: SkillRowState;
  /**
   * **正文（磁盘当前版）** —— 编辑器拿它当初值。
   * 【为什么由本层给，而不是让界面自己再解析一遍】"编辑器里看到的一定是磁盘上那一版"必须是结构事实：
   * 界面若另解析一次，就又多出一份"当前正文"的判断（本仓典型事故形态）。
   */
  content: string;
  /**
   * 正文指纹 = **保存时的冲突基线**：磁盘当前正文与它不同 ⇒ 有人（人或另一次会话）在别处改过这一版
   * ⇒ 不静默覆盖（见 `saveSkillToDisk` 的 `baselineHash`）。
   */
  contentHash: string;
  /** 上次修改（**索引里的本地时间**；磁盘上没这个字段 ⇒ 缺省不显示） */
  updatedAt?: number;
  /** 正文里引用了、但包里没有的资料（模型读到会失败；行上先说了） */
  missingRefs: string[];
  /** 无描述 ⇒ **不进「可用清单」**（块① 只收有描述的）；仍可用于对话，故不是"不可用" */
  noDescription: boolean;
  /** 正文长度（字）—— 详情/编辑器的预算条用 */
  contentLength: number;
  /** 正文里显式引用的资料条数 */
  resourceCount: number;
  /** 已启用（索引里没记过 ⇒ 默认启用，与 `isSkillEnabled` 同口径） */
  enabled: boolean;
  /** **能用于对话**：磁盘有 + 有 id + 已在索引（= `state === 'ok'`） */
  usable: boolean;
  /** **能进编辑器**：只有 `usable` 的行（磁盘必须存在 ⇒ 结构上不可能"保存时把已删的包重建"） */
  editable: boolean;
  /** 官方内置：只给开关，不给编辑/删除/移动 */
  readonly: boolean;
}

/** 组头（组级开关的三态**在这里算**，组件不再自己算一份） */
export interface SkillGroupView {
  name: string;
  label: string;
  /**
   * 语义类别 —— **界面分支只看它**（官方段 / 已删除段 / 普通段）。
   * 消费者若去比 `name === '__official'` 就是绕回哨兵，改哨兵值会静默失效（TD-11-62）。
   */
  kind: SkillGroupKind;
  rows: SkillRow[];
  /** 组内**可开关**的行数（= 已纳入索引的行；缺 id / 仅索引 行不参与） */
  toggleable: number;
  /**
   * 组内**可开关**行的 id（批量开关直接用；与 `toggleable` **同源**）。
   * 【为什么由视图层给（TD-11-67）】"组内哪些行可开关"这条判据此前在视图层（算计数/三态）与消费者
   * （`SkillSettings` 自己 `filter(r => r.state === 'ok')` 取 id）**各判一次** ⇒ 判据一分歧就出
   * "组头显示 2/2 全开、点开关只动 1 个"这类**跨面不一致**（TD-11-50 的同一形态，只是换了个判据）。
   */
  toggleIds: string[];
  /** 其中已启用数 */
  onCount: number;
  /**
   * 组开关的状态：**二态**（用户裁定：分组开关只有全开 / 全关）。
   * 判据 = 组里**有任何一个**开着 ⇒ `on`；一个都没开（含无可开关行）⇒ `off`。
   * 「开了一半」不是第三种开关状态 —— 它就是"这组正在用"这一件事，开了几个看 `onCount/toggleable`。
   */
  toggleState: 'on' | 'off';
  readonly: boolean;
}

export interface SkillLibraryView {
  groups: SkillGroupView[];
  counts: {
    /** 磁盘上的技能包数（**芯片的"磁盘 N 包"**） */
    diskPackages: number;
    /** 列表总行数（磁盘包 + 内置 + 仅索引） */
    rows: number;
    /** 可用于对话的行数 */
    usable: number;
    /** 可用且已启用的行数 */
    enabled: number;
    /** 缺 frontmatter id（未纳入索引）的包数 */
    missingId: number;
    /** 只存在于索引（磁盘上已删除）的条数 */
    indexOnly: number;
  };
  /**
   * **未决**：磁盘清单没读到（后端没起 / 还没读）。此时按索引显示，但这**不是**"磁盘上没有技能"
   * —— 调用方必须把这件事说出来（黑话：不得用空清单否定真值）。
   */
  undecided: boolean;
}

/**
 * 索引条目的最小形状（本层只用这些；形状不全的按"没有它"处理）。
 * 【为什么导出】选用入口（`skillPickerView.buildSkillPickerGroups`）的入参就是它
 * —— 同一形状不许在两个用例里各写一份。
 */
export interface IndexRow {
  id?: unknown;
  category?: unknown;
  slug?: unknown;
  name?: unknown;
  description?: unknown;
  version?: unknown;
  content?: unknown;
  updatedAt?: unknown;
  /** `listAllSkills()` 会带的内置标记（选用入口用它把官方那批挑出来，见 `buildSkillPickerGroups`） */
  builtin?: unknown;
}

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

/** 内置技能的最小形状（`skillBuiltins.ts` 的 `BuiltinSkillDef` 结构子集） */
export interface BuiltinLike {
  id: string;
  name: string;
  description: string;
  content: string;
  version?: string;
}

/**
 * 索引条目是 `unknown` 形状 ⇒ 逐字段安全取值（形状不全按兜底，不抛）。
 * 【为什么导出】选用入口（`skillPickerView`）读的是**同一个** `IndexRow` 形状 ⇒
 * 这一行取值口径只留一份（模块内共享，门面不转发）。
 */
export const asText = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/**
 * 索引条目 → 行（两个来源：**未决时按索引显示** / **仅索引（磁盘上已删除）**）。
 *
 * 【为什么 `state` 必须由调用方给】`usable`/`editable` 都由 `state` 派生（能编辑 ⇒ 磁盘必存在，见不变量 18）。
 * 若这里先写死 `ok/usable/editable=true` 再由调用点改三个字段，**漏改一个就回归成"仅索引的行可用可编辑"**
 * —— 那是"先造错再覆盖"，本仓典型形态（TD-11-56）。
 */
function rowFromIndex(
  id: string,
  raw: IndexRow,
  enabled: boolean,
  state: SkillRowState = 'ok',
): SkillRow {
  const group = asText(raw?.category).trim() || UNSORTED_GROUP;
  const content = asText(raw?.content);
  const usable = isUsableState(state);
  return {
    key: id,
    id,
    name: asText(raw?.name) || asText(raw?.slug) || id,
    description: asText(raw?.description),
    version: typeof raw?.version === 'string' && raw.version ? raw.version : undefined,
    group,
    groupLabel: labelOfGroup(group),
    categoryInput: categoryInputOf(group, usable),
    slug: asText(raw?.slug),
    relPath: raw?.slug ? skillEntryRelPath(group, asText(raw.slug)) : '',
    state,
    content,
    contentHash: contentFingerprint(content),
    updatedAt: num(raw?.updatedAt),
    missingRefs: [],
    noDescription: !asText(raw?.description).trim(),
    contentLength: content.length,
    resourceCount: 0,
    enabled,
    usable,
    editable: usable,
    readonly: false,
  };
}

/**
 * 造视图。**入参一句话**：磁盘清单（`null` = 未决）+ 索引条目 + 启用态 + 内置常量。
 *
 * 【行从哪来】磁盘包（含 `SKILL.md` 正文）+ 内置常量 + "索引里有、磁盘没有"的条目。
 * 【谁排前】官方（内置）恒在最前；磁盘分组按 `compareSkillGroups`（`_未分类` 恒排最后）；
 * 「磁盘上已删除」收纳组恒在最后 —— 它是"待处置"，不是用户建的分组。
 */
export function buildSkillLibraryView(input: {
  disk: SkillLibrary | null;
  indexRows: unknown[];
  enabledMap: Record<string, boolean>;
  builtins: BuiltinLike[];
}): SkillLibraryView {
  // 「默认启用」的判据**不在这里**：它跟着 `agent_skill_enabled` 键走（`skillRepository.isSkillEnabledIn`）
  const enabledOf = (id: string) => isSkillEnabledIn(input.enabledMap, id);

  const indexById = new Map<string, IndexRow>();
  for (const raw of input.indexRows || []) {
    const row = raw as IndexRow;
    if (typeof row?.id === 'string' && row.id) indexById.set(row.id, row);
  }

  const rows: SkillRow[] = [];
  const diskIds = new Set<string>();

  if (input.disk === null) {
    // 【未决】按索引显示（顶部横幅说明"这不代表磁盘上没有别的技能"）
    for (const [id, raw] of indexById) rows.push(rowFromIndex(id, raw, enabledOf(id)));
  } else {
    for (const pkg of input.disk.packages || []) {
      const relPath = skillEntryRelPath(pkg.category, pkg.slug);
      const md = findSkillEntryFile(pkg.contents);
      if (!md || md.encoding !== 'utf8') {
        // 残包 / 二进制：如实列出来（不隐藏），但只能"打开该包"去看
        rows.push({
          key: `${pkg.category}/${pkg.slug}`,
          id: '',
          name: pkg.slug,
          description: '',
          group: pkg.category,
          groupLabel: labelOfGroup(pkg.category),
          categoryInput: '', // 不可编辑（读不到 SKILL.md）⇒ 没有输入框
          slug: pkg.slug,
          relPath,
          state: 'unreadable',
          content: '',
          contentHash: '',
          missingRefs: [],
          noDescription: true,
          contentLength: 0,
          resourceCount: 0,
          enabled: false,
          usable: false,
          editable: false,
          readonly: false,
        });
        continue;
      }
      const { manifest, body } = parseSkillMarkdown(md.content);
      const id = typeof manifest.id === 'string' ? manifest.id.trim() : '';
      if (id) diskIds.add(id);
      const present = new Set((pkg.contents || []).map((f) => f.relPath));
      const referenced = extractResourcePaths(body);
      const missingRefs = referenced.filter((p) => !present.has(p));
      const description = manifest.description || '';
      const state: SkillRowState = !id ? 'missing-id' : indexById.has(id) ? 'ok' : 'not-indexed';
      rows.push({
        key: id || `${pkg.category}/${pkg.slug}`,
        id,
        name: manifest.name || pkg.slug,
        description,
        version: manifest.version,
        group: pkg.category,
        groupLabel: labelOfGroup(pkg.category),
        categoryInput: categoryInputOf(pkg.category, isUsableState(state)),
        slug: pkg.slug,
        relPath,
        state,
        content: body,
        contentHash: contentFingerprint(body),
        updatedAt: num(indexById.get(id)?.updatedAt),
        missingRefs,
        noDescription: !description.trim(),
        contentLength: body.length,
        resourceCount: referenced.length,
        enabled: id ? enabledOf(id) : false,
        usable: isUsableState(state),
        editable: isUsableState(state), // 能编辑 ⇒ 磁盘必有（见 README 不变量 18）
        readonly: false,
      });
    }
    // 索引里有、磁盘上已没有：**不隐藏**（正文可能只剩索引这一份），但也不伪装成正常行
    for (const [id, raw] of indexById) {
      if (diskIds.has(id)) continue;
      rows.push(rowFromIndex(id, raw, enabledOf(id), 'index-only'));
    }
  }

  for (const b of input.builtins || []) {
    rows.push({
      key: b.id,
      id: b.id,
      name: b.name,
      description: b.description,
      version: b.version,
      group: OFFICIAL_GROUP,
      groupLabel: labelOfGroup(OFFICIAL_GROUP),
      categoryInput: '', // 内置不可编辑（代码常量）
      slug: '',
      relPath: '',
      state: 'ok',
      content: asText(b.content),
      contentHash: contentFingerprint(asText(b.content)),
      missingRefs: [],
      noDescription: !asText(b.description).trim(),
      contentLength: asText(b.content).length,
      resourceCount: 0,
      enabled: enabledOf(b.id),
      usable: true,
      editable: false, // 内置是代码常量：能开关，不能改
      readonly: true,
    });
  }

  // ── 归组（骨架 = 磁盘分组 ∪ 官方 ∪ 仅索引收纳组）──────────────────────────
  const groups = new Map<string, SkillRow[]>();
  const ensure = (g: string): SkillRow[] => {
    const bucket = groups.get(g);
    if (bucket) return bucket;
    const fresh: SkillRow[] = [];
    groups.set(g, fresh);
    return fresh;
  };
  if (input.builtins?.length) ensure(OFFICIAL_GROUP);
  for (const g of input.disk?.groups || []) if (g && g !== OFFICIAL_GROUP) ensure(g);
  for (const r of rows) {
    if (r.state === 'index-only') continue; // 它归"已删除"收纳组，不进任何磁盘分组
    ensure(r.group).push(r);
  }

  const toGroup = (name: string, bucket: SkillRow[]): SkillGroupView => {
    const toggleable = bucket.filter((r) => r.state === 'ok');
    const onCount = toggleable.filter((r) => r.enabled).length;
    const kind = kindOfGroup(name); // 语义只在这里从组名推出（消费者读 kind，不读 name）
    return {
      name,
      label: labelOfGroup(name),
      kind,
      rows: bucket,
      toggleable: toggleable.length,
      toggleIds: toggleable.map((r) => r.id), // 与 `toggleable` 同源：消费者别再自己 `filter(state==='ok')`
      onCount,
      toggleState: onCount > 0 ? 'on' : 'off',
      readonly: kind === 'official',
    };
  };

  const ordered: SkillGroupView[] = [];
  const names = [...groups.keys()].sort((a, b) => {
    if (a === OFFICIAL_GROUP) return -1;
    if (b === OFFICIAL_GROUP) return 1;
    return compareSkillGroups(a, b);
  });
  for (const name of names) {
    const bucket = groups.get(name)!;
    bucket.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    ordered.push(toGroup(name, bucket));
  }
  const indexOnlyRows = rows.filter((r) => r.state === 'index-only');
  if (indexOnlyRows.length) {
    indexOnlyRows.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    ordered.push(toGroup(INDEX_ONLY_GROUP, indexOnlyRows));
  }

  return {
    groups: ordered,
    counts: {
      diskPackages: input.disk?.packages?.length || 0,
      rows: rows.length,
      usable: rows.filter((r) => r.usable).length,
      enabled: rows.filter((r) => r.usable && r.enabled).length,
      missingId: rows.filter((r) => r.state === 'missing-id').length,
      indexOnly: indexOnlyRows.length,
    },
    undecided: input.disk === null,
  };
}

/**
 * **能用于对话**的唯一判据：只有"磁盘有 + 有 id + 已在索引"（= `ok`）才算。
 * 缺 id（不在索引里）与仅索引（磁盘上已删）都**不**算。
 * （"无描述"仍算可用 —— 它只是不进「可用清单」块①，正文照样能注入。）
 *
 * 【为什么不导出】目前只有本文件在用（列表行）+ 界面据 `row.usable` 渲染。
 * AI 面板的取用面走 `skillPickerView`（它读的是 `row.usable`，不是本函数）。
 */
function isUsableState(state: SkillRowState): boolean {
  return state === 'ok';
}
