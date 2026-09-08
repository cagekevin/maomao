# AI 助手表格 —— 不变量清单与收口方案

> **状态：实施中 · 批 0/批 1 已完成（2026-09-08）**
> 起因：`copyTab` 复制出空表（2026-09-08 修）、「假成功」「非幂等读」（2026-09-07 修）——
> **三次事故同一个根**：ID 与引用散落各处，且「引用断了」全程静默，无人报错。
> 本文把表格域**所有应当恒真**的约束整理成清单，供收口与单测钉死。
>
> **2026-09-08 落地（批 0 + 批 1）**：
> - ✅ 批 1：新建 `assistantTable/tableIds.ts`（`newTabId/newColId/newRowId`，前缀 `atab/acol/arow`），
>   替换 `assistantTable.ts` 全部 20 处裸 `generateId('col'|'row'|'tab')`；
> - ✅ 批 1：新建 `assistantTable/tableInvariants.ts`（`validateTabs/validateWorkspace/~Violation~`，
>   I/S/T/W/P 清单校验；`normalizeLabel` 导出复用做 S2 同名列）；测试 `tests/unit/tableInvariants.test.ts`
>   （17 条含错误注入红测）；SSOT-7 稳定 id 单测进 `assistantTable.memory.test.ts`；
> - ✅ 批 1：SSOT-6 孤儿草稿清理 —— `useTableDrafts.ts` 增自维护裁剪 effect（table 行/列缩小即清孤儿 `${rowId}:${colId}`/colRename key）；
> - ✅ 批 0：`AgentPanel` 改走 `useActiveAssistantTable()`，删就地 `normalizeAssistantTabs` 再造（根治两套 id 空间）。
> 批 2/3/4 未做（涉及语义变更 / S2 决策，另行评估）。
>
> 关联：`AI-ASSISTANT-TABLE-IMPLEMENTATION.md`、`AI-ASSISTANT-TABLE-JSON-CONTRACT.md`、
> `AI-ASSISTANT-TABLE-INTERACTION-MODEL.md`、`AI-ASSISTANT-TABLE-TABS.md`。
> 真源：`src/components/agent/assistantTable/assistantTable.ts`、`tableWorkspaceState.ts`。

---

## 零、阅读约定

每条不变量标注**现状保障等级**：

| 标记 | 含义 |
| --- | --- |
| ✅ | 已有保障（注明位置），只需补一条校验防回潮 |
| ⚠️ | 部分保障（靠调用方自觉 / 只在部分入口做了） |
| ❌ | **无任何保障**，纯靠运气，是首要收口对象 |

---

## 〇、单一数据源（SSOT）—— 最上游

> 这组是**所有其它不变量的前提**：如果数据有两个来源，I4 之类的引用校验查了也白查——
> 两个来源各自「自洽」，但互相对不上。

### 分层（只允许 L0 可写，其余全是派生或运行态）

| 层 | 内容 | 可写？ |
| --- | --- | --- |
| **L0 真源** | `memory.assistantTables`（`{tabs, activeTabId}`） | ✅ **唯一可写** |
| L1 派生 | `activeTab` / `table` / `globalStyle` / `rowToText` / `rowToObj` | ❌ 读时计算 |
| L2 运行态（不落盘，只存 id） | `tableWorkspaceState`：selectedRowIds / preview / range / editingCell / open / width | ❌ |
| L3 草稿（未提交编辑） | `useTableDrafts`：edits / colRenameDraft / styleDraft | ❌ |
| L4 渲染缓存 | `useColumnResize` 的 `colWidthMapRef` | ❌ |
| L5 历史副本（只读） | 撤销栈 `pushHistory(tabs0)` | ❌ |
| L6 兼容层 | `memory.assistantTable` / `global_contract.unified_style_prompt` | ❌ **只读，绝不写** |

### 不变量

