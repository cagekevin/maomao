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
  const groupId = `group-${Date.now().toString(36)}`

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
