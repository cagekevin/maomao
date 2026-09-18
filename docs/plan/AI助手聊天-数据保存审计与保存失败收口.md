# AI 助手聊天 — 数据保存审计与"保存失败"收口

> 审计时间：2026-08-28
> 审计范围：仅 AI 助手聊天链路 + "部分数据保存失败" Toast 的统一来源
> 目的：先集中记录"哪些数据要保存"，并定位提示来源，供后续集中收口

---

## 一、待保存数据清单（AI 助手聊天）

所有持久化统一走 `src/components/base/contentStore.js`（同步 `contentSet` / 异步 `contentSetAsync`），未发现绕过统一层直写原生 localStorage 的代码。

### 1. 核心会话数据（集中落盘）

会话体（消息、线程、workflow、记忆等）全部收敛到 **一个 localStorage 键**：
`agent_conversations_{agentKey}`（agentKey = `canvas-assistant-{projectId}`）

由 `conversationState.js` 的 `persistDebounced`（300ms 防抖，pagehide 兜底 flush）统一整包序列化落盘。

| # | 数据 | 存储位置 | 关键保存函数 | 文件:行号 |
|---|------|---------|-------------|----------|
| 1 | 对话消息列表（user/assistant/tool/system，含 attachments、tool_calls） | `agent_conversations_{agentKey}` | `appendMsg` / `setHistory` / `stripStreaming` / `patchCurrentMessages` | `conversationState.js:67`、`conversationSnapshot.js:35`、`agentMessages.js:26,31,67` |
| 2 | 会话/线程历史（多对话列表 + 当前活跃 id） | `agent_conversations_{agentKey}` + `agent_active_conversation_id_{agentKey}` | `newConversation` / `switchConversation` / `deleteConversation` / `renameActiveConversation` | `conversationStore.js:48,91,99,105,118` |
| 3 | 执行分级 runMode（auto / step-confirm） | 会话体内 `conv.runMode` | `setCurrentRunMode` | `conversationAiState.js:24` |
| 4 | workflow 状态 + steer 队列 | 会话体内 `conv.workflow` | `patchCurrentWorkflow` / `wfStart/wfSteer/wfFinish` | `conversationSnapshot.js:80` |
| 5 | pending（刷新后恢复未完成任务） | 会话体内 `conv.pending` | `setCurrentPending` | `conversationSnapshot.js:99` |
| 6 | 对话级记忆 memory（summary/facts/lastPlan/全局风格契约/artifacts） | 会话体内 `conv.memory` | `setCurrentMemory` / `setCurrentGlobalContract` / `setCurrentArtifacts` | `conversationSnapshot.js:114`、`conversationAiState.js:43,65` |
| 7 | Skill 三阶段策划暂存 pendingGenerations | 会话体内 `conv.pendingGenerations` | `setActivePendingGenerations` | `conversationSkillState.js:23` |
| 8 | Skill 确认态 awaitingConfirm | 会话体内 `conv.awaitingConfirm` | `setAwaitingConfirm` | `conversationSkillState.js:38` |
| 9 | 项目记忆建议暂存 pendingMemorySuggest | 会话体内 `conv.pendingMemorySuggest` | `setActivePendingMemorySuggest` | `conversationSkillState.js:53` |
| 10 | 积分确认门禁 creditGate（per-conversation） | 会话体内 `conv.creditGate` | `setCreditGate` / `clearCreditGate` | `conversationSkillState.js:74,90` |
| 11 | 本轮用户参考图引用 referenceImages | 会话体内 `conv.referenceImages` | `setCurrentRefImages` | `conversationAiState.js:114` |
| 12 | AI 撤销栈 aiUndoStack（上限 20） | 会话体内 `conv.aiUndoStack` | `pushActiveAiUndo` / `popActiveAiUndo` | `conversationAiState.js:82,94` |

