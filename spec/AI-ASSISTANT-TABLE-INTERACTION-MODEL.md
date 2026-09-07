# AI 助手表格 —— 业界对齐交互模型（Interaction Model）契约

> **状态：需求定稿（2026-09-07 用户逐条拍板）**。本文是表格「交互基座」的**唯一真源**——把 Excel / Sheets 业界交互对齐成可执行契约，供一次性从底层落地，避免"个性化功能堆叠 → 将来返工推翻重来"。
> **核心初衷（用户原话）**：从底层对齐业界规范，这样以后扩展功能（方向键移动、右键菜单、@ 高亮、区域编辑…）都只在这个基座上"加几行"，而不是推翻重写。
> 与既有 spec 的关系：
> - `AI-ASSISTANT-TABLE-UI-FOUNDATION.md`（表格本体底层优化蓝图，**待执行**）——管「组件拆分 / 样式归位 / 代码健康度」；本文管「**交互语义与运行态契约**」，二者正交。**建议交互模型先于/并行于 UI-FOUNDATION 阶段 B（拆 CellEditor/TableGrid）落地，避免拆完又改交互再返工。**
> - `AI-ASSISTANT-TABLE-IMPLEMENTATION.md`（AI 逻辑层契约 C1~C9，预览=确认、buildPreviewResult 单源）——**本次不动、不重叠**。交互模型只涉及「用户在表格上怎么点、怎么选中、怎么编辑、怎么复制粘贴」，不碰 AI 注入/探测/写回。
> - 本文只做「**对齐业界 + 交互运行态重构**」，样式观感全程不动。

---

## 0. 为什么必须做（根因：现在是"永远可编辑 textarea"的非业界形态）

当前每个单元格是**永远可编辑的 `<textarea>`**（`CellEditor.tsx`），带来 4 个结构性病灶：

| # | 病灶 | 表现 | 根因 |
|---|---|---|---|
| 1 | **点格即进编辑** | 单击单元格，光标就落入 textarea，无法"只选中整格" | textarea 天然接受焦点/键入；无"选中态 cell"与"编辑态 cell"之分 |
| 2 | **Ctrl+C/V 复制粘不出来** | 焦点在 textarea 里时，`AssistantTablePanel` 快捷键 handler 第 376 行 `if (INPUT||TEXTAREA) return` 直接放行给浏览器原生 → 用户的复制走的是原生 textarea 复制（只复制框内选中文字），不是表格复制；而表格 copy 又写**内存剪贴板**不写系统剪贴板 → "粘到别处没有内容" | textarea 抢键 + 复制目标错误 |
| 3 | **无"当前聚焦单格"态** | 复制/粘贴的对象要么整行、要么矩形选区，**没有"选中一格就复制这格"** | `tableWorkspaceState` 只有 `selectedRowIds`/`range`，无 `focusedCell` |
| 4 | **无法扩展展示类功能** | @ 资产高亮、富文本、只读样式都做不了（textarea 显示不了 HTML） | cell 必须渲染成普通元素（div/span）才能承载富内容 |

**结论**：这不是修 4 个独立 bug，而是**交互基座没摆正**。正确做法是一次性对齐业界模型，从根上消除"永远是 textarea"这一条。

---

## 1. 对齐目标：业界（Excel / Sheets / Notion Table）交互模型

下表钉死我们**采纳**的业界行为（其余业界特性本期不做，见 §0 之外 §7 明确不做）。

### 1.1 核心模型：两种 cell 态

业界表格的每个格子，本质是**两个可切换的形态**：

| | 选中态（cell 常态） | 编辑态 |
|---|---|---|
| 渲染元素 | **普通元素**（`div`/可渲染富文本，默认 `.cell` 样式） | **输入控件**（`<textarea>`，可自动撑高/换行） |
| 获取方式 | **单击**：聚焦该格（设为 `focusedCell`），显示选中高亮 | **双击**：进入编辑，光标落格内可打字 |
| 用途 | 显示文本 + 承载选中 + 复制/粘贴对象 + 方向键导航 | 修改单元格文本 |
| 键盘 | 可接收 Ctrl/Cmd+C/V、方向键、Enter、Delete | 原生文字编辑（Ctrl+C/V 走浏览器原生、Enter 换行、Esc 退出） |
| 提交 | — | **失焦（blur）或 Esc/Enter(可选)** 提交写回，退回选中态 |

