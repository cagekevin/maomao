# TASK-001 — 失败项手动重试（对齐大雄 retryAgentGeneration）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号必须来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」，不能只写"缺/不缺"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件，不知道有几个 AI 在并行。

---

## 一、项目背景
我们（猫猫画布 maomao，React+ReactFlow）AI 助手正在逐项追平大雄「设计大师」。本任务深入核验「生图失败后用户能否在对话里单步重试」。

## 二、硬约束
只读核验。产出必须「可执行」：让下一个实现 AI 拿到就能动手，不用再探索。

## 三、探索起点（真实 grep，供你深入，行号以实际核实为准）

### 大雄侧（canvas-agent.js，约 1.15 万行）
- 主文件 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
- 单步重试 `retryAgentGeneration(messageId, genIndex)` ≈ L5155（只重跑失败步骤，retryCount 计数 ≈ L5204）
- 整条回复重试 `agentRetryMessage(msgId)` ≈ L5099
- 重试 UI 渲染 `data-agent-gen-retry` ≈ L3801 / 事件绑定 ≈ L4045
- 整条重试按钮 `data-agent-retry` ≈ L3827 / L4031
- 重试执行分支 isRetryRun ≈ L10521 / onlyIndexes ≈ L11281

### 我们侧
- 状态机 `/Users/kevin/Documents/maomao/src/components/base/inputStateMachine.js`：`failed → hasContent() ? 'retry' : 'idle'` ≈ L21/L80
- 对话消息渲染 `/Users/kevin/Documents/maomao/src/components/AgentMessage.jsx`：tool 消息成功/失败文本 ≈ L163
- 生成节点重试契约 `/Users/kevin/Documents/maomao/src/components/base/useNodeGeneration.js`：`registerTaskRetry` 已存在
- 失败态设置 `/Users/kevin/Documents/maomao/src/components/base/useAgentChat.js`：失败后 `setStatus('failed')` ≈ 搜索 `setStatus('failed')`
- 已剖析基底：`docs/AI助手开发历史/09-AI助手完整审计报告-2026-08-16.md`

## 四、覆盖清单（逐项给「大雄怎么做 + 我们缺在哪 + 精确落点」）
1. 大雄 `retryAgentGeneration` 完整逻辑：如何只挑失败 step 重跑、不删其他完成卡片、retryCount 展示、moderation 拦截失败如何重新提交 API。
2. 我们对话里生成结果卡片有没有失败态 + 重试按钮？`AgentMessage.jsx` 现在的失败卡片长什么样？
3. 我们 `inputStateMachine` 的 `failed → retry` 推导（L21/L80）是否已存在，`AgentPanel` 是否消费了 `stateAction==='retry'`？
4. 我们执行器 `canvasPlanExecutor.js` 单步失败后，能否按 stepId 重跑（对齐大雄 `runOneEntryWithRetry` 的手动分支）？
5. **结论**：用户「点失败卡片 → 单步重试」最少改我们哪个文件哪一行、复用哪个现有能力（registerTaskRetry / runNodeGeneration）。

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）」三节组织。追平落点必须写「改哪个文件哪一行 + 怎么改 + 复用哪个能力」。


## 六、验收标准（可自测）
1. 4.1：确认 `inputStateMachine` 的 `failed→retry` 是否已存在（贴文件+行号+代码）；明确「点失败卡片→单步重试」要改我们哪个文件哪一行。
2. 4.2：贴出大雄 `retryAgentGeneration` 关键逻辑（可略注释）。
3. 追平落点必须落到具体文件+行号，不能写"在合适位置"。

---

## 八、核验报告（本次实际打开文件核实，行号真实）

> 本章为唯一产出。所有行号均来自本次实读文件。代码证据已粘贴。

### 1. 大雄 `retryAgentGeneration` 完整逻辑

