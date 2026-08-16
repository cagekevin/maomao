# 08 - 大雄 canvas-agent 架构剖析与我们的地基对照

> 日期：2026-08-16
> 来源：克隆自 `https://github.com/heyu1084916812/daxiong-canvas-plugins`，位置 `~/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/`，版本 2.2.48。
> 目的：把大雄 AI 助手的完整架构记录下来（供 AI 后续参考），并对照我们自己的画布 AI 助手代码，按「对我们的价值 × 复杂度」排出地基补建优先级。
> 关联文档：`07-画布AI助手排查手册-2026-08-16.md`（我们自己画布助手的能力清单，同目录）。

---

## 〇、一句话定位

大雄 `canvas-agent`（"设计大师"）是一个**深度绑定画布、成熟度远超我们**的 AI Agent 插件。它不只是"对话 + 工具调用"，而是一整套 **「Skill 驱动的多阶段工作流引擎」**：用户需求 → 阶段1 策划 → 阶段2 规划 → 多步执行器 → 画布节点产物。

---

## 一、整体架构（模块划分）

| 文件 | 职责 | 我们有没有 |
|---|---|---|
| `web/canvas-adapter.js` | **智能画布**适配层（CanvasAgentHost 接口） | ❌ 无（我们直接 useReactFlow） |
| `web/canvas-adapter-classic.js` | **经典画布**适配层（同一 host 接口，另一套实现） | ❌ 无 |
| `web/canvas-plan-executor.js` | 多步执行器（按 generations 建节点/连线/跑图） | ❌ 无 |
| `web/input-state-machine.js` | 输入状态机（send/stop/steer/retry） | ❌ 无（我们只有 sending boolean） |
| `web/canvas-agent.js` | 主逻辑：Skill 系统、三阶段流程、generations 契约、UI | ⚠️ 部分（我们有对话循环+工具层） |
| `backend.py` | Skill 后端 CRUD（REST + 文件 + 乱码修复） | ❌ 无 |
| `builtin_skills/*.json` | 内置 Skill（纯提示词模板） | ❌ 无 |
| `plugin.json` | 插件清单/依赖/权限 | ❌ 无（我们非插件架构） |

---

## 二、画布适配层（CanvasAgentHost）—— 最核心的架构

### 2.1 设计

把所有画布操作收敛成一个 `host` 接口对象，AI 助手**只依赖 host，不碰画布内部**：

```js
window.CanvasAgentHost = {
  schemaVersion: 2,
  canvasKind: () => 'smart' | 'classic',   // 双画布各一套 adapter
  getCanvasId,
  getSelection,                             // 当前选中节点
  getNode(id),                              // 读节点
  getNodeImages(nodeOrId),                  // 读节点图
  applyNodeImages(nodeOrId, images),        // 写节点图
  createNode(type, data, position),
  createImageNode(file, position),          // 建参考图节点
  updateNode(id, patch),
  connectNodes(from, to, {kind}),           // 连线（kind=flow/reference/input）
  runNode(id, opts),                        // 跑生成（await 完成）
  cancelNodeRun(id),
  beginTransaction / commitTransaction / rollbackTransaction,  // 事务
  selectNodes(ids), focusNodes(ids),
  saveCanvas,
  resolveGenerationSettings(requested),     // provider/model 解析
  getViewportAnchor,                        // 放置新节点的锚点
  subscribe / publish,                      // 事件系统
  registerNodeType, getProviderCapabilities,
}
```

### 2.2 关键能力点

1. **双画布适配**：classic（prompt/generator/output/image 节点）和 smart（smart-image 节点）各一套 adapter，但**同一 host 接口**。执行器（plan-executor）用 `host.canvasKind()` 分支，其余逻辑完全复用。
2. **事务**：`beginTransaction` 存整画布快照 + `pushUndo()`；`rollbackTransaction` 整体回滚一次 AI 工作流。
3. **模型设置锁定**：`lockAgentNodeSettings` / `resolveGenerationSettings` 反复强调「Agent 节点绝不回落到画布底部默认模型」，同名模型按 provider 归属解析。
4. **异步安全**：每次 `await` 后用 `liveNodeById` 重新查节点（防 nodes 被 409 合并替换导致写悬空对象）；节点消失则用结果**重建节点**。

