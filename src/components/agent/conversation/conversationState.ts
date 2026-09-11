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
 * 【本文件职责 = 审计文档 §1.6 的"共享 state 层"】states/hydration/hydrated/currentAgentKey/listeners
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
  STEER_QUEUE_MAX,
} from '../../base/utils/volumePolicy.ts';
// 【批2 · 落盘前写前校验】validateConversationState 仅 type 依赖本文件，不形成运行时环
import { validateConversationState } from './conversationInvariants.ts';

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
import type {
  Conversation,
  ConversationMemory,
  ConversationStorePatch,
  ConversationStoreState,
  PendingRefState,
  RawConversation,
  RawMemory,
  RawPending,
  RawWorkflow,
  WorkflowState,
} from './conversationTypes.ts';
export * from './conversationTypes.ts';

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
    assistantTables: null, // AI 助手表格工作区多标签页真源（{tabs,activeTabId}；读写见 get/setCurrentAssistantTabs）
  };
}

/**
 * 单一数据源改为「按 agentKey 隔离」：每个 agentKey（本项目=每项目）一份 { conversations, activeId, sending }。
 * 这样 AI 会话跟随项目走，项目作为最顶层，互不串话。
 * sending = 运行态标志（是否正在发送/流式）。仅存内存、不落盘（persist 只序列化 conversations + activeId）。
 */
const states: Record<string, ConversationStoreState> = {}; // { [agentKey]: { conversations, activeId, sending } }
let currentAgentKey: string = AGENT_KEY_PREFIX; // 当前生效的 agentKey（由 setAgentKey 设置）

