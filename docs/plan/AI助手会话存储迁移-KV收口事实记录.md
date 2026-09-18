# AI 助手会话存储迁移至 KV —— 事实记录

> 本文档只记录事实，不含方案、不含决策、不含代码改动建议。
> 目的：为「把 AI 助手会话数据搬出 localStorage、根治 QuotaExceededError」收口依据。

---

## 一、问题现象（事实）

- 报错：`Failed to execute 'setItem' on 'Storage': Setting the value of 'yimao:agent_conversations_canvas-assistant-proj-1787277067373' exceeded the quota.`
- 抛出方：浏览器 `localStorage.setItem`（全局配额，非单键体积）。
- 触发键：`yimao:` 前缀 + `agent_conversations_{agentKey}` 逻辑键。
- 本质：localStorage 在 Chrome 上硬上限约 **5MB / 域名**，所有 `yimao:` 键共享同一池子；该会话键是压垮池子的最后一次写入，但根因是 localStorage 总量被多键累积填满。

---

## 二、现有存储架构事实（来自代码）

### 1. 双后端分流（事实）

来源：`src/components/base/contracts.js`、`src/components/base/kvStore.js`

- `backend: 'kv'` → 走 `localTool` 的 `/api/kv/*`（底层 SQLite，磁盘持久化，无 5MB 浏览器限制）。
- `backend: 'local'` → 走浏览器 localStorage（插件环境为 chrome.storage）。
- 后端判定单一事实源：`kvStore.isKvKey(key)` 以 `contracts.js` 的 `STORAGE_KEYS` 登记表为准。

### 2. 已迁 KV 的键（事实，证明通道可用）

来源：`contracts.js` STORAGE_KEYS

| 逻辑键 | backend | 说明 |
|---|---|---|
| `canvas-state-v1-{projectId}` | kv | 画布快照 |
| `canvas-state-v1-{projectId}_version` | kv | 画布快照版本号 |
| `active_api_endpoint` | kv | 主供应商 endpoint |
| `yimao_accounts` | kv | 多开账号环境 |

→ 说明：KV 通道已稳定承载大体积业务数据，AI 会话走同一通道在架构上无新增风险。

### 3. 仍在 localStorage 的 AI 会话键（事实）

来源：`contracts.js` STORAGE_KEYS（L250–264）

```
'agent_conversations_{agentKey}':        { domain:'agent', backend:'local', pattern:true }
'agent_active_conversation_id_{agentKey}': { domain:'agent', backend:'local', pattern:true }
'agent_project_memory_v1_{agentKey}':    { domain:'agent', backend:'local', pattern:true }
```

→ 当前 `agent_conversations_*` 的 backend 是 `'local'`，所以 `isKvKey` 判定它为 local（不会误判为 kv）。

### 4. isKvKey 对 pattern 键的判定逻辑（事实）

来源：`kvStore.js` L41–65

- 精确键：`STORAGE_KEYS[key]` 存在 → 按其 `backend` 判定。
- pattern 键：遍历 `STORAGE_KEYS`，仅当 `v.pattern && v.backend==='kv'` 时，用正则模板匹配。
- 当前 `backend==='kv'` 的 pattern 模板只有：`canvas-state-v1-{projectId}`、`canvas-state-v1-{projectId}_version`。
- 结论：`agent_conversations_*` 要被识别为 KV 键，**只需把登记表里的 `backend` 从 `'local'` 翻成 `'kv'`**，`isKvKey` 的正则匹配逻辑已能自动覆盖（无需改 kvStore 代码）。

### 5. 读写入口已统一（事实）

来源：`conversationState.js`、`contentStore.js`、`kvStore.js`

- 会话落盘（写路径）走 `contentSet('agent_conversations_'+agentKey, ...)` → `contentStore.set` → 按 `getBackend(key)` 分流 → `kvStore.storageSet` / `sSet`。
- 落盘前已有 L3 预算安全网：`applyConversationBudget`（SAFE_BUDGET_BYTES=2MB）对单键投影降级（见 `volumePolicy.js`），保证单键不超 2MB，但**不解决 localStorage 总量超限**。
- **写路径的"改后端"结论成立**：落盘统一经 `contentSet`，写侧改 backend 登记表即可，`getBackend` 自动分流，无需改 conversationState。

**读取/初始化路径 ≠ 写路径（关键差异，审计补充 2026-08-28）**
- 初始化/迁移读取用**同步** `contentGet`：`initState` 读 `contentGet(convKey(k))`（conversationState.js L121）与 `contentGet(activeKey(k))`（L128），旧键迁移 `migrateLegacyGlobal` 同用 `contentGet`（L154、L162）。
- `contentStore.contentGet` 对 KV 后端：缓存未命中时直接返回 `undefined`（不发起网络请求，见 contentStore.js L181–190）。而对 local 后端，`sGet` 走 storageAdapter 同步内存缓存（启动时 `initStorage()` 预载），冷启动可读到。
- 全仓 grep 佐证：`convKey(*)` / `activeKey(*)` 的读取**只有同步 `contentGet` 一处**（`initState` / `migrateLegacyGlobal`），**不存在任何 `contentGetAsync` 读取**（contentGetAsync 仅用于 yimao_accounts / 画布 / 项目记忆 / 账号等其它键）。即会话初始化目前完全没有异步读取路径可用。
- 结论：**把 `agent_conversations_*` 翻成 kv 后端后，同步 `contentGet` 在冷启动/缓存未命中时会读到空，初始化将水化出空会话**。真正迁移需先为会话键引入异步读取（`contentGetAsync` 或读取前预载缓存）——即 §三.3"无需改 conversationState 业务代码"只对写路径成立，**读/初始化路径需要改动**。

