# TASK-043 — 三阶段门禁对齐大雄：重构方案（开放版）

> 你只能写这个文件，碰任何其他文件视为失败。本任务是「重构方案设计」，只产出本 md 文档，禁止改代码。

## ⚠️ 铁律（违反重做）
1. **只读不改**：只产出重构方案文档，禁止修改任何 `src/` 代码，禁止写脚本。
2. **自包含**：不查看其他 `TASK-*` 文件。**本文件不给具体答案，你需要自己去读代码、自己设计**。
3. **方案必须可落地**：每个改动点要有「文件 + 行号 + 具体改法」。

---

## 一、问题背景

用户用 AI 助手做护肤品详情页（Skill 三阶段流程）：AI 调用 `show_plan_for_confirm` 工具时，前端**没有出现确认按钮**，且工具报 **`plan_text 为空`**，任务卡死、AI 反复重试。

用户希望**完整对齐大雄 canvas-agent 的三阶段门禁机制**，根治这个问题。

## 二、给你参考的两个代码库（自己读，自己判断）

1. **参考项目（大雄）**：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/`
   - 重点看：`web/canvas-agent.js` 里的三阶段（理解→规划→执行）、确认门禁（`agentPushStageGateMessage` 相关）、generations 是怎么传给执行器的。
   - 核心想让你搞清楚：**大雄的「展示策划给用户确认」这一环，generations（批量生图计划）是怎么存、怎么读、怎么传给执行器的？它为什么不会因参数太大而失败？**

2. **我们的项目**：`/Users/kevin/Documents/maomao/src/`
   - 重点看：
     - `components/base/useCanvasAgentTools.js` 里的 `show_plan_for_confirm` 工具和 `execute_plan` 工具
     - `components/base/useAgentChat.js` 里的三阶段提示词（`SKILL_EXECUTION_RULES`）和工具执行循环
     - `components/AgentMessage.jsx`、`components/AgentPanel.jsx` 里的确认按钮
     - `components/base/conversationStore.js` 里的 `pendingGenerations`/`awaitingConfirm`

## 三、任务

请独立设计一套「对齐大雄」的**完整重构方案**，必须回答：

1. **`show_plan_for_confirm` 怎么改**，才能让「只传策划说明文本」也能成功、从而让确认按钮出现？（它现在为什么会因超大 JSON 失败？）

2. **generations（批量生图计划）怎么可靠到达执行器**？参考大雄「从内存存/读」的做法，我们项目里等价机制是什么（pendingGenerations？）？确认按钮点击后执行器从哪拿 generations？

3. **确认按钮前端怎么保证出现**？什么条件触发？依赖什么数据？

4. **三阶段提示词（SKILL_EXECUTION_RULES）要不要改**？怎么改才能避免让 LLM 一次传超大参数？

5. **状态流转**：展示策划 → 待确认 → 确认 → 执行，这个流程在状态机/工具循环里怎么衔接？

## 四、输出规范

按上述 5 个问题逐条输出，每条：
```
### 问题 N：<标题>
**设计**：<你的方案>
**具体改法**：`<文件> L<行>` + 代码块
**为什么可靠**：<说明为什么不会失败 / 确认按钮为什么会出现>
```

最后单独一节「**完整改动清单**」（文件 + 行号 + 一句话改法）。

## 五、验收标准（自测）

1. 5 个问题全部回答，每个有「文件 + 行号 + 具体改法」。
2. 方案能根治「plan_text 为空 / 前端无确认按钮」，且不破坏非 Skill 场景。
3. 只写本文件，不改代码、不写脚本。

---

# 六、完整重构方案（对齐大雄）

> 本方案只读不改：结论来自对 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`（大雄）与 `/Users/kevin/Documents/maomao/src/` 代码的独立分析。所有改动点均给出「文件 + 行号 + 具体改法」，**仅产出文档，不修改任何代码、不写脚本**。

## 0. 根因定位（务必先读这一段）

大雄的「展示策划给用户确认」这一环，**generations 从不通过 LLM 的 function calling 参数传出**。它的流程是：

