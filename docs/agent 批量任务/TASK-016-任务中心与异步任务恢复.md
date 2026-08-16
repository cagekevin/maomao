# TASK-016 — 任务中心与异步任务恢复薄弱点探查

> ⚠️ 铁律（违反重做）
> 1. 你只能写这个文件，碰任何其他文件视为失败。
> 2. 不写脚本：本任务是「读源码 + 在本文档表格里写结论」，不写批量改码脚本。
> 3. 每行号必须来自本次你实际读到的文件，禁止套用历史行号。

## 一、任务背景

TASK-006 未覆盖「任务中心（TaskCenter）」与「刷新后异步任务恢复（pollTask）」这条用户可见的状态链路。本地工具生图/视频提交后，前端靠 `pollTaskId` 刷新恢复；任务中心展示进度/结果。本任务探查这条链路的数据一致性、恢复边界、UI 同步。

## 二、硬约束

- 读 `src/components/base/`：`pollTask.js`、`taskStore.js`、`TaskCenter.jsx`、`tasksApi.js`、`eventBus.js`、`useNodeGeneration.js`（任务中心写入侧）。
- 不修改任何 `src/`。
- 不参考现有文档作结论来源。
- 每条结论附「文件 + 行号 + 真实片段 + 触发场景 + 后果」，区分「已确认缺陷 / 设计权衡 / 健康」。

## 三、探索起点（本次会话已定位）

- `src/components/base/pollTask.js`（122 行，已读）：`initTaskRecovery` 每 2s 检查 + 5s 节流（`POLL_INTERVAL=5000`），`MAX_PER_ROUND=5`，`pollOneTask` 查网关 `task_view`，`extractResultUrl` 按类型提结果，`publish('agent:task-completed')`。注释明言「只轮询有 pollTaskId 的异步任务；文本/生图 sync 无 pollTaskId 天然跳过」。
- `src/components/base/taskStore.js`：`getTasks/patchTask/setTaskPollId/registerTaskRetry/runNodeGeneration`（retryRegistry 段，TASK-006 已探 `useNodeGeneration.start` 闭包 loading 重入问题在此关联）。
- `src/components/base/TaskCenter.jsx`：任务列表渲染、进度、重试、删除。
- `src/components/base/eventBus.js`：`publish/subscribe` 解耦广播。
- `src/components/base/useNodeGeneration.js`（162 行，TASK-006 §3.3 已探：`start` 闭包 loading 旧值导致并发生图，L64-65/L125）。

## 四、覆盖清单（按维度）

1. **文本/生图 sync 刷新即丢**：`pollTask.js` 注释明言「文本/生图 sync 无 pollTaskId，刷新即断」。触发场景：用户生图（sync SSE）进行中刷新页面 → 任务卡 running 永不结束，任务中心残留死任务。是否有清理机制（挂载时扫 running 无 pollTaskId 的任务标 failed？）。
2. **恢复轮询只查 5 个/轮**：`pollTask.js L31/105` `MAX_PER_ROUND=5`；若刷新时有 50 个 running 任务，需 10 轮 ×5s = 50s 才查完。用户等待长，且无「优先查当前对话」策略。
3. **extractResultUrl 兼容性**：`pollTask.js L37-57` 只处理 `result.videos/result.images/result.url` 及顶层 `video_url`。若网关返回结构变（如 `result.data.url`、数组包多层），提取失败 → `resultUrl=''` → 任务 completed 但节点拿不到图。是否覆盖所有 provider 返回结构。
4. **patchTask 高频写盘**：`taskStore.patchTask` 每次 poll 一轮（每任务）都写盘？与 TASK-006 §4.2 全量 stringify 同源 → 高频 IO。
5. **任务中心与节点脱节**：`pollOneTask` 完成 `publish('agent:task-completed')`，节点 `eventBus.subscribe` 回写。若节点已被删/已 unmount，`publish` 无人消费 → 任务 completed 但画布无图，且任务中心显示完成无对应节点。
6. **retry 注册竞态**：`taskStore.registerTaskRetry` + `useNodeGeneration.start`（TASK-006 §3.3）`startRef` 防重注册但 `start` 内 `if(loading) return` 用闭包旧值 → 快速双击仍并发生图，任务中心双写。本任务确认 TaskCenter 侧的呈现（是否显示两条相同任务）。
7. **pollTask 单例防重**：`pollTask.js L114` `if(timer) return` 防重复启动；但 `initTaskRecovery` 在 React StrictMode/热重载下是否被调多次？App 挂载点是否确保只调一次。

## 五、输出规范

