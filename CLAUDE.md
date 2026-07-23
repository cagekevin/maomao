# CLAUDE.md · 猫猫画布（猫猫AI画布魔改版）架构师工作手册

## -1. 构建方式

**唯一合法构建命令：**

```bash
npm run build
```

> ⚠️ **禁止使用 `npx vite build` 替代！** 后者比 `npm run build`（经 `cross-env` 包装）宽松，可能放过语法错误（如 import 不存在的导出、孤儿 JSX 等）。**2026-07-23 翻车记录**：用 `npx vite build` 验证通过的代码，`npm run build` 报 `invalid JS syntax`，浪费数小时回退。**改码后验证必须用 `npm run build`。**

---

## 0. 项目全局定位与第一原则

- **角色定位**：你是「猫猫AI画布」项目的核心架构师与维护者。
- **项目本质**：一个 Chrome 扩展画布工具（包含 AI 图片、视频、文本工作流），由闭源原版反编译魔改为脱离官方的本地模式。
- **运行机制**：前端跑本地引擎，AI 请求走自研网关，文件和数据走自研本地服务。
- **当前状态**：代码含大量混淆代码（反编译产物），**正在渐进式拆解中**。当前只跑 V1，V2 已永久暂停。目标是将 `App.js`（~4.4 万行）逐步拆解为可读、可维护的独立模块。
- **第一原则**：修改前先读本文档。目标是让项目越来越可读、功能越来越完整。改代码前确认影响范围，别瞎猜。

> **⚠️ 目录结构已重组（2026-07-22）**：原 `src/_engine/` 已扁平化，`App.js` / `config.js` / `entry.js` / `vendor/` 现直接位于 `src/` 根（`src/App.js`、`src/config.js`、`src/entry.js`、`src/vendor/`）。本文档及 `docs/` 常驻文档中凡出现 `src/_engine/App.js` 之处，均指 **`src/App.js`**；`src/_engine/config.js` 即 `src/config.js`。`docs/archive/` 下的历史笔记仍保留旧路径，属当时快照，以本说明与常驻文档为准。恢复基线用 `git checkout -- src/App.js`。

> **TL;DR（AI 进场速查）**
> - 可自由修改：`src/App.js`（渐进拆解，抽函数到子模块）及子模块（`src/config/`、`src/utils/`、`src/services/`、`src/components/`、`src/hooks/`、`src/contexts/`）、`src/config.js`、`localTool/src/**`、`apimart-gateway/**`
> - 保持原样不重写：`src/vendor/`（`vendor.js`/`rolldown-runtime.js` 是运行时依赖，可 import 引用，不改内容）、`dist/`（构建产物）、`reference/App.original.js`（原始参考）、`*.css`
> - 入口：前端唯一入口是 `src/entry.js`（`index.html` 直接引用）；`src/main.tsx` 已删除，不要再创建或引用。
> - 端口：前端扩展（Chrome 加载 `dist/`）· localTool `:18080` · 网关 `:9004`
> - 先读：本文件 → `docs/模块专题/README.md` → `docs/archive/PROJECT_ORIGIN.md` → `docs/02-architecture.md` → 改码前查 `docs/func-mapping.txt` + `docs/var-mapping.txt`
> - 事实源：代码 > git > 审计文档；`docs/04-api` 等是 AI 提纯，**非事实源**，改码前须 grep 源码复核
> - 已知噪音（别修）：`9004` 未实现 API 的 `404`、`RootErrorBoundary` 的 `null` 异常

---

## 1. 运行时全貌（三大进程）

系统在 `config.js` 设定 `USE_LOCAL_ENGINE=true` 时，以下三个进程协同运行：

| 进程名称 | 端口 | 核心职责 | 启动命令与方式 |
|----------|------|----------|----------------|
| 前端扩展 | `dist/` | 提供 V1 画布 UI，作为表现层加载到 Chrome。 | `npm run build`（⚠️ 唯一合法构建命令，禁止用 `npx vite build`）。将 `dist/` 加载到 Chrome。唯一入口为 `src/entry.js`（经 `index.html` 引用）。 |
| localTool 本地服务 | `127.0.0.1:18080` | 提供 KV、文件、任务、资源、代理的存储，数据落盘至 SQLite(WASM) 和磁盘。 | `cd localTool && npm run build && npm start`（或 `start.sh`）。 |
| apimart-gateway 网关 | `127.0.0.1:9004` | 接收 OpenAI 风格接口并翻译为 Lovart 调用，处理图文视频生成。 | `cd apimart-gateway && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 9004`。 |

---

## 2. 目录职责全解（改代码前必看）

