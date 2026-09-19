# TASK-026 · 域主：`agent`

> **先读 `TASK-022-总纲-域籍判定与交叉验证规程（全批必读）.md`** —— 判据、四件证据、成因代号、输出格式、交叉验证协议全在那里，本文件只给**你的领地**和**本域特有事项**。
> **你只能写这个文件**：`docs/agent 批量任务/TASK-026-域主-agent.md`。**碰任何其他文件视为失败。**
> **本轮只登记，不搬。**（不许 `git mv`、不许改 `src/**`）

> **执行状态：已完成（第一波 · 只登记不搬）** —— 领地实测 62 件全部入表，未改动 `src/**` 任何文件（`git status` 摘要见文末）。

---

## 0. 取证口径（本域统一证据块，主表按代号引用）

| 代号 | 证据原文 |
| --- | --- |
| `[UI-ROOT]` | `src/App.tsx:37` `import AgentPanel from './components/agent/panels/AgentPanel.tsx'`；`src/App.tsx:1619` `<AgentPanel …>`（域唯一装配入口） |
| `[UI-MSG]` | `panels/AgentPanel.tsx:1487` `<AgentMessage>` · `:1517` `<AgentConfirmCard>` · `:155` `<AttachmentCover>` · `:1956` `<TableWorkspacePanel>` |
| `[UI-TBL]` | `panels/TableWorkspacePanel.tsx:92` `<AssistantTablePanel …>`（表格 UI 经此挂到 AI 面板左栏） |
| `[UI-AML]` | `panels/AgentMessage.tsx:196` `<AttachmentCover>` · `:378` `<ChatMarkdown>` |
| `[UI-TOOL]` | `runtime/useAgentChat.ts:2` import + `:372` `const { toolSchemas, callTool } = useCanvasAgentTools();`；`panels/TableWorkspacePanel.tsx:30,39` `const { callTool } = useCanvasAgentTools();` |
| `[D-CONV]` | `conversation/conversationState.ts:54` `export const convKey = agentConversationsKey;` · `:160` `contentSetAsync(key, toStore)` → 会话 KV `agent_conversations_{agentKey}` |
| `[D-TBL]` | `conversation/conversationTypes.ts:19` `assistantTables: unknown;`（表格数据真源 = per-conversation `memory.assistantTables`）；`assistantTable/tableWorkspaceState.ts:189` 宽度写 `agent_split_width`（唯一落盘项） |
| `[D-CANVAS]` | `canvas/agentCanvasHost.ts:77` `ctx.setNodes((ns)=>[...ns,newNode])` · `:81` `ctx.setNodes` · `:82` `ctx.setEdges` → ReactFlow `nodes/edges` |
| `[D-MODEL]` | `runtime/agentModelStore.ts:50` `contentSet(AGENT_CHAT_MODEL_KEY, …)`（键真源 `base/core/contracts.ts` `KEY_AGENT_CHAT_MODEL`，`:16` 别名） |
| `[D-SKILL]` | `runtime/skillStore.ts:43` `export const SKILLS_KEY = KEY_AGENT_SKILLS;`（contentStore 落盘） |
| `[D-MEM]` | `runtime/projectMemoryStore.ts:11` KV `agent_project_memory_v1_${agentKey}`（跨会话长期记忆） |
| `[D-NONE]` | 无落盘（纯函数 / 类型 / 样式 / 纯展示组件） |

**反证检查口径**：本表所有件均为「本域消费 ≥1 处」，故无一判为「非本域」；`canvas/` 3 件另做 L1 双侧说明（见 §2.3）。

**成因列填 `—` 的含义**：该件无错位、无过期描述，成因不适用（成因代号 A~H 全部描述「错位/过期/成片」机理，不给合规件硬套）。

---

## 1. 主表 · 域籍台账（62 件，`find src/components/agent -type f | sort` 逐件）

### 1.1 域根（5 件）

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `src/components/agent/.DS_Store` | 待核（口径缺口或反证命中） | — | 建议删除（非源码资产） | 无（macOS 系统垃圾文件） | 无 | refs 不适用（非模块） | 零引用；属应被 `.gitignore` 项 | — | 中 |
| 2 | `src/components/agent/agentConfig.ts` | 本域·域内错位 | `agent` | `agent/runtime/` | 无 JSX；值经 `runtime/agentCore.ts:47` `import { AGENT_PROMPTS } from '../agentConfig.ts'` 注入 LLM 请求，回显于 `[UI-ROOT]` 消息流 | `[D-NONE]`（system prompt + 工具循环常量值收口，不写存储） | `src/components/agent/runtime/agentCore.ts` | 本域 1 处消费（`agentCore.ts:47`、`:153` re-export）⇒ 属本域无疑；但域根非其落点 | A | 高 |
| 3 | `src/components/agent/agentTypes.ts` | 待核（口径缺口或反证命中） | `agent` | 契约层（**无子域可落**，见判据缺口 1） | 无（纯类型 `Violation`，14 行） | `[D-NONE]`（类型；被两个不变量校验器作返回结构） | `src/components/agent/assistantTable/tableInvariants.ts` · `src/components/agent/conversation/conversationInvariants.ts` | 本域 2 处消费 ⇒ 属本域无疑；落点无据 ⇒ 待核 | F | 中 |
| 4 | `src/components/agent/index.ts` | 本域·合规 | `agent` | 域根（D1 例外① 门面） | `[UI-ROOT]`（`App.tsx:109` `import { setAgentKey } from './components/agent/index.ts'`） | `[D-NONE]`（聚合 re-export） | `src/App.tsx` · `src/components/agent/panels/AgentPanel.tsx` · `tests/unit/AgentPanel.test.tsx` | 本域 3 处消费 ⇒ 本域件 | G | 高 |
| 5 | `src/components/agent/提示词备份.md` | 本域·域内错位 | `agent`（内容归属） | 移出 `src/**` → `docs/` 或 `spec/`（或删除） | 无（纯文本备份，76 行，内容「🐱猫猫画布助手核心系统指令」） | `[D-NONE]`；内容已被 `agentConfig.ts` 取代（全仓含「猫猫画布助手」仅此 2 处） | refs `① 模块引用 0 处（无）` | 本域 0 处引用 ⇒ 可直接移出 | G | 中 |

