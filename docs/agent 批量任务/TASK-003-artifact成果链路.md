# TASK-003 — artifact 成果链路 + global_contract 统一风格锁定（对齐大雄）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号必须来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」，不能只写"缺/不缺"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件，不知道有几个 AI 在并行。

---

## 一、项目背景
我们 AI 助手逐项追平大雄。本任务深入核验「跨步成果链路（artifact）与统一风格/负面提示词逐字绑定（global_contract）」，这直接影响电商套图（13 张同品牌）的一致性。

## 二、硬约束
只读核验。产出必须「可执行」。

## 三、探索起点（真实 grep，行号以实际核实为准）

### 大雄侧（canvas-agent.js）
- 主文件 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
- `AGENT_TASK_SPEC` / `global_contract`：搜索 `global_contract`、`input_artifact_ids`、`output_artifact_id`
- 阶段1 隐藏结构化任务单：搜索 `taskSpec`、`artifact`
- 前序成果显式注入下游：搜索 `output_artifact_id` 相关执行
- 已剖析基底：`docs/AI助手开发历史/08-大雄canvas-agent架构剖析与地基对照-2026-08-16.md`（含 artifact 链路说明）

### 我们侧
- 执行器 `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`：`depends_on_previous` / `dependency_mode`，用「连线」让下游自动读前序 imageUrl，无 artifact 概念
- 对话记忆 `/Users/kevin/Documents/maomao/src/components/base/useAgentChat.js`：`memory.lastPlan` 只记 generations，无 global_contract
- Skill 规则 `/Users/kevin/Documents/maomao/src/components/base/useAgentChat.js`：`SKILL_EXECUTION_RULES`（约 L120）无 global_contract 绑定
- `/Users/kevin/Documents/maomao/src/components/base/useCanvasAgentTools.js`：execute_plan 工具（generations 契约）

## 四、覆盖清单（逐项给「大雄怎么做 + 我们缺在哪 + 精确落点」）

> 代码证据全部来自本次实际打开的文件核实（行号为本次读取所得）。

### 4.1 大雄 `global_contract` 是什么结构、怎么「逐字无损绑到每个 generation 的 prompt」

**结构定义**（大雄 `canvas-agent.js`）：
- 阶段1 任务单 `AGENT_TASK_SPEC` 的三字段全局契约（L819-L821）：
  ```json
  {"schema_version":2,
   "global_contract":{
     "visual_positioning":"视觉整体定位原文",
     "unified_style_prompt":"统一风格提示词原文",
     "unified_negative_prompt":"统一负面提示词原文"
   }, "deliverables":[...]}
  ```
- 归一化时只去首尾空白、**绝不摘要/改写**（L5903-L5908）：
  ```js
  const globalContract = globalSrc ? {
    visual_positioning: String(globalSrc.visual_positioning || '').trim(),
    unified_style_prompt: String(globalSrc.unified_style_prompt || '').trim(),
    unified_negative_prompt: String(globalSrc.unified_negative_prompt || '').trim()
  } : null
  ```
- 阶段1 正文里三项内容被同时汇成逐字文本 `unifiedText`（L6085-L6091）：正文标题截取 `bodyGlobalText` 与结构化 `structuredGlobalText` 二选一，确保「正文标题不稳定时仍能完整、无损地下传三项全局约束」。

**逐字绑到每个 generation 的 prompt**（关键证据 L6106-L6113，函数 `agentBindSkillPlanPagesToGenerations`）：
```js
const verbatim = [block.text, unifiedText].filter(Boolean).join('\n\n').trim();
if(!verbatim) return;
gen.prompt = verbatim;                 // ← 整页策划正文 + 三项全局契约 原样拼进每个 gen.prompt
gen.plannedPrompt = verbatim;
gen.professionalPrompt = verbatim;
gen.skill_plan_text = block.text;
if(unifiedText) gen.skill_global_contract_text = unifiedText;  // ← 契约单独挂字段，供审计/回显
gen.skill_plan_source = 'stage1_verbatim';
```
即：**阶段2 不重写 prompt，把 `block.text`（逐页策划原文）与 `unifiedText`（三项全局契约原文）直接拼接成 `gen.prompt`**。每个 generation 的 prompt 都携带完整统一的视觉定位/风格/负面提示词，做到「逐字无损绑定、不可覆盖」。
补充约束校验：当阶段1 存在页面契约（`hasPageContract`）时，逐步检查 `gen.prompt` 是否落实「产品一致性 / 版式 / 风格」三类约束中的至少 2 项（L7144-L7153，正则 `contractHits < 2` 即报错），保证 `verbatim` 绑定后每步 prompt 真正带了统一约束。