| 目录/文件 | 核心职责与状态 |
|-----------|----------------|
| `src/entry.js` | ★ 前端**唯一入口**（`index.html` 直接引用）。负责解包 vendor React/ReactDOM 并挂 `window`、`接入点引导`、动态 `import('./App.js')`、`createRoot().render()`。双 React 实例问题的唯一解包点，改动须谨慎。 |
| `src/background.ts` | Service Worker，负责右键菜单和资源采集，可读 TS，必须保留别重写。 |
| `src/App.js` | ★ V1 引擎核心（当前运行，原 `src/_engine/App.js` 扁平化而来），约 4.4 万行。已**解耦拆分**：业务逻辑分散在 `src/config/`、`src/utils/`、`src/services/`、`src/components/`、`src/hooks/`、`src/contexts/` 子模块，`App.js` 本身保留混淆变量名并 `import` 这些子模块。★ 主权威运行/修改文件。 |
| `src/config.js` | 集中配置层（原 `src/_engine/config.js`），修改端点或开关时动它。 |
| `src/react-bridge.ts` | JSX runtime 桥接，从 `window.__React` 取 React 供 `@vitejs/plugin-react` 的 JSX transform 用（配合 `vite.config.ts` 的 alias）。 |
| `src/vendor/` | 第三方/运行时原版产物。可 import 引用其导出，**不要直接修改文件内容**（`vendor.js`/`rolldown-runtime.js`）。 |
| `localTool/` | 本地工具服务，基于 Node/TS，使用 sql.js(WASM) 存储。 |
| `apimart-gateway/` | AI 网关，基于 Python FastAPI。 |
| `scripts/` | 反编译/拆分辅助脚本，不是运行所需。 |
| `reference/` | 早期反编译素材/参考，以及 `App.original.js`。 |
| `docs/` | 核心文档区（详见下方文件清单）。 |
| `docs/archive/` | 审计归档。包含真实溯源文件 `PROJECT_ORIGIN.md` 和 `ARCHITECTURE.md`。 |
| `dist/` | 构建产物，❌ 严禁手动修改。 |

> **入口变更（2026-07-22，双 React 实例修复第九轮）**：原 `src/main.tsx` 已删除，入口合并进 `src/entry.js`，`index.html` 的 `<script>` 改为指向 `/src/entry.js`。不要再创建/引用 `main.tsx`。详见 `HANDOFF.md`。

**`docs/` 根目录真实文件（常被误认为在 archive/ 下）**：
- `TASKS.md` — 已知 Bug/修复清单/排查任务板（🟢 高信任）
- `func-mapping.txt` / `var-mapping.txt` — 混淆名→可读名映射表（🟡 字典级，定位符号先查这俩）
- `01-concept.md` / `02-architecture.md`（常驻版，对应 `archive/ARCHITECTURE.md`）/ `03-database.md` / `04-api/`（端点路由，提纯非事实源）/ `05-runbook.md` / `06-integration.md` / `glossary.md` / `PROJECT_LOG.md`
- `模块专题/` — 按需查阅的模块深度剖析（🟢 高信任，代码坐实）。先点 [`模块专题/README.md`](模块专题/README.md) 看目录索引，确认有没有自己要改的部分再进去。

> 同名易混：`docs/02-architecture.md`（常驻精简）与 `docs/archive/ARCHITECTURE.md`（旧审计原版）是不同文件，内容可能分叉。

---

## 3. 开发原则与边界

### 3.1 新组件编写规范（自包含样式）

**所有新建 UI 组件必须使用自包含 CSS，不依赖 Tailwind。**

原因：项目使用预编译的静态 `src/styles/tailwind.css`，没有 `tailwind.config.js` 和 JIT 编译，`gap-[16px]`、`rounded-[18px]` 等任意值写法不会生效。

标准写法：

