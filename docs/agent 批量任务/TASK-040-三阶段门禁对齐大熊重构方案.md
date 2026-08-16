# TASK-040 — 三阶段门禁完整对齐大雄：重构方案（主稿/基准）

> 本文是**重构方案文档**，不是剖析报告。目标是让 maomao 的「show_plan_for_confirm → 确认门禁 → execute_plan」三阶段流程完整对齐大雄 canvas-agent，根治「AI 传超大 generations 导致 plan_text 为空、前端无确认按钮」的问题。

## 一、问题（用户反馈）

用户做护肤品详情页（Skill 三阶段）：AI 调用 `show_plan_for_confirm` 时传了 11 个 generations 的超大 JSON，工具报 **`plan_text 为空`**，导致：
- `awaiting_confirm` 门禁没建立；
- 前端**没有出现可点击的确认按钮**；
- 任务卡死，AI 反复重试。

## 二、根因

我们 `show_plan_for_confirm` 是 **LLM 工具**，强制 LLM 把 `generations`（11 个含长 prompt 的对象）塞进 `tool_calls.arguments`。这个 JSON 太大，SSE 流式传输/解析失败（`args` 解析为空对象 → `plan_text` 判空）→ 工具失败 → 门禁断裂。

大雄规避此问题：**generations 不走 LLM 工具 args**，而是由前端本地从内存读取。

## 三、大雄机制（参考基准，已核实）