// P4 落盘节流：commit 每次变更全量 stringify + 落盘是热路径（流式/轮询/记忆提炼高频触发），
// 防抖合并成最终态一次落盘。通知订阅者（notify）保持即时，只有「落盘」被节流。
// write 是「读当前最新 state」的 thunk——flush 时才执行，天然合并窗口内多次 commit 的最终态。
// 兜底：createDebouncedPersist 自动注册 pagehide flush，极端刷新/关闭不丢最后变更。
const persistDebounced = createDebouncedPersist(() => {
  if (!hydrated.has(currentAgentKey)) return; // 未水化不落盘（空壳会覆盖 KV 真数据）
  const next = states[currentAgentKey];
  if (!next) return;
  // 【P1c L3 整包预算安全网】序列化前对归一化副本做投影降级：整包超预算时先剥离瞬时字段、
  // 再截断最大字符串，保证落盘字符串恒 < SAFE_BUDGET_BYTES（规避 QuotaExceededError）。
  // 只作用于落盘投影副本，绝不动 states 本体（内存态完整，撤销/上下文/恢复读取不受影响）。
  // 【P4 自愈·2026-09-11】用浅拷贝喂 normalizeConversation：该函数就地改写入参（归一字段），
  // 若不拷贝会污染内存态——尤其流式途中会把 live 消息的 streaming 标志抹掉，致 UI 提前停 typing / 冻结流式增量。
  // streaming 在归一时被清为 false（见 normalizeConversation 内 P4 自愈），落盘永不带 streaming:true。
  const normalized = next.conversations.map((conv) =>
    normalizeConversation({ ...conv, messages: conv.messages }),
  );
  // 【批2 · 落盘前写前校验】dev 下对硬约束（error）违规告警——把「假成功」在写时就抓住，不等用户踩。
  // 只作用于内存归一副本，与落盘投影降级互不影响；P1 体积仍由下方 applyConversationBudget 强制。
  if (import.meta.env.DEV !== false) {
    const violations = validateConversationState({
      conversations: normalized,
      activeId: next.activeId,
      sending: false,
    }).filter((v) => v.level === 'error');
    if (violations.length) {
      logger.warn('AI助手', '会话落盘前不变量校验失败', {
        key: convKey(currentAgentKey),
        count: violations.length,
        violations,
      });
    }
  }
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
 * 空窗期（setAgentKey → 水化落地）内 states[k] 只是空壳：同步读不会崩，但读不到真数据。
 * 防竞态只有两条机制（其余都是注释）：
 *  - ① 每 key 只水化一次：`hydration` 缓存 Promise，重复调用拿同一个（缓存即幂等，无需 InFlight/Waiters 两套账）；
 *  - ② 水化未完成不落盘：`hydrated` 是同步闸，防「空壳覆盖 KV 真数据」（唯一真正要防的竞态，见 commit/persist）。
 * 其余既定取舍（2026-08-28）：迁移写 KV 用 contentSetAsync（await）+ logger 记录成败；读/写都走 withTimeout 兜超时；
 * C3 不做「迁完删 local」：KV 失败降级仍写 local 副本（storageGet 兜底可回读），local 键保留语义不破坏。
 */

/** 每个 agentKey 的水化任务：在途/已完成都只此一份（Map 缓存 = 幂等 = 去重 + 等待者，一套账） */
const hydration = new Map<string, Promise<void>>();

/** 已完成水化的 agentKey（同步判定闸：未完成时 commit 不排期落盘、persist 直接 no-op） */
const hydrated = new Set<string>();

/**
 * 取（必要时发起）某 agentKey 的水化 Promise；同 key 永远返回同一个（幂等）。
 * 【永不 reject】读失败按「无存量」继续并照常置 hydrated —— 否则等待者永久悬挂、落盘闸永远打不开
 * （后续写入全部静默丢失，比「读到空态」更糟）。失败经 logger 可见（不静默）。
 */
function hydrate(k: string): Promise<void> {
  const cached = hydration.get(k);
  if (cached) return cached;
  const p = hydrateAsync(k)
    .catch((e) =>
      logger.warn('AI助手', '会话水化失败，按空态继续（下次进入会重新读取）', {
        key: convKey(k),
        error: e?.message || String(e),
      }),
    )
    .finally(() => {
      hydrated.add(k); // 无论成败：水化尝试结束即放行落盘（空态也是确定态，不该让后续写入丢）
    });
  hydration.set(k, p);
  return p;
}

/**
 * 等到某 agentKey 水化完成（未发起则先发起）。永不 reject，可直接 await。
 * 会话键迁 KV 后水化为异步，调用方（如 useAgentChat 恢复 effect）须先 await 本 Promise，
 * 才能读到真实数据而非空壳（见 AI助手会话存储迁移-KV收口事实记录.md §2.5）。
 * @param {string} [k] agentKey，缺省为当前 agentKey
 * @returns {Promise<void>}
 */
export function waitHydrated(k?: string): Promise<void> {
  return hydrate(k || currentAgentKey);
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
 * 并异步水化真实数据（读 KV → 必要时迁存量 → 写全 states[k] → 置 hydrated 放行落盘）。
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

/** 确保某 agentKey 有 state：无则放空壳保同步读不崩，并发起（幂等的）异步水化 */
function ensureState(k: string): void {
  if (!states[k]) {
    // 空壳：让同步 getState/订阅立即有对象可读，不阻塞 UI
    states[k] = { conversations: [], activeId: '', sending: false };
  }
  void hydrate(k); // 幂等：已在途/已完成则直接返回同一个 Promise
}

/**
 * 异步水化一个 agentKey：读 KV（新后端）→ 必要时把 localStorage 存量一次性迁入 KV（幂等）→ 写全 states[k]。
 * 只由 hydrate() 调用，故每个 key 最多跑一次（resetConversationCache 后再跑 = 新的一次水化）。
 */
async function hydrateAsync(k: string): Promise<void> {
  // ① 并行读 KV（会话 + 活跃 id，最坏耗时减半）；读失败视为无 KV 数据并走存量兜底，失败经 logger 可见（不静默）
  const convP = withTimeout(contentGetAsync(convKey(k)), KV_TIMEOUT, `读取会话水化超时(${k})`);
  const activeP = withTimeout(
    contentGetAsync(activeKey(k)),
    KV_TIMEOUT,
    `读取活跃会话 id 超时(${k})`,
  );
  let kvConversations: unknown = null;
  try {
    kvConversations = await convP;
  } catch (e) {
    logger.warn('AI助手', '水化读会话 KV 失败，回退本地存量', {
      key: convKey(k),
      error: e?.message || String(e),
    });
  }
  let kvActiveId = '';
  try {
    const id = await activeP;
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

  // ④ 写全内存态 + 通知订阅者；hydrated 由 hydrate() 在本 Promise settle 时统一置上（此后允许落盘）。
  //    注：此处整体覆盖 states[k] —— 空窗期的写入会被真数据取代（既定语义），故写入方须先 await waitHydrated。
  states[k] = { conversations, activeId, sending: false };
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
  if (hydrated.has(currentAgentKey) && persist) persistDebounced.schedule();
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

/**
 * 写入口守卫（spec/AI-ASSISTANT-STATE-INVARIANTS-SSOT.md 批0）：返回当前对话；无则
 * logger.warn 记录「写未生效」并返回 null。把「假成功」转「可见错误」——写没生效不再静默吞掉。
 * 用于所有 `if (!conv) return` 的写入口（setCurrentXxx / push/pop / markXxx 等）。
 *
 * 【限噪】水化竞态窗（hydrate 前空壳 + 某 effect 抢先做写）会连续命中同一 op，瞬时刷日志淹没真实告警。
 * 故按 op 做分钟级限频：同 op 在窗口内只 warn 一次，避免噪音，又不掩盖「确实悬空」这一事实。
 */
const warnWindowMs = 5000;
const lastWarnByOp = new Map<string, number>();
function throttledWarnClick(op: string): boolean {
  const now = Date.now();
  const last = lastWarnByOp.get(op);
  lastWarnByOp.set(op, now);
  if (last === undefined || now - last >= warnWindowMs) return true;
  return false;
}
export function requireActiveConv(op: string): Conversation | null {
  const conv = getActiveConv();
  if (!conv) {
    // 【壳期静默】空壳期（hydrate 异步未完成）写未生效是预期，直接跳过告警；写仍被拦下（返回 null），
    // 绝不因「静默」而用空数据覆盖 KV 真数据。水化失败也会在 hydrate().finally 里 hydrated.add，
    // 故「真悬空」仍会告警，安全网不撤。
    if (!hydrated.has(currentAgentKey)) return null;
    if (throttledWarnClick(op)) {
      logger.warn('AI助手', `写「${op}」未生效：当前无有效对话（activeId 悬空）`, {
        activeId: getState().activeId,
      });
    }
  }
  return conv;
}

/** 标记当前 agentKey 已从存储恢复（hydrated=true，此后 commit 允许落盘）。
 *  由 applyConversation / importLegacy（conversationStore 聚合层）在恢复/切换成功后调用。 */
export function markHydrated(): void {
  hydrated.add(currentAgentKey);
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
  // 【P4 自愈·2026-09-11】streaming 是瞬时 UI 标志（与 sending 同类）：刷新后无法续流，
  // 绝不该落盘、水化即清。否则历史未收尾的 streaming:true 会残留，触发「会话落盘前不变量校验」P4 警告，
  // 并让刷新后看到半截气泡（内容已完整、仅标志位残留）。仅在 projections 副本上清除；调用方已保证不污染 live（落盘路径传浅拷贝）。
  c.messages = c.messages.map((m) => {
    const msg = m as Record<string, unknown> | null;
    if (msg && typeof msg === 'object' && msg.streaming === true) {
      return { ...msg, streaming: false };
    }
    return m;
  });
  if (!Array.isArray(c.skills)) c.skills = [];
  if (!Array.isArray(c.attachments)) c.attachments = [];
  if (typeof c.title !== 'string') c.title = c.title || '对话';
  if (typeof c.titleCustom !== 'boolean') c.titleCustom = false;
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
  // L1 静态上限：防补充指令队列无限膨胀（保最近 STEER_QUEUE_MAX 条，水位定义见 volumePolicy）
  else if (w.steerQueue.length > STEER_QUEUE_MAX)
    w.steerQueue = w.steerQueue.slice(-STEER_QUEUE_MAX);
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
    assistantTables:
      m.assistantTables !== undefined && m.assistantTables !== null ? m.assistantTables : null,
  };
}

/** 重置 store 内存缓存（测试/硬重置用）：清空所有 agentKey 的缓存、等待者与在途水化 */
export function resetConversationCache(): void {
  for (const k of Object.keys(states)) delete states[k];
  // 清空水化记录：硬重置后允许对最新 KV 重新水化（旧在途水化仍会 settle，但只写自己的那一次）
  hydrated.clear();
  hydration.clear();
  listeners.forEach((l) => l());
}
