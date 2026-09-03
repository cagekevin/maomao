# 重构设计：生图轮询从「前端自轮询」移交「localTool 常驻轮询」

> **本文档性质**：纯设计文档，按「步进式代码生成引擎（4 步法）」协议撰写，仅到 State 4 骨架，**不落地任何施工代码**。供其他 AI 审查后，再进入施工。
> **目标**：消除「`result_url` 落库依赖前端一次性轮询窗口、错失不自愈」的偶发丢结果根因（详见 00 架构文档 §2.1 与故障分析）。
> **核心动作**：轮询与写库责任从「浏览器前端进程」移到「localTool 常驻 Node 进程」，前端只提交 + 订阅完成信号。

---

## 背景与根因（Why）

现状（`docs/00-猫猫项目架构总览.md` §2.1 已记录）：异步生图走「提交 → 前端 `pollInFlight` 每 3s 自轮询 → `extractUrl` 解析 → `taskStore.done` 写 `result_url`」。

偶发丢结果的四个候选根因（已分析，均为「前端窗口错失」变体）：
1. 用户在「网关返回 completed」与「前端写库」的几十毫秒窗口里刷新/HMR → 写库回调丢失，且残留占位让恢复轮询跳过。
2. 偶发进程重启带走内存态（9004 `_meta` 或前端轮询态）。
3. 某层对 `task_id` 响应被缓存/去重，或 9004 状态机偶发卡死 → 永远读旧 running。
4. Lovart 偶发返回边缘结构 → `extractUrl` 抽空。

**统一根因**：`result_url` 落库的真源在前端那一次性窗口，且错失后无兜底。根治 = 把责任移出浏览器进程。

**本方案命中的根因覆盖**：①②③④ 全部（写库在常驻进程 + 幂等重试，不再依赖前端窗口）。

---

## State 1：定契约（边界）

### 核心需求复述
将「前端轮询 Lovart 并把 `result_url` 写回本地 SQLite」这一职责，迁移到 localTool 常驻进程；前端改为只负责发起提交、并在结果写库后接收完成信号做渲染。

### 输入源 / 输出目标 / 副作用

| 维度 | 内容 |
|---|---|
| **输入源** | ① 前端用户操作/节点生成触发提交（`POST /api/proxy`）；② localTool SQLite `tasks` 表中「在途任务」行（`status∈(running,pending)` 且 `thread_id` 非空）。 |
| **输出目标** | ① localTool 把 `result_url` / `status=completed` / `completed_at` 写入本地 SQLite `tasks` 表（既有 `upsertTask`，`database.ts:326` 白名单已含 `result_url`）；② 前端节点渲染（经既有 `eventBus` 的 `agent:task-completed` 事件精准回填 `nodeId`）。 |
| **副作用** | ① 出站网络：localTool 周期性查询 Lovart 状态（直连或经 9004 透传 `/v1/gateway/task/{id}`）；② 写 SQLite；③ 通过 SSE/HTTP 向前端推完成信号；④ 可选：图落盘 `/files/`（沿用既有 `resolveLocalImages`）。 |

### 收口检索（既有件复用判定）

| 能力 | 既有件 | 判定 |
|---|---|---|
| 前端任务完成事件发布 | `src/components/base/taskCompletionBus.ts`（`publishTaskCompleted`，注释明确为「唯一发布入口」，治 D1） | **复用**（前端侧 emit 唯一入口，不新建） |
| 底层事件总线 | `src/components/base/eventBus.ts` + `contracts.ts:61` EVENTS 登记 | **复用**（不新建） |
| 结果 URL 解析 | `src/components/base/resultUrlExtractor.ts`（`extractResultUrl`，注释明确为「全库唯一真值源」） | **复用/迁移**（localTool 侧须用同一逻辑，禁止第三份解析） |
| 中央契约登记 | `src/components/base/contracts.ts`（EVENTS / apiRegistry / STORAGE_KEYS） | **复用**（新增事件/路由须在此登记，发布订阅成对） |
| 统一日志 | `src/components/base/logger.ts` | **复用**（禁止散写 `console.log`） |
| 本地 DB 写 | `localTool/src/db/database.ts`（`upsertTask`，`result_url` 在白名单） | **复用**（不新建写库路径） |
| 出站 fetch | `localTool/src/utils/netProxy.ts`（`fetchWithProxy`） | **复用** |
| 提交入口 | `localTool/src/routes/system.ts`（handleProxy） | **复用**（不改提交链路） |
| 上游状态查询 | `apimart-gateway/main.py`（`check_and_fire_task`） | **复用**（经 `/v1/gateway/task/{id}` 或 localTool 直连 Lovart） |