### 1.2 `assistantTable/`（23 件 · 全部表格语义）

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 6 | `assistantTable/AssistantTablePanel.tsx` | 本域·合规 | `agent` | `agent/assistantTable/` | `[UI-TBL]`（`TableWorkspacePanel.tsx:92`） | `[D-TBL]` | `src/components/agent/panels/TableWorkspacePanel.tsx` · `tests/unit/AgentPanel.test.tsx` | 本域 1 处渲染 ⇒ 本域件 | — | 高 |
| 7 | `assistantTable/AssistantTablePreviewCard.tsx` | 本域·合规 | `agent` | `agent/assistantTable/` | 由 `AssistantTablePanel.tsx` 渲染（refs ① 反向证实） | `[D-TBL]`（预览态 `tableWorkspaceTypes.ts:10 TableWorkspacePreview`，确认才写回） | `src/components/agent/assistantTable/AssistantTablePanel.tsx` · `tests/unit/AssistantTablePreviewCard.test.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 8 | `assistantTable/CellEditor.tsx` | 本域·合规 | `agent` | `agent/assistantTable/` | 由 `TableGrid.tsx` 渲染 | `[D-TBL]`（commitCell → `assistantTable.setCell` 写回 memory） | `src/components/agent/assistantTable/TableGrid.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 9 | `assistantTable/FindReplaceDialog.tsx` | 本域·合规 | `agent` | `agent/assistantTable/` | 由 `AssistantTablePanel.tsx` 渲染 | `[D-TBL]`（onReplace 由上层写回） | `src/components/agent/assistantTable/AssistantTablePanel.tsx` | 本域消费；唯一外部依赖 `base/panels/FullscreenShell.tsx:5`（横切叶组件，合规） | — | 高 |
| 10 | `assistantTable/RowOpsMenu.tsx` | 本域·合规 | `agent` | `agent/assistantTable/` | 由 `AssistantTablePanel.tsx` 渲染（行尾 ⋯ 菜单） | `[D-TBL]` | `src/components/agent/assistantTable/AssistantTablePanel.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 11 | `assistantTable/TabTargetMenu.tsx` | 本域·合规 | `agent` | `agent/assistantTable/` | 由 `AssistantTablePreviewCard.tsx` / `RowOpsMenu.tsx` 渲染 | `[D-TBL]`（跨表复制目标 tab 写回） | `src/components/agent/assistantTable/AssistantTablePreviewCard.tsx` · `src/components/agent/assistantTable/RowOpsMenu.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 12 | `assistantTable/TableGrid.tsx` | 本域·合规 | `agent` | `agent/assistantTable/` | 由 `AssistantTablePanel.tsx` 渲染（纯渲染子组件） | `[D-TBL]` | `src/components/agent/assistantTable/AssistantTablePanel.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 13 | `assistantTable/TableTabsBar.tsx` | 本域·合规 | `agent` | `agent/assistantTable/` | 由 `AssistantTablePanel.tsx` 渲染（顶部 40px tab 条） | `[D-TBL]`（tab 增删/改名/排序经上层落盘） | `src/components/agent/assistantTable/AssistantTablePanel.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 14 | `assistantTable/assistant-table.css` | 本域·合规 | `agent` | `agent/assistantTable/` | 由 `AssistantTablePanel.tsx` + `panels/TableWorkspacePanel.tsx` 各自 import（`agent-panel.css:8` 明写「表格样式已迁至本文件」） | `[D-NONE]`（样式） | `src/components/agent/assistantTable/AssistantTablePanel.tsx` · `src/components/agent/panels/TableWorkspacePanel.tsx` | 本域 2 处 import ⇒ 本域件 | — | 高 |
| 15 | `assistantTable/assistantTable.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 无 JSX（表格模型层）；经 `AssistantTablePanel` / `AgentPanel` / `canvas/useCanvasAgentTools` / `conversation/conversationAiState` 消费 | `[D-TBL]` | `AssistantTablePanel.tsx` · `AssistantTablePreviewCard.tsx` · `FindReplaceDialog.tsx` · `TableGrid.tsx` · `TableTabsBar.tsx` · `tableHistory.ts` · `tableInvariants.ts` · `tableWorkspaceState.ts` · `tableWorkspaceTypes.ts` · `useActiveAssistantTable.ts` · `useColumnResize.ts` · `useTableDrafts.ts` · `useTableSelection.ts` · `canvas/useCanvasAgentTools.ts` · `conversation/conversationAiState.ts` · `panels/AgentPanel.tsx` · `tests/unit/assistantTable.memory.test.ts` · `assistantTable.property.test.ts` · `assistantTable.test.ts` · `tableHistory.test.ts` · `tableInvariants.test.ts` · `tableWorkspaceState.test.ts`（22 处） | 本域 16 处消费 ⇒ 本域件 | — | 高 |
| 16 | `assistantTable/assistantTablePrompt.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 无 JSX；`buildRefineRowsUser` 由 `panels/AgentPanel.tsx` 调用拼装改行 user 串出 LLM（人格/JSON 契约已上移 `agentConfig.TABLE_RULES`） | `[D-NONE]`（只拼字符串） | `src/components/agent/panels/AgentPanel.tsx` | 本域 1 处消费 ⇒ 本域件；**不属 `prompt` 域**（该域 = `prompt/PromptHub.tsx` + `promptHubStore.ts`，与 AI 表格提示词拼装零交集） | — | 高 |
| 17 | `assistantTable/icons.tsx` | 本域·合规 | `agent` | `agent/assistantTable/` | 表格内 6 处渲染（refs ① 反向证实） | `[D-NONE]`（纯 SVG） | `AssistantTablePanel.tsx` · `AssistantTablePreviewCard.tsx` · `RowOpsMenu.tsx` · `TabTargetMenu.tsx` · `TableGrid.tsx` · `TableTabsBar.tsx` | 本域 6 处渲染 ⇒ 本域件 | — | 高 |
| 18 | `assistantTable/tableHistory.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 撤销/重做栈，由 `AssistantTablePanel` 的 ⟲/⟳ 按钮驱动（spec 3.4 只走按钮） | `[D-NONE]`（纯运行态、不落盘，栈上限 50） | `AssistantTablePanel.tsx` · `tableWorkspaceState.ts` · `panels/AgentPanel.tsx` · `tests/unit/tableHistory.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 19 | `assistantTable/tableIds.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 无（id 构造器 `atab/acol/arow`） | `[D-TBL]`（生成的 id 写进 `memory.assistantTables`） | `src/components/agent/assistantTable/assistantTable.ts` | 本域消费 ⇒ 本域件。**线索 TD-25-2 复核**：与 `agentKeys` 同形态（键/常量构造器），按 D3 判为**能力层**（表格前缀合约），留在子能力目录合规，不搬 | — | 高 |
| 20 | `assistantTable/tableInvariants.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 无（校验纯函数） | 校验对象 = `[D-TBL]` 的两份数据（tabs + 运行态） | `tableWorkspaceState.ts` · `conversation/conversationAiState.ts` · `tests/unit/tableInvariants.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 21 | `assistantTable/tableWorkspaceState.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 左面板 ↔ 右对话的共享运行态枢纽（由 `AssistantTablePanel` / `panels/AgentPanel` / `TableWorkspacePanel` 三方订阅） | `[D-TBL]`（不落盘，仅 `:189` 宽度写 `agent_split_width`） | `AssistantTablePanel.tsx` · `usePreviewResize.ts` · `useTableSelection.ts` · `panels/AgentPanel.tsx` · `panels/TableWorkspacePanel.tsx` · `tests/unit/AgentPanel.test.tsx` · `tests/unit/tableInvariants.test.ts` · `tests/unit/tableWorkspaceState.test.ts` | 本域 5 处消费 ⇒ 本域件 | — | 高 |
| 22 | `assistantTable/tableWorkspaceTypes.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 无（中立类型模块） | `[D-NONE]`（类型） | `tableInvariants.ts` · `tableWorkspaceState.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 23 | `assistantTable/useActiveAssistantTable.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | hook，由 `AssistantTablePanel` + `panels/AgentPanel` 订阅 | `[D-TBL]`（真源 `memory.assistantTables`，`:5` 订阅 `conversationState`） | `AssistantTablePanel.tsx` · `panels/AgentPanel.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 24 | `assistantTable/useColumnResize.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 列宽拖拽，由 `AssistantTablePanel` 装配 | `[D-TBL]`（松手 `setColumnWidth` 写回） | `src/components/agent/assistantTable/AssistantTablePanel.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 25 | `assistantTable/usePreviewResize.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 预览卡高度拖拽，由 `AssistantTablePanel` 装配 | `[D-TBL]`（松手 `setPreviewHeight`，运行态不落盘） | `src/components/agent/assistantTable/AssistantTablePanel.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 26 | `assistantTable/useTabDragSort.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | tab 拖拽排序，由 `TableTabsBar.tsx` 装配 | `[D-TBL]`（松手 `moveTab` 落盘一次） | `src/components/agent/assistantTable/TableTabsBar.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 27 | `assistantTable/useTableDrafts.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 编辑草稿，由 `AssistantTablePanel` 装配 | `[D-TBL]`（commitCell → `setCell` 写回） | `src/components/agent/assistantTable/AssistantTablePanel.tsx` | 本域消费 ⇒ 本域件 | — | 高 |
| 28 | `assistantTable/useTableSelection.ts` | 本域·合规 | `agent` | `agent/assistantTable/` | 选区/复制粘贴，由 `AssistantTablePanel` 装配 | `[D-TBL]` + 系统剪贴板（外部落点，非域内存储） | `src/components/agent/assistantTable/AssistantTablePanel.tsx` | 本域消费 ⇒ 本域件 | — | 高 |

### 1.3 `canvas/`（3 件）

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 29 | `canvas/useCanvasAgentTools.ts` | 本域·合规 | `agent` | `agent/canvas/`（维持） | `[UI-TOOL]`（`runtime/useAgentChat.ts:2` + `:372`；`panels/TableWorkspacePanel.tsx:30,39`） | 双向：写 `[D-CANVAS]`（经 host）+ 写会话 workflow/memory（`conversationStore`） | `src/components/agent/index.ts` · `src/components/agent/panels/TableWorkspacePanel.tsx` · `src/components/agent/runtime/useAgentChat.ts` · `tests/unit/agentPersistRecovery.test.ts` · `canvasAgentTools.test.ts` · `creditGateModes.test.ts` · `useAgentChat.hook.test.ts` · `useCanvasAgentTools.test.ts` | **反证命中**（本域 3 处消费，含门面 `index.ts:64` 导出）⇒ 不许判非本域 | H | 中 |
| 30 | `canvas/canvasPlanExecutor.ts` | 本域·合规 | `agent` | `agent/canvas/`（维持） | 无 JSX；由 `useCanvasAgentTools.executePlanTool` 调用（`AgentPanel.tsx:581,594` 注释指向它做积分闸判定） | `[D-CANVAS]`（建 imageGenerateNode + 触发 + 写回 `data.assetUrl`）+ 会话 workflow | `canvas/useCanvasAgentTools.ts` · `tests/unit/canvasAgentTools.test.ts` · `canvasPlanExecutor.deps.test.ts` · `canvasPlanExecutor.test.ts` · `creditGateModes.test.ts` | 反证命中（本域 `useCanvasAgentTools.ts` 消费）⇒ 不许判非本域 | H | 中 |
| 31 | `canvas/agentCanvasHost.ts` | 本域·合规 | `agent` | `agent/canvas/`（维持） | 无 UI（纯 JS 工厂，注入 ctx）；由工具层/执行器调用 | `[D-CANVAS]`（`:77` appendNode / `:81` appendMany / `:82` setEdges → ReactFlow nodes/edges） | `canvas/canvasPlanExecutor.ts` · `canvas/useCanvasAgentTools.ts` · `tests/unit/agentCanvasHost.test.ts` · `canvasPlanExecutor.deps.test.ts` | 反证命中（本域 2 处消费）⇒ 不许判非本域 | H | 中 |

### 1.4 `conversation/`（8 件）

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 32 | `conversation/conversationState.ts` | 本域·合规 | `agent` | `agent/conversation/` | 无 JSX（状态底座）；界面 = `[UI-ROOT]` | `[D-CONV]`（`:54` convKey · `:107` persistDebounced · `:160` contentSetAsync） | `assistantTable/useActiveAssistantTable.ts` · `conversation/conversationAiState.ts` · `conversationImageMap.ts` · `conversationSkillState.ts` · `conversationSnapshot.ts` · `conversationStore.ts` · `panels/TableWorkspacePanel.tsx` · `runtime/useAgentChat.ts` · `tests/unit/agentDraftTd17.test.ts` · `assistantTable.memory.test.ts` · `conversationState.invariants.test.ts` · `conversationState.test.ts` · `tableWorkspaceState.test.ts` · `useAgentChat.hook.test.ts`（14 处） | 本域 7 处消费 ⇒ 本域件 | — | 高 |
| 33 | `conversation/conversationSnapshot.ts` | 本域·合规 | `agent` | `agent/conversation/` | 无 JSX；由 `panels/AgentPanel.tsx`、`runtime/useAgentChat.ts` 读快照 | `[D-CONV]`（workflow/pending/memory 经底座 commit） | `conversation/conversationImageMap.ts` · `conversationStore.ts` · `panels/AgentPanel.tsx` · `runtime/useAgentChat.ts` · `tests/unit/agentMessages.test.ts` · `canvasAgentTools.test.ts` | 本域消费 ⇒ 本域件。**注**：`:31` import `runtime/volumePolicy.ts` = 成环反向边 | — | 高 |
| 34 | `conversation/conversationAiState.ts` | 本域·合规 | `agent` | `agent/conversation/` | 无 JSX；`global_contract/artifacts/undo/refImages` 由对话流驱动 | `[D-CONV]`（per-conversation，经底座 commit） | `src/components/agent/conversation/conversationStore.ts` | 本域 1 处（聚合门面）消费 ⇒ 本域件 | — | 高 |
| 35 | `conversation/conversationSkillState.ts` | 本域·合规 | `agent` | `agent/conversation/` | 无 JSX；Skill 三阶段门禁态，确认卡渲染于 `[UI-MSG]`（`:1517`） | `[D-CONV]`（`pendingGenerations`/`awaitingConfirm`/`creditGate`，`CREDIT_GATE_FIELD` 取自 `base/core/contracts.ts`） | `conversation/conversationStore.ts` · `tests/unit/creditGateModes.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 36 | `conversation/conversationImageMap.ts` | 本域·合规 | `agent` | `agent/conversation/` | 无 JSX；供执行层反查「图N」（`runtime/agentCore.ts` + `canvas/useCanvasAgentTools.ts` 消费） | `[D-CONV]`（读 snapshot/messages，不新增落盘） | `conversation/conversationStore.ts` · `runtime/agentCore.ts` | 本域 2 处消费 ⇒ 本域件 | — | 高 |
| 37 | `conversation/conversationStore.ts` | 本域·合规 | `agent` | `agent/conversation/`（聚合门面） | 无 JSX；被 `App.tsx:109`（经 `index.ts:66`）、`useAgentChat`、`canvas/useCanvasAgentTools` 消费 | `[D-CONV]`（会话 CRUD 真源） | `assistantTable/AssistantTablePanel.tsx` · `assistantTable/tableWorkspaceState.ts` · `canvas/useCanvasAgentTools.ts` · `agent/index.ts` · `runtime/agentMessages.ts` · `runtime/useAgentChat.ts` · `runtime/workflowState.ts` · `tests/unit/AgentPanel.test.tsx` · `agentDraftTd17.test.ts` · `agentMessages.test.ts` · `agentPersistRecovery.test.ts` · `assistantTable.memory.test.ts` · `canvasAgentTools.test.ts` · `conversationState.test.ts` · `conversationStore.test.ts` · `creditGateModes.test.ts` · `tableWorkspaceState.test.ts` · `useAgentChat.hook.test.ts` · `workflowState.test.ts`（19 处） | 本域 7 处消费 ⇒ 本域件 | — | 高 |
| 38 | `conversation/conversationTypes.ts` | 本域·合规 | `agent` | `agent/conversation/` | 无 JSX（中立类型模块） | `[D-NONE]`（类型；`:19` 声明 `assistantTables` 字段 = `[D-TBL]` 的 schema 落点） | `conversation/conversationInvariants.ts` · `conversationState.ts` · `panels/AgentPanel.tsx` · `tests/unit/conversationStore.test.ts` | 本域消费 ⇒ 本域件 | G | 高 |
| 39 | `conversation/conversationInvariants.ts` | 本域·合规 | `agent` | `agent/conversation/` | 无 JSX（校验纯函数） | 校验对象 = `[D-CONV]` 的会话形状 | `conversation/conversationState.ts` · `tests/unit/conversationState.invariants.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |

### 1.5 `panels/`（8 件）

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 | `panels/AgentPanel.tsx` | 本域·合规 | `agent` | `agent/panels/` | `[UI-ROOT]`（`App.tsx:1619` `<AgentPanel>`） | 读 `[D-CONV]` + `[D-TBL]`（`:105` TableWorkspacePanel 等多处 `conversationStore`） | `src/App.tsx` · `tests/unit/AgentPanel.test.tsx` | 本域装配根 ⇒ 本域件 | — | 高 |
| 41 | `panels/AgentMessage.tsx` | 本域·合规 | `agent` | `agent/panels/` | `[UI-MSG]`（`AgentPanel.tsx:1487`） | 读消息流（`[D-CONV]`），不写 | `panels/AgentPanel.tsx` · `runtime/useAgentChat.ts` · `tests/unit/AgentMessage.test.tsx` · `tests/unit/AgentPanel.test.tsx` | 本域渲染 ⇒ 本域件。**注**：它同时是 `runtime/useAgentChat.ts:120` 的类型源（见分层违规） | — | 高 |
| 42 | `panels/AgentConfirmCard.tsx` | 本域·合规 | `agent` | `agent/panels/` | `[UI-MSG]`（`AgentPanel.tsx:1517` + `AgentMessage.tsx` 内） | `[D-NONE]`（纯展示；读 pending/creditGate） | `panels/AgentMessage.tsx` · `panels/AgentPanel.tsx` | 本域 2 处渲染 ⇒ 本域件（文件头 `:6` 明载「非死代码」，勿当死代码删） | — | 高 |
| 43 | `panels/ChatMarkdown.tsx` | 本域·合规 | `agent` | `agent/panels/` | `[UI-AML]`（`AgentMessage.tsx:378` `<ChatMarkdown>`） | `[D-NONE]`（纯渲染） | `panels/AgentMessage.tsx` · `tests/unit/ChatMarkdown.test.tsx` | 本域渲染 ⇒ 本域件 | — | 高 |
| 44 | `panels/TableWorkspacePanel.tsx` | 本域·合规 | `agent` | `agent/panels/` | `[UI-MSG]`（`AgentPanel.tsx:1956` `<TableWorkspacePanel agentPanelWidth={width} />`） | `[D-TBL]`（`:69` 左缘拖拽写 `agent_split_width`） | `panels/AgentPanel.tsx` · `tests/unit/AgentPanel.test.tsx` | 本域渲染 ⇒ 本域件。**边界观察项**：表格本体在 `assistantTable/`、面板薄壳在 `panels/`，见判据缺口 3 | — | 高 |
| 45 | `panels/agent-panel.css` | 本域·合规 | `agent` | `agent/panels/` | 由 `AgentPanel.tsx` 显式 import（`:29` 注释） | `[D-NONE]`（样式） | `src/components/agent/panels/AgentPanel.tsx` | 本域 1 处 import ⇒ 本域件 | — | 高 |
| 46 | `panels/attachmentCover.tsx` | 本域·合规 | `agent` | `agent/panels/` | `[UI-AML]`（`AgentMessage.tsx:196`）+ `AgentPanel.tsx:155`（发送前 chip） | `[D-NONE]`（纯展示） | `panels/AgentMessage.tsx` · `panels/AgentPanel.tsx` | 本域 2 处渲染 ⇒ 本域件。**线索 TD-25-3 核实**：现位 `agent/panels/`，与计划 A4 裁定一致 ⇒ **落点正确**；原债描述写 `base/ui/attachmentCover.tsx` 已过期 | G | 高 |
| 47 | `panels/markdownImages.ts` | 本域·合规 | `agent` | `agent/panels/` | 由 `ChatMarkdown.tsx` 调 `extractImageSpans` | `[D-NONE]`（纯函数；底层判据委托 `base/utils/media/assetType.classifyAssetUrlKind`） | `src/components/agent/panels/ChatMarkdown.tsx` | 本域 1 处消费 ⇒ 本域件；fan-in 仅 1 个业务域 ⇒ 非横切件（L3 不成立） | — | 高 |

### 1.6 `runtime/`（15 件）

| # | 件（相对路径） | 判定 | 应属域 | 应属域内落点 | 证据①界面位置 | 证据②数据落点 | 证据③refs ① 段原文 | 反证检查 | 成因代号 | 置信度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 48 | `runtime/useAgentChat.ts` | 本域·合规 | `agent` | `agent/runtime/` | 由 `AgentPanel` 经门面 `index.ts:58` 装配；`[UI-ROOT]` | 驱动 `[D-CONV]` + `[D-CANVAS]` | `agent/index.ts` · `tests/unit/agentLogic.test.ts` · `agentPersistRecovery.test.ts` · `localIntent.test.ts` · `useAgentChat.hook.test.ts` | 本域件。**注**：`:120` `import type { AgentMessageData } from '../panels/AgentMessage.tsx'` = 域内分层违规 | — | 高 |
| 49 | `runtime/agentCore.ts` | 本域·合规 | `agent` | `agent/runtime/` | 无 JSX（纯函数层）；出网请求在 `[UI-ROOT]` 消息流回显 | `[D-NONE]`（`buildRequestMessages`/`parseSSEChunk`/意图分流，不写存储） | `panels/AgentMessage.tsx` · `runtime/agentRuntime.ts` · `runtime/useAgentChat.ts` · `tests/unit/agentLogic.test.ts` · `agentMessages.test.ts` · `agentRuntime.test.ts` · `useAgentChat.hook.test.ts` | 本域 3 处消费 ⇒ 本域件 | G | 高 |
| 50 | `runtime/agentRuntime.ts` | 本域·合规 | `agent` | `agent/runtime/` | 无 JSX（依赖注入运行时） | 消息写回 `[D-CONV]`（经 ctx.appendMsg） | `runtime/useAgentChat.ts` · `tests/unit/agentRuntime.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 51 | `runtime/agentAttachments.ts` | 本域·合规 | `agent` | `agent/runtime/` | 无 JSX；附件归一由 `AgentPanel` 发送触发 | `[D-CONV]`（`userMsg.attachments` + `refCatalog`，随消息落盘） | `runtime/useAgentChat.ts` · `tests/unit/agentAttachments.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 52 | `runtime/agentMessages.ts` | 本域·合规 | `agent` | `agent/runtime/` | 无 JSX（消息构造/落盘层） | `[D-CONV]`（appendMsg/setHistory/流式 patch，经 conversationStore） | `runtime/useAgentChat.ts` · `tests/unit/agentMessages.test.ts` · `assistantTable.memory.test.ts` · `tableWorkspaceState.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 53 | `runtime/inputStateMachine.ts` | 本域·合规 | `agent` | `agent/runtime/` | 输入区按钮态（`idle/planning/running/steer/retry`），渲染于 `[UI-ROOT]` 输入区 | `[D-NONE]`（内存态，不落盘） | `runtime/useAgentChat.ts` · `tests/unit/inputStateMachine.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 54 | `runtime/workflowState.ts` | 本域·合规 | `agent` | `agent/runtime/` | 无 JSX（状态迁移纯函数，M2 收口） | `[D-CONV]`（只产 workflow patch，`:18` 读 `conversationStore.getCurrentWorkflow`） | `runtime/useAgentChat.ts` · `tests/unit/conversationState.invariants.test.ts` · `workflowState.test.ts` | 本域消费 ⇒ 本域件。**边界结论**：编排状态机（驱动 send/steer 循环）⇒ 留 `runtime/` | — | 高 |
| 55 | `runtime/contextCompression.ts` | 本域·合规 | `agent` | `agent/runtime/` | 无 JSX | `[D-CONV]`（压缩结果写 `memory.summary`） | `runtime/useAgentChat.ts` · `tests/unit/contextCompression.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 56 | `runtime/tokenBudget.ts` | 本域·合规 | `agent` | `agent/runtime/` | 无 JSX（预算决策纯函数） | `[D-NONE]`（只决定压不压，压缩由 contextCompression 执行） | `runtime/useAgentChat.ts` · `tests/unit/tokenBudget.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 57 | `runtime/memoryRetrieval.ts` | 本域·合规 | `agent` | `agent/runtime/` | 无 JSX；检索结果注入上下文（由 useAgentChat 调用） | 读 `[D-MEM]`（不写） | `runtime/useAgentChat.ts` · `tests/unit/memoryRetrieval.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 58 | `runtime/projectMemoryStore.ts` | 本域·合规 | `agent` | `agent/runtime/`（计划硬约束落点） | 无 JSX；写入由 `memory_suggest` 工具触发，确认卡渲染于 `[UI-MSG]` | `[D-MEM]`（KV `agent_project_memory_v1_${agentKey}`，按 agentKey 全局，**非会话态**） | `canvas/useCanvasAgentTools.ts` · `runtime/memoryRetrieval.ts` · `runtime/useAgentChat.ts` · `tests/unit/memoryRetrieval.test.ts` · `projectMemoryStore.test.ts` | 本域 3 处消费 ⇒ 本域件 | — | 高 |
| 59 | `runtime/pendingRecovery.ts` | 本域·合规 | `agent` | `agent/runtime/` | 无 JSX（刷新恢复纯解析器） | 读 `[D-CONV]` 的 pending/messages（不写） | `runtime/useAgentChat.ts` · `tests/unit/pendingRecovery.test.ts` | 本域消费 ⇒ 本域件 | — | 高 |
| 60 | `runtime/agentModelStore.ts` | 本域·合规 | `agent` | `agent/runtime/`（计划硬约束落点） | 双入口：`[UI-ROOT]` 面板 + `settings/sections/AgentChatSettings.tsx`（设置页） | `[D-MODEL]`（全局应用偏好，非会话态） | `panels/AgentPanel.tsx` · `runtime/useAgentChat.ts` · `settings/sections/AgentChatSettings.tsx` · `tests/unit/AgentPanel.test.tsx` · `agentModelStore.test.ts` | 本域 2 处 + 域外 1 处消费 ⇒ 主消费方在本域 ⇒ 本域件（计划 A1 line 148 已从 `base/store` 迁入，硬约束已兑现） | — | 高 |
| 61 | `runtime/skillStore.ts` | 本域·合规 | `agent` | `agent/runtime/`（计划硬约束落点） | 双入口：`[UI-ROOT]` 面板 + `settings/sections/SkillSettings.tsx`（设置页） | `[D-SKILL]`（数据真源，非会话态） | `panels/AgentPanel.tsx` · `settings/sections/SkillSettings.tsx` · `tests/unit/AgentPanel.test.tsx` · `skillStore.test.ts` | 本域 1 处 + 域外 1 处消费 ⇒ 数据真源 + 供 agent Skill 三阶段执行 ⇒ 本域件（计划 A1 line 149 已迁入，硬约束已兑现） | — | 高 |
| 62 | `runtime/volumePolicy.ts` | 本域·合规 | `agent` | `agent/runtime/`（维持；备选 `conversation/`，见 §2.2 + 判据缺口） | 无 JSX（体积治理纯策略） | `[D-CONV]`（治理对象 = 会话整包 `agent_conversations_{agentKey}` 的序列化投影） | `conversation/conversationSnapshot.ts` · `conversation/conversationState.ts` · `tests/unit/conversationState.test.ts` · `volumePolicy.test.ts` | **零 runtime 消费 / 全 conversation 消费** ⇒ 属本域无疑，但落点有争议 ⇒ 维持现位并登记备选 | — | 中 |

