# spec/TECH-DEBT.md · 技术债登记（单一固定文件）

> **定位**：全仓库唯一的技术债留痕文件。由「系统治理5步法」Step 7 主动追加，也可由任何 AI 在发现"现在不能动、但确是债"时追加。**单一文件、只追加、不分散、不建 ADR**（CLAUDE.md 决策铁律）。
> **读者**：下一个 AI。目的是让债可见、不被聊天淹没、不被误删。
> **不写**：备选方案否决理由（属决策过程，不落盘）；讲"为什么这么设计"的注释不挪到这里（留原处）。

## 登记格式

每条债固定结构（复制追加，不删既有条）：

```
### [TD-<序号>] <一句话现象>
- 状态：待处理 / [已解决 <日期>]
- 现象：<现在观察到的问题>
- 根因：<为何产生 / 是哪个前置闸门漏了>
- 为何现在不动：<风险 / 依赖 / 时机未到>
- 建议处理时机：<什么条件下再动>
- 登记于：<日期> · 来源：<系统治理 / 写码时发现>
```

**防膨胀规则**：债还清后**标记 `[已解决 <日期>]` 而非删除**（保留"曾是什么坑"的决策价值）；本文件只追加、只标状态，不整体清空。`Temp/governance-*.md` 是一次性快照，可过期清理，非权威。

## 已登记债

### [TD-1] refToken.js 参考图 token 编解码实现后未接入
- 状态：待处理
- 现象：`src/components/base/refToken.js`（encodeRefToken / parseRefTokensFromText）全仓无任何 import，仅 agentCore / useCanvasAgentTools 注释提及。
- 根因：对齐大雄 token 编解码时实现了该模块；但实际跨轮用图链路走 `conversationStore` 的 `getCurrentImageMap`（useCanvasAgentTools execute_plan 反查），refToken 未被接线。
- 为何现在不动：文件头自述是有意实现（对齐大雄表示层差距②），可能是预留/半成品；删前需确认"是否近期要接 token 化"，误删会丢决策价值。
- 建议处理时机：确认"跨轮图记忆"已稳定走 getCurrentImageMap 后可归档 refToken；或真正接入时接线。
- 登记于：2026-08-21 · 来源：系统治理

### [TD-2] workflowRuntime.js 工作流运行时有意预留但无调用方
- 状态：待处理
- 现象：`src/components/base/workflowRuntime.js`（createWorkflow 生命周期 API）无外部 import；eventBus.js:17-18 注释明示「⚠️ 预留广播，勿当 bug 删」。
- 根因：工作流运行时作为统一生命周期权威实现，已开发完成，但当前画布工作流仍由 useAgentChat / canvasPlanExecutor 各自管理，未迁移到 workflowRuntime。
- 为何现在不动：eventBus 明确标注预留广播，属有意预留；强行动会触发未接线的重构风险。
- 建议处理时机：下次工作流状态管理重构（多任务/回滚/确认态收口）时接入；在那之前保留。
- 登记于：2026-08-21 · 来源：系统治理