---

### 4.2 大雄 `input_artifact_ids` / `output_artifact_id` 怎么实现跨步成果传递

**概念**：artifact = 带身份的阶段成果资产（Logo/色卡/产品定稿/推广图），用字符串 id 标识，在 `plan.artifacts` 声明，并绑到 generation 上。

**结构**（L834 阶段2 JSON 示例 + L5925-L5926 归一化）：
```js
plan.artifacts:[{id:"artifact_1",type:"text|image|palette|product|plan",title:"阶段成果名称",description:"摘要"}]
generations:[{ ..., input_artifact_ids:["artifact_1"], output_artifact_id:"artifact_2",
               depends_on_previous:true, dependency_mode:"product_reference|fusion" }]
```
- 解析时透传这些 id（L5821-L5822）：
  ```js
  if(Array.isArray(g.input_artifact_ids)) gen.input_artifact_ids = g.input_artifact_ids.map(...).filter(Boolean);
  if(g.output_artifact_id) gen.output_artifact_id = String(g.output_artifact_id).trim();
  ```

**跨步注入机制**（执行器 `runAgentGenerations` 覆盖实现 L10476 起，依赖 `window.CanvasAgentPlanExecutor`）：
- 前序成果（某 step 的 `gen.results[].url`）被记录为该 `output_artifact_id` 对应的资产。
- 后续 step 声明 `input_artifact_ids` 含该 id 且 `depends_on_previous=true` 时，执行器把**前序结果图**作为参考图注入第二波（L10640-L10648「依赖前序生成图时仍保留 LLM 明确选择的用户参考图；执行器会把两类引用合并」）。
- 串行依赖的硬校验（L7155-L7161）：第一步必须有 `output_artifact_id`，后续步 `input_artifact_ids` 必须包含它，否则报错——「执行器不得依赖 prompt 中口头描述猜依赖」。
- 前序结果图注入确认（L10644-L10648）：`isPrevDep` 为真时，执行器强制 `gen.depends_on_previous=true`、`gen.use_previous_results=true`（即前序生成图在第二波注入，保留 LLM 选的用户参考图两类合并）。
- 参考图落节点：`agentMaterializeReferenceNodes`（L10384）把前序/用户参考图落成带 `nodeId` 的节点（同一次任务内同一 URL 只落一次、复用 nodeId 连线），下游 `useConnectedInputs` 读上游 `data.imageUrl`。

> 结论：大雄的 artifact 既是**数据契约**（id 绑定，校验强依赖），又是**执行时参考图来源**（前序定稿图通过 id 注入下游节点的 `images`/连线）。

---

### 4.3 我们是否缺 artifact 概念？前序成果现在靠什么传

**我们缺 artifact 概念**：代码里搜索 `artifact`/`input_artifact_ids`/`output_artifact_id`/`global_contract`/`unified_style_prompt` 在整個 `src/`（含 `src/components/base/*`）中**零出现**（已全仓 grep 确认），即我们没有「带身份的资产 id」与「统一风格契约」这两层。

**前序成果现在靠什么传 —— 连线 + `data.imageUrl`**（代码证据 `src/components/base/canvasPlanExecutor.js`）：
- 分批：独立批 / 依赖批（L73-L74 `dependsOnPrevious` 判定 `depends_on_previous` / `use_previous_results` / `depends_on_steps`）。
- Wave2 依赖批：把「已成功的独立批节点」连到本步节点（L169-L177）：
  ```js
  const prevOk = entries.filter((e) => e.status === 'completed' && e.nodeId)
  const edges = prevOk.map((e) => ({ id: `e-plan-${nodeId}-${e.nodeId}`, source: e.nodeId, target: nodeId }))
  ctx.addEdges(edges)
  ```
- 下游节点靠 `useConnectedInputs` 读上游 `data.imageUrl` 当参考图（文件头注释 L10-L12 明确：「用连线把上游产出传给下游，getNodeOutput 读上游 data.imageUrl」）。