**唯一的不可侵犯原则**：**同一时刻整表最多一个格子处于编辑态**（业界亦如此）。编辑态不常驻，无编辑时全部格子都是选中态 cell（可选中、可复制）。

### 1.2 关键区分：单击 = 选中整格，双击 = 编辑（必须实现）

业界（尤其 Excel）的语义：
- **单击 cell**：把该格设为「当前格」（`focusedCell`），可对整个 cell 做复制/删除/格式操作；**不会**把光标放进格子。
- **双击 cell**：进入编辑模式，光标定位进格内文字，此时才能改字。
- 连续两次单击之间若为"慢速双击"不成立（系统自行判双击间隔）。

> ⚠️ **这是当前最大、也最易踩坑的改动**：因为现在的 cell 是"永远 textarea"，点击默认就把光标放进去。要达成业界语义，**非编辑态的 cell 必须不是可聚焦的 textarea**——见 §2 渲染方案。

### 1.3 选中模型：三种选择粒度并存且互斥由"操作位置"决定

业界用一套统一的"当前操作位置"驱动，不搞割裂的开关：

| 粒度 | 表示 | 由谁触发 | 谁消费 |
|---|---|---|---|
| **单格**（本期核心新增） | `focusedCell: {rowId, colId}` | 单击普通格 | 复制当前格、作为粘贴锚点、方向键移动 |
| **行多选** | `selectedRowIds: string[]`（已有） | 点**行号格 #**（Cmd/Ctrl 加选、Shift 区间） | AI 意图信号（不改） |
| **矩形选区** | `range: CellRange`（已有） | Shift + 单击扩选（spec 3.6 保留） | 复制一块区域、批量操作 |

**互斥规则（保持现状 spec §7，不破坏）**：行多选与"普通格单格/矩形选区"仍是两套——点**行号格**才选行，点**普通格**走单格/矩形。新增约束见 §3.2。

### 1.4 复制 / 粘贴（本期必须修通的核心）

对齐业界，复制/粘贴**同时**支持**系统剪贴板**（能进出 Excel/外部）与**表格内部选区语义**：

| 操作 | 业界行为 | 本表实现 |
|---|---|---|
| Ctrl/Cmd+C | 有选区复制选区；无选区复制**当前格** | 复制 `focusedCell` 的**文本**到系统剪贴板；有矩形 `range` 则复制 TSV（可粘进 Excel 成表）；有行多选则复制整行文本（沿用既有内部剪贴板逻辑） |
| Ctrl/Cmd+V | 粘到当前格/选区起点 | 从系统剪贴板读：纯文本 → 覆盖 `focusedCell`；TSV（含 `\t`/换行）→ 从当前格起按矩形铺开（复用 `pasteCells`，越界裁剪不扩列）；行多选 → 沿用既有 `pasteRows` |
| 系统 vs 内存 | Excel 直接用系统剪贴板 | **必须写系统剪贴板**（`navigator.clipboard.writeText` + 兜底 `document.execCommand('copy')`）；同时**保留/更新**表格内部剪贴板供内部 TSV/行粘贴 |

> ⚠️ 当前 bug 的双重根因：① 焦点在 textarea 时 Ctrl+C/V 被短路给原生；② 就算走了表格 copy 也写内存不写系统。业界模型下，**Ctrl+C/V 的接收者是"选中的 cell"（普通元素，不在 textarea 内）** → 不冲突、可自由写系统剪贴板。

### 1.5 键盘导航（本期最小集，为扩展铺轨）

业界方向键移动格是最基础能力。本期**只做最小闭环**，为将来完整铺轨：

| 键 | 行为 |
|---|---|
| `Tab` | 提交当前编辑 → 移到右一列（**业界标配**，现有 Tab 在 textarea 里是"插制表符"，改为"提交并右移"） |
| `Enter`（选中态） | 下移一格（可选，本期可不做，留轨） |
| `Escape`（编辑态） | 取消本次编辑（恢复原值）→ 回选中态 |
| 方向键 `↑↓←→`（选中态） | 移动 `focusedCell`（本期**先不做**，见 §7，但状态结构须支持） |

> 方向键/Delete 等本期不做，但 §3 的状态结构按"将来能加"设计，避免返工。

---

## 2. 渲染方案（改哪个组件、怎么改）

### 2.1 CellEditor 重构：选中态 div ⇄ 编辑态 textarea

`CellEditor.tsx` 从「永远 textarea」改为**双态容器**：

