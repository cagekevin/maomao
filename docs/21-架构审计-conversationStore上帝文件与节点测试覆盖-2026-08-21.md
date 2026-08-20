# 21 - 架构审计：conversationStore 上帝文件 + 节点 UI 测试覆盖 - 2026-08-21

> **状态：🟢 已实施（2026-08-21）**
> **日期**：2026-08-21
> **性质**：架构债务审计（非 bug）。两个问题：① `conversationStore.js` 职责过载；② 节点 UI 测试覆盖不均。
> **目标**：为明天动手提供精确的改动清单 + 风险排序。
> **关联**：`src/components/base/conversationStore.js`、`src/components/nodes/*`、`tests/unit/*Node*.test.jsx`

---

## 0. 审计结论（先行摘要）

| 问题 | 现状 | 严重度 | 建议 |
|---|---|---|---|
| conversationStore 上帝文件 | 674 行，**44 个导出 + 12 个内部函数**，职责混杂 | 中 | **拆分 4 个文件**，但需谨慎（改动大、**仅 4 个文件直接 import**，回归面可控） |
| 节点 UI 测试覆盖 | 17 节点**全部有测试**（我原判断"偏薄"**不准确**），但**深度严重不均** | 中 | **重点补大文件节点**，尤其 VideoProcessNode |

**重要修正**：我之前口头说"UI 层覆盖偏薄"是**不准确的**。实际审计发现每个节点都有对应测试文件（21 个节点测试文件），且有统一的 `_nodeMocks.mjs` mock 基建。真实问题是**覆盖深度不均**，不是"没有覆盖"。

---

## 1. 问题一：conversationStore.js 上帝文件

### 1.1 现状

- **674 行，44 个导出函数 + 12 个内部 helper（`emptyMemory`/`subscribe`/`getSnapshot`/`initState`/`migrateLegacyGlobal`/`getState`/`commit`/`uid`/`getActiveConv`/`persistDebounced`/`convKey`/`activeKey`）≈ 56 个**（实测）。*（原文档写"58 个导出函数"不准确：`export function` 实测仅 44 个，见 §4 决策记录。）*
- 一个文件同时承担了 **6 类职责**（见下）。

### 1.2 职责切分（按函数归类）

从 `src/components/base/conversationStore.js` 逐函数审计，可拆成 6 类：

| # | 职责域 | 代表函数 | 函数数（导出/含内部） |
|---|--------|---------|--------|
| A | **核心会话 CRUD**（对话增删切换） | `ensureActiveConversation` / `newConversation` / `switchConversation` / `deleteConversation` / `applyConversation` / `renameActiveConversation` / `importLegacy` / `captureActiveConversation` / `getActiveConversationId` / `getConversations` | 10 / 10 |
| B | **存储抽象 + 隔离**（agentKey 分区、落盘、订阅） | `setAgentKey` / `useConversationStore` / `flushPersist` / `resetConversationCache`（导出）+ `convKey` / `activeKey` / `initState` / `migrateLegacyGlobal` / `getState` / `commit` / `subscribe` / `getSnapshot` / `persistDebounced`（内部） | 4 / 13 |
| C | **归一化/内存模型**（结构兜底） | `normalizeConversation` / `normalizeWorkflow` / `normalizePending` / `normalizeMemory` + `emptyMemory`（内部） | 4 / 5 |
| D | **当前对话读写快照**（runtime 状态） | `getCurrentSnapshot` / `setCurrentSnapshot` / `getCurrentWorkflow` / `patchCurrentWorkflow` / `getCurrentPending` / `setCurrentPending` / `getCurrentMemory` / `setCurrentMemory` + `getActiveConv`（内部） | 8 / 9 |
| E | **跨轮图数据源**（AI 图生图反查） | `getLastUserReferenceImages` / `getLastGeneratedImages` / `getCurrentImageMap` | 3 / 3 |
| F | **Skill/统一风格/撤销/确认态**（AI 编排状态） | `getCurrentGlobalContract` / `setCurrentGlobalContract` / `getCurrentArtifacts` / `setCurrentArtifacts` / `getActiveAiUndoStack` / `pushActiveAiUndo` / `popActiveAiUndo` / `getActivePendingGenerations` / `setActivePendingGenerations` / `getAwaitingConfirm` / `setAwaitingConfirm` / `getCurrentRefImages` / `setCurrentRefImages` / `getCurrentRunMode` / `setCurrentRunMode` | 15 / 15 |

