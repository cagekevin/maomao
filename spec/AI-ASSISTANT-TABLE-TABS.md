# AI 助手表格 —— 多标签页与表格编辑增强（2026-09-07 需求定稿）

> **状态：需求定稿（2026-09-07 用户逐条拍板）**。本文是「多标签页 + 配套编辑增强」这一期改造的**需求与契约真源**。
> **执行态（2026-09-07 追加 §2.1「数据流与可执行契约」）**：§8 全部待确认项已拍板，数据流/契约已对着既有源码签名定死，可据此施工。
> 上游权威（不改）：`docs/分镜协作-AI助手内嵌工作区-2026-09-05.md`（产品定稿）、`spec/AI-ASSISTANT-TABLE-IMPLEMENTATION.md`（AI 逻辑层契约 C1~C9，**本次不动**）、`spec/AI-ASSISTANT-TABLE-PROMPT-DESIGN.md`（提示词人格，**改注入文本时必读**）、`spec/AI-ASSISTANT-TABLE-UI-FOUNDATION.md`（UI 分层蓝图）。
> 本文只新增/修订：① 表格从「一对话一张表」→「一对话多标签页」（tab 置顶、单选即选中、可拖拽排序）；② 预览卡拖动拉高；③ 预览可指定写入哪个标签页；④ 表格层撤销/重做（仅按钮）；⑤ 行尾 ⋯ 菜单；⑥ 批量复制/删除 + 跨表复制 + 区域选择；⑦ 落画布带表名。

---

## 0. 本轮拍板清单（一句话，做/不做）

| # | 项 | 结论 |
|---|---|---|
| 1 | **多标签页**，标签页之间**隔离**（列/行/全局风格各归各表） | ✅ 做 |
| 2 | `globalStyle` | ✅ **每 tab 独立**（真隔离，不再对话级共享） |
| 3 | AI 上下文注入 | ✅ **选中态即授权**：**选中的那张表**（当前 tab）才随会话发给 AI；其余 tab 对 AI 完全不可见（天然单选、天然防信息过载） |
| 3b | 独立「点亮/高亮」开关 + tab 多选 | ❌ **取消**（2026-09-07 二次裁定）："高亮没意义、多选 tab 也没意义" —— 状态只留**一个「选中态」**，选中 = 当前 = 发给 AI |
| 4 | 落画布 `rowToText` | ✅ **带表名**（可选参数，仅落画布路径传） |
| 5 | 表格层**撤销/重做** | ✅ 做功能，**但只走工具条 ⟲/⟳ 按钮**；❌ **不绑 Ctrl/Cmd+Z 快捷键**（规避与画布/单元格的三方冲突，见 §3.4） |
| 6 | 行操作 | ✅ 行尾 **⋯（三点竖）菜单**；❌ **不做右键菜单**；保留上移/下移（**行**拖拽排序不做） |
| 7 | 行多选 | ✅ **已改造**（2026-09-07 落地）：**只有点最左边行号格 `#` 才是选行**（Cmd/Ctrl 加选、Shift 选区间）；点普通格子 = 设选区起点。原先点整行任意格都选行，与 §3.6「点格设选区」直接打架 |
| 8 | 批量复制 / 批量删除 / **跨表复制** / **区域选择** | ✅ 做（"那就变成真正表格了"） |
| 9 | **tab 拖拽排序** | ✅ **做**（本轮改口要）；❌ 行/列拖拽排序仍不做 |
| 9b | 隐藏列、冻结首列、双击列宽自适应 | ❌ 不做（非必备） |
| 10 | 表内搜索 / 筛选 / 排序 | ❌ 不做 |
| 11 | 导入 / 导出文件（CSV/JSON） | ❌ 不做 |
| 12 | B 类（批量生成 / AI 跨表读写 / AI 写回独立回滚 / 预览 diff 开关） | ❌ 不做（多余） |
| 13 | C 类「tab 基础操作」（新建 / 关闭 / 重命名 / 复制为新表 / 横向滚动 / 行数） | ✅ 做 |
| 14 | 表模板、跨对话复用表 | ❌ 不做 |
| 15 | D 类（预览高度落盘记忆 / 面板最大化 / 关面板未处理预览提示） | ❌ 忽略 |
| 16 | **tab 位置** | ✅ **面板最顶部独立一条 36px**（全局风格条之上）—— 详见 §3.1 |

**预览卡拖动拉高**：✅ 做；高度**只存运行态、不落盘**（对应 D 类"忽略"= 不做记忆/最大化）。

> **为什么最终只有一个「选中态」**（用户 2026-09-07 二次裁定）：
> 起因是"信息太多 AI 会混乱" → 曾设想「点亮开关 + tab 多选」来挑几张发给 AI；最终收敛为**更简单的模型**：
> **一张表被选中（= 当前正在看的那张）→ 它才发给 AI，其余对 AI 不存在。**
> 收益：① 概念只剩一个，不用解释"选中 vs 点亮"；② 天然单选 → 从源头杜绝多表信息过载；③ UI 最省（tab 上不需要任何开关控件）。
> 代价（已知并接受）：**不能让 AI 同时看两张表做对照**；将来若真需要，再引入 `aiOn` 开关（方案留档，本期不做）。

---

## 1. 数据契约（唯一数据形态，先定死）

### 1.1 会话记忆字段变更