| # | 维度 | 文件:行 | 真实代码片段 | 触发场景 | 后果 | 判定(缺陷/权衡/健康) |
|---|------|---------|--------------|----------|------|---------------------|
| 1 | sync 刷新丢 | `pollTask.js:10-14`（注释）；`pollTask.js:100-101`（`candidates` 仅筛 `pollTaskId`）；`taskStore.js:152-157`（`reportGenerate` 建 task `status:'running'` 无 `pollTaskId`）；`taskStore.js:32-44`（`initTasks` 仅从历史加载，无清理） | `// 文本（chatCompletions）与生图 sync(SSE) 是同步阻塞请求，前端刷新即断、无 task_id 可查。故这里只轮询有 pollTaskId 的异步任务`；`const candidates = tasks.filter((t) => (t.status === 'running' || t.status === 'pending') && t.pollTaskId)`；`status: 'running', progress: 0, errorMsg: '', resultUrl: '', …`（建任务不写 `pollTaskId`） | 用户生图（sync SSE）/文本生成进行中刷新页面 → 该任务以 `running` 落库且无 `pollTaskId`，`runRound` 永远跳过它 | 任务中心永久残留「生成中」死任务，进度条卡死 0%，无法自动恢复；用户只能手动删除。无挂载时扫描 running 无 pollTaskId 任务标 failed 的兜底 | **已确认缺陷** |
| 2 | 轮询速率 | `pollTask.js:29`（`POLL_INTERVAL=5000`）；`pollTask.js:31`（`MAX_PER_ROUND=5`）；`pollTask.js:105`（`slice(0, MAX_PER_ROUND)`）；`pollTask.js:113-121`（`setInterval` 2s 检查+5s 节流） | `const POLL_INTERVAL = 5000`；`const MAX_PER_ROUND = 5`；`const slice = candidates.slice(0, MAX_PER_ROUND)`；`timer = setInterval(() => { … runRound() }, 2000)` | 刷新瞬间有 50 个 running 异步任务（生图/视频批量）→ 每轮仅查 5 个、每轮间隔 ≥5s | 全部查完需 10 轮 ×5s = 50s 才轮到最后的任务；任务多时用户等待恢复时间线性增长，且无「优先当前对话/当前节点」策略，重要任务可能被排在队尾 | **设计权衡**（明确注释为「防一次刷新几十个任务打爆网关」，但缺优先级策略） |
| 3 | resultUrl 兼容 | `pollTask.js:37-57`（`extractResultUrl`） | `const vids = result.videos \|\| []`；`const imgs = result.images \|\| []`；`return data.video_url \|\| ''`；`return result.url \|\| ''`；仅覆盖 `result.videos[].url` / `result.images[].url` / `result.url` / 顶层 `video_url` | 网关返回结构变体：`result.data.url`、`<img数组包多层`、只返回顶层 `url` 而 `result` 为空对象但带 `data` 子结构 | `extractResultUrl` 取不到 → `resultUrl=''`，`patchTask` 标 `completed` 但 `resultUrl` 空；节点 `onRecover` 因 `!d.resultUrl` 直接忽略（`useNodeGeneration.js:153`），画布无图、任务中心显示「已完成」却点不开缩略图 | **已确认缺陷**（兼容性只覆盖注释中明示的 4 种结构，未覆盖 `result.data.*`/多层包裹） |
| 4 | 高频写盘 | `taskStore.js:209-221`（`patchTask` 每次 `persist`）；`taskStore.js:47-49`（`persist`→`saveTask` 单条 POST）；`pollTask.js:78,85,90,92`（`pollOneTask` 每状态变更都 `patchTask`） | `if (changed) { notify(); const cur = tasks.find((t) => t.id === id); if (cur) persist(cur) }`；`function persist(task) { saveTask(task).catch(() => {}) }`；`patchTask(task.id, { status: 'running', progress: data.progress })` | 50 个 running 任务、每轮（≥5s）每个任务进度变更 1 次 → 每轮最多 5 次 `saveTask` POST；长时间轮询累计大量写盘 | 与 TASK-006 §4.2 同源：每次 `patchTask` 单条 POST 落 SQLite（无批量/合并）；高频 IO，弱网下 POST 失败仅 `catch(()=>{})` 静默丢更新（内存与后端短暂不一致）。非阻塞 UI 但后端可能落后 | **设计权衡**（fire-and-forget 取舍，缺轮询内合并写/批量 save） |
| 5 | 节点脱节 | `pollTask.js:80`（`publish('agent:task-completed')`）；`useNodeGeneration.js:147-158`（effect 挂载时订阅、卸载时 `unsubscribe`）；`useNodeGeneration.js:136-141`（`unregisterTaskRetry`）；`taskStore.js:190`（`reportGenerate.done` 也 `publish`） | `publish('agent:task-completed', { taskId, nodeId, resultUrl, type, status: 'completed' })`；`return subscribe('agent:task-completed', handler)`（effect 返回取消订阅）；`return () => unregisterTaskRetry(nodeId)` | 异步任务完成后，对应节点已被用户删除/画布切走导致组件 unmount（刷新后若该节点所属画布未重新打开，effect 不重挂） | `publish` 经 eventBus 同步调用订阅者，节点已 unmount 则无 handler → 任务中心显示「已完成」但画布节点拿不到图；且 `retryTask` 因 `retryRegistry` 已删该 nodeId 返回 false（`taskStore.js:261`），任务中心提示「找不到对应节点」 | **设计权衡**（解耦设计，但缺「节点缺失时任务结果可经任务中心手动重新注入画布」的回退；目前仅 `reportGenerate.done` 路径有持久 URL 落盘，poll 路径依赖节点 alive） |
| 6 | retry 竞态 | `useNodeGeneration.js:64-65`（`if(loading) return` 闭包旧值）；`useNodeGeneration.js:125`（`start` useCallback 依赖 `[loading, nodeId]`）；`taskStore.js:150-151`（`reportGenerate` 新建前清理同 nodeId 旧 running 任务）；`useNodeGeneration.js:71-74`（`abortRef.current?.abort()` 取消旧请求） | `const start = useCallback(async () => { if (loading) return false … }, [loading, nodeId])`；`const old = tasks.find((t) => t.nodeId === nodeId && (t.status === 'running' || t.status === 'pending'))`；`tasks = tasks.filter((t) => t !== old)` | 快速双击「再来一次」/任务中心重试：第一次点击 `setLoading(true)` 是异步的状态更新，在重渲染生效前 `loading` 闭包值仍为 `false`；第二次点击进入时 `useCallback` 尚未因 `loading` 变化重建，`if(loading) return` 再次放行 | 两次 `start` 都通过防重 → 两次 `runRef.current(...)` **并发打到网关**（浪费一次生图配额/费用）；但**不会**在 TaskCenter 出现两条：第二次 `reportGenerate`（`taskStore.js:150`）会 `filter` 掉第一次刚建的 task_A，最终只保留 task_B。后果是「并发生成 + 首条结果 `taskCtl_A.done` 因 task_A 已移除而成 no-op 丢失」，而非视觉双写。覆盖清单第 6 点之问「TaskCenter 是否显示两条相同任务」：**否**，因 `reportGenerate` 去重清理 | **已确认缺陷**（性质为并发浪费/首结果丢失，非双写；TASK-006 §3.3 同源：依赖闭包 `loading` 而非 `useRef` 同步标志，双击防重不可靠） |
| 7 | 单例防重 | `pollTask.js:114`（`if(timer) return`）；`pollTask.js:33-34`（`timer=null` 模块级）；`pollTask.js:113`（`initTaskRecovery`） | `export function initTaskRecovery() { if (timer) return // 防重复启动; timer = setInterval(...) }`；`let timer = null` | React StrictMode 双调用 / Vite HMR 热重载多次调用 `initTaskRecovery` | 模块级 `timer` 在第一次调用后非空，后续调用 `if(timer) return` 直接跳过 → 只会起一个 `setInterval`，不会叠加轮询 | **健康**（单例防重有效，前提 App 挂载点只调一次 `initTaskRecovery`；若 App 在条件渲染里重复挂载仍安全，因 `timer` 已置位） |

