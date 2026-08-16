# TASK-0010 — depends_on_steps 精确取前序（两批执行链）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号必须来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」，不能只写"缺/不缺"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件，不知道有几个 AI 在并行。

---

## 一、项目背景
我们 AI 助手逐项追平大雄。本任务深入核验「依赖步是否支持精确指定用哪几张前序结果，而非全部」。

## 二、硬约束
只读核验。产出必须「可执行」。

## 三、探索起点（真实 grep，行号以实际核实为准）

### 大雄侧（本次核实真实行号）
- 主文件 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
  - 规划器把 `depends_on_steps` 写入 generation（两批链）：`L7261-7284`（`foundationIds` = 首批全量 id，`depends_on_steps = foundationIds.slice()`）
  - 校验 `input_artifact_ids` 必须含首步 `output_artifact_id`：`L7155-7161`
  - LLM 输出契约里 `input_artifact_ids` / `output_artifact_id` 字段定义：`L834`、`L5925-5926`、`L10784-10786`
- 执行器 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-plan-executor.js`
  - `sourceMeta` 透传 `input_artifact_ids` / `depends_on_steps`：`L46-48`
  - `stepDependsOnPrevious`：`L51-57`（含 `depends_on_steps` 数组非空判断）
  - `stepDependencyMode`：`L58-67`（`none`/`fusion`/`product_reference`）
  - Wave2 挂载前序图：`L596-626`（`productImages.slice(0,1)` 首张、`prevImages` 全部，按 `mode` 分支）

### 我们侧（本次核实真实行号）
- 执行器 `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`
  - 前序判断 `dependsOnPrevious`：`L19-24`（读 `depends_on_previous` / `use_previous_results` / `depends_on_steps` 数组非空）
  - Wave2 挂载：核心段 `L161-191`，取前序 `L170`、连边 `L176`（`prevOk.map(...).addEdges`，全部成功前序）
  - 入参签名：`L65`（`executePlan({ ctx, generations, autoRun, model, defaults, referenceImages })`）——**无 `input_artifact_ids` 字段**
  - `createGenNode` 的 `data`：`L92-104`——**未透传 `depends_on_steps` / `input_artifact_ids`**

## 四、覆盖清单（逐项给「大雄怎么做 + 我们缺在哪 + 精确落点」）
1. 大雄怎么用 `depends_on_steps` / `input_artifact_ids` 精确指定「本步用哪几张前序」？
2. 我们 Wave2 现在是不是把全部成功前序都连到本步？能否指定 subset？
3. **结论**：我们 `executePlan` 要改成什么样才能支持 `depends_on_steps`（精确取前序节点）。

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）」三节。

---

## 六、核验结论（本任务产出）

> 核验方法：本文件所引用的行号均来自本次实际打开文件核实
> - 大雄执行器 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-plan-executor.js`（已通读，含 `sourceMeta` L46-48、`stepDependsOnPrevious` L51-57、`stepDependencyMode` L58-67、Wave2 挂载 L596-626）
> - 大雄规划器 `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`（按 `depends_on_steps`/`input_artifact_ids`/`foundationIds` 关键词 grep 核实，关键段 L7261-7284、L7155-7161、L834、L5925-5926、L10784-10786 均已打开核对）
> - 我们执行器 `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`（已通读 198 行，关键段 L19-24、L65、L92-104、L160-191 均已打开核对）

### 覆盖点 1 — 大雄怎么用 `depends_on_steps` / `input_artifact_ids` 精确指定「本步用哪几张前序」

**结论：大雄把这两个字段当作「规划契约/声明」，由上游 LLM 规划器填充；执行器读取并透传到节点，但 Wave2 实际挂载前序图时并未用它们做精确 subset 筛选。**

证据：

