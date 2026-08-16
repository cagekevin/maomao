# TASK-006 — 深度探索 AI 助手的薄弱机制（源码级审计，最终版）

> 只写本文件，不碰任何 `src/`。所有行号、片段均来自本次逐文件核实（覆盖 9 个源文件全文）。

## 一、审计范围与方法

- **逐文件通读**（非抽样）：`useAgentChat.js`（852 行）、`useCanvasAgentTools.js`（933 行）、`canvasPlanExecutor.js`（198 行）、`useNodeGeneration.js`（162 行）、`conversationStore.js`（439 行）、`storageAdapter.js`（75 行）、`inputStateMachine.js`（125 行）、`AgentPanel.jsx`（关键区段）、`taskStore.js`（retryRegistry 段）。
- **关注点**：运行时才会暴露的薄弱点——并发/竞态、状态一致性、异常恢复、性能/内存、边界、UI 交互。
- **每条结论**均附「文件 + 行号 + 真实片段 + 触发场景 + 后果」，并区分「已确认缺陷 / 设计权衡」。

## 二、探索起点（已逐个读）
- `src/components/base/useAgentChat.js`
- `src/components/base/useCanvasAgentTools.js`
- `src/components/base/canvasPlanExecutor.js`
- `src/components/base/conversationStore.js`
- `src/components/base/useNodeGeneration.js`
- `src/components/base/storageAdapter.js`
- `src/components/base/inputStateMachine.js`
- `src/components/AgentPanel.jsx`
- `src/components/base/taskStore.js`（`runNodeGeneration`/`isNodeRegistered`/`registerTaskRetry`）

---

## 三、覆盖清单（按维度）

### 1. 并发 / 竞态

#### 1.1【致命·已确认】`runToolCalls` 把异步工具当同步调用，结果被序列化为 Promise
- **机制**：`runToolCalls` 是**同步** `for` 循环，直接 `callTool(name, args)` 把返回值当 `{ok,data|error}` 回填给 LLM。但 `execute_plan` 和 `generate_node` 工具的 `execute` 是 **async**，经 `buildCanvasAgentTools` 的 `map[name] = (args) => execute(args, ctx)` 返回的是 **Promise**（注意：`executePlanTool.execute` 自带 try/catch 返回 `{ok:false,...}`，但那是**异步函数体内部**的返回，外层 `fn(args)` 拿到的仍是 Promise）。
- **代码证据**：
  - `useAgentChat.js L549-567`：`const result = callTool(tc.function?.name, args)` 后 `appendMsg({ content: result.ok ? JSON.stringify({ok:true, ...result.data}) : JSON.stringify({ok:false, error: result.error}) })`——**无 await**，`result` 是 Promise → `result.ok` 为 `undefined` → 走 else 分支。
  - `useCanvasAgentTools.js L539`：`triggerGenerationTool.execute: async (args, ctx) => {...}`。
  - `useCanvasAgentTools.js L618`：`executePlanTool.execute: async (args, ctx) => {...}`。
  - `useCanvasAgentTools.js L864-882`：`buildCanvasAgentTools` 中 `map[t.name] = (args) => { ...; return execute(args, ctx) }`，同步返回。
- **触发场景**：用户说「5 张主图 + 8 张详情」→ LLM 调 `execute_plan`。执行器**异步**改了画布（建节点、生图），但回填 LLM 的 tool 消息是 `{"ok":false,"error":undefined}`（Promise 被 JSON 化）。LLM 看到"失败"→ 重试 `execute_plan` 或道歉 → **撞 `MAX_TOOL_ROUNDS=8` 死循环**（`useAgentChat.js L666-687`），且画布被重复建节点。
- **后果**：聊天模式下的批量生图/节点生成**功能实质失效**，并重复消耗生图配额、污染画布。影响面最大、必然复现。
- **同源受影响**：`useAgentChat.js L623-647` 的 **Demo 模式** `demoPlan` 里 `callTool(p.name, p.args)` 同样同步调用（L641-643）—— Demo 模式下 `execute_plan`/`generate_node` 的 tool 消息同样是 Promise 被序列化，演示结果也不可信。
- **反例（正确写法）**：`sendImageMode` 走 `await callTool('execute_plan', ...)`（`useAgentChat.js L769`），正确；`useAgentChat.js L685-687` 的轮询等待 `waitForNodeReady` 也正确 await。说明作者并非不懂 await，而是 `runToolCalls` 漏改。

