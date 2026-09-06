# AI 助手表格 —— 可执行实施文档（技术债清理 + 多行改 / 选行为追加）

> **状态：可执行（2026-09-06）**。本文是「AI 助手表格」改造的**唯一实施依据**，实施时按顺序执行第 2、3 步，每步有验收。
> 整合自三篇（原文档保留为背景/证据，已不再单独作为实施依据）：
>
> - `spec/AI-ASSISTANT-TABLE-TECHDEBT.md` → 技术债清理清单，**全量执行**（第 2 步）
>
> - `spec/AI-ASSISTANT-TABLE-FEATURES.md` → 新功能设计，**全量执行**（第 3 步）
>
> - `spec/AI-ASSISTANT-TABLE-PROMPT-DESIGN.md` → 提示词/意图设计，**只读参考，不在本次改动范围**（表格人格 `mode='table'` 切换、`TABLE_RULES` 已定稿落地于 `agentCore.ts`/`agentConfig.ts`，见 §6）

***

## 0. 范围与边界

| <br />  | 内容                                                                                 |
| ------- | ---------------------------------------------------------------------------------- |
| **做**   | ① 技术债清理（A+B+C 级，第 2 步）；② 新功能「多行同时修改 + 以选中行表达追加」（第 3 步）                             |
| **不做**  | 表格人格/提示词改动（PROMPT-DESIGN 已定稿落地）；工具执行层硬闸、工具按 mode 裁剪（PROMPT-DESIGN §7.3 可选根治项，本次不做） |
| **纯前端** | 全部改动在 `src/`，不涉及 localTool / 端口 / 存储键 / 事件契约新增                                     |

***

## 1. 目标行为（「选中态 = 唯一意图信号」，预览 = 确认）

> 全部写回与预览共用同一份「操作后最终表格」，确认只原样写回、**不再二次推导**。

| 场景                  | 意图判定                                                   |
| ------------------- | ------------------------------------------------------ |
| 选中 N 行 + AI 回 N 行   | `update`：第 i 个 AI 行填进选中的第 i 行（行内有 `_rowIndex` 优先按行号定位） |
| 选中 0 行 + AI 回行      | `append`：原样追加到末尾（保留原有行与列宽）                             |
| 选中 N 行 + AI 回 M>N 行 | 前 N 行 `update`，多出的 M-N 行 `append`                      |
| AI 显式返回全表           | `replace`：按列名映射现有列、保留列 id 与列宽，不重生成列 id                 |
| AI 返回的列名对不上现有列      | 作为**新列追加**（先在预览里显示，确认可见），绝不静默跳过                        |
| 任何写回                | 绝不 `generateId('col')` 重造列；列宽 `width` 不丢               |

***

## 1.5 数据流与契约（2026-09-06 实施定稿）

> 本节是改造后的**数据流与契约真源**，代码 JSDoc 与之对齐。先定死再施工。

### 1.5.1 数据流

```
用户左表（memory.assistantTable，唯一数据真源）
  │  编辑/加行/删行/多选（Cmd/Ctrl）
  ▼
共享运行态 tableWorkspaceState：open / width / selectedRowIds / preview / handledMessageId
  │  发送（AgentPanel.handleSend）：现状 + buildRefineRowsUser(选中行带行号) → user 注入
  ▼
AI 返回表格 JSON → 探测（tryParseAssistantTableJson）
  │  acceptTablePreview：用【实时表 + 实时选中】调 buildPreviewResult，把「操作后最终表格」算好存 preview
  ▼
preview = { json, messageId, selectedRowIds(冻结), resultRows, resultCols, opKind }
  │  预览卡直接渲染 resultRows/resultCols（预览 = 确认）
  ▼
confirmTablePreview：只原样写回 resultCols/resultRows + globalStyle，零二次推导
```

### 1.5.2 契约（关键决策）

