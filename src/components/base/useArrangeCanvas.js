import { useCallback } from 'react'
import dagre from 'dagre'

/**
 * 自动排版（复刻 H_.jsx:10985 `Ui` 整理画布 / Ctrl+L）。
 *
 * 【为什么用 dagre 而不是手写布局】
 * 官方就是 dagre 做有向图分层布局（rankdir=LR）。dagre 处理「边 → 左右分层」
 * 最稳，手写 BFS/拓扑分层在复杂 DAG 下易跑偏。故直接沿用官方选型，参数全对齐
 * （nodesep/ranksep=300、align=UL、compound 支持 group 父子），保证整理结果与官方一致。
 *
 * 【职责边界（抉择）】
 * 本 hook **只做「纯计算 + 调 onArrange 写回」**，不碰历史栈、不弹确认窗。
 * 原因：排列后要不要「撤销/是否保留」是**画布宿主**的交互决策，不该埋在算法里。
 * 调用方（App.arrangeCanvas）负责：① 存排列前快照 ② 入历史栈 ③ 弹「是否保留」确认。
 * 这样本 hook 可在「只想要布局、不要确认」的其它场景（如脚本盒引擎内部自动排版）复用。
 *
 * 【返回结构（抉择）】
 * `arrange()` 返回 `{ nodes, edges }`（新布局），并把新布局经 `onArrange` 写回。
 * 返回 + 回调双通道：调用方既能同步拿到结果入历史，也能让 React setState 走回调。
 *
 * 【接真实系统】
 * 原型用 nodes/edges 快照（measured/style/position）做演示。接真引擎时**无需改本 hook**：
 * - 真引擎的 node 结构同样是 { id, type, position, data, measured, parentId }（@xyflow 契约）；
 * - 调用方从 `useReactFlow().getNodes/getEdges` 取快照传入即可；
 * - 写回仍走 `setNodes`（真引擎的 updateNodeData/setNodes 通道一致，见 ARCHITECTURE §四）。
 * 唯一要注意：真引擎可能给节点带 `measured.width/height`（已渲染实测），本 hook 已优先读它。
 *
 * @returns {arrange: Function} 传入当前节点/边快照与可选回调，执行 dagre 布局并写回。
 */
