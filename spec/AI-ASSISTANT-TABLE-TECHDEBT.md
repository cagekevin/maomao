# AI 助手表格 —— 技术债清理清单（先于新功能）

> **状态：已整合** —— 本文清理清单已并入 `spec/AI-ASSISTANT-TABLE-IMPLEMENTATION.md`（唯一实施依据，含执行顺序与验收）；本文保留为盘点证据。
> 来源：code-explorer 子代理全链路盘点（证据均为 file:line 级），2026-09-06
> 目标：在加「多行改 + 选行为意图」两功能**之前**先清债，避免在新地基上叠旧坑
> 配套：`spec/AI-ASSISTANT-TABLE-FEATURES.md`

## 总览

| 级别 | 含义 | 数量 |
|---|---|---|
| A | 高优先级：会导致数据错误/丢失/静默失败 | 5 |
| B | 中优先级：逻辑重复/可维护性/语义隐患 | 6 |
| C | 低优先级：注释过时/死代码/小清理 | 5 |

**核心病灶**：`buildPreviewModel`（预览）与 `confirmTablePreview`（确认）是两套独立推导，对同一份 AI JSON 各自重算 → 空行/多行下分歧，表现为"预览对、确认不更新/丢数据"。所有 A 级债都源于此。

---

## A 级（须在上新功能前清）

### [A-001] 单行定位失败静默降级为整表全量替换 → 灾难性丢数据
- **位置**：`src/components/agent/assistantTable/tableWorkspaceState.ts:167-197`（`:174 if (targetRowId)` 不成立直落 `:183 jsonToSb`）
- **问题**：仅当 `rows.length===1` 且 `targetRowId` 能解析（有合法 `_rowIndex` 或当时选中行）才走 `mergeRowFromObj`；否则不报错直接整表重写。
- **危害**：本想改某行却覆盖整张表（列 id 全重生、未回显数据永久丢失），零提示。极端形态的"预览对、确认却丢数据"。
- **修法**：单行合并失败应**显式失败并提示**，绝不静默降级为整表替换；至少 `logger.warn` + 中断确认。

### [A-002] `jsonToSb` 静默丢空行，预览 `buildPreviewModel` 却保留 → 行数不一致
- **位置**：确认侧 `assistantTable.ts:386-393`（`if (!hasText) continue;`）；预览侧 `assistantTable.ts:504-517`（整表分支不过滤空行）
- **问题**：整表确认用 `hasText` 跳过全空行，预览却保留所有行。
- **危害**：预览看到 N 行、确认后只剩 N-k 行；含空行的修改"看似确认了却没变"——即"预览对、确认不更新"的直接成因。
- **修法**：预览与确认共用同一套行保留/过滤规则（抽单一纯函数），空行策略显式约定。

### [A-003] `jsonToSb` 重生成全部列 id 并整体重建 → 丢列/丢列宽
- **位置**：`assistantTable.ts:379-394`（列由 `rows[0]` 键重建、id 用 `generateId('col')`）；调用 `tableWorkspaceState.ts:183-194`
- **问题**：整表写回是整体新建，不是"按列名合并"。AI 漏回某列 → 该列及所有行数据被静默删，`width` 等列元数据一并丢。
- **危害**：用户手加后被 AI 漏回的列整列消失；列 id 重生破坏任何对列 id 的引用/缓存。
- **修法**：整表写回应基于"现有列 id + 列名对齐合并"，仅确为新建空表才全量重建。

### [A-004] `confirmTablePreview` 静默吞错（无返回值/无日志）
- **位置**：`tableWorkspaceState.ts:159-197` 整体（无 return；多处分支静默转整表/丢行/跳列）
- **问题**：函数全程无返回/异常；单行失败静默转整表、`jsonToSb` 静默丢行/丢列、`mergeRowFromObj` 静默跳列，均无 `logger`。
- **危害**："点了确认但表没按预期变"无从定位——静默吞失败的实锤。
- **修法**：返回 `{ ok, mode, droppedRows?, droppedCols? }` 或至少对丢数据路径打 `logger.warn`，UI 据返回给 toast。

