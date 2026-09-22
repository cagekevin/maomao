/**
 * 设置 · Skill 库 —— **一页平铺 · 分组分段 · 弹窗编辑**（形态定稿 2026-09-22，母债 TD-11-44）。
 *
 * 【本页的定位（一句话）】技能库的"文件管理器 + 正文编辑器"：
 *   · **一张卡 = 磁盘上的一个技能包**（骨架来自磁盘，索引只负责补状态）；
 *   · **点保存 = 直接写那个包**（整包原子写，写盘成功才更新索引）—— 用户感知不到"缓存"这个东西；
 *   · 界面做的事，人在 Finder 里也能做，**结果等价**（改名/移动不改 id ⇒ 身份不丢）。
 *
 * 【页面里的三条铁律】
 *  ① **状态在卡上**：缺 id / 未纳入索引 / 仅索引（磁盘上已删）/ 无描述 / 引用缺失 全部写在卡里，
 *     **正常卡零状态**（不显示徽章/版本/时间），只有出问题的那张多一句 + 一个动作；
 *  ② **能编辑的卡，磁盘上一定存在**（`row.editable`）⇒ "点保存把已删的包静默重建"结构上不可达；
 *  ③ **保存不静默覆盖**：磁盘那一版被外部改过 ⇒ 弹冲突选择（两个写者真实存在，见 `saveSkillToDisk`）。
 *
 * 【布局为什么是「一页平铺 + 弹窗」而不是「导航条 + 内容区」或「左列表 + 右详情」】
 *   - **不钻层**（用户裁定："返回上一级还麻烦"）⇒ 分组是同一页里的**可折叠分段表头**，不是另一个空间；
 *   - 写正文是这个页面的主活 ⇒ 点开一张卡 = 弹窗拿到完整宽度，而**列表留在原位**（不换页、不返回）；
 *   - 低频动作（新建分组 / 从磁盘重读 / 打开技能库 / 注入预算）一律收进工具条右上 **⋯**。
 *
 * 【为什么没有搜索框】用户裁定（技能就几个，搜索是噪声），组件测试 `tests/unit/skillSettings.test.tsx`
 * 锁死了这一点；要按名字找请走分组表头 + 折叠。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutsideClick } from '@/components/base/core/interaction/uiHooks';
import DropdownPanel from '@/components/base/ui/form/DropdownPanel';
import DropdownRow from '@/components/base/ui/form/DropdownRow';
import InlineNameInput from '@/components/base/ui/form/InlineNameInput';
import {
  Bot,
  ChevronDown,
  Download,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  SlidersHorizontal,
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

/**
 * 预算项的界面名（超建议上界时点名用）。
 * 【故意**不是** `SKILL_LIMIT_SUGGESTED_MAX` 的全量映射】`maxExplicitBindings` 不在这里：
 * 一次对话只带一个之后它不再由界面暴露 ⇒ 再给它一个界面名，等于为一个摸不到的旋钮准备标签。
 */
const BUDGET_LABELS: Record<string, string> = {
  singleSkillChars: '单个 Skill 正文上限',
  expansionTotalChars: '一次注入合计上限',
};

