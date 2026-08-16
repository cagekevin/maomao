# TASK-042 — 三阶段门禁对齐大雄：重构方案（独立稿 B，审计优化版）

> 你只能写这个文件，碰任何其他文件视为失败。本任务是「重构方案设计」，只产出本 md 文档，禁止改代码。
> 本文件为**自包含重构方案**，不依赖其他 TASK 文件。

## ⚠️ 铁律（违反重做）
1. **只读不改**：只产出重构方案文档，禁止修改任何 `src/` 代码，禁止写脚本。
2. **自包含**：本文件已含所有参考与现状。
3. **方案必须可落地**：每个改动点给出「文件 + 行号 + 具体改法（before→after 代码块）」。

---

## 零、现状核真（已读源码对齐，行号为当前真实行）

| 文件 | 关键点 | 行号 |
|---|---|---|
| `src/components/base/useCanvasAgentTools.js` | `presentPlanTool`（show_plan_for_confirm 工具，`generations` 是 `required`） | L652-698 |
| 同上 | `presentPlanTool.execute`：`setPendingGenerations(gens)` + `setAwaitingConfirm(true)` | L689-692 |
| 同上 | `executePlanTool`：第1优先级用传入 generations，空则取 `getPendingGenerations()`（第2优先级） | L733-738 |
| 同上 | `setPendingGenerations/getPendingGenerations/clearPendingGenerations` 包装 conversationStore 的 `setActivePendingGenerations/getActivePendingGenerations` | L76-84 |
| `src/components/base/useAgentChat.js` | `SKILL_EXECUTION_RULES` 三阶段提示词 | L126-138 |
| 同上 | `runToolCalls` show_plan_for_confirm 成功 → 追加 `awaiting_confirm:true` 消息，条件 `result.ok && result.data?.plan_text` | L671-673 |
| `src/components/AgentMessage.jsx` | 确认按钮渲染，条件 `message.awaiting_confirm && !message.streaming` | L138-151 |
| `src/components/AgentPanel.jsx` | `handleConfirmPlan`：`setAwaitingConfirm(false)` + `send('已确认，请按刚才展示的策划执行。')` | L321-325 |
| `src/components/base/conversationStore.js` | `getActivePendingGenerations/setActivePendingGenerations/getAwaitingConfirm/setAwaitingConfirm`（per-conversation 落盘，刷新不丢、多对话不串） | L411-438 |
| `src/components/base/useAgentChat.js` | `send` 主循环三阶段门禁 break：`show_plan_for_confirm` 后停循环等用户确认 | L794-808+ |

**核真结论（关键）**：
- 我们**已有**对齐大雄的内存暂存机制：`presentPlanTool` 已把 `generations` 暂存进 `conversationStore.pendingGenerations`（per-conversation，刷新不丢），`executePlanTool` 已支持「空 generations → 从暂存读」（L733-738）。这等价于大雄「`generations` 从内存 `pendingPlan` 拿，不走工具 args 重传」。
- 确认按钮已只依赖 `awaiting_confirm` 消息与 `plan_text` 成功返回（L671-673），**不依赖 generations 传输成功**。
- 真正破防点只有一个：`presentPlanTool.parameters.required` 含 `'generations'`（L679）。LLM 被强制把 11 个含长 prompt 的 generations 塞进 `tool_calls.arguments` → SSE 流式 JSON 过大解析失败 → `args` 变 `{}` → `plan_text` 判空 → 工具返回失败 → 门禁断裂。

**审计补充（优化版新增，封死漏洞）**：
- 初稿曾提议「`generations` 从 required 移除 + 提示词允许阶段1 不传 generations」。但经审计发现这会导致**危险中间态**：若 LLM 阶段1 只传 `plan_text`、确认后 `execute_plan` 也未传 generations，则暂存空 + 未传 → 执行报 `generations 为空`。此路径不可落地。
- **修正策略**：`generations` 从 `required` 移除（改可选，解除 SSE 解析失败），但提示词**强约束阶段1 必须传 generations（走暂存）**，确认后 `execute_plan` 不传（从暂存取）。即「schema 放宽以容错、提示词收紧以保送达」，双保险而非二选一。

