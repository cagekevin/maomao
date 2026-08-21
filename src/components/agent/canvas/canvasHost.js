/**
 * ════════════════════════════════════════════════════════════════
 * 画布操作原语层（CanvasHost）—— 纯 JS 工厂，注入 ctx 可测，无 React hook 依赖
 * ════════════════════════════════════════════════════════════════
 *
 * 【解决什么】见 docs/14 Step M1。把工具层/执行器里重复的底层 ReactFlow 写法
 * （`setNodes([...getNodes(), x])` / `setNodes((ns) => ns.map(...))` /
 *  `deleteNodesWithCascade(getNodes(), getEdges(), id)` + `setNodes` + `setEdges`）
 * 收敛成语义清晰、可复用、可批量、可回滚的画布原语。这才是可维护性/可扩展性的来源。
 *
 * 【用法】
 *   const host = createCanvasHost(ctx)   // ctx = useReactFlow() 或测试 mock
 *   host.appendNode(newNode)             // 追加单节点（函数式 setNodes）
 *   host.appendMany({ nodes, edges })    // 批量追加：一次 setNodes/setEdges 防重渲染风暴
 *   host.updateNodeData(id, patch)       // 不可变局部更新 node.data
 *   host.updateNodePosition(id, pos)     // 只改 position
 *   host.lockNodes(ids, locked)          // 锁定/解锁（data.locked + draggable/selectable）
 *   host.deleteNodes(ids)                // 级联删子孙 + 相连边，返回被删节点 id 数组
 *   host.appendEdges(edges)              // 追加边（函数式 setEdges）
 *   host.replaceNodes(nodes)             // 整体替换节点数组（undo_ai/group_nodes 用）
 *   host.restoreNodesAndEdges({nodes,edges}) // 一次性整体恢复 nodes+edges（undo_ai 快照恢复）
 *
 * 【读写纪律】写一律用函数式（读最新状态），deleteNodes 例外：先 getNodes 快照 → 整体替换，
 * 避免「先读后写」读到过期 nodes。replaceNodes/restoreNodesAndEdges 用于「整体替换」场景
 * （undo_ai 恢复快照、group_nodes 整体替换），非局部操作。host 内部保持一致，调用方无需关心。
 */
import { deleteNodesWithCascade } from '../../base/groupNodes.js'

/**
 * 创建画布操作句柄。
 * @param {object} ctx 画布能力（useReactFlow() 或测试 mock）：
 *   { getNodes, setNodes, getEdges, setEdges, ... }
 */
export function createCanvasHost(ctx = {}) {
  // ── 读 ──
  const getNode = (id) => ctx.getNodes().find((n) => n.id === id) || null
  const getNodes = () => ctx.getNodes()
  const getEdges = () => ctx.getEdges()

  // ── 写（语义原语，内部封装 ReactFlow 函数式写法）──
  const appendNode = (newNode) => ctx.setNodes((ns) => [...ns, newNode])

  // 批量追加：单次 setNodes/setEdges，避免 N 次全量重渲染（P11 防渲染风暴关键，勿退化逐条 append）
  const appendMany = ({ nodes, edges }) => {
    if (nodes?.length) ctx.setNodes((ns) => [...ns, ...nodes])
    if (edges?.length) ctx.setEdges((es) => [...es, ...edges])
  }

  // 更新单个节点 data（不可变局部更新，非目标节点引用不变不重渲染）
  const updateNodeData = (id, patch) =>
    ctx.setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))

  // 只改 position（保留 data/其它字段）
  const updateNodePosition = (id, position) =>
    ctx.setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, position } : n)))

  // 锁定/解锁：data.locked + draggable/selectable 一起写，让 NodeShell 真正消费锁定效果
  const lockNodes = (ids, locked) =>
    ctx.setNodes((ns) =>
      ns.map((n) => (ids.includes(n.id)
        ? { ...n, data: { ...n.data, locked }, draggable: !locked, selectable: !locked }
        : n)),
    )

  // 删除节点（族谱级联删子孙 + 相连边）；先快照后整体替换
  const deleteNodes = (ids) => {
    const idArr = Array.isArray(ids) ? ids : [ids]
    const { nodes, edges, deleted } = deleteNodesWithCascade(ctx.getNodes(), ctx.getEdges(), idArr)
    ctx.setNodes(nodes)
    ctx.setEdges(edges)
    return deleted
  }

  const appendEdges = (edges) => ctx.setEdges((es) => [...es, ...edges])

  // ── 整体替换（undo_ai 恢复快照 / group_nodes 整体替换节点数组）──
  // 这两个场景是「整数组替换」而非「局部操作」，host 之前只覆盖局部原语，导致 undo_ai / group_nodes
  // 只能裸 ctx.setNodes。收口后统一走此原语（见实施计划 M1 C1-1 验收：工具层零裸 useReactFlow）。
  const replaceNodes = (nodes) => ctx.setNodes(nodes)
  const replaceEdges = (edges) => ctx.setEdges(edges)
  // undo_ai 恢复 AI 快照：一次性整体替换 nodes + edges（快照来自 pushActiveAiUndo 记录的原值）
  const restoreNodesAndEdges = ({ nodes, edges }) => {
    if (nodes) ctx.setNodes(nodes)
    if (edges) ctx.setEdges(edges)
  }

  return {
    getNode, getNodes, getEdges,
    appendNode, appendMany, appendEdges,
    updateNodeData, updateNodePosition, lockNodes, deleteNodes,
    replaceNodes, replaceEdges, restoreNodesAndEdges,
  }
}