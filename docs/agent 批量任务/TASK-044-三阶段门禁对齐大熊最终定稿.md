# TASK-044 — 三阶段门禁对齐大雄：最终定稿（合并 TASK-040/041/043 查漏补缺）

> 本文合并三份方案（040 主稿 + 041 独立稿A + 043 开放稿），经查漏补缺，产出**最终可实施**的重构方案。

## 一、最终结论（三份方案融合）

| 来源 | 贡献 |
|---|---|
| **TASK-040（我）** | 问题背景、大雄机制、现状行号、目标框架 |
| **TASK-041（AI-A）** | **关键审计**：`setPendingGenerations([])` 实际存 `null`（conversationStore L77-78），若阶段1 完全不传 generations，内存 null → 阶段3 execute_plan 拿空 → 执行失败。故**不能简单让 LLM"阶段1 不传 generations"**。提出 A/B 分层（A 层参数瘦身+内存优先+重传兜底，B 层前端本地规划）。 |
| **TASK-043（AI-C，开放稿）** | 最彻底瘦身：阶段1 只传 plan_text，generations 推迟到阶段3 execute_plan 传。但**其阶段3 execute_plan 也要传大 JSON，可能再次失败**（未完全根治）。 |

**最终采用：041 的 A 层 + 043 的门禁只依赖 plan_text**，即：

- **门禁（show_plan_for_confirm）只依赖 plan_text**（几十字文本，永不超限）→ 确认按钮必出现（043 的诉求）。
- **generations 保留"阶段1 尽量传 + 暂存内存"通道**（041 的保留），阶段3 execute_plan **内存非 null 优先**（避免阶段3 再传大 JSON）→ 根治"阶段3 也传大 JSON"（041 的诉求）。
- **阶段3 兜底**：内存 null 时才允许 LLM 在 execute_plan 重传（041）。
- **B 层（前端本地规划 generations）**作为二期（041 建议，本期不做，工作量中等）。

## 二、改动清单（最终可实施）

### 改动 1：`presentPlanTool`（show_plan_for_confirm）参数瘦身
文件：`src/components/base/useCanvasAgentTools.js` L652-698
- `required` 从 `['plan_text', 'generations']` 改为 `['plan_text']`（L679）。
- `execute`（L681-697）：仅 `plan_text` 非空即成功；generations 可选（LLM 传了就暂存，没传存 null 由阶段3 兜底）；返回加 `generations_stashed` 标记。

### 改动 2：`executePlanTool`（execute_plan）读取优先级：内存优先
文件：`src/components/base/useCanvasAgentTools.js` L732-739
- 从「args 优先」改为「**内存非 null 优先**」：`getPendingGenerations()` 非空则用内存（避免阶段3 再传大 JSON），否则用 `args.generations` 兜底。
- `gens` 为空时错误文案改为引导 LLM 补传（而非空报错卡死）。

### 改动 3：确认消息追加只依赖工具成功
文件：`src/components/base/useAgentChat.js` L671-673
- 条件从 `result?.ok && result.data?.plan_text` 改为 `result?.ok`（门禁与 plan_text/generations 传输解耦）。

### 改动 4：`SKILL_EXECUTION_RULES` 提示词
文件：`src/components/base/useAgentChat.js` L126-138
- 阶段1：`show_plan_for_confirm` **必须传 plan_text（门禁唯一必需项）**；generations **尽量一并传**（系统会暂存供阶段3 直接用）；明确"不要因 generations 过大反复重试"。
- 阶段3：execute_plan **若系统提示 generations 为空才重传**，否则直接执行（内存已暂存）。

### 改动 5：前端确认按钮（无需改）
- `AgentMessage.jsx` L138-151、`AgentPanel.jsx` L321-325 保持。
- 确认后 `handleConfirmPlan` 发 `send('已确认，请按刚才的策划执行：调用 execute_plan 并完整给出 generations（每步一张图）')`（041/043 建议引导 LLM 阶段3 带参，若内存已暂存则 LLM 可省略）。

## 三、验收标准

1. `show_plan_for_confirm({ plan_text })` 只传文本也成功，前端出现「确认，按此执行」按钮。
2. 确认后 execute_plan 能拿到 generations（内存优先，或重传兜底）。
3. 不破坏非 Skill 场景（普通 create_node/generate_node/execute_plan 直连）。
4. `npx vitest run` 全绿，`npm run build` 通过。

## 四、硬约束

- 只改：`useCanvasAgentTools.js`、`useAgentChat.js`；`AgentMessage.jsx`/`AgentPanel.jsx` 视情况微调文案。
- 保留 `setPendingGenerations`/`getPendingGenerations`/`setAwaitingConfirm`/`getAwaitingConfirm` 现有接口。
