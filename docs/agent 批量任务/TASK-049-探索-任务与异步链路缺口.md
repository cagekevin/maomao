# TASK-049 — 探索：任务中心 / 异步链路"该走却没走"缺口

> 你只能写这个文件，碰任何其他文件视为失败。本任务只探索 + 产出本文档，禁止改代码。

## ⚠️ 铁律
1. 只读不改，禁止写脚本。
2. 自包含，不查看其他 TASK-*。
3. 一切结论必须有代码证据（文件 + 行号 + 片段），行号由你亲自打开核实。

## 一、背景
项目有任务中心 + 异步生图/视频任务。任务应走「前端上报 → 后端持久化 → 轮询恢复 → 结果回填」链路，可能有多处"该走却没走"：任务只在内存不落盘、刷新丢失、taskId 链路断、轮询不恢复、结果 URL 处理错。你的任务：**自己去 src/ 探索任务与异步链路，找出所有缺口**。

## 二、判断标准（你按此自己找）
- 任务本应持久化（落盘/后端）却只在内存、刷新即空。
- 任务本应有 taskId 贯穿链路（前端→网关→后端→轮询），若断链找缺口。
- 异步任务本应刷新后恢复轮询，若只在内存找缺口。
- 结果 URL（数组/字符串）本应正确回填节点，若处理错找缺口。
- 并发上限、状态流转本应正确，若没走该分支找缺口。

## 三、怎么做
1. 通读 `src/components/base/taskStore.js`、`imageApi.js`、`videoApi.js`、`pollTask.js`（若有）、`useNodeGeneration.js`。
2. 梳理任务从提交→持久化→轮询→回填的完整链路。
3. 找出每一步"该走却断/该存却没存"。

## 四、输出规范
按链路逐段输出：`### 环节：<名>` + `**缺口**：` + `**证据**：文件:行 + 片段` + `**本应**：`

## 五、验收标准
1. ≥3 个"该走却没走/该存却没存"缺口，每条带文件:行 + 证据。
2. 覆盖任务提交、持久化、刷新恢复、结果回填。
3. 只写本文件，不改代码、不写脚本。

---

## 探索结论（审计修正版）

> 范围：仅读 `src/` 与 `localTool/` 代码，确认任务与异步链路"该走却没走"的缺口。
> 已通读：`taskStore.js` / `pollTask.js` / `useNodeGeneration.js` / `imageApi.js` / `videoApi.js` /
> `tasksApi.js` / `filesApi.js` / `localTool/src/routes/tasks.ts` / `localTool/src/routes/system.ts`，并交叉核对
> `App.jsx` 调用点、`useNodeGeneration` 全部 5 个使用方（TextNode / TemplateNode / PromptNode / DiscountVideoNode）。
> 本任务**未改任何代码、未新增脚本**，仅产出本文档。行号均来自本次亲自打开文件核实。
> 本版为二审修正：剔除了初稿中误用的不存在函数/变量（`notFoundCount`、`saveRemoteUrl`、`onMediaResult`、
> `media:result`、`saveMedia`、`genMax`），并精确化了缺口 A/B/C/D 的影响方与定性。

---

### 环节一：任务提交与 taskId 贯穿

**已确认自洽（非缺口）**：前端 taskId 经 `setCurrentTaskId` 贯穿到 `proxyRequest` 的 `X-Task-Id` header。
- **证据**：`useNodeGeneration.js:84` `setCurrentTaskId(taskCtl.taskId || '')`；`taskStore.js:23-28` 模块级 `currentTaskId` + `getCurrentTaskId()`；`imageApi.js:13` / `videoApi.js:15` 导入 `getCurrentTaskId, setTaskPollId`，在 `proxyRequest` 内读取 `getCurrentTaskId()` 加 header。提交链路贯通。
- **结论**："前端 taskId ↔ 网关 thread_id" 关联机制存在，非缺口。

