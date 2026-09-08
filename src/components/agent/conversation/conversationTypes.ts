/**
 * 会话域共享类型（中立模块）。
 *
 * 把跨文件复用的会话数据形状（Conversation / ConversationMemory / WorkflowState /
 * ConversationStoreState 及其组成类型）收敛到这里，避免子模块为复用单个类型而互相
 * 反向依赖成环（典型坑：conversationInvariants ↔ conversationState）。
 * 各子模块只从这里 import 类型；conversationState 负责 re-export 维持对外兼容。
 */
export interface ConversationMemory {
  summary: string;
  facts: unknown[];
  lastPlan: Record<string, unknown> | null;
  lastSharedStyle: string;
  notes: unknown[];
  global_contract: GlobalContractShape | null;
  artifacts: ArtifactShape[] | null;
  /** AI 助手左栏表格工作区【多标签页真源】（assistantTables:{tabs,activeTabId}，spec 1.1）。
   *  读写由 get/setCurrentAssistantTabs 经 normalizeAssistantTabs 归一。 */
  assistantTables: unknown;
  // 索引签名：①落盘数据可能携带历史遗留字段；②使本类型可赋值给 volumePolicy 的宽松
  // ConversationMemory（TS 的 interface 无隐式索引签名，缺此会在跨层调用处报 TS2345）。
  [key: string]: unknown;
}

/** 反序列化用的宽松形态：所有字段可选 + 索引签名，供 normalize* 系列归一成精确类型 */
export interface RawMemory {
  summary?: unknown;
  facts?: unknown[];
  lastPlan?: unknown;
  lastSharedStyle?: unknown;
  notes?: unknown[];
  global_contract?: unknown;
  artifacts?: unknown;
  assistantTables?: unknown;
  [key: string]: unknown;
}

/** 统一风格契约的归一形状（三字段恒为 string） */
export interface GlobalContractShape {
  visual_positioning: string;
  unified_style_prompt: string;
  unified_negative_prompt: string;
}

/** 跨步成果资产条目（归一后仅保证对象，字段由写入方约定） */
export interface ArtifactShape {
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  nodeId?: string;
  url?: string;
  [key: string]: unknown;
}

/** 工作流运行时状态（per-conversation，对齐大雄 conv.workflow） */
export interface WorkflowState {
  id: string;
  status: string;
  nodeIds: string[];
  steerQueue: unknown[];
  startedAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

/** 反序列化用的宽松形态（对齐 WorkflowState） */
export interface RawWorkflow {
  id?: unknown;
  status?: unknown;
  nodeIds?: unknown[];
  steerQueue?: unknown[];
  startedAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

/**
 * pending 引用（刷新恢复用）。
 * 【P1a 去重】新形态不存 text 副本，改引用 messageId；旧数据的 text 为迁移期兼容字段。
 */
export interface PendingRefState {
  conversationId: string;
  messageId: string;
  text?: string;
  attachments?: unknown[];
}

/** 反序列化用的宽松形态（对齐 PendingRefState） */
export interface RawPending {
  conversationId?: unknown;
  messageId?: unknown;
  text?: unknown;
  attachments?: unknown[];
  [key: string]: unknown;
}

/**
 * 单条会话消息：会话存储侧的宽松消息形状。
 * 字段全部可选且以 unknown 承载，因为真实消息包含流式中间态（id/streaming 占位）、
 * 体积降级字段（lastResults）、历史遗留字段等，且常被 `Record<string, unknown>` 直接赋值。
 * 用 unknown 而非 any：既消除 any，又保留「这是消息对象」的结构提示与索引签名，消费方可自行收窄。
 */
export interface ConversationMessage {
  id?: unknown;
  role?: unknown;
  content?: unknown;
  tool_calls?: unknown;
  tool_call_id?: unknown;
  reasoning?: unknown;
  attachments?: unknown;
  refCatalog?: unknown;
  lastResults?: unknown;
  streaming?: unknown;
  [key: string]: unknown;
}

/**
 * 单条会话。字段由 normalizeConversation 保证齐全；
 * 索引签名保留，因为落盘数据可能携带历史遗留字段（creditGate 等也经 CREDIT_GATE_FIELD 动态键访问）。
 *
 * 【新增会被序列化的字段 × 三联动（改这里必须同步，漏一处是隐患）】
 *  ① normalizeConversation 补默认值/归一（本文件同名函数）；
 *  ② volumePolicy 限容（sanitizeMessages / capConversationMemory / applyConversationBudget，见 base/utils/volumePolicy.ts）；
 *  ③ conversationInvariants 单测网（会让 integrity 被破坏的改动提前变红，见 tests/unit/conversationState.invariants.test.ts）。
 *  纯运行态字段（不落盘，如 streaming 占位）无需走 ①③，但请随手确认不被 setCurrentSnapshot 序列化。
 */
export interface Conversation {
  id: string;
  title: string;
  /** 用户是否显式重命名过标题（true 时 UI 显示层优先用 c.title，不再用首条消息自动切片覆盖） */
  titleCustom?: boolean;
  ts: number;
  updatedAt: number;
  draft: string;
  messages: ConversationMessage[];
  skills: unknown[];
  attachments: unknown[];
  memory: ConversationMemory;
  workflow: WorkflowState | null;
  pending: PendingRefState | null;
  aiUndoStack: unknown[];
  pendingGenerations: unknown[] | null;
  awaitingConfirm: boolean;
  pendingMemorySuggest: Record<string, unknown> | null;
  referenceImages: string[];
  [key: string]: unknown;
}

/** 反序列化用的宽松形态（对齐 Conversation；供 normalizeConversation 归一成精确类型） */
export interface RawConversation {
  id?: unknown;
  title?: unknown;
  titleCustom?: unknown;
  ts?: unknown;
  updatedAt?: unknown;
  draft?: unknown;
  messages?: unknown[];
  skills?: unknown[];
  attachments?: unknown[];
  memory?: RawMemory;
  workflow?: RawWorkflow | null;
  pending?: RawPending | null;
  aiUndoStack?: unknown[];
  pendingGenerations?: unknown[] | null;
  awaitingConfirm?: unknown;
  pendingMemorySuggest?: Record<string, unknown> | null;
  referenceImages?: string[];
  [key: string]: unknown;
}

/** 单个 agentKey 的状态（sending 仅内存、不落盘） */
export interface ConversationStoreState {
  conversations: Conversation[];
  activeId: string;
  sending: boolean;
}

/**
 * commit 入参：sending 可省略。
 * 会话 CRUD（新建/切换/删除/迁移）历史上就只提交 { conversations, activeId }，
 * sending 因此为 undefined（`!!sending` 判定等价 false）。TS 迁移保真该形态，不改运行时。
 */
export type ConversationStorePatch = Omit<ConversationStoreState, 'sending'> & {
  sending?: boolean;
};