- 现状：`memory.assistantTable = { columns, rows }`（一对话一张表），`globalStyle` 存 `memory.global_contract.unified_style_prompt`（**对话级**）。
- 改造：新增 `memory.assistantTables`（多标签页真源）。`memory.assistantTable` **保留只读兼容**（老数据水合用，不再写）。

```ts
/** 一个标签页 = 一张独立的、隔离的表 */
export interface TableTab {
  id: string;            // generateId('tab')，稳定唯一
  name: string;          // 默认「表1/表2…」，双击可重命名
  columns: TableColumn[];// 复用既有 TableColumn（含 width）
  rows: TableRow[];      // 复用既有 TableRow
  globalStyle: string;   // 【本轮隔离决策】本表独立，不进 global_contract
  // 注：曾设计 `aiOn`（发给 AI 开关）与 tab 多选，2026-09-07 二次裁定取消 —— 一律以 activeTabId 为唯一信号
}

/** 一个对话的多标签页集合（会话记忆内聚字段，单一数据源） */
export interface AssistantTableTabs {
  tabs: TableTab[];
  activeTabId: string;   // 当前活动 tab（落盘，切对话回到上次的 tab）
}

/** 反序列化宽松形态（供 normalizeAssistantTabs 归一，兼容历史/脏数据） */
export interface RawAssistantTableTabs {
  tabs?: unknown[];
  activeTabId?: unknown;
  [key: string]: unknown;
}
```

### 1.2 归一化与老数据水合（`normalizeAssistantTabs`）

1. `memory.assistantTables` 存在且合法 → 直接归一（补 id、name 缺省 `表N`、globalStyle 缺省 `''`）。
2. 否则若 `memory.assistantTable` 有列或行 → **升为单 tab**：`name='表1'`，**`globalStyle` 一次性从 `global_contract.unified_style_prompt` 水合**（老数据不丢风格），并设其为 `activeTabId`，此后各表独立。
3. 都没有 → `emptyAssistantTabs()` = 一个空 tab（**不做"零 tab"态**：面板永远至少有一张表，省掉一堆空指针分支）。
4. `activeTabId` 缺失/指向不存在的 tab → 回退第一个 tab。

> ⚠️ **施工前必须 grep 全部 `global_contract` 读点**，确认除 globalStyle 外没有别的链路依赖它；本次只迁移"表格工作区全局风格"这一条语义，其它照旧。

### 1.3 兼容决策（关键，防大面积返工）

- `getCurrentAssistantTable() / setCurrentAssistantTable(sb)` **保留且语义收窄为「当前活动 tab 的表」**（内部走 tabs），`read_table` 工具、`buildTableSnapshotText`、`buildPreviewResult` 等既有调用点**签名不变**。
- 新增 tab 级读写：`getCurrentAssistantTabs() / setCurrentAssistantTabs(tabs) / getTab(tabs,tabId) / setTabTable(tabs,tabId,sb) / setTabGlobalStyle(tabs,tabId,style) / setActiveTabId(tabs,tabId)`。
- 模型层既有行/列纯函数（`addRow/deleteRow/moveRow/duplicateRow/setCell/insertColumnAfter/deleteColumn/renameColumn/setColumnWidth/...`）**签名全不动**，统一由 tab 级包装函数 `updateTab(tabs, tabId, fn: (sb)=>sb)` 套用 → 既有单测（测试即护栏）不红。

---

## 2. 运行态契约（`tableWorkspaceState.ts`）

> 原则：运行态**不落盘、不进 conversationState**；宽度沿用既有键 `agent_split_width`（不动）。

| 字段 | 变化 | 说明 |
|---|---|---|
| `open` / `width` | 不变 | 面板开合与宽 |
| `selectedRowIds` | 不变（`string[]`） | **切 tab 时清空**（见下），不改成 per-tab 结构（最小改动） |
| `preview` | **加 `targetTabId`** | 预览要写到哪张表；默认 = 探测时的活动 tab |
| `previewHeight` | **新增（仅内存）** | 预览卡高度 px，clamp 后存运行态；**不写 localStorage、不新增存储键** |
| `handledMessageId` | 不变 | 探测游标 |

**切标签页 = 重置协作现场**（对齐既有 `resetTableWorkspace` 语义，一行复用）：
`setActiveTab(tabId)` → 写 `activeTabId` 到会话记忆 + `setState({ ...state, selectedRowIds: [], preview: null, handledMessageId: null })`。
理由：选中行的 rowId 属于原表，跨表无意义；保留会直接破坏 C1「选中即唯一意图信号」。

### 2.1 数据流与可执行契约（2026-09-07 整理，对着既有源码签名定死）

> 现状签名已核对（`assistantTable.ts` / `tableWorkspaceState.ts` / `conversationAiState.ts`）：
> - `buildPreviewResult(sb, json, selectedRowIds = [])` 第 3 参即**选中行 id 集合** → §3.3 换目标表时传 `[]`（选中行不参与定位，与决策一致，无需新参数）✅；
> - `rowToText(sb, row, globalStyle?)` 现返回 `string` → 追加可选第 4 参 `tableName?` 可行；
> - `confirmTablePreview()` 现返回 `{ ok, mode? }`，当前把 globalStyle 写入 `global_contract` → 本次改写到**目标 tab 的 `globalStyle`**（迁移 read 侧灰色）。

