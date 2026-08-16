# TASK-009 — 依赖批跳过文案 + 执行进度日志（pushLog 对齐）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号必须来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」，不能只写"缺/不缺"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件，不知道有几个 AI 在并行。

---

## 一、项目背景
我们 AI 助手逐项追平大雄。本任务深入核验「依赖批失败时的跳过文案」与「执行器逐步进度日志」。

## 二、硬约束
只读核验。产出必须「可执行」。

## 三、探索起点（真实 grep，行号以实际核实为准）

### 大雄侧（canvas-agent.js）
- 主文件 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
- 依赖批失败文案：搜索 `前置步骤`、`已跳过`、`请先重试`
- 执行进度日志 pushLog：搜索 `pushLog`、`log`、逐步挂载参考图
- dependent 阶段失败日志 ≈ L10990

### 我们侧
- 执行器 `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`：跳过文案「前置步骤未全部成功，已跳过」≈ L173，依赖批逻辑 ≈ L161-175
- toast 通知 `/Users/kevin/Documents/maomao/src/components/base/toastStore.js`：`showToast`
- 对话消息 `/Users/kevin/Documents/maomao/src/components/base/useAgentChat.js`：assistant 消息展示进度

## 四、覆盖清单（逐项给「大雄怎么做 + 我们缺在哪 + 精确落点」）
1. 大雄依赖批失败时的跳过文案原文是什么（成功/总数 + 引导重试）？
2. 大雄 pushLog 是否逐步输出每步挂载几张参考图、每步开始/成功/失败？
3. 我们跳过文案（L173）和有没有执行进度日志？
4. **结论**：我们补文案 + 日志要改哪些文件哪些行（toast 或 assistant 消息）。

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）」三节。

---

## 六、核验结果（本任务产出 · 最终版）

> 所有行号均来自本次实际打开文件核实（已逐行打开源码确认）。
> 大雄侧主文件：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
> 我们侧文件：
> - `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`
> - `/Users/kevin/Documents/maomao/src/components/base/toastStore.js`
> - `/Users/kevin/Documents/maomao/src/components/base/useAgentChat.js`
> - `/Users/kevin/Documents/maomao/src/components/base/useCanvasAgentTools.js`

### 0. 现状事实清单（先对齐双方结构）

| 维度 | 大雄 | 我们 |
|---|---|---|
| 执行器入口 | `window.CanvasAgentPlanExecutor.execute(plan, { logs, onLog, stopRequested })`（L10924） | `executePlan({ ctx, generations, autoRun, model, defaults, referenceImages })`（L65） |
| 依赖批失败文案 | `error: '前置步骤未完成，已跳过融合'`（L10999） | `entry.error = '前置步骤未全部成功，已跳过' / '无前序成功结果，已跳过'`（L173） |
| 逐步日志 | executor 经 `onLog` 逐步 push，渲染成折叠「执行摘要」（L3745-3780） | **无**（grep `pushLog`/`onLog` 全文件 0 命中） |
| 失败对外提示 | assistant `generations` 错误卡 + 「重试失败项」按钮（L3801） | **无 toast、无 assistant 卡片** |
| 重试入口 | `data-agent-gen-retry` 按钮（L3801） | 无 |

---

### 1. 大雄依赖批失败时的跳过文案原文是什么（成功/总数 + 引导重试）？

**大雄怎么做（代码证据）**
`execute` 完成后遍历 `execution.entries`，对依赖批失败项构造错误 gen 卡片，文案写死在 `error` 字段：

```10990:10999:/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js
}else if(entry.phase === 'dependent' && entry.result?.status === 'failed'){
    // 追加显示被跳过的融合步骤
    const skipGen = {
        prompt: entry.step?.professional_prompt || entry.step?.prompt || '融合步骤',
        count: 1,
        depends_on_previous: true,
        use_last_outputs: false,
        results: [],
        status: 'error',
        error: entry.result?.error || '前置步骤未完成，已跳过融合'
    };
```

