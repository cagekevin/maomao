/**
 * 设置 · Skill 库 —— **一条导航 · 一片内容 · 一个编辑器**（docs/plan/141，母债 TD-11-44）。
 *
 * 【本页的定位（一句话）】技能库的"文件管理器 + 正文编辑器"：
 *   · **列表里的每一行就是磁盘上的一个包**（骨架来自磁盘，索引只负责补状态）；
 *   · **点保存 = 直接写那个包**（整包原子写，写盘成功才更新索引）—— 用户感知不到"缓存"这个东西；
 *   · 界面做的事，人在 Finder 里也能做，**结果等价**（改名/移动目录不改 id ⇒ 身份不丢）。
 *
 * 【页面里的三条铁律】
 *  ① **状态在行上**：缺 id / 未纳入索引 / 仅索引（磁盘上已删）/ 无描述 / 引用缺失 全部写在行里，
 *     不需要第二个列表来告诉你（"待处置"只是同一批行的**另一个视图**，不新写判据）；
 *  ② **能编辑的行，磁盘上一定存在**（`row.editable`）⇒ "点保存把已删的包静默重建"结构上不可达；
 *  ③ **保存不静默覆盖**：磁盘那一版被外部改过 ⇒ 弹冲突选择（两个写者真实存在，见 `saveSkillToDisk`）。
 *
 * 【布局为什么是「导航条 + 内容区」而不是「左列表 + 右详情」】
 *   - 分组 = 磁盘上的**文件夹** ⇒ 它是空间导航，不是列表里的一行小标题 ⇒ 给它一条常驻导航条；
 *   - 写正文是这个页面的主活 ⇒ 选中一行后**内容区整体换成编辑器**（拿到全宽，而不是半个卡片）；
 *   - 导航条在编辑时**常驻** ⇒ 改完一个可以点另一个组接着改，不需要先返回。
 *
 * 【为什么没有搜索框】用户裁定（技能就几个，搜索是噪声），组件测试 `tests/unit/skillSettings.test.tsx`
 * 锁死了这一点；要按名字找请走导航条 + 分组。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  Download,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  getBuiltinSkills,
  backfillMissingIds,
  buildSkillLibraryView,
  createSkillGroup,
  deleteSkillEverywhere,
  discardSkillFromIndex,
  getSkillConfig,
  importSkillPackages,
  importSkillText,
  isImportablePackageFile,
  isSkillImportFile,
  migrateSkillsToDiskIfNeeded,
  readSkillEnabledMap,
  readSkillLibrary,
  readUserSkills,
  reloadSkillsFromDisk,
  restoreSkillFromIndex,
  saveSkillToDisk,
  setSkillConfig,
  setSkillsEnabled,
  SKILL_IMPORT_ACCEPT,
  SKILL_LIMIT_SUGGESTED_MAX,
  SKILL_MAX_FILE_BYTES,
  skillMarkdownForExport,
  skillNameFromFile,
  openSkillFolder,
  ENABLED_KEY,
  SKILLS_KEY,
  type SkillConfig,
  type SkillGroupView,
  type SkillLibrary,
  type SkillRow,
} from '@/components/agent/skill';
import { selectSkillInCurrentConversation } from '@/components/agent';
import { contentSubscribe } from '@/components/base/core/contentStore';
import { logger } from '@/components/base/core/log/logger';
import { showToast } from '@/components/base/core/event/toastStore';
import { askConfirm } from '@/components/base/core/event/confirmStore';
import { downloadBlob } from '@/components/base/utils/net/clipboard';
import { Toggle } from '@/components/base/ui/form/Toggle';

const inputCls =
  'w-full bg-canvas border border-edge text-body text-sm px-3 py-2.5 rounded-xl outline-none placeholder:text-muted focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/10 transition disabled:opacity-50';

/** 预算项的界面名（超建议上界时点名用；与 `SKILL_LIMIT_SUGGESTED_MAX` 的键一一对应） */
const BUDGET_LABELS: Record<keyof typeof SKILL_LIMIT_SUGGESTED_MAX, string> = {
  singleSkillChars: '单个 Skill 正文上限',
  expansionTotalChars: '一次注入合计上限',
  maxExplicitBindings: '一次对话最多带几个',
};

/** 目录选择器：`webkitdirectory` 不在 React 的 props 类型里（非标准属性），用展开注入（不用 as any） */
const DIR_PICKER_PROPS: Record<string, string> = { webkitdirectory: '', directory: '' };

/**
 * 导航条的选中值：
 *  · `''` = 全部（默认，按组分段显示全部行）
 *  · `'__fix'` = 待处置（同一批问题行的**聚合视图**，不是第二份判据）
 *  · 其余 = 某个分组名（`SkillGroupView.name`）
 */
const ALL_GROUPS = '';
const FIX_VIEW = '__fix';

interface EditForm {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
}

const emptyForm = (): EditForm => ({
  id: '',
  name: '',
  description: '',
  content: '',
  category: '',
});

/**
 * 三态开关（全开 / **部分** / 全关）。
 * 【为什么必须有】二态 Toggle 表达不了"组里开了一半" —— 旧版只能靠旁边一行小字（"部分 2/4"）救场，
 * 于是"部分"与"全关"在控件上长得一模一样。三态控件自己说状态，小字只留计数。
 * 【为什么放在本文件】目前只有组头一个消费者 ⇒ 不往 `base/ui/form` 里加通用原语（ADR-0053：
 * 无第二个真实消费者不许预留）；出现第二个消费者时再上移。
 */
function TriToggle({
  state,
  onToggle,
  disabled,
}: {
  state: 'on' | 'partial' | 'off';
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}) {
  const title =
    state === 'on' ? '本组全部启用 · 点一下全部停用' : '本组未全部启用 · 点一下全部启用';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={state === 'on' ? true : state === 'partial' ? 'mixed' : false}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(state !== 'on'); // 未全开 ⇒ 全开；已全开 ⇒ 全关
      }}
      className={`relative w-8 h-[18px] rounded-full transition shrink-0 cursor-pointer border-none disabled:opacity-40
        ${state === 'off' ? 'bg-surface-3' : 'bg-blue-500/80'}`}
    >
      <span
        className={`absolute top-[2px] h-[14px] rounded-full bg-white transition-all
          ${state === 'on' ? 'left-[16px] w-[14px]' : state === 'partial' ? 'left-[7px] w-[8px]' : 'left-[2px] w-[14px]'}`}
      />
    </button>
  );
}

/** 行上的状态徽标（状态只在这里说一次，不在第二个列表里） */
function RowBadges({ row }: { row: SkillRow }) {
  const chip = 'shrink-0 text-[10px] px-1.5 py-[1px] rounded bg-surface-2';
  return (
    <>
      {row.state === 'missing-id' && (
        <span
          className={`${chip} text-amber-300`}
          title="这个包没有 frontmatter id ⇒ 未纳入索引，无法用于对话"
        >
          缺 id
        </span>
      )}
      {row.state === 'not-indexed' && (
        <span
          className={`${chip} text-secondary`}
          title="索引里还没有它 ⇒ 点导航条底部的「从磁盘重读」收敛"
        >
          未纳入索引
        </span>
      )}
      {row.state === 'unreadable' && (
        <span
          className={`${chip} text-red-300`}
          title="读不到 SKILL.md（残包或二进制）⇒ 打开该包看看"
        >
          读不到 SKILL.md
        </span>
      )}
      {row.state === 'index-only' && (
        <span
          className={`${chip} text-amber-300`}
          title="磁盘上已经没有这个包，只剩索引里这一份正文"
        >
          磁盘上已删除
        </span>
      )}
      {row.noDescription && row.usable && (
        <span
          className={`${chip} text-amber-300`}
          title="没有描述 ⇒ 不会出现在「可用 Skill 清单」里"
        >
          无描述
        </span>
      )}
      {row.missingRefs.length > 0 && (
        <span
          className={`${chip} text-amber-300`}
          title={`正文引用了包里没有的资料：${row.missingRefs.join('、')}`}
        >
          引用缺失 {row.missingRefs.length}
        </span>
      )}
    </>
  );
}