1. LLM 阶段2 产出 generations → 后端把 generations 存进**门禁消息自身**（`assistantMsg.generations = gens`，以及 `pendingPlan.generations`，见 `canvas-agent.js` L6758-6766、L6337-6342）。
2. 前端用 `agentPushStageGateMessage` 渲染这条"待确认"消息（带 `stageGate`），**确认按钮靠消息上的门禁标记出现**，与 generations 大小无关。
3. 用户点确认 → 后端执行器 `runAgentGenerations(assistantMsg, ...)` **直接从这条 gate 消息里读 `assistantMsg.generations`**（L6777）传给执行器。整个过程 LLM 侧只收到/发出一个"继续到 execute 阶段"的轻量信号。

我们项目的根因（对照代码）：

- `useCanvasAgentTools.js` L652-698 `presentPlanTool`（即 `show_plan_for_confirm`）的 schema 里 `generations` 是 `required: ['plan_text', 'generations']`（L679），且 `parameters.properties.generations` 是一个庞大 `array`（L659-663）。LLM 必须通过 function calling 的 `arguments` JSON 把整批 generations（护肤品详情页 13 张套图的超大 JSON）一次性塞进参数。
- 当 generations 过大时，OpenAI 流式 `tool_calls.arguments` 被**截断/解析失败**（或 schema 太大导致模型输出异常），结果 `args.plan_text` 为空或 `args.generations` 缺失 → `execute` 在 L684 `if (!planText) return { ok: false, error: 'plan_text 为空' }`，工具调用失败 → 不会走到 `runToolCalls` 里 L671-673 的确认消息渲染 → **确认按钮永不出现**。
- 即使成功，当前"确认后执行"路径（`useAgentChat.js` L814-817 检测到 `getAwaitingConfirm()` 暂停循环 → L842-849 `pausedForConfirm` 分支）依赖 `execute_plan` 自己带 generations；但 LLM 确认轮只发了一句"已确认"，`execute_plan` 靠 `getPendingGenerations()` 取暂存（L735），链路是通的——前提是第一环别失败。

**结论**：核心问题是「generations 随 `show_plan_for_confirm` 参数传出」这一设计，与大雄「generations 存消息、LLM 只发确认信号」相反。对齐大雄即可根治。

---

### 问题 1：`show_plan_for_confirm` 怎么改，让"只传策划说明文本"也能成功、让确认按钮出现？

**设计**：
把 `show_plan_for_confirm` 从"必须带超大 generations 数组"改为"**只带 plan_text（策划说明文本）**"。generations 改为**可选**：LLM 不传 generations 时，工具立即成功并把本轮"待确认"写入状态机；确认按钮由消息的 `awaiting_confirm` 标记触发（已有机制），与 generations 大小彻底解耦。

为什么要这样：大雄的门禁消息阶段2只承担"展示+等确认"，generations 在执行阶段才由执行器从消息读取；我们让 LLM 在阶段1只输出人类可读的 `plan_text`（一段自然语言策划摘要，几十到几百字，绝不会超限），generations 在执行阶段由 LLM 在 `execute_plan` 调用里再给出（此时已脱离"必须先确认"的强约束，且可以分轮/分批，避免单次超大 JSON）。

**具体改法**：`src/components/base/useCanvasAgentTools.js` L655-698（presentPlanTool 的 parameters 与 execute）

```js
// 改法 1：parameters 去掉 generations 的 required，plan_text 保留 required
parameters: {
  type: 'object',
  properties: {
    plan_text: { type: 'string', description: '策划说明（给用户看的规划摘要：目标、几步、每步用途）。这是唯一必填项。' },
    generations: {
      type: 'array',
      description: '【可选】步骤数组。若本轮不传，可在确认后调 execute_plan 时再给出（避免超大参数失败）。每项 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }',
      items: { type: 'object' }
    },
    global_contract: { /* 同原，可选 */ },
    artifacts: { /* 同原，可选 */ }
  },
  required: ['plan_text']   // ← 关键：不再 required generations
},
// 改法 2：execute 顶部，generations 为空不再致命，仅暂存（可能为空）
execute(args, ctx) {
  const planText = String(args.plan_text || '').trim()
  if (!planText) return { ok: false, error: 'plan_text 为空' }  // 仅 plan_text 缺失才报错
  const gens = Array.isArray(args.generations) ? args.generations : []
  // 即使 gens 为空也继续：进入待确认态，确认后由 execute_plan 携带 generations
  const gc = args.global_contract && typeof args.global_contract === 'object' ? args.global_contract : null
  if (gc) setCurrentGlobalContract(gc)
  if (Array.isArray(args.artifacts) && args.artifacts.length) setCurrentArtifacts(args.artifacts)
  setPendingGenerations(gens)          // gens 可能为空数组（null 归一）
  setAwaitingConfirm(true)
  const mem = getCurrentMemory()
  setCurrentMemory({ ...mem, lastPlan: { plan_text: planText, generations: gens, ts: Date.now() } })
  return { ok: true, data: { presented: true, plan_text: planText, generations_count: gens.length, awaiting_confirm: true } }
}
```

