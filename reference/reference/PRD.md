# PRD · 一毛AI画布 完全复刻工程

> 文档状态：第 1 层 + 第 2 层全部完成，附录 A 契约已源码验证，待确认后进入执行阶段
> 方法：PRD 5 步法（步进式，Strangler 渐进替换，禁止 big-bang 重写）

## 1. 项目定位

- **做什么**：将「一毛AI画布」Chrome 扩展从反编译的 `_engine`（~4.6 万行混淆 JS）**完全复刻**为可读、可维护的 TypeScript 源码工程。包含前端扩展（React + React Flow 画布）和本地工具服务（Node/TS，端口 18080，替代闭源 Go 二进制）。方法为 Strangler 渐进替换，禁止 big-bang 重写。最终删除 `_engine/` 目录。
- **给谁用**：Kevin 本人，连接个人 API 网关 `127.0.0.1:9004`，作为 AI 图片/视频/文本工作流画布工具。
- **核心价值**：
  1. 统一 React 实例（消除双实例 #306 冲突）
  2. **27 种节点** + 五 Tab + 资源/账号/任务系统全部可读可维护
  3. 彻底摆脱 `0.1mao.cc` 依赖
  4. 本地工具服务开源可控（替代闭源 Go 二进制）
  5. **完全复刻**：功能 1:1 对齐原版，无回退到引擎黑盒

## 2. 核心模块（6 个，互不重叠）

| # | 模块 | 职责 | 依赖 |
|---|------|------|------|
| 0 | 本地工具服务 | Node/TS 服务，监听 18080，提供 KV/文件/tasks/resources/proxy/jianying 全部 API；数据落 SQLite + 磁盘；跨平台；替代闭源 Go 二进制 | 无（独立进程） |
| 1 | 运行时基座 | 入口 `main.tsx`、Vite 构建、React 实例统一、`manifest.json`、`background.ts` | 无（根） |
| 2 | API 通信层 | 统一收口两类后端：远程网关 `127.0.0.1:9004` + 本地 tool `127.0.0.1:18080` | 基座 |
| 3 | 状态与上下文层 | Zustand store；全局项目/资源/账号/任务状态；持久化走本地 tool KV | 基座、API 层 |
| 4 | 画布与框架层 | React Flow 画布、`nodeTypes` 注册表（27 种）、五 Tab 容器、拖拽/连线/视口/快捷键 | 基座、状态层 |
| 5 | 领域组件层 | 27 节点组件 + 5 UI 组件（ResourcePanel/AccountManager/FullscreenEditor/NodeContextMenu/Toast） | 状态层、API 层、画布层 |

依赖方向：模块 0 独立 → 基座 →（API 层、状态层）→ 画布层 → 领域组件层。无循环依赖。

## 3. 翻车点（3 个）

1. **localTool upload/tasks/resources 字段名未对齐** — 原版是 Go 二进制，form-data key 名、返回 JSON 字段名只要差一个字母，扩展调用就会静默失败（图片上传后拿不到 URL，节点显示空白）。无法从 strings 推断字段名，只能从 App.js 调用点的后续使用反推。
2. **Strangler 替换期间状态不同步** — 渐进替换期间，引擎的 React Flow 画布和新代码的状态层同时存在。如果状态层（模块 3）还没接管项目保存/恢复就替换画布层（模块 4），用户一刷新就丢数据。
3. **27 种节点中重度节点的迁移** — `director3dNode`（Three.js）、`faceMosaicNode`（WebGL shader）、`imageCompressNode`（Konva）的反编译代码 500-2000 行且高度耦合引擎内部状态，拆分不当容易引入渲染 bug 且极难定位。

## 4. 模块约束 & 跨模块约束

### 模块 0 · 本地工具服务
- 约束 1：实现前必须先从 App.js 调用点反推 upload/tasks/resources 的精确字段名，写成测试用例，再写实现。禁止凭猜测实现。
- 约束 2：KV 存储用 `better-sqlite3`，数据目录默认 `~/.yimao-localtool/`，可通过环境变量覆盖。
- 约束 3：完整实现附录 A 全部端点，数据落 SQLite + 磁盘目录，重启后数据不丢。
- 约束 4：跨平台（Mac arm64/intel + Windows），可 `node` 启动或打包为单文件可执行双击运行。

### 模块 1 · 运行时基座
- 约束 1：整个扩展只用一个 React 实例（项目 `node_modules` 的 React），禁止引擎 vendor React 与项目 React 并存。验证：控制台无 #306/#300，应用正常渲染。
- 约束 2：Strangler 替换期间，`_engine/` 保留在仓库中但逐步减少引用。每次替换必须保证 `npm run build` 通过 + 扩展可加载。
- 约束 3：`background.ts` 的右键菜单/资源采集逻辑已经是可读 TS，直接保留，不重写。

### 模块 2 · API 通信层
- 约束 1：所有请求（远程网关 + 本地 tool）必须经 `utils/api.ts` 单一出口，禁止散落 `fetch`。验证：`grep -r 'fetch.*9004\|fetch.*18080' src/ --include='*.ts' --include='*.tsx'` 仅命中 api.ts。
- 约束 2：`api.ts` 导出两类函数 — `gateway.*`（远程 9004）和 `localTool.*`（本地 18080），调用方不需要知道 URL 拼接细节。
- 约束 3：每个函数必须有 5s 超时 + 统一错误处理，禁止 Promise 永远 pending。
- 约束 4：请求失败有统一兜底（网关不可达→提示；本地 tool 不可达→降级到 `chrome.storage`）。验证：断网/tool 挂掉时应用不白屏。

### 模块 3 · 状态与上下文层
- 约束 1：用 Zustand（非 Context），因为 Zustand 支持 store 间组合且不触发不必要的重渲染。
- 约束 2：全局状态用统一 store 管理，持久化走本地 tool KV，禁止组件内散落 `localStorage` 写（一次性读除外）。验证：状态变更经单一入口、可追踪。
- 约束 3：状态层接管持久化**必须先于**画布层替换（硬性顺序约束，针对翻车点 #2）。

### 模块 4 · 画布与框架层
- 约束 1：`nodeTypes` 注册表必须完整映射 27 种节点到可读实现，禁止注册表与实现脱节。验证：27 种节点类型均可渲染、可拖拽。
- 约束 2：五 Tab 切换不卸载画布状态（节点/连线保留）。验证：切 Tab 再切回，画布内容不变。
- 约束 3：画布替换时，先确保状态层（模块 3）的项目保存/恢复已就绪，确保切换前后画布数据可序列化/反序列化。