### 环节二：刷新恢复轮询端点（提交前台轮询 vs 刷新后恢复轮询）

**缺口 B（设计异轨 · 存疑待验 · 非已确认 bug）**：两条轮询路径端点不同。
- **证据**：
  - 提交前台轮询：`imageApi.js:144` `buildTargetUrl(provider, \`tasks/${taskId}\`)` ⇒ `provider.base_url/v1/tasks/{taskId}`；`videoApi.js:77` 同构。此处路径段是 `v1/tasks/{id}`。
  - 刷新恢复轮询：`pollTask.js:65` `fetch(\`${API_BASE}/api/v1/gateway/task/${pollTaskId}\`)` ⇒ `localTool:18080/api/v1/gateway/task/{id}`，经 `localTool/src/routes/system.ts:54` `handleGatewayTask` 转发到 `apimart-gateway:9004/v1/gateway/task/{id}`。此处路径段是 `v1/gateway/task/{id}`。
  - 存入的 `pollTaskId` 值来自 `response.data.task_id`（`imageApi.js:141` `setTaskPollId(getCurrentTaskId(), taskId)`；`videoApi.js:74` 同构）。
  - `system.ts:43-53` 路由注释明示该 `/api/v1/gateway/task` 端点**最初为「特惠视频 discountVideo / Vr.jsx」直连查询而建**（`code:200→1` 改写适配 Vr.jsx）；但 `pollTask.js:16-18` 注释把它复用为「统一转发网关的固定查询端点，按 task_id 查，不依赖具体 provider」。
- **本应**：若 `provider.base_url` 与 `apimart-gateway` 指向同一网关，则两条路径查的是同一 `task_id`，理论上都通（仅是路径风格不同：`/v1/tasks/{id}` vs `/v1/gateway/task/{id}`）。**风险点**：`system.ts` 该路由起初为特惠视频设计，对普通生图/视频的 `task_id` 是否同样通用，取决于 apimart-gateway 是否同时暴露这两种 task 查询路径——此点**本探索未运行后端、无法定论，标记为存疑待验**。
- **定性**：不武断为 bug。属"提交前台轮询"与"刷新恢复轮询"两条异轨路径，建议后续 TASK 抓取真实 `pollTaskId` 实测 `/v1/gateway/task/{id}` 是否 200。

### 环节三：结果回填节点（onRecover 覆盖）

**缺口 A（中 · 真实缺口）**：刷新后结果回写节点卡片的 `onRecover` 仅 2/4 个**会进入异步恢复**的节点实现；真正受影响的是 `TemplateNode`。
- **证据**：
  - `useNodeGeneration` 共 4 处使用：`TextNode.jsx:124`（type=`text`）、`TemplateNode.jsx:174`（type=`image`）、`PromptNode.jsx`（useNodeGeneration 在约 L151，onRecover 实现在 L190）、`DiscountVideoNode.jsx`（useNodeGeneration 在约 L129，onRecover 实现在 L154）。
  - 仅 `PromptNode.jsx:190`、`DiscountVideoNode.jsx:154` 传入 `onRecover`。`TextNode`、`TemplateNode` **未传**。
  - `useNodeGeneration.js:154-163` 监听 `agent:task-completed`，命中条件 `d.nodeId===nodeId && d.status==='completed' && d.resultUrl`，回调 `onRecoverRef.current?.(d)`（`?.` 可选调用）。**未传 onRecover 时，广播被静默忽略，结果仅写进任务中心（`patchTask`），不回写节点 data**。
- **影响方精确化**：
  - `TemplateNode`（模板生图，`type:'image'`，`run` 用 `generateImage`）可按 `provider.image_mode='async'` 走异步、产生 `pollTaskId` → 刷新后 `pollTask.js` 恢复完成并广播，但 `TemplateNode` 无 `onRecover` → **卡片仍停在"待生成/空"，用户只能去任务中心翻图**。这是缺口 A 的真实唯一落点。
  - `TextNode`（`type:'text'`，走 chatCompletions sync）**本就无 `pollTaskId`、不进异步恢复轮询**，缺 `onRecover` 对其无影响，不应计入本缺口。
