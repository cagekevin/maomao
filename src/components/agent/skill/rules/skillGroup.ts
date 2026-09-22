/**
 * 技能**分组**的全部语义（唯一家）：兜底组名 · 组名 → 显示名 · 组名 → 语义类别 · 排序 · 输入框预填值。
 *
 * 【为什么收成一个文件（TD-11-58/62/68）】这些映射此前后散在三处：`skillCatalog.skillGroupLabel`、
 * `skillLibraryView` 的两个伪组特例、以及消费者自己判。而现在有**两个消费者**（设置页列表、
 * AI 面板下拉）都按同一套语义渲染 —— 共享语义住在**其中一个消费者**里是错的（另一个要用就得抄）。
 *
 * 【本文件是"组"这件事的唯一出生地】两个伪组哨兵（`OFFICIAL_GROUP` / `INDEX_ONLY_GROUP`）只在这里定义，
 * 且**不对域外导出**（域外读 `SkillGroupView.kind` / `SkillPickGroup.kind`，不是读哨兵字符串）。
 * 由 `check:arch` 的"哨兵字面量只许住本文件"守另一半 —— 不然有人手抄一份，改哨兵值即静默失效。
 *
 * 【变更理由】"系统里有哪几类组、每类叫什么、怎么排序"。与"行状态怎么从磁盘×索引判出来"
 * （`skillLibraryView.ts`）、"选用入口要摆成什么形状"（`skillPickerView.ts`）各不相干。
 */

/** 无分类技能的落点分组（唯一真源；迁移、新建、导入都落这里） */
export const UNSORTED_GROUP = '_未分类';

/**
 * 官方（内置）组：内置技能是**代码常量**、没有磁盘包，是唯一不来自磁盘的一组。
 *
 * 【可见性（TD-11-62 + 68）】定义处**只有本文件**（`check:arch` 有闸只放行这里的字面量），且
 * **门面不转发** ⇒ 域外拿不到它们，"在外面比哨兵"这条路在类型层就不成立。
 * 模块内它必须能被 `skillLibraryView.ts` 的表用（"官方恒排最前"要认出它）—— 那次共享是结构必然；
 * 而**语义**仍然只经 `kindOfGroup` / `labelOfGroup` 出去（模块内的消费者也一律读 `kind`，不许比字面量）。
 */
export const OFFICIAL_GROUP = '__official';
/** 仅存在于索引（磁盘上已删除）的行的收纳组 —— 它**不是**磁盘上的分组，故不进骨架顺序（同上：门面不转发） */
export const INDEX_ONLY_GROUP = '__index-only';

/**
 * 组的**语义类别** —— 消费者据此渲染（官方段 / 已删除段 / 普通段），**不许**再比较 `name`。
 * 【为什么要有它】`name` 是数据（磁盘目录名 / 两个内部哨兵），不是给界面分支用的；
 * 界面分支要的是"这是哪一类组"。把语义提成字段后，哨兵值怎么改都影响不到消费者。
 */
export type SkillGroupKind = 'official' | 'index-only' | 'normal';

/**
 * 组名 → 显示名：**完整映射的唯一措辞源**（含两个伪组）。
 * `skillGroupLabel` 只做最后一步兜底（`_未分类` → 「未分组」）—— 改组措辞请改这里。
 */
export const labelOfGroup = (name: string): string =>
  name === OFFICIAL_GROUP
    ? '官方'
    : name === INDEX_ONLY_GROUP
      ? '磁盘上已删除'
      : skillGroupLabel(name);

/** 组名 → 语义类别（与 `labelOfGroup` 同一处口径：只在本文件认哨兵） */
export const kindOfGroup = (name: string): SkillGroupKind =>
  name === OFFICIAL_GROUP ? 'official' : name === INDEX_ONLY_GROUP ? 'index-only' : 'normal';

/**
 * 分组输入框的**预填值**：**兜底组不是用户要填的组名** ⇒ 空串；不可编辑的行没有输入框 ⇒ 也空串。
 * 【为什么由本层给（TD-11-58）】界面此前自己比 `UNSORTED_GROUP` 哨兵来折叠（`prefillCategory`）——
 * 哨兵是模块内部约定，泄漏出去 ⇒ 改哨兵值即静默失效（与 TD-11-62 同族）。
 */
export const categoryInputOf = (group: string, editable: boolean): string =>
  editable && group !== UNSORTED_GROUP ? group : '';

/**
 * 组名 → 界面显示名：**只兜 `_未分类`**（内部兜底名 → 「未分组」）。
 *
 * ⚠️ 它**不是**完整映射的唯一措辞源（TD-11-69 就地回改）：完整映射是上面的 `labelOfGroup`
 * —— 两个伪组（官方 / 磁盘上已删除）的措辞在那里，本函数是它的**最后一步兜底**。
 */
export function skillGroupLabel(name: string): string {
  return name === UNSORTED_GROUP ? '未分组' : name;
}

/**
 * 组的**排序位次**（唯一家）—— 段序：**官方恒最前**（内置是代码常量，不属于任何磁盘目录）
 * < **普通磁盘组**（本地中文序） < **`_未分类`**（兜底组是"还没归组"，不是用户有意建的分组）
 * < **仅索引收纳段**（磁盘上已删除的"待处置"，不是用户建的分组）。
 *
 * 【为什么这条规则住在这里（TD-11-74）】本文件头自称"分组的**全部**语义（唯一家）：…排序…"，
 * 但此前只有 `_未分类` 那一条住在这里，"官方恒最前"与"仅索引恒最后"却写在视图文件里
 * ⇒ 想改"官方组排第几"的人按头注释进本文件**找不到**，会以为没有这条规则而另写一份
 * （正是本仓"判据两个出生地"的形态）。现在**位次只在这里定**，视图层只剩"按位次排"。
 */
export function orderOfGroup(name: string): number {
  if (name === OFFICIAL_GROUP) return 0;
  if (name === INDEX_ONLY_GROUP) return 3;
  if (name === UNSORTED_GROUP) return 2;
  return 1;
}

/** 组排序：先按 `orderOfGroup` 位次（段序），同位次按本地中文序 */
export function compareSkillGroups(a: string, b: string): number {
  const byOrder = orderOfGroup(a) - orderOfGroup(b);
  return byOrder !== 0 ? byOrder : a.localeCompare(b, 'zh-Hans-CN');
}