**合计：44 个导出 + 12 个内部 helper = 56 个函数**（原文档"58"为笔误，多算的 2 个应是把 B 类 `persistDebounced` 双算了）。B 类在导出面最小（4 个），但含全部落盘/订阅/分区内部逻辑，是拆分时最需要共享 state 的部分——这点原文档 §1.6 已正确识别。

**关键判断**：这不是"一个 store"，而是 **AI 会话状态管理的多个关注点硬塞在一个文件**。其中 **F 类（AI 编排状态）占了一半以上导出**，和"会话存储"这个核心职责混在一起。

### 1.3 为什么危险

1. **修改面**：**仅 4 个源码文件直接 import 它**（`App.jsx` / `useAgentChat.js` / `useCanvasAgentTools.js` / `AgentPanel.jsx`）。*（原文档写"10 个文件 import"不准确：`agentCore` / `backupStore` / `useStoreSelector` / `eventBus` 仅在注释里提及文件名，`contracts.js` 是登记配置字符串，均非 import。拆分成 "1 个 re-export 入口 + 3 个内部实现文件" 时，**只需这 4 个调用方兼容**，回归面比原判断更小。见 §4。）*
2. **函数间隐藏耦合**：`setCurrentSnapshot` 依赖 `normalizeWorkflow`，`getCurrentImageMap` 依赖 `getLastGeneratedImages`，拆错会断链。
3. **每加一个 AI 编排状态就往这塞** → 继续膨胀。

### 1.4 拆分建议（4 个文件，保持导出名不变，防调用方改动）

> ⚠️ **原则：拆分只动文件组织，不重命名任何导出函数。** 所有调用方 import 路径是 `./conversationStore.js`，若直接改路径会让 10 个文件全要改。**推荐用"re-export 聚合层"平滑迁移**（见 1.5）。

| 新文件 | 内容 | 理由 |
|---|---|---|
| `conversationStore.js`（瘦身保留） | A 核心会话 CRUD + B 存储抽象 | 保持"会话存储"单一语义，成为 re-export 入口 |
| `conversationSnapshot.js` | D 当前对话快照 + C 归一化 | "读写当前对话"独立关注点 |
| `conversationAiState.js` | F AI 编排状态（contract/artifact/undo/pending/refImages/runMode/awaitingConfirm） | 量最大、最独立，拆出后主文件瘦身一半 |
| `conversationImageMap.js` | E 跨轮图数据源 | AI 图生图专属，可独立测试 |

### 1.5 平滑迁移方案（推荐，零破坏）

- `conversationStore.js` 保留全部导出名，但内部 `export { ... } from './conversationSnapshot.js'` 等方式 re-export。
- **所有调用方 import 路径不变**（仍 `from './conversationStore.js'`），无感知。
- 新代码可逐步从具体文件 import（渐进迁移，不强制一步到位）。

### 1.6 拆分风险

| 风险 | 规避 |
|---|---|
| 模块级 `states` / `hydratedSet` / `listeners` 是共享可变状态 | **拆分文件时必须共享同一份 module state**，不能各文件各持一份（否则状态隔离断裂）。建议抽一个 `conversationState.js` 持有状态，其余文件 import 它 |
| `persistDebounced` 依赖 `hydratedSet[currentAgentKey]` | 落盘逻辑放 B（存储抽象），由它统一引用 state |
| 循环依赖（A 引用 B，B 引用 A） | 用 `conversationState.js` 做底层状态层，A/B/C/D/E/F 都依赖它，**单向依赖** |

