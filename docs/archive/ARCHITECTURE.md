> ⚠️ 本文为旧版架构描述，已迁移至 docs/02-architecture.md（理解文档主文件，含交叉验证实锤事实）；对外能力接口请看 docs/06-integration.md。旧版保留仅供追溯。

# 一毛AI画布 · 架构参考（AI 友好版）

> 合并自 `AI_REFERENCE.md` + `DATA_FLOW_ARCHITECTURE.md`(27 张图，已去) + `FILE_SYSTEM_AUDIT.md`，并补全代码库结构化事实。
> 面向 AI 阅读：只保留结构化事实，**不含 Mermaid 图**。
> 本文采用三段式结构：**① 全局视图**（系统鸟瞰）→ **② 递归分类**（逐层下钻：层 → 模块 → 子模块/接口）→ **③ 交叉分类**（跨层关联）。
>
> ⚠️ **行号快照日期 2026-07-20，会漂移**。动手前重新 grep 确认当前行号。
> 🐱 项目代号「猫猫画布」，包名 `yimao-ai-canvas`，版本 `1.3.5`，当前只跑 V1。
> 🔴 **开发维护红线（修改范围 / 版本锁定 / 命名 / 三层隔离 / 异步契约 / 路径绝对化 / 修复诊断）以 `CLAUDE.md` §3 红线总纲为准**，本文只陈述事实，不重复规约。

---

# ① 全局视图（GLOBAL）

## G1. 系统定位
一个 **Chrome 扩展 MV3 画布工具**（AI 图片/视频/文本工作流），由闭源原版**反编译魔改成脱离官方的本地模式**：
- 前端跑**本地引擎**（画布/资源/配置）
- AI 请求走**自研网关**（OpenAI 风格 → Lovart 翻译）
- 文件/数据走**自研本地服务**（SQLite WASM + 磁盘）

## G2. 三大进程（运行时全貌）
| 进程 | 语言/栈 | 端口 | 入口路径 | 职责 |
|------|---------|------|----------|------|
| **前端扩展** | JS(混淆) / React19 | — | `src/main.tsx` → `src/_engine/App.js`(~46252 行) | 画布引擎 + 资源面板 + 配置管理 |
| **localTool** | Node/TS（原生 `node:http`，非 fastify） | 18080 | `localTool/src/index.ts` | 文件/KV/任务/资源的本地 SQLite 服务 |
| **apimart-gateway** | Python / FastAPI | 9004 | `apimart-gateway/main.py` | OpenAI 风格 → Lovart AI 翻译 |

> 端口坑：网关 README/main 默认写 8000，但画布实际连 **9004**，启动须 `--port 9004`。

## G3. 三层 + 一个跨层总线
```
┌───────────────────────────── 表现/逻辑层 (前端扩展) ─────────────────────────────┐
│  src/main.tsx → src/_engine/App.js(★权威修改文件)  +  src/background.ts(SW)        │
│  职责: 画布 / 资源面板 / 配置 / 采集 / 同步 / 轮询编排                              │
└───────┬───────────────────────────────┬───────────────────────────────────┬──────┘
        │ HTTP                            │ HTTP                               │ HTTP
        ▼                                 ▼                                   ▼
┌────────────── 本地数据层 (localTool :18080) ──────────────┐   ┌── 外部 AI 层 (网关 :9004) ──┐
│ SQLite WASM(kv/tasks/resources) + 磁盘 uploads/            │   │ Lovart API 转发 + 任务轮询  │
│ 路由: files/kv/tasks/resources/system + /files/* 静态      │   │ 路由: /v1/images|videos|... │
└───────────────────────────────────────────────────────────┘   └────────────────────────────┘
        ▲                                                                          │
        └──────────── 跨层事件总线: window CustomEvent（前端进程内） ──────────────┘
```
- **跨层边界**：前端 ↔ localTool 是「本地 HTTP + SQLite 持久化」；前端 ↔ 网关是「远程 HTTP + 异步任务轮询」；网关 ↔ Lovart 是外部依赖。
- **总线范围**：`window` CustomEvent **仅在前端进程内**跨模块通信（前端↔localTool/网关之间靠 HTTP 请求/响应，无直接事件总线）。