**结论**：无「确属新增」的独立能力，全部为**复用/扩展既有件**。仅新增两处薄壳：localTool 常驻轮询 worker、前端 SSE 订阅客户端。

### 文件归属
- **新增**：`localTool/src/workers/pollWorker.ts`（并入 localTool，同类职责已有 `routes/tasks.ts`，不放前端、不新建独立服务）。
- **新增（薄）**：`localTool/src/routes/stream.ts`（SSE 完成信号通道）或复用既有 SSE 能力；`src/components/base/api/taskSocket.ts`（前端 SSE 订阅客户端）。
- **删除/瘦身**：`src/components/base/api/proxyGenerate.ts` 的 `pollInFlight` / `pollUntilDone` 轮询段；`src/components/base/api/pollTask.ts`（整体）；`App.tsx` 的 `initTaskRecovery`；`useNodeGeneration` 的超时置 `failed` 分支；`resultUrlExtractor.ts` 的前端使用（逻辑迁 localTool 侧）。

### 额外检查（矛盾 / 边缘）
- **跨刷新一致性**：`taskCompletionBus` 是内存总线，前端刷新后丢失未消费事件 → 必须加「前端加载时从 DB `fetchTasks` 补读」兜底，且 localTool 写库须先于/独立于推送（推送只是加速，DB 才是真相）。
- **推送 vs 拉取**：采用「localTool 写库为真相 + SSE 推信号加速 + 前端加载补读兜底」三层，避免单点依赖推送通道。

---

## State 2：定数据流（链路 / 唯一入口 / 避交叉黑盒）

### 链路总图

```
[提交] 前端 proxyGenerate.imageProxy/videoProxy/chatProxy
   → POST /api/proxy  (localTool routes/system.ts handleProxy, 既有)
   → 转发 9004 → Lovart → 返回 task_id / thread_id
   → 前端 persistThreadId 写 tasks 行 (thread_id / submit_ack_at)  ← 沿用既有
   → 前端【不再 pollInFlight】, 改为订阅 taskSocket (SSE)

[轮询·新] localTool pollWorker (常驻, 随 localTool 启动)
   → scanPendingTasks(db): SELECT * FROM tasks
        WHERE status IN ('running','pending') AND thread_id IS NOT NULL
   → 对每个 task: pollOneTask(task, lovartClient)
        → 出站查 Lovart 状态 (直连 or /v1/gateway/task/{id} 透传)
        → withTimeout 包裹, 失败原样透传 (禁静默)
   → done: resolveResultUrl(raw, type)   ← 复用 resultUrlExtractor 同逻辑 (唯一真值源)
   → upsertTask(db, {task_id, result_url, status:'completed', completed_at})  ← 既有写库
   → pushTaskCompleted(taskId,nodeId,resultUrl,type)  ← SSE 推前端

[接收] 前端 taskSocket (SSE 客户端)
   → 收到 task-completed → publishTaskCompleted(...)  ← 既有 taskCompletionBus 唯一入口
   → eventBus 'agent:task-completed' → useNodeGeneration 精准回填 nodeId (既有, 不动)

[兜底] 前端 App 启动 / 刷新
   → fetchTasks (既有 localToolApi) 补读 DB → 已完成任务直接渲染 (消除推送漏接)
```