### 2.3 对我们的启示

我们的工具层直接 `useReactFlow()`（`getNodes/setNodes`），没有 host 抽象。**价值**：解耦、可测、可换画布。**代价**：重构量大。

---

## 三、异步执行器（runNode）—— 最该补的地基

### 3.1 它怎么做

`runNode(id)` 是**真正 await 生成完成**并返回结果：

```js
await runGenerator(id, {...options, cascade:true, agentDriven:true});
// 等待 output pending 真正结束（最多 15 分钟）
while (Date.now() - waitStart < 15*60*1000) {
  const pending = (output._pending || []).filter(p => !p.done && !p.error && !p.agentPlaceholder);
  if (!pending.length) break;
  await sleep(300);
  if (token.cancelled) break;
}
const images = output.images.filter(x => x.url);
return { status, nodeId, outputNodeId, images };
```

关键：
- **`cascade:true`** 绕过节点自身的 running 锁，让 Agent 编排真正执行。
- **等完成**：轮询 output pending 直到结束，返回 `images`。
- **结果兜底**：节点丢失 → 用结果重建；`applyNodeImages` 二次写回防 await 期间节点被替换。

### 3.2 对我们的启示

我们的 `trigger_generation` 是 **fire-and-forget**（`runNodeGeneration(id)` 只提交，不等结果）。**这是最大的地基缺口**——它决定了我们能否做「前序依赖」（先生成 A，用 A 结果生成 B）、多图编排、Skill 执行。

`taskStore.js` 已有 `awaitTask(nodeId, timeout)`（订阅任务完成），可复用，但工具层没用它。

---

## 四、输入状态机（InputStateMachine）

### 4.1 它怎么做

用状态机管理输入，区分「可发送/可停止/可补充/可重试」：

```js
state.status: idle | planning | creating_nodes | ready | running | stopping | failed | completed
isRunning():  status ∈ {planning, creating_nodes, ready, running}
action():     stopping→'stopping'; failed→(有内容?'retry':'idle');
              isRunning→(有内容?'steer':'stop'); 否则→(有内容?'send':'idle')
```

- **steer**：运行中用户又输入 → 「补充指令」（不打断主任务，追加到队列）。
- **retry**：失败后可重试。
- **consume()**：发送后清空草稿和附件。

### 4.2 对我们的启示

我们只有 `sending` boolean，没有「运行中可补充指令（steer）」和「失败可重试（retry）」的语义。做多轮/长任务时，用户想中途补充指令，我们无法优雅处理。

---

## 五、多步执行器（Plan Executor）—— 三阶段的执行端

### 5.1 它怎么做

`executeCanvasPlan(plan, context)` 把一个计划（steps）转成画布节点流程：

1. 按 `depends_on_previous` 把步骤分成 **independent（独立批）** 和 **dependent（依赖批）**。
2. **Wave 1**：独立批并行建节点 + 触发生成（`Promise.all`）。
3. **Wave 2**：依赖批（融合/产品参考）——**仅当独立批全部成功**才执行，用前序成功图当参考图。
4. 每步建：prompt 节点（可选）+ generator 节点 + output 节点，连线参考图。
5. 工作流对象 `{id, status, plan, nodeIds, logs, entries}` 记录全程。
6. `auto_run=false` 时只建节点不跑（ready 态）。

### 5.2 依赖模式（dependency_mode）

| 值 | 含义 |
|---|---|
| `none` | 无依赖，并行 |
| `product_reference` | 用前序「产品定稿」当参考图（保持产品一致） |
| `fusion` | 用前序全部成功图融合生成 |

### 5.3 对我们的启示

这是「Skill 生成 5主图+8详情」这类**大批量、有依赖**任务的地基。我们没有多图编排、没有前序依赖、没有 Wave 分批。

---

## 六、Skill 系统 —— 上层，但设计很轻

