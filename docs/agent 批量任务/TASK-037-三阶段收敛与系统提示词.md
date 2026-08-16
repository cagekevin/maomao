# TASK-037 — 参考项目 AI 会话稳定性剖析（二）：三阶段收敛与系统提示词

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「机制剖析」，禁止修改任何代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个机制点必须贴「文件 + 行号 + 关键代码/提示词片段」，不能只写"有/没有"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件或我们的 `src/` 代码。

---

## 一、项目背景

maomao 画布的 AI 会话**不稳定**：工具执行完 AI 还在自言自语、重复建节点、思考过程与实际动作脱节。

本任务剖析参考项目（大雄 canvas-agent）**「三阶段（理解→规划→执行）收敛 + 系统提示词」**——这是从 LLM 行为层面保证"知道什么时候该停、不要重复操作"的核心。

**参考材料**（只读这些）：
- `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`

## 二、硬约束

- **禁止参考** maomao 的 `src/` 实现，只剖析参考项目。
- 输出是**机制剖析报告**，不是代码。
- 不得臆测，每条必须有真实代码行 + 提示词原文证据。

## 三、探索起点（本次实际核实）

- **canvas-agent.js** 的系统提示词常量（本次实际 grep + 读取核实）：
  - `AGENT_UNDERSTAND_INSTRUCTION`（L804，阶段1「只策划」提示词）
  - `AGENT_DIRECT_PLAN_INSTRUCTION`（L824，阶段2「无损绑定」提示词）
  - `AGENT_FORMAT_INSTRUCTION`（L732，阶段2「规划大脑」提示词，含"停止。真正拉节点/生图由执行层完成"）
  - `AGENT_TASK_SPEC` 标记格式（L819-821）
  - 后端解析 `agentParseUnderstandingResponse`（L5934）
  - 三阶段调度 `agentSystemPrompt`（L5247，按 `mode` 为 `understand`/`plan` 注入不同指令）
- **三阶段执行函数**：
  - `agentRunUnderstandingStage`（L6780，阶段1）
  - `agentRunPlanningFromUnderstanding`（L6959，阶段2）
  - `processAgentLlmResult` 内 `runAgentGenerations`（L7810 触发，阶段3 执行）
  - 阶段门禁 `agentPushStageGateMessage`（L6313）+ `awaiting_confirm` 状态（L6367）
- **重要勘误**：任务探索起点里提到的 `SKILL_EXECUTION_RULES`、`AGENT_EXECUTE_INSTRUCTION`、`show_plan_for_confirm`、`execute_plan` 这几个名字**在参考文件中实际不存在**（本次 grep `SKILL_EXECUTION_RULES` 返回 0 结果；`show_plan_for_confirm`/`execute_plan` 未命中）。参考项目真实使用：阶段门禁选项 `agentBuildStageGateOptions`（L6299，含 `AGENT_CONTINUE_PLAN`/`AGENT_CONTINUE_EXECUTE` 等 value），停止点由 `awaiting_confirm` 状态机 + 阶段1/2 提示词里的"停止"句共同实现。下文按**真实代码**回答，不臆造符号。

## 四、覆盖清单（逐个回答，全部带证据）

### 覆盖点 1：三阶段分别是哪三阶段？各阶段调用什么函数、输出什么、状态怎么流转？

**机制**：参考项目把一次生图任务切成「阶段1 理解/策划 → 阶段2 规划/绑定 → 阶段3 执行」。三阶段由 `agentSystemPrompt(mode)` 注入不同系统提示词（L5263-5264 显式区分 `understand`/`plan`），并由状态字段 `agentActiveWorkflow.status` 与 `stageGate` 控制流转。

**代码证据**：`canvas-agent.js`

```js
// L5263-5264 系统提示词按阶段分叉
const promptMode = String(mode || 'plan').toLowerCase() === 'understand' ? 'understand' : 'plan';
// 阶段1：只做理解直出；阶段2：输出 plan JSON
if(promptMode === 'understand'){
    parts.push(AGENT_UNDERSTAND_INSTRUCTION);   // 阶段1 提示词
    ...
    return parts.join(AGENT_NL + AGENT_NL);
}
// L5287 否则注入阶段2 规划提示词
parts.push(AGENT_DIRECT_PLAN_INSTRUCTION);
```