```
CellEditor（每格一个，仍是受控）
 ├─ 默认渲染：选中态 <div class="cell" ...>  ← 显示文本（值来自草稿/backing）
 │    - 无 value 时空态占位（&nbsp; 或空，撑住行高）
 │    - 【预留】将来在此 dangerouslySetInnerHTML 渲染 @ 资产高亮（scriptbox 现成 hlAt/.at）
 │    - 鼠标事件：单击向上抛"聚焦该格"；双击向上抛"进入编辑"
 └─ 编辑态：渲染 <textarea class="cell">     ← 当前 cell 正在编辑时切换
      - 保留现有 grow(自动撑高) / blur 提交 / 草稿 onChange
```

**切换信号（单一事实源）**：编辑态只由**一个全局态**决定——`tableWorkspaceState.editingCell: {rowId, colId} | null`（见 §3.1）。只有 `editingCell === 当前格` 时该格渲染 textarea，其余全是 div。**每格内部不再自持"我在不在编辑"**，杜绝多格同时编辑/状态分叉。

### 2.2 事件契约（TableGrid 单元格 td）

现有 `<td>` 只绑 `onMouseDown`。业界模型下事件分工：

| 事件 | 处理 | 语义 |
|---|---|---|
| `onMouseDown` | 设矩形选区起点/扩展（**保留现状**，Shift 扩选） | 不阻止默认 → 但不让 cell div 抢焦点进入编辑 |
| `onClick`（单） | 设 `focusedCell = {rowId,colId}` + 取消行多选（互斥） | 选中整格 |
| `onDoubleClick` | 设 `editingCell = {rowId,colId}` + 聚焦该 textarea | 进入编辑 |
| `onKeyDown`（td/容器捕获） | Ctrl+C/V、Tab、Esc 等 | 复制/粘贴/导航（见 §3.3） |

> ⚠️ **单击不进入编辑的实现关键**：cell div 必须**不自动接受焦点**或单击不落光标。方案：cell div 设 `tabIndex=-1`（或单击后手动 `focusedCell` 且把焦点放 td/容器上），只有双击才把焦点交给 textarea。**这块最容易做错**——若 div 单击仍把光标塞进去，就又退回"点即编辑"。

### 2.3 草稿 / 列宽 / 撑高 影响面（已核实，多数不用动）

| 机制 | 是否受影响 | 说明 |
|---|---|---|
| 草稿 `useTableDrafts`（每格独立 draft + blur 提交） | ✅ 基本不动 | 与渲染元素无关；编辑态 textarea 仍走它。**新增**：进入编辑时若该格有未提交草稿也显示之 |
| 提交写回 `commitCell` | ✅ 小改 | 编辑态 blur/提交时照旧写回；但"提交时机"从"blur"延到"退出编辑态"（因 cell 常态不再是 textarea，blur 语义要重新定义） |
| 列宽估算 `estimateColumnWidth` / 拖拽 `useColumnResize` | ✅ **完全不动** | 列宽按内容算纯函数，不依赖渲染元素 |
| 撤销栈 / 写回唯一入口 | ✅ 完全不动 | 走既有 `pushHistory` + `setCurrentAssistantTabs` |
| 行高/自动撑高 `grow` | ⚠️ 需适配 | 现状用 textarea `scrollHeight` 撑高；cell div 无 `scrollHeight`。方案：编辑态 textarea 撑高并同步行高，选中态 div 用 CSS `white-space: pre-wrap` + 高度=内容自然高度（div 高度默认随内容），或复用「列宽变 → resizeTick 重算」时把 div 高度也对齐 |

---

## 3. 运行态契约（数据流先定死，防返工）

### 3.1 tableWorkspaceState 新增两个运行态字段

`tableWorkspaceState.ts` 增加（**仅运行态，不落盘**，对齐既有 `range`/`clipboard` 的纯内存定位）：

```ts
/** 当前聚焦的单格（业界"当前格"）；单击格设置，方向键移动的载体；复制/粘贴的默认锚点 */
focusedCell: { rowId: string; colId: string } | null;

/** 当前正在编辑的格（整表唯一）；null = 无格在编辑（全表选中态）。双击格设置，提交/取消/Esc 清空 */
editingCell: { rowId: string; colId: string } | null;
```

配套 setter：
```ts
setTableFocusedCell(cell | null)   // 单击格 / 清空（切 tab、删行删列使格失效时）
setTableEditingCell(cell | null)   // 双击进入 / 提交·取消退出
```