**统一风格怎么传 —— 没有逐字契约**：
- 我们的 `SKILL_EXECUTION_RULES`（`useAgentChat.js` L121-L132）只要求「每步 prompt 必须是完整纯净中文视觉描述」，无 `global_contract` 三字段结构。
- `show_plan_for_confirm` 只暂存 `generations` + 记 `memory.lastPlan`（`useCanvasAgentTools.js` L585-L591），`lastPlan` 结构 `{plan_text, generations}`，**无 `global_contract` 字段**（`conversationStore.js` L37 `emptyMemory` 也只有 `lastPlan/lastSharedStyle`，无契约）。
- `execute_plan` 执行时直接把 LLM 给的 `prompt` 写入节点 `data.prompt`（L92-L104 `createGenNode`），**未把任何「统一风格」逐字前缀化/锁死**，依赖 LLM 自己写在 prompt 里。

**缺项小结**：
| 能力 | 大雄 | 我们 |
|---|---|---|
| 带身份资产 artifact id | ✅ `input_artifact_ids`/`output_artifact_id` | ❌ 无 |
| 前序图传下游 | artifact id 注入参考图 + 连线 | ⚠️ 仅连线读 `data.imageUrl`（无身份、无强校验） |
| 统一风格逐字绑定 | ✅ `global_contract` 拼进每个 `gen.prompt` | ❌ 仅靠 LLM 自觉写进 prompt，无锁 |
| 串行依赖强校验 | ✅ 缺 `output_artifact_id` 即报错 | ❌ 无校验，靠 `depends_on_previous` 布尔 |

---

### 4.4 结论：最少改哪些文件、加什么字段（可执行）

目标：「前序定稿作为带身份的资产传给后续 + 统一风格逐字锁定每步」。

**方案选型**：复用现有 `conversationStore`（per-conversation 落盘、刷新不丢、多对话不串，已验证于 `pendingGenerations`/`lastPlan`）承载新字段；执行层在 `canvasPlanExecutor.js` 与 `useCanvasAgentTools.js` 消费。不引入新文件。

**落点 1 — conversationStore.js（加字段，对齐 `global_contract`）**

- `emptyMemory()`（L37）扩为：
  ```js
  function emptyMemory() {
    return { summary:'', facts:[], lastPlan:null, lastSharedStyle:'',
             global_contract:null,   // 新增：{visual_positioning, unified_style_prompt, unified_negative_prompt}
             artifacts:null,         // 新增：[{id,type,title,description,nodeId?,url?}]
             notes:[] }
  }
  ```
- `normalizeMemory()`（L150-L159）的返回对象补 `global_contract`/`artifacts` 缺省 `null`（与 `emptyMemory()` 同步，防旧对话恢复丢字段）：
  ```js
  return {
    summary: ..., facts: ..., lastPlan: m.lastPlan || null, lastSharedStyle: ...,
    global_contract: (m && m.global_contract && typeof m.global_contract==='object') ? {
      visual_positioning: String(m.global_contract.visual_positioning||'').trim(),
      unified_style_prompt: String(m.global_contract.unified_style_prompt||'').trim(),
      unified_negative_prompt: String(m.global_contract.unified_negative_prompt||'').trim()
    } : null,
    artifacts: Array.isArray(m?.artifacts) ? m.artifacts.slice() : null,
    notes: ...
  }
  ```
- 新增两套读写导出，仿 L263 `setCurrentMemory` / L258 `getCurrentMemory`：
  ```js
  export function getCurrentGlobalContract() {
    return getActiveConv()?.memory?.global_contract || null
  }
  export function setCurrentGlobalContract(c) {
    const conv = getActiveConv(); if (!conv) return
    commit({ ...state, conversations: state.conversations.map((x) => x.id===conv.id ? { ...x, memory: normalizeMemory({ ...x.memory, global_contract: c || null }), updatedAt: Date.now() } : x) })
  }
  export function getCurrentArtifacts() {
    return getActiveConv()?.memory?.artifacts || null
  }
  export function setCurrentArtifacts(arr) {
    const conv = getActiveConv(); if (!conv) return
    commit({ ...state, conversations: state.conversations.map((x) => x.id===conv.id ? { ...x, memory: normalizeMemory({ ...x.memory, artifacts: Array.isArray(arr)&&arr.length ? arr : null }), updatedAt: Date.now() } : x) })
  }
  ```
  > 选型说明：`artifacts` 也可放 workflow（大雄 `agentActiveWorkflow.artifacts`），但放 memory 与 `lastPlan` 同域、随对话自动落盘、刷新不丢、多对话不串（已验证于 `pendingGenerations`/`lastPlan`），优先 memory，不引入模块级态。

