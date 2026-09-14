/**
 * 播放速度的取值域、步进与格式化 —— **唯一真源**。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么是线性 0.1 步进，而不是 log₂ 映射】（2026-09-15 用户裁定）
 * 旧实现把滑杆位置做 log₂ 映射（0.25→0、1→0.5、4→1），理由是"线性会把低速段挤在前 1/5"。
 * 但它的代价是**步进不均匀**：低速段拖一格变 0.01、高速段变 0.1 ——
 * 用户明确要求「每一次调整的幅度都是 0.1」。
 * 故改为**滑杆直接绑速度值**（`min/max/step` = `0.25 / 4 / 0.1`），
 * 拖动、加号、减号三处**同一套步进**，处处一致。
 * ⚠️ 谁要再引入位置映射（log/曲线），必须先解决"步进不均匀"——否则用户感知会退回去。
 * ════════════════════════════════════════════════════════════════
 * 【已删】`SPEED_PRESETS`（0.25x/0.5x/…/4x 那一排按钮）与
 * `speedToSliderPos` / `sliderPosToSpeed`（log₂ 映射）——
 * 用户要求「不要那些 0.25、0.5、1 倍之类的东西」，预设一排已移除。
 */

export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 4;

/**
 * 播放速度的统一步进（滑杆拖动 / 加号 / 减号**共用**）。
 * 用户要求「每一次调整的幅度都是 0.1」—— 故这是本模块的核心常量，不要各写 0.1 字面量。
 */
export const PLAYBACK_RATE_STEP = 0.1;

/** 把任意值钳进合法速度域（并按步进对齐，避免浮点毛刺如 1.2000000000000002）。 */
export function clampPlaybackRate({ value }: { value: number }): number {
  if (!Number.isFinite(value)) return 1;
  const clamped = Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, value));
  // 按步进对齐到最近的刻度（0.1 的倍数）；四舍五入消除浮点误差。
  return Math.round(clamped / PLAYBACK_RATE_STEP) * PLAYBACK_RATE_STEP;
}

/**
 * 步进一格（`delta` 通常传 ±1）。
 * @returns 钳制并对齐后的新速度
 */
export function stepPlaybackRate({ rate, delta }: { rate: number; delta: number }): number {
  return clampPlaybackRate({ value: rate + delta * PLAYBACK_RATE_STEP });
}

export function formatSpeedLabel({ rate }: { rate: number }): string {
  if (Number.isInteger(rate)) return rate.toString();
  const rounded = Math.round(rate * 100) / 100;
  return rounded.toString();
}
