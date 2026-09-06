# AI 助手表格 —— 表格本体底层优化蓝图（数据 / 渲染 / 交互 / 样式地基）

> **状态：蓝图（待执行，2026-09-06）**。本文盘点「表格**本身**」——数据模型、运行态、渲染组件、交互、样式——的地基层现状与优化路线，供落地为一张干净地基，便于后续任意加功能。
> 与既有 spec 的关系：`AI-ASSISTANT-TABLE-IMPLEMENTATION.md`（AI 逻辑层：预览=确认、buildPreviewResult 单源推导）**已定稿且不属本次范围**；本蓝图只动表格 UI/交互/样式/组件结构，**不触碰已定契约 C1~C9、不碰 AI 注入/探测**。
> 原则：样式用户已满意，**不改观感**，只做「让代码配得上观感」的重构；每步都能跑通、可回退。
> 证据均为 file:line（2026-09-06 快照），改前先读目标文件当前文本。

---

## 0. 一句话结论

表格的**数据模型层（assistantTable.ts 纯函数）已相当干净**，真正的底层病灶集中在 **UI 层**：

1. `AssistantTablePanel.tsx` 是 **777 行的「上帝组件」**，数据订阅、编辑态、列宽策略 + 拖拽（命令式绕 React 直改 DOM）、行/列操作、剪贴板、渲染、图标内联全塞一处 → 加任何功能都在同一函数里继续堆。
2. **CSS 与组件命名树脱钩**：表格渲染根是 `.sb`，但样式全部挂 `.tw-panel .sb …`（靠 `TableWorkspacePanel` 的祖先 `.tw-panel` 才生效），类名沿袭历史缩写（`.sb/.sbt/.gs/.pv`），且样式文件归属 `agent-panel.css` 而非表格模块 → 看不懂、不敢删、改名即断。
3. **图标 / 重复逻辑**：十数个 16×16 inline SVG 重复书写、行操作图标同一套 path 拷多份、`edits` 用 `"${rowId}:${colId}"` 字符串拼 key。
4. 少量**模型层遗留死码**：`normalizeAssistantTable` 里的 `ids`/`void ids;`（IMPLEMENTATION 标 C-002 删，实际仍在）。

地基打牢 = 三层动作：**① 拆组件（每层单一职责）→ ② 样式归位 + 语义化命名（CSS 结构对齐组件树）→ ③ 收尾清理（死码 / 图标统一 / 行内逻辑抽取）**。样式观感全程不动。

---

## 1. 现状分层盘点

### 1.1 文件地图

| 文件 | 职责 | 当前健康度 | 主要病灶 |
|---|---|---|---|
| `src/components/agent/assistantTable/assistantTable.ts` | 数据模型 + 归一化 + 解析 + 行↔JSON 纯函数 | ★★★☆ | `ids` 死变量(113/130)；`sb` 参数命名沿袭历史；少量职责耦合 |
| `.../tableWorkspaceState.ts` | 共享运行态（open/width/选中/预览/游标） | ★★★☆ | 把「面板 UI 开关」与「AI 协作预览」混一个 store |
| `.../AssistantTablePanel.tsx` | 左栏表格 UI 薄壳（**本应只渲染**） | ★★☆☆ | **上帝组件**（777 行），一切全塞 |
| `.../AssistantTablePreviewCard.tsx` | 预览「待确认卡」（仅渲染+回调） | ★★★☆ | 相对干净，可留 |
| `.../assistantTablePrompt.ts` | 改行 user 拼装纯函数 | ★★★★ | 干净（AI 层） |
| `src/components/panels/TableWorkspacePanel.tsx` | 表格面板容器壳 + 装配 | ★★★☆ | 与 AssistantTablePanel 职责边界靠 props 纠缠 |
| `.../agent-panel.css` | 表格样式（1139~1749 行） | ★★☆☆ | 命名历史缩写、归属错误文件、选择器依赖祖先 `.tw-panel` |

### 1.2 渲染树 vs 命名树（核心脱节）

```
组件树                              CSS 归属            CSS 生效依赖
TableWorkspacePanel(.tw-panel)  ← .tw-panel(外壳)   ✓ 自持
 └─ AssistantTablePanel(.sb)    ← .sb/.sb-head…     ✗ 靠祖先 .tw-panel 才命中
     ├─ .sb-head > .gs(全局风格) ← .tw-panel .gs      ✗ 同上
     ├─ table.sbt                ← .tw-panel .sbt    ✗
     └─ AssistantTablePreviewCard(.pv)              ← .tw-panel .pv（嵌套在组件内）
```

