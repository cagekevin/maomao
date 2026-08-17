---
title: TASK-048 · 探索「AI 助手链路该走却没走」的缺口
status: done
type: explore
mode: read-only
owner: explorer
readonly: true
no-modify: true
---

# TASK-048 · 探索「AI 助手链路该走却没走」的缺口

> 授权边界（铁律）：本任务**只读不改**，只产出本文档，不修改任何源码、测试或配置。
> 铁律 2：本任务只探索本仓库 AI 助手链路，**不查看其他 TASK 文档**（不在本文件引用其他 TASK 内容，避免污染）。

## 问题描述

（我是探索 Agent，由用户直接发起"做任务"，授权通读相关源码、梳理链路、输出缺口清单，全程不改动任何文件。）

### 问题陈述

当前 AI 助手（画布助手）有一条「用户说一句话 → AI 策划 → 用户确认 → 执行生图」的标准链路。
但代码里存在若干"该走这条链路、却没走"的缺口。本次重点排查三处"该串起来却断了"的地方：

1. **三阶段门禁（策划 / 确认 / 执行）** 有没有真正串起来，还是某个阶段被绕过 / 重复触发 / 状态不同步？
2. **generations 计划** 有没有真正传到执行器（`canvasPlanExecutor.executePlan`），还是中途被吃掉了字段（比如 `attachment_indices`、`dependency_mode`、`use_attachments`）？
3. **刷新后对话恢复**，AI 任务（正在确认 / 正在执行的计划）能否续上，还是刷新后脱节（按钮消失、锁卡死、计划丢失）？

## 探索范围

- `src/components/base/useAgentChat.js`（状态机 / 工具循环 / 刷新恢复 / generations 解析）
- `src/components/base/useCanvasAgentTools.js`（`present_plan_for_confirm` / `execute_plan` 工具实现 + `setPendingGenerations`）
- `src/components/base/conversationStore.js`（`pending` / `pendingGenerations` / `awaitingConfirm` / `workflow` 持久化）
- `src/components/base/canvasPlanExecutor.js`（计划执行 / Wave1+Wave2 / 依赖批改写）
- `src/components/base/inputStateMachine.js`（状态机定义，确认"awaiting_confirm"是否为其一等状态）
- 旁证：`src/components/AgentPanel.jsx`（确认按钮由谁驱动）、`src/components/AgentMessage.jsx`（`awaiting_confirm` 气泡）

---

## 探索发现

### 0. 链路全景（三阶段 + 刷新恢复，先对齐再找缺口）

**阶段1 · 策划 / 暂存**
- LLM 在**正文**放 JSON 计划 → `parseGenerationsFromReply`（`useAgentChat.js` L166–184）解析出 `parsed.generations`，并 `filter((g) => g && typeof g === 'object')`（L181）——**保留整个对象，非白名单裁剪**，字段（含 `attachment_indices`/`use_attachments`）是否在对象里取决于 LLM 是否在正文 JSON 写出。
- LLM 同时在**工具参数** `show_plan_for_confirm.generations` 另传一份 → `presentPlanTool.execute`（`useCanvasAgentTools.js` L692）`setPendingGenerations(gens)`。
- 两份 generation 最终都写入 **同一个** `conversationStore.pendingGenerations`（L411–423，per-conversation 持久化）：
  - `setPendingGenerations`（L76–78）内部直接调 `setActivePendingGenerations`。
  - 因此"正文通道"与"工具参数通道"是**同一份数据的两次写入，后写覆盖前写**。

**阶段2 · 门禁 / 执行**
- `executePlanTool.execute`（`useCanvasAgentTools.js` L729）：
  - L733：`if (getAwaitingConfirm()) return {ok:false, error:'策划尚未确认…'}` —— **唯一**的"确认态"硬门禁点。
  - L738–739：`const pending = getPendingGenerations(); let gens = pending.length ? pending : args.generations` —— **内存暂存优先**，仅当暂存空才用参数兜底。
  - L740：`clearPendingGenerations()`（一进就清暂存）。
  - L741：空 generations 拒绝。
  - L716→`canvasPlanExecutor.executePlan({ctx, generations: gens, ...})` 真正跑节点。

**阶段3 · 确认态**
- `presentPlanTool.execute` 末尾 L694：`setAwaitingConfirm(true)`（写 store，持久化）。
- `useAgentChat.js` L941：`patchCurrentWorkflow({status:'awaiting_confirm'})`（写 store，持久化）。
- `useAgentChat.js` L943：`stateMachineRef.current.setStatus('awaiting_confirm')` → 驱动 UI 的 `stateAction`。
- UI 确认按钮由 **`stateAction === 'awaiting_confirm'`** 驱动（`AgentPanel.jsx` L388 / L310、`AgentMessage.jsx` L184）；用户点确认 → `setAwaitingConfirm(false)`（`useAgentChat.js` L1065 / `AgentPanel.jsx` L310）。

