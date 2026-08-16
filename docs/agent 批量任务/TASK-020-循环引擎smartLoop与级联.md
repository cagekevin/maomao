# TASK-020 — 循环引擎 smartLoop + 级联 smartCascade 核验（大雄最差异化能力）

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论必须贴「文件 + 行号 + 关键代码片段」，不能只写"缺/不缺"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件。

---

## 一、项目背景
大雄 Infinite-Canvas 智能画布最强的差异化能力是**循环引擎（smartLoop）**：一个节点能按 N 轮循环批量生图、每轮可引用前轮输出（自引用）、可级联下游（smartCascade）推理。我们（maomao）有 `execute_plan` 多步编排，但那是"一次性多步"，不是"单节点循环 + 级联推理"。本任务核验这套循环/级联到底强在哪、我们差距多大、值不值得做。

## 二、硬约束
只读核验。结论必须可执行。

## 三、探索起点（本次实际核实）
### 大雄侧（`/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js`）
- **循环执行核心**：`runSmartCascade` @ L14242、`runSmartCascadeRoundsWithLimit` @ L14224、`runSmartCascadeFromLoop` @ L14453、`runSmartCascadeFromLoop` 入口 @ L7901
- **循环上下文**：`smartLoopContext`（L145 全局 `let`）、`smartCascadeRunPath`（L143 全局 `let`）、`smartCascadeRuns`（L144 `const Map` 运行态表）、`smartLoopRoundSettings` @ L664、`smartLoopCount`/`smartLoopWidth`/`smartLoopHeight` @ L1913-1919、`smartLoopBodyHtml` @ L7059
- **循环数据流**：`smartLoopPrompt` @ L12400、`smartLoopInputImages` @ L12420、`selfReferenceImagesForNode` @ L12449、`outputImagesForNode` @ L12440、`candidateInputImagesFor` @ L12321、`smartCascadeGraphForTail` @ L13501、`directLoopRunTargets` @ L13496、`rememberRoundOutputs` @ L12484（每轮输出存入 `ctx.roundOutputs`，自引用/输出槽的地基）
- **循环输出槽**：`loopOutputSlotsForRoot` @ L13154、`loopOutputSlotForRound` @ L13164、`createLoopOutputSlot` @ L13184、`appendLoopOutputsToNode` @ L13767

### 我们侧
- `/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`（`executePlan`：多步编排 Wave1/Wave2）
- `/Users/kevin/Documents/maomao/src/components/base/taskStore.js`（`runNodeGeneration`：单节点执行）
- `/Users/kevin/Documents/maomao/src/components/base/useCanvasAgentTools.js`（`execute_plan` 工具）
- `/Users/kevin/Documents/maomao/src/components/base/useNodeGeneration.js`

## 四、覆盖清单

### 核验点 1：大雄循环引擎完整机制
- **节点级循环**：单节点配 count=N，一轮一轮跑，每轮独立出图。
- **自引用**：`selfReferenceImagesForNode`（L12449）让第 N 轮能引用第 N-1 轮输出（迭代优化）。
- **级联推理**：`runSmartCascade`（L14242）沿连线从起点级联触发下游；`smartCascadeGraphForTail`（L13501）按连线构图；`smartCascadeRunForLoop`（L162）+ `smartCascadeRunPath`（L143）维护运行路径状态。
- **输出槽**：`loopOutputSlotsForRoot`/`loopOutputSlotForRound`（L13154/L13164）把循环输出按轮次/槽位分发给下游。

### 核验点 2：我们现状（代码证据）
- `canvasPlanExecutor.js`：`executePlan` 是"一个 generation 一步"的**扁平多步**，有没有"单节点 N 轮循环"概念？有没有"第 N 轮引用前轮输出"（自引用）？有没有"沿连线级联触发下游"？
- 结论：我们是"多步编排"（一次规划多张），大雄是"单点循环+级联"（一个节点迭代 N 次 + 触发下游），**语义完全不同**。确认差距本质。

### 核验点 3：结论 —— 值不值得对齐
- 能力矩阵：节点级循环 / 自引用迭代 / 级联推理 / 输出槽分发 / 运行状态可视化。
- 每项：我们现状、缺口、追平落点（文件+行号+改法）、成本、价值。
- **关键判断**：循环+自引用适合"迭代精修同一主体"（如逐轮提升质量）；级联适合"上游出图自动触发下游"。我们的 execute_plan 能否通过"在 executor 加 loop 参数"低成本实现？还是需要全新节点模型？
- 明确"利大于弊 / 弊大于利"倾向与理由。

