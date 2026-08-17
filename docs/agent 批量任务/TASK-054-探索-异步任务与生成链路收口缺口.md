# TASK-054｜探索：异步任务与生成链路「收口缺口」

> 模式：探索性任务（只读不改，可写本文件）。本文件为「同步研究笔记」，记录对当前异步任务 / 生成链路收口现状的核查结论，供后续决策，不产代码。
> 审计状态：经逐文件核对源码（行号、函数名、字段均对照原文），已修正初版中的函数名/行号/能力误判。

## 0. 结论速览（TL;DR）

异步任务与生成链路**已有统一收口骨架，且网关侧能力比预期更完整**，但**前端收口未 100% 覆盖、且缺失韧性增强**，主要缺口在：

1. **节点侧**：4 个生成节点已接入统一 `useNodeGeneration` 契约（PromptNode / TextNode / DiscountVideoNode / TemplateNode）；非生成型容器节点（如 ImageBoxNode）本就不接入，合理。其余生成类节点是否全接入需逐点确认（见 G1）。
2. **API 侧**：`imageApi.generateAsync` 与 `videoApi.generateAsync` 各自实现一份轮询（image 间隔 3s / 超时 300000ms，video 间隔 5s / 超时 600000ms，结果字段不同），结构同构但未抽到共享 `pollUntilDone`。
3. **网关侧**：提交（`chat_completions`）支持 `wait=1` 同步 SSE，异步返回 `task_id`；查询靠 `GET /v1/gateway/task/{id}`。**网关已支持 webhook 回调**（调用方提交时带 `webhook` 字段即可），且已有 `TASK_RESULT_TTL=86400` 结果保留期；**但无任务级主动重试 Lovart、无提交幂等去重**。
4. **代理层（localTool）**：`/api/proxy` 与 `handleGatewayTask` 均有统一超时（默认 300000ms）→ 504/502，**但无自动重试、无 Lovart 504 兜底降级**。
5. **刷新恢复**：`pollTask.js` 已能扫描 `running/pending + pollTaskId` 的任务在刷新后继续轮询回填（节流 5s、每轮上限 5 个），但仅覆盖 async 模式（sync/SSE 刷新断即断，官方同此取舍）。
6. **关键缺口**：前端提交（imageApi/videoApi）**未注册 webhook**，因此尽管网关支持 webhook，前端仍强依赖轮询；且代理层缺重试/降级。

---

## 1. 现状核查（逐层，均附证据）

### 1.1 前端统一契约：`useNodeGeneration`（已收口基础）
- 文件：`src/components/base/useNodeGeneration.js`
- 收敛：提交 → 进度 → 成功双写（`taskStore` + `node.data`）/ 失败 → `registerTaskRetry` 注册「再来一次」。
- 暴露：`{ loading, error, start, stop }`，`start` 返回 `{ ok, resultUrl }` 供 Agent / 编排层拿持久结果（`useNodeGeneration.js:68-132`）。
- 精准回填：监听 `eventBus` 的 `agent:task-completed` 广播，仅当 `detail.nodeId === 本 nodeId` 且 `status==='completed' && detail.resultUrl` 才回调 `onRecover` 写回 `node.data`（`useNodeGeneration.js:154-165`）。
- 防重入：用 `runningRef` 原子防双击并发生成（`useNodeGeneration.js:55,70,130`）。
- 已接入生成节点（grep `useNodeGeneration`）：
  - `PromptNode`、`TextNode`、`DiscountVideoNode`、`TemplateNode`（`TemplateNode.jsx:18,174` 调 `generateImage`）、`NodeShell`（壳，非生成）。
- 非生成型节点（不接入，合理）：
  - `ImageBoxNode`：图片容器/选择器（用 `NodeShell` 外壳），本身不调生成 API，不接入 `useNodeGeneration` 属正常设计，非缺陷。
  - `VideoExtractNode`：`setInterval` 仅用于「抽帧间隔」参数控制，非任务轮询。
  - `ScriptBoxNode`：`setInterval` 仅倒计时显示。

