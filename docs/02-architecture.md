# 猫猫AI画布 · 架构主文件（Architecture）

> 事实锚点经 AI13 交叉验证实锤（2026-07-21），详见 `docs/AI13/交叉验证最终报告.md` 与 `docs/AI13/裁决表.md`。
> 本文只陈述"代码表达不了的 Why / 上下文 / 已裁决事实"，不抄代码逻辑（遵循"代码即文档"）。行号随构建漂移，主引用用函数名 / 真实 TS 路径。
> **外部开发者 / 下游 AI 请优先看 `docs/06-integration.md`（能力接口清单）。**

---

## 一、系统拓扑

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          猫猫画布 v1.3.5 (Chrome Extension MV3)                       │
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                     index.html → src/entry.js → src/App.js                    │  │
│  │                            (~4.2万行，★权威修改文件)                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │   画布    │  │ 资源面板  │  │ 多开管理  │  │ 模型/API配置  │  │  设置面板  │  │  │
│  │  │ ReactFlow│  │ 素材浏览  │  │ 多账号    │  │ 供应商选择   │  │  版本/同步 │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  └────────────┘  │  │
│  │                                                                               │  │
│  │  ┌──────────────────────── 存储层 (src/utils/storage/) ────────────────────┐  │  │
│  │  │  Q.getObject / Q.setObject → 三级降级: localTool KV → Chrome Storage    │  │  │
│  │  │  → localStorage / localforage                                            │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                               │  │
│  │  ┌──────────────────── 事件总线 ────────────────────────────────────────────┐  │  │
│  │  │  进程内: window CustomEvent (mutiwindow-task-completed / -rerun-task)    │  │  │
│  │  │  跨进程: chrome.runtime (resourceAdded ← background.ts)                  │  │  │
│  │  └──────────────────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌── src/background.ts ──────────────────────────────────────────────────────────┐  │
│  │  Service Worker: 右键采集 / 侧边栏 / 下载管理 / 资源注入 → resourceAdded       │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────┬────────────────────────┬──────────────┬───────────────────────┘
                        │                        │              │
          HTTP :18080    │          HTTP :9004    │              │ chrome.runtime
                        ▼                        ▼              ▼
