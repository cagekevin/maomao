# 一毛AI画布 · 项目来历

> 项目来历：闭源扩展 → 反编译魔改本地模式 → 自研 localTool + 网关 → 暂停中的 V2 重写。详细工程笔记见 `docs/reference/`。

---

## 1. 起点：一个闭源的 Chrome 扩展

「一毛AI画布」原本是一个 **Chrome 扩展（MV3）**，AI 图片/视频/文本工作流画布工具，有两个闭源部分：

- **前端画布引擎**：混淆打包 JS，核心逻辑在 `App.js`（git 基线 `0e0b2cc` 约 1.74MB；当前魔改后约 1.80MB / 46252 行），依赖官方服务器 `0.1mao.cc` 提供账号、模型、应用商店。
- **本地工具服务**：闭源 **Go 二进制**，监听 `127.0.0.1:18080`，负责文件上传、KV、任务/资源持久化、代理转发（用 `strings` 从三平台二进制扒出端点，证实为 Go + SQLite，见 `reference/PRD.md` 附录 A.8）。

---

## 2. 反编译，得到 V1 引擎（`src/_engine/`）

反编译原版前端引擎得到 `App.js`（约 1.80MB 混淆代码，全部业务逻辑）、`entry.js`、`config.js`、预编译 CSS、vendor runtime 等。

随后对 V1 深度魔改成"本地模式"，脱离官方服务器：
- **去登录**：`Oa()` 永远返回本地 token，`isLoggedIn` 恒 true
- **地址参数化**：端点集中到 `config.js`
- **React 实例统一**：项目 React + `window.React` 桥接，消除双实例冲突
- **Vite 构建**：替代原版 rolldown，`npm run build` → `dist/`
- **UI 清理**：官方依赖项（升级横幅/会员充值/应用商店/教程等）用 `false &&` 前置禁用，不删代码
- 画布改连**自研网关 `127.0.0.1:9004`** 与**本地工具服务 `127.0.0.1:18080`**

运行入口：`src/main.tsx` → `React.lazy(() => import('./_engine/App.js'))`，用 `src/v2/components/ErrorBoundary` 包裹。

---

## 3. 自研本地工具服务 `localTool/`（`127.0.0.1:18080`，Node/TS）

用 `sql.js`（纯 WASM，无需编译）把闭源 Go 二进制**重写**为开源可控的 Node/TS 服务。早期笔记写"better-sqlite3"，**实际落地是 sql.js**，以 `localTool/src/db/database.ts` 为准，勿改依赖。

端点（详见 `reference/PRD.md` 附录 A）：`/api/status`、`/api/kv/get|set`、`/api/files/*`、`/api/tasks/*`、`/api/resources/*`（CRUD，SQLite 表，支持分页/排序/筛选）、`/api/proxy`、`/api/jianying/send`。数据落 SQLite + 磁盘，重启不丢；跨平台（Mac + Windows）。

---

## 4. 自研 AI 网关 `apimart-gateway/`（`127.0.0.1:9004`，Python FastAPI）

把 OpenAI 风格接口翻译成实际后端（Lovart 等）调用，画布的聊天/生图/生视频/音乐全走这里。

> **⚠ 端口坑**：`main.py` 与 `README.md` 默认写 `port 8000`，但画布（`config.js` 的 `DEFAULT_ENDPOINT`、`App.js` 的 `ot='http://127.0.0.1:9004'`）**实际连 9004**。启动必须显式 `uvicorn main:app --host 127.0.0.1 --port 9004`，勿照搬 8000，否则画布全 404。

端点（详见 `reference/PRD.md` 附录 B）：`POST /v1/chat/completions`（流式）、`POST /v1/images/generations|edits`（异步 task）、`POST /v1/videos/generations`（异步 task）、`GET /v1/tasks/{id}`（轮询），以及 `/v1/music/generations`、`/v1/uploads/images`、`/v1/balance` 等。异步轮询逻辑后续逐步补齐（见 `FUNCTION_MAP.md` §2.1、`reference/PRD_TASK_POLLING.md`）。

---

## 4.5 V1 本地模式改造要点速查（改功能前必知）

> 提取自 `reference/HANDOFF2.md`（仍有效部分），详细改造见该文件。

