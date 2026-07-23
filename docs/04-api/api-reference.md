# 接口契约（API Reference）

> 手写契约（项目未接入 openapi 自动生成）。按模块记录 Endpoint / Method / Payload / 特殊状态码。函数真身见 `localTool/src/routes/*.ts`。
> 事实来自 AI13 交叉验证 + AI05-03/11/13/14 实证。对外能力清单见 `docs/06-integration.md`。

---

## 1. localTool 端点（:18080）

路由模块对应 `localTool/src/routes/*.ts`。

**文件（files.ts）**
| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/files/upload` | POST | 文件上传落盘，返回可访问 URL |
| `/api/files/read` | GET | 读文件（`?path=`，支持 X-Proxy 头） |
| `/api/files/thumbnail` | GET | 缩略图（`?url=&maxDim=&quality=`，返回 JSON） |
| `/api/files/mkdir` `/api/files/move` | POST | 目录操作 |
| `/api/files/open` `/api/files/open-dir` | GET | 打开文件/目录 |
| `/api/files/list` | GET | 列目录 |
| `/files/*` | GET | 静态文件服务（路径遍历防护 + 长缓存） |

**KV（kv.ts）**
| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/kv/get` | GET | 取键值 |
| `/api/kv/set` | POST | 存键值 |

**系统（system.ts）**
| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/status` | GET | 服务状态，返回 `{status:"ok", version, message, ffmpeg?:boolean, port}` |
| `/api/proxy` | POST | 代理转发（localTool 兼作 9004 网关请求的代理跳板，穿透本地网络隔离）。**两种形态**：① FormData/Blob + `X-Proxy-Url`/`X-Proxy-Method`/`X-Proxy-Headers`(JSON)/`X-Proxy-Cookie` 头；② JSON `{url, method, headers, body, cookie}`。失败 `catch` 后 fall through 直连（AI12 实锤） |
| `/api/jianying/send` | POST | 剪映发送。走本地 `http://127.0.0.1:18080/api/jianying/send`（`Wn`=`Bc`=18080，需 localTool 在跑）。**两种形态**：① 单个 `{fileUrl, localPath, fileName}`；② 批量 `{items:[{fileUrl, localPath}]}`。当前仅记日志占位（AI11 实锤） |

**资源（resources.ts）**
| Endpoint | Method | 说明 | 真身函数 | 备注 |
|----------|--------|------|----------|------|
| `/api/resources` | GET | 资源列表（分页） | `handleResourcesGet` | 分页参数：`page`/`pageSize`(默认20)/`sortBy`(默认`timestamp`)/`sortDir`(默认`DESC`)/`search`/`filters`(JSON字符串)；返回 `{items, total, page, pageSize, totalPages}` |
| `/api/resources/save` | POST | 资源 upsert | `handleResourcesSave`（`Sv`） | body 需含 `id` |
| `/api/resources/batch-save` | POST | 批量 upsert | — | body 为数组 |
| `/api/resources/delete` | POST | 只删 DB 不删盘 | `handleResourcesDelete`（localTool L202） | query `?id=` 传 id；**已 grep 源码坐实**（index.ts L190 仅注册 POST；无 GET、无 deleteFiles 参数） |
| `/api/resources/clear` | POST | 清空资源（可按 folder） | `handleResourcesClear` | body `{folder?:string, deleteFiles?:boolean}`；**已支持 `deleteFiles:true` 删盘**（wv 未用，修复解法见 `03-database.md` §四） |
| `/api/resources/rescan` | POST | 扫描 upload 目录同步进 resources 表 + 孤儿清理 | `handleResourcesRescan`（`Ev`） | rescan 真身在 `Ev`，非 `we`；调用端有**节流**（App.js L42910–42914），高频落盘不会炸库 |

**任务（tasks.ts）**
| Endpoint | Method | 说明 | 真身函数 | 备注 |
|----------|--------|------|----------|------|
| `/api/tasks` | GET | 任务列表（分页） | `handleTasksGet` | 分页参数：`page`/`pageSize`(默认20)/`sortBy`(默认`createdAt`)/`sortDir`(默认`DESC`)/`search`/`filters`(JSON字符串)；返回 `{items, total, page, pageSize, totalPages}` |
| `/api/tasks/save` | POST | 任务 upsert | `handleTasksSave`（前端 `J_`@L41611 调它） | body 需含 `taskId`；`media_meta` 由 `taskToRow` 序列化 |
| `/api/tasks/batch-save` | POST | 批量 upsert | `Y_`@L41696 | body 为数组（启动播种用） |
| `/api/tasks/delete` | POST | 删任务（只删 DB） | `handleTasksDelete`（localTool L84） | query `?id=` 传 id，无 body；**已 grep 源码坐实**（localTool/src/index.ts L170 仅注册 POST，无 GET） |
| `/api/tasks/batch-delete` | POST | 批量删任务 | `handleTasksBatchDelete`（localTool L93） | body `{ids:string[]}`，返回 `{deleted:number}`；**已 grep 源码坐实** |
| `/api/tasks/clear` | POST | 清空全部任务（无删盘、无 statuses 过滤） | `handleTasksClear`（localTool L102） | **无 body**，直接 `DELETE FROM tasks`（清空整表）；原文档写 `{statuses:[]}` 系误植，已据源码删除 |

**客户端调用形态与超时（已 grep src/App.js 坐实）**
- `useLocalTool` hook 暴露 `uploadFile/saveKV/getKV/createFolder/moveFile/status`，内部 `fetch` 打向 localTool 基址（来自 `LOCAL_ENGINE.base`，默认 `http://127.0.0.1:18080`）。
- 超时常量（已解耦至 `src/services/localToolClient.js` / `src/hooks/useLocalTool.js`，行号随构建漂移）：fetch 超时约 5s/15s，连通检测节流约 3s。具体常量名以源码 grep 为准，勿依赖旧行号 L19055/L19145。
- 连通失败文案（源自 `useLocalTool.js`）：`无法连接到 ${LOCAL_ENGINE.base}，请确保 localTool Service 正在运行`（运行时取变量，非硬编码 18080）。
- 代理封装 `zc` 经 `/api/proxy` 转发 9004，断开直连（`zc` 双形态：本地跳板 / 网关直发；`zc` 真身定义在 `src/services/gatewayProxy.js` L3 `async function zc`，App.js L24 `import { zc }` 使用，非 App.js 内定义）。`localPort` 透传逻辑见 `gatewayProxy.js`。

> 资源 URL 经 `toAbsoluteFileUrl`（`localTool/src/routes/resources.ts#L31`）补全为 `http://127.0.0.1:18080/...`，否则前端 `<img>` 在 extension 页面破图。

**已知债务补充（来自 FUNCTION_MAP / PROJECT_LOG）**
- `deleteFiles` 参数债务：`handleResourcesDelete`(`wv`) 只删 DB；真正的删盘解法已存在于 `handleResourcesClear`@L211（支持 `deleteFiles:true`），但 `wv` 未复用——修复时直接改 `wv` 调同一逻辑即可（详见 `03-database.md` §四）。
- 死循环（deadloop）曾发生并已修复（commit `cd3c0aa`）：某同步 / rescan 路径会在特定条件下反复触发自身。接手相关代码时勿重蹈，触发条件见 `docs/PROJECT_LOG.md`。
- 后端与前端行号随时漂移，函数名（`Ev`/`wv`/`J_` 等）才是稳定锚点。

---

## 2. AI 网关端点（:9004，Python `apimart-gateway/main.py`）

| Endpoint | Method | 说明 | 特殊状态码 |
|----------|--------|------|-----------|
| `/v1/tasks/{id}` | GET | 轮询任务状态（前端生图主链路轮询） | 正常 200；abort→400；超时→504；heartbeat 保活 |
| `/v1/chat/completions` | POST (SSE) | 对话流式（main.py L434–574） | abort→400（L502/L521）；超时→504（L541）；heartbeat（L549）|
| `/v1/images/generations` | POST | 图片生成（L591） | — |
| `/v1/videos/generations` | POST | 视频生成（L641） | — |
| `/v1/images/edits` | POST | 图片编辑(inpaint/outpaint)（L595） | — |
| `/v1/tasks/{id}/confirm` | POST | 手动确认（`AUTO_CONFIRM=false` 时，L882） | — |
| `/v1/uploads/images` | POST | 图片上传到网关侧（L900，`USE_LOCAL_ENGINE=false` 时文件走此路由；本地模式默认不走） | — |
| `/v1/balance` | GET | 余额/模式查询（L922）；402/403 → Toast | — |
| `/v1/audio/transcriptions` | POST | 音频转写（走用户配置 endpoint `s`，非 CDN 直连，AI11 L12830） | 自定义端点 |
| `/v1/gateway/ai-app{t}` | POST | 网关 AI 应用调用（`rr`=buildGatewayUrl@L856，`${tr(e)}/v1/gateway/ai-app${t}`） | — |
| `/v1/music` `/audio` `/audio/speech` | POST | 音频类 | **实际返回 501**（L655/L659/L663，与 README 矛盾，待修项） |

> ⚠️ **已知偏差**：网关 README 声称 music/audio 走 chat，源码实返 501。记此待修。
> 两套生图机制：chat 网关内同步轮询 + SSE；生图节点前端异步轮询 `/v1/tasks/{id}`。汇于同一查询端点（AI05-13）。

### 2.1 网关**未实现**端点（前端仍发请求，前端兜底吞掉，无害）
来自 `PROJECT_LOG` + AI13 裁决，以下 9004 路径网关从未实现，**下游 AI 切勿当可用接口调用**：
- `/api/public/platform/builtin`
- `/public/platform/models`
- `/plugin/manifest.json`
- `/api/workflow-apps/by-project/default`

> `workflow-apps/publish` 真实路由：`POST /api/workflow-apps/publish`（AI11 L42492）经 `Sg` 拼 URL 走网关 `http://127.0.0.1:9004/api/workflow-apps/publish`（非 localTool），发布画布工作流用。

---

## 3. 跨进程消息（非 HTTP）

| 消息 | 通道 | 方向 | 说明 |
|------|------|------|------|
| `resourceAdded` | `chrome.runtime` | background → App.js | 资源落盘后跨进程通知前端刷新。**detail**: `{action:'resourceAdded', resource:{id,url,type,pageUrl,pageTitle,source:'extension'}}` |

> 纯 CustomEvent（`mutiwindow-*`）仅限同扩展内同窗口广播，不能跨进程/跨窗口。事件全集与 payload 见 `06-integration.md` §2。