1. 规划器把 `depends_on_steps` 写进 generation（两批链：先 Logo/三视图/包装，再融合）：
```7270:7284:/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js
if(index < requirements.initialCount){
    gen.depends_on_previous = false;
    gen.dependency_mode = 'none';
    gen.depends_on_steps = [];
}else{
    gen.depends_on_previous = true;
    gen.depends_on_steps = foundationIds.slice();   // foundationIds = 前 initialCount 个 step.id 列表
}
```
`foundationIds` 来源（全部首批 step.id，非 subset）：
```7261:7263:/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js
const foundationIds = gens.slice(0, requirements.initialCount)
    .map((gen, index) => String(gen?.id || `step_${index + 1}`).trim())
    .filter(Boolean);
```

2. 执行器只在 `sourceMeta` 里读取并透传（写入节点 `agentSource`），没有拿它去筛选前序图：
```46:48:/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-plan-executor.js
inputArtifactIds: Array.isArray(step.input_artifact_ids) ? step.input_artifact_ids.slice() : [],
outputArtifactId: String(step.output_artifact_id || ''),
dependsOnSteps: Array.isArray(step.depends_on_steps) ? step.depends_on_steps.slice() : []
```

3. Wave2 真正决定「挂哪些前序图」的是 `dependency_mode`，不是 `depends_on_steps`：
   - fusion 模式：挂**全部**成功前序 `prevImages`（L623）
   - product_reference 模式：仅挂**首张** `productImages.slice(0,1)`（L598）
```596:626:/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-plan-executor.js
const prevImages = collectPrevImages(wave1Entries);          // L596：收集 Wave1 全部成功前序图
const productImages = prevImages.slice(0, 1);               // L598：仅取首张
...
for(let di = 0; di < dependent.length; di++){
    ...
    const mode = stepDependencyMode(step);                  // L605：由 step 字段/提示词判定
    ...
    if(mode === 'product_reference'){                       // L611
        const existingUserRefs = (Array.isArray(step.references) ? step.references : []).filter(r => r?.url);
        if(existingUserRefs.length && step.depends_on_previous !== true && step.use_previous_results !== true){
            refs = existingUserRefs.slice();
            step.dependency_mode = 'none';
        }else{
            refs = mergeReferences(productImages..., existingUserRefs);  // L618：挂首张 + 用户原图
            step.dependency_mode = 'product_reference';
        }
    }else{                                                  // L622：fusion（或默认）
        refs = (prevImages || []).filter(r => r?.url);      // L623：挂【全部】成功前序，不做 subset
        step.dependency_mode = 'fusion';
    }
```
> 关键观察：L623 的 `refs` 直接来自 `prevImages`（Wave1 全量），**没有任何"按 `step.depends_on_steps` 过滤"的代码分支**；`depends_on_steps` 在 L48 被读入 `agentSource` 后，在本函数内再未被引用。这坐实了"executor 未用 depends_on_steps 做精确 subset"的结论。

> 严谨限定：大雄两批链里 `depends_on_steps` 的**实际取值 = 全部首批 step.id 列表**（`foundationIds.slice()`，见 L7280），因此"按 `depends_on_steps` 取"与"按全部前序取"在它的场景里结果完全一致，无法证伪其 subset 能力。但它**确实没有「只取首批中某几张（如 logo+三视图、排除包装）」的 executor 分支**——任何真正 subset 需求在当前 executor 都会退化成 `dependency_mode` 的"全量(fusion)/首张(product_reference)"两档。即：大雄把精确取前序的"语义声明"交给 LLM 规划器，executor 只落实"全/首"两档，subset 精度未真正落地。其精确定位仅发生在「LLM 规划阶段声明 + 校对阶段校验」（如 L7155-7161 校验 `input_artifact_ids` 必须包含首步 `output_artifact_id`）。

### 覆盖点 2 — 我们 Wave2 现在是不是把全部成功前序都连到本步？能否指定 subset？

**结论：是，我们把「全部成功前序节点」无差别连到本步，没有任何 subset 指定机制。**