> 注意：消息写入分两路——低频写（appendMsg 等）立即进防抖落盘队列；高频流式写（updateLastStreaming/endStreaming）仅通知不落盘，最终态由 `send` 的 `finally` 统一落盘。

### 2. 配置/偏好类（各自独立 localStorage 键）

| # | 数据 | 键名 | 保存函数 | 文件:行号 |
|---|------|------|---------|----------|
| 13 | AI 聊天模型选择（providerId/modelId/streamMode） | `agent_chat_model` | `saveAgentChatModel` | `settings/agentModelStore.js:29` |
| 14 | 历史回传轮数 historyTurns | `agent_history_turns` | `saveAgentHistoryTurns` | `settings/agentModelStore.js:62` |
| 15 | 用户自定义 Skill 列表 | `agent_skills` | `saveCustomSkills` / `upsertCustomSkill` / `deleteCustomSkill` | `skillStore.js:122,139,159` |
| 16 | Skill 使用次数统计 | `agent_skill_usage` | `markSkillUsed` | `skillStore.js:174` |
| 17 | Skill 启用状态 | `agent_skill_enabled` | `setSkillEnabled` / `saveEnabledMap` | `skillStore.js:196,210` |
| 18 | 长期项目记忆（用户确认后写，脱敏+上限 60 条） | `agent_project_memory_v1_{agentKey}`（异步 `contentSetAsync`） | `saveProjectMemory` / `removeProjectMemory` | `agent/runtime/projectMemoryStore.js:114,140` |
| 19 | 积分确认全局开关 creditSwitch | `agent_credit_switch` | `setCreditSwitch` | `agent/canvas/useCanvasAgentTools.js:75` |
| 20 | 生图参数 genParams（"设为默认"） | `agent_gen_params` | `setGenParams` | `agent/canvas/useCanvasAgentTools.js:54` |
| 21 | 供应商配置 / 主 endpoint 回写 | 后端 API + KV `active_api_endpoint` | `save` / endpoint 回写 | `providerStore.js:221,261` |
| 22 | 输入框草稿 agent_draft（刷新恢复） | `agent_draft` | `contentSet(AGENT_DRAFT_KEY,…)` | `AgentPanel.jsx:167,388,399,415,782` |
| 23 | 输入模式 / 面板宽度 | `agent_input_mode` / `agent_panel_width` | `setInputModeAndPersist` / width effect | `AgentPanel.jsx:208,328` |

### 关键结论

- **核心会话数据（#1–#12）全部收敛到一个键 `agent_conversations_{agentKey}`**，整包序列化。一旦该键写入失败（配额超 / 权限拒），整段会话数据就落不了盘 → 用户看到 Toast：`数据保存失败 [agent_conversations_canvas-assistant-xxx]：…`（见第二节）。
- **落盘不区分消息角色**（事实）：用户消息（user）与 AI 回复（assistant/tool）、以及用户输入在 `messages` 与 `pending` 的两份副本，均写入同一键、同一整包，**代码无按 role 分流或不同键的逻辑**（详见二-B 节事实 2、3）。因此"某类消息能存、某类存不了"不能从机制上成立——失败由整包体积是否超过配额决定。
- **现有防膨胀防线**：`conversationState.js:38` 定义 `AGENT_MSG_MAX = 60`，`appendMsg`（`conversationMessages.js:21-39`）会在超标时裁剪最旧消息，已对消息条数设上限。但记忆/artifacts/图片引用、用户输入在 `pending` 的副本等大字段**无上限**，体积随累积增长（详见二-B 节事实 3、4）。
- **积分/额度**：本仓库无用户积分余额/额度账户概念，只有"积分确认闸"（creditSwitch 全局开关 + per-conversation creditGate），属生成前确认门禁态，见 #10/#19。
- **生成结果**：AI 生图结果本身是画布节点产物，聊天侧只把结果图 URL 回填进 assistant 消息 `lastResults`（属 #1 消息体一部分，随会话键落盘），不单独持久化。

