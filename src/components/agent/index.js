/**
 * AI 助手模块 —— 目录地图（改代码前先读这个，不用翻其它文档）
 * 数据流：AgentPanel(panels/) → useAgentChat(runtime/) → useCanvasAgentTools(canvas/)
 *        → canvasPlanExecutor(canvas/) → canvasHost(M1后) → conversation/ → 后端
 * 改 X 看哪：加工具→canvas/useCanvasAgentTools；改发送→runtime/useAgentChat；
 *           改会话状态→conversation/；改批量出图→canvas/canvasPlanExecutor；
 *           改状态机→runtime/inputStateMachine；UI→panels/AgentPanel
 * 契约：事件见 contracts.js EVENTS；存储键见 contracts.js STORAGE_KEYS；画布只经 host。
 */
export {}