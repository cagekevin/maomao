# 模块6 · localTool 服务端审计

> 审计对象：`localTool/src/*`（Node/TS，监听 `127.0.0.1:18080`，替代闭源 Go 二进制）。
> 行号快照：2026-07-21（TS 源码稳定）。
> 关联：模块2（本地数据层与 Rescan）的**服务端对等体**；模块3 落盘归宿；门4（30_）已跨审 P2 三项。本模块补全「启动/路由/持久化/KV/系统/任务」独立链路，不重复 P2 细节。
> 门3 校验：52 行号引用全 PASS、0 FAIL；3 个 WARN 为脚本局限（`main()`/`getDb()`/`closeDb()` 是 localTool 侧函数，门3 脚本仅对 `App.js` 做符号校验，非真实错误）。

---

## ① 运转图景

localTool 是纯本地 HTTP 服务，承载四类职责：
1. **文件仓库**：`/api/files/*` 上传/读取/缩略图/目录操作，磁盘落地于 `~/.maomao-localtool/uploads`（见 `database.ts:L17-L19`）。
2. **结构化存储**：`tasks` / `resources` / `kv` 三张表，由 sql.js（WASM）持久化到 `~/.maomao-localtool/localtool.db`（`database.ts:L36`）。
3. **系统/代理**：`/api/status` 健康检查、`/api/proxy` 反代（前端绕过 CORS）、`/api/jianying/send` 剪映对接（空实现）。
4. **静态文件**：`/files/*` 直接映射到 upload 目录，带路径穿越防护（`index.ts:L43-L95`）。

启动链：`main()`（`index.ts:L219`）→ `checkPortAvailable(18080)`（`index.ts:L25`，占用即 `exit(1)`）→ `getDb()` 初始化 → `http.createServer(handleRequest)`（`index.ts:L231`）。优雅退出 `SIGINT/SIGTERM` → `closeDb()` 落盘（`index.ts:L261-L271`）。

前端对接（已坐实）：`App.js` `Hr`/`vv` 硬编码 `127.0.0.1:18080`（`var-mapping`），模块1（11_）已标 P0 根因——未读 `config.js LOCAL_ENGINE.base`。

---

## ② 核心混淆字典（服务端，TS）

| 符号 | 行号 | 真身 | 说明 |
|------|------|------|------|
| `PORT` | index.ts:L21 | `18080` | 硬编码，与 App.js `Hr`/`vv` 同值（P0 根因侧） |
| `VERSION` | index.ts:L22 | `2.0.0-maomao-clone` | 版本戳 |
| `checkPortAvailable` | index.ts:L25 | 端口预检 | `EADDRINUSE` → exit(1) |
| `handleStaticFile` | index.ts:L43 | 静态服务 | 路径穿越防护（`index.ts:L51-L55`），404/403 |
| `handleRequest` | index.ts:L98 | 主路由 | 全路由表 L122-L208 |
| `getDb` | database.ts:L23 | DB 初始化 | sql.js WASM，`localtool.db` 不存在则新建 |
| `saveDb` | database.ts:L51 | 落盘 | `_db.export()` → `writeFileSync` |
| `getDataDir` | database.ts:L11 | 数据目录 | `MAOMAO_DATA_DIR` 或 `~/ .maomao-localtool` |
| `queryAll`/`queryOne`/`run` | database.ts:L82/L94/L100 | 查询封装 | better-sqlite3 风格兼容 |
| `upsertTask` | tasks.ts:L42 | 任务 upsert | sql.js 无 ON CONFLICT → DELETE+INSERT 模拟 |
| `handleStatus` | system.ts:L13 | 健康检查 | `ffmpeg:false`（硬编，非探测） |
| `handleProxy` | system.ts:L24 | 反代 | 15s 超时（`system.ts:L67/L126`） |
| `handleJianyingSend` | system.ts:L160 | 剪映对接 | **空实现**，仅记日志返回 ok |

---

## ③ 关键数据流（带 file:line）

### 流 A：前端文件上传落盘（模块2 `Xr`/`Zr` 服务端归宿）
- 前端 `Xr`(`App.js:L1802`) → `POST /api/files/upload`（`index.ts:L135`）→ `handleUpload`（`files.ts:L14`）。
- FormData（`files.ts:L25`）或 JSON（`files.ts:L21`）两形态；落地 `~/.maomao-localtool/uploads/<subfolder>/`（默认 `canvas`）。
- 缩略图：`App.js:ri`(L1856) → `GET /api/files/thumbnail`（`index.ts:L141`）→ `handleThumbnail`（`files.ts`）。门4（30_）已坐实 `files.ts:L137` `fs.copyFileSync` 伪复制（P2 #8）。