---

## 2. 本域特有事项结论（任务书 §3 逐条）

### 2.1 `stores/` 是否已并入 `runtime/` —— **已并入（硬约束兑现）**

实测结论：**`agent/stores/` 不存在**。证据：

```
find src/components/agent -type d | sort
src/components/agent
src/components/agent/assistantTable
src/components/agent/canvas
src/components/agent/conversation
src/components/agent/panels
src/components/agent/runtime      ← 无 stores/
```

原 `stores/` 的 2 件（`agentModelStore` · `skillStore`）**已在 `runtime/` 内**：`src/components/agent/runtime/agentModelStore.ts` · `src/components/agent/runtime/skillStore.ts`（与计划 §A1 line 148/149 的 `base/store/* → agent/runtime/*` 迁移矩阵一致）。
⇒ 计划对本域的唯一硬约束**已兑现**，无「域内错位（组）」需登记。

### 2.2 `runtime/` 与 `conversation/` 的边界（D3/D4）—— 逐件结论

判法：先分「**会话数据本体**」与「**非会话态**」两类，再看消费链路方向。

| 状态/状态机件 | 现落点 | 逐件结论 | 依据 |
| --- | --- | --- | --- |
| `conversation/*` 8 件 | `conversation/` | **留 `conversation/`** | 全部 per-conversation、经 `conversationState.ts:160` 同键落盘，构成单向依赖链 `state ← {snapshot, aiState, skillState} ← {imageMap, store}`（`conversationStore.ts:19` 自载，实测无内部环） |
| `agentModelStore.ts` | `runtime/` | **留 `runtime/`** | 全局应用偏好（用哪个模型），`[D-MODEL]`，与会话无关；计划硬约束落点 |
| `projectMemoryStore.ts` | `runtime/` | **留 `runtime/`** | 跨会话长期记忆，`[D-MEM]`，文件头明写「与对话级 `memory.summary` 互补」；计划硬约束落点 |
| `skillStore.ts` | `runtime/` | **留 `runtime/`** | Skill 数据真源，`[D-SKILL]`，与会话无关；计划硬约束落点 |
| `inputStateMachine.ts` | `runtime/` | **留 `runtime/`** | 输入区 UI 状态机（idle/planning/running/…），驱动输入框按钮，**不是会话数据** |
| `workflowState.ts` | `runtime/` | **留 `runtime/`** | 编排状态机：只产 patch、由 `useAgentChat` 驱动 send/steer 循环，落盘动作在调用方（`workflowState.ts:9` 自载契约） |
| `volumePolicy.ts` | `runtime/` | **维持 `runtime/`（有争议，登记备选）** | 见下 |

