# 重构设计：生图/视频轮询与结果写库从「前端」移交「localTool relay 常驻进程」

> **本文档性质**：纯设计文档。本次修订（2026-09-03）把基底从「/api/proxy + handleProxy」对齐到**当前 relay 架构**（`localTool/src/relay.ts` + `ai-relay/` 声明式协议引擎），并吸收 docs/90（R1~R7）、docs/91（M1~M5）的目标形态，消除与在途 relay 迁移的漂移。
> **目标**：消除「result_url 落库依赖前端一次性轮询窗口、错失不自愈」的偶发丢结果根因（详见 docs/00 §2.1 与故障分析）。**核心动作**：轮询句柄生命周期从「浏览器页面」移到「localTool 进程」，句柄**可 attach**——提交即返 taskId，任务由 localTool 后台轮询到终态落盘并写库，前端只「提交 + GET/SSE 收结果」。前端刷新不再丢图/丢积分。
> **红线（来自 91 号 PRD C0/C1，用户确认）**：协议执行（提交/轮询/取结果）**绝不绕开 ai-relay kit**；落盘 `/files/` **不依赖 kit**，走既有 `saveRemoteUrl`/`saveResultToTasks`。

---

## 背景与根因（Why）

现状（`src/components/base/api/proxyGenerate.ts`，image/video 走 `image_mode==='async'` 或 video 强制 async）：前端 `pollUntilDone`/`pollInFlight` 每 ~3s 自轮询 `/api/v1/gateway/task/{id}`，拿到 URL 后 `taskStore.done` 写 `result_url`；刷新靠 `pollTask.initTaskRecovery` 重启扫描。偶发丢结果根因均为「前端窗口错失」变体：
1. 「网关返回 completed」与「前端写库」几十毫秒窗口里刷新/HMR → 写库回调丢失。
2. 前端/本地进程重启带走内存轮询态。
3. 网关响应被缓存/去重，或状态机偶发卡 running。
4. Lovart 偶发返回边缘结构 → 前端抽取落空。

**统一根因**：result_url 落库真源在前端一次性窗口，错失无兜底。**根治 = 把责任移出浏览器进程**，且轮询句柄归 localTool 进程所有、可 attach（docs/90 §1、docs/91 M3）。本方案命中①②③④。

---

## State 1：定契约（边界）—— 锚定 relay 架构

### 核心需求复述
前端提交 → localTool relay **submit 只拿 task_id 即返**（不等终态）→ localTool 侧常驻 poller 持有句柄逐轮打点到终态 → 结果**由 localTool 落盘 `/files/` 并写 `tasks` 表** → 前端经 `GET /api/generate/:id` 或 SSE 收结果渲染。前端刷新 = 重新 GET attach 到**同一句柄**，任务继续跑完，不丢。

### 输入源 / 输出目标 / 副作用

| 维度 | 内容 |
|---|---|
| **输入源** | ① 前端提交意图（`POST /api/generate`，body 同 `/api/relay`：providerId/capability/model/prompt/size/images/messages）；② localTool SQLite `tasks` 表在途行（`status∈(running,pending)` 且 `poll_task_id`/`task_id` 非空）——localTool 重启恢复的依据。 |
| **输出目标** | ① localTool 把 `result_url`(已落盘 /files/)、`status='completed'`、`completed_at` 写入 `tasks` 表（复用 `routes/tasks.ts` `upsertTask`）；② 前端节点渲染（复用既有 `taskCompletionBus.publishTaskCompleted` 唯一入口 → `eventBus 'agent:task-completed'` 精准回填 nodeId）。 |
| **副作用** | ① 出站：ai-relay kit `lowLevel.submit/poll` 周期性查上游状态（**唯一出站出口**，不自写 fetch）；② 写 SQLite；③ 落盘 `/files/tasks/`（`saveRemoteUrl`）；④ 向前端推完成（低频 GET 或 SSE，本期先 GET，SSE 作可选项）。 |

