/**
 * ════════════════════════════════════════════════════════════════
 * 会话隔离数据层 —— 当前对话快照读写（D 类：runtime 状态）
 * ════════════════════════════════════════════════════════════════
 *
 * 【拆分契约 · 2026-08-21】从 conversationStore.js 拆出的 D 类职能：
 * "读写当前对话"的快照/workflow/pending/memory。依赖单向指向 conversationState 底座。
 * 下游 conversationImageMap / conversationStore(聚合) 可再依赖本文件。
 * 命名/导出不变，消费方无感知。
 * ════════════════════════════════════════════════════════════════
 */
import {
  getActiveConv,
  requireActiveConv,
  commit,
  getState,
  normalizeWorkflow,
  normalizePending,
  normalizeMemory,
  emptyMemory,
  AGENT_MSG_MAX,
} from './conversationState.ts';
import {
  ConversationMessage,
  WorkflowState,
  PendingRefState,
  ConversationMemory,
} from './conversationState.ts';
// 【P1b L1 静态上限】写入口统一限容：lastResults 去重限条 + memory 限条，防止整包体积无界增长（见 volumePolicy.js）
import { sanitizeMessages, capConversationMemory } from '../../base/utils/volumePolicy.ts';

/**
 * 当前对话快照（对外读形状）。
 * 具体字段类型待 conversationState.ts 转完后收敛为 Conversation 的子集视图；
 * 此处以「结构 + 逐字段可空」为准，不改变运行时行为。
 */
export interface ConversationSnapshot {
  messages: ConversationMessage[];
  skills: unknown[];
  attachments: unknown[];
  draft: string;
  /** 工作流运行时状态（无则 null，见 workflowState.WorkflowStatus） */
  workflow: WorkflowState | null;
  /** 刷新恢复用的 pending 引用（无则 null） */
  pending: PendingRefState | null;
  memory: ConversationMemory;
}

/** setCurrentSnapshot 入参：只覆盖传入字段，其余保留 */
export type SnapshotPatch = Partial<ConversationSnapshot> & Record<string, unknown>;

/** 读当前对话的快照副本（对外） */
export function getCurrentSnapshot(): ConversationSnapshot {
  const conv = getActiveConv();
  return {
    messages: conv ? [...conv.messages] : [],
    skills: conv ? [...conv.skills] : [],
    attachments: conv ? [...conv.attachments] : [],
    draft: conv?.draft || '',
    workflow: conv?.workflow
      ? { ...conv.workflow, steerQueue: [...(conv.workflow.steerQueue || [])] }
      : null,
    pending: conv?.pending
      ? { ...conv.pending, attachments: [...(conv.pending.attachments || [])] }
      : null,
    memory: conv?.memory ? normalizeMemory(conv.memory) : emptyMemory(),
  };
}

/**
 * 同步当前对话的内存态（**部分 patch：只覆盖显式传入的字段，未传字段原样保留**）。
 * 重构后这是唯一写入口之一：更新 active 对话并自动落盘。
 *
 * 【契约（TD-17 显式化 2026-09-11 · 改调用点前必读）】
 *  - `undefined` = **不动该字段**；要清空必须显式传空值（`draft: ''` / `attachments: []`）。
 *  - **禁止**为「顺手同步一下」而在切换/发送等路径上盲目列举字段——那正是 TD-17 的根因：
 *    `switchChat/newChat/deleteChat` 曾各自手写 `draft: ''`，把「即将离开的会话」的草稿清掉
 *    （旧 `agent_draft` 独立键时代的遗留防御，收敛进 `conv.draft` 后变成数据破坏）。
 *  - 判据：**要改哪个字段就只传哪个**。带别的字段 = 声明你确实要覆盖它，请写明理由。
 *  - `workflow`/`pending` 例外：`pending` 用 `!== undefined` 判空（可显式置 null），`workflow` 为真值判断。
 *
 * 【TD-11-5 收窄 2026-09-11】本函数仍保留（是唯一写漏斗），但**新代码禁止用它列举字段**：
 * 单字段写请走下列 `setCurrentDraft/setCurrentSkills/setCurrentAttachments/setCurrentMessages`，
 * 「清空整对话」请走 `resetCurrentConversationToEmpty`。理由：部分 patch 的「漏列举」在类型层面
 * 不可防（多传/少传都合法），只有把「一次只改一件语义事」做成**函数签名**才能让错误不可能发生。
 */