| # | 不变量 | 违反后果 | 现状 |
| --- | --- | --- | --- |
| **SSOT-1** | L0 是表格数据唯一可写源 | 双写失同步 | ✅ 注释+实践，无强制 |
| **SSOT-2** | L6 兼容层只读，绝不写 | 脏数据残留、老数据"复活" | ⚠️ 只靠注释（`conversationAiState:114`），**无守卫、无测试** |
| **SSOT-3** 🔴 | **所有消费方必须走 `useActiveAssistantTable()` 单一入口**，禁止各自订阅 + 各自 `normalizeAssistantTabs` | **同一份 raw 被归一化两次 → 造出两套 id 空间** | ❌ **已违规**：见下 |
| **SSOT-4** | 派生数据必须 `useMemo` 派生，**禁止 `useState` 缓存表格数据** | 数据副本失同步 | ✅ 两处都是 `useMemo` |
| **SSOT-5** | 运行态（L2）不落盘，且**只存 id、不存表格数据副本** | 快照膨胀 / 失同步 | ✅ |
| **SSOT-6** | 草稿（L3）随数据变更失效：**删行/删列必须清对应 `${rowId}:${colId}` 孤儿 key** | 孤儿草稿堆积；将来若 id 复用会串值 | ❌ **删行/删列路径未清**（只有撤销/切 tab 走 `resetAllDrafts`） |
| **SSOT-7** | 真源必须「已落盘」：**不接受「读时才造 id」的惰性真源** | 非幂等读 → 前后对不上（2026-09-07 事故根因） | ⚠️ 已有 `materializeAssistantTabs` **补丁**，根因未除 |
| **SSOT-8** | 撤销栈是历史副本，**不得当数据源读** | 读到过期数据 | ✅ |
| **SSOT-9** | 预览卡渲染投影（`resultCols/resultRows`），确认只原样写回 | 预览≠结果 | ✅（= P7） |

### 🔴 SSOT-3 违规详情（本次新发现）

`AssistantTablePanel` 走单一入口，但 **`AgentPanel` 绕过了它**，自己又写了一遍：

```380:401:src/components/panels/AgentPanel.tsx
  const activeConv = (conversations || []).find((c) => c.id === activeConversationId);
  const tableTabs = useMemo(
    () =>
      normalizeAssistantTabs(activeConv?.memory?.assistantTables ?? null, {
        assistantTable: activeConv?.memory?.assistantTable ?? null,
        globalStyle: /* global_contract.unified_style_prompt */ '',
      }),
    [activeConv],
  );
  const activeTab = getActiveTab(tableTabs);
  const tableData = useMemo(
    () => (activeTab ? { columns: activeTab.columns, rows: activeTab.rows } : emptyAssistantTable()),
    [activeTab],
  );
```

对照 `AssistantTablePanel.tsx:112` 用的是 `useActiveAssistantTable()`。

**后果链**：
1. 两处各自调 `normalizeAssistantTabs`；
2. 若 `memory.assistantTables` 尚未落盘（新对话 / 老数据），`normalizeAssistantTabs:725` 会 `generateId('tab')` 造**新 id**；
3. → **发送侧（AgentPanel）与显示侧（AssistantTablePanel）持有 id 不同的两份表**；内容一样，但 col/row/tab id 全不同；
4. → 任何跨侧引用（发送时带选中行、预览写回目标表）都可能对不上。

这正是 2026-09-07「AI 预览后不知道往哪个表填」的**结构性根因**；
`materializeAssistantTabs` 只是把"未落盘"这个触发条件补掉了，**破口本身还在**。

**收口动作**：`AgentPanel` 改用 `useActiveAssistantTable()`，删除这段就地订阅与拼装。

---

## 一、ID 与引用完整性（I）

| # | 不变量 | 违反后果 | 现状 | 收口动作 |
| --- | --- | --- | --- | --- |
| **I1** | tab id 全局唯一 | `getTab` 取错表 → 写错表 | ⚠️ 靠 `generateId` 随机性 | 校验 + 生成收口 |
| **I2** | col id **表内**唯一 | 列值串列、删列删错 | ⚠️ 同上 | 校验 |
| **I3** | row id **表内**唯一 | 选中行错位、删行删错 | ⚠️ 同上 | 校验 |
| **I4** | **每行 `values` 的 key 集合 == 本表 `columns` 的 id 集合**（既不缺、也不多） | 缺 → 显示空白；多 → 孤儿数据（静默膨胀） | ❌ **无运行时校验**，仅 `normalizeAssistantTable:125` 建表时保证 | **核心校验项**（`copyTab` 事故正是这条） |
| **I5** | `activeTabId` 恒指向存在的 tab | 静默回退到 `tabs[0]` → 用户以为在表2、写进表1 | ⚠️ 有回退但**静默**（`:716` / `:745` / `:793`） | 回退处加 `logger.warn` |
| **I6** | 跨表不复用 col/row id（复制表必须换新 id 空间） | 跨表粘贴/合并串味 | ⚠️ `copyTab` 已修，无校验 | 校验（警告级） |
| **I7** | 单元格值一律 `string`（`CellValue = string`） | 破坏 AI 契约 `rows: Record<string,string>` | ✅ 类型约束 | — |

