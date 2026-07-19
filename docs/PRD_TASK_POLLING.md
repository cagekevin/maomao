# PRD：一毛画布 V1 接入网关异步 Task 轮询（最终版）

> **目标**：让画布的文生图、图生图、视频生成通过 `apimart-gateway` 真正跑通。
> **原则**：所有改动在画布 V1 侧（`src/_engine/App.js`），不改动网关代码。
> **基线**：2+1（提交侧归一）。提交端点 `generations`/`edits`/`videos` 的差异仅是"带不带图 + 走哪个 URL"，属提交层参数，不进轮询模块；轮询+取媒资这套下游逻辑对文生图/图生图/视频零差异。

---

## 1. 项目定位

- **做什么**：在 V1 画布 `Jn` 函数 N 分支（~行 32891）实现对网关异步 task 的轮询取媒资——提交拿到 `task_id` → 轮询 `GET /v1/tasks/{id}` 至终态 → 从 `data.result` 取图/取视频。
- **给谁用**：一毛画布 V1 的使用者，通过画布界面生图/生视频。
- **核心价值**：屏蔽网关的异步状态机，让画布像调同步 API 一样稳定出图/出视频；同时向后兼容直接返回 `url`/`b64` 的同步 API。

**现状**：
- 网关侧：`POST /v1/images/generations`、`POST /v1/images/edits`、`POST /v1/videos/generations` 均已实现，返回异步 task_id，通过 `GET /v1/tasks/{task_id}` 轮询结果。**网关无需改动。**
- 画布侧：
  - 聊天 SSE：✅ 已修通
  - 文生图/图生图（`Jn` N 分支，~行 32891）：❌ 同步解析 `data[0].b64_json/url`，拿到 task_id 后不轮询，报"未生成图片"
  - sd2Video（~行 33247）/ video（~行 33852）：⚠️ 有轮询逻辑，但轮询端点和结果格式与网关不匹配

---

## 2. 模块拆解

| # | 模块 | 职责 |
|---|------|------|
| **A** | 异步轮询 + 结果提取 | 检测 `task_id` → 轮询 `GET /v1/tasks/{id}` → 终态判定 → 从 `data.result` 提取图片/视频 URL → 交给 `ii()` 持久化。media-agnostic，图/视频共用。无 task_id 时走原同步解析。 |
| **B+C** | 文生图 + 图生图接入 | A 完成即 B+C 完成（轮询成功赋值 `u` 后自然落入 32909 以后的已有回写逻辑） |
| **D** | 视频轮询 + 结果适配 | sd2Video/video 节点：轮询端点改走 `/v1/tasks/{id}`，结果解析取 `data.result.videos[0].url[0]`，状态判定对齐网关 |
| **E** | 视频提交 body 参数对齐 | sd2Video/video 节点的提交 body 字段映射到网关格式（**阻塞项，需决策改画布还是改网关**） |

**依赖**：B+C 依赖 A。D 依赖 A（共用轮询逻辑）。E 独立，是视频的阻塞项。

---

## 3. 陷阱（代码实证）

### 陷阱 1：响应格式错位
网关提交返回 `{code:200, data:[{status:"submitted", task_id:"task_xxx"}]}`（main.py 756），画布在 32892-32897 只尝试从 `data[0]` 取 `b64_json`/`url`/`image_url.url`。`task_id` 被完全忽略 → `u` 为空 → 32909 `throw Error('未生成图片')`。

### 陷阱 2：AbortController 在初始 fetch 后已被删除
- 32780：`ht.current.set(n, i)` 注册（`n = \`${e}_${t}\``）
- 32821：`ht.current.delete(n)` 在 `await zc(...)` 返回后立即执行
- 32818：`.finally()` 里 `clearTimeout(o)` 清除了 `oe` 的计时器
- 31457：全局取消 `ht.current.forEach(e => e.abort())`
- **后果**：轮询若复用原 controller，全局取消命中不了；`oe` 计时器在轮询开始前就已失效
- **对策**：轮询前新建 `AbortController` 并重新 `ht.current.set(n, ac)`，`finally` 中 `ht.current.delete(n)`

### 陷阱 3：`oe` 超时不 abort 且已被清除
- 32782-32790：`oe`（globalSyncTimeout，默认 600s）只做"转入后台运行"UI 提示，**从不 abort**
- 32818：`.finally()` 里 `clearTimeout(o)` 在初始 POST 返回后立即清除
- **对策**：轮询必须自建 deadline（15min），不依赖 `oe`

### 陷阱 4：`.url` 是数组不是 string
- main.py 154/156：`images.append({"url": [url], ...})`、`videos.append({"url": [url], ...})`
- 旧同步逻辑 32894 `e.url` 直接当 string 用 → 拿到数组 → `Image.src` 赋值失败
- **对策**：必须 `.url[0]`

