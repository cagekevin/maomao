# 一毛AI画布 · 对外能力接口文档（Integration Guide）

> 事实全部来自 `docs/AI13/交叉验证最终报告.md` + `docs/AI05/*` 深审（13 个 AI 交叉验证实锤）。
> 本文是给**外部开发者 / 下游 AI agent** 看的：告诉你在这个系统上**能接什么、调哪个真身、传什么、收什么、踩什么红线**。
> 行号随构建漂移，引用以**函数真身 / 真实 TS 路径**为主，行号仅附注。改码前重新 grep 确认当前行号。

---

## 〇、一句话能力地图

| 你想做什么 | 接入口 | 机制 |
|-----------|--------|------|
| 让画布生一张图 | `Jn(e, prompt, size, model)` @L32490 | 前端派发网关异步任务 |
| 让画布生视频 | `er` / `Qn` / `$n`（按类型） | 复用生图底层 |
| 重跑一个已有任务 | 发 `mutiwindow-rerun-task` 事件 | 纯前端 CustomEvent |
| 生图完成后刷新资源 | 监听 `mutiwindow-task-completed` | 纯前端 CustomEvent |
| 写任务元数据 | 发 `mutiwindow-update-task-meta` | 纯前端 CustomEvent |
| 从网页采集资源 | 用浏览器扩展右键菜单（background 已内置） | chrome.runtime 跨进程 |
| 资源落盘 / 入库 | `ii`@L1888 / `Sv`@L42838 / `Ev`@L42883 | HTTP → localTool :18080 |
| 云同步配置 | `ei`(push) / `ti`(pull) @L43950/L43974 | POST GAS |
| 和 AI 直接对话 | `POST /v1/chat/completions`（网关 :9004） | SSE |

---

## 〇·五、接缝总图（跨模块通道一览）

> 所有通道均经 AI13 交叉验证实锤。改任一模块前，先在此确认"它和谁说话、走什么通道、什么格式"。
> 行号随构建漂移，通道本身（协议/函数真身）稳定；引用带真身名，动码前 grep 复核。

### 通道类型一览

| # | 通道 | 协议 / 机制 | 发起方 → 接收方 | 关键端点 / 事件 / 函数 | 备注 |
|---|------|------------|----------------|----------------------|------|
| 1 | 前端 ↔ localTool | HTTP :18080 | 前端 `useLocalTool` hook → localTool `node:http` | `/api/files/*` `/api/kv/*` `/api/resources/*` `/api/tasks/*` `/api/status` | 文件落盘 + 持久化主通道 |
| 2 | 前端 ↔ 网关 | HTTP :9004 | 前端 `Jn`/`lr`/`zc` → 网关 FastAPI | `/v1/images\|videos/generations` `/v1/tasks/{id}` `/v1/chat/completions` | 生图/视频/chat 主通道；网关 ↔ Lovart 外部依赖 |
| 3 | 前端 ↔ 网关（代理跳板） | HTTP `POST /api/proxy` @L19016 | 前端 `zc`（localTool 连通时）→ localTool 转发 → 9004 | localTool 兼作 9004 请求的代理跳板（AI12 实锤）；断开时 `zc` 直连 9004 | localTool = 文件服务 + 代理跳板 + 本地文件读取器 三重角色 |
| 4 | background ↔ 前端 | `chrome.runtime` 跨进程消息 | `background.ts`(SW) → App.js | `resourceAdded`（detail `{action,resource:{id,url,type,pageUrl,pageTitle,source:'extension'}}`） | **非 CustomEvent**，跨进程唯一通道；纯 CustomEvent 跨不过进程边界 |
| 5 | 前端进程内广播 | `window` CustomEvent（`mutiwindow-*` 前缀） | 同窗口多面板（popup/sidePanel/画布）互发 | `mutiwindow-task-completed` / `mutiwindow-update-task-meta` / `mutiwindow-rerun-task` | 限同窗口；**不能跨扩展窗口**（多窗口机制 AI13 标记 ➖ 待查） |
| 6 | 前端 ↔ GAS 云同步 | HTTP POST（Google Apps Script） | `ei`(push)@L43950 / `ti`(pull)@L43974（`CloudSyncEngine`）→ GAS 部署 | URL 在 `config.js` `GAS_CLOUD_SYNC_URL` | 仅配置/资源元数据，非实时协同；pull 后 1s reload |
| 7 | 画布落盘（资源/生成结果） | HTTP :18080 | `ii`@L1888 / `Xr`@L1802 / `Zr`@L1827 → `POST /api/files/upload` | 结果经 `toAbsoluteFileUrl`(`localTool/resources.ts#L31`) 补 `http://127.0.0.1:18080/...` | 拒绝 CDN 直链（红线） |
| 8 | 生成结果回填 → 资源刷新 | 通道 5 + 通道 1 | `mutiwindow-task-completed` → `Ev`@L42883 `POST /api/resources/rescan` → `xv`@L42821 `GET /api/resources` | 闭环：生图落盘 → 广播 → rescan → 面板刷新 | 节流在 L42910–42914 |
| 9 | 配置层 | 模块内读取 | `src/_engine/config.js`（`UPPER_SNAKE`）→ App.js / 网关 | `USE_LOCAL_ENGINE` / `LOCAL_ENGINE.base`(18080) / `DEFAULT_ENDPOINT`(9004) | 改配置动 config.js，不是 App.js |

