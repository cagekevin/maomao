# S2 施工设计档 · 轮询收口（ensurePolling 调度注册表 + 统一终态裁决）

> 前置：已走 4 步法 State 1(定契约)/State 2(定数据流) 并经用户确认。
> 范围：只收口 image/video 的 **async 轮询**；chat、image/video 的 **sync SSE 分支不动**。
> 关联：docs/81(总施工) · docs/80 §四/§六(P0-1/2/3 目标态)。

---

## 0. 为什么有两套轮询（用户确认的关键理解，决定设计）

- **in-flight 轮询**(proxyGenerate while)：当前页任务在跑时，实时拿进度/结果。生命周期=页面。
- **恢复轮询**(pollTask)：页面刷新后 in-flight 停了，任务在网关还跑，需独立轮询捞回结果。生命周期=数据/localTool。
- 二者查同一 taskId，但**触发时机/生命周期不同** → 不能简单删一套。
- **ensurePolling 解法**：调度注册表 Map<taskId>，**同一时刻一个 taskId 只有一个 poller**。当前页在跑→in-flight 先注册(带实时进度)；刷新→注册表清空(运行时属性)→启动扫描重新注册恢复轮询接管。

## 1. 数据流定稿（State 2 产出）

```
调用方两处，同一 ensurePolling 入口：
  ① in-flight: async 提交拿 task_id + setTaskPollId → ensurePolling(taskId, {register: 单轮回调, type})
  ② 启动扫描(App 挂载 initTasks 后): 对每个 running/pending && pollTaskId → ensurePolling
        ├── taskId 已注册 → 返回已有句柄(不起第二个)   ← 双查构造上不可能
        └── 未注册 → 注册，定时驱动单轮回调到终态

终态裁决(唯一, 统一 in-flight 与恢复)：
  completed:
    ① 任务记录已有持久 resultUrl(/files/) → 保留不动        ← 修复 C：恢复不覆盖已持久结果
    ② resultUrl 为空(崩在落盘前) → 才回源网关拿原始 URL 兜底 ← 极端边界，S4 彻底根治
    ③ patchTask(completed, 最终 resultUrl) + publishTaskCompleted
  failed: patchTask(failed, errorMsg)   (不广播，同现状)
```

## 2. ensurePolling 设计要点

- **不做传输统一**：in-flight 保留 /api/proxy + onProgress；恢复保留 gateway/task。ensurePolling 只调度+终态裁决，不掺 provider/传输知识。
- 单轮回调 `register(taskId) => Promise<单轮是否到终态>` 由各传输方提供（proxyGenerate 提供 in-flight 版；pollTask 提供恢复版）。
- 超时/取消：每 poller 带总超时(image/video 各自 GEN/VIDEO_TIMEOUT)；AbortSignal 中止 → stopPolling 清注册表。

## 3. 改动点与现有测试影响

| 文件 | 改动 | 现有测试影响 |
|---|---|---|
| `taskStore.ts` | 新增 pollers Map + ensurePolling/stopPolling + 终态裁决函数 | taskStore.test.ts 基本不破坏 |
| `proxyGenerate.ts` | async 分支删 while，改 ensurePolling 注册(单轮回调含 onProgress) | imageApi/videoApi 行为不变 |
| `pollTask.ts` | 删 runRound/initTaskRecovery 定时器；pollOneTask 保留为单轮回调；新增启动扫描 | pollTask.test.ts 单轮状态机断言基本保住(不测 runRound/initTaskRecovery) |
| `App.tsx` | L489 initTaskRecovery() → 新启动扫描 | 无 |

## 4. 测试设计（State 3）

| # | 断言 | 实现一变必红 |
|---|---|---|
| N1 | ensurePolling 同 taskId 重复注册 → 只一个 poller | 无注册表 → 双查 |
| N2 | 启动扫描: running/pending&&pollTaskId → 逐个 ensurePolling | 扫描不注册 → 刷新不恢复 |
| N3 | 恢复终态**不覆盖**已持久 /files/ resultUrl | 现 pollOneTask 直接覆盖外链 → 红 |
| N4 | resultUrl 为空边界 → 才回源网关兜底 | — |
| N5 | pollOneTask 单轮状态机断言保留(迁回调不破) | 搬家后逻辑变 → 红 |
| N6 | 恢复路径不再单独 publish 外链(完成出口唯一) | 仍广播外链 → 红 |

## 5. 边界与诚实标注
- "崩在落盘前、resultUrl 为空"的极端边界，S2 只做到"回源兜底显示"，彻底根治留 S4(撤销 P0-C 让 done 内部落盘)。
- EVENTS `from` 仍登记 taskCompletionBus.ts:30，publish 调用点变化过 `npm run check:events`。
- S2 完成后，应跑 `npm test`(前端全量)+ `npm run build` + `check:events` + `check:api`。