## 五、输出规范
按「大雄怎么做（代码证据）/ 我们现状（代码证据）/ 追平落点（可执行）+ 价值判断」三节。

## 六、验收标准
1. 三节贯通，带文件+行号+片段。
2. 能力矩阵完整，每项有成本与价值评级。
3. 明确判断循环/级联哪个值得对齐、哪个不值得。
4. 亲自核实代码。

## 七、铁律文件名
本文件即唯一产出。写满后结束。

---

# ▶ 正式核验报告（追加于铁律正文之后）

> 以下为本任务唯一产出内容。所有行号均来自本次实际打开文件核实。

---

## A. 大雄怎么做（代码证据）

### A1. 节点级循环（单节点 count=N，一轮一轮独立出图）
- 循环轮数由 `smartLoopCount` 决定，封顶 100 轮：
```1913:1915:/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js
function smartLoopCount(node){
    return Math.max(1, Math.min(100, Number(node?.count || 1) || 1));
}
```
- `runSmartCascade`（L14242）是循环+级联总入口。它先构图、解析 `loop`（resolveSmartCascadeLoop，L13438 取上游 `smart-loop` 节点及其 `count`/`mode`），再按 `totalRounds = loop?.count || 1`（L14266）逐轮跑。
- 轮次索引 `roundIndexes`（L14406）：
```14406:14421:/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js
        const roundIndexes = Array.from({length:totalRounds}, (_, round) => startIndex + round * batchSize);
        if(loopMode === 'parallel' && totalRounds > 1){
            ...
            await runSmartCascadeRoundsWithLimit(roundIndexes, parallelLimit, (loopIndex, roundOffset) => {
                const outputTarget = parallelTargets[roundOffset] || null;
                return runRound(loopIndex, {outputTarget});
            }, runState);
        } else {
            for(const loopIndex of roundIndexes){
                throwIfSmartCascadeStopRequested(runState);
                await runRound(loopIndex);
            }
        }
```
  即：单节点可 `serial`（逐轮）或 `parallel`（最多 6 并发，受 `smartCascadeParallelLimit` L14220 限制）跑 N 轮。
- 每轮真生图在 `runLoopRoundIntoSlot`（L14062），内部 `generateUrlsForCurrentSettings`（L14133）或 `runApiGeneration`（L14106）生成，并把结果 `rememberRoundOutputs`（L14158）记进 `ctx.roundOutputs`。
- **`roundOutputs` 是自引用与输出槽分发的共同地基**：`rememberRoundOutputs`（L12484）把每轮输出按 `node.id` 存入 `ctx.roundOutputs`（`Map`）；`outputImagesForNode`（L12440-12447）在取到 `ctx.roundOutputs` 时返回该节点本轮/累积输出；`selfReferenceImagesForNode`（L12449，自引用）与 `loopOutputSlotForRound`（L13164，输出槽定位）都间接依赖它。`runSmartCascade` 在 L14307 给 `ctx` 注入 `roundOutputs:new Map()`，整条链据此串联。

### A2. 自引用（第 N 轮引用第 N-1 轮输出，迭代精修）
- 自引用核心 `selfReferenceImagesForNode`（L12449）就是取本节点已产出的输出图：
```12449:12451:/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js
function selfReferenceImagesForNode(node, consume=false, ctx=smartLoopContext){
    return outputImagesForNode(node, consume, ctx).filter(img => img?.url);
}
```
- `outputImagesForNode`（L12440）对普通图节点直接返回 `imagesForNode(node)`（即该节点自己已落盘的图）；对 loop 节点返回 `smartLoopInputImages`（L12442，上游喂给 loop 的图）。
- **单节点循环时第 N 轮引用前轮的关键在 `refsForDirectLoopRound`（L13321）**：
```13321:13330:/Users/kevin/Documents/画布/Infinite-Canvas/static/js/smart-canvas.js
function refsForDirectLoopRound(loopNode, loopIndex, total){
    if(!loopNode?.imageInput) return [];
    return outputImagesForNode(loopNode, true, {index:loopIndex, total, nodeId:loopNode.id})
        .filter(ref => ref?.url)
        .map((ref, index) => ({
            ...ref,
            role:ref.role || `image_${index + 1}`,
            name:ref.name || trf('canvas.loopImageLabel', {n:loopIndex + index})
        }));
}
```
  在 `runSmartCascade` 的 `singleNodeLoopRun` 分支（L14310-14322）调用 `refsForDirectLoopRound(loop.node, loopIndex, endIndex)` 拿到前轮输出作为本轮 `refs`（参考图），再 `runLoopRoundIntoSlot` 出本轮图 → 形成"前轮出图→本轮当参考图→再出图"的迭代链。