### 模块 5 · 领域组件层
- 约束 1：每个节点/UI 组件只依赖状态层 + API 层，禁止直接 import 引擎内部变量。验证：组件可隔离单测。
- 约束 2：27 节点 + 5 UI 组件 100% 覆盖原引擎功能，无回退。验证：对照引擎功能清单逐项验证。
- 约束 3：每个节点迁移后必须与原版并排对比测试（同一画布数据，原版 vs 新版截图对比）。
- 约束 4：未迁移的节点使用 StubNode 占位，显示节点类型名，禁止注册表缺项导致渲染崩溃。

### 跨模块约束
- 跨 1：所有"存储/文件"能力必须经「本地 tool」或「API 通信层」，领域组件/状态层不得绕过。
- 跨 2：依赖方向严格单向（模块 0 独立 → 基座→API/状态→画布→领域），禁止反向或循环依赖。
- 跨 3：任何模块替换必须保持对外行为黑盒等价，每步有小提交可回归。
- 跨 4：最终交付物中不得包含 `_engine/` 目录。
- 跨 5（针对翻车点 #1）：模块 0 的每个端点实现前，必须先在 App.js 中找到该端点的**调用点 + 返回值使用方式**，据此确定精确的请求/响应字段契约，写入测试。
- 跨 6（针对翻车点 #2）：替换顺序硬性规定：0 → 1 → 2 → 3 → 4 → 5。模块 3 必须在模块 4 之前完成持久化能力。
- 跨 7（针对翻车点 #3）：模块 5 中节点迁移顺序为：纯 UI 节点优先 → 轻度 API 节点 → 重度渲染节点（Three.js/WebGL/Konva）最后。

## 5. 替换顺序总览

```
模块 0  本地工具服务（独立，可最先开始）
  ↓
模块 1  运行时基座（React 实例统一）
  ↓
模块 2  API 通信层（统一收口）
  ↓
模块 3  状态与上下文层（Zustand + 持久化）
  ↓
模块 4  画布与框架层（React Flow + 五 Tab）
  ↓
模块 5  领域组件层（27 节点 + 5 UI 组件）
  ↓
删除 _engine/ 目录
```

---

## 6. 模块 0 细化：本地工具服务

### 6.1 子模块拆解

| # | 子模块 | 职责 | 依赖 |
|---|--------|------|------|
| 0.1 | 契约反推 | 从 App.js 调用点反推每个端点的精确请求/响应字段，输出 CONTRACT.md + curl 测试用例 | 无（最先执行） |
| 0.2 | KV 存储 | SQLite 建表、`/api/kv/get`、`/api/kv/set`，value JSON 序列化 | 无 |
| 0.3 | 文件操作 | upload/read/thumbnail/mkdir/move/open/open-dir/list | 0.2 |
| 0.4 | 业务存储 | tasks（CRUD+batch+clear）、resources（CRUD+batch+clear），SQLite 表 | 0.2 |
| 0.5 | 系统/代理 | status/proxy/jianying/send | 无 |

### 6.1.1 数据模型（来自 App.js 解析器，非猜测）

**Task**（解析器 `G_`，`App.js:41199-41215`）：
```ts
interface Task {
  taskId?: string; nodeId?: string; prompt?: string
  resultUrl?: string; thumbnailUrl?: string; errorMsg?: string
  customOutputType?: string; channelName?: string; modelName?: string
  progress: number;          // 默认 0
  createdAt: number;         // 默认 0
  notFoundCount?: number;    // 默认 0
  customResultData?: unknown; customRawResponse?: unknown
  requestData?: unknown; responseData?: unknown; mediaMeta?: unknown
  [k: string]: unknown       // 允许扩展字段
}
```
- `W_` 列表（行 41198）中的字段在值为空字符串/null 时被删除，JSON 字符串字段自动 `JSON.parse`。

**Resource**（解析器 `yv`，`App.js:42436-42442`）：
```ts
interface Resource {
  id: string; url: string; type: string   // image | video | audio | text
  source?: string; folder?: string; name?: string
  pageUrl?: string; pageTitle?: string
  isFavorite: boolean;      // 原始 0/1/true → 归一 boolean
  timestamp: number         // 默认 0
}
```
- 空字符串字段（`pageUrl`/`pageTitle`/`source`/`folder`/`name`）被删除。

### 6.2 翻车点

1. **upload 的 form-data key 名未知** — App.js 有 3 处调用（行 1778/1798/19024），混淆后无法直接看出 field name。缓解：0.1 契约反推时读每处前后 30 行，追踪 FormData 构造。**已解决**：行 19022 明确 `i.append('file', t, n)` / `i.append('fileUrl', t)`。
2. **tasks/resources 的 body 结构未知** — 行 41227-41293（tasks）、42454-42495（resources）的 body 经过混淆。缓解：0.1 追踪变量从定义到 fetch 的完整数据流。**已解决**：行 41199 `G_` 解析器和行 42436 `yv` 解析器给出完整字段。
3. **proxy 的流式转发边界** — 是否支持 ReadableStream pipe？是否限制目标域名？缓解：0.1 检查 proxy 调用点是否处理流式响应。**已解决**：行 18936-18955 两种形态，FormData/Blob 透传 + JSON body，均需 pipe。
4. **`/api/status` 需同时满足两个客户端** — `Kr()`（行 1708）和 `Uc()`（行 18981）读不同字段。缓解：返回结构合并两方需求。

### 6.3 约束清单 & 验证标准

#### 0.1 契约反推
- 约束 1：对附录 A 每个有调用点的端点，读 App.js 对应行前后 30 行，提取 `{method, url, headers, body_fields, response_fields}`。
- 约束 2：契约写入 `localTool/CONTRACT.md`，每个端点附带 curl 示例。
- 约束 3：upload/tasks/resources/proxy 四个高风险端点额外提取变量数据流。
- 验证：CONTRACT.md 每个端点有 curl 命令，字段名与 App.js 调用点一致。

#### 0.2 KV 存储
- 约束 1：SQLite 表 `CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)`。
- 约束 2：`/api/kv/get` key 不存在返回 HTTP 200 + body `null`（非 404）。
- 约束 3：`/api/kv/set` body 字段名为 `key` 和 `value`。
- 验证：set → get 往返一致；重启服务后 get 仍返回值。

#### 0.3 文件操作
- 约束 1：upload 的 form-data 支持两种形态（`App.js:19022`）：
  - `file`(File/Blob) + 可选 `subfolder`（默认 `canvas`）+ 可选 `filename`
  - `fileUrl`(string) + 可选 `subfolder` + 可选 `filename`
  - 二选一，`file` 优先。
