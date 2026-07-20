# 一毛AI画布 · 项目来历

> 本文档说明这个项目是怎么来的：从闭源扩展 → 反编译魔改本地模式 → 自研本地服务与网关 → 以及暂停中的 V2 重写计划。
> 详细的工程笔记、PRD、交接记录、diff、变量映射等历史文档已统一移至 `docs/reference/`。

---

## 1. 起点：一个闭源的 Chrome 扩展

「一毛AI画布」原本是一个 **Chrome 扩展（MV3）**，是一个 AI 图片/视频/文本工作流画布工具。

它的原始形态有两个闭源部分：

- **前端画布引擎**：混淆/打包后的 JS（git 基线 `0e0b2cc` 的 `App.js` 实测约 1.74MB；当前魔改后的 `App.js` 约 1.80MB / 46229 行），核心逻辑在 `App.js` 里，依赖官方服务器 `0.1mao.cc` 提供账号、模型、应用商店等能力。
- **本地工具服务**：一个 **闭源的 Go 二进制**，双击运行后监听 `127.0.0.1:18080`，负责文件上传、KV 存储、任务/资源持久化、代理转发等。用 `strings` 从三个平台（Mac arm64/intel、Windows）二进制里扒出的端点全集证实其为 Go + SQLite 编写（见 `reference/PRD.md` 附录 A.8）。

---

## 2. 反编译，得到 V1 引擎（`src/_engine/`）

原版前端引擎被反编译，得到：

- `App.js`（实测 **46229 行 / 约 1.80MB** 混淆代码，全部业务逻辑所在；行号会随编辑漂移，引用以实际打开为准）
- `entry.js`（入口壳：接入点引导、CSS 加载、ErrorBoundary、render）
- `config.js`（端点等配置，后来被抽成集中配置层）
- 预编译 CSS、vendor runtime 等

随后对 V1 做了**深度魔改，变成"本地模式"**，使其脱离官方服务器独立运行：

- **去登录**：`Oa()` 永远返回本地 token，`isLoggedIn` 始终为 `true`
- **地址参数化**：所有端点地址集中到 `config.js`
- **React 实例统一**：项目升级到 React 19.2.7，通过 `window.React` 桥接让引擎使用项目 React，消除双实例冲突（`#306`）
- **Vite 构建**：替代原版 rolldown 打包，`npm run build` 输出到 `dist/`
- **UI 清理**：大量官方依赖项（升级横幅、会员/充值、应用商店、官方教程等）用 `false &&` 前置禁用，不删代码
- 本地模式下，画布改连**用户自己的网关 `127.0.0.1:9004`** 与**自研本地工具服务 `127.0.0.1:18080`**

当前运行入口：`src/main.tsx` → `React.lazy(() => import('./_engine/App.js'))`，用 `src/v2/components/ErrorBoundary` 包裹。

---

## 3. 自研本地工具服务 `localTool/`（`127.0.0.1:18080`，Node/TS）

用 `sql.js`（纯 WASM，跨平台无需编译）把闭源 Go 二进制**重写**为开源可控的 Node/TS 服务，替代原二进制。
> 注意：早期笔记曾写"用 better-sqlite3"，**实际落地是 sql.js**，以 `localTool/src/db/database.ts` 为准，勿被旧文档误导去改依赖。

实现端点（详见 `reference/PRD.md` 附录 A）：

- `/api/status` 状态检查
- `/api/kv/get` `/api/kv/set` KV 读写
- `/api/files/*` 文件上传/读取/缩略图/目录操作
- `/api/tasks/*` `/api/resources/*` 任务与资源 CRUD（SQLite 表，支持分页/排序/筛选）
- `/api/proxy` 代理转发
- `/api/jianying/send` 剪映发送

数据落 SQLite + 磁盘，重启不丢；跨平台（Mac + Windows）。

---

## 4. 自研 AI 网关 `apimart-gateway/`（`127.0.0.1:9004`，Python FastAPI）

把 OpenAI 风格的外向接口翻译成实际后端（Lovart 等）调用，画布的聊天、生图、生视频、音乐全部走这里。

> **⚠ 端口坑（实测）**：本网关源码 `main.py` 顶部 docstring 与 `README.md` 默认写的是 `port 8000` / `--port 8000`，但本项目画布（`config.js` 的 `DEFAULT_ENDPOINT`、App.js 里的 `ot = 'http://127.0.0.1:9004'`）**实际连的是 9004**。启动网关时必须显式 `uvicorn main:app --host 127.0.0.1 --port 9004`，否则画布会全部 404 / 连不上。勿照搬 README 的 8000。

