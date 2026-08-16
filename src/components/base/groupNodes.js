/**
 * 通用编组能力（治根：Agent group_nodes 与右键「编组」共用同一套逻辑）。
 * 依据 React Flow 官方 Sub Flows 推荐实现：
 *  - 父节点(group) 必须在 nodes 数组中先于子节点声明（unshift 到开头）
 *  - 子节点设 parentId + 相对坐标，加 extent:'parent' 限制不拖出 group 边界
 *  - ungroupNodes：parentId/extent 置空 + 坐标转回绝对
 * 纯函数，由右键菜单 / Agent 工具用 setNodes 应用，UI 与两端复用。
 */

/** 节点的实际尺寸（style 优先，其次 measured，兜底默认 420/420，对齐官方） */
function nodeSize(n) {
  return {
    w: Number(n.style?.width) || n.measured?.width || 420,
    h: Number(n.style?.height) || n.measured?.height || 420,
  }
}

/**
 * 编组：建一个 group 节点包住目标节点，并把目标节点设为子节点（parentId + 相对坐标）。
 * @param {Array} nodes 当前全部节点
 * @param {Array<string>} selectedIds 要编组的节点 id
 * @returns {{ok:boolean, nodes?:Array, groupId?:string, error?:string}}
 */
export function createGroupFromNodes(nodes, selectedIds) {
  const ids = Array.isArray(selectedIds) ? selectedIds : []
  // 只编组「普通节点」：排除 group 自身、以及已在其他组内的节点
  const targets = nodes.filter(
    (n) => ids.includes(n.id) && n.type !== 'group' && !n.parentId
  )
  if (targets.length < 2) return { ok: false, error: '至少选择 2 个可编组的节点' }

  // 计算外接矩形（用节点绝对坐标 + 尺寸，兜底 420）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of targets) {
    const { w, h } = nodeSize(n)
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + w)
    maxY = Math.max(maxY, n.position.y + h)
  }
  const pad = 40 // 对齐官方：外接矩形四周各留 40px
  const gx = minX - pad
  const gy = minY - pad
  const gw = maxX - minX + pad * 2
  const gh = maxY - minY + pad * 2
  // 【R4】groupId 用 crypto.randomUUID()（无碰撞），替代 Date.now 毫秒 id（Agent 批量并发建组时可能碰撞）。
  // fallback：老环境/测试无 randomUUID 时用 Date.now + 随机后缀保证不重复。
  const groupId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? `group-${crypto.randomUUID()}`
    : `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  const groupNode = {
    id: groupId,
    type: 'group',
    position: { x: gx, y: gy },
    style: { width: gw, height: gh },
    // 官方推荐：父节点有 style 尺寸时同时设 initialWidth/Height，保证首次测量前尺寸确定
    initialWidth: gw,
    initialHeight: gh,
    // 覆盖 React Flow 默认 .react-flow__node-group（自带 border/padding/背景 → 两层边框）
    className: 'yimao-group-node',
    data: { name: '编组' },
  }

  const next = nodes.map((n) =>
    targets.some((t) => t.id === n.id)
      ? {
          ...n,
          parentId: groupId,
          // 子节点 position 转相对父节点坐标
          position: { x: n.position.x - gx, y: n.position.y - gy },
          // 注意：不设 extent:'parent'，让组内节点能自由拖出 group（用户要求「移得出去」）。
          // 拖动消失的根因是父节点未前置（已用 unshift 修复），而非 extent。
          selected: false,
        }
      : n
  )
  // 官方要求：父节点必须在 nodes 数组中先于子节点声明，否则 React Flow 无法正确建立父子关系
  next.unshift(groupNode)
  return { ok: true, nodes: next, groupId }
}

/**
 * 取消编组：移除 group 节点，并把其子节点移出组（parentId 置空 + position 转回绝对坐标）。
 * @param {Array} nodes 当前全部节点
 * @param {string} groupId 要取消的组节点 id
 * @returns {{ok:boolean, nodes?:Array, error?:string}}
 */
export function ungroupNodes(nodes, groupId) {
  const group = nodes.find((n) => n.id === groupId)
  if (!group) return { ok: false, error: '组不存在' }
  const gx = group.position.x
  const gy = group.position.y
  const next = nodes
    .filter((n) => n.id !== groupId)
    .map((n) =>
      n.parentId === groupId
        ? { ...n, parentId: undefined, extent: undefined, position: { x: n.position.x + gx, y: n.position.y + gy } }
        : n
    )
  return { ok: true, nodes: next }
}

/**
 * 级联删除节点（R3 系统性根因治理）：删除目标节点及其**所有子孙**（`parentId` 属于待删集合的
 * 递归收集），并删除相关边。根治「删 group 父节点留孤儿子节点」（用户侧 + AI 侧同源缺陷）。
 *
 * @param {Array} nodes 当前全部节点
 * @param {Array} edges 当前全部边
 * @param {Array<string>|string} ids 要删除的节点 id（单个或多个）
 * @returns {{ nodes: Array, edges: Array, deleted: string[] }} 删除后的 nodes/edges + 实际删除的 id 集合
 */
export function deleteNodesWithCascade(nodes, edges, ids) {
  const seed = new Set(Array.isArray(ids) ? ids.map(String) : [String(ids)])
  // 递归收集：任何 parentId 属于待删集合的节点也要删（含多层嵌套）
  const toDelete = new Set(seed)
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (n.parentId && toDelete.has(String(n.parentId)) && !toDelete.has(String(n.id))) {
        toDelete.add(String(n.id))
        grew = true
      }
    }
  }
  const nextNodes = nodes.filter((n) => !toDelete.has(String(n.id)))
  const nextEdges = edges.filter((e) => !toDelete.has(String(e.source)) && !toDelete.has(String(e.target)))
  return { nodes: nextNodes, edges: nextEdges, deleted: [...toDelete] }
}

/**
 * 克隆子图（R3 治理：修「复制丢连线 + 复制 group 成空壳」）。
 * 克隆选中节点及其**所有子孙**（若选中 group 则整组克隆），重映射 id/parentId，并重映射相关边，
 * 使克隆体保持原组关系与连线。原节点/边保留，克隆是"新增"。
 *
 * @param {Array} nodes 当前全部节点
 * @param {Array} edges 当前全部边
 * @param {Array<string>} selectedIds 选中的节点 id
 * @param {Function} [makeId] 生成新 id 的函数（默认 type-clone-随机）
 * @returns {{ nodes: Array, edges: Array, clones: Array }} 克隆后的完整 nodes/edges + 新增的克隆节点
 */
export function duplicateSelectedWithEdges(nodes, edges, selectedIds, makeId) {
  const seed = new Set(Array.isArray(selectedIds) ? selectedIds.map(String) : [])
  if (seed.size === 0) return { nodes, edges, clones: [] }
  // 递归收集：选中 group 时连带其子孙（保持整组）
  const toClone = new Set(seed)
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (n.parentId && toClone.has(String(n.parentId)) && !toClone.has(String(n.id))) {
        toClone.add(String(n.id))
        grew = true
      }
    }
  }
  const idMap = new Map() // 原 id → 新 id
  const mk = makeId || ((n) => `${n.type || 'node'}-clone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  // 先建立 id 映射（所有被克隆节点）
  for (const n of nodes) if (toClone.has(String(n.id))) idMap.set(String(n.id), mk(n))
  // 生成克隆节点：重映射 id + parentId（指向新 group id），偏移 40px
  const clones = nodes
    .filter((n) => toClone.has(String(n.id)))
    .map((n) => {
      const newId = idMap.get(String(n.id))
      return {
        ...n,
        id: newId,
        ...(n.parentId && idMap.has(String(n.parentId)) ? { parentId: idMap.get(String(n.parentId)) } : { parentId: undefined }),
        position: { x: (n.position?.x || 0) + 40, y: (n.position?.y || 0) + 40 },
        selected: true,
      }
    })
  // 重映射克隆体内部的边（两端都在克隆集合内的），及原选中边界（source/target 任一端在克隆内）
  const sourceIds = new Set(toClone)
  const clonedEdgeIds = new Set()
  const remappedEdges = edges.map((e) => {
    const sIn = sourceIds.has(String(e.source))
    const tIn = sourceIds.has(String(e.target))
    // 边两端都被克隆（组内边）→ 完整重映射到克隆体
    if (sIn && tIn) {
      clonedEdgeIds.add(e.id)
      return { ...e, id: `e-${idMap.get(String(e.source))}-${idMap.get(String(e.target))}`, source: idMap.get(String(e.source)), target: idMap.get(String(e.target)), selected: true }
    }
    // 边一端在克隆内、一端在外 → 复制到克隆体（保持与原外部节点连接）
    if (sIn || tIn) {
      clonedEdgeIds.add(e.id)
      return { ...e, id: `${e.id}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source: sIn ? idMap.get(String(e.source)) : e.source, target: tIn ? idMap.get(String(e.target)) : e.target, selected: true }
    }
    return e
  })
  return { nodes: [...nodes, ...clones], edges: remappedEdges, clones }
}
