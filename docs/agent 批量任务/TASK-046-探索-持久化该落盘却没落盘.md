# TASK-046 探索：持久化——该落盘却没落盘（最终审计版）

> 阶段：仅探索 / 只产出本报告 / 不改代码（除非你要我接着做）
> 范围：`src/` 全量持久化写入点通读 + 逐条核对"该落盘却没落盘 / 该报错却没报"缺口
> 审计时间：2026-08-17（经两轮通读 + 交叉核对，修正了初稿的错误判断）
> 配套依据：`storageAdapter.js` R1 治理、`eventBus.js`、`App.jsx` 全局监听、`kvStore.js` 分流契约

---

## 0. 结论速览

- **多数核心数据已正确落盘**，且 localStorage 路径已被 `storageAdapter` 的 **R1 系统性根因治理**兜底：任何 `sSet/sRemove` 失败都会 `publish('persist:failed')` → `App.jsx` 全局监听 → `console.warn` + 5s 节流 `toast`。所以"localStorage 写入失败无感知"基本已被平台层解决。
- **真正的无声缺口集中在 KV 路径**（localTool 后端 SQLite / HTTP fetch）：`kvSet` 失败时本层**不 publish、不 catch**，完全依赖调用方 `.catch(()=>{})`，而这些调用方几乎全包了空 catch —— 落盘失败**既无 toast 也无 console**，用户完全无感知。
- **剧本盒子/3D 导演台**等"存 node.data"的数据，落盘完全依赖画布的防抖保存（G1），属同一风险面。
- 初稿误判处已修正：剧本盒子并非独立 `sSet` 落盘；localStorage 路径静默 catch 已被 R1 事件兜底，严重度需下调；`faceMosaic` 无持久化写入，已从清单移除。

---

## 1. 持久化架构总览（双轨分流）

来源：`kvStore.js:48` `isKvKey`（key 以 `canvas-state-v1-` 开头走 KV，其余走 localStorage）。

| 数据类别 | 后端 | 写入 API | 失败是否有提示 |
|---|---|---|---|
| 画布快照（节点/边/剧本盒子/导演台数据） | localTool KV（SQLite） | `saveCanvasState` → `kvSet('canvas-state-v1-<id>')` | ❌ 无声（见 G1） |
| 项目/账号/设置/节点参数/会话/图库/技能/预设/聊天模型 | 浏览器 localStorage | `sSet` | ✅ R1 治理：toast + console.warn |
| 任务（列表/状态/结果 URL） | localTool 后端（SQLite） | `taskStore.persist` → `tasksApi` fetch | ❌ 无声（见 G2） |
| 生成结果文件（图片/文本） | localTool `/files/`（磁盘） | `saveResultToTasks`/`saveTextToTasks` → `filesApi` fetch | ❌ 无声（见 G3/G4） |
| 当前生效 endpoint（跨端） | localTool KV | `kvSet('active_api_endpoint')` | ❌ 无声（见 G7） |
| 云端同步回写 | localStorage + localTool | `cloudSync.writeLS` → `sSet` | ⚠️ 局部静默（见 G8） |

**关键区分**：
- **localStorage 路径**：`sSet` 内部失败同步 `publish('persist:failed')`，全局监听已挂钩 → 有 toast。
- **KV / fetch 路径**：`kvSet`/`filesApi`/`tasksApi` 失败是 Promise reject，本层不 publish，仅当调用方处理才可见。

---

## 2. 缺口清单（已审计，按无声严重度排序）

### 2.1 真正无声（KV / fetch 路径，落盘失败用户零感知）

| # | 文件:行 | 落盘内容 | 调用形态 | 风险 |
|---|---|---|---|---|
| **G1** | `src/App.jsx:258` | **画布快照**（节点/边/剧本盒子/导演台全部数据） | `saveCanvasState(...).catch(() => {})` | 防抖自动保存的**唯一**落盘点；KV 写入失败（后端挂/磁盘满）被吞，刷新可能丢全部改动，无任何提示 |
| **G2** | `src/components/base/taskStore.js`（全部 `persist`：`createTask`/`updateTaskStatus`/`saveResult`/`deleteTask`/`flush`） | **任务数据**（后端 SQLite） | `persist(task).catch(() => {})` | 任务新建/状态/结果 URL 落库失败被吞，前端显示成功后端没存 |
| **G3** | `src/components/TextNode.jsx:189` | **文本生成结果文件**（`/files/`） | `saveTextToTasks(...).catch(() => {})` | 结果文本落盘失败被吞；任务 URL 已存后端，但本地文件缺失 |
| **G4** | `src/components/PromptNode.jsx:183` | **图片生成结果文件**（`/files/`） | `saveResultToTasks(...).then(...).catch(() => {})` | 图片文件落盘失败被吞 |
| **G7** | `src/components/base/settings/providerStore.js:189` | **当前生效 API endpoint**（KV，跨端） | `kvSet('active_api_endpoint', ...).catch(() => {})` | 主供应商 endpoint 写 KV 失败被吞，跨端读取可能用旧 endpoint |
| **G12** | `src/components/PromptNode.jsx:110`（含 `:112`） | 节点 `imageUrl` 回写（来源命中历史任务） | `patchData({ imageUrl: ... }).catch(() => {})` | 节点回写落盘失败被吞（最终依赖画布 G1） |