**`volumePolicy.ts` 的明确结论**：**维持 `runtime/`，不判域内错位**。两条理由 ——
① 计划对本域的硬约束是「状态件与运行时件在同一子域（`runtime/`）」，volumePolicy 管的是**会话落盘包**，与运行时落盘路径同生命周期；
② 它是纯函数（lib 身份），放机制子域不违反 D4（D4 只禁 lib 反向 import 视图层，实测它零出向视图依赖）。

**但它有两个反常信号**：一是它是 `runtime/ ↔ conversation/` 成环的**唯一反向边**（`conversationSnapshot.ts:31` + `conversationState.ts:46` 反向 import 它）；二是它**零 `runtime/` 消费**（4 个消费方：2 个 conversation 件 + 2 个测试）。若裁判优先「断环」，最省一刀是把它移入 `conversation/`（此时 `runtime/ → conversation/` 变单向无环）。两种判法都成立 ⇒ 已列入判据缺口，请裁定。

⇒ **未发现「状态件混装」导致的假子域**（详见「假子域 / 成环」小节第 3 条）。

### 2.3 `agent/canvas/` 是不是「域中域」（成因 H）—— 结论：**① 属 agent 的机制层**，同时**命中 H 形态**

- **L1①界面长在哪**：`runtime/useAgentChat.ts:372` 调 `useCanvasAgentTools()` 拿 `toolSchemas/callTool`，工具执行结果回显在 AI 助手对话流（`[UI-ROOT]` + `agent-panel.css` 明载「工具行去文字化」）；`panels/TableWorkspacePanel.tsx:39` 用 `callTool('create_node')` 走同一注册表。⇒ **界面在 agent 面板**。
- **L1②数据落到哪**：`agentCanvasHost.ts:77/81/82` `ctx.setNodes/setEdges` ⇒ **数据落 canvas 画布**（`[D-CANVAS]`）。
- **L1 双侧冲突 ⇒ 按「驱动方 + 唯一消费域」判**：这 3 件由 agent 运行时发起调用、被 agent 域 3 处消费（含门面 `index.ts:64`），**canvas 域零消费**；它们对 canvas 是**单向向外依赖**（`useCanvasAgentTools.ts:11` import `@/components/canvas`）。⇒ **判归 agent 机制层（选项①）**。
- **反证门闩命中**：本域 3 处消费 ⇒ **不许判非本域**（这是我不把它们报送 canvas 域的硬理由）。
- **但确实命中 H 形态**：这 3 件是「能指着说的第二样东西」—— AI 画布工具链，而且被**劈成两半**：**注册表契约 `canvas/toolRegistry.ts` 在 canvas 域**（文件头明写「画布 AI 工具注册表……约定 `useCanvasAgentTools` 模块加载时同步 `registerTool` 一批」），**工具实现全在 agent 域**。
  ⇒ 结论：**不算假子域**（3 件达 D2 门槛、职责单一：注册表/执行器/原语），但**登记 H**，并请求 canvas 域主交叉验证。另两种可能明确排除：② 属 `canvas/` 域 —— 不成立（canvas 域零消费，且工具实现深度依赖 agent 的 conversation/projectMemory/creditGate）；③「第三个东西」—— 不成立（无独立界面，也无独立数据落点，数据全部落在已有两域）。

