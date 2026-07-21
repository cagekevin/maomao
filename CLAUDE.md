# CLAUDE.md · 猫猫画布（一毛 AI 画布魔改版）

> **角色**：你是「一毛 AI 画布」项目的核心架构师与维护者。项目由闭源 Chrome 扩展反编译后重度魔改为本地模式，代码极度脆弱、含大量混淆代码。
> **第一原则**：先读本文档与 `docs/archive/PROJECT_ORIGIN.md` 再动手；任何建议都不得违背下方「红线总纲」。当前只跑 V1，V2 已永久暂停，别瞎改、别瞎猜。

---

## 0. TL;DR（AI 进场速查）

| 项 | 结论 |
|----|------|
| **能改的文件** | 仅 `src/_engine/App.js`（核心逻辑）、`src/_engine/config.js`（配置）、`localTool/src/**`、`apimart-gateway/**` |
| **绝对别碰** | `dist/`、`vendor-*.js`、`rolldown-runtime-*.js`、`captureVideoFrame-*.js`、`*.css`、`reference/App.original.js`、`src/v2/`（V2 暂停） |
| **运行版本** | 只跑 V1；V2 永久暂停，禁止引入其逻辑 |
| **三进程端口** | 前端扩展（Chrome 加载 `dist/`）· localTool `:18080` · 网关 `:9004` |
| **先读顺序** | 本文件 → `docs/archive/PROJECT_ORIGIN.md` → `docs/archive/ARCHITECTURE.md` → 改码前查 `func/var-mapping.txt` + `FUNCTION_MAP.md` |
| **事实源** | 代码 > git > 审计文档。`docs/04-api` 等是 AI 提纯，**非事实源**，改码前须 grep 源码复核 |
| **已知噪音（别修）** | `9004` 未实现 API 的 `404`、`RootErrorBoundary` 的 `null` 异常 |
| **通用纪律** | 见 §10 卡帕西准则：先问别猜、简洁、精准修改 |

---

## 1. 一句话定位

一个 Chrome 扩展画布工具（AI 图片/视频/文本工作流），由闭源原版**反编译魔改成脱离官方的本地模式**：前端跑本地引擎，AI 请求走自研网关，文件/数据走自研本地服务。

当前**只跑 V1**（`src/_engine/` + `src/main.tsx`）；V2（`src/v2/`，TS 重写）**已永久暂停**，仅为不参与运行的半成品存档。

---

## 2. 三个进程怎么跑（运行时全貌）

| 进程 | 端口 | 作用 | 启动 |
|------|------|------|------|
| **前端扩展** | 构建产物 `dist/` 加载到 Chrome | V1 画布 UI | `npm run build` → Chrome 加载 `dist/` |
| **localTool 本地服务** | `127.0.0.1:18080` | KV/文件/tasks/resources/proxy/jianying，数据落 SQLite(WASM) + 磁盘 | `cd localTool && npm run build && npm start`（或 `start.sh`） |
| **apimart-gateway 网关** | `127.0.0.1:9004` | OpenAI 风格接口 → 翻译为 Lovart 调用，文/图/视频生图走这 | `cd apimart-gateway && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 9004` |

`config.js` 中 `USE_LOCAL_ENGINE=true` 时：KV/文件走 `:18080`，AI 生成请求走 `:9004`。

---

## 3. 目录职责（改之前先看清属于哪块）