---

## 二、"数据保存失败" Toast 来源（统一收口点）

> ⚠️ 历史别名：早期文案为「部分数据保存失败，请检查浏览器存储空间/权限」，现已改为**逐 key 透传**（见第三节第 1 条，2026-08-28 完成），本文档其余处均以新文案为准。

### 触发链路（解耦，非直接 catch）

| 环节 | 文件:行号 | 说明 |
|------|----------|------|
| 发布点 | `src/components/base/storageAdapter.js:26-30` | `reportPersistFailure(key, error)` 内 `publish('persist:failed', { key, error })`（`error` 已取 `error.message`） |
| 订阅/监听 | `src/App.jsx:451-463` | `subscribe('persist:failed', (payload) => …)`，**按 key 节流**（同一 key 5s 内合并，不同 key 各自弹，不漏报） |
| Toast 文案 | `src/App.jsx:460` | `showToast(\`数据保存失败 [${key}]${error ? \`：${error}\` : ''}，请检查浏览器存储空间/权限\`, { type: 'error' })` —— **原样透传 key + error，无兜底文案** |
| 事件契约登记 | `src/components/base/contracts.js:80-85` | 声明 `persist:failed` 来源/去向/payload 为 `{ key, error }` |
| 总线实现 | `src/components/base/eventBus.js` `publish` / `subscribe` | 轻量同步广播 |

### 发布点的具体失败分支（storageAdapter.js）

`reportPersistFailure` 只在 `storageAdapter.js` 内部被调用，共 5 处写入失败分支：

- `sSet` 非插件环境：`storageAdapter.js:72` — `localStorage.setItem` 抛错
- `sSet` 插件环境异步：`storageAdapter.js:79` — `chrome.storage.local.set` 回调 `chrome.runtime.lastError`
- `sSet` 插件环境同步回退：`storageAdapter.js:86` — 异步抛错 + `localStorage` 回退也失败
- `sRemove` 非插件环境：`storageAdapter.js:95` — `localStorage.removeItem` 抛错
- `sRemove` 插件环境：`storageAdapter.js:101` / `:103`

### ⚠️ 会话键落盘的"catch 忽略"不等于静默丢失（重要）

`conversationState.js` 的 `persistDebounced`（`conversationState.js:62-70`）把 `contentSet` 包在 `try { … } catch { /* 忽略写失败 */ }` 里。**注意**：这里的 catch 只保证"写失败不阻断调用栈"，因为 `contentSet → sSet` 失败时会先 `publish('persist:failed')` 再返回，事件照常上报 → 用户照样能看到 Toast。所以会话键失败**不会被静默吞掉**，只是不会抛异常冒泡。

### 本质触发原因

**浏览器持久化写入失败**，两类：

1. **存储配额耗尽** —— `localStorage` 写满（`QuotaExceededError`）或 `chrome.storage.local` 配额用尽。文案「请检查浏览器存储空间」即指此。
2. **写入权限被拒 / 环境异常** —— 隐私模式、存储被禁用、扩展运行时上下文异常导致 setItem/存储 API 抛错。文案「/权限」即指此。

> 现版本已把失败的 `key` 与 `error.message` 透传到 Toast（如 `数据保存失败 [agent_conversations_canvas-assistant-xxx]：QuotaExceededError: …`）。AI 助手聊天链路中，会话键 `agent_conversations_{agentKey}`（数据清单 #1）是唯一整包序列化的键，体积随消息、记忆、artifacts、pending 等累积增长（详见二-B 节事实 3、4）。触发失败的具体原因需以 Toast 的 `error` 字段与 StorageMonitor 观测为准。

### 二-B 观察到的现象与代码事实（2026-08-28 起陆续补充，仅记录事实）

