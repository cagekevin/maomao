# 全局任务与AI生成轮询机制（模块专题 · 按需查阅）

> 事实锚点：grep `src/App.js`、`src/services/taskStore.js`、`src/config/storageKeys.js`（行号快照 2026-07-23）坐实。
> 行号随构建漂移，主引用用函数语义名 + 真实路径；动手前回源码复核当前行号。
> 本文只写代码里已存在的机制，不写方案、不写待决策。

---

## 〇、这是什么

所有 AI 生成任务（生图/视频/音频/文本/自定义节点/rhWebapp）统一进入「全局任务」队列，提交到网关 `:9004` 拿到 `taskId` 后**递归轮询**结果，完成后把资源落 18080（见 `中转资源本地落盘机制.md`）并回写节点。任务状态持久化到 SQLite（非 KV）。

---

## 一、存储键与持久化

- `Z.GLOBAL_TASKS` = `globalTasks`（`storageKeys.js:15`）。
- UI 状态 `globalTasks: R = []`（`App.js:29191`），更新 `updateGlobalTasks: z` → `wi`（`App.js:41774`）→ `ev`/`tv`（`taskStore.js`）→ `POST vv/api/tasks/save`（或 `batch-save`）。
- 启动播种（`App.js:40548`）：若本地 SQLite 无标记，把 KV 里的历史 `globalTasks` 经 `Y_` 批量写库。
- 注意：`syncAllToLocalTool`（`storage/index.js:323`）也把 `globalTasks` 列入 KV 全量同步清单，但运行态主存储是 SQLite。

---

## 二、任务生命周期（以 rhWebapp 节点为例）

- 发起：`POST rr(p, '/run')`（`App.js:13627`），`p` = 网关基址（`:9004`，来自 `config.js`）；取 `taskId`（`App.js:13637`）。
- 入队：先写一条 `{status:'running'}` 全局任务（`App.js:13654-13668`），再 `R(o)` 启动轮询（`App.js:13686` effect，节点挂载且未失败则自动起轮询）。
- 轮询循环（递归 `setTimeout`，非 `setInterval`，`App.js:13435`）：
  - `fetch rr(p, '/task/'+taskId)`（`App.js:13435`）取 `status`。
  - 状态机：`QUEUED`→`running`；`SUCCESS`→`completed`（处理 `r.results`，经 `Xr(...,{subfolder:'tasks'})` 落 18080，逐个 `addTransitResource(url, type, 'generated')`，回写节点 `data`：`status:'SUCCESS', progress:100`）；`FAILED`→`failed`；超时（`Date.now()-start>6e5`=600s）→`failed`（`App.js:13437-13446`）。
  - 间隔：首次 1500ms，之后 3000ms（`App.js:13567`/`13570`）；由 `globalPollingInterval`(默认3)/`globalMaxPollingDuration`(默认600)（`App.js:29197-29198`）配置。

---

## 三、与节点 / 资源的关系

- 各类节点经 `nodeTypes` 分发生成回调（`App.js:33458`）：`imageNode→Jn`(生图 `App.js:30377`)、`videoNode→ur/er`、`textNode→cr`、`customNode→_r`、`rhWebappNode` 走上面 `/run` 流程。
- 结果资源统一经 `urlifyAsset`(`Zh`，云端 `upload/asset`) 或 `Zr`/`Xr`（本地 18080）处理；外传第三方时走云端 `Zh`，自用落盘走 `Zr`/`Xr`。

---

## 四、一句话

`节点生成 → POST :9004/run 拿 taskId → 入全局任务(running) → 递归轮询 /task/:id → SUCCESS 落 18080(addTransitResource)+回写节点；FAILED/超时→failed；状态存 SQLite`。

---

## 五、改码前必查

1. **轮询是递归 setTimeout，不是 setInterval**：改动循环逻辑务必保持 `T.current = setTimeout(r, …)` 链，别误改成会泄漏的 setInterval。
2. **结果必须落 18080**：SUCCESS 分支的资源经 `Xr(...,subfolder:'tasks')` 下载落盘，严禁把网关 CDN URL 直接写节点（CLAUDE.md §3.2）。
3. **任务存 SQLite 非 KV**：`updateGlobalTasks` 经 `taskStore.js` 写库；别用 `Q.setObject(globalTasks,…)` 当主存储（仅 `syncAllToLocalTool` 才顺带同步 KV）。
4. **超时 600s 硬性失败**：`Date.now()-start>6e5` 直接 `failed`，长任务需确认网关侧不超时。

---

## 六、真实路径速查

| 符号 | 位置（≈行） | 作用 |
|------|------------|------|
| `Z.GLOBAL_TASKS` | storageKeys.js:15 | 存储键 |
| `R` / `r`（轮询） | 29191 / 13435 | 任务状态 / 轮询循环 |
| `R(o)` 启动 | 13686 | 节点挂载起轮询 |
| `/run` 发起 | 13627 | POST :9004/run |
| SUCCESS 落盘 | 13486 / 13522 | `Xr(tasks)` + `addTransitResource` |
| `wi`→`ev`/`tv` | 41774 / taskStore.js | 持久化到 SQLite |
| 配置 `globalPolling*` | 29197 | 轮询间隔/超时 |
