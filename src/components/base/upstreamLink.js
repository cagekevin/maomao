/**
 * P2-G 拓扑触发安全网 —— 上游完成后可选自动触发「直接下游」（默认关，零行为改变）。
 *
 * 【背景】现状"上游驱动下游只实现一半"：useConnectedInputs 是"下游生成时实时拉上游"，
 * 上游完成【不会】自动驱动下游（无拓扑触发引擎）。G1 先建一个轻量安全网：
 *  - 上游节点完成（经 taskCompletionBus.publishTaskCompleted）→ 广播 `upstream:updated { sourceNodeId }`；
 *  - 本 hook 监听它，用 ReactFlow 的 edges 只找 `edge.source === sourceNodeId` 的**直接下游**（只接一层），
 *    当开关 AUTO_TRIGGER_DOWNSTREAM（config.js，默认 false）打开时，对下游调用 runNodeGeneration 触发一次。
 *  - 不做全图自动跑（workflowRuntime 全图演进另立 PRD）。
 *
 * 【挂载】须在 ReactFlow provider 内（useReactFlow 可用）。挂在画布根组件（App.jsx 的 Canvas）。
 * 【与 P1-E 关系】触发走 runNodeGeneration → 下游 start 的单节点互斥锁，天然防重入。
 * 【诚实边界】仅能驱动「登记过 start 回调」的下游（AI 生图/视频/模板等节点）；本地处理类节点（切图/抽帧）
 *   无 start 注册 → runNodeGeneration 返回 false 静默跳过；且仅覆盖「经任务中心完成」的上游。
 */
import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { subscribe } from './eventBus.js'
import { runNodeGeneration } from './taskStore.js'
import { AUTO_TRIGGER_DOWNSTREAM } from './config.js'
import { logger } from './logger.js'

/**
 * 订阅 `upstream:updated`，打开开关时自动触发直接下游。返回取消函数。
 * 只取直接下游（edge.source === sourceNodeId → edge.target），不做多级递归。
 */
export function useUpstreamAutoTrigger() {
  const { getEdges } = useReactFlow()
  useEffect(() => {
    if (!AUTO_TRIGGER_DOWNSTREAM) return undefined
    return subscribe('upstream:updated', ({ sourceNodeId }) => {
      if (!sourceNodeId) return
      try {
        const targets = (getEdges() || [])
          .filter((e) => e.source === sourceNodeId && e.target)
          .map((e) => e.target)
        for (const target of [...new Set(targets)]) {
          logger.info('拓扑', '[G1] 上游完成 → 触发直接下游', { sourceNodeId, target })
          runNodeGeneration(target).catch(() => {})
        }
      } catch (e) {
        logger.warn('拓扑', '[G1] 触发直接下游失败', { sourceNodeId, error: e?.message })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}