/** 单条技能行（状态 + 该状态唯一能做的动作，都写在行上） */
function Row({
  row,
  active,
  onSelect,
  onToggle,
  onQuickAction,
}: {
  row: SkillRow;
  active: boolean;
  onSelect: () => void;
  onToggle: (v: boolean) => void;
  onQuickAction: (kind: 'backfill' | 'restore' | 'discard' | 'reload') => void;
}) {
  const quickBtn =
    'shrink-0 text-[10px] px-1.5 py-[2px] rounded bg-surface-2 hover:bg-surface-3 cursor-pointer border-none';
  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition
        ${active ? 'bg-surface-active border border-edge' : 'border border-transparent hover:bg-surface-hover'}`}
      onClick={onSelect}
    >
      {row.readonly ? (
        <Bot size={13} className="shrink-0 text-secondary" />
      ) : (
        <span className="shrink-0 w-[13px] text-[11px] text-muted">·</span>
      )}
      <span className={`flex-1 text-sm truncate ${row.usable ? 'text-body' : 'text-muted'}`}>
        {row.name}
      </span>
      <RowBadges row={row} />
      {row.state === 'missing-id' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickAction('backfill');
          }}
          className={`${quickBtn} text-body`}
        >
          补齐 id
        </button>
      )}
      {row.state === 'not-indexed' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickAction('reload');
          }}
          className={`${quickBtn} text-body`}
        >
          重读
        </button>
      )}
      {row.state === 'index-only' && (
        <span className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction('restore');
            }}
            className={`${quickBtn} text-body`}
          >
            恢复
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction('discard');
            }}
            className={`${quickBtn} text-muted`}
          >
            丢弃
          </button>
        </span>
      )}
      {row.state === 'ok' && <Toggle checked={row.enabled} onChange={onToggle} />}
    </div>
  );
}

/**
 * 数值设置项（**失焦/回车才提交**）。
 * 【为什么不在 onChange 里写】每敲一个字符都写一次存储 = 一次持久化 + 一次云同步候选推送；
 * 且中间态（如想输 12000 时的 "1"）会被当成有效值写进去。
 */
function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <label className="flex items-center gap-2 text-xs text-secondary">
      {label}
      <input
        type="number"
        min={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (Number.isFinite(n) && n > 0) onCommit(Math.floor(n));
          else setDraft(String(value)); // 非法输入 ⇒ 回显现值（不写坏值）
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-24 h-7 bg-canvas border border-edge rounded-lg px-2 text-xs text-body outline-none focus:border-blue-500/50"
      />
    </label>
  );
}

/**
 * 正文长度 → 预算条（正常 / 接近上限 / 超限 三档）。
 * 【为什么配一条进度条】只有一行数字时，"超限"和"还早"在视觉上差别极小；
 * 条把"占了多少"变成一眼可见的量（与 `BudgetBar` 的两档色调同一口径，不新增判据）。
 */
function BudgetBar({ length, limit }: { length: number; limit: number }) {
  const ratio = limit > 0 ? length / limit : 0;
  const tone = ratio > 1 ? 'text-red-300' : ratio > 0.9 ? 'text-amber-300' : 'text-muted';
  const fill = ratio > 1 ? 'bg-red-500' : ratio > 0.9 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div>
      <div className={`flex items-center justify-between text-[11px] ${tone}`}>
        <span>正文长度 · 占单篇上限</span>
        <span>
          {length.toLocaleString()} / {limit.toLocaleString()} 字
        </span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${fill}`}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>
      {ratio > 1 && (
        <div className={`mt-1 text-[11px] ${tone}`}>
          超出 {(length - limit).toLocaleString()}，发给 AI 时会被截断（已注明）
        </div>
      )}
    </div>
  );
}

/**
 * 行 → 问题说明（**待处置**视图用）。
 * 【为什么这份文案住在这里】判据仍是视图层给的 `row.state` / `missingRefs` / `noDescription`，
 * 本函数只把它们映射成人话 —— 是**呈现**，不是第二份判据（与 `RowBadges` 同一层，两者说的是同一件事）。
 */
function problemOf(
  row: SkillRow,
): {
  badge: string;
  why: string;
  action: 'backfill' | 'reload' | 'restore' | 'edit' | null;
} | null {
  if (row.state === 'missing-id')
    return {
      badge: '缺 id',
      why: 'SKILL.md 的 frontmatter 里没写 id，所以它不会登记进索引 —— AI 看不到它。补 id 会写回这个文件，不动正文。',
      action: 'backfill',
    };
  if (row.state === 'not-indexed')
    return {
      badge: '未纳入索引',
      why: '磁盘上有这个包，但索引还没读到它（可能刚放进去）。重读一次就好。',
      action: 'reload',
    };
  if (row.state === 'unreadable')
    return {
      badge: '读不到 SKILL.md',
      why: '目录在，但入口文件读不到或是二进制（残包）。只能打开文件夹去看它到底是什么。',
      action: null,
    };
  if (row.state === 'index-only')
    return {
      badge: '磁盘上已删除',
      why: '磁盘上那个文件夹已经没了，索引里还留着正文 —— 这可能是它唯一的一份。恢复会把它写回磁盘；丢弃则连索引一起清掉，之后无法再恢复。',
      action: 'restore',
    };
  if (row.missingRefs.length)
    return {
      badge: `引用缺失 ${row.missingRefs.length}`,
      why: `正文引用了包里没有的资料：${row.missingRefs.join('、')}。模型读到会失败。`,
      action: null,
    };
  if (row.noDescription && row.usable)
    return {
      badge: '无描述',
      why: '说不出用途 ⇒ 不会出现在「可用 Skill 清单」里（仍然可以手动带进对话）。',
      action: 'edit',
    };
  return null;
}