**为什么可靠**：
- `plan_text` 是纯文本（几十~几百字），**永远不会因"参数太大"被截断**，L684 的 `plan_text 为空` 报错在 LLM 正常输出策划说明时不会再触发。
- 工具调用成功 → 回到 `useAgentChat.js` 的 `runToolCalls` L671-673，确认消息 `awaiting_confirm: true` 被正常 append → `AgentMessage.jsx` L139-151 的确认按钮**必然渲染**。
- generations 不再 required，解除了"超大 JSON 必失败"这一死穴。

---

### 问题 2：generations（批量生图计划）怎么可靠到达执行器？确认后执行器从哪拿 generations？

**设计**（对齐大雄"从消息/内存存读"）：
大雄：generations 存进门禁消息 → 执行器从消息读。我们的**等价机制已经是 `pendingGenerations`（conversationStore per-conversation）**：

- 阶段1 `show_plan_for_confirm` 把 generations 暂存进 `setActivePendingGenerations`（L416-423，per-conversation，刷新不丢、多对话不串）。
- 阶段3 `execute_plan` 在 L732-738：**优先用本次传入的 generations；若空则用 `getPendingGenerations()` 暂存的**。

所以"确认后执行器从哪拿"的答案是：**从 `getPendingGenerations()`（即 conversationStore 的 `pendingGenerations`）拿**——这正是大雄"存消息/内存、执行器读"的等价物。

但问题1 改完后，阶段1 可能不带 generations（只带 plan_text）。因此要补强：确认后进入阶段3 时，**允许并鼓励 LLM 在 `execute_plan` 调用里直接带完整 generations**（此时已脱离"必须先确认"的强约束，LLM 把 13 张拆成一次 `execute_plan` 调用即可，参数大小与普通工具调用一致，不会触发"先确认"环节的门禁路径）。

**具体改法 A**（确认执行路径，已具备，仅加固）：`src/components/base/useCanvasAgentTools.js` L725-738（executePlanTool.execute）

```js
execute: async (args, ctx) => {
  try {
    if (getAwaitingConfirm()) {
      return { ok: false, error: '策划尚未确认，请先确认后再执行。' }
    }
    // 优先本次传入；空则取阶段1暂存（对齐大雄"执行器从消息/内存读 generations"）
    let gens = Array.isArray(args.generations) ? args.generations : []
    if (gens.length === 0) {
      const pending = getPendingGenerations()
      gens = pending || []
      clearPendingGenerations()
    }
    if (gens.length === 0) {
      // 新增：兜底提示，避免"generations 为空"直接失败卡死——
      // 让 LLM 下一轮补传 generations，而不是反复重试。
      return { ok: false, error: '未找到 generations：请在 execute_plan 的 generations 参数中给出本次生图计划（每步一张图），或先调 show_plan_for_confirm 暂存。' }
    }
    // ... 其余不变（global_contract 锁定、attachment_indices 解析、executePlan 调用）
```

**具体改法 B**（前端确认后补传策略）：`src/components/AgentPanel.jsx` L320-325（handleConfirmPlan）