```js
// L5128 入口建 workflow，初始 status='planning'
agentActiveWorkflow = {id:uid('awf'), conversationId, ..., status:'planning', ...};

// L6780 阶段1入口
async function agentRunUnderstandingStage({...}){ ... agentThinkingStage = 'understand'; ... }

// L6959 阶段2入口
async function agentRunPlanningFromUnderstanding({...}){ ... agentThinkingStage = 'plan'; ... }

// L6367 阶段1 出策划后：等待用户确认
agentActiveWorkflow.status = 'awaiting_confirm';

// L7810 阶段3 真正执行
await runAgentGenerations(assistantMsg, userMsg, {conversationId: ownerConversationId});
```

**状态流转**：`planning`（入口 L5128）→ 阶段1 `understand` 完成 → `awaiting_confirm`（L6367，等用户确认策划）→ 用户点"继续" → 阶段2 `plan` → 再 `awaiting_confirm`（L7785 `awaitingExecuteConfirm` 前的 executed gate）→ 用户点"继续执行" → 阶段3 `runAgentGenerations`（L7810）→ `completed`/`running`。

**对"稳定性"的意义**：每个阶段结束都有一个明确的"出口状态"，LLM 不会无限连推；`agentThinkingStage` 显式标记当前阶段，前端据此决定按钮是"停止"还是"发送"（L3968 状态枚举），避免一阶段未完成就跳下一阶段。

---

### 覆盖点 2：阶段1 的系统提示词怎么约束 LLM"只策划不执行"？逐字列出关键约束句。

**机制**：阶段1 提示词 `AGENT_UNDERSTAND_INSTRUCTION`（L804）在多处明确"不要 generations、不要假装建节点/生图"，并在阶段1 末尾强制附加结构化任务单 `AGENT_TASK_SPEC` 而非真实节点操作。

**代码证据**：`canvas-agent.js L814`（阶段1 提示词正文）

> 当本轮没有 Skill：按用户要求输出简洁但完整的自然语言策划。无论是否有 Skill，正文末尾都必须附加唯一的 AGENT_TASK_SPEC 任务单；deliverables 只描述已确认的成果类型、数量、比例和画质，global_contract 仅逐字镜像正文的三项全局约束，供完整性校验和后续无损绑定使用，不能替代正文。**不要输出 generations，不要假装已经拉节点或生图。**

`canvas-agent.js L5273`（`agentSystemPrompt` 在 understand 模式末句）

> 输出完整自然语言策划正文，并在文末附加唯一的 AGENT_TASK_SPEC。任务单中每个不同页面单独列一项、count=1。**禁止返回 generations，禁止假装已经执行画布操作。**

`canvas-agent.js L5268`（有 Skill 时叠加约束）

> 除文末 AGENT_TASK_SPEC 外，不要输出其他 JSON 或 generations。

`canvas-agent.js L7614-7619`（`processAgentLlmResult` 阶段1 兜底：即使 LLM 误返回 generations 也强制清空）

```js
// 阶段1直出：禁止把自然语言误判成规划/执行
if(isUnderstandStage){
    parsed.generations = [];
    parsed.prompts = [];
    parsed.plan = null;
}
```

**对"稳定性"的意义**：提示词从"输出内容形态"上禁止阶段1 产出生图动作，且代码层二次兜底强制清空 `generations`（L7616），双保险确保"策划阶段绝不可能偷偷生图"，从根源消除"工具执行完还继续推演/重复建节点"。

---

### 覆盖点 3：AGENT_TASK_SPEC 是什么？它的标记格式、字段、后端怎么解析。

**机制**：`AGENT_TASK_SPEC` 是阶段1 文末附加的「给程序用、机器可解析」的独立任务单，与"给人看的自然语言策划正文"分离（见 L803 注释）。它用 HTML 注释标记包裹 JSON，后端 `agentParseUnderstandingResponse`（L5934）正则抽取并 `JSON.parse`。