#### 1.2【已确认】`sendImageMode` 与 `send` 并发保护不互通，图像模式指令被静默吞掉
- **机制**：`send` 用 `sendingRef.current` 拦截并转 steer 队列；`sendImageMode` 共用同一 `sendingRef`，但**不进 steer 队列**，直接 `if (sendingRef.current) return`。
- **代码证据**：`useAgentChat.js L739`：`if (sendingRef.current) return`（无提示、无队列）。`sendImageMode` 整体（L735-789）无 steer 分支。
- **触发场景**：智能对话生成进行中，用户切到「图像模式」发送 → 指令被静默丢弃。
- **后果**：用户在生成中补充图像指令会无声丢失，无任何反馈。

#### 1.3【设计权衡·非缺陷】切换/新建/删除对话在生成中被整组禁用
- **机制**：`newChat`/`switchChat`/`deleteChat` 均 `if (sendingRef.current) return`（`useAgentChat.js L829 / L837 / L845`）。
- **说明**：这是**有意的并发保护**（防止切换对话打断进行中的 `messagesRef`/画布操作），且 `AgentPanel` 按钮在 `sending`（及非 steer）态下 `disabled`（`AgentPanel.jsx L382, L796-805`），不会误触发。
- **真实代价**：长任务（多轮生图）进行中，用户无法切到另一对话查看历史。属**体验权衡**，非 bug，但可通过「生成状态 per-conversation 隔离 + 允许只读切换」优化。

### 2. 状态一致性

#### 2.1【隐患·已确认】`messages`(state) 与 `messagesRef`(ref) 在 `updateLastStreaming` 中不同步
- **机制**：几乎所有写入走 `appendMsg/setHistory/endStreaming/stripStreaming`（均**同步**更新 ref）；唯独 `updateLastStreaming` 只 `setMessages`、**不更新 ref**（`useAgentChat.js L381-395`）。
- **补充**：`messagesRef` 另由 `useEffect(() => { messagesRef.current = messages }, [messages])`（`useAgentChat.js L361`）异步同步。因此 ref 会**最终**跟上 state，但存在一帧延迟。
- **当前安全性**：多轮工具循环是串行 `await`，进入下一轮前 `endStreaming` 已更新 ref（L398-405 同步更新），故**当前不崩**。
- **风险**：依赖「异步 effect 在下次读取前已跑完」这一时序假设。若未来 `runToolCalls` 改为并发执行、或 `buildRequestMessages` 在 effect 刷新前被调用，ref 会读到 streaming 中的 stale `content:''`，导致发给 LLM 的历史缺内容。文件头 L59-63 明言"任何改动必须保持两者一致"，此处是**已知脆弱点**。

#### 2.2【已确认】刷新自动重发依赖 localStorage 完整保留 dataURL 附件
- **机制**：挂载时 `pending` 恢复（`useAgentChat.js L433-440`）调用 `sendRef.current?.(pending.text, pending.attachments || [])`；`setCurrentPending` 把 attachments 原样落盘（`conversationStore.js L248-255`）。
- **代码证据**：L433-440；`conversationStore.js L242-255`。
- **触发场景**：附件是 dataURL（上传图 `AgentPanel.jsx L343` 存 dataURL）。若刷新时 localStorage 已因配额问题丢失/截断，pending 恢复会带残缺附件。
- **后果**：刷新恢复带图的未完成任务时，图可能丢失或恢复失败（与 §4.3 同源）。