> **I4 是三次事故的共同形态**：引用与定义在「复制/重映射」时脱节。
> 一条 `values.key ⊆ columns.id` 的校验，就能在写代码的当下抓住，而不是等用户看到空表。

---

## 二、表结构（S）

| # | 不变量 | 违反后果 | 现状 | 收口动作 |
| --- | --- | --- | --- | --- |
| **S1** | 列 `label` 非空 | AI 契约键为空、列无法定位 | ✅ `renameColumn:278` 拒空、`normalize:105` 丢弃空名列 | — |
| **S2** | **列 `label`（`normalizeLabel` 后）表内唯一** | `colValue:560` / `pasteRows:992` / `copyRowsToTab:1038` 均按 label 归一匹配 → **同名列取错值、互相覆盖** | ❌ **`renameColumn` 不查重**，用户可把两列改成同名 | **需要决策**：禁止同名（改 `renameColumn` 幂等拒绝）或允许但取首个（补注释 + 校验） |
| **S3** | 列名匹配一律走 `normalizeLabel`（trim + 折叠空白），禁止裸 `===` | A-005 回潮（AI 键名带空格匹配不上） | ✅ 三处均已用它（`buildPreviewResult` / `pasteRows` / `copyRowsToTab`） | 校验：新代码不得裸比 label |
| **S4** | `rows` 数组顺序 == 显示顺序 == 发给 AI 的「第N行」行号 | AI 改错行 | ✅ `buildTableSnapshotText:1903` `第${i+1}行` | 校验（顺序无状态，靠约定） |
| **S5** | `columns` 数组顺序 == 显示顺序 == CSV/TSV 列顺序 | 导出/粘贴串列 | ✅ | — |
| **S6** | 表可为空（`columns`/`rows` 皆空），但** tabs 恒 ≥1** | 零 tab 态引发空指针 | ✅ `removeTab:831` 防御 + `emptyAssistantTabs` 注释 | 校验 |

---

## 三、多标签页（T）

| # | 不变量 | 违反后果 | 现状 | 收口动作 |
| --- | --- | --- | --- | --- |
| **T1** | `tabs.length ≥ 1`（不做零 tab 态） | 空指针分支 | ✅ `removeTab:831` | 校验 |
| **T2** | `activeTabId` 指向存在的 tab（= I5） | 静默写错表 | ⚠️ 静默回退 | 回退加 warn |
| **T3** | `globalStyle` 每 tab 独立，不进 `global_contract` | 风格串表（隔离决策被破坏） | ✅ `setTabGlobalStyle` | 校验：不得写 `global_contract` |
| **T4** | 删除 tab 后，指向它的引用必须作废（尤其 `preview.targetTabId`） | 确认写悬空 id → 假成功 | ✅ `discardPreviewForMissingTarget:388` | 已修，补校验 |
| **T5** | 复制 tab 必须生成**全新** id 空间（tab + col + row 全换） | 跨表串味 | ⚠️ `copyTab` 已修（2026-09-08），无校验 | 走 `cloneTableWithNewIds` + 校验 |

---

## 四、运行态 / 协作现场（W，不落盘）

> 真源 `tableWorkspaceState.ts`，仅内存。**切 tab / 切对话 / 关面板必须整体清理**。