### 1.2 异步轮询实现：`imageApi` vs `videoApi`（结构同构，未抽共享）
- `imageApi.generateAsync`（`src/components/base/imageApi.js:117`）：提交拿 `task_id` → `setTaskPollId` 回填（`imageApi.js:141`）→ `while` 轮询 `tasks/{id}`，**间隔 3000ms**（`imageApi.js:147`），超时由 `generateImage` 传入 **300000ms**（`imageApi.js:239`），解析 `result.images[0].url`（`imageApi.js:158`）。
- `videoApi.generateAsync`（`src/components/base/videoApi.js:50`）：逻辑同构，**间隔 5000ms**（`videoApi.js:80`），超时由 `generateVideo` 传入 **600000ms**（`videoApi.js:126`），解析 `result.videos[0].url || result.images[0].url || results[0].url`（`videoApi.js:90`）。
- 差异：轮询间隔、超时上限、结果字段；**结构完全同构** → 可抽 `pollUntilDone({ provider, taskId, pollUrl, intervalMs, timeoutMs, parse })` 共享。
- 二者均被 `useNodeGeneration` 的 `run` 执行器调用（非独立散落），属「API 层实现重复」，非「节点层重复」。

### 1.3 刷新恢复轮询：`pollTask.js`（已收口基础）
- 文件：`src/components/base/pollTask.js`
- `pollOneTask`（`pollTask.js:60`）：`fetch(`${API_BASE}/api/v1/gateway/task/${pollTaskId}`)`（`pollTask.js:65`）→ 完成则 `patchTask` + `publish('agent:task-completed', …)` 精准广播回填。
- 节流：`POLL_INTERVAL=5000`、setInterval 2s 检查 + 5s 节流、`MAX_PER_ROUND=5`（防刷新后几十任务打爆网关）（`pollTask.js:29-31,115-120`）。
- `initTaskRecovery()` 启动位：`App.jsx:419` 延迟 500ms（等 `initTasks` 从后端加载完历史任务）（`App.jsx:412-420`）。
- 边界：sync/SSE 模式无 `pollTaskId`，刷新断即断（官方同取舍，非缺陷）。

### 1.4 网关层：`chat_completions` + `get_task`（能力比预期完整）
- 文件：`apimart-gateway/main.py`
- **提交**（`chat_completions`，`main.py:964`）：
  - `wait=1` → 内部 `run_and_get` 循环查 `get_status`（`main.py:1018-1066`），超时抛 `LovartError("同步等待生成结果超时", 504)`（`main.py:1068`）。
  - 异步（默认）→ 返回 `{status:"submitted", task_id}`（`main.py:1278-1287`），由调用方自行轮询或等待 webhook。
- **查询**（`GET /v1/gateway/task/{task_id}`，`main.py:1373`，处理函数 `get_task`）→ 调 `TaskService.check_and_fire_task`（`main.py:1375`）。
- **Webhook（已支持！）**：
  - 调用方提交时 body 带 `webhook` 字段即注册（`main.py:1175,1228-1232`）。
  - 完成时 `TaskService.fire_webhook` 触发（`main.py:800,830,835`），实现 `main.py:839`：`WEBHOOK_MAX_RETRIES=3`、`WEBHOOK_RETRY_INTERVAL=10`。
  - `_background_webhook_watcher`（`main.py:1289`）：后台轮询防「调用方不主动 GET 导致 webhook 瘫痪」。
  - **结论**：网关 webhook 能力完整；但**前端 imageApi/videoApi 提交时不带 `webhook` 字段** → 前端实际仍强依赖轮询。
- **结果保留期（已支持）**：`TASK_RESULT_TTL=86400`（默认 1 天，`main.py:74`）。
- 缺项（探查确认）：
  - 无**任务级主动重试** Lovart（仅 `send_with_project` 的 project 失效自愈重试，`main.py:721-731`，非任务级）。
  - 无**提交幂等/去重**（grep 幂等/duplicate/already 0 命中，见 G5）。

### 1.5 代理层（localTool）：`/api/proxy` + `handleGatewayTask`（有超时，无重试降级）
- 文件：`localTool/src/routes/system.ts`
- 统一超时 `PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT) || 300000`（默认 5min，`system.ts:17`）。
- 通用代理（`system.ts` 主 proxy 分支，`system.ts:205,277-285`）：超时 → `504`、其它错误 → `502`、打印 `[proxy] … TIMEOUT/ERR` 日志。
- 网关 task 查询转发 `handleGatewayTask`（`system.ts:54`，**非 62**）：转发到 `http://127.0.0.1:9004/v1/gateway/task/{id}`（`system.ts:63`），同样 `PROXY_TIMEOUT_MS` 超时 → `504`（`system.ts:96-100`）。
- 缺项：无**自动重试**（瞬时 502/504 直接失败）、无 **Lovart 504 兜底降级**（如降级同步 `wait=1` 续查或返回可续查 token）。

