import { generateId } from '../core/idGen.ts';
import type { Node, Edge } from '@xyflow/react';

/**
 * 通用编组能力（治根：Agent group_nodes 与右键「编组」共用同一套逻辑）。
 * 依据 React Flow 官方 Sub Flows 推荐实现：
 *  - 父节点(group) 必须在 nodes 数组中先于子节点声明（unshift 到开头）
 *  - 子节点设 parentId + 相对坐标，加 extent:'parent' 限制不拖出 group 边界
 *  - ungroupNodes：parentId/extent 置空 + 坐标转回绝对
 * 纯函数，由右键菜单 / Agent 工具用 setNodes 应用，UI 与两端复用。
 */

// Ctrl+D 复制偏移：与原节点左对齐，向下偏移 750（实测最合理，约等于图片节点高 + 抽屉高）
const DUPLICATE_OFFSET_Y = 750;

/** 节点的实际尺寸（style 优先，其次 measured，兜底默认 420/420，对齐官方） */
function nodeSize(n: Node): { w: number; h: number } {
  return {
    w: Number(n.style?.width) || n.measured?.width || 420,
    h: Number(n.style?.height) || n.measured?.height || 420,
  };
}

/**
 * 编组：建一个 group 节点包住目标节点，并把目标节点设为子节点（parentId + 相对坐标）。
 */
export function createGroupFromNodes(
  nodes: Node[],
  selectedIds: string[],
): { ok: boolean; nodes?: Node[]; groupId?: string; error?: string } {
  const ids = Array.isArray(selectedIds) ? selectedIds : [];
  // 只编组「普通节点」：排除 group 自身、以及已在其他组内的节点
  const targets = nodes.filter((n) => ids.includes(n.id) && n.type !== 'group' && !n.parentId);
  if (targets.length < 2) return { ok: false, error: '至少选择 2 个可编组的节点' };

  // 计算外接矩形（用节点绝对坐标 + 尺寸，兜底 420）
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of targets) {
    const { w, h } = nodeSize(n);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  const pad = 40; // 对齐官方：外接矩形四周各留 40px
  const gx = minX - pad;
  const gy = minY - pad;
  const gw = maxX - minX + pad * 2;
  const gh = maxY - minY + pad * 2;
  // 【R4】groupId 用 crypto.randomUUID()（无碰撞），替代 Date.now 毫秒 id（Agent 批量并发建组时可能碰撞）。
  // fallback：老环境/测试无 randomUUID 时用 Date.now + 随机后缀保证不重复。
  const groupId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `group-${crypto.randomUUID()}`
      : generateId('group');

  const groupNode: Node = {
    id: groupId,
    type: 'group',
    position: { x: gx, y: gy },
    style: { width: gw, height: gh },
    // ⚠️ 必须同时写 width/height 字段（与 style 一致）：NodeShell.useNodeSize 读尺寸是
    // `n.width ?? n.style?.width`，width 优先。仅写 style 时，落盘/刷新后若 width 未同步，
    // 尺寸会塌成默认。写死 width/height + 白名单保存，刷新后尺寸必然保真。
    width: gw,
    height: gh,
    // 官方推荐：父节点有 style 尺寸时同时设 initialWidth/Height，保证首次测量前尺寸确定
    initialWidth: gw,
    initialHeight: gh,
    // 覆盖 React Flow 默认 .react-flow__node-group（自带 border/padding/背景 → 两层边框）
    className: 'yimao-group-node',
    data: { name: '编组' },
  };

  const next: Node[] = nodes.map((n) =>
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
      : n,
  );
  // 官方要求：父节点必须在 nodes 数组中先于子节点声明，否则 React Flow 无法正确建立父子关系
  next.unshift(groupNode);
  return { ok: true, nodes: next, groupId };
}

/**
 * 取消编组：移除 group 节点，并把其子节点移出组（parentId 置空 + position 转回绝对坐标）。
 */
export function ungroupNodes(
  nodes: Node[],
  groupId: string,
): { ok: boolean; nodes?: Node[]; error?: string } {
  const group = nodes.find((n) => n.id === groupId);
  if (!group) return { ok: false, error: '组不存在' };
  const gx = group.position.x;
  const gy = group.position.y;
  const next: Node[] = nodes
    .filter((n) => n.id !== groupId)
    .map((n) =>
      n.parentId === groupId
        ? {
            ...n,
            parentId: undefined,
            extent: undefined,
            position: { x: n.position.x + gx, y: n.position.y + gy },
          }
        : n,
    );
  return { ok: true, nodes: next };
}

/**
 * 级联删除节点（R3 系统性根因治理）：删除目标节点及其**所有子孙**（`parentId` 属于待删集合的
 * 递归收集），并删除相关边。根治「删 group 父节点留孤儿子节点」（用户侧 + AI 侧同源缺陷）。
 */
