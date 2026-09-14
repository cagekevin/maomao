export const SPEED_PRESETS = [
  { label: '0.25x', value: 0.25 },
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1x', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
] as const;

export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 4;

/**
 * 速度 → 滑杆位置（log₂ 映射：0.25→0，1→0.5，4→1）。
 * 线性映射会把 0.25–1x 挤在滑杆前 1/5，低速段几乎调不准；对数映射刻度均匀。
 */
export function speedToSliderPos({ rate }: { rate: number }): number {
  const min = Math.log2(MIN_PLAYBACK_RATE);
  const max = Math.log2(MAX_PLAYBACK_RATE);
  const clamped = Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rate));
  return (Math.log2(clamped) - min) / (max - min);
}

/** 滑杆位置 → 速度（0.05 步进，与自定义输入一致）。 */
export function sliderPosToSpeed({ pos }: { pos: number }): number {
  const min = Math.log2(MIN_PLAYBACK_RATE);
  const max = Math.log2(MAX_PLAYBACK_RATE);
  const clampedPos = Math.min(1, Math.max(0, pos));
  const rate = Math.pow(2, min + clampedPos * (max - min));
  return Math.round(rate * 20) / 20;
}

export function formatSpeedLabel({ rate }: { rate: number }): string {
  if (Number.isInteger(rate)) return rate.toString();
  const rounded = Math.round(rate * 100) / 100;
  return rounded.toString();
}

export function computeDurationAfterSpeedChange({
  currentDuration,
  oldRate,
  newRate,
}: {
  currentDuration: number;
  oldRate: number;
  newRate: number;
}): number {
  return currentDuration * (oldRate / newRate);
}
