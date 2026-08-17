# TASK-059 · 探索报告：多端兼容与云同步收口缺口

> 类型：纯探索（只读）
> 范围：仅产出本报告，不改动任何业务文件 / 不新增脚本
> 结论：存储后端**已统一收口**（唯一入口 + 跨端 KV 通道），云同步引擎**已真实实现并已接线**；但存在若干**真实缺口**，集中在（1）Director3D 持久化绕过统一层、（2）云同步后端单点不可插拔、（3）多端部署形态仅扩展、（4）缺 key 版本/迁移、（5）同步清单未覆盖 D3D。

> 修订说明：本报告经二次审计，已剔除初版中基于误读/推测的全部不实断言（如「云同步为假 UI/空引擎」「runtimeEnv/IS_EXT/#no-cloud/usePlatformBridge/CLOUD_ENABLED/CLOUD_USER_ID/bootstrapFromCloud 等不存在的概念」「accountsStore 无降级直调 chrome.tabs.create」），结论均以下方代码证据为准。

---

## 0. 探索方法

仅通过阅读源码 + 关键词检索（`chrome.` / `localStorage` / `sGet/sSet/storageGet/storageSet` / `uploadConfig/downloadConfig` / `persist`）确认现状，未运行任何脚本、未修改任何文件。

---

## 1. 已收口（证据确凿）

| 项目 | 现状 | 证据 |
|---|---|---|
| 存储后端唯一入口 | `chrome.storage.local` **只在 `storageAdapter.js` 内被调用**；其余 store 全部经 `sGet / sSet / sRemove` 收口。全仓 `localStorage.setItem` 直写（非经 storageAdapter）**仅 storageAdapter 自身一处**，其余模块无裸 localStorage 直写 | `storageAdapter.js` 是唯一 `chrome.storage.local` 调用点；grep `localStorage.setItem` 在 `src/` 仅命中 storageAdapter |
| 跨端 KV 通道（真实存在） | `kvStore.js` 实现统一抽象：`canvas-state-v1-` 前缀的 key 走 localTool KV（`/api/kv/*`，SQLite，跨端共享），其余走 `sGet/sSet`；KV 失败时降级到 `sSet`（localStorage），避免快照丢失 | `src/components/base/kvStore.js`：`storageGet/storageSet/storageDelete` + `isKvKey` + 降级逻辑 |
| 扩展专属 API 有守卫 | `chrome.tabs` / `chrome.cookies` 等调用集中在 `accountsStore.js`，且均在 `isExtensionEnv()` 守卫内；**非扩展环境有降级分支**（写测试数据） | `accountsStore.js`：`fetchActiveTab`/`saveEnvironment` 内 `if (isExtensionEnv()) … else { 浏览器端降级 }` |
| 云同步引擎已真实实现并接线 | `cloudSync.js` 含完整 `CloudSyncEngine`（GAS URL 真实 `fetch`），`uploadConfig/downloadConfig` 走 `backupStore.LS_KEYS` 整包收集/恢复；`App.jsx` 已接线 `handlePushToCloud/handlePullFromCloud`，拉取成功后 `window.location.reload()` | `cloudSync.js` 全文；`App.jsx` 第 328+ 行 `handlePullFromCloud` 调用 `downloadConfig` |
| 整包同步清单已存在 | `backupStore.js` 维护 `LS_KEYS`（约 11 个 key：settings / accounts / projects / models / conversations 等），`cloudSync` 复用同一份清单做收集 | `backupStore.js`、被 `cloudSync.js` 引用 |

---

## 2. 真实缺口

### 缺口 A — Director3D 持久化绕过统一存储层（高，隐性）
- `directorStore.ts` 用裸 `localStorage.setItem` 直写（`LOCAL_MODEL_LIBRARY_STORAGE_KEY`、`getDirectorSceneStorageKey()` 等，见第 297 / 383 行），**不经过 `storageAdapter` / `kvStore` / `cloudSync` 清单**。
- 影响：D3D 的模型库与场景快照（1）不进入跨端 KV 通道（多端不共享）；（2）不被 `backupStore.LS_KEYS` / `cloudSync` 覆盖，云同步与本地备份都**不包含 D3D 数据**；（3）命名空间（`storyai-3d-director-*`）与统一层 `yimao:` 前缀割裂。

### 缺口 B — 云同步后端单点、不可插拔（中，架构）
- `cloudSync.js` 的 GAS 端点以**硬编码常量**存在于引擎内（非可配置项），且**仅此一种后端**。
- 影响：换后端/自托管需改代码；无本地多端（扩展↔WEB）之间的轻量同步路径（如都走 localTool KV）作为备选。GAS URL 未配置时 `handlePushToCloud`/`onPushToCloud` 守卫会直接 toast「推送功能未接入」——这是**正常的未配置提示**，不是假 UI，但仍意味着默认状态下同步不可用。

