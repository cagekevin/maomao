# TASK-042 — 三阶段门禁对齐大雄：重构方案（独立稿 B）

> 你只能写这个文件，碰任何其他文件视为失败。本任务是「重构方案设计」，只产出本 md 文档，禁止改代码。

## ⚠️ 铁律（违反重做）
1. **只读不改**：只产出重构方案文档，禁止修改任何 `src/` 代码，禁止写脚本。
2. **自包含**：本文件已含所有参考与现状，不需要也不得查看其他 `TASK-*` 文件。
3. **方案必须可落地**：每个改动点要给出「文件 + 行号 + 具体改法（before→after 代码块）」。

---

## 一、问题背景

用户做护肤品详情页（Skill 三阶段流程）：AI 调用 `show_plan_for_confirm` 工具时，传了 11 个 generations 的超大 JSON，工具报 **`plan_text 为空`**，导致：
- 确认门禁没建立，前端**没有可点击的确认按钮**；
- 任务卡死，AI 反复重试。

## 二、根因（已定位）

我们 `show_plan_for_confirm` 是 LLM 工具，强制 LLM 把 `generations`（多个含长 prompt 的对象）塞进 `tool_calls.arguments`。JSON 太大，SSE 流式传输/解析失败（`args` 变空对象 → `plan_text` 判空）→ 工具失败 → 门禁断裂。

## 三、大雄的机制（参考基准，请据此对齐）

参考：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`

- 大雄用**前端本地构造门禁消息** `agentPushStageGateMessage`（L6313）：`planText`/`generations`/`taskSpec` 从内存 `pendingPlan` 直接拿（L6337-6355），`awaiting_confirm` 状态机（L6367）。**generations 不经过 LLM 工具 args 传输。**
- 确认按钮由前端渲染 `options`（L6299），点击后 `agentContinueFromPlanGate`（L6726）从内存 `pendingPlan.generations` 拿 gens（L6761）→ `runAgentGenerations`（L6777）。**generations 全程不重传、不走工具 args。**

核心：**generations 由前端/内存管理，不让 LLM 通过工具参数传超大 JSON。**

## 四、我们现有实现（改动基准，已核实行号）

| 文件 | 关键点 | 行号 |
|---|---|---|
| `src/components/base/useCanvasAgentTools.js` | `presentPlanTool`（show_plan_for_confirm 工具，generations 是 required 参数） | L652-698 |
| 同上 | `presentPlanTool.execute`：`setPendingGenerations(gens)` + `setAwaitingConfirm(true)` | L689-692 |
| 同上 | `executePlanTool`：从 `getPendingGenerations()` 读 generations（第 2 优先级） | L734-738 |
| `src/components/base/useAgentChat.js` | `SKILL_EXECUTION_RULES` 三阶段提示词 | L126-134 |
| 同上 | `runToolCalls` show_plan_for_confirm 成功 → appendMsg `awaiting_confirm:true` | L671-673 |
| `src/components/AgentMessage.jsx` | 确认按钮渲染 | L138-151 |
| `src/components/AgentPanel.jsx` | `handleConfirmPlan`：setAwaitingConfirm(false) + send('已确认，请按策划执行') | L321-325 |
| `src/components/base/conversationStore.js` | `setPendingGenerations`/`getPendingGenerations`/`setAwaitingConfirm`/`getAwaitingConfirm` | 已存在 |

## 五、任务：设计一套「对齐大雄」的完整重构方案

请在文档中给出**可直接落地**的重构方案，覆盖以下问题：

1. **`presentPlanTool`（show_plan_for_confirm）如何瘦身**：generations 是否从 `required` 移除？`execute` 如何容错（plan_text 非空即成功）？给出具体代码改法。

2. **generations 如何可靠到达 execute_plan**：确认大雄「generations 从内存 pendingPlan 拿」在我们项目的等价实现。我们的 `getPendingGenerations()`（conversationStore）如何配合？确认按钮点击后 execute_plan 怎么拿 generations（从暂存读，还是 AI 重传）？分析两种路径的可靠性。

3. **确认门禁前端如何保证出现按钮**：`show_plan_for_confirm` 成功后如何确保 `AgentMessage` 渲染「确认，按此执行」按钮？`awaiting_confirm` 消息追加（L671-673）是否依赖 generations 传输成功？如何让门禁只依赖 plan_text？

4. **`SKILL_EXECUTION_RULES` 提示词怎么改**：让 LLM 阶段1 只传 plan_text、generations 精简或确认后再传，避免超大 JSON。

5. **执行顺序/状态机**：show_plan_for_confirm → awaiting_confirm → 确认 → execute_plan 的状态流转是否要改？`send` 主循环的三阶段门禁 break（L794-808）是否保留？

## 六、输出规范

按上述 5 个问题逐条输出，每条格式：
```
### 问题 N：<标题>
**设计**：<方案说明>
**具体改法**：`<文件> L<行>` + before→after 代码块（3-15 行）
**可靠性分析**：<为什么这样不会因超大 JSON 失败 / 如何保证确认按钮出现>
```

最后单独一节「**完整改动清单**」，列出所有要改的文件 + 行号 + 一句话改法。

## 七、验收标准（自测）

1. 5 个问题全部有输出，每个有「文件 + 行号 + before→after 代码块」。
2. 方案能保证：`show_plan_for_confirm({ plan_text })` 只传文本也成功、前端确认按钮出现、确认后 execute_plan 能拿到 generations。
3. 不改变非 Skill 场景行为。
4. 只写本文件，不改代码、不写脚本。