**单一数据源**：`memory.assistantTables`（`AssistantTableTabs`，§1.1）为表格真源；`memory.assistantTable` 只读兼容（老数据水合，不再写）。读写一律经 `conversationStore` 唯一入口。

**写入链路（唯一入口 `setCurrentAssistantTabs`，commit 自动落盘）**
1. 表格/行/列/风格/表名/顺序 任一 commit → `updateTab(tabs, tabId, fn)` → `setCurrentAssistantTabs(nextTabs)`。
2. 预览探测 `acceptTablePreview({ json, messageId, selectedRowIds })`：目标 = 当前活动 tab；
   `buildPreviewResult(getTab(tabs, activeTabId).table, json, [])` 算好存入 `preview`（含 `targetTabId=activeTabId`）。
3. 切目标 `setPreviewTargetTab(tabId)`：`buildPreviewResult(getTab(tabs, tabId).table, preview.json, [])` 重算，更新 `preview.targetTabId`（保持「预览=确认」：确认只原样写回）。
4. 确认 `confirmTablePreview()`：① `setTabTable(tabs, targetTabId, { columns: resultCols, rows: resultRows })`（**源表不动**）；② globalStyle 写目标 tab 的 `globalStyle`（**不再写 `global_contract`**）；③ `markMessageTableResolved(messageId, 'confirmed')` + 清 preview；④ `setActiveTabId(tabs, targetTabId)`（**确认后自动切到目标表**）+ toast「已写入「表X」」；⑤ 结果无列 → `logger.warn` + 不落表 + `{ok:false}`（沿用 C6，不静默）。**每次确认写回入撤销栈。**

**读链路（AI 注入，只发当前选中表）**
- `AgentPanel` send：`buildTableSnapshotText(getTab(tabs, activeTabId).table, globalStyle, tableName = 当前表名)` → 首行「当前表 = 表X」+ 该表全量；**其余 tab 零注入**（连表名都不给）。
- `buildRefineRowsUser` 永远来自当前表；`read_table` 工具签名不变，仍只读当前选中表（仅 description 补「当前标签页」措辞）。

**切表重置（§2）**
- `setActiveTab(tabId)`：写 `activeTabId`（随会话落盘）+ 运行态 `setState({ ...state, selectedRowIds: [], preview: null, handledMessageId: null })`。

**批量/选区/跨表（§3.6）**
- 运行态新增 `clipboard: { kind: 'rows' | 'range', payload }`（仅内存，不落盘）。
- `copyRowsToTab(tabs, srcTabId, destTabId, rowIds)`：列按 `normalizeLabel` 归一命中（**复用 `buildPreviewResult` 那套归一**，禁新写一套匹配逻辑，防 A-005 静默丢值），未命中列留空、绝不丢值；复制到目标表**末尾**。

**撤销/重做（§3.4）**
- `tableHistory.push(tabs 引用)`（commit 后）→ `undo()/redo()` = `setCurrentAssistantTabs(snapshot)` + 清本地草稿；栈上限 **50**。UI 仅工具条 ⟲/⟳。

**新增/改造契约签名（对齐既有风格）**
- `normalizeAssistantTabs(raw): AssistantTableTabs`；`emptyAssistantTabs(): AssistantTableTabs`（恒 ≥1 空 tab，不做零 tab 态）。
- `updateTab(tabs, tabId, fn: (sb) => AssistantTable): AssistantTableTabs`。
- tab 级读写：`getCurrentAssistantTabs(): AssistantTableTabs` / `setCurrentAssistantTabs(t): void` / `getTab(tabs, tabId): TableTab | null` / `setTabTable(tabs, tabId, { columns, rows }): AssistantTableTabs` / `setTabGlobalStyle(tabs, tabId, style): AssistantTableTabs` / `setActiveTabId(tabs, tabId): AssistantTableTabs`。
- **`getCurrentAssistantTable() / setCurrentAssistantTable(sb)` 签名不变**，语义收窄为「当前活动 tab 的表」（内部走 tabs），既有调用点（`read_table` / `buildTableSnapshotText` / `buildPreviewResult` 探测）零改动。
- `rowToText(sb, row, globalStyle?, tableName?)`：`tableName` 传入则文本首行加 `表名：{tableName}`（§3.7，仅落画布路径传）。
- `buildTableSnapshotText(sb, globalStyle, tableName?)`：多带当前表名前缀（多表不新增注入逻辑）。
- 模型层既有行/列纯函数（`addRow/deleteRow/moveRow/duplicateRow/setCell/insertColumnAfter/deleteColumn/renameColumn/setColumnWidth/...`）**签名全不动**，统一由 `updateTab` 套用 → 既有单测（测试即护栏）不红。

---

## 3. 功能规格

### 3.1 多标签页（隔离）

**位置（决策）**：tab 条 = 表格面板**最顶部独立一行**（36px），在**全局风格条之上** —— 即 `.atw` 的第一个子节点、`.atw-head` 之前。

```
[tab 条 36px]   [表1 12 ×] [表2 3 ×] [表3 8 ×]    ＋  ⋯        ← 固定，不随表体滚
[全局条 + 工具条]   （属当前选中表）
[表体]             flex:1，自己滚
[预览卡，可拖高]     保持原位
注：示意中选中「表1」——视觉 = accent 淡蓝底 + 左侧 2px 竖条（见「选中态」）。
```