证据（我们 `canvasPlanExecutor.js`）：
```161:177:/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js
if (dependent.length) {
  const prevFailed = entries.filter((e) => e.status !== 'completed').length
  for (let i = 0; i < dependent.length; i++) {
    ...
    // 前序依赖：把「已成功的独立批节点」连到本步节点
    const prevOk = entries.filter((e) => e.status === 'completed' && e.nodeId)
    ...
    const edges = prevOk.map((e) => ({ id: `e-plan-${nodeId}-${e.nodeId}`, source: e.nodeId, target: nodeId }))
    ctx.addEdges(edges)
```
- L170：`prevOk` = 所有 `status === 'completed'` 的前序，不区分哪几张。
- L176：对这些节点**全部** `addEdges` 连到本步。
- 没有读 `step.depends_on_steps`，也没有 `dependency_mode` 概念，因此**既无法指定 subset，也无法区分 fusion/首张**。
- 进一步：**我们 `executePlan` 的入参（`ctx / generations / autoRun / model / defaults / referenceImages`，见 L65）里根本没有 `input_artifact_ids` 字段**，连规划侧传过来的 `input_artifact_ids` 都不会被接收/透传——比大雄少了"契约声明"这一层。

> 我们与大雄的差距不是「有没有 subset」，而是两层缺口：（a）大雄至少有 `dependency_mode` 区分 fusion(全)/product_reference(首张)，我们只有全连；（b）大雄至少把 `depends_on_steps`/`input_artifact_ids` 解析透传进节点 `agentSource` 供校验，我们连这两个字段都不接收。`depends_on_steps` 的精确 subset 在**双方 executor 挂载逻辑里都未真正落地**，但大雄的"声明+校验"基础设施更完整。

### 覆盖点 3 — 结论：我们 `executePlan` 要改成什么样才能支持 `depends_on_steps`（精确取前序节点）

**可执行落点（只动 `canvasPlanExecutor.js`，不碰 `src/` 其他文件）**

改动 1 + 改动 2 合并：改写 Wave2 的 L170-177 区块，用 `step.depends_on_steps` 精确过滤、并用 `dependency_mode` 分层。

> 原代码（L161-191 内 Wave2 核心段，本次核实原样）：
```170:177:/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js
      const prevOk = entries.filter((e) => e.status === 'completed' && e.nodeId)
      if (prevFailed > 0 || prevOk.length === 0) {
        entry.status = 'failed'
        entry.error = prevFailed > 0 ? '前置步骤未全部成功，已跳过' : '无前序成功结果，已跳过'
      } else {
        // 建连线：每个前序结果节点 → 本步节点
        const edges = prevOk.map((e) => ({ id: `e-plan-${nodeId}-${e.nodeId}`, source: e.nodeId, target: nodeId }))
        ctx.addEdges(edges)
```

> 替换为（精确取前序 + 两层模式，行号对齐原 170-177）：
```js
      // 精确取前序：若 step 显式声明 depends_on_steps，只取这些 id 的成功结果；否则回退全部成功前序
      const prevOkAll = entries.filter((e) => e.status === 'completed' && e.nodeId)
      const prevOk = Array.isArray(step.depends_on_steps) && step.depends_on_steps.length
        ? prevOkAll.filter((e) => step.depends_on_steps.includes(e.stepId) || step.depends_on_steps.includes(e.id))
        : prevOkAll
      // 对齐大雄 dependency_mode：product_reference 只挂首张，fusion/未声明 用 prevOk（已是精确或全量结果）
      const depMode = String(step.dependency_mode || '').toLowerCase()
      const prevSources = depMode === 'product_reference' ? prevOk.slice(0, 1) : prevOk
      if (prevFailed > 0 || prevSources.length === 0) {
        entry.status = 'failed'
        entry.error = prevFailed > 0 ? '前置步骤未全部成功，已跳过' : '无前序成功结果，已跳过'
      } else {
        // 建连线：每个命中的前序结果节点 → 本步节点
        const edges = prevSources.map((e) => ({ id: `e-plan-${nodeId}-${e.nodeId}`, source: e.nodeId, target: nodeId }))
        ctx.addEdges(edges)
```
- 说明：`entry` 记录 `entry.id`（`step.id || dep_${i+1}`）与 `entry.stepId`（`step.id`），`depends_on_steps` 里存的是上游 `step.id`（如 `step_1`），故用 `includes` 同时匹配两字段可精确命中。
- 注意：校验仍用 `prevFailed`（是否有失败前序）决定整体跳过；`prevSources.length === 0` 覆盖"声明了 depends_on_steps 但所指前序未成功"的情形。

