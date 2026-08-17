# TASK-053 探索：存储与持久化收口缺口

> 性质：纯只读探索。本报告只梳理"数据存放位置 / 是否经统一存储层 / 备份与云同步覆盖情况"，不改代码、不运行脚本。
> 日期：2026-08-17
> 范围：`src/components/base/*`（store 层）、`directorStore.ts`、`kvStore.js`、`storageAdapter.js`、`localTool`（后端 KV/SQLite）、`cloudSync.js` / `backupStore.js`（两份备份权威清单）。
> 所有"文件:行"均已逐条回读源码核对（见文末"核对记录")。

---

## 0. 统一存储层事实基线

- **前端统一层** = `storageAdapter.js`（`sGet/sSet/sDelete` 封装，chrome.storage 兼容 + `persist:failed` 事件总线）+ `kvStore.js`（`kvGet/kvSet/storageGet/storageSet`，按 KV 前缀分流：带 `canvas-state-v1-` 走后端 KV，其余走 localStorage）。
- **后端存储** = `localTool/src/db/database.ts` 四表：`kv` / `tasks` / `resources` / `projects`（L295-298），SQLite，路径 `getDataDir()`。
- **两套"备份权威清单"，意图不同（关键，勿混淆）：**
  - `backupStore.js` 的 `LS_KEYS`（L29-41）：**文件导出/导入**用，求全（含 `lastOpenedProject`、`yimao_asset_library`，并通过遍历 projects 动态补 `agent_conversations_*` 与 KV 画布快照）。
  - `cloudSync.js` 的 `LS_KEYS`（L231-241）：**云同步**用，刻意排除本机/隐私键（不含 `lastOpenedProject`、不含 `yimao_asset_library`、不含 `agent_conversations_*`）。
  - 两者差异见第 2 节。

---

## 1. 现状总览表

| 数据 | 存放位置 | 经统一层？ | 进 backupStore 清单？ | 进 cloudSync 清单？ | 进 KV（后端）？ |
|------|----------|-----------|----------------------|---------------------|----------------|
| 项目列表 / 当前项目 | 双写 `localStorage('projects'/'lastOpenedProject')` + 后端 `/api/projects` | 是（sSet）+ 后端 | `projects`✓ `lastOpenedProject`✓ | `projects`✓；`lastOpenedProject`✗ | 否 |
| 画布快照 nodes/edges | KV `canvas-state-v1-<pid>` + `_version` | 是（kvSet 分流） | ✓（遍历 projects 读 KV） | ✗（明确不同步） | **是** |
| app_settings | localStorage `app_settings` | 是 | ✓ | ✓ | 否 |
| agent_skills / usage | localStorage | 是 | ✓ | ✓ | 否 |
| agent_chat_model | localStorage | 是 | ✓ | ✓ | 否 |
| prompt 预设/最近 | localStorage `yimao_preset_*` | 是 | ✓ | ✓ | 否 |
| 节点偏好 | localStorage `yimao_node_prefs` | 是 | ✓ | ✓ | 否 |
| 账号环境 | localStorage `yimao_accounts` | 是 | ✓ | ✓ | 否 |
| 素材库 | localStorage `yimao_asset_library`（仅 URL 引用） | 是 | ✓ | ✗（本地 URL 跨端无意义） | 否 |
| 任务中心 | 后端 `/api/tasks`（SQLite `tasks` 表） | 否（直连 tasksApi） | 否（不在清单） | 否 | 否（在 `tasks` 表） |
| AI 对话历史 | localStorage `agent_conversations_*` / `agent_active_conversation_id_*` | 是 | ✓（遍历 projects 动态补） | ✗（隐私） | 否 |
| 供应商/API 配置 | 后端 `/api/providers` + KV `active_api_endpoint` | 部分 | 否（`active_api_endpoint` 经 KV 但不在清单） | 否 | `active_api_endpoint` 是 |
| **3D Director 场景** | **localStorage `storyai-3d-director-desk-demo[:<id>]`（直写）** | **否（完全旁路）** | **否** | **否** | **否** |
| **3D Director 本地模型库** | **localStorage `storyai-3d-director-local-model-library`（直写）** | **否（完全旁路）** | **否** | **否** | **否** |

---

## 2. 两套权威清单的差异（务必区分）