## 六、验收标准

- [x] 7 维度覆盖，附行号+片段。
- [x] 缺陷给触发场景→后果。
- [x] 区分缺陷/权衡/健康。
- [x] 末尾 Top 3。

## 八、Top 3 最值得修的薄弱点

1. **【缺陷·P0】sync 刷新即丢（维度 1）**：文本/生图 sync 任务刷新后永久成为 `running` 死任务，任务中心无清理兜底。影响面最广、用户最易感知。建议：App 挂载/任务加载后扫描 `status==='running' && !pollTaskId` 的任务，标 `failed`（或按类型补限时超时判定），与 `initTasks` 联动。
2. **【缺陷·P1】retry 双击竞态（维度 6）**：`start` 用闭包 `loading` 作防重，快速双击仍并发两次 `runRef.current` 打到网关（浪费一次生图），且首条结果因 `reportGenerate` 去重清理而丢失（TaskCenter 不会显示两条，但首请求结果 no-op）。与 TASK-006 §3.3 同源。建议：改用 `useRef` 同步 `runningRef` 在 `start` 入口做原子判断（`if(runningRef.current) return; runningRef.current = true`），`finally` 复位，彻底消除并发。
3. **【缺陷·P1】resultUrl 兼容不足（维度 3）**：`extractResultUrl` 仅覆盖 4 种返回结构，网关变体（`result.data.url`、多层包裹）会导致任务 `completed` 但 `resultUrl` 空、画布无图。建议：补 `result.data?.url`、`result.url` 已覆盖，增加 `data.result?.url`/递归首 URL 兜底。

> 维度 2（轮询速率）、4（高频写盘）、5（节点脱节）、7（单例防重）判定为设计权衡/健康，非阻塞，可随后续治理一并优化（如轮询内合并写 `batchSaveTasks`、加当前对话优先级）。

## 七、铁律文件名

`docs/agent 批量任务/TASK-016-任务中心与异步任务恢复.md`
