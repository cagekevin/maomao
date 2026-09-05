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
 *     ├─ useAgentChat.ts         对话 hook：send/stop/clear 编排骨架
 *     ├─ agentCore.ts            纯函数：buildRequestMessages / parseSSEChunk / 意图分流
 *     ├─ agentRuntime.ts         运行时：roundTrip（LLM 通信）/ runToolCalls（工具执行，依赖注入版）
 *     ├─ runModeRegistry.ts      执行模型（2026-09-05 收敛恒 auto 完全自主 + credit 积分闸）
 *     ├─ agentConfig.ts          system prompt + 运行时常量（值收口）
 *     ├─ inputStateMachine.ts    输入状态机：idle/planning/running/steer/retry
 *     ├─ workflowState.ts        M2 工作流状态迁移纯函数（wfStart/wfSteer/wfFinish/…）
 *     ├─ agentMessages.ts        M3 消息构造/落盘（appendMsg/setHistory/流式更新）
 *     ├─ agentAttachments.ts     M3 附件归一/参考图编号（normalizeAttachmentsForSend/buildRefCatalog）
 *     ├─ contextCompression.ts   历史超长→memory.summary 分层压缩
 *     ├─ projectMemoryStore.ts   项目长期记忆（memory_suggest 写入）
 *     ├─ memoryRetrieval.ts      记忆检索注入
 *     └─ tokenBudget.ts          上下文 token 预算
 *
 *   canvas/                      —— 画布操作 + 工具层
 *     ├─ useCanvasAgentTools.ts  20 个画布工具（AI 调用的工具注册表；2026-09-05 奥卡姆删除 6 个）
 *     ├─ canvasPlanExecutor.ts   多步执行器（Wave1 并行 + Wave2 依赖）
 *     └─ canvasHost.ts           M1 画布原语层（getNode/createNode/deleteNodes/transaction，写操作唯一入口）
 *
 *   conversation/                —— 会话状态（单一数据源）
 *     ├─ conversationState.ts    底座：模块级 state + 落盘/订阅/归一
 *     ├─ conversationSnapshot.ts 当前对话快照（workflow/pending/memory）
 *     ├─ conversationAiState.ts  AI 编排态（global_contract/artifacts/undo/refImages/runMode）
 *     ├─ conversationImageMap.ts 跨轮图记忆（图1~图N 编号）
 *     ├─ conversationSkillState.ts Skill 三阶段态
 *     └─ conversationStore.ts    聚合 re-export（外部统一从这 import）
 *
 * 【改 X 看哪（快速定位）】
 *   - 加工具        → canvas/useCanvasAgentTools.ts（注册 name/description/parameters/execute）
 *   - 改发送/循环    → runtime/useAgentChat.ts
 *   - 改执行模型     → runtime/runModeRegistry.ts（2026-09-05 收敛恒 auto）
 *   - 改会话状态     → conversation/conversationState.ts（底座）/ conversationStore.ts（聚合）
 *   - 改批量出图     → canvas/canvasPlanExecutor.ts
 *   - 改画布操作     → canvas/canvasHost.ts（写操作必须走它，禁裸 useReactFlow）
 *   - 改输入状态机   → runtime/inputStateMachine.ts
 *   - 改 UI 面板     → panels/AgentPanel.tsx + panels/AgentMessage.tsx（UI 壳，留在 panels/）
 *
 * 【契约（改前必查，注册表收口）】
 *   - 事件名    → base/contracts.ts 的 EVENTS（publish/subscribe 必须用登记名）
 *   - 存储键    → base/contracts.ts 的 STORAGE_KEYS（禁裸字符串 key）
 *   - 画布写操作 → 只经 canvasHost，禁止裸 ctx.setNodes/setEdges/addNodes
 *   - 工具信封  → { ok, data | error }，禁止异常冒泡到 Agent 层
 *
 * 【对外的聚合 re-export】外部（AgentPanel/App）统一从这里 import，不绕深层路径。
 *   新增对外符号 → 在此追加 re-export，勿在外部直接 import 子目录深层路径。
 */
export { useAgentChat } from './runtime/useAgentChat.ts'
export type { UseAgentChatReturn } from './runtime/useAgentChat.ts'
export { setGenParams, getGenParams, getNodeImageUrl, getCreditSwitch, setCreditSwitch } from './canvas/useCanvasAgentTools.ts'
export { setAgentKey } from './conversation/conversationStore.ts'
// 运行模式注册表透出（docs/65 M8→2026-09-05 精简）：收敛恒 auto（三态已删，保留 get/set 归一封装）
export { getWorkMode, setWorkMode, RUN_MODE_IDS, DEFAULT_WORK_MODE, WORK_MODE_STORAGE_KEY } from './runtime/runModeRegistry.ts'