- 约束 2：upload 响应必须包含 `{url: string, thumbnailUrl?: string, path: string}`（`App.js:1784-1788` 解构 `s.url`/`s.thumbnailUrl`/`s.path`）。
- 约束 3：文件存储 `{DATA_DIR}/uploads/{subfolder}/{timestamp}-{filename}`。
- 约束 4：`/open` Mac 用 `open`、Windows 用 `explorer`，防 shell 注入。
- 约束 5：`/thumbnail` 接受 query `url` + 可选 `maxDim` + `quality`，返回 `{thumbnailUrl: string}`（`App.js:1838` `(await r.json())?.thumbnailUrl`），**不是**直接返回 JPEG 二进制。实现可用 sharp 生成缩略图存磁盘后返回 URL。
- 验证：`curl -F "file=@test.png;subfolder=canvas" localhost:18080/api/files/upload` 返回含 `url`/`path` 的 JSON；`curl localhost:18080/api/files/thumbnail?url=<上传返回的url>` 返回含 `thumbnailUrl` 的 JSON。

#### 0.4 业务存储
- 约束 1：tasks/resources 各用独立 SQLite 表，表结构以 0.1 契约为准。
- 约束 2：`batch-save` 接受数组，单次事务，部分失败不影响其他。
- 约束 3：`clear` 清空整表，`delete` 按条件删除。
- 约束 4：`GET /api/tasks` 和 `GET /api/resources` 支持分页查询参数（`App.js:41217-41219,42444-42446`）：
  - `page`/`pageSize`（默认 20）、`sortBy`（tasks 默认 `createdAt`，resources 默认 `timestamp`）、`sortDir`（默认 `DESC`）、`search`（模糊搜索）、`filters`（JSON 字符串，对象形式）
  - 返回 `{items: T[], total: number, page: number, pageSize: number, totalPages: number}`
- 约束 5：`POST /api/tasks/delete?id=` 用 query 参数传 id（`App.js:41267`）；`POST /api/tasks/batch-delete` body 为 `{ids: string[]}`，返回 `{deleted: number}`（`App.js:41282-41286`）。
- 约束 6：`POST /api/resources/clear` body 为 `{folder?: string, deleteFiles?: boolean}`（`App.js:42495-42503`），返回 `{deleted: number}`。
- 验证：save → get 往返一致；batch-save 5 条 → get 返回 5 条；`GET /api/tasks?page=1&pageSize=2` 返回 `{items: [...], total: 5, page: 1, pageSize: 2, totalPages: 3}`。

#### 0.5 系统/代理
- 约束 1：`/api/status` 返回结构需同时满足两个客户端（`App.js` 有两处调用）：
  - `Kr()`（行 1708，1s 超时）：以 HTTP 200 判连通，读 `response.ffmpeg`（boolean，可选）。
  - `Uc()`（行 18981，5s/15s 轮询）：读 `response.status === 'ok'`、`response.version`、`response.message`。
  - **综合返回**：`{status: "ok", version: "2.0.0-yimao-clone", message: "localTool service", ffmpeg: false, port: 18080}`
- 约束 2：`/api/proxy` 两种形态（`App.js:18936-18955`）：
  - 形态 ①（body 为 FormData/Blob）：读 `X-Proxy-Url`/`X-Proxy-Method`/`X-Proxy-Headers`（JSON 字符串）/`X-Proxy-Cookie` 请求头，body 透传。
  - 形态 ②（body 为 JSON）：`{url, method, headers, body, cookie}`。
  - 两种形态均支持流式 pipe，超时 15s（`Hc=15e3`）。
- 约束 3：`/api/jianying/send` 两种形态（`App.js:14,60`）：
  - 形态 ① 单个：body `{fileUrl, localPath, fileName}`，返回 `{status: 'ok', message}` 或 `{status: 'error', error}`。
  - 形态 ② 批量：body `{items: [{fileUrl, localPath}]}`，返回 `{status: 'ok', count, message}` 或 `{status: 'error', error}`。
  - 客户端判定 `n.status === 'ok'`（`App.js:26,70`），**必须返回 `status` 字段**。
- 约束 4：端口冲突检测 — 启动时若 18080 被占用，打印「18080 端口被占用，请先退出原版引擎或其他服务」并 `process.exit(1)`，不静默失败。
- 验证：proxy 形态 ② 能转发到 `http://httpbin.org/post` 并返回完整响应；jianying 形态 ① 返回 `{status:"ok", message:"..."}`。

### 6.4 跨模块约束支撑
- 跨 5（字段名先反推）→ 0.1 专门解决
- 跨 1（存储经 localTool）→ 0.2/0.4 提供
- 模块 0 约束 1（先反推再实现）→ 0.1 在 0.2-0.5 之前
- 模块 0 约束 2（better-sqlite3）→ 0.2/0.4 使用
- 模块 0 约束 4（跨平台）→ 0.3 用 `process.platform` 判断

---

## 7. 模块 1 细化：运行时基座

### 7.1 子模块拆解

| # | 子模块 | 职责 | 依赖 |
|---|--------|------|------|
| 1.1 | Vite 构建配置 | engine 独立 chunk、OOM 防护、background 单独入口 | 无 |
| 1.2 | React 实例统一 | 升级项目 React 到 19.2.7，消除 vendor React，window.React 桥接 | 1.1 |
| 1.3 | 入口接管 | 从 entry.js 逐步提取 CSS→端点→ErrorBoundary→渲染到可读代码 | 1.2 |
| 1.4 | manifest.json | 确认 MV3 配置正确，不需要改动则不碰 | 无 |

### 7.2 翻车点

1. **React 实例统一是"全有或全无"** — vendor 是 React 19.2.7，项目是 18，版本不一致 hooks 行为有差异。缓解：1.2 先升级到同版本再统一。
2. **entry.js 副作用不可分割** — 同时做 CSS 加载、端点引导、ErrorBoundary、渲染 4 件事，不能一次性替换。缓解：1.3 按 A→B→C→D 顺序逐步提取。
3. **Vite 构建 OOM** — vendor 1.74MB 压缩代码解析时内存爆炸。缓解：1.1 将 engine 归入独立 chunk，限制内存。

### 7.3 约束清单 & 验证标准

#### 1.1 Vite 构建配置
- 约束 1：`_engine/*` 归入独立 `engine.js` chunk，不与项目代码混合。
- 约束 2：`NODE_OPTIONS="--max-old-space-size=512"` 或等效配置，防 OOM。
- 约束 3：`background.ts` 单独入口。
- 验证：`npm run build` 512MB 内完成，exit 0，产物含 `engine-*.js` 独立 chunk。