### 通道边界铁律（接手必守）
- **跨进程只用 `chrome.runtime`**（`resourceAdded`）；同窗口广播只用 `mutiwindow-*`；别指望 `mutiwindow-*` 跨窗口。
- **文件落盘只走 localTool :18080**，URL 必须绝对路径；网关 :9004 无 `/api/files/upload`（`USE_LOCAL_ENGINE=false` 时上传全失败，当前默认 true 不触发）。
- **网关请求默认 9004**，启动必须 `--port 9004`（README 写 8000 是错的）。
- **代理跳板**：前端↔网关在 localTool 连通时经 `/api/proxy`，这是本地网络隔离穿透点，改 `zc` 封装须保留降级直连逻辑。

---

## 一、AI 生图 / 生视频能力

### 1.1 生图主入口 `Jn`
- **真身**：`Jn` = imageNode 生图主回调，`let Jn = Y.useCallback(async (e, r, o, ...) => {})` @L32490。
- **⚠️ 同名遮蔽**：模块级 `Jn`@L89 = `LogoIcon` 组件，**不是**生图回调。引用必须带 L32490。
- **入参形状**（AI05-04 实锤）：
  ```
  Jn(e, prompt, size, model)
    e      : 上游节点/上下文数据
    prompt : 提示词（内部经 g() 清洗 ≤6000 字）
    size   : 尺寸
    model  : 模型名
  ```
- **内部链路**：收集上下文 → `POST /v1/images|videos/generations`（网关）→ 拿到 `task_id` → 前端异步轮询 `GET /v1/tasks/{id}`（≥3s，429 退避 15s，15min deadline）→ `completed` 取 `images[].url[0]`（**数组第 0 个**）→ `ii()` 落盘 `uploads/tasks/` → 回填 `data.imageUrl` → 发 `mutiwindow-task-completed`。

### 1.2 生视频 / 其他类型（按节点 type 分派）
AI05-18 实锤的分派表（来自 `mutiwindow-rerun-task` 处理分支）：
```
text         → tr(nodeId, prompt, autoSplit, modelName)
video        → er(nodeId, prompt, aspectRatio, size, modelName, seconds)
sd2Video     → Qn(nodeId, prompt, size, modelName, seconds)
discountVideo→ $n(nodeId, prompt, size, modelName, seconds, resolution)
custom       → _r(nodeId)           // 取 data.config 重跑 customNode
rhWebapp     → 发 vs 事件（专用重跑）
```
> **结论**：生视频不走 `Jn`，走 `er`/`Qn`/`$n`。想在画布加"对话生视频"，复用这些分派函数，不要自己重写网关调用。

### 1.3 红线
- 结果必须**落盘 18080**（严禁 CDN 直链，代码在 L33047 已处理）。
- `pending_confirmation` 卡死：网关 `AUTO_CONFIRM=false` 时节点置 `await_confirm`，需手动 confirm（`POST /v1/tasks/{id}/confirm`）。
- 网关任务库**内存态**，重启即丢（轮询 404 为无害噪音）。

---

## 二、事件总线契约（CustomEvent / 跨进程）