### [A-005] `mergeRowFromObj` 列名不匹配静默跳过（不告警、不新增列）
- **位置**：`assistantTable.ts:412-419`（`if (!(col.label in obj)) continue;`；未知列无处理）
- **问题**：单行写回只遍历现有列、按列名精确匹配；AI 返回列名有空格/措辞差异或想新增列 → 该值被静默丢弃。
- **危害**："预览显示有该列新值、确认后该列没变"的静默不一致；也直接阻碍"AI 自由加列"。
- **修法**：列名归一化（trim/去多余空格）模糊匹配；未知列名显式提示或按策略新增。

---

## B 级（中优先级）

### [B-001] 三套并行"AI JSON → 表"推导逻辑各自为政、易漂移
- **位置**：`buildPreviewModel`（`assistantTable.ts:470-518`）、`jsonToSb`（`:373-396`）、`mergeRowFromObj`（`:402-422`）
- **问题**：预览/整表确认/单行确认各写一套映射；空行过滤、列名匹配、`_rowIndex` 处理不共享。
- **危害**：即"两套独立逻辑各自重算"的技术根因；任一处改规则另两处不同步。
- **修法**：抽统一纯函数（如 `aiRowsToColumnsAndValues(json, opts)`）供三处共用，规则单一来源。

### [B-002] 缺失"多行改"写回路径：AI 返回多行只能整表替换
- **位置**：`tableWorkspaceState.ts:167`（`rows.length===1` 才单行）、`:182-196`（多行 → `jsonToSb` 整表）
- **问题**：confirm 仅支持"1 行 merge"或"多行整表重建"两态，无"按 `_rowIndex` 批量 patch 多行"中间态。
- **危害**：新功能"多行改"若复用当前逻辑，会把"改几条指定行"变成整表覆盖，连带触发 A-003 丢列。
- **修法**：新增 `mergeRowsFromObjs(current, objs)`——按各行 `_rowIndex`/id 逐行 merge，未提及行保持不动。

### [B-003] 选中行 id 取"探测瞬间快照"而非"确认时实时值"
- **位置**：固化 `AgentPanel.tsx:383`（`rowId: wsSnap.selectedRowId`）；使用 `tableWorkspaceState.ts:162` 及 `buildPreviewModel` 收 `ws.preview.rowId`
- **问题**：`acceptTablePreview` 把探测当时的 `selectedRowId` 固化进 `preview.rowId`；预览与确认都用快照。
- **危害**：探测后改选别的行再点确认，写回仍落旧行；"选中即意图"必须以确认时实时选中为准。
- **修法**：确认时实时读共享态 `selectedRowId`（或 preview 不固化 rowId，确认时再解析）。

### [B-004] `AssistantTablePanel` 本地 `selectedRowId` 与共享态双源不同步
- **位置**：本地 `AssistantTablePanel.tsx:128`、onClickRow `:330-333`、渲染 `:639`；共享态 `tableWorkspaceState.ts:55/138`；AgentPanel 取消选中 `AgentPanel.tsx:1281/1481` 只改共享态
- **问题**：高亮用本地 `selectedRowId`，注入/预览/确认用共享态。"取消选中"只改共享态，本地高亮残留。
- **危害**：看到某行高亮（本地）但注入/写回用另一份（共享）——"选中即意图"的隐患。
- **修法**：删本地 `selectedRowId`，统一用 `ws.selectedRowId` 渲染与判定（onClickRow 仅调 `setTableWorkspaceRow`）。