因此本方案**不需要推翻现有架构**，只需「瘦身 `presentPlanTool` 的 required + 提示词强约束阶段1 送达 + 门禁条件加固」，即可让 `show_plan_for_confirm({ plan_text, generations })` 稳定成功、按钮出现、确认后 generations 从暂存取。

---

## 一、问题1：`presentPlanTool`（show_plan_for_confirm）如何瘦身

**设计**：把 `generations` 从 `required` 移除（改可选），解除「缺字段即被运行时/SDK 拒绝」的硬约束，让超大 generations 即便解析异常也不至于让 `plan_text` 丢失。但**保留 generations 在 schema 中**，配合提示词引导 LLM 阶段1 仍传（详见问题4）。`execute` 主体逻辑不变（仍 `setPendingGenerations` 暂存、仍 `setAwaitingConfirm(true)`），唯一硬约束仍是「`plan_text` 非空即成功」。

**具体改法**：`src/components/base/useCanvasAgentTools.js` L679（required 行）

before:
```js
    required: ['plan_text', 'generations']
```
after:
```js
    // generations 改可选：解除"缺字段被拒"的硬约束，避免超大 JSON 解析异常拖累 plan_text。
    // 送达仍由 SKILL_EXECUTION_RULES 强约束阶段1 传入（走内存暂存，见问题2/4）。
    required: ['plan_text']
```

**可靠性分析**：移除 `required` 后，LLM 调 `show_plan_for_confirm` 通过函数调用 schema 校验，不再因缺 `generations` 字段被 SDK 拒绝；即使 generations 因过大解析为 `[]` 或部分丢失，`plan_text` 仍稳定抵达 → 工具稳定 `ok:true` → 门禁消息稳定追加。generations 的**完整送达**由问题4 提示词 + 问题2 暂存路径保证，不依赖本处 required。

---

## 二、问题2：generations 如何可靠到达 execute_plan

**设计**：我们项目已有等价于大雄 `pendingPlan.generations` 的内存机制——`conversationStore.setActivePendingGenerations`（per-conversation，落盘、刷新不丢、多对话不串），由 `presentPlanTool.execute` 在阶段1 写入（L690）。`executePlanTool.execute` 已实现「第1优先级用本次传入的 generations；为空则 `getPendingGenerations()` 取暂存并 `clearPendingGenerations()`」（L733-738）。这正是大雄「确认后从 `pendingPlan.generations` 拿，全程不重传」的等价。

两条路径对比：
- **路径 A（AI 重传）**：`execute_plan({ generations })` 直接带 generations。风险：和阶段1 同样可能超大 JSON 解析失败；且用户确认后 LLM 再生成一遍 11 项数组易出错/与暂存不一致。**不推荐**。
- **路径 B（从暂存读，默认，对齐大雄）**：确认后 `execute_plan()` 不带 generations，`executePlanTool` 自动从 `getPendingGenerations()` 取。优势：generations 全程不重传、不走工具 args，彻底规避超大 JSON 风险。前提：阶段1 已成功写入暂存（由问题4 提示词强约束保证）。

**闭环兜底**：若阶段1 暂存为空且 `execute_plan` 也未传（极端异常），`executePlanTool` 现有 L739 `if (gens.length === 0) return { ok: false, error: 'generations 为空' }` 会返回明确错误，前端 tool 卡片可展示「重试」——不会卡死无提示。此分支**保留，无需改**，作为最后防线。

**具体改法**：`src/components/base/useCanvasAgentTools.js` L733-738 — 逻辑已正确，仅补注释固化「路径 B 为默认、对齐大雄」，属意图声明而非行为改动：

