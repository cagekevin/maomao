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
| `/api/status` | GET | 服务状态 |
| `/api/proxy` | POST | 代理转发 |
| `/api/jianying/send` | POST | 剪映发送（占位，仅记日志） |

**资源（resources.ts）**
| Endpoint | Method | 说明 | 真身函数 | 备注 |
|----------|--------|------|----------|------|
| `/api/resources` | GET | 资源列表（分页） | `handleResourcesGet` | — |
| `/api/resources/save` | POST | 资源 upsert | `handleResourcesSave`（`Sv`） | body 需含 `id` |
| `/api/resources/batch-save` | POST | 批量 upsert | — | body 为数组 |
| `/api/resources/delete` | POST/GET | 只删 DB 不删盘 | `handleResourcesDelete`（`wv`） | 已知债务；无 deleteFiles 参数 |
| `/api/resources/clear` | POST | 清空资源（可按 folder） | `handleResourcesClear` | **已支持 `deleteFiles:true` 删盘**（wv 未用，修复解法见 `03-database.md` §四） |
| `/api/resources/rescan` | POST | 扫描 upload 目录同步进 resources 表 + 孤儿清理 | `handleResourcesRescan`（`Ev`） | rescan 真身在 `Ev`，非 `we`；调用端有**节流**（App.js L42910–42914），高频落盘不会炸库 |

**任务（tasks.ts）**
| Endpoint | Method | 说明 | 真身函数 | 备注 |
|----------|--------|------|----------|------|
| `/api/tasks` | GET | 任务列表（分页） | `handleTasksGet` | — |
| `/api/tasks/save` | POST | 任务 upsert | `handleTasksSave`（前端 `J_`@L41611 调它） | body 需含 `taskId`；`media_meta` 由 `taskToRow` 序列化 |
| `/api/tasks/batch-save` | POST | 批量 upsert | `Y_`@L41696 | body 为数组（启动播种用） |
| `/api/tasks/delete` | GET | 删任务（只删 DB） | `handleTasksDelete` | 已知债务 |
| `/api/tasks/batch-delete` | POST | 批量删任务 | `Z_` | body `{ids:[]}` |
| `/api/tasks/clear` | POST | 清空任务（无删盘） | `handleTasksClear` | 已知债务（比 wv 更深）|

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
| `/v1/music` `/audio` `/audio/speech` | POST | 音频类 | **实际返回 501**（L655/L659/L663，与 README 矛盾，待修项） |

> ⚠️ **已知偏差**：网关 README 声称 music/audio 走 chat，源码实返 501。记此待修。
> 两套生图机制：chat 网关内同步轮询 + SSE；生图节点前端异步轮询 `/v1/tasks/{id}`。汇于同一查询端点（AI05-13）。

---

## 3. 跨进程消息（非 HTTP）

| 消息 | 通道 | 方向 | 说明 |
|------|------|------|------|
| `resourceAdded` | `chrome.runtime` | background → App.js | 资源落盘后跨进程通知前端刷新。**detail**: `{action:'resourceAdded', resource:{id,url,type,pageUrl,pageTitle,source:'extension'}}` |

> 纯 CustomEvent（`mutiwindow-*`）仅限同扩展内同窗口广播，不能跨进程/跨窗口。事件全集与 payload 见 `06-integration.md` §2。