参考文件：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`

1. **阶段1（understand）**：LLM 普通回复输出策划正文（含 generations 结构），前端解析，generations 存内存 `pendingPlan`（L6337-6344）。
2. **门禁消息**：`agentPushStageGateMessage`（L6313）**前端本地构造**，`planText`/`generations`/`taskSpec` 从内存直接拿（L6337-6355），`awaiting_confirm` 状态机（L6367）。**不经过工具 args 传输**。
3. **确认按钮**：前端渲染 `options`（L6299 `agentBuildStageGateOptions`：确认策划并继续/切换全自动/修改策划），点击事件 L4067-4086。
4. **确认后**：`agentContinueFromPlanGate`（L6726）从内存 `pendingPlan.generations` 拿 gens（L6761），构造执行消息 → `runAgentGenerations`（L6777）。**generations 全程不重传、不走工具 args**。

## 四、我们现有实现（改动基准，已核实行号）

| 文件 | 关键点 | 行号 |
|---|---|---|
| `src/components/base/useCanvasAgentTools.js` | `presentPlanTool`（show_plan_for_confirm 工具，参数含 generations 超大 JSON） | L652-698 |
| 同上 | `presentPlanTool.execute`：`setPendingGenerations(gens)` 暂存 + `setAwaitingConfirm(true)` + 写 memory.lastPlan | L689-696 |
| 同上 | `executePlanTool`：从 `getPendingGenerations()` 读 generations（第 2 优先级） | L734-738 |
| `src/components/base/useAgentChat.js` | `SKILL_EXECUTION_RULES` 三阶段提示词（要求阶段1 调 show_plan_for_confirm 传 plan_text + generations） | L126-134 |
| 同上 | `runToolCalls` 里 show_plan_for_confirm 成功 → appendMsg `awaiting_confirm:true` | L671-673 |
| 同上 | `send` 主循环：执行 show_plan_for_confirm 后 `getAwaitingConfirm()` → break（三阶段门禁暂停） | L794-808 |
| `src/components/AgentMessage.jsx` | 确认按钮渲染（`message.awaiting_confirm && !message.streaming`） | L138-151 |
| `src/components/AgentPanel.jsx` | `handleConfirmPlan`：`setAwaitingConfirm(false)` + `send('已确认，请按策划执行')` | L321-325 |
| 同上 | AgentMessage 传入 `onConfirmPlan={handleConfirmPlan}` | L536 |
| `src/components/base/conversationStore.js` | `setPendingGenerations`/`getPendingGenerations`/`setAwaitingConfirm`/`getAwaitingConfirm` | 已存在 |

## 五、目标设计（对齐大雄）

**核心原则：generations 不走 LLM 工具 args。**

### 改动 1：`presentPlanTool`（show_plan_for_confirm）参数瘦身
- `generations` 参数**改为可选**（从 `required` 移除），`plan_text` 保持必填。
- `execute` 逻辑：即使 `args.generations` 为空，只要 `plan_text` 非空就成功（展示策划 + 进入 awaiting_confirm）。
- generations 不再由本工具必须携带；确认后由 execute_plan 从 `getPendingGenerations()` 读。

### 改动 2：generations 的暂存来源
- 方案：**generations 仍由 LLM 在阶段1 通过 show_plan_for_confirm 传，但作为「最后手段」；主路径是确认后 execute_plan 携带 generations**。
- 关键：**show_plan_for_confirm 不再强制要求 generations**，避免超大 JSON 传输失败；LLM 可分两次：先 show_plan_for_confirm（只 plan_text），确认后 execute_plan（带 generations）。
- 但 execute_plan 的 generations 也大——所以**确认按钮不应触发"让 AI 重传 generations"**，而应直接从暂存读。

### 改动 3：确认门禁前端构造（对齐大雄 `agentPushStageGateMessage`）
- 当 `show_plan_for_confirm` 成功（plan_text 非空），前端把 plan_text 展示 + 渲染确认按钮（现状 AgentMessage 已支持 `awaiting_confirm`）。
- **确认按钮点击后**：不依赖 AI 重传 generations。execute_plan 从 `getPendingGenerations()` 读（已有机制 L734-738），若 show_plan_for_confirm 成功时已暂存过则可用。
- 若 show_plan_for_confirm 成功但没暂存 generations（只传 plan_text），确认后 AI 调 execute_plan 时需带 generations。

### 改动 4：`SKILL_EXECUTION_RULES` 提示词修正
- 阶段1 明确：`show_plan_for_confirm` **只传 plan_text（策划说明）**，generations 在**用户确认后**由 execute_plan 传入（或阶段1 精简传入但控制体积）。
- 避免让 LLM 一次传 11 个长 prompt 的超大 JSON。

### 改动 5：前端确认按钮 + 确认后执行
- `AgentMessage` 确认按钮已存在（L138-151），保持。
- `AgentPanel.handleConfirmPlan`：`setAwaitingConfirm(false)` + `send('已确认，请按策划执行')`，保持。
- 确认后 AI 调 execute_plan 时，generations 从 `getPendingGenerations()` 读（若阶段1 已暂存）或 AI 重新带。

## 六、改动文件清单（最小集）

1. `src/components/base/useCanvasAgentTools.js`：presentPlanTool 参数瘦身 + execute 容错。
2. `src/components/base/useAgentChat.js`：SKILL_EXECUTION_RULES 提示词修正。
3. `src/components/AgentMessage.jsx`：确认按钮（确认是否够用，可能无需改）。
4. `src/components/AgentPanel.jsx`：handleConfirmPlan（确认是否够用，可能无需改）。

## 七、验收标准

1. AI 调用 `show_plan_for_confirm({ plan_text: '...' })`（只传文本）成功，不再报 `plan_text 为空`。
2. 成功后前端出现「确认，按此执行」按钮（`awaiting_confirm` 门禁建立）。
3. 点击确认 → execute_plan 正常执行（generations 从暂存/重传获取）。
4. 不改变非 Skill 场景（普通 create_node/generate_node）行为。
5. `npx vitest run` 全绿，`npm run build` 通过。

## ⚠️ 硬约束
- 只改上述 4 个文件，禁止改其他文件。
- 不删已有机制（setPendingGenerations/setAwaitingConfirm 保留）。
- 行号仅作参考，实际以打开文件核实为准。