**不变量**：
- `focusedCell`/`editingCell` 恒指向**存在**的行与列（rowId 在 rows、colId 在 columns）；删行/删列/切 tab/切对话 → 同步清空（对齐现有 `range` 的失效清理）。
- `editingCell` 若非空则通常 `=== focusedCell`（业界"编辑的格就是当前格"），但**以 editingCell 为编辑唯一来源**，二者分开存以防将来"编辑某格但聚焦仍在别处"。
- 行多选 `selectedRowIds` 与单格 `focusedCell`：**点普通格时清行多选**（对齐现有"动选区即清行选中"）；点行号格选行时**清 focusedCell/editingCell**。

### 3.2 数据流（读 → 交互 → 写回，单向无旁路）

```
用户单击 td
  → setTableFocusedCell({rowId,colId})          // 只改运行态，不改表数据
  → 清 selectedRowIds（互斥）

用户双击 td
  → setTableEditingCell({rowId,colId})           // 标记该格进编辑
  → 聚焦该格 textarea

用户键入
  → CellEditor onChange → setCellDraft（草稿，不落数据层）   // 复用 useTableDrafts

用户离开编辑（提交/Esc/切格/Tab）
  → commitCell：写回数据层 setCell → commit（内含 pushHistory）
  → setTableEditingCell(null)                     // 退回选中态

用户 Ctrl/Cmd+C（选中态）
  → copyCell/选区 → navigator.clipboard.writeText(文本或TSV)   // 系统剪贴板
  → （同步更新内部 clipboard 供内部 TSV/行粘贴）

用户 Ctrl/Cmd+V（选中态）
  → 读系统剪贴板文本
  → 纯文本 → setCell 覆盖 focusedCell
  → TSV/多行 → pasteCells/pasteRows 从 focusedCell 铺开
  → commit + 入撤销栈

用户 Ctrl/Cmd+Z
  → 不绑（spec 3.4 已裁定：撤销只走工具条 ⟲/⟳；与画布/原生三方抢键）
```

**失败可见**：系统剪贴板读写失败（权限/禁用于非安全上下文）必须 `showToast` 报错、不静默。异步 `navigator.clipboard` 一律 `await` + try/catch 显式提示。

### 3.3 快捷键 handler 重写（修 bug 核心）

现状 `AssistantTablePanel` 快捷键 handler（第 373~408 行）**在 `target` 是 INPUT/TEXTAREA 时直接 return**——这正是 bug①。业界模型下：

- **编辑态 textarea**：Ctrl/Cmd+C/V 走**浏览器原生**（编辑文字），**不拦**（保持现状）——用户在改字时 Ctrl+C 就是复制框内文字，业界也如此。
- **选中态 cell**（焦点不在 textarea，target 是 td/div/panel）：Ctrl/Cmd+C/V 走**表格系统剪贴板复制/粘贴**（§3.2），**拦截默认**。
- 判断标准：`editingCell` 是否为 null。**编辑中（非 null）→ 放行给 textarea 原生；未编辑（null）→ 表格接管复制粘贴。**

> 这比现有"看 target.tagName"更语义化、更稳：不看标签，看**有没有在编辑**。

### 3.4 兼容现有行多选 / 矩形选区（不破坏已定契约）

- 行多选复制（Ctrl+C，选中了行号格）→ 沿用内部剪贴板 `copyRows`（已有）。
- 矩形选区（有 `range`）→ 优先复制选区（`rangeToTsv` 已有）。
- 无选区无行选、但有 `focusedCell` → 复制单格（**本期新增**）。
- 三者优先级：**行多选 > 矩形选区 > focusedCell 单格**（对齐现有 copy 逻辑，只补最后一级）。

---

## 4. 明确本期做 / 不做（边界，先钉死防返工）

### ✅ 本期做（档位 1：最小可用的业界对齐基座）

| # | 项 |
|---|---|
| 1 | cell 双态：选中态渲染普通元素、编辑态渲染 textarea；**单击=聚焦整格、双击=编辑** |
| 2 | `focusedCell` / `editingCell` 运行态 + 不变量 + setter |
| 3 | **系统剪贴板复制/粘贴**修通：单格复制、矩形 TSV 复制、单格/TSV 粘贴覆盖 |
| 4 | Ctrl/Cmd+C/V 改判"是否编辑中"（修 bug①），编辑中放行原生、选中态接管 |
| 5 | 编辑退出（提交/Esc/切格）回选中态 + 提交写回复用既有 commit/撤销 |