**刷新恢复**
- 挂载 `initEffect`（`useAgentChat.js` L580–589）：`getCurrentPending()` 仅取 `{text, attachments}`，若存在则 `sendRef(pending.text, ...)` 重发，意图"续上任务"。
- `applyConversation` 置 `hydrated=true` 并落盘（`conversationStore.js` L482–497）。
- `inputStateMachine.load`（L45–55）从 `saved.status` 恢复状态，但 **`saved.status` 集合不含 `awaiting_confirm`**（只有 idle/planning/creating_nodes/ready/running/stopping/failed/completed，见 L12、L34）——**确认态不是状态机一等公民**。

---

### 缺口1（P0·严重）· 刷新后"确认态"断裂：按钮消失 + 锁卡死 → 死锁

**现象**：用户停在"策划待确认"界面刷新页面后，确认按钮消失，但任何 `execute_plan` 都被拒，任务卡死。

**根因**：确认态被拆成两套、且只有一套被持久化、恢复时两套没对齐。

- `stateAction` 是 `useAgentChat.js` L501 `useState('idle')`——**纯组件内存态，刷新即归零**。
- `awaitingConfirm`（store，`conversationStore.js` L188 默认 false，L694 置 true 已落盘）与 `workflow.status='awaiting_confirm'`（L941 已落盘）——**持久态，刷新仍在**。
- UI 确认按钮读的是 `stateAction`（`AgentPanel.jsx` L388/310、`AgentMessage.jsx` L184），**不读 store 的 `awaitingConfirm`**。
- 状态机 `inputStateMachine.load`（L45–55）从 `saved.status` 恢复，但 `status` 集合（L12）**根本没有 `awaiting_confirm`**——即使 `workflow.status` 落盘为 `awaiting_confirm`，状态机也恢复不出该态，`stateAction` 无从被驱动回 `awaiting_confirm`。
- 恢复逻辑 L582–589 **只重发 `pending.text`，不重建 `stateAction`**，刷新后 `stateAction='idle'`、确认按钮不出现。
- 此时 `store.awaitingConfirm` 仍为 `true` → 任何 `execute_plan` 被 `useCanvasAgentTools.js` L733 拒（"策划尚未确认"），而界面无确认按钮可解除 → **死锁**。
- 反向铁证：`clear` 时 `useAgentChat.js` L1064–1067 专门重置 `pendingGenerations:null, awaitingConfirm:false`——说明作者已知"`awaitingConfirm` 残留会永久卡死 execute_plan"，但恢复路径未做对称清理/重建。

**该走却没走**：刷新恢复本应把"确认态"完整还原（`stateAction` 回 `awaiting_confirm`、确认按钮重现），实际只重发了文本、没还原确认态。更糟的是，恢复路径"`pending` 存在就重发"与"待确认不重发"语义冲突——`runToolCalls` 内 `pausedForConfirm` 分支（L912–915）刻意**不清空** `pending`，导致刷新后 pending 仍在、被恢复逻辑重发、又跑一轮规划，与已落盘的 `awaitingConfirm=true` 叠加成脏态。

**建议方向（仅描述，不改）**：恢复时若 `getAwaitingConfirm()===true` 或 `workflow.status==='awaiting_confirm'`，应直接把 `stateAction` 置回 `awaiting_confirm` 并重建确认气泡，而非重发 `pending.text`；或恢复逻辑显式区分"待确认"与"待续跑"。

---

### 缺口2（P0·严重）· generations 双写覆盖：`attachment_indices` / `use_attachments` 常被吃掉

**现象**：阶段1 策划的"参考图挂载"偶发失效——`canvasPlanExecutor.js` L263 对 `step.use_attachments===false` 的判定走偏，该带参考图的步没带、或不该带的步混喂。

**根因**：generations 有**两条写入通道，写的是同一份 `pendingGenerations`，后写整体覆盖前写**；而 execute_plan 消费时按"内存优先"读**正文通道**结果。