### 收口检索（既有件复用判定）

| 能力 | 既有件 | 判定 |
|---|---|---|
| 声明式协议执行（提交/轮询/取结果） | `ai-relay/`（`protocol/engine.ts` `submitModelProtocol`/`executeModelProtocol`、`poll.ts`、`presets.ts` lovart image/video） | **复用（唯一出口，禁止绕开 kit 自写 fetch/字段抽取）** |
| relay 薄端点（同步阻塞，基线） | `localTool/src/relay.ts` `handleRelay`/`relayGenerate` | **复用**；异步 `/api/generate` 在旁新增，不删 relay |
| 结果 URL 解析（跨端） | kit `response.ts` `readModelProtocolUrls`/`readModelProtocolFirstScalar`；前端 `resultUrlExtractor.ts` | **复用 kit**（后端 poller 直接用 kit 协议 `result.urlPath` 抽，不引前端文件、不在 worker 手写第三份映射） |
| 前端任务完成事件唯一入口 | `src/components/base/taskCompletionBus.ts` `publishTaskCompleted` | **复用**（SSE/GET 到达前端后只经此入口 emit） |
| DB 写库 | `localTool/src/routes/tasks.ts` `upsertTask` + `persistThreadId`；`db/database.ts` | **复用**（worker 写结果只走 upsertTask，禁裸 UPDATE） |
| 落盘 /files/ | `localTool/src/routes/files.ts` `saveRemoteUrl` | **复用**（M4-C1，不依赖 kit） |
| 提交入口/薄壳 | `relay.ts` | **复用**（新建 `/api/generate` 走 kit lowLevel 提交即返） |
| 网关查询参考 | `system.ts` `handleGatewayTask` | 参考；poll 统一走 kit，不再散打网关 |

**结论**：核心新代码只有两块——localTool「relay 轮询句柄管理器（可 attach + 落库 + 重启恢复）」+ 异步提交/查询薄端点。前端新增薄 relay 客户端；前端自轮询/恢复轮询分阶段删。

### 文件归属
- **localTool 新增**：`localTool/src/relay-poll.ts`（轮询句柄管理器：`Map<frontTaskId, PollHandle>` + 定时器 + 重启扫描）；`localTool/src/routes/generate.ts`（`POST /api/generate` 提交即返 + `GET /api/generate/:frontTaskId` attach 查询 + `cancel`）。
- **localTool 改动**：`relay.ts`（可复用 `submitModelProtocol` 拆分提交）；`router.ts` + `src/components/base/contracts.ts` `apiRegistry`（新端点登记，过 check:api）。
- **前端新增**：`src/components/base/api/relayProxy.ts`（薄壳：`relaySubmit` → POST /api/generate；`relayPoll`/`relayAttach` → GET）。
- **前端删除/瘦身（relay 稳定后分阶段）**：`src/components/base/api/pollTask.ts`（整体）、`proxyGenerate.ts` 的 `pollUntilDone`/`pollInFlight` 轮询段、`taskStore` 的 `ensurePolling/occupyOnly/startRecoveryRound/initTaskRecovery`、前端恢复落盘补丁。

> 注：SSE（`/api/stream/tasks`）在本设计中**不作前端依赖**。采用「DB 为真相 + GET 低频拉取 + 前端加载补读」三层即可满足 T1/T2；SSE 仅作可选加速（先低频 GET 够用，docs/90 §2.3）。

### 额外检查（矛盾 / 边缘）
- **跨刷新一致性**：`taskCompletionBus` 是内存总线，刷新后事件丢失 → 前端加载时从 `fetchTasks`/`GET /api/generate/:id` 补读。localTool 写库先于/独立于推送，**DB 才是真相**。
- **能力零退化（docs/90 §5 / execution-plan §5.0.5）**：进度条、取消(AbortSignal→cancel 落 failed)、参考图归一、错误中文降级、CLI 平台、刷新恢复——逐个有人兜住才允许删/切。
- **key 红线（91 M3-C5）**：协议执行全程 key 不入库、只驻内存；重启按 providerId 重读 .env。