选最顶部的四条理由（第一条是硬约束）：
1. **`globalStyle` 已改为 per-tab**（§1.1），全局条属于"当前这张表"；tab 在它之上，层级才对 —— 否则看着像跨表共享。
2. **底部放不了**：面板底部已被**待确认预览卡**占据且可拖高，会打架（Excel 式底部 sheet 标签在此不适用）。
3. 表格面板无独立头部（关闭入口在 AI 助手顶栏），tab 条正好充当它的头。
4. 拖拽排序在顶部横条最自然；横向空间足（面板 360~1080）。

**选中态（唯一状态，单选）**

- 选中 = 当前正在看/编辑的那张表 = **发给 AI 的那张表**（`activeTabId`，三者同一）。
- ~~视觉沿用项目既有的「选中」语言：accent 淡蓝底 + 左侧 2px 竖条 + 文字最亮~~
  **更新(2026-09-07 落地修正)**：改用**中性高亮**（`surface-hover-strong` + 内描边 `edge` + 文字最亮），
  **不用蓝**。原因：蓝在本项目语义是「某开关已启用」（`panel-kit.css` 头部「语义色约定」），
  「当前项」全站统一为中性高亮（`.pk-seg-item[aria-selected]` / `.pk-pill[aria-pressed]` 同款）；
  原蓝底蓝竖条方案实测与全站观感冲突（用户反馈"格格不入"）。
  ⚠️ 表格行 `.sel` / 预览卡改动行仍保留 accent 蓝（那是"数据选中"，与本处"当前项"语义不同层，不动）。
- **tab 条上不设任何开关控件**（无勾、无高亮态）；点 tab 主体 = 选中它。
- ❌ 不做 tab 多选（无 Ctrl/Cmd 多选、无批量选中集合）。

**操作**

- 单击 tab 主体 → 选中（切表）；
- `＋` 新建标签页（空表，名 `表N`，自动选中）；
- 双击表名 → 就地重命名（Enter 提交 / Esc 取消，空名回退原名）；
- `×` 关闭 → 走 `askConfirm`（danger）：「关闭「表2」？表内 N 行将被删除且无法恢复」；最后一个 tab **不允许关闭**（禁用 `×`）；
- [C 类基础操作] **复制为新表** → tab 条尾部 `⋯` 菜单：{ 复制为新表 / 重命名 / 关闭 }（无右键菜单）。
  **落地约束(2026-09-07)**：`⋯` 与 `＋` 必须挂在**滚动容器外**的条尾（`.atw-tabs-tail`）——
  `.atw-tabs-scroll` 是 `overflow-x:auto/overflow-y:hidden`，浮层挂在其内部会被纵向裁掉，
  表现为「点了三个点没反应」（菜单其实开了，只是看不见）。菜单作用于**当前选中表**，
  点外部关闭走 `useOutsideClick`（全站 ⋯ 菜单同一套）。
- **tab 拖拽排序（本轮要）**：
  - 用 **pointer 事件手写**（`pointerdown` + **window 级** `pointermove/up/cancel/keydown`），**禁止 HTML5 `draggable`**（历史踩坑、用户点名不用：各浏览器 drag 行为差异大，易出诡异 bug）。
    ⚠️ **禁用 `setPointerCapture`（2026-09-07 踩坑）**：指针捕获会把随后的 mouseup / **click 一并重定向到捕获元素**，
    导致 tab 内的「切表」click 与 `×`／`⋯` 按钮全部收不到事件（「点了没反应」）。替代方案：
    监听挂 window + `consumeDrag()` 在 `onClickCapture` 阶段吞掉拖拽尾随的那次 click。
  - 拖拽中 **DOM 顺序不变**（只改 `transform:translateX` + 在落点 tab 上画 2px 插入指示线）。
    若按视觉序重渲整条，`children` 序号就不再是数据序号，命中判定会混用两套 index 算错落点。
  - 起拖阈值：按下后位移 **>4px** 才进入拖拽态，否则按"点击"处理（选中 tab）—— 避免"想点一下却把 tab 拖走"。
  - 拖拽中**只做视觉**：被拖 tab `transform: translateX` 跟随 + 目标位占位，**不重渲整条、不写 store**；松手才一次性 commit 新顺序到会话记忆（沿用 `useColumnResize` 的性能范式）。
  - `pointercancel` / Esc → 取消并回原位；拖到条外松手 → 回原位（不删除、不移动）。
  - 顺序变更**入撤销栈**（属结构变更，可用 ⟲ 回退）。
  - 自动横向滚动（拖到条边缘时）：能做就做，做不了可省（非必需）。
- ❌ **行 / 列拖拽排序**：仍不做（与 textarea 编辑、滚动容器冲突面大，历史上多次评估为高风险）。

**隔离语义（验收点）**：列、行、列宽、globalStyle、选中态、待确认预览，全部 per-tab，互不可见；**对 AI 的可见性由 `activeTabId` 决定** —— 只有选中（当前）的 tab 会发给 AI，其余对 AI 完全不存在（见 §3.8）。

### 3.2 预览卡拖动拉高

