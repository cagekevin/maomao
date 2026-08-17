# TASK-055 探索：状态机与会话并发收口缺口

> 模式：仅探索 + 产出本篇，禁止改代码 / 禁止写脚本。
> 日期：2026-08-17
> 范围：AI 助手（agent）链路的「输入状态机 + 多会话并发收口」是否存在会双发 / 串台 / 跨会话阻塞的缺口。
> 本文档经二次审计修正：纠正了 Gap C 的触发条件表述，补入原遗漏的 genParams 模块级单例缺口，并精确定位所有读写的"当前对话"均依赖全局 `activeId`（而非显式 conversationId）。

## 0. 核心机制事实（审计基准，避免误报）

1. **per-conversation 数据存储已下沉**：`conversationStore` 中每个会话对象 `conv` 自带 `pendingGenerations`、`awaitingConfirm`、`referenceImages`、`workflow`、`aiUndoStack` 等字段（`conversationStore.js:184-189`），数据本身按会话隔离，**切换会话不会把 A 的数据写进 B 的存储**。
2. **但所有"读/写当前对话"的函数都通过 `getActiveConv()` 解析**：`getActiveConv() = conversations.find(c => c.id === getState().activeId)`（`conversationStore.js:255-257`）。即它们依赖**全局 `activeId`**，而非调用方显式传入 `conversationId`。
   - 这意味着：**只要在一次异步 LLM 调用进行中切换了激活会话，`setActivePendingGenerations(replyGens)`（`useAgentChat.js:901`）等地会写到"新激活的会话"而非"正在跑的那个会话"**。
3. **生图参数 `genParams` 是模块级单例**：`let genParams = loadGenParams()`（`useCanvasAgentTools.js:41`），注释明确"模块级单例"（`useCanvasAgentTools.js:22-27`），`execute_plan` 经 `getGenParams()`（`:746`）读取，作为批量出图默认参数。它**不按会话隔离**，持久化在全局 key `canvasAgentGenParams`（`:29`）。
4. **`executingPlan` 是模块级全局单飞锁**：`let executingPlan = false`（`canvasPlanExecutor.js:21`），不区分会话。
5. **`asyncGuard` 的单飞/超时能力目前只被媒体加载复用**（VideoProcessNode / imageCompress / PanoramaNode），agent 对话链路未接入（`grep asyncGuard` 仅 3 处）。

## 1. 已确认健康（非缺口，避免误报）

- **输入状态机 `InputStateMachine` 是 per-conversation 实例**：`load(conversationId, saved)` 切换对话隔离状态（`inputStateMachine.js:44-55`），`steerQueue` 挂在 per-conversation `workflow`（`useAgentChat.js:823-832`），切对话不会把 A 的排队指令喂给 B。
- **生图并发已有上限**：`taskStore.runNodeGeneration` 用 `MAX_CONCURRENT_GEN=6` 限流并按 `nodeId` 去重，不会同节点重复进 running。
- **发送入口有复合忙判定** `isAgentBusy() = sendingRef || stateMachine.isRunning()`（`useAgentChat.js:493-495`），单实例下挡双发。
- **`executingPlan` 有 `finally` 兜底释放**（`canvasPlanExecutor.js:451-453`），正常不死锁。
- **`execute_plan` 有确认态硬约束**：`getAwaitingConfirm()` 为真则直接拒绝（`useCanvasAgentTools.js:733-735`），未确认不会出图。
- **`execute_plan` 执行即清空 pending**（`useCanvasAgentTools.js:740 clearPendingGenerations()`），确认态被消费一次即失效。

## 2. 缺口清单（按严重度）

### Gap A（高）：`executingPlan` 全局单飞锁 → 跨会话阻塞

- 证据：`canvasPlanExecutor.js:21` 模块级 `executingPlan`；`:209` 进入即 `if (executingPlan) return { workflow:{status:'failed', error:'已有计划正在执行，请稍后再试'} }`；`:211` 置 `true`；`:451-453` `finally` 释放。
- 问题：锁不区分 `conversationId`。会话 A 整段计划执行期间，会话 B 任何 `execute_plan` 都会被判失败（"已有计划正在执行"），即便 A、B 无关。AI 收到 `failed` 后可能自我纠错重试，造成无谓往返。
- 触发条件：两个会话在相近时间各自走到 `execute_plan` 阶段。
- 建议方向（仅描述）：改为 `Map<conversationId, boolean>` 或下沉到 per-conversation workflow 状态做单飞。

### Gap B（中）：生图参数 `genParams` 模块级单例 → 跨会话参数污染（原文档遗漏，本次补入）

- 证据：`useCanvasAgentTools.js:41` `let genParams = loadGenParams()` 为模块级变量；`:29` 持久化 key `canvasAgentGenParams` 全局；`:746` `execute_plan` 经 `getGenParams()` 读取作默认 provider/model/ratio/resolution；注释 `:22-27` 自述"模块级单例"。
- 问题：会话 A 正在执行计划、会话 B 在面板改了生图参数 → `setGenParams()`（`:42-44`）改写全局 `genParams`，会话 A 后续步骤（`executePlan` 内分批 `runNodeGeneration`）读到的是 B 的参数（模型/比例/分辨率），造成 A 出图参数被 B 污染。
- 触发条件：多会话并行且各自改过生图参数面板。
- 建议方向：生图参数下沉 per-conversation（并入 `conv` 或 `conv.workflow`），`execute_plan` 按当前会话读取。

