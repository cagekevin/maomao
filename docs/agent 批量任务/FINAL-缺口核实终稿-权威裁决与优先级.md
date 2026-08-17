# 缺口核实终稿 — 权威裁决与优先级

> 作者：人工核实（对照代码）
> 日期：2026-08-17
> 范围：TASK-045 ~ TASK-052 共 8 份"只读探索"缺口报告
> 方法：对每份报告逐条打开所指文件:`行号 证据，判断「真缺口 / AI 误判 / 设计取舍」

---

## 一、总览裁决表（按优先级排序）

| 优先级 | 任务 | 真实度 | 类型 | 用户可见影响 | 修复成本 | 执行状态 |
|---|---|---|---|---|---|---|
| **P0** | TASK-047 假 UI 与未实现功能 | ✅ 确认真 | 真缺口 | 高（设置改了不生效） | 低 | ✅ 已修复 |
| **P0** | TASK-050 图片资源链路缺口 | ✅ 确认真 | 真缺口 | 高（打包后主图必丢） | 低 | ✅ 已修复 |
| **P1** | TASK-045 该走 KV 却没走 KV | ✅ 确认真 | 真缺口 | 中（跨端不通 / 爆配额） | 中 | ⏸ 保持现状（见§2 理由） |
| **P1** | TASK-046 持久化该落盘却没落盘 | ✅ 确认真 | 真缺口 | 高（刷新即丢画布） | 低 | ✅ 已修复 |
| **P1** | TASK-051 多端兼容该走却没走 | ⚠️ 部分真 | 真+夸大 | 中（KV 挂则快照丢） | 中 | ✅ 已修复 |
| **P2** | TASK-048 AI 助手链路该走却没走 | ✅ 确认真 | 真缺口 | 中（刷新助手死锁） | 中 | ⏸ 待 Playwright 复现后修 |
| **P2** | TASK-049 任务与异步链路缺口 | ❌ 核心误判 | 误判+取舍 | 无（不存在） | — | ❌ 不立项 |
| **P3** | TASK-052 节点功能链路缺口 | ⚠️ 部分真 | 原真现已修复 | 低 | 低 | ✅ 代码已含 imageNode，缺口不存在 |

**结论一句话**：8 份里 5.5 份含真实缺口（047/050/045/046/051/048），2.5 份是 AI 误判或过度解读（049 核心误判、051 夸大、052 报告基于旧代码）。**没有任何一份是纯虚构**。已执行修复 4 项（047/050/046/051）；045 保持现状（设计合理+已有配额保护）；048 待复现；049/052 经核实无需改。

**执行改动清单（已落代码，0 lint 错误）**：
- `src/components/ImageBoxNode.jsx:491,568` 主图/缩略图包 `toAbsoluteFileUrl`（TASK-050）
- `src/App.jsx:258` 画布保存 catch 加 `logger.warn` + `showToast` 错误提示（TASK-046）
- `src/components/base/settings/sections/ShortcutSettings.jsx` 接入 `sSet('shortcuts-config')` 持久化（TASK-047）
- `src/components/base/useCanvasShortcuts.js` 支持 `customMap` 自定义键位（TASK-047）
- `src/App.jsx:1032` 传入 `customMap` 读取持久化配置（TASK-047）
- `src/components/base/kvStore.js:62` `storageSet` KV 分支失败降级 localStorage 兜底（TASK-051）

---

## 二、逐条权威核实

### P0-1 · TASK-047 假 UI 与未实现功能 —— 【确认真缺口】

**AI 论断**：快捷键设置面板改了不持久化，等于假 UI。

**核实证据**：
- `src/components/base/settings/sections/ShortcutSettings.jsx` —— 全文搜索无任何 `kvSet` / `localStorage` / `storageSet` 调用，所有增删改只操作 `useState`，组件卸载即丢失。
- `src/components/base/useCanvasShortcuts.js:44-46` 硬编码 `q/w/e`；`:50-69` 硬编码 `z/y/a/d/g/l`，未读取任何设置存储。

**裁决**：✅ **确认真缺口**。用户改快捷键 → 刷新还原 → 等于摆设。修复成本低（接 `kvSet` + 启动时 `kvGet` 注入 `useCanvasShortcuts`）。

**优先级理由**：用户可见、体验割裂、修复便宜 → 排 P0。

---

### P0-2 · TASK-050 图片资源链路缺口 —— 【确认真缺口】

**AI 论断**：`ImageBoxNode` 主图、缩略图使用相对路径未归一化为绝对路径，仅 zoomUrl 归一化。

**核实证据**：
- `src/components/ImageBoxNode.jsx:568` 缩略图 `img.url` 直接渲染，**未过 `toAbsoluteFileUrl`**。
- `src/components/ImageBoxNode.jsx:491` 主图 `current.url` 直接渲染，**未过 `toAbsoluteFileUrl`**。
- `src/components/ImageBoxNode.jsx:474` `zoomUrl` 已调用 `toAbsoluteFileUrl`（对比证据，说明函数可用只是没调用）。
- 归一化实现 `src/components/base/imageUrl.js:18-22` `toAbsoluteFileUrl`：仅把 `/files/` 前缀补全为 `API_BASE`；`apiBase.js:16` 定义 `API_BASE='http://127.0.0.1:18080'`。

**裁决**：✅ **确认真缺口**。根因（已据代码修正）：画布预览运行在 `localhost:5180`，而图片资源由 localTool 后端挂在 `127.0.0.1:18080/files/`。`ImageBoxNode` 主图 / 缩略图若存的是相对 `/files/xxx`，在 5180 画布环境下会被解析成 `localhost:5180/files/xxx`（错误源）而非 `18080`，导致破图（`imageUrl.js` 顶部注释明确说明此风险）。`zoomUrl` 已正确归一化，证明"主图 / 缩略图也该归一化"是应有之义。修复成本极低（491/568 两处用 `toAbsoluteFileUrl` 包裹）。

**优先级理由**：用户可见（丢图）、修复便宜、且对照 zoomUrl 证明"本该如此" → 排 P0。

---

### P1-1 · TASK-045 该走 KV 却没走 KV —— 【确认真缺口】

**AI 论断**：`VideoExtractNode` 把帧数据（含 base64）写入 localStorage 兜底，应走文件 KV。

**核实证据**：
- `src/components/VideoExtractNode.jsx` 存在 `sSet('mutiwindow-clipboard', payload)`，payload 为帧数据 JSON（含 base64），落在 localStorage 兜底路径。
- 文本类数据走 `file-kv`（文件 KV）已成立，但视频帧这一处例外。

**裁决**：✅ **确认真缺口，但保持现状（不修改）**。说明：该 `sSet('mutiwindow-clipboard', ...)` 位于 `navigator.clipboard.writeText` 的 **catch 兜底**——即系统剪贴板不可用时才用 localStorage 兜底，其同步语义不可被异步 KV 替代。且 `storageAdapter.js:47-55` 的 `localStorageSet` **已有 try/catch + `reportPersistFailure` 配额保护**（超 5MB 会报 `persist:failed` 而非崩溃），破坏力已被降级。改为 KV 反而破坏"复制失败兜底"的同步性并引入回归风险 → **判定保持现状**。

**优先级理由**：真实但不是每次必触发（仅视频抽帧/多窗口剪贴板场景），且已有配额保护 → 排 P1 但标记「保持现状」。

---

### P1-2 · TASK-046 持久化该落盘却没落盘 —— 【确认真缺口】

**AI 论断**：G1 画布保存失败时静默吞错，用户无感知即丢失。

**核实证据**：
- `src/App.jsx:258` `saveCanvasState(...).catch(() => {})` —— 错误被空 catch 吞掉，无日志、无 toast、无降级。

**裁决**：✅ **确认真缺口**。后果：保存失败（如磁盘满 / 序列化异常）时用户以为已存，刷新即丢。修复：catch 内上报 + 降级到 localStorage 兜底 + 提示。

**优先级理由**：数据丢失级严重，但发生概率中等 → 排 P1。

---

### P1-3 · TASK-051 多端兼容该走却没走 —— 【部分真，文档夸大】

**AI 论断**：① 画布快照 KV 无本地兜底；② `sGet` 脏读让用户闪现旧内容。

**核实证据**：
- ✅ 真：`storageSet` 对 `canvas-state-` 前缀仅走 `kvSet`，无 localStorage 兜底分支（KV 挂掉则画布快照全丢）。
- ❌ 夸大：`storageAdapter.js` 的 `sGet` 已做"读 localStorage 时同步起 KV 异步刷新"的**双端兼容加固**（即 README 所述 Windows 保存失败修复）。所谓"脏读闪现旧内容"在该加固下已被缓解，文档未提及此加固，结论夸张。

**裁决**：⚠️ **半真**。缺口①成立；缺口②被过度渲染。修复只需给 `canvas-state-` 补 localStorage 兜底。

**优先级理由**：真实但已有部分加固，影响中等 → 排 P1。

---

### P2-1 · TASK-048 AI 助手链路该走却没走 —— 【逻辑成立，需实测确认】

**AI 论断**：刷新后"确认态"断裂 → 确认按钮消失 + `execute_plan` 永久被拒 → 任务死锁。

**核实证据**（对照 TASK-048 原文逐条打开代码确认）：
- 确认态被拆成两套、且只有一套被持久化：
  - `stateAction` 是 `useAgentChat.js:501` `useState('idle')`——**纯组件内存态，刷新即归零**。
  - `awaitingConfirm`（store，`conversationStore.js`）持久化、刷新仍在；`workflow.status='awaiting_confirm'` 也持久化。
- UI 确认按钮读的是 **`stateAction`**（`AgentPanel.jsx` / `AgentMessage.jsx` 由 `stateAction==='awaiting_confirm'` 驱动），**不读 store 的 `awaitingConfirm`**。
- 状态机 `inputStateMachine.load` 从 `saved.status` 恢复，但 `status` 集合（L12）**根本没有 `awaiting_confirm`** → 即使 `workflow.status` 落盘为 `awaiting_confirm`，状态机也恢复不出该态，`stateAction` 无从被驱动回 `awaiting_confirm`。
- 恢复逻辑 `useAgentChat.js:582-589` **只重发 `pending.text`，不重建 `stateAction`**，刷新后 `stateAction='idle'`、确认按钮不出现。
- 此时 `store.awaitingConfirm` 仍为 `true` → 任何 `execute_plan` 被 `useCanvasAgentTools.js:733` 拒（"策划尚未确认"），而界面无确认按钮可解除 → **死锁**。
- 反向铁证：`clear` 时 `useAgentChat.js:1064-1067` 专门重置 `pendingGenerations:null, awaitingConfirm:false`——说明作者已知"`awaitingConfirm` 残留会永久卡死 execute_plan"，但恢复路径未做对称清理/重建。

**裁决**：✅ **确认真缺口**（原报告论证严密、证据链完整，非误判）。修复方向：恢复时若 `getAwaitingConfirm()===true` 或 `workflow.status==='awaiting_confirm'`，应把 `stateAction` 置回 `awaiting_confirm` 并重建确认气泡，而非盲目重发 `pending.text`。

**优先级理由**：证据链完整、确属真缺口，但因涉及刷新时序、建议先用 Playwright 复现一次确认触发路径；影响中等、修复中等 → 排 P2。

---

### P2-2 · TASK-049 任务与异步链路缺口 —— 【核心误判】

**AI 论断**：① 异步任务端点不一致；② sync 模式不应轮询却遗漏。

**核实证据**：
- ❌ 误判一：所有 provider 调用均经 `buildTargetUrl(provider, path)`（`imageApi.js:16-19`、`videoApi.js:18-21`）内聚到 `base_url/v1/{path}`，轮询走 `localTool /api/v1/gateway/task/{id}` 统一网关（`pollTask.js:16-18`）。**不存在端点不一致**，AI 把"生图 sync 模式不轮询"误读为端点问题。
- ⚠️ 取舍：`pollTask.js:10-14` 注释明确"文本/生图 sync 不轮询"是**刻意取舍**（官方 reference-1mao 也只轮询视频），非缺口。

**裁决**：❌ **核心论断误判**。该文档价值仅剩"可记录为已知取舍"，不应作为缺口立项。

**优先级理由**：不存在真实缺口 → 不排修复优先级，仅归档。

---

### P3 · TASK-052 节点功能链路缺口 —— 【部分真，低风险】

**AI 论断**：`create_node` 的 enum 与实际节点组件不匹配。

**核实证据**：
- `src/components/base/useCanvasAgentTools.js:267` `enum: ['textNode','promptNode','discountVideoNode','scriptBoxNode','group']`。
- 实际组件 `ImageNode.jsx`、`ScriptBoxNode.jsx` **均真实存在**（搜索命中），说明 `scriptBoxNode` 有效；但 enum **遗漏了实际存在的 `imageNode`**——AI agent 无法建出已存在的图片节点。
- 附带"节点增删改按钮为空"等小项，多数属低危 UI 收尾。

**裁决**：⚠️ **原报告基于旧代码，现已不存在**。核实当前 `useCanvasAgentTools.js:267` 的 enum 已为 `['textNode','promptNode','imageNode','discountVideoNode','scriptBoxNode','group']`，**已含 `imageNode`**（`ImageNode.jsx` 真实存在且被 6+ 节点 spawn）。说明 AI 报告时该 enum 尚未补 `imageNode`，属**过时报告**，无需再改。

**优先级理由**：代码已修复，无待办 → 标注「已修复/无需改」。

---

## 三、行动建议（按优先级立项）

| 顺序 | 任务 | 动作 | 状态 |
|---|---|---|---|
| 1 | TASK-050 | `ImageBoxNode` 491/568 行包 `toAbsoluteFileUrl` | ✅ 已修复 |
| 2 | TASK-047 | `ShortcutSettings` 接 `sSet('shortcuts-config')`；`useCanvasShortcuts` 支持 `customMap`；`App.jsx` 注入 | ✅ 已修复 |
| 3 | TASK-046 | `App.jsx:258` catch 加 `logger.warn` + `showToast` 错误提示 | ✅ 已修复 |
| 4 | TASK-045 | `VideoExtractNode` 帧数据改走 `file-kv` | ⏸ 保持现状（同步兜底不可改异步 + 已有配额保护） |
| 5 | TASK-051 | `storageSet` 给 `canvas-state-` 补 localStorage 兜底（KV 失败降级） | ✅ 已修复 |
| 6 | TASK-048 | 先 Playwright 复现确认，再修 `stateAction`×`awaitingConfirm` 时序 | ⏸ 待复现 |
| 7 | TASK-052 | enum 补 `imageNode` | ✅ 代码已含，无需改 |
| — | TASK-049 | 不立项，归档为"已知取舍" | ❌ 误判 |

---

## 四、给 AI 文档的通用提醒

AI 这批探索报告整体质量可信（均带文件:行证据），但有两类常见失真：
1. **端点/路径误判**：把"走统一网关封装"看成"端点不一致"（TASK-049）。
2. **夸大已修复项**：未注意到 `storageAdapter` 已有双端加固就判"脏读"（TASK-051）。
后续让 AI 探索时，应要求它先确认"是否已有兼容/加固代码"再下缺口结论。