### 2.1 真实事件全集（AI05-17 实锤，可安全使用）
| 事件 | 发送 | 监听 | 机制 | detail / payload |
|------|------|------|------|------------------|
| `mutiwindow-task-completed` | L38481/L43640/L43676/L43697/L44406 | L31426 | 前端 CustomEvent | `{taskId, nodeId, resultUrl, type, status, errorMsg}`；L44406 额外 `thumbnailUrl, customOutputType`。**仅 `nodeId` 存在时发** |
| `mutiwindow-update-task-meta` | L41032 | L43734 | 前端 CustomEvent | `{taskId, meta}`（meta=width/duration 等媒体元数据）|
| `mutiwindow-rerun-task` | L44343 | L36618 | 前端 CustomEvent | `{task: <task对象>}`（task 含 nodeId；无 nodeId 早退）|
| `mutiwindow-nodes` | L36139/L16369 | L35918 等 | 前端 CustomEvent | 剪贴板节点 |
| `mutiwindow-images` | L16369/L16497 | L36001 等 | 前端 CustomEvent | 剪贴板图片 |
| `import-project` / `export-project` | L44706/L44712 | L38534 | 前端 CustomEvent | 无 detail |
| `mutiwindow-open-builtin-settings` / `open-schedule-settings` | L4922 等 | L43774 | 前端 CustomEvent | — |
| `open-shortcuts-modal` | L37359 | — | 前端 CustomEvent | — |
| `resourceAdded` | background.ts L101 | App.js L43527 | **chrome.runtime 跨进程** | `{action:'resourceAdded', resource:{id,url,type,pageUrl,pageTitle,source:'extension',timestamp}}` |

### 2.2 ❌ 已证伪（源码 0 命中，严禁使用）
- `canvas-state-change` —— 画布持久化走 `Q.saveCanvasState`@L1642，无此事件。
- `mutiwindow-sync-local` —— 实为 `handleSyncLocal`@L44426 函数，非事件。

### 2.3 跨进程边界（极其重要）
- **background 只发 `resourceAdded` 一条跨进程消息**（chrome.runtime，SW→前端）。
- 其余 `mutiwindow-*` 全是**同 window 纯 CustomEvent**，**不能跨扩展窗口**广播。
- ⚠️ 多窗口真实跨窗口机制 AI13 标记为待查（17-5）：不要把 `mutiwindow-*` 当跨窗口同步用，跨窗口请走 storage 事件或 SW 中转。

---

## 三、节点与画布能力

### 3.1 可创建节点类型（nodeTypes，AI05-05 实锤）
`promptNode` · `imageNode`(li) · `imageBoxNode` · `videoNode` · `sd2VideoNode` · `discountVideoNode` · `gridSplitNode`(Lc) · `gridMergeNode`(To) · `cropNode` · `urlToImageNode`(Wc) · `fileToUrlNode` · `panoramaNode`(Jc/Yc) · `videoExtractNode`(Ns) · `textNode`(Qa) · `audioNode`(ps) · `textConcatNode`(Rc) · `Director3DNode`(Th)。
- 节点 data 字段：`data.imageUrl` / `videoUrl` / `audioUrl` / `text` / `prompt` / `label` / `resultUrl`。
- 拖放建节点：`onDrop`(Lr@L36243) 支持 `application/x-yimao-template`（批量导入）/ `application/x-mutiwindow-task`（创建节点）/ `dataTransfer.files`（落盘）。

### 3.2 3D 导演台
- `$d`=DirectorShell@L24391（布局壳）；`Th`=Director3DNode（节点壳，注册 L31141，**仍生效**）。
- 场景对象：`Bu`=createSceneObject、`Du`=createDefaultDirectorProject；相机 `Im`/`Bl`；AI 生成 `kp`/`Op`（register/invoke modelGenerateHandler）。

### 3.3 撤销重做
- 中央 store `r`@L21580 统一接管（快照→判等→压栈→持久化 `Su`@L21178）。**不要直接 setNodes/setEdges 改业务数据**，否则绕过撤销栈。
- 快捷键 Ctrl/Cmd+Z undo、Ctrl/Cmd+Shift+Z 或 Ctrl+Y redo。

---

## 四、本地数据能力（localTool :18080）

> 全部 HTTP，base `http://127.0.0.1:18080`。详参 `03-database.md` / `04-api/api-reference.md`。

| 能力 | 端点 | 真身 |
|------|------|------|
| 资源 upsert | `POST /api/resources/save` | `Sv`@L42838 |
| 资源查询 | `GET /api/resources` | `xv` |
| rescan 入库 | `POST /api/resources/rescan` | `Ev`@L42883（扫盘→写 resources 表）|
| 资源删除 | `POST /api/resources/delete?id=` | `wv`@L42857（**只删 DB 不删盘**）|
| 文件上传落盘 | `POST /api/files/upload` | `ii`@L1888 |
| 缩略图 | `GET /api/files/thumbnail?url=&maxDim=&quality=` | `ri`@L1856（内存缓存+锁）|
| 任务 upsert | `POST /api/tasks/save` | `J_`@L41611 |