export function useArrangeCanvas() {
  /**
   * @param {Object} opts
   * @param {Array} opts.nodes           当前节点快照（含 measured/style/position/data/parentId）
   * @param {Array} opts.edges           当前边快照
   * @param {Function} opts.onArrange    写回回调，入参 { nodes, edges }（调用方 setNodes）
   * @param {Function} [opts.onComplete] 写回后回调（如 fitView）
   * @returns {Object} 返回 { nodes, edges } 以便调用方入历史栈 / 显示确认弹窗
   */
  const arrange = useCallback(({ nodes, edges, onArrange, onComplete } = {}) => {
    // 空画布直接跳过布局，仍调 onComplete（让 fitView 等收尾回调能跑）
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      onComplete?.()
      return { nodes, edges }
    }

    const graph = new dagre.graphlib.Graph({ compound: true })
    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({ rankdir: 'LR', nodesep: 300, ranksep: 300, align: 'UL' })

    // 取节点真实尺寸（抉择：三选一优先序）
    // measured=已渲染实测最准 → 其次显式 width/height（如生图节点 420×420 未渲染前就有）→
    // 再 style 里的宽高 → 最后兜底。group 兜底用更大的 300×200（分组框），普通节点 320×80。
    // 尺寸准不准直接决定 dagre 排布疏密，所以宁可多取几层也不让它退到瞎猜的 0。
    const nodeDim = (n, fallbackW, fallbackH) => {
      const styleW = Number(n.style?.width)
      const styleH = Number(n.style?.height)
      return {
        width: n.measured?.width || Number(n.width) || (Number.isFinite(styleW) && styleW > 0 ? styleW : 0) || fallbackW,
        height: n.measured?.height || Number(n.height) || (Number.isFinite(styleH) && styleH > 0 ? styleH : 0) || fallbackH,
      }
    }
    nodes.forEach((n) => {
      const isGroup = n.type === 'group'
      const { width, height } = nodeDim(n, isGroup ? 300 : 320, isGroup ? 200 : 80)
      graph.setNode(n.id, { width, height })
      // compound：group 父子关系进图，dagre 会把子节点布局在父框内
      if (n.parentId) graph.setParent(n.id, n.parentId)
    })
    edges.forEach((e) => {
      graph.setEdge(e.source, e.target)
    })
    dagre.layout(graph)

    // 【连通分量分组（抉择）】
    // dagre 只保证「单图内」分层；多个互不相连的连通分量会互相重叠。
    // 官方用 BFS 把所有节点按「能否通过边/组连通」聚成若干分量，再逐分量摆位、
    // 列间留白，避免多块互不相连的图叠在一起。这里复刻官方 BFS。
    const components = []
    const visited = new Set()
    const adj = new Map()
    nodes.forEach((n) => adj.set(n.id, []))
    edges.forEach((e) => {
      if (adj.has(e.source)) adj.get(e.source).push(e.target)
      if (adj.has(e.target)) adj.get(e.target).push(e.source)
    })
    nodes.forEach((n) => {
      if (visited.has(n.id)) return
      const comp = []
      const queue = [n.id]
      for (visited.add(n.id); queue.length > 0; ) {
        const cur = queue.shift()
        const node = nodes.find((x) => x.id === cur)
        if (node) comp.push(node)
        adj.get(cur)?.forEach((nid) => {
          if (!visited.has(nid)) {
            visited.add(nid)
            queue.push(nid)
          }
        })
      }
      components.push(comp)
    })

    let colX = 0 // 当前列的原点 X
    let colY = 0 // 当前列的原点 Y
    let colH = 0 // 当前列已累积的高度（用于列宽判定）
    const laid = [] // 最终写回的新节点数组

    components.forEach((comp) => {
      // 分量包围盒（相对 dagre 输出的节点中心坐标）
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      comp.forEach((node) => {
        const pos = graph.node(node.id)
        if (pos) {
          minX = Math.min(minX, pos.x - pos.width / 2)
          minY = Math.min(minY, pos.y - pos.height / 2)
          maxX = Math.max(maxX, pos.x + pos.width / 2)
          maxY = Math.max(maxY, pos.y + pos.height / 2)
        }
      })
      const w = maxX - minX
      const h = maxY - minY

      // 超宽换列（抉择）：单列总宽累计 > 2500 就换下一列（列距 400）。
      // 避免一排排太长导致画布横向无边，官方用 2500 这个经验阈值。
      if (colX + w > 2500 && colX > 0) {
        colX = 0
        colY += colH + 400
        colH = 0
      }

      comp.forEach((node) => {
        const pos = graph.node(node.id)
        if (!pos) return
        let x = 0
        let y = 0
        if (node.parentId) {
          // group 子节点：保持相对父节点的偏移（父框不动，子随父）
          const parentPos = graph.node(node.parentId)
          if (parentPos) {
            x = pos.x - pos.width / 2 - (parentPos.x - parentPos.width / 2)
            y = pos.y - pos.height / 2 - (parentPos.y - parentPos.height / 2)
          }
        } else {
          // 普通节点：相对分量左上角摆位，加上列原点
          const relX = pos.x - pos.width / 2 - minX
          const relY = pos.y - pos.height / 2 - minY
          x = colX + relX
          y = colY + relY
        }
        laid.push({
          ...node,
          position: { x, y },
          // 整理后统一收起配置面板（官方行为：排版后节点折叠，画布清爽）
          data: { ...node.data, expanded: false },
          // group 节点写回测量尺寸（否则框的大小对不上内部子节点）
          style: node.type === 'group' ? { ...node.style, width: pos.width, height: pos.height } : node.style,
        })
      })

      colX += w + 300
      colH = Math.max(colH, h)
    })

    const result = { nodes: laid, edges }
    onArrange?.(result)
    onComplete?.()
    return result
  }, [])

  return { arrange }
}
