# TASK-045 探索 · 数据存储「该走 KV 却没走 KV」缺口分析（最终版）

> 类型：只读探索（**未修改任何业务代码**）
> 标准：按项目隔离的画布/节点/边核心数据应走 localTool KV；含大体积或增长式的数据不应落 localStorage。
> 方法：通读分流核心（`kvStore` / `storageAdapter` / `projectStore` / `App.jsx`），全量 grep 落盘点，
>       交叉核对 `backupStore` 备份清单与 `cloudSync` 同步范围，并对齐 `reference-1mao` 官方实现。

---

## 0. 分流机制（精确基线，已实测）

分流由 **key 前缀** 决定，来自 `src/components/base/kvStore.js`：

```js
// kvStore.js:20-51
export const CANVAS_STATE_PREFIX = 'canvas-state-v1-'
export function isKvKey(key) { return typeof key === 'string' && key.startsWith(CANVAS_STATE_PREFIX) }

// storageSet/storageGet/storageDelete：isKvKey → localTool KV(/api/kv/*)；否则 → chrome.storage/localStorage
```

- **只要 key 以 `canvas-state-v1-` 开头**，统一存储层（`storageSet` 等）自动路由到 localTool KV（SQLite，跨端共享）。
- 其余 key（配置/用户/会话/素材）→ 浏览器 `localStorage`（插件环境经 `chrome.storage.local`，见 `storageAdapter.js`）。
- ⚠️ **分流与 `api.config.json` 的 `kv.enabled/kv.mode` 无关**——`kvStore.js` 里没有任何读取该配置的分支；该配置可能是 localTool 服务端的开关，前端始终按前缀分流。
- 也支持**显式调用** `kvSet/kvGet/kvDelete` 把非 `canvas-state-` 前缀的键直接写 KV（见 §3 范例）。

> 结论：**画布快照链路已完全正确进 KV**，且 projectStore 还做了运行时字段清理（`sanitizeNodes/Edges`，`projectStore.js:124-145`）和版本冲突检测（`_version`，`:153-164`），是高质量实现。✅

---

## 1. 已正确实现 / 非缺口（审计确认）

| 项目 | 证据 | 判定 |
|---|---|---|
| 画布快照写 KV | `projectStore.js:109-170` 经 `storageSet(CANVAS_STATE_PREFIX+id, …)` + `kvSet(\`${key}_version\`)` | ✅ 正确 |
| 无绕过 kvStore 直写 `canvas-state-` | 全 src 搜 `sSet('canvas-state` / 拼接前缀 = 0 命中 | ✅ 无逃逸 |
| 节点 data 内 base64 图片 | `useAssetDropPaste.js:69-85`：文件优先 `uploadFileToLocal`→`/files/` URL；失败才 fallback 读 dataURL，随画布进 KV（容量足够） | ✅ 设计内兜底 |
| `active_api_endpoint` 显式走 KV | `providerStore.js:183` `kvSet('active_api_endpoint', …)`（跨端当前生效 endpoint） | ✅ 正确范例 |
| 小型配置/索引（node_prefs、asset_library、app_settings、projects 列表等） | 体小，且被 `backupStore.js` `LS_KEYS` 明确纳入备份清单 | ✅ 符合分类 |

---

## 2. 缺口与风险（按严重度排序）

### 🔴 缺口 B（最高严重度，必修）：VideoExtractNode 把 base64 视频帧塞进 localStorage

- **位置**：`src/components/VideoExtractNode.jsx:293`（生成）、`:301-318`（落盘）
- **键**：`mutiwindow-clipboard`（全局共享，无项目隔离）
- **代码链**：
  ```js
  // VideoExtractNode.jsx:293
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)   // base64 JPEG
  // :305 / :315（clipboard 不可用时兜底）
  sSet('mutiwindow-clipboard', JSON.stringify({ type:'mutiwindow-images', images:[dataUrl, …] }))
  ```
- **问题**：
  1. 多张视频帧的 base64 直接进 localStorage，单次即可逼近 5MB 上限，极易 `QuotaExceededError`；且写失败被静默 `catch`（`storageAdapter` 虽已上报 `persist:failed` 事件，但复制结果**已丢失**，用户无感）。
  2. 键是全局共享键，跨项目/跨会话相互覆盖，与"按项目隔离"标准相悖。
  3. 官方 `mutiwindow_clipboard` 设计用于跨窗口传递，本不该放大体积 base64。
