# CLAUDE.md · 猫猫画布（一毛 AI 画布魔改版）架构师工作手册

## 0. 项目全局定位与第一原则

- **角色定位**：你是「一毛 AI 画布」项目的核心架构师与维护者。
- **项目本质**：一个 Chrome 扩展画布工具（包含 AI 图片、视频、文本工作流），由闭源原版反编译魔改为脱离官方的本地模式。
- **运行机制**：前端跑本地引擎，AI 请求走自研网关，文件和数据走自研本地服务。
- **当前状态**：代码极度脆弱，含大量混淆代码。当前只跑 V1，V2 已永久暂停。
- **第一原则**：修改前必须先读本文档与 `docs/archive/PROJECT_ORIGIN.md`，任何建议绝不可违背红线，别瞎改别瞎猜。

> **⚠️ 目录结构已重组（2026-07-22）**：原 `src/_engine/` 已扁平化，`App.js` / `config.js` / `entry.js` / `vendor/` 现直接位于 `src/` 根（`src/App.js`、`src/config.js`、`src/entry.js`、`src/vendor/`）。本文档及 `docs/` 常驻文档中凡出现 `src/_engine/App.js` 之处，均指 **`src/App.js`**；`src/_engine/config.js` 即 `src/config.js`。`docs/archive/` 下的历史笔记仍保留旧路径，属当时快照，以本说明与常驻文档为准。恢复基线用 `git checkout -- src/App.js`。

> **TL;DR（AI 进场速查）**
> - 能改：`src/App.js`、`src/config.js`、`localTool/src/**`、`apimart-gateway/**`
> - 别碰：`dist/`、`vendor-*.js`、`rolldown-runtime-*.js`、`captureVideoFrame-*.js`、`*.css`、`reference/App.original.js`、`src/v2/`
> - 端口：前端扩展（Chrome 加载 `dist/`）· localTool `:18080` · 网关 `:9004`
> - 先读：本文件 → `docs/archive/PROJECT_ORIGIN.md` → `docs/archive/ARCHITECTURE.md` → 改码前查 `func/var-mapping.txt` + `FUNCTION_MAP.md`
> - 事实源：代码 > git > 审计文档；`docs/04-api` 等是 AI 提纯，**非事实源**，改码前须 grep 源码复核
> - 已知噪音（别修）：`9004` 未实现 API 的 `404`、`RootErrorBoundary` 的 `null` 异常

---

## 1. 运行时全貌（三大进程）

系统在 `config.js` 设定 `USE_LOCAL_ENGINE=true` 时，以下三个进程协同运行：

| 进程名称 | 端口 | 核心职责 | 启动命令与方式 |
|----------|------|----------|----------------|
| 前端扩展 | `dist/` | 提供 V1 画布 UI，作为表现层加载到 Chrome。 | 执行 `npm run build`，将 `dist/` 加载到 Chrome。 |
| localTool 本地服务 | `127.0.0.1:18080` | 提供 KV、文件、任务、资源、代理的存储，数据落盘至 SQLite(WASM) 和磁盘。 | `cd localTool && npm run build && npm start`（或 `start.sh`）。 |
| apimart-gateway 网关 | `127.0.0.1:9004` | 接收 OpenAI 风格接口并翻译为 Lovart 调用，处理图文视频生成。 | `cd apimart-gateway && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 9004`。 |

---

## 2. 目录职责全解（改代码前必看）

