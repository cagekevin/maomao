/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层 —— 共享底层状态 + 存储抽象（可拆分的底座）
 * ════════════════════════════════════════════════════════════════
 *
 * 【拆分契约 · 2026-08-21】原 conversationStore.js 是"上帝文件"（674 行 / 44 导出），
 * 本文件把「模块级可变状态 + 落盘/订阅/隔离 + 归一化」这一最底层依赖抽出来，作为单向依赖底座。
 * 分文件依赖方向（无环）：conversationState(底座) ← { conversationSnapshot, conversationAiState }
 *   ← { conversationImageMap, conversationStore(聚合入口) }。
 *
 * 【本文件职责 = 审计文档 §1.6 的"共享 state 层"】states/hydratedSet/currentAgentKey/listeners
 * 等模块级可变状态、persistDebounced 落盘、subscribe/getSnapshot 订阅、initState/getState/commit
 * 读写、uid/emptyMemory 与 normalize 归一化。必须全局唯一，否则多文件各持 state 状态隔离断裂。
 *
 * 【对外 API】其余文件从本文件 import 这套内部契约（convKey / getState / commit / uid /
 * getActiveConv / normalize* 等）；但本文件的"公开 API"仅 useConversationStore / setAgentKey /
 * flushPersist / resetConversationCache / normalize* ，由 conversationStore.js 作为聚合入口统一 re-export，
 * 调用方 import 路径与符号名都不变。
 * ════════════════════════════════════════════════════════════════
 */
import { useSyncExternalStore } from 'react';
import {
  contentGet,
  contentSet,
  contentGetAsync,
  contentSetAsync,
  createDebouncedPersist,
} from '../../base/core/contentStore.ts';
import { sGet } from '@/components/base/storage/index.ts';
import { withTimeout } from '../../base/utils/asyncGuard.ts';
import { generateId } from '../../base/core/idGen.ts';
import { CREDIT_GATE_FIELD } from '../../base/core/contracts.ts';
import { logger } from '../../base/core/logger.ts';
import { reportDegrade } from '../../base/core/degrade.ts';
import { KV_TIMEOUT } from '../../base/core/config.ts';
// 【P1c L3 整包预算安全网】落盘前对归一化副本做投影降级，保证整包序列化体积有界（见 volumePolicy.js）
import {
  applyConversationBudget,
  estimateConversationsBytes,
  SAFE_BUDGET_BYTES,
} from '../../base/utils/volumePolicy.ts';
import { type ChatMessage as AgentChatMessage } from '../runtime/agentCore.ts';

/**
 * 存储键按 agentKey 隔离（每项目一个 agentKey → 每项目一套会话）。
 * 键形如 agent_conversations_canvas-assistant-<projectId>，天然按项目分开。
 */
export const convKey = (k: string) => `agent_conversations_${k}`;
export const activeKey = (k: string) => `agent_active_conversation_id_${k}`;

/**
 * 会话记忆（对齐大雄 agentEmptyConversationMemory）。
 * global_contract 为统一风格契约；artifacts 为跨步成果资产。
 */