---

## 2. 问题二：节点 UI 测试覆盖不均

### 2.1 修正之前的判断

**我此前口头说"17 个节点 UI 层覆盖偏薄"——不准确。** 实测：
- **17 个节点全部有对应测试文件**（21 个节点测试文件，含 `.upstream` / `.imgMenu` 变体）。
- 有统一 mock 基建 `_nodeMocks.mjs`（174 行），mock 了 NodeShell/HoverToolbar/ExpandablePanel/useConnectedInputs/useNodeGeneration 等 16 个依赖。
- 有深度测试：`AgentPanel.test.jsx`(361)、`useAgentChat.hook.test.js`(784)、`canvasPlanExecutor.test.js`(333)、`canvasAgentTools.test.js`(681)、`conversationStore.test.js`(288)。

**真实问题 = 覆盖深度严重不均**，尤其是"越大的文件测越浅"。

### 2.2 测试深度审计（按文件行数 / 节点复杂度）

| 节点 | 源码行数 | 测试文件行数 | 深度评价 |
|---|---|---|---|
| **VideoProcessNode** | **1553（最大）** | **35** | 🔴 **严重偏薄**（大而复杂测最浅） |
| **VideoExtractNode** | 603 | 251 | 🟢 较深 |
| ImageBoxNode | 687 | 191 | 🟢 中上 |
| GridSplitNode | 996 | 30 | 🔴 偏薄 |
| GridMergeNode | 695 | 30 | 🔴 偏薄 |
| FaceMosaicNode | 340 | 217 | 🟢 深 |
| ScriptBoxNode | 208 | 242 | 🟢 深 |
| DiscountVideoNode | 381 | 282 | 🟢 深 |
| PromptNode | 459 | 292(.imgMenu) + 168(.upstream) | 🟢 深 |
| TemplateNode | 461 | 125 + 142(.upstream) | 🟢 中上 |
| TextNode | 424 | 41 + 137(.upstream) | 🟡 中 |
| ImageNode | 339 | 30 | 🔴 偏薄 |
| LoopNode | 289 | 27 | 🔴 偏薄 |
| GroupNode | 113 | 77 | 🟢 中上 |
| Director3DNode | 179 | 20 | 🟡 浅但简单 |
| PanoramaNode | 329 | 25 | 🟡 浅 |
| GhostTargetNode | 36 | 59 | 🟢（辅助节点，够） |

### 2.3 核心问题

1. **VideoProcessNode（1553 行）只有 35 行测试** → 最复杂、改动风险最高的节点，测试保护最弱。这是最需要补的。
2. **GridSplitNode（996 行）/ GridMergeNode（695 行）/ ImageNode（339）/ LoopNode（289）** 测试偏浅（30 行左右），多为"挂载不崩 + 单次触发"，对边界/参数分支覆盖不足。
3. 已有 `_nodeMocks.mjs` 基建，**补测试成本低**（mock 都齐了，照着 TextNode/VideoExtractNode 的写法加即可）。

### 2.4 补充建议（按优先级）

| 优先级 | 节点 | 建议补什么 |
|---|---|---|
| P0 | VideoProcessNode | 至少补：挂载各模式、核心参数渲染、生成/停止、上游输入传递、错误态 |
| P1 | GridSplitNode / GridMergeNode | 补：多图输入、切图逻辑、参数变更重渲染 |
| P1 | ImageNode / LoopNode | 补：图片渲染、循环次数、上游连接 |
| P2 | 其余偏薄节点 | 补到"挂载 + 主交互 + 关键分支"即可，不必全量 |

### 2.5 测试基建现状（已具备，可直接复用）

`tests/unit/_nodeMocks.mjs`（174 行）已 mock：
- `@xyflow/react`、NodeShell、HoverToolbar、ExpandablePanel、GenerateButton、ModelSelect、PromptInput、MaterialStrip、ResizeFullscreenHandle、FullscreenModal、GeneratingOverlay
- `useConnectedInputs`、`useNodeGeneration`、`nodePrefs`、`useSyncNodeData`、`toastStore`、`filesApi`、`providerStore`、`providerModels`、`chatApi`