| # | 不变量 | 违反后果 | 现状 | 收口动作 |
| --- | --- | --- | --- | --- |
| **W1** | `selectedRowIds` ⊆ 当前表 `rows` 的 id | 幽灵选中、删除行数不对 | ⚠️ 只在删行入口清（`:325` `:350`）；**换表靠 `switchTableTab` 清**（`:380`） | 校验（切表/写回后） |
| **W2** | **`selectedRowIds`（行选）与 `focusedCell`/`editingCell`（单格）互斥**，不可并存 | 「行也选了、单格还亮着」脏叠加 | ✅ 双向清理已实现（`AssistantTablePanel:187-208` 与 `:418-420`，注释记了 2026-09-08 踩坑） | 校验：两者不得同时非空 |
| **W3** | `editingCell` 至多一个（整表同时只有一个编辑格） | 多格同时编辑、提交错乱 | ✅ 单一事实源 `editingCell` | 校验 |
| **W4** | `focusedCell` / `editingCell` 指向存在的 row 与 col | 高亮幽灵格 | ⚠️ 无显式校验 | 校验 |
| **W5** | `range` 锚点 `r0/c0/r1/c1` 都是 **id**（非索引）；任一失效 → 整段选区无效 | 选区越界、复制错内容 | ✅ `rangeToCells:904`「任一锚点失效返回 []」 | 校验：id 必须存在 |
| **W6** | 内部剪贴板 `clipboard` 的 colIds ⊆ 当前表 `columns` | 粘贴出串列 | ⚠️ `pasteRows` 按 label 兜底，未命中放空 | 校验（警告级） |
| **W7** | 切 tab / 切对话 / 关面板 → 清 `selectedRowIds` / `preview` / `range` / `focusedCell` / `editingCell` | 状态串到别的表/对话 | ✅ `switchTableTab:321` / `resetTableWorkspace:410` | 校验 |

---

## 五、预览与 AI 契约（P）

| # | 不变量 | 违反后果 | 现状 | 收口动作 |
| --- | --- | --- | --- | --- |
| **P1** | `preview.targetTabId` 恒指向存在的 tab，否则作废 | 确认写悬空 → 「提示成功但表空」 | ✅ `discardPreviewForMissingTarget` + `confirmTablePreview:361` 存在性兜底（2026-09-07） | 补校验 |
| **P2** | `preview.resultCols` 非空才允许确认写回 | 落空表 | ✅ `confirmTablePreview:348` 显式失败 | — |
| **P3** | `preview.changedRowIds` ⊆ `resultRows` 的 id | 预览卡折叠错行 | ✅ 由 `buildPreviewResult` 产出 | 校验 |
| **P4** | 发给 AI 的 `rows` 值一律 string（契约不受未来扩展影响） | 契约破坏 | ✅ `CellValue = string` | — |
| **P5** | `_rowIndex` 是定位元数据，**绝不当列** | 多出一列 `_rowIndex` | ✅ `buildPreviewResult:520` 显式跳过 | 校验 |
| **P6** | 确认写回后必须清协作现场（旧 rowId 属原表） | 跨表残留选中 | ✅ `switchTableTab:380`（注释已说明） | — |
| **P7** | 「预览=确认」：accept 时算好，confirm 只原样写回，**零二次推导** | 预览与结果不一致 | ✅ 架构约束（文件头 :19-20） | 校验：confirm 不得调 `buildPreviewResult` |

---

## 六、数值与格式边界（N）

| # | 不变量 | 现状 |
| --- | --- | --- |
| **N1** | 手动锁定列宽 `col.width ∈ [60, 600]` | ✅ `useColumnResize` `COL_W_MIN/MAX` |
| **N2** | 估算列宽 ∈ [90, 240] | ✅ `estimateColumnWidth:291-292` |
| **N3** | 两套宽度常量口径不同是**刻意的**（估算 vs 手动锁定），勿统一 | ⚠️ 记录下来，防止后人误合并 |
| **N4** | 空行判定一律走 `rowHasText`（不自己判） | ✅ |

---

## 七、收口实施（五层）

### L0 · 单一入口收口（**最优先**，其它层的前提）

1. **`AgentPanel` 改用 `useActiveAssistantTable()`**，删除就地 `normalizeAssistantTabs` + `getActiveTab` + 拼装（SSOT-3）。
2. 加守卫：
   - 禁止 `assistantTable.ts` 之外出现 `normalizeAssistantTabs(` 的裸调用（可用 `check:` 脚本或 code review 规则）；
   - 单测：mock 一份「未落盘」的会话，断言**两次调用得到同一批 id**（钉死 SSOT-7）。
3. 草稿清理：删行/删列后清 `edits` 中对应孤儿 key（SSOT-6）。

### L1 · 生成收口（零风险，纯改名）

