import { generateId } from './idGen.js'

/**
 * 节点派生统一契约 —— 「建子节点 + 自动连线」的原子快照构造器。
 *
 * 背景：画布上多个节点（TextNode/VideoProcessNode/GridSplitNode 等）都需要「新建子节点并自动连一条
 * 边」。此前各节点用裸 setNodes/setEdges 拼接，且均未进 undo 栈（useCanvasHistory 未 record）。
 * 本工具把「读当前快照 → 构造 nextNodes/nextEdges」这层同构骨架收敛为纯函数，可单测；子节点的
 * data 构造（每处业务不同）由调用方提供 childSpecs。
 *
 * 用法：
 *   const { childNodes, edges } = buildSpawnNodes(parentNode, childSpecs, edgeOpts)
 *   调用方随后 setNodes(concat) + setEdges(concat) + history.record({ nodes, edges }) 原子提交。
 *
 * 注意：必须「先基于 getNodes()/getEdges() 当前值计算 next 快照，再 setState 再 record(显式快照)」，
 * 否则 undo 会丢新增节点（见 useCanvasHistory 的 record 语义）。
 */

/**
 * 生成一个子节点的 id（保留语义前缀 + 唯一后缀）。
 * @param {string} prefix 语义前缀（如 'text-split'/'box'/'split'）
 */
export function makeChildId(prefix) {
  return `${prefix}-${generateId('n')}`
}

/**
 * 构造「建子节点 + 连线」的原子快照。
 * @param {object} parentNode 父节点 { id, position }
 * @param {Array<{type, data, position, style?, label?}>} childSpecs 子节点规格（position 缺省时基于父节点偏移）
 * @param {{sourceHandle?, targetHandle?, type?, animated?}} edgeOpts 边的附加选项（默认 source=父,target=子）
 * @returns {{ childNodes: Array, edges: Array }} 待提交的新节点与边（不含旧状态）
 */
export function buildSpawnNodes(parentNode, childSpecs, edgeOpts = {}) {
  const parentId = parentNode?.id
  const base = parentNode?.position || { x: 0, y: 0 }

  const childNodes = childSpecs.map((spec, i) => ({
    id: spec.id || makeChildId('derived'),
    type: spec.type,
    position: spec.position || { x: base.x + 40, y: base.y + i * 200 + 40 },
    data: spec.data || {},
    ...(spec.style ? { style: spec.style } : {}),
  }))

  const edges = childNodes.map((c) => ({
    id: edgeOpts.id ? `${edgeOpts.id}-${c.id}` : `e-${parentId}-${c.id}`,
    source: parentId,
    target: c.id,
    ...(edgeOpts.sourceHandle !== undefined ? { sourceHandle: edgeOpts.sourceHandle } : {}),
    ...(edgeOpts.targetHandle !== undefined ? { targetHandle: edgeOpts.targetHandle } : {}),
    ...(edgeOpts.type ? { type: edgeOpts.type } : {}),
    ...(edgeOpts.animated !== undefined ? { animated: edgeOpts.animated } : {}),
  }))

  return { childNodes, edges }
}

/**
 * 基于当前画布状态计算「追加子节点+边」后的完整 next 快照（用于 record）。
 * @param {Array} currentNodes getNodes() 当前值
 * @param {Array} currentEdges getEdges() 当前值
 * @param {{childNodes, edges}} spawned buildSpawnNodes 的产物
 * @returns {{ nodes: Array, edges: Array }} 提交后的完整快照（含旧状态）
 */
export function applySpawnSnapshot(currentNodes, currentEdges, spawned) {
  return {
    nodes: currentNodes.concat(spawned.childNodes),
    edges: currentEdges.concat(spawned.edges),
  }
}
