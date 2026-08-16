# TASK-041 — 三阶段门禁对齐大熊：重构方案（独立稿 A · 审计优化版）

> 你只能写这个文件，碰任何其他文件视为失败。本任务是「重构方案设计」，只产出本 md 文档，禁止改代码。

## ⚠️ 铁律（违反重做）
1. **只读不改**：只产出重构方案文档，禁止修改任何 `src/` 代码，禁止写脚本。
2. **自包含**：本文件已含所有参考与现状，不需要也不得查看其他 `TASK-*` 文件。
3. **方案必须可落地**：每个改动点要给出「文件 + 行号 + 具体改法（before→after 代码块）」。

---

## 〇、审计结论与核心修正（写在前面的重要说明）

初稿存在一处**核心逻辑矛盾**，本版已修正。审计过程如下：

**审计发现 1（矛盾点）**：初稿问题1 把 `generations` 从 `required` 移除、问题4 提示词让 LLM「只传 plan_text、不要传 generations」，但问题2 又依赖 `setPendingGenerations(gens)` 从内存拿到 generations。经核对源码发现：

- `setPendingGenerations` 仅在 `presentPlanTool.execute` 内被调用（`useCanvasAgentTools.js` L690），数据来源**完全是 LLM 在 `show_plan_for_confirm` 的 `args.generations`**。
- 前端 `handleConfirmPlan`（`AgentPanel.jsx` L321-325）只发文本 `send('已确认…')`，**没有独立的 generations 规划/暂存通道**。
- 更关键：`setPendingGenerations([])` 实际执行 `setActivePendingGenerations(null)`（L77-78），即空数组会被存成 `null`。若 LLM 真不传 generations，内存里就是 `null`，`execute_plan` 会拿到空 → 执行失败。

→ **结论**：本项目的 generations 唯一正确来源就是「LLM 在阶段1 `show_plan_for_confirm` 传入 args → 暂存内存」。这与大雄不同——大雄的 generations 是**前端本地规划**生成（`pendingPlan`），前端天然持有，所以能「不传 args」。本项目前端当前**没有**这个本地规划能力，不能直接照搬「前端不传」。

**审计发现 2（真正的根因细化）**：根因不是「generations 不该传」，而是「11 个含长 prompt 的 generations 作为超大 JSON 走 LLM 工具 `args`，在 SSE 流式解析时偶发整包 `args` 变空 → `plan_text` 一并丢失 → 判空失败 → 门禁断裂」。这是**传输层**问题，单靠提示词无法 100% 杜绝。

**审计后的方案分层**（对应大雄的两层本质）：
- **A 层（主方案，必做，低风险）**：让门禁与 generations 传输解耦——`show_plan_for_confirm` 只因 `plan_text` 判成功，确认按钮只依赖工具成功，generations 仍由 LLM 阶段1 传入并暂存（保留现有已工作的内存通道）。这能解决「门禁断裂导致按钮不出现」，但**未根除** SSE 偶发丢包时 generations 也丢的情况（此时执行仍需 LLM 阶段3 重传兜底）。
- **B 层（增强方案，真正对齐大熊，需新增前端规划能力）**：把 generations 的生成从「LLM 工具 args」下沉到「前端本地规划」——前端在 Skill 启动时本地构造 generations 并 `setPendingGenerations`，`show_plan_for_confirm` 仅传 `plan_text`。这样 generations 彻底不走 LLM args，根除超大 JSON 故障，与大雄 `pendingPlan` 完全等价。代价是需新增前端规划模块（下文给出接口与落点）。

> 文档以下正文按「A 层（问题1–5 主改动）+ B 层（增强方案单独成节）」组织，并附修订记录。

---

## 一、问题背景

用户做护肤品详情页（Skill 三阶段流程）：AI 调用 `show_plan_for_confirm` 工具时，传了 11 个 generations 的超大 JSON，工具报 **`plan_text 为空`**，导致：
- 确认门禁没建立，前端**没有可点击的确认按钮**；
- 任务卡死，AI 反复重试。

## 二、根因（已定位，审计细化）

