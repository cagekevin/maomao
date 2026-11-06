/**
 * 节点尺寸「三写不变量」的唯一实现（TD-04-28 收口 · 母体 M7）。
 *
 * 【为什么住横切层（S2-1b-pre · 2026-09-19）】原住 `base/canvas/nodeDefaults.ts`（画布域）。
 * 但它是**纯数据形态原语**（读 node.style、产尺寸补丁），**零画布语义**，而消费方横跨横切与域：
 *   · 横切：`base/core/uiHooks.ts`（onMainBoxResize）· `hooks/useArrangeCanvas.ts`（排版写回）
 *   · 域  ：`base/canvas/groupNodes.ts`（建组）
 * ⇒ 画布域住着横切原语 ⇒ `base/core` 反向依赖画布域（违反规则 2「横切禁依赖业务域」）。
 * 依「依赖只能指向更稳定的方向」，原语下沉到横切；域消费横切是**正确单向**。
 *
 * 【不变量 · 2026-11-06「二写收口」】节点宽高**只写 `width` / `height` 字段一份真源**（可选
 * `initialWidth/initialHeight`，仅新建节点）。原「三写不变量」（字段 + style.width/height 双写）
 * **废除**——用户裁定：style 里的尺寸键不再写（新写路径不产生），`withNodeSize` 还会**主动剥离**
 * 存量 `style.width/height`，节点宽高回归字段单一真源；style 上的视觉属性（background 等）原样保留。
 * 配套事实（152/C1 取证）：React Flow 渲染 wrapper 与 NodeShell 根 div 均按 `width ?? style.width`
 * **字段优先**解析（`getNodeInlineStyleDimensions`，style 殿后），NodeResizer 拖拽也只写字段——
 * style 尺寸在全链路里没有任何「比字段新」的路径，废除后零渲染差异；DOM 内联尺寸由 NodeShell
 * **从字段派生**（子元素按 100% 排布依赖根 div 的 CSS 宽高，该派生必须完整保留，见 NodeShell 注释）。
 * 读侧兼容：存量节点仍带 style 尺寸，两个读原语保留 `width → style` 兜底，新代码**只读字段**。
 * 【两份尺寸为何曾共存】React Flow 内联尺寸解析自带 style 兜底链（`getNodeInlineStyleDimensions`
 * = `width ?? initialWidth ?? style.width`），存量旧节点（参考蓝本时代）只有 style 写法 ⇒ 读侧必须认；
 * 三写不变量时代写入侧又双写字段与 style ⇒ 共存成为常态。二写收口后新写路径只产字段一份，
 * 存量 style 尺寸在**两处被剥离**：① 节点再次经 `withNodeSize` 写尺寸时（见实现）；
 * ② 加载归一 `nodeDefaults.fillGeometry` 补完字段后即剥（持久化数据从此不存在第二份尺寸）。
 *
 * 【为什么必须抽共享纯函数】该不变量此前被 3 处**各自手抄 + 注释自证**（`uiHooks.onMainBoxResize` /
 * `useArrangeCanvas` 排版写回 / `groupNodes` 建组），靠"约定"同步 = 典型 SSOT 第二份。批量写点
 * （排版 / 建组）无法走 per-node hook，故收敛为纯函数由各处委托。
 *
 * **返回尺寸补丁（不是整个 node）**，三种消费形态都自然：
 *  - `patchNodeById(setNodes, id, withNodeSize(node, w, h))` —— 合并式写回；
 *  - `{ ...node, ...withNodeSize(node, w, h) }` —— 展开式写回（只覆盖尺寸键，不动 position/data）；
 *  - `withNodeSize({ id, type }, w, h, { includeInitial: true })` —— 新建节点全量构造。
 *
 * ── 尺寸「读」原语（2026-11-06 · 152/C1 全库收口）──
 * 写有三写不变量，读同样分族（用户裁定：**按语义分族收口，禁止一刀切合并**）：
 *  1. **布局/拖拽族 → `readNodeMeasuredSize`**（measured → width → style → 兜底）
 *     语义是「节点现在实际多大」的几何计算：编组外接矩形 / dagre 排版 / 粘贴包围盒 /
 *     spawn 落点 / Agent 建节点锚点 / 框选守卫。measured 是 ReactFlow 实测，最准；
 *     style 优先会把「用户缩放后的旧 style 残值」当真实尺寸（groupNodes 拖拽落组早已论证）。
 *  2. **样式承载族 → `readNodeDeclaredWidth` / `readNodeDeclaredHeight`**（width → style，**字段优先**）
 *     语义是「节点声明渲染成多大」：NodeShell 根 div / 比例同步 / 手柄写回前的现值读取。
 *     ⚠️ 族序必须是**字段优先**：React Flow `getNodeInlineStyleDimensions` 按 `width ?? style.width`
 *     渲染 wrapper，NodeShell 根 div 必须与其同序，否则 drift 节点（字段与 style 不一致）端口错位——
 *     这正是三写不变量存在的原因（两处同写 ⇒ 常态相等，序只在残缺数据上起兜底作用）。
 *     「样式承载」的分族轴 = 读**声明承载**（不读 measured 实测），而非字面「style 排最前」。
 *  读原语住本文件（横切层）的理由与写原语相同：纯数据形态、零画布语义，消费方横跨
 *  base/utils（clipboard）/ hooks / 画布域 / agent 域，base→base 单向合法。
 */