#### 2.3【已确认·卡死风险】`clear()` 不重置 `awaitingConfirm`，导致后续 `execute_plan` 永久被拒
- **机制**：`clear()`（`useAgentChat.js L798-807`）只 `abort()` + `setHistory([])` + `setCurrentSnapshot({workflow:null, ...})`，**不重置当前对话的 `awaitingConfirm`**。而 `executePlanTool.execute` 在 `getAwaitingConfirm()` 为真时直接拒绝（`useCanvasAgentTools.js L622-624`）。
- **代码证据**：L804 `setCurrentSnapshot({ ... workflow: null, pending: null, memory: {...} })`——未含 `awaitingConfirm`；`conversationStore.js L203-221` 的 `setCurrentSnapshot` 在 `snap.awaitingConfirm` 缺省时保留 `conv.awaitingConfirm`（真）。
- **触发场景**：展示策划（`show_plan_for_confirm`→`setAwaitingConfirm(true)`，`useCanvasAgentTools.js L587`）后用户清空对话 → `awaitingConfirm` 仍为 `true` → 之后任何 `execute_plan` 被拒，直到切对话或刷新（hydrated 重新加载）。
- **后果**：隐蔽卡死，用户无明确提示，只看到"策划尚未确认"。

### 3. 异常恢复

#### 3.1【低概率·已确认】SSE `buffer` 末尾残留与非标准代理分块
- **机制**：`roundTrip` 按 `\n\n` 切分（`useAgentChat.js L521`）；末尾 `buffer += decoder.decode()` 再 `parseSSEChunk` 一次（L529-530）。`parseSSEChunk`（L150-172）只认 `data:` 前缀，单 chunk 内多行 `data:` 用 `\n` 而非 `\n\n` 分隔会漏解析。
- **触发场景**：`VITE_LLM_CHAT_BASE_URL` 走 `/api/proxy` 转发时，若代理把多个 SSE 事件压成单行 `\n` 分隔。
- **后果**：内容/工具调用丢失，可能让 LLM 误判。OpenAI 标准格式下安全。

#### 3.2【根因同 §1.1】async 工具异常被序列化为 Promise
- **机制**：`executePlanTool.execute` 自带 try/catch 返回 `{ok:false,...}`（L661-664），**但函数本身是 async**，外层 `fn(args)` 返回的是 Promise。`runToolCalls` 不 await → Promise 被当对象 JSON 化（`[object Promise]` 或 `{"ok":false,"error":undefined}`）。属 §1.1 同一根因的不同表现。

#### 3.3【已确认】`useNodeGeneration.start` 闭包 `loading` 旧值导致并发生图
- **机制**：`start` 的 `useCallback` 依赖 `[loading, nodeId]`（`useNodeGeneration.js L125`）；`registerTaskRetry` 用 `startRef.current`（L134-138）规避重注册，但 `start` 内部 `if (loading) return false`（L64-65）用的是**闭包 loading 旧值**。
- **代码证据**：L64-65 `if (loading) return false`；L125 deps `[loading, nodeId]`。
- **触发场景**：快速点两次生成：第一次 `setLoading(true)` 异步，第二次进入时闭包 `loading` 仍为 `false` → 两次 `run` 并发 → 任务中心双写、节点 `data` 被两次结果覆盖。
- **后果**：重复生图、任务中心重复条目、资源浪费。

#### 3.4【已确认】`canvasPlanExecutor` 渲染超时留「死节点」
- **机制**：`waitForNodeReady` 最多等 5s（L111-119），超时返回 false → `runNode` 直接 `entry.status='failed'`（L124），但**节点已 `addNodes` 创建在画布上**（`createGenNode` L86-107，在 `runNode` 之前调用）。
- **代码证据**：L124 `if (!ready) return { status:'failed', error:'节点 ... 未注册生成契约（渲染超时）' }`；节点在 L143/L166 已建。
- **触发场景**：低端机/大画布 React 渲染慢 >5s。
- **后果**：留一堆"空节点"需手动删。

### 4. 性能 / 内存

#### 4.1【已确认】SSE 每 50ms `setMessages` 浅拷贝整条消息数组
- **机制**：`scheduleFlush` 每 50ms 调 `updateLastStreaming` → `setMessages(prev => [...prev, last])`（`useAgentChat.js L508-515, L382-394`）每次浅拷贝整个消息数组。
- **触发场景**：接近 `AGENT_MSG_MAX=60`（`conversationStore.js L33`）的长会话多轮流式，每次 flush 拷贝 60 条大对象。
- **后果**：长会话输入卡顿、掉帧。