关键矛盾：**渲染 `.sb` 的组件叫 `AssistantTablePanel`，但它的样式规则全写成 `.tw-panel .sb …`（`.tw-panel` 是它的父级容器 `TableWorkspacePanel`）**。一旦把 `AssistantTablePanel` 挪出 `.tw-panel`、或删除某层，样式连锁失效；反之在样式里想删一段必须脑补「这段规则实际作用在哪个组件」。

---

## 2. 病灶清单（按层，含证据）

### 2.1 UI 层 · 上帝组件 `AssistantTablePanel.tsx`

一个组件文件内并存了 5 类互不相同的职责：

| 职责 | 证据 | 问题 |
|---|---|---|
| 会话数据订阅 + 派生 | 100~128 | 与 TableWorkspacePanel 重复订阅同一 store（可抽 hook） |
| 本地编辑态 | 131~133（`edits`/`colRenameDraft`/`styleDraft`） | 三份散落 state，`edits` key 用 `"${rowId}:${colId}"` 字符串拼接，改列/删列会留孤儿 key |
| 列宽策略 + 拖拽 | 409~495；`colWidthMapRef`/`colSigRef`/`colElsRef`/`resizingRef`/`tableDataRef` | **命令式绕 React**：拖拽中 `colElsRef.current[ci].style.width` 直改 DOM、`onResizeMove/onResizeUp` 靠 window 监听；5 个 ref + 2 个 useCallback 才能实现一个「列宽记忆」，逻辑难以单测、状态游离组件外 |
| 行/列/风格操作 | handlePaste/Copy/Clear、`ops()`、col 增删改名 | 每次 render 重建闭包；逻辑与 JSX 混排 |
| 渲染 + 图标 | 全文件数十个 inline `<svg>` | 十多个 16×16 图标重复内联，同一 `feather` path 拷 N 份 |

附加性能/健壮隐患：
- **每格一个 `<textarea>` 自动撑高**（`CellEditor` 780~816，`el.scrollHeight` hack）——N 行 × M 列 = N·M 个 textarea 全部常驻 DOM 并各自跑 effect 量高，行数一多即卡；无虚拟化 / 分页。
- `cells(row)`（368）/`ops(row)`（257）在 render 中反复重建，无 memo。
- 单元格值 = 真正的列数可能上百，但整表一次性渲染所有行。

### 2.2 样式层 · 命名与归属

| 病灶 | 证据 | 说明 |
|---|---|---|
| 类名沿袭历史缩写，无语义 | `.sb`/`.sb-head`/`.sb-bar`/`.sb-body`/`.sb-empty`/`.sbt`/`.gs`/`.gs-v`/`.pv`/`.pv-hd`… | `sb`≈scriptBox 遗留，`gs`=globalStyle、`pv`=preview 缩写；代码里注释还得解释「gs=全局风格」才看得懂 |
| 样式归属错误文件 | 全部在 `agent-panel.css` | 表格组件在 `assistantTable/` 目录，样式却住在「AI 助手面板」的 css——多模块共用一文件，删改互相影响 |
| 选择器依赖祖先 | 每条都是 `.tw-panel .sb …` | 组件树与命名树脱节（见 1.2），组件无法独立复用 |
| 行内排版注释冗长 | 1377、1405~1417 等多处 | 「解释为何这么写」的注释是好资产，但量多已盖过可读性（保留决策、清过程） |
| CSS 变量复用良好 | 全用 `rgb(var(--mao-*))` | ✅ 值得保留（语义令牌单一来源） |

### 2.3 模型层 · 少量遗留

| 病灶 | 证据 | 说明 |
|---|---|---|
| `ids` 死变量 | `assistantTable.ts:113` + `:130 void ids;` | IMPLEMENTATION §2.5 C-002 已标「删」，实际还在 |
| `sb` 入参命名 | 全文件 | 沿袭 scriptBox 时代，读代码者需先理解 sb=表格 |
| `estimateColumnWidth` 缺首列预留 | — | 估算列宽不含行号列/操作列，纯函数层 OK，UI 需另留 |

> ⚠️ 模型层纯函数是**单测主力**（tests/unit/assistantTable.test.ts 覆盖全），重构时保持导出名与行为，测试即护栏。改名 `sb`→`table` 可用 `rename-symbol` 且不动导出即可，优先级放最后。

---

## 3. 优化目标态（分层地基）