---

## State 2：定数据流（链路 / 唯一入口 / 避交叉黑盒）

### 链路总图
```
[提交] 前端 relaySubmit(image/video/chat 意图)
   → POST /api/generate (localTool routes/generate.ts)
   → relay 经 kit submitModelProtocol 提交上游 → 拿上游 task_id
   → 生 PollHandle 句柄注册进 poller + 写 tasks 行(status=running, task_id, poll_task_id, node_id, type, request_data)
   → 立即返 {code:0, data:{taskId: frontTaskId}}          ← 不等终态
   → 前端 persistTaskId 写 tasks 行(nodeId/type/status)    ← 沿用既有 saveTask

[轮询·localTool] relayPoll 句柄管理器 (常驻, 随 localTool 启动)
   → 扫描 tasks 在途行(status∈running/pending && poll_task_id)   ← 重启恢复
   → 对每句柄: 经 kit lowLevel.poll 单轮查上游 → withTimeout/AbortSignal 总超时
   → 完成: saveRemoteUrl 落盘 /files/ → upsertTask({status:'completed', result_url, completed_at})
   → 失败: upsertTask({status:'failed', error_msg}) + 落盘状态同步
   → (可选 SSE 推 task-completed → 前端 publishTaskCompleted)

[查询] 前端 relayAttach(frontTaskId)
   → GET /api/generate/:frontTaskId → 从 Map/库返回 progress / completed(/files/ url) / failed
   → completed → publishTaskCompleted(...) → eventBus → 节点回填 nodeId(既有, 不动)

[兜底] 前端 App 启动/刷新
   → fetchTasks(既有 localToolApi) 补读 DB → running 任务逐个 GET attach 同一句柄
```

### 唯一入口锁定
- **协议执行**：全局唯一 = ai-relay kit `lowLevel.submit/poll`（M3-C1/M3-C3）。poller 不得散 import `protocol/*` 深层、不得自写 fetch/鉴权/字段抽取。
- **结果 URL 解析**：kit 协议 `result.urlPath`（声明式，每上游一份），poller 不手写字段映射。
- **前端完成事件发布**：全局唯一 `publishTaskCompleted`（taskCompletionBus）。到达前端只经此入口 emit。
- **DB 写库**：全局唯一 `upsertTask`（routes/tasks.ts）。poller 写结果只走此函数。
- **落盘**：全局唯一 `saveRemoteUrl`（files.ts）。

### 契约常量登记
- `/api/generate`(POST/GET) 新增：`router.ts` routes + `contracts.ts apiRegistry`（`status:'ACTIVE'`），过 `npm run check:api`。
- 前端 `relayProxy.ts` 调用端点登记进 apiRegistry。

### 幂等 / 去重 / 防重入
- 任务主键 = 前端自造 `frontTaskId`（taskStore task_id），`Map<frontTaskId, PollHandle>` 保证一个 frontTaskId 只一个 poller；DB 按 task_id upsert 天然幂等。
- **可 attach**：GET 重复 attach 到同一句柄（句柄在 Map 中存活即复用；localTool 重启后按库重建）。
- 单句柄轮询失败不阻塞其他句柄（独立 try/catch，错误原样 logger 可见）。

### 避交叉黑盒 / 单向性
- 数据流单向：`localTool(submit+落盘+写库+GET/SSE) → 前端 → eventBus → 节点渲染`。前端不再反向轮询上游。
- 提交链路与 poller 共享 DB：提交写 `task_id/status/request_data`，poller 写 `result_url/status/completed_at`；经 DB + 内存 Map 解耦。
- key 只驻内存，落库只存 providerId（重启按 .env 重读），杜绝 key 落盘。