端点映射（详见 `reference/PRD.md` 附录 B）：

- `POST /v1/chat/completions` 文本生成（流式）
- `POST /v1/images/generations` `POST /v1/images/edits` 图片生成（异步 task）
- `POST /v1/videos/generations` 视频生成（异步 task）
- `GET /v1/tasks/{id}` 任务结果轮询
- 其它：`/v1/music/generations`、`/v1/uploads/images`、`/v1/balance` 等

> 注：异步生图的 task 轮询逻辑是后续逐步补齐的（见 `docs/FUNCTION_MAP.md` §2.1 陷阱浓缩、`reference/PRD_TASK_POLLING.md`）。

---

## 4.5 V1 本地模式改造要点速查（改功能前必知）

> 提取自 `reference/HANDOFF2.md`（仍有效部分）。详细改造记录见该文件。

- **去登录**：`Oa()` 永远返回本地 token，`isLoggedIn` 恒 true（详见 `FUNCTION_MAP.md` §1）。
- **地址参数化**：所有端点集中在 `src/_engine/config.js`（详见 `FUNCTION_MAP.md` §5）。
- **React 实例统一**：项目 React + `window.React` 桥接，消除双实例冲突。
- **Vite 构建**：替代原版 rolldown，`npm run build` → `dist/`。
- **UI 清理策略**：官方依赖项（升级横幅/会员充值/应用商店/官方教程等）一律用 `false &&` **前置禁用，不删代码**。改 UI 发现某块"消失"，先搜 `false &&` 而非以为代码丢了。
- **GAS 云端同步**：头像菜单"推送到云端/从云端拉取"改走 Google Apps Script（`CloudSyncEngine`，URL 在 `config.js` 的 `GAS_CLOUD_SYNC_URL`）。
- **"退出登录" → "重置配置"**：清本地数据；"重置配置"文案改动在 `Zr`(logout) 处。
- **画布交互决策（易踩坑）**：
  - **Ctrl+拖拽框选**：`ctrlHeld` state 监听物理 Ctrl/Meta 键动态切换 `panOnDrag`/`selectionOnDrag`，keydown 只响应 `e.key==='Control'/'Meta'`，不吞组合键。
  - **画布 `minZoom: .05`**：React Flow 默认 0.5 会限制缩放/fitView，显式放宽。
  - **`.react-flow__pane { user-select: none }`**：防 Ctrl+框选时产生蓝色文本选区。
  - 撤销/重做直接 `setNodes/setEdges`，不经 `onNodesChange` 回调链。

---

## 5. V2 计划（已暂停）

目标是把 `src/_engine/` 的反编译混淆代码**彻底重写为可读、可维护的 TypeScript 工程**，用 Strangler 渐进替换策略（按模块 0→1→2→3→4→5 逐步替换，禁止 big-bang 重写），最终删除 `_engine/` 目录。

完整规划见 `reference/PRD.md`。V2 代码已在 `src/v2/`，目前**封存暂停**，不参与运行。

---

## 6. 目录与文档结构

```
maomao/
├── src/
│   ├── main.tsx              # V1 入口（lazy 加载 _engine/App.js）
│   ├── background.ts         # Service Worker（右键菜单/资源采集，可读 TS 直接保留）
│   ├── _engine/              # V1 引擎（当前运行，反编译魔改）
│   │   ├── App.js            # 主程序（全部业务逻辑）
│   │   ├── config.js         # 集中配置层
│   │   ├── entry.js          # 入口壳
│   │   └── vendor / runtime / css
│   └── v2/                   # V2 完全重写（暂停归档）
├── localTool/                # 本地工具服务（:18080，V1/V2 共用）
├── apimart-gateway/          # AI 网关（:9004，Python FastAPI）
├── docs/
│   ├── PROJECT_ORIGIN.md     # 本文档：项目来历
│   ├── FUNCTION_MAP.md       # 功能代码地图（App.js 行号索引，改功能前先查）
│   ├── PROJECT_LOG.md        # 关键决策日志（只追加不覆盖）
│   └── reference/            # 历史工程笔记（PRD / HANDOFF / diff / 映射表）
└── dist/                     # 构建产物
```

### `docs/reference/` 内容速查