### 🚧 本期不做（明确留轨，将来在基座上加，不推翻）

| # | 项 | 将来怎么加（都是"加几行"） |
|---|---|---|
| 1 | **方向键移动格 / Delete 清格 / Tab 右移** | 选中态 td keydown 已接管 → 在 handler 里移动 `focusedCell`；状态结构已支持 |
| 2 | **@ 资产高亮** | cell 选中态已是普通元素 → 直接 `dangerouslySetInnerHTML(hlAt(...))` + scriptbox 现成 `.at` 样式；**本期不做非必选**（用户裁定：非必选项，可不做） |
| 3 | **右键菜单（复制/粘贴/插入行…）** | 仿 RowOpsMenu 挂到选中格；复制/粘贴已走系统剪贴板可直接复用 |
| 4 | **多格批量编辑 / 填充手柄 / 冻结首行等深度 Excel 功能** | 非必备；本基座不阻碍 |
| 5 | 虚拟滚动 / 分页性能专项 | 另立项；与交互正交 |

---

## 5. 文件归属（改动清单）

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/components/agent/assistantTable/tableWorkspaceState.ts` | **改（加字段+setter+失效清理）** | `focusedCell`/`editingCell` 运行态 |
| `src/components/agent/assistantTable/CellEditor.tsx` | **重写为双态** | 选中态 div ⇄ 编辑态 textarea 切换 |
| `src/components/agent/assistantTable/TableGrid.tsx` | **改（td 事件）** | onClick 聚焦 / onDoubleClick 编辑 / onKeyDown |
| `src/components/agent/assistantTable/useTableDrafts.ts` | **小改** | 编辑态进出与草稿对齐 |
| `src/components/agent/assistantTable/AssistantTablePanel.tsx` | **改（快捷键 handler + 装配）** | Ctrl/Cmd+C/V 改判编辑中；接新回调 |
| `src/components/agent/assistantTable/useTableSelection.ts` | **改** | 复制/粘贴补「focusedCell 单格」一级 + 系统剪贴板 |
| `src/components/agent/assistantTable/assistant-table.css` | **小改** | 选中态 cell 显示样式（`.is-focused`/`.is-editing` 高亮态） |
| `tests/unit/*` | **增** | focusedCell/editingCell 不变量、单格复制/TSV 粘贴、快捷键判定 |

---

## 6. 验收要点

- 单击格：**光标不进格**，格显示聚焦高亮（蓝框/底色），不进入编辑。
- 双击格：进入编辑，能打字、失焦/Esc 退出回选中态。
- **任一时刻最多一格在编辑**。
- Ctrl+C（选中格）→ 到系统文本输入框/Excel 能粘出该格文本（**修 bug②**：之前粘不出来）。
- Ctrl+C（矩形选区）→ 粘到 Excel 成表（TSV 生效）。
- Ctrl+V（有格子选中）→ 从外部复制的纯文本覆盖当前格；多行文本按矩形铺开（越界裁剪）。
- 编辑态（在 textarea 内）Ctrl+C/V 仍走浏览器原生文字复制，不串。
- 删行/删列/切 tab/切对话 → focusedCell/editingCell 清空，无悬空引用（防假成功）。
- 原有：行多选发 AI、矩形选区批量、撤销/重做、跨表复制——**全不受影响**（回归）。

---

## 7. 为什么这样能"避免将来返工"（防返工锚点）

- **交互模型单一事实源**：cell 只有"选中态 div / 编辑态 textarea"两个态，由 `editingCell` 一个全局信号驱动 → 不存在"每个 cell 各自判断自己在不在编辑"的状态分叉。加任何"针对选中格"的操作（方向键、右键、格式刷）都只需读 `focusedCell`，加任何"编辑态"逻辑只需处理 `editingCell`。
- **复制粘贴统一走系统剪贴板 + 统一优先级（行 > 选区 > 单格）** → 将来加"复制成 CSV/跨表/跨文档"只扩展序列化函数，不碰事件分发。
- **cell 是普通元素** → 富文本 / @ 高亮 / 徽标 / 只读态未来全部原生可承载，不再被 textarea 锁死。
- **不改**：数据模型、AI 契约 C1~C9、撤销栈、写回入口、列宽估算、矩形选区 TSV 逻辑——全是稳定件。

> 一句话：**这次把"格子怎么被选、怎么被编辑、怎么被复制"这条交互脊椎摆正成业界形状，之后所有表格功能都只是在这个脊椎上长肌肉，不再动骨头。**