**用户报告的现象（未经代码验证，原样记录）**：
- 现象 A：AI 每次回复时弹出「数据保存失败 [agent_conversations_…]」，用户自己的消息能保存。
- 现象 B：用户发送很长的消息时，也会弹出同样的「数据保存失败」提示。

以上两类现象均指向同一个存储键 `agent_conversations_{agentKey}` 的写入失败，但代码层面**无法**从已实现的机制区分"是用户消息还是 AI 回复那次写入触发失败"（见下方事实 6）。

**代码事实（已查证）**：

1. **落盘是整包、单键、全有或全无**（事实）：`persistDebounced`（`conversationState.js:62-70`）将整个 `conversations` 数组经 `normalizeConversation` 后一次性 `contentSet` 写入键 `agent_conversations_{agentKey}`（`conversationState.js:30`）；`contentSet` 内部 `JSON.stringify` 成单个字符串一次性 `localStorage.setItem`（`contentStore.js:206`、`storageAdapter.js:72`）。单个 `setItem` 抛错时该键保留旧值，不存在部分写入。
2. **用户消息与 AI 回复走同一落盘入口，不按 role 分流**（事实）：`appendMsg`（user/assistant/tool 共用，`agentMessages.js:26`）→ `setCurrentSnapshot` → `commit(persist=true)` → `persistDebounced.schedule()`（`conversationState.js:168`）。AI 流式回复的 `endStreaming` 本身 `persist:false`（`conversationSnapshot.js:66-71`），最终态由 `send` 的 `finally`（`useAgentChat.js:582-584` 等）统一落盘。全仓库未发现任何按 `msg.role` 分支写入不同键或不同函数的代码。
3. **用户长消息会增大整包体积（不止一处）**（事实）：一次 `send` 中用户输入 `text` 进入 `messages[].content`（`useAgentChat.js:447/461`）与 `pending.text`（`useAgentChat.js:444`，经 `setCurrentPending` 同键落盘）两处；`draft` 在落盘时被清空（`useAgentChat.js:442/584`），不额外增容；`memory` 不存用户输入原文（`summary` 来自历史压缩）。输入 `text` 写入前**无长度校验、无截断、无拒绝逻辑**（`useAgentChat.js:420-612` 仅有空内容保护；全仓 `maxLength`/`slice` 仅限工程名/镜头名/日志摘要，与 Agent 消息体无关）。
4. **AI 回复会向整包追加体积敏感字段**（事实）：assistant 正文、多条 `tool` 结果（`agentRuntime.js` 等处 `appendMsg({role:'tool'})`）、`lastResults` 图 URL（`execution_summary` 消息）、收尾 `setCurrentMemory` 写回 `summary`/`lastPlan`/`global_contract`/`artifacts`（`useAgentChat.js`、`conversationSnapshot.js:114`）。这些均在同一次整包落盘前累积进 `conversations`。
5. **写入失败事件 payload 不含角色信息**（事实）：`persist:failed` 的 payload 仅 `{ key, error }`（`storageAdapter.js:28`、`contracts.js:80-85`），无 `role` / `messageId` / `send` 序号 / 时间戳（除 toast 节流用的 `Date.now()`，不随 payload 上报）。因此**从事件本身无法判定失败是哪条消息/哪次 send 触发的**。
6. **无线上统计/埋点记录该失败**（事实）：`persist:failed` 唯一订阅点是 `App.jsx:453`（仅 `showToast`，同 key 5s 节流）；`reportPersistFailure` 自身无 logger。仓库内其它 `persist-fail` 日志（PromptNode/ taskStore/ providerStore/ d3dPersistence）与该事件无关联，且不记录此事件的 key/error。