### 6.1 数据结构（极简，无 schema）

```json
{
  "id": "skill_xxx",
  "name": "通用整套详情页",
  "description": "根据产品信息与产品图，生成5页主图+8页详情页...",
  "content": "【一大段结构化提示词，指导 LLM 如何策划/执行】",
  "builtin": true,
  "usage_count": 0
}
```

**核心：`content` 就是纯提示词，无 parameters/steps/schema。** Skill 靠 LLM 解析 `content` 来执行，不靠结构化定义。

### 6.2 三阶段流程

| 阶段 | 指令 | 输出 |
|---|---|---|
| **阶段1 策划** | `AGENT_UNDERSTAND_INSTRUCTION` | 完整策划正文 + `AGENT_TASK_SPEC` 任务单 |
| **阶段2 规划** | `AGENT_DIRECT_PLAN_INSTRUCTION` | `generations` JSON（每张图的 prompt/ratio/dependency） |
| **执行** | `canvas-plan-executor` | 建节点/连线/跑图 |

### 6.3 generations 契约（执行唯一真相）

```json
{
  "id": "step_1", "title": "本张用途", "role": "main",
  "prompt": "完整可直接生图的中文提示词",
  "count": 1, "ratio": "square", "resolution": "2k",
  "use_attachments": true, "attachment_indices": [0],
  "input_artifact_ids": ["artifact_1"], "output_artifact_id": "artifact_2",
  "depends_on_previous": false, "dependency_mode": "none",
  "notes": "参考图角色说明"
}
```

- `attachment_indices` 精确绑定参考图（0-based）。
- `depends_on_previous` + `dependency_mode` 表达前序依赖。
- **Skill 原文无损注入**（`===== Skill 文档开始：name =====` 包起来直接给 LLM），不 rewrite。

### 6.4 完整性门禁

- 阶段1 策划过短（未完整吸收 Skill）→ 停止，不进入执行。
- 任务单步骤数与 LLM 返回 generations 数不一致 → 明确停止，不猜测执行。
- 用户参数（数量/比例/画质/语言）优先于 Skill 默认值。

### 6.5 Skill 后端（backend.py）

- REST：`GET/POST/PUT/DELETE /api/plugins/canvas-agent/skills` + `POST /skills/:id/use`（计使用次数）。
- 持久化：`skills.json` 文件（temp 原子写入）。
- **乱码修复**：`_repair_mojibake_text` 检测并修复 CP1252/Latin1 误解码的 UTF-8 中文。
- 字段校验：name 必填、content 必填、同名冲突 409、content 上限 10 万字符。

### 6.6 对我们的启示

Skill 数据结构和"无损注入"值得照搬（简单通用）。但它依赖三阶段 + generations 执行器——**做 Skill 前必须先把异步执行器和执行契约补上**。

---

## 七、会话隔离与持久化

- 每个 conversation 独立：`{skills, attachments, workflow, messages}`。
- 历史存 localStorage + KV。
- 消息结构含 `skills` 字段（当前对话启用的 Skill）。
- `AGENT_MSG_MAX = 60`，`AGENT_HISTORY_MAX = 20`，`AGENT_GEN_MAX_PER_MSG = 24`（支持 13 张套图）。

### 对我们的启示

我们只有单一 `canvas-assistant` 会话，无 conversation 隔离、无 per-conversation skills。

---

## 八、大雄做得好的健壮性细节（值得学）

1. **防双注入**：`window.__canvasAgentBooting` / `CanvasAgentPlugin?.mounted` 防止脚本重复注入双面板。
2. **live 节点防悬空**：每次 await 后重新查节点。
3. **结果兜底重建**：节点消失则用结果重建。
4. **模型设置强锁定**：防画布默认模型覆盖 Agent 选择。
5. **乱码修复**：中文在传输/存储中 mojibake 后自动修复。
6. **transaction 整体回滚**：一次 AI 工作流可整体撤销。
7. **steer 补充指令**：运行中可追加指令不打断主任务。
8. **generations 完整性门禁**：任务单与执行数不一致就停。

