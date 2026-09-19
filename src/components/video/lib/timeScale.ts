/**
 * 视频能力域 · 时间轴「时间 ↔ 像素」换算与吸附（纯函数，**零业务域依赖**）。
 *
 * 落点依据（2026-09-19 域归位裁定，**推翻** `docs/124` 裁决 ② 的旧落点）：`refs` 实测非测试
 * 消费者**只有** `video/nodes/VideoProcessNode.tsx` ⇒ 单一域 ⇒ 按 ADR-0040 L4 归 `video/lib/`。
 * 原「`nodes/` + `director3d/` + `videoEditor/` 三域共用」是**未取证的既有标签**（ADR-0001 违反）。
 *
 * ── 收口边界（7 步法 Step 3：**收口探测/运算，保留判据**）──
 *  可收口的（怎么算）：时间↔像素换算式、吸附“找最近候选”的算法。
 *  （★2026-09-18：原还列「缩放夹取、落点序号、矩形相交」—— 它们连同 `MIN/MAX_PIXELS_PER_SECOND`
 *    都是**零生产消费**的假接缝，已按 ADR-0030 删除；真要用时按**当时的**真实消费方重建，别提前预留。）
 *  留在各域的（要不要做 / 吸到什么 / 框选什么）：候选集合是什么、容差多大、选中后干什么。
 *  例：`snapTime` 只回答「在给定候选与容差内，最近的那个是哪条」，**不决定**候选从哪来。
 *
 * ── 单位纪律 ──
 * 本模块只认**秒**（`docs/123` §一.1 T1：全仓唯一时间单位）。
 * 帧基宿主（如 `director3d`）在自己的边界处换算（`秒 = 帧 / fps`），**不要把帧塞进来** ——
 * 那样这个"共用层"就会长出第二套单位，正是它要消灭的东西。
 */

/**
 * 时间 → 横坐标（像素）。
 * `x = t * pps - scroll`
 *
 * @param t      时间轴时刻（秒）
 * @param pps    缩放：像素 / 秒（**必须 > 0**；由调用方与其缩放来源保证）
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
 * 【2026-09-18 已删】拖序落点（`dropIndexAt` + `TimelineSpan`）与框选相交（`rectsIntersect` + `Rect`）
 *
 * 二者与本文件的 `fitZoom` 一样，**零生产消费**（全仓只被 `timelineShared.test.ts` 自证），
 * 属 ADR-0030 判定的「假接缝」⇒ 删除。真要做拖拽落点/框选时，按**当时的**真实消费方重建：
 * 判据（要不要吸、落点怎么算）归各业务域，本层只该收口「怎么算」的那一段。
 * ──────────────────────────────────────────────────────────────── */