**下游监控依赖（审计补充 2026-08-28，事实）**
- `storageQuota.js` 的 `analyzeAgentConversationPressure`（P3 配额预警）通过 `enumerateLocalEntries()` 枚举**本地存储**（chrome.storage/localStorage）统计 `agent_conversations_*` 键级占用（storageQuota.js L64–82）。它隐含假设会话键存于本地存储；迁 KV 后该监控不再能枚举到会话键，需留意其统计口径失效。

### 6. 云同步隔离事实（重要，避免副作用）

来源：`cloudSync.js`

- `agent_conversations_*` 含隐私，明确**不在云同步范围内**：注释说明「AI 会话键含隐私，本就为 pattern 键不在 getLocalKeys() 内」。
- `getLocalKeys()` 收集的 localStorage 键用于云同步上传；KV 后端键（如 accounts）由 S4 领域开关单独处理，`agent_conversations_*` 当前既不进 `getLocalKeys()` 也不进 accounts 单独收集。
- 结论：把 `agent_conversations_*` 从 local 改 kv 后端后，它**仍只存本机 localTool**，不会因此被加入云同步，隐私边界与现状一致。

### 7. KV 降级行为事实（副作用边界）

来源：`kvStore.js` storageSet L91–106

- KV 写入失败时会**降级写 localStorage 并 reportDegrade**（弹一次 toast：跨设备同步可能丢失）。
- KV 读取失败时会**降级读本地副本**（storageSet 曾降级写过的本地副本读得回）。
- 结论：迁移后若 localTool 后端不可用，会话数据降级回 localStorage（此时可能再次触发 quota，但这是极端降级路径，非主路径）。

---

## 三、收口结论（事实沉淀）

1. 根治 localStorage quota 超限的最小改动手是：把 `agent_conversations_{agentKey}`、`agent_active_conversation_id_{agentKey}` 的 `backend` 由 `'local'` 改为 `'kv'`。
2. 改登记表即被 `isKvKey` 识别：`isKvKey` 已支持 pattern 键的 kv 识别，无需改 kvStore 代码。
3. 写入口已统一经 `contentSet`（写路径业务层无感）；**但读/初始化路径用同步 `contentGet`，对 KV 键会返回 undefined，需改异步或确保缓存预载（见 §2.5 关键差异）**，非纯登记表改动。
4. 云同步边界不变（仍不含隐私会话键）。
5. 大体积数据（画布快照、账号）已验证 KV 通道稳定，会话迁 KV 属同构操作。

---

## 四、待确认/待办 → 已实施状态（2026-08-28）

> 本次已按 §三 结论执行迁移，以下事实项逐一落实：

- [x] **读取路径适配**：`conversationState.js` 水化改为异步 `hydrateAsync`（读 KV 经 `contentGetAsync`，键迁 KV 后同步 `contentGet` 缓存未命中返回 undefined），并新增 `waitHydrated(k)` 供 `useAgentChat` 恢复 effect 先等水化完成再读真实数据（否则会在空壳上恢复、丢记录）。
- [x] **具体落点**：`contracts.js` 将 `agent_conversations_{agentKey}` / `agent_active_conversation_id_{agentKey}` 的 `backend` 由 `'local'` 翻为 `'kv'`；`isKvKey` pattern 自动接管，无需改 kvStore。
- [x] **存储量一次迁移（幂等）**：`hydrateAsync` 在「KV 空 && 本地存量有数据」时把存量子一次迁入 KV（`contentSetAsync`），KV 有数据绝不覆盖；不删 local 源（保留作 KV 失败降级兜底）。
- [x] **耦合读方**：`backupStore.exportAll` 会话键收集由同步 `contentGet` 改异步 `contentGetAsync`（原同步读冷路径漏备份）。
- [x] **监控口径**：`storageQuota.analyzeAgentConversationPressure` 已弃用（恒返回 null），从 `StorageMonitor.jsx` 移除其调用与预警横幅（会话已不占本地存储）。
- [x] **竞态/失败可见机制**：`hydratedSet` 在水化完成前恒 false → persist 落盘 no-op，从时序排除未水化空写；水化/迁移读写走 `withTimeout` + `contentSetAsync`（await）并记录成败。
- [~] **`agent_project_memory_v1_{agentKey}` 未迁移**（保持 local）：独立 store（projectMemoryStore.js）本已用 `contentGetAsync`+`withTimeout`，体积上限 60 条，暂不在本次范围。

**验证（2026-08-28）**：`vitest run` 全量 2045 用例通过；`check:keys` 存储键契约校验通过；`vite build` 通过（2902 模块）。

> 附注：原 IV（旧键迁移）已在 §2.5 `hydrateAsync` 默认项目兜底分支兼容；`agent_active_conversation_id_*` 已与 conversations 同批次迁 KV。