```
maomao/
├── src/
│   ├── main.tsx              # V1 入口。lazy 加载 _engine/App.js，用 v2/components/ErrorBoundary 包裹
│   ├── background.ts         # Service Worker（右键菜单/资源采集，可读 TS，保留别重写）
│   ├── _engine/              # ★ V1 引擎（当前运行）。反编译魔改产物
│   │   ├── App.js            # ★ 唯一权威运行/修改文件（全部业务逻辑，约 1.8MB / 46252 行混淆）
│   │   ├── config.js         # 集中配置层（端点/开关），改配置动它
│   │   ├── entry.js          # 入口壳（接入点引导等），极少改
│   │   └── vendor-Cr1JWW-B.js / rolldown-runtime-*.js / captureVideoFrame-*.js / *.css  # 别改
│   └── v2/                   # ⏸ V2 永久暂停存档（见 §5）
├── localTool/                # 本地工具服务（:18080，V1/V2 共用），Node/TS，sql.js(WASM) 存储
├── apimart-gateway/          # AI 网关（:9004，Python FastAPI）
├── scripts/                  # 反编译/拆分辅助脚本（deobfuscate / split-nodes 等），不是运行所需
├── reference/                # 早期反编译素材/参考（archived/decompiled/mediapipe/models）+ App.original.js
├── docs/
│   ├── TASKS.md              # 已知 Bug/修复清单/排查建议任务板（docs/ 根）
│   ├── 01-concept.md         # 概念层
│   ├── 02-architecture.md    # docs/archive/ARCHITECTURE.md 的常驻化版本；三层架构事实
│   ├── 03-database.md        # 数据库/表结构/债务
│   ├── 04-api/               # API 端点与网关路由（AI 提纯，改码前须 grep 源码复核）
│   ├── 05-runbook.md         # 启动/部署/恢复基线
│   ├── 06-integration.md     # 跨模块通道/接缝总图
│   ├── glossary.md           # 术语表
│   ├── PROJECT_LOG.md        # 关键决策日志（只追加）
│   ├── func-mapping.txt      # 混淆函数名→可读名（docs/ 根）
│   ├── var-mapping.txt       # 混淆变量名→可读名（docs/ 根）
│   └── archive/              # 📦 审计归档（非实时事实源）
│       ├── PROJECT_ORIGIN.md / ARCHITECTURE.md / FUNCTION_MAP.md  ← 本文档引用的这几个文件实际在此目录
│       ├── AI01–AI13/        # 交叉审计草稿（可信线索，须 grep 源码坐实）
│       └── reference/        # 历史工程笔记（PRD / HANDOFF / diff / 变量映射旧表，可能过时）
└── dist/                     # 构建产物（❌ 严禁手改）
```

> 两个同名易混点：`docs/02-architecture.md`（常驻）与 `docs/archive/ARCHITECTURE.md`（旧审计）是不同文件，内容可能分叉；以 `archive/` 下原版为引用源，`02-` 为常驻精简版。

---

## 4. 红线总纲（开发维护规约 · 最高优先级）

> 以下三类红线**不可违背**。任何代码修改、架构建议都必须先过这关。
> 详细架构事实见 `docs/archive/ARCHITECTURE.md`；已知 Bug/修复任务见 `docs/TASKS.md`。

### 4.1 🔴 核心红线（禁止越界）

1. **修改范围限制**：前端只能修改 `src/_engine/App.js`（核心逻辑）和 `config.js`（配置）。
   - 绝对禁止修改 `dist/` 目录内容；禁止修改 `vendor-*.js`、`rolldown-runtime-*.js`、`captureVideoFrame-*.js`、`*.css`、`App.original.js` 等原版保留/第三方产物。
2. **版本锁定**：项目当前严格运行在 **V1 引擎**下。V2 已永久暂停存档，**绝对禁止引入 V2 的代码或逻辑**（详见 §5）。
3. **命名红线**：
   - `App.js` 中原有的短命名（如 `ii`、`Xr`、`U_`、`W_`、`G_`）是反编译残留，无稳定语义，**禁止修改它们的名字**，定位时必须带上行号。
   - 你新增的任何变量/函数必须使用**语义化命名**（`camelCase` 或 `UPPER_SNAKE`，如 `rawResp` / `LOCAL_ENGINE`），**严禁模仿反编译风格使用单/双字母加下划线的短名**（如 `a_`、`U_`）。
4. **恢复基线**：`App.js` 改坏时用 `git checkout -- src/_engine/App.js` 恢复，别复制任何备份文件（`reference/App.original.js` 仅作参照）。

### 4.2 🏗️ 架构与数据流红线

5. **三层隔离**：认清系统边界，不要把两个服务的职责混淆。
   - 前端扩展（表现层）依赖两个**独立**服务：
     - **文件 / KV 存储** → `localTool`（端口 `18080`）
     - **AI 生成与转发** → `apimart-gateway`（端口 `9004`）
6. **异步契约（轮询 + 落盘）**：所有 AI 任务必须走**轮询机制**。
   - 提交后拿到 `task_id` → 轮询 `9004` 端口获取结果 → 结果获取后**必须通过 `uploadFile` 机制下载落盘到 `18080` 服务**。
   - **严禁直接使用 CDN URL** 当作最终结果（否则刷新/离线即丢，且破坏本地模式闭环）。