- **去登录**：`Oa()` 永远返回本地 token（详见 `FUNCTION_MAP.md` §1）。
- **地址参数化**：端点集中在 `src/_engine/config.js`（详见 §5）。
- **React 实例统一**：项目 React + `window.React` 桥接。
- **Vite 构建**：替代原版 rolldown → `dist/`。
- **UI 清理**：官方依赖项一律 `false &&` 前置禁用、不删代码；改 UI 见某块"消失"先搜 `false &&`。
- **GAS 云同步**：头像菜单"推送到云端/从云端拉取"走 Google Apps Script（`CloudSyncEngine`，URL 在 `config.js` 的 `GAS_CLOUD_SYNC_URL`）。
- **"退出登录" → "重置配置"**：清本地数据，文案改动在 `Zr`(logout)。
- **画布交互（易踩坑）**：Ctrl+拖拽框选（`ctrlHeld` 动态切 `panOnDrag`/`selectionOnDrag`，keydown 只认 `Control`/`Meta`）；`minZoom: .05`（React Flow 默认 0.5 限制缩放）；`.react-flow__pane { user-select: none }` 防框选蓝选；撤销/重做直接 `setNodes/setEdges`，不经 `onNodesChange`。

---

## 5. V2 计划（已暂停）

目标：把 `src/_engine/` 反编译混淆代码彻底重写为可读可维护的 TypeScript 工程，用 Strangler 渐进替换（按模块 0→1→2→3→4→5，禁止 big-bang），最终删 `_engine/`。完整规划见 `reference/PRD.md`。V2 代码在 `src/v2/`，**封存暂停，不参与运行**。

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

> 闭源 Chrome 画布扩展 → 反编译魔改成去官方依赖的本地模式（V1）→ 配自研 localTool + 网关 → 计划（暂停中）整体重写为 V2。`docs/reference/` 保存全过程工程笔记。

---

## 8. 命名与版本澄清（防止后续 session 混淆）

以下为唯一事实，后续 session 直接采信：

### 8.1 用 V1 还是 V2？

**当前只跑 V1，V2 是已暂停的归档代码，不参与运行。**

| 版本 | 位置 | 运行 | 说明 |
|------|------|------|------|
| **V1** | `src/_engine/` + `main.tsx` + `background.ts` | ✅ | 魔改成本地模式的反编译引擎 |
| **V2** | `src/v2/` | ❌ | 已暂停，纯归档（进度见 `reference/HANDOFF2.md` §2） |

**铁证**：`main.tsx` L41 只 `React.lazy(() => import('./_engine/App.js'))`；V2 的 `AppShell` 无运行路径 import。**规则**：除非用户明确说"用/切到/恢复 V2"，否则所有改动在 V1 下进行。

### 8.2 `_engine/` 下到底改哪个 js？

| 文件 | 角色 | 改？ |
|------|------|------|
| **`App.js`** | 主程序（约 1.80MB / 46252 行混淆，含生图轮询/SSE/rescan 节流等） | ✅ 唯一权威文件 |
| `config.js` | 集中配置层 | ✅ 改配置时动 |
| `entry.js` | 入口壳 | 极少改 |
| `vendor-Cr1JWW-B.js` / `rolldown-runtime-*.js` / `captureVideoFrame-*.js` / `*.css` | 第三方/运行时/样式 | ❌ 别改 |

**历史副本（别往里写逻辑）：**
- `reference/App.original.js`：V1 本地模式早期魔改快照（去登录/参数化/GAS 已完成，早于生图轮询等），**不是 V2**。实测基线 `0e0b2cc` App.js 约 1.74MB、它约 1.79MB，差约 46KB，很可能就是基线加少量早期魔改，仅作参照。
- `App 备份.js`：已废弃（工作区删空，git 删了 ~46000 行），勿依赖。
- **恢复 `App.js` 基线用 `git checkout -- src/_engine/App.js`，不要复制任何备份。**

### 8.3 混淆变量名（ii/Xr/Zr/ri/Ev/Jn…）

`App.js` 是混淆反编译代码，函数/变量名（`ii()` `Xr()` `Zr()` `ri()` `Ev()` `Jn()` `Oa()` `er()` …）**无稳定语义**，不同次反编译可能重命名，**引用必须带行号**（如 `Ev()` 在某行、`Jn` 在某行），不能只说"改 ii()"。行号映射查 `docs/var-mapping.txt` / `docs/func-mapping.txt`（行号会漂移，以实际打开为准）。