新建 `assistantTable/tableIds.ts`：

```ts
export const newTabId = () => generateId('atab');
export const newColId = () => generateId('acol');
export const newRowId = () => generateId('arow');
```

替换全部 20+ 处裸 `generateId('col'|'row'|'tab')`。

> ⚠️ 前缀必须换：现有 `generateId('tab')` 被**浏览器窗口 id** 占用
> （`useCanvasSync.ts:30`），与表格标签页撞前缀，妨碍 grep 排障。

### L2 · 查找收口（禁止静默）

- 新增 `requireTab(tabs, id): TableTab` —— 找不到**抛错**，供「必须命中」场景
- `updateTab` / `setTabTable`：**找不到即显式失败**（logger.warn + 返回标记），
  **不再静默 no-op**（这是「假成功」的根因，`:760-764`）
- 三处静默回退（`:716` / `:745` / `:793`）：保留回退（不能崩），但加 `logger.warn`

### L3 · 重映射收口（一个函数管所有复制）

```ts
cloneTableWithNewIds(sb): AssistantTable                    // copyTab / 老数据水合
remapRowsColumns(rows, idMap, srcCols): TableRow[]          // copyRowsToTab / 粘贴
```

**所有动列的地方只准走这两个**，禁止就地手写 `map`。

### L4 · 不变量校验（真正防回潮的一层）

```ts
/** 返回违规描述数组；空 = 健康。硬约束违规 → error，可疑 → warn */
export function validateTabs(tabs: AssistantTableTabs): Violation[];
export function validateWorkspace(state: TableWorkspaceState, tabs): Violation[];
```

**检查项**（对应上文 I/S/T/W/P）：

*硬约束（error）*
- I1/I2/I3 id 唯一；**I4 `values.key == columns.id`**；I5 activeTabId 有效
- S1 label 非空；S6/T1 tabs ≥ 1
- P1 preview.targetTabId 有效

*警告（warn）*
- I6 跨表 id 复用；**S2 同名列**；W1/W4/W5 悬空引用；W2 行选与单格并存；P3 changedRowIds 越界

**接入点**：
1. `normalizeAssistantTabs` 出口 + `setCurrentAssistantTabs` 落盘前（dev 下 `console.warn`）
2. **单测通用断言**：所有表格纯函数用例末尾跑一次 `expect(validateTabs(tabs)).toEqual([])`

---

## 八、落地分批（风险递增）

| 批次 | 内容 | 风险 | 收益 |
| --- | --- | --- | --- |
| **批 0** | **SSOT-3**：`AgentPanel` 改走 `useActiveAssistantTable()`；禁止裸调 `normalizeAssistantTabs` | 中（动发送侧数据源） | **根治「两套 id 空间」**，是后面所有校验生效的前提 |
| **批 1** | `tableIds.ts` 生成收口 + `validateTabs`/`validateWorkspace` + 单测接入；草稿清理（SSOT-6） | **零** | 拦住未来绝大多数同类 bug |
| **批 2** | `updateTab`/`setTabTable` 静默 → 显式失败 + 回退处 warn | 低 | 消灭「假成功」 |
| **批 3** | `cloneTableWithNewIds` / `remapRowsColumns` 收口，替换就地实现 | 中 | 消灭「复制丢数据」 |
| **批 4** | **决策 S2**（列同名是否允许），按裁定改 `renameColumn` 或补注释 | 低 | 消除同名列取错值 |

**顺序建议**：批 1（零风险、先立护栏）→ 批 0（根治根因）→ 批 2/3/4。

> 若先做批 0 再做批 1 也可以，但**不做批 0，批 1 的校验只能查单侧自洽**——
> 「两侧各自自洽但互相对不上」这类问题查不出来。

---

## 九、单测接入示例

```ts
// 每个表格用例末尾一行，成本低、覆盖面广
import { validateTabs } from '../../src/components/agent/assistantTable/tableInvariants.ts';

it('copyTab 后不变量成立', () => {
  const next = copyTab(fixture, 'A');
  expect(validateTabs(next).filter((v) => v.level === 'error')).toEqual([]);
});
```

配合「错误注入」用例（故意删掉一个 col 但不改 values，断言校验报错），
确保校验本身有效——**否则校验会像没写一样**。
