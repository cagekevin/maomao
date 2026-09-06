# 表格工作区拆分为「画布左侧独立面板」—— 交接文档（施工中）

> **状态：`施工中`（数据流契约已于 2026-09-06 定稿，见 §四.5；按 §四施工，勿再推翻）**
> 写于：2026-09-06 · 作者：交接 AI
> 面向：接手把「AI 助手内置表格」改造成「画布左侧独立滑出表格面板」的施工 AI。
> 纪律提醒（改前必读，出自 `CLAUDE.md`）：先读 `spec/CONTEXT.md` 决策地图；改文件必须同步文件头 JSDoc；
> 反直觉改动就地注释；禁止裸存储键/事件名；移动文件走 `node scripts/mv-sync-refs.mjs`；提交前 `npm test` + `npm run build`。

***

## 一、需求原文与已确认决策（三轮澄清定稿，勿再推翻）

**用户原始诉求**（转述）：AI 助手面板里的「表格」目前是和右侧 AI 对话合并在一起（左侧表格 + 右侧对话并排，各占半宽），打开后表格只显示一半、没意义。用户希望：

1. **表格是独立于 AI 助手的东西**：点开「表格」→ 从**画布左侧**独立滑出一个表格面板；关闭 → 整个表格从画布消失（数据保留在存储，重开即恢复）。
2. **不跟 AI 助手合并**：表格和右侧 AI 对话各管各的，视觉与容器分离。
3. **仍要用 AI 生成/改表**：打开左侧表格时，右侧 AI 助手对话进入「表格协作」状态 —— 发消息注入表格上下文（表格列 + 全局风格 + 当前选中行），AI 返回的表格 JSON → 在**左侧表格面板内**生成待确认预览，确认才写回正式表格。
4. 已澄清（表单确认）：表格形态 = 「画布左侧独立滑出面板」；AI 改表方式 = 「仍用右侧 AI 助手，表格独立在左」。
5. 前置两轮已定并落地的交互（见 §二）必须保留，不得回退。

***

## 二、【已落地 · 本会话完成，保留勿回退】

以下改动**已完成并通过 type-check + build + 相关单测**，是后续拆分的基础，施工时不能删：

1. **表格预览「处理态」持久化**（刷新后不再把已确认的历史表格消息重弹成待确认预览）：

   - `src/components/agent/conversation/conversationAiState.ts`：新增 `markMessageTableResolved(messageId, 'confirmed'|'cancelled')`，把处理态写到**该条 assistant 消息**的 `tableResolved` 字段并随会话落盘。

   - `conversationStore.ts` re-export；`useAgentChat.ts` 透传给 UI（return 新增 `markMessageTableResolved`）。

   - `AgentPanel.tsx`：确认/取消时调用；探测 effect 命中已带 `tableResolved` 的消息 → 跳过不重弹；消息流里的 pv-done 痕迹改由消息自身 `tableResolved` 驱动渲染（不再依赖内存 `tbPreview`）。

   - 配套：`tests/unit/assistantTable.memory.test.ts` 新增用例；`AgentPanel.test.tsx` / `useAgentChat.hook.test.ts` 的 conversationStore mock 补 `markMessageTableResolved: vi.fn()`。
2. **预览确认卡收进左栏表格下方**（`AssistantTablePanel` 内 `.sb-preview`，与正式表格同宽贴邻）：

   - `AssistantTablePanel.tsx` 新增 props `preview / sending / onConfirmPreview / onCancelPreview`，在 `.sb` 内 `.sb-body`/`.sb-empty` 之后渲染 `AssistantTablePreviewCard`。

   - `AgentPanel.tsx` 删除原先横跨面板宽度的全屏贴底 `.agent-pv-dock`，把 `tablePreviewModel`/确认/取消回调传给左栏表格组件。

   - `agent-panel.css`：`.agent-pv-dock` → `.agent-body .sb-preview`（+ 卡高覆盖 `clamp(150px,28vh,300px)`）。
3. **AI 助手发送按钮 hover 不可见修复**：`.agent-send:hover` 背景变深黑时加 `color:#fff`（`agent-panel.css`）。

> 注意：`git status` 里同时存在的 `useImageHoverActions.tsx`、`scripts/check-*.cjs`、`conversationState.ts` 等改动**不属于**本会话，是历史/他处改动，勿在本文施工时混入或回滚。

***

## 三、现状精确定位（拆分前的代码地图）