`presentPlanTool` 是 LLM 工具，`generations`（多个含长 prompt 的对象）作为 `required` 参数（L679）强制塞进 `tool_calls.arguments`。JSON 过大时，SSE 流式传输/解析失败，整包 `args` 变空对象 → `plan_text` 判空（L684）→ 工具返回 `ok:false` → 门禁未建立（L671-673 的 `result?.ok` 不成立）→ 按钮不渲染。

**关键点**：失败时不仅 generations 丢，`plan_text` 也因同包 args 变空而丢失。因此任何「只依赖 plan_text」的容错，前提是 **plan_text 这一小块文本必须能独立、可靠地到达**——这正是 A 层 + B 层要解决的核心。

## 三、大雄的机制（参考基准，已核对行号）

参考：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`

- 大雄用**前端本地构造门禁消息** `agentPushStageGateMessage`（L6313）：门禁消息体里 `generations: []`（L6336，空数组，绝不传超大 JSON），真正的 `generations` 放在内存 `pendingPlan.generations`（L6337-6344），由**前端本地规划**生成、不走 LLM args。`awaiting_confirm` 状态机由 workflow.status 翻转（L6367）。
- 确认按钮由前端 `options`（L6299 `agentBuildStageGateOptions`）渲染，点击后 `agentContinueFromPlanGate`（L6726）从内存 `pendingPlan.generations` 拿 gens（L6761）→ `runAgentGenerations`（L6777）。**generations 全程不重传、不走工具 args。**

核心：**generations 由前端/内存管理，不让 LLM 通过工具参数传超大 JSON。**

## 四、我们现有实现（改动基准，已核实行号）

| 文件 | 关键点 | 行号 |
|---|---|---|
| `src/components/base/useCanvasAgentTools.js` | `presentPlanTool`（show_plan_for_confirm 工具，generations 是 required 参数） | L652-698 |
| 同上 | `presentPlanTool.execute`：`setPendingGenerations(gens)` + `setAwaitingConfirm(true)`；`setPendingGenerations([])` 实际存 `null`（L77） | L689-692, L76-78 |
| 同上 | `executePlanTool`：从 `getPendingGenerations()` 读 generations（第 2 优先级） | L734-738 |
| `src/components/base/useAgentChat.js` | `SKILL_EXECUTION_RULES` 三阶段提示词 | L126-138 |
| 同上 | `runToolCalls` show_plan_for_confirm 成功 → appendMsg `awaiting_confirm:true` | L671-673 |
| 同上 | 三阶段门禁 break（循环遇 awaitingConfirm 即停） | L812-817 |
| `src/components/AgentMessage.jsx` | 确认按钮渲染（绑定 `message.awaiting_confirm`） | L138-151 |
| `src/components/AgentPanel.jsx` | `handleConfirmPlan`：setAwaitingConfirm(false) + send('已确认…') | L321-325 |
| `src/components/base/conversationStore.js` | `setPendingGenerations`/`getPendingGenerations`/`setAwaitingConfirm`/`getAwaitingConfirm` | 已存在 |

## 五、任务：设计一套「对齐大熊」的完整重构方案

### 问题 1：`presentPlanTool`（show_plan_for_confirm）如何瘦身

**设计（A 层）**：  
`plan_text` 仍是 required（它是门禁成功的唯一判据，且体量小不怕 SSE）。但把 `generations` 从 `required` 移除——这样即使 SSE 把 generations 这块弄丢导致 `args.generations` 缺失，工具参数 schema 校验仍通过，`execute` 不会因「缺 required 字段」直接被框架拒。  
`execute` 改为「`plan_text` 非空即成功」，不再因 generations 缺失失败；`generations` 缺失时暂存 `null`（既有 L77 行为），由 B 层或阶段3 重传兜底。

**具体改法**：`src/components/base/useCanvasAgentTools.js` L679

```js
// before
    required: ['plan_text', 'generations']
// after
    // generations 移出 required：避免 SSE 偶发丢包时因缺 required 字段被框架直接拒（plan_text 仍是唯一成功判据）
    required: ['plan_text']