## G4. 关键数据流（一句话版）
1. **AI 生成**：前端 组件内 `Jn()`(L32490，局部变量，遮蔽模块级 `Jn`=LogoIcon@L89) → 网关 `/v1/.../generations` → Lovart 异步任务 → 前端轮询 → 下载落盘 `uploads/tasks/` → 事件总线刷新资源。
2. **资源采集**：`background.ts` 右键采集 → `chrome.storage` + `resourceAdded` 事件 → 前端下载 `uploads/migrated/` → 入库。
3. **画布持久化**：ReactFlow `onChange` → `canvas-state-change` → localforage。
4. **同步**：统一同步 effect 遍历 `globalTasks` → 未本地化则 uploadFile → 事件总线 rescan。

## G5. 文档地图（全局导航）
| 文档 | 角色 |
|------|------|
| `docs/ARCHITECTURE.md`（本文件） | 架构/代码结构化事实总览（全局→分类→交叉） |
| `docs/TASKS.md` | 已知 Bug / 修复清单 / 排查建议（任务板） |
| `docs/PROJECT_ORIGIN.md` | 项目来历，**以它为准** |
| `docs/FUNCTION_MAP.md` | App.js 行号索引（改功能前先查） |
| `docs/func-mapping.txt` / `var-mapping.txt` | 混淆名→可读名映射（定位符号优先搜） |
| `reference/` / `docs/reference/` | 历史笔记，**可能过时**，以代码/git 为准 |

---

# ② 递归分类（RECURSIVE — 逐层下钻）

> 结构：层 → 模块 → 子模块/接口/函数。每个叶子带「文件:行号」锚点。

## L1 表现/逻辑层（前端扩展）

### L1.0 目录职责与改动红线
**目录职责**
```
maomao/
├── src/
│   ├── main.tsx              # V1 入口。lazy 加载 _engine/App.js，用 v2/components/ErrorBoundary 包裹
│   ├── background.ts         # Service Worker（右键菜单/资源采集，可读 TS，保留别重写）
│   ├── _engine/              # ★ V1 引擎（当前运行）。反编译魔改产物
│   │   ├── App.js            # ★ 唯一权威运行/修改文件（~1.8MB 混淆代码）
│   │   ├── config.js         # 集中配置层，改配置动它
│   │   ├── entry.js          # 入口壳，极少改
│   │   ├── vendor-Cr1JWW-B.js / rolldown-runtime-*.js / captureVideoFrame-*.js / *.css  # 别改
│   └── v2/                   # ⏸ V2 永久暂停存档（见 L4.4）
├── localTool/                # 本地工具服务（:18080），Node/TS，sql.js(WASM)
├── apimart-gateway/          # AI 网关（:9004），Python FastAPI
├── scripts/                  # 反编译/拆分辅助脚本（见 L4.1），非运行所需
├── reference/                # 早期反编译素材/参考 + App.original.js（仅参照）
├── docs/                     # 文档
└── dist/                     # 构建产物（❌ 严禁手改）
```
**改动红线（最重要）**
1. 默认只改 `src/_engine/App.js`；配置改 `config.js`，入口壳 `entry.js` 极少改。
2. 别碰 `vendor-Cr1JWW-B.js` / `rolldown-runtime-*.js` / `captureVideoFrame-*.js` / `*.css` / `App.original.js`。
3. 恢复 `App.js` 基线用 `git checkout -- src/_engine/App.js`，别复制任何备份文件。
4. `App.js` 混淆代码，函数/变量名无稳定语义，**引用必须带行号**。
5. 新增代码用语义化命名（如 `rawResp`/`LOCAL_ENGINE`），严禁反编译风格短名（`U_`/`W_`/`G_` 是原版残留，别动）。
6. ❌ 严禁改 `dist/`：build 输出物，改了下次 build 即被覆盖、浏览器加载的就是它。

### L1.1 入口与装配
| 项 | 文件:行号 | 说明 |
|----|-----------|------|
| 应用入口 | `src/main.tsx` | `React.lazy(() => import('./_engine/App.js'))`，用 `v2/components/ErrorBoundary` 包裹；复用 `v2/react-bridge.ts` |
| 配置层 | `src/_engine/config.js` | 集中配置（端点/开关），见 L1.5 |
| 入口壳 | `src/_engine/entry.js` | 接入点引导，极少改 |
| Service Worker | `src/background.ts` | 右键菜单 / 资源采集，可读 TS，保留别重写 |
| 权威运行文件 | `src/_engine/App.js`(~46252 行) | ★ 全部业务逻辑，混淆代码，**引用必带行号** |
| 勿碰产物 | `src/_engine/vendor-Cr1JWW-B.js` / `rolldown-runtime-*.js` / `captureVideoFrame-*.js` / `*.css` | 第三方/备份，别改 |

