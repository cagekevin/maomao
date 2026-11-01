/**
 * 框选误选**守卫**（2026-11-01 · 用户报障）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【现象】把一张图复制到很远的地方后，框选时**框根本没碰到的节点也被选中**（用户原话：
 * "我去框选的时候，选中了复制出来的这个新图，那个旧图也会被选中"）。
 *
 * 【根因：React Flow 的一行短路，不是图层顺序】
 * `getNodesInside()`（`@xyflow/system` :383）：
 *     const forceInitialRender = !node.internals.handleBounds;
 *     const isVisible = forceInitialRender || partiallyVisible || overlappingArea >= area;
 * ⇒ **`handleBounds` 缺失的节点被无条件判进框选结果**，几何相交完全不参与。
 *
 * `handleBounds` 只在节点**被真实渲染测量后**才写入（`updateNodeInternals`）。而本仓
 * `onlyRenderVisibleElements`（App.tsx）下**视口外的节点不渲染 ⇒ 永远测不到**
 * ⇒ 复制/新建到视口外的节点**永久**停在"缺 handleBounds"状态
 * ⇒ 此后**每一次**框选都把它算进来。这就是"复制到很远的地方就必现"的完整机制。
 *
 * 【为什么不在节点上补 `handles` 声明（试过，已否决）】
 * 给节点声明 `handles` 确实能让 `parseHandles()` 立即产出 handleBounds、框选立刻正常。
 * **但它会破坏端口定位**：实测（`adoptUserNodes` 真跑）声明之后，**每次** nodes 变化
 * （拖动一帧、选中、任意 `setNodes`）都会把 `handleBounds` **重算回声明里的占位坐标**
 * （真实测量值 y=210 → 重置成 y=1）；不声明 handles 时真实坐标会被保留。
 * ⇒ 那会换来"连线端点每次都在节点内乱跳"，比框选误选更糟。**故否决，改用本守卫**。
 *
 * 【本守卫做什么】只在**框选产生的选中**上做二次校验，不碰任何节点内部状态：
 *   对每条 `{ type: 'select', selected: true }` 变更，用节点的**真实几何**
 *   （`internals.positionAbsolute` + `width/height`，未测量时退回 `width/height/initial*`）
 *   判断它是否与**本次框选矩形**相交；不相交 ⇒ 丢弃该条选中变更。
 *
 * ⚠️ **只在"框选进行中"生效**：普通点击选中、Ctrl+A 全选、程序化选中**不走此路径**
 * （它们没有框选矩形）。判据 = 调用方传入的 `selectionRect`（`null` = 非框选，原样放行）。
 * ════════════════════════════════════════════════════════════════
 */

/** 框选矩形（**flow 坐标**，非屏幕坐标） */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 守卫需要的最小节点几何（从 React Flow 的 internal node 取） */
interface NodeGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `onNodesChange` 的变更项最小形状（只读本守卫关心的字段，其余原样透传）。
 * `id` 可缺省：`NodeChange` 是判别联合，`add` 等分支不带 id（本守卫对它们一律放行）。
 */
interface SelectChangeLike {
  type: string;
  id?: string;
  selected?: boolean;
}

/**
 * 判断节点矩形是否与框选矩形相交（**边缘接触也算**，与 `getRectsOverlappingArea` 同口径）。
 * @returns 相交面积 > 0
 */
function rectsOverlap(a: SelectionRect, b: NodeGeometry): boolean {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap > 0 && yOverlap > 0;
}

/**
 * 过滤掉「框选矩形之外的选中变更」（框选误选守卫 · 唯一实现）。
 *
 * @param changes `onNodesChange` 收到的变更数组（原样，不改入参；返回同型数组）
 * @param rect 本次框选矩形（**flow 坐标**）；`null` = 当前不是框选 ⇒ **原样放行**
 * @param geometryOf 按 id 取节点真实几何；返回 `null` = 该节点几何不可用 ⇒ **放行**
 *        （几何缺失时不做判断：宁可多选，也不要把用户真正框住的节点漏掉）
 * @returns 过滤后的新数组（未命中过滤时返回原引用，避免无谓重渲染）
 */
export function filterSelectionOutsideRect<T extends SelectChangeLike>(
  changes: T[],
  rect: SelectionRect | null,
  geometryOf: (id: string) => NodeGeometry | null,
): T[] {
  if (!rect || rect.width <= 0 || rect.height <= 0) return changes;
  let dropped = 0;
  const out = changes.filter((c) => {
    // 只处理「框选产生的选中」；取消选中、位置/尺寸等其它变更一律放行
    if (c.type !== 'select' || c.selected !== true || !c.id) return true;
    const geo = geometryOf(c.id);
    if (!geo) return true; // 几何不可用 → 放行（宁多选不漏选）
    if (rectsOverlap(rect, geo)) return true;
    dropped++;
    return false;
  });
  return dropped === 0 ? changes : out;
}