### Gap C（中）："当前对话"全部依赖全局 `activeId` → 异步进行中切换会话会写错会话

- 证据：`getActiveConv()` 用全局 `getState().activeId`（`conversationStore.js:255-257`）；`setActivePendingGenerations(replyGens)` 在 LLM 循环内调用（`useAgentChat.js:901`），`getAwaitingConfirm()`/`setAwaitingConfirm()`（`conversationStore.js:426-438`）、`getActivePendingGenerations()`（`:411-413`）全部经它解析。
- 原描述修正：此前说"切到 B 再回 A 点确认会拿 B 的 generations"**不准确**——数据已 per-conversation 存储，切回 A 时 `getActiveConv()` 仍是 A，数据仍在 A，确认通常正确。
- 真实风险：若用户在**某次 `send()` 的异步 LLM 轮次仍在进行时**切到会话 B（此时全局 `activeId` 变 B），则本轮 `setActivePendingGenerations(replyGens)`（`:901`）会把本属于 A 的 generations 写到 B 的 `pendingGenerations`，污染 B，而 A 的 `pendingGenerations` 留空 → A 后续 `execute_plan` 走"generations 为空"兜底分支（`:741-743`）；同理 `setAwaitingConfirm(true)` 会写到 B。
- 触发条件：发送后、LLM 流式/工具循环返回前，切换激活会话（后台标签/多面板场景）。
- 建议方向：`setActivePendingGenerations` / `setAwaitingConfirm` 等写入函数应接收显式 `conversationId`（或在 `send` 入口捕获本会话 id 后透传），而非依赖全局 `activeId`。

### Gap D（中）：确认态不挡 `isAgentBusy()`，连点确认有体验瑕疵

- 证据：`RUNNING = new Set(['planning','creating_nodes','ready','running'])`（`inputStateMachine.js:34`），**不含 `awaiting_confirm`**；因此 `isAgentBusy()`（`:493-495`）不把"待确认"视为忙。
- 现状：设计上有意让 `send()` 在确认态走 `steer` 排队分支（`:823-832`），不打断。且 `execute_plan` 入口有硬约束（`:733-735`），首轮确认 `execute_plan` 后 `clearPendingGenerations()`（`:740`）已清空，故**连点确认不会双发出图**。
- 瑕疵：若快速连点确认，第一轮消耗 pending 执行成功；第二轮 `execute_plan` 读到空 pending → 返回"generations 为空"错误（`useCanvasAgentTools.js:741-743`），AI 会向用户报一条错误。属体验/健壮性瑕疵，非数据损坏。
- 建议方向：确认态 consume 后，前端禁用确认按钮直至新一轮收敛；或在 `execute_plan` 空 pending 时区分"已消费"与"真为空"。

### Gap E（低）：`asyncGuard` 能力未复用于对话链路

- 证据：`asyncGuard.js` 提供 `withTimeout`/`isTimeoutError`/单飞语义，目前仅媒体加载 3 处使用。
- 说明：属架构一致性机会，可用于 Gap A（per-conversation 单飞）与超时兜底，非缺陷。

### Gap F（低）：`submitLocked` 死字段

- 证据：`inputStateMachine.js:39,52` 状态含 `submitLocked:false`，但 `snapshot()`（`:58-65`）不返回它，`isRunning()`（`:68-70`）只查 `RUNNING` 集合，全仓 grep `submitLocked` 仅此 2 处。
- 说明：字段已设但未在任何判定中被读取，形同死字段。建议清理或接入（例如把"提交锁"纳入 `isRunning()` 语义）。

## 3. 优先级与建议落点（仅规划，不在本任务实施）

| 缺口 | 严重度 | 典型触发场景 | 建议落点 |
|---|---|---|---|
| A 全局单飞锁 | 高 | 多会话并行执行计划 | `canvasPlanExecutor.js` 改 per-conversation 单飞 |
| B genParams 模块级 | 中 | 多会话并行 + 各自改生图参数 | 生图参数下沉 per-conversation |
| C activeId 隐式依赖 | 中 | 发送中切换会话 | 写入函数显式传 conversationId |
| D 确认态不挡 busy | 中（体验） | 连点确认 | 前端禁用 + 空 pending 区分 |
| E asyncGuard 未复用 | 低 | 架构一致性 | 工具/计划链路接入 |
| F submitLocked 死字段 | 低 | 代码整洁 | 清理或接入 |

## 4. 验证线索（供后续实施任务回归）

- 回归点（Gap A）：会话 A 执行计划期间，会话 B 调 `execute_plan` 应**不被** "已有计划正在执行" 误杀。
- 回归点（Gap B）：会话 A 执行中、会话 B 改生图参数，A 出图参数不应被 B 覆盖。
- 回归点（Gap C）：会话 A `send()` 后、LLM 轮次返回前切到 B，A 的 `pendingGenerations`/`awaitingConfirm` 不应被写进 B。
- 回归点（Gap D）：连点确认只触发一次有效 `execute_plan`，且不向用户报"generations 为空"错误。
- 涉及文件：`src/components/base/canvasPlanExecutor.js`、`src/components/base/useCanvasAgentTools.js`、`src/components/base/useAgentChat.js`、`src/components/base/inputStateMachine.js`、`src/components/base/conversationStore.js`、`src/components/base/taskStore.js`、`src/components/base/asyncGuard.js`。

---
*本篇为 TASK-055 探索交付物（审计修正版）。未修改任何代码、未运行任何脚本。*