- 预览卡（`.atw-pv`）顶部加一条 6px 横向 grip（`.atw-pv-grip`，`cursor: row-resize`），拖拽调高。
- 高度 clamp：`min 120px`，`max = min(面板高 - 160px, 面板高 * 70%)`（**保证上方正式表格至少留 160px 可视区**）；拖拽中直改 DOM 不重渲（沿用 `useColumnResize` 同款性能设计），松手 `setPreviewHeight` 一次。
- 卡片 `max-height` 由写死的 `clamp(150px,28vh,300px)` 改为**运行态高度优先、无高度时回退现有 clamp**（`assistant-table.css`）。
- `.atw-body`（表格区）需补 `min-height: 160px`，否则可被压成 0。
- ❌ 不记忆、不双击复位、不最大化（D 类忽略）。

### 3.3 预览指定写入哪个标签页（下拉）

- 预览卡头（`atw-pv-hd`）加下拉：**「写入到：表1（当前）▾」**，选项 = 所有 tab + **「＋ 新建标签页」**（✅ 2026-09-07 确认：下拉末尾放一个「新建标签页」选项即可，省掉"先建表再发"两步）。
- **切换目标 = 用目标表重算**（保持 C5「预览 = 确认」，仍是一次性算好、确认只写回）：
  `setPreviewTargetTab(tabId)` → `buildPreviewResult(targetTab.sb, preview.json, [])`。
  - **选中行不参与定位**（rowId 属原表）：此时只认 AI 行里的 `_rowIndex`；
  - 目标表无列 → 自然判定 `replace` 建表（正好覆盖"让 AI 生成的内容进新表"）；
  - 选「＋ 新建标签页」→ 先建空 tab，再按 `replace` 算。
- `confirmTablePreview()`：
  1. 写 `setTabTable(targetTabId, { resultCols, resultRows })`（**源表不动**）；
  2. `globalStyle` 写到**目标 tab 的 `globalStyle`**（隔离决策），不再写 `global_contract`；
  3. `markMessageTableResolved(messageId,'confirmed')` + 清 preview；
  4. **✅ 自动切到目标 tab + toast「已写入「表2」」**（2026-09-07 已确认，否则用户看不到写回结果）；
  5. 结果无列 → `logger.warn` + 不落表 + `{ok:false}`（沿用 C6，不静默）。
- 每次确认写回**入撤销栈**（见 3.4）。

### 3.4 表格层撤销 / 重做

- 新建 `tableHistory.ts`（纯函数栈）+ `useTableHistory.ts`（hook）：past/future 栈，上限 **50** 步，快照 = **整份 `AssistantTableTabs` 的引用**（模型层本就不可变更新，存引用几乎零成本）。
- 入栈时机（只在 **commit** 后进，草稿逐键不入）：改格提交、加/删/移/复制行、列增删改名、列宽落点、粘贴、清空、**AI 确认写回**、关闭 tab、批量删除/粘贴/跨表复制、重命名 tab。
- 撤销/重做 = `setCurrentAssistantTabs(snapshot)` + 清本地草稿；跨 tab 也成立（快照是整份 tabs）。
- **UI（唯一入口）**：工具条加 ⟲ / ⟳ 两个图标按钮，`disabled` 由 `canUndo/canRedo` 驱动，`title` = 「撤销 / 重做」。
  ⚠️ **这两个按钮绝不能跟着 `hasData` 一起隐藏**（2026-09-07 修）：清空表格/删完列后 `hasData=false`，
  若按钮随之消失，"清空"这一步就再也撤不回来了 —— 而 ⟲ 是 spec 规定的**唯一**撤销入口。
  图标用 lucide-react 的 `Undo2`/`Redo2`（全站统一；手写 feather path 比例失真已废弃）。
- ⚠️ **切对话必须 `clearHistory()`**（2026-09-07 补）：快照是整份 `AssistantTableTabs`，
  跨对话复用会把 A 对话的 tabs 写进 B 对话并落盘。挂在 `AgentPanel` 切对话 effect（与 `resetTableWorkspace` 同一处）。
- ❌ **不绑 Ctrl/Cmd+Z 快捷键**（本轮用户裁定："有风险的话可以不做"）。
  **风险所在**：画布已有全局 `useCanvasShortcuts`（Ctrl+Z = 画布 undo），单元格 textarea 还有浏览器原生 undo —— 三方抢同一个键，一旦误伤画布撤销，是**静默且难定位**的回归。故本期只给按钮，零冲突零风险。
- **若将来仍要快捷键**（本期不实现，方案留档）：需**先给画布快捷键补"可让位"的契约与测试**，再按焦点域分流 ——
  1. 焦点在单元格 textarea 编辑中 → 浏览器原生（不拦）；
  2. 焦点在表格面板内（非编辑态）→ 表格 undo（`stopPropagation` + 抢先注册）；
  3. 其余 → 画布 undo 行为完全不变。

### 3.5 行尾 ⋯ 三点菜单（替代右侧 5 连图标）

- `TableGrid` 每行行尾由「复制/上移/下移/删除/发送」5 个图标 → **一个 `⋯`（三点竖）按钮**，点击弹菜单（对齐 `agent-pop` 浮层样式：`surface-1 + edge + radius 12`）。
- 菜单项（顺序）：上移 / 下移 / 插入空行（下方）/ 复制行到…（跨表，见 3.6）/ 删除行 / 发送到画布（danger 项仅"删除行"标红）。
  **2026-09-07 用户裁定**：删掉「复制到下一行」—— 与「复制行到…」是同一功能的两个入口（后者更强、可跨表），只留一个；
  「发送到画布去生图」→「发送到画布」（原文案过长）。