- 原文兜底文案（L10999）：`前置步骤未完成，已跳过融合`。
- 展示载体：该 `skipGen` 被 push 进 `assistantMsg.generations`（L11002-11003），与成功卡片并列渲染。
- 引导重试：错误卡片渲染「重试失败项」按钮（L3801）：
```3801:3801:/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js
    const retryFailed = status === 'error' || status === 'stopped' ? `<div class="agent-gen-retry-row"><button class="agent-quick-btn primary" type="button" data-agent-gen-retry="${escapeHtml(messageId)}" data-agent-gen-index="${genIndex}"><i data-lucide="refresh-cw"></i><span>${status === 'error' ? '重试失败项' : '重新运行此项'}</span></button></div>` : '';
```
- 注意：大雄文案**未**显式写「成功 X / 共 Y」数字，而是用「重试失败项」按钮承担引导重试；数量信息显示在卡片缩略图计数与顶部进度（确认/跳过计数见 L3841-3845）。

**我们现状（代码证据）**
依赖批失败时仅写 `entry.error`，无对外出口：

```171:173:/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js
      if (prevFailed > 0 || prevOk.length === 0) {
        entry.status = 'failed'
        entry.error = prevFailed > 0 ? '前置步骤未全部成功，已跳过' : '无前序成功结果，已跳过'
```

- L173 文案：`前置步骤未全部成功，已跳过`（前序有失败）/`无前序成功结果，已跳过`（无成功前序）。
- `entry` 结构（L144、L167）：`{ id, stepId, nodeId, phase, status, resultUrl, error }`，**不含成功/总数统计**，仅 `phase` 标记批次。
- 该 error 经 `executePlan` 的 `entries` 向上透传；`useCanvasAgentTools.js` 的 `execute_plan` 工具（L650 调用、L660 返回 `entries`）原样交回 LLM，但**不弹 toast、不进对话消息**。

**差异小结**
1. 措辞：我们是「前置步骤未全部成功，已跳过」；大雄是「前置步骤未完成，已跳过融合」（融合语义更明确）。
2. 我们缺「引导重试」出口（大雄有按钮 + 错误卡）。
3. 我们不在对话里呈现失败卡片。

**追平落点（可执行）**
- 文件：`canvasPlanExecutor.js`，行：L173。
- 改法（最小改动、对齐大雄）：
  ```js
  // L173 改为：
  const okCount = prevOk.length
  const totalIndep = entries.filter((e) => e.phase === 'independent').length
  entry.error = prevFailed > 0
    ? `前置步骤未完成（成功 ${okCount} / 共 ${totalIndep}），依赖步骤已跳过，请在节点中重试前序`
    : '无前序成功结果，已跳过'
  ```
  说明：`entries` 中 `phase==='independent'` 即独立批总数（L144 写入），`prevOk.length` 即成功数（L170），无需新增返回字段。

---

### 2. 大雄 pushLog 是否逐步输出每步挂载几张参考图、每步开始/成功/失败？

**大雄怎么做（代码证据）**
大雄把 `workflowLogs` 数组与 `onLog` 回调一并传给 executor，executor 内部逐步调用 `onLog` 写入，前端节流渲染：

```10921:10940:/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js
            const workflowLogs=[];
            if(assistantMsg){ assistantMsg.workflowLogs = workflowLogs; }
            patchOwnerWorkflow(wf=>{ wf.logs = workflowLogs; });
            execution=await window.CanvasAgentPlanExecutor.execute(plan,{
                workflowId:(ownerWorkflow()?.id||agentActiveWorkflow?.id||uid("awf")),
                conversationId:agentState.activeConversationId,
                messageId:userMsg?.id||'',
                userPrompt:userMsg?.text||'',
                logs:workflowLogs,
                stopRequested:()=>!!agentStopRequested,
                onLog:(item)=>{
                    if(assistantMsg){ assistantMsg.workflowLogs = workflowLogs; }
                    patchOwnerWorkflow(wf=>{ wf.logs = workflowLogs; });
                    // 节流渲染：日志较多时也保持可见
```