### L1.2 画布引擎（App.js 核心）
| 函数 | 行号 | 作用 |
|------|------|------|
| `Z` | ~L36215 | 创建节点并加入画布 |
| `Ir` / `Lr` | L36212 / L36215 | 画布 `onDragOver` / `onDrop` |
| `ii` | ~L36284 | `uploadFile` 统一入口（落盘 uploads/） |
| `Qn` | L169 | 资源面板组件 |
| `onlyRenderVisibleElements` / `pan-performance-mode` / `is-large-canvas` | — | 性能降级策略（节点>20 / >300） |

**画布节点类型**（App.js L4141 spawnable 集合，可能不全）:
`promptNode` · `imageNode` · `imageBoxNode` · `videoNode` · `sd2VideoNode` · `discountVideoNode` · `gridSplitNode` · `gridMergeNode` · `cropNode` · `urlToImageNode` · `fileToUrlNode` · `panoramaNode` · `videoExtractNode` · `textNode` · `audioNode` · `textConcatNode`
- 节点数据字段: `data.imageUrl` / `videoUrl` / `audioUrl` / `text` / `prompt` / `label` / `resultUrl`
- 组件日志前缀: `[ImageNode]` / `[VideoNode]` / `[SD2VideoNode]` / `[DiscountVideoNode]`

### L1.3 AI 生成编排（App.js）
| 函数 | 行号 | 作用 |
|------|------|------|
| `Jn`(模块级 L89)=`LogoIcon` 品牌图标；生图主回调是组件内局部 `let Jn = Y.useCallback(...)`(L32490)，遮蔽模块级 `Jn` | L32490（局部）| 生图/生视频/生音频 主回调（N 分支走网关异步轮询）；引用须带 L32490，不能只写 `Jn` |
| 生图轮询 | L32910 | 轮询 `GET /v1/tasks/{id}`（≥3s，退避 15s，15min deadline） |
| 统一同步 effect | L44246 | 遍历 `globalTasks`，未本地化则 `uploadFile()` |
| `Oa` | L3511 | 登录/鉴权（本地模式永远返回本地 token） |

### L1.4 资源 / 存储 / 同步（App.js）
| 函数 | 行号 | 作用 | 端点 |
|------|------|------|------|
| `Q`(管理器) | ~L1260 | `get/set/setObject/getObject/syncToLocalTool` | 后端 `wr`/`Mr`/`Nr`/`Pr` |
| `xv` | L42742 | 查询资源列表 | GET /api/resources |
| `Sv`(大写) | L42838 | 保存资源 upsert（POST /api/resources/save）；⚠️ ≠ 小写 `sv`=nodeCallbackFieldSet(L42002) | POST /api/resources/save |
| `Cv` | L42772 | 切换收藏 | Sv({...isFavorite}) |
| `wv` | L42857 | 删除资源（只删 DB，不删磁盘，TASKS P2） | POST /api/resources/delete |
| `Ev` | L42883 | rescan（扫磁盘→resources 表） | POST /api/resources/rescan |
| `we` | L4176(模块级) / L43015(组件内) | 加载资源(rescan+查询)；同名双定义，引用带行号 | Ev()→xv() |
| `Oi` | L44322 | "同步到本地" | we() 刷新 |
| `ei` / `ti` | ~L43760 | GAS 云同步 push / pull | config.GAS_CLOUD_SYNC_URL |

**存储键**（chrome.storage / localStorage / localforage）:
`app_settings` · `api_configs` · `users` · `membership` · `projects` · `presetPrompts` · `customNodeTemplates` · `modelSchedules` · `cloud_storage_config` · `transitResources`(≤5,内存易失) · `transit_grid_cols` · `globalTasks` · `canvas-state-v1-{projectId}`(localforage) · `auth_token`(localStorage)