- 工具参数通道：`useCanvasAgentTools.js` L692 `setPendingGenerations(gens)`（来自 `show_plan_for_confirm.generations`）。
- 正文通道：`useAgentChat.js` L901 `setActivePendingGenerations(replyGens)`（来自 `parseGenerationsFromReply`）。
- 执行顺序：`runToolCalls` L753–761 **先**跑 `show_plan_for_confirm`（写工具参数通道），随后同轮 L899–901 **再**解析正文 JSON 覆盖成 `replyGens`。
- 消费优先级：`executePlanTool` L738–739 **内存暂存优先**，而内存暂存最终是 L901 正文覆盖后的结果（工具参数通道被覆盖）。
- 工具参数 `generations` 的 schema 明确鼓励带 `attachment_indices`（L716："仅当该步要基于某参考图图生图时填"；L725–727："generations 主通道是阶段1 暂存…此参数仅作兜底"）。即 **`attachment_indices`/`use_attachments` 更常在工具参数里给出，而正文 JSON 常省略**。

**问题**：当 LLM 在工具参数里给了完整 `attachment_indices`，但正文 JSON 省略了这些字段时，L901 用不含它们的 `replyGens` **整体覆盖**同一份 `pendingGenerations` → `attachment_indices`/`use_attachments` 被静默丢弃 → 阶段2 拿到的 generation 缺字段 → `canvasPlanExecutor.js` L263 判定失效（字段为 undefined），参考图挂载逻辑走偏。

**该走却没走**：generations 本应"单一可信来源"无损传到执行器，实际是"正文 + 工具参数"双写同一字段、后写整体覆盖、且正文常字段不全 → 关键附件索引在传递途中被覆盖丢。

**建议方向（仅描述，不改）**：统一单一通道（优先工具参数 `generations`，或解析正文时把 `attachment_indices`/`use_attachments`/`count` 纳入并做字段级 merge 而非整体覆盖）；两条来源按 `id` 做字段级合并，而非 `replyGens` 整体覆盖 `setPendingGenerations` 的结果。

---

### 缺口3（P1·中等）· steer 续跑 `execute_plan` 时 generations 已清空 + 确认态/续跑态互斥缺失

**现象**：用户在"执行中"用 steer 补充指令、续跑若再次触发 `execute_plan`，偶发"计划为空"被拒；或"未确认就 steer"时确认态与续跑态互相污染。

**根因**：
- `executePlanTool` L740 一进就 `setActivePendingGenerations(null)`（清空暂存）。
- steer 续跑路径：`useAgentChat.js` L956–962 把用户补充塞进 `pending` + 重发 `next`；若续跑轮 LLM 再次调 `execute_plan`，此时 `pendingGenerations` 已被首次清空，除非 LLM **重传** `generations` 参数，否则命中 L741 空 generations 拒绝。
- 叠加风险：若上轮"展示策划但未确认"就 steer（此时 `awaitingConfirm` 仍为 `true`，L694 未解除），续跑先重发 → 又到 `show_plan_for_confirm` 再次 `setAwaitingConfirm(true)`（L694），与 steer 的 `setCurrentPending`（L957）逻辑打架，确认态与续跑态相互污染。

**该走却没走**：steer 是"运行中补充指令"的标准链路，但续跑若复用 `execute_plan` 会与"一进就清空暂存"冲突；且确认态与 steer 态没有互斥校验。

**建议方向（仅描述，不改）**：steer 续跑不应复用"清空+重跑"的 `execute_plan` 语义；或 `execute_plan` 在 `awaitingConfirm===true` 时应给出与 steer 冲突的明确提示而非静默拒绝。

---

### 缺口4（P1·中等）· 三阶段门禁"确认态"只在 `execute_plan` 单点校验，展示侧不防

**现象**：`show_plan_for_confirm`（展示策划）本身不校验"是否已在确认态"，门禁只在 `execute_plan` 一处（L733）。

- `presentPlanTool.execute` L690–698 **总是** `return {ok:true}`，不读取 `getAwaitingConfirm()` 做前置校验。
- 门禁只存在于 `executePlanTool` L733（awaitingConfirm 时拒）。
- 即"展示策划"对工具循环器永远是成功（ok:true）；若 LLM 在同轮紧接着调 `execute_plan`，靠 L733 拦截（ok:false）让循环器停。门禁是**单点、单向**：展示侧无对称校验。

**风险**：门禁不对称，难以推理"重复展示是否会重复置态/重复建节点"；若工具循环器对 `show_plan_for_confirm` 的 ok:true 处理有差异，确认态约束可能被绕过。

**该走却没走**：三阶段门禁本应是"策划→确认→执行"对称闭环，实际确认态只在执行入口拦一刀，展示侧不设防。

**建议方向（仅描述，不改）**：`show_plan_for_confirm` 在 `getAwaitingConfirm()===true` 时应直接拒绝（避免重复展示/重复置态），与 `execute_plan` 门禁对称。

---

### 缺口5（P2·轻）· 刷新恢复靠"重发副作用"重建上下文，且 `artifacts`/`global_contract` 未持久化

**现象**：刷新后参考图上下文与跨步资产可能不一致或丢失。