### 2.4 `assistantTable/` 达标性 —— **达标**

- 件数 **23**（≥3 ✔，D2 满足）。
- 职责纯度：**23/23 全部表格语义**，无一件混入非表格职责（逐件核过：模型层 1、UI 8、hook 5、运行态 2、校验 1、类型 2、id 构造器 1、提示词拼装 1、样式 1、图标 1）。
- **唯一外部依赖** = `base/panels/FullscreenShell.tsx`（`FindReplaceDialog.tsx:5`，横切叶组件，合规）。
- 遗留观察：内部未按 D3 再分层（UI/hook/store/contract/css 同居一个子能力包）⇒ 已列为判据缺口 2，不是本轮错位。

### 2.5 域根散件（D1）—— 现状 5 件 · 目标 1

见下方「域根散件清单」。`agentConfig.ts` 与 `agentTypes.ts` 均**未命中任何一条 D1 例外**：计划 §5（line 395）对本域只写「已建域 + 门面；本批只收 4 件、**不内部重构**」——这是**时序安排**，不是「留域根」的落点裁定 ⇒ 我按「无例外」登记，并请裁判裁定是否豁免（判据缺口 5）。

### 2.6 域内分层方向（D4）—— 已跑，命中 1 处违规

跑法：对 `runtime/` 15 件**全量** grep 出向 import（超出任务书「抽 3 件」的要求）：