### L1.5 配置层（config.js 全量导出）
| 导出 | 值/含义 |
|------|---------|
| `LOCAL_ENGINE` | `{host:'127.0.0.1', port:18080, get base()}` |
| `JIANYING_PORT` | `18080`（剪映发送端口，已禁用） |
| `ENDPOINTS` | `[{label:'API网关', url:'http://127.0.0.1:9004'}]` |
| `DEFAULT_ENDPOINT` | `'http://127.0.0.1:9004'` |
| `AUTH_TOKEN_KEY` | `'auth_token'` |
| `USE_LOCAL_ENGINE` | `true`（true→走 localTool :18080） |
| `REMOTE_BASE` | `'http://127.0.0.1:9004'`（false 时用） |
| `localEngineBase()` / `getLocalEngineBase` | `USE_LOCAL_ENGINE ? LOCAL_ENGINE.base : REMOTE_BASE` |
| `AVATAR_IMAGE` | `'/logo.png'` |
| `APP_BRAND` | `'猫猫'` |
| `APP_VERSION` | `'1.3.5'` |
| `DEFAULT_GATEWAY_URL` | = `DEFAULT_ENDPOINT` |
| `DICEBEAR_AVATAR_BASE` | `'https://api.dicebear.com/7.x/avataaars/svg?seed='` |
| `DEV_DEMO_SITE` | `{name:'开发测试网', url:'http://localhost:3000', cookies:[{name:'test',value:'123'}]}` |
| `GAS_CLOUD_SYNC_URL` | Google Apps Script 部署 URL（云端同步按钮） |

---

## L2 本地数据层（localTool :18080）

### L2.1 服务骨架
| 项 | 文件:行号 | 说明 |
|----|-----------|------|
| 入口 | `localTool/src/index.ts` L1 | 原生 `node:http`，`PORT=18080`，`VERSION=2.0.0-yimao-clone` |
| 端口冲突检测 | index.ts L25 | `EADDRINUSE` 报「18080 被占用」 |
| 静态文件 | index.ts L43 | `/files/*` → 磁盘，路径遍历防护 + 403 |
| 数据库 | `localTool/src/db/database.ts` L1/L59 | `sql.js`(WASM SQLite)，非 better-sqlite3 |
| 工具 | `localTool/src/utils/helpers.ts` | `json` / `sendError` |
| 数据根目录 | `~/.yimao-localtool/`（`YIMAO_DATA_DIR` 可覆盖） | DB: `localtool.db` |

### L2.2 路由模块
| 模块 | 文件 | 路由（方法） |
|------|------|--------------|
| 状态 | `routes/system.ts` | `/api/status`(GET) · `/api/proxy`(POST) · `/api/jianying/send`(POST,占位) |
| KV | `routes/kv.ts` | `/api/kv/get`(GET) · `/api/kv/set`(POST) |
| 文件 | `routes/files.ts` | `/api/files/upload`(POST) · `/read`(GET) · `/thumbnail`(GET) · `/mkdir`·`/move`(POST) · `/open`·`/open-dir`(GET) · `/list`(GET) |
| 任务 | `routes/tasks.ts` | `/api/tasks`(GET) · `/save`(POST) · `/delete`(POST) · `/clear`(POST) |
| 资源 | `routes/resources.ts` | `/api/resources`(GET,L168) · `/save`(POST,L181) · `/batch-save`(POST,L190) · `/delete`(POST,L202) · `/clear`(POST,L211) · `/rescan`(POST,L37) |

### L2.3 数据模型（SQLite WASM）
```sql
kv(key TEXT PK, value TEXT, updated_at INTEGER)
tasks(task_id TEXT PK, node_id, prompt, result_url, ...)
resources(id TEXT PK, url TEXT, type TEXT, source, folder, name, page_url, page_title, is_favorite INTEGER, timestamp INTEGER)
```
- 磁盘: `uploads/tasks/`(生成) · `uploads/migrated/`(采集) · `uploads/canvas/drop/`(拖入) · `uploads/canvas/paste/`(粘贴) · `uploads/.thumbnails/`(缩略图)

### L2.4 资源持久化细节
- rescan: 扫 `uploadDir` 子目录（排除 `.thumbnails`）→ 目录→`type=folder`，文件→扩展名映射；id=`local-{folder}-{name}`，已存在跳过；孤儿清理只清 `source='local-tool'`。
- 删除 `wv()`: **只删 DB，不删磁盘文件**（P2，见 TASKS）。
- 缩略图 `tryGenerateThumbnail`(files.ts L104–142): 图片类扩展名 → 复制原图到 `.thumbnails/`（**仅 `copyFileSync`，无真实缩放**，P2 见 TASKS）
- 按需 `handleThumbnail`(files.ts L224–258): 文件名 `thumb_{maxDim}x{quality}_{basename}`，已存在则缓存
- 前端 `ri()`(App.js L1856): 内存缓存 Map<TTL=300s> + 并发锁，返回 thumbnailUrl 字符串