- ❌ 不做右键菜单（用户明确）；❌ 不做行首拖拽排序（保留上移/下移作为唯一排序手段）。
- 操作列宽度可由 88px 收到 ~32px，给内容列让宽（顺带缓解"窄栏挤"的老问题）。

### 3.6 批量复制 / 批量删除 / 跨表复制 / 区域选择

**选区模型（新增 `useTableSelection.ts`）**

```ts
/** 单元格区域：起点 + 终点（rowId/colId 锚定，不用 index —— 增删行不串） */
export interface CellRange { r0: string; c0: string; r1: string; c1: string }
```
- 已有能力保留：Cmd/Ctrl + 点行 = 行多选（`selectedRowIds`，本期不动）。
- 新增**区域选择**：点某格 → 起点；**Shift + 点另一格** → 扩成矩形选区（渲染淡蓝底 + 边框）。
- ❌ **不做鼠标拖选**（用户底线：宁可少功能不出 bug；拖选与 textarea/滚动冲突面大，历史已否决拖拽类方案）。
- Esc / 点空白 = 取消选区。

**操作**

| 动作 | 入口 | 行为 |
|---|---|---|
| 复制 | 行多选或选区 + `Ctrl/Cmd+C`（面板内焦点） | 写入**内部剪贴板**（运行态 `clipboard: { kind:'rows'│'range', payload }`，不依赖系统剪贴板权限） |
| 粘贴 | `Ctrl/Cmd+V`（面板内焦点） | 按当前活动 tab + 锚点行/列粘贴；行复制 → 插到锚点行之后；区域复制 → 从锚点格按矩形铺开（越界部分按现有列数裁剪，不静默扩列） |
| 批量删除 | 选中多行 + `Delete/Backspace` 或行尾 ⋯ 菜单「删除选中行」 | 删 N 行，`selectedRowIds` 同步清理，一次入撤销栈 |
| **跨表复制** | 行尾 ⋯ →「复制行到…」 | 弹**同款目标表下拉**（复用 3.3 的下拉组件：所有 tab + 「＋ 新建标签页」）→ 复制选中行到目标表**末尾**（列按名归一命中，未命中列留空，绝不静默丢弃值） |

> 跨表复制**只做「复制行到目标表」**（一次性动作），不做"AI 跨表读写"（B 类否决）。

### 3.7 落画布带表名

- `rowToText(sb, row, globalStyle, tableName?)`：新增可选第 4 参，传了就在文本首行加 **`表名：xxx`**（✅ 2026-09-07 定稿格式）。
- **仅落画布路径传**（`AssistantTablePanel` 的「发送到画布」/ 行尾 ⋯「发送到画布」）；AI 注入路径**不传**（避免污染模型上下文）。

### 3.8 发给 AI 的唯一信号 = 选中的那张表

> **二次裁定（2026-09-07）**：取消「点亮/高亮开关」与「tab 多选」。
> **选中态 = 当前表 = 发给 AI 的那张表**，三者同一，信号只有一个 —— `activeTabId`。

**语义**

- 每次 send，**只把当前选中表的完整现状**（表名 + 列名 + globalStyle + 各行带行号可读文本）注入 AI。
- 其余 tab 对 AI **完全不可见**（不注入任何内容，连表名都不给）。想让 AI 看哪张，就切到哪张。
- 天然单选 → 从源头杜绝"多表信息过载把 AI 弄乱"（这正是本机制的初衷）。

**边界**

- `activeTabId` **落盘**随会话记忆（切对话回来仍在原来那张）；切表按 §2 清协作现场。
- 与「写入到哪个标签页」下拉（§3.3）**互不干扰**：下拉列出**所有** tab —— 用户主动选择写入 = 显式授权，与"当前选中哪张"无关。
- 与 `read_table` 工具：**不改签名**，仍只读当前选中表（B 类"AI 跨表读"已否决）。
- 与跨表复制（§3.6）：纯本地动作，与发给 AI 无关。
- ❌ 不做"多表同时注入"、**不做注入行数降级摘要** —— 一次就一张表，沿用既有 `buildTableSnapshotText` 行为，不新增机制。

---

## 4. AI 上下文注入变更（`AgentPanel.tsx`）

注入内容 = **当前选中表（当前 tab）的完整现状**（§3.8），其余 tab 完全不注入。

```
【表格工作区 · 当前表 = 表1（12 行）】
列：景别 / 画面描述 / 台词
全局风格：沙丘风
1. 景别=中景；画面描述=…；台词=…
…
【选中行】…（沿用 buildRefineRowsUser，永远来自当前表）
```

- 注入形态与既有 `buildTableSnapshotText(sb, globalStyle)` **几乎一致**，只需**多带一个表名**（首行写明「当前表 = <name>」）。
- 无多余机制：不加表列表、不做多表降级、不做"未注入表名单"（一次只发一张表，从源头压信息量 —— 用户核心诉求）。
- `buildTableSnapshotText` 加可选表名前缀（或由调用方拼）；不新增多表注入纯函数。
- `read_table` 工具（`useCanvasAgentTools.ts`）：**不动签名、不加 `tabId`**，仍只读当前选中表；仅 description 措辞补"当前标签页"。
- `TABLE_RULES` **本期不改**（PROMPT-DESIGN 已定稿）。

