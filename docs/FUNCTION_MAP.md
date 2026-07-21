# 一毛AI画布 · 功能代码地图（V1，App.js 行号索引）

> 让接手的 AI **秒定位功能在 App.js 的哪一行**，避免 grep 把能跑的改坏。仅适用于 V1 主线 `src/_engine/App.js`。
> **铁律**：① 引用必须带**行号**（函数名无稳定语义，反编译可能变）；② 行号为 **2026-07-20 实测快照，会漂移**，动手前重新 grep；③ 新增代码用语义化命名，严禁 `ii()`/`U_` 这类短名。

---

## 0. 全局常量（端点/端口，原版残留短名，勿改）

这些是原版残留（反编译器生成），改了会和基线对不上、grep 误判：

| 行号（App.js） | 常量 | 含义 |
|---|---|---|
| L41453 | `U_ = 'http://127.0.0.1:18080'` | 本地工具服务 base（硬编码残留，实际读取走 config.js） |
| L42691 | `vv = 'http://127.0.0.1:18080'` | 资源 store 用的 localTool base |
| L43084 | `ot = 'http://127.0.0.1:9004'` | AI 网关 base（画布实际连接的端口） |
| L1700 | `var Hr = localEngineBase()` | 是否本地引擎开关（来自 config.js） |
| L18989 | `var Bc = LOCAL_ENGINE.port` | localTool 端口（18080） |

---

## 0.5 混淆名高频核心（改 App.js 必备速查）

完整字典在 `docs/var-mapping.txt` + `docs/func-mapping.txt`（行号已漂移）。**下面是最常碰到的几个**，改功能前先认脸：

| 混淆名 | 可读含义 | 用途 |
|--------|---------|------|
| `Oa()` | getAuthToken / 去登录核心 | 永远返回本地 token，本地模式登录逻辑全走这（L3511） |
| `Ne` | isLoggedIn | 去登录后恒为 true |
| `Jn` | 生图主回调 | 生图/视频生成逻辑入口（N 分支走网关，见 §2.1） |
| `li` | ImageNode | 图片节点组件（自动判 image/video/audio/text） |
| `Ya` | PromptNode | 提示词节点（生图入口） |
| `Q` | StorageManager | 存储编排器（getConfig/setConfig/saveCanvasState…） |
| `Z` | StorageKeys | 存储键枚举（CANVAS_STATE_PREFIX/AUTH_TOKEN…） |
| `wr` | localToolBackend | 基于 `window.localTool` 的 KV 后端 |
| `ei` / `ti` | pushToCloud / pullFromCloud | GAS 云端同步（我们新增，非原版） |
| `Qn` | TransitPanel | 资源面板（transit Tab）组件 |
| `Ev()` | rescan 前端定义 | 资源 rescan 循环调用方；定义见 §2「生成完成触发 rescan」处（行号以实际 grep 为准），调用点在 §3 L42768 |

> 注意：`U_`/`W_`/`G_`/`B_` 这类短下划线名是**原版残留**，不是我们加的，别改也别和新增变量混淆。

---

## 1. 登录 / 鉴权（本地模式：永远登录）

| 功能 | 行号 | 说明 |
|---|---|---|
| `function Oa()` | **L3511** | 去登录核心：永远返回本地 token / 已登录态。**改登录逻辑只动这里。** |
| `Oa()` 调用点 | L3530, L3549, L3559, L3595, L3606, L30647, L38102, L38198, L42944, L42954 | 各取数函数用 `if(!Oa())` 兜底，本地模式恒为 true |
| `isLoggedIn: V = false` | **L31251** | 登录态变量声明（本地模式由 `Oa()` 覆盖，非此值决定） |
| "请先登录" 异常 | L30659 | `if(!Oa()) throw Error('请先登录')` —— 若误触发说明 `Oa()` 被改坏 |
| 初始化完成日志 | L43356 | `[初始化完成] 当前 isLoggedIn` —— 排查登录看这里 |

---

## 2. AI 生成（生图 / 生视频 / 聊天）

| 功能 | 行号 | 说明 |
|---|---|---|
| 生图提交端点 | **L32731** | `I = \`${R}/v1/images/generations\``（R 为网关 base） |
| 生图任务轮询（节点侧） | L32910 | `pollUrl = \`${R}/v1/tasks/${taskId}\`` |
| 另一个轮询路径 | L33423, L34088 | `zc(\`${_}/v1/tasks/${k}\`...)` 等异步轮询 |
| `rawResp` 诊断变量 | L32777, L32825, L32883, L33142, L33143 | 我们新增：保留原始响应用于报错展示，改报错信息展示动这里 |
| `customRawResponse` | L35134, L35181, L35234, L35283, L38333, L38351, L40931, L40997, L41412, L43530, L43551 | 节点结果原始响应字段（混淆名系原版残留，勿改） |
| 生成完成触发 rescan | L31361 | `Ev().then(...)` 资源入库统一逻辑，生成完成自动 rescan |