export interface ConversationMemory {
  summary: string;
  facts: unknown[];
  lastPlan: Record<string, unknown> | null;
  lastSharedStyle: string;
  notes: unknown[];
  global_contract: GlobalContractShape | null;
  artifacts: ArtifactShape[] | null;
  /** AI 助手左栏表格工作区（assistantTable：{columns,rows}）。不走精确类型（保持底座轻 + 避免
   *  底座反向依赖 assistantTable 模块）；读写由 get/setCurrentAssistantTable 经 normalizeAssistantTable 归一。 */
  assistantTable: unknown;
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
  assistantTable?: unknown;
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
 */
export interface Conversation {
  id: string;
  title: string;
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
  runMode: 'auto' | 'step-confirm';
  [key: string]: unknown;
}

/** 反序列化用的宽松形态（对齐 Conversation；供 normalizeConversation 归一成精确类型） */
export interface RawConversation {
  id?: unknown;
  title?: unknown;
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
  runMode?: unknown;
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
/** AI 助手 agentKey 前缀（对齐 App.jsx / backupStore.ts，集中避免散落硬编码） */
const AGENT_KEY_PREFIX = 'canvas-assistant';
/** 旧全局会话键（迁移用）：改造前无 agentKey 后缀（contracts.ts 登记为 migration 键） */
const LEGACY_CONV_KEY = 'agent_conversations';
const LEGACY_ACTIVE_KEY = 'agent_active_conversation_id';
/** 每个 agentKey 的对话消息上限（对齐大雄 AGENT_MSG_MAX = 60，防无限膨胀） */
export const AGENT_MSG_MAX = 60;

/** 空对话记忆（对齐大雄 agentEmptyConversationMemory） */
export function emptyMemory() {
  return {
    summary: '',
    facts: [],
    lastPlan: null,
    lastSharedStyle: '',
    notes: [],
    global_contract: null, // 统一风格契约 {visual_positioning, unified_style_prompt, unified_negative_prompt}（对齐大雄 global_contract）
    artifacts: null, // 跨步成果资产 [{id,type,title,description,nodeId?,url?}]（对齐大雄 plan.artifacts）
    assistantTable: null, // AI 助手表格工作区（{columns,rows}；读写见 get/setCurrentAssistantTable）
  };
}

/**
 * 单一数据源改为「按 agentKey 隔离」：每个 agentKey（本项目=每项目）一份 { conversations, activeId, sending }。
 * 这样 AI 会话跟随项目走，项目作为最顶层，互不串话。
 * sending = 运行态标志（是否正在发送/流式）。仅存内存、不落盘（persist 只序列化 conversations + activeId）。
 */
const states: Record<string, ConversationStoreState> = {}; // { [agentKey]: { conversations, activeId, sending } }
const hydratedSet: Record<string, boolean> = {}; // { [agentKey]: boolean } 该 key 是否已恢复过当前对话
let currentAgentKey: string = AGENT_KEY_PREFIX; // 当前生效的 agentKey（由 setAgentKey 设置）

// P4 落盘节流：commit 每次变更全量 stringify + 落盘是热路径（流式/轮询/记忆提炼高频触发），
// 防抖合并成最终态一次落盘。通知订阅者（notify）保持即时，只有「落盘」被节流。
// write 是「读当前最新 state」的 thunk——flush 时才执行，天然合并窗口内多次 commit 的最终态。
// 兜底：createDebouncedPersist 自动注册 pagehide flush，极端刷新/关闭不丢最后变更。
const persistDebounced = createDebouncedPersist(() => {
  if (!hydratedSet[currentAgentKey]) return; // 未恢复不落盘（防挂载覆盖）
  const next = states[currentAgentKey];
  if (!next) return;
  // 【P1c L3 整包预算安全网】序列化前对归一化副本做投影降级：整包超预算时先剥离瞬时字段、
  // 再截断最大字符串，保证落盘字符串恒 < SAFE_BUDGET_BYTES（规避 QuotaExceededError）。
  // 只作用于落盘投影副本，绝不动 states 本体（内存态完整，撤销/上下文/恢复读取不受影响）。
  const normalized = next.conversations.map(normalizeConversation);
  // volumePolicy 的 ChatMessage.content 是 string 窄类型；真实消息 content 可为数组，这里只在
  // 落盘降级投影这一边界做一次断言（运行时 shape 兼容），避免把整套消息类型都收窄到 string。
  const { conversations: toStore, downgraded } = applyConversationBudget(
    normalized as Parameters<typeof applyConversationBudget>[0],
    SAFE_BUDGET_BYTES,
  );
  if (downgraded) {
    logger.warn('AI助手', '会话落盘触发体积降级', {
      key: convKey(currentAgentKey),
      rawBytes: estimateConversationsBytes(normalized),
      budget: SAFE_BUDGET_BYTES,
    });
  }
  try {
    contentSet(convKey(currentAgentKey), toStore);
    contentSet(activeKey(currentAgentKey), next.activeId || '');
  } catch (e) {
    // 【修正旧注释】原注释称「事件已由 contentSet→sSet 内部 publish」——该假设仅在 local
    // 后端成立。会话键已登记 backend:'kv'，走 storageSet→kvSet(网络)，不经过 sSet，
    // 故 KV 路径的同步抛错不会触发 persist:failed 事件，必须在此显式透传。
    const key = convKey(currentAgentKey);
    const msg = e?.message || String(e);
    logger.warn('AI助手', '会话落盘失败', { key, error: msg });
    // 透传给降级上报（其 toast 为可选表现层，非判定依据；真实判定看返回值与 logger）
    reportDegrade({
      layer: 'conversationState',
      key,
      e,
      toast: '会话保存失败，本次对话内容可能未存上',
    });
  }
}, 300);

/** 强制立即落盘当前 agentKey 会话（页面卸载兜底 / 测试用） */
export function flushPersist(): void {
  persistDebounced.flush();
}

/** 订阅者 */
const listeners = new Set<() => void>();

/** 订阅当前 agentKey 状态变更（供 useStoreSelector 按字段订阅，避免整包订阅连坐重渲染） */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot(): ConversationStoreState {
  return states[currentAgentKey] || { conversations: [], activeId: '', sending: false };
}

/** useConversationStore()：订阅当前 agentKey 的会话状态（对齐 taskStore 的 useTasks 用法） */
export function useConversationStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * 【会话存储迁移至 KV】（AI助手会话存储迁移-KV收口事实记录.md）
 * 会话键 `agent_conversations_{agentKey}` / `agent_active_conversation_id_{agentKey}` 已由
 * contracts.ts 登记为 `backend:'kv'`。因此读取不能再走同步 `contentGet`（KV 键缓存未命中返回 undefined），
 * 水化改为异步 `contentGetAsync`，并把 localStorage 里的存量会话【幂等】一次性迁入 KV。
 *
 * 交叉/黑盒处理（2026-08-28，防竞态与静默失败）：
 *  - C1/C2 竞态：hydratedSet[k] 在水化完成前恒 false → persistDebounced 落盘是 no-op；
 *    先放空壳保 UI 可读，异步水化把 states[k] 写全后才 markHydrated，从时序上排除「未水化空写／迁移与正常写并发」。
 *  - B1 失败可见：迁移写 KV 用 contentSetAsync（await）+ logger 记录成败；读/写都走 withTimeout 兜超时。
 *  - C3 不做「迁完删 local」：KV 失败降级仍写 local 副本（storageGet 兜底可回读），local 键保留语义不破坏。
 */

/** 正在异步水化的 agentKey 集合（防重复触发一次以上水化） */
const hydrationInFlight = new Set<string>();

/** 等待某 agentKey 水化完成的 resolve 集合：agentKey → Set<resolve>（支持多调用方同时等待） */
const hydrationWaiters = new Map<string, Set<() => void>>();

/**
 * 返回「某 agentKey 已水化完成」的 Promise（已水化则立即 resolve）。
 * 会话键迁 KV 后水化为异步，调用方（如 useAgentChat 恢复 effect）须先 await 本 Promise，
 * 才能读到真实数据而非空壳（见 AI助手会话存储迁移-KV收口事实记录.md §2.5）。
 * @param {string} k agentKey
 * @returns {Promise<void>}
 */
export function waitHydrated(k?: string): Promise<void> {
  const key = k || AGENT_KEY_PREFIX;
  if (hydratedSet[key]) return Promise.resolve();
  if (!hydrationWaiters.has(key)) hydrationWaiters.set(key, new Set());
  const waiters = hydrationWaiters.get(key)!;
  return new Promise<void>((resolve) => {
    waiters.add(resolve);
  });
}

/** 标记某 agentKey 水化完成并放行所有等待者 */
function resolveHydration(k: string): void {
  hydratedSet[k] = true;
  const resolvers = hydrationWaiters.get(k);
  if (resolvers) {
    for (const r of resolvers) r();
    hydrationWaiters.delete(k);
  }
}

/** 解析「可能已是 JSON 字符串」的原始值；失败原样返回（对齐 contentStore.tryParse 语义） */
function hydrateParse(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * 纯函数 · 幂等判定：是否需把 localStorage 存量迁入 KV。
 * 仅当「KV 无会话数据 && local 存量有会话」返回 true；KV 已有数据绝不动（防覆盖，幂等闸）。
 * @param {Array|null} kvConversations KV 读到的会话
 * @param {Array|null} localConversations localStorage 存量会话
 */
export function shouldMigrateLocalToKV(
  kvConversations: unknown,
  localConversations: unknown,
): boolean {
  const kvEmpty = !Array.isArray(kvConversations) || kvConversations.length === 0;
  return kvEmpty && Array.isArray(localConversations) && localConversations.length > 0;
}

/**
 * 设置当前 agentKey（项目切换/新建时调用）。首次出现的 key 立即放空壳（保 UI 同步可读），
 * 并异步水化真实数据（读 KV → 必要时迁存量 → 写全 states[k] → markHydrated）。
 */
export function setAgentKey(key?: string): void {
  const k = key || AGENT_KEY_PREFIX;
  const same = k === currentAgentKey;
  currentAgentKey = k;
  // 幂等触发：确保该 key 的 state 存在并（未水化时）发起异步水化——即使 k===currentAgentKey 也执行，
  // 避免「命中同键提前 return」导致水化从未被触发。同键不再重复通知监听器。
  ensureState(k);
  if (!same) listeners.forEach((l) => l());
}

/** 确保某 agentKey 有 state：无则放空壳并触发异步水化（幂等：每个 key 最多一次水化） */
function ensureState(k: string): void {
  if (!states[k]) {
    // 空壳：让同步 getState/订阅立即有对象可读，不阻塞 UI
    states[k] = { conversations: [], activeId: '', sending: false };
  }
  if (hydrationInFlight.has(k)) return;
  // 已水化则无需重来；未水化（含此前水化失败）则（重）触发
  if (hydratedSet[k]) return;
  hydrationInFlight.add(k);
  hydrateAsync(k)
    .catch((e) =>
      logger.warn('AI助手', '会话水化失败（数据保留内存或由下次触发补迁）', {
        key: k,
        error: e?.message || String(e),
      }),
    )
    .finally(() => hydrationInFlight.delete(k));
}

/**
 * 异步水化一个 agentKey：读 KV（新后端）→ 必要时把 localStorage 存量一次性迁入 KV（幂等）→ 写 states[k] → 标记 hydrated。
 * 时序：本函数把 states[k] 写全、hydratedSet[k] 置 true 之前，persistDebounced 对落盘是 no-op（见 commit 守卫）。
 */
async function hydrateAsync(k: string): Promise<void> {
  if (hydratedSet[k]) return;
  // ① 读 KV（会话 + 活跃 id）；读失败视为无 KV 数据并走存量兜底，失败经 logger 可见（不静默）
  let kvConversations: unknown = null;
  let kvActiveId = '';
  try {
    kvConversations = await withTimeout(
      contentGetAsync(convKey(k)),
      KV_TIMEOUT,
      `读取会话水化超时(${k})`,
    );
  } catch (e) {
    logger.warn('AI助手', '水化读会话 KV 失败，回退本地存量', {
      key: convKey(k),
      error: e?.message || String(e),
    });
  }
  try {
    const id = await withTimeout(
      contentGetAsync(activeKey(k)),
      KV_TIMEOUT,
      `读取活跃会话 id 超时(${k})`,
    );
    if (typeof id === 'string' && id) kvActiveId = id;
  } catch (e) {
    logger.warn('AI助手', '水化读活跃会话 id 失败', {
      key: activeKey(k),
      error: e?.message || String(e),
    });
  }

  // ② 读取 localStorage 存量（键已翻成 kv 后端，contentGetAsync 会路由到 KV，故直读本地存量源）
  const localConvRaw = hydrateParse(sGet(convKey(k)));
  const localConversations: Conversation[] = Array.isArray(localConvRaw)
    ? ((localConvRaw as unknown[])
        .map((c) => normalizeConversation(c))
        .filter(Boolean) as Conversation[])
    : [];
  const localActiveRaw = hydrateParse(sGet(activeKey(k)));
  const localActiveId = typeof localActiveRaw === 'string' ? localActiveRaw : '';

  // ③ 决定水化目标 + 是否需要存量迁移（KV 有数据绝不覆盖）
  let conversations: Conversation[];
  let activeId = '';
  if (Array.isArray(kvConversations) && kvConversations.length > 0) {
    conversations = (kvConversations as unknown[])
      .map((c) => normalizeConversation(c))
      .filter(Boolean) as Conversation[];
    activeId = kvActiveId;
  } else if (shouldMigrateLocalToKV(kvConversations, localConversations)) {
    conversations = localConversations;
    activeId = localActiveId;
    try {
      // 幂等迁入 KV：contentSetAsync 路由到 KV；失败保留内存态由后续正常链路兜底，失败可见
      await withTimeout(
        contentSetAsync(convKey(k), conversations),
        KV_TIMEOUT,
        `存量会话迁 KV 超时(${k})`,
      );
      await withTimeout(
        contentSetAsync(activeKey(k), activeId),
        KV_TIMEOUT,
        `存量活跃 id 迁 KV 超时(${k})`,
      );
      logger.warn('AI助手', '存量会话已从 localStorage 一次性迁入 KV', {
        key: convKey(k),
        count: conversations.length,
      });
    } catch (e) {
      logger.warn('AI助手', '存量会话迁 KV 失败，沿用内存态', {
        key: convKey(k),
        error: e?.message || String(e),
      });
    }
  } else {
    // 兼容迁移：改造前会话存固定键 agent_conversations（无项目后缀）。仅默认项目、且都无数据时迁一次。
    if (k === `${AGENT_KEY_PREFIX}-default`) {
      const { conversations: legacyConv, activeId: legacyActive } = migrateLegacyGlobal();
      if (legacyConv.length) {
        conversations = legacyConv;
        activeId = legacyActive;
        try {
          await withTimeout(
            contentSetAsync(convKey(k), conversations),
            KV_TIMEOUT,
            `旧键会话迁 KV 超时(${k})`,
          );
          await withTimeout(
            contentSetAsync(activeKey(k), activeId),
            KV_TIMEOUT,
            `旧键活跃 id 迁 KV 超时(${k})`,
          );
        } catch {
          /* 与上述存量迁移同款兜底语义 */
        }
      } else {
        conversations = [];
        activeId = '';
      }
    } else {
      conversations = [];
      activeId = '';
    }
  }

  // ④ 写全内存态 + 标记 hydrated（此后允许落盘）+ 放行等待者 + 通知订阅者
  states[k] = { conversations, activeId, sending: false };
  resolveHydration(k);
  listeners.forEach((l) => l());
}

/** 从旧固定键 agent_conversations 迁移一次（改造前会话归属默认项目）。旧键仍为 local 后端，contentGet 可读。 */
function migrateLegacyGlobal(): { conversations: Conversation[]; activeId: string } {
  let conversations: Conversation[] = [];
  try {
    const arr = contentGet(LEGACY_CONV_KEY);
    conversations = (Array.isArray(arr) ? arr : []).map(normalizeConversation).filter(Boolean);
  } catch {
    conversations = [];
  }
  if (conversations.length === 0) return { conversations: [], activeId: '' };
  let activeId = '';
  try {
    const id = contentGet(LEGACY_ACTIVE_KEY);
    activeId =
      typeof id === 'string' && id && conversations.some((c) => c.id === id)
        ? id
        : conversations[0].id;
  } catch {
    activeId = conversations[0].id;
  }
  return { conversations, activeId };
}

/** 读取当前 agentKey 的 state（确保已初始化）——供各分文件读写共享状态 */
export function getState(): ConversationStoreState {
  ensureState(currentAgentKey);
  return states[currentAgentKey];
}

/** 统一提交：更新当前 agentKey 的 state + 通知；持久化由 persist 控制（hydrated 后才写 localStorage，防挂载覆盖）。
 *  persist=false 用于流式热路径的"仅通知不落盘"（patchCurrentMessages），最终态由 send finally 统一落盘。 */
export function commit(next: ConversationStorePatch, opts: { persist?: boolean } = {}): void {
  const { persist = true } = opts;
  states[currentAgentKey] = next as ConversationStoreState;
  listeners.forEach((l) => l());
  if (hydratedSet[currentAgentKey] && persist) persistDebounced.schedule();
}

/**
 * 【阶段1D·薄壳化】设置当前 agentKey 的 sending 运行态标志。
 * 仅内存、不落盘（persist 只序列化 conversations + activeId，sending 会被忽略）。
 * 供 useAgentChat 订阅 sending（UI 展示"思考中"），与 sendingRef（异步闭包读）分离。
 */
export function setSending(sending: boolean): void {
  const st = getState();
  commit({ ...st, sending: !!sending }, { persist: false });
}

/** 生成唯一 id（对齐大雄 uid('ac')） */
export function uid(prefix?: string): string {
  return generateId(prefix || 'ac');
}

/** 读当前对话对象（内部；无则 null）——各分文件共用 */
export function getActiveConv(): Conversation | null {
  return getState().conversations.find((c) => c.id === getState().activeId) || null;
}

/** 标记当前 agentKey 已从存储恢复（hydrated=true，此后 commit 允许落盘）。
 *  由 applyConversation / importLegacy（conversationStore 聚合层）在恢复/切换成功后调用。 */
export function markHydrated(): void {
  resolveHydration(currentAgentKey);
}

/** 保证一个对话的结构完整（数组字段缺省补齐、workflow/pending/memory 归一） */
export function normalizeConversation(raw: unknown): Conversation | null {
  if (!raw || typeof raw !== 'object') return null;
  // 反序列化入口：入参为运行时未知数据，此处断言为宽松形态便于字段归一（字段已逐项做 typeof/Array.isArray 校验）
  const c = raw as RawConversation;
  if (!Array.isArray(c.messages)) c.messages = [];
  // P15 列表 key：保证每条消息有稳定唯一 id（无 id 的补一个，已有保留；幂等——补过的对象带 id，
  // 二次归一化直接返回原引用，不重生成 → 列表 key 稳定不重挂载）。
  c.messages = c.messages.map((m) => {
    const msg = m as Record<string, unknown> | null;
    if (!msg || typeof msg !== 'object' || msg.id) return m;
    return { ...msg, id: generateId('msg') };
  });
  if (!Array.isArray(c.skills)) c.skills = [];
  if (!Array.isArray(c.attachments)) c.attachments = [];
  if (typeof c.title !== 'string') c.title = c.title || '对话';
  if (typeof c.draft !== 'string') c.draft = '';
  if (!c.id) c.id = uid('ac');
  if (!c.ts) c.ts = Date.now();
  if (!c.updatedAt) c.updatedAt = c.ts;
  // 记忆归一
  if (!c.memory || typeof c.memory !== 'object') c.memory = emptyMemory();
  if (!Array.isArray(c.memory.facts)) c.memory.facts = [];
  if (!Array.isArray(c.memory.notes)) c.memory.notes = [];
  if (typeof c.memory.summary !== 'string') c.memory.summary = '';
  if (typeof c.memory.lastSharedStyle !== 'string') c.memory.lastSharedStyle = '';
  // workflow / pending：缺省为 null（可空）
  if (c.workflow === undefined) c.workflow = null;
  if (c.pending === undefined) c.pending = null;
  // 工作流运行时状态（per-conversation，Step D 下沉，防模块级串话）
  if (!Array.isArray(c.aiUndoStack)) c.aiUndoStack = []; // AI 撤销栈快照 [{nodes,edges,action}]
  if (c.pendingGenerations === undefined) c.pendingGenerations = null; // Skill 阶段1 策划暂存
  if (typeof c.awaitingConfirm !== 'boolean') c.awaitingConfirm = false; // Skill 阶段2 确认态
  if (c.pendingMemorySuggest === undefined) c.pendingMemorySuggest = null; // 「记」项目记忆建议暂存（memory_suggest 待用户确认后写入）
  // 【积分闸】creditGate：单一对象 { pending, gens, map(stepId→nodeId) }，含媒体生成待确认态 + 步骤映射
  if (c[CREDIT_GATE_FIELD] === undefined) c[CREDIT_GATE_FIELD] = null;
  if (!Array.isArray(c.referenceImages)) c.referenceImages = []; // 本轮用户引用的参考图 URL（per-conversation，防跨对话泄漏）
  // 【2026-09-05 精简】执行模型收敛恒 auto：runMode 兼容字段一律归 auto（历史旧值 direct/step-confirm/semi 归一丢弃；
  // 运行时断言以 workMode 真源 getWorkMode()=auto 为准，本字段仅历史持久化兼容，写入侧 registerRunModeSync 恒写 auto）。
  c.runMode = 'auto';
  return c as Conversation;
}

/** 归一 workflow：保证结构完整（对齐大雄 conv.workflow） */
export function normalizeWorkflow(raw: unknown): WorkflowState | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as RawWorkflow;
  if (!w.id) w.id = generateId('awf');
  if (!w.status) w.status = 'planning';
  if (!Array.isArray(w.nodeIds)) w.nodeIds = [];
  if (!Array.isArray(w.steerQueue)) w.steerQueue = [];
  if (!w.startedAt) w.startedAt = Date.now();
  if (!w.updatedAt) w.updatedAt = Date.now();
  return w as WorkflowState;
}

/** 归一 pending（{ conversationId, messageId, [text] [attachments] }）。
 * 【P1a 去重】新形态：text 不存副本，改引用 messageId（恢复按 id 从 messages 找回，消除用户消息双副本体积增）。
 *   attachments 保留「原始输入」引用：恢复重发时走 send 归一化一次，避免对已归一 base64/绝对 URL 二次压缩（见 ②）。
 * 兼容旧数据：旧 pending（messageId 存在前）保留 text，迁移期仍可恢复。
 * 契约单一来源：构造用 makePendingRef、归一用本函数、消费见 useAgentChat 恢复（resolvePendingRecovery）。 */
export function normalizePending(raw: unknown): PendingRefState | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as RawPending;
  const next: PendingRefState = {
    conversationId: String(p.conversationId || ''),
    messageId: String(p.messageId || ''),
  };
  if (typeof p.text === 'string' && p.text) next.text = p.text;
  if (Array.isArray(p.attachments) && p.attachments.length)
    next.attachments = p.attachments.slice();
  return next;
}

/**
 * pending 引用契约的构造器（与 normalizePending / useAgentChat 恢复共用，单一书写源）。
 * @param {{conversationId?:string, messageId?:string, attachments?:Array}} [obj]
 * @returns {{conversationId:string, messageId:string, attachments?:Array}}
 */
export function makePendingRef({
  conversationId,
  messageId,
  attachments,
}: { conversationId?: string; messageId?: string; attachments?: unknown[] } = {}): PendingRefState {
  const p: PendingRefState = { conversationId: conversationId || '', messageId: messageId || '' };
  if (Array.isArray(attachments) && attachments.length) p.attachments = attachments.slice();
  return p;
}

/** 归一 memory（对齐大雄 agentEmptyConversationMemory） */
export function normalizeMemory(raw: unknown): ConversationMemory {
  const base = emptyMemory();
  if (!raw || typeof raw !== 'object') return base;
  const m = raw as RawMemory;
  const gc =
    m.global_contract && typeof m.global_contract === 'object'
      ? (m.global_contract as Record<string, unknown>)
      : null;
  return {
    summary: typeof m.summary === 'string' ? m.summary : base.summary,
    facts: Array.isArray(m.facts) ? m.facts.slice() : base.facts,
    lastPlan: (m.lastPlan as Record<string, unknown> | undefined) || null,
    lastSharedStyle:
      typeof m.lastSharedStyle === 'string' ? m.lastSharedStyle : base.lastSharedStyle,
    notes: Array.isArray(m.notes) ? m.notes.slice() : base.notes,
    global_contract: gc
      ? {
          visual_positioning: String(gc.visual_positioning || '').trim(),
          unified_style_prompt: String(gc.unified_style_prompt || '').trim(),
          unified_negative_prompt: String(gc.unified_negative_prompt || '').trim(),
        }
      : null,
    artifacts: Array.isArray(m.artifacts)
      ? (m.artifacts as unknown[]).map((a) => ({ ...(a as Record<string, unknown>) }))
      : null,
    assistantTable:
      m.assistantTable !== undefined && m.assistantTable !== null ? m.assistantTable : null,
  };
}

/** 重置 store 内存缓存（测试/硬重置用）：清空所有 agentKey 的缓存、等待者与在途水化 */
export function resetConversationCache(): void {
  for (const k of Object.keys(states)) delete states[k];
  for (const k of Object.keys(hydratedSet)) delete hydratedSet[k];
  // 放行悬挂的 waitHydrated（防止测试隔离/硬重置后等待者永久悬挂）
  for (const resolvers of hydrationWaiters.values()) for (const r of resolvers) r();
  hydrationWaiters.clear();
  // 清空在途水化：硬重置后应允许对最新 KV 重新水化（否则旧在途水化读到旧值会压制新水化）
  hydrationInFlight.clear();
  listeners.forEach((l) => l());
}
