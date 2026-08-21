/**
 * ════════════════════════════════════════════════════════════════
 * AI 助手模块 —— 目录地图 + 聚合入口
 * （改代码前先读本文件，不用翻其它文档；对 AI 助手的一切改动从这里开始）
 * ════════════════════════════════════════════════════════════════
 *
 * 【模块全景 · 数据流（单向，无环）】
 *   AgentPanel(panels/UI) → useAgentChat(runtime/) → useCanvasAgentTools(canvas/)
 *     → canvasPlanExecutor(canvas/) → canvasHost(canvas/) → conversation/ → 后端(LLM)
 *
 * 【目录结构 · 每个文件干嘛】
 *   runtime/                     —— 对话引擎 + 运行时
 *     ├─ useAgentChat.js         对话 hook：send/stop/clear 编排骨架（M3 瘦身后只留编排）
 *     ├─ agentCore.js            纯函数：buildRequestMessages / parseSSEChunk / 规则注入
 *     ├─ agentRuntime.js         运行时：roundTrip / runToolCalls（依赖注入版）
 *     ├─ inputStateMachine.js    输入状态机：idle/planning/running/steer/retry
 *     ├─ workflowState.js        M2 工作流状态迁移纯函数（wfStart/wfSteer/wfFinish/…）
 *     ├─ agentMessages.js        M3 消息构造/落盘（appendMsg/setHistory/流式更新）
 *     └─ agentAttachments.js     M3 附件归一/参考图编号（normalizeAttachmentsForSend/buildRefCatalog）
 *
 *   canvas/                      —— 画布操作 + 工具层
 *     ├─ useCanvasAgentTools.js  24 个画布工具（AI 调用的工具注册表）
 *     ├─ canvasPlanExecutor.js   多步执行器（Wave1 并行 + Wave2 依赖）
 *     └─ canvasHost.js           M1 画布原语层（getNode/createNode/deleteNodes/transaction，写操作唯一入口）
 *
 *   conversation/                —— 会话状态（单一数据源）
 *     ├─ conversationState.js    底座：模块级 state + 落盘/订阅/归一
 *     ├─ conversationSnapshot.js 当前对话快照（workflow/pending/memory）
 *     ├─ conversationAiState.js  AI 会话态
 *     ├─ conversationImageMap.js 跨轮图记忆（图1~图N 编号）
 *     ├─ conversationSkillState.js Skill 三阶段态
 *     └─ conversationStore.js    聚合 re-export（外部统一从这 import）
 *
 * 【改 X 看哪（快速定位）】
 *   - 加工具        → canvas/useCanvasAgentTools.js（注册 name/description/parameters/execute）
 *   - 改发送/循环    → runtime/useAgentChat.js
 *   - 改工作流状态   → runtime/workflowState.js
 *   - 改会话状态     → conversation/conversationState.js（底座）/ conversationStore.js（聚合）
 *   - 改批量出图     → canvas/canvasPlanExecutor.js
 *   - 改画布操作     → canvas/canvasHost.js（写操作必须走它，禁裸 useReactFlow）
 *   - 改输入状态机   → runtime/inputStateMachine.js
 *   - 改 UI 面板     → panels/AgentPanel.jsx + panels/AgentMessage.jsx（UI 壳，留在 panels/）
 *
 * 【契约（改前必查，注册表收口）】
 *   - 事件名    → base/contracts.js 的 EVENTS（publish/subscribe 必须用登记名）
 *   - 存储键    → base/contracts.js 的 STORAGE_KEYS（禁裸字符串 key）
 *   - 画布写操作 → 只经 canvasHost，禁止裸 ctx.setNodes/setEdges/addNodes
 *   - 工具信封  → { ok, data | error }，禁止异常冒泡到 Agent 层
 *
 * 【对外的聚合 re-export】外部（AgentPanel/App）统一从这里 import，不绕深层路径。
 *   新增对外符号 → 在此追加 re-export，勿在外部直接 import 子目录深层路径。
 */
export { useAgentChat } from './runtime/useAgentChat.js'
export { setGenParams, getGenParams, getNodeImageUrl } from './canvas/useCanvasAgentTools.js'
export { setAgentKey } from './conversation/conversationStore.js'
