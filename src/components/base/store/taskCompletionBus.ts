/**
 * P1-D 任务完成信号唯一发布入口（治 D1）。
 *
 * 【收口什么】此前 taskStore.done 与 pollTask 恢复路径各散拼 payload 调
 * `publish('agent:task-completed', …)`，无校验。现收敛为单一入口 + 前置校验：
 *   - 非 completed / resultUrl 非空字符串 → 拒绝发布（防"空结果/半成品"广播污染节点回填）
 *   - 校验通过才 publish('agent:task-completed', payload)
 * 消费方不变（useNodeGeneration 精准回填过滤 nodeId===本节点）。
 */

import { publish } from '../core/eventBus.ts'

/** 任务完成事件入参（与 agent:task-completed 载荷一致） */
export interface TaskCompletedArg {
  taskId: string
  nodeId: string
  resultUrl: string
  type: string
  status: string
}

/**
 * 校验并发布任务完成事件。
 * @param {{taskId:string, nodeId:string, resultUrl:string, type:string, status:string}} arg
 * @returns {boolean} 是否实际发布（false=校验未通过/未发布）
 */
export function publishTaskCompleted({ taskId, nodeId, resultUrl, type, status }: TaskCompletedArg): boolean {
  if (status !== 'completed') return false
  if (typeof resultUrl !== 'string' || !resultUrl) return false
  publish('agent:task-completed', { taskId, nodeId, resultUrl, type, status: 'completed' })
  // P2-G 安全网：上游节点完成 → 通知直接下游（useUpstreamAutoTrigger 消费；开关 AUTO_TRIGGER_DOWNSTREAM 默认关）。
  if (typeof nodeId === 'string' && nodeId) {
    publish('upstream:updated', { sourceNodeId: nodeId })
  }
  return true
}