- `onLog` 的 `item.level` 取值（渲染端过滤，L3749）：`'ok' | 'warn' | 'error' | 'info'`。
- 渲染成折叠「执行摘要」面板（L3775-3781）：
```3775:3781:/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js
        <button type="button" class="agent-workflow-log-head" data-agent-log-toggle="1" aria-expanded="false">
            <span class="agent-workflow-log-title">执行摘要</span>
            <span class="agent-workflow-log-summary">${escapeHtml(summary)}</span>
            <span class="agent-workflow-log-chevron" aria-hidden="true">▾</span>
        </button>
```

⇒ **结论**：大雄确实逐步输出每步「开始/挂载参考图数/成功/失败」，并以 level 分级、折叠「执行摘要」呈现；内部逐步日志完整保留在 `assistantMsg.workflowLogs`。

**我们现状（代码证据）**
`executePlan` 全程无任何日志通道：
- `canvasPlanExecutor.js` 函数签名（L65）无 `onLog`；`runNode`（L122-135）、Wave1（L139-158）、Wave2（L160-191）均无日志调用。
- `executePlan` 返回（L196）仅 `{ workflow:{status,steps}, entries }`，无 `logs`。
- 上层 `useCanvasAgentTools.js` 的 `execute_plan` 工具（L650、L660）只把 `entries` 交回 LLM；`useAgentChat.js` 的 `sendImageMode`（L769-773）末尾仅拼一句汇总 `已在画布生图：N 张，完成 M 张`，无逐步进度。

**追平落点（可执行）**
- 文件：`canvasPlanExecutor.js`。
- 落点（在以下精确位置插入 `onLog?.({level, message})`）：
  1. L65 签名加 `onLog`：`export async function executePlan({ ctx, generations = [], autoRun = true, model = '', defaults = {}, referenceImages = [], onLog } = {})`
  2. Wave1 建节点后（L147 之后）：
     ```js
     onLog?.({ level: 'info', message: `第 ${i + 1} 步开始生成，挂载参考图 ${stepRefImages(step).length || referenceImages.length} 张` })
     ```
     （`stepRefImages` 已在 L82 定义，可直接用）
  3. Wave1 结果写回处（L152-157 内）：
     ```js
     onLog?.({ level: r.status === 'completed' ? 'ok' : 'error', message: `第 ${i + 1} 步 ${r.status === 'completed' ? '完成' : '失败：' + (r.error || '')}` })
     ```
  4. Wave2 建节点后（L166 之后）：
     ```js
     onLog?.({ level: 'info', message: `依赖步 ${i + 1} 开始，连接前序成功节点 ${prevOk.length} 个` })
     ```
  5. 跳过分支（L173 之后）：
     ```js
     onLog?.({ level: 'warn', message: entry.error })
     ```
  6. 成功执行依赖步后（L182 之后，autoRun 分支）补一条 `ok` 日志。

---

### 3. 我们跳过文案（L173）和有没有执行进度日志？

**我们现状（代码证据）**
- 跳过文案（L173）：存在，但仅写入 `entry.error`，**不弹 toast、不进对话**。
- 执行进度日志：**无**。`canvasPlanExecutor.js` 全文件无 `onLog`/`pushLog`（grep 全仓库 0 命中于本文件）。
- `toastStore.js` 已具备 `showToast(message, { type })`（L33），但 `canvasPlanExecutor.js` **未 import、未调用**（grep 全文 0 处 `showToast`）。
- `useAgentChat.js` 仅在 `sendImageMode`（L773）给一句汇总，无逐步进度、无失败卡片。

**大雄对照**
- 失败项经 `assistantMsg.generations` 错误卡（L10990-11005）+ 「重试失败项」按钮（L3801）呈现；逐步日志经 `onLog` → `workflowLogs` → 折叠「执行摘要」（L3745-3781）。

**追平落点（可执行）**
文案出口两条（可并存，建议只选 toast 以免对话刷屏；或仅走 onLog 汇总到 assistant）：
- Toast：`canvasPlanExecutor.js` L16 加 `import { showToast } from './toastStore.js'`，L173 后加 `showToast(entry.error, { type: 'warning' })`。
- 对话进度：在 `useCanvasAgentTools.js` 的 `execute_plan`（L650-660）接收 `entries`，把 failed 依赖步拼成 assistant 可见文案（见 §4 落点 3）。