| 键 | backupStore（导出/导入） | cloudSync（云同步） | 说明 |
|----|--------------------------|---------------------|------|
| `projects` | ✓ | ✓ | 项目列表 |
| `lastOpenedProject` | ✓ | ✗ | 本机会话；导出可带，云同步不覆盖避免串设备 |
| `app_settings` | ✓ | ✓ | |
| `agent_skills` / `agent_skill_usage` | ✓ | ✓ | |
| `agent_chat_model` | ✓ | ✓ | |
| `yimao_preset_prompts` / `yimao_preset_recent` | ✓ | ✓ | |
| `yimao_asset_library` | ✓ | ✗ | 本地 URL 引用，跨端无意义 |
| `yimao_node_prefs` | ✓ | ✓ | |
| `yimao_accounts` | ✓ | ✓ | |
| `agent_conversations_*` | ✓（动态遍历） | ✗ | 隐私，云不同步但导出可带 |
| KV 画布快照 | ✓（遍历 projects 读 KV） | ✗ | 画布本体不在 LS_KEYS，导出单独收集 |

> 结论：所谓"漏备份"不能一刀切。3D Director 键（`storyai-3d-director-*`）**两份清单都没含**，因为它既不在 `backupStore.LS_KEYS` 也不在 `cloudSync.LS_KEYS`，且不经统一层——这才是真正的第三轨未收口。

---

## 3. 关键缺口（按严重度排序）

### 缺口 A【高】`directorStore.ts` 完全绕过统一存储层
- 文件：`src/components/director3d/editor/store/directorStore.ts`
  - L177-179 定义键名：`storyai-3d-director-local-model-library`、`storyai-3d-director-desk-demo`、`storyai-3d-director-desk-demo:`（按项目前缀）。
  - L258-262 `getLocalStorageSafe()` 直接返回浏览器 `localStorage`。
  - L292-301 `writePersistedLocalModelAssets` 直写 `localStorage.setItem(LOCAL_MODEL_LIBRARY_STORAGE_KEY, ...)`。
  - L378-387 `writePersistedDirectorState` 直写 `localStorage.setItem(getDirectorSceneStorageKey(), ...)`。
- 问题：
  1. 不经 `storageAdapter`（无 `persist:failed` 上报、无 chrome.storage 插件兼容、无降级）。
  2. 键 `storyai-3d-director-*` 在 `cloudSync.js`（L231-241）和 `backupStore.js`（L29-41）两份清单均**不存在** → 既不进文件导出/导入，也不进云同步。
  3. 与 `kvStore.js` 的"KV 前缀分流"约定无关，是真正的第三轨存储。
- 影响：用户 3D 场景刷新不丢（localStorage 在），但换设备 / 清缓存 / 导出备份 / 云同步全部丢失，且故障无统一感知。

### 缺口 B【中】`projectStore` 项目列表双写、无冲突校验
- `projectStore.js`：内存唯一数据源；`persist()`（L53-60）**同时** `saveJSON(PROJECTS_KEY,...)` + `saveJSON(LAST_OPENED_KEY,...)`（底层 `sSet`，localStorage）与 `saveProjects(...)`（后端 `/api/projects`）。
  - 注：`saveJSON`→`sSet`（`storageAdapter`），非 `kvSet`；键 `'projects'`、`'lastOpenedProject'` 均经统一层。
- `initProjects()` 以**后端为准**；但 localStorage `projects` 与后端 `projects` 表**双写并存，无版本/时间戳校验**。
- 潜在不一致：后端不可达时本地改项目 → 后端恢复后又以后端覆盖，本地修改静默丢失。

### 缺口 C【中】画布快照只存 nodes/edges，不含视图态与会话态
- `projectStore.js` L122-125 `NODE_KEEP`/`EDGE_KEEP` 白名单只保留 `id/type/position/data/width/height`（节点）与 `id/source/target/.../data/label`（边）。
- 不含：视口 transform（zoom/pan）、选中态、节点折叠/UI 偏好、画布背景等。
- 对照：3D Director 反而把完整 `state`（含 viewMode/selected/camera，见其 `writePersistedDirectorState`）写 localStorage——两者"什么该持久化"口径不统一。

### 缺口 D【中】任务中心后端化但写入失败无统一感知
- `taskStore.js` `initTasks()`（L32-44）从 `/api/tasks` 加载；`persist()`（L46-49）`saveTask(task).catch(()=>{})` fire-and-forget，失败仅内存、刷新即丢。
- 后端写入失败**不**触发 `storageAdapter` 的 `persist:failed` 事件（该事件只覆盖 sSet/kvSet 失败）→ 用户无感知，与画布快照（KV 失败降级 + toast）兜底不对齐。