### 唯一入口锁定
- **结果 URL 解析**：全局唯一 `extractResultUrl`（resultUrlExtractor）。localTool 侧实现须与前端**同一份逻辑**（复制并登记，或抽为可跨端共享模块；**禁止**在 worker 里就地手写字段映射，否则重现 φ2 脏数据源）。
- **前端完成事件发布**：全局唯一 `publishTaskCompleted`（taskCompletionBus）。worker 推送到达前端后，**只**经此入口 emit，禁止 `eventBus.publish('agent:task-completed', …)` 散发。
- **DB 写库**：全局唯一 `upsertTask`（database.ts）。worker 写结果只走此函数，禁止裸 `run(db, 'UPDATE …')`。
- **出站查询**：全局唯一 `fetchWithProxy`（netProxy.ts）。

### 契约常量登记（contracts.ts）
- 新增 SSE 事件须在 `EVENTS` 登记（发布方：localTool stream.ts；订阅方：前端 taskSocket.ts），**成对**，杜绝「只监听未发布」。
- 新增路由 `/api/stream/tasks` 须在 `apiRegistry` 登记。
- `thread_id` 关联契约沿用 §2.1：`poll_task_id` = 网关 task_id；`thread_id` = Lovart ID。

### 幂等 / 去重 / 防重入
- 任务主键 `task_id` 即为全局唯一键；`upsertTask` 按 `task_id` 幂等 upsert，天然幂等。
- worker 扫描加**在途标记**（如内存 `Set<task_id>` 或 `tasks.in_flight` 列），避免同一 task 被并发轮询两遍。
- 单 task 轮询失败不阻塞其他 task（独立 try/catch，错误原样 logger 可见）。

### 避交叉黑盒 / 单向性
- 数据流单向：`localTool → (写DB + SSE) → 前端 → eventBus → 节点渲染`。前端**不再反向轮询 Lovart**。
- worker 与提交链路（handleProxy）共享 DB，但分模块：提交只写 `thread_id`，worker 只写 `result_url/status`；二者不互相 import 大模块，经 DB 解耦。
- SSE 推送为「单向通知」，不含副作用订阅黑洞；前端订阅在 `taskSocket.ts` 单一登记。

### 失败拦截点
- **Lovart 查询失败**：在 `pollOneTask` 内 `await withTimeout(...)`，超时抛明确错误 → logger 记录 → 该 task 下轮重试；**不**置 `failed`（保持 `running` 让 worker 续查）。
- **解析失败（边缘结构）**：`resolveResultUrl` 返回 undefined → 不写库、不推送、记 debug 日志、下轮重试；若需扩 SELECTORS 路径，统一在 `resultUrlExtractor` 改（唯一真值源）。
- **失败可见禁令**：禁止 `.catch(()=>{})`；所有异步 `await`；错误原样透传，禁止 `catch` 后抛泛化 `new Error('出错了')` 抹掉原始 stack。

### 权衡
复用 localTool 既有 `upsertTask` / `fetchWithProxy` / DB（低成本、可观测）> 新建旁路。仅新增 worker + SSE 薄壳，且 SSE 通道若 localTool 已有 SSE 能力则直接复用，不开第二套。

---

## State 3：构思测试（细化契约 + 数据流）

> 以下断言须「实现一变必红」。逻辑可抽纯函数的（resolveResultUrl / scanPendingTasks 查询构造）优先抽离补单测；组件只补关键交互防崩。

### T1 — 不依赖前端窗口（命中根因①）
- **给定**：提交任务后，立即杀掉前端进程（模拟刷新/HMR）。
- **期望**：localTool worker 仍在后台把 `result_url` 写入 SQLite，`status` 最终 `completed`，`completed_at` 非空。
- **断言**：前端进程死亡期间 + 之后，DB 中该 task 的 `result_url` 由 `null` 变为非空字符串。

### T2 — 刷新后结果可见（命中根因①②）
- **给定**：任务进行中刷新前端页面。
- **期望**：localTool 写库后，前端加载经 `fetchTasks` 补读 或 SSE 推信号，节点最终渲染出图。
- **断言**：刷新后 30s 内，该节点 `resultUrl` 非空（不依赖刷新发生时刻）。

