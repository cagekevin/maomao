/**
 * 共用层 · 时间轴刻度（步长抽稀 / 标签 / 刻度点）—— 纯函数，零业务域依赖。
 *
 * 落点依据同 `timeScale.ts`（`docs/124` 裁决 ②）。刻度是「运算」不是「判据」：
 * 「多少像素一格、标签怎么写」全仓只该有一份实现，否则两个域各自漂移（一个 `1:05`、一个 `65s`）。
 *
 * 只认**秒**（`docs/123` §一.1 T1）。
 */

/** 刻度点：时刻 + 已格式化标签（避免消费方各自再格式化一遍）。 */
export interface Tick {
  time: number;
  label: string;
}

/**
 * 「好看的」步长序列（秒）。刻度步长必须落在人类可读的点上 ——
 * `3.7 秒一格` 这种刻度没人会读。序列覆盖 1 秒到 1 小时。
 */
const NICE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600] as const;

/** 相邻刻度的最小像素间距：低于它刻度就会糊成一团（80px ≈ 一个短标签的宽度）。 */
const MIN_TICK_SPACING_PX = 80;

/**
 * 选刻度步长（秒）。
 *
 * 【为什么参数只有 pps】步长**只由缩放决定**：总时长不参与 —— 时长变了，刻度数量自然跟着变，
 * 这正是正确行为（`docs/123` §一.4 原签名写作 `(duration, pps?)`；实现时取证发现加入 `duration`
 * 只会得到一个永不触发的分支或一个"总长兜底"，两者都是为不存在的需求加防卫，故收敛为 `(pps)`）。
 *
 * @param pps 像素 / 秒（必须 > 0；用 `clampZoom` 夹取后再传）
 */
export function pickTickStep(pps: number): number {
  if (!(pps > 0)) return NICE_STEPS[NICE_STEPS.length - 1];
  return (
    NICE_STEPS.find((s) => s * pps >= MIN_TICK_SPACING_PX) ?? NICE_STEPS[NICE_STEPS.length - 1]
  );
}

/**
 * 刻度标签：`m:ss`（满 1 小时则 `h:mm:ss`）。
 *
 * `step` 只用于决定「要不要显示小数秒」：步长 < 1 秒时才带一位小数
 * （否则每秒都顶着 `.0`，噪音大于信息）。
 */
export function formatTickLabel(t: number, step: number): string {
  const safe = Math.max(0, t);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const decimal = step < 1 ? 1 : 0;
  const ss = s.toFixed(decimal).padStart(decimal ? 4 : 2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * 生成刻度点：`[0, step, 2*step, …]`，**末尾必含 `duration`**（不做 step 对齐）。
 *
 * 为什么末刻度不参与对齐：时间轴末端往往不是步长整数倍（7.3 秒的片子、步长 2），
 * 少了末刻度会让右边界失去参照。末刻度与前一格过近时（< 半步）不再重复添加。
 */
export function buildTicks(duration: number, step: number): Tick[] {
  if (!(duration > 0) || !(step > 0)) return [];
  const ticks: Tick[] = [];
  for (let t = 0; t <= duration + Number.EPSILON; t += step) {
    ticks.push({ time: t, label: formatTickLabel(t, step) });
  }
  const last = ticks[ticks.length - 1];
  if (!last || Math.abs(last.time - duration) > step / 2) {
    ticks.push({ time: duration, label: formatTickLabel(duration, step) });
  }
  return ticks;
}