```

**具体改法**：`src/components/base/useCanvasAgentTools.js` L681-697（`execute` 容错）

```js
// before
  execute(args, ctx) {
    const gens = Array.isArray(args.generations) ? args.generations : []
    const planText = String(args.plan_text || '').trim()
    if (!planText) return { ok: false, error: 'plan_text 为空' }
    const gc = args.global_contract && typeof args.global_contract === 'object' ? args.global_contract : null
    if (gc) setCurrentGlobalContract(gc)
    if (Array.isArray(args.artifacts) && args.artifacts.length) setCurrentArtifacts(args.artifacts)
    setPendingGenerations(gens)        // gens 为空 → 内部存 null（L77）
    setAwaitingConfirm(true)
    const mem = getCurrentMemory()
    setCurrentMemory({ ...mem, lastPlan: { plan_text: planText, generations: gens, ts: Date.now() } })
    return { ok: true, data: { presented: true, plan_text: planText, generations_count: gens.length, awaiting_confirm: true } }
  }
// after
  execute(args, ctx) {
    const planText = String(args.plan_text || '').trim()
    // 门禁只依赖 plan_text（体量小，SSE 丢失概率极低）；generations 缺失不再致命
    if (!planText) return { ok: false, error: 'plan_text 为空' }
    // generations 可选：LLM 传了就暂存（走内存，供 execute_plan 消费）；没传则存 null，由阶段3 重传/B 层兜底
    const gens = Array.isArray(args.generations) ? args.generations : []
    const gc = args.global_contract && typeof args.global_contract === 'object' ? args.global_contract : null
    if (gc) setCurrentGlobalContract(gc)
    if (Array.isArray(args.artifacts) && args.artifacts.length) setCurrentArtifacts(args.artifacts)
    setPendingGenerations(gens)
    setAwaitingConfirm(true)
    const mem = getCurrentMemory()
    setCurrentMemory({ ...mem, lastPlan: { plan_text: planText, generations: gens, ts: Date.now() } })
    // 明确返回 generations 是否成功暂存，便于前端/日志判断是否走兜底
    return { ok: true, data: { presented: true, plan_text: planText, generations_count: gens.length, generations_stashed: gens.length > 0, awaiting_confirm: true } }
  }
```

**可靠性分析**：`required` 去掉后，SSE 即使把 generations 弄丢，框架也不会因「缺 required 字段」拒收；`plan_text` 仅几百字，单独到达概率远高于整包 11 个 generations，门禁因此更稳。但注意：若 SSE 连整包 args 都弄丢（plan_text 也没了），本层仍会失败——这由 B 层根除。

---

### 问题 2：generations 如何可靠到达 execute_plan

**设计**：  
保留现有内存通道（`getPendingGenerations()`），并明确**双来源优先级**：
1. 阶段1 LLM 已传 generations → `setPendingGenerations(gens)` 暂存（非 null）→ 阶段3 直接读（A 层主路径，绝大多数情况）。
2. 阶段1 没存到（SSE 丢包 / B 层前端未注入）→ 阶段3 LLM 在 `execute_plan` 的 `args.generations` 重传兜底。

A 层维持现状「args 优先、内存其次」其实更合理（因为阶段3 重传是 LLM 实时生成、最新鲜），但需保证「内存有就直接用、避免重新让 LLM 扛超大 JSON」。故改为：**内存非 null 则优先用内存；内存为 null 才用 args 重传**。

**具体改法**：`src/components/base/useCanvasAgentTools.js` L732-739（读取优先级：内存非 null 优先）

```js
// before
      let gens = Array.isArray(args.generations) ? args.generations : []
      if (gens.length === 0) {
        const pending = getPendingGenerations()   // 内存为 null 时返回 null
        gens = pending || []
        clearPendingGenerations()
      }
      if (gens.length === 0) return { ok: false, error: 'generations 为空' }
// after
      // 内存优先：阶段1 已暂存且非 null 则直接用（避免阶段3 再让 LLM 扛超大 JSON）
      const pending = getPendingGenerations()      // 阶段1 没存时为 null
      let gens = (Array.isArray(pending) && pending.length) ? pending
                : (Array.isArray(args.generations) ? args.generations : [])
      clearPendingGenerations()                    // 消费后清空，防跨轮串味
      if (gens.length === 0) return { ok: false, error: 'generations 为空（阶段1 未暂存且阶段3 未重传）' }