- **修复方向**：首选 `navigator.clipboard`（已是主路径）；移除 localStorage 兜底，或兜底时（a）限制帧数与压缩质量，（b）改用带 `projectId` 的临时 KV 键而非全局 localStorage。

### 🟡 风险 A（容量风险，建议修）：conversationStore 的 AI 会话落 localStorage

- **位置**：`src/components/base/conversationStore.js:147-158`（`commit` → `sSet`）、`:111-113`（迁移写盘）
- **键**：`agent_conversations_canvas-assistant-<projectId>`、`agent_active_conversation_id_canvas-assistant-<projectId>`
- **问题**：
  1. 会话是**按项目隔离、增长式**数据（`AGENT_MSG_MAX=60`，`conversationStore.js:41`），多轮生图后 `messages` + `referenceImages`/`attachments`（可能含 base64 或长 URL）体积可观，localStorage 5MB 上限有超限风险。
  2. 但未触发 `canvas-state-` 前缀，故按当前分流规则**不进 KV**。
- **重要澄清（非硬缺口）**：`cloudSync.js:14-19` 明确把 `agent_conversations` 列为**不同步**项（"含隐私"），官方有意将它与画布快照区分。因此"该进 KV"的判断需弱化——它的 localStorage 落盘有**官方设计依据**，真正的问题是**容量风险**而非"路线错误"。
- **修复方向**：若长会话出现超限，可将其迁到 KV（复刻 `providerStore` 的显式 `kvSet` 模式，键加 `projectId` 前缀）；迁移时保留 cloudSync 的"不同步"策略（KV 数据本就不在 cloudSync 范围，见 `cloudSync.js:14`）。

---

## 3. 可执行修复模式（供后续 TASK 复用，本次未实施）

`providerStore.js:183` 提供了"非画布数据显式进 KV"的正确样板：
```js
import { kvSet } from '../kvStore.js'
kvSet('active_api_endpoint', { providerId, name, base_url, protocol, updatedAt: Date.now() }).catch(() => {})
```
- 修复缺口 A：用 `kvSet(\`conversations:${projectId}\`, …)` 替代 `sSet(\`agent_conversations_…\`)`.
- 修复缺口 B：跨窗口帧数据改用 `kvSet(\`tmp:extract:${projectId}\`, …)` 或系统剪贴板，避免全局 localStorage。

---

## 4. 审计证据清单（可追溯）

| 文件:行 | 内容 |
|---|---|
| `kvStore.js:20-51` | 分流机制：`canvas-state-v1-` 前缀 → KV；`isKvKey` 判定 |
| `kvStore.js:53-73` | `storageSet/Get/Delete` 按 `isKvKey` 路由 |
| `projectStore.js:109-170` | 画布快照走 KV + 运行时字段清理 + 版本冲突检测 |
| `projectStore.js:156-164` | `${key}_version` 显式 `kvGet/kvSet`（KV） |
| `providerStore.js:183` | `active_api_endpoint` 显式 `kvSet`（KV 正确范例） |
| `conversationStore.js:147-158` | 会话 `commit` → `sSet`（localStorage） |
| `conversationStore.js:41` | `AGENT_MSG_MAX=60` 增长式 |
| `VideoExtractNode.jsx:293,305,315` | `toDataURL` base64 + `mutiwindow-clipboard` 写 localStorage |
| `useAssetDropPaste.js:69-85` | 文件优先上传 → `/files/` URL；base64 仅兜底且最终进 KV |
| `backupStore.js` (`LS_KEYS`) | 官方备份分类基线：配置/索引留 localStorage，画布快照留 KV |
| `cloudSync.js:14-19` | 官方同步范围：画布快照与 AI 对话**不同步**（隐私/业务数据） |
| `reference-1mao/.../Vr.jsx:2358,2827` | 官方画布键规范 `canvas-state-v1-<id>`，与本项目一致 |

---

## 5. 结论

- **画布核心数据（节点/边）已全部正确进 KV**，链路干净无逃逸，且带版本/清理加固。✅
- **1 个必修硬缺口**（B：VideoExtractNode base64 帧进 localStorage，随时 Quota 风险）+ **1 个容量风险项**（A：长会话 localStorage 超限可能）。
- 小型配置/索引维持 localStorage 现状，符合官方备份与同步分类，**非缺口**。
- 本文件为只读探索产出；修复请另开 TASK（如 TASK-049 缺口修复），不在本次改动源码。