#### 1.2 React 实例统一
- 约束 1：项目 React 升级到 19.2.7（与 vendor 同版本）。
- 约束 2：通过 `window.React` 桥接，让 engine 代码使用项目 React。
- 约束 3：每步验证控制台无 #306/#300。
- 验证：DevTools Console 搜索 `#306|#300` 零结果。

#### 1.3 入口接管（4 步顺序）
- 步骤 A：CSS 加载（3 个 CSS 从 entry.js 移到 main.tsx）
- 步骤 B：端点引导（entry.js 的 `b()` → `src/config.ts`）
- 步骤 C：ErrorBoundary（entry.js → `src/components/ErrorBoundary.tsx`）
- 步骤 D：渲染逻辑（entry.js 的 `createRoot().render()` → main.tsx）
- 约束 1：每步独立提交，build 通过 + 扩展可加载。
- 约束 2：步骤 D 完成后 `grep -r '_engine/entry' src/` 零结果，但 App.js 仍 lazy import。
- 验证：4 步完成后 UI 与原版完全一致。

#### 1.4 manifest.json
- 约束 1：确认 `side_panel`、`host_permissions`（`127.0.0.1:18080/*`、`127.0.0.1:9004/*`）。
- 约束 2：不需要改动则不碰。
- 验证：扩展加载后侧边栏可打开，无权限报错。

### 7.4 跨模块约束支撑
- 跨 3（每步可回归）→ 1.3 的 4 步顺序 + 每步 build 验证
- 跨 6（替换顺序第二）→ 1.2 React 统一后模块 2-5 才能安全使用项目 React
- 模块 1 约束 1（单 React 实例）→ 1.2 专门解决
- 模块 1 约束 2（_engine 保留但减少引用）→ 1.3 逐步提取
- 模块 1 约束 3（background.ts 保留）→ 1.4 确认不动

---

## 8. 模块 2 细化：API 通信层

### 8.1 子模块拆解

| # | 子模块 | 职责 | 依赖 |
|---|--------|------|------|
| 2.1 | 基础设施 | `fetchWithTimeout`、`getBaseUrl()`、`ApiError` 类型、鉴权 header 注入 | 无 |
| 2.2 | gateway 函数族 | chatCompletion/imageGeneration/imageEdit/videoGeneration/uploadImage/queryTask/getBalance — 对应附录 B | 2.1 |
| 2.3 | localTool 函数族 | getStatus/kvGet/kvSet/upload/tasks*/resources*/proxy/jianying — 对应附录 A | 2.1 |
| 2.4 | 降级与兜底 | localTool 不可达降级到 chrome.storage.local（仅读取）；网关不可达抛用户可读错误 | 2.3 |

### 8.2 翻车点

1. **引擎中 fetch 经混淆间接调用** — 可能不是字面 `fetch(` 而是变量间接调用，grep 验证会漏检。缓解：函数签名对齐优先于 grep 验证。
2. **异步任务轮询分散在各节点** — 图片/视频生成需轮询 `/v1/tasks/{id}`，原版轮询逻辑分散。缓解：2.2 提供 `pollTask()` 高级函数统一封装。
3. **localTool 降级到 chrome.storage 的 key 命名空间不同** — `active_api_endpoint` 在 sessionStorage 而非 chrome.storage。缓解：降级只降读取，不降写入。

### 8.3 约束清单 & 验证标准

#### 2.1 基础设施
- 约束 1：`fetchWithTimeout(url, options, timeoutMs=5000)` 用 AbortController 实现，超时抛 `ApiError('timeout')`。
- 约束 2：`getBaseUrl()` 从 `sessionStorage.active_api_endpoint` 读取，fallback 到 `http://127.0.0.1:9004`。
- 约束 3：`ApiError` 类含 `code`、`message`、`status` 字段。
- 验证：`new fetchWithTimeout('http://invalid', {}, 100)` 在 100ms 内 reject。

#### 2.2 gateway 函数族
- 约束 1：每个函数签名与附录 B 端点的请求/响应一一对应。如 `chatCompletion({model, messages, stream?})` → `POST /v1/chat/completions`。
- 约束 2：`pollTask(taskId, {intervalMs=2000, maxAttempts=60, onProgress?})` 封装轮询，返回 Promise<TaskResult>。
- 约束 3：鉴权 header 从 `localStorage.auth_token` 读取，注入 `Authorization: Bearer {token}`。
- 验证：`gateway.chatCompletion({model:'test',messages:[{role:'user',content:'hi'}]})` 发出正确请求（用 mock 验证）。

#### 2.3 localTool 函数族
- 约束 1：所有函数 base URL 固定 `http://127.0.0.1:18080`，不暴露给调用方。
- 约束 2：每个函数对应附录 A 一个端点，参数名以 0.1 契约反推结果为准。
- 约束 3：超时 5s（普通）/ 15s（upload/proxy）。
- 验证：`localTool.kvSet('test','hello')` → `localTool.kvGet('test')` 返回 `'hello'`。

#### 2.4 降级与兜底
- 约束 1：localTool 请求失败（网络错误）时，`kvGet` 降级到 `chrome.storage.local.get`，`kvSet` 不降级（避免数据漂移）。
- 约束 2：网关请求失败时，抛出 `ApiError` 含用户可读中文消息（如"API 网关不可达，请检查 9004 端口"）。
- 验证：停掉 localTool → `kvGet` 返回 chrome.storage 中的值；停掉网关 → 抛出可读错误，应用不白屏。

### 8.4 跨模块约束支撑
- 跨 1（存储经 localTool）→ 2.3 提供 localTool 函数
- 模块 2 约束 1（单一出口）→ 2.2/2.3 是唯一直接 fetch 的地方
- 模块 2 约束 2（gateway/localTool 分类）→ 2.2/2.3 命名空间隔离
- 模块 2 约束 3（5s 超时）→ 2.1 fetchWithTimeout
- 模块 2 约束 4（统一兜底）→ 2.4

---

## 9. 模块 3 细化：状态与上下文层

### 9.1 子模块拆解

| # | 子模块 | 职责 | 依赖 |
|---|--------|------|------|
| 3.1 | 项目 store | Zustand store：项目列表 CRUD、当前项目切换、项目重命名/删除 | 模块 2（localTool） |
| 3.2 | 画布状态 store | Zustand store：nodes/edges/viewport，与 React Flow 的 onNodesChange/onEdgesChange 绑定 | 无 |
| 3.3 | 资源 store | Zustand store：资源列表、收藏、筛选、分页 | 模块 2（localTool） |
| 3.4 | 账号 store | Zustand store：账号列表、Cookie 读写 | 无 |
| 3.5 | 任务 store | Zustand store：全局任务队列、任务状态轮询、进度追踪 | 模块 2（gateway） |
| 3.6 | UI store | Zustand store：activeTab、settingsTab、toasts、modals、loading 状态 | 无 |
| 3.7 | 持久化桥接 | 项目/资源/任务变更时自动写入 localTool KV；启动时从 localTool 读取恢复 | 3.1-3.5 |