### 失败拦截点
- **上游查询失败**：单轮 `lowLevel.poll` 失败 → logger 记录 → 下轮重试（句柄保持 running，靠总超时收口）；**不**误置 failed。
- **总超时**：每句柄带总超时（对齐 GEN_TIMEOUT/VIDEO_TIMEOUT），到点 abort → 置 `failed` + error_msg（失败可见，不静默挂起）。
- **落盘失败**：`saveRemoteUrl` 失败 → 记 error 并回退存原 url（宁显示外链不丢），不吞错。
- **失败可见禁令**：禁止 `.catch(()=>{})`；所有异步 await；错误原样透传，禁止 catch 后抛泛化 `new Error('出错了')` 抹原始 stack。

### 权衡
复用 kit（协议执行）+ 既有 `upsertTask`/`saveRemoteUrl`/DB（低成本、可观测）> 新建旁路。核心新代码仅 relay-poll 管理器 + 两薄端点 + 前端薄壳；SSE 不作为前端依赖（低频 GET 够用，SSE 仅可选加速）。

---

## State 3：构思测试（细化契约 + 数据流）

### T1 — 不依赖前端窗口
- **给定**：提交任务后立即杀掉前端进程（模拟刷新/HMR）。
- **期望**：localTool poller 仍在后台把结果落盘并把 `result_url` 写入 SQLite，`status` 最终 `completed`、`completed_at` 非空。
- **断言**：前端进程死亡期间 + 之后，DB 中该 task `result_url` 由 null → 非空。

### T2 — 刷新后结果可见
- **给定**：任务进行中刷新前端页面。
- **期望**：前端加载补读 DB 或 GET attach 到同一句柄，节点最终渲染出图（/files/）。
- **断言**：刷新后 30s 内该节点 `resultUrl` 非空（不依赖刷新时刻）。

### T3 — 并发幂等
- **给定**：并发提交 N 个任务。
- **期望**：poller Map 防重入 + upsertTask 幂等；每 task 恰好一次 `completed` 写库，无重复/漏写。
- **断言**：DB N 行 `status=completed` 且 `result_url` 非空；无重复 task_id 行。

### T4 — 边缘结构解析（命中根因④）
- **给定**：Lovart 返回边缘结构。
- **期望**：kit 协议 `result.urlPath`（声明式）抽到 url，或显式扩协议 path 后抽到。
- **断言**：传入边缘样例（用 kit `readModelProtocolUrls`）→ 非空 url；标准样例 → 与 kit 基线一致。

### T5 — localTool 崩溃可恢复
- **给定**：localTool 进程中途崩溃/重启，在途任务仍在 DB。
- **期望**：重启后 `initRelayPoller` 扫描 DB 在途行重新起句柄，最终落盘写库。
- **断言**：重启后 60s 内在途任务全部 `completed`（DB 持久态即真相，不依赖内存）。

### T6 — 超时与失败可见
- **给定**：上游长时间不返回或返回 error。
- **期望**：总超时 abort 抛明确错误；error 原样写入 `error_msg`，不静默、不泛化。
- **断言**：超时后任务 `status` 为明确 `failed` 且 `error_msg` 含原始文本；无「卡 running 永不结束」。

### 写不出断言即退回 State 1/2
- 若 GET attach 与轮询句柄生命周期存疑 → 退回 State 2 补 Map/库职责边界。
- 若 poll 跨 kit 与本地句柄的重试/总超时权重不清 → 退回 State 2 定唯一出口。

---

## State 4：施工骨架（仅骨架 / 签名 / 空函数）

### 4.1 模块骨架与文件归属
- `localTool/src/relay-poll.ts`（**新增**）：轮询句柄管理器。随 localTool `index.ts` 启动时 `initRelayPoller()`（单例，扫描在途行重建句柄）。
- `localTool/src/routes/generate.ts`（**新增**）：`POST /api/generate`（提交即返 taskId）+ `GET /api/generate/:frontTaskId`（attach 查询）+ `POST /api/generate/:frontTaskId/cancel`。
- `src/components/base/api/relayProxy.ts`（**新增**）：前端薄壳 `relaySubmit` / `relayPoll` / `relayAttach` / `relayCancel`。
- **localTool 接线**：`router.ts` routes 表 + `src/components/base/contracts.ts` apiRegistry 登记。
- **删除/瘦身（relay 稳定后分阶段，R7）**：`pollTask.ts`、`proxyGenerate.ts` 轮询段、taskStore `ensurePolling` 系、前端恢复落盘补丁。

