# CLAUDE.md · 猫猫画布（一毛AI画布魔改版）

> 给接手本项目的 AI / 协作者：**当前只跑 V1，V2 已永久暂停，别瞎改、别瞎猜。**先读它再动手。

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
│   └── reference/            # 历史工程笔记（PRD / HANDOFF / diff / 变量映射表）
└── dist/                     # 构建产物
```

---

## 3. V1 改动红线（最重要，违反就是坑）

1. **默认只改 `src/_engine/App.js`**。配置改 `config.js`，入口壳 `entry.js` 极少改。
2. **别碰**：`vendor-Cr1JWW-B.js`、`rolldown-runtime-*.js`、`captureVideoFrame-*.js`、`*.css`、`App.original.js` 等备份/第三方产物。
3. **恢复 `App.js` 基线用 `git checkout -- src/_engine/App.js`**，别复制任何备份文件（`reference/App.original.js` 仅是早期魔改快照，仅作参照）。
4. `App.js` 是混淆代码，函数/变量名（`ii()` `Xr()` `Jn()` `Oa()` 等）无稳定语义，**引用必须带行号**。
5. **新增代码用语义化命名**（如 `rawResp`、`LOCAL_ENGINE`），严禁用反编译风格短名（`U_` `W_` `G_` 是原版残留，别动）。
6. **❌ 严禁改 `dist/`**：那是 `npm run build` 的输出物，改了下次 build 即被覆盖、且浏览器加载的就是它。改动只在源码（`App.js`/`config.js`/`localTool/`/`apimart-gateway/`），改完 `npm run build` → Chrome 重新加载。有 AI 误以为要改 `dist/` 下的文件——那是错的。

---

## 4. V2 状态（永久暂停，别碰也别接）

- 位置 `src/v2/`。含一批 node 组件 tsx + 多个 Zustand store + `AppShell.tsx` + `utils/api.ts`（具体数量以目录实际为准）。
- **实际进度**：模块 1-5 的结构都搭出来了，但全是空壳/TODO——AppShell 里项目切换、accounts/资源/设置面板全是无逻辑的占位（`console.log('[AppShell] ... TODO')`）。**从未真正接业务逻辑，V2 业务入口 `AppShell` 从未被 `main.tsx` 启用。**
- `main.tsx` L41 只 `lazy import('./_engine/App.js')` 作业务入口；V2 的 `AppShell` 无任何运行路径 import。**注意**：V2 并非"零引用"——`main.tsx` 已复用 V2 的 `v2/react-bridge.ts`（L7）和 `v2/components/ErrorBoundary`（L16）作错误兜底与 React 实例桥接，仅 V2 业务 `AppShell` 未启用。切换 V2 时把 L41 换成 `import('./v2/App.js')` 即可（L3 注释已说明）。
- **规则**：除非用户明确说"恢复 V2 / 切到 V2"，否则所有工作都在 V1 下进行，V2 当只读归档。

---

## 5. 后端契约（对齐参考）

- localTool 端点全集见 `docs/reference/PRD.md` 附录 A；网关见附录 B。
- **实现与 PRD 的偏差（已实证）**：
  - PRD 规划 localTool 用 `better-sqlite3`，**实际用的是 `sql.js`（纯 WASM，跨平台无需编译）**（`localTool/src/db/database.ts`）。功能等价，别被 PRD 误导去改依赖。
  - localTool 实际路由见 `localTool/src/index.ts`（含 `/api/resources/rescan` 等，比 PRD 附录 A 略多）。
- 网关为内存任务库，重启即丢（见 `apimart-gateway/README.md` 已知限制），属已知限制非 bug。

---

## 6. 文档怎么用（trust 什么）

- `docs/PROJECT_ORIGIN.md`：项目来历，**以它为准**。
- `docs/FUNCTION_MAP.md`：**功能代码地图（App.js 行号索引）**。改画布功能前先查它，秒定位"某功能在 App.js 哪一行"，避免大海捞针式 grep 把能跑的改坏。行号会漂移，以实际打开为准。
- `docs/reference/` 里的 HANDOFF/PRD/diff/映射表：**历史笔记，可能过时**。其中 PRD 的"规划"不等于"现状"（如 §5 说的存储选型偏差）。引用具体事实前**以实际代码/git 为准**，别把文档当真理。
- `reference/`（根）：早期反编译素材 + `App.original.js`，一般不用看。

---

## 6.5 日志在哪（排查时去哪拿）

| 来源 | 位置 | 拿法 |
|------|------|------|
| 网关 (9004) | `apimart-gateway/apimart_9004.log` + `apimart_9004.err.log` | 已落盘，直接把路径给 AI |
| localTool (18080) | 双击 `启动项目.ps1` 前台运行的窗口 | 看窗口输出；当前未落盘文件 |
| 前端画布 | 画布内「任务清单」面板（App.js 的 TaskListDrawer） | UI 内看任务运行记录；DevTools Console 可右键 Save as 存文本 |

交给 AI 排查时附"预期 vs 实际、触发动作"即可，具体定位由 AI 在代码里做。

---

## 7. git 工作区（通用原则）

- 动手前先 `git status` 看清当前状态，别在脏工作区上乱 `checkout` 丢掉未提交改动。
- `src/_engine/App.js` 是 V1 魔改主线，里面的未提交改动可能就是当前在跑的逻辑，**别随意 `git checkout` 还原它**。
- 重要改动小步提交，commit message 写清（参考历史：`feat(localTool+engine): ...` / `fix(localTool): ...` / `docs: ...`）。

---

## 8. 给下一个 AI 的硬提醒

- **先读 `docs/PROJECT_ORIGIN.md` 和本文件，再读代码。**
- 遇到没见过的报错/异常（如某次运行日志里的 `RootErrorBoundary` 异常），**先确认它是不是魔改原版客户端时漏掉的东西导致的**，别急着为了消除一条报错去大改代码——大局优先。
- 不确定该改哪、能不能改时，**先问，别猜**。本项目最大的坑就是"AI 接手后瞎猜瞎改，把能跑的改坏"。