**待验证（非事实，未下结论）**：
- 现象 A 与现象 B 是否为同一根本原因（整包体积达到 localStorage 配额上限）触发，需结合 StorageMonitor 观测该键实时体积与 `error` 具体内容（预期为 `QuotaExceededError`）确认。
- 因代码不按角色分流、且 payload 无角色字段，**"用户消息能存、AI 存不了"无法从现有机制证实或证伪**——更稳妥的表述是：任一使整包体积超过配额的写入（无论由用户长消息还是 AI 长回复引起）都会触发同一失败提示。
- 复现/定位手段：观察 Toast 的 `error` 字段是否为 `QuotaExceededError`；在 StorageMonitor 查看 `agent_conversations_{agentKey}` 键占用是否接近上限。

**修复方向（治本，待收口，非针对特定角色）**：见第三节第 2 条——对体积敏感字段（用户输入原文在 messages 与 pending 的两份副本、`lastResults`/`artifacts`/大 `tool` 结果）做裁剪/去重/外置/分键，降低整包体积。

---

## 三、集中收口建议（待评审）

1. ~~**区分失败粒度**：当前 `persist:failed` 不区分 key，建议 payload 带上 key，Toast 层面至少能提示"会话记录保存失败"而非笼统"部分数据"。~~
   **✅ 已完成（2026-08-28）**：`storageAdapter.js` 的 `reportPersistFailure` 早已带 `{ key, error }`（非兜底透传）；`App.jsx` 全局监听器现已**原样透传失败 key 与 error**，无笼统兜底文案。
   提示形如：`数据保存失败 [agent_conversations_canvas-assistant-xxx]：QuotaExceededError: …，请检查浏览器存储空间/权限`。
   节流策略：仅「同一 key」5s 内重复合并，不同 key 各自弹出，不漏报。
2. **会话键防膨胀**：`agent_conversations_{agentKey}` 整包序列化。现有 `AGENT_MSG_MAX=60`（`conversationState.js:38`）已限制消息条数，但记忆/artifacts/图片引用等大字段**无上限**，累积易超配额。建议对大字段（lastResults 图 URL、artifacts、memory.artifacts）做裁剪/外置或分键存储。
3. **配额预警**：结合 `StorageMonitor.jsx` 在接近配额阈值时提前提示，而非等写入失败才弹错。
4. **失败重试/降级**：`contentSet` 失败时目前仅发事件，可考虑对核心会话键做内存兜底 + 下次空闲重试。

---

## 待办（集中收口阶段）

- [x] 修订 Toast 文案与 payload 透传（已完成：去掉兜底文案，逐 key 透传失败 key + error）
- [ ] 确认 #1 会话键为高频"保存失败"主因（统计线上 persist:failed 的 key 分布）
- [ ] 评估会话体分键/裁剪方案（治本：避免会话键膨胀超配额）
- [ ] 设计失败粒度提示与配额预警（如按 key 分类提示"会话记录/草稿/模型配置"等）

---

## 四、收口前准备（现状基线，供 State 1 定契约）— 2026-08-28 核查

> 本节只记录已查证的事实，供后续按"定契约→构思测试→定数据流施工"三步法执行收口时复用。
> 不在此写方案、不写代码。所有条目均可回溯到文件:行号。

### 4.1 契约现状（contracts.js 登记覆盖）