**落点 2 — useAgentChat.js（让 LLM 输出契约 + 续轮回灌）**

- `SKILL_EXECUTION_RULES`（L121-L132）在「规划规则」段补一条契约约束（对齐大雄 `AGENT_TASK_SPEC` L819-820 三字段）：
  ```
  - 阶段1 策划须先给出统一风格契约 global_contract 三字段：visual_positioning（视觉整体定位）、unified_style_prompt（统一风格提示词）、unified_negative_prompt（统一负面提示词），并原样写进每个后续步骤的 prompt 头部，不可改写、不可省略。
  ```
- `buildRequestMessages` 的 memory 注入段（L204-L210）增加：若 `memory.global_contract` 存在，作为 system 上下文回灌（对齐大雄逐字复用，供续轮锁定每步）：
  ```js
  if (memory && memory.global_contract && (memory.global_contract.visual_positioning || memory.global_contract.unified_style_prompt)) {
    const gc = memory.global_contract
    out.push({ role: 'system', content:
      `【本对话统一风格契约（逐字锁定，每步必须原样带入 prompt 头部）】\n视觉整体定位：${gc.visual_positioning||''}\n统一风格提示词：${gc.unified_style_prompt||''}\n统一负面提示词：${gc.unified_negative_prompt||''}` })
  }
  ```

**落点 3 — useCanvasAgentTools.js（execute_plan 暂存 + 消费契约 + artifact）**

- `presentPlanTool`（`show_plan_for_confirm`，L565-L593）：从 LLM 入参取 `global_contract` 与 `plan.artifacts`，暂存进本对话 memory：
  ```js
  // L581 附近取到 gens 后，追加：
  const gc = args.global_contract && typeof args.global_contract==='object' ? args.global_contract : null
  if (gc) setCurrentGlobalContract(gc)
  if (Array.isArray(args.artifacts) && args.artifacts.length) setCurrentArtifacts(args.artifacts)
  // L590 的 lastPlan 也扩字段，记契约摘要供审计：
  setCurrentMemory({ ...mem, lastPlan: { plan_text: planText, generations: gens, global_contract: gc, ts: Date.now() } })
  ```
- 工具参数 schema：`presentPlanTool.parameters`（L568-L578）与 `executePlanTool.parameters`（L604-L616）各补两字段：
  ```js
  global_contract: { type:'object', description:'统一风格契约 {visual_positioning, unified_style_prompt, unified_negative_prompt}，阶段1产出、逐字锁定每步',
    properties:{ visual_positioning:{type:'string'}, unified_style_prompt:{type:'string'}, unified_negative_prompt:{type:'string'} } },
  artifacts: { type:'array', description:'跨步成果资产声明 [{id,type,title,description}]，id 被后续步 input_artifact_ids 引用',
    items:{ type:'object' } }
  ```
- `executePlanTool`（L618-L665）：调用 `executePlan` 前，把 `global_contract` 三字段**逐字前缀**拼到每个 `g.prompt`（仿大雄 L6106 `verbatim`），并传 `globalContract`/`artifacts` 给执行器：
  ```js
  const gc = args.global_contract || getCurrentGlobalContract() || {}
  const gcText = [gc.visual_positioning, gc.unified_style_prompt, gc.unified_negative_prompt]
    .filter(Boolean).map((t,i)=>['视觉整体定位：','统一风格提示词：','统一负面提示词：'][i]+t).join('\n')
  const lockedGens = resolvedGens.map((g) => gcText ? { ...g, prompt: `[统一风格锁定]\n${gcText}\n\n${g.prompt||''}` } : g)
  const artifactTable = Array.isArray(args.artifacts) ? args.artifacts : (getCurrentArtifacts()||[])
  const result = await executePlan({ ctx, generations: lockedGens, autoRun, model, defaults: panel, referenceImages: globalRefs, globalContract: gc, artifacts: artifactTable })
  ```

**落点 4 — canvasPlanExecutor.js（执行器：逐字锁 + 资产注入）**

