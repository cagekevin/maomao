/**
 * AI 助手工作流状态迁移（纯函数层，M2 收口）。
 *
 * 定位：把 useAgentChat 里散落的「自己算 workflow 状态」的 7 处调用点
 * （steer 入队 / planning 起步 / awaiting_confirm / 终态 / 队列出队 / 图像模式终态）
 * 收口成一组可单测的纯函数。每个函数【只读当前 workflow + 返回 patch 建议】，
 * 是否落盘（commit）由调用方决定——统一走 patchCurrentWorkflow（conversationSnapshot 的单一写入口）。
 *
 * 约束：
 * - 只操作 conversationStore 的 workflow 字段（normalizeWorkflow 定义字段集），不新增字段、不做独立内存对象。
 * - awaitingConfirm 是【conversation 顶层字段】不是 workflow 字段；确认态翻转走 setAwaitingConfirm(false)，
 *   不在此产生 workflow patch（见实施计划审计修正 3）。
 * - 本文件不 import 任何 React/Store 实例，getCurrentWorkflow 仅用作「读当前值」推进迁移判断。
 *
 * 依赖方向（单向）：useAgentChat → workflowState → conversationStore。（无环）
 */

import { getCurrentWorkflow } from '../conversation/conversationStore.js'

/** workflow.status 合法取值（normalizeWorkflow 未硬校验，此处登记供迁移判断复用） */
export type WorkflowStatus =
  | 'planning' | 'running' | 'awaiting_confirm' | 'stopped'
  | 'completed' | 'failed' | 'completed_with_errors'

/** workflow.status 合法取值全集（normalizeWorkflow 未硬校验，此处登记供迁移判断复用） */
export const WORKFLOW_STATUS: WorkflowStatus[] = ['planning', 'running', 'awaiting_confirm', 'stopped', 'completed', 'failed', 'completed_with_errors']

/** steerQueue 里的一条补充指令 */
export interface SteerItem {
  text: string
  attachments: unknown[]
}

/**
 * 起步 / 重新置为 planning。
 * 返回 patch：进 planning 并记录开始时间；steerQueue 由 patchCurrentWorkflow 保持既有值（若 patch 未显式携带数组）。
 * @param {object} [patch] 额外覆盖字段（如 { status: 'running' }）
 */
export function wfStart(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return { status: 'planning', startedAt: Date.now(), ...patch }
}

/**
 * 补充指令入队（busy 时的 steer）。
 * 读当前 workflow 追加一条 { text, attachments } 到 steerQueue；
 * 若尚无 workflow 则以 running 起步（与 useAgentChat 原「无则建 running」语义等价）。
 * @param {string} text  补充指令原文
 * @param {Array}  attachments 附带附件（默认 []）
 */
export function wfSteer(text: string, attachments?: unknown[]): Record<string, unknown> {
  const wf = getCurrentWorkflow()
  return {
    steerQueue: [...((wf && wf.steerQueue) || []), { text, attachments: attachments || [] }],
    ...(wf ? {} : { status: 'running' }),
  }
}

/**
 * 终态迁移：由 ok / aborted 推导终结 status。
 * @param {boolean} ok      是否成功
 * @param {boolean} [aborted] 是否被中止（ok 为 false 且 aborted 时 → stopped）
 * @returns {{ status: 'completed'|'failed'|'stopped' }}
 */
export function wfFinish(ok: boolean, aborted?: boolean): { status: WorkflowStatus } {
  return { status: !ok ? (aborted ? 'stopped' : 'failed') : 'completed' }
}

/**
 * 三阶段门禁：展示策划后暂停等待确认 → workflow.status 置 awaiting_confirm。
 * （awaitingConfirm 顶层字段的翻转不在此，走 setAwaitingConfirm）
 */
export function wfAwaitConfirm(): { status: WorkflowStatus } {
  return { status: 'awaiting_confirm' }
}

/**
 * 终态处理后取出队列中的下一条补充指令（FIFO）。
 * @param {string} [terminalStatus] 无下一条时维持的终态 status（如上一步 wfFinish 的结果）
 * @returns {{ next: {text:string, attachments:Array}|undefined, patch: object }}
 *          next 有值 → patch.status 置 planning（续跑），否则维持 terminalStatus。
 */
export function wfNextSteer(terminalStatus?: WorkflowStatus):
  { next: SteerItem | undefined; patch: { steerQueue: SteerItem[]; status: WorkflowStatus | undefined } } {
  const wf = getCurrentWorkflow()
  const steerQ: SteerItem[] = (wf && wf.steerQueue) || []
  const next = steerQ.shift() as SteerItem | undefined
  return { next, patch: { steerQueue: steerQ, status: next ? 'planning' : terminalStatus } }
}