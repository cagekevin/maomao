# CLAUDE.md · 猫猫画布（一毛 AI 画布魔改版）

> **角色**：你是「一毛 AI 画布」项目的核心架构师与维护者。项目由闭源 Chrome 扩展反编译后重度魔改为本地模式，代码极度脆弱、含大量混淆代码。
> **第一原则**：先读本文档与 `docs/PROJECT_ORIGIN.md` 再动手；任何建议都不得违背下方「红线总纲」。当前只跑 V1，V2 已永久暂停，别瞎改、别瞎猜。

---

## 0. 一句话定位

一个 Chrome 扩展画布工具（AI 图片/视频/文本工作流），由闭源原版**反编译魔改成脱离官方的本地模式**：前端跑本地引擎，AI 请求走自研网关，文件/数据走自研本地服务。

当前**只跑 V1**（`src/_engine/` + `src/main.tsx`）；V2（`src/v2/`，TS 重写）**已永久暂停**，仅为不参与运行的半成品存档。

---

## 1. 三个进程怎么跑（运行时全貌）

| 进程 | 端口 | 作用 | 启动 |
|------|------|------|------|
| **前端扩展** | 构建产物 `dist/` 加载到 Chrome | V1 画布 UI | `npm run build` → Chrome 加载 `dist/` |
| **localTool 本地服务** | `127.0.0.1:18080` | KV/文件/tasks/resources/proxy/jianying，数据落 SQLite(WASM) + 磁盘 | `cd localTool && npm run build && npm start`（或 `start.sh`） |
| **apimart-gateway 网关** | `127.0.0.1:9004` | OpenAI 风格接口 → 翻译为 Lovart 调用，文/图/视频生图走这 | `cd apimart-gateway && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 9004` |

`config.js` 中 `USE_LOCAL_ENGINE=true` 时：KV/文件走 `:18080`，AI 生成请求走 `:9004`。

---

## 2. 目录职责（改之前先看清属于哪块）

```
maomao/
├── src/
│   ├── main.tsx              # V1 入口。lazy 加载 _engine/App.js，用 v2/components/ErrorBoundary 包裹
│   ├── background.ts         # Service Worker（右键菜单/资源采集，可读 TS，保留别重写）
│   ├── _engine/              # ★ V1 引擎（当前运行）。反编译魔改产物
│   │   ├── App.js            # ★ 唯一权威运行/修改文件（全部业务逻辑，约 1.8MB 混淆代码）
│   │   ├── config.js         # 集中配置层（端点/开关），改配置动它
│   │   ├── entry.js          # 入口壳（接入点引导等），极少改
│   │   ├── vendor-Cr1JWW-B.js / rolldown-runtime-*.js / captureVideoFrame-*.js / *.css  # 别改
│   └── v2/                   # ⏸ V2 永久暂停存档（见 §4）
├── localTool/                # 本地工具服务（:18080，V1/V2 共用），Node/TS，sql.js(WASM) 存储
├── apimart-gateway/          # AI 网关（:9004，Python FastAPI）
├── scripts/                  # 反编译/拆分辅助脚本（deobfuscate / split-nodes 等），不是运行所需
├── reference/                # 早期反编译素材/参考（archived/decompiled/mediapipe/models）+ App.original.js
├── docs/
│   ├── PROJECT_ORIGIN.md     # 项目来历 + 命名/版本澄清（本文件的事实来源之一）
│   ├── ARCHITECTURE.md       # 全局→递归→交叉三层架构事实（与本文档互补，不重复红线）
│   ├── TASKS.md              # 已知 Bug/修复清单/排查建议任务板
│   └── reference/            # 历史工程笔记（PRD / HANDOFF / diff / 变量映射表）
└── dist/                     # 构建产物（❌ 严禁手改）
```

---

## 3. 红线总纲（开发维护规约 · 最高优先级）

> 以下三类红线**不可违背**。任何代码修改、架构建议都必须先过这关。
> 详细架构事实见 `docs/ARCHITECTURE.md`；已知 Bug/修复任务见 `docs/TASKS.md`。

### 3.1 🔴 核心红线（禁止越界）

1. **修改范围限制**：前端只能修改 `src/_engine/App.js`（核心逻辑）和 `config.js`（配置）。
   - 绝对禁止修改 `dist/` 目录内容；禁止修改 `vendor-*.js`、`rolldown-runtime-*.js`、`captureVideoFrame-*.js`、`*.css`、`App.original.js` 等原版保留/第三方产物。
2. **版本锁定**：项目当前严格运行在 **V1 引擎**下。V2 已永久暂停存档，**绝对禁止引入 V2 的代码或逻辑**（详见 §4）。
3. **命名红线**：
   - `App.js` 中原有的短命名（如 `ii`、`Xr`、`U_`、`W_`、`G_`）是反编译残留，无稳定语义，**禁止修改它们的名字**，定位时必须带上行号。
   - 你新增的任何变量/函数必须使用**语义化命名**（`camelCase` 或 `UPPER_SNAKE`，如 `rawResp` / `LOCAL_ENGINE`），**严禁模仿反编译风格使用单/双字母加下划线的短名**（如 `a_`、`U_`）。
4. **恢复基线**：`App.js` 改坏时用 `git checkout -- src/_engine/App.js` 恢复，别复制任何备份文件（`reference/App.original.js` 仅作参照）。

### 3.2 🏗️ 架构与数据流红线