7. **路径绝对化**：与 `localTool` 交互返回的文件路径**必须是绝对路径**（如 `http://127.0.0.1:18080/files/...`）。**严格禁止使用相对路径**，以防 Chrome 扩展环境破图。
   - 已知残留问题见 `docs/TASKS.md`（P0：host 硬编码 18080、中文目录/文件名 Latin1 乱码）。

### 4.3 🛡️ 修复与诊断红线

8. **无视已知噪音**：以下均为**无害噪音，严禁尝试去"修复"它们**：
   - `9004` 端口相关的未实现 API `404` 报错（网关内存任务库，重启即丢，属已知限制）；
   - `RootErrorBoundary` 的 `null` 异常（原版客户端残留，不影响运行）。
9. **不破坏原有状态**：修复问题时，**必须利用事件总线**（如 `window` 上的 `CustomEvent`）通知各组件更新状态；**不要试图绕过 `StorageManager`（混淆名 `Q`）直接操作底层存储**。
10. **先证明后修改**：在提供任何代码修改之前，必须：
    - 先解释该修改将**如何影响现有的数据流向**；
    - 确保已查阅 `docs/var-mapping.txt` 和 `docs/func-mapping.txt` 以明确上下文（拿到 `ii()`/`Xr()`/`ei`/`Cr` 这类短名，先去映射表查它对应什么，再决定改哪一行，别在 `App.js` 里盲搜）。
    - **若用户让你修改代码，必须在回答的第一句话确认**：
      > 「我已核对红线规则，本次修改在 `[具体文件]` 中，未触碰已知噪音和禁区。」
      然后再给出方案。

---

## 5. V2 状态（永久暂停，别碰也别接）

- **2026-07-20 起**：V2 源码（App.tsx / AppShell.tsx / nodes(30) / stores / utils / hooks 等）已压缩归档为 `src/v2/归档.zip` 并从 `src/v2/` 移走。当前 `src/v2/` 仅保留 V1 真实依赖的文件 + 少量残留。
- `src/v2/` 现存文件清单：
  - ✅ `react-bridge.ts`、`vite-env.d.ts`、`components/ErrorBoundary.tsx` —— **V1 真实依赖**（被 `main.tsx` L7/L16 引用，且在 `tsconfig` include 中），勿删。
  - `归档.zip` —— V2 源码归档，勿在 `src` 内解析。
- V2 并非"零引用"：`main.tsx` 复用了 `react-bridge.ts`（L7）和 `ErrorBoundary`（L16）作兜底与桥接；切 V2 需先解压 `归档.zip` 恢复源码，再把 `main.tsx` L41 换成 `import('./v2/App.js')`。
- **规则**：除非用户明确说"恢复/切到 V2"，否则所有工作在 V1 下进行，V2 当只读归档。

---

## 6. 后端契约（对齐参考）

- **端点契约以 `docs/04-api/api-reference.md` 为准**（已据 `localTool/src` + `App.js` grep 审计提纯）。`docs/archive/reference/PRD.md` 附录 A/B 仅是开发期规划，**PRD 不一定对，不可作事实源**，仅作历史参考。
- **实现与 PRD 的偏差（已实证）**：PRD 规划 localTool 用 `better-sqlite3`，**实际用 `sql.js`（纯 WASM，跨平台无需编译）**，别被 PRD 误导去改依赖；localTool 实际路由（`localTool/src/index.ts`）比附录 A 略多。
- 网关为内存任务库，重启即丢，属已知限制非 bug。
- ⚠ `04-api` 等审计文档是"AI 交叉提纯"，**非源码事实源**；改码前务必用 `git` + 实际打开 `App.js` / `localTool/src` 复核，行号随时构建漂移，函数真身路径才稳定。

---

## 7. 文档怎么用（trust 什么）

> 统一原则：**代码 > git > 审计文档**。审计/历史文档可能过时，引用具体事实前以实际代码为准。