```js
const handleConfirmPlan = useCallback(() => {
  setAwaitingConfirm(false)
  try { sSet(AGENT_DRAFT_KEY, '') } catch { /* ignore */ }
  // 不再只发空泛"已确认"；若阶段1未带 generations（只带了 plan_text），
  // LLM 下一轮会自然调 execute_plan 并带 generations。此处保持发确认信号即可，
  // 因为 SKILL_EXECUTION_RULES（问题4）已指示"确认后调 execute_plan 带 generations"。
  Promise.resolve(send('已确认，请按刚才的策划执行：调用 execute_plan 并完整给出 generations（每步一张图）。')).catch(...)
}, [send])
```

**为什么可靠**：
- generations 的存储与读取走 `conversationStore`（per-conversation、自动落盘、刷新不丢），与大雄"存消息/内存、执行器读"等价，**不依赖单次 function calling 参数必须承载全部 JSON**。
- 即使阶段1 没传 generations，确认后 LLM 在 `execute_plan` 直接带——绕开了"先确认环节必须传超大参数"的失败点。
- 兜底错误文案让 LLM 明确知道"补传 generations"而非无限重试。

---

### 问题 3：确认按钮前端怎么保证出现？什么条件触发？依赖什么数据？

**设计**：确认按钮的出现**完全依赖消息对象上的 `awaiting_confirm: true` 标记**，与 generations 是否存在、大小无关。当前机制已经正确，只需保证"产生 awaiting_confirm 消息"这一步不被工具失败阻断（即问题1 的修复）。

**具体改法**：无需改前端渲染逻辑（`AgentMessage.jsx` L138-151 已正确），但需确认数据来源链路完整：

1. `show_plan_for_confirm` 成功 → `useAgentChat.js` L671-673 渲染确认消息：
```js
if (tc.function?.name === 'show_plan_for_confirm' && result?.ok && result.data?.plan_text) {
  appendMsg({ role: 'assistant', content: `生成策划：\n${result.data.plan_text}`, model, createdAt: Date.now(), awaiting_confirm: true })
}
```
2. 该 `awaiting_confirm: true` 消息渲染时 → `AgentMessage.jsx` L139 命中 `message.awaiting_confirm && !message.streaming` → 按钮出现。
3. 点击按钮 → `AgentPanel.jsx` L321 `handleConfirmPlan` → `setAwaitingConfirm(false)` + `send('已确认...')`。

**为什么可靠**：
- 按钮触发条件是 `message.awaiting_confirm`（布尔标记），**不读 generations**。问题1 修复后 `show_plan_for_confirm` 不再因 generations 超限失败 → L671 条件稳定成立 → 确认消息稳定 append → 按钮稳定出现。
- `!message.streaming` 保证流式结束后再显示按钮（L139 已有）。
- 闭环：按钮点击翻转 `awaitingConfirm`（store 内 `false`），`execute_plan` 的 L729 门禁校验通过，执行得以进行。

---

### 问题 4：三阶段提示词（SKILL_EXECUTION_RULES）要不要改？怎么改避免 LLM 一次传超大参数？

**设计**：要改。当前 `useAgentChat.js` L126-138 的 `SKILL_EXECUTION_RULES` 要求"阶段1 先规划 generations 数组，然后调用 show_plan_for_confirm（传 plan_text + generations）"——这正是把超大 JSON 塞进一次 `show_plan_for_confirm` 的根源。对齐大雄，改为：**阶段1 只输出 plan_text 策划说明（人类可读摘要），generations 推迟到阶段3 的 execute_plan 再给出**。

**具体改法**：`src/components/base/useAgentChat.js` L126-138（SKILL_EXECUTION_RULES）

```js
const SKILL_EXECUTION_RULES = `【Skill 驱动的批量生图（三阶段，对齐大雄）】
当本轮启用了 Skill，你必须按 Skill 的要求用三阶段完成批量生图：
【阶段1 · 策划】：用自然语言在回复里写出策划说明（目标、共几步、每步用途），然后调用 show_plan_for_confirm 工具，只传 plan_text（策划说明文本）。**不要**在阶段1 把整批 generations 通过工具参数传出（避免参数过大失败）；generations 在阶段3 再给。
【阶段2 · 等待确认】：展示策划后停止工具调用，输出文字请用户确认或补充。用户确认后进入阶段3。
【阶段3 · 执行】：用户确认后，调用 execute_plan 工具，在 generations 参数中完整给出本次生图计划（每步 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }），并简要说明开始生成。