> 注意：`U_`/`W_`/`G_`/`H_`/`B_` 这类短下划线名（如 `U_='http://127.0.0.1:18080'`）也是原版残留，在基线里同样存在，**不是我们加的，别改**（改了会和基线对不上、grep 误判）。

### 8.4 我们自己新建的变量/函数 —— 禁止再用短混淆名（硬规则）

**规则**：在 `App.js` / `config.js` / `localTool/*` 中**新增**的变量/函数/常量必须语义化命名，严禁 `ii`/`Xr`/`U_`/`W_`/`G_` 这类反编译短名。

- ✅ `rawResp`、`CloudSyncEngine`、`LOCAL_ENGINE`、`localEngineBase`、`taskId`、`customRawResponse`
- ❌ `ii()` `Xr()` `Zr()` `ri()` `U_` `W_` `G_` `a_` `e_` 等单/双字母+下划线
- 常量 `UPPER_SNAKE`、函数/变量 `camelCase`、类 `PascalCase`，命名要能看出用途。在混淆代码里插新逻辑时也别复用周围短名，免得后续分不清原版还是我们加的。

**现状（2026-07-20）**：新增命名已合规（`rawResp`、`CloudSyncEngine`、`config.js` 全 `UPPER_SNAKE`），无需回溯历史代码；此规则仅约束**后续新增**。

---

### 8.5 `docs/reference/` 使用须知（防误信过时笔记）

`docs/reference/` 是**历史工程笔记**（HANDOFF/PRD/映射表），记录了反编译魔改全过程，**价值极高但部分已过时**，引用具体事实前**以实际代码 / git / 本文件§8 为准**：

| 文件 | 可信度 | 注意 |
|------|--------|------|
| `func-mapping.txt` / `var-mapping.txt` | 🟡 字典级，行号已漂移 | 混淆名→可读名，改 App.js 前先查；部分符号（如 `Bl`/`Oc`/`Vn`）来自 `dist/assets/engine-*.js`，批量替换须跨包 |
| `PRD_TASK_POLLING.md` + `PRD-画布异步生图别人的.md` | 🟢 设计真源（仍有效） | 生图/视频异步 task 轮询完整陷阱（7 陷阱 + 9 约束），接网关生图必读 |
| `HANDOFF3.md` §1-§2 | 🟢 实证结论有效 | 类型识别/破图真因/rescan 节流可靠；§3 待办部分被 PRD 覆盖、§6 状态过时 |
| `HANDOFF2.md` | 🟡 部分过时 | §0-§4 可用；§5 `USE_LOCAL_ENGINE=false` 实测 `true`、§7 #3 `better-sqlite3` 实为 `sql.js`、§8 "未接网关"已被推翻——勿照搬 |
| `HANDOFF3.md` §5-§6 | 🔴 状态已过期 | §5.2 称 `App.original.js` 为基线同款错误（见 §8.2）；§6 "App.js 干净基线/破图未修"已被 `3db58ff`/`d5d48dd` 推翻 |
| `PRD_MODULE4_5.md` | 🟢 V2 蓝图（仅切 V2 时读） | 27 节点清单 / React Flow 配置 / 右键菜单；V2 暂停中默认不读 |

> **一句话**：reference 是"当时怎么踩坑的"，不是"现在是什么样"。改代码前先 `git log` + 查 `FUNCTION_MAP.md` + 实际打开 App.js 确认行号，再回头参考其设计思路。

### 8.5 localTool 与 V1/V2 的关系

`localTool/`（`src/routes/*`、`src/db/database.ts`）是 **V1/V2 共用的本地工具服务（:18080）**，独立于前端版本。资源面板类型识别、rescan、文件上传的改动都在 `localTool/`，别去 `src/_engine/App.js` 找。

### 8.6 接口契约：文件上传 URL 必须绝对路径

`/api/files/upload` 返回的 `url`/`thumbnailUrl` 必须是绝对路径（`http://127.0.0.1:18080/files/...`），**禁止相对路径**。

原因：前端跑在 Chrome 扩展环境，相对路径 `/files/...` 会被解析成 `chrome-extension://.../files/...` → `ERR_FILE_NOT_FOUND` → 前端重试 → 日志刷爆（实测单图错误 30449 行）。

现状：`files.ts` 仍吐相对路径；前端 `uploadFile`（App.js ~L19049）已兜底补 `http://127.0.0.1:${Bc}` 前缀。改 `files.ts` 返回绝对路径亦可，但注意端口配置、且前端兜底保留。