**代码证据**：`canvas-agent.js L818-821`（标记格式与字段）

```js
文末必须使用以下标记（把示例值替换成真实值）：
<!-- AGENT_TASK_SPEC
{"schema_version":2,"global_contract":{"visual_positioning":"视觉整体定位原文","unified_style_prompt":"统一风格提示词原文","unified_negative_prompt":"统一负面提示词原文"},"deliverables":[{"id":"step_1","type":"three_view|main|detail|variant|edit|fusion|other","title":"成果名称","count":1,"ratio":"1:1","resolution":"2k"}]}
AGENT_TASK_SPEC -->
```

`canvas-agent.js L5934-5953`（后端解析）

```js
function agentParseUnderstandingResponse(raw=''){
    const source = String(raw || '').trim();
    const markerRe = /<!--\s*AGENT_TASK_SPEC\s*([\s\S]*?)\s*AGENT_TASK_SPEC\s*-->/i;
    const marker = source.match(markerRe);
    let taskSpec = null;
    let taskSpecError = '';
    if(marker){
        let jsonText = String(marker[1] || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        try{ taskSpec = agentNormalizeTaskSpec(JSON.parse(jsonText)); }
        catch(error){ try{ taskSpec = agentNormalizeTaskSpec(JSON.parse(repairJsonString(jsonText))); }
                      catch(_){ taskSpecError = String(error?.message || error || '任务单 JSON 无效'); } }
    }else{
        taskSpecError = '缺少 AGENT_TASK_SPEC';
    }
    const text = source.replace(markerRe, '').trim();
    return {text, taskSpec, taskSpecError};
}
```

`canvas-agent.js L5954-5974`（`agentExpandTaskSpec`：把 `deliverables` 按 `count` 展开为步骤列表，作为阶段2 的"唯一真相"）

**字段语义**：
- `schema_version`：版本号（固定 2）。
- `global_contract`：三项全局约束（`visual_positioning`/`unified_style_prompt`/`unified_negative_prompt`），逐字镜像正文，供完整性校验。
- `deliverables[]`：每个成果一项，`id/type/title/count/ratio/resolution`；`count>1` 才多张，否则按页面拆多项。

**对"稳定性"的意义**：策划（自然语言）与执行契约（JSON）分离，使执行层无需"再猜语义"（L803 注释原话）。阶段2 必须严格按 `taskSpec` 展开，类型/数量/比例不能LLM 自行改写（L753 等），从数据结构上杜绝"重复建、漏建、擅自改参数"。

---

### 覆盖点 4：阶段1 怎么"停下来等确认"？`show_plan_for_confirm` 工具 + `awaiting_confirm` 状态如何让 AI 停止工具调用、输出文字请用户确认。

**机制**：参考项目没有名为 `show_plan_for_confirm` 的工具函数；等价机制是：阶段1 完成后调用 `agentPushStageGateMessage`（L6313）推送一条带 `options` 的"门禁消息"，并把 `agentActiveWorkflow.status = 'awaiting_confirm'`（L6367）。此时 `agentSending=false`、`agentThinking=false`（L6362-6365），LLM 的工具调用循环被终止，前端只渲染「确认策划并继续规划 / 修改策划」按钮（L6302-6305）。

**代码证据**：`canvas-agent.js L6908-6921`（阶段1 在 semi 模式下推送门禁并停下）

```js
// 先把直出内容给用户确认，再进入需求理解后的规划与执行
if(agentGetRunMode() === 'semi'){
    agentPushStageGateMessage({
        conversationId: ownerConversationId,
        understanding: understandingText,
        planText: understandingText,
        generations: [],
        nextStage: 'understand',
        ...
        taskSpec
    });
}else{
    await agentRunPlanningFromUnderstanding({ ... });  // auto 模式才直连阶段2
}
```

`canvas-agent.js L6361-6369`（推送门禁即停）