export function setCurrentSnapshot(snap?: SnapshotPatch | null): void {
  const conv = requireActiveConv('setCurrentSnapshot');
  if (!conv) return;
  const rawMessages = Array.isArray(snap?.messages)
    ? snap.messages.slice(-AGENT_MSG_MAX)
    : conv.messages;
  const rawMemory = snap?.memory ? normalizeMemory(snap.memory) : conv.memory;
  const next = {
    ...conv,
    // 【P1b L1】写入口统一限容：lastResults 去重限条 + memory 限条
    messages: sanitizeMessages(
      rawMessages as Parameters<typeof sanitizeMessages>[0],
    ) as ConversationMessage[],
    skills: Array.isArray(snap?.skills)
      ? snap.skills.map((s) => ({ ...(s as Record<string, unknown>) }))
      : conv.skills,
    attachments: Array.isArray(snap?.attachments)
      ? snap.attachments.map((a) => ({ ...(a as Record<string, unknown>) }))
      : conv.attachments,
    draft: typeof snap?.draft === 'string' ? snap.draft : conv.draft,
    workflow: snap?.workflow ? normalizeWorkflow(snap.workflow) : conv.workflow,
    pending: snap?.pending !== undefined ? normalizePending(snap.pending) : conv.pending,
    memory: capConversationMemory(rawMemory),
    updatedAt: Date.now(),
  };
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) => (c.id === conv.id ? next : c)),
  });
}

/**
 * 轻量更新当前对话的消息数组：只更新 messages + 通知订阅者，跳过落盘（persist:false）。
 * 【用途】流式热路径（updateLastStreaming/endStreaming）每 50ms 高频调用，若走 setCurrentSnapshot
 *   （内部 commit → 触发 persistDebounced 落盘调度）会造成高频落盘抖动；此函数不落盘，
 *   最终态由 send 的 finally 统一 captureActiveConversation 落盘。
 * 【同步性】commit 内部同步更新 states 并 notify，因此调用后立即 getState()/getCurrentSnapshot()
 *   读取到的就是最新消息（保证 send finally 同步读到完整 assistant 而非空 streaming 占位）。
 */
export function patchCurrentMessages(messages?: ConversationMessage[] | null): void {
  const conv = requireActiveConv('patchCurrentMessages');
  if (!conv) return;
  commit(
    {
      ...getState(),
      conversations: getState().conversations.map((c) =>
        c.id === conv.id
          ? {
              ...c,
              messages: Array.isArray(messages) ? messages.slice(-AGENT_MSG_MAX) : c.messages,
              updatedAt: Date.now(),
            }
          : c,
      ),
    },
    { persist: false },
  );
}

/** 读当前对话的 workflow（副本；无则 null） */
export function getCurrentWorkflow(): WorkflowState | null {
  return getActiveConv()?.workflow
    ? { ...getActiveConv().workflow, steerQueue: [...(getActiveConv().workflow.steerQueue || [])] }
    : null;
}

/** 原地补丁当前对话的 workflow（运行时状态；更新后落盘） */
export function patchCurrentWorkflow(patch: Record<string, unknown> = {}): WorkflowState | null {
  const conv = requireActiveConv('patchCurrentWorkflow');
  if (!conv) return null;
  const wf = conv.workflow
    ? { ...conv.workflow }
    : { status: 'planning', nodeIds: [], steerQueue: [] };
  const nextWf = normalizeWorkflow({
    ...wf,
    ...patch,
    steerQueue: Array.isArray(patch?.steerQueue) ? patch.steerQueue : wf.steerQueue || [],
  });
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id ? { ...c, workflow: nextWf, updatedAt: Date.now() } : c,
    ),
  });
  return nextWf;
}

/** 读当前对话的 pending（副本；无则 null） */
export function getCurrentPending(): PendingRefState | null {
  const p = getActiveConv()?.pending;
  return p ? { ...p, attachments: [...(p.attachments || [])] } : null;
}