/** 目录选择器：`webkitdirectory` 不在 React 的 props 类型里（非标准属性），用展开注入（不用 as any） */
const DIR_PICKER_PROPS: Record<string, string> = { webkitdirectory: '', directory: '' };

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
          title="索引里还没有它 ⇒ 右上 ⋯ →「从磁盘重读」即可收敛"
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
  /** 分组表头的折叠态（折叠 = 收起这一段，不换页、不钻层） */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState('');
  /** 工具条 ⋯ 菜单（低频动作收口） */
  const [moreOpen, setMoreOpen] = useState(false);
  const importRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);
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
        if (!r.ok) setNotice(`读取技能库失败：${r.message}`);
        else if (h.undecided)
          setNotice('技能库里还没有可用的技能包（要清掉列表里残留的条目，用卡片上的「丢弃」）');
        else if (h.changed) setNotice(`已重读：新增/更新 ${h.loaded} 个`);
        else setNotice('没有变化');
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

  // 下拉/菜单点击外部关闭 —— 走公共 hook（`useOutsideClick`），这里不自己再写一份监听
  useOutsideClick(importRef, importOpen, () => setImportOpen(false));
  useOutsideClick(moreRef, moreOpen, () => setMoreOpen(false));

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

  /**
   * 一页平铺 ⇒ **全部分组都显示**（不再有"导航条选中哪个组才显示哪个组"这一层）。
   * 分组表头就是分节；折叠交给用户点，界面不替他决定看哪一段。
   */
  const shownGroups: SkillGroupView[] = useMemo(() => view.groups, [view]);

  // 「已删除」收纳组不进分组候选 —— 判据读**视图层给的语义** `kind`，不比哨兵字符串（TD-11-62）
  const groupNames = useMemo(
    () => view.groups.filter((g) => g.kind !== 'index-only').map((g) => g.name),
    [view],
  );
  // 【`maxExplicitBindings` 不进超预算检查（一次对话只带一个后它不再由 UI 暴露）】
  // 该键仍留在配置里（冻结层 `slice(0, N)` 的兜底，N ≥ 1 时无副作用），但界面不再摆这个旋钮 ⇒
  // 若继续拿它比建议上界，会出现"提示超界、但用户找不到能调的地方"（假宣称）。
  const overBudget = (
    Object.keys(SKILL_LIMIT_SUGGESTED_MAX) as (keyof typeof SKILL_LIMIT_SUGGESTED_MAX)[]
  )
    .filter((k) => k !== 'maxExplicitBindings')
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
        ? `已建分组「${name}」（它已经出现在页面上；把技能的「分组」填成它即可移入）`
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
  /** 编辑器是否已打开（新建也算）—— 打开时是一个弹窗，列表留在原位（不换页） */
  const editorOpen = isEditing || !!selected;
  const closeEditor = () => {
    setSelectedKey('');
    setMode('detail');
    setConflict(null);
    setForm(emptyForm());
  };
  // Esc 关弹窗（与右上 ×、点遮罩 三个出口同一套动作）
  useEffect(() => {
    if (!editorOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditor();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
            下面每一张卡就是一个技能；改动保存即写回磁盘上的那个文件
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-[11px] text-secondary">
          <span className="px-2.5 py-1 rounded-full bg-surface-1">
            共 {view.counts.diskPackages} 个
          </span>
          <span
            className="px-2.5 py-1 rounded-full bg-surface-1"
            title="开关决定它能不能在对话里被选到"
          >
            对话里可用 {view.counts.enabled}/{view.counts.usable}
          </span>
        </div>
      </div>

      {/* 工具条：只放高频动作（导入 / 新建技能）；低频（新建分组 / 重读 / 打开技能库 / 注入预算）收进右上 ⋯ */}
      <div className="px-5 py-2.5 border-b border-edge-subtle flex items-center gap-2 flex-wrap">
        {/* 导入⌄（.md 文件 / 技能包整包） */}
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
          {/* 与右上 ⋯ 同一个 chrome（`DropdownPanel` + `DropdownRow`）：下拉外观只有一份真源 */}
          {importOpen && (
            <DropdownPanel popupTo="down" widthClass="w-48">
              <DropdownRow
                selected={false}
                onSelect={() => {
                  setImportOpen(false);
                  mdFileRef.current?.click();
                }}
              >
                .md 文件（只要正文）
              </DropdownRow>
              <DropdownRow
                selected={false}
                onSelect={() => {
                  setImportOpen(false);
                  dirFileRef.current?.click();
                }}
              >
                技能包（整包）
              </DropdownRow>
            </DropdownPanel>
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
        {/* 「新建分组」收进右上 ⋯（低频）：界面不摆两个"加东西"的按钮 */}
        {/* 新建分组 = 就地命名（通用件 `InlineNameInput`：回车提交 / Esc 取消 / 失焦提交 / IME 守卫） */}
        {newGroupOpen && (
          <InlineNameInput
            value={newGroup}
            onChange={setNewGroup}
            onCommit={() => void handleCreateGroup()}
            onCancel={() => setNewGroupOpen(false)}
            tone="orange"
            placeholder="新分组的名字"
          />
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* ⋯：低频动作全收口（新建分组 / 从磁盘重读 / 打开技能库） */}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              title="更多"
              className="h-7 w-7 flex items-center justify-center rounded-lg bg-surface-1 text-body hover:bg-surface-hover cursor-pointer border-none"
            >
              <MoreHorizontal size={13} />
            </button>
            {moreOpen && (
              <DropdownPanel popupTo="down" align="right" widthClass="w-[180px]">
                <DropdownRow
                  selected={false}
                  onSelect={() => {
                    setNewGroupOpen(true);
                    setMoreOpen(false);
                  }}
                >
                  <FolderPlus size={12} />
                  新建分组
                </DropdownRow>
                <DropdownRow
                  selected={false}
                  onSelect={() => {
                    setMoreOpen(false);
                    void load({ report: true });
                  }}
                >
                  <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
                  从磁盘重读
                </DropdownRow>
                <DropdownRow
                  selected={false}
                  onSelect={() => {
                    setMoreOpen(false);
                    void handleOpen();
                  }}
                >
                  <FolderOpen size={12} />
                  打开技能库
                </DropdownRow>
                <DropdownRow
                  selected={budgetOpen}
                  onSelect={() => {
                    setBudgetOpen((v) => !v);
                    setMoreOpen(false);
                  }}
                >
                  <SlidersHorizontal size={12} />
                  注入预算
                </DropdownRow>
              </DropdownPanel>
            )}
          </div>
          {/* 「注入预算」不再常驻按钮：它属于"不必懂但必须有"，收进 ⋯（面板仍展开在工具条下方） */}
        </div>
      </div>

      {/* 注入预算：默认收起，由工具条 ⋯ →「注入预算」开关（把"发给 AI 多少字"这条隐形约束摆到台面上） */}
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
            </div>
            <p className="text-[11px] text-muted">
              本页的开关只决定这个技能<b className="text-secondary">出不出可选列表</b>
              ，开多少个都行；一次对话只带<b className="text-secondary">一个</b>
              （在 AI 助手里选，选新的就换掉旧的）。
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
              对话里可用 <b className="text-body">{view.counts.enabled}</b> 个 · 一次对话只带 1 个
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

      {/* 内容区：一页平铺卡片（分组 = 可折叠表头，**不钻层**；编辑 = 弹窗，不换页） */}
      <div className="min-h-[420px]">
        {!editorOpen && (
          <div className="overflow-y-auto px-8 py-3">
            {view.counts.rows === 0 && (
              <div className="px-2 py-10 text-center text-xs text-muted">
                技能库还是空的 —— 用上面的「导入」把 .md 或技能包放进来，或点「新建技能」自己写一个
              </div>
            )}
            {shownGroups.map((group, groupIndex) => {
              const open = !collapsed[group.name];
              return (
                <div key={group.name}>
                  {/* 分组表头：名字 · 数量 · 三态开关 · 折叠（折叠 = 收起这一段，不是换页） */}
                  <div
                    className={`flex cursor-pointer select-none items-center gap-1.5 pb-2.5 ${
                      groupIndex === 0 ? 'pt-1' : 'pt-5'
                    }`}
                    onClick={() => setCollapsed((c) => ({ ...c, [group.name]: !c[group.name] }))}
                  >
                    <ChevronDown
                      size={12}
                      className={`shrink-0 text-muted ${open ? '' : '-rotate-90'}`}
                    />
                    <span
                      className={`truncate text-[12px] ${
                        group.kind === 'index-only' ? 'text-amber-300' : 'text-secondary'
                      }`}
                      title={group.label}
                    >
                      {group.label}
                    </span>
                    <span className="rounded-full bg-surface-hover px-1.5 py-[1px] text-[10px] text-body">
                      {group.rows.length}
                    </span>
                    <span
                      className="ml-auto flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* 【组开关只有两态（用户裁定）】组里有**任何一个**开着 ⇒ 显示"开"；一个都没开 ⇒ "关"。
                          状态读视图层给的 `toggleState`（判据唯一真源，这里不自己比数字）；
                          计数说清到底开了几个（2/7）。点"开" ⇒ 全关；点"关" ⇒ 全开。 */}
                      <span className="text-[10px] text-muted">
                        {group.onCount}/{group.toggleable}
                      </span>
                      <Toggle
                        checked={group.toggleState === 'on'}
                        disabled={group.toggleable === 0}
                        onChange={(v) => handleGroupToggle(group, v)}
                      />
                    </span>
                  </div>

                  {open && (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                      {group.rows.length === 0 && (
                        <div className="px-1 py-1.5 text-[11px] text-muted">
                          空分组 —— 编辑技能时把「分组」填成它，技能就会移到这里
                        </div>
                      )}
                      {group.rows.map((row) => (
                        <div
                          key={row.key}
                          className={`relative flex cursor-pointer flex-col gap-2 rounded-lg border px-4 py-3.5 transition
                            ${
                              row.state === 'ok'
                                ? 'border-edge-faint bg-surface hover:bg-surface-hover'
                                : 'border-amber-500/40 bg-surface'
                            }`}
                          onClick={() => {
                            setSelectedKey(row.key);
                            setMode('detail');
                            setConflict(null);
                            fillForm(row);
                          }}
                        >
                          {/* 标题与开关同一基线（items-center）：flex-start 会让开关看着比字低 */}
                          <div className="flex items-center gap-2">
                            {row.readonly ? (
                              <Bot size={13} className="shrink-0 text-secondary" />
                            ) : null}
                            <span
                              className={`min-w-0 flex-1 truncate text-[13px] ${
                                row.usable ? 'text-body' : 'text-muted'
                              }`}
                            >
                              {row.name}
                            </span>
                            {/* 常显控件只有这一个：对话里能不能选到它 */}
                            {row.state === 'ok' && (
                              <Toggle
                                checked={row.enabled}
                                onChange={(v) => handleToggle(row, v)}
                              />
                            )}
                          </div>

                          <div className="line-clamp-2 text-[12px] leading-relaxed text-muted">
                            {row.description || '（还没有描述）'}
                          </div>

                          {/* 异常才说话：一句说明 + 该状态唯一能做的动作（与行徽标同源判据） */}
                          {row.state !== 'ok' && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <RowBadges row={row} />
                              {row.state === 'missing-id' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedKey(row.key);
                                    void handleBackfill();
                                  }}
                                  className="shrink-0 cursor-pointer rounded bg-surface-2 px-1.5 py-[2px] text-[10px] text-body hover:bg-surface-3"
                                >
                                  补齐 id
                                </button>
                              )}
                              {row.state === 'not-indexed' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void load({ report: true });
                                  }}
                                  className="shrink-0 cursor-pointer rounded bg-surface-2 px-1.5 py-[2px] text-[10px] text-body hover:bg-surface-3"
                                >
                                  重读
                                </button>
                              )}
                              {row.state === 'index-only' && (
                                <span className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleRestore(row);
                                    }}
                                    className="shrink-0 cursor-pointer rounded bg-surface-2 px-1.5 py-[2px] text-[10px] text-body hover:bg-surface-3"
                                  >
                                    恢复
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleDiscard(row);
                                    }}
                                    className="shrink-0 cursor-pointer rounded bg-surface-2 px-1.5 py-[2px] text-[10px] text-muted hover:bg-surface-3"
                                  >
                                    丢弃
                                  </button>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 编辑 = 弹窗（照 ConfirmContainer 的壳：遮罩 + bg-surface-raised + rounded-xl） */}
        {editorOpen && (
          <div
            className="fixed inset-0 z-float flex items-center justify-center bg-black/70 p-6"
            onClick={closeEditor}
          >
            <div
              className="flex max-h-[86vh] w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-edge bg-surface-raised shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-2 px-5 pb-3 pt-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-white">
                    {isEditing ? (form.id ? '编辑技能' : '新建技能') : selected?.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {selected?.readonly
                      ? '官方内置'
                      : selected
                        ? `自定义 · 分组 ${selected.groupLabel}`
                        : '保存即写回磁盘上的 SKILL.md（整包原子写，写盘成功才更新列表）'}
                  </div>
                </div>
                {/* 「编辑」不在这里再放一份：操作区那个是唯一入口（P1 一个动作一个入口） */}
                <button
                  type="button"
                  onClick={closeEditor}
                  title="关闭"
                  className="shrink-0 cursor-pointer border-none bg-transparent text-[18px] leading-none text-muted hover:text-body"
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
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
                        {selected.usable
                          ? selected.enabled
                            ? '对话里可用'
                            : '对话里不带它'
                          : '不可用于对话'}
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
                          正文引用了包里没有的资料：{selected.missingRefs.join('、')}
                          （模型读到会失败）
                        </div>
                      )}
                      {selected.noDescription && selected.usable && (
                        <div className="text-amber-300">
                          没有描述 ⇒ 不会出现在「可用 Skill 清单」里
                        </div>
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
                    {/* 名称 + 分组同一排：它俩是"这个技能叫什么 / 归到哪一类"，配对出现才看得出关系 */}
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
                      一个技能只属于一个分组；在这里改成别的分组 = 把它移过去，
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
                            onClick={() =>
                              void handleOpen(selected?.readonly ? undefined : selected)
                            }
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
          是随程序内置的（不占磁盘），只能开关；你的技能住在技能库里，改它请用上面的弹窗，或者在右上
          ⋯ →「打开技能库」里直接改文件。
        </div>
      )}
    </section>
  );
}