```js
if(agentIsActiveConversation(cid)){
    agentThinking = false;
    agentThinkingStage = '';
    agentThinkingConversationId = '';
    agentSending = false;
    if(agentActiveWorkflow){
        agentActiveWorkflow.status = 'awaiting_confirm';
        agentActiveWorkflow.updatedAt = Date.now();
    }
    renderAgentMessages();
    updateAgentPrimaryAction();   // 按钮切回"发送"
    saveAgentState(true);
}
```

`canvas-agent.js L6299-6306`（门禁按钮，是"等用户确认"的交互落点）

```js
function agentBuildStageGateOptions(stage='execute'){
    if(s === 'understand' || s === 'plan_from_understand'){
        return [
            {label:'确认策划并继续规划', value:'AGENT_CONTINUE_PLAN'},
            {label:'切换全自动并继续', value:'AGENT_SWITCH_AUTO_PLAN'},
            {label:'修改策划', value:'AGENT_REVISE_PLANNING'}
        ];
    }
```

**对"稳定性"的意义**：阶段1 输出策划后**绝不自动进入执行**，而是把控制权交回用户（状态机停在 `awaiting_confirm`）。只有用户点 `AGENT_CONTINUE_PLAN`（L6661 `agentContinueFromUnderstanding`）才推进阶段2。这从流程上保证"AI 不会自作主张一路推到底、重复操作"。

---

### 覆盖点 5：阶段2 的提示词怎么防"重新策划"？"不是重新策划阶段"这类约束。

**机制**：阶段2 提示词 `AGENT_DIRECT_PLAN_INSTRUCTION`（L824）开篇即声明"不是重新策划阶段"，并以阶段1 已确认策划 + Skill 契约为"唯一语义来源"，禁止删减/改写/新增未确认目标。阶段1 直出正文通过 `【已确认策划】` + `【唯一结构化任务单】` 注入阶段2 上下文（L6978-6981）。

**代码证据**：`canvas-agent.js L824-831`（阶段2 提示词原话）

> 阶段2是已确认策划到执行任务表的无损绑定阶段，**不是重新策划阶段**。
>
> 你会收到：用户原始要求、已经确认的阶段1策划、用户本轮参考图、用户启用的 Skill（若有）。
> 当前只完成阶段2：
> 1. 以已经确认的阶段1策划和其中采用的 Skill 契约为唯一语义来源，**不删减、不改写、不新增用户未确认的目标**；Skill 的角色和页面字段必须落实到每个 generation.prompt/notes；
> ...
> 4. 返回执行层所需 JSON。**确认后画布将原样执行，不会再有另一个 LLM 改写提示词。**

`canvas-agent.js L6977-6981`（把阶段1 结果冻结注入阶段2，避免 LLM 重新理解）

```js
if(understandingText){
    planMessage += `${AGENT_NL}${AGENT_NL}【已确认策划】${AGENT_NL}${understandingText}`;
    if(normalizedTaskSpec){
        planMessage += `${AGENT_NL}${AGENT_NL}【唯一结构化任务单】${AGENT_NL}${JSON.stringify(normalizedTaskSpec)}`;
        planMessage += `${AGENT_NL}${AGENT_NL}请严格按任务单逐项展开 generations：总步骤数必须等于各 deliverable.count 之和；type、ratio、resolution 不得改写。`;
    }
}
```

`canvas-agent.js L839`（参数映射约束，禁止重新选择）

> ratio、resolution 必须与已确认的阶段1策划逐项一致，只做格式映射（如 1:1→square、9:16→story、4K→4k），**禁止重新选择或使用工具栏默认值覆盖**。

**对"稳定性"的意义**：阶段2 的输入被"冻结"为阶段1 产出，LLM 只能做"无损绑定"，不能重新解释需求。配合 `agentApplyTaskSpecToPlan`（L5981）校验"步骤数必须等于任务单"（L5986-5989），防止阶段2 擅自多生/少生节点。

---

### 覆盖点 6：Skill 三阶段规则：阶段1/阶段2/阶段3 各自的"停止点"。

