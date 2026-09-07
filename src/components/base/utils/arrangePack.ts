/**
 * 连通分量打包（按视窗比例择优换行）纯函数。
 *
 * 【职责】useArrangeCanvas 整理时，把各「连通分量」的包围盒打包成稀疏矩阵，
 *   目标不是固定的单列堆叠，而是让整体边界框 (W, H) 接近视窗比例，使 fitView
 *   后节点缩放最大化（fitView 实际 scale = min(vw/W, vh/H, maxZoom)）。
 *
 * 【动机】旧实现用「单列累计宽度超阈值 COL_MAX_W 就换列」的启发式（绝对值 2500），
 *   与视窗宽高无关，宽屏下容易排成一行长龙、一列到底，fitView 后节点偏小。
 *   本函数改为遍历 perRow=1..n 试排，按 fitView 真实缩放打分取最优 —— 纯 JS、零依赖、可单测。
 *
 * 【算法】
 *   for perRow = 1..n:
 *     逐行放置，每行至多 perRow 个分量；行内 x 递增、行 y = 上一行底部 + gapY；
 *     得整体包围盒 (W, H) 与各分量占位 placement；
 *     打分 scale = min(vw/W, vh/H, maxZoom)；   // 即 fitView 后的真实缩放
 *   取 scale 最大的 perRow；同分取更大的 perRow（行更少，更贴近从左到右阅读流向）。
 *
 * 【复杂度】O(n²)，n = 连通分量数（常规几十），可忽略。
 *
 * @param boxes 各连通分量的包围盒（顺序与调用方 components 一致）
 * @param opts  gapX/gapY 间距；maxZoom（fitView 上限，默认 1）；viewport（视窗尺寸，缺省退化 1600×900）
 * @returns 选定的 perRow + 整体 (W,H) + 每个分量的左上角占位 placements
 */
export interface ArrangePackBox {
  width: number;
  height: number;
}

export interface ArrangePackOpts {
  gapX: number;
  gapY: number;
  /** fitView 允许的最大缩放，默认 1 */
  maxZoom?: number;
  /** 画布视窗尺寸；缺省退化 1600×900（宽屏兜底） */
  viewport?: { width: number; height: number };
}

export interface ArrangePackResult {
  perRow: number;
  width: number;
  height: number;
  /** 各分量左上角占位（与 boxes 下标一一对应） */
  placements: { x: number; y: number }[];
}

const DEFAULT_VIEW_W = 1600;
const DEFAULT_VIEW_H = 900;

/** 单次按固定 perRow 试排：返回包围盒与占位；返回 null 表示无分量 */
function packWithPerRow(
  boxes: ArrangePackBox[],
  perRow: number,
  gapX: number,
  gapY: number,
): { width: number; height: number; placements: { x: number; y: number }[] } | null {
  const n = boxes.length;
  if (n === 0) return null;
  const placements: { x: number; y: number }[] = [];
  let width = 0;
  let height = 0;
  let y = 0;
  for (let rowStart = 0; rowStart < n; rowStart += perRow) {
    let rowW = 0;
    let rowH = 0;
    // 行内第 1 个不放前导间距，后续每个在本项之前加 gapX（无尾间距，perRow=1 也正确）
    for (let col = 0; col < perRow && rowStart + col < n; col++) {
      const b = boxes[rowStart + col];
      if (col > 0) rowW += gapX;
      placements.push({ x: rowW, y });
      rowW += b.width;
      rowH = Math.max(rowH, b.height);
    }
    width = Math.max(width, rowW);
    height += rowH + gapY;
    y += rowH + gapY;
  }
  // 去掉列尾多余间距
  height -= gapY;
  return { width, height, placements };
}

export function packComponents(boxes: ArrangePackBox[], opts: ArrangePackOpts): ArrangePackResult {
  const { gapX, gapY } = opts;
  const maxZoom = opts.maxZoom ?? 1;
  const vw = opts.viewport?.width || DEFAULT_VIEW_W;
  const vh = opts.viewport?.height || DEFAULT_VIEW_H;
  const n = boxes.length;

  if (n === 0) {
    return { perRow: 0, width: 0, height: 0, placements: [] };
  }
  if (n === 1) {
    const b = boxes[0];
    return {
      perRow: 1,
      width: b.width,
      height: b.height,
      placements: [{ x: 0, y: 0 }],
    };
  }

  let best: {
    perRow: number;
    width: number;
    height: number;
    placements: { x: number; y: number }[];
  } | null = null;
  let bestScale = -Infinity;
  for (let perRow = 1; perRow <= n; perRow++) {
    const packed = packWithPerRow(boxes, perRow, gapX, gapY);
    if (!packed) continue;
    // 边界框可能为 0（单点分量等）——避免除零，用极小值兜底
    const effW = Math.max(packed.width, 1);
    const effH = Math.max(packed.height, 1);
    const scale = Math.min(vw / effW, vh / effH, maxZoom);
    // 同分时取更大的 perRow（>= 而非 >）：行更少更贴近阅读流向
    if (best === null || scale >= bestScale) {
      bestScale = scale;
      best = { perRow, ...packed };
    }
  }
  const r = best!;
  return { perRow: r.perRow, width: r.width, height: r.height, placements: r.placements };
}