export function deleteNodesWithCascade(
  nodes: Node[],
  edges: Edge[],
  ids: string[] | string,
): { nodes: Node[]; edges: Edge[]; deleted: string[] } {
  const seed = new Set(Array.isArray(ids) ? ids.map(String) : [String(ids)]);
  // 递归收集：任何 parentId 属于待删集合的节点也要删（含多层嵌套）
  const toDelete = new Set(seed);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) {
      if (n.parentId && toDelete.has(String(n.parentId)) && !toDelete.has(String(n.id))) {
        toDelete.add(String(n.id));
        grew = true;
      }
    }
  }
  const nextNodes = nodes.filter((n) => !toDelete.has(String(n.id)));
  const nextEdges = edges.filter(
    (e) => !toDelete.has(String(e.source)) && !toDelete.has(String(e.target)),
  );
  return { nodes: nextNodes, edges: nextEdges, deleted: [...toDelete] };
}

/** 节点实际尺寸（统一读取源：measured 优先、width 次之、style 兜底，避免缩放后尺寸漂移） */
function dragGroupSize(n: Node): { w: number; h: number } {
  return {
    w: Number(n.measured?.width) || Number(n.width) || Number(n.style?.width) || 0,
    h: Number(n.measured?.height) || Number(n.height) || Number(n.style?.height) || 0,
  };
}

/**
 * 拖拽节点落组判定（R3 治理：拖入 group 设 parentId、拖出解除 parentId）。
 * 从 App.jsx handleNodeDragStop 抽出的纯几何计算，写回由调用方执行。
 *
 * 规则：
 *  - 拖入：节点重叠面积 ≥ 子节点面积 50% 即算落入该组（复刻原实现）。
 *  - 候选组：非折叠、不含被拖节点自身，按面积小→大（优先最内层）。
 *  - 拖出：原父节点存在但不再命中任何组 → 解除 parentId、转绝对坐标。
 *  - group 自身拖动不参与判定。
 *  - 组尺寸只由用户手动调整，不随子节点自动伸缩。
 *
 * @returns 有组关系变化时返回新 nodes 数组；否则返回 null（位置移动由调用方另作历史记录）
 */
export function resolveDragGrouping(draggedNode: Node, nodes: Node[]): Node[] | null {
  if (!draggedNode || draggedNode.type === 'group') return null;
  let cur: Node[] = nodes;
  let changed = false;

  // 绝对坐标辅助（递归求父绝对位置）
  const absPosOf = (id?: string): { x: number; y: number } => {
    let x = 0,
      y = 0,
      nodeId: string | undefined = id;
    let guard = 0;
    while (nodeId && guard++ < 20) {
      const n = cur.find((nn) => nn.id === nodeId);
      if (!n) break;
      x += n.position.x;
      y += n.position.y;
      nodeId = n.parentId;
    }
    return { x, y };
  };
  // 判定节点是否「大部分在 group 内」：重叠面积 ≥ 子节点面积一半（50%）即算组内
  const insideGroup = (nodeAbs: { x: number; y: number }, g: Node): boolean => {
    const gAbs = absPosOf(g.id);
    const { w: gW, h: gH } = dragGroupSize(g);
    const nW =
      Number(draggedNode.measured?.width) ||
      Number(draggedNode.width) ||
      Number(draggedNode.style?.width) ||
      100;
    const nH =
      Number(draggedNode.measured?.height) ||
      Number(draggedNode.height) ||
      Number(draggedNode.style?.height) ||
      60;
    const overlapW = Math.max(
      0,
      Math.min(nodeAbs.x + nW, gAbs.x + gW) - Math.max(nodeAbs.x, gAbs.x),
    );
    const overlapH = Math.max(
      0,
      Math.min(nodeAbs.y + nH, gAbs.y + gH) - Math.max(nodeAbs.y, gAbs.y),
    );
    const overlap = overlapW * overlapH;
    const nodeArea = nW * nH;
    return nodeArea > 0 && overlap / nodeArea >= 0.5;
  };

  const draggedAbs = {
    x: draggedNode.position.x + (draggedNode.parentId ? absPosOf(draggedNode.parentId).x : 0),
    y: draggedNode.position.y + (draggedNode.parentId ? absPosOf(draggedNode.parentId).y : 0),
  };
  // 候选 group：非折叠、不包含被拖节点自身；按面积小→大（优先最内层）
  const groups = cur
    .filter((n) => n.type === 'group' && !n.data?.collapsed && n.id !== draggedNode.id)
    .sort((a, b) => {
      const sa = dragGroupSize(a);
      const sb = dragGroupSize(b);
      return sa.w * sa.h - sb.w * sb.h;
    });
  const newParent = groups.find((g) => insideGroup(draggedAbs, g));

  if (newParent && draggedNode.parentId !== newParent.id) {
    // 拖入/更换父组：转为该 group 子节点
    const pAbs = absPosOf(newParent.id);
    cur = cur.map((n) =>
      n.id === draggedNode.id
        ? {
            ...n,
            parentId: newParent.id,
            position: { x: draggedAbs.x - pAbs.x, y: draggedAbs.y - pAbs.y },
          }
        : n,
    );
    changed = true;
  } else if (!newParent && draggedNode.parentId) {
    // 拖出原组：解除 parentId，转绝对坐标（group 保留）
    const parent = cur.find((n) => n.id === draggedNode.parentId);
    if (parent) {
      const pAbs = absPosOf(parent.id);
      cur = cur.map((n) =>
        n.id === draggedNode.id
          ? {
              ...n,
              parentId: undefined,
              extent: undefined,
              position: { x: draggedAbs.x, y: draggedAbs.y },
            }
          : n,
      );
      changed = true;
    }
  }

  return changed ? cur : null;
}