#### 4.2【已确认】每次 `commit` 整列 `JSON.stringify` 全量落盘（高频）
- **机制**：`commit`（`conversationStore.js L82-93`）对**整个对话列表** `state.conversations.map(normalizeConversation)` 后整列 `sSet`。`captureActiveConversation` 现是 no-op（`conversationStore.js L351-356`），但每次 `setCurrentSnapshot`（L702, L779 等）与 `patchCurrentWorkflow`（L705, L716, L780 等）都触发 `commit`。
- **代码证据**：`conversationStore.js L87` `sSet(CONVERSATIONS_KEY, JSON.stringify(state.conversations.map(normalizeConversation)))`；`useAgentChat.js L702/705/716/717/780/782`。
- **触发场景**：每次发送、每轮工具循环、每次 steer 续跑都多次整列序列化（含所有消息 + attachments）。
- **后果**：高频 IO / 主线程阻塞，长对话明显。

#### 4.3【已确认·数据丢失路径】大附件 dataURL 进 localStorage 静默撑爆配额
- **机制**：上传图 `URL.createObjectURL` + `blobToDataURL` 存 dataURL（`AgentPanel.jsx L340-343`），再经 `setCurrentSnapshot({attachments})` 落盘（`conversationStore.js L210`）。`storageAdapter.js L55-63` 的 `sSet` catch **静默忽略**（`localStorage.setItem` 失败 only `/* ignore */`）。
- **代码证据**：`AgentPanel.jsx L343` `setAttachments((prev) => [...prev, {type:'image', url: dataUrl, localUrl}])`；`conversationStore.js L210` 落盘 `attachments`；`storageAdapter.js L57-59` `catch { /* ignore */ }`。
- **触发场景**：传 3-4 张大图（每张数 MB dataURL）→ localStorage 配额爆 → 因整列 stringify 一起写，**任一项超配额则整次 commit 失败，所有对话写入一起丢**。
- **后果**：最危险的数据丢失路径，且无任何提示。

#### 4.4【已确认】`referenceImages` 模块级单例跨对话泄漏
- **机制**：`currentRefImages` 是模块级变量（`useCanvasAgentTools.js L40-46`），由 `useAgentChat.send` 写入（`useAgentChat.js L612`）。切换对话后旧值残留，直到下次该对话发送才覆盖。
- **代码证据**：`useCanvasAgentTools.js L40` `let currentRefImages = []`；`useAgentChat.js L612` `setCurrentReferenceImages(imgAtts.map((a) => a.url).filter(Boolean))`。
- **触发场景**：对话 A 带参考图后切到对话 B 立即 `execute_plan`（不带图）→ 仍读到 A 的参考图。
- **后果**：图生图用错参考图，结果错乱。

### 5. 边界场景

#### 5.1【已处理】`attachment_indices` 越界已裁剪
- **机制**：`execute_plan` 解析 `attachment_indices` 时 `idxs.filter(i => i < refPool.length)`（`useCanvasAgentTools.js L646`），越界被裁剪——**已处理**。
- **剩余缝隙**：`refPool` 仅含"图片附件"（`useAgentChat.js L602` `imgAtts = userMsg.attachments.filter(a => a.type !== 'node')`）。若某附件 `type==='node'`（画布节点引用），会被排除，导致 AI 见到的"参考图编号目录"与实际池对不上。当前 `AgentPanel` 选中节点走 `type:'image'`（`AgentPanel.jsx L224`），故一般安全，但属潜在不一致。

#### 5.2【Prompt 层约束】空画布 `list_nodes` 返回空，LLM 仍可能臆造 node id
- **机制**：`CANVAS_AGENT_RULES` 已提示"不要臆造节点 id"（`useAgentChat.js L86`），但仅 prompt 约束，无运行时校验；`updateNodeTool` 不存在时返回 `{ok:false, error}`（`useCanvasAgentTools.js L355-356`），LLM 若忽略错误会重试。属 prompt 层防护，非硬 bug。