### 3.1 表格被嵌在 AgentPanel 内部

`src/components/panels/AgentPanel.tsx`（右侧 AI 抽屉，`absolute top-0 right-0 bottom-0`）在**自身内部**、当 `tableOpen=true` 时把左栏表格 `AssistantTablePanel` 与右侧对话用 `.agent-body` 左右 flex 排开：

- 相关 state（\~L126-148）：`tableOpen`、`selectedRowId`、`tableWidth`、`tableSplitDragging`、`tbPreview`、`tbPreviewHandledRef`。

- 挂载 JSX：`<div className="agent-body"> {tableOpen && <AssistantTablePanel width=... preview=... onConfirmPreview=.../>} {tableOpen && <div className="agent-split" .../>} <div flex-1 ...对话消息区/> </div>`。

- 表格联动逻辑全在 AgentPanel 内：

  - **handleSend 注入**（\~L875-902）：`if (tableOpen)` 时用 `buildTableModeContext(列标签, globalStyle)` + `ASSISTANT_TABLE_FORMAT` + 选中行 `buildRefineRowUser(rowToText(...))` 拼 `finalText` 后走 `send`。

  - **探测 effect**（\~L375-418）：watch 最后一条已结束 assistant 消息 → `tryParseAssistantTableJson(content)` 命中且消息未带 `tableResolved` → `setTbPreview({json,messageId,rowId,resolved:null})`；若 `tableOpenRef.current && looksLikeTableJson` 但解析失败 → toast「解析失败」。

  - **confirm/cancel**（\~L429-473）：`mergeRowFromObj`/`jsonToSb` → `setCurrentAssistantTable`/`setCurrentGlobalContract` + `markMessageTableResolved`。

  - **表格数据派生**（\~L341-362）：`storyboard = normalizeAssistantTable(activeConv.memory.assistantTable)`、`globalStyle`、`selectedRow`、`selCtx`。

- AgentPanel 顶部「表格」图标开关 = 该按钮 `onClick={toggleTable}`。

### 3.2 表格内容组件（可直接复用）

`src/components/agent/assistantTable/AssistantTablePanel.tsx`：

- 已经**自读自写** conversationStore 的 `memory.assistantTable`（经 `getCurrentAssistantTable/setCurrentAssistantTable`）与全局风格，不强依赖 AgentPanel 的 DOM。

- 已含：单元格编辑、行操作、粘贴表格、空态、列名/列增删、`.sb-preview` 待确认预览卡（`AssistantTablePreviewCard`）。

- 依赖外部 props：`width / previewing / onSelectRow / onSendToCanvas / preview / sending / onConfirmPreview / onCancelPreview`。

### 3.3 画布左侧面板可参考外壳

`src/components/base/panels/LeftPanel.tsx`：`fixed left-3 top-... bottom-... z-sidebar` 左侧滑出形态 + `animate-panel-in`（`panel-kit.css`）。但它是「任务/素材」tab 容器，**不直接塞表格**；可借形态、不复用 tab 结构。

### 3.4 数据与工具的唯一入口（改动必须走，禁裸写）

- 表格数据真相源：per-conversation `memory.assistantTable`；读写经 `conversationStore.get/setCurrentAssistantTable`（自动落盘）。**禁绕过**。

- 消息处理态：`markMessageTableResolved`（见 §二.1）。

- 注入/解析纯函数：`assistantTable/assistantTablePrompt.ts`（`buildTableModeContext/ASSISTANT_TABLE_FORMAT/buildRefineRowUser`）、`assistantTable/assistantTable.ts`（`tryParseAssistantTableJson/buildPreviewModel/mergeRowFromObj/jsonToSb/rowToText`）。

- 会话订阅：`conversation/conversationState.ts` 的 `subscribe/getState/setAgentKey` + `useStoreSelector`（跨组件订阅范例见 `AssistantTablePanel.tsx` / `useAgentChat.ts`）。

- 消息唯一发送入口：`useAgentChat` 的 `send`（经 `agent/index.ts` re-export）。**禁新增第二条发送链路**。

***

## 四、目标架构与数据流（State 2 定稿）

### 4.1 一句话

把 `AgentPanel` 内的「表格模式」抽成**两侧共享的一个表格工作区运行态**，表格内容组件改挂到**画布左侧独立滑出面板**；右侧 `AgentPanel` 瘦身为纯对话，但仍按共享态决定「是否注入表格上下文 / 是否把 AI 的表格 JSON 解析成预览」。