---

## 九、我们的地基对照（缺什么 + 按价值排序）

> 价值评估基于：对我们画布助手（后续要加 Skill、多图编排、前序依赖）的**直接收益**。复杂度为实施成本（低/中/高）。

### 9.1 核心地基缺口

| # | 缺口 | 大雄做法 | 我们现状 | 价值 | 复杂度 |
|---|---|---|---|---|---|
| 1 | **异步执行器**（trigger_generation 暴露结果） | `runNode` 等 pending 完成返回 images | `start()` 内部已 await 到 url，但 `runNodeGeneration` 只 return true、不暴露结果（见 §9.1.5 审计1） | ⭐⭐⭐ 最高（Skill/依赖/多图的根） | 低（审计后下调） |
| 2 | **前序依赖**（先生成A用A生成B） | `depends_on_previous` + `dependency_mode` | ❌ 无 | ⭐⭐⭐ 最高 | 中 |
| 3 | **generations 执行契约** | 多图 steps→节点流程 | ❌ 无 | ⭐⭐⭐（Skill 执行依赖） | 高 |
| 4 | **画布适配层 host** | CanvasAgentHost 接口 | 直接 useReactFlow | ⭐⭐ 高（解耦可测） | 高 |
| 5 | **分组事务**（整体回滚） | beginTransaction/rollback | 只有单步 undo_ai | ⭐⭐ | 中 |
| 6 | **模型强锁定**（防默认覆盖） | lockAgentNodeSettings | 只有 selectedModel 优先 | ⭐⭐ | 低 |
| 7 | **输入状态机**（steer/retry） | InputStateMachine | 只有 sending boolean | ⭐⭐ | 中 |
| 8 | **Skill 系统** | 数据结构+三阶段+后端 | ❌ 无 | ⭐⭐⭐（你要加） | 高 |
| 9 | **会话隔离** | conversation 独立 skills | 单一会话 | ⭐ | 中 |
| 10 | **事件系统** | subscribe/publish | 硬编码事件 | ⭐ | 中 |

### 9.1.5 可行性审计（2026-08-16 源码核实）

> 对「推荐建设顺序」的可行性做了一次实际代码审计，修正了多处不准确的假设。

**审计 1：异步执行器（#1）可行性 —— 比文档预想的简单**
- 核实 `src/components/base/imageApi.js`：无论 sync（`generateSync` 读 SSE 流到 url）还是 async（`generateAsync` 轮询到 url），**`generateImage` 在返回前都已经拿到结果 url**。
- 核实 `useNodeGeneration.js` 的 `start`：`await run()` 拿到 `r.url` → `taskCtl.done(r.url)`。**所以「结果 url」在 start 完成时本来就可得**。
- **修正**：`runNodeGeneration(id)` 现在是 fire-and-forget（只 `return true`），但它触发的 `start()` 本身是 async 且内部知道 resultUrl。**真正的改法不是引入 awaitTask 轮询，而是让 `start` 把 `{ ok, resultUrl }` 返回、`runNodeGeneration` 透传给调用方。** 比文档原本写的"用 awaitTask 订阅轮询"更简单、更可靠（start 完成即知 url，无需额外轮询）。`awaitTask` 仍可作兜底（应对 start 内部异常/被吞），但不是主路径。
- **结论**：#1 复杂度从「中」降为「低」，是**最容易补且收益最高**的地基。

**审计 2：前序依赖（#2）可行性 —— 成立**
- 因为 start 能拿到 A 的 resultUrl，「先生成 A、用 A 结果生成 B」可行：执行器先 `await` A 的 start 拿 url，再把该 url 作为 B 的参考图（`generateImage` 的 `images` 参数）触发生成。
- 需注意：B 的生成节点要能接受「前序结果 url 当参考图」——我们 `useConnectedInputs`/`data.images` 已支持参考图，但「运行时把前序 url 动态注入」需要执行器在建 B 时把 url 写进 B 的 `data.images`。可行，需在 generations 执行器里做。