---

## 5. 文件归属与施工顺序

> 纪律：通信走 `eventBus`（EVENTS 登记）/ 提示 `toastStore` / 观测 `logger` / 持久化 `storageAdapter + *Store` / 能力层单一函数；契约常量查 `src/components/base/core/contracts.ts`，禁裸字面量；移动改名走 `scripts/mv-sync-refs.mjs`。**本期不新增存储键、不新增事件**（宽度沿用 `agent_split_width`）。

| 动作 | 文件 | 说明 |
|---|---|---|
| 改造 | `assistantTable/assistantTable.ts` | 新增 tab 模型 + `normalizeAssistantTabs` + `updateTab` + 批量纯函数（`deleteRows` / `copyRows` / `pasteRows` / `copyRowsToTab` / `rangeToTsv`）；`rowToText` 加 `tableName?`；既有行/列函数签名不动 |
| 改造 | `agent/assistantTable/assistantTablePrompt.ts` | `buildTableSnapshotText` 加**当前表名前缀**（多表不新增注入逻辑） |
| 改造 | `agent/assistantTable/tableWorkspaceState.ts` | `preview.targetTabId`、`previewHeight`、`setPreviewTargetTab`、`setPreviewHeight`、切 tab 重置现场；`confirmTablePreview` 写目标表 |
| 改造 | `agent/conversation/conversationAiState.ts` | `get/setCurrentAssistantTable` 语义收窄为活动 tab（签名不变）+ 新增 tabs/tab 级读写 |
| 改造 | `agent/conversation/conversationState.ts` | `ConversationMemory` / `RawMemory` / `emptyMemory` / `normalizeMemory` **成对登记** `assistantTables` |
| 改造 | `agent/assistantTable/AssistantTablePanel.tsx` | 装配 tab 条 + 撤销按钮 + 选区/剪贴板接线（保持薄壳） |
| 改造 | `agent/assistantTable/TableGrid.tsx` | 行尾 ⋯、选区渲染、`colgroup` 调整 |
| 改造 | `panels/AgentPanel.tsx` | 注入内容补当前表名（仍只发当前选中表）；切 tab 后下一轮 send 立即生效 |
| 改造 | `agent/assistantTable/assistant-table.css` | tab 条、预览 grip、选区、撤销按钮 |
| 改造 | `agent/canvas/useCanvasAgentTools.ts` | 仅措辞（read_table 不改签名） |
| 新建 | `agent/assistantTable/TableTabsBar.tsx` | 标签条（**选中态样式** / 重命名 / × / ⋯ / 行数 / 横向滚动 / **pointer 拖拽排序**） |
| 新建 | `agent/assistantTable/useTabDragSort.ts` | tab 拖拽排序 hook（pointer 手写、**禁 HTML5 DnD**，起拖阈值 4px，松手才 commit） |
| 新建 | `agent/assistantTable/RowOpsMenu.tsx` | 行尾 ⋯ 菜单（含"复制行到…"） |
| 新建 | `agent/assistantTable/useTableSelection.ts` | 行多选（已有）+ 区域选区 + 内部剪贴板（2026-09-07 已落地） |
| 新建 | `agent/assistantTable/TabTargetMenu.tsx` | 目标表下拉**唯一实现**（预览卡「写入到」+ 行尾「复制到」共用；含「＋ 新建标签页」+ 点外部关闭。2026-09-07 抽，原先两处各写一份） |
| 新建 | `agent/assistantTable/tableHistory.ts` + `useTableHistory.ts` | 撤销栈（纯函数 + hook） |
| 新建 | `agent/assistantTable/usePreviewResize.ts` | 预览卡高度拖拽（同 `useColumnResize` 范式） |

**施工顺序（每步可跑可验）**
1. 模型层：tab 数据结构 + `normalizeAssistantTabs` + `updateTab` + 单测（老数据水合不丢）。
2. 会话层：`assistantTables` 登记 + tabs/tab 级读写 + per-tab 隔离单测。
3. 运行态：`targetTabId` / `previewHeight` / 切 tab 重置 + `confirmTablePreview` 写目标表 + 单测。
4. UI：`TableTabsBar`（**选中态** + **拖拽排序**）+ 切 tab 隔离（人工回归）。
5. 预览：目标表下拉 + 拖动拉高。
6. 撤销/重做（**仅工具条按钮**，不碰快捷键）。
7. 行尾 ⋯ 菜单 + 批量/区域/跨表复制。
8. 落画布带表名 + 注入补当前表名（仍是单表注入）。

---

## 6. 验收标准（可断言，逐条能红）