### T3 — 并发幂等（命中根因②③）
- **给定**：并发提交 N 个任务。
- **期望**：worker 扫描 + `upsertTask` 幂等；每个 task 恰好一次 `completed` 写库，无重复、无漏写。
- **断言**：DB 中 N 行 `status=completed` 且 `result_url` 非空；无重复 `task_id` 行。

### T4 — 边缘结构解析（命中根因④）
- **给定**：Lovart 返回边缘结构（如 `items[].artifacts[].content` 而非 `result.images[0].url`）。
- **期望**：`resolveResultUrl`（复用 resultUrlExtractor 同逻辑）仍能抽出 url；或显式扩展 SELECTORS 后抽出。
- **断言**：传入边缘样例 → 返回非空 url；传入标准样例 → 返回与前端既有行为一致的 url（验证唯一真值源未被破坏）。

### T5 — worker 崩溃可恢复（命中根因②）
- **给定**：worker 进程中途崩溃/重启（模拟 localTool 偶发重启），在途任务仍在 DB。
- **期望**：新 worker 启动后扫描 DB 接管在途任务，最终写库。
- **断言**：重启后 60s 内，DB 在途任务全部 `completed`（DB 持久态即真相，不依赖内存）。

### T6 — 超时与失败可见（禁令红线）
- **给定**：Lovart 长时间不返回（> 总超时阈值）或返回 error。
- **期望**：`withTimeout` 抛明确错误，任务不无限挂起；error 原样写入 `error_msg`，不静默、不泛化掩盖。
- **断言**：超时后任务 `status` 为明确 `error`/`timeout` 态且 `error_msg` 含原始 Lovart 错误文本；无「卡 running 永不结束」。

### 写不出断言即退回 State 1/2
- 若 SSE 通道选型不确定（推 vs 拉兜底权重），退回 State 2 补链路细节。
- 若 `resolveResultUrl` 跨端共享方式未定（复制+登记 vs 抽共享模块），退回 State 2 定唯一入口。

---

## State 4：施工骨架（仅骨架 / 签名 / 空函数，不写完整逻辑）

> 以下为施工蓝图。填充须严格按签名与注释步骤，且不得引入 State 2 未声明的依赖/状态。

### 4.1 模块骨架与文件归属
- `localTool/src/workers/pollWorker.ts`（**新增**）：常驻轮询器，随 localTool `index.ts` 启动一次（单例）。
- `localTool/src/routes/stream.ts`（**新增/复用既有 SSE**）：SSE 端点 `/api/stream/tasks`，向前端推 `task-completed`。
- `src/components/base/api/taskSocket.ts`（**新增**）：前端 SSE 客户端，接信号后调 `publishTaskCompleted`。
- **删除/瘦身**：`proxyGenerate.ts` 轮询段、`pollTask.ts`、`initTaskRecovery`、`useNodeGeneration` 超时分支、`resultUrlExtractor.ts` 前端使用。

### 4.2 核心函数签名 + 空骨架