### 4.2 共享「表格工作区运行态」（唯一新增枢纽）

- 归属：新文件（建议 `src/components/agent/assistantTable/tableWorkspaceState.ts`），模块级可变 + `subscribe`/`useSyncExternalStore`（仿 `conversationState.ts` 轻量底座，**不落盘、不进 conversationState 的 states 结构**，仅经 conversationStore action 读写表格）。

- 形状（内存运行态）：

  ```
  { open: boolean;                 // 左面板开=表格协作激活
    width: number;                 // 左面板宽(localStorage 记忆)
    selectedRowId: string | null;  // 选中行（AI 注入"改单行"读）
    preview: { json, messageId, rowId, resolved:null } | null; // 待确认预览
    handledMessageId: unknown;     // 探测游标（原 tbPreviewHandledRef）
  }
  ```

- 建议 action：`open/close/toggleTableWorkspace()`、`setTableWorkspaceWidth()`、`setTableWorkspaceRow()`、`acceptTablePreview(json,messageId,rowId)`、`markTableMessageHandled()`、`confirmTablePreview()`、`cancelTablePreview()`、`useTableWorkspace()`。宽度记忆沿用键 `agent_split_width`（避免旧数据丢失）。

- `confirm/cancel` 逻辑抽成模块函数：自读 `getCurrentAssistantTable()/getCurrentGlobalContract()` 完成 merge/整表替换 → `setCurrentAssistantTable/setCurrentGlobalContract` + `markMessageTableResolved` + 清 preview（即把现 AgentPanel `confirmTablePreview` 复制为不依赖 React state 的模块 action，便于单测）。

### 4.3 拆分后两侧职责（单向，无 A↔B 环）

- **右侧 AgentPanel（纯对话）**：

  - 删除表格左右布局与相关本地 state；顶栏「表格」图标改指「打开左侧表格工作区」或移到画布入口。

  - `handleSend` 读共享 `open`+`selectedRowId`+当前表格列/风格 → 决定注入（原 `if(tableOpen)` 分支改为 `if(workspace.open)`）。

  - 探测 effect 保留在消息流侧（右方能拿 messages）：解析到表格 JSON 且共享 `open` 且消息未带 `tableResolved` → `acceptTablePreview(...)`（写共享）；解析失败且 `open` → toast。已处理消息跳过逻辑保留。

- **左侧 TableWorkspacePanel（新组件，画布左侧滑出）**：订阅共享态 + `memory.assistantTable`，承载 `AssistantTablePanel`（把 `preview/previewing/onSelectRow/preview/onConfirmPreview/onCancelPreview` 接到共享态）；渲染关闭按钮。

- **App.tsx**：在画布覆盖层（现 `LeftPanel` 附近）挂载 `TableWorkspacePanel`；提供「表格」开关入口。

- 表格数据仍 per-conversation 存 `memory.assistantTable`，左右都只经唯一入口读写。

### 4.4 施工文件清单

| 动作 | 文件                                                     | 说明                                         |
| -- | ------------------------------------------------------ | ------------------------------------------ |
| 新增 | `assistantTable/tableWorkspaceState.ts`                | 共享运行态 + action（核心，先写 + 单测）                 |
| 新增 | `src/components/panels/TableWorkspacePanel.tsx`        | 左侧滑出外壳，承装 AssistantTablePanel              |
| 修改 | `AgentPanel.tsx`                                       | 去表格布局/本地态，改读共享态（探测/注入/选中行）                 |
| 修改 | `App.tsx`                                              | 挂载左面板 + 入口                                 |
| 修改 | `agent-panel.css`（或新 CSS）                              | 新面板外壳样式；保留已落地 `.sb-preview`                |
| 测试 | `tests/unit/tableWorkspaceState.test.ts`（新增）           | 锁共享态 action：open/preview 写回调用 store / mark |
| 测试 | 既有 `AgentPanel.test.tsx` / `useAgentChat.hook.test.ts` | 若 return/挂载变化需同步 mock                      |

***

## 五、测试与验证要求（提交前必跑）

- 逻辑/共享态抽纯/模块函数 → 补单测（`tests/unit/`），断言须「实现一变必红」。

- UI 组件只补关键交互 + 防崩；不 mock 到失去意义。

- 全量门禁：`npm test`（冒烟+全量单测+回归+工具）+ `npm run build`；较大改动加 `npm run check:health`。