### 流 B：资源入库/删除/rescan（模块2 `Sv`/`wv`/`Tv`/`Ev` 服务端归宿）
- `Sv`(`App.js:L42838`) → `POST /api/resources/save`（`index.ts:L184`）→ `handleResourcesSave`（`resources.ts`）。
- `wv`(`App.js:L42857`) → `POST /api/resources/delete`（`index.ts:L190`）→ `handleResourcesDelete`（`resources.ts`）。**门4 已坐实 `resources.ts:L207` 单条删除无 `deleteFiles` → 仅删 DB（P2 #6）。**
- `Tv`(`App.js:L42866`) → `POST /api/resources/clear`（`index.ts:L193`）→ `handleResourcesClear`（`resources.ts`，带 `deleteFiles`）。
- `Ev`(`App.js:L42883`) → `POST /api/resources/rescan`（`index.ts:L196`）→ `handleResourcesRescan`（`resources.ts`）。**门4 已坐实 `resources.ts:L123` 仅清 `source='local-tool'`，extension 源不清理（P2 #7）。**

### 流 C：KV 配置读写的「删插模拟」边界
- `App.js:cachedGet`(`jr`,L1345) 等读 `GET /api/kv/get`（`index.ts:L127`）→ `handleKvGet`（`kv.ts:L9`）。
- `handleKvSet`（`kv.ts:L22`）因 sql.js **不支持 `ON CONFLICT`**，用 `DELETE + INSERT` 模拟 upsert（`kv.ts:L30-L31`）。⚠️ 边界：**删插非原子**，并发写可能丢更新（低概率，单线程 Node 下可接受，但多请求并发时窗口存在）。
- 与 `tasks.ts:upsertTask`（`tasks.ts:L46-L47`）同一模式——**全库 upsert 皆 DELETE+INSERT**，是 sql.js 限制下的统一 workaround。

### 流 D：代理与剪映（前端旁路通道）
- `POST /api/proxy`（`index.ts:L201`）→ `handleProxy`（`system.ts:L24`）：支持 `X-Proxy-Url` 头（FormData）或 JSON body 两形态（`system.ts:L28/L34`）；**15s 超时**（`system.ts:L67`），超时返 `504`（`system.ts:L94`）。
- `POST /api/jianying/send`（`index.ts:L206`）→ `handleJianyingSend`（`system.ts:L160`）：**空实现**——无论单文件还是 `items[]` 批量，仅 `console.log` 后返回 `ok`（`system.ts:L173/L189`）。即剪映对接**未实际落地**，属已知占位。

---

## ④ 存疑 Bug / 边界契约（对照 P0–P2）

### 边界契约（对外承诺）
1. 端口 **强制 18080**（`index.ts:L21`），与 App.js `Hr`/`vv` 双向硬编码；改端口需前后端同步（当前无配置桥接 → 模块1 P0）。
2. 静态文件 `/files/*` 受路径穿越防护（`index.ts:L51-L55`），越界返 403；不存在返 404。
3. 全路由 CORS 全开（`index.ts:L104-L106`，`Access-Control-Allow-Origin: *`）。
4. upsert 语义：tasks/resources/kv 均为「先删后插」，调用方不应依赖 `ON CONFLICT` 原子性。

### 存疑项
- **P-本1（空实现，非崩溃）**：`handleJianyingSend`（`system.ts:L160`）仅记日志，剪映集成未实现。前端若依赖此接口「已发送剪映」，会得到假成功。属设计占位，建议文档标注为「未实装」，避免误判为 bug。
- **P-本2（硬编码假值）**：`handleStatus` 返回 `ffmpeg:false`（`system.ts:L18`）为硬编码，未探测系统 ffmpeg。若前端据此禁功能，可能与实际环境不符；建议改为真实探测或移除该字段。
- **P-本3（并发 upsert 窗口）**：`kv.ts:L30-L31` / `tasks.ts:L46-L47` 的 DELETE+INSERT 非事务包装。单 Node 事件循环下同一请求内连续执行，但**多并发请求**交错时存在理论丢失窗口（sql.js 单连接，实际风险低）。建议用 `execMulti` 事务（`database.ts:L106`）包裹。
- **P-本4（proxy 超时短）**：`/api/proxy` 固定 15s（`system.ts:L67/L126`），大文件/慢上游易 504；且无自定义超时入参。建议透传 `timeout` 字段。

### 与已验证结论闭合
- 模块2（`Xr`/`Zr`/`Sv`/`wv`/`Tv`/`Ev`）的服务端归宿全部对应到 `index.ts` 路由表（L135-L197）✅。
- 门4（30_）P2 三项（#6 删除不删磁盘 / #7 rescan 不清理 extension / #8 缩略图伪复制）服务端证据锚点（`resources.ts:L207/L123`、`files.ts:L137`）均在本模块路由表覆盖范围内 ✅。
- 模块1 P0（18080 硬编码）在本模块服务端根（`index.ts:L21`）与 App.js `Hr`/`vv` 同源确认 ✅。
- 模块3 落盘 `ii()`（`App.js:L1888` → `Xr` L1802）最终写入本服务 `/api/files/upload`，链路完整 ✅。