| #  | 契约                                                                                                                                                                                                                                                                                                                                                    |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1 | **选中态唯一信号**：`selectedRowIds: string[]`（共享单源，删 `AssistantTablePanel` 本地副本）。普通点击=单选/再点取消；Cmd/Ctrl+点击=累加/取消。取消选中入口一律 `setTableWorkspaceRows([])`                                                                                                                                                                                                         |
| C2 | **意图判定**（`buildPreviewResult(sb, json, selectedRowIds)` 内，唯一推导）：当前表无列 → `replace`（按 AI 建表，丢全空行）；逐行定目标：AI 行带合法 `_rowIndex` → 按行号定位（未选中也能改指定行，TABLE\_RULES「把第 3 行改成 X」场景），无 `_rowIndex` 时第 i 个 AI 行 → 第 i 个选中行；无任何目标（未选中且无 `_rowIndex`）→ `append`（原样追加末尾）；有目标 → `update`（M>N 时未命中目标的 AI 行追加）。**既有表「AI 显式返回全表」不单独识别**（TABLE\_RULES 对既有表只教单行/加行；重建走清空后建表） |
| C3 | **列合并**：AI 键名 trim+折叠空白归一后命中现有列 → 沿用原列 id/width；未命中 → 新列追加末尾（`generateId('col')`）。任何写回绝不重造既有列 id                                                                                                                                                                                                                                                      |
| C4 | **空行策略**：`rowHasText(values)` 单一实现。`replace` 建表丢全空行；`append`/`update` 保留（目标是明确的行，不丢）                                                                                                                                                                                                                                                                  |
| C5 | **预览=确认**：`acceptTablePreview` 时一次性算好结果存入 preview；确认只写回，**不再二次推导**。B-003「确认时实时读选中态」由此**结构消解**（写回的就是预览所见，无第二次读取）                                                                                                                                                                                                                                       |
| C6 | **确认安全**：`confirmTablePreview` 返回 `{ ok, mode }`，结果无列时 `logger.warn` + 不落表 + 返回 `{ok:false}`，绝不静默降级                                                                                                                                                                                                                                                   |
| C7 | **旧推导删除**：`jsonToSb` / `mergeRowFromObj` / `buildPreviewModel` / `sbToJson` 删除（逻辑迁入 `buildPreviewResult`）；`rowToObj` 保留（`useCanvasAgentTools` 在用）                                                                                                                                                                                                     |
| C8 | **探测收紧**（B-005）：`looksLikeTableJson` 去掉裸 `^\s*\{` 判定，仅认 代码块 / `globalStyle:` / `rows:`                                                                                                                                                                                                                                                                |
| C9 | **AI 上下文**：全表现状（`buildTableSnapshotText` 不变）+ 有选中行时 `buildRefineRowsUser(第N行文本数组, globalStyle, 用户话)`，替换 `buildRefineRowUser`                                                                                                                                                                                                                          |

***

## 2. 技术债清理（前置，先做）

> 顺序即 TECHDEBT「清理顺序建议」：先选中态底座，再抽统一推导，最后数据安全硬闸。A 级（A-001\~A-005）须在第 3 步之前全部完成。
> 文件位置为指引（2026-09-06 快照），改前先读对应文件当前文本。

### 2.1 选中态底座（必须先做，否则「选中即意图」在双源/快照上再次踩坑）

| 编号        | 改动                                                                                                                                                             | 位置                                                | 验收                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------ |
| **B-004** | 删 `AssistantTablePanel` 本地 `selectedRowId`，高亮/判定全读共享态 `ws.selectedRowId`；`onClickRow` 仅调 `setTableWorkspaceRow`（`tableWorkspaceState.ts:139`）                  | `AssistantTablePanel.tsx:128/260/329-333/639-640` | 高亮、注入、写回同源；取消选中后本地高亮不再残留 |
| **B-003** | 确认时**实时**读共享态 `selectedRowId`，不再用探测瞬间快照：`AgentPanel.tsx:383` 去掉 `rowId: wsSnap.selectedRowId` 固化；`confirmTablePreview`/`buildPreviewModel` 不再收 `preview.rowId` | `AgentPanel.tsx:383`；`tableWorkspaceState.ts:162` | 探测后改选其它行再点确认，写回落在新选行     |

### 2.2 统一推导纯函数（消除「预览≠确认」分歧前提）

| 编号        | 改动                                                                        | 位置                                                    | 验收                   |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------- |
| **B-001** | 抽统一纯函数 `aiRowsToColumnsAndValues(json, opts)`，预览 / 整表确认 / 单行确认三处共用，规则单一来源 | `assistantTable.ts:470-518` / `:373-396` / `:402-422` | 三处调用同一函数，无各自为政映射     |
| **B-006** | 抽 `rowHasText(values)` 单一函数，`parsePasted` 与 `jsonToSb` 共用                 | `assistantTable.ts:150-157` / `:386-391`              | 两处调用同一函数             |
| **A-002** | 空行策略显式约定并统一：预览与确认共用同一 `keepEmptyRows` 选项；整表确认不再用 `hasText` 静默丢空行          | `assistantTable.ts:386-393`（确认）vs `:504-517`（预览）      | 含空行的修改，预览行数 == 确认后行数 |