- 已落地功能回归点（不许被拆坏）：
  ① 确认写入表格后刷新 → 不重弹待确认预览、消息流显示「已写入表格」；
  ② AI 返回表格 JSON → 在表格面板出预览，确认写回 / 取消不动；
  ③ 发送按钮 hover 图标可见。

- 改代码过程中禁静默吞错（空 `catch`），异步一律 `await` + 总超时（`withTimeout`），关键链路留可开关 `logger` 埋点。

***

## 四.5 数据流契约（2026-09-06 定稿，施工以本节为准，§六遗留决策已全部收口）

### 4.5.1 共享「表格工作区运行态」—— tableWorkspaceState.ts（唯一新增枢纽）

- 归属：`src/components/agent/assistantTable/tableWorkspaceState.ts`。模块级可变 + `subscribe`/`useSyncExternalStore`
  （仿 `conversationState.ts` 轻量底座）。**不落盘、不进 conversationState 的 states 结构**；仅宽度经既有键
  `agent_split_width`（STORAGE\_KEYS 已登记）记忆，**禁新增存储键 / 事件名 / 会话字段**。

- 运行态形状：

  ```
  {
    open: boolean,                // 表格工作区开合（左面板滑出 = 表格协作激活）
    width: number,                // 左面板宽（px，clamp 360~760，localStorage agent_split_width）
    selectedRowId: string | null, // 选中行（AI 注入「改单行」读）
    preview: { json, messageId, rowId } | null,  // 待确认预览（存 raw JSON，计算模型由消费方派生）
    handledMessageId: unknown,    // 探测游标（原 AgentPanel tbPreviewHandledRef）
  }
  ```

- Action 一览（均为模块函数，禁裸写 store）：

  | action                                       | 语义                                                                                                                                                                                                                  |
  | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `toggleTableWorkspace()`                     | 开合取反；开 = 进入协作（左面板滑出）                                                                                                                                                                                                |
  | `closeTableWorkspace()`                      | 关面板 = 关协作：open=false + 清 selectedRowId/preview/handledMessageId                                                                                                                                                     |
  | `setTableWorkspaceWidth(px)`                 | clamp 360\~760 + 写 `agent_split_width`                                                                                                                                                                              |
  | `setTableWorkspaceRow(id\|null)`             | 选中行（AssistantTablePanel onSelectRow lift 落点）                                                                                                                                                                        |
  | `acceptTablePreview({json,messageId,rowId})` | 探测命中 → 置 preview（待确认）                                                                                                                                                                                               |
  | `markTableMessageHandled(messageId)`         | 探测游标推进（该消息已处理过，不重弹）                                                                                                                                                                                                 |
  | `confirmTablePreview()`                      | 模块化写回：自读 `getCurrentAssistantTable`/`getCurrentGlobalContract` → 单行 `mergeRowFromObj` / 整表 `jsonToSb` → `setCurrentAssistantTable`/`setCurrentGlobalContract` + `markMessageTableResolved('confirmed')` + 清 preview |
  | `cancelTablePreview()`                       | `markMessageTableResolved('cancelled')` + 清 preview                                                                                                                                                                 |
  | `resetTableWorkspace()`                      | 切对话时清 selectedRowId/preview/handledMessageId（保留 open/width）                                                                                                                                                         |
  | `useTableWorkspace()`                        | useSyncExternalStore hook（组件订阅）                                                                                                                                                                                     |
  | `getTableWorkspace()`                        | 同步读（effect 内探测用，不订阅）                                                                                                                                                                                                |

### 4.5.2 两侧职责（单向，无 A↔B 环）

- **右侧 AgentPanel（纯对话瘦身）**：

  - 删表格左右布局与本地态（tableOpen/selectedRowId/tableWidth/tbPreview 等）→ 改读共享态。

  - 「表格」顶栏图标保留在 AI 助手顶栏 = `toggleTableWorkspace()`（入口位置用户裁定）。

  - `handleSend`：`if (getTableWorkspace().open)` 时注入表格上下文（`buildTableModeContext` + `ASSISTANT_TABLE_FORMAT` + 选中行 `buildRefineRowUser`）。

  - 探测 effect 保留在消息流侧（右方有 messages）：watch 最后一条已结束 assistant 消息 → `handledMessageId` 未命中且消息未带 `tableResolved` → `tryParseAssistantTableJson` 命中 → `acceptTablePreview`；解析失败且 open → toast；每次处理后 `markTableMessageHandled`。

  - 切对话 → `resetTableWorkspace()`。

  - mode bar / ctx-chip 读共享 open + selectedRowId。