### 1.6 持久化：thread_id 打通
- `localTool/src/routes/tasks.ts:175` `persistLovartThreadId`：把 Lovart `/chat` 返回的 `thread_id`（网关拼成 `task_<threadId>`）写进 `tasks` 表，**只为前端 frontTaskId 行补 thread_id，不再为网关 task_id 单独建行**（杜绝重复垃圾任务行）。
- 与 `pollTask.js` 关系：前端轮询用前端任务行上的 `pollTaskId` 直接打网关，不依赖此网关行 → 该持久化目前仅为可追溯/调试用途。

---

## 2. 缺口清单（按优先级，均经核实）

| # | 缺口 | 位置 | 影响 | 建议 |
|---|------|------|------|------|
| G1 | 生成节点未全部接入统一契约 | 其余生成类节点（需逐点确认） | 未接入节点的任务中心与卡片结果可能不一致；retry 无法驱动 | 盘点所有生成类节点，未接入的改接 `useNodeGeneration`（复用 `run` 执行器） |
| G2 | 异步轮询重复实现 | imageApi / videoApi | 维护双份、字段解析漂移风险 | 抽 `pollUntilDone` 共享，两处调用 |
| G3 | 代理层无自动重试 | localTool `/api/proxy` + `handleGatewayTask` | Lovart 偶发 502/504 直接失败，用户体验差 | 对 502/504 加有限次指数退避重试 |
| G4 | Lovart 504 兜底降级缺失 | localTool proxy 层 | 长任务易超时断链 | 超时后降级 `wait=1` 同步续查或返回可续查 token |
| G5 | 网关无提交幂等 / 去重 | apimart-gateway `chat_completions` | 重复提交 / Agent 重放建多条任务 | 按 `nodeId+prompt+model` 做幂等键或客户端 dedup |
| G6 | 前端未注册 webhook（网关已支持） | imageApi / videoApi 提交 | 前端强依赖前端轮询，关页即断；未利用网关已有 webhook | 提交时带 `webhook` 回调（指向 localTool 端点），完成后由网关主动通知 |

> 注：G1/G2 为前端收口收尾（低风险、纯重构）；G3/G4 为代理层韧性；G5/G6 涉及网关/提交契约（需后端评审，其中 G6 网关已具备能力、仅前端未用，成本最低）。

---

## 3. 不改动确认
本次为探索任务，**未改动任何源码/配置**，仅写入/修订本笔记文件。所有结论基于以下文件逐行核查：
- `src/components/base/useNodeGeneration.js`
- `src/components/base/pollTask.js`
- `src/components/base/taskStore.js`
- `src/components/base/tasksApi.js`
- `src/components/base/imageApi.js` / `videoApi.js`
- `src/App.jsx`（initTaskRecovery 启动位 `App.jsx:419`）
- `src/components/{PromptNode,TextNode,DiscountVideoNode,TemplateNode,ImageBoxNode,VideoExtractNode,ScriptBoxNode}.jsx`
- `apimart-gateway/main.py`（提交 `chat_completions:964`、查询 `get_task:1373`、webhook `fire_webhook:839` / `_background_webhook_watcher:1289`、TTL `:74`）
- `localTool/src/routes/system.ts`（proxy `:17,205,277`、handleGatewayTask `:54`）/ `tasks.ts:175`

## 4. 审计修订记录（初版 → 本版）
- 修正 1.4 函数名：原文误称 `query_task(task_id, wait, timeout)`；实际为 `chat_completions`（提交/同步）+ `get_task`（查询，`main.py:1373`）。
- 修正 1.4 端点行号：原文 `main.py:486` → 实际 `main.py:1373`。
- 修正 1.4「无 webhook」误判：网关**已完整支持** webhook（`fire_webhook` + 重试 + 后台 watcher），缺的是**前端未注册**。G6 改述。
- 修正 1.4「无统一超时上限」：网关有 `TASK_RESULT_TTL=86400`；缺的是任务级主动重试。
- 修正 1.5 行号：`system.ts:62` → `handleGatewayTask` 实际 `system.ts:54`。
- 补强 1.2：明确 image/video 的 timeoutMs 来源（300000 / 600000）与间隔（3000 / 5000）。
- 澄清 1.1：ImageBoxNode 不接入属合理设计，非收口缺口。

## 5. 后续建议（若转开发任务）
- 最低成本高收益：先做 **G6**（前端提交带 webhook，复用网关已有能力）→ 前端关页也不丢结果。
- 小步收口：再做 **G1+G2**（前端纯重构，风险最低，收敛「任务中心↔节点卡片」一致性）。
- 韧性增强：做 **G3+G4**（代理层重试 + Lovart 504 降级），显著提升长任务成功率。
- 网关治理：**G5** 视后端资源排期，非阻塞前端体验。