```
assistantTable/                       ← 表格域自洽模块（样式也归这里）
 ├─ assistantTable.ts                 // 纯数据模型（不动业务契约）
 ├─ tableWorkspaceState.ts            // 共享运行态（拆分：面板态 vs 协作态）
 ├─ AssistantTablePanel.tsx           // 收敛为「薄壳 + 组合子组件」
 ├─ cells/TableGrid.tsx               // 表格渲染：表头/行/单元格（纯 presentational）
 ├─ cells/CellEditor.tsx              // 单格编辑（从 Panel 抽出）
 ├─ interactions/useColumnResize.ts   // 列宽拖拽 hook（逻辑可从组件剥离、可单测）
 ├─ interactions/useTableDrafts.ts    // 本地编辑态管理
 ├─ icons.tsx                         // 统一表格图标表
 ├─ AssistantTablePreviewCard.tsx     // 预览卡（不变）
 └─ assistant-table.css               // 样式从 agent-panel.css 迁出（只迁表格规则）
```

各层目标（「现 → 后」）：

| 层 | 现在 | 目标态 | 加功能的受益 |
|---|---|---|---|
| 渲染 | 一函数渲全表 | `TableGrid` 纯渲染 + 子组件拆分 | 加「行拖拽排序/勾选列/冻结首行」只改对应子组件 |
| 列宽 | ref 直改 DOM + window 监听 | `useColumnResize` hook（状态→commit 回写模型） | 列宽逻辑可测、可加「双击自适应」「min/max 提示」 |
| 编辑态 | `"row:col"` 串 + 3 份 state | `useTableDrafts` 统一 draft 管理 | 加「整行编辑/复制撤销」从 state 层入手 |
| 图标 | inline 重复 | `icons.tsx` 统一（面 name→svg） | 改图标只动一处 |
| 样式 | 历史缩写 + 借父祖先 | 语义命名 + 组件自持 css | 可读、可删、组件可独立复用 |
| 模型 | 遗留死码 | 清理 +（可选）`sb` 改名 | 读模型层不再有认知负担 |

---

## 4. 执行路线（建议分 4 阶段，每阶段可独立提交）

> 目标读者是执行 AI：**每阶段做完整（含 build + 单测）再进下一阶段**；纯前端改动，不涉 localTool/存储键/事件契约。
> 全程**不动样式观感**：只挪 CSS 位置与改名，不改任何 px/色值/间距。

### 阶段 A · 样式归位 + 语义命名（纯 CSS 迁移，先做，风险最低、即时提升可维护性）

**目标**：表格样式从 `agent-panel.css` 迁出到表格域自有 css，类名语义化，选择器不再依赖祖先 `.tw-panel`。

做法（谨慎，改名易断，建议用「命名映射表」逐步替换，勿一次性 `find/replace` 裸类名）：
1. 新建 `assistantTable/assistant-table.css`，把 `agent-panel.css:1137~1749` 表格规则迁入（**逐段核对无遗漏**，只迁 `.tw-panel` 内的表格规则；其余对话区规则留在原文件）。
2. 在组件根自持类名：`AssistantTablePanel` 渲染根 `.sb` 改为语义化根（如 `.atw-table`），并把每条祖先选择器改写成「类名自带前缀」，使 CSS 与组件树一一对应、删组件不伤样式。
3. 历史缩写改名（用 `rename-symbol` 对类名做不了，需 CSS+TSX 双侧同步；建议逐个类批量替换 + `npm run build` 验证）：
   - `.sb` → `.atw`（Assistant Table Workspace）
   - `.sbt` → `.atw-grid`，`.sb-head`→`.atw-head`，`.sb-bar`→`.atw-toolbar`，`.sb-body`→`.atw-body`，`.sb-empty`→`.atw-empty`
   - `.gs`/`.gs-v`/`.gs-l` → `.atw-style` / `.atw-style-input` / `.atw-style-label`
   - `.pv`/`.pv-hd`/`.pv-body`/`.pv-ft` → `.atw-pv*`（预览卡同属表格域）
   - `.tw-op` → `.atw-icobtn`（icon 按钮）——`tw` 也含糊
4. 删除/改写冗长「过程性」注释，**保留所有讲「为何这么设计」的决策注释**（红线：只追加不删资产）。

验收：`npm run build` 通过；肉眼对比样式无回归；`agent-panel.css` 不再含表格规则、`assistant-table.css` 不含对话区规则。

### 阶段 B · 拆分上帝组件（UI 结构性重构，核心工程）

**目标**：`AssistantTablePanel.tsx` 从 777 行降到「薄壳 + 组合」，把 5 类职责各自独立。