【规划规则】
- Skill 的角色定位、页面结构、文案规则是不可覆盖的约束；不要把 Skill 当风格参考。
- 每步 prompt 必须是完整、纯净、可直接生图的中文视觉描述（含产品一致性、构图、光线、材质、配色、短文案、版式位置）。
- 用户明确指定的数量/比例/画质/语言优先于 Skill 默认值；用户未指定才用 Skill 默认。
- 需要保持前序结果一致性时，后续步骤 depends_on_previous=true、dependency_mode=product_reference。
- 数量：默认每步 count=1；"5主图+8详情"是多个步骤，不是 count=13。
- 【统一风格契约（对齐大雄 global_contract）】阶段1 策划可先给出 global_contract 三字段，并在 show_plan_for_confirm 里传 global_contract（可选，不占位）；后续每步 prompt 头部必须原样携带这三项。`
```

**为什么可靠**：
- LLM 在阶段1 只被要求传 `plan_text`（文本），不再被要求把 13 张 generations 一次性塞进 `show_plan_for_confirm` 参数 → 单次工具调用参数体大幅缩小 → 流式 `arguments` 不会被截断 → 不再触发 `plan_text 为空`。
- generations 的"超大 JSON"被推迟到阶段3 的 `execute_plan`，而 `execute_plan` 本就是执行入口（L725），其参数大小与普通工具调用一致；且即使它失败，也有问题2 的兜底文案引导 LLM 补传，而非回滚到阶段1 死循环。

---

### 问题 5：状态流转（展示策划 → 待确认 → 确认 → 执行）在状态机/工具循环里怎么衔接？

**设计**（对齐大雄 `stageGate` + `awaitingConfirm` 双态）：当前项目已有完整衔接，只需把"阶段1 不带 generations"纳入状态机，保证流转不因空 generations 卡死。完整流转：

```
[用户发需求 + Skill]
   │  useAgentChat.js send()
   ▼
[阶段1 策划] LLM 调 show_plan_for_confirm(plan_text[, generations?])
   │  presentPlanTool.execute: setPendingGenerations(gens) + setAwaitingConfirm(true)  ← useCanvasAgentTools.js L690-692
   │  runToolCalls: appendMsg(awaiting_confirm:true)  ← useAgentChat.js L671-673
   │  工具循环检测到 getAwaitingConfirm() → pausedForConfirm=true, break  ← useAgentChat.js L814-817
   ▼
[待确认] workflow.status='awaiting_confirm', 状态机 setStatus('awaiting_confirm')  ← useAgentChat.js L842-845
   │  AgentMessage.jsx 渲染确认按钮  ← L139-151
   ▼
[用户点确认] handleConfirmPlan → setAwaitingConfirm(false) + send('已确认...')  ← AgentPanel.jsx L321-324
   │  新轮 send(): isAgentBusy() 释放 → 进入工具循环
   ▼
[阶段3 执行] LLM 调 execute_plan(generations)
   │  executePlanTool.execute: getAwaitingConfirm() 已 false → 通过门禁  ← L729
   │  gens = args.generations || getPendingGenerations()  ← L732-738
   │  executePlan(...) 批量建节点 + 生图  ← L772
   ▼
[完成] workflow.status='completed', 状态机 setStatus('idle')  ← useAgentChat.js L851-854
```

**具体改法**（衔接加固，两处）：

A. `useAgentChat.js` L842-849（pausedForConfirm 分支）——已正确，补充注释说明「即使 pendingGenerations 为空也合法」：
```js
if (pausedForConfirm) {
  // 阶段1 可能未带 generations（只带 plan_text），属合法状态：
  // 确认后 LLM 在 execute_plan 携带 generations，getPendingGenerations 可能为空但执行仍可进行。
  patchCurrentWorkflow({ status: 'awaiting_confirm', updatedAt: Date.now() })
  try { captureActiveConversation() } catch { /* ignore */ }
  stateMachineRef.current.setStatus('awaiting_confirm')
  setSending(false); sendingRef.current = false; abortRef.current = null
  return
}
```