### 4.2 核心函数签名 + 空骨架
```ts
// ── localTool/src/relay-poll.ts ──
/** 注册一个可 attach 的轮询句柄（提交后调用；写库 status=running） */
export function registerPollHandle(frontTaskId: string, pollCtx: PollContext): void

/** 对单个句柄跑一轮（经 kit lowLevel.poll，到终态落盘+写库） */
async function pollOnce(ctx: PollContext): Promise<'running'|'completed'|'failed'|'timeout'>

/** localTool 启动时扫描 DB 在途行，重建句柄（重启恢复，对齐前端 S2 启动扫描） */
export function initRelayPoller(): void

/** GET attach：返回该 frontTaskId 的进度/结果（Map 或库） */
export function getPollStatus(frontTaskId: string): PollStatus

/** cancel：停句柄 → 置 status=failed */
export function cancelPoll(frontTaskId: string): void

// ── localTool/src/routes/generate.ts ──
export async function handleGenerateSubmit(req,res,url)   // POST：relay submit → taskId → 立即返
export async function handleGenerateGet(req,res,url)      // GET /:frontTaskId：progress/completed/failed

// ── src/components/base/api/relayProxy.ts ──
export async function relaySubmit(intent): Promise<{ok,taskId}>          // POST /api/generate
export async function relayPoll(taskId): Promise<{status,progress?,url?}> // GET /api/generate/:taskId
```

### 4.3 可变性纪律
- poller 句柄 `Map<frontTaskId, PollHandle>` 为进程单例；DB 经 `upsertTask` 幂等 upsert。
- 每次 kit 出站调用带总超时（AbortSignal/`maxDurationMs`），防无限挂起。
- 高频扫描默认节流（间隔配置化，不裸奔）。
- key 只驻内存，落库只存 providerId。

### 4.4 红线复查
- [ ] 无 `.catch(()=>{})` 空体；所有异步 await。
- [ ] 失败原样透传，无泛化 `new Error('出错了')`。
- [ ] 协议执行全部经 ai-relay kit `lowLevel`，无第二套 fetch/轮询/字段抽取（C0）。
- [ ] 落盘只走 `saveRemoteUrl`，kit 不感知 /files/（C1）。
- [ ] 每次出站有总超时（maxDurationMs/AbortSignal）。
- [ ] `publishTaskCompleted` 前端唯一入口，无散 `eventBus.publish('agent:task-completed')`。
- [ ] 新端点登记 router.ts + contracts.ts apiRegistry，发布订阅成对，过 check:api。
- [ ] key 不入库、只驻内存。

### 防返工锚点
若日后新增另一类异步任务（视频/3D），本架构是加数据（relay-presets 加协议声明）+ 复用 poller/upsertTask/saveRemoteUrl，无需拆掉重写——提交/轮询/落盘/写库已统一在 kit + poller 单一链路。

---

## 退回机制 / 待确认（给审查 AI）
1. poller 扫描/单句柄轮询间隔与总超时阈值：生图 ≤3min 建议轮询 3~5s、单查 30s、总超时对齐 GEN_TIMEOUT/VIDEO_TIMEOUT。
2. `/api/generate` 异步薄壳与既有 `/api/relay`(同步阻塞) 双轨共存期：`/api/relay` 保留到前端全部切完（R5-R6）。
3. 前端 image 先切 relay（R5 双轨），video 随后；chat 本期不动（同步信封语义与 relay 冲突，另行）。
4. 是否需要 SSE：本期先低频 GET（docs/90 §2.3），SSE 仅可选加速，不作为前端依赖。