### 9.2 翻车点

1. **画布状态序列化格式与引擎不兼容** — React Flow 的 nodes/edges 包含函数引用（如 `data.onGenerate`），JSON.stringify 会丢失。原版引擎有自定义序列化逻辑。缓解：3.7 持久化时过滤掉函数字段，恢复时从节点类型重新注入回调。
2. **store 间循环依赖** — 任务 store 需要更新画布节点数据（生成完成后写回 imageUrl），画布 store 不应依赖任务 store。缓解：用 Zustand 的 `subscribe` + `get` 单向监听，不用 import。
3. **启动时大量 KV 读取阻塞渲染** — 项目列表、资源列表、任务列表同时从 localTool 读取。缓解：3.7 用 `Promise.all` 并行读取，不串行。

### 9.3 约束清单 & 验证标准

#### 3.1 项目 store
- 约束 1：`projects: CanvasProject[]`、`currentProjectId: string | null`、`createProject(name)`、`switchProject(id)`、`renameProject(id, name)`、`deleteProject(id)`。
- 约束 2：所有变更通过 3.7 持久化桥接自动写入 localTool KV key `canvas-projects`。
- 验证：创建项目 → 刷新页面 → 项目列表仍在。

#### 3.2 画布状态 store
- 约束 1：`nodes`/`edges` 与 React Flow 的 `onNodesChange`/`onEdgesChange`/`onConnect` 绑定。
- 约束 2：`getCanvasSnapshot()` 返回可序列化的 `{nodes, edges, viewport}`，过滤掉函数字段。
- 约束 3：`loadCanvasSnapshot(data)` 恢复画布状态。
- 验证：添加 3 个节点 → 切 Tab → 切回 → 节点仍在。

#### 3.3 资源 store
- 约束 1：`resources: TransitResource[]`、`addResource(r)`、`removeResource(id)`、`toggleFavorite(id)`。
- 约束 2：持久化到 localTool KV key `transit-resources`。
- 验证：添加资源 → 重启服务 → 资源列表仍在。

#### 3.4 账号 store
- 约束 1：`accounts: Account[]`，持久化到 `localStorage`（与原版一致，账号数据不涉及 localTool）。
- 验证：添加账号 → 刷新 → 账号仍在。

#### 3.5 任务 store
- 约束 1：`tasks: GlobalTask[]`、`addTask(task)`、`updateTask(id, partial)`、`removeTask(id)`。
- 约束 2：持久化到 localTool `/api/tasks`（非 KV，是独立端点）。
- 约束 3：`pollTask(id)` 调用 `gateway.pollTask()`，完成后更新 store + 对应画布节点数据。
- 验证：提交生成任务 → 轮询完成 → 画布节点自动更新结果。

#### 3.6 UI store
- 约束 1：`activeTab: MainTab`、`settingsTab: string`、`toasts: ToastMessage[]`、`showToast(msg, type?, duration?)`。
- 验证：Tab 切换正常，Toast 显示/自动消失。

#### 3.7 持久化桥接
- 约束 1：项目/资源变更时 debounce 500ms 后写入 localTool。
- 约束 2：启动时 `Promise.all` 并行读取项目列表 + 资源列表 + 任务列表。
- 约束 3：localTool 不可达时，从 chrome.storage.local 降级读取（仅项目/资源，与 2.4 对齐）。
- 验证：正常流程读写一致；停 localTool → 从 chrome.storage 恢复。

### 9.4 跨模块约束支撑
- 跨 1（存储经 localTool）→ 3.7 桥接
- 跨 2（单向依赖）→ 3.2 用 subscribe 监听 3.5，不反向 import
- 跨 6（状态层先于画布层）→ 3.1-3.7 在模块 4 之前完成
- 模块 3 约束 1（Zustand）→ 全部用 `create()` 实现
- 模块 3 约束 2（禁止散落 localStorage 写）→ 3.4 除外（与原版对齐）
- 模块 3 约束 3（先于画布层）→ 硬性顺序

---

## 10. 模块 4 细化：画布与框架层

### 10.1 子模块拆解

| # | 子模块 | 职责 | 依赖 |
|---|--------|------|------|
| 4.1 | React Flow 画布容器 | `<Canvas>` 组件：ReactFlow + Controls + MiniMap + Background + Panel（节点添加菜单） | 模块 3（画布状态 store） |
| 4.2 | nodeTypes 注册表 | 27 种节点类型映射，未迁移的用 StubNode 占位 | 模块 5（节点组件） |
| 4.3 | 五 Tab 容器 | `<TabBar>` + 5 个 Tab 页面容器，Tab 切换不卸载画布 | 模块 3（UI store） |
| 4.4 | 节点添加菜单 | `<NodeAddMenu>` 按分类展示 27 种节点，点击添加到画布 | 4.2 |
| 4.5 | 右侧检查器 | 选中节点时右侧显示属性面板（原版有此功能） | 模块 3（画布状态 store） |
| 4.6 | 快捷键系统 | Delete 删除节点、Ctrl+Z 撤销、Ctrl+Y 重做、Ctrl+S 保存 | 4.1 |

### 10.2 翻车点

1. **React Flow 的 nodeTypes 必须在模块顶层定义** — React Flow 要求 nodeTypes 对象引用稳定，不能在组件内每次 render 重新创建。缓解：4.2 在模块顶层 `const nodeTypes = {...}` 定义。
2. **五 Tab 切换不卸载画布** — 用 `display:none`（visibility）而非条件渲染（v-if）。缓解：4.3 用 CSS `visible/invisible` 控制显示，所有 Tab 页面始终挂载。
3. **撤销/重做需要节点快照栈** — React Flow 不内置 undo/redo。缓解：4.6 用 `useRef` 维护快照栈，每次 onNodesChange/onEdgesChange 前保存快照。

### 10.3 约束清单 & 验证标准

#### 4.1 React Flow 画布容器
- 约束 1：`<ReactFlow>` 绑定模块 3.2 的 `nodes/edges/onNodesChange/onEdgesChange/onConnect`。
- 约束 2：深色主题（背景 #0d0c0c，节点边框 #333，选中边橙色）。
- 约束 3：Controls/MiniMap/Background 按原版位置和样式配置。
- 验证：画布可拖拽、缩放、添加节点、连线。