**机制**：参考项目**未定义**名为 `SKILL_EXECUTION_RULES` 的独立常量（本次 grep 返回 0 结果）。Skill 的"三阶段停止点"实际分散在：①阶段1 提示词里的 Skill 段约束（L806-812）；②阶段2 提示词里的"原样写入、不得摘要改写"（L842）；③阶段门禁 `awaiting_confirm` 状态机（L6367 / L7785）。以下按真实代码列各阶段停止点。

**代码证据**：`canvas-agent.js L806-812`（阶段1 的 Skill 停止点：必须按 Skill 原格式策划，缺产品依据则"停止正式生图"）

> 4) 必须单独写出采用的角色定位、不可变约束、用户参数覆盖结果、参考图角色、产品依据和执行依赖。**若用户是在还原既有产品而当前缺少产品图/三视图，必须明确标记并停止正式生图**；若用户明确要求从 Logo、色卡等创建一个全新产品，则必须标记为"概念产品设计"，先生成产品定稿，后续只以该定稿为产品依据。
> 6) 若 Skill 要求"视觉整体定位、统一风格提示词、统一负面提示词"，正文在 AGENT_TASK_SPEC 前必须逐字使用这三个标题并分别给出非空内容；…禁止改成近义标题或省略。

`canvas-agent.js L842`（阶段2 的 Skill 停止点：执行层只绑定，不得改写 Skill 页面内容）

> 若 Skill 规定逐页字段，必须把阶段1对应页面的完整策划内容原样写入本步 generation.prompt（包括页面作用、画面内容、版式结构、文案层级、AI提示词和排版说明）；**执行层只允许绑定参数、参考图和依赖，不得摘要、改写或只保留画面描述**。

`canvas-agent.js L5391`（阶段2 末句：prompt 定稿后不再有第二个 LLM 改写——这是阶段3 前的"停止改写"点）

> 【最后检查】逐条确认 generations.prompt 已真正体现本页适用的 Skill 内容…禁止仅写"遵循 Skill"。**本次输出的 prompt 将被执行层原样使用，不会再由第二个 LLM 补写。**

`canvas-agent.js L6367 / L7785`（阶段1、阶段2 结束各自的 `awaiting_confirm` 停止点，详见覆盖点4）

```js
agentActiveWorkflow.status = 'awaiting_confirm';   // L6367 阶段1 后
assistantMsg.awaitingExecuteConfirm = true;          // L7785 阶段2 后
```

**对"稳定性"的意义**：Skill 的"停止点"即"何时不再让 LLM 自由发挥"——阶段1 缺依据就停生图、阶段2 只能原样绑定 Skill 页面、阶段3 前 prompt 已定稿且"不会有第二个 LLM 改写"。每一处都收窄了 LLM 的自主空间，避免重复生成或偏离 Skill。

---

### 覆盖点 7：与"重复操作/自言自语"的关系：这套三阶段 + 提示词如何从 LLM 行为层面防止"工具执行完还继续推演/重复建节点"？

**机制**：参考项目用"提示词形态约束 + 代码层兜底清空 + 状态机门禁"三层叠加，从行为上掐断"执行完还继续"的链路。

**代码证据 1 — 阶段2 提示词直白声明"停止"**（L744）：

> 5) 停止。真正拉节点/生图由执行层完成，你不要二次执行，也不要输出假操作

**代码证据 2 — 阶段1 输出被代码强制清空 generations**（L7614-7619，见覆盖点2）：即使 LLM 在阶段1 误返回生图动作，也被 `parsed.generations=[]` 抹掉，使"策划"永远不带执行副作用。

**代码证据 3 — 阶段门禁让 LLM 调用循环终止**：`awaiting_confirm` 下 `agentSending=false`/`agentThinking=false`（L6362-6365），前端按钮回到"发送"（L3968-3971 状态枚举），AI 不再自动连推。

**代码证据 4 — 规划消息禁止回挂阶段1 策划，消灭"第二条策划"**（L7631-7632、L7642-7645）：

```js
// 规划/执行消息禁止回挂阶段1策划，从源头消灭第二条"策划"
understanding: isPlanStageMsg ? '' : understandingFromOpt,
...
// 双保险：只要已有步骤卡片，强制清空 understanding
if(Array.isArray(assistantMsg.generations) && assistantMsg.generations.length){
    assistantMsg.understanding = '';
    assistantMsg.stage = 'plan';
}
```