| 文档 | 用途 | 信任度 |
|------|------|--------|
| `docs/archive/PROJECT_ORIGIN.md` | 项目来历 + 命名/版本澄清，**以它为准** | 🟢 高 |
| `docs/archive/ARCHITECTURE.md`（常驻版 `02-architecture.md`） | 三层架构事实，红线以本文档 §4 为准 | 🟢 高 |
| `docs/archive/FUNCTION_MAP.md` | App.js 行号索引，改画布功能前先查；行号会漂移 | 🟡 行号已漂 |
| `docs/func-mapping.txt` / `docs/var-mapping.txt` | 混淆名→可读名。**定位符号先搜这俩**，别在 App.js 盲搜短名 | 🟡 字典级 |
| `docs/04-api/api-reference.md` | 端点/网关路由清单（已审计提纯，**改码前须 grep 源码复核**） | 🟡 提纯非事实源 |
| `docs/TASKS.md` | 已知 Bug/修复清单/排查任务板 | 🟢 高 |
| `docs/archive/AI01–AI13/` | 交叉审计草稿，可信线索，须 grep 源码坐实 | 🟡 线索级 |
| `docs/archive/reference/`（PRD/HANDOFF 等） | 历史工程笔记，**可能过时**，勿当真理 | 🔴 易过时 |

---

## 8. 日志在哪（排查时去哪拿）

| 来源 | 位置 | 拿法 |
|------|------|------|
| 网关 (9004) | `apimart-gateway/apimart_9004.log` + `apimart_9004.err.log` | 已落盘，直接把路径给 AI |
| localTool (18080) | 双击 `启动项目.ps1` 前台运行的窗口 | 看窗口输出；当前未落盘文件 |
| 前端画布 | 画布内「任务清单」面板（App.js 的 TaskListDrawer） | UI 内看任务运行记录；DevTools Console 可右键 Save as 存文本 |

排查时附"预期 vs 实际、触发动作"即可，定位由 AI 在代码里做。

---

## 9. git 工作区（通用原则）

- 动手前先 `git status`；`src/_engine/App.js` 的未提交改动可能就是当前在跑的逻辑，**别随意 `git checkout` 还原它**。
- 重要改动小步提交，commit message 写清（参考：`feat(localTool+engine): ...` / `fix(localTool): ...` / `docs: ...`）。

---

## 10. 给下一个 AI 的硬提醒

- **先读 `docs/archive/PROJECT_ORIGIN.md` 和本文件，再读代码。**
- 遇到没见过的报错/异常（如 `RootErrorBoundary` 异常），**先确认是不是魔改原版客户端残留导致**，别急着为消除一条报错大改代码（对照 §4.3 红线 8）。
- 不确定该改哪、能不能改时，**先问，别猜**。本项目最大坑是"AI 接手后瞎猜瞎改，把能跑的改坏"。

---

## 11. 卡帕西编码准则（通用行为约束）

> 减少常见 LLM 编码错误的 AI 行为准则，源自 Andrej Karpathy 对 LLM 编码陷阱的观察。
> **权衡**：以下准则偏向谨慎而非速度；对琐碎任务可自行判断。本节通用纪律不得违背 §4 红线。

### 11.1 编码前思考
**不要假设。不要隐藏困惑。展示权衡。**
- 明确说明假设；不确定就问。
- 多种解释并存时，全部呈现，不要默默选一个。
- 有更简单的方法就说出来，必要时提出异议。
- 不清楚就停下，指出困惑点并询问。

### 11.2 简洁优先
**用最少的代码解决问题。不要推测。**
- 不添加需求之外的功能；不为一次性代码造抽象。
- 不添加未要求的"灵活性 / 可配置性"。
- 不为不可能发生的场景做错误处理。
- 若 200 行能写成 50 行，重写。
- 自检："资深工程师会觉得这过于复杂吗？"如果是，简化。

### 11.3 精准修改
**只碰必须碰的。只清理自己造成的混乱。**
- 不"改进"相邻的代码 / 注释 / 格式；不重构没坏的东西。
- 匹配现有风格，即便你更偏好别的写法。
- 发现无关的死代码，提一句——但不要删。
- 改动产生孤儿代码时：删掉因你的改动而无用的导入 / 变量 / 函数；不删预先存在的死代码，除非被要求。
- 检验：每一行修改都应能直接追溯到用户请求。

### 11.4 目标驱动执行
**定义成功标准。循环验证直到达成。**
- 把指令式任务转为可验证目标：
  - "添加验证" → "为无效输入写测试，再让测试通过"
  - "修复 Bug" → "写重现 Bug 的测试，再让它通过"
  - "重构 X" → "确保重构前后测试都通过"
- 多步骤任务给出简短计划（`步骤 → 验证：检查项`）。
- 强成功标准让 Agent 能独立循环；弱标准（"让它工作"）需要不断澄清。

**生效标志**：diff 中不必要的改动更少、因过度复杂导致的重写更少、澄清问题在实现前而非犯错后提出。