- **左侧 TableWorkspacePanel（新组件** **`src/components/panels/TableWorkspacePanel.tsx`）**：

  - 【位置定稿 2026-09-06 二轮用户裁定】不浮在画布最左，而是**吸附在 AI 助手面板左缘**（表格在左、对话在右，
    `[表格][对话]` 成一体）；由 AgentPanel 渲染为片段兄弟，锚点 `right: agentPanelWidth`。

  - 订阅 `useTableWorkspace()` + conversationState（`memory.assistantTable` / `sending`）。

  - 承载 AssistantTablePanel：`width=ws.width`、`previewing=!!ws.preview`、`onSelectRow=setTableWorkspaceRow`、
    `preview=buildPreviewModel(storyboard, ws.preview.json, ws.preview.rowId)`、`onConfirmPreview=confirmTablePreview`、`onCancelPreview=cancelTablePreview`。

  - `onSendToCanvas` = `useCanvasAgentTools().callTool('create_node', {type:'textNode', text})`（工具层共享同一注册表，不新增发送链路）。

  - 右缘拖拽改宽 = `setTableWorkspaceWidth()`（吸附边界即表格宽度拖拽条；表格打开时隐藏 agent-grip 避免双手柄冲突）。

  - 无独立头部（贴近旧 UI 左栏表格），关闭入口 = AI 助手顶栏「表格」图标。

- **App.tsx**：不挂表格面板（由 AgentPanel 内部渲染）。**联动收起**（用户裁定，替代「不互斥」）：
  AI 面板收起（open=false）→ AgentPanel effect 调 `closeTableWorkspace()` 一起收。

### 4.5.3 数据流单行道

```
AI JSON 探测(AgentPanel 消息流) → acceptTablePreview → 左面板 .sb-preview 待确认卡
确认/取消(tableWorkspaceState 模块 action) → conversationStore（setCurrentAssistantTable /
  setCurrentGlobalContract / markMessageTableResolved）→ 会话落盘
表格数据真相源仍 = memory.assistantTable（per-conversation），左右两侧只经唯一入口读写；
节点/全局风格纯函数（assistantTable.ts / assistantTablePrompt.ts）零改动复用。
```

### 4.5.4 §六 遗留决策 → 已定稿（勿再问）

| # | 决策项       | 结论                                                                   |
| - | --------- | -------------------------------------------------------------------- |
| 1 | 表格打开入口    | 保留在 AI 助手顶栏「表格」图标（用户裁定；点了 → 表格吸附面板在 AI 面板左缘滑出 + AI 进入协作）             |
| 2 | 与 AI 面板关系 | 【二轮裁定：吸附 + 联动】表格吸附 AI 面板左缘（表格在左、对话在右成一体）；AI 面板收起 → 表格一起收（替代首轮「不互斥」）  |
| 3 | 关面板清协作    | 是：closeTableWorkspace 清 selectedRowId/preview/cursor（§4.5.1）         |
| 4 | 表格宽度可拖    | 是：吸附边界（右缘）拖拽，沿用 `agent_split_width`，范围 360\~760px；表格打开时隐藏 agent-grip |
| 5 | 空态文案      | 保持现状（"还没有表格" / 预览时"等你在右侧确认后写入"）                                      |

***

## 六、遗留待决策点（均已定稿，见 §四.5.4；本节保留历史问题原文供回溯）

1. **「表格」打开入口放哪**：仍在 AI 助手顶栏（点了把左面板打开，同时可收起 AI 助手）？还是放画布顶部 `TopNav` / 左侧竖条？
2. **左右是否互斥**：打开左侧表格时，是否自动关闭右侧 AI 助手抽屉？（用户倾向"各管各的、不合并"，可能希望表格打开时对话抽屉可收起。）
3. **关闭表格面板**是否清空「表格协作」激活态：若表格面板关着但右侧对话还在发「改表」指令（不带表格上下文），AI 不会按表格格式回 → 建议关面板 = 关协作（本文档 §4.2 采用此语义）。
4. 左面板宽度是否仍可拖（建议沿用原 `agent_split_width` 记忆，范围 `~360–760px`）。
5. 表格空态文案/布局在独立面板下是否需要微调（现 `AssistantTablePanel` 空态是竖中空态，放入大面板应没问题，但视觉上可再审视）。

