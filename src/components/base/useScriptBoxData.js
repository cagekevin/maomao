import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'

/**
 * 剧本盒子 —— 数据读写 hook（对应真实系统的 updateNodeData K/r 通道）。
 *
 * 职责铁律（来自 docs/剧本盒子/剧本盒子职责划分.md）：
 *  - 数据只存 node.data，组件通过本 hook 读/写，绝不在组件内 useState 缓存数据。
 *  - UI 编辑 → updateData(patch) → setNodes 不可变写回 node.data。
 *  - UI 触发生成 → 直接调 d.onXxx?.(...)（引擎回调，挂在 node.data 上，由 App/引擎注入）。
 *  - 方向单一：UI 只调回调；引擎内部也走 updateData 写回；数据永远在 node.data。
 *
 * @param id        节点 id（setNodes 定位用）
 * @returns
 *  - updateData(patch)：不可变合并写回 node.data（深层字段用 setter 或对象）
 *   用法：updateData({ shots }) 整体替换；updateData((d)=>...)? 不支持，
 *   用 updateData({ data: { ...d.data, shots } }) 不方便 → 本 hook 提供两层：
 *     updateData({ shots }) 浅合并到 node.data；
 *     updateDataDeep({ shots: [...] }) 同浅合并（命名贴合「往 data 写」）。
 *  - 其余 9 个 onXxx 回调：本 hook 不定义，由调用方从 node.data 读取后透传。
 */
export function useScriptBoxData(id) {
  const { setNodes } = useReactFlow()

  const updateData = useCallback(
    (patch) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
      )
    },
    [id, setNodes]
  )

  return { updateData }
}