```

**可靠性分析**：  
- 路径 A（内存非 null）：阶段1 LLM 成功传入 → 内存持有 → 阶段3 直接读，**不重复走 LLM args 超大 JSON**。这是 A 层主路径，覆盖「SSE 正常」的绝大多数场景。  
- 路径 B（LLM 阶段3 重传）：仅当内存为 null（SSE 阶段1 丢包）时触发，LLM 在 `execute_plan` 重传 generations 兜底。代价是又扛一次超大 JSON，但此时往往已脱离门禁卡死、且用户已确认，可接受。  
- 两条路径都满足「确认后 execute_plan 能拿到 generations」，A 层即可解决门禁断裂；B 层（下文）进一步根除路径 B 的超大 JSON 风险。

---

### 问题 3：确认门禁前端如何保证出现按钮

**设计**：  
按钮依赖 `message.awaiting_confirm`（`AgentMessage.jsx` L139），由 `useAgentChat.js` L671-673 在 `show_plan_for_confirm` 成功时追加。当前条件是 `result?.ok && result.data?.plan_text`——问题1 已让 `plan_text` 非空即 `ok:true`，故 `result.data.plan_text` 必然存在；但若将来 `plan_text` 因 SSE 丢包为空而 `ok:false`，按钮仍不出现。为彻底解耦，改为**仅依赖 `result?.ok`**。

**具体改法**：`src/components/base/useAgentChat.js` L671-673

```js
// before
      if (tc.function?.name === 'show_plan_for_confirm' && result?.ok && result.data?.plan_text) {
        appendMsg({ role: 'assistant', content: `生成策划：\n${result.data.plan_text}`, model, createdAt: Date.now(), awaiting_confirm: true })
      }
// after
      // 门禁只依赖工具成功（plan_text 由 presentPlanTool 保证存在）；与 generations 是否传输成功完全解耦
      if (tc.function?.name === 'show_plan_for_confirm' && result?.ok) {
        const pt = result.data?.plan_text || ''
        appendMsg({ role: 'assistant', content: `生成策划：\n${pt}`, model, createdAt: Date.now(), awaiting_confirm: true })
      }
```

**具体改法**：`src/components/AgentMessage.jsx` L138-139（无需改动，仅标注不变量已满足）

```jsx
// 保持不变：按钮绑定 message.awaiting_confirm 且 !message.streaming
// 不变量：show_plan_for_confirm 成功 → awaiting_confirm:true 必追加（useAgentChat.js L671-673，现仅依赖 result?.ok）
{ message.awaiting_confirm && !message.streaming && (
  <button ... onClick={onConfirmPlan}>确认，按此执行</button>
) }
```

> `onConfirmPlan` = `AgentPanel.jsx` L321-325 `handleConfirmPlan`，点击后 `setAwaitingConfirm(false)` + `send('已确认，请按策划执行')`，再触发阶段3 `execute_plan`。该链路不碰 generations，无需改动。

**可靠性分析**：`awaiting_confirm:true` 的追加条件从「`ok && plan_text`」降级为「`ok`」。结合问题1，`plan_text` 非空即 `ok:true`，按钮必然渲染。即使极端情况 `plan_text` 随 SSE 丢包丢失（`ok:false`），B 层（前端本地规划）能让 `show_plan_for_confirm` 由前端直接构造、不走易丢的 LLM args，从根上保证 `ok:true`。

---

### 问题 4：`SKILL_EXECUTION_RULES` 提示词怎么改

**设计**：  
提示词需与大雄对齐「generations 不强制走 args」，但**必须诚实**——本项目的 generations 仍由 LLM 生成，不能简单说「不要传」。故改为：阶段1 **正常传 generations**（保持现有暂存路径工作），但明确「若 generations 过大导致工具报错，阶段3 在 `execute_plan` 重传即可，系统会兜底」；同时强调 `plan_text` 是门禁唯一必需项，务必先给。并补充：阶段3 若内存已有 generations，可省略重传。

**具体改法**：`src/components/base/useAgentChat.js` L126-138

```js
// before
【阶段1 · 策划】：先规划一个可执行的 generations 数组（每张图一个步骤），每步含 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }，然后调用 show_plan_for_confirm 工具（传 plan_text 策划说明 + generations）把策划展示给用户确认。**不要**在阶段1直接 execute_plan。
【阶段2 · 等待确认】：展示策划后停止工具调用，输出文字请用户确认或补充。用户确认后进入阶段2。
【阶段3 · 执行】：用户确认后，调用 execute_plan 工具（传 generations 数组）执行，并简要说明开始生成。
// after
【阶段1 · 策划】：先规划一个可执行的 generations 数组（每张图一个步骤，每步含 { id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }），然后调用 show_plan_for_confirm 工具。**必须传 plan_text（策划说明，门禁唯一必需项，务必先给）**；generations 也一并传入（系统会暂存，供阶段3 直接用）。**不要**在阶段1直接 execute_plan。
【阶段2 · 等待确认】：展示策划后停止工具调用，输出文字请用户确认或补充。
【阶段3 · 执行】：用户确认后，调用 execute_plan 工具执行。若系统提示 generations 为空，则在此重传 generations 数组；否则无需重传，简要说明开始生成即可。
```

> `global_contract`（L138）保持原样——3 个短字符串字段，体量极小，不会触发 SSE 失败。

**可靠性分析**：提示词不再虚构「前端持有 generations」，而是诚实描述现有通道（阶段1 传→暂存→阶段3 用）并给出重传兜底指令。LLM 行为更可预测，门禁因 `plan_text` 必传而稳，执行因「内存优先 + 阶段3 重传兜底」而稳。

---

### 问题 5：执行顺序 / 状态机

**设计**：  
状态流转**保持不变**，仅确认门禁 break 继续保留：

```
阶段1 show_plan_for_confirm(plan_text, generations)
   └─ execute: setPendingGenerations(gens|null) + setAwaitingConfirm(true) → ok:true
   └─ useAgentChat L671-673: appendMsg awaiting_confirm:true → 前端渲染「确认，按此执行」