| 文件 | 内容 |
|------|------|
| `PRD.md` | 完全复刻工程完整产品需求文档（6 模块 + 附录 A/B 契约） |
| `HANDOFF2.md` | 跨 session 交接（V1 改造、本地模式清理、登录排查） |
| `HANDOFF3.md` | 跨 session 交接（资源面板类型识别、破图/刷新排查、命名规则） |
| `PRD_TASK_POLLING.md` | 网关异步 task 轮询接入 PRD |
| `PRD-画布异步生图别人的.md` | 异步生图提交侧参数差异核对 |
| `PRD_MODULE4_5.md` | 模块 4/5 细化 |
| `func-mapping.txt` | 反编译模块级短函数名 → 可读名映射 |
| `var-mapping.txt` | 反编译混淆变量名 → 可读名映射 |

---

## 7. 一句话总结

> 一个闭源 Chrome 画布扩展，被反编译 → 魔改成去官方依赖的本地模式（V1）→ 配自研 localTool + 自研网关 → 并计划（暂停中）整体重写为 V2。`docs/reference/` 保存了这个过程的全部工程笔记。

---

## 8. 命名与版本澄清（防止后续 session 混淆）

聊天记录中多次出现 V1/V2、变量名、App.js 与其它 js 到底用哪个的混淆。**以下为唯一事实，后续 session 直接采信：**

### 8.1 用 V1 还是 V2？

**默认且当前运行的只有 V1（原版引擎）。V2 是已暂停的归档代码，不参与运行。**

| 版本 | 位置 | 是否运行 | 说明 |
|------|------|---------|------|
| **V1** | `src/_engine/` + `src/main.tsx` + `src/background.ts` | ✅ 运行中 | 反编译原版引擎，已魔改成本地模式 |
| **V2** | `src/v2/` | ❌ 不运行 | 进度见 `reference/HANDOFF2.md` §2，已暂停，纯归档 |

**判定铁证**：`src/main.tsx` L41 `const App = React.lazy(() => import('./_engine/App.js'))` —— 入口只加载 `_engine/App.js`。V2 的 `src/v2/AppShell` 当前未被任何运行路径 import。
**规则**：除非用户明确说"用 V2 / 切到 V2 / 恢复 V2"，否则所有改动都在 V1（`src/_engine/`）下进行。

### 8.2 `_engine/` 下的 js 文件，到底改哪个？

| 文件 | 角色 | 是否要改 |
|------|------|---------|
| **`App.js`** | **主程序（实测 46229 行 / 约 1.80MB 混淆产物，当前魔改最新版，含生图轮询/SSE/rescan 节流等后续逻辑）** | ✅ 唯一要改/运行的权威文件（V1 全部业务逻辑在这） |
| `config.js` | 集中配置层（端点地址等） | ✅ 改配置时动它 |
| `entry.js` | 入口壳（接入点引导） | 极少改 |
| `vendor-Cr1JWW-B.js` | 打包后的第三方 vendor | ❌ 别改 |
| `rolldown-runtime-*.js` | rolldown 运行时垫片 | ❌ 别改 |
| `captureVideoFrame-*.js` | 摄像头抽帧小工具 | ❌ 别改 |
| `*.css` | 预编译样式 | ❌ 别改（除非改样式） |

**关于历史副本（不要再往里写逻辑）：**
- `App.original.js`：已移至 `reference/App.original.js`。它是 **V1 本地模式早期魔改快照**（去登录/地址参数化/GAS 同步已完成，但早于生图轮询等后续改动），**不是 V2**。与 git 基线 `0e0b2cc` 的关系：实测基线 `App.js` 约 1.74MB、`App.original.js` 约 1.79MB，两者仅差约 46KB——故它**很可能就是基线同款再加少量早期魔改**，并非截然不同的文件。仅作参照，恢复基线请用 `git checkout`，不要复制它。
- `App 备份.js`：已废弃副本（工作区近乎删空，git 里显示删了 ~46000 行），勿依赖。
- **恢复 `App.js` 基线请用 `git checkout -- src/_engine/App.js`，不要复制任何备份文件。**

### 8.3 混淆变量名（ii/Xr/Zr/ri/Ev/Jn…）

`App.js` 是混淆后的反编译代码，函数/变量名（`ii()` `Xr()` `Zr()` `ri()` `Ev()` `Jn()` `Oa()` `er()` 等）都是反编译器生成的，**没有稳定语义**，不同次反编译可能重命名。引用时**必须带行号**（如 `Ev()` 定义在某行、`Jn` 在 32425），不能只说"改 ii()"。行号映射可查 `docs/reference/var-mapping.txt` 与 `docs/reference/func-mapping.txt`（但行号会随编辑漂移，引用时以实际打开为准）。