5. **三层隔离**：认清系统边界，不要把两个服务的职责混淆。
   - 前端扩展（表现层）依赖两个**独立**服务：
     - **文件 / KV 存储** → `localTool`（端口 `18080`）
     - **AI 生成与转发** → `apimart-gateway`（端口 `9004`）
6. **异步契约（轮询 + 落盘）**：所有 AI 任务必须走**轮询机制**。
   - 提交后拿到 `task_id` → 轮询 `9004` 端口获取结果 → 结果获取后**必须通过 `uploadFile` 机制下载落盘到 `18080` 服务**。
   - **严禁直接使用 CDN URL** 当作最终结果（否则刷新/离线即丢，且破坏本地模式闭环）。
7. **路径绝对化**：与 `localTool` 交互返回的文件路径**必须是绝对路径**（如 `http://127.0.0.1:18080/files/...`）。**严格禁止使用相对路径**，以防 Chrome 扩展环境破图。
   - 已知残留问题见 `docs/TASKS.md`（P0：host 硬编码 18080、中文目录/文件名 Latin1 乱码）。

### 3.3 🛡️ 修复与诊断红线

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

## 4. V2 状态（永久暂停，别碰也别接）

- **2026-07-20 起**：V2 源码（App.tsx / AppShell.tsx / nodes(30) / stores / utils / hooks 等）已压缩归档为 `src/v2/归档.zip` 并从 `src/v2/` 移走。当前 `src/v2/` 仅保留 V1 真实依赖的文件 + 少量残留。
- `src/v2/` 现存文件清单：
  - ✅ `react-bridge.ts`、`vite-env.d.ts`、`components/ErrorBoundary.tsx` —— **V1 真实依赖**（被 `main.tsx` L7/L16 引用，且在 `tsconfig` include 中），勿删。
  - `归档.zip` —— V2 源码归档，勿在 `src` 内解析。
- V2 并非"零引用"：`main.tsx` 复用了 `react-bridge.ts`（L7）和 `ErrorBoundary`（L16）作兜底与桥接；切 V2 需先解压 `归档.zip` 恢复源码，再把 `main.tsx` L41 换成 `import('./v2/App.js')`。
- **规则**：除非用户明确说"恢复/切到 V2"，否则所有工作在 V1 下进行，V2 当只读归档。

---

## 5. 后端契约（对齐参考）

- localTool 端点全集见 `docs/reference/PRD.md` 附录 A；网关见附录 B。
- **实现与 PRD 的偏差（已实证）**：PRD 规划 localTool 用 `better-sqlite3`，**实际用 `sql.js`（纯 WASM，跨平台无需编译）**，别被 PRD 误导去改依赖；localTool 实际路由（`localTool/src/index.ts`）比附录 A 略多。
- 网关为内存任务库，重启即丢，属已知限制非 bug。

---

## 6. 文档怎么用（trust 什么）

- `docs/PROJECT_ORIGIN.md`：项目来历，**以它为准**。
- `docs/ARCHITECTURE.md`：全局→递归→交叉三层架构事实（与本文档互补，红线以本文档 §3 为准）。
- `docs/FUNCTION_MAP.md`：App.js 行号索引，改画布功能前先查它；行号会漂移，以实际打开为准。
- `docs/func-mapping.txt` / `docs/var-mapping.txt`：混淆名 → 可读名映射表（函数 52 个 + 变量全集）。**找功能/定位符号时优先先搜这两个文件**：拿到 `ii()` `Xr()` `ei` `Cr` 这类短名，先来这里查它对应什么（如 `ei = pushToCloud`、`Cr = canvasStateKey`），再决定去 App.js 哪一行改；别在 App.js 里盲搜短名。
- `docs/reference/` 与根 `reference/`：历史笔记，**可能过时**，引用具体事实前以实际代码/git 为准，别当真理。

---

## 6.5 日志在哪（排查时去哪拿）

| 来源 | 位置 | 拿法 |
|------|------|------|
| 网关 (9004) | `apimart-gateway/apimart_9004.log` + `apimart_9004.err.log` | 已落盘，直接把路径给 AI |
| localTool (18080) | 双击 `启动项目.ps1` 前台运行的窗口 | 看窗口输出；当前未落盘文件 |
| 前端画布 | 画布内「任务清单」面板（App.js 的 TaskListDrawer） | UI 内看任务运行记录；DevTools Console 可右键 Save as 存文本 |

排查时附"预期 vs 实际、触发动作"即可，定位由 AI 在代码里做。

---

## 7. git 工作区（通用原则）

- 动手前先 `git status`；`src/_engine/App.js` 的未提交改动可能就是当前在跑的逻辑，**别随意 `git checkout` 还原它**。
- 重要改动小步提交，commit message 写清（参考：`feat(localTool+engine): ...` / `fix(localTool): ...` / `docs: ...`）。

---

## 8. 给下一个 AI 的硬提醒

- **先读 `docs/PROJECT_ORIGIN.md` 和本文件，再读代码。**
- 遇到没见过的报错/异常（如某次运行日志里的 `RootErrorBoundary` 异常），**先确认它是不是魔改原版客户端时漏掉的东西导致的**，别急着为了消除一条报错去大改代码——大局优先（对照 §3.3 红线 8）。
- 不确定该改哪、能不能改时，**先问，别猜**。本项目最大的坑就是"AI 接手后瞎猜瞎改，把能跑的改坏"。
