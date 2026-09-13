/**
 * 共用层 · 时间轴「时间 ↔ 像素」换算与吸附（纯函数，**零业务域依赖**）。
 *
 * 落点依据：`docs/124` 裁决 ② ——「时间轴运算层」（时间↔像素 / 刻度 / 吸附 / 框选 / 播放钟）
 * 收口到 `base/utils/timeline/`，因为它是 **`nodes/` + `director3d/` + `videoEditor/` 三域共用**的运算。
 * 故它**不能**住在 `videoEditor/core/`（那样 base 会反向依赖业务域，`check-arch` G-1 会拦）。
 *
 * ── 收口边界（7 步法 Step 3：**收口探测/运算，保留判据**）──
 *  可收口的（怎么算）：时间↔像素换算式、吸附“找最近候选”的算法、缩放夹取、落点序号、矩形相交。
 *  留在各域的（要不要做 / 吸到什么 / 框选什么）：候选集合是什么、容差多大、选中后干什么。
 *  例：`snapTime` 只回答「在给定候选与容差内，最近的那个是哪条」，**不决定**候选从哪来。
 *
 * ── 单位纪律 ──
 * 本模块只认**秒**（`docs/123` §一.1 T1：全仓唯一时间单位）。
 * 帧基宿主（如 `director3d`）在自己的边界处换算（`秒 = 帧 / fps`），**不要把帧塞进来** ——
 * 那样这个"共用层"就会长出第二套单位，正是它要消灭的东西。
 */

/**
 * 缩放上下限（**像素 / 秒**）。
 *
 * 下限保证长片子仍能一屏看全；上限保证单帧级精剪时像素足够。
 * 与 `docs/123` §一.4 常量表同名同义，但家在这里 —— 因为唯一的消费者（`clampZoom`）在这里，
 * 而 base 不许反向依赖业务域（详见 `videoEditor/core/constants.ts` 文件头的说明）。
 */
export const MIN_PIXELS_PER_SECOND = 4;
export const MAX_PIXELS_PER_SECOND = 240;

/**
 * 时间 → 横坐标（像素）。
 * `x = t * pps - scroll`
 *
 * @param t      时间轴时刻（秒）
 * @param pps    缩放：像素 / 秒（**必须 > 0**，用 `clampZoom` 夹取后再传）
 * @param scroll 容器已横向滚动的像素（`scrollLeft`）；默认 0
 */
export function timeToX(t: number, pps: number, scroll = 0): number {
  return t * pps - scroll;
}

/**
 * 横坐标（像素）→ 时间。`timeToX` 的反函数。
 * `t = (x + scroll) / pps`
 *
 * @param x      **相对可视左缘**的像素（若传绝对 `clientX`，请先把容器左边界作为 `scroll` 传入）
 * @param pps    像素 / 秒（必须 > 0）
 * @param scroll 已横向滚动的像素；默认 0
 */
export function xToTime(x: number, pps: number, scroll = 0): number {
  return (x + scroll) / pps;
}

/** 像素差 → 时间差（对 `timeToX` 的增量形式；`scroll` 相消，故不需传入）。 */
export function pxDeltaToTime(dx: number, pps: number): number {
  return dx / pps;
}

/** 时长 → 像素宽（`pxDeltaToTime` 的反函数；同样与 `scroll` 无关）。 */
export function timeDeltaToPx(dt: number, pps: number): number {
  return dt * pps;
}

/** 缩放夹取到 `[MIN_PIXELS_PER_SECOND, MAX_PIXELS_PER_SECOND]`。 */
export function clampZoom(pps: number): number {
  if (!Number.isFinite(pps)) return MIN_PIXELS_PER_SECOND;
  return Math.min(MAX_PIXELS_PER_SECOND, Math.max(MIN_PIXELS_PER_SECOND, pps));
}

/** 铺满缩放：让 `duration` 秒的整条时间轴恰好占满 `width` 像素（再夹取到合法区间）。 */
export function fitZoom(duration: number, width: number): number {
  if (!(duration > 0) || !(width > 0)) return MIN_PIXELS_PER_SECOND;
  return clampZoom(width / duration);
}

/**
 * 吸附：在 `candidates` 中找离 `t` 最近的候选；若最近距离 ≤ `tolPx` 对应的秒数，返回该候选，否则返回 `t`。
 *
 * 【为什么容差以**像素**给】用户感知的是「鼠标离那条线多近」，而同一个秒数在不同缩放下
 * 是不同的像素距离（放大后 0.1s 可能是好几百像素）。故由宿主给像素容差，本函数负责换算。
 *
 * 【本函数不决定的事】候选集合从哪来、要不要吸（`tolPx` 传 0 即关闭）—— 都是宿主判据。
 *
 * @param t          待吸附的时间（秒）
 * @param candidates 候选时刻（秒），可含 `t` 自身；空数组 → 原样返回 `t`
 * @param pps        像素 / 秒（用于把 `tolPx` 换算成秒）
 * @param tolPx      容差（像素）；≤0 视为不吸附
 */
export function snapTime(
  t: number,
  candidates: readonly number[],
  pps: number,
  tolPx: number,
): number {
  if (!(tolPx > 0) || !(pps > 0) || candidates.length === 0) return t;
  const tolSec = tolPx / pps;
  let best: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    const dist = Math.abs(c - t);
    // 严格小于才算「更近」：并列时保留先出现的那个（调用方按重要性排列候选时行为可预期）
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best !== null && bestDist <= tolSec ? best : t;
}

/* ────────────────────────────────────────────────────────────────
 * 拖序落点 / 框选相交
 * ──────────────────────────────────────────────────────────────── */

/**
 * 参与「落点序号」计算的最小时间窗（刻意用窄结构类型：
 * `videoEditor` 的 `Clip` 与 `VideoProcessNode` 的 `VClip` 都天然满足它，无需任何适配）。
 */
export interface TimelineSpan {
  id: string;
  timelineStart?: number;
  sourceStart?: number;
  sourceEnd?: number;
}

/**
 * 落点 → 插入序号（**按中点判定**）。
 *
 * 语义：把 `draggedId` 从数组中排除后，依次比较其余片段的**中点**与 `t`；
 * 返回「应该插到第几个位置」。用于拖拽时的落点预览与最终重排。
 *
 * 排除 `draggedId` 是必须的：不排除的话，被拖动的片段会与自己比较，落点永远偏向原位（经典 off-by-one）。
 */
export function dropIndexAt(spans: readonly TimelineSpan[], t: number, draggedId?: string): number {
  let index = 0;
  for (const span of spans) {
    if (draggedId !== undefined && span.id === draggedId) continue;
    const start = span.timelineStart ?? 0;
    const end = start + Math.max(0, (span.sourceEnd ?? 0) - (span.sourceStart ?? 0));
    // 纯计数（中点落在 t 之前就算一位）——**不做"遇到第一个中点在后就 break"的提前退出**：
    // 那会隐含「入参已按时间排序」这一未声明的前提，一旦调用方传入未排序数组就静默给错序号。
    if (t > (start + end) / 2) index += 1;
  }
  return index;
}

/** 轴对齐矩形（像素坐标）。 */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 两矩形是否相交；**边缘恰好接触也算相交**（框选贴边应命中）。 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}