#### 4.2 nodeTypes 注册表
- 约束 1：27 种节点全部注册，key 与引擎 `lg` 对象完全一致。
- 约束 2：未迁移的节点映射到 `<StubNode>`，显示节点类型名。
- 约束 3：**命名映射警告** — 引擎 type 键与组件文件名不一定一致。已知：`GroupNode.tsx` 对应引擎键 **`group`**（非 `groupNode`），写错键渲染空白。注册前须逐个核对引擎 `lg` 对象。
- 验证：`Object.keys(nodeTypes).length === 27`。

#### 4.3 五 Tab 容器
- 约束 1：5 个 Tab 页面（canvas/transit/accounts/settings/appcenter）始终挂载，用 CSS `visible/invisible` 切换。
- 约束 2：Tab 栏样式与原版一致（圆角胶囊，选中橙色）。
- 验证：切 Tab 再切回，画布节点/连线不丢失。

#### 4.4 节点添加菜单
- 约束 1：按 5 个分类展示（核心/图片工具/视频工具/文本工具/其他），与原版节点菜单一致。
- 约束 2：点击节点类型后调用画布 store 的 `addNode(type)`。
- 验证：每个分类的节点都可点击添加。

#### 4.5 右侧检查器
- 约束 1：选中节点时右侧显示该节点的可编辑属性。
- 约束 2：属性变更直接写入画布 store 的对应节点 data。
- 验证：选中 promptNode → 右侧显示提示词文本 → 修改后节点更新。

#### 4.6 快捷键系统
- 约束 1：Delete 删除选中节点、Ctrl+Z 撤销、Ctrl+Y 重做、Ctrl+S 保存画布。
- 约束 2：撤销栈最多 50 步。
- 验证：添加节点 → Ctrl+Z → 节点消失 → Ctrl+Y → 节点恢复。

### 10.4 跨模块约束支撑
- 跨 2（单向依赖）→ 4.1 依赖 3.2，4.3 依赖 3.6
- 跨 3（每步可回归）→ 每个 Tab 页面可独立替换
- 模块 4 约束 1（27 种注册）→ 4.2
- 模块 4 约束 2（Tab 不卸载）→ 4.3
- 模块 4 约束 3（状态层先就绪）→ 依赖模块 3

---

## 11. 模块 5 细化：领域组件层

### 11.1 子模块拆解

按跨 7 的迁移顺序分 3 批：

**第 1 批：纯 UI 节点（无 API 调用，无外部依赖）**

| 节点 | 行数估算 | 说明 |
|------|---------|------|
| StickyNoteNode | ~50 | 便签，文本编辑 + 背景色 |
| TextConcatNode | ~100 | 文本拼接，多输入 → 单输出 |
| UrlToImageNode | ~60 | URL 输入 → 图片预览 |
| FileToUrlNode | ~50 | 文件选择 → Blob URL |
| GroupNode | ~80 | 编组容器，可编辑标签 |
| GridSplitNode | ~150 | 图片切分（纯 UI，不含实际切分逻辑） |
| GridMergeNode | ~200 | 图片拼图（纯 UI） |

**第 2 批：轻度 API 节点（调用 gateway/localTool，无重渲染依赖）**

| 节点 | 行数估算 | 说明 |
|------|---------|------|
| PromptNode | ~500 | 提示词 + 模型选择 + 图片生成 |
| TextNode | ~200 | 文本生成 |
| ImageNode | ~150 | 图片展示 + 下载 |
| VideoNode | ~250 | 视频生成 + 预览 |
| CustomNode | ~150 | 万能 HTTP 请求节点 |
| VideoExtractNode | ~100 | 视频帧提取 |
| CropNode | ~100 | 裁剪参数 |
| ImageBoxNode | ~150 | 多图盒子 |
| PanoramaNode | ~100 | 全景图预览 |
| Sd2VideoNode | ~200 | 图生视频 |
| DiscountVideoNode | ~200 | 折扣视频 |
| AudioNode | ~150 | 音频生成 |
| AudioPlayerNode | ~100 | 音频播放 |
| CompareNode | ~150 | 对比工具 |
| RhWebappNode | ~200 | AI 应用节点 |

**第 3 批：重度渲染节点（Three.js / WebGL / Konva）**

| 节点 | 行数估算 | 说明 |
|------|---------|------|
| Director3dNode | ~1500 | Three.js 3D 场景 |
| FaceMosaicNode | ~800 | WebGL shader 人脸打码 |
| ImageCompressNode | ~400 | Konva Canvas 图片压缩 |
| VideoToGifNode | ~300 | 视频 → GIF 转换 |

**UI 组件（5 个，已有参考实现）**

| 组件 | 行数估算 | 说明 |
|------|---------|------|
| ResourcePanel | ~400 | 资源面板（已有，需完善） |
| AccountManager | ~450 | 多开管理（已有，需完善） |
| FullscreenEditor | ~80 | 全屏文本编辑器（已有，基本完整） |
| NodeContextMenu | ~60 | 右键菜单（已有，基本完整） |
| Toast | ~80 | Toast 通知（已有，需改用 Zustand store） |

### 11.2 翻车点

1. **节点回调注入** — 原版通过 `onGenerate`/`onCrop`/`onAddImage` 等回调注入节点（App.js 行 36199 附近），每个节点类型有不同的回调集。新代码中这些回调需要从 store/action 层注入。缓解：每个节点的 `data` 中预留 `callbacks` 字段，画布层在渲染时注入。
2. **节点间数据传递** — 原版中上游节点输出（如 promptNode 生成的图片 URL）自动传递给下游节点。这是通过 React Flow 的 edge 连接 + 手动数据流实现的。缓解：在画布 store 中实现 `propagateData(sourceNodeId, outputData)` 函数，edge 连接变更时触发。
3. **重度节点的反编译代码高度耦合** — Director3dNode 1500 行中大量 Three.js 场景搭建代码与引擎内部状态交织。缓解：第 3 批节点最后迁移，迁移时先提取 Three.js/Konva 渲染逻辑为独立 hook，再组装节点组件。

### 11.3 约束清单 & 验证标准

#### 通用约束（所有节点）
- 约束 1：每个节点只 import `../types`、`../nodes/CustomHandle`、`../../store/*`、`../../utils/api`。禁止 import `_engine/*`。
- 约束 2：每个节点用 `React.memo` 包装。
- 约束 3：每个节点导出 `default`，在 4.2 注册表中以 `节点类型名: 组件` 映射。
- 验证：`grep -r '_engine' src/nodes/ src/components/` 零结果。

#### 第 1 批约束
- 约束 1：纯 UI 节点不调用任何 API 函数。
- 验证：添加到画布后可拖拽、可编辑属性、可连线。

