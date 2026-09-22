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
 * 【判据不另写】"这条能不能选"读的是列表视图给的 `row.usable` × `row.enabled`（与设置页列表**同一处判**）。
 */
import { buildSkillLibraryView } from './skillLibraryView.ts';
import type { IndexRow } from './skillLibraryView.ts';
import { asText } from '../rules/skillText.ts';
import type { SkillGroupKind } from '../rules/skillGroup.ts';
import type { BuiltinSkillDef, SkillLibrary } from '../skillTypes.ts';

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
 * 造选用入口的分组。**入参**：技能全集（`listAllSkills()` 的形状）+ 磁盘现状 + 启用态映射。
 *
 * 【本层判"选得动" —— 两半都在这里，只判一次（TD-11-75）】"能不能选" = `row.usable`（结构：磁盘有 +
 * 有 id + 已在索引）× `row.enabled`（用户开关）。此前这**两半住两层**：调用方先按 `isSkillEnabled`
 * 预过滤（判"启用"）、本函数再按 `usable` 过滤（判"可用"）⇒ 同一条判据两个出生地。
 * 现在调用方只**转发真值**（面板持有 `readSkillEnabledMap()`，与 `skillStore.isSkillEnabled` 同源），
 * 判断全在本函数。
 * ⚠️ 与 TD-11-71 的关系：那轮把 `&& r.enabled` 去掉，是因为当时传进来的是 `{}`（**编的值**），
 * 过滤等于依赖"缺省启用"这个副作用。**根因是输入不真，不是这个判断错了** —— 输入改成真值后，
 * 这条判断回到它该在的层（判据要么判、要么不判，现在它是**真判**）。
 * **空组不出现** —— 选用入口摆一个没有成员的组只是挡路（磁盘上的空组由设置页如实显示，
 * 那里"分组"是能管理的对象）。
 *
 * 【取用面的磁盘收口（TD-11-55）】给 `disk` 时，"**磁盘上已删除、索引里还在**"的条目不进下拉
 * （那种条目能被告知"本轮启用"、正文可注入，而附属资料已随磁盘删除而丢失）。
 * 【未决时怎么办】`disk` 为 `null`（没读到、或后端没起）⇒ 按索引列出（**不把下拉变空**）：
 * "读不到磁盘"与"磁盘上没有技能"是两件事，不许用后者否定前者（黑话：不得用空清单否定真值）。
 *
 * 【两个入参都**必填**：不许用"省略"表达世界状态】`disk` 的 `null` 与 `enabledMap` 的 `{}` 都是
 * **合法的世界状态**（未决 / 没有任何关掉的记录），但必须由调用方**说出来**：
 * 给它们默认值就等于"漏传 ⇒ 静默按索引列出 + 静默全部启用"，正是本仓"缺省 = 危险值"的形态。
 */
export function buildSkillPickerGroups(
  all: readonly IndexRow[],
  disk: SkillLibrary | null,
  enabledMap: Record<string, boolean>,
): SkillPickGroup[] {
  const list = [...(all || [])];
  const builtins: BuiltinSkillDef[] = list
    .filter((s) => !!s.builtin)
    .map((s) => ({
      id: asText(s.id),
      name: asText(s.name),
      description: asText(s.description),
      content: asText(s.content),
      version: typeof s.version === 'string' ? s.version : undefined,
    }));
  const mine = list.filter((s) => !s.builtin);
  const view = buildSkillLibraryView({ disk, indexRows: mine, enabledMap, builtins });
  return view.groups
    .map((g) => ({
      kind: g.kind,
      label: g.label,
      // 「选得动」两半合一处：`usable`（结构可用）× `enabled`（用户开关）—— 不再由调用方预过滤
      items: g.rows.filter((r) => r.usable && r.enabled).map((r) => ({ id: r.id, name: r.name })),
    }))
    .filter((g) => g.items.length > 0);
}
