import { useCallback, useEffect, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { debounce } from './utils.js'
import { NODE_PATCH_DEBOUNCE_MS } from './config.js'

/**
 * 节点 data 统一写回 hook（P0-2 收口）。
 *
 * 【为什么要有它】此前每个节点手写同一份「不可变局部更新 node.data」样板
 *   const patchData = useCallback((patch) => setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)), [id])
 *   + 同款 debouncedPatch（debounce(patchData, 200)）。实测 6+ 处逐字重复
 *   （TextNode / DiscountVideoNode / PromptNode / TemplateNode / LoopNode / ImageBoxNode）。
 * 本 hook 统一收口，节点只需 `const { patchData, patchDebounced } = useNodeData(id)`。
 *
 * 【用法】
 *   const { patchData, patchDebounced } = useNodeData(id)
 *   patchData({ imageUrl: r.url })                 // 立即写回（成功/确认回填等关键路径）
 *   patchDebounced({ prompt })                      // 防抖写回（编辑器高频输入用）
 *
 * 【说明】
 *  - patchData 稳定性：setNodes（reactflow）与 id 均为稳定引用 → patchData 引用稳定，
 *    一次 useMemo 构造的防抖即可复用，无需每次渲染重建。
 *  - patchDebounced 卸载时自动 flush：把窗口内最后一次待提交写出，避免丢数据。
 *  - 必须在 ReactFlowProvider 树内调用（经 useReactFlow 取 setNodes），节点天然满足。
 *  - 纯逻辑不写 UI，可覆盖单测（patchData 不可变更新 / patchDebounced 防抖 + flush）。
 */
export function useNodeData(id) {
  const { setNodes } = useReactFlow()
  const patchData = useCallback(
    (patch) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))),
    [id, setNodes]
  )
  const patchDebounced = useMemo(() => debounce(patchData, NODE_PATCH_DEBOUNCE_MS), [patchData])
  useEffect(() => () => patchDebounced.flush(), [patchDebounced])
  return { patchData, patchDebounced }
}