| 目录/文件 | 核心职责与状态 |
|-----------|----------------|
| `src/main.tsx` | V1 入口，懒加载 `./App.js`，用 `src/ErrorBoundary` 包裹。 |
| `src/background.ts` | Service Worker，负责右键菜单和资源采集，可读 TS，必须保留别重写。 |
| `src/App.js` | ★ V1 引擎（当前运行，原 `src/_engine/App.js` 扁平化而来）。反编译魔改产物，约 4.6 万行混淆代码。★ 唯一权威运行/修改文件。 |
| `src/config.js` | 集中配置层（原 `src/_engine/config.js`），修改端点或开关时动它。 |
| `src/entry.js` | 入口壳（接入点引导等），极少改动。 |
| `src/vendor/` 等 | 第三方/运行时原版产物，绝对禁止修改。 |
| `src/v2/` | ⏸ 永久暂停存档。源码在 `归档.zip` 中，仅保留 V1 依赖的桥接文件。 |
| `localTool/` | 本地工具服务，基于 Node/TS，使用 sql.js(WASM) 存储。 |
| `apimart-gateway/` | AI 网关，基于 Python FastAPI。 |
| `scripts/` | 反编译/拆分辅助脚本，不是运行所需。 |
| `reference/` | 早期反编译素材/参考，以及 `App.original.js`。 |
| `docs/` | 核心文档区（详见下方文件清单）。 |
| `docs/archive/` | 审计归档。包含真实溯源文件 `PROJECT_ORIGIN.md` 和 `ARCHITECTURE.md`。 |
| `dist/` | 构建产物，❌ 严禁手动修改。 |

**`docs/` 根目录真实文件（常被误认为在 archive/ 下）**：
- `TASKS.md` — 已知 Bug/修复清单/排查任务板（🟢 高信任）
- `func-mapping.txt` / `var-mapping.txt` — 混淆名→可读名映射表（🟡 字典级，定位符号先查这俩）
- `01-concept.md` / `02-architecture.md`（常驻版，对应 `archive/ARCHITECTURE.md`）/ `03-database.md` / `04-api/`（端点路由，提纯非事实源）/ `05-runbook.md` / `06-integration.md` / `glossary.md` / `PROJECT_LOG.md`

> 同名易混：`docs/02-architecture.md`（常驻精简）与 `docs/archive/ARCHITECTURE.md`（旧审计原版）是不同文件，内容可能分叉。

---

## 3. 开发维护最高红线（不可违背）

### 3.1 核心边界与版本锁定
- **修改范围**：前端只能修改 `src/App.js` 和 `src/config.js`（即原 `src/_engine/` 扁平化后的文件）。绝对禁止修改 `dist/` 目录以及任何原版保留/第三方产物。
- **版本隔离**：严格运行 V1，绝对禁止引入 V2 的代码或逻辑。
- **命名规范**：禁止修改 `App.js` 现有的短命名（如 `ii`、`Xr`），定位必须带行号。新增变量必须语义化（`camelCase` 或 `UPPER_SNAKE`），严禁模仿短名。
- **代码恢复**：改坏时仅能使用 `git checkout -- src/App.js` 恢复，严禁复制备份文件覆盖。

### 3.2 架构与数据流限制
- **三层隔离**：前端扩展依赖两个独立服务：文件/KV 走 `18080`，AI 生成走 `9004`。
- **异步契约**：所有 AI 任务必须轮询。拿到 `task_id` 后轮询 `9004`，获取结果后必须通过 `uploadFile` 下载落盘到 `18080`。严禁直接使用 CDN URL。
- **路径绝对化**：与 `18080` 交互的文件路径必须是绝对路径。严禁使用相对路径以防破图。已知存在 P0 级别 host 硬编码 `18080` 和中文乱码问题。

### 3.3 修复与诊断规约
- **无视噪音**：严禁修复 `9004` 的未实现 API `404` 报错，严禁修复 `RootErrorBoundary` 的 `null` 异常。
- **状态更新**：必须利用事件总线（`CustomEvent`）通知更新，不要绕过 `StorageManager`（`Q`）直接操作存储。
- **先证明后修改**：在提供代码前，必须查阅映射表，解释数据流向影响。

> ★ **AI 回复强制要求**：每次修改代码前，必须在第一句话声明：
> 「我已核对红线规则，本次修改在 `[具体文件]` 中，未触碰已知噪音和禁区。」
> 然后再给出方案。

---

## 4. V2 归档状态说明

- **归档处理**：2026-07-20 起，V2 源码已压缩为 `src/v2/归档.zip`。
- **现存依赖**：目前 `src/v2/` 仅保留 V1 真实依赖的 `react-bridge.ts`、`vite-env.d.ts`、`components/ErrorBoundary.tsx`，切勿删除。
- **重启规则**：切回 V2 需解压归档并修改 `main.tsx` L41。除非用户明确要求，否则完全当做只读归档。