```
grep -rn "from '[^']*panels/" src/components/agent    # 排除 panels/ 自身
→ src/components/agent/runtime/useAgentChat.ts:120: import type { AgentMessageData } from '../panels/AgentMessage.tsx';
```

- **结论**：`runtime/` 只有 1 条指向 `panels/` 的边，且是 `import type`（运行时被擦除，无真实模块依赖）—— 但它意味着**运行时层的契约类型住在视图层**（`AgentMessageData` 定义在 `panels/AgentMessage.tsx`），是 D4 反向的**类型层**违规。建议把 `AgentMessageData` 下沉到契约层（与 `conversationTypes.ts` 同层），而不是搬 `useAgentChat`。
- `conversation/` → `panels/`：**0 处**（已跑，无命中）。
- `assistantTable/` → `panels/`：**0 处**（唯一外部是 base 横切件）。
- 正向链路健康：`panels/` → `runtime/`（`AgentPanel` 消费 `agentModelStore`/`skillStore`）、`panels/` → `assistantTable/`、→ `conversation/`，均符合「视图 → 机制 → 能力」。

### 2.7 域内成环 —— **有环 1 处**

`runtime/` ↔ `conversation/` 互为依赖（任务书预判的常见形态，实测确认）：

- `runtime/ → conversation/`：`useAgentChat.ts:113/114/115`（`conversationState`）、`workflowState.ts:18`（`conversationStore`）、`agentCore.ts:48`（`conversationImageMap`，type-only）
- `conversation/ → runtime/`：`conversationSnapshot.ts:31` + `conversationState.ts:46`（均为 `runtime/volumePolicy.ts`）