/**
 * 克隆子图（R3 治理：修「复制丢连线 + 复制 group 成空壳」）。
 * 克隆选中节点及其**所有子孙**（若选中 group 则整组克隆），重映射 id/parentId，并重映射相关边，
 * 使克隆体保持原组关系与连线。原节点/边保留，克隆是"新增"。
 */
export function duplicateSelectedWithEdges(
  nodes: Node[],
  edges: Edge[],
  selectedIds: string[],
  makeId?: (n: Node) => string,
): { nodes: Node[]; edges: Edge[]; clones: Node[] } {
  const seed = new Set(Array.isArray(selectedIds) ? selectedIds.map(String) : []);
  if (seed.size === 0) return { nodes, edges, clones: [] };
  // 递归收集：选中 group 时连带其子孙（保持整组）
  const toClone = new Set(seed);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) {
      if (n.parentId && toClone.has(String(n.parentId)) && !toClone.has(String(n.id))) {
        toClone.add(String(n.id));
        grew = true;
      }
    }
  }
  const idMap = new Map<string, string>(); // 原 id → 新 id
  const mk = makeId || ((n: Node) => `${n.type || 'node'}-clone-${generateId('c')}`);
  // 先建立 id 映射（所有被克隆节点）
  for (const n of nodes) if (toClone.has(String(n.id))) idMap.set(String(n.id), mk(n));
  // 生成克隆节点：重映射 id + parentId（指向新 group id）。
  // Ctrl+D 复制：与原节点左对齐（x 不变），向下偏移「图片节点宽 + 抽屉宽」(920)。
  // 组内子节点随父节点移动（相对坐标不加偏移），顶层节点才施加偏移。
  const clones: Node[] = nodes
    .filter((n) => toClone.has(String(n.id)))
    .map((n) => {
      const newId = idMap.get(String(n.id));
      // 【瞬态收口·阶段一】克隆节点必须重开 data 为独立对象，切断与原节点共享引用。
      // 根因：此前 `{ ...n }` 直接复用 n.data，复制带瞬态（如 VideoProcessNode 曾存的
      //   data.loading）/带结果的节点后，两节点共享同一 data 引用，任何读/缓存引用点都
      //   可能联动 →「Ctrl+D 复制后点生成，原节点动画异常」。配合阶段二把瞬态迁出 data
      //   （nodeRuntimeStore），副本是干净副本。
      //   ⚠️ 只会原地修改 data 的读点需要独立顶层集合：此刻先做顶层展开（足够断原引用）；
      //   若后续发现 data 内「会被写者原地改的集合字段」（images[]/texts[]/outputs[]等）
      //   仍串扰，再对这类字段逐一浅拷成新数组（非无脑递归深拷，避免无谓体积）。
      const clonedData = n.data ? { ...n.data } : n.data;
      return {
        ...n,
        id: newId,
        data: clonedData,
        ...(n.parentId && idMap.has(String(n.parentId))
          ? { parentId: idMap.get(String(n.parentId)) }
          : { parentId: undefined }),
        position: {
          x: n.position?.x || 0,
          y: (n.position?.y || 0) + (n.parentId ? 0 : DUPLICATE_OFFSET_Y),
        },
        selected: true,
      };
    });
  // 原边全部保留；对「至少一端被克隆」的边，额外生成一条克隆边（映射到克隆体）。
  // 组内边（两端都被克隆）→ 克隆边两端都映射到新 id；边界（一端克隆一端外部）→ 只映射克隆端。
  const sourceIds = new Set(toClone);
  const remappedEdges: Edge[] = [...edges];
  for (const e of edges) {
    const sIn = sourceIds.has(String(e.source));
    const tIn = sourceIds.has(String(e.target));
    if (!sIn && !tIn) continue;
    remappedEdges.push({
      ...e,
      id: `${e.id}-dup-${generateId('d')}`,
      source: sIn ? idMap.get(String(e.source)) : e.source,
      target: tIn ? idMap.get(String(e.target)) : e.target,
      selected: true,
    });
  }
  return { nodes: [...nodes, ...clones], edges: remappedEdges, clones };
}