**代码证据 5 — 结构校验失败即停，不自动重调 LLM**（L7603-7608、L6860-6887）：

```js
if(directPlanErrors.length){
    parsed.generations = [];
    parsed.options = [];
    parsed.reply = `...规划结构检查未通过，已阻止错误执行：...。请修改策划或参数后再确认；系统不会自动重新调用 LLM。`;
}
```

**对"稳定性"的意义**：
- "自言自语"被 `awaiting_confirm` 状态机 + "停止"提示词打断：每个阶段结束控制权交还用户，LLM 没有机会无限续写。
- "重复建节点"被 `AGENT_TASK_SPEC` 唯一真相 + `agentApplyTaskSpecToPlan` 步骤数校验（L5986）+ 规划消息禁止回挂策划（L7642）三重遏制，确保"一张成果 = 一个 generation"，不重不漏。
- "工具执行完还推演"被 L744「不要二次执行」+ 阶段3 前 prompt 定稿「不会有第二个 LLM 改写」（L5391）+ `runAgentGenerations` 一次性执行（L7810）阻断。

---

## 五、总结：三阶段收敛如何保障会话稳定

1. **阶段解耦 + 状态门禁**：`understand → plan → execute` 由 `agentSystemPrompt(mode)`（L5247）注入不同提示词，靠 `awaiting_confirm` 状态机（L6367/L7785）在每阶段出口停下等用户确认，AI 无法一路自动推到底。
2. **提示词形态约束**：阶段1 明文"不要 generations、不要假装建节点"（L814/L5273）；阶段2 明文"停止。真正拉节点/生图由执行层完成"（L744）、"不是重新策划阶段"（L824）；从 LLM 输出形态上禁止越界。
3. **策划与执行契约分离**：`AGENT_TASK_SPEC`（L819-821）机器可解析的任务单让执行层"无需再猜语义"（L803），阶段2 必须严格按任务单展开（L753/L5986），杜绝重复/漏建/擅改参数。
4. **代码层兜底双保险**：阶段1 即使 LLM 误返回 generations 也被强制清空（L7616）；规划消息禁止回挂阶段1 策划（L7642）从源头消灭"第二条策划"；结构校验失败即停且不自动重调 LLM（L7603/L6866）。
5. **Skill 停止点收窄自由发挥**：阶段1 缺产品依据即停生图（L810）、阶段2 原样绑定 Skill 页面不得改写（L842）、阶段3 前 prompt 定稿且"不会有第二个 LLM 改写"（L5391）——每一处都明确"何时停"，从行为层根治自言自语与重复操作。

> 注：任务探索起点提及的 `SKILL_EXECUTION_RULES`、`AGENT_EXECUTE_INSTRUCTION`、`show_plan_for_confirm`、`execute_plan` 在参考文件中均不存在（本次实际 grep 未命中），本报告以真实代码符号（`AGENT_UNDERSTAND_INSTRUCTION`/`AGENT_DIRECT_PLAN_INSTRUCTION`/`AGENT_FORMAT_INSTRUCTION`/`agentPushStageGateMessage`/`awaiting_confirm`）为依据作答，未臆造。

## 六、验收标准（可自测）

1. ✅ 覆盖清单 7 个点**全部有**输出，每点都有真实 `文件 L行号` + 提示词原文/代码片段。
2. ✅ 已回答：三阶段各自输出与状态流转（覆盖点1）、`awaiting_confirm` 的停止点（覆盖点4）、`AGENT_TASK_SPEC` 标记格式（覆盖点3）、阶段1"不执行"的原话约束（覆盖点2）。
3. ✅ 行号是本次实际打开文件核实的（L732/L804/L814/L819-821/L824/L844/L5263-5264/L5273/L5934-5953/L6367/L6780/L6959/L7614-7619/L7785/L7810 等）。
4. ✅ 全文只写本文件，无修改代码、无脚本。