- 每轮 prompt 还带计数 token（`smartLoopPrompt` L12400，把 `《计数》`/`《总数》`/`《进度》` 替换成当前轮，L12411-12417），实现"第 3 张卖点图"这类逐轮差异化提示词。

### A3. 级联推理（沿连线从起点触发下游）
- 构图：`smartCascadeGraphForTail`（L13501）沿 `downstreamCascadeTargetsFor`（L13484，按 `input`/`flow` 连线）做 DFS，产出 `root / path / edges / children`（L13501-13529）。
- 触发：`runSmartCascade` 的 `runBranch`（L14326）递归跑 `graph.root` 并把每步输出 `cascadeRefsFromOutputs`（L14375/L14378）喂给下一跳 `target`，即"上游出图 → 自动当下游参考图 → 触发下游"。
- 运行路径状态：`smartCascadeRunForLoop`（L162）+ `smartCascadeRunPath`（L143，全局）；`runState.runPath.states[edgeKey]` 标记每条边 `wait/active/done`（L14297、L14370、L14393），驱动连线层可视化（scheduleConnectionLayerRefresh）。

### A4. 输出槽分发（循环输出按轮次/槽位给下游）
- 单节点循环时，为每轮预建一个 `smart-image` 输出槽：`loopOutputSlotsForRoot`（L13154，取 root 下游可承载输出图节点）+ `loopOutputSlotForRound`（L13164，按 `loopRoundIndex`/`loopSlotIndex` 定位）+ `createLoopOutputSlot`（L13184，克隆 root、清空继承、tag 轮次）。
- 每轮把结果写入对应 `outputSlot`（L14314-14322 `tagLoopOutputSlot` + `runLoopRoundIntoSlot` 写 `outputSlot.images`），下游再按连线读这些槽。
- 历史堆叠：`appendLoopOutputsToNode`（L13767）把多轮输出归并进节点、并保留历史分组。

### A5. 运行状态可视化 / 可控
- `smartCascadeRuns`（Map，L162 区域）按 `runKey`/`loopId` 记录运行态；`requestSmartCascadeStop`（L14207）支持中途停止；`smartCascadeIsLoopRunning`（L163）防重入。

**小结（大雄语义）**：一个 `smart-loop` 节点 + 下游 `smart-image` 链路 = "单节点迭代 N 轮（每轮可自引用前轮）+ 沿连线级联触发下游 + 每轮一个输出槽"，是**节点级的、状态可视化的、可控的循环推理引擎**。

---

## B. 我们现状（代码证据）

### B1. 我们只有"扁平多步编排"，无"单节点 N 轮循环"
- `executePlan`（`canvasPlanExecutor.js` L200）的核心结构是：按 `dependsOnPrevious` 分**独立批 Wave1 + 依赖批 Wave2**（L209-211），每步建一个 `promptNode` 并跑**一次** `runNodeGeneration`（L279-295 `runNode`）。每个 step 对应一个节点、只生一次图，**没有"同一节点跑 N 轮"的概念**。
- 全文件没有任何 `loop`/`round`/`selfReference`/`级联` 概念。唯一与"循环"沾边的是工具层 `MAX_TOOL_ROUNDS`（死循环护栏，非节点迭代）—— `useAgentChat.js` L69/L731，与节点循环引擎无关。

### B2. 我们的 `PromptNode` 有 `count` 字段，但它是"单次批量出 N 张"，不是"N 轮迭代"
```51:51:/Users/kevin/Documents/maomao/src/components/PromptNode.jsx
  const [count, setCount] = useState(data.count || 1)
```
```394:397:/Users/kevin/Documents/maomao/src/components/PromptNode.jsx
                  {showCountMenu && (
                    ...
                      {[1, 2, 3, 4, 5].map((n) => ... x{n} ...)}
```
  这是"一次生图请求出 1-5 张"，轮次间无自引用、prompt 不变、无"前轮图当本轮参考"。与大雄 `smartLoopCount`（独立 loop 节点、逐轮、可自引用、计数 token 进 prompt）**本质不同**。