```ts
// ── localTool/src/workers/pollWorker.ts ──
/** 启动常驻轮询（随 localTool 单例启动一次） */
export function startPollWorker(db: Database, opts: PollWorkerOpts): void {
  // 步骤: setInterval(scanLoop, opts.intervalMs); 注册进程退出清理; 单例保护
}

/** 扫描在途任务（仅 status∈running/pending 且 thread_id 非空） */
async function scanPendingTasks(db: Database): Promise<TaskRow[]> {
  // 步骤: queryAll(db, SELECT ... WHERE status IN (?,?) AND thread_id IS NOT NULL)
}

/** 轮询单个任务状态（出站查 Lovart，带总超时） */
async function pollOneTask(task: TaskRow, client: LovartClient): Promise<PollOutcome> {
  // 步骤: await withTimeout(client.getStatus(task.thread_id), opts.timeoutMs)
  //       失败原样 throw (禁静默); 返回 {done, raw, error}
}

/** 解析结果 URL —— 复用 resultUrlExtractor 同逻辑（唯一真值源，禁第三份） */
function resolveResultUrl(raw: unknown, type: ResultKind): string | undefined {
  // 步骤: 调用与前端一致的 extractResultUrl({data: raw, type}); 返回 string|undefined
}

/** 写库（唯一入口 upsertTask） */
async function upsertResult(db: Database, taskId: string, patch: ResultPatch): Promise<void> {
  // 步骤: upsertTask(db, {task_id: taskId, ...patch, status:'completed', completed_at: Date.now()})
}

/** 推完成信号到前端（SSE 通道） */
function pushTaskCompleted(arg: TaskCompletedArg): void {
  // 步骤: sseBroadcast('task-completed', arg)  // 前端 taskSocket 接后调 publishTaskCompleted
}

// ── src/components/base/api/taskSocket.ts ──
/** 前端订阅 SSE 完成信号 → 经 taskCompletionBus 唯一入口 emit */
export function connectTaskSocket(): () => void {
  // 步骤: new EventSource('/api/stream/tasks')
  //        onmessage('task-completed', payload => publishTaskCompleted(payload))
  //        返回断开函数
}

// ── proxyGenerate.ts 改造（删除 pollInFlight/pollUntilDone 轮询段）──
// 保留: imageProxy/videoProxy/chatProxy 提交 + persistThreadId 写 thread_id
// 新增: 提交后 connectTaskSocket() 订阅（或 App 级统一订阅一次）
```

### 4.3 可变性纪律
- worker 为**单例**，在途任务集用 `Set<task_id>`（可变，仅 worker 内持有）。
- DB 写入经 `upsertTask`（不可变入参 patch，内部 upsert）。
- 每次 Lovart 调用必须 `withTimeout` 包裹，超时清理悬挂资源，禁止无限挂起。
- SSE 广播为单向通知，前端订阅在 `taskSocket.ts` 单一登记。
- 高频扫描默认节流（interval 配置化，不裸奔）。

### 4.4 红线复查
- [ ] 无 `.catch(()=>{})` 空体；所有异步 `await`。
- [ ] 失败原样透传，无泛化 `new Error('出错了')`。
- [ ] 每次出站调用有 `withTimeout` 总超时。
- [ ] 关键链路 logger debug 埋点（集中开关，默认安静，禁 console.log）。
- [ ] `resultUrlExtractor` 唯一真值源，localTool 侧未另起第三份解析。
- [ ] `publishTaskCompleted` 唯一入口，前端无散 `eventBus.publish('agent:task-completed')`。
- [ ] 新增 SSE 事件/路由在 `contracts.ts` EVENTS/apiRegistry 登记，发布订阅成对。

### 防返工锚点
若日后新增「另一类异步任务」（如视频、3D），本架构是**加几行**（扩展 `scanPendingTasks` 的 type 分支 + 复用 `resolveResultUrl`/`upsertTask`/`pushTaskCompleted`），**无需拆掉重写** —— 因为轮询/写库/推送已统一在 worker 单一链路。

---

## 退回机制
- 若审查发现「SSE 推送 vs DB 补读」权重需调整 → 退回 State 2 重定链路（不影响 State 1 契约）。
- 若发现 localTool 已有可用 SSE/常驻机制 → 退回 State 2 改复用，删减 State 4 新增文件。
- 若 `resolveResultUrl` 跨端共享方式存疑 → 退回 State 2 定唯一入口实现形态。

## 待审查确认项（给审查 AI）
1. worker 扫描间隔（`opts.intervalMs`）与单任务 `withTimeout` 阈值取多少合理（生图 ≤3min，建议轮询间隔 3~5s、单查超时 30s）。
2. SSE 是新建 `/api/stream/tasks` 还是复用 localTool 既有 SSE 能力（需查 localTool 是否已有 SSE）。
3. `resultUrlExtractor` 跨端共享：复制+登记，还是抽为 localTool 与前端共 import 的共享模块（当前分属 Node/浏览器两侧）。
4. 前端「提交即订阅」放在 `proxyGenerate` 内还是 App 级统一订阅一次（推荐 App 级单例，避免重复连接）。