### 陷阱 5：URL 过期
- main.py 37/144/154：`expires_at = now + TASK_RESULT_TTL`（默认 86400 = 24h）
- 轮询取到的 CDN URL 24h 后 404
- 32911-32921：已有 `ii(u, {subfolder, preferThumbnail, ...})` 持久化逻辑，但只对 `data:` 开头的 base64 触发
- **对策**：HTTP URL 也必须经过 `ii()` 下载并持久化到本地，不能裸存 CDN URL 到任务状态

### 陷阱 6：审核拒绝 ≠ 普通失败
- main.py 835-840：终态 `status:"failed"` + `data.error.code:"no_artifact"` + `data.error.message` 含审核拒绝提示
- **对策**：`data.error.code === 'no_artifact'` 时优先用 `data.error.message`，不能笼统报"生成失败"

### 陷阱 7：图/视频可独立出现
- main.py 159-165：`out` 只含实际存在的 key（`images`/`videos`/`music`）
- 视频任务 `data.result` 无 `images`；图任务无 `videos`
- **对策**：分别判空，不假设两者都在

---

## 4. 全局约束

| # | 约束 | 说明 |
|---|------|------|
| X1 | 复用现有 `zc`/`R`/`h`/`n`/`z`/`ht.current`/`ii` | 禁止为轮询新建独立 fetch 层或全局状态 |
| X2 | 所有错误统一 `throw Error(...)` 走现有 catch（33032） | 不新增错误格式，catch 已带 `rawResp` |
| X3 | 仅改 `Jn` 的 N 分支（~32891） | 不动 B 分支（SSE，32832）及其他分支 |
| X4 | 同步 API 兼容 | 无 task_id 时走原同步解析（32892-32897 不动） |

---

## 5. 模块 A：异步轮询 + 结果提取

### 5.1 插入点

行 32891 `if (N) {` 内部。替换 32892-32897 的同步解析为：**task_id 检测 → 有则轮询 → 无则走原逻辑**。

### 5.2 约束清单

| # | 约束 | 代码实证 | 验证标准 |
|---|------|----------|----------|
| A-C1 | **task_id 检测 + 分流**：从 `t`（已 JSON.parse 的提交响应）提取 `taskId = t.data?.[0]?.task_id \|\| t.data?.[0]?.id \|\| t.task_id \|\| t.id`。有 taskId → 进轮询；无 → 走原同步解析（32892-32897 原逻辑不动） | 提交响应 756：`{status:"submitted", task_id}` | 网关响应提取到 `"task_abc"`；直连 OpenAI 同步响应走原逻辑 |
| A-C2 | **轮询端点**：`GET ${R}/v1/tasks/${taskId}`，用 `zc(url, {method:'GET', headers:{Authorization:`Bearer ${h}`}, localPort: H.status.isConnected ? H.status.port : undefined})`，**不带 body** | `zc` 18941：localPort 分支透传 `method`；初始 POST 32813 同形 | localPort 连接时轮询走 `/api/proxy` 且 method=GET |
| A-C3 | **AbortController 重注册**：轮询前 `new AbortController()`，`ht.current.set(n, ac)`（`n` = `\`${e}_${t}\``，沿用 32776），`finally` 中 `ht.current.delete(n)`。轮询 fetch 传 `signal: ac.signal`，每轮检查 `ac.signal.aborted` | 32780 set / 32821 delete / 31457 全局取消 | 轮询中点全局取消，catch 命中 `AbortError`，面板标"已取消" |
| A-C4 | **终态判定**：严格按网关归一化值——`pending`/`processing` → 继续轮询；`completed` → 提取结果；`failed` → `throw Error(data.error?.message \|\| '生成失败')`。响应含顶层 `error` 字段（HTTP 级 401/400）也立即 throw | 795-845：`pending`/`queued`/`submitted` → `"pending"`；`running` → `"processing"`；有结果 → `"completed"`；无结果 → `"failed"` + `error` | 分别 mock 三种状态，行为正确 |
| A-C5 | **结果提取**：① 优先网关 shape：图片 `data.result.images?.[0]?.url?.[0]`，视频 `data.result.videos?.[0]?.url?.[0]`（`.url` 是数组，必须 `[0]`，154/156 行）；② 兜底同步 shape：`data[0].url`/`data[0].b64_json`/`data[0].image_url.url`（32892-32897 原逻辑）；③ 图/视频分别判空，不假设两者都在（159-165）；④ 无结果时：`data.error.code === 'no_artifact'` → throw 其 `message`（含审核拒绝提示，835-840）；否则 `throw Error('生成完成但未产出媒资')` | 154/156：`url: [url]`；835-840：`no_artifact` 错误 | 网关异步 + 直连同步均取到 URL；审核拒绝显示精确提示 |
| A-C6 | **URL 持久化**：轮询取到 HTTP URL 后，必须经过 `ii(u, {subfolder:'tasks', preferThumbnail:true, thumbMaxDim:480, thumbQuality:75})` 下载并持久化（32911-32918 同形）。`ii` 返回 `{url, thumbnailUrl}` → `u = e.url`。base64 URL（`data:` 开头）也走 `ii`。**不裸存 CDN URL 到任务状态** | 32911-32921：`ii` 仅对 `data:` 触发；CDN URL 需手动调用 | 异步完成后任务状态里是本地 url 而非 `*.lovartcdn*` 裸链 |
| A-C7 | **轮询间隔**：`(ie \|\| 3) * 1e3` ms（`ie` = globalPollingInterval，默认 3）；连续 429 或空响应时退避 ×1.5，上限 15s | 31244：`ie` 定义 | 日志相邻间隔 ≥3s |
| A-C8 | **自建 deadline**：`deadline = Date.now() + 9e5`（15min），每轮 `if(Date.now() > deadline) throw Error('生成超时（15分钟）')`。不耦合 `oe`（`oe` 的 setTimeout 在 32818 `.finally` 已被 `clearTimeout(o)` 清除，轮询开始前即失效） | 32781-32790：`oe` 只做 UI 提示不 abort；32818：`clearTimeout(o)` | 15min 后抛错不卡死 |
| A-C9 | **进度回写**：轮询中 `z(e => e.map(e => e.id === r \|\| e.taskId === r ? {...e, status:'running', progress: data.progress \|\| progress} : e))`（`r` = `\`${e}_${Date.now()}_${t}\``，32796；`data.progress` 来自网关 `_task_view` 356） | 32792-32806：初始 `z` 调用同形；356：`_task_view` 返回 `progress` | 任务面板实时显示进度百分比 |