---

### L2.5 文件 I/O 路径（写入 / 读取 / 清理）
**写入入口（7 个）**
| # | 入口 | 落盘位置 | App.js 行号 | 说明 |
|---|------|---------|------------|------|
| 1 | 右键"发送到资源" | `uploads/migrated/` | L43436–L43467 | ii()(L1888)→POST /api/files/upload；元数据 Sv()(L42838) 入库（注：原记 `Zr()` 误，`Zr`=注销@L43893） |
| 2 | AI 生成结果 | `uploads/tasks/` | L44287 | 统一同步 effect → uploadFile()→ii()(L1888)（注：原记 `Xr()/Zr()` 误，`Xr`=openInTab@L1802） |
| 3 | 画布拖入文件 | `uploads/canvas/drop/` | L36285 | ii({subfolder:'canvas/drop'})→POST /api/files/upload |
| 4 | 剪贴板粘贴 | `uploads/canvas/paste/` | L36003 | ii({subfolder:'canvas/paste'}) |
| 5 | 资源面板文件上传 | `uploads/canvas/` | L29165–L29166 | R(files)→ii()(L1888)（注：原记 `→Xr()` 误） |
| 6 | 资源面板 URL 拖入 | **不落盘** | L29176 | 只存 URL 到状态，刷新后丢失 |
| 7 | 剪映素材发送 | 占位 | localTool | POST /api/jianying/send 只记日志，不发送 |

**读取入口（3 个）**
| # | 入口 | 路由/函数 | 行号 | 说明 |
|---|------|----------|------|------|
| 1 | 静态文件服务 | GET `/files/{subfolder}/{filename}` | index.ts L43 | 路径遍历防护 + MIME + Cache-Control:max-age=31536000 |
| 2 | API 文件读取 | GET `/api/files/read?path=` | files.ts L145 | 支持 X-Proxy-* 头代理读 |
| 3 | 缩略图 API | GET `/api/files/thumbnail?url=&maxDim=&quality=` | files.ts L224 | 返回 JSON {thumbnailUrl}，非二进制 |

**删除 / 清理路径**
- 资源删除 `wv(id)` → POST `/api/resources/delete?id=` → **只删 DB 记录，不删磁盘文件**
- 资源清空 → POST `/api/resources/clear`（body `{folder, deleteFiles}`）：无 folder 清空全部；`deleteFiles=true` 额外删磁盘
- Rescan 孤儿清理：只清 `source='local-tool'` 且磁盘不存在的记录；`source='extension'` 不被清理

### L2.6 资源类型映射
| 类型 | 扩展名 | 说明 |
|------|--------|------|
| image | png/jpg/webp/gif/bmp/svg/avif | 图片 |
| video | mp4/webm/mov/avi/mkv/flv/m4v | 视频 |
| audio | mp3/wav/flac/ogg/m4a/aac/opus/wma/aiff | 音频 |
| text | md/markdown/txt | 文本 |
| folder | — | 目录(资源面板可嵌套浏览) |

未登记扩展名被 `extToFileType` 跳过；rescan 只扫 `uploadDir` 子目录，跳过 `.thumbnails` 与 `.` 开头项。

## L3 外部 AI 层（apimart-gateway :9004）

### L3.1 服务骨架
| 项 | 文件:行号 | 说明 |
|----|-----------|------|
| 入口 | `apimart-gateway/main.py` L1 | FastAPI + uvicorn，`--port 9004` |
| Lovart 客户端 | `apimart-gateway/lovart_client.py` | 转发 + 异步任务轮询 |
| 任务轮询 | main.py L783 | `GET /v1/tasks/{id}` |
| 字段映射 | main.py L687 | `ratio→aspect_ratio` · `seconds→duration` · `input_reference→reference_images` |
| 验证脚本 | `verify_gateway.py` | 网关自检 |
| 任务库 | 内存（重启即丢，已知限制非 bug） | — |