### 2.3 整表写回安全（不丢列/不丢列宽）

| 编号        | 改动                                                                 | 位置                                                                            | 验收                   |
| --------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------- |
| **A-003** | 整表写回改为「按现有列 id + 列名对齐合并」，仅确为新建空表才全量重建；AI 漏回某列 → 该列及数据保留、`width` 不丢 | `assistantTable.ts:373-394`（`jsonToSb` 重建列处）；`tableWorkspaceState.ts:183-194` | 手加列后让 AI 整表回，漏回的列不消失 |

### 2.4 数据安全硬闸（单行失败不再静默）

| 编号        | 改动                                                                                                         | 位置                                                           | 验收                          |
| --------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------- |
| **A-001** | 单行定位失败 → **显式失败 +** **`logger.warn`** **+ 中断确认**，绝不静默降级为整表替换                                               | `tableWorkspaceState.ts:167-197`（`:174 if (targetRowId)` 分支） | 单行写回失败有告警、不覆盖整表             |
| **A-004** | `confirmTablePreview` 返回 `{ ok, mode, droppedRows?, droppedCols? }`（或至少对丢数据路径 `logger.warn`），UI 据返回给 toast | `tableWorkspaceState.ts:159-197`（现无返回/无日志）                   | 确认异常可定位、可见                  |
| **A-005** | 列名归一化（trim / 去多余空格）模糊匹配；未知列名不再 `continue` 静默跳，按新功能策略作为新列追加                                                 | `assistantTable.ts:412-419`（`mergeRowFromObj`）               | AI 返回列名带空格/措辞差异仍命中；未知列出现在预览 |

### 2.5 为功能铺路 + 小清理

| 编号        | 改动                                                                                   | 位置                              | 验收                    |
| --------- | ------------------------------------------------------------------------------------ | ------------------------------- | --------------------- |
| **B-002** | 新增 `mergeRowsFromObjs(current, objs)`：按各行 `_rowIndex`/id 逐行 merge，未提及行保持不动（多行改的地基）   | `tableWorkspaceState.ts:167` 一带 | 多行 patch 不触发整表覆盖      |
| **B-005** | 收紧 `looksLikeTableJson` 探测（要求含 `rows` 数组结构，或仅在解析失败且结构明显像表格时报警），普通 `{` 开头正文不再误弹 toast | `AgentPanel.tsx:1979-1988`      | 任意 `{` 开头的聊天正文不弹「格式错」 |
| **C-001** | `sbToJson` 删除或标注（仅测试用则加注释说明）                                                         | `assistantTable.ts:361-366`     | 无死导出残留                |
| **C-002** | 删 `normalizeAssistantTable` 中 `ids` 声明与 `void ids;`                                  | `assistantTable.ts:104/121`     | 无死变量                  |
| **C-003** | 在 `confirmTablePreview` / `jsonToSb` / `mergeRowFromObj` 处加 TODO 指向本清单               | 同上三处                            | 技术债可见                 |
| **C-005** | （可选）面板关闭时探测到表格 JSON 不静默丢：重开时给「有未处理表格建议」入口                                            | `AgentPanel.tsx:353-392`        | 关面板重开，未处理内容有提示        |

***

## 3. 新功能实施（后做，依赖第 2 步完成）

### 3.1 多选状态（C-004 落地）

- `tableWorkspaceState.ts:55/77/122/139`：`selectedRowId: string \| null` → **`selectedRowIds: string[]`**（多选集合）；`setTableWorkspaceRow` 相应改造；取消选中清空集合。

- `AssistantTablePanel` `onClickRow`（`:329-333`）：**Cmd/Ctrl + 点击**累加/取消选中，普通点击单选；**不新增 checkbox 列**（改动面最小）。

- `AgentPanel.handleSend`：发送时把**选中的多行**（行号 + 可读内容）一起注入，提示模型「请按选中行逐一返回改动」。

### 3.2 统一预览 / 写回架构（预览 = 确认）

- **preview 新形状**（`tableWorkspaceState.ts`）：