#### 5.3【可接受】`model`/`provider` 未配置时静默走默认
- **机制**：`agentProvider` 可能为 `null`（`AgentPanel.jsx L82-89`），`provider` 传 `null` → 走 `CHAT_BASE_URL` 或 localTool 默认（`useAgentChat.js L451, L465`）。
- **行为**：localTool 未启动 → `fetch` 失败 → `parseAgentError` 抛网络错 → `send` catch 显示"调用失败"（`useAgentChat.js L695`）。**有错误提示**，可接受。

#### 5.4【已确认】`execute_plan` 依赖批"一错全弃"，容错差
- **机制**：`canvasPlanExecutor.js L161-191`：Wave2 依赖批仅当独立批**全部成功**才执行（`prevFailed = entries.filter(e => e.status !== 'completed').length`）；任一独立步失败 → 所有依赖步被标 failed 跳过。
- **触发场景**：独立批里 1 张图失败，其余依赖步（本可独立生）全被跳过。
- **后果**：容错差，一错全弃，损失大量本可成功的图。

#### 5.5【已确认】`MAX_TOOL_ROUNDS=8` 上限是"死循环"的唯一兜底
- **机制**：多轮工具循环 `for (; round < MAX_TOOL_ROUNDS; round++)`（`useAgentChat.js L666`）。在 §1.1 的 Promise bug 下，LLM 每轮都"看到 execute_plan 失败"→ 反复重调 → 直到走满 8 轮才提示用户（`L685-687`）。
- **后果**：配合 §1.1，既重复建节点又浪费 8 轮 token/配额。上限本身是必要的，但放大了 §1.1 的代价。

### 6. UI / 交互

#### 6.1【已确认】steer 态按钮图标语义不清
- **机制**：`AgentPanel.jsx L796` `sending && stateAction !== 'steer' ? 停止按钮 : 发送按钮`；`canSend`（L382）`stateAction !== 'stopping'`。在 `steer` 态（进行中补充指令）显示"发送箭头"，但 `handleSend` 内 `sending && stateAction !== 'steer'` 才 return（L296），否则走 `send` → `send` 内 `sendingRef.current` true → 转 steer 队列。逻辑能跑，但**图标显示"发送"而非"排队中"**，用户困惑。
- **后果**：交互语义不清。

#### 6.2【已确认】失败态只显示最后一条 error
- **机制**：`useAgentChat.js L695` `setError(e?.message)` 只存最后一个；UI 仅渲染 `error`（`AgentPanel.jsx L528`）。中途某轮工具失败（被 §1.1 掩盖）无痕迹。
- **后果**：排障困难。

#### 6.3【健康】`scrollKey` 滚动覆盖 reasoning
- `AgentPanel.jsx L283-287` 滚动依赖 `lastMsg.content?.length`，`reasoning` 流式增长已计入。基本覆盖，无问题。

---

## 四、Top 10 最值得修的薄弱机制（影响 × 概率）