### 4.1 已知债务（接这些接口时要知道）
- `wv` 删除只删 DB → 孤儿磁盘文件（修复：改用 clear 带 `deleteFiles`，localTool 已支持）。
- `tasks clear` 无删盘路径（比 wv 更深）。
- rescan 孤儿清理只清 `source='local-tool'`；`source='extension'`（采集）不被清理。
- 缩略图伪复制（仅 `copyFileSync`，无真实缩放）。
- URL 拖入不落盘（仅内存，刷新丢失）；文件上传不自动入库（需手动 rescan）。

---

## 五、网关对话能力（:9004）

### 5.1 `POST /v1/chat/completions`（SSE）
- **入参**（AI05-13 实锤）：
  - `messages`：user 消息直接拼；其他 role 包 `[{role}] {content}`；多模态 `image_url` 提为 `vision_urls`。
  - `model`：经 `resolve_prefer_models(model, "IMAGE"/"VIDEO")` 决定生成偏好。
  - `stream`：默认 true。
- **返回**：SSE 流 = 每 2s `: heartbeat` + 单条 `chat.completion.chunk`（`delta.content`）+ `data: [DONE]`。
- **错误码**：无 user 消息→400；abort→400；超时(300s)→504；LovartError→`data:{error}`。
- **⚠️ 两套机制**：chat 是**网关内同步轮询** Lovart 后以 SSE 吐出；生图节点是**前端异步轮询** `GET /v1/tasks/{id}`。两者汇于同一任务查询端点，但入口/轮询主体不同。想在对话里生图，要么前端自己调 `/v1/images/generations`，要么解析 chat 返回的任务。

### 5.2 其他网关端点
- `POST /v1/images/generations` / `/v1/videos/generations` / `/v1/images/edits` —— 生图/视频/编辑。
- `GET /v1/tasks/{id}` —— 轮询任务状态（abort→400 / 超时→504）。
- `POST /v1/tasks/{id}/confirm` —— 手动确认。
- ❌ `/v1/music` `/v1/audio` `/v1/audio/speech` —— **返回 501**（README 与 main.py 矛盾，待修）。

---

## 六、云同步能力（GAS）

- **真身**：`CloudSyncEngine`@L43896，POST `text/plain` 到 `config.GAS_CLOUD_SYNC_URL`。
- **push** `ei`@L43950：收集 9 类配置（`app_settings`/`api_configs`/`users`/`membership`/`projects`/`presetPrompts`/`customNodeTemplates`/`modelSchedules`/`cloud_storage_config`），非空才推。
- **pull** `ti`@L43974：拉取后逐键写回，**成功 1s 后 `window.location.reload()`**。
- **硬约束**：GAS 必须部署为「所有人访问」，否则响应含 `<html` 报错（L43914）。

---

## 七、给下游 AI agent 的开发纪律

> 以下硬规则来自 `PROJECT_ORIGIN.md` §4/§4.5/§8，改码 / 接接口前逐条过。

1. 引用混淆名**必须带行号 + 语义名**（如"生图主回调 `Jn`@L32490"），禁止只写 `Jn`。
2. 同名遮蔽（`ei`/`ti`/`Jn`/`Zr`/`we`/`R`/`Th`）查 `glossary.md` 确认用哪个真身。
3. 动码前重新 grep 确认当前行号（构建会漂移）。
4. **新增代码用语义化命名，严禁复用短混淆名**（`ii`/`Xr`/`U_`/`W_`/`G_` 等）。`U_`/`W_`/`G_`/`H_`/`B_` 这类下划线短名是原版残留，别改（改了会和基线对不上、grep 误判）。常量 `UPPER_SNAKE`、函数/变量 `camelCase`、类 `PascalCase`。
5. 跨进程用 `chrome.runtime`；同窗口广播用 `mutiwindow-*`；别指望 `mutiwindow-*` 跨窗口。
6. 不碰 `dist/`、vendor、`App.original.js`；默认只改 `App.js`/`config.js`。
7. **网关端口坑**：画布实际连 `127.0.0.1:9004`（网关 `config.js` 的 `ot`/`DEFAULT_ENDPOINT`），README 写的 `8000` 是错的。启动网关必须 `uvicorn main:app --host 127.0.0.1 --port 9004`，照搬 8000 会让画布全 404。
8. **文件上传 URL 必须绝对路径**：`/api/files/upload` 返回的 `url`/`thumbnailUrl` 必须是 `http://127.0.0.1:18080/files/...`，禁止相对路径（扩展环境相对路径会解析成 `chrome-extension://...` → 破图刷日志）。前端 `uploadFile` 已兜底补前缀，改 `files.ts` 时保留。
9. **只跑 V1**：`main.tsx` L41 只 `React.lazy(() => import('./_engine/App.js'))`，V2（`src/v2/`）封存不参与运行。恢复 `App.js` 基线用 `git checkout -- src/_engine/App.js`，别复制任何备份文件。
10. **画布交互易踩坑**：Ctrl+拖拽框选（`ctrlHeld` 动态切 `panOnDrag`/`selectionOnDrag`，keydown 只认 `Control`/`Meta`）；`minZoom:.05`（React Flow 默认 0.5）；`.react-flow__pane{user-select:none}` 防框选蓝选；**撤销/重做直连 `setNodes`/`setEdges`，不经 `onNodesChange`**。

