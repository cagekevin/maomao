/**
 * AI 助手 · 会话域不变量校验（spec/AI-ASSISTANT-STATE-INVARIANTS-SSOT.md 批1/L4）。
 *
 * 把会话状态「应当恒真」的约束收敛成可单测的校验函数，接在纯函数用例末尾跑一次，
 * 防「activeId 悬空 / message id 撞号 / 终态残留 streaming / creditGate 形状坏」等长期静默。
 *
 * 与表格域 `tableInvariants.ts` 共享 `Violation[]` 范式：
 *   - level=error：硬约束，违反必须修；
 *   - level=warn：可疑（可能是合法中间态 / 兜底场景），记录即可。
 *
 * 【依赖方向（刻意零环）】本文件只 type-only 依赖 conversationState（Conversation / Memory /
 *   Workflow / StoreState），避免 conversationState（批2 要反向 import 本文件做写前校验）运行时成环。
 *   因此 AGENT_MSG_MAX / KNOWN_WORKFLOW_STATUS 为本地镜像，测试里断言与真源一致防漂移。
 *
 * 用法（对齐 spec §九）：
 *   import { validateConversation, validateConversationState } from './conversationInvariants.ts'
 *   const next = doSomething(fixture);
 *   expect(validateConversation(next).filter((v) => v.level === 'error')).toEqual([]);
 */
import type {
  Conversation,
  ConversationMemory,
  ConversationStoreState,
  WorkflowState,
} from './conversationState.ts';
import { CREDIT_GATE_FIELD } from '../../base/core/contracts.ts';
import type { Violation } from '../assistantTable/tableInvariants.ts';

/** 单会话消息上限（镜像 conversationState.AGENT_MSG_MAX=60，反向 import 会成环；测试断言二者随变） */
export const CONV_MSG_MAX = 60;

/** workflow.status 合法取值（镜像 runtime/workflowState.ts 的 WORKFLOW_STATUS，理由同 CONV_MSG_MAX） */
export const KNOWN_WORKFLOW_STATUS = new Set([
  'planning',
  'running',
  'awaiting_confirm',
  'stopped',
  'completed',
  'failed',
  'completed_with_errors',
]);

function err(code: string, message: string): Violation {
  return { level: 'error', code, message };
}
function warn(code: string, message: string): Violation {
  return { level: 'warn', code, message };
}

/** 校验单条会话。返回违规数组；空 = 健康。 */
export function validateConversation(conv: Conversation | null): Violation[] {
  const out: Violation[] = [];
  if (!conv || typeof conv !== 'object') return [err('S0', 'conv 结构缺失或非对象')];
  // I1：conversation id 必须有（跨对话唯一性由 validateConversationState 的 I1 查重兜底）
  if (!conv.id || typeof conv.id !== 'string') out.push(err('I1', 'conv.id 缺失'));
  // I2：message id 稳定唯一（缺 id / 撞号都是 P15 列表 key 崩坏温床）
  const seenMsg = new Map<string, number>();
  conv.messages.forEach((m, i) => {
    const id = m && (m as { id?: unknown }).id;
    if (id == null || id === '') {
      out.push(err('I2', `message 缺 id 位于 index ${i}`));
    } else {
      const n = seenMsg.get(String(id)) ?? 0;
      seenMsg.set(String(id), n + 1);
      if (n > 0) out.push(err('I2', `message id 重复「${id}」`));
    }
  });
  // S1：消息数 ≤ AGENT_MSG_MAX（防整包无限膨胀）
  if (conv.messages.length > CONV_MSG_MAX) {
    out.push(err('S1', `messages.length ${conv.messages.length} > AGENT_MSG_MAX(${CONV_MSG_MAX})`));
  }
  // S3：creditGate 形状合法（读侧 isCreditGate 与写侧 setCreditGate 同一套判定）
  const g = conv[CREDIT_GATE_FIELD];
  if (g != null) {
    const o = g as Record<string, unknown>;
    const ok =
      o &&
      typeof o === 'object' &&
      o.pending === true &&
      Array.isArray(o.gens) &&
      !!o.map &&
      typeof o.map === 'object' &&
      !Array.isArray(o.map);
    if (!ok)
      out.push(err('S3', 'creditGate 形状非法（需 { pending:true, gens:array, map:object }）'));
  }
  // P4：终态不得残留 streaming:true（否则刷新看到半截气泡）
  conv.messages.forEach((m, i) => {
    if (m && (m as { streaming?: unknown }).streaming === true) {
      out.push(err('P4', `message index ${i} 仍处于 streaming:true（终态残留）`));
    }
  });
  // 记忆 / 工作流子校验
  out.push(...validateMemory(conv.memory));
  out.push(...validateWorkflow(conv.workflow));
  return out;
}