### 2.2 localStorage 路径——已被 R1 治理兜底，但仍有"降级为内存"的静默写法

下列位置虽用 `try { sSet } catch {}` 静默吞异常，但 `sSet` 内部**已先同步 `publish('persist:failed')` 并触发 toast**，故失败**对用户有感知**；真正的问题是：调用方 catch 把 `sSet` 抛出的异常吞了，后续逻辑误以为"已保存成功"继续执行（逻辑幻觉）。严重度低于 2.1。

| # | 文件:行 | 落盘内容 | 备注 |
|---|---|---|---|
| G5 | `src/components/base/promptManager.js:46` | 提示词预设 | `try { sSet } catch {}`；隐私模式失败已 toast，但写后逻辑继续 |
| G6 | `src/components/base/backupStore.js:71` | 备份导入回写 | 同上 |
| G10 | `src/components/base/settings/agentModelStore.js:39` | AI 聊天模型偏好 `agent_chat_model` | 同上（初稿曾误判为"已正确落盘"，更正） |
| G11 | `src/components/base/useCanvasAgentTools.js:44` | AI 生成参数 `GEN_PARAMS_KEY` | `catch { /* 持久化失败仅降级为内存 */ }` —— 注释明示降级内存，失败有 toast 但数据仅留内存 |

### 2.3 云端同步回写——写回本地失败静默

| # | 文件:行 | 落盘内容 | 备注 |
|---|---|---|---|
| G8 | `src/components/base/cloudSync.js:101` `writeLS` | 云端 → 本地回写（全量用户配置） | `catch { /* ignore */ }`；sSet 内已 publish，但 restoreLocal 循环里失败条目静默跳过 |
| G9 | `src/components/base/cloudSync.js:154,163,170` `restoreLocal` | 项目/API/providers 回写 | 每项 `catch {}` 静默跳过；±1 条失败不影响整体，但无汇总提示 |

> 注：G8/G9 的 sSet 失败仍会触发 R1 toast，故"无声"程度弱于 KV 路径，主要风险是"部分键回写失败未汇总告知"。

### 2.4 降级路径的潜在落盘（影响小）

| # | 文件:行 | 内容 | 备注 |
|---|---|---|---|
| G13 | `src/components/VideoExtractNode.jsx:305,315` | `mutiwindow-clipboard` 多窗复制降级 | clipboard 失败才 `sSet`；sSet 本身未包 catch，若 localStorage 也失败则最终丢，但属复制降级路径，影响极小 |

---

## 3. 纯内存缺口（未落盘，部分可接受）

| # | 位置 | 未落盘内容 | 是否需修 |
|---|---|---|---|
| M1 | `src/components/Director3DNode.jsx:94` `handleExit` | 3D 导演台**编辑中**状态（相机/全景/场景）只在内存，必须点"退出"才 `setNodes` 回写 `data.directorProject` + 缩略图 | ⚠️ 编辑完直接刷新/关页丢本次编辑。建议退出前拦截提醒或定时落盘 |
| M2 | 节点拖拽中间态 / 输入框输入中 | React 内存态，依赖 600ms 防抖 `persistCanvas` | ✅ 可接受（防抖已覆盖，见 `App.jsx:274`） |
| M3 | `src/components/PromptNode.jsx:133` `loadProviders().catch(() => {})` | 供应商列表加载失败被吞 | ⚠️ 非持久化但同类"沉默失败"；供应商加载失败用户无提示，建议至少 `console.warn` |

---

## 4. 已正确落盘（核对通过，无需改）

| 数据 | 落盘证据 |
|---|---|
| 项目列表 | `projectStore.js` 全程 `sSet('projects', ...)`，失败有 R1 toast |
| 账号环境 | `accountsStore.js` `sSet('yimao_accounts')` / `sSet('activeAccountId')` |
| 应用设置 | `appSettings.js` → `sSet('app_settings')` |
| 节点参数记忆 | `nodePrefs.js` `sSet('yimao_node_prefs')` |
| 会话历史 | `conversationStore.js` `sSet(agentKey)` |
| 图库 | `assetStore.js` `sSet('yimao_asset_library')` |
| 技能 | `skillStore.js` `sSet('agent_skills')` / `sSet('agent_skill_usage')` |
| 提示词预设 | `promptManager.js` `sSet`（写本身 OK，G5 仅静默 catch 但已 toast） |
| 画布快照 | `saveCanvasState` → KV（写本身 OK，问题在吞错 G1） |
| 剧本盒子 | **仅存 `node.data`**（`useScriptBoxData.js` `updateData` → `setNodes`），落盘归并到画布 G1，**无独立 localStorage/KV 键**（初稿误判已修正） |
| 3D 导演台 | 编辑结果经 `setNodes` 回写 `node.data`，落盘归并到画布 G1 |
| 当前 AI 聊天模型 | `agentModelStore.js` `sSet('agent_chat_model')`（G10 静默 catch 但已 toast） |
| 生成参数记忆 | `useCanvasAgentTools.js` `sSet(GEN_PARAMS_KEY)`（G11 降级内存但已 toast） |