### B3. 我们没有"自引用迭代"
- 在 `src/` 中**精确搜索以下专属术语**：`selfReference` / `自引用` / `roundOutputs` / `smartLoop` / `smartCascade` / `级联` —— **0 个命中**。
  （注：另一次宽泛搜 `loop` 命中 46 个文件，但经逐一核对均为 `for` 循环、视频 loop、或 `MAX_TOOL_ROUNDS` 工具护栏等无关项，非节点循环引擎。两者不矛盾。）
- 我们的"前序依赖"是 `execute_plan` 的 `depends_on_previous`：Wave2 节点通过**连线**读上游 `data.imageUrl` 当参考图。这套"连线数据传递"由 `useConnectedInputs.js` 实现（`useConnectedInputs.js` L139-177）：下游生成时实时 `getNodeOutput` 读取**直接上游一层**产出（L17-19 明确"只接一层、不递归"），上游更新后下游自动拿到最新。但这纯属"**不同节点之间**的依赖"，完全没有"同一节点引用自己上一轮输出"的概念。

### B4. 我们没有"沿连线级联触发下游"的自动引擎
- `executePlan` 的 Wave2 在**同一 executePlan 调用内**按 `depends_on_steps` 建连线并 `runNode`（L408-412），是**一次规划、内部顺序执行**，不是"上游节点出图后自动触发下游节点重新计算"的运行时级联。即：级联是**规划期**静态编排，不是大雄那种**运行期**沿连线动态传播（大雄 `runBranch` 递归 `runCascadeStepIntoNode` 直到叶子）。
- 我们的依赖批也没有维护"运行路径状态"（没有 `runPath.states` 那样的 `wait/active/done` 边状态机）。

### B5. 我们没有"按轮次/槽位分发输出"与"循环运行状态可视化"
- `executePlan` 每步只写一个 `resultUrl` 进 `data.imageUrl`（L290），无"每轮一个槽位节点"；
- 无 `smartCascadeRuns` 式的循环运行态/停止控制；无连线层 `active/done` 进度可视化。

**小结（我们语义）**：`execute_plan` = "一次规划、建 N 个节点、各自跑一次、靠连线传前序图"。这是**一次性多步编排**，缺"单节点循环 / 自引用迭代 / 运行期级联 / 输出槽 / 循环可视化"五件套。语义本质不同，已确认。

---

## C. 追平落点（可执行）+ 价值判断

### 能力矩阵

| # | 能力 | 我们现状 | 缺口 | 追平落点（文件+行号+改法） | 成本 | 价值 | 建议 |
|---|------|----------|------|---------------------------|------|------|------|
| 1 | **节点级循环**（单节点 count=N 轮） | 仅 `PromptNode.count`=单次批量 1-5 张（`PromptNode.jsx` L51/L396），无逐轮 | 无"逐轮"调度 | `canvasPlanExecutor.js` `createGenNode`/`runNode`（L231/L279）：给 generation 加 `loop: {count, mode}`；executor 对带 loop 的 step 在 `runNode` 内 `for(round)` 循环跑 N 次，每次写回 `data.imageUrl` 并保留历史。 | 中（需改 executor + PromptNode 支持多轮结果） | 高（迭代精修同一主体刚需） | **值得对齐** |
| 2 | **自引用迭代**（第 N 轮引前轮图） | 无 | 无"引用本节点上一轮输出" | 在 executor 循环里：第 round>1 时把上一轮 `resultUrl` 注入该 step 的 `referenceImages`（经 `createGenNode` 的 `data.images`，L243-258），实现"前轮图当本轮图生图参考"。 | 低（复用现有 images 注入通道） | 高（质量迭代核心） | **值得对齐（低成本）** |
| 3 | **级联推理**（运行期沿连线自动触发下游） | 规划期静态编排（Wave2 一次跑完，`canvasPlanExecutor.js` L323-426） | 无运行期"上游出图→自动重算下游" | 已有静态连线依赖地基：`useConnectedInputs.js`（L139-177，下游生成时实时读直接上游一层产出），`canvasPlanExecutor.js` L10-14 记载该设计；要"运行期自动触发"需在节点出图完成后（eventBus `agent:task-completed`，`taskStore.js` L190）订阅并级联 `runNodeGeneration` 下游。 | 高（需引入事件驱动的级联调度器，防环、限深） | 中（多数场景一次规划已够；实时级联用得少） | **可暂不对齐**（弊>利，收益有限且易引入复杂度/环） |
| 4 | **输出槽分发**（每轮一个槽位节点） | 每步单 `imageUrl`（`canvasPlanExecutor.js` L290） | 无轮次槽位 | 循环时每轮 clone 一个 `imageNode` 承载该轮输出（对齐大雄 `createLoopOutputSlot` L13184）。 | 中 | 中 | 随 #1 一起做即可 |
| 5 | **运行状态可视化 / 可控** | 有任务中心 `reportGenerate`（`taskStore.js` L146）+ `onLog` 进度（`canvasPlanExecutor.js` L201/L433） | 无"循环运行态/停止/边状态" | 复用现有 `onLog`+`patchCurrentWorkflow`（L676/L709）即可呈现"第 X/N 轮"，无需大改。 | 低 | 中 | **顺手对齐（低成本）** |