- 存储键登记区：`src/components/base/contracts.js:124-352`（`STORAGE_KEYS`），每条含 `{ domain, store, backend, [pattern], [migration], note }`，`backend ∈ {local, kv, native}`。
- AI 助手相关键**已在 STORAGE_KEYS 登记**的有：`agent_conversations_{agentKey}`(`:251`,pattern)、`agent_active_conversation_id_{agentKey}`(`:258`,pattern)、`agent_chat_model`(`:170`)、`agent_history_turns`(`:176`)、`agent_skills`(`:184`)、`agent_skill_usage`(`:190`)、`agent_skill_enabled`(`:196`)、`agent_credit_switch`([CREDIT_SWITCH_KEY] `:299`/`定义:25`)、`active_api_endpoint`(`:162`,kv)、`agent_draft`(`:287`)、`agent_input_mode`(`:293`)、`agent_panel_width`(`:281`)、`agent_history_{agentKey}`(`:307`,pattern,migration)、`canvasAgentGenParams`(`:316`)。
- **未登记的 agent 相关键（违反"先登记"约定）**：`agent_project_memory_v1_${agentKey}`（长期记忆键），定义/使用于 `src/components/agent/runtime/projectMemoryStore.js:40`（`memoryKey`），调用点 `:79,115,145,157`。STORAGE_KEYS 无对应条目/pattern；因是动态拼接键，`contentStore.checkRegistered` 仅 warning 不拦截，运行时不报错但违反约定。
- 文档原清单里的 `agent_gen_params`：仓库实际不存在该字面量，真实键为已登记的 `canvasAgentGenParams`（`:316`）——属文档记录笔误，已在此澄清。
- 无 agent 相关键标 `backend: 'native'`（native 仅 director3d 域两个键：`director3d-project` `:332`、`director3d-custom-poses` `:338`）。
- 事件登记：`persist:failed` 已在 `contracts.js:80-85` 登记（payload `{ key, error }`，from `storageAdapter.js:28`，to `App.jsx:452`）。

### 4.2 测试现状（persist:failed 相关覆盖）

- **已覆盖**：
  - `tests/unit/storageAdapter.test.js`：sSet 正常不发布(`:70`)、sSet 抛错发布且带 key(`:77`)、sRemove 抛错发布(`:87`)、扩展环境正常不发布(`:119`)、回退 localStorage 也失败才发布(`:140`)。
  - `tests/unit/persistFailedChain.test.js`：测「KV→localStorage 降级失败→publish persist:failed」集成链(`:58`/`:65`)，断言降级成功且 persist:failed 长度为 1(`:74-76`)。**注意**：它测的是降级链，不是 catch 吞错。
  - `tests/unit/contracts.test.js:239`：仅断言 EVENTS 含 `persist:failed` 字符串。
- **未覆盖（缺口）**：
  1. `contentSet` 抛错时仍 publish `persist:failed` —— 无测试（`contentStore.test.js` 全程 mock sSet，从不让 sSet 抛错）。
  2. 会话落盘失败（`conversationState.persistDebounced` 内 contentSet 抛错仍 publish）—— `conversationState.test.js` 只测正常/不触发路径(`:51`/`:62`)，无失败断言。
  3. `App.jsx` 的 `subscribe('persist:failed')` 监听器（Toast 透传 key）—— **无 `App.test.jsx`/测试文件**，零覆盖。
  4. `chrome.runtime.lastError` 回调分支（`storageAdapter.js:79`/`:101`）—— 现有测试只模拟 `set` 直接 throw（`:130`），从未模拟 `lastError` 非空，该分支零覆盖。
- grep 统计：`tests/` 下 `persist:failed` 13 处、`QuotaExceededError` 4 处、`reportPersistFailure` 0 处、`publish('persist'` 0 处（测试用 `publishMock.mock.calls` 捕获）。

### 4.3 日志缺口（AI 助手链路 / 静默 catch）

- **persist:failed 发布点与订阅点均无 logger**：`storageAdapter.js:26-30`（reportPersistFailure 无 logger）、`App.jsx:451-463`（订阅仅 toast）、`contentStore.js` 有 logger 但 persist 路径未用。事件触发时无落盘日志，只能靠 Toast。
- **`captureActiveConversation` 的 catch 全部无 logger**（`useAgentChat.js`）：`:434`、`:591`、`:600`、`:609` 四处 `try { captureActiveConversation() } catch { /* 忽略/落盘失败忽略 */ }` 均无日志。
- **`send` 的失败分支无 logger**：`useAgentChat.js:570-582` 整个 `catch (e)` 仅 `setError`/`setStatus`，无 `logger.error`。
- **`conversationState.persistDebounced` 的 catch 无 logger**（`:69` `/* 忽略写失败 */`），该文件无任何 logger 引用。
- **`skillStore.js` 整文件无 import logger**，且三处写失败 catch 无日志（`:125`/`:178`/`:197` 的 contentSet 忽略）。
- 有 logger 的对照点（已实现，可参考风格）：`taskStore.js:52`、`assetStore.js:235`、`providerStore.js:267`、`projectMemoryStore.js:89/157`、`contextCompression.js:128`、内容 `maybeCompressSummary` 内部 `.catch`(`:416`)。
- logger 接口（`src/components/base/logger.js`）：`logger.info/warn/error/log/debug`，级别映射到 console；`debug` 支持第 4 参 `{ module }` 做模块开关（默认安静、不上报后端），`info/warn/error` 用 `category` 字符串分类。