> 网关侧对应：`apimart-gateway/main.py` 的 `/v1/images/generations`(L591)、`/v1/videos/generations`(L641)、`/v1/tasks/{id}`(L873)。**字段兼容映射**在 `_submit_generation`(L687) —— 画布视频节点字段名 → 网关标准字段名。

### 2.1 生图/视频异步轮询 · 实施陷阱浓缩（接网关必看）

> 来源：`docs/reference/PRD_TASK_POLLING.md`（已实证，方案就绪待实施）。轮询入口在 `Jn` 的 N 分支（提交拿到 `task_id` → 轮询 `GET /v1/tasks/{id}` 至终态 → 取 `data.result`）。

**7 个必踩陷阱**：
1. **响应格式错位**：网关提交返回 `{code:200,data:[{status:"submitted",task_id}]}`，旧逻辑只同步读 `b64_json/url` → 忽略 `task_id` → 报"未生成图片"。须检测 `task_id` 改走轮询。
2. **AbortController 初始 fetch 后已删除**：`ht.current.delete(n)` 在 POST 返回后立即执行，轮询须**新建** `AbortController` 重新 `ht.current.set(n, ac)`，否则全局取消命中不了。
3. **`oe` 超时不 abort 且轮询前已失效**：`oe` 只翻 UI 旗标、`.finally` 里 `clearTimeout(o)` 已清除 → 轮询须**自建 deadline（15min）**。
4. **`.url` 是数组不是 string**：网关 `images[].url`/`videos[].url` 均为 `[url]`（main.py L154/156），必须 `.url[0]`，旧逻辑 `e.url` 当 string 会拿到数组导致 `Image.src` 失败。
5. **URL 过期**：CDN url `expires_at` 默认 24h 后 404 → 取到 HTTP URL 必须经 `ii(u,...)` 下载持久化到本地，**不裸存 CDN url**。
6. **审核拒绝 ≠ 普通失败**：终态 `failed` + `data.error.code:"no_artifact"` → 优先透传 `data.error.message`，别笼统报"生成失败"。
7. **图/视频可独立出现**：`data.result` 只含实际存在的 `images`/`videos`，分别判空，不假设两者都在。

**关键约束**：仅改 `Jn` 的 N 分支；复用现有 `zc`/`R`/`h`/`z`/`ht.current`/`ii`；错误统一 `throw Error(...)`；无 `task_id` 走原同步解析。轮询间隔 `≥3s`、退避上限 15s、自建 15min deadline。

---

## 3. 资源面板 / rescan（localTool :18080）

| 功能 | 行号 | 说明 |
|---|---|---|
| 资源读取 | L42710 | `fetch(\`${vv}/api/resources?${t}\`)` |
| 资源保存 | L42723 | `fetch(\`${vv}/api/resources/save\`...)` |
| 资源删除 | L42742 | `fetch(\`${vv}/api/resources/delete?id=...\`)` |
| 资源清空 | L42751 | `fetch(\`${vv}/api/resources/clear\`...)` |
| **rescan 触发** | **L42768** | `fetch(\`${vv}/api/resources/rescan\`...)` —— 重新扫描入库 |
| rescan 节流（防循环） | L42910–L42914 | `rescanThrottledSync`：3 秒内重复调用直接 return，**修 rescan 抖动/循环改这里** |
| `useLocalTool.getKV` | L19074 | KV 读取；连不上 18080 会打"请确保 localTool 正在运行" |
| KV 保存 | L19092 | `fetch(\`http://127.0.0.1:${Bc}/api/resources/save\`...)` |

> localTool 侧对应：`localTool/src/routes/resources.ts`（`handleResourcesRescan` 等）、`localTool/src/index.ts` L196 路由 `/api/resources/rescan`。破图真因见 §3.2（已在 `d5d48dd` 修复）。

### 3.1 资源类型识别规则（rescan 入库，实证有效）

`localTool/src/routes/resources.ts` 的 `RESCAN_FILE_TYPE`（L12-L21）按扩展名映射：

| 扩展名 | 入库 type |
|--------|-----------|
| `.png .jpg .jpeg .webp .gif .bmp .svg` | `image` |
| `.mp4 .webm .mov .avi .mkv .flv .m4v` | `video` |
| `.mp3 .wav .flac .ogg .m4a` | `audio` |
| `.md .markdown .txt` | `text` |
| 目录项 | `folder` |

