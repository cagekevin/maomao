import { useCallback } from 'react'
import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'

/** 一次排版的结果：新布局的 nodes + 原样透传的 edges */
export interface ArrangeResult {
  nodes: Node[]
  edges: Edge[]
}

export interface ArrangeOptions {
  /** 当前节点快照（含 measured/style/position/data/parentId） */
  nodes: Node[]
  /** 当前边快照 */
  edges: Edge[]
  /** 写回回调，入参 { nodes, edges }（调用方 setNodes） */
  onArrange?: (result: ArrangeResult) => void
  /** 写回后回调（如 fitView） */
  onComplete?: () => void
}

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
export function useArrangeCanvas(): { arrange: (opts?: Partial<ArrangeOptions>) => ArrangeResult } {
  /**
   * @param {Object} opts
   * @param {Array} opts.nodes           当前节点快照（含 measured/style/position/data/parentId）
   * @param {Array} opts.edges           当前边快照
   * @param {Function} opts.onArrange    写回回调，入参 { nodes, edges }（调用方 setNodes）
   * @param {Function} [opts.onComplete] 写回后回调（如 fitView）
   * @returns {Object} 返回 { nodes, edges } 以便调用方入历史栈 / 显示确认弹窗
   */
  const arrange = useCallback(({ nodes, edges, onArrange, onComplete }: Partial<ArrangeOptions> = {}): ArrangeResult => {
    // 空画布直接跳过布局，仍调 onComplete（让 fitView 等收尾回调能跑）
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      onComplete?.()
      return { nodes, edges }
    }

    // 统一留白常量（优化③：基于尺寸的相对留白，避免魔数散落）
    const GAP_X = 300 // 分量横向间距
    const GAP_Y = 400 // 换列纵向间距
    const COL_MAX_W = 2500 // 单列累计宽度阈值，超宽换列
    const GROUP_PAD = 40 // group 外接矩形四周留白，对齐 groupNodes.createGroupFromNodes

    // 取节点真实尺寸（抉择：三选一优先序）
    // measured=已渲染实测最准 → 其次显式 width/height → 再 style → 最后兜底 320×80。
    // 尺寸准不准直接决定 dagre 排布疏密，所以宁可多取几层也不让它退到瞎猜的 0。
    const nodeDim = (n, fallbackW = 320, fallbackH = 80) => {
      const styleW = Number(n.style?.width)
      const styleH = Number(n.style?.height)
      return {
        width: n.measured?.width || Number(n.width) || (Number.isFinite(styleW) && styleW > 0 ? styleW : 0) || fallbackW,
        height: n.measured?.height || Number(n.height) || (Number.isFinite(styleH) && styleH > 0 ? styleH : 0) || fallbackH,
      }
    }
    const childSize = (n) => nodeDim(n, 420, 420)

    // 【优化①：编组当整体】计算 group 的真实尺寸 = 其子节点当前（相对父框）外接矩形 + 留白。
    // 这样 dagre 把 group 视为一个不可拆分的块来排，组间间距才真实，且整理后组大小不变。
    const groupSize = (groupId) => {
      const kids = nodes.filter((n) => n.parentId === groupId)
      if (kids.length === 0) return { width: 300, height: 200 }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const k of kids) {
        const { width, height } = childSize(k)
        minX = Math.min(minX, k.position.x)
        minY = Math.min(minY, k.position.y)
        maxX = Math.max(maxX, k.position.x + width)
        maxY = Math.max(maxY, k.position.y + height)
      }
      return { width: maxX - minX + GROUP_PAD * 2, height: maxY - minY + GROUP_PAD * 2 }
    }

    const graph = new dagre.graphlib.Graph({ compound: true })
    graph.setDefaultEdgeLabel(() => ({}))
    graph.setGraph({ rankdir: 'LR', nodesep: 300, ranksep: 300, align: 'UL' })

    // 只把【顶层节点】放进 dagre 布局：普通节点 + group 框。
    // ⚠️ 子节点不进 dagre、也不 setParent —— 这样 dagre 不会重排子节点坐标，
    // 组内当前摆放原封不动；父框被 dagre 移动后，子节点因 React Flow 父子关系
    // （绝对位置 = 父框 + 相对坐标）自动整体平移。
    nodes.forEach((n) => {
      if (n.parentId) return // 跳过子节点
      const { width, height } = n.type === 'group' ? groupSize(n.id) : nodeDim(n)
      graph.setNode(n.id, { width, height })
    })
    edges.forEach((e) => {
      // 只保留两端都是顶层节点的边（组内边两端都是子节点，对整体布局无意义，跳过）
      const s = nodes.find((x) => x.id === e.source)
      const t = nodes.find((x) => x.id === e.target)
      if (s && t && !s.parentId && !t.parentId) graph.setEdge(e.source, e.target)
    })
    dagre.layout(graph)

    // 【连通分量分组（抉择）】
    // dagre 只保证「单图内」分层；多个互不相连的连通分量会互相重叠。
    // 用 BFS 把所有顶层节点按「能否通过边/组连通」聚成若干分量，再逐分量摆位、留白。
    //
    // ⚠️ 邻接表必须同时纳入 group 父子关系（parentId，子 ↔ 父 双向），
    // 否则 group 框和子节点不连通会被拆成独立分量，整理时组被拆散/重叠。
    const components = []
    const visited = new Set()
    const adj = new Map()
    // adj 必须包含【所有节点】（子节点也要占位），否则下面 parentId 合并时
    // adj.get(子) 为 undefined 会把子节点漏掉 → BFS 找不到子节点 → 子节点不写回。
    // BFS 起点仍只从顶层节点开始（见下 if (n.parentId) return），子节点靠父子边纳入。
    nodes.forEach((n) => adj.set(n.id, []))
    edges.forEach((e) => {
      if (adj.has(e.source)) adj.get(e.source).push(e.target)
      if (adj.has(e.target)) adj.get(e.target).push(e.source)
    })
    nodes.forEach((n) => {
      if (n.parentId && adj.has(n.id) && adj.has(n.parentId)) {
        adj.get(n.id).push(n.parentId)
        adj.get(n.parentId).push(n.id)
      }
    })
    nodes.forEach((n) => {
      if (n.parentId || visited.has(n.id)) return
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
    let colH = 0 // 当前列已累积的高度（用于换列判定）
    const laid = [] // 最终写回的新节点数组（顶层节点先按 0,0 起算的初稿坐标）

    components.forEach((comp) => {
      // 分量包围盒（相对 dagre 输出的节点中心坐标，仅顶层节点参与）
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
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

      // 超宽换列（优化③）：单列总宽累计超阈值就换下一列，避免一排无限拉长
      if (colX + w > COL_MAX_W && colX > 0) {
        colX = 0
        colY += colH + GAP_Y
        colH = 0
      }

      comp.forEach((node) => {
        const pos = graph.node(node.id)
        if (!pos) return
        // 顶层节点：相对分量左上角摆位，加上列原点
        const relX = pos.x - pos.width / 2 - minX
        const relY = pos.y - pos.height / 2 - minY
        const x = colX + relX
        const y = colY + relY
        laid.push({
          ...node,
          position: { x, y },
          // 整理后统一收起配置面板（官方行为：排版后节点折叠，画布清爽）
          data: { ...node.data, expanded: false },
          // group 节点写回真实尺寸（外接矩形，否则框大小对不上内部子节点）
          style: node.type === 'group' ? { ...node.style, width: pos.width, height: pos.height } : node.style,
        })
      })

      // 子节点随父分量一起写回，但【position 原样保留】（相对父框坐标不变）
      comp
        .filter((node) => node.parentId)
        .forEach((node) => {
          laid.push({ ...node, position: { ...node.position }, data: { ...node.data, expanded: false } })
        })

      colX += w + GAP_X
      colH = Math.max(colH, h)
    })

    // 【优化②：不跳变】以第一个顶层节点的原始位置为锚，算整体平移偏移，
    // 让整理结果相对原画布只做"最小平移"而非每次跳回原点（连续整理不再整体漂移）。
    const firstTop = nodes.find((n) => !n.parentId)
    let offX = 0
    let offY = 0
    if (firstTop) {
      const d = laid.find((n) => n.id === firstTop.id)
      if (d) {
        offX = firstTop.position.x - d.position.x
        offY = firstTop.position.y - d.position.y
      }
    }
    const finalNodes = laid.map((n) => (n.parentId ? n : { ...n, position: { x: n.position.x + offX, y: n.position.y + offY } }))

    const result = { nodes: finalNodes, edges }
    onArrange?.(result)
    onComplete?.()
    return result
  }, [])

  return { arrange }
}