### 4.4 错误透传缺口（静默吞错 vs 漏报 persist:failed）

- **已安全（catch 包裹但经 storageAdapter，不漏报）**：共 18 处 `contentSet`/`contentSetAsync` 的 catch-忽略（`conversationState.js:66-69`/`:127-130`、`AgentPanel.jsx:167/208/328/388/399/415/782`、`VideoExtractNode.jsx:351/361`、`appSettings.js:32`、`cloudSync.js:103`、`useCanvasAgentTools.js:56/76`、`skillStore.js:178/197`、`accountsStore.js:86`）。这些失败在 `sSet` 内部已 `publish('persist:failed')`，外层 catch 只吞"抛给调用方的异常"，事件已发出。=> 不漏报，但**无 logger**（见 4.3）。
- **真·漏报缺口（绕过 storageAdapter 的原生 localStorage 写，失败不 publish）**：
  - `src/components/director3d/storage.js:42`（`writeJson` 非工程键分支 `localStorage.setItem`，失败仅 `log.error` 返回 false）。
  - `src/components/director3d/storage.js:62`（`removeKey` `localStorage.removeItem`，失败仅 `log.error`）。
  - `src/components/base/d3dPersistence.js:120`（`writeLocalJson` `localStorage.setItem`，catch 内 `return false`）。
  - 注：`accountsStore.js:272/302/304` 的 localStorage 是注入目标站点 main world，非本仓库持久化，不计缺口。
- **`contentSetAsync` 无直接 publish**：`contentStore.js:261-271` 的 `contentSetAsync` 自身无任何 `reportPersistFailure`/`publish('persist:failed')`；kv 后端失败走 `storageSet` → `reportDegrade`（非 persist:failed 事件），local 后端经 `sSet` 间接 publish。=> 异步 KV 写失败不会进 persist:failed 事件（与 #1 会话键无关，但属统一机制缺口）。
- **fire-and-forget 吞错**（无 publish、无 logger）：`projectStore.js:306/307`（`contentDeleteAsync(...).catch(()=>{})`）、`taskStore.js:257/396/403`（`.catch(()=>{})`）。

### 4.5 三步法落地的输入基线小结（事实，非方案）

- 契约层（State 1 可复用）：STORAGE_KEYS 已登记绝大多数 agent 键，唯一缺口是 `agent_project_memory_v1_*` 未登记；EVENTS 已登记 `persist:failed`。
- 测试层（State 2 可补）：contentSet 失败链、会话落盘失败、App 监听器、chrome lastError 分支均为零覆盖，是可立即补断言的"契约验证点"。
- 日志/透传层（State 1 边界界定）：persist:failed 事件本身无 logger 落盘；多个 catch-忽略点无日志但已 publish（不漏报）；director3d 三条原生写与 contentSetAsync 的 KV 路径是真正的透传缺口（漏报）。
- 与本审计根因的关系：以上均为"失败可见性"基建，不直接解决"会话键整包超配额"（第三节第 2 条治本项仍是体积问题）；但补齐后，可观测到具体 key+error，便于确认根因与验证治本方案。