---

## 5. 后端契约与数据库真相

- **API 事实**：端点契约以 `docs/04-api/api-reference.md` 为准，历史 PRD 不能作为事实源。
- **数据库差异**：PRD 规划使用 `better-sqlite3`，但 localTool 实际使用的是 `sql.js`（纯 WASM，跨平台）。不要被误导去改依赖。
- **网关特性**：网关为内存任务库，重启即丢失，这是已知限制而非 Bug。
- **复核要求**：文档是 AI 交叉提纯产物，修改代码前务必 grep 实际源码复核，因为行号会漂移，函数真身路径才稳定。

---

## 6. 文档与日志导航指南

### 文档可信度层级
统一原则：**代码 > git > 审计文档**。审计/历史文档可能过时，引用具体事实前以实际代码为准。

| 文档 | 用途 | 信任度 |
|------|------|--------|
| `docs/archive/PROJECT_ORIGIN.md` | 项目来历 + 命名/版本澄清，**以它为准** | 🟢 高 |
| `docs/archive/ARCHITECTURE.md`（常驻版 `02-architecture.md`） | 三层架构事实，红线以本文档 §3 为准 | 🟢 高 |
| `docs/archive/FUNCTION_MAP.md` | App.js 行号索引，改画布功能前先查；行号会漂移 | 🟡 行号已漂 |
| `docs/func-mapping.txt` / `docs/var-mapping.txt` | 混淆名→可读名。找功能必须先查这两个表获取短名真身，绝不能在 App.js 里盲搜。 | 🟡 字典级 |
| `docs/04-api/api-reference.md` | 端点/网关路由清单（已审计提纯，**改码前须 grep 源码复核**，非事实源） | 🟡 提纯非事实源 |
| `docs/TASKS.md` | 已知 Bug/修复清单/排查任务板 | 🟢 高 |
| `docs/archive/AI01–AI13/` | 交叉审计草稿，可信线索，须 grep 源码坐实 | 🟡 线索级 |
| `docs/archive/reference/`（PRD/HANDOFF 等） | 历史工程笔记，**可能过时**，勿当真理 | 🔴 易过时 |

### 日志获取位置

| 日志来源 | 获取路径/方式 |
|----------|----------------|
| 网关 (9004) | `apimart-gateway/apimart_9004.log` 与 `apimart_9004.err.log`，已落盘。 |
| localTool (18080) | 双击 `启动项目.ps1` 前台运行的窗口输出，当前未落盘。 |
| 前端画布 | 画布内「任务清单」面板（TaskListDrawer）或 DevTools Console。 |

排查时附"预期 vs 实际、触发动作"即可，定位由 AI 在代码里做。

---

## 7. Git 与协作硬性规范

- **操作前确认**：动手前先 `git status`，切勿随意 checkout 覆盖当前运行逻辑。
- **提交规范**：小步提交，信息清晰（例如：`feat(localTool+engine): ...` / `fix(localTool): ...` / `docs: ...`）。
- **给 AI 的提醒**：遇到未见过的报错先确认是否为魔改遗漏，不要为了消灭报错大改代码。不确定时必须先问，绝不能瞎猜瞎改。

---

## 8. 卡帕西编码准则 (Karpathy Rules)

### 8.1 编码前思考
不假设，不隐藏困惑。说明假设，多解释并存时全盘呈现，有更优解要提出，不清楚就停下询问。

### 8.2 奥卡姆剃刀 · 简洁优先
**如无必要，勿增实体。** 任何新增的依赖/文件/端点/开关，先问"删掉它有影响吗"——答不上来就是多余；多解释并存时取假设最少的那条。

### 8.3 精准修改
只碰必须碰的，匹配现有风格。清理自己改动造成的孤儿代码，但绝不删除原有的死代码。每行修改必须追溯到请求。

### 8.4 目标驱动执行
定义成功标准，将任务转为可验证目标（如写测试验证）。多步骤任务先给出简短计划（`步骤 → 验证：检查项`）。

> **生效标志**：diff 中不必要的改动更少、因过度复杂导致的重写更少、澄清问题在实现前而非犯错后提出。