### 7.1 已知无害噪音（看到别慌，也别改）
- 控制台 9004 的 4 个 404（`/api/public/platform/builtin`、`/plugin/manifest.json`、`/api/workflow-apps/by-project/default` 等）：网关从未实现、前端兜底吞掉，**无害**。
- `RootErrorBoundary` 的 `useState null` 异常：魔改残留，**无害，不改**。
- 18080 连不上：localTool 没启动，**非代码 bug**，先起服务。
- 被注释的 UI（模型选择/插件市场/工作流管理）底层取数函数仍发请求（App.js L3224/L3240/L38212/L43311），属预期，**不改**。

### 7.2 改功能的标准动作（防坑 SOP）
1. 先 `git status` 确认工作区干净（App.js 有未提交改动时别 `git checkout`）。
2. 按表 grep 目标功能的**当前行号**（行号会漂移）。
3. 只改 `App.js`/`config.js`；资源/rescan 相关改 `localTool/`，AI 生成相关改 `apimart-gateway/`。**绝不改 `dist/`**（build 产物，改了下次构建即覆盖）；改源码再 `npm run build` → Chrome 重新加载。
4. 新增变量用语义化命名，小步提交，commit message 写清（`feat(localTool+engine): ...` / `fix(localTool): ...`）。

---

## 七·五、画布节点能力清单（在画布"能做什么"）

> 来源 `一毛AI画布使用教程合集.md`（v1.1.1–v1.3.5）。这些是**已上线能力**，下游 AI 可基于它们设计"对话即生成"的工作流。节点创建契约见 `glossary.md` / `Z`@L36215（精确入参待查）。

| 能力 | 节点 / 入口 | 对 AI agent 的意义 |
|------|-----------|-------------------|
| 文本生成 | 文本节点 | 提示词 / 文案入口 |
| AI 生图 | 生图节点（`Jn`@L32490） | 图生成主入口 |
| AI 生视频 | 视频节点（`er`/`Qn`/`$n` 分派） | 视频生成主入口 |
| **万能节点** | 右键添加 → 齿轮配置 | **灵魂功能**：配 URL+`{{变量}}` 即可接任意第三方 API（ComfyUI/RunningHub/TTS…），自动生成输入控件；结果默认每 4.5s 刷新 |
| 视频抽帧 / 关键帧 | 抽帧节点 | 标准/间隔/智能场景三模式，输出可连生图做图生图 |
| 360° 全景 | 全景图节点 | 2D 全景 → 球状/柱状 3D 漫游，可截图生成新节点 |
| 九宫格拼图 | 拼图节点 | v1.2.10 起拖拽所见即所得 |
| 便签 | 便签节点（v1.3.2） | 画布标注 |
| 对比工具 / 人脸打码 | 右键→小工具（v1.3.3+） | 两张图/视频对比、隐私打码 |
| 3D 导演台 | `Th`=Director3DNode（v1.3.5） | 画布内搭 3D 场景、调镜头、AI 生成模型 |
| 七牛云桥接 | 设置→数据管理→云存储 | 本地素材自动转公网直链，桥接要求公网 URL 的第三方 API / SD2 视频 |
| 剪映发送 | 素材工具栏剪映图标（v1.3.3+） | 一键送剪映；外部图片需先「魔法棒」转路径图片 |
| 数据备份打包 | 设置内一键打包 | 项目/资源/多开环境/API 配置全量导出 |