⇒ 环的**唯一反向边 = `volumePolicy.ts`**。不自行重构，登记交裁判（解法见下节第 1 条）。

---

## 认领域分布（我送出到各域各几件）

| 目标域 | 件数 | 件清单 |
| --- | --- | --- |
| **（全部）** | **0** | 本域 **无一件判为「非本域」**。62 件中：本域·合规 58 · 本域·域内错位 2 · 待核 2 · 非本域 0 |

说明：本域封装度极高 —— 全仓对 `src/components/agent/**` 的**域外消费仅 4 处**（`App.tsx:37` `AgentPanel`、`App.tsx:109` `index.ts`、`settings/sections/SkillSettings.tsx` `skillStore`、`settings/sections/AgentChatSettings.tsx` `agentModelStore`），**无任何一件被 ≥3 个业务域消费** ⇒ L3 真横切不成立、L4 也不触发；`base` 横切层里没有本域的件需要收回。

---

## 域内错位表（属本域 · 子目录不对 · 本轮登记不搬）

| 件 | 现子目录 | 应入子目录 | 依据 |
| --- | --- | --- | --- |
| `src/components/agent/agentConfig.ts` | 域根 | `agent/runtime/` | ① 本域门面 `index.ts:16` 已把它**登记在 runtime/ 名下**（「├─ agentConfig.ts system prompt + 运行时常量（值收口）」）而文件实际仍在域根 ⇒ 文档与实测不一致；② 唯一消费者 `runtime/agentCore.ts:47` 在 `runtime/`；③ D1 域根只许门面 `index.ts` |
| `src/components/agent/提示词备份.md` | 域根 | 移出 `src/**` → `docs/` 或 `spec/`（或直接删除） | ① 非源码资产，0 引用（refs `① 模块引用 0 处`）；② `src/**` 内不应存放文档备份；③ 内容（「🐱猫猫画布助手核心系统指令」）已被 `agentConfig.ts` 的 `AGENT_PROMPTS` 取代 —— 全仓含该词的仅此 2 处，属过期备份 |

---

## 域根散件清单（现状 5 件 · 目标 1）

| 件 | 现位置 | 应入子目录 | 命中哪条 D1 例外（无则"无例外"） |
| --- | --- | --- | --- |
| `index.ts` | 域根 | **留域根** | **例外① 门面**（`App.tsx:109` + `App.tsx:37` 双向装配入口） |
| `agentConfig.ts` | 域根 | `agent/runtime/` | 无例外 |
| `agentTypes.ts` | 域根 | 待裁定（契约层，无子域可落） | 无例外（且 D2 门槛冲突，见判据缺口 1） |
| `提示词备份.md` | 域根 | 移出 `src/**` | 无例外 |
| `.DS_Store` | 域根 | 删除（macOS 系统垃圾） | 无例外（非源码资产，建议一并补 `.gitignore`） |

---

## 假子域 / 域内分层违规 / 成环

| 现象 | 涉及件 | 依据 |
| --- | --- | --- |
| **成环（runtime ↔ conversation）** | 正向：`runtime/useAgentChat.ts:113/114/115`、`runtime/workflowState.ts:18`、`runtime/agentCore.ts:48`（type）；反向：**`runtime/volumePolicy.ts`**（被 `conversationSnapshot.ts:31`、`conversationState.ts:46` import） | 双向 grep 实测。**解法 A（推荐）**：把 `volumePolicy.ts` 移入 `conversation/` ⇒ 环自断、`runtime/ → conversation/` 变单向；**解法 B**：依赖倒置（conversation 只依赖抽出的接口） |
| **域内分层违规（D4 反向 · 类型层）** | `runtime/useAgentChat.ts:120` `import type { AgentMessageData } from '../panels/AgentMessage.tsx'` | 机制层 runtime 反向依赖视图层 panels 的**契约类型**。建议：把 `AgentMessageData` 下沉到契约层（与 `conversationTypes.ts` / `agentTypes.ts` 同层），而不是搬 `useAgentChat`。全量 grep 确认 `runtime/` → `panels/` 仅此 1 条（且 type-only） |
| **假子域排查 · `assistantTable/`** | 23 件 | **非假子域**：≥3 件 ✔ · 23/23 全部表格语义 ✔ |
| **假子域排查 · `canvas/`** | 3 件 | **非假子域但卡在 D2 下限**（恰好 3 件）：职责单一 ✔（注册表/执行器/原语）。**登记 H 形态**（AI 画布工具链成片，注册表 `canvas/toolRegistry.ts` 在 canvas 域、实现在 agent 域） |
| **假子域排查 · `conversation/`** | 8 件 | **轻度假子域风险（D3）**：计划给它的职责是「对话状态与消息流」，实测混入 2 件非状态件 —— `conversationTypes.ts`（契约）· `conversationInvariants.ts`（校验 lib）。**本轮不判错位**（8 件里 6 件纯状态，且类型/校验是状态域的内聚附件），登记供裁判决定是否抽 `contract/` |
| **假子域排查 · `runtime/`** | 15 件 | **不算假子域**：它确实混了 hook/纯函数/状态机/store 四种职责，但**计划 §3 对本域比对基准（任务书 §2 表）给 `runtime/` 的职责本就是「编排 · 工具调用 · 会话驱动 + 状态」多职责** ⇒ 按本域基准属授权范围 |
| **D2 门槛冲突** | `agentTypes.ts` | 唯一正确落点是契约层，但 agent 域无 `contract/` 子目录，单件建目录违反「不足 3 件不许建子目录」 ⇒ 无处可落（判据缺口 1） |

---

## 判据缺口（无据可依处 · 供裁判裁定）

1. **中立共享契约件的落点无据**（`agentTypes.ts`）—— D3 有 `contract/`（schema/常量）这一角色，但 D2 要求 ≥3 件才能建子目录，本域契约类件散在 3 处：`agentTypes.ts`（域根）· `conversation/conversationTypes.ts` · `assistantTable/tableWorkspaceTypes.ts`。
   → 建议（二选一）：① ADR-0042 补一条「契约件不足 3 件时可留域根并显式标注 exception」；② **并案建 `agent/contract/`**，把上述 3 件一起收进去（正好满足 D2 ≥3 件）。我倾向 ②。
2. **「子能力包」内部是否需按 D3 再分层无据** —— `assistantTable/` 23 件内部混装 UI(tsx 8) + hook(5) + 运行态(2) + 纯函数(3) + 类型(2) + 样式(1) + 图标(1) + 提示词(1)，逐条比对 D3 属多职责；但计划 §5（line 396）把它整体认定为「表格子系统，域内聚」。
   → 建议明确：子能力目录 = **一级豁免**（内部不再按 D3 拆），或反之要求内部再分 `panels/lib/contract`。**若按前者，本节的假子域风险自动消解。**
3. **「同一视图跨两个子域」无据** —— 表格视图分居 `assistantTable/AssistantTablePanel.tsx`（本体）与 `panels/TableWorkspacePanel.tsx`（面板薄壳）。两者现落点**都讲得通**（后者是 AgentPanel 直接装配的面板壳）。
   → 建议明确一条：由 `AgentPanel` 直接装配的面板壳归 `panels/`，子能力内部视图归子能力目录。当前我按此判两者均合规。