阶段2 （LLM 停止，等用户点按钮；主循环 L812-817 遇 awaitingConfirm 即 break）
   └─ 用户点击 → handleConfirmPlan: setAwaitingConfirm(false) + send('已确认…')
阶段3 execute_plan()
   └─ 入口硬约束: if(getAwaitingConfirm()) return 拒绝（已翻 false）→ 通过
   └─ gens = 内存(非null) 优先，否则 args 重传 → 批量建节点执行
```

**具体改法**：`src/components/base/useAgentChat.js` L812-817（保留不动，仅注释加固）

```js
// before / after 一致——三阶段门禁 break 保留：
// 阶段1 成功后 awaitingConfirm=true，主循环在此 break，强制等用户点确认按钮，对齐大雄 awaiting_confirm 状态机
if (getAwaitingConfirm()) {
  pausedForConfirm = true
  break
}
```

**可靠性分析**：状态机未引入新分支。`awaitingConfirm` 硬约束（L729-731）继续兜住「未确认不许出图」；门禁 break 的输入仅由前端按钮驱动，与 generations 无关，不会因超大 JSON 卡在阶段1。

---

## 六、B 层增强方案（真正对齐大熊：前端本地规划 generations）

> 仅当 A 层仍偶发 SSE 丢包导致 generations 整包丢失时启用。目标：让 generations **彻底不走 LLM 工具 args**，与大雄 `pendingPlan.generations` 完全等价。

**设计**：  
大雄的 generations 由前端本地规划生成，本项目目前没有该能力。B 层在 Skill 启动时，由前端（或新增的轻量规划模块）基于 Skill 元数据 + 用户需求，**本地构造 generations 数组**并调用 `setPendingGenerations(gens)` 暂存；`show_plan_for_confirm` 仅传 `plan_text`（及可选 `global_contract`），不再依赖 LLM 生成 generations。

**落点（仅描述，不改代码）**：
1. 新增 `src/components/base/useSkillPlanner.js`（或扩展现有 Skill hook）：导出 `planGenerationsFromSkill(skill, userReq) → generations[]`，纯前端计算，无 LLM 调用。
2. `AgentPanel` 在 Skill 启用且用户首轮发送时，调用 `planGenerationsFromSkill` 并 `setPendingGenerations(gens)`（落 conversationStore，随对话落盘，刷新不丢）。
3. `show_plan_for_confirm` 阶段1 文案（plan_text）仍可由 LLM 生成（短文本，安全），generations 已从内存存在，无需传 args。
4. `execute_plan` 阶段3 走问题2 的「内存非 null 优先」路径，LLM 完全不重传 generations。

**可靠性分析**：generations 全程在内存/前端，零超大 JSON 走 SSE，从根上根除本次故障。代价是需新增前端规划模块（中等工作量），且需保证前端规划与 LLM 阶段3 执行语义一致（比例/分辨率/依赖关系由前端算准）。**建议作为 A 层上线后的二期优化**。

---

## 七、输出规范核对

- 5 个问题全部有输出，每个含「文件 + 行号 + before→after 代码块」。✅（问题1–5 + B 层）
- 方案保证：`show_plan_for_confirm({ plan_text })` 只传文本也成功（问题1）、前端确认按钮出现（问题3）、确认后 execute_plan 能拿到 generations（问题2 内存优先 + 阶段3 重传兜底）。✅
- 不改变非 Skill 场景行为：`executePlanTool` 仍接受 `args.generations` 兜底（问题2 路径 B）；`required` 放宽仅影响 Skill 分支容错。✅
- 只写本文件，不改代码、不写脚本。✅

---

## 八、完整改动清单

| 文件 | 行号 | 一句话改法 | 层级 |
|---|---|---|---|
| `src/components/base/useCanvasAgentTools.js` | L679 | `presentPlanTool.required` 移除 `'generations'`，只留 `['plan_text']` | A |
| `src/components/base/useCanvasAgentTools.js` | L681-697 | `presentPlanTool.execute` 容错：仅 `plan_text` 非空即成功；generations 缺失不致命；返回 `generations_stashed` 标记 | A |
| `src/components/base/useCanvasAgentTools.js` | L732-739 | `executePlanTool` generations 读取改为「内存非 null 优先，LLM 重传兜底」，消费后清空 | A |
| `src/components/base/useAgentChat.js` | L671-673 | 门禁追加 `awaiting_confirm` 仅依赖 `result?.ok`（解耦 generations/plan_text 传输） | A |
| `src/components/base/useAgentChat.js` | L126-138 | `SKILL_EXECUTION_RULES`：明确 plan_text 为门禁唯一必需项，generations 阶段1 传→暂存、阶段3 内存优先/可重传兜底 | A |
| `src/components/base/useAgentChat.js` | L812-817 | 三阶段门禁 break 保留不动（状态机不变） | A |
| `src/components/AgentMessage.jsx` | L138-151 | 确认按钮逻辑不变（不变量已由 L671-673 保证） | A |
| `src/components/AgentPanel.jsx` | L321-325 | `handleConfirmPlan` 不变 | A |
| `src/components/base/conversationStore.js` | — | 无需改动，现有 pending/awaiting 接口已满足内存通道 | A |
| `src/components/base/useSkillPlanner.js`（新增） | — | B 层：前端本地规划 generations 并 `setPendingGenerations`，根治超大 JSON（二期） | B |

---

## 九、审计修订记录（相对初稿）

1. **修正核心矛盾**：初稿误假设「前端有独立 generations 通道、可不让 LLM 传」。审计源码确认 `setPendingGenerations` 唯一调用点在 `presentPlanTool.execute`、数据来源是 LLM args；且 `setPendingGenerations([])` 实际存 `null`（L77）。已重写问题2/4，改为「generations 仍由 LLM 阶段1 传入暂存（A 层主路径）+ 阶段3 重传兜底」，并在 B 层诚实给出「前端本地规划」的真正对齐大雄方案。
2. **细化根因**：明确失败是「SSE 整包 args 变空，连 plan_text 一起丢」，单靠提示词无法 100% 杜绝，故引入 A/B 分层。
3. **`executePlanTool` 读取优先级修正**：初稿「内存优先」写法与现状「args 优先」语义相反，已统一为「内存非 null 优先、否则 args 重传」，符合「避免阶段3 再扛超大 JSON」目标。
4. **补充门禁 break 行号**：明确 L812-817 为实际门禁中断点（初稿写 L794-808 范围过大，已精确到 break 处）。
5. **新增 B 层与修订记录**：保证方案既「可立即落地（A 层低风险）」又「能根除故障（B 层对齐大雄）」。