### L3.2 路由模块
| 路由 | 方法 | 行号 | 说明 |
|------|------|------|------|
| `/v1/images/generations` | POST | L591 | 图片生成 |
| `/v1/images/edits` | POST | L595 | 图片编辑(inpaint/outpaint) |
| `/v1/videos/generations` | POST | L641 | 视频生成 |
| `/v1/video/generations` | POST | L646 | 别名(sd2Video) |
| `/v1/videos` | POST | L651 | 别名(video) |
| `/v1/music/generations` | POST | L655 | **501** |
| `/v1/audio/generations` | POST | L659 | **501** |
| `/v1/audio/speech` | POST | L663 | **501(TTS)** |
| `/v1/tasks/{task_id}` | GET | L873 | 任务状态 |
| `/v1/tasks/{task_id}/confirm` | POST | L882 | 手动确认(`AUTO_CONFIRM=false`) |
| `/v1/balance` | GET | L922 | 余额/模式 |
| `/v1/chat/completions` | POST | — | 流式 SSE 聊天 |

### L3.3 环境变量
| 变量 | 默认 | 说明 |
|------|------|------|
| `LOVART_ACCESS_KEY` / `LOVART_SECRET_KEY` | "" | Lovart 密钥 |
| `LOVART_BASE_URL` | `https://lgw.lovart.ai` | Lovart 后端 |
| `LOVART_TIMEOUT` | 600 | 超时秒 |
| `AUTO_CONFIRM` | true | 自动确认 pending |
| `LOVART_MODE` | "" | fast/unlimited |
| `TASK_RESULT_TTL` | 86400 | 结果缓存秒 |
| `USER_KEYS` | "{}" | 多用户密钥映射 |
| `OPEN_RELAY` | false | 开放中继 |

---

## L4 跨层支撑（工具链 / 构建 / 扩展壳）

### L4.1 反编译/拆分工具链（scripts/，非运行所需）
| 脚本 | 作用 |
|------|------|
| `deobfuscate.cjs` | Babel AST 反混淆：常量折叠/`!0`→`true`、中文解码 → `reference/decompiled/` |
| `deobfuscate-rename.cjs` | 消费 `func-mapping.txt`+`var-mapping.txt` 做作用域感知安全重命名 |
| `split-nodes.cjs` | 把反编译 App.js 拆成 `reference/decompiled/nodes/<NodeType>.raw.js`(27) |
| `patch-app.cjs` | 对 `src/restored/App.js` 注入 config、替换硬编码地址为 config 变量 |
| `gen-entry.cjs` | 生成 `src/restored/entry.js`，接入点读 config |
| `map-vendor.cjs` | 解析 vendor 尾部 `as` 别名 → `vendor-map.json` |
| `copy-chunks.cjs` | 扫描 `src/restored` 动态 import 收集 chunk |

### L4.2 构建与启动
| 进程 | 构建 | 启动 | 备注 |
|------|------|------|------|
| 前端 | `npm run build`→`dist/` | Chrome 加载 `dist/`(MV3) | ❌ 严禁手改 `dist/` |
| localTool | `cd localTool && npm run build` | `npm start`(或 `start.sh`) | — |
| 网关 | `pip install -r requirements.txt` | `uvicorn main:app --port 9004` | 端口须 9004 |
- 一键启动器: `启动项目.command`(mac) / `启动项目.ps1`(win)；网关 `启动网关.command`/`run_local.sh`/`run_local.bat`
- 构建 OOM 防护: esbuild 压缩、`target:esnext`、`--max-old-space-size=1024`；chunk: `_engine`→`engine`、`react`→`vendor-react`、`@xyflow`→`vendor-xyflow`
- 技术栈（dependencies）: `react`/`react-dom` `^19.2.7` · `@xyflow/react` `^12.3.6` · `zustand` `^5.0.14` · `localforage` `^1.10.0` · `sharp` `^0.35.3` · `lucide-react` `^1.25.0` · `@babel/*`(generator/parser/traverse/types) `^8`（工具链）
- 开发依赖: `vite` `^6.0.3` · `@vitejs/plugin-react` · `typescript ~5.6.2` · `tailwindcss ^3.4.16` · `postcss` · `autoprefixer` · `@types/chrome` · `@types/react(-dom)`
- npm scripts: `dev=vite` / `build='NODE_OPTIONS=--max-old-space-size=1024 vite build'` / `preview='vite preview'`

### L4.3 扩展清单（manifest.json, MV3）
- `name=猫猫画布`, `version=1.3.5`
- permissions: `contextMenus` `storage` `unlimitedStorage` `cookies` `activeTab` `scripting` `tabs` `sidePanel` `downloads`
- `host_permissions: <all_urls>`；`side_panel.default_path=index.html`
- `background.service_worker=background.js`(module)；CSP `script-src 'self' 'wasm-unsafe-eval'`
- web_accessible: `*.svg/png/jpg/jpeg/css` + `mediapipe/*`