before:
```js
      // 优先用本次传入的 generations；若空则用阶段1 show_plan_for_confirm 暂存的（Skill 三阶段）
      let gens = Array.isArray(args.generations) ? args.generations : []
      if (gens.length === 0) {
        const pending = getPendingGenerations()
        gens = pending || []
        clearPendingGenerations()
      }
```
after:
```js
      // 路径 A：优先用本次传入的 generations（AI 重传，兼容老行为，不推荐）。
      let gens = Array.isArray(args.generations) ? args.generations : []
      if (gens.length === 0) {
        // 路径 B（默认，对齐大雄）：从阶段1 内存暂存取，全程不重传、不走工具 args。
        const pending = getPendingGenerations()
        gens = pending || []
        clearPendingGenerations()
      }
```

**可靠性分析**：路径 B 的 generations 来自 `conversationStore`（per-conversation Zustand，落盘 localStorage），不经由 LLM 工具 args，彻底规避超大 JSON 风险。阶段1 一旦 `execute` 返回 `ok`，`setPendingGenerations(gens)`（L690）即写入当前对话；用户确认后 `handleConfirmPlan` 只翻转 `awaitingConfirm`（L322），不清除暂存，故 `execute_plan` 读到的就是阶段1 的同一个数组。双保险（问题1 schema 放宽 + 问题4 提示词强约束阶段1 送达）确保暂存非空，路径 B 稳定命中。

---

## 三、问题3：确认门禁前端如何保证出现按钮

**设计**：现状已正确——`runToolCalls` 在 `show_plan_for_confirm` 返回 `ok` 且 `result.data?.plan_text` 存在时追加 `awaiting_confirm:true` 的 assistant 消息（L671-673）；`AgentMessage` 据此渲染「确认，按此执行」按钮（L138-151）。**按钮出现与 generations 是否传输成功完全无关**。加固点：把 L671 的 `result.data?.plan_text` 判空改为「`result?.ok` 即追加」，使门禁建立与 `plan_text` 字段解耦（防止未来 `data.plan_text` 因裁剪为空而漏渲染按钮）。

**具体改法**：`src/components/base/useAgentChat.js` L671-673

before:
```js
      if (tc.function?.name === 'show_plan_for_confirm' && result?.ok && result.data?.plan_text) {
        appendMsg({ role: 'assistant', content: `生成策划：\n${result.data.plan_text}`, model, createdAt: Date.now(), awaiting_confirm: true })
      }
```
after:
```js
      // 门禁只依赖工具是否成功（result?.ok），不再依赖 plan_text 字段，
      // 与 presentPlanTool 已移除 generations 强约束保持一致：plan_text 为空时工具本就返回 ok:false，不会到此。
      if (tc.function?.name === 'show_plan_for_confirm' && result?.ok) {
        const planText = result.data?.plan_text || '（策划已生成，请确认）'
        appendMsg({ role: 'assistant', content: `生成策划：\n${planText}`, model, createdAt: Date.now(), awaiting_confirm: true })
      }
```

**辅助说明（无需改动，仅证明确认 UI 与 generations 无关）**：`src/components/AgentMessage.jsx` L138-151 按钮条件 `message.awaiting_confirm && !message.streaming` 只认 `awaiting_confirm`，不读 generations。

**可靠性分析**：门禁建立条件收敛为「`show_plan_for_confirm` 工具 `ok:true`」。由于问题1 已让该工具只依赖 `plan_text` 成功，而 `plan_text` 又不再因超大 generations JSON 解析失败而丢失，门禁消息必然追加 → `AgentMessage` 必然渲染按钮。整条链路与 generations 体积彻底解耦。

---

## 四、问题4：`SKILL_EXECUTION_RULES` 提示词怎么改

**设计**：重写阶段1/阶段3 指令，达到两个目标：(1) 告知 LLM `show_plan_for_confirm` 只需 `plan_text` 即可建立门禁（缓解其对超大 JSON 的顾虑）；(2) **强约束**阶段1 仍须把完整 `generations` 传进 `show_plan_for_confirm`（走系统暂存），确认后 `execute_plan` **不传** generations（自动从暂存取）。以此封死「两处都空」的危险中间态——这是与初稿「允许阶段1 不传」的关键修正。三阶段结构、global_contract 约束不变。