- **本应**：所有可异步的生图节点都应实现 `onRecover`，最起码 `TemplateNode` 需补。

### 环节四：结果 URL 落盘不一致（首生成 vs 刷新恢复）

**缺口 D（中 · 真实缺口 · 初稿遗漏）**：首次生成与刷新恢复两路径对结果 URL 的"落盘到 uploads/tasks"处理不一致。
- **证据**：
  - 首次生成（用户点生成）：`useNodeGeneration.js:99-101` 成功后在 `start` 内调用 `saveResultToTasks(rawUrl, t.type)` 把结果幂等落盘到 `localTool/.../uploads/tasks/`（真实函数见 `filesApi.js:136` `saveResultToTasks`），返回持久 URL 给调用方。
  - 刷新恢复（pollTask.js 完成）：`pollTask.js:78` 仅 `patchTask(task.id, { status:'completed', progress:100, resultUrl })` 把 `resultUrl` 写回任务记录，**未调用 `saveResultToTasks` 落盘**。
- **本应**：两条路径应一致——恢复到的 `resultUrl`（上游 http(s) url）也应经 `saveResultToTasks` 落盘到 `uploads/tasks/`，否则"生成面板（读 uploads/tasks）"在刷新恢复场景下看不到该结果，只有任务中心有 url。首次生成能落盘、刷新恢复不能，属"该走却没走"。
- **注**：`filesApi.js` 真实落盘函数为 `saveResultToTasks`（http/data → multipart 上传 `localTool/api/files/upload`，落 `SUBFOLDER='tasks'`），以及 `saveInlineToLocal` / `uploadFileToLocal` / `saveTextToTasks`。初稿误写的 `saveRemoteUrl`/`onMediaResult`/`media:result`/`saveMedia` **在本代码库中均不存在**，本版删除。

### 环节五：持久化（pollTaskId 落库闭环）

**已排除（非缺口）**：`pollTaskId` 持久化链路自洽。
- **证据**：后端 `tasks.ts:46-52` `ALLOWED_TASK_COLUMNS` 含 `poll_task_id`；列映射 `CAMEL_TO_SNAKE['pollTaskId']='poll_task_id'`，`taskToRow` 正确映射，`saveTask`/`patchTask`（`taskStore.js` → `tasksApi.js` → 后端）能落库；`rowToTask` 反向映射回 `pollTaskId`。刷新后 `fetchTasks`（`App.jsx:408` `initTasks()`）取回的任务携带 `pollTaskId`，`pollTask.js:100-101` 的 `candidates = tasks.filter(t => (t.status==='running'||t.status==='pending') && t.pollTaskId)` 有数据。

### 环节六：历史任务加载闭环

**已排除（非缺口）**：`App.jsx:407-416` 挂载即 `initTasks()` → `fetchTasks` 拉后端 `/api/tasks`；延迟 500ms（`App.jsx:414`）启动 `initTaskRecovery()`（防重复启动见 `pollTask.js:113-114`）。历史任务加载与恢复轮询触发闭环通。
- **小观察（非缺口）**：`initTaskRecovery` 延迟 500ms，若后端 `/api/tasks` 慢于 500ms，首轮 `runRound`（`pollTask.js:98`）`candidates` 可能为空；但 `setInterval` 每 2s 检查 + 5s 节流（`pollTask.js:29,115-120`）会持续重试，仅是延迟，非永久缺口。

### 环节七：文本 / sync 任务刷新恢复（取舍边界）