- 恢复逻辑 L582–589 用 `sendRef(pending.text, ...)` → 内部 `send` 在 L854–861 重建 `refCatalog` 并 `setCurrentRefImages`。该路径**可用**，但依赖"重发"这一副作用来重建参考图上下文，而非从持久化的 `referenceImages`（`conversationStore.js` L440–454，已持久化）直接恢复。
- `pending.attachments` 经 `normalizePending`（L206–213）归一化，可能丢失原始元（如必应来源 `origin`），导致 `refCatalog` 重影/去重不一致（边界）。
- **延伸遗漏**：`execute_plan` 的 `artifacts`（跨步资产，L723）与 `global_contract`（风格契约，L722）**仅存在于本次调用参数**，`presentPlanTool` 未将其写入持久化 `pending`（L692 只传 `generations`）。一旦进入确认态刷新或 steer 续跑，暂存里只有 `generations`、无 `artifacts`/`global_contract` → `canvasPlanExecutor` 消费时这两项为 undefined（虽有 L246–251 global_contract 兜底，但 `artifacts` 无兜底 → 依赖步 `input_artifact_ids` 注入参考图失效）。

**该走却没走**：`generations` 进了持久化暂存，但配套的 `artifacts`/`global_contract`/`referenceImages` 上下文未整体持久化，刷新/续跑时链路断裂。

**建议方向（仅描述，不改）**：将 `artifacts`/`global_contract` 与 `generations` 一并写入 per-conversation 持久化暂存；恢复时直接从持久化 `referenceImages` 重建上下文，而非靠"重发副作用"。

---

### 附：已正确实现、但易误判为缺口的点（澄清，避免误改）

1. **generations 主通道确实是正文 JSON**（L901），工具参数 `args.generations` 是兜底双保险——但正是"双保险写同一份字段"造成了缺口2 的覆盖问题。
2. **刷新恢复确实会重发 `pending.text`**（L582），"任务续跑"基本可用；但**确认态**（缺口1）和 **generations 双写覆盖**（缺口2）是实质漏洞，不是"完全没接"。
3. **`canvasPlanExecutor` 的依赖批改写**（`buildFusionPrompt` / `buildProductReferencePrompt`，L115–135）已正确按 `dependency_mode` 重建下游 prompt，并做了"融合兜底 / 套图自动识别"（L335–380），这部分链路是通的。
4. **`execute_plan` 的 global_contract 双保险**（L246–251）在执行层兜底锁统一风格契约，即使规划层漏带也会补——这部分是通的（`artifacts` 缺兜底见缺口5）。
5. **`pendingGenerations` / `awaitingConfirm` / `referenceImages` 均为 per-conversation 持久化**（`conversationStore.js` L186–454），设计上已防跨对话泄漏；问题不在"是否持久化"，而在"确认态是否被状态机/UI 正确消费与对齐"（缺口1/3/5）。

---

## 结论（缺口优先级与修复顺序）

| 优先级 | 缺口 | 一句话 | 关键证据 |
|--------|------|--------|----------|
| P0 | 缺口1 | 刷新后确认态断裂：按钮消失 + 锁卡死，任务死锁 | L501(stateAction内存态) / L188+L694(持久awaitingConfirm) / inputStateMachine L12无awaiting_confirm / L1064–1067反向铁证 |
| P0 | 缺口2 | generations 双写覆盖：`attachment_indices`/`use_attachments` 常被打掉 | L692(setPendingGenerations) vs L901(覆盖) / L738–739内存优先 / L716 schema 鼓励参数带索引 |
| P1 | 缺口3 | steer 续跑 `execute_plan` 时 generations 已清，确认态/续跑态互斥缺失 | L740清空 / L956–962续跑 / L694重复置态 |
| P1 | 缺口4 | 三阶段门禁只 `execute_plan` 单点校验，展示侧不防 | L690–698无校验 / L733单点门禁 |
| P2 | 缺口5 | 刷新靠重发副作用重建上下文；`artifacts`/`global_contract` 未持久化 | L582–589重发 / L206–213归一化 / L692只传generations |

**修复建议顺序**（仅描述，本任务不改）：先收口两个 P0——（a）缺口1：恢复逻辑识别 `awaitingConfirm/workflow.status` 并重建 `stateAction`，而非盲目重发；（b）缺口2：generations 按 `id` 字段级合并两通道、取消"正文整体覆盖工具参数"。P1 两项的对称门禁与 steer 互斥随后补。P2 顺带把 `artifacts`/`global_contract` 纳入持久化暂存。

> 本探索为只读产出，未修改任何文件。如需进入"修复"阶段，应另开 TASK。