**具体改法**：`src/components/base/useAgentChat.js` L126-130（SKILL_EXECUTION_RULES 前三行）

before:
```js
const SKILL_EXECUTION_RULES = `【Skill 驱动的批量生图（三阶段，对齐大雄）】
当本轮启用了 Skill，你必须按 Skill 的要求用三阶段完成批量生图：
【阶段1 · 策划】：先规划一个可执行的 generations 数组（每张图一个步骤），每步含 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }，然后调用 show_plan_for_confirm 工具（传 plan_text 策划说明 + generations）把策划展示给用户确认。**不要**在阶段1直接 execute_plan。
【阶段2 · 等待确认】：展示策划后停止工具调用，输出文字请用户确认或补充。用户确认后进入阶段2。
【阶段3 · 执行】：用户确认后，调用 execute_plan 工具（传 generations 数组）执行，并简要说明开始生成。
```
after:
```js
const SKILL_EXECUTION_RULES = `【Skill 驱动的批量生图（三阶段，对齐大雄）】
当本轮启用了 Skill，你必须按 Skill 的要求用三阶段完成批量生图：
【阶段1 · 策划】：先规划 generations 数组（每张图一个步骤），每步含 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }。然后调用 show_plan_for_confirm 工具：**必须同时传 plan_text（策划摘要）和完整 generations 数组**——generations 会被系统暂存，供确认后执行，无需你重复构造。show_plan_for_confirm 仅凭 plan_text 即可建立确认门禁，但 generations 必须在此步一并传入以确保执行时有数据。**不要**在阶段1直接 execute_plan。
【阶段2 · 等待确认】：展示策划后停止工具调用，输出文字请用户确认或补充。用户确认后进入阶段2。
【阶段3 · 执行】：用户确认后，调用 execute_plan 工具执行——**不要**再传 generations 数组（系统自动用阶段1 暂存的），仅简要说明开始生成即可。
```

**可靠性分析**：提示词形成双保险——schema 侧 `generations` 可选（问题1，容错解析异常），提示词侧强约束阶段1 必传（保送达）。LLM 在阶段1 一次性把完整 generations 交给 `show_plan_for_confirm`，由 `setPendingGenerations` 落盘暂存；确认后 `execute_plan` 不带 generations，走路径 B 从暂存取。既不重复构造超大 JSON，也杜绝「两处都空」。

---

## 五、问题5：执行顺序 / 状态机

**设计**：状态机保持不变，已对齐大雄：
`show_plan_for_confirm(plan_text, generations)` → `setAwaitingConfirm(true)` + `setPendingGenerations(gens)` 暂存 → `runToolCalls` 追加 `awaiting_confirm` 消息 → `send` 主循环在 `show_plan_for_confirm` 后 break 停循环（L794-808 的「三阶段门禁」）等用户确认 → 用户点「确认，按此执行」→ `handleConfirmPlan` 翻转 `setAwaitingConfirm(false)` 并 `send('已确认…')` → 下一轮 LLM 调 `execute_plan`（不带 generations）→ 从 `getPendingGenerations()` 取暂存 → 检查 `getAwaitingConfirm()` 已 false → 放行执行。

`send` 主循环的三阶段门禁 break（L794-808）**保留**：它正是大雄「展示策划后 stop 工具循环、等用户确认、不再让 AI 自言自语」的等价实现，且只依赖 `awaiting_confirm` 状态，与本次瘦身无关。

`executePlanTool` 的 `getAwaitingConfirm()` 拒绝分支（L729-731）**保留**：防 LLM 未确认直接出图的关键硬约束，阶段1 瘦身不影响它。

**具体改法**：`src/components/base/useAgentChat.js` L794-812 — 确认保留，无需改；列出以证明确认门禁 break 逻辑：

现状（确认无需改动）：
```js
        for (; round < MAX_TOOL_ROUNDS; round++) {
          appendMsg({ role: 'assistant', content: '', model, streaming: true, createdAt: Date.now() })
          assistant = await roundTrip(...)
          endStreaming(assistant)
          if (!assistant.tool_calls || assistant.tool_calls.length === 0) break
          await runToolCalls(assistant.tool_calls, (tc) => tc.id)
          // 三阶段门禁：本轮执行了 show_plan_for_confirm → 进入"待确认"，立即停循环等用户确认。
```