┌───────────────────────────────┐ ┌───────────────────────────┐ ┌──────────────────┐
│  localTool (Node.js :18080)   │ │ apimart-gateway (:9004)   │ │ GAS 云同步(可选)  │
│  本地工具服务，替代闭源 Go 二进│ │ FastAPI → Lovart 中继      │ │ Google Apps      │
│  制                           │ │                           │ │ Script 跨设备同步 │
│                               │ │                           │ │                  │
│  ┌── KV 存储 ──────────────┐  │ │ ┌── AI 生成 ───────────┐  │ └──────────────────┘
│  │ /api/kv/get, /api/kv/set│  │ │ │ /v1/chat/completions│  │
│  │ SQLite WASM (sql.js)    │  │ │ │ /v1/images/gen       │  │
│  └─────────────────────────┘  │ │ │ /v1/video/*          │  │
│  ┌── 文件操作 ────────────┐   │ │ └─────────────────────┘  │
│  │ /api/files/upload/read │   │ │ ┌── 平台数据 ──────────┐  │
│  │ /thumbnail/mkdir/move  │   │ │ │ /public/platform/    │  │
│  │ /open/list             │   │ │ │   models             │  │
│  └────────────────────────┘   │ │ │   builtin             │  │
│  ┌── 任务管理 ────────────┐   │ │ │ /user/model-          │  │
│  │ /api/tasks CRUD        │   │ │ │   entitlements        │  │
│  └────────────────────────┘   │ │ └─────────────────────┘  │
│  ┌── 资源管理 ────────────┐   │ └───────────────────────────┘
│  │ /api/resources CRUD    │   │          │
│  └────────────────────────┘   │          ▼
│  ┌── 代理 ────────────────┐   │   Lovart 后台 (lgw.lovart.ai)
│  │ /api/proxy             │   │   生图/生视频/对话/模型权益
│  └────────────────────────┘   │
│  ┌── 平台(本地兜底) ──────┐   │
│  │ /plugin/manifest.json  │   │
│  │ /api/workflow-apps/    │   │
│  │   by-project/:id       │   │
│  └────────────────────────┘   │
│  ┌── 系统 ────────────────┐   │
│  │ /api/status            │   │
│  │ /api/jianying/send     │   │
│  └────────────────────────┘   │
│                               │
│  数据: ~/.maomao-localtool/    │
└───────────────────────────────┘
```

### 请求路由分发规则

| 请求类别 | 示例路径 | 目标 | 原因 |
|----------|----------|------|------|
| KV 存储 | `/api/kv/*` | **18080** | SQLite 本地持久化 |
| 文件操作 | `/api/files/*` | **18080** | 文件落盘/缩略图/浏览 |
| 任务 CRUD | `/api/tasks/*` | **18080** | 本地任务队列 |
| 资源管理 | `/api/resources/*` | **18080** | 本地资源索引 |
| HTTP 代理 | `/api/proxy` | **18080** | 转发到外部 API |
| 剪映发送 | `/api/jianying/send` | **18080** | 剪映集成 |
| 健康检查 | `/api/status` | **18080** | 前端连通性检测 |
| 版本检查 | `/plugin/manifest.json` | **18080** | 本地返回当前版本 |
| 工作流应用 | `/api/workflow-apps/by-project/*` | **18080** | 本地模式返回 null |
| 平台模型系列 | `/public/platform/models` | **9004** | Lovart 平台数据 |
| 内置收藏模型 | `/public/platform/builtin` | **9004** | Lovart 平台数据 |
| 用户模型权益 | `/user/model-entitlements` | **9004** | Lovart 用户权益 |
| AI 对话 | `/v1/chat/completions` | **9004** | OpenAI 兼容 → Lovart |
| AI 生图 | `/v1/images/generations` | **9004** | OpenAI 兼容 → Lovart |
| AI 生视频 | `/v1/video/*` | **9004** | OpenAI 兼容 → Lovart |

> **关键**：localTool 兼作 9004 网关请求的**代理跳板**——前端在 localTool 连通时把网关请求经 `POST /api/proxy` 转发，断开时直连 9004。localTool 是"文件服务 + 代理跳板 + 本地文件读取器"三重角色。

### 数据流

1. **AI 生成**：`Jn`@L30377 → 网关异步任务 → 轮询 `GET /v1/tasks/{id}` → 落盘 `uploads/tasks/` → `mutiwindow-task-completed` → rescan。
2. **资源采集**：`background.ts` 右键 → `resourceAdded`（跨进程）→ 前端下载 → `uploads/migrated/` → 入库。
3. **画布拖入**：`onDrop` → `ii({subfolder:'canvas/drop'})` → `POST /api/files/upload`。
4. **画布持久化**：`Q.saveCanvasState` → localforage + localTool KV，版本号防冲突。
5. **GAS 云同步**：`syncToCloud`(push，原 `ei`，App.js L41365) / `ti`(pull，App.js L41415) → 走 `CloudSyncEngine` 对象（约 L41312 起）→ POST Google Apps Script URL。
   > ⚠️ 同名遮蔽：App.js `Nv` 组件内另有一个 `ei`（L34671，是"打组"的 `Y.useCallback`），与 GAS push 无关。搜 `ei` 必须带行号。

---

## 二、技术选型 ADR（Why）

### ADR-1：为什么 localTool 是独立进程（:18080）
画布需要文件落盘、缩略图生成、资源 / 任务 / KV 持久化。这些能力在扩展 Service Worker / 页面沙箱里受限（文件路径、WASM SQLite、长驻服务），故拆出 Node/TS 本地服务，用原生 `node:http` + `sql.js`(WASM) SQLite，数据落在 `~/.maomao-localtool/`。

### ADR-2：为什么双 base（USE_LOCAL_ENGINE 开关）
- `USE_LOCAL_ENGINE=true`（默认）→ 文件走 `LOCAL_ENGINE.base` = `18080`（localTool）。
- `USE_LOCAL_ENGINE=false` → 文件走 `REMOTE_BASE` = `9004`（网关）。
- `Hr = localEngineBase()`@L1732 动态切换取 18080/9004；`vv`@L42808 字面值写死 18080。两处不一致是已知债务（`vv`/`U_` 不随开关变）。

### ADR-3：为什么事件总线用 mutiwindow-* CustomEvent + chrome.runtime 双轨
- 扩展内同窗口多面板（popup / sidePanel / 画布）需广播状态 → 用 `window` CustomEvent（`mutiwindow-` 前缀）。
- background（SW）与页面渲染进程属不同执行环境，CustomEvent 跨不过进程边界 → 资源落盘后用 `chrome.runtime` 消息 `resourceAdded` 跨进程通知前端。
- 两者职责不同：CustomEvent 限同窗口；chrome.runtime 限跨进程。**纯 CustomEvent 不能跨扩展窗口**（多窗口真实机制待查）。

### ADR-4：为什么生图有两套轮询机制
- 生图节点 `Jn`@L30377：前端直接轮询 `GET /v1/tasks/{id}`（L33005），落盘 18080。
- 网关 chat `/v1/chat/completions`：网关内同步轮询 Lovart 后 SSE 吐出。
- 两者最终都汇于 `GET /v1/tasks/{id}`(L873)，但入口与轮询主体不同（AI05-13 实锤）。

### ADR-5：为什么只有 V1 在跑（V2 已彻底移除）
- 项目最初反编译出闭源产品**本地模式 V1**（`src/App.js`，约 4.4 万行，★权威修改文件；原路径 `src/_engine/App.js` 已于 2026-07-22 扁平化到 `src/` 根，业务逻辑已解耦至 `src/config/`、`src/utils/`、`src/services/`、`src/components/`、`src/hooks/`、`src/contexts/` 子模块）。
- 曾启动 V2 重写，代码留在 `src/v2/`，但**已暂停 / 归档，且 `src/v2/` 目录已删除**，未上线。
- 任何新功能、接接口、下游 AI 开发都**默认基于 V1 的 `App.js` 与其事件 / 函数契约**；V2 不可作为事实来源。来历细节见 `docs/06-integration.md` §11、`docs/AI05/`。

### ADR-6：下游改码 / 接接口的硬纪律（来自 PROJECT_ORIGIN §4/§4.5/§8）
- **端口坑**：网关 `main.py`/README 写 `8000`，但画布 `config.js` 的 `ot`/`DEFAULT_ENDPOINT` 实际连 `127.0.0.1:9004`。启动必须 `--port 9004`，照搬 8000 画布全 404。
- **文件上传绝对路径**：`/api/files/upload` 返回的 `url`/`thumbnailUrl` 必须是 `http://127.0.0.1:18080/files/...` 绝对路径；扩展环境相对路径会解析成 `chrome-extension://...` → 破图刷日志。
- **V1 铁证 + 恢复基线**：前端唯一入口是 `src/entry.js`（经 `index.html` 引用，`main.tsx` 已删除）；V2 无运行路径。恢复 `App.js` 用 `git checkout -- src/App.js`，别复制任何备份。
- **混淆名引用带行号 + 语义名**；`U_`/`W_`/`G_`/`H_`/`B_` 是原版残留别改。
- **新增代码严禁短混淆名**：常量 `UPPER_SNAKE`、函数/变量 `camelCase`、类 `PascalCase`（下游 AI 写新逻辑必守）。
- **画布交互易踩坑**：Ctrl+拖拽框选、`minZoom:.05`、`.react-flow__pane{user-select:none}`、撤销/重做直连 `setNodes`/`setEdges`（不经 `onNodesChange`）。
- 完整版见 `docs/06-integration.md` §七。

### ADR-7：配置层集中在 `config.js`（不是 App.js）
`src/config.js` 导出（全 `UPPER_SNAKE`，改配置动这里；原路径 `src/_engine/config.js` 已扁平化）：
- `LOCAL_ENGINE`{host,port,base}（:18080）
- `ENDPOINTS` / `DEFAULT_ENDPOINT`（默认 `http://127.0.0.1:9004`，即网关 `ot`）
- `USE_LOCAL_ENGINE=true`（true 走 localTool；false 走网关 9004 文件路由）
- `AUTH_TOKEN_KEY='auth_token'`
- `GAS_CLOUD_SYNC_URL`（GAS 云同步部署地址）

> 注：`USE_LOCAL_ENGINE=false` 实测行为以 `true` 为准（HANDOFF2 §5 旧笔记已过时），接配置时以实际运行值为准。

---

## 三、已裁决事实段（直接写正确版，全部引自 AI13 最终报告）

### 3.1 画布持久化
画布状态保存走 `Q.saveCanvasState`(L1642) / `saveCanvasStateWithVersion`(L1650/L31728) **直接写 localforage**。**不存在 `canvas-state-change` 事件**（源码 grep 0 命中，旧文档误造）。

### 3.2 事件总线真实事件（已证伪项勿引用）
- `mutiwindow-task-completed`（L38481 等，detail `{taskId,nodeId,resultUrl,type,status,errorMsg}`）→ 触发 `Ev`@L42883 rescan 入库。
- `mutiwindow-update-task-meta`（L41032 → L43734，detail `{taskId,meta}`）→ `J_`@L41611 写 tasks 表。
- 跨进程 `resourceAdded`（background.ts L101 → App.js L43527，detail `{action,resource}`）。
- ❌ **已证伪（源码 0 命中，勿再引用）**：`canvas-state-change`、`mutiwindow-sync-local`（实为 `handleSyncLocal`@L44426 函数）。

### 3.3 资源落盘与 URL 补全
- 拖入 / `resourceAdded` 触发 `Zr`@L1827 下载落盘；`ii`@L1888 → `Xr`@L1802 → `POST /api/files/upload`。
- `toAbsoluteFileUrl` 真身 = `localTool/src/routes/resources.ts#L31`（App.js 内 0 命中；L43548 仅 `${Hr}${url}` 拼接）。用途：把资源 URL 补全为 `http://127.0.0.1:18080/...`，否则 extension 页面 `<img>` 破图。

### 3.4 3D 系统
- `Th` = Director3DNode，注册于 `director3dNode: Th`@L31141（**仍生效**，AI08 曾误标"待废弃"）。
- `$d` = DirectorShell（布局壳）@L24391。
- 两者同属 3D 两层封装（节点壳 + 布局壳）。

### 3.5 撤销重做
撤销 / 重做由**中央 store `r`@L21580** 接管（快照 / 入栈 `undoStack`@L21219 / 持久化 `Su`@L21178），**不经 ReactFlow onChange 直接 setNodes/setEdges**。无变化不入栈。

### 3.6 AI 生图流
- 生图主回调 `Jn`@L30377（App.js 内当前唯一 `Jn` 定义；`LogoIcon` 已解耦到 `src/components/common/LogoIcon.js`，不再有同名遮蔽）。
- 入参 `Jn(e, prompt, size, model)`；内部轮询 `GET /v1/tasks/{id}`（局部 `R`@L33005），completed → `images[].url[0]` → `ii` 落盘@L33049 → 发 `mutiwindow-task-completed`。
- 生视频走 `er`/`Qn`/`$n`（按节点 type 分派，见 `06-integration.md` §1.2），不走 `Jn`。

---

## 四、阅读导航

| 文档 | 角色 |
|------|------|
| `06-integration.md` | **对外能力接口清单（开发者/AI 首选）** |
| `01-concept.md` | 产品价值 / 用户故事 / 边界 |
| `03-database.md` | 数据模型（resources / tasks / kv） |
| `04-api/api-reference.md` | 接口契约 |
| `05-runbook.md` | 运维启动 |
| `glossary.md` | 同名遮蔽 / 已证伪项 / 黑话 |