### L4.4 V2 状态（永久暂停）
- V2 源码已归档为 `src/v2/归档.zip`；`src/v2/` 现存 `react-bridge.ts`/`vite-env.d.ts`/`components/ErrorBoundary.tsx`(V1 真实依赖，勿删) + `归档.zip`
- 切 V2 需解压归档并把 `main.tsx` L41 换 `import('./v2/App.js')`；否则只在 V1 工作
- V1 实际状态在 App.js 混淆变量；V2 stores（`canvasStore`/`resourceStore`/`taskStore`/`uiStore`/`projectStore`/`accountStore`）仅存档未运行

---

### L4.5 日志位置（排查去哪拿）
| 来源 | 位置 | 拿法 |
|------|------|------|
| 网关 (9004) | `apimart-gateway/apimart_9004.log` + `apimart_9004.err.log` | 已落盘，直接把路径给 AI |
| localTool (18080) | `启动项目.ps1` 前台运行窗口 | 看窗口输出；当前未落盘文件 |
| 前端画布 | 画布内「任务清单」面板（App.js TaskListDrawer） | UI 内看任务运行记录；DevTools Console 可 Save as 存文本 |

> 排查时附"预期 vs 实际、触发动作"即可，定位由 AI 在代码里做。

# ③ 交叉分类（CROSS — 跨层关联）

## X1. 跨层数据流（端到端，带边界）
### X1.1 AI 生成（前端 ↔ 网关 ↔ Lovart ↔ localTool）
```
Jn()(组件内, App L32490；模块级 Jn@L89=LogoIcon)
  → POST /v1/images|videos/generations (网关 L591/L641)
  → LovartClient 创建异步任务 → task_id
  → 前端轮询 GET /v1/tasks/{id} (网关 L873, ≥3s/退避15s/15min)
  → 解析 images[].url (注意是数组 [0])
  → CDN? ii() 下载 → uploads/tasks/ (App L44287)
  → 更新节点 data.imageUrl/videoUrl
  → dispatchEvent('mutiwindow-task-completed') → Ev() rescan → 资源面板刷新
```
> 7 个轮询陷阱见 `FUNCTION_MAP.md` §2.1。

### X1.2 资源采集（background.ts ↔ 前端 ↔ localTool）
```
background.ts handleSaveToTransit()
  → chrome.storage.local.set('transitResources') (≤5)
  → sendMessage({action:'resourceAdded'})
  → 前端 onMessage (App L43436) → 追加 transitItems(内存) + ii()(L1888) 落盘 → uploads/migrated/
  → Sv() POST /api/resources/save 入库
```
> 已知限制：只存元数据 URL，不下载文件（P1，见 TASKS）。

### X1.3 画布拖放（前端内 → localTool）
```
onDrop (App L36215)
  → application/x-yimao-template → 批量导入节点
  → application/x-mutiwindow-task → 创建节点
  → dataTransfer.files → ii({subfolder:'canvas/drop'}) → POST /api/files/upload
```

### X1.4 统一同步（前端 ↔ localTool，防死循环）
```
依赖 [globalTasks, isConnected, port]; 锁定 Se.current
遍历 globalTasks(status=completed):
  需本地化? (startsWith('/files/') OR 127.0.0.1/files/tasks) → 跳过 : uploadFile()下载
  有变更 → dispatchEvent('mutiwindow-task-completed') → Ev() rescan
```
> 修复前缺 `/files/` 条件 → 已本地化任务反复上传死循环。

## X2. 跨层事件总线（前端 window CustomEvent）
| 事件 | 触发源(文件:行号) | 连锁 |
|------|-------------------|------|
| `mutiwindow-task-completed` | 统一同步 effect(L38430/L43578/L44344) | → Ev() rescan → 资源刷新 |
| `resourceAdded` | background.ts → 前端 L43465 | → transitItems → 素材 Tab |
| `mutiwindow-sync-local` | 资源面板按钮 | → we() rescanSync |
| `import-project` / `export-project` | AppShell(L44644/L44650) | → 文件选择/保存 |
| `canvas-state-change` | ReactFlow onChange | → localforage 保存 |