/** 尺寸读取的最小结构契约：Node / RF 内部节点 / 剪贴板宽对象都天然满足（字段全可选、值容忍字符串） */
interface NodeSizeSource {
  measured?: { width?: unknown; height?: unknown } | undefined;
  width?: number | string | undefined;
  height?: number | string | undefined;
  style?: { width?: number | string | undefined; height?: number | string | undefined } | undefined;
}

/**
 * 布局/拖拽族唯一读取源：measured → width → style → 兜底（数值化，非法/0 视为缺失）。
 * 兜底参数化：各语境自带兜底（建组矩形 420、排版 320/80、粘贴 300、Agent 锚点 280、
 * 拖拽落组 0 由调用方解释），与 groupNodes 收口先例同形态。
 */
export function readNodeMeasuredSize(
  n: NodeSizeSource | null | undefined,
  fallbackW = 0,
  fallbackH = 0,
): { w: number; h: number } {
  return {
    w: Number(n?.measured?.width) || Number(n?.width) || Number(n?.style?.width) || fallbackW,
    h: Number(n?.measured?.height) || Number(n?.height) || Number(n?.style?.height) || fallbackH,
  };
}

/**
 * 样式承载族唯一读取源（**原始值访问器**）：width → style，字段优先（序论证见文件头）。
 * ⚠️ 兼容语义（2026-11-06 二写收口）：`withNodeSize` 已不写 style 尺寸并会剥离存量——
 * style 兜底**仅为存量旧节点保留**，新代码一律只认字段真源，不得新增依赖 style 尺寸的读取。
 * 返回原始值而非 {w,h} 对象：NodeShell 的 zustand selector 靠 Object.is 比较截断重渲染（P0，
 * docs/106），selector 内建对象 = 每帧全量重渲，故本族原语必须逐维返回原始值。
 */
export function readNodeDeclaredWidth(
  n: NodeSizeSource | null | undefined,
): number | string | undefined {
  return n?.width ?? n?.style?.width;
}

export function readNodeDeclaredHeight(
  n: NodeSizeSource | null | undefined,
): number | string | undefined {
  return n?.height ?? n?.style?.height;
}

/** `withNodeSize` 产出的尺寸补丁（二写收口：字段 width/height + 剥离尺寸后的 style，可选 initial*） */
export interface NodeSizePatch {
  width: number;
  height: number;
  style: Record<string, unknown>;
  initialWidth?: number;
  initialHeight?: number;
}

/**
 * @param node     目标节点（读其既有 `style` 以保留其余键）
 * @param w        宽度
 * @param h        高度
 * @param opts.includeInitial 是否一并产出 `initialWidth/initialHeight`（**仅新建节点**需要，
 *        官方推荐「父节点有 style 尺寸时同时设 initial，保证首次测量前尺寸确定」；已有节点不需要）
 */
export function withNodeSize(
  node: Record<string, unknown>,
  w: number,
  h: number,
  opts: { includeInitial?: boolean } = {},
): NodeSizePatch {
  // 【2026-11-06 · 二写收口】style 不再写 width/height，且**剥离**存量尺寸键——缩放旧节点时
  // 把遗留 style 尺寸一并清掉，宽高回归字段单一真源；视觉属性（background 等）原样保留。
  // 读侧兜底（readNodeDeclared* 的 width → style）仅为存量兼容，新代码只读字段。
  const restStyle = { ...((node['style'] as Record<string, unknown>) || {}) };
  delete restStyle['width'];
  delete restStyle['height'];
  const patch: NodeSizePatch = {
    width: w,
    height: h,
    style: restStyle,
  };
  if (opts.includeInitial) {
    patch.initialWidth = w;
    patch.initialHeight = h;
  }
  return patch;
}
