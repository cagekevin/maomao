import { useEffect, useRef } from 'react'

/**
 * 节点 data 外部变更 → 本地 state 同步 hook。
 *
 * 【为什么需要它】
 * Agent 的 update_node / update_node_raw 通过 setNodes 直接改写 node.data
 * （如 aspectRatio、prompt、selectedModel）。但各节点组件把这类字段做成本地
 * useState 初始化（只在挂载时读一次 data），外部改 data 后 state 不会跟着变，
 * 导致 UI 与生成参数停留在旧值 —— 表现为「Agent 说改成功了，但画布没变」。
 *
 * 【用法】
 * const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || 'Auto')
 * useSyncNodeData(data, { aspectRatio: setAspectRatio, prompt: setPrompt })
 *
 * @param data       节点当前 data（ReactFlow setNodes 后是新引用，effect 会触发）
 * @param setters    { data字段名: 本地setState } 映射。data 中该字段变化时同步到本地 state。
 */
export function useSyncNodeData(data, setters) {
  const prevRef = useRef({})
  const settersRef = useRef(setters)
  settersRef.current = setters

  useEffect(() => {
    const prev = prevRef.current
    for (const key of Object.keys(settersRef.current)) {
      const next = data?.[key]
      const last = prev[key]
      // 跳过首次（首次由 useState 初始化已处理）与未变化
      if (!(key in prev)) { prev[key] = next; continue }
      if (next === last) continue
      prev[key] = next
      const setter = settersRef.current[key]
      if (typeof setter === 'function') setter(next)
    }
  }, [data])
}