```ts
interface TableWorkspacePreview {
  json: AssistantTableJson;
  messageId: unknown;
  selectedRowIds: string[];          // 发消息那一刻冻结的选中（含多选）
  resultRows: TableRow[];            // 操作后"最终的全部行"（预览=确认）
  resultCols: TableColumn[];         // 操作后列（保留原列 id/宽度，新增列才追加）
  opKind: 'update' | 'append' | 'replace';
}
```

- **纯函数** **`buildPreviewResult(sb, json, selectedRowIds)`**：产出 `{ resultRows, resultCols, opKind }`，即「操作后最终表格」。意图判定按 §1 表执行。预览 UI 与确认写回**共用这一份结果**（吸收 2.2 的统一推导函数）。

- **`confirmTablePreview()`** **退化为一行写入**：

```ts
setCurrentAssistantTable({ columns: p.resultCols, rows: p.resultRows });
// + globalStyle 处理 + markMessageTableResolved('confirmed') + 清 preview
```

- 删除确认路径上 `_rowIndex` / `mergeRowFromObj` / `jsonToSb` 的二次推导（逻辑保留或迁移进 `buildPreviewResult` 内）。

### 3.3 交互与 AI 上下文

| 项      | 做法                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| 预览     | 右卡显示「操作后最终整表」（= 确认结果），左表仍为旧态，天然可对比                                                                                 |
| AI 上下文 | 沿用已落地的表格现状注入（`buildTableSnapshotText` + 有选中行时 `buildRefineRowUser`，见 PROMPT-DESIGN §5.2），扩展为多行版本（选中多行 → 多行行号+内容注入） |
| 兜底     | 未选中任何行 + AI 返回行 → 按 `append` 末尾追加，不破坏现有数据                                                                          |

### 3.4 功能工作流（无需新 UI 元素）

1. 用户想加内容 → 点「加行」建好空行（如 2 行）→ Cmd/Ctrl 多选这些空行 → 对 AI 说「给这两行续写…」。
2. AI 返回对应行内容 → 确认填进选中的空行。
3. 「改」与「加」共用同一套机制，**无单独追加语义/开关**。

***

## 4. 验收标准（FEATURES §6 原样，全过才算完成）

1. 选中一个**空行** + AI 续写 → 确认后内容填进该空行（不再「纹丝不动」）。
2. 选中**两行** + AI 改这两行 → 确认后两行都更新，未选中的行不受影响。
3. **未选中**任何行 + AI 返回行 → 确认后末尾追加，原有行与列宽不丢。
4. AI 返回的**列名与现有不一致** → 新列出现在预览中，确认后被加入（不再静默丢弃）。
5. 预览所见 == 确认结果（任意场景）。

***

## 5. 验证命令

- **每步完成**：`npm run type-check` + 相关单测：

  - `npx vitest run tests/unit/assistantTable.test.ts`（`extractRowIndex` / `jsonToSb` / `buildPreviewModel` / `aiRowsToColumnsAndValues` / `rowHasText`）

  - `npx vitest run tests/unit/tableWorkspaceState.test.ts`（`confirmTablePreview` 定位与写回、`buildPreviewResult`）

  - 改了注入/探测：`npx vitest run tests/unit/agentLogic.test.ts tests/unit/useAgentChat.hook.test.ts`（断言引用 `TABLE_AGENT_RULES`，改字不红、漏注入才红）

- **提交前**：`npm test`（= smoke + vitest 全量 + regression + tools）+ `npm run build`；较大改动加 `npm run check:health`。

- 本次为纯前端改动，**不涉及** `cd localTool && npm test`。

***

## 6. 参考（只读，不执行）

- `spec/AI-ASSISTANT-TABLE-PROMPT-DESIGN.md`：表格人格 / 意图协议全貌（`mode='table'` 切换、`TABLE_RULES` 五段结构、判定分流表、排错对照表）。**改提示词前必读，勿推翻已定决策**。注：其引用的 `spec/TABLE-WORKSPACE-INDEPENDENT-PANEL.md` 当前不存在于仓库，仅代码注释里留名。

- `spec/CONTEXT.md` §五 数据一致性防线：任务中心权威源、节点不回写等通用红线。

- 关键代码：`src/components/agent/assistantTable/*`（表格模型 + 解析纯函数）、`src/components/agent/runtime/agentCore.ts`（`buildRequestMessages` mode 切换）、`src/components/agent/runtime/useAgentChat.ts`（`tableOpen`→mode）、`src/components/panels/AgentPanel.tsx`（表格现状注入 / 探测 / 取消选中）。