### 关键判断：能否"在 executor 加 loop 参数"低成本实现？
**能，且成本可控（针对能力 1/2/4/5）。**
- 我们 `executePlan` 已具备"建节点 + 跑节点 + 连线传图"的完整地基（`canvasPlanExecutor.js` L231/L279/L408）。只要给 step 增加 `loop:{count,mode}`：
  - 循环体 = 在 `runNode`（L279）外层包 `for (round=0; round<count; round++)`，复用 `runNodeGeneration`；
  - 自引用 = 循环内第 2 轮起把上一轮 `resultUrl` 设为本次 `referenceImages`（走 L243-258 已有的 `data.images` 通道）；
  - 输出槽 = 每轮额外 clone 一个 `imageNode` 承载（对齐大雄 `createLoopOutputSlot`）；
  - 可视化 = 复用 `onLog`/`patchCurrentWorkflow` 报"第 round/N 轮"。
- **不需要全新节点模型**：`smart-loop` 节点是大雄为构图/可视化单独建的"控制节点"；我们可用"generation 带 loop 参数 + executor 内循环"等价实现，无需新增节点类型，避免侵入 `useConnectedInputs`/`taskStore` 契约。

### 级联（能力 3）是否值得对齐？
**弊大于利，建议暂不投入。**
- 大雄的级联是"运行期沿连线递归触发下游"，需要状态机（`runPath.states`）、防环（`visiting` Set，L13513）、限深、停止控制——一套独立调度器，成本高。
- 我们**已有等价能力的更简形态**：`execute_plan` 在规划期一次性把"上游→下游"用连线 + 依赖批编排完（`canvasPlanExecutor.js` L323-426），对电商套图/融合等场景已覆盖。运行期级联仅在"用户在画布改了上游节点想自动重算下游"时才显价值，而这是交互态需求，可由"手动重跑下游"或未来 `agent:task-completed` 事件轻量触发，不必建完整级联引擎。
- 结论：**循环+自引用（#1/#2）利大于弊，值得做；级联（#3）弊大于利，暂不投入，用现有规划期编排 + 手动重跑即可。**

### 总体倾向与理由
- **优先对齐"单节点循环 + 自引用迭代"**（能力 1/2/4/5）：契合"迭代精修同一主体"（逐轮提升质量、逐轮差异化提示词）这一最高频刚需，且可**在现有 `executePlan` 加 loop 参数低成本实现**，无需新节点模型、不破坏现有契约，价值/成本比最高。
- **级联（#3）暂不对齐**：运行期级联引擎复杂、防环/限深/停止控制成本高，而我们的规划期静态编排已覆盖绝大多数用例，收益有限。
- 落地顺序建议：先 `#1 循环` + `#2 自引用`（同一改动内完成）→ 再 `#4 输出槽`（每轮 clone imageNode）→ `#5 可视化`（复用 onLog/workflow）。#3 留作后续独立评估。

---

## 验收自述
1. 三节（大雄/我们/追平）贯通，均带 `文件 L行号` + 片段。✅
2. 能力矩阵 5 项，每项含成本/价值评级。✅
3. 明确判断：循环+自引用值得对齐、级联暂不值得。✅
4. 全部行号来自本次实际打开核实（已逐一 `read_file` / `search_content` 大雄 `smart-canvas.js` 与我们 `canvasPlanExecutor.js`/`useCanvasAgentTools.js`/`taskStore.js`/`PromptNode.jsx`/`useAgentChat.js`/`useConnectedInputs.js`/`useNodeGeneration.js`）。✅