---

## 施工进度实录（2026-09-03 · 已落地）

> 已按上文 + docs/90 R1~R5 落地「relay 轮询后端化」后端全链路 + 前端双轨。以下为**真实文件/签名**（非骨架）。

### 已实现（后端 · docs/90 R1~R4）
1. **ai-relay kit 补通用单轮导出**（C0 不绕 kit）：
   - `localTool/src/ai-relay/protocol/poll.ts`：`pollModelProtocolOnce(poll, apiKey, signal?, allowedBaseUrl?)` → `{status:'completed',urls}|{status:'failed',error}|{status:'processing',progress?,error?,retryable?}`（分解自 `pollResolvedModelProtocol` 单轮，通用全平台）。
   - `protocol/index.ts` 已再导出。
2. **轮询句柄管理器** `localTool/src/relay-poll.ts`：
   - `submitGenerateTask(input)`：`submitModelProtocol` 提交 → 拿 task_id + ResolvedPollConfig → 落库在途行(running, poll_task_id, request_data._relayPoll 快照) → 注册句柄 → 返 frontTaskId。
   - 完成：`saveRemoteUrl` 落 /files/ → `upsertTask` completed + result_url + completed_at。
   - 失败/超时：`upsertTask` failed + error_msg（失败可见）。单轮瞬时错不误判，续查。
   - `getGenerateStatus` / `cancelGenerateTask` / `initRelayPoller()`（重启扫描，key 不入库）。
3. **薄端点** `localTool/src/routes/generate.ts`：`POST /api/generate`、`GET /api/generate/:id`、`POST .../cancel`；已登记 `router.ts`；`index.ts` 启动调 `initRelayPoller()`。`upsertTask` 已从 `routes/tasks.ts` 导出。
4. `src/components/base/contracts.ts apiRegistry` 登记 3 端点（RESERVED，待前端切真机后改 ACTIVE）。

### 已实现（前端双轨 · docs/90 R5，默认关）
5. `src/components/base/api/relayProxy.ts`：`relaySubmit` / `relayPoll` / `relayCancel` / `relayGenerate`（submit + 低频 GET attach，返回后端 /files/ url）。
6. `src/components/base/config.ts` 新增 `RELAY_ASYNC_SUBMIT = false`（双轨开关，**默认 false = 零行为改变**）。
7. `proxyGenerate.ts` `imageProxy`(async 分支)/`videoProxy`：`RELAY_ASYNC_SUBMIT` 开启时改走 `relayGenerate`。
8. `filesApi.ts saveResultToTasks`：url 已是本机 `/files/` 时直接返回（避免后端返回本地 url 被重复落盘，M4-C4/P0-C）。

### 待做（relay 真机验证稳定后）
- **R6**：前端刷新恢复——加载时对 DB 里 running 任务逐个 GET attach 同一句柄（替代 `pollTask.initTaskRecovery`/`ensurePolling` 重启扫描）。
- **R7**：删旧前端自轮询/恢复：`pollTask.ts`（整体）、`proxyGenerate.ts` 轮询段、taskStore `ensurePolling/occupyOnly/startRecoveryRound`、前端恢复落盘补丁；chat/文本/sync SSE 本期不动。
- 真机验证路径：`cd localTool && npm run build && npm start` → `POST /api/generate`（curl）→ 观察 relay-poll 轮询日志 + `uploads/tasks` 出文件 + `GET /api/generate/:id` 返 /files/ → 重启 localTool 确认 running 任务续跑 → 再把 `RELAY_ASYNC_SUBMIT` 置 true 切前端。

### 校验状态
- `localTool` 与前端 `npx tsc --noEmit` 均通过；新增代码无 lint 错误。
- `npm run check:api` 的 7 个 error 为**既有 relay 迁移遗留**（删了 `/api/providers*`、`/api/proxy` 后端路由但前端 registry 仍 ACTIVE），非本次引入；本次新增端点以 RESERVED 登记，未新增 error。
