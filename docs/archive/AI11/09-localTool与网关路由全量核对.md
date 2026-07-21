# 09 · localTool 与网关路由全量核对（后端契约坐实）

> 源：localTool `src/index.ts` L122–208 + `routes/*.ts`；网关 `apimart-gateway/main.py` L434–922。
> 全部 grep/read 坐实（2026-07-21）。本文件补全前序模块只引用未全列的后端路由，作为模块1–4 接缝的权威端点清单。

---

## 一、localTool 路由全量（index.ts 分发，L122–208）

| 分类 | 路由 | 方法 | 处理函数 | 行号 |
|------|------|------|---------|------|
| 系统 | `/api/status` | GET | handleStatus | L122 |
| KV | `/api/kv/get` | GET | handleKvGet | L127 |
| KV | `/api/kv/set` | POST | handleKvSet | L130 |
| 文件 | `/api/files/upload` | POST | handleUpload | L135 |
| 文件 | `/api/files/read` | GET | handleRead | L138 |
| 文件 | `/api/files/thumbnail` | GET | handleThumbnail | L141 |
| 文件 | `/api/files/mkdir` | POST | handleMkdir | L144 |
| 文件 | `/api/files/move` | POST | handleMove | L147 |
| 文件 | `/api/files/open` | GET | handleOpen | L150 |
| 文件 | `/api/files/open-dir` | GET | handleOpenDir | L153 |
| 文件 | `/api/files/list` | GET | handleList | L156 |
| 任务 | `/api/tasks` | GET | handleTasksGet | L161 |
| 任务 | `/api/tasks/save` | POST | handleTasksSave | L164 |
| 任务 | `/api/tasks/batch-save` | POST | handleTasksBatchSave | L167 |
| 任务 | `/api/tasks/delete` | POST | handleTasksDelete | L170 |
| 任务 | `/api/tasks/batch-delete` | POST | handleTasksBatchDelete | L173 |
| 任务 | `/api/tasks/clear` | POST | handleTasksClear | L176 |
| 资源 | `/api/resources` | GET | handleResourcesGet | L181 |
| 资源 | `/api/resources/save` | POST | handleResourcesSave | L184 |
| 资源 | `/api/resources/batch-save` | POST | handleResourcesBatchSave | L187 |
| 资源 | `/api/resources/delete` | POST | handleResourcesDelete | L190 |
| 资源 | `/api/resources/clear` | POST | handleResourcesClear | L193 |
| 资源 | `/api/resources/rescan` | POST | handleResourcesRescan | L196 |
| 代理 | `/api/proxy` | POST | handleProxy | L201 |
| 剪映 | `/api/jianying/send` | POST | handleJianyingSend（占位） | L206 |
| — | 其他 | — | sendError 404 | L211 |

> 注：ARCHITECTURE L2.2 列的 `/api/files/upload`(POST)/`/read`(GET)/`/thumbnail`(GET)/`/mkdir`/`/move`(POST)/`/open`/`/open-dir`(GET)/`/list`(GET) 与代码一致 ✅。新增发现 `/api/tasks/batch-delete`（文档未列）。
> 静态文件 `/files/*` 由 index.ts L43（见 ARCHITECTURE L222）单独处理，不在上表路由分发内。

## 二、网关路由全量（main.py，grep 坐实）

| 路由 | 方法 | 行号 | 说明 |
|------|------|------|------|
| `/v1/chat/completions` | POST | L434 | 流式 SSE 聊天 |
| `/v1/images/generations` | POST | L591 | 图片生成 |
| `/v1/images/edits` | POST | L595 | 图片编辑(inpaint/outpaint) |
| `/v1/videos/generations` | POST | L641 | 视频生成 |
| `/v1/music/generations` | POST | L655 | **501** |
| `/v1/audio/generations` | POST | L659 | **501** |
| `/v1/audio/speech` | POST | (ARCHITECTURE L263 记 L663) | **501(TTS)** |
| `/v1/tasks/{task_id}` | GET | L873 | 任务状态轮询 |
| `/v1/tasks/{task_id}/confirm` | POST | L882 | 手动确认 |
| `/v1/balance` | GET | L922 | 余额/模式 |

> 注：ARCHITECTURE L3.2 路由表与代码一致 ✅。`/v1/videos`(别名 L651)/`/v1/video/generations`(L646) 本次未在 main.py 直接 grep 到 post 装饰器（可能为 `videos_generations` 内部别名），建议文档维护者复核 L646/L651 是否真实存在路由或仅为常量。

## 三、前后端接缝映射（模块→路由）

| 模块 | 前端符号 | 后端路由 | 位置 |
|------|---------|---------|------|
| 模块1 | useLocalTool 连接检测 | GET `/api/status` | index.ts L122 |
| 模块2 | `Xr`@L1802 / `Zr`@L1827 / hook.uploadFile@L19098 | POST `/api/files/upload` | index.ts L135 |
| 模块2 | `Sv`@L42840 | POST `/api/resources/save` | index.ts L184 |
| 模块2 | `wv`@L42859 | POST `/api/resources/delete` | index.ts L190 |
| 模块2 | `Tv`@L42868 | POST `/api/resources/clear` | index.ts L193 |
| 模块2 | `Ev`@L42885 | POST `/api/resources/rescan` | index.ts L196 |
| 模块2 | `xv`@L42821 | GET `/api/resources` | index.ts L181 |
| 模块3 | `Jn`@L32490 → `${R}/v1/images/generations` | POST `/v1/images/generations` | main.py L591 |
| 模块3 | 轮询 `pollUrl` | GET `/v1/tasks/{id}` | main.py L873 |
| 模块3 | `markNeedsConfirm` | POST `/v1/tasks/{id}/confirm` | main.py L882 |
| 模块8 | `syncAllToLocalTool`@L1608 | KV/tasks/resources 系列 | index.ts L127–198 |

## 四、校验结论

- localTool 路由全量与 ARCHITECTURE L2.2 一致（新增 batch-delete 一处文档遗漏）。
- 网关路由全量与 ARCHITECTURE L3.2 一致（个别别名 L646/L651 待复核）。
- 所有模块引用的路由在后端均有真实处理函，无悬空端点（除 `/v1/music`/`/v1/audio` 返回 501 属已知限制）。