---

### 4. 结论：我们补文案 + 日志要改哪些文件哪些行（toast 或 assistant 消息）

**大雄怎么做（总结）**
- 文案：依赖步失败 → `error:'前置步骤未完成，已跳过融合'`（L10999），进 `generations` 错误卡 + 「重试失败项」按钮（L3801）。
- 日志：executor `onLog` 逐步 push（开始/挂载参考图数/成功/失败）→ `workflowLogs` → 折叠「执行摘要」（L3745-3781）。

**我们现状（总结）**
- 文案：L173 写 `entry.error`，**不外显、无重试入口**。
- 日志：**全无**；`executePlan` 无 `onLog`，上层仅末尾汇总；未接 `toastStore`。

**追平落点（可执行清单 · 文件+行号）**

1. `src/components/base/canvasPlanExecutor.js`
   - L16：加 `import { showToast } from './toastStore.js'`
   - L65：签名加 `onLog`（见 §2 落点 1）
   - L147 后 / L152-157 / L166 后 / L173 后 / L182 后：插入 `onLog?.()`（见 §2 落点 2–6）
   - L173：文案改为带「成功 X / 共 Y」+「请在节点中重试前序」（见 §1 追平落点）
   - L173 后（可选）：`showToast(entry.error, { type: 'warning' })`
   - L196：保持返回 `entries`（已含每步 status/error，供上层拼消息）

2. `src/components/base/useCanvasAgentTools.js`（`execute_plan` 工具，L618-666）
   - 文件顶部 L6 附近加 `import { showToast } from './toastStore.js'`
   - L650 调用 `executePlan` 时传入 `onLog`：
     ```js
     const logs = []
     const result = await executePlan({
       ctx, generations: resolvedGens, autoRun, model, defaults: panel, referenceImages: globalRefs,
       onLog: (it) => { logs.push(it); showToast(it.message, { type: it.level === 'error' ? 'error' : it.level === 'warn' ? 'warning' : 'info' }) }
     })
     ```
   - L660 返回里把 `logs` 一并带回：`return { ok: true, data: { workflow: result.workflow, entries: result.entries, logs } }`，供 `useAgentChat` 渲染「执行摘要」。

3. `src/components/base/useAgentChat.js`
   - `sendImageMode`（L769-773）：把 `res.data.entries` 中 `phase==='dependent' && status==='failed'` 的项拼成 assistant 文案，提示「可在节点中重试前序」，对齐大雄「重试失败项」语义。
   - 或在 `runToolCalls`（L549-567）调用 `execute_plan` 后，若返回 `data.logs?.length`，append 一条 assistant「执行摘要」消息（对齐大雄折叠面板，可选进阶）。

4. （进阶，对齐大雄「执行摘要」折叠）助手消息渲染组件
   - 新增 `workflowLogs` 折叠渲染（对齐大雄 L3745-3781），把 `onLog` 收集的数组按 level 过滤显示 ok/warn/error + 末条 info。

**自测建议（对应验收标准）**
- 构造「1 个独立步故意失败 + 1 个依赖步」计划 → 应：
  1. 看到 warning toast（或 assistant 失败卡）文案含「前置步骤未完成（成功 0 / 共 1），依赖步骤已跳过，请在节点中重试前序」；
  2. 逐步日志显示每步「挂载参考图 N 张 / 完成 / 失败」；
  3. 对话中出现「可在节点中重试前序」提示。
- 行号均以本次实开文件核实为准；本任务未改动任何 `src/` 代码，仅产出本文档。

---

## 七、验收标准（可自测）
1. 每个核验点都给出「大雄怎么做（代码证据）+ 我们现状（代码证据）+ 追平落点（文件+行号+改法）」。
2. 落点必须落到具体文件+行号，不能写"在合适位置"。
3. 结论必须你亲自核实过代码，不能只引用外部文档。

## 八、铁律文件名（产出即本文档，不新建）
本文件即唯一产出。写满后结束，不要改动任何其他文件。