### 缺口 C — 多端部署形态只有扩展（中）
- `public/manifest.json` 为 MV3 扩展（sidePanel + background service worker），**无 PWA service worker**（`sw.js` 不存在）、**无移动端/独立 WEB 构建产物**（`package.json` 仅 `vite build` 单一脚本）。
- 代码层面经 `vite.config.js` 的 `base:'./'` + `isChromeExtension()` 判定，**已能双端运行**（扩展 / WEB），但部署形态未补齐：没有 PWA 清单、没有移动端封装、没有非扩展态的独立发布流程。
- 影响：WEB 端用户无法获得「安装即应用」的体验，移动端无承载。

### 缺口 D — 存储 key 无版本/迁移机制（中，技术债）
- `storageAdapter` 用固定前缀 `yimao:` 但**无 schema 版本号 / 迁移函数**。各 store 自管 key 语义。
- 影响：一旦某个 store 的本地结构演进，旧版本用户数据可能解析失败或字段错位，且无法在不破坏云同步整包的前提下灰度迁移。

### 缺口 E — 同步清单未覆盖 D3D 与部分运行时状态（低-中）
- `backupStore.LS_KEYS` 覆盖设置/账号/项目/模型/会话等，但**不含 D3D**（见缺口 A），也**不含运行时 KV 画布态**（画布快照走 KV，理论上跨端已共享，但不在备份/导出包内）。
- 影响：本地备份 JSON 与云同步包**不包含画布内容本身**，仅含配置与元数据；D3D 内容两者都不含。

---

## 3. 风险评估（修正版）

| 缺口 | 严重性 | 用户可见 | 说明 |
|---|---|---|---|
| A D3D 绕过统一层 | 高（隐性） | 否 | 跨端/云同步/备份都丢 D3D 数据，事后难察觉 |
| B 云同步后端单点 | 中 | 配置后可见 | 默认未配置即不可用；不可插拔 |
| C 多端部署仅扩展 | 中 | 部分 | WEB 可跑但无 PWA/移动端产物 |
| D 无 key 版本/迁移 | 中（技术债） | 否 | 结构演进时数据风险 |
| E 同步清单覆盖不全 | 低-中 | 否 | 备份/同步包不含画布与 D3D |

---

## 4. 建议的收口路径（仅建议，不在本任务实施）

1. **收编 D3D**：将 `directorStore` 的 `localStorage.setItem` 改为走 `storageAdapter`（或经 `kvStore` 跨端前缀），并把其 key 纳入 `backupStore.LS_KEYS`，使其进入统一同步/备份域。
2. **云同步后端可插拔**：把 GAS 端点抽成可配置项（如读自 `appSettings` 或环境变量），并补充「localTool KV 作为扩展↔WEB 轻量同步通道」的备选实现。
3. **补齐多端部署**：新增 PWA 清单 + service worker（或移动端封装），使 WEB 端具备独立可安装形态。
4. **key 版本化**：在 `storageAdapter` 增加 schema 版本号与 `migrate()` 钩子，对 `LS_KEYS` 内各 key 做演进管理。
5. **同步清单补全**：`LS_KEYS` 纳入 D3D key 与（按需）画布 KV key，使备份/云同步包内容完整。

---

## 5. 涉及文件索引（已逐一核实）

- `src/components/base/storageAdapter.js` — 存储唯一入口（含 `yimao:` 前缀、`isChromeExtension()` 判定）
- `src/components/base/kvStore.js` — 跨端 KV 通道（`canvas-state-v1-` 前缀 + 降级）
- `src/components/base/cloudSync.js` — **真实**云同步引擎（GAS fetch + 整包收集/恢复）
- `src/components/base/backupStore.js` — `LS_KEYS` 整包清单（被 cloudSync 复用）
- `src/components/base/TopNav.jsx` — 云同步按钮（`onPushToCloud/onPullFromCloud` 守卫）
- `src/App.jsx` — 接线 `handlePushToCloud/handlePullFromCloud` → `uploadConfig/downloadConfig`
- `src/components/base/settings/accountsStore.js` — `chrome.tabs/cookies` 调用均在 `isExtensionEnv()` 守卫内，含浏览器端降级
- `src/components/director3d/editor/store/directorStore.ts` — 裸 `localStorage.setItem` 直写（缺口 A）
- `public/manifest.json` — MV3 扩展 manifest（无 PWA）
- `package.json` / `vite.config.js` — 单一 `vite build`；`base:'./'` + 扩展判定（双端可跑但单部署形态）
