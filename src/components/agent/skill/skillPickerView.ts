/**
 * 选用入口（AI 面板下拉）的**分组视图（纯函数）** —— 与设置页列表**同一套语义**（`kind` / `label`）。
 *
 * 【为什么单独一个文件（TD-11-68）】它与列表视图是**两个用例**：列表要"行状态全集 + 组三态 + 计数"，
 * 选用入口只要"选得动的那些、按组摆好"。此前两者同居在 `skillLibraryView.ts`（518 行）里
 * ⇒ 改下拉的契约要在一个装着行状态机的文件里动手。拆开后变更理由独立。
 *
 * 【为什么不在这里归组（TD-11-62）】此处从前在面板里**手写** `{ name: '__official', label: '官方' }`
 * —— 消费者自己捏造哨兵组 ⇒ 组语义有两个出生地、改哨兵值即静默失效（无类型错、无测试拦）。
 * 现在整组交给本函数，而组名与措辞都取自 `skillGroup.ts`（`labelOfGroup` / `kindOfGroup`）——
 * 本文件（与面板一样）不认识任何哨兵。
 *
 * 【判据不另写】"这条能不能选"读的是列表视图给的 `row.usable`（与设置页列表**同一处判**）。
 */
import { asText, buildSkillLibraryView } from './skillLibraryView.ts';
import type { BuiltinLike, IndexRow } from './skillLibraryView.ts';
import type { SkillGroupKind } from './skillGroup.ts';
import type { SkillLibrary } from './skillTypes.ts';

/** 选用入口的一行 —— **只要 id 与名字**：选定只传 id，正文由冻结层按 id 现查 */
export interface SkillPickRow {
  id: string;
  name: string;
}

/** 选用入口的组：组头只需 `label`；`kind` 与设置页列表**同语义**（消费者不许比哨兵） */
export interface SkillPickGroup {
  kind: SkillGroupKind;
  label: string;
  items: SkillPickRow[];
}

/**
 * 造选用入口的分组。**入参**：技能全集（`listAllSkills()` 的形状）+ 磁盘现状（可缺省）。
 *
 * 【输入是"选得动的"那批】组合（`listAllSkills`）与启用判据（`isSkillEnabled`）由调用方先过；
 * 本函数只做"按组摆好"。**空组不出现** —— 选用入口摆一个没有成员的组只是挡路（磁盘上的空组
 * 由设置页如实显示，那里"分组"是能管理的对象）。
 *
 * 【取用面的磁盘收口（TD-11-55）】给 `disk` 时，"**磁盘上已删除、索引里还在**"的条目不进下拉
 * （那种条目能被告知"本轮启用"、正文可注入，而附属资料已随磁盘删除而丢失）。
 * 【未决时怎么办】`disk` 缺省/为 `null`（没读到、或后端没起）⇒ 按索引列出（**不把下拉变空**）：
 * "读不到磁盘"与"磁盘上没有技能"是两件事，不许用后者否定前者（黑话：不得用空清单否定真值）。
 */
export function buildSkillPickerGroups(
  all: readonly IndexRow[],
  disk: SkillLibrary | null = null,
): SkillPickGroup[] {
  const list = [...(all || [])];
  const builtins: BuiltinLike[] = list
    .filter((s) => !!s.builtin)
    .map((s) => ({
      id: asText(s.id),
      name: asText(s.name),
      description: asText(s.description),
      content: asText(s.content),
      version: typeof s.version === 'string' ? s.version : undefined,
    }));
  const mine = list.filter((s) => !s.builtin);
  // `enabledMap: {}` = 「本层没有启用态信息」⇒ 视图按"缺省启用"填 `row.enabled`，但**本函数不读它**
  // （启用判据由调用方先过：面板给的就是已启用的那批 —— 见 `AgentPanel` 的 `isSkillEnabled` 过滤）
  const view = buildSkillLibraryView({ disk, indexRows: mine, enabledMap: {}, builtins });
  return view.groups
    .map((g) => ({
      kind: g.kind,
      label: g.label,
      // 【只按 `usable` 过滤（TD-11-71）】此前是 `r.usable && r.enabled` —— 那等于把"本层不判启用"
      // 表达成"依赖 `enabledMap` 的缺省值"：哪天"缺省启用"改成"缺省关"，本函数会**静默返回空下拉**，
      // 而它的 docblock 恰好承诺"不把下拉变空"。判据要么判、要么不判，不靠副作用。
      items: g.rows.filter((r) => r.usable).map((r) => ({ id: r.id, name: r.name })),
    }))
    .filter((g) => g.items.length > 0);
}
