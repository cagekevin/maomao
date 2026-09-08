/**
 * 会话体体积治理策略（纯函数，可单测）。
 *
 * 【为什么存在】AI 助手会话数据整包收敛进单个 localStorage 键 `agent_conversations_{agentKey}`，
 * 由 conversationState.js 的 persistDebounced 一次性 JSON.stringify 落盘。消息条数有 AGENT_MSG_MAX=60
 * 上限，但 lastResults/artifacts/memory 等大字段无上限；整包体积随累积增长，逼近 localStorage /
 * chrome.storage.local 配额后写入抛 QuotaExceededError → 触发「数据保存失败」Toast。
 * 本模块把「把体积管住」的纯逻辑收口，供写路径与序列化路径复用，避免散落。
 *
 * 【三层防线（叠加）】
 *   L1 静态上限（写入即限制）：
 *       sanitizeLastResults —— lastResults 按 url 去重 + 限条数（保留最近）。
 *       capConversationMemory —— memory.facts / memory.artifacts 限条数（保留最近）。
 *   L2 pending 去重（见 conversationSnapshot.setCurrentPending）：pending 不再存用户文本副本，
 *       改引用 messageId，恢复时在 messages 按 id 找回——消除「用户消息 + pending」双副本体积。
 *   L3 整包预算安全网（序列化前，两段式降级）：
 *       estimateConversationsBytes —— 估算整包序列化字节。
 *       applyConversationBudget —— 若超预算，对【投影副本】：
 *         ① 剥离瞬时冗余字段（pending / steerQueue / streaming 占位）
 *         ② 水位归一：正文截到 MSG_CONTENT_MAX（tool 结果 TOOL_CONTENT_MAX）、summary 截到 SUMMARY_MAX
 *         ③ 仍超则贪心截断最大的若干字符串（折半），直到回到预算内或达最大轮数。
 *       只作用于落盘快照，绝不动内存态（states），保证撤销/上下文/恢复读到完整数据。
 *       ② 的作用：降级目标可预测（截到设计水位而非盲砍），并避免「单条超长消息吃掉整包预算、
 *       把其余消息挤成反复砍半」的不公平。
 *
 * 【数据流】写路径（appendMsg / setCurrentSnapshot / setCurrentMemory）调 L1；
 * persistDebounced 的 writer 调 L3 后把投影结果交给 contentSet；L2 在 setCurrentPending 实现。
 *
 * 【契约】这些常量是体积治理的单一事实源；M5 配额预警复用 SAFE_BUDGET_BYTES。
 */

/** lastResults 单项（按 url 去重主键；缺 url 回落 name） */
export interface LastResultItem {
  url?: string;
  name?: string;
}

/** 消息最少形状（lastResults 可嵌套数组） */
export interface ChatMessage {
  content?: string;
  lastResults?: LastResultItem[] | null;
  [key: string]: unknown;
}

/** memory 形状（summary / facts / artifacts 限容）。artifacts 可显式为 null（无跨步成果）。 */
export interface ConversationMemory {
  summary?: string;
  facts?: unknown[];
  artifacts?: unknown[] | null;
  [key: string]: unknown;
}

/** 会话整包形状（L3 降级在投影副本上做，不改引用）。
 *  pending / workflow 经 conversationState 归一后可为 null（非仅 undefined），故显式允许 null。 */
export interface Conversation {
  pending?: unknown;
  workflow?: { steerQueue?: unknown[] } | null;
  messages?: ChatMessage[];
  memory?: ConversationMemory;
  [key: string]: unknown;
}

/** 单条 user/assistant 正文存储上限（L3 水位归一段用） */
export const MSG_CONTENT_MAX: number = 4000;
/** 单条 tool 结果存储上限（同上；结构化输出更长，故水位更宽） */
export const TOOL_CONTENT_MAX: number = 6000;
export const LAST_RESULTS_MAX: number = 20; // 单条 assistant 消息 lastResults 条数上限（L1/L3）
/** memory.summary 上限（L3 水位归一段用） */
export const SUMMARY_MAX: number = 3000;
export const FACTS_MAX: number = 60; // memory.facts 条数上限（L1/L3，保最近）
export const ARTIFACTS_MAX: number = 20; // memory.artifacts 条数上限（L1/L3，保最近）
/** workflow.steerQueue 条数上限（L1，防排队膨胀；在 conversationState.normalizeWorkflow 归一入口限容保最近） */
export const STEER_QUEUE_MAX: number = 20;
/** 安全水位：保守远低于典型配额（localStorage ≈5MB、chrome.storage.local ≈10MB），从源头规避超配额写失败 */
export const SAFE_BUDGET_BYTES: number = 2 * 1024 * 1024;
/** L3 单次降级允许的最大截断/剥离轮数（防病态输入死循环） */
const BUDGET_MAX_ITER: number = 8;
/** 超预算后逐层剥离的可丢弃字段名（按代价从低到高，先丢无用户语义的瞬时数据） */