**审计 3：generations 执行契约（#3）可行性 —— 成立但工程量大**
- 我们工具层有 `create_node`（支持 connectFrom）、`connect_nodes`、`trigger_generation`，能建多节点+连线+触发。但缺「按 generations 的 `attachment_indices`/`depends_on_previous` 批量编排 + await 前序」这一层。需新建一个 plan-executor，基于 #1 的异步执行器。

**审计 4：Skill（#8）依赖链 —— 成立**
- Skill(8) → generations(3) → 异步执行器(1)。审计确认这个依赖方向正确：Skill 的 content 只是提示词，执行要落地必须靠 #3 的 generations 执行器把「策划」转成「可执行的节点流程」，而执行器又要靠 #1 拿结果。

**审计 5：我们自己的现实约束（文档原未充分强调）**
- **参考图**：我们 `generateImage` 支持 `images` 参数（图生图），但参考图需在触发前就位。前序依赖要求「A 生成完 → 拿 url → 写进 B 的参考图再触发 B」，这是执行器要处理的时序，不是现有工具能一步到位的。
- **模型/provider 解析**：我们 `resolveProviderModel(providers, selectedModel, primary)` 存在，但 `runNodeGeneration` 触发的是节点已注册的 start（节点已带 selectedModel），执行器建新节点时要正确设 `selectedModel`，否则落到默认。这点要在 generations 执行器里显式处理（对应 #6 模型锁定）。

### 9.2 推荐建设顺序（地基依赖关系）

```
第 1 步：异步执行器（#1）✅ 已落地（2026-08-16）
第 2 步：前序依赖 + generations 执行契约（#2+#3）✅ 已落地（2026-08-16）
第 3 步：分组事务（#5）+ 模型锁定（#6）✅ 已落地（2026-08-16）
第 4 步：Skill 系统（#8）✅ 已落地（2026-08-16）
第 5 步：输入状态机（#7）+ 会话隔离（#9）+ 事件系统（#10）—— 交互与扩展（后续）。
第 6 步：画布适配层（#4）—— 长期重构，解耦（后续）。

关键依赖：Skill(8) 依赖 generations(3) 依赖异步执行器(1)。
```

**已落地记录（2026-08-16）**：

*第 1 步：异步执行器（#1）*
- `useNodeGeneration.js` `start()` 返回 `{ ok, resultUrl }`：成功后 `await saveResultToTasks` 拿**已落盘持久 URL**（生成完成即落盘 `uploads/tasks/`，url 稳定可复用），失败回退上游 url 或 `{ok:false,error}`。
- `taskStore.js` `runNodeGeneration()` 透传 start() 的 promise 结果；旧回调（返回 true/false）向后兼容。
- `useCanvasAgentTools.js` `trigger_generation` 改为 async，`await runNodeGeneration` 返回 `{ ok, resultUrl }`——AI 助手触发生成后能拿到已落盘 resultUrl，供前序依赖/多图编排复用。

*第 2 步：前序依赖 + generations 执行契约（#2 + #3）*
- 新增 `src/components/base/canvasPlanExecutor.js`：多步编排执行器，接收 `generations` 数组，按 `depends_on_previous` 分**独立批(Wave1) + 依赖批(Wave2)**（对齐大雄）。
  - Wave1：并行建 promptNode + 触发 + await 拿 resultUrl + 写回 data.imageUrl。
  - Wave2：依赖批仅当独立批全部成功才执行，用**前序节点连线**让下游 `useConnectedInputs` 自动读前序图当参考图。
  - `autoRun=false` 时只建节点不跑（ready 态）。
  - `waitForNodeReady`：addNodes 后轮询 `isNodeRegistered` 等 React 渲染 + useNodeGeneration effect 注册，避免直接 runNodeGeneration 找不到回调。
- `taskStore.js` 新增 `isNodeRegistered(nodeId)` 导出。
- `useCanvasAgentTools.js` 新增 `execute_plan` 工具（入 AI 撤销栈 MUTATING_TOOLS，整体可被 undo_ai 撤回）。工具数 22 → 23。

