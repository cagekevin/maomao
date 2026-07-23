# AI06 · 模块5：本地工具服务 localTool（:18080，独立进程）

> 审计日期：2026-07-21 ｜ 行号快照会漂移，动手前重 grep。
> 与模块2（前端资源层）互补：本模块审 localTool 自身（Node/TS，sql.js WASM），闭合"三大进程"审计。
> 放置范围：仅 `docs/AI06/`，未触碰 localTool 源码（红线§3.1）。

## 1. 运转图景
localTool 是独立 Node 进程，原生 `node:http` 监听 127.0.0.1:18080。职责：KV 存储、文件上传/读取/缩略图、tasks 持久化、resources CRUD + rescan、proxy、剪映发送（占位）。数据落 SQLite WASM（sql.js）+ 磁盘 `~/.maomao-localtool/`。

## 2. 核心事实（已坐实）
| 项 | 文件:行号 | 说明 |
|----|-----------|------|
| 入口 | `localTool/src/index.ts` L1 | 原生 node:http，VERSION='2.0.0-maomao-clone' |
| 端口 | index.ts L21 | `PORT=18080`（常量） |
| 端口冲突检测 | index.ts L25 | EADDRINUSE → 退出并报"18080 被占用" |
| 静态文件 | index.ts L43/L114 | `/files/*` → 磁盘，路径遍历防护(@L51-54) + 403 |
| 路由分发 | index.ts L100/L231 | `http.createServer(handleRequest)` |
| 数据库 | `localTool/src/db/database.ts` | sql.js(WASM SQLite)，非 better-sqlite3 |
| 上传目录 | database.ts `getUploadDir()` | `~/.maomao-localtool/uploads`（MAOMAO_DATA_DIR 可覆盖） |

## 3. 路由全表（实 grep index.ts L122-208，比 ARCHITECTURE L2.2 更全）
| 模块 | 路由(方法) | 处理 | 行号 |
|------|-----------|------|------|
| 系统 | `/api/status`(GET) | handleStatus | L122 |
| KV | `/api/kv/get`(GET) / `/api/kv/set`(POST) | handleKvGet/Set | L127/L130 |
| 文件 | `/api/files/upload`(POST) | handleUpload | L135 |
| 文件 | `/api/files/read`(GET) | handleRead | L138 |
| 文件 | `/api/files/thumbnail`(GET) | handleThumbnail | L141 |
| 文件 | `/api/files/mkdir`(POST) | handleMkdir | L144 |
| 文件 | `/api/files/move`(POST) | handleMove | L147 |
| 文件 | `/api/files/open`(GET) / `/api/files/open-dir`(GET) | handleOpen/OpenDir | L150/L153 |
| 文件 | `/api/files/list`(GET) | handleList | L156 |
| 任务 | `/api/tasks`(GET) / `/api/tasks/save`(POST) | handleTasksGet/Save | L161/L164 |
| 任务 | `/api/tasks/batch-save`(POST) / `/api/tasks/batch-delete`(POST) | batch | L167/L173 |
| 任务 | `/api/tasks/delete`(POST) / `/api/tasks/clear`(POST) | handleTasksDelete/Clear | L170/L176 |
| 资源 | `/api/resources`(GET) / `/api/resources/save`(POST) | handleResourcesGet/Save | L181/L184 |
| 资源 | `/api/resources/batch-save`(POST) | handleResourcesBatchSave | L187 |
| 资源 | `/api/resources/delete`(POST) | handleResourcesDelete | L190 |
| 资源 | `/api/resources/clear`(POST) | handleResourcesClear | L193 |
| 资源 | `/api/resources/rescan`(POST) | handleResourcesRescan | L196 |
| 代理 | `/api/proxy`(POST) | handleProxy | L201 |
| 剪映 | `/api/jianying/send`(POST) | handleJianyingSend(占位) | L206 |