1. **老数据水合**：`memory.assistantTable` 有列/行 + `global_contract` 有风格 → 归一为 1 个 tab，列/行/风格全不丢。
2. **隔离**：表1 写"沙丘"、表2 留空 → 来回切换互不污染；表1 改行不影响表2。
3. **切 tab 清现场**：切 tab 后 `selectedRowIds=[]`、`preview=null`、`handledMessageId=null`。
4. **预览目标 = 确认目标**：切到表2 后确认 → 表2 变化、表1 不变；`{ok:true, mode}` 返回正确。
5. **目标为空表 → replace 建表**；AI 行带 `_rowIndex` 时按行号定位；切换目标后 `selectedRowIds` 不参与定位。
6. **预览=确认仍成立**：预览渲染 rows == 确认后目标表 rows（任意场景，含跨表）。
7. **撤销**：改格后点 ⟲ 回退；删行 → 撤销后行回来且 **rowId 不变**；AI 确认写回 → 撤销回到写回前；超过 50 步丢弃最旧；⟳ 可重做前进。
8. **不抢快捷键**：表格面板内 / 画布上按 Ctrl+Z 的行为与改造前**完全一致**（仍是画布 undo、单元格内仍是浏览器原生），零回归；撤销只能经工具条按钮触发。
9. **批量**：多选 3 行删除 → 只剩 N-3；跨表复制行到表2 末尾，未命中列留空不丢值；区域复制粘贴 TSV 后行列对齐。
10. **预览高度**：拖到上下限被 clamp；表格区始终 ≥160px 不被压没；刷新后回落默认值（不记忆）。
11. **落画布**：文本首行含表名。
12. **选中即授权**：选中表1 时发送 → 注入文本含「当前表 = 表1」与表1 全部内容，且**不含任何其它表**的内容/名称；切到表2 再发 → 换成表2。
13. **tab 拖拽排序**：拖「表3」到「表1」前 → 顺序变 3,1,2 且落盘；拖拽中**不写 store**（松手才 commit，中途 Esc/取消不落盘）；位移 <4px 判定为点击切 tab；⟲ 可撤销顺序变更；拖拽不影响各表数据。
14. **选中态持久化**：`activeTabId` 随会话落盘，切对话再回来仍在原来那张表。

**验证命令**：`npm run type-check` + `npx vitest run tests/unit/assistantTable.test.ts tests/unit/tableWorkspaceState.test.ts tests/unit/assistantTable.memory.test.ts tests/unit/AgentPanel.test.tsx`；提交前 `npm test` + `npm run build`。纯前端改动，不涉及 `cd localTool && npm test`。

---

## 7. 明确不做（边界，写下来防回潮）

- **行 / 列拖拽排序**、行首拖拽换位、鼠标拖选区域（防 bug，用户底线）。⚠️ **例外：tab 条拖拽排序要做**（§3.1）—— 它是简单元素、无 textarea/滚动冲突，风险远低于行拖拽。
- 右键菜单（改行尾 ⋯）。
- 隐藏列 / 冻结首列 / 双击列宽自适应（非必备）。
- 表内搜索 / 筛选 / 排序；导入导出 CSV/JSON。
- 批量生成、AI 跨表读写（`read_table(tabId)`）、AI 写回独立回滚、预览 diff 开关（B 类，多余）。
- **独立「点亮/高亮」开关、tab 多选、多表同时注入 AI** —— 已二次裁定取消：状态只留一个「选中态」（选中 = 当前 = 发给 AI），一次只发一张表。将来确需"多表对照给 AI"再引入 `aiOn` 开关（方案留档）。
- 表模板、跨对话复用表；tab 跨对话全局共享（表仍**随对话**，沿用定稿决策 15）。
- 预览高度落盘记忆、面板最大化、关面板未处理预览提示（D 类）。
- 单元格限高 + 格内滚动（历史已否决：双重滚动难受）。
- 不动 `TABLE_RULES` / 不动 IMPLEMENTATION 的契约 C1~C9。

---

## 8. 待确认（2026-09-07 已全部拍板 ✅）

1. ✅ **多标签页 + 每对话一套、随对话隔离**（不推翻定稿决策 15）；`globalStyle` per-tab；**状态只留「选中态」** —— 选中 = 当前 = 发给 AI（点亮开关 / tab 多选已取消）；tab 归属非全局共享。
2. ✅ **预览「写入到」下拉**：末尾**含「＋ 新建标签页」选项**。
3. ✅ **确认写回后**：**自动切到目标 tab + toast「已写入「表X」」**。
4. ✅ **tab 操作入口**：**双击重命名（快捷）+ tab 条 `⋯` 菜单放「复制为新表 / 重命名 / 关闭」**，两者并存。
5. ✅ **落画布表名格式**：文本首行 **`表名：xxx`**。
6. **tab 拖拽自动横向滚动**（§3.1）：可选，按可行性补；实现佐证不足可省（非必需）。

---

## 9. 已知风险（施工时注意）

- ~~**Ctrl+Z 三方冲突**（画布 / 表格 / 单元格原生）~~ → **已规避**：本期撤销只走工具条按钮、不绑快捷键（§3.4）。将来若要做快捷键，必须先给画布快捷键补"可让位"契约 + 测试，否则不动。
- **`global_contract` 迁移**：写入路径从 `setCurrentGlobalContract` 改到 tab 前，必须确认无其它读取方（剧本盒/生成链路）依赖 `unified_style_prompt`，否则静默换源。
- **体积**：多 tab 全量随会话 KV 落盘，体积放大（已有 `volumePolicy` 兜底）；若单 tab 很大，后续再评估"只落活动 tab + 其余懒加载"（本期不做）。
- **跨表复制的列归一**：必须复用 `buildPreviewResult` 里那套 `normalizeLabel` 归一匹配，禁止新写一套匹配逻辑（防 A-005 类静默丢值回潮）。