#### 第 2 批约束
- 约束 1：API 调用统一走 `gateway.*` 或 `localTool.*`。
- 约束 2：异步操作（生成/轮询）有 loading 状态和错误处理。
- 验证：promptNode 输入提示词 → 点击生成 → 图片出现在节点中。

#### 第 3 批约束
- 约束 1：Three.js/Konva/WebGL 代码封装为独立 hook（如 `useThreeScene`、`useKonvaCanvas`）。
- 约束 2：渲染失败时显示错误占位，不白屏。
- 验证：director3dNode 添加到画布后显示 3D 场景（或错误占位）。

#### UI 组件约束
- 约束 1：Toast 改用模块 3.6 的 UI store。
- 约束 2：ResourcePanel 改用模块 3.3 的资源 store。
- 约束 3：AccountManager 保持 localStorage 持久化（与原版对齐）。
- 验证：Toast 从 Zustand store 读取；资源面板与 store 双向同步。

### 11.4 跨模块约束支撑
- 跨 1（存储经 localTool）→ 节点通过 store 间接使用
- 跨 2（单向依赖）→ 节点只依赖 store + api
- 跨 7（迁移顺序）→ 3 批顺序：纯 UI → 轻度 API → 重度渲染
- 模块 5 约束 1（不 import 引擎）→ 通用约束 1
- 模块 5 约束 2（100% 覆盖）→ 27 节点 + 5 UI 全部实现
- 模块 5 约束 3（并排对比测试）→ 每批完成后与原版截图对比
- 模块 5 约束 4（StubNode 占位）→ 未迁移前用占位

---

## 12. PRD 完成声明

第 1 层（全局骨架）+ 第 2 层（6 个模块逐个细化）全部完成。

递归停止判断：
- 模块 0：5 个子模块，每个 ≤5 条约束，每条有验证标准 → 停止 ✅
- 模块 1：4 个子模块，每个 ≤4 条约束，每条有验证标准 → 停止 ✅
- 模块 2：4 个子模块，每个 ≤4 条约束，每条有验证标准 → 停止 ✅
- 模块 3：7 个子模块，每个 ≤4 条约束，每条有验证标准 → 停止 ✅
- 模块 4：6 个子模块，每个 ≤4 条约束，每条有验证标准 → 停止 ✅
- 模块 5：3 批 + 通用约束，每条有验证标准 → 停止 ✅

**PRD 已完成。**

### 技术决策记录

| 决策 | 选择 | 备选 | 理由 |
|------|------|------|------|
| localTool 存储 | `better-sqlite3` | `lowdb` | 原版二进制用 SQLite（strings 实证）；tasks/resources 有分页/排序/筛选，SQL 天然适配；WAL 模式防崩溃；lowdb 全量加载 JSON + 手动串行化并发写 |
| 前端状态管理 | Zustand | Context 分片 | 画布状态（nodes/edges）可能几百节点，Context 任一字段变更触发所有消费者重渲染；Zustand selector 天然解决；~2KB 依赖 |
| localTool HTTP 框架 | 原生 `http` | Express | 零依赖，端点数量有限（~20 个），不需要路由框架；与原版 Go `net/http` 风格对齐 |

---

## 附录 A · 本地引擎（18080）API 契约（反推 + 源码验证）

> 来源：反编译 `App.js` 调用点，每个字段均经源码交叉验证。**本契约同时作为自研 localTool 服务的实现与验收标准。** 闭源二进制本体路径（仅作参考，不再依赖）：
> `/Users/kevin/Nutstore Files/我的坚果云/chrome插件/04画布插件/一毛AI画布引擎Mac端Arm版`
> （Mach-O arm64 闭源，约 11MB，双击运行后监听 18080，状态栏常驻）

### A.1 KV 存储
| 端点 | 方法 | 请求 | 响应 | 调用点 |
|------|------|------|------|--------|
| `/api/kv/set` | POST | `{key: string, value: string}`（value 已由客户端 JSON.stringify） | `{ok: boolean}` | `App.js:19034` |
| `/api/kv/get?key=` | GET | query: `key` | value（JSON 反序列化后）；不存在返回 `null` | `App.js:19049` |
| JS 桥 `window.localTool.getKV/saveKV` | — | 同语义 | 同语义 | `decompiled:1266-1298` |

### A.2 文件操作
| 端点 | 方法 | 请求 | 响应 | 调用点 |
|------|------|------|------|--------|
| `/api/files/upload` | POST | FormData: `file`(File/Blob) 或 `fileUrl`(string) 二选一 + `subfolder`(默认 `canvas`) + `filename`(可选) | `{url: string, thumbnailUrl?: string, path: string}` | `App.js:1778,1798,19022-19024` |
| `/api/files/open?subfolder=` | GET | query: `subfolder` | `{path: string}` | `App.js:328` |
| `/api/files/open-dir?filepath=` | GET | query: `filepath`（URL pathname 去 `/files/` 前缀） | — | `App.js:589,685` |
| `/api/files/read?path=` | GET | query: `path`；支持 `X-Proxy-*` 头做代理读 | 文件内容 | `App.js:18928` |
| `/api/files/thumbnail?url=&maxDim=&quality=` | GET | query: `url`(必填) + `maxDim`(可选) + `quality`(可选) | `{thumbnailUrl: string}` | `App.js:1837-1838` |
| `/api/files/mkdir` | POST | `{folder: string}` | — | `App.js:19061-19069` |
| `/api/files/move` | POST | `{src: string, dst: string}` | — | `App.js:19076-19084` |
| `/api/files/list` | GET | — | 文件列表 | strings 发现（JS 未直接调用，选做） |

### A.3 业务存储 — tasks（`App.js:41197` `U_`）
| 端点 | 方法 | 请求 | 响应 | 调用点 |
|------|------|------|------|--------|
| `/api/tasks` | GET | query: `page`/`pageSize`(默认20)/`sortBy`(默认`createdAt`)/`sortDir`(默认`DESC`)/`search`/`filters`(JSON字符串) | `{items: Task[], total, page, pageSize, totalPages}` | `App.js:41227-41236` |
| `/api/tasks/save` | POST | `Task` 对象 | `{ok: boolean}` | `App.js:41240-41246` |
| `/api/tasks/batch-save` | POST | `Task[]` | `{ok: boolean}` | `App.js:41254-41260` |
| `/api/tasks/delete?id=` | POST | query: `id` | — | `App.js:41267-41269` |
| `/api/tasks/batch-delete` | POST | `{ids: string[]}` | `{deleted: number}` | `App.js:41277-41286` |
| `/api/tasks/clear` | POST | `{statuses: string[]}` | `{deleted: number}` | `App.js:41293-41303` |