> 注意：`U_` / `W_` / `G_` / `H_` / `B_` 这类短下划线名（如 `U_ = 'http://127.0.0.1:18080'`）**也是原版反编译残留**，在 `App.original.js` 基线里同样存在，**不是我们加的，不要改**（改了会和基线对不上，且 grep 会误判）。

### 8.4 我们自己新建的变量/函数 —— 禁止再用短混淆名（硬规则）

**规则**：在 `App.js` / `config.js` / `localTool/*` 中**由我们新增**的任何变量、函数、常量，必须使用**语义化命名**，严禁使用 `ii` / `Xr` / `U_` / `W_` / `G_` 这类反编译风格短名。

- ✅ 允许：`rawResp`、`CloudSyncEngine`、`LOCAL_ENGINE`、`localEngineBase`、`taskId`、`customRawResponse`
- ❌ 禁止：`ii()` `Xr()` `Zr()` `ri()` `U_` `W_` `G_` `a_` `e_` 等单/双字母 + 下划线
- 常量用 `UPPER_SNAKE`，函数/变量用 `camelCase`，类名用 `PascalCase`；命名要能看出用途（如 `rawResp` 而非 `r2`）。
- 在反编译混淆代码里插入新逻辑时，新变量也不要复用周围的短名风格，避免后续 session 分不清"这是原版混淆的"还是"我们加的"。

**现状核查（2026-07-20）**：当前我们自己新增的代码命名已合规——诊断变量用 `rawResp`（`App.js` ~32785）、云同步用 `CloudSyncEngine`（`App.js` ~43760）、配置层 `config.js` 全用 `UPPER_SNAKE` 常量。无需回溯重命名历史代码；此规则仅约束**后续新增**。

---

### 8.5 `docs/reference/` 使用须知（防误信过时笔记）

`docs/reference/` 是**历史工程笔记**（HANDOFF/PRD/映射表），记录了反编译魔改全过程，**价值极高但部分已过时**。下个 AI 必读，但引用具体事实前**以实际代码 / git / 本文件§8 为准**：

| 文件 | 可信度 | 用途与注意 |
|------|--------|-----------|
| `func-mapping.txt` / `var-mapping.txt` | 🟡 字典级，但**行号基于 2026-07-19 快照，已漂移** | 混淆名→可读名映射，**改 App.js 前先查**。注意部分符号（如 `Bl`/`Oc`/`Vn`）来自 `dist/assets/engine-*.js` 包，批量替换须跨包；行号以实际打开为准 |
| `PRD_TASK_POLLING.md` + `PRD-画布异步生图别人的.md` | 🟢 **设计真源（仍有效）** | 生图/视频异步 task 轮询的完整陷阱清单（7 陷阱 + 9 约束）。**接网关生图功能必读**，方案已就绪待实施 |
| `HANDOFF3.md` §1-§2 | 🟢 实证结论有效 | 资源面板类型识别规则、破图真因（相对路径 url）、rescan 节流——结论可靠；但 §3 待办已部分被 PRD 覆盖、§6 状态描述已过期（见下） |
| `HANDOFF2.md` | 🟡 部分过时 | §0-§4 改造记录可用；**§5 的 `USE_LOCAL_ENGINE=false` 与 `config.js` 实测 `true` 不符**、§7 决策#3 `better-sqlite3` 实为 `sql.js`、§8 已知问题#1"未接网关"已被后续 PRD 推翻——勿照搬这两处 |
| `HANDOFF3.md` §5-§6 | 🔴 状态已过期 | §5.2 把 `App.original.js` 称"git 基线同款"**错误**（见 §8.2）；§6"App.js 处于干净基线 / 破图未修复"**已被 commit `3db58ff`(rescan节流) / `d5d48dd`(破图修复) 推翻**。以 git log 与 FUNCTION_MAP.md 为准 |
| `PRD_MODULE4_5.md` | 🟢 V2 蓝图（仅切 V2 时读） | 27 节点清单 / React Flow 配置 / 右键菜单结构。V2 暂停中，默认不读；恢复 V2 时必读 |

> **一句话**：reference 是"当时怎么踩坑的"，不是"现在是什么样"。改代码前先 `git log` + 查 `FUNCTION_MAP.md` + 实际打开 App.js 确认行号，再回头参考 reference 的设计思路。

### 8.5 localTool 与 V1/V2 的关系

`localTool/`（`src/routes/*`、`src/db/database.ts`）是 **V1/V2 共用的本地工具服务（:18080）**，独立于前端版本。资源面板类型识别、rescan、文件上传的改动都在 `localTool/` 里，不要跑到 `src/_engine/App.js` 去找。