```js
// 1. 定义 CSS 字符串（用统一前缀，如 pl- / pd-）
const STYLES = `
  .pl-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); ... }
  .pl-card { background: #1a1a1a; border: 1px solid #2a2a2a; ... }
  .pl-card:hover { border-color: #444; }
`;

// 2. 在组件 return 最外层注入 <style>
return X.jsxs("div", { className: "pl-overlay", children: [
  X.jsx("style", { children: STYLES }),
  // ... 其他 JSX，全部用 pl- 前缀类名
]});
```

规则：
- 使用语义化类名前缀（如 `pl-` = prompt library，`pd-` = prompt dropdown）
- 颜色用 hex/rgba，字体大小用 px，间距用 px
- 伪类（`:hover`、`:focus`）直接写在 CSS 字符串里
- 滚动条用统一类名 `pl-custom-scrollbar`（已在项目中定义）
- `PromptDropdown` 等小组件也复用同一个 `STYLES` 字符串，各自注入 `<style>`

**不要用的写法**：`className="gap-[16px]"`、`className="text-[#e5e5e5]"`、`className="rounded-[18px]"` 等 Tailwind 任意值语法。

### 3.2 渐进式拆解模式

`App.js` 的目标是逐步缩小，将功能模块提取为独立文件。每次拆解遵循标准模式：

- **标准拆解**：2 个文件 = `src/services/xxxManager.js`（薄数据层） + `src/components/xxx/XxxPanel.jsx`（UI 层）
- **更大拆解**：3 个文件 = service + component + hook
- **最小拆解**：1 个文件 = 纯工具函数或纯数据层
- 拆解后，`App.js` 中删除原有函数定义，改为 import 并在原位置引用
- 不改变数据通路：KV 读写、状态管理、GAS 同步键集合保持原有逻辑
- 拆解文档参考：`docs/模块专题/` 下各专题文档

### 3.2 核心边界与规范
- **修改范围**：`src/App.js`（渐进拆解，抽函数到子模块）及子模块（`src/config/`、`src/utils/`、`src/services/`、`src/components/`、`src/hooks/`、`src/contexts/`）、`src/config.js`、`src/entry.js`、`src/react-bridge.ts`。
- **保持原样不重写**：`src/vendor/`（可 import 引用导出，不改文件内容）、`dist/`（构建产物）、`reference/App.original.js`（原始参考）。
- **版本隔离**：只跑 V1，V2 已移除，不引入 V2 代码。
- **命名规范**：不修改 `App.js` 中现有的混淆短命名（如 `ii`、`Xr`）。新增变量用语义化名（`camelCase` 或 `UPPER_SNAKE`），不模仿短名。
- **代码恢复**：改坏用 `git checkout -- <file>` 恢复。

### 3.3 统一入口原则

多个入口做同一件事时，统一为一个入口。例如：提示词管理 → 设置面板 tab 和节点下拉「提示词库」都打开同一个 `PromptLibrary` 组件，不再各自实现。

### 3.4 架构与数据流
- **三层隔离**：文件/KV 走 `18080`，AI 生成走 `9004`。
- **异步契约**：AI 任务轮询 `9004`，结果通过 `uploadFile` 落盘到 `18080`，不用 CDN URL。
- **路径绝对化**：与 `18080` 交互的文件路径用绝对路径。
- **状态更新**：必要时用事件总线（`CustomEvent`），不绕过 `StorageManager`（`Q`）直接操作存储。

### 3.5 诊断规约
- **无视噪音**：别修 `9004` 未实现 API 的 `404`、`RootErrorBoundary` 的 `null` 异常。
- **先理解后修改**：改码前确认影响范围，必要时查映射表和专题文档。

---

## 4. V2 归档状态说明

- **彻底移除**：V2 源码已压缩归档（见 `归档.zip` 或历史备份），`src/v2/` 目录已**删除**。V1 实际依赖的桥接文件（`src/react-bridge.ts`、`src/vite-env.d.ts`）已留在 `src/` 根，正常使用，切勿误删。
- **重启规则**：除非用户明确要求，否则完全当做已废弃，不引入任何 V2 代码或逻辑。

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
- **经验沉淀**：每次完成一次拆解或功能改造后，把经验教训追加到 `docs/拆分计划.md` 的「翻车点」区域。记录内容：改了什么、遇到什么问题、怎么解决的、下次怎么避免。拆解完成时更新对应条目的状态。
- **AI 质量门控（改码后必跑，再交付）**：每次改动安全区代码后，**按顺序**执行以下检查，全部通过才能交付：
  - **① `npm run build`（最先跑，最重要）** — ⚠️ 只能用 `npm run build`，禁止 `npx vite build`。
  - ② 前端 / TS：`npx eslint src/config src/utils src/services src/components src/hooks src/contexts src/config.js src/react-bridge.ts`（仅报错级规则；`src/App.js` / `src/vendor` 已在 `eslint.config.js` 中忽略）。
  - ③ 网关 Python：`cd apimart-gateway && ruff check .`（需先 `pip install ruff` 或 `uv tool install ruff`）。
  - 不强制 0 warning，但不得引入新的 error 级问题；若工具未安装，在交付说明中注明「未跑 lint」。

---

## 8. 卡帕西编码准则 (Karpathy Rules)

### 8.1 编码前思考
不假设，不隐藏困惑。说明假设，多解释并存时全盘呈现，有更优解要提出，不清楚就停下询问。

### 8.2 奥卡姆剃刀 · 简洁优先
**如无必要，勿增实体。** 任何新增的依赖/文件/端点/开关，先问"删掉它有影响吗"——答不上来就是多余；多解释并存时取假设最少的那条。

### 8.3 精准修改
只碰必须碰的，匹配现有风格。拆解时清理提取后遗留的孤儿代码（App.js 中已被替代的函数/变量）。每行修改必须能追溯到明确目的。

### 8.4 目标驱动执行
定义成功标准，将任务转为可验证目标（如写测试验证）。多步骤任务先给出简短计划（`步骤 → 验证：检查项`）。

> **生效标志**：diff 中不必要的改动更少、因过度复杂导致的重写更少、澄清问题在实现前而非犯错后提出。