4. **L1 双侧冲突时的优先口径无据** —— `agent/canvas/` 3 件：界面在 agent 对话流、数据落 canvas 画布，L1 的两问给出**相反指向**。
   → 建议补一条：「双侧冲突时按『驱动方 + 唯一消费域』判」或「按数据落点优先判」。**这两种口径会给出相反结论**（本批我按前者判归 agent；若裁判取后者，这 3 件应整体送 canvas 域）。这是本批对 `agent/canvas` 唯一真正需要裁定的点。
5. **计划 §5「不内部重构」是否等于 D1 豁免** —— 计划 line 395 对本域写「已建域 + 门面；本批只收 4 件、不内部重构」，未写「域根留 `agentConfig.ts`/`agentTypes.ts`」。
   → 请裁定：这是**时序安排**（本批不动，之后仍要归位 ⇒ 我登记的 2 件错位成立）还是**永久落点裁定**（⇒ 应补进 D1 例外清单，我改判合规）。
6. **`base/core/agentKeys.ts` 的归位待确认** —— 计划 §2（line 266）已**改判归 `agent/agentKeys.ts`**（理由：实测 agent 5 / App 1，`backupStore` 零消费，§7「三处共用」前提不成立）。但**实测该文件仍在 `src/components/base/core/agentKeys.ts`**（属 TASK-028 领地，我不越界）。
   → 本轮我按**实测 62 件**登记（未把它计入本域）。若第二波确认归 agent，本域应新增 1 件，落点建议 `agent/runtime/`（键构造器 = 契约原语，按 TD-25-2 口径「键构造器非债」，与 `agentModelStore`/`skillStore` 同处）。请裁判在汇总时并入迁移矩阵。

---

## 交叉验证请求（要下列域复核我的送出项）

我本轮**零送出**（无一件判为非本域），以下是**请求对方复核归属**的件：

| 送出的件 | 请哪个域复核 | 复核对什么 |
| --- | --- | --- |
| `agent/canvas/useCanvasAgentTools.ts` · `agent/canvas/canvasPlanExecutor.ts` · `agent/canvas/agentCanvasHost.ts` | **`canvas` 域主（TASK-025）** | 这 3 件是「AI 驱动的画布操作」。请 canvas 回三种之一：① **认领**（工具实现应迁 `canvas/agent/`）② **不认**（维持 `agent/canvas/`，我当前判法）③ **并案**（注册表 `canvas/toolRegistry.ts` 与工具实现应在同一域 —— 无论合到哪边）。**关键事实**：canvas 域对这 3 件零消费；agent 域 3 处消费（含门面导出）；它们单向 import `@/components/canvas` |
| `agent/runtime/skillStore.ts` · `agent/runtime/agentModelStore.ts` | **`settings` 域主（TASK-027）** | 这两件各被 settings 域 1 处消费（`SkillSettings.tsx` · `AgentChatSettings.tsx`）。我判**本域**（数据真源 + 主消费方在 agent，settings 只是管理 UI）。请 settings 判是否要求**并案为共享件** |
| （待收）`base/core/agentKeys.ts` | **`base` 横切层域主（TASK-028）** | 计划 §2 已改判归 agent（实测 agent 5 / App 1）。若 TASK-028 确认，请报送我第二波**认领**；我给它的落点是 `agent/runtime/` |

---

## 计数

- 本域扫描件数：**62**（`find src/components/agent -type f | sort`；其中源码件 60 = 计划 §5 的 3+23+3+8+8+15，另含 `提示词备份.md` 1 · `.DS_Store` 1）
- 本域·合规：**58**（含门面 `index.ts`）
- 本域·域内错位：**2**（`agentConfig.ts` · `提示词备份.md`）
- 非本域：**0**
- 待核：**2**（`agentTypes.ts` · `.DS_Store`）
- 成因分布：**A 1** / B 0 / C 0 / D 0 / E 0 / **F 1** / **G 4** / **H 3** / `—`（合规·无错位成因）**53**
  - **A 1** = `agentConfig.ts`（子域化后域根件未跟进：`index.ts:16` 已登记它属 runtime/，文件未动）
  - **F 1** = `agentTypes.ts`（契约件无子域可落）
  - **G 4** = `index.ts`（目录地图缺 `agentModelStore`/`skillStore`/`volumePolicy` 三件、路径仍写 `.js`）· `agentCore.ts`（`:7-8` 注释写 `../agentConfig.js`）· `conversationTypes.ts`（`:124` 注释写 `base/utils/volumePolicy.ts`，真位 `agent/runtime/volumePolicy.ts`）· `panels/attachmentCover.tsx`（债 TD-25-3 描述写 `base/ui/attachmentCover.tsx`，实测已在 `agent/panels/`，与 A4 裁定一致 ⇒ **落点正确、仅描述过期**）
  - **H 3** = `canvas/` 3 件（AI 画布工具链成片，注册表与实现分居两域）
- 无 `refs` 输出的件（附清单）：**`src/components/agent/提示词备份.md`**（refs `① 模块引用 0 处（无）`）· **`src/components/agent/.DS_Store`**（非模块，refs 不适用）。其余 60 件均有 refs ① 段输出，已逐条粘入主表。

---

## 验收自测（TASK-022 §9 + 本任务书 §6）

- [x] 领地 `src/components/agent/**` 的**每一个文件**（62 件，`find … -type f | sort` 全量）都在主表出现一次，不多不少；无 refs 输出的 2 件已列入末尾清单。
- [x] 每条「非本域」凑齐四件证据 —— **本轮非本域 0 件**，该条不适用；`canvas/` 3 件已按四件证据完整论证（含反证门闩命中说明）。
- [x] 反证检查已对**所有 62 件**执行（主表「反证检查」列逐件填写；`canvas/` 3 件因命中反证而**不判非本域**）。
- [x] 成因代号逐条填写；合规件填 `—` 并在表头/计数处说明（未给合规件硬套代号、未用形容词）。
- [x] 无一条依据是「名字叫 xxx」或「目录在 xxx」—— 全部依据为 `refs` 实测 + `文件:行` 渲染点/落盘点 + 出向 import grep。
- [x] 「`stores/` 并入 `runtime/`」给了实测结论（**无 `stores/` 目录** + 2 件已在 runtime/ 内）与证据。
- [x] 「`runtime/` vs `conversation/` 边界」「`agent/canvas/` 是否域中域」「域根散件」三问各有明确结论（§2.2 / §2.3 / §2.5）。
- [x] 对 `runtime/` 跑了出向 import 验证（**全量 15 件**，超出「抽 3 件」要求）：→ `panels/` 仅 1 条且 type-only。
- [x] 只写了本文件。`git status --porcelain` 摘要（本域主执行前）：

```
 M .workbuddy-ai/memory/2026-09-19.md                                   ← 记忆文件（非本任务产出）
 M docs/agent 批量任务/TASK-025-域主-canvas.md                            ← 别域域主产出（非我改动）
 M docs/agent 批量任务/TASK-029-域主-小域与hooks与types.md                  ← 别域域主产出（非我改动）
```

本域主未新增/修改 `src/**` 任何文件，未执行 `git mv`，未新建脚本，未 `debt.mjs add`，未读其它 `TASK-*` 产出与其它域结论。