/** 设置/清除当前对话的 pending（刷新后据此恢复任务） */
export function setCurrentPending(p: unknown): void {
  const conv = requireActiveConv('setCurrentPending');
  if (!conv) return;
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id ? { ...c, pending: normalizePending(p), updatedAt: Date.now() } : c,
    ),
  });
}

/** 读当前对话的 memory（副本；无则空记忆） */
export function getCurrentMemory(): ConversationMemory {
  return getActiveConv()?.memory ? normalizeMemory(getActiveConv().memory) : emptyMemory();
}

/** 更新当前对话的 memory（提炼 lastPlan 等；【P1b】facts/artifacts 限容） */
export function setCurrentMemory(m: unknown): void {
  const conv = requireActiveConv('setCurrentMemory');
  if (!conv) return;
  commit({
    ...getState(),
    conversations: getState().conversations.map((c) =>
      c.id === conv.id
        ? { ...c, memory: capConversationMemory(normalizeMemory(m)), updatedAt: Date.now() }
        : c,
    ),
  });
}

/* ────────────────────────────────────────────────────────────────
 * 【TD-11-5 · 单字段原子写（窄接口）】2026-09-11
 * 每个函数一次只改**一件语义事**，签名即契约：
 *   - 无法「漏列举」：要改 draft 就只能调 setCurrentDraft，不存在"顺带清别的"；
 *   - 无法「多传」：参数类型就是该字段的真类型（不是宽松 Record）；
 *   - 读回一律走 getCurrentSnapshot/各 getCurrent*，不另开读入口。
 * 新代码禁止再用 setCurrentSnapshot 列举字段（保留仅为「一次改多字段」的迁移期出口）。
 * ──────────────────────────────────────────────────────────────── */

/** 写当前对话草稿（唯一写点）。草稿是会话数据：切对话留存、随会话落盘。 */
export function setCurrentDraft(draft: string): void {
  setCurrentSnapshot({ draft: String(draft ?? '') });
}

/** 写当前对话技能列表（随会话落盘） */
export function setCurrentSkills(skills: unknown[]): void {
  setCurrentSnapshot({ skills: Array.isArray(skills) ? skills : [] });
}

/**
 * 写当前对话消息数组（整体替换；随会话落盘）。
 * 与 `agentMessages.setHistory` 的区别：本函数**不补消息 id**，供「已有稳定 id 的消息整体写回」场景
 * （如按内容定位 patch 后写回）。需要补 id 的新消息构造请走 `agentMessages.setHistory`。
 */
export function setCurrentMessages(messages: ConversationMessage[] | unknown[]): void {
  setCurrentSnapshot({
    messages: (Array.isArray(messages) ? messages : []) as ConversationMessage[],
  });
}

/** 写当前对话附件列表（随会话落盘） */
export function setCurrentAttachments(attachments: unknown[]): void {
  setCurrentSnapshot({ attachments: Array.isArray(attachments) ? attachments : [] });
}

/**
 * 把当前对话重置为「空对话」（清空消息/草稿/附件/工作流/pending/记忆/生成暂存）。
 *
 * 【为何是一个函数而不是调用点手抄字段】原 `useAgentChat.clear()` 就地手写了 11 个字段
 * （含整份 `memory` 字面量），等于**复制了一遍 `emptyMemory()` 的定义**——`Conversation` 每加
 * 一个需清空的字段，clear 就必须记得回来加，漏一次即静默残留（TD-11-5 同源病灶）。
 * 现收敛为「重置」这一语义动作，字段清单只此一处。
 *
 * 注：`skills` 保留（清空对话不撤已选技能，与原 `clear()` 行为一致）；
 *     `aiUndoStack`/`referenceImages`/`pendingMemorySuggest` 等 per-conversation 运行态
 *     由 `normalizeConversation` 在重置时补默认（此处显式置空以免依赖归一兜底）。
 */
export function resetCurrentConversationToEmpty(skills: unknown[] = []): void {
  setCurrentSnapshot({
    messages: [],
    skills: Array.isArray(skills) ? skills : [],
    draft: '',
    attachments: [],
    workflow: null,
    pending: null,
    memory: emptyMemory(),
    pendingGenerations: null,
    awaitingConfirm: false,
  });
}