| # | 机制 | 文件:行 | 影响 | 概率 | 建议改法 |
|---|------|---------|------|------|----------|
| 1 | `runToolCalls` 同步调用 async 工具，结果序列化错（execute_plan/generate_node 回填 LLM 的是 `{"ok":false,"error":undefined}`）；Demo 模式同源 | `useAgentChat.js L549-567` + `useCanvasAgentTools.js L539/L618`；Demo `L641-643` | 致命（批量生图/生成失效、撞 MAX_TOOL_ROUNDS 死循环、重复建节点、浪费配额） | 高（每次用 execute_plan/generate_node 必现） | 把 `runToolCalls` 改为 `async` 并 `await callTool(...)`；或让 `callTool` 在返回前 `await` 异步工具结果再回信封。 |
| 2 | 大附件 dataURL 进 localStorage 静默撑爆配额导致整个对话列表丢失 | `AgentPanel.jsx L343` + `conversationStore.js L210` + `storageAdapter.js L57-59` | 致命（数据全丢、无提示） | 中（传多张大图时） | 附件不存 localStorage（仅存 blob 引用/上传后 URL）；`sSet` 捕获 `QuotaExceededError` 并告警；落盘前对 attachments 做大小裁剪/排除。 |
| 3 | `execute_plan` 因 §1.1 被回填为失败，实际画布已改 → LLM 重试撞上限并重复建节点 | 同上 + `useAgentChat.js L666-687` | 高（重复节点、配额浪费） | 高（依赖 #1） | 先修 #1；并对 `execute_plan` 结果做"已建节点 count"回显，避免 LLM 误判未完成。 |
| 4 | `useNodeGeneration.start` 闭包 `loading` 旧值导致两次并发生图 | `useNodeGeneration.js L64-65, L125` | 高（重复生图、任务中心双写） | 中（快速连点） | 用 `ref` 存 `loading` 或在 `start` 内用 `runRef`/令牌防重入，而非闭包 `loading`；deps 去掉 `loading`。 |
| 5 | 刷新恢复带图 `pending` 依赖 localStorage 完整保留（与 #2 同源） | `useAgentChat.js L433-440` + `conversationStore.js L242-255` | 高（恢复丢图/失败） | 中 | 恢复时若 attachments 含 dataURL 且超阈值，降级为仅恢复 text 并提示用户重新加图。 |
| 6 | `awaitingConfirm` 在 `clear()` 后残留，导致后续 `execute_plan` 永久被拒 | `useAgentChat.js L798-807`（clear 不重置） + `useCanvasAgentTools.js L622` | 高（功能卡死） | 中（展示策划后清空） | `clear()` 内 `setAwaitingConfirm(false)`；或 clear 时一并重置当前对话 `pendingGenerations`/`awaitingConfirm`。 |
| 7 | `referenceImages` 模块级单例跨对话泄漏 | `useCanvasAgentTools.js L40-46` + `useAgentChat.js L612` | 中（图生图用错参考图） | 中（切对话即发 execute_plan） | 改为 per-conversation（存 `conversationStore` 当前对话字段），切对话自动隔离。 |
| 8 | `commit` 每次全量 `JSON.stringify` 整列对话 + 发送高频落盘 | `conversationStore.js L82-93` + `useAgentChat.js L702/705/716/717/780/782` | 中（卡顿、IO 压力） | 高（每次发送必现） | 仅对"当前对话"增量写盘；发送中节流落盘；大 messages 已做 `slice(-AGENT_MSG_MAX)` 但仍整列序列化，可改为只序列化变更对话。 |
| 9 | `execute_plan` 依赖批"一错全弃"，容错差 | `canvasPlanExecutor.js L161-191` | 中（丢大量可成功图） | 中（独立批任一步失败） | 改为"仅跳过依赖该失败前序的步骤"，其余依赖步仍尝试；或独立批部分失败时把依赖步降级为独立批。 |
| 10 | 节点渲染 >5s 超时（waitForNodeReady）导致已建节点不死不生 | `canvasPlanExecutor.js L111-119, L124` | 中（留死节点） | 低（慢机/大画布） | 超时不直接标 failed，改为重试等待或回滚已建节点；或超时阈值提到与生成超时同量级。 |

---

## 五、验收自测对照

1. 覆盖维度：并发(1.1-1.3)、状态一致(2.1-2.3)、异常恢复(3.1-3.4)、性能(4.1-4.4)、边界(5.1-5.5)、UI(6.1-6.3) —— **6 维度全覆盖，共 19 项**。
2. Top 10 含排序依据（影响 × 概率）与建议改法。
3. 全部为"真实会出问题"的机制 + 文件 + 行号 + 代码证据；区分「已确认缺陷 / 设计权衡」。
4. 与初稿对比修正：
   - §1.3 由"缺陷"重判为**设计权衡**（有意并发保护，非 bug）。
   - §2.1 补充 `messagesRef` 由 `useEffect` 异步同步，降级为"隐患"而非即时崩溃。
   - §3.2 明确根因同 §1.1（async 函数体内部 try/catch 不阻止外层返回 Promise）。
   - §4.2 修正：`captureActiveConversation` 实为 no-op，落盘压力来自 `setCurrentSnapshot`/`patchCurrentWorkflow` 的 `commit`。
   - 新增 §1.1 同源影响（Demo 模式同等 bug）、§5.5（MAX_TOOL_ROUNDS 放大 §1.1 代价）。

> 注：本文件所有行号来自本次逐文件核实；未修改任何源码。