/** 截断字符串到 max 字符，超长补省略标记（保留语义可读性；纯函数） */
export function truncateTo(str: string, max: number): string {
  if (typeof str !== 'string' || str.length <= max) return str;
  const head = Math.max(0, max - '…[已截断]'.length);
  return str.slice(0, head) + '…[已截断]';
}

/** lastResults 去重（按 url）+ 限条数（保最近 LAST_RESULTS_MAX 条）。入参可能为 undefined/null/原数组。 */
export function sanitizeLastResults(list: LastResultItem[] | null | undefined): LastResultItem[] {
  if (!Array.isArray(list) || list.length === 0) return list || [];
  const seen = new Set<string>();
  const out: LastResultItem[] = [];
  // 保留顺序中「较新」的项：从后往前去重，最后反转为保留最近
  for (let i = list.length - 1; i >= 0 && out.length < LAST_RESULTS_MAX; i--) {
    const item = list[i];
    if (!item || typeof item !== 'object') continue;
    const key = item.url || String(item.name || '') || JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.reverse();
}

/** 消息数组内 `lastResults` 去重 + 限条（写入口 L1 用）。非数组原样返回。 */
export function sanitizeMessages(
  list: ChatMessage[] | null | undefined,
): ChatMessage[] | null | undefined {
  if (!Array.isArray(list)) return list;
  return list.map((m) => {
    if (m && typeof m === 'object' && Array.isArray(m.lastResults))
      return { ...m, lastResults: sanitizeLastResults(m.lastResults) };
    return m;
  });
}

/** memory 限容（保最近）：facts → FACTS_MAX、artifacts → ARTIFACTS_MAX。入 prefer original 引用不变时原样返回。 */
/**
 * 泛型保型：调用方的 memory 具体类型（如 conversationState 的 ConversationMemory）不被擦成本模块的宽松形状。
 * 运行时逻辑不变。
 */
export function capConversationMemory<T extends ConversationMemory | null | undefined>(
  memory: T,
): T {
  if (!memory || typeof memory !== 'object') return memory;
  const next: ConversationMemory = { ...memory };
  if (Array.isArray(next.facts) && next.facts.length > FACTS_MAX)
    next.facts = next.facts.slice(-FACTS_MAX);
  if (Array.isArray(next.artifacts) && next.artifacts.length > ARTIFACTS_MAX)
    next.artifacts = next.artifacts.slice(-ARTIFACTS_MAX);
  return next as T;
}

/** 估算 conversations 整包序列化字节（用 JSON.stringify 长度，与落盘口径一致；兜底返回 0） */
export function estimateConversationsBytes(conversations: unknown[] | null | undefined): number {
  if (!Array.isArray(conversations) || conversations.length === 0) return 0;
  try {
    return JSON.stringify(conversations).length;
  } catch {
    return 0;
  }
}

/** downgradeConversation 选项 */
interface DowngradeOpts {
  dropStreaming?: boolean;
  dropPending?: boolean;
  dropSteerQueue?: boolean;
}

/**
 * 把单条消息降级：剥离 transient 字段 + 截断超长正文/工具结果。
 * 纯函数返回新消息（不 mutate 入参）。opt = { dropStreaming, dropPending, truncateContent }
 */
function downgradeConversation(
  conv: Conversation | null | undefined,
  opt: DowngradeOpts = {},
): Conversation | null | undefined {
  if (!conv || typeof conv !== 'object') return conv;
  const next: Conversation = { ...conv };
  // 1) 可剥离瞬时字段（无用户语义，落盘丢后刷新不损失核心记录）
  if (opt.dropPending && next.pending !== undefined) next.pending = null;
  if (opt.dropSteerQueue && Array.isArray(next.workflow?.steerQueue))
    next.workflow = { ...next.workflow, steerQueue: [] };
  if (opt.dropStreaming && Array.isArray(next.messages)) {
    next.messages = next.messages.filter((m) => !m || m.streaming !== true);
  }
  // 2) lastResults 去重限条
  if (Array.isArray(next.messages)) {
    next.messages = next.messages.map((m) => {
      if (m && Array.isArray(m.lastResults))
        return { ...m, lastResults: sanitizeLastResults(m.lastResults) };
      return m;
    });
  }
  // 3) memory 限容
  next.memory = capConversationMemory(next.memory);
  return next;
}

/** 单条正文的水位：tool 结果是结构化输出，比普通正文更宽 */
function contentLimitOf(msg: ChatMessage): number {
  return msg.role === 'tool' ? TOOL_CONTENT_MAX : MSG_CONTENT_MAX;
}

/**
 * 水位归一（L3 第②段）：把超水位的字段一次性截到设计上限——
 * 正文 → MSG_CONTENT_MAX（tool → TOOL_CONTENT_MAX）、memory.summary → SUMMARY_MAX。
 * 未超水位的字段原样保留；纯函数，返回新数组（不改入参）。
 */
function clampToLimits(convs: Conversation[]): Conversation[] {
  return convs.map((conv) => {
    let changed = false;
    const next: Conversation = { ...conv };
    if (Array.isArray(next.messages)) {
      next.messages = next.messages.map((m) => {
        if (!m || typeof m.content !== 'string') return m;
        const limit = contentLimitOf(m);
        if (m.content.length <= limit) return m;
        changed = true;
        return { ...m, content: truncateTo(m.content, limit) };
      });
    }
    const summary = next.memory?.summary;
    if (typeof summary === 'string' && summary.length > SUMMARY_MAX) {
      next.memory = { ...next.memory, summary: truncateTo(summary, SUMMARY_MAX) };
      changed = true;
    }
    return changed ? next : conv;
  });
}

/**
 * L3 整包预算降级：若整包字节超预算，对 conversations 的【投影副本】做有界降级，返回 { conversations, downgraded }。
 *   - 投影副本：不改入参（内存态保持完整），仅用于落盘。
 *   - 降级顺序（仅当整包超预算时才逐级加深，未超预算不做任何截断）：
 *     ① 剥离瞬时字段（pending/steerQueue/streaming 占位）
 *     ② 水位归一（正文/memory.summary 截到设计上限）
 *     ③ 贪心截断「最大单条字符串」（折半），直到回到预算内或达到最大轮数。
 *   返回的 downgraded=true 表示确实做了降级（供日志）。
 */
export function applyConversationBudget(
  conversations: Conversation[] | null | undefined,
  budget: number,
  // 该形参目前未参与计算（保留位），调用方（conversationState 落盘投影）只传前两参，故标可选。
  _activeId?: string,
): { conversations: Conversation[] | null | undefined; downgraded: boolean } {
  if (!Array.isArray(conversations) || conversations.length === 0) {
    return { conversations, downgraded: false };
  }
  let projected = conversations.map((c) =>
    downgradeConversation(c, { dropStreaming: true, dropPending: true, dropSteerQueue: true }),
  );
  let bytes = estimateConversationsBytes(projected);
  // downgraded 沿用原语义：① 剥离瞬时字段后仍超预算即视为发生降级（供日志/告警）
  const downgraded = bytes > budget;
  const effectiveBudget = budget || SAFE_BUDGET_BYTES;
  // ② 水位归一：仅在仍超预算时执行——未超预算时一条超长正文不该被白截
  if (bytes > effectiveBudget) {
    projected = clampToLimits(projected);
    bytes = estimateConversationsBytes(projected);
  }
  let iter = 0;
  while (bytes > effectiveBudget && iter < BUDGET_MAX_ITER) {
    // 贪心：找「当前可截断」字段里最大的一条字符串进行截断
    let best:
      | { kind: 'content'; conv: Conversation; msg: ChatMessage; len: number }
      | { kind: 'summary'; conv: Conversation; len: number }
      | null = null; // { path indicators } → 直接重建
    let bestLen = 0;
    for (const conv of projected) {
      for (const msg of conv.messages || []) {
        if (typeof msg?.content === 'string' && msg.content.length > bestLen) {
          best = { kind: 'content', conv, msg, len: msg.content.length };
          bestLen = msg.content.length;
        }
      }
      const mem = conv.memory;
      if (mem && typeof mem.summary === 'string' && mem.summary.length > bestLen) {
        best = { kind: 'summary', conv, len: mem.summary.length };
        bestLen = mem.summary.length;
      }
    }
    if (!best) break; // 无可截断字段，退出
    projected = projected.map((conv) => {
      if (conv === best.conv) {
        const c: Conversation = { ...conv, messages: [...(conv.messages || [])] };
        if (best.kind === 'content') {
          c.messages = c.messages.map((m) =>
            m === best.msg
              ? { ...m, content: truncateTo(m.content, Math.floor(m.content.length / 2)) }
              : m,
          );
        } else if (best.kind === 'summary') {
          c.memory = {
            ...c.memory,
            summary: truncateTo(c.memory.summary, Math.floor(c.memory.summary.length / 2)),
          };
        }
        return c;
      }
      return conv;
    });
    bytes = estimateConversationsBytes(projected);
    iter++;
  }
  return { conversations: projected, downgraded };
}