1. **纯渲染抽离** → `TableGrid.tsx`：表格 body（表头吸顶/行/格/行号/操作列）只做 presentational，props 进 `columns/rows/selectedRowIds/colWidths/callbacks`；`cells()`/`ops()` 随迁，图标引用集中表。
2. **单元格编辑抽离** → 现有 `CellEditor`（780 行起）提为独立文件，编辑态提交逻辑收拢。
3. **列宽 hook** → `useColumnResize.ts`：把 `colElsRef/resizingRef/onResizeMove/onResizeUp/startResize`（442~495）的命令式 DOM 操纵抽成可复用 hook，返回 `{ startResize, colWidths }`；保留「拖拽中直改 DOM 不重渲、松手才 commit」的性能设计（注释写明），但状态收进 hook 便于未来加「双击自适应」。
4. **本地编辑态 hook** → `useTableDrafts.ts`：`edits`/`colRenameDraft`/`styleDraft` 收拢，key 语义化（`edits` 用 `row:col` 串可改为结构化对象）。
5. **图标集中** → `icons.tsx`：收集全组件 inline `<svg>`，抽成 `<Icon name="copy" />` 式小表（data name → path），消灭重复 path。

验收：单测全绿（UI 层改动多为纯搬移）；`npm run build` 过；交互逐项人工回归（粘贴/改格/加删行列/拖列宽/选中多行/预览卡确认取消）。

### 阶段 C · 运行态与数据订阅收口（状态治理）

**目标**：`tableWorkspaceState` 与订阅逻辑职责清晰、可被后续功能安全扩展。

1. **运行态拆分（保守）**：把 `tableWorkspaceState.ts` 的「面板开合/宽度」（纯 UI）与「选中/预览/游标」（AI 协作）是否拆两份 store 需权衡——若未来加「无 AI 的纯本地多表」则拆，否则保持一份即可。**建议先不做破坏性拆 store**，仅整理字段注释与订阅面（TableWorkspacePanel 与 AssistantTablePanel 重复订阅可抽 `useActiveAssistantTable()` hook）。
2. 组件直读 store 的 select 收进 hook（`useActiveAssistantTable` 返回归一表 + 风格 + 原子更新），消除 Panel 内 100~128 的散落订阅逻辑。
3. 核对 `onSendToCanvas`/`callTool('create_node')` 属 AI 工具接线，属 IMPLEMENTATION 范围，本次不动。

### 阶段 D · 收尾清理（低风险小改）

1. **删模型层死码**：`assistantTable.ts:113` `ids`、`:130 void ids;` 删除（IMPLEMENTATION C-002）。
2. **（可选，低优先）`sb`→`table` 语义化**：`rename-symbol` 仅改参数名、不动导出、不碰对外契约；`estimateColumnWidth` 参数同步。若风险判断高于收益可跳过，写注释说明 `sb=table` 即可。
3. 审计 `assistantTable.ts` 顶层注释与实现是否对齐（文件头 JSDoc 已较详实，补「样式迁移」提及）。

---

## 5. 明确不做（边界）

| 不做项 | 原因 |
|---|---|
| 改任何样式观感（色值/间距/圆角/字体） | 用户已满意，只做配得上的重构 |
| 触碰已定契约 C1~C9（选中意图/预览=确认/buildPreviewResult） | IMPLEMENTATION 已定稿，本次是 UI 底层，不重叠 |
| AI 注入/探测/工具接线（AgentPanel 表格探测、buildRefineRowsUser、callTool） | 属 AI 逻辑层，不在「表格本身」范围 |
| 引入虚拟化/虚拟滚动大改 | 属性能专项，建议本蓝图落地、地基稳定后单独立项评估 |

---

## 6. 验证与回退

- 每阶段收尾：`npm run build` + `npx vitest run tests/unit/assistantTable.test.ts tests/unit/tableWorkspaceState.test.ts`；较大改动再 `npm run test:smoke`。
- **样式迁移是最易无声回归的**：改完肉眼过一遍「空态 / 有表 / 预览卡待确认 / 行选中多选 / 列宽拖拽 / 表头 hover 按钮 / 表体滚动」7 个典型态。
- 任何阶段 diff 大，用 `scripts/mv-sync-refs.mjs`（rename/move）事务式迁移，`--dry` 预览 + 可 `undo`。

---

## 7. 优先级速览

| 优先 | 动作 | 风险 | 收益 |
|---|---|---|---|
| 1 | 阶段 A：样式归位 + 语义命名 | 低（纯 CSS 搬移） | 表格样式可读可删、归属自洽 |
| 2 | 阶段 B：拆上帝组件 | 中（结构性） | 后续加功能改单文件即可 |
| 3 | 阶段 C：运行态/订阅收口 | 中 | 状态面清晰、可安全扩展 |
| 4 | 阶段 D：清死码 / 语义化收尾 | 低 | 模型层零负担 |