> 注：万能节点 + 七牛云桥接是"把外部能力纳入画布"的最低成本路径，比自己写新节点更稳。

---

## 八、当前文档未覆盖的契约缺口（诚实标注，非杜撰）

| 缺口 | 影响 | 状态 |
|------|------|------|
| 创建节点函数 `Z`@L36215 的精确入参结构（nodeType + data 字段全貌） | 想"对话即建 placeholder 节点"时需读此处 | AI13 标记 ➖ 待查 |
| 多窗口真实跨窗口广播机制 | 跨窗口同步方案设计 | AI13 标记 ➖ 待查（17-5）|
| `POST /api/tasks/save` 的 localTool handler 内部字段 | 直接写任务库时 | AI05 标记待实证 |
| 撤销栈 `r` 的外部调用签名 | 想以代码触发可撤销变更时 | AI13 标记 ➖（18 仅记内部实现）|

---

## 九、接网关生图的 7 个必踩陷阱（接 `/v1/images|videos/generations` 必看）

> 来源 `FUNCTION_MAP.md` §2.1（已实证，方案就绪）。改 `Jn` 的 N 分支或自己接生图时必读。

1. **响应格式错位**：提交返回 `{code:200,data:[{status:"submitted",task_id}]}`，须检测 `task_id` 改走轮询，旧逻辑只同步读 `b64_json/url` 会报"未生成"。
2. **AbortController 初始 fetch 后已删除**：POST 返回后 `ht.current.delete(n)` 立即执行，轮询须**新建** AbortController 重新 set，否则全局取消命中不了。
3. **超时不会自动 abort**：`oe` 只翻 UI 旗标、`.finally` 里已 `clearTimeout` → 轮询须**自建 deadline（15min）**。
4. **`.url` 是数组不是 string**：网关 `images[].url`/`videos[].url` 均为 `[url]`，必须 `.url[0]`，旧逻辑 `e.url` 当 string 会拿到数组导致 `Image.src` 失败。
5. **URL 过期**：CDN url `expires_at` 默认 24h 后 404 → 取到 HTTP URL 必须经 `ii(u,...)` 下载持久化到本地，**严禁裸存 CDN url**（红线 §3.2）。
6. **审核拒绝 ≠ 普通失败**：终态 `failed` + `data.error.code:"no_artifact"` → 优先透传 `data.error.message`，别笼统报"生成失败"。
7. **图/视频可独立出现**：`data.result` 只含实际存在的 `images`/`videos`，分别判空，不假设两者都在。

---

## 十、备份 / 云同步结构差异（踩坑预警）

> 来源 `PROJECT_LOG.md`（2026-07-20 待观察项）。外部开发者做导入导出 / 云端同步时必知。

- **导出备份** `Ri`@L44443 / 恢复 `Bi`@L44482：同一份 `{localforage, kvStore}` 结构（含画布节点）。
- **云端推送** `ei`@L43888 → GAS `push_data`：**另一份独立扁平结构**，仅 9 个 kvStore 键（`app_settings`/`api_configs`/`users`/`membership`/`projects`/`presetPrompts`/`customNodeTemplates`/`modelSchedules`/`cloud_storage_config`），**不含画布节点(localforage)**。
- **互用问题**：导出备份拿去云端 push 会丢字段；云端拉取 `ti` 只写 kvStore 不碰 localforage，画布不会回来。当前三者未统一，做同步功能时注意结构差异。

---

## 十一、项目来历与架构 Why（外部开发者背景）

> 来源 `PROJECT_ORIGIN.md`。理解"为什么架构长这样"。

- 原版是**闭源 Chrome 扩展**（官方服务器 `0.1mao.cc` 提供账号/模型/商店）。
- 反编译魔改为**去官方依赖的本地模式（V1）**：去登录（`Oa` 永返本地 token）、端点集中 `config.js`、画布改连自研**网关 9004** + **localTool 18080**。
- localTool 用 `sql.js`(WASM) **重写**了原版闭源 Go 二进制（原以为 better-sqlite3，实际 sql.js）。
- 网关把 OpenAI 风格接口翻译转发 Lovart。
- **V2 完整重写已暂停归档**（`src/v2/`），当前只跑 V1；不要假设 V2 stores 在运行。
- 原版残留短名 `U_`/`W_`/`G_`/`B_` 别改也别和新增变量混淆。