### [B-005] `looksLikeTableJson` 误判：任意 `{` 开头文本误弹错误 toast
- **位置**：`AgentPanel.tsx:1979-1988`（`/^\s*\{/` + `globalStyle`/`rows` 正则）+ 调用 `:385`
- **问题**：正则命中任何以 `{` 起的消息；普通正文（代码/JSON 示例）会被误判"想返回表格但格式错"并弹错。
- **危害**：干扰正常对话。
- **修法**：收紧探测（要求含 `rows` 数组结构，或仅在 `tryParseAssistantTableJson` 失败且结构明显像表格时报警）。

### [B-006] 空行过滤 `hasText` 在 `parsePasted` 与 `jsonToSb` 重复实现
- **位置**：`assistantTable.ts:150-157`（`parsePasted`）、`:386-391`（`jsonToSb`）
- **问题**：同样"全空行跳过"判定写两次，语义一致只是巧合，易漂移。
- **修法**：抽 `rowHasText(values)` 单一函数共用。

---

## C 级（低优先级）

### [C-001] `sbToJson` 导出但从未被业务调用（疑似死代码）
- **位置**：`assistantTable.ts:361-366`（仅内部 `rowToObj` 间接用；外部 0 调用）
- **修法**：删除或补调用；若仅测试用则标注。

### [C-002] `normalizeAssistantTable` 中 `ids` 声明后用 `void ids;` 压制告警（死变量）
- **位置**：`assistantTable.ts:104`、`assistantTable.ts:121`
- **修法**：删除 `ids` 声明与 `void ids;`。

### [C-003] 全仓无 `TODO/FIXME/XXX/HACK` 标记，技术债完全 undocumented
- **位置**：全仓 `src`（搜索 0 命中）
- **修法**：至少在 `confirmTablePreview` / `jsonToSb` / `mergeRowFromObj` 处加 TODO 指向本清单。

### [C-004] `selectedRowId` 单值形状不支持多选（新功能需改造）
- **位置**：`tableWorkspaceState.ts:55`、`AssistantTablePanel.tsx:329-333`
- **问题**：共享态单值与新功能多选天然不兼容；onClickRow 只单选 toggle。
- **修法**：新功能阶段把形状改为 `string[]`，并改造 onClickRow（Ctrl/Cmd 多选）；优先先消 B-004 双源。

### [C-005] 关闭面板时 AI 已返回的表格 JSON 被静默丢弃
- **位置**：`AgentPanel.tsx:381`、`:353-392`（两段探测都要求 `open`）
- **问题**：面板关闭时探测到表格 JSON，既不 `acceptTablePreview` 也不报错，整条回复被忽略。
- **修法**：设计上"关闭=关协作"合理；建议重新打开时给"有未处理表格建议"入口，避免内容凭空消失。

---

## 清理顺序建议（最小风险支撑两新功能）

1. **B-004 选中态双源归一**：删 `AssistantTablePanel` 本地 `selectedRowId`，全改读共享态。改动小、风险低，是"选中即意图"底座。
2. **B-003 确认时实时读选中态**：把 `preview.rowId` 的"探测快照"改为"确认时实时 `selectedRowId`"，使"选中即意图"语义正确。
3. **B-001 + B-006 抽统一纯函数**：`aiRowsToColumnsAndValues(json, { keepEmptyRows })` + `rowHasText(values)`，预览与确认共用。消除 A-002 分歧前提，纯重构低风险。
4. **A-002 + A-003 整表写回改为"列名对齐合并"、空行策略统一**：不再全量重建、不静默丢列/丢行。
5. **A-001 + A-004 单行失败不再静默降级为整表；confirm 返回结果/打 warn**：数据安全硬闸。
6. **B-002 + C-004 新增"多行改"merge 路径、`selectedRowId` 升级为集合 + onClickRow 多选**：此时底层"按 `_rowIndex` 批量 patch"与"多选即意图"才有干净地基；A-005 列名模糊匹配一并补上，支撑"AI 自由加列"。

> A-001/A-002/A-003 是当前"预览→确认"分歧与静默失败的直接技术根因，须在上新功能**之前**完成；B-004/B-003 必须排最前，否则"选中即意图"会在双源/快照上再次踩坑。