### 5.3 轮询成功后的数据流

```
轮询终态 completed
  → A-C5 提取 URL（u）
  → A-C6 ii(u) 持久化 → u = 本地 url, f = thumbnailUrl
  → 32909 if (!u) throw — 不触发（u 已有值）
  → 32911 if (u.startsWith('data:')) — 不触发（ii 已转为本地 http url）
  → 32922 new Image() → onload → 更新节点/任务面板
```

---

## 6. 模块 B+C：文生图 + 图生图接入

A 完成即 B+C 完成。轮询成功赋值 `u` 后自然落入 32909 以后的已有回写逻辑。**不需要额外代码。**

**验证**：
- 文生图：选 OpenAI 格式模型，输入提示词 → 提交 → 轮询 → 图片出现在画布
- 图生图：连接 imageBoxNode，选模型 → 提交 FormData → 轮询 → 图片出现在画布
- 同步兼容：直连 OpenAI DALL-E（同步返回 `data[0].url`）→ 不走轮询 → 图片正常出现

---

## 7. 模块 D：视频轮询 + 结果适配

**状态**：待做（依赖模块 A 的轮询逻辑）。

**改动点**（sd2Video ~行 33355 / video ~行 33968）：
- 轮询端点：改为 `GET ${base}/v1/tasks/${task_id}`（替代原 `/v1/video/generations/${id}` 和 `/v1/videos/{id}`）
- 结果解析：改为取 `data.result.videos?.[0]?.url?.[0]`（替代原 `data.content.video_url` 等多种字段）
- 状态判定：对齐网关 `completed`/`failed`（替代原 `SUCCESS`/`IN_PROGRESS`/`FAILED`）
- task_id 检测：提交响应中 task_id 以 `task_` 开头时走网关轮询，否则走原轮询

---

## 8. 模块 E：视频提交 body 参数对齐（阻塞项）

**状态**：⏸️ 阻塞，需决策。

**问题**：视频节点的提交 body 与网关不兼容，且无法通过"检测 task_id"在轮询阶段解决（提交就失败了）。

| # | 不兼容点 | 画布侧 | 网关侧 |
|---|---------|--------|--------|
| E-P1 | **sd2Video 提交端点** | `POST /v1/video/generations`（单数，33247） | `POST /v1/videos/generations`（复数） |
| E-P2 | **sd2Video 提交 body** | `{model, prompt, metadata: {ratio, duration, reference_images, ...}}`（33270-33282，字段嵌套在 `metadata`） | `{model, prompt, size, aspect_ratio, duration, reference_images, ...}`（字段在顶层） |
| E-P3 | **video 节点提交 body** | `{model, prompt, seconds, input_reference, input_video}`（33883-33890） | `{model, prompt, duration, reference_images, videos}`（字段名不同） |
| E-P4 | **状态词表** | sd2Video/video 用 `SUCCESS`/`IN_PROGRESS`/`FAILED`（33370/33392） | 网关用 `completed`/`failed`/`pending`/`processing` |

**解决方向（待决策）**：
- 方案 A：网关侧增加路由别名 + body 字段兼容层（改网关）
- 方案 B：画布侧做字段映射（改画布）
- 方案 C：视频节点新增"网关模式"开关