- 未登记扩展名会被 `extToFileType` 直接跳过，不进资源表。
- rescan 仅扫 `uploadDir` 子目录，跳过 `.thumbnails` 与 `.` 开头项；`id = local-{folder}-{name}`，已有 id 直接 `skipped`（保留收藏/元数据）。

### 3.2 破图真因 & 已知残留（已修复，记此防复发）

- **真凶**（已在 `d5d48dd` 修复）：rescan 把 `url` 存成相对路径，在 `chrome-extension://` 下被解析成 `chrome-extension://xxx/files/...` → 404 破图；修复为补全 `http://127.0.0.1:18080/files/...`。
- **残留风险**：① 入库 `url` host 硬编码 `127.0.0.1:18080`，改 host/port 或跨设备需同步；② **中文目录/文件名 Latin1 乱码**（如"新建文件夹"→`æ°å»ºæä»¶å¤±`），疑似 sql.js 以 Latin1 存中文，待修。

---

## 4. 云同步（GAS，Google Apps Script）

| 功能 | 行号 | 说明 |
|---|---|---|
| `CloudSyncEngine` | ~L43760 | 我们新增的云端推送/拉取引擎 |
| 同步 URL | `config.js` `GAS_CLOUD_SYNC_URL` | GAS 部署地址集中配置，改地址动 config.js |

---

## 5. 配置层（改配置动 `config.js`，不是 App.js）

`src/_engine/config.js` 导出（全 `UPPER_SNAKE`）：`LOCAL_ENGINE`{host,port,base}（:18080）、`ENDPOINTS`/`DEFAULT_ENDPOINT`（默认 `http://127.0.0.1:9004`）、`USE_LOCAL_ENGINE=true`（true 走 localTool）、`AUTH_TOKEN_KEY='auth_token'`、`GAS_CLOUD_SYNC_URL`。

---

## 6. 已知无害噪音（下个 AI 看到别慌，也别改）

来自 `docs/PROJECT_LOG.md` (2026-07-20) + `PROJECT_ORIGIN.md` §8：
- 控制台 9004 的 4 个 404（`/api/public/platform/builtin`、`/plugin/manifest.json`、`/api/workflow-apps/by-project/default` 等）：网关从未实现、前端兜底吞掉，**无害**。
- `RootErrorBoundary` 的 `useState null` 异常：魔改残留，**无害，不改**。
- 18080 连不上：localTool 没启动，**非代码 bug**，先起服务。
- 被注释的 UI（模型选择/插件市场/工作流管理）底层取数函数仍发请求（`App.js` L3224/L3240/L38212/L43311），属预期，**不改**。

---

## 7. 改功能的标准动作（防坑 SOP）

1. 先 `git status` 确认工作区干净（App.js 有未提交改动时别 `git checkout`）。
2. 按上表 grep 目标功能的**当前行号**（行号会漂移）。
3. 只改 `App.js`/`config.js`；资源/rescan 相关改 `localTool/`，AI 生成相关改 `apimart-gateway/`。**绝不改 `dist/`**（build 产物，改了下次构建即覆盖、浏览器加载的就是它）——改源码再 `npm run build` → Chrome 重新加载。
4. 新增变量用语义化命名，小步提交，commit message 写清（`feat(localTool+engine): ...` / `fix(localTool): ...`）。

---

## 8. `docs/reference/` 的定位（精华已提取，仅作字典/详档）

上面各节已把 reference 里**当前仍有效的高价值内容提取成本文档**：
- 生图异步轮询 7 陷阱 + 关键约束 → 见 **§2.1**
- 资源类型识别规则 + 破图真因 + 中文乱码残留 → 见 **§3.1 / §3.2**
- 混淆名高频核心 → 见 **§0.5**

`docs/reference/` 仅作两类补充，默认不必先读：
1. **完整混淆名字典**：`var-mapping.txt` / `func-mapping.txt`（§0.5 不够用时查；行号已漂移，部分符号属 `engine` 包）。
2. **详版设计与历史**：`PRD_TASK_POLLING.md`、`PRD-画布异步生图别人的.md`、`HANDOFF2/3.md`、`PRD_MODULE4_5.md`（V2 蓝图，仅切 V2 时读）。

> ⚠️ reference 部分已过时（如 HANDOFF2 §5 `USE_LOCAL_ENGINE=false` 实测为 `true`、§7 #3 `better-sqlite3` 实为 `sql.js`；HANDOFF3 §6 已被 `3db58ff`/`d5d48dd` 推翻）。**以本文件 + git + 实际代码为准**。
