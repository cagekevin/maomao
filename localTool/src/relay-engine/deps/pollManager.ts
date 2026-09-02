/**
 * deps/pollManager — 画布节点的异步任务持久化（宿主能力，kit 不实现）。
 *
 * 原实现把异步任务登记到节点，用于应用重启后断点续跑。
 * kit 面向一次调用，不做画布持久化。这里给同签名的 no-op。
 */
import type { GeneralModelCategory } from '../types/connection';

export type PendingTaskType =
  | 'custom-protocol' | 'apimart' | 'volcengine' | 'dreamina' | 'comfyui'
  | 'apimart-flow-music' | 'apimart-tts' | 'general' | 'runninghub';

export interface PendingTask {
  nodeId: string;
  projectId: string;
  nodeType: string;
  provider: string;
  providerConfigId?: string;
  taskId: string;
  taskType: PendingTaskType;
  batchCount?: number;
  submitted?: boolean;
  [key: string]: unknown;
}

/** 返回 AbortSignal（与 ai 层代码期望一致）；kit 不建节点轮询，返回 undefined。 */
export function registerNodePolling(_nodeId: string): AbortSignal | undefined {
  return undefined;
}

export function cleanupNodePolling(_nodeId: string): void {}

export function savePendingTask(_task: PendingTask): void {}

export function updatePendingTask(_nodeId: string, _patch: Partial<PendingTask>): void {}

export function removePendingTask(_nodeId: string): void {}

export type { GeneralModelCategory };