**写新节点测试无需新 mock，照抄现有文件结构即可。**

---

## 3. 风险排序与实施建议（明天动手顺序）

### 第一步（低风险，建议先做）：补节点测试
- **P0：VideoProcessNode 35→~200 行**（最急，因为它 1553 行还没测试保护）。
- **P1：GridSplit / GridMerge / ImageNode / LoopNode**。
- 纯新增测试文件，**不改源码**，零回归风险，立刻提升安全感。

### 第二步（中低风险，谨慎做）：拆分 conversationStore
- **不要急着重命名导出**，先按 1.5 的 re-export 聚合层平滑拆（实测仅 4 个源码文件 import，回归面比初判小）。
- **必须抽 `conversationState.js` 共享状态**，否则多文件各持 state 会状态断裂。
- 拆分后用 `conversationStore.test.js`(288行) 跑通做回归验证（它覆盖了大多数导出函数）。
- 一次只拆一个关注点（先拆 F 类 AI 状态，量最大最独立），拆完跑测试再拆下一个。

### 第三步（不建议现在做）
- 重写 17 个节点（风险高、收益低，已有测试 + 基座，缺的是"补齐测试"而非"重写"）。

---

## 4. 决策记录

- **conversationStore**：✅ 建议拆，但用"re-export 聚合层 + 共享 state 层"平滑迁移，不重命名导出。
- **节点测试**：✅ 建议补，P0 先补 VideoProcessNode，纯新增测试零风险。
- **重写节点**：❌ 暂不建议，改为"补测试保护"替代"推倒重写"。

### 审计修正记录（同日复核）

- **函数数**：原写"58 个导出函数" → 修正为 **44 个导出 + 12 个内部 helper = 56 个**。`export function` 实测仅 44 个，多算的 2 个来自 B 类 `persistDebounced` 重复计数。已同步修正 §0 / §1.1 / §1.2。
- **调用面**：原写"10 个文件 import" → 修正为 **仅 4 个源码文件直接 import**（App.jsx / useAgentChat / useCanvasAgentTools / AgentPanel）。`agentCore` / `backupStore` 等仅注释提及。拆分回归面小于原判断，拆分风险等级相应下调（中 → 中低），§3 第二步"谨慎做"可适度放宽为"按 1.5 re-export 分层逐文件拆、每拆一步跑 `conversationStore.test.js` 回归"。

### 实施记录（2026-08-21）

- **conversationStore 拆分已落地**：按 §1.6 抽 `conversationState.js` 为共享 state 底座（自持 states/hydratedSet/currentAgentKey/listeners/persistDebounced + 落盘/订阅/隔离 + normalize 归一化 + useConversationStore/setAgentKey/flushPersist/resetConversationCache/markHydrated）。
  - `conversationSnapshot.js`（D 类）：当前对话快照 workflow/pending/memory。
  - `conversationAiState.js`（F 类）：runMode/global_contract/artifact/undo/pendingGenerations/awaitingConfirm/refImages（量最大，占原文件近半导出）。
  - `conversationImageMap.js`（E 类）：跨轮图三数据源。
  - `conversationStore.js` 瘦身为 A 类 CRUD + 聚合 re-export 入口；**44 个公开导出名与调用方 import 路径均不变**，4 个消费方零改动。
  - 依赖方向单向无环：`state ← { snapshot, aiState } ← { imageMap, store }`。
- **节点测试已补齐**：P0 VideoProcessNode（35→119 行）、P1 GridSplit / GridMerge / ImageNode / LoopNode 增补深度用例（模式切换/校验/来源/内容态/拆分契约）。
- **验证**：全量单元测试 126 文件 / 1478 用例全部通过；`npm run build` 成功。