*第 3 步：分组事务 + 模型锁定（#5 + #6）*
- **分组事务**：`undo_ai` 从"单步快照"升级为 `aiUndoStack` 快照栈（上限 20 步）。每个写工具执行前 push 改前快照，`undo_ai` 弹出最近一个恢复。`execute_plan` 一次编排（建多节点+连线+触发）作为一个写操作 push 一次，`undo_ai` **整体撤回整个编排**（对齐大雄 beginTransaction/rollback）。
- **生图参数区（模型锁定 #6 落地）**：`AgentPanel` 新增「生图」参数条（模型下拉 + 档位 1K/2K/4K + 比例），**无数量**（对齐大雄 `resolveFinalGenCount`：数量靠用户口头写张数）。
  - 模型用 `buildAllModels(providers,'image')` 聚合所有 provider 生图模型（value=`providerId::modelId`）。
  - 参数存模块级 `genParams`（`setGenParams`/`getGenParams`，类似 `currentTaskId` 模式），`execute_plan` 读取。
  - **参数优先级对齐大雄 `resolveFinalGenParams`**：`generations` 每步 ratio/resolution > 面板 defaults（model/ratio/resolution）。

*第 4 步：Skill 系统（#8，完整对齐大雄）*
- 新增 `src/components/base/skillStore.js`：Skill 数据层。结构 `{id, name, description, content}`（纯提示词，照搬大雄）；内置 Skill「电商详情页套图」（改写自大雄 universal-detail-pages.json，适配我们的 generations 契约）；存储 = 内置（常量）+ 用户自定义（localStorage key=`agent_skills`）+ **per-conversation 启用的 skills**（key=`agent_active_skills`）+ **使用次数**（key=`agent_skill_usage`）。
- `AgentPanel` 的 Skill UI（对齐大雄）：
  - **Skill 按钮**（输入区）：点开列表（内置+自定义），选择启用/停用；自定义 skill 带删除（✕）；列表底部「新建 Skill」；显示 `已用 N 次`；内置 skill 标「内置」。
  - **空态展示常用 Skill**：空对话显示「试试这些 Skills」chips，点击直接启用。
  - **`/` 快速调用**：textarea 输入单个 `/` 弹出 Skill 下拉，选择应用。
  - **per-conversation 持久化**：activeSkills 存 localStorage，刷新不丢。
- `AgentMessage`：user 消息显示「已使用 Skill」标签（对齐大雄 skillsHtml）。
- `useAgentChat` 加 `skills` 参数 + `skillsRef`；`buildRequestMessages` **无损注入** Skill content（包 `===== Skill 文档 ====`）+ `SKILL_EXECUTION_RULES`（对齐大雄：Skill 驱动三阶段）。
- **三阶段流程**（对齐大雄 understand→plan→execute）：
  - 阶段1：LLM 规划 generations，调 `present_plan` 工具（传 plan_text + generations）→ 前端展示策划给用户确认（作为一条 assistant 消息），generations 暂存模块级 `pendingGenerations`。
  - 阶段2：用户确认后，LLM 调 `execute_plan` 执行（execute_plan 若没传 generations 则用暂存的）。
  - `present_plan` / `execute_plan` 都入 AGENT_TOOLS（工具数 23 → 24）。
- **对齐差距（剩余）**：Skill 完整编辑（修改已有 content）未做（用新建+删除替代）；Skill 文件（.md）引入未做。如需可后续补。

---

## 十、结论

大雄 canvas-agent 的**地基层精华是「异步执行器 + 前序依赖 + generations 执行契约 + 事务」**，它把 AI 助手从"单步工具调用"提升为"多步工作流引擎"。Skill 反而是最上层的、最简单的（纯提示词）。

我们当前的画布助手是"对话 + 22 个工具"的单步模型，**缺的是把单步变成多步工作流的地基**。要加 Skill，必须先补异步执行器和执行契约。

> 我们的优势：任务中心持久化、刷新恢复轮询、`awaitTask` 已有、分层清晰（这些大雄反而没有）。