**缺口 C（低 · 设计取舍）**：文本通道（sync）与「生图 sync 模式」无 `pollTaskId`（`setTaskPollId` 仅在 `generateAsync` 路径调用，见 `imageApi.js:141` / `videoApi.js:74`）。
- **证据**：`imageApi.js:237-240` 按 `provider.image_mode` 分流 sync/async；`App.jsx:410-412` 注释承认"文本/生图 sync 同步无 taskId，不在此轮询范围（刷新断即断，官方同此）"。
- **本应**：属"异步/长时任务刷新可恢复"诉求下的覆盖盲区，已明确取舍，非 bug（方案 B 文本异步化在 `pollTask.js:20-22` 注释中列为未实施）。

### 环节八：并发上限（漏跑风险）

**存疑（低 · 设计取舍）**：`runNodeGeneration`（`taskStore.js:303-316`）在 `genActive >= MAX_CONCURRENT_GEN`（=6，`taskStore.js:283-284`）时直接 `return false`（跳过、不排队），节点保持"待生成"，由用户手动点。注释（`taskStore.js:277-282`）明言"超出上限不自动触发、不排队"。
- **本应**：非 bug，是明确取舍（避免一次打爆上游、避免"排队中"状态）。但 AI 批量生成（`executePlan` 规划多张）触顶时，超出节点不会被重试，需用户手动补跑——属取舍边界，若业务要求"批量必须全跑完"则需引入排队。

---

### 结论摘要（按严重度 / 确定性）

| ID | 环节 | 确定性 | 严重度 | 类型 |
|----|------|--------|--------|------|
| A | TemplateNode 缺 onRecover，刷新后异步生图结果不回写卡片 | 已确认 | 中 | 真实缺口 |
| D | 刷新恢复路径未落盘 resultUrl 到 uploads/tasks（首次生成会落盘） | 已确认 | 中 | 真实缺口 |
| B | 提交前台轮询 `/v1/tasks/{id}` vs 恢复轮询 `/v1/gateway/task/{id}` 异轨 | 存疑待验 | 中 | 设计异轨 |
| C | 文本/sync 无 pollTaskId，刷新即断 | 已确认 | 低 | 设计取舍 |
| 八 | 并发满不排队（MAX_CONCURRENT_GEN=6） | 已确认 | 低 | 设计取舍 |

### 初稿审计修正记录（自检）
1. 删除误用函数 `notFoundCount`（代码中不存在；400→404 归一 + notFoundCount 累加在 **Vr.jsx 特惠轮询**，不在 `pollTask.js`）。
2. 删除误用函数 `saveRemoteUrl` / `onMediaResult` / `media:result` / `saveMedia`（全 `src` 搜索 0 命中），改为真实 `filesApi.saveResultToTasks`（`filesApi.js:136`）并在 `useNodeGeneration.js:100` 被调用。
3. 缺口 A 影响方精确化：去掉误伤的 `TextNode`（文本 sync 无 pollTaskId，不进恢复轮询），锁定真正落点 `TemplateNode`；行号修正（`imageApi.js:141` 非 `:225`，`PromptNode` onRecover 在 `:190`，`DiscountVideoNode` 在 `:154`）。
4. 缺口 B 由"高·可能 bug"降级为"存疑待验·设计异轨"，去掉"404 直接放弃"的杜撰断言。
5. 并发变量名由杜撰的 `genMax`/`genActive` 修正为真实 `MAX_CONCURRENT_GEN`(=6)/`genActive`（`taskStore.js:283-284`）。
6. 新增缺口 D（初稿遗漏的落盘不一致），补齐"结果 URL 处理/落盘"这一验收维度。

**下一步（非本任务范围，供后续 TASK）**：
1. 给 `TemplateNode.jsx` 补 `onRecover`，把 `agent:task-completed` 的 `resultUrl` 写回 `data.imageUrl`（对齐 PromptNode）。
2. 在 `pollTask.js:78` 完成分支补 `saveResultToTasks(resultUrl, task.type)`，使刷新恢复与首次生成落盘一致。
3. 抓取一次真实 async 生图的 `pollTaskId`，实测 `localTool/api/v1/gateway/task/{id}` 是否返回 200（验证缺口 B）。