> ⚠️ ARCHITECTURE L2.2 行号已漂移（写 L168/L181/L190/L202/L211），且**漏列** batch-save/batch-delete、mkdir/move/open/open-dir/list 子路由。本表以 2026-07-21 实 grep 为准。

## 4. 关键逻辑（已坐实）
### 4.1 rescan 绝对路径补全（P0 修复已落地）
`resources.ts` L30-35：
```ts
const LOCAL_TOOL_BASE = 'http://127.0.0.1:18080';
function toAbsoluteFileUrl(relativePath: string): string {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `${LOCAL_TOOL_BASE}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}
```
- 调用点：L77(文件夹 url)、L95(文件 url) → rescan 入库的 url **已是绝对路径**。
- **结论**：TASKS P0 修复方案"Sv() 保存前 toAbsoluteFileUrl"——**localTool 端 rescan 已实施**。前端 `Ev`(L42883)→rescan 返回的 resources URL 已是绝对路径，不破图。
- **P0 残留点**：仅 `files.ts` 的 `thumbUrl`(@L132/L248) 返回相对路径 `/files/...`（无 host）。`handleThumbnail` API 返回的 thumbnailUrl 走相对路径 → 前端破图残留（见 07-bug-rootcause P0.1）。

### 4.2 孤儿清理局限（P2.3 坐实）
`resources.ts` L120-129：
```ts
const localRows = queryAll(db, `SELECT id, folder, name, type FROM resources WHERE source = 'local-tool'`);
for (const row of localRows) {
  const diskPath = path.join(uploadDir, row.folder, row.name);
  if (!fs.existsSync(diskPath)) { run(db, `DELETE FROM resources WHERE id = ?`, [row.id]); orphanDeleted++; }
}
```
- 只清 `source='local-tool'`；`source='extension'`（右键采集入库）记录不清理，即使磁盘已删仍残留（ARCH X3.2 / 07 P2.3）。

### 4.3 删除不删磁盘（P2.1 坐实）
`handleResourcesDelete` @L202：`run(db, 'DELETE FROM resources WHERE id = ?')` @L207，**无 fs.unlink**。仅 `clear` 接口 `deleteFiles=true` 才删磁盘(@L217-219)。

### 4.4 缩略图伪复制（P2.2 坐实）
`files.ts` `tryGenerateThumbnail` @L121：`copyFileSync` @L137 无真实缩放；`thumb_` 命名 @L131 误导。

## 5. 存疑 / 雷
- **PORT 硬编码 18080**（index.ts L21 常量）：与前端 `vv`@L42808(写死18080) 一致；注意前端 `Hr`@L1732 是动态解析（`USE_LOCAL_ENGINE=false` 时→9004），而 localTool 仍监听 18080 → 架构上 false 模式文件功能不可用（X3.3，已纠正原"Hr 硬编码"假设，见 `12`）。
- **CORS 全开**（index.ts L104-106 `Access-Control-Allow-Origin: *` / `Allow-Headers: *`）：本地服务，风险低但非生产级。
- **未落盘日志**：localTool 当前日志只打 stdout（启动窗口），无文件落盘（CLAUDE.md §6.5 已记）。

## 6. 边界契约（与前端接缝）
| 类型 | 名称 | 位置 | 说明 |
|------|------|------|------|
| HTTP | POST /api/files/upload | index.ts L135 | 前端 Xr(L1802)/Zr(L1827) 调 |
| HTTP | POST /api/resources/save | index.ts L184 | 前端 Sv(L42838) 调 |
| HTTP | POST /api/resources/delete | index.ts L190 | 前端 wv(L42857) 调 |
| HTTP | POST /api/resources/rescan | index.ts L196 | 前端 Ev(L42883) 调 |
| HTTP | GET /files/{sub}/{file} | index.ts L114 | 静态服务 |
| 存储 | `~/.maomao-localtool/` | getUploadDir() | DB + uploads 磁盘根 |

## 7. 校验门
所有 `localTool/...:Lnnn` 锚点由 grep 坐实 ✅。与模块2 互补，前端↔localTool 接缝闭合。