## X3. 跨层一致性风险（调试必看）
1. **双数据源**：`transitItems`(内存易失) vs `resources`(持久) — "素材"Tab 显示 resources。
2. **资源 ID 冲突**：`resourceAdded` 用 `Date.now()`；rescan 用 `local-{folder}-{name}` — 同一文件可能两条记录。
3. **base URL 不一致**：`Hr=localEngineBase()`(可能 9004) vs `vv=LOCAL_ENGINE.base`(固定 18080) — `USE_LOCAL_ENGINE=false` 时文件走 9004 无上传路由失败。
4. **rescan URL 格式**：rescan 补全绝对路径；ii()(L1888)/uploadFile 返回相对路径 — 相对路径在 `chrome-extension://` 下破图（已 `d5d48dd` 修复，host 硬编码 18080 待改）。（注：原记 `Zr()` 误，`Zr`=注销@L43893）
5. **缩略图路径**：`/files/{sub}/{subfolder}/.thumbnails/thumb_*` → `uploads/{sub}/.thumbnails/` ✅；rescan 跳过 `.thumbnails` ✅。

## X4. 跨层错误处理层级
- L1 React 边界 `ErrorBoundary` → 降级 UI+重试
- L2 网络 fetch 失败 → 重试(3次递增)/15min deadline/AbortController
- L3 业务 402(余额)/403(权限)/404(无害噪音)/500(重试)
- L4 噪音 ResizeObserver/RootErrorBoundary/Promise rejection → silent ignore

## X5. 跨层性能策略
- 画布：节点>20 隐藏非可见、>300 降透明度
- 存储：`transitResources`≤5、`TASK_RESULT_TTL` 86400s、`_TASK_META`≤500、缩略图缓存
- 网络：`rescanThrottledSync` 3s 节流、轮询≥3s(退避15s)、`Cache-Control max-age=31536000`、SSE(`/v1/chat/completions`)
- 渲染：React.memo、Zustand selector、GPU 加速(transform+opacity)

## X6. 跨层其他流程
- **GAS 云同步**：`ei`/`ti`(App ~L43760) → callGateway('push_data') → POST GAS URL；URL 在 `config.GAS_CLOUD_SYNC_URL`
- **启动初始化**：bootstrap→lazy App.js→Q→检查 localTool→建立连接→config→syncAllToLocalTool(1s)→项目→localforage 恢复→tasks→xv()+we() rescan→注册监听
- **图片编辑**：编辑节点 image+mask → FormData → `/v1/images/edits` → Lovart → 回填
- **余额检查**：GET `/v1/balance` → 402/403 Toast
- **多开账号**：`Oa`(L3511) 登录 → auth_token → users KV + localStorage → 网关按 `USER_KEYS` 独立计费

## X7. 已知 Bug / 修复 / 排查 → 任务板
> 已拆到 **`docs/TASKS.md`**（P0–P2 Bug、修复清单、"发送到资源"不落盘排查），此处不重复。

---

## 附录：代码位置速查
| 功能 | 文件 | 行号 |
|------|------|------|
| 资源面板 Qn | App.js | L169 |
| Rescan Ev() | App.js | L42804 |
| 同步到本地 Oi() | App.js | L44322 |
| 统一同步 effect | App.js | L44246 |
| 资源读取 xv() | App.js | L42742 |
| 资源保存 Sv() | App.js | L42759 |
| 右键采集 | App.js | L43436 |
| 生图主回调(组件内 Jn) | App.js | L32490 |
| 生图轮询 | App.js | L32910 |
| 存储管理器 Q | App.js | L1260 |
| GAS 云同步 | App.js | L43760 |
| localTool 入口 | localTool/src/index.ts | L1 |
| 文件路由 | localTool/src/routes/files.ts | L1 |
| 资源路由 | localTool/src/routes/resources.ts | L1 |
| 任务路由 | localTool/src/routes/tasks.ts | L1 |
| 数据库 | localTool/src/db/database.ts | L1/L59 |
| 网关入口 | apimart-gateway/main.py | L1 |
| 字段映射 | apimart-gateway/main.py | L687 |
| 任务轮询 | apimart-gateway/main.py | L783 |
| 配置层 | src/_engine/config.js | L1 |
| Service Worker | src/background.ts | L1 |
| 画布 onDrop | App.js | L36215 |
| 剪映发送 | localTool/src/routes/system.ts | L159 |

> 混淆名字典见 `docs/var-mapping.txt` + `docs/func-mapping.txt`（行号已漂移）。完整 App.js 行号索引见 `FUNCTION_MAP.md`。