- `executePlan` 签名（L65）加 `globalContract = null, artifacts = null` 两个入参。
- `createGenNode`（L86-L107）：若 `globalContract` 三字段非空，把原文拼到 `data.prompt` 头部（双保险，即使 `lockedGens` 已拼也在执行层兜底锁定，防止 LLM 漏带）：
  ```js
  const gcText = [globalContract?.visual_positioning, globalContract?.unified_style_prompt, globalContract?.unified_negative_prompt]
    .filter(Boolean).map((t,i)=>['视觉整体定位：','统一风格提示词：','统一负面提示词：'][i]+t).join('\n')
  const lockedPrompt = gcText ? `[统一风格锁定]\n${gcText}\n\n${step.prompt||''}` : (step.prompt||'')
  // L94 改为：prompt: lockedPrompt
  ```
- Wave2（L160-L191）：除现有「连线读 `data.imageUrl`」外，若某依赖步声明 `input_artifact_ids`，从 `artifacts` 资产表取对应 `url` 显式写进该步 `data.images`（与连线并存，双保险）；并补**串行依赖硬校验**（仿大雄 L7155-L7161）：
  ```js
  // 在 dependent 循环内、建连线前：
  const inIds = Array.isArray(step.input_artifact_ids) ? step.input_artifact_ids.map(String) : []
  const matched = artifactTable.filter((a) => inIds.includes(a.id) && a.url).map((a)=>a.url)
  // 前序资产 url 显式注入参考图（与连线并存）
  if (matched.length && !stepRefImages(step).length) {
    step.referenceImages = matched   // createGenNode 会把 referenceImages 写成 data.images
  }
  // 硬校验：依赖步必须声明 input_artifact_ids 且能在资产表命中（防 prompt 口头猜依赖）
  if (inIds.length && matched.length===0) {
    entry.status='failed'; entry.error=`步骤 ${step.id} 声明 input_artifact_ids=${inIds.join(',')} 但资产表无对应 url`
  }
  ```
  > 注：我们执行器当前依赖判定是 `dependsOnPrevious`（L19-L24，看 `depends_on_previous`/`use_previous_results`/`depends_on_steps`），与 `input_artifact_ids` 并存不冲突——`input_artifact_ids` 仅用于「从资产表取前序定稿 url 注入参考图 + 硬校验」，连线仍由 `dependsOnPrevious` 触发（L170-L177）。

**改动文件清单（最少集，且均与现有 per-conversation 落盘范式一致）**：
1. `src/components/base/conversationStore.js` — `emptyMemory`(L37)/`normalizeMemory`(L150) 加 `global_contract`/`artifacts`；新增 4 个读写导出（仿 L258/L263）。
2. `src/components/base/useAgentChat.js` — `SKILL_EXECUTION_RULES`(L121) 加契约约束；`buildRequestMessages`(L204) 加契约回灌。
3. `src/components/base/useCanvasAgentTools.js` — `presentPlanTool`(L565)/`executePlanTool`(L601) 暂存与消费契约+artifacts；`parameters`(L568、L604) 补字段。
4. `src/components/base/canvasPlanExecutor.js` — `executePlan`(L65) 加两入参；`createGenNode`(L86) 逐字锁 prompt；Wave2(L160) 资产注入 + 硬校验。

> 不新增文件、不引入模块级全局态（沿用 conversationStore per-conversation 模式，与现有 `pendingGenerations`/`lastPlan` 一致）。

**自测验收（对齐第六节）**：
- A. 阶段1 LLM 输出 `global_contract` + `artifacts` → `show_plan_for_confirm` 后，`getCurrentGlobalContract()` 非空、`getCurrentArtifacts()` 含声明。
- B. `execute_plan` 执行后，任意生图节点 `data.prompt` 头部含 `[统一风格锁定]\n视觉整体定位：…`（逐字、未改写）。
- C. 依赖步 `input_artifact_ids` 命中前序资产 → 该步 `data.images` 含前序定稿 url（或连线已建立）；未命中则 `entry.status==='failed'` 且 error 明示。
- D. 刷新对话后 `global_contract`/`artifacts` 仍在（memory 落盘验证，同 `lastPlan`）。

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）」三节，已落地于第四节 4.1–4.4。


## 六、验收标准（可自测）
1. 4.1/4.2：贴出大雄 global_contract 与 artifact 的结构定义（搜索到的代码证据）。
2. 4.3：明确我们前序成果现在靠什么传（贴文件+行号）。
3. 落点必须落到具体文件+字段。

## 七、铁律文件名（产出即本文档，不新建）
本文件即唯一产出。写满后结束，不要改动任何其他文件。