### A.4 业务存储 — resources（`App.js:42435` `vv`）
| 端点 | 方法 | 请求 | 响应 | 调用点 |
|------|------|------|------|--------|
| `/api/resources` | GET | query: `page`/`pageSize`(默认20)/`sortBy`(默认`timestamp`)/`sortDir`(默认`DESC`)/`search`/`filters`(JSON字符串) | `{items: Resource[], total, page, pageSize, totalPages}` | `App.js:42454-42463` |
| `/api/resources/save` | POST | `Resource` 对象 | `{ok: boolean}` | `App.js:42467-42473` |
| `/api/resources/batch-save` | POST | `Resource[]` | `{ok: boolean}` | strings 发现（建议实现） |
| `/api/resources/delete?id=` | POST | query: `id` | — | `App.js:42486-42488` |
| `/api/resources/clear` | POST | `{folder?: string, deleteFiles?: boolean}` | `{deleted: number}` | `App.js:42495-42505` |

### A.5 系统 / 代理 / 外部
| 端点 | 方法 | 请求 | 响应 | 调用点 |
|------|------|------|------|--------|
| `/api/status` | GET | — | `{status: "ok", version, message, ffmpeg?: boolean, port}` | `App.js:1708,18981` |
| `/api/proxy` | POST | **形态①** FormData/Blob body + `X-Proxy-Url`/`X-Proxy-Method`/`X-Proxy-Headers`(JSON)/`X-Proxy-Cookie` 头；**形态②** JSON `{url, method, headers, body, cookie}` | 透传目标响应 | `App.js:18936-18955` |
| `/api/jianying/send` | POST | **形态①** 单个 `{fileUrl, localPath, fileName}`；**形态②** 批量 `{items: [{fileUrl, localPath}]}` | `{status: 'ok', message}` 或 `{status: 'ok', count, message}` 或 `{status: 'error', error}` | `App.js:14,60` |

### A.6 客户端调用形态
- `useLocalTool` hook（`App.js:19020-19089`）：暴露 `uploadFile / saveKV / getKV / createFolder / moveFile / status`，内部 `fetch http://127.0.0.1:18080`。
- `window.localTool` JS 桥（`decompiled:1266-1298`）：`getKV/saveKV/setObject/remove/isAvailable`，`status.isConnected` 标记连通。
- 超时：`Vc=5e3`（5s）、`Hc=15e3`（15s）（`App.js:18972-18973`）。
- 连通检测节流：`Gr=3e3`（3s，`App.js:1701`）。
- 连通失败文案：`无法连接到 http://127.0.0.1:18080，请确保 localTool Service 正在运行`（`App.js:19056`）。

### A.7 自研服务验收项（重写后逐条自测）
1. `GET /api/status` 返回 `{status:"ok", version, message, ffmpeg, port}`，HTTP 200。
2. `/api/kv/set` + `/api/kv/get` 往返持久化（重启服务后仍在）。
3. `/api/files/upload` FormData `file` 字段 + `subfolder` → 返回 `{url, path, thumbnailUrl?}`。
4. `/api/files/upload` FormData `fileUrl` 字段 → 返回 `{url, path}`。
5. `/api/files/thumbnail?url=<上传url>` → 返回 `{thumbnailUrl}`。
6. `/api/tasks` 分页查询返回 `{items, total, page, pageSize, totalPages}`。
7. `/api/resources` 分页查询同上结构。
8. `/api/proxy` 形态 ② 能转发到 `http://httpbin.org/post` 并返回完整响应。
9. `/api/jianying/send` 形态 ① 返回 `{status:"ok", message}`。
10. 端口冲突检测：18080 被占用时退出并提示。
11. 跨平台：Mac(arm64/intel) + Windows 同一份 Node 服务均可运行。

### A.8 strings 交叉验证（三平台二进制，实测 2026-07-18）
对三个官方二进制跑 `strings | grep '/api/'`，**结果完全一致**，证明跨平台契约统一。提取端点全集：
```
/api/status
/api/kv/set  /api/kv/get
/api/files/list  /api/files/open  /api/files/open-dir  /api/files/upload
/api/files/mkdir  /api/files/move  /api/files/thumbnail
/api/tasks  /api/tasks/save  /api/tasks/batch-save  /api/tasks/delete  /api/tasks/batch-delete  /api/tasks/clear
/api/resources  /api/resources/save  /api/resources/batch-save  /api/resources/delete  /api/resources/clear
/api/jianying/send  /api/proxy  /api/list  /api/sync/from-kv
```
**差异 & 结论：**
- 三平台 100% 一致 → 自研单份 Node 服务即可覆盖 Mac/Win。
- 二进制特征 `MarshalJSON/MarshalText` → 证实为 **Go 编写**（印证反编译原生二进制极难，按契约重写是正确路径）。
- 二进制特征 `sql` → 疑似用 **SQLite** 存数据，自研用 `better-sqlite3` 对齐。
- `/api/files/read` 在 strings 未直接出现，但 JS 调用点 `App.js:18928` 明确请求 → 重写**必须实现**。
- 额外端点（JS 未直接调用，自研可先不实现或选做）：`/api/files/list`、`/api/list`、`/api/sync/from-kv`。

---

## 附录 B · API 网关（9004）说明

> 路径：`apimart-gateway/`（Python FastAPI，已包含在仓库中）
> 启动：`cd apimart-gateway && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 9004`

### B.1 定位

APIMart 兼容中转站，将 OpenAI 风格外向接口翻译成 Lovart OpenAPI 调用。扩展的远程网关请求全部走这里。

### B.2 端点映射

| 外向（扩展调用） | 内部（Lovart） |
|---|---|
| `POST /v1/chat/completions` | 文本生成（同步/流式） |
| `POST /v1/images/generations` | 图片生成（异步 task） |
| `POST /v1/images/edits` | 图生图（multipart） |
| `POST /v1/videos/generations` | 视频生成（异步 task） |
| `POST /v1/music/generations` | 音乐生成（异步 task） |
| `POST /v1/audio/generations` | 音乐生成（别名） |
| `GET /v1/tasks/{id}` | 任务结果查询 |
| `POST /v1/uploads/images` | 图片上传 → CDN URL |
| `GET /v1/balance` | 余额查询（占位） |

### B.3 已知限制
- 任务库为内存字典，重启即丢
- chat 无状态，不保留多轮上下文
- 流式 chat 为最小实现（生成完一次性吐完整内容 + `[DONE]`）
- `/v1/audio/speech` 和 `/v1/audio/transcriptions` 返回 501