**可靠性分析**：状态机无改动，门禁 break 与 `awaiting_confirm` 解耦于 generations，瘦身 `required` 后状态流转更稳：阶段1 必成功（plan_text 必达）→ 必停循环 → 必渲染按钮 → 确认必翻转 → 执行必从暂存取 generations 放行。

---

## 六、完整改动清单

| 文件 | 行号 | 改法类型 | 一句话改法 |
|---|---|---|---|
| `src/components/base/useCanvasAgentTools.js` | L679 | **实质改动** | `presentPlanTool.required` 由 `['plan_text','generations']` 改为 `['plan_text']`（generations 改可选，解除 SDK 拒收） |
| `src/components/base/useAgentChat.js` | L671-673 | **实质改动** | `runToolCalls` 追加 `awaiting_confirm` 消息条件由「`result.ok && data.plan_text`」改为「`result.ok`」，门禁只依赖工具成功 |
| `src/components/base/useAgentChat.js` | L126-130 | **实质改动** | `SKILL_EXECUTION_RULES` 阶段1 强约束必传 plan_text+generations（generations 走暂存）；阶段3 明确不传 generations（从暂存取） |
| `src/components/base/useCanvasAgentTools.js` | L733-738 | 注释固化（非行为） | `executePlanTool` 第2优先级从 `getPendingGenerations()` 读 generations 逻辑保留，补注释标明「路径 B 默认、对齐大雄」 |
| `src/components/base/useCanvasAgentTools.js` | L690 | 保留（不变） | `setPendingGenerations(gens)` 暂存逻辑，路径 B 基础 |
| `src/components/AgentMessage.jsx` | L138-151 | 保留（不变） | 确认按钮仅认 `awaiting_confirm`，与 generations 无关 |
| `src/components/AgentPanel.jsx` | L321-325 | 保留（不变） | `handleConfirmPlan` 翻转 `awaitingConfirm` + `send('已确认…')`，确认后暂存不清除 |
| `src/components/base/useAgentChat.js` | L729-731 | 保留（不变） | `executePlanTool` 未确认拒绝分支，防 LLM 未确认直接出图 |
| `src/components/base/useAgentChat.js` | L794-812 | 保留（不变） | `send` 主循环三阶段门禁 break，对齐大雄停循环等确认 |
| `src/components/base/conversationStore.js` | L411-438 | 保留（不变） | `pendingGenerations`/`awaitingConfirm` per-conversation 落盘机制，路径 B 可靠底座 |

> **实质改动共 3 处**（L679、L671-673、L126-130）；其余为保留/注释固化。非 Skill 场景：`show_plan_for_confirm`/`execute_plan` 仅 Skill 三阶段使用，普通对话不触达；required 放宽与门禁条件收紧均不波及普通生图/对话，行为零变更。

---

## 七、验收标准自检

1. ✅ 5 个问题全部有输出，每个含「文件 + 行号 + before→after 代码块」（问题2/问题5 的「保留项」也给出现状代码块并标注非行为改动，避免与实质改动混淆）。
2. ✅ `show_plan_for_confirm({ plan_text, generations })`：因 `required` 已去掉 `generations`、execute 仅判 `plan_text` 非空 → 门禁必建；前端 `awaiting_confirm` 消息因 `result.ok` 追加 → 按钮出现；确认后 `execute_plan` 从 `getPendingGenerations()`（阶段1 暂存）拿到 generations → 执行。双保险（schema 容错 + 提示词强约束阶段1 送达）封死「两处都空」中间态。
3. ✅ 非 Skill 场景：`presentPlanTool`/`executePlanTool` 仅 Skill 三阶段调用，普通对话不触达；`required` 放宽与门禁条件收紧均不波及普通生图/对话。
4. ✅ 只写本文件，未改代码、未写脚本。