### 缺口 E【低】`conversationStore` 水合竞态（文件头已自述）
- `conversationStore.js` L1-26 注释：挂载早期 AgentPanel effect 用空 current 覆盖 localStorage → 刷新丢历史；用 `hydrated` 标志（`hydratedSet`）防覆盖。属已知待治理项，非新增，但属"持久化收口"范畴。

### 缺口 F【低】`useAgentChat` 旧单会话键 `agent_history_*` 迁移后未清理
- `useAgentChat.js` L186-198：`historyKey`/`loadHistory` 从 `agent_history_<agentKey>` 读一次迁移到 conversationStore；旧键读后不删除，长期残留于 localStorage（无害，属"该清未清"）。

---

## 4. 后端侧（localTool）存储分工核对
- `database.ts` L295-298：`kv` / `tasks` / `resources` / `projects` 四表。
- `kv.ts` `handleKvSet`（L23-30）：入库前经 `externalizeBase64InValue`（`base64Externalize.ts` L6-45）把 data URI 解码落盘 `uploads/canvas/`，避免大 base64 塞 SQLite——前端 `saveCanvasState` 的 `data` 字段若含 data URI，外部化依赖后端，前端无感知。
- `resources.ts` L234-236 注释：纯 dataURL 素材若不落盘则刷新丢素材；与前端 assetStore（`yimao_asset_library` 仅存 URL 引用、文件在 `uploads/`）一致——跨端同步时引用失效（已在 cloudSync 注释排除）。
- `admin.ts` L50、L74：`canvas-state-v1-*` 与 `auth_token`/`projects`/`users` 在管理重置时被保护、不误清。

---

## 5. 收口建议（供后续 TASK，非本次执行）
1. **缺口 A 必须收口**：`directorStore.ts` 改为经 `kvStore.storageSet`（或 `storageAdapter.sSet`），并把 `storyai-3d-director-*` 加入 `backupStore.LS_KEYS` 与 `cloudSync.LS_KEYS`（或改用 `canvas-state-v1-` 前缀走 KV，随项目一起备份/同步）。这是唯一确凿的"未收口"存储。
2. **缺口 B**：确认单一权威源（建议后端），前端 localStorage 仅作离线兜底并加冲突校验，或明确角色边界、在文档界定。
3. **缺口 D**：后端写失败应复用 `eventBus.publish('persist:failed')` 或等价 toast，与画布快照对齐。
4. **缺口 C/E/F**：统一"持久化白名单"规范，避免各 store 自定口径；旧 `agent_history_*` 键迁移后清理。
5. 建议新增"存储键登记表"文档/单测，回归时校验所有 `localStorage.setItem`/`storageSet`/`sSet` 都经统一层且落在备份/同步清单覆盖范围内（目前 3D Director 不在该约束内）。

---

## 6. 探索结论
统一存储层（`storageAdapter` + `kvStore` + 后端 SQLite）**已覆盖绝大多数用户数据与配置**，且备份/同步有**两份意图分明**的清单（文件导出求全、云同步避隐私/本机）。**唯一确凿的未收口点是 `directorStore.ts`**：直写 `localStorage`、`storyai-3d-director-*` 不在任何备份/同步清单、不进 KV、不经统一层，属第三轨存储。其余为双写无校验（B）、持久化白名单口径不一（C）、后端写失败无感知（D）、已知水合竞态与旧键残留（E/F）。报告仅陈述事实，未做任何修改。

---

## 核对记录（逐条回读源码确认）
- directorStore.ts：L177-179 / L258-262 / L292-301 / L378-387 ✓
- cloudSync.js LS_KEYS：L227-241 ✓（排除 lastOpenedProject / yimao_asset_library / agent_conversations_*）
- backupStore.js LS_KEYS：L29-41 ✓（含 lastOpenedProject / yimao_asset_library）；遍历 projects 补 agent_conversations_*（L49-51, L101-102）与 KV 画布快照（L106-116）；import 写回（L132-149）
- projectStore.js：persist L53-60（saveJSON→sSet + saveProjects）；saveJSON→sSet L32-34；双写声明 L1-9；NODE_KEEP/EDGE_KEEP L122-125；saveCanvasState 走 kvSet L163；删除走 storageDelete L201-202
- taskStore.js：initTasks L32-44；persist L46-49 ✓
- conversationStore.js：注释 L1-26；convKey/activeKey L38-39 ✓
- useAgentChat.js：historyKey/loadHistory L186-198 ✓
- database.ts：四表 L295-298 ✓；kv.ts handleKvSet L23-30；base64Externalize.ts L6-45；resources.ts L234-236 ✓