export default function SkillSettings() {
  // ── 数据：磁盘（真相源）+ 索引（投影）+ 启用态 + 设置 ──────────────────────────
  /** `null` = **未决**（还没读到 / 读不到）—— 与"磁盘上确实没有技能"是两件事 */
  const [disk, setDisk] = useState<SkillLibrary | null>(null);
  const [indexRows, setIndexRows] = useState<unknown[]>(() => readUserSkills().list);
  const [indexError, setIndexError] = useState(() => readUserSkills().error || '');
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() =>
    readSkillEnabledMap(),
  );
  const [cfg, setCfg] = useState<SkillConfig>(() => getSkillConfig());

  // ── 界面态 ────────────────────────────────────────────────────────────────
  const [selectedKey, setSelectedKey] = useState('');
  const [form, setForm] = useState<EditForm>(emptyForm);
  /** `detail` = 编辑器**只读态**；`edit` = 可编辑。两者是**同一份渲染**，不是两个页面 */
  const [mode, setMode] = useState<'detail' | 'edit'>('detail');
  /** 进编辑态那一刻的正文指纹 = **保存时的冲突基线** */
  const [baselineHash, setBaselineHash] = useState('');
  const [conflict, setConflict] = useState<{ diskContent: string; message: string } | null>(null);
  /** 导航条的选中项（'' = 全部；'__fix' = 待处置；其余 = 分组名） */
  const [railSel, setRailSel] = useState<string>(ALL_GROUPS);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  const importRef = useRef<HTMLDivElement | null>(null);
  const mdFileRef = useRef<HTMLInputElement | null>(null);
  const dirFileRef = useRef<HTMLInputElement | null>(null);

  const refreshIndex = useCallback(() => {
    const r = readUserSkills();
    setIndexError(r.error || '');
    setIndexRows(r.list);
  }, []);
  const refreshEnabled = useCallback(() => setEnabledMap(readSkillEnabledMap()), []);

  /**
   * 读盘（+ 收敛索引）。**两个动作的顺序不可换**：先 `reloadSkillsFromDisk`（磁盘 → 索引 hydrate），
   * 再读磁盘清单渲染 —— 否则"磁盘有、索引没有"的包会先以 `未纳入索引` 闪一下。
   * 读不到磁盘 ⇒ `disk = null`（**未决**），页面按索引显示并由横幅说明，绝不当成"你磁盘上什么都没有"。
   */
  const load = useCallback(
    async (opts: { report?: boolean } = {}) => {
      setBusy(true);
      const h = await reloadSkillsFromDisk();
      refreshIndex();
      refreshEnabled();
      const r = await readSkillLibrary();
      setDisk(r.ok ? r.data : null);
      setBusy(false);
      if (!r.ok) {
        logger.warn('SkillSettings', '读取技能库失败（按索引显示并标注未决）', r.message);
      }
      if (opts.report) {
        // 【三态如实报】未决 ≠ "磁盘与索引一致"（未决时磁盘没给出可写的结论）
        if (!r.ok) setNotice(`读取磁盘失败：${r.message}`);
        else if (h.undecided)
          setNotice('磁盘上还没有可用技能包 ⇒ 索引未改动（要删索引里的条目，请用行上的「丢弃」）');
        else if (h.changed) setNotice(`已从磁盘重读：纳入/更新 ${h.loaded} 条`);
        else setNotice('磁盘与索引一致，无需更新');
        if (h.failures.length) setNotice(`${h.failures.length} 个包**未纳入**：${h.failures[0]}`);
        // 已纳入但引用的资料不在包里：说清"它已经能用，只是某个资料读不到"（行上也有标记）
        if (h.warnings.length) {
          setNotice(
            `${h.warnings.length} 个包引用的资料缺失（已纳入，行上有标记）：${h.warnings[0]}`,
          );
        }
      }
    },
    [refreshIndex, refreshEnabled],
  );

  useEffect(() => {
    void (async () => {
      // 一次性迁移（旧 localStorage 里的 skill → 磁盘）：幂等、不改写旧键 ⇒ 挂在页面挂载上跑（与旧面板同款）。
      // 只有**真有东西可迁 / 有失败**时才说话 —— 平时不占一行提示。
      const m = await migrateSkillsToDiskIfNeeded();
      if (m.error) setNotice(`迁移未完成：${m.error}`);
      else if (m.migrated > 0) setNotice(`已把 ${m.migrated} 个旧技能迁移到磁盘`);
      if (m.failures.length) setNotice(`迁移失败 ${m.failures.length} 条（已原样保留）`);
      await load();
    })();
  }, [load]);
  // 索引变了（云同步写回 / 别处 hydrate）⇒ 重读索引；启用态变了 ⇒ 重取
  useEffect(() => contentSubscribe(SKILLS_KEY, refreshIndex), [refreshIndex]);
  useEffect(() => contentSubscribe(ENABLED_KEY, refreshEnabled), [refreshEnabled]);

  // 下拉（导入）点击外部关闭
  useEffect(() => {
    if (!importOpen) return;
    const close = (e: Event) => {
      if (importRef.current && !importRef.current.contains(e.target as Node)) setImportOpen(false);
    };
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [importOpen]);

  // ── 视图（行 = 磁盘包 ∪ 索引状态；判定全在纯函数里）────────────────────────────
  const view = useMemo(
    () =>
      buildSkillLibraryView({
        disk,
        indexRows,
        enabledMap,
        builtins: getBuiltinSkills(),
      }),
    [disk, indexRows, enabledMap],
  );
  const allRows = useMemo(() => view.groups.flatMap((g) => g.rows), [view]);
  const selected = useMemo(
    () => allRows.find((r) => r.key === selectedKey) || null,
    [allRows, selectedKey],
  );

  /** 导航条：分组按视图层给的 `kind` 分栏（官方 / 普通 / 已删除），不比哨兵字符串（TD-11-62） */
  const rail = useMemo(
    () => ({
      normal: view.groups.filter((g) => g.kind === 'normal'),
      official: view.groups.filter((g) => g.kind === 'official'),
      deleted: view.groups.filter((g) => g.kind === 'index-only'),
    }),
    [view],
  );

  /** 待处置 = 同一批"有问题"的行（判据与行徽标同源：`row.state` / `missingRefs` / `noDescription`） */
  const problemRows = useMemo(
    () =>
      allRows
        .map((r) => ({ row: r, info: problemOf(r) }))
        .filter(
          (x): x is { row: SkillRow; info: NonNullable<ReturnType<typeof problemOf>> } =>
            x.info !== null,
        ),
    [allRows],
  );

  const shownGroups: SkillGroupView[] = useMemo(() => {
    if (railSel === FIX_VIEW) return [];
    if (railSel === ALL_GROUPS) return view.groups;
    return view.groups.filter((g) => g.name === railSel);
  }, [view, railSel]);

  // 「已删除」收纳组不进分组候选 —— 判据读**视图层给的语义** `kind`，不比哨兵字符串（TD-11-62）
  const groupNames = useMemo(
    () => view.groups.filter((g) => g.kind !== 'index-only').map((g) => g.name),
    [view],
  );
  const overBudget = (
    Object.keys(SKILL_LIMIT_SUGGESTED_MAX) as (keyof typeof SKILL_LIMIT_SUGGESTED_MAX)[]
  )
    .filter((k) => cfg.contentLimits[k] > SKILL_LIMIT_SUGGESTED_MAX[k])
    .map((k) => BUDGET_LABELS[k]);
  // ⚠️ 【不要拿「已启用数」去比 `maxExplicitBindings`】两者不是同一个东西：
  //   · 本页的开关 = 这个技能进不进 AI 助手的**可选列表**（候选池，开多少个都合法；
  //     面板用 `isSkillEnabled` 先过一遍，见 `AgentPanel`）；
  //   · `maxExplicitBindings` = **一次对话里最多同时挂几个**（`freezeSkillTurn` → `buildBoundSkillBlocks`
  //     `slice(0, N)`，超出的本次不注入，但会在发给模型的文本里点名注明，不静默丢）。
  // 把"候选池大小"标成"超出上限"是假宣称 —— 这两件事在设置页里没有可比性。
  const patchConfig = (patch: {
    catalogToModel?: boolean;
    contentLimits?: Partial<SkillConfig['contentLimits']>;
  }) => setCfg(setSkillConfig(patch));

  // ── 行级动作 ──────────────────────────────────────────────────────────────
  const handleToggle = (row: SkillRow, v: boolean) => {
    setSkillsEnabled([row.id], v);
    refreshEnabled();
  };
  const handleGroupToggle = (group: SkillGroupView, v: boolean) => {
    // 可开关的 id 由视图层给（`toggleIds`，与组头的计数/三态**同源**）——
    // 这里不再自己 `filter(r => r.state === 'ok')`：那会让"组头说 2/2、开关只动 1 个"成为可能（TD-11-67）
    const ids = group.toggleIds;
    if (!ids.length) return;
    setSkillsEnabled(ids, v);
    refreshEnabled();
  };

  /**
   * 选中一行 ⇒ **把这一行装进编辑器**（只读态）。
   * 【为什么选中即填表单】编辑器只有一份渲染（只读 / 可编辑两态），
   * 先填好再决定能不能改，就不需要"详情卡片"这份并行渲染了。
   */
  const fillForm = (row: SkillRow) => {
    setForm({
      id: row.id,
      name: row.name,
      description: row.description,
      content: row.content, // 磁盘当前版（视图层给的，界面不再自己解析）
      category: row.categoryInput, // 预填值由视图层给（界面不比 `_未分类` 哨兵，TD-11-58）
    });
    setBaselineHash(row.contentHash);
  };

  const handleBackfill = async () => {
    setBusy(true);
    const r = await backfillMissingIds();
    setBusy(false);
    const parts = [`已补齐 ${r.patched.length} 个`];
    if (r.failed.length) parts.push(`失败 ${r.failed.length} 个：${r.failed[0]?.message || ''}`);
    if (r.error) parts.push(r.error);
    setNotice(parts.join('；'));
    await load();
  };

  /** 恢复：把索引里那份正文写回磁盘（`references/**` 已随磁盘删除而丢失，必须在确认框里说清） */
  const handleRestore = async (row: SkillRow) => {
    const ok = await askConfirm({
      title: `把「${row.name}」写回磁盘？`,
      message: `索引里还留着这份正文，将据此重建 ${row.relPath || '技能包'}。\n附属资料（references/**）已随磁盘包一起删除，无法恢复。`,
      confirmText: '写回磁盘',
    });
    if (!ok) return;
    setBusy(true);
    const r = await restoreSkillFromIndex(row.id);
    setBusy(false);
    if (!r.ok) {
      setNotice(`恢复失败：${r.message}`);
      showToast(`恢复失败：${r.message}`, { type: 'error' });
      return;
    }
    setNotice(`已把「${row.name}」写回磁盘`);
    showToast('已写回磁盘', { type: 'success' });
    await load();
  };

  const handleDiscard = async (row: SkillRow) => {
    const ok = await askConfirm({
      title: `丢弃「${row.name}」在索引里的那一份？`,
      message:
        '只清掉索引里的这一条（磁盘上没有它了）。索引里的正文会一起删掉，**之后无法再恢复**。',
      confirmText: '丢弃',
      danger: true,
    });
    if (!ok) return;
    const r = discardSkillFromIndex(row.id);
    if (!r.ok) {
      showToast(`丢弃失败：${r.message}`, { type: 'error' });
      return;
    }
    setNotice(`已丢弃「${row.name}」（仅索引）`);
    setSelectedKey('');
    refreshIndex();
  };

  const handleDelete = async (row: SkillRow) => {
    const ok = await askConfirm({
      title: `删除 Skill「${row.name}」？`,
      message: '磁盘上的技能包会移进技能库的 .trash/（可手动捞回），索引同时清除。',
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteSkillEverywhere(row.id);
    if (!r.ok) {
      showToast(`删除失败：${r.message}`, { type: 'error' });
      return;
    }
    setNotice(`已删除「${row.name}」（备份在 .trash/）`);
    setSelectedKey('');
    setMode('detail');
    await load();
  };

  const handleExport = async (row: SkillRow) => {
    // 导出**完整 SKILL.md**（含 frontmatter）：只导正文会丢掉 name/description/version，再导入就残缺。
    // 【TD-11-70 起：这份 = 磁盘上那个文件逐字】不再从缓存重拼（缓存只留 5 个字段 ⇒ allowed-tools /
    // 布尔 / unknown 全丢，"导出→再导入"一轮就少声明）。读不到 ⇒ `null`，下面的降级提示如实说。
    const full = row.id ? await skillMarkdownForExport(row.id) : null;
    // 【降级必须如实说】回落成"仅正文"= 丢 frontmatter 声明（TD-11-28）
    const degraded = !!row.id && full === null;
    const blob = new Blob([full ?? row.content], { type: 'text/markdown;charset=utf-8' });
    const filename = `${row.name || 'skill'}.md`;
    downloadBlob(blob, filename);
    showToast(
      degraded
        ? `已导出 ${filename}（仅正文：未读到完整条目，frontmatter 声明已丢）`
        : `已导出 ${filename}`,
      { type: degraded ? 'warning' : 'success' },
    );
  };

  const handleOpen = async (row?: SkillRow) => {
    const r = row ? await openSkillFolder(row.group, row.slug) : await openSkillFolder();
    if (!r.ok) showToast(r.message, { type: 'error' });
  };

  const handleUse = (row: SkillRow) => {
    const r = selectSkillInCurrentConversation(row.id);
    if (!r.ok) {
      showToast(r.message || '未能切换到该技能', { type: 'error' });
      return;
    }
    showToast(
      r.added ? `已选中「${row.name}」，切到 AI 助手去用它` : `「${row.name}」已在当前对话中选中`,
      {
        type: 'success',
      },
    );
  };

  const handleCreateGroup = async () => {
    const name = newGroup.trim();
    if (!name) return;
    setBusy(true);
    const r = await createSkillGroup(name);
    setBusy(false);
    if (!r.ok) {
      showToast(`新建分组失败：${r.message}`, { type: 'error' });
      return;
    }
    setNewGroup('');
    setNewGroupOpen(false);
    setNotice(
      r.data.created
        ? `已建分组「${name}」（空组已显示在导航条；把技能的「分组」填成它即可移入）`
        : `分组「${name}」已存在`,
    );
    await load();
  };

  // ── 编辑器 ────────────────────────────────────────────────────────────────
  const startNew = () => {
    setSelectedKey('');
    setMode('edit');
    setConflict(null);
    setForm(emptyForm());
    setBaselineHash('');
  };

  /**
   * 保存 = **直接写磁盘**（整包原子写）。
   * 冲突（磁盘那一版被外部改过）⇒ 保留编辑态、弹选择；冲突时**一个字都没写**。
   */
  const doSave = async (allowOverwrite: boolean) => {
    const name = form.name.trim();
    const description = form.description.trim();
    const content = form.content.trim();
    if (!name) {
      showToast('请填写名称', { type: 'warning' });
      return;
    }
    if (!content) {
      showToast('请填写正文', { type: 'warning' });
      return;
    }
    setBusy(true);
    const r = await saveSkillToDisk({
      id: form.id || undefined,
      name,
      description,
      content,
      category: form.category.trim(),
      baselineHash: form.id ? baselineHash : undefined, // 新建没有"某一版"可比
      allowOverwrite,
    });
    setBusy(false);
    if (!r.ok) {
      if ('conflict' in r) {
        setConflict({ diskContent: r.diskContent, message: r.message });
        return;
      }
      showToast(`保存失败：${r.message}`, { type: 'error' });
      return;
    }
    setConflict(null);
    setNotice(`已保存「${r.skill.name}」到磁盘`);
    showToast('已保存到磁盘', { type: 'success' });
    setMode('detail');
    await load();
    setSelectedKey(r.skill.id);
  };

  /** 冲突时选「放弃我的、加载磁盘版」：把磁盘那一版装进表单，用户接着在**它**上面改 */
  const loadDiskVersion = () => {
    if (!conflict || !selected) return;
    setForm((f) => ({ ...f, content: conflict.diskContent }));
    setBaselineHash(selected.contentHash);
    setConflict(null);
    setNotice('已加载磁盘上那一版；你的改动已丢弃');
  };

  // ── 导入 ──────────────────────────────────────────────────────────────────
  const handleMdImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const okNames: string[] = [];
    const failed: string[] = [];
    setImporting(true);
    try {
      for (const f of files) {
        if (!isSkillImportFile(f.name)) {
          failed.push(`${f.name}：不是文本类技能文件`);
          continue;
        }
        const r = await importSkillText(skillNameFromFile(f.name) || f.name, await f.text());
        if (r.ok) okNames.push(r.skill.name);
        else failed.push(`${f.name}：${r.message}`);
      }
    } finally {
      e.target.value = '';
    }
    setImporting(false);
    setNotice(
      okNames.length
        ? `已导入 ${okNames.length} 个${failed.length ? `；${failed.length} 个失败：${failed[0]}` : ''}`
        : `导入失败：${failed[0] || '没有可导入的文件'}`,
    );
    await load();
  };

  /** 整目录导入：能把 `references/**` 一起带进来（按"谁直接含 SKILL.md"切包） */
  const handleDirImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    const inputs: { relPath: string; content: string }[] = [];
    const skipped: string[] = [];
    for (const f of picked) {
      const relPath = f.webkitRelativePath || f.name;
      // 判据与门面**同一个实现**（不读二进制/隐藏文件）；大文件不读 —— 读了也过不了后端那道闸
      if (!isImportablePackageFile(relPath) || f.size > SKILL_MAX_FILE_BYTES) {
        skipped.push(relPath.slice(relPath.lastIndexOf('/') + 1));
        continue;
      }
      inputs.push({ relPath, content: await f.text() });
    }
    setImporting(true);
    const r = await importSkillPackages(inputs);
    setImporting(false);
    if (r.error) {
      showToast(`导入失败：${r.error}`, { type: 'error' });
      return;
    }
    const notes: string[] = [];
    if (skipped.length)
      notes.push(`跳过 ${skipped.length} 个非文本/超大文件（${skipped.slice(0, 3).join('、')}）`);
    if (r.failed.length)
      notes.push(`${r.failed.length} 个包失败（${r.failed[0].target}：${r.failed[0].message}）`);
    setNotice(
      r.imported.length
        ? `已导入 ${r.imported.length} 个技能包${notes.length ? `；${notes.join('；')}` : ''}`
        : `导入失败：${notes.join('；') || '没有可导入的包'}`,
    );
    await load();
  };

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  const isEditing = mode === 'edit';
  /** 编辑器是否已打开（新建也算）—— 打开时内容区整体换成它，导航条常驻 */
  const editorOpen = isEditing || !!selected;
  const railItemCls = (on: boolean, amber = false) =>
    `w-full flex items-center gap-2 px-2 py-[7px] rounded-lg text-[12px] cursor-pointer border-none text-left
     ${on ? 'bg-surface-active text-primary' : amber ? 'text-amber-300 hover:bg-surface-hover' : 'text-body hover:bg-surface-hover'} bg-transparent`;

  return (
    <section className="bg-surface border border-edge-subtle rounded-xl overflow-hidden">
      {/* 头部：标题 + 统计芯片（把"启用几个 / 磁盘几包"变成看得见的当前状态） */}
      <div className="px-5 py-3 border-b border-edge-subtle flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="settings-page-title flex items-center gap-2">
            <Bot size={17} className="text-secondary" />
            Skill Library
          </h3>
          <p className="text-xs text-muted mt-1">
            技能以文件夹形式住在磁盘上，列表里的每一行就是一个包；保存即写回那个文件
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-[11px] text-secondary">
          <span className="px-2.5 py-1 rounded-full bg-surface-1">
            磁盘 {view.counts.diskPackages} 包
          </span>
          <span className="px-2.5 py-1 rounded-full bg-surface-1">
            启用 {view.counts.enabled}/{view.counts.usable}
          </span>
        </div>
      </div>

      {/* 工具条：**创作类**动作在这里；维护类（重读/打开文件夹）下沉到导航条底部 */}
      <div className="px-5 py-2.5 border-b border-edge-subtle flex items-center gap-2 flex-wrap">
        {/* 导入⌄（.md 文件 / 技能包文件夹） */}
        <div className="relative" ref={importRef}>
          <button
            type="button"
            onClick={() => setImportOpen((v) => !v)}
            disabled={importing}
            className="h-7 px-2 rounded-lg bg-surface-1 text-[11px] text-body flex items-center gap-1 hover:bg-surface-hover transition cursor-pointer border-none disabled:opacity-50"
          >
            <Upload size={12} />
            {importing ? '导入中…' : '导入'}
            <ChevronDown size={11} className="text-muted" />
          </button>
          {importOpen && (
            <div className="absolute left-0 top-8 z-20 w-48 py-1 rounded-lg border border-edge bg-surface shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  mdFileRef.current?.click();
                }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-body hover:bg-surface-hover cursor-pointer border-none bg-transparent"
              >
                .md 文件（只要正文）
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  dirFileRef.current?.click();
                }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-body hover:bg-surface-hover cursor-pointer border-none bg-transparent"
              >
                技能包文件夹（含 references/）
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={startNew}
          className="h-7 px-2.5 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white text-[11px] flex items-center gap-1 cursor-pointer border-none"
        >
          <Plus size={12} />
          新建技能
        </button>
        <button
          type="button"
          onClick={() => setNewGroupOpen((v) => !v)}
          className="h-7 px-2 rounded-lg bg-surface-1 text-[11px] text-body flex items-center gap-1 hover:bg-surface-hover transition cursor-pointer border-none"
          title="在技能库里建一个分组目录（= 磁盘上的文件夹）"
        >
          <FolderPlus size={12} />
          分组
        </button>
        {newGroupOpen && (
          <span className="flex items-center gap-1">
            <input
              autoFocus
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateGroup();
                if (e.key === 'Escape') setNewGroupOpen(false);
              }}
              placeholder="分组名（= 磁盘上的文件夹）"
              className="h-7 w-44 bg-canvas border border-edge rounded-lg px-2 text-[11px] text-body outline-none focus:border-blue-500/50"
            />
            <button
              type="button"
              onClick={() => void handleCreateGroup()}
              disabled={busy || !newGroup.trim()}
              className="h-7 px-2 rounded-lg bg-surface-1 text-[11px] text-body cursor-pointer border-none disabled:opacity-50"
            >
              建立
            </button>
          </span>
        )}

        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setBudgetOpen((v) => !v)}
            className="h-7 px-2 rounded-lg bg-surface-1 text-[11px] text-body flex items-center gap-1 hover:bg-surface-hover transition cursor-pointer border-none"
          >
            注入预算
            {budgetOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        </div>
      </div>

      {/* 注入预算：常驻一行（把"已启用几个 / 上限几个"这条隐形约束摆到台面上） */}
      <div className="px-5 py-2 border-b border-edge-subtle text-[11px] text-muted">
        {budgetOpen ? (
          <div className="space-y-2 py-1">
            <div className="flex items-start justify-between gap-4">
              <span className="text-secondary">
                默认把全部 Skill 清单发给 AI（开＝每轮都发「有哪些 Skill」，关＝只发你选中的正文）
              </span>
              <Toggle
                checked={cfg.catalogToModel}
                onChange={(v) => patchConfig({ catalogToModel: v })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <NumberField
                label="单个正文上限（字）"
                value={cfg.contentLimits.singleSkillChars}
                onCommit={(n) => patchConfig({ contentLimits: { singleSkillChars: n } })}
              />
              <NumberField
                label="一次注入合计上限（字）"
                value={cfg.contentLimits.expansionTotalChars}
                onCommit={(n) => patchConfig({ contentLimits: { expansionTotalChars: n } })}
              />
              <NumberField
                label="一次对话最多带几个"
                value={cfg.contentLimits.maxExplicitBindings}
                onCommit={(n) => patchConfig({ contentLimits: { maxExplicitBindings: n } })}
              />
            </div>
            <p className="text-[11px] text-muted">
              「一次对话最多带几个」管的是<b className="text-secondary">AI 助手里勾选</b>的那批：
              勾多了，超出的本次不注入，并在发给 AI 的文本里点名说明（不静默丢）。
              本页的开关只决定这个技能<b className="text-secondary">出不出可选列表</b>
              ，开多少个都行。
            </p>
            {overBudget.length > 0 && (
              <p className="text-amber-400">
                已超出建议范围（{overBudget.join('、')}）：预算的作用是防止上下文被顶爆，
                调到这个量级等于没有防线。确实需要可以继续，但请知道这一点。
              </p>
            )}
            <p>超出上限的正文会被截断，并在发给 AI 的文本里注明（不会静默丢内容）。</p>
          </div>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              可选 <b className="text-body">{view.counts.enabled}</b> 个 · 一次对话最多带{' '}
              {cfg.contentLimits.maxExplicitBindings} 个
            </span>
            <span className="text-edge">·</span>
            <span>清单 {cfg.catalogToModel ? '开' : '关'}</span>
            <span className="text-edge">·</span>
            <span>单篇 {cfg.contentLimits.singleSkillChars.toLocaleString()} 字</span>
            <span className="text-edge">·</span>
            <span>合计 {cfg.contentLimits.expansionTotalChars.toLocaleString()} 字</span>
          </span>
        )}
      </div>

      {/* 页面级横幅：未决 / 结果 / 索引损坏 —— 不藏在折叠面板里 */}
      {view.undecided && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-[11px] text-secondary">
          <b className="text-amber-300">读不到磁盘技能库</b>（本地服务未启动？）—— 下面按索引显示，
          <b className="text-amber-300">这不代表磁盘上没有别的技能</b>
          。读不到时也不会用空清单去覆盖任何东西。
          <button
            type="button"
            onClick={() => void load({ report: true })}
            className="ml-2 text-amber-300 hover:text-amber-200 cursor-pointer border-none bg-transparent p-0"
          >
            重试
          </button>
        </div>
      )}
      {indexError && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-[11px] text-secondary">
          索引损坏：{indexError}（不影响磁盘上的技能包；点「重读」按磁盘重建索引）
        </div>
      )}
      {notice && <div className="mx-5 mt-3 text-[11px] text-secondary">{notice}</div>}

      {/* 主体：导航条（常驻） + 内容区（列表 ⇄ 编辑器 整体切换） */}
      <div className="flex min-h-[420px]">
        <nav className="w-[172px] shrink-0 border-r border-edge-subtle bg-canvas flex flex-col px-2 py-3">
          <div className="px-2 pb-1.5 text-[10px] text-muted uppercase tracking-wider">技能库</div>
          <button
            type="button"
            className={railItemCls(railSel === ALL_GROUPS)}
            onClick={() => setRailSel(ALL_GROUPS)}
          >
            <span className="flex-1 truncate">全部</span>
            <span className="text-[10px] text-muted">{view.counts.rows}</span>
          </button>

          {rail.normal.length > 0 && <div className="my-2 h-px bg-edge-subtle" />}
          {rail.normal.map((g) => (
            <button
              type="button"
              key={g.name}
              className={railItemCls(railSel === g.name)}
              onClick={() => setRailSel(g.name)}
              title={g.label}
            >
              <FolderOpen size={12} className="shrink-0 text-muted" />
              <span className="flex-1 truncate">{g.label}</span>
              <span className="text-[10px] text-muted">{g.rows.length}</span>
            </button>
          ))}

          {rail.official.length > 0 && <div className="my-2 h-px bg-edge-subtle" />}
          {rail.official.map((g) => (
            <button
              type="button"
              key={g.name}
              className={railItemCls(railSel === g.name)}
              onClick={() => setRailSel(g.name)}
            >
              <Bot size={12} className="shrink-0 text-muted" />
              <span className="flex-1 truncate">{g.label}</span>
              <span className="text-[10px] text-muted">{g.rows.length}</span>
            </button>
          ))}

          {/* 待处置：同一批问题行的聚合视图（解释 + 一键修），判据与行徽标同源 */}
          {problemRows.length > 0 && (
            <>
              <div className="my-2 h-px bg-edge-subtle" />
              <button
                type="button"
                className={railItemCls(railSel === FIX_VIEW, true)}
                onClick={() => setRailSel(FIX_VIEW)}
              >
                <AlertTriangle size={12} className="shrink-0 text-amber-300" />
                <span className="flex-1 truncate">待处置</span>
                <span className="text-[10px] text-amber-300">{problemRows.length}</span>
              </button>
            </>
          )}

          {rail.deleted.length > 0 && <div className="my-2 h-px bg-edge-subtle" />}
          {rail.deleted.map((g) => (
            <button
              type="button"
              key={g.name}
              className={railItemCls(railSel === g.name, true)}
              onClick={() => setRailSel(g.name)}
              title="磁盘上已经没有这些包，只剩索引里那份正文"
            >
              <Trash2 size={12} className="shrink-0 text-amber-300" />
              <span className="flex-1 truncate">{g.label}</span>
              <span className="text-[10px] text-amber-300">{g.rows.length}</span>
            </button>
          ))}

          {/* 维护类动作：低频，不占工具条 */}
          <div className="mt-auto pt-3 px-1 space-y-1">
            <button
              type="button"
              onClick={() => void load({ report: true })}
              disabled={busy}
              className="w-full flex items-center gap-1.5 px-1 py-1 text-[11px] text-muted hover:text-body cursor-pointer border-none bg-transparent disabled:opacity-50"
              title="把磁盘上的现状读进来（在编辑器/Finder 里改完文件后点这里）"
            >
              <RefreshCw size={11} className={busy ? 'animate-spin' : ''} />
              从磁盘重读
            </button>
            <button
              type="button"
              onClick={() => void handleOpen()}
              className="w-full flex items-center gap-1.5 px-1 py-1 text-[11px] text-muted hover:text-body cursor-pointer border-none bg-transparent"
              title="在文件管理器里打开技能库文件夹"
            >
              <FolderOpen size={11} />
              打开文件夹
            </button>
          </div>
        </nav>

        {/* ── 内容区：列表 ── */}
        {!editorOpen && (
          <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3">
            {railSel === FIX_VIEW ? (
              // 【待处置】同一批行，换一种说法：说清"是什么 / 为什么 / 怎么办"
              <div className="space-y-2">
                <div className="px-1 pb-1 text-[11px] text-muted">
                  {problemRows.length} 项 · 都不影响磁盘上的文件
                </div>
                {problemRows.map(({ row, info }) => (
                  <div
                    key={row.key}
                    className="px-3 py-2.5 rounded-lg bg-surface-1 border border-edge-faint flex gap-2.5"
                  >
                    <AlertTriangle size={13} className="shrink-0 text-amber-300 mt-[2px]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] text-body">{row.name}</span>
                        <span className="shrink-0 text-[10px] px-1.5 py-[1px] rounded bg-surface-2 text-amber-300">
                          {info.badge}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted leading-relaxed">{info.why}</div>
                      <div className="mt-2 flex items-center gap-2">
                        {info.action === 'backfill' && (
                          <button
                            type="button"
                            onClick={() => void handleBackfill()}
                            disabled={busy}
                            className="h-7 px-2 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white text-[11px] cursor-pointer border-none disabled:opacity-50"
                          >
                            补齐 id
                          </button>
                        )}
                        {info.action === 'reload' && (
                          <button
                            type="button"
                            onClick={() => void load({ report: true })}
                            disabled={busy}
                            className="h-7 px-2 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white text-[11px] cursor-pointer border-none disabled:opacity-50"
                          >
                            从磁盘重读
                          </button>
                        )}
                        {info.action === 'restore' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleRestore(row)}
                              disabled={busy}
                              className="h-7 px-2 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white text-[11px] cursor-pointer border-none disabled:opacity-50"
                            >
                              恢复到磁盘
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDiscard(row)}
                              className="h-7 px-2 rounded-lg bg-surface-1 hover:bg-surface-hover text-red-300 text-[11px] cursor-pointer border-none"
                            >
                              丢弃
                            </button>
                          </>
                        )}
                        {info.action === 'edit' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedKey(row.key);
                              setMode('edit');
                              setConflict(null);
                              fillForm(row);
                            }}
                            className="h-7 px-2 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white text-[11px] cursor-pointer border-none"
                          >
                            补描述
                          </button>
                        )}
                        {row.slug && (
                          <button
                            type="button"
                            onClick={() => void handleOpen(row)}
                            className="h-7 px-2 rounded-lg bg-surface-1 hover:bg-surface-hover text-body text-[11px] cursor-pointer border-none"
                          >
                            打开该包
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {view.counts.rows === 0 && (
                  <div className="px-2 py-2 text-xs text-muted">
                    技能库还是空的 —— 点左下「打开文件夹」把技能包放进去（每个包 = 一个含 SKILL.md
                    的目录）， 回来点「从磁盘重读」；或者在上面「新建技能」。
                  </div>
                )}
                {shownGroups.map((group) => (
                  <div key={group.name} className="mb-3">
                    <div className="flex items-center gap-1.5 px-2 pb-1">
                      <span
                        className={`flex-1 text-[11px] uppercase tracking-wider truncate ${
                          group.kind === 'index-only' ? 'text-amber-300' : 'text-muted'
                        }`}
                        title={group.label}
                      >
                        {group.label}
                      </span>
                      <span className="text-[10px] text-muted shrink-0">
                        {group.onCount}/{group.toggleable}
                      </span>
                      <TriToggle
                        state={group.toggleState}
                        disabled={group.toggleable === 0}
                        onToggle={(v) => handleGroupToggle(group, v)}
                      />
                    </div>
                    <div className="space-y-0.5">
                      {group.rows.length === 0 && (
                        <div className="px-2.5 py-1.5 text-[11px] text-muted">
                          空分组 —— 编辑技能时把「分组」填成它，或在文件夹里放入技能包
                        </div>
                      )}
                      {group.rows.map((row) => (
                        <Row
                          key={row.key}
                          row={row}
                          active={row.key === selectedKey}
                          onSelect={() => {
                            setSelectedKey(row.key);
                            setMode('detail');
                            setConflict(null);
                            fillForm(row);
                          }}
                          onToggle={(v) => handleToggle(row, v)}
                          onQuickAction={(kind) => {
                            setSelectedKey(row.key);
                            if (kind === 'backfill') void handleBackfill();
                            else if (kind === 'restore') void handleRestore(row);
                            else if (kind === 'discard') void handleDiscard(row);
                            else void load({ report: true });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── 内容区：编辑器（只读态 / 编辑态 = **同一份渲染**；导航条常驻，可接着点下一个） ── */}
        {editorOpen && (
          <div className="flex-1 min-w-0 overflow-y-auto">
            <div className="px-4 pt-2.5 pb-1 flex items-center gap-2 text-[11px] text-muted">
              <button
                type="button"
                onClick={() => {
                  setSelectedKey('');
                  setMode('detail');
                  setConflict(null);
                  setForm(emptyForm());
                }}
                className="flex items-center gap-1 text-muted hover:text-body cursor-pointer border-none bg-transparent p-0"
              >
                <ChevronDown size={12} className="rotate-90" />
                技能库
              </button>
              {selected && <span className="truncate">/ {selected.groupLabel}</span>}
            </div>

            <div className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] text-body font-medium truncate">
                    {isEditing ? (form.id ? '编辑技能' : '新建技能') : selected?.name}
                  </div>
                  <div className="text-[11px] text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                    {selected ? (
                      <>
                        <span>{selected.readonly ? '官方内置' : '自定义'}</span>
                        {!selected.readonly && <span>· 分组 {selected.groupLabel}</span>}
                        {selected.version ? <span>· v{selected.version}</span> : null}
                      </>
                    ) : (
                      <span>保存即写回磁盘上的 SKILL.md（整包原子写，写盘成功才更新列表）</span>
                    )}
                  </div>
                </div>
                {selected && (
                  <span
                    className={`shrink-0 text-[10px] px-2 py-[2px] rounded-full ${
                      selected.usable
                        ? selected.enabled
                          ? 'bg-blue-500/15 text-blue-300'
                          : 'bg-surface-2 text-muted'
                        : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {selected.usable ? (selected.enabled ? '已启用' : '已停用') : '不可用于对话'}
                  </span>
                )}
              </div>

              {/* 元信息条（路径 / 引用 / 修改时间 / 缺失项）—— 只读态与编辑态共用 */}
              {selected && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-surface-1 text-[11px] text-muted space-y-0.5">
                  {selected.relPath && (
                    <div className="truncate" title={selected.relPath}>
                      路径 skills/{selected.relPath}
                    </div>
                  )}
                  <div>
                    引用资料 {selected.resourceCount} 条
                    {selected.updatedAt
                      ? ` · 上次修改 ${new Date(selected.updatedAt).toLocaleString()}`
                      : ''}
                  </div>
                  {selected.missingRefs.length > 0 && (
                    <div className="text-amber-300">
                      正文引用了包里没有的资料：{selected.missingRefs.join('、')}（模型读到会失败）
                    </div>
                  )}
                  {selected.noDescription && selected.usable && (
                    <div className="text-amber-300">没有描述 ⇒ 不会出现在「可用 Skill 清单」里</div>
                  )}
                </div>
              )}

              {/* 冲突：磁盘那一版被外部改过 —— 不静默覆盖，让用户选 */}
              {conflict && (
                <div className="mt-3 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-[11px] text-secondary space-y-1.5">
                  <div className="text-amber-300 font-medium">{conflict.message}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void doSave(true)}
                      className="h-7 px-2 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white cursor-pointer border-none"
                    >
                      用我的覆盖
                    </button>
                    <button
                      type="button"
                      onClick={loadDiskVersion}
                      className="h-7 px-2 rounded-lg bg-surface-1 hover:bg-surface-hover text-body cursor-pointer border-none"
                    >
                      放弃我的、加载磁盘版
                    </button>
                  </div>
                </div>
              )}

              {/* 字段：**一份**渲染；只读态 `disabled`，点「编辑」才放开 */}
              <div className="mt-3 space-y-3">
                {/* 名称 + 分组同一排：它俩是"这个技能叫什么 / 放在哪个文件夹"，配对出现才看得出关系 */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs text-secondary mb-1.5">名称</span>
                    <input
                      value={form.name}
                      disabled={!isEditing}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="例如：小红书爆款标题"
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs text-secondary mb-1.5">分组</span>
                    <input
                      value={form.category}
                      disabled={!isEditing}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="留空 = 未分组"
                      list="skill-group-names"
                      className={inputCls}
                    />
                    <datalist id="skill-group-names">
                      {groupNames.map((g) => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <span className="block text-[11px] text-muted -mt-1">
                  分组 = 技能库里的文件夹（一个 Skill 只属于一个分组）；改名即把技能移到该分组，
                  <b className="text-secondary">清空则移回「未分组」</b>
                </span>
                <label className="block">
                  <span className="block text-xs text-secondary mb-1.5">描述</span>
                  <input
                    value={form.description}
                    disabled={!isEditing}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="一句话说清它管什么"
                    className={inputCls}
                  />
                  <span className="block text-[11px] text-muted mt-1.5">
                    开「把全部 Skill 清单发给
                    AI」时，清单**只收有描述的技能**（说不出用途的不占预算）
                  </span>
                </label>
                <label className="block">
                  <span className="block text-xs text-secondary mb-1.5">正文</span>
                  <textarea
                    value={form.content}
                    disabled={!isEditing}
                    onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                    rows={12}
                    className={`${inputCls} font-mono text-[12px] leading-relaxed resize-y`}
                  />
                  <span className="block mt-1.5">
                    <BudgetBar
                      length={form.content.length}
                      limit={cfg.contentLimits.singleSkillChars}
                    />
                  </span>
                </label>
              </div>

              {/* 操作区：只读态给「编辑」+ 该状态专属动作；编辑态给「保存/取消/删除」 */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!isEditing && (
                  <>
                    {selected?.editable && (
                      <button
                        type="button"
                        onClick={() => setMode('edit')}
                        className="h-8 px-3 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white text-xs flex items-center gap-1.5 cursor-pointer border-none"
                      >
                        <Pencil size={12} />
                        编辑
                      </button>
                    )}
                    {selected?.state === 'missing-id' && (
                      <button
                        type="button"
                        onClick={() => void handleBackfill()}
                        disabled={busy}
                        className="h-8 px-3 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white text-xs cursor-pointer border-none disabled:opacity-50"
                      >
                        补齐 id（写回 frontmatter）
                      </button>
                    )}
                    {selected?.state === 'index-only' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleRestore(selected)}
                          disabled={busy}
                          className="h-8 px-3 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white text-xs cursor-pointer border-none disabled:opacity-50"
                        >
                          恢复（写回磁盘）
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDiscard(selected)}
                          className="h-8 px-3 rounded-lg bg-surface-1 hover:bg-surface-hover text-secondary text-xs cursor-pointer border-none"
                        >
                          丢弃
                        </button>
                      </>
                    )}
                    {(selected?.readonly || selected?.slug) && (
                      <button
                        type="button"
                        onClick={() => void handleOpen(selected?.readonly ? undefined : selected)}
                        className="h-8 px-3 rounded-lg bg-surface-1 hover:bg-surface-hover text-body text-xs flex items-center gap-1.5 cursor-pointer border-none"
                      >
                        <FolderOpen size={12} />
                        {selected?.readonly ? '打开技能库' : '打开该包'}
                      </button>
                    )}
                    {selected?.usable && (
                      <button
                        type="button"
                        onClick={() => handleExport(selected)}
                        className="h-8 px-3 rounded-lg bg-surface-1 hover:bg-surface-hover text-body text-xs flex items-center gap-1.5 cursor-pointer border-none"
                      >
                        <Download size={12} />
                        导出
                      </button>
                    )}
                    {/* 【判据是 usable 而不是 editable】内置技能**更常用**这个入口（它们是官方那批），
                        而它们恰好不可编辑 ⇒ 挂在 `editable` 上会让内置技能用不了它（组件测试抓到的缺口） */}
                    {selected?.usable && (
                      <button
                        type="button"
                        onClick={() => handleUse(selected)}
                        className="h-8 px-3 rounded-lg bg-surface-1 hover:bg-surface-hover text-secondary text-xs cursor-pointer border-none"
                        title="把该 Skill 选进当前 AI 对话，并打开 AI 助手面板"
                      >
                        在 AI 助手里使用
                      </button>
                    )}
                    {selected?.editable && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(selected)}
                        className="h-8 px-3 rounded-lg bg-surface-1 hover:bg-surface-hover text-red-300 text-xs flex items-center gap-1.5 cursor-pointer border-none"
                      >
                        <Trash2 size={12} />
                        删除
                      </button>
                    )}
                  </>
                )}
                {isEditing && (
                  <>
                    <button
                      type="button"
                      onClick={() => void doSave(false)}
                      disabled={busy}
                      className="h-8 px-3 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white text-xs cursor-pointer border-none disabled:opacity-50"
                    >
                      保存修改
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // 新建 ⇒ 取消 = 回列表；编辑 ⇒ 取消 = 回到只读态（表单回填磁盘那一版）
                        if (!form.id) {
                          setSelectedKey('');
                          setForm(emptyForm());
                        } else if (selected) {
                          fillForm(selected);
                        }
                        setMode('detail');
                        setConflict(null);
                      }}
                      className="h-8 px-3 rounded-lg bg-surface-1 hover:bg-surface-hover text-body text-xs cursor-pointer border-none"
                    >
                      取消
                    </button>
                    {form.id && (
                      <button
                        type="button"
                        onClick={() => {
                          const row = allRows.find((r) => r.id === form.id);
                          if (row) void handleDelete(row);
                        }}
                        className="ml-auto h-8 px-3 rounded-lg bg-surface-1 hover:bg-surface-hover text-red-300 text-xs flex items-center gap-1.5 cursor-pointer border-none"
                      >
                        <Trash2 size={12} />
                        删除
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 隐藏的文件选择器（导入）
          `accept` 从**白名单真源**派生（`SKILL_IMPORT_ACCEPT`）：此前这里手写了
          `.md,.markdown,.txt,.json,.yaml,.yml,.csv` —— 后四类在 `handleMdImport` 里一律被拒，
          等于"选择框钓你挑一个必然失败的文件"（TD-11-63 顺带修）。 */}
      <input
        ref={mdFileRef}
        type="file"
        multiple
        accept={SKILL_IMPORT_ACCEPT}
        className="hidden"
        onChange={(e) => void handleMdImport(e)}
      />
      <input
        ref={dirFileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleDirImport(e)}
        {...DIR_PICKER_PROPS}
      />

      {/* 官方组的小注（内置是代码常量：能开关、不能改）—— 判据读视图层给的 `kind`，不比哨兵 */}
      {view.groups.some((g) => g.kind === 'official') && (
        <div className="px-5 py-2 border-t border-edge-subtle text-[10px] text-muted">
          官方 Skill
          是随程序内置的（不占磁盘），只能开关；你的技能住在技能库里，用编辑器改或直接用编辑器打开文件夹改。
        </div>
      )}
    </section>
  );
}