---

## 5. 评估与修复建议（按无声严重度排序）

**核心洞察**：修复应分两层——
- **KV/fetch 路径**（G1/G2/G3/G4/G7/G12）：这些**没有任何兜底**，必须改。统一在调用处加 `onPersistError` 辅助（打 console.error + 节流 toast「XXX 保存失败」），不要空 catch。
- **localStorage 路径**（G5/G6/G10/G11）：R1 已 toast，可保留静默 catch，但建议把 `catch {}` 改为 `catch(e){ console.warn(...); /* sSet 已上报 persist:failed */ }`，避免"逻辑幻觉"。

**优先级：**

1. **【最高】G1 画布快照吞错** —— 用户最多数据在此。改 `.catch(()=>{})` → `.catch(err => { console.error('[Canvas] 保存失败', err); toast('画布自动保存失败，请检查本地服务') })`。
2. **【最高】G2 任务后端吞错** —— `persist` 失败改为 `console.error` + （可选）标记任务为"未同步"重试。
3. **【高】G3/G4 生成结果文件吞错** —— 落盘失败 `console.error`；可选把结果 data 保留在节点（不只落文件）。
4. **【高】G7 active_api_endpoint 吞错** —— `kvSet(...).catch(e => console.error('[Provider] endpoint 同步失败', e))`。
5. **【中】G12 节点 imageUrl 回写吞错** —— 同 G1 处理。
6. **【低】G8/G9 云端回写** —— 汇总失败条目数，回写结束给一个 toast「N 项恢复失败」。
7. **【提示】M1 导演台退出前丢编辑** —— 退出前 `confirm` 或编辑中定时 `setNodes` 落盘。
8. **【提示】M3 供应商加载吞错** —— `loadProviders().catch(e => console.warn(...))`。

**通用改造**：新增 `src/components/base/persistError.js` 暴露 `onPersistError(scope, err)`，集中"console.error + 节流 toast"，所有 KV/fetch 落盘点统一引用，消除散落空 catch。

---

## 6. 验证方式（若后续动手）

- 单元：`tests/unit/storageAdapter.test.js` 已 mock `setItem` 抛错验证 `persist:failed` 发布。
- 手动（KV 路径）：停掉 localTool 后端 → 新建/改节点 → G1/G2/G7 应出现日志/提示而非静默。
- 手动（localStorage）：Safari 隐私模式 localStorage 不可写 → G5/G6/G10/G11 应触发 R1 toast。
- 云端：mock 回写单键失败 → G8/G9 应汇总提示。

---

## 7. 审计修正记录（相对初稿）

| 初稿判断 | 修正后 | 原因 |
|---|---|---|
| 剧本盒子经 `sSet('scriptBoxMainV2')` 落盘 | ❌ 错误。剧本盒子仅存 `node.data`，落盘归并到画布 G1，无独立键 | `useScriptBoxData.js` 只调 `setNodes`；全 src 搜 `scriptBoxMainV2` 0 命中 |
| localStorage 路径"该报错却没报" | ⚠️ 下调严重度。R1 治理已 `publish('persist:failed')` + App 全局 toast 兜底 | `storageAdapter.js:40` `reportPersistFailure` + `App.jsx:421` 监听 |
| 存储层用 `console.error('persist:failed')` | ⚠️ 修正为 `publish('persist:failed')` 事件（非 console.error），由 App 节流转 console.warn + toast | 读 `storageAdapter.js` 与 `App.jsx` 实际实现 |
| `faceMosaic` 列入图库落盘 | ❌ 移除。`faceMosaic.js` 无任何 sSet/kvSet，仅检测器加载 | 搜索确认无持久化写入 |
| 遗漏 `providerStore` 的 `active_api_endpoint` | ➕ 新增 G7 | `kvSet(...).catch(()=>{})` |
| 遗漏 `cloudSync` 回写静默 | ➕ 新增 G8/G9 | `writeLS` / `restoreLocal` catch |
| 遗漏 `agentModelStore` / `useCanvasAgentTools` 静默 catch | ➕ 新增 G10/G11 | 补充通读 |
| 遗漏 `PromptNode` 的 `patchData` 回写吞错 | ➕ 新增 G12 | `:110` `.catch(()=>{})` |
| 遗漏 `VideoExtractNode` 复制降级落盘 | ➕ 新增 G13 | `:305/315` |

---

## 8. 产出物

- 本报告（探索结论 + 审计后缺口表 + 修复建议），未改动任何 `src/` 代码。
- 待你确认是否进入"修复"阶段（建议按第 5 节优先级逐个改，KV 路径为必改项）。