**文件**：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`

**(a) 入口与并发保护（L5155–L5170）**
```5155:5155:canvas-agent.js
async function retryAgentGeneration(messageId, genIndex){
```
- 用 `reallyBusy` 判断是否真有任务在跑（`__canvasAgentGenRunning` / `agentActiveWorkflow.status` 在 RUNNING 集合）。
- 若 `agentSending && reallyBusy` → toast 拒绝重试（L5160–5162）。
- 若发送锁卡死但实际没任务 → 强制把 `agentSending=false` / `__canvasAgentGenRunning=false`（L5164–5170），避免死锁（安全拦截失败后常见）。

**(b) 定位失败项（L5172–L5184）**
```5176:5176:canvas-agent.js
    const gen = assistantMsg?.generations?.[index];
    if(!assistantMsg || !gen){ ... toast('找不到可重试的失败项'); return; }
    if(!['error','stopped'].includes(String(gen.status || ''))){
        toast('该项当前不是失败/停止状态'); return;
    }
```
- 每个 tool/生成卡片挂在 `assistantMsg.generations[index]`，按 `genIndex` 精确挑失败 step。

**(c) 回溯 userMsg（L5186–L5197）**：向前找最近的 `user` 消息，拿到原始 prompt/参考图。

**(d) 重置该 step 为「可重跑」并计数（L5199–L5216）**
```5201:5206:canvas-agent.js
    gen.status = 'running';
    gen.error = '';
    gen.results = [];
    gen.retryCount = (Number(gen.retryCount) || 0) + 1;
    gen.runNodeId = '';
    gen.outputNodeId = '';
```
- 关键：**只清这一张失败卡片的状态，不删其他已完成卡片**；`retryCount++` 用于展示（见下 1e）。
- 对 `moderation_blocked` 等安全拦截：强制 `runNodeId=''`/`outputNodeId=''` → **必须重新提交 API**，不是复用旧节点（L5199–5200 注释）。

**(e) 调执行层，只跑失败下标（L5218–L5228）**
```5219:5223:canvas-agent.js
        await runAgentGenerations(assistantMsg, userMsg, {
            retry: true,
            onlyIndexes: [index],
            conversationId: ...
        });
```

**(f) 执行层 `runAgentGenerations` 的 `onlyIndexes` 分支（L10518–L10538）**
```10521:10530:canvas-agent.js
    const isRetryRun = !!(options.retry || onlyIndexes.length);
    let gens;
    if(isRetryRun){
        // 重试：绝不删掉消息里其他已完成/失败卡片，只挑选要重跑的步骤
        gens = assistantMsg.generations.filter((gen, idx) => {
            if(onlyIndexes.length) return onlyIndexes.includes(idx);
            ...
        });
        gens.forEach(g => {
            g.status = 'running'; g.error=''; g.results=[];
            g.runNodeId=''; g.outputNodeId=''; g.stopped=false;
```

**(g) 失败卡片渲染 + 重试按钮（L3801 / L3827）**
```3801:3801:canvas-agent.js
    const retryFailed = status === 'error' || status === 'stopped' ? `<button ... data-agent-gen-retry="${messageId}" data-agent-gen-index="${genIndex}">重试失败项</button>` : '';
```
- 错误文案 + `已重试 N 次`（L3804：`gen.retryCount ? ' · 已重试'+gen.retryCount+'次'`）。
- 事件绑定：`data-agent-gen-retry` 在 L4038–L4047 绑 `retryAgentGeneration(btn.dataset.agentGenRetry, Number(btn.dataset.agentGenIndex))`。

**(h) 整条回复重试 `agentRetryMessage(msgId)` = L5099**（实测精确行号；仅对 `assistant` 且无 `generations` 的门禁卡片，L3823–3827 `canRetryWholeReply`）。`data-agent-retry` 按钮模板在 L3827，事件绑定在 L4031–L4037（`if(!agentSending) agentRetryMessage(btn.dataset.agentRetry)`）。

> **结论（大雄怎么做）**：Dialog 里每张生图结果是一张 `gen` 卡，挂在 `assistantMsg.generations[index]`；失败卡（status `error`/`stopped`）右下角出现「重试失败项」按钮，点击只把这一张 `gen` 重置为 running、清 `runNodeId`/`outputNodeId`、retryCount+1，再 `runAgentGenerations({onlyIndexes:[index]})` 重跑——其余完成卡片完全不动。整条重试只用于无 generations 的门禁类回复。

---

### 2. 我们对话里生成结果卡片有没有失败态 + 重试按钮？

**文件**：`/Users/kevin/Documents/maomao/src/components/AgentMessage.jsx`

- `tool` 消息只有「成功/失败」两态文字 + 图标（L157–L182）：
```163:163:AgentMessage.jsx
      text = r.error || (r.ok ? `操作成功${r.nodeId ? `：${r.nodeId}` : ''}` : '操作失败')
```
```173:176:AgentMessage.jsx
            <svg ... className="text-red-400">   // 红叉图标
              <line x1="18" y1="6" x2="6" y2="18" />
```
- **没有任何 `generations` 卡片结构**，也**没有重试按钮**（`data-agent-gen-retry` 在我们代码库里 `search_content` 命中 0 处）。
- 我们的生图结果不是以「对话卡片」形式呈现，而是直接画成画布 `promptNode` 节点（由 `canvasPlanExecutor` 建节点 + `useNodeGeneration` 驱动），结果 URL 写回 `node.data.imageUrl`。即「生成结果卡片」在我们体系里 = **画布节点卡片**，而非对话气泡里的卡片。
- 画布节点层（PromptNode 内 `useNodeGeneration`）确实自带失败红字 + 任务中心「再来一次」，但那是**画布侧**，不是**对话气泡里的单步重试按钮**。任务要的是「点对话里失败卡片 → 单步重试」。

> **结论（我们现状）**：对话气泡里 `tool` 失败只显示一行红字，无重试按钮、无 per-step 卡片、无 `retryCount`。生成结果以画布节点呈现，对话侧没有对齐大雄的 `gen` 卡片 + 重试按钮。

---

### 3. `inputStateMachine` 的 `failed → retry` 推导 与 `AgentPanel` 是否消费

**文件**：`/Users/kevin/Documents/maomao/src/components/base/inputStateMachine.js`

- `failed → retry/idle` 推导**已存在**（L80）：
```80:80:inputStateMachine.js
    if (this.state.status === 'failed') return this.hasContent() ? 'retry' : 'idle'
```
- 注释也写明（L21）：`failed → 有内容 ? 'retry' : 'idle'`。
- 触发入口：`useAgentChat` 在 `send` 异常且非 Abort 时 `setStatus('failed')`（`useAgentChat.js` L696 / L708 兜底），状态机 `onChange` 回写 `stateAction`（L350–354）。

**`AgentPanel` 是否消费 `stateAction==='retry'`？——未消费。**
- `AgentPanel.jsx` 全文件 `search_content` 搜 `stateAction === 'retry'` → **0 命中**。
- 仅消费了 `stateAction` 的两种取值：
  - L296：`if (... || (sending && stateAction !== 'steer')) return`（steer 续跑放行）
  - L382：`const canSend = (input.trim() || attachments.length > 0) && stateAction !== 'stopping'`
  - L796：`{sending && stateAction !== 'steer' ? <停止按钮> : <发送按钮>}`
- 即 `'retry'` 目前只是状态机吐出的一个值，**UI 没有渲染「重试」按钮/语义**。当一条对话失败且输入框为空时，`stateAction==='idle'`（因为 `hasContent()` 为假），连「retry」都进不到——这跟任务要的「点失败卡片单步重试」无关，那是整条重发的入口，不是单步。

> **结论（我们现状）**：`failed→retry` 推导已具备（L80），但 (1) 它只在「输入框有内容」时才是 retry，空输入是 idle；(2) `AgentPanel` 没消费 `retry`，没有「重试」按钮；(3) 它表达的是「整条重发」，不是大雄的「单步卡片重试」。

---

### 4. 执行器 `canvasPlanExecutor.js` 能否按 stepId 重跑？

**文件**：`/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`

- `executePlan` 是「一次性建节点+跑全计划」入口（L65），**没有 `onlyIndexes` / `retry` 参数**。
- 但它内部依赖的核心能力 `runNode(nodeId, step)`（L122–L136）已经可以按节点重跑：
```125:127:canvasPlanExecutor.js
    const res = await runNodeGeneration(nodeId)
    if (!res) return { status: 'failed', error: `节点 ${nodeId} 未注册生成契约` }
    if (res.ok === false) return { status: 'failed', error: res.error || '生成失败' }
```
- 即「单步重跑」已经具备地基：**已知 `nodeId` → 调 `runNodeGeneration(nodeId)` 即可重跑该节点**（该能力来自 `registerTaskRetry`/`useNodeGeneration`，见下 4.结论）。
- 缺的是：执行器没有「从某条 assistant 消息里按 stepId 找 nodeId 并重跑」的封装，也没有「只跑失败步骤、保留其他」的 `onlyIndexes` 分支。

> **结论（我们现状）**：单步重跑的「原子能力」已就绪（`runNodeGeneration(nodeId)`）；缺的是「按消息+step 定位 nodeId 并只重跑失败项」的编排入口，对齐大雄 `onlyIndexes`。

---

### 5. 追平落点（可执行，落到具体文件+行号）

**核心判断**：我们对话侧的「生成结果卡片」= 画布节点，不是气泡卡片。大雄的「点对话卡片重试失败 step」在我们体系里最自然的对齐是：**在对话气泡的 tool 失败项里加一个「重试此步骤」按钮，点击后定位到该 step 对应的画布节点 `nodeId`，调用已存在的 `runNodeGeneration(nodeId)`（即 `useNodeGeneration` 注册的 `registerTaskRetry` 回调）重跑该节点**。

需要改动的最小落点：

**落点 A（必改）— `AgentMessage.jsx` L157–L182（tool 消息渲染）**
- 现状：`tool` 消息只显示红字，无重试。
- 改法：给 `tool` 消息组件加 `onRetryStep` prop，并在 `ok===false` 分支追加一个「重试此步骤」按钮。把该 tool 消息里携带的 `nodeId`（见下方落点 B 写入 `r.nodeId`）通过 `onRetryStep(nodeId)` 上抛。
- 复用：无需新增生成逻辑，只需触发 `runNodeGeneration`。

**落点 B（必改）— `useAgentChat.js` 的工具执行回填 L556–L561（`runToolCalls`）**
- 现状：`tool` 消息只写 `{ ok, ...result.data }`，成功时 `result.data.nodeId` 已带上（L163 `r.nodeId`），但失败时 `result.data` 取决于工具层——**实测 `useCanvasAgentTools.js` 两个生成工具的失败分支都只返回 `{ ok:false, error }`，不带 `nodeId`**：
  - `generate_node`（L539–552）：L548 `return { ok:false, error:'节点未注册生成契约…' }`、L551 `return { ok:false, error: res.error||'生成失败' }`，均缺 `nodeId`。
  - `execute_plan`（L580–665）：成功返回 `data:{ workflow, entries }`（L660，entries 含 `nodeId`），但失败走 L653 `return { ok:false, error:'计划执行失败' }` 或 L663 `return { ok:false, error:'计划执行异常…' }`，**已建节点的 nodeId 也没透出**。
- 后果：失败 tool 卡片拿不到 `nodeId`，落点 A 的「重试此步骤」按钮无法定位节点。
- 改法：
  1. `generate_node` 失败时把它已知的 `id`（L540 已 `const id = str(args.nodeId)`）补进返回：`return { ok:false, error:..., nodeId: id }`（L548、L551 两处）。
  2. `execute_plan` 失败分支：把 `result.entries` 里 `status==='failed'` 的 `nodeId` 收集进返回 `data`，让重试能逐节点重跑（对应大雄 `onlyIndexes` 多步场景）。
- 让 `onRetryStep` 从 `AgentPanel` 注入：在 `AgentPanel.jsx` L517 的 `<AgentMessage>` 传入 `onRetryStep={handleRetryStep}`。

**落点 C（必改）— `AgentPanel.jsx` 新增 `handleRetryStep(nodeId)`（建议加在 L290 `handleSend` 附近）**
```js
const handleRetryStep = useCallback((nodeId) => {
  if (!nodeId) return
  // 复用 taskStore 已注册的节点生成契约（registerTaskRetry → runNodeGeneration）
  runNodeGeneration(nodeId)   // 来自 './base/taskStore.js'
}, [])
```
- 需在 `AgentPanel.jsx` 顶部 `import { runNodeGeneration } from './base/taskStore.js'`（当前该文件未导入）。
- 这是「复用哪个现有能力」的直接答案：**`registerTaskRetry`（useNodeGeneration.js L136–L141 注册）/ `runNodeGeneration`（taskStore.js L289–L303）**。

**落点 D（可选，对齐大雄 retryCount 展示）— `useNodeGeneration.js`**
- 大雄在每次重试 `gen.retryCount++` 并展示「已重试 N 次」。我们节点层当前 `start()`（L64–L125）没有 retryCount 概念；如需在对气泡显示次数，可在 `taskStore.retryRegistry` 命中时累加计数，但**非最小改动**，可后置。

**不必改动**：
- `inputStateMachine.js` L80 的 `failed→retry` 已存在，本任务「单步卡片重试」走的是「tool 卡片按钮 → `runNodeGeneration`」，不依赖该推导；`AgentPanel` 当前未消费 `'retry'` 不影响本落点（整条重试是另一诉求）。
- `canvasPlanExecutor.js` 本身**不需要改**：因为单步重跑直接复用 `runNodeGeneration(nodeId)`，绕过了 `executePlan` 的整计划流程，反而更精准（对齐大雄「只重跑失败 step、不动其他卡片」）。

**验收对照（对应任务六验收标准）**
- 4.1：`inputStateMachine` `failed→retry` **已存在**（证据 L80）；但「点失败卡片→单步重试」要改的文件是 `AgentMessage.jsx` L157–L182 + `AgentPanel.jsx`（新增 `handleRetryStep` + L517 传 prop）+ `useAgentChat.js` L556–L561 保证失败带 `nodeId`，并补 `useCanvasAgentTools.js` 失败返回 `nodeId`。
- 4.2：大雄 `retryAgentGeneration` 关键逻辑已贴（L5155–L5246 入口 + L10518–L10538 onlyIndexes 分支 + L3801 失败卡按钮）。
- 所有落点均已落到具体文件+行号，无「合适位置」空话。

## 七、铁律文件名（产出即本文档，不新建）
本文件即唯一产出。写满后结束，不要改动任何其他文件。
