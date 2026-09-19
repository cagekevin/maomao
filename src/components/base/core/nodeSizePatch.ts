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
 * 【不变量】节点尺寸必须同时写 `width` / `height` **字段** 与 `style.width` / `style.height`。
 * 理由：`NodeShell` 根 div 读尺寸是 `n.width ?? n.style?.width`（**width 优先**）；只写 style 会让
 * root 尺寸与 React Flow wrapper（读 style）错位 → 端口/环绕错位，且落盘快照 width 与 style 不一致，
 * 刷新后尺寸塌成默认。
 *
 * 【为什么必须抽共享纯函数】该不变量此前被 3 处**各自手抄 + 注释自证**（`uiHooks.onMainBoxResize` /
 * `useArrangeCanvas` 排版写回 / `groupNodes` 建组），靠"约定"同步 = 典型 SSOT 第二份。批量写点
 * （排版 / 建组）无法走 per-node hook，故收敛为纯函数由各处委托。
 *
 * **返回尺寸补丁（不是整个 node）**，三种消费形态都自然：
 *  - `patchNodeById(setNodes, id, withNodeSize(node, w, h))` —— 合并式写回；
 *  - `{ ...node, ...withNodeSize(node, w, h) }` —— 展开式写回（只覆盖尺寸键，不动 position/data）；
 *  - `withNodeSize({ id, type }, w, h, { includeInitial: true })` —— 新建节点全量构造。
 */

/** `withNodeSize` 产出的尺寸补丁（三写不变量：字段 width/height + style.width/height，可选 initial*） */
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
  const patch: NodeSizePatch = {
    width: w,
    height: h,
    style: { ...((node.style as Record<string, unknown>) || {}), width: w, height: h },
  };
  if (opts.includeInitial) {
    patch.initialWidth = w;
    patch.initialHeight = h;
  }
  return patch;
}