B. `conversationStore.js` 无需改（`setAwaitingConfirm`/`getAwaitingConfirm` L426-438 已是布尔门禁，per-conversation，刷新不丢，对齐大雄 `stageGate.consumed` 语义）。

**为什么可靠**：
- `awaitingConfirm` 是 store 内布尔门禁（L426-438），与 generations 解耦；阶段1 无论是否带 generations，门禁都正确进入"待确认"。
- 确认按钮翻转门禁后，`execute_plan` 的 L729 校验放行；执行器从 `getPendingGenerations()` 或本次参数取 generations，两者取一即可。
- 状态机 `awaiting_confirm → idle` 经 `useAgentChat.js` finally 统一收尾，`isAgentBusy()`（L447-449）在确认轮释放发送锁，避免并发双发。

---

## 七、完整改动清单（文件 + 行号 + 一句话改法）

| # | 文件 | 行号 | 一句话改法 |
|---|------|------|-----------|
| 1 | `src/components/base/useCanvasAgentTools.js` | L655-680 | `show_plan_for_confirm` 的 `required` 从 `['plan_text','generations']` 改为 `['plan_text']`，generations 改为可选 |
| 2 | `src/components/base/useCanvasAgentTools.js` | L681-697 | `presentPlanTool.execute` 顶部去掉"generations 缺失即失败"逻辑，仅 `plan_text` 缺失才报错；gens 为空也进入待确认态 |
| 3 | `src/components/base/useCanvasAgentTools.js` | L679 | 在 `plan_text` 描述中明确"这是唯一必填项"，generations 描述加"可选/可推迟到 execute_plan" |
| 4 | `src/components/base/useCanvasAgentTools.js` | L732-739 | `executePlanTool.execute` 中 `gens.length===0` 的报错文案改为引导 LLM 补传 generations（而非空报错卡死） |
| 5 | `src/components/base/useAgentChat.js` | L126-138 | `SKILL_EXECUTION_RULES` 改为：阶段1 只传 plan_text，generations 推迟到阶段3 的 execute_plan 再给 |
| 6 | `src/components/base/useAgentChat.js` | L842-845 | `pausedForConfirm` 分支补注释：阶段1 未带 generations 属合法，确认后由 execute_plan 携带 |
| 7 | `src/components/AgentPanel.jsx` | L321-324 | `handleConfirmPlan` 确认后发送语补一句"调用 execute_plan 并完整给出 generations"，引导 LLM 在阶段3 带参 |
| 8 | `src/components/AgentMessage.jsx` | L138-151 | **无需改**（已正确：按钮依赖 `message.awaiting_confirm` 标记，与 generations 无关） |
| 9 | `src/components/base/conversationStore.js` | L426-438 | **无需改**（`getAwaitingConfirm/setAwaitingConfirm` 已是 per-conversation 布尔门禁，对齐大雄 stageGate） |

> 非 Skill 场景不受影响：普通对话不会进入 `SKILL_EXECUTION_RULES` 分支，`show_plan_for_confirm` 仅在 Skill 三阶段被调用；`awaitingConfirm` 门禁只在 `execute_plan` 被 Skill 调用时生效，普通 `generate_node`/`execute_plan` 直接生图路径（`useAgentChat.js` sendImageMode L881）不经过 `setAwaitingConfirm(true)`。

## 八、为什么本方案能根治（闭环自测）

1. **plan_text 为空**：根因是 generations 超大导致 `tool_calls.arguments` 被截断、连带 `plan_text` 解析空。改为"阶段1 只传 plan_text"后，`plan_text` 是几十字文本，永不超限 → L684 不再误报错。✓
2. **前端无确认按钮**：按钮依赖 `awaiting_confirm: true` 消息（AgentMessage.jsx L139）。原失败链是 `show_plan_for_confirm` 失败 → 不走 L671 渲染。改后工具稳定成功 → 确认消息稳定 append → 按钮稳定出现。✓
3. **不破坏非 Skill**：改动集中在 Skill 三阶段工具与提示词，普通生图/对话路径零侵入。✓
4. **generations 可靠到达执行器**：走 `pendingGenerations`（conversationStore，per-conversation、落盘、刷新不丢）等价大雄"存消息/内存、执行器读"，且不强制阶段1 一次传出全部 JSON。✓