改动 3（建议，追平大雄契约透传）：在 `executePlan` 入参接收 `input_artifact_ids`，并在 `createGenNode` 的 `data`（L92-104）里透传，便于后续人工/调试核对。
- 入参补：`input_artifact_ids` 字段（L65 的 `{...}` 内加 `inputArtifactIds = []`）。
- `data` 内补（L92-104 任意位置）：
```js
...(Array.isArray(step.depends_on_steps) && step.depends_on_steps.length ? { dependsOnSteps: step.depends_on_steps } : {}),
...(Array.isArray(step.input_artifact_ids) && step.input_artifact_ids.length ? { inputArtifactIds: step.input_artifact_ids } : {}),
```
- 注：仅透传、不参与挂载逻辑，作用等同大雄 `sourceMeta`（executor L46-48），为将来 subset 校验/UI 显示打底。

**端到端两批链示例（可自测）**
规划：首批生成 `step_1`(Logo)、`step_2`(三视图)、`step_3`(包装)；第二批 `step_4` 融合，但只想用 Logo+三视图、排除包装。
- 上游传入：`step_4.depends_on_steps = ['step_1','step_2']`，`step_4.dependency_mode = 'fusion'`。
- 改后行为：`prevOkAll` = `[step_1,step_2,step_3]` 全部成功 → `prevOk` 经 `includes` 命中 → `['step_1','step_2']` → `depMode!=='product_reference'` → `prevSources = ['step_1','step_2']` → 只连这两张。✅
- 现状行为（改前）：`prevOk` = 全部三张 → 连三张，包装被误纳入融合。❌
- 大雄现状：其 `depends_on_steps` 在两批链里恒等于 `['step_1','step_2','step_3']`（foundationIds 全量），executor 又按 `dependency_mode=fusion` 取全部，故同样连三张；它**没有"排除包装"的 executor 分支**。我们的改法因此比大雄当前 executor 更精确。

**追平后的行为矩阵（与现状对比）：**
| 场景 | 大雄现状（executor） | 我们改后 |
|---|---|---|
| 未声明 `depends_on_steps` | fusion=全部前序；product_reference=首张 | 同（`dependency_mode` 未声明→全连，对齐 fusion 默认） |
| `depends_on_steps:['a','b']` | 透传但 executor 仍按 mode 取全部/首张 | **精确只连 a、b 两张** ✅ 追平并超越 |
| `dependency_mode:'product_reference'` | 只挂首张 | 只挂首张 ✅ |
| `input_artifact_ids` 接收 | 有（规划+校验） | 改后透传（改动 3），补全缺口 |

> 结论：通过「改动 1+2」即可让 `executePlan` 真正支持 `depends_on_steps` 精确取前序节点；叠加「改动 3」补齐 `input_artifact_ids` 契约透传，使我们从"全连、无契约"追平到"精确 subset + 两层模式 + 契约声明"，并在 subset 精度上优于大雄当前 executor。


## 七、验收标准（可自测）
1. 每个核验点都给出「大雄怎么做（代码证据）+ 我们现状（代码证据）+ 追平落点（文件+行号+改法）」。
2. 落点必须落到具体文件+行号，不能写"在合适位置"。
3. 结论必须你亲自核实过代码，不能只引用外部文档。

## 八、铁律文件名（产出即本文档，不新建）
本文件即唯一产出。写满后结束，不要改动任何其他文件。