/** 校验会话记忆。返回违规数组；空 = 健康。 */
export function validateMemory(mem: ConversationMemory | null): Violation[] {
  const out: Violation[] = [];
  if (!mem || typeof mem !== 'object') return [err('S0', 'memory 结构缺失或非对象')];
  // S4：global_contract 三字段恒为 string（契约键缺失会污染 fresh-task 注入）
  const gc = mem.global_contract;
  if (gc) {
    for (const f of [
      'visual_positioning',
      'unified_style_prompt',
      'unified_negative_prompt',
    ] as const) {
      if (typeof gc[f] !== 'string') out.push(err('S4', `global_contract.${f} 非 string`));
    }
  }
  return out;
}

/** 校验工作流运行时状态。返回违规数组；空 = 健康。 */
export function validateWorkflow(wf: WorkflowState | null): Violation[] {
  const out: Violation[] = [];
  if (!wf) return out;
  if (wf.id == null || wf.id === '') out.push(warn('S2', 'workflow.id 缺失'));
  if (!KNOWN_WORKFLOW_STATUS.has(wf.status)) {
    out.push(
      warn(
        'S2',
        `workflow.status「${String(wf.status)}」未知（合法集 ${[...KNOWN_WORKFLOW_STATUS].join('/')}）`,
      ),
    );
  }
  return out;
}

/**
 * 校验整份会话 store 状态（含 I3 activeId 有效性 / I1 跨对话 id 唯一 / T3 零对话）。
 * 供批2「落盘前写前校验」与单测网使用。
 * ⚠️ P1（序列化体积）已被 volumePolicy.applyConversationBudget 在落盘投影强制保证，
 *   此处不再每 commit 重复序列化（性能）；T1（切对话后残留）属跨对话时序，由用例如开关切换覆盖。
 */
export function validateConversationState(state: ConversationStoreState | null): Violation[] {
  const out: Violation[] = [];
  if (!state || !Array.isArray(state.conversations)) {
    return [err('S0', 'storeState 结构缺失（conversations 非数组）')];
  }
  // T3：不做零对话态（ensureActiveConversation 兜底建空；此处 warn 记可疑零态）
  if (state.conversations.length === 0) {
    out.push(warn('T3', 'conversations 为空（恒需 ≥1，靠 ensureActiveConversation 兜底）'));
  }
  // I1：conversation id 全局唯一
  const seen = new Map<string, number>();
  state.conversations.forEach((c, i) => {
    const n = seen.get(c.id) ?? 0;
    seen.set(c.id, n + 1);
    if (n > 0) out.push(err('I1', `conversation id 重复「${c.id}」位于 index ${i}`));
  });
  // I3：activeId 恒指向存在的对话
  if (state.conversations.length > 0 && !state.conversations.some((c) => c.id === state.activeId)) {
    out.push(err('I3', `activeId「${state.activeId}」不指向任何存在的对话（静默回退温床）`));
  }
  for (const c of state.conversations) out.push(...validateConversation(c));
  return out;
}
