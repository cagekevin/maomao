import { describe, expect, it } from 'vitest';
import {
  TRACK_HEIGHTS,
  TIMELINE_CONSTANTS,
  clampTrackHeightScale,
} from '../../src/components/videoEditor/constants/timeline-constants';
import {
  getTrackHeight,
  getCumulativeHeightBefore,
  getTotalTracksHeight,
} from '../../src/components/videoEditor/engine/timeline/track-utils';

/**
 * TD-21-16 · 轨道高度可调（倍率）—— 判据唯一实现的行为断言。
 *
 * 契约（`timeline-constants.tsx` / `track-utils.ts` 的 JSDoc 已锁定）：
 *  1. `scale` 缺省 = 1 ⇒ 高度与「不可调」时代**完全一致**（存量工程零回归）；
 *  2. 夹取只在 `clampTrackHeightScale` 一处；非法输入（undefined/NaN）→ 1，不静默取边界；
 *  3. 命中区 / 胶片条 / 总高**必须同一入口** `getTrackHeight`，否则"显示按基准、命中按倍率"错位。
 */
describe('TD-21-16 · 轨道高度倍率', () => {
  it('缺省 scale 等价于 1（存量工程零回归）', () => {
    for (const type of ['video', 'text', 'audio', 'sticker'] as const) {
      expect(getTrackHeight({ type })).toBe(TRACK_HEIGHTS[type]);
      expect(getTrackHeight({ type, scale: 1 })).toBe(TRACK_HEIGHTS[type]);
    }
  });

  it('倍率等比作用于各类型（分类型基准 × 同一倍率）', () => {
    expect(getTrackHeight({ type: 'video', scale: 2 })).toBe(TRACK_HEIGHTS.video * 2);
    expect(getTrackHeight({ type: 'text', scale: 2 })).toBe(TRACK_HEIGHTS.text * 2);
  });

  it('夹取到 [MIN, MAX]；非法输入退 1（不产出 NaN 传播、不静默取边界）', () => {
    const { TRACK_HEIGHT_SCALE_MIN: MIN, TRACK_HEIGHT_SCALE_MAX: MAX } = TIMELINE_CONSTANTS;
    expect(clampTrackHeightScale(1e6)).toBe(MAX);
    expect(clampTrackHeightScale(0)).toBe(MIN);
    expect(clampTrackHeightScale(Number.NaN)).toBe(1);
    expect(clampTrackHeightScale(undefined)).toBe(1);
    expect(clampTrackHeightScale(1)).toBe(1);
  });

  it('累计高 / 总高与逐轨道 getTrackHeight 同口径（命中区不错位）', () => {
    const tracks = [{ type: 'video' as const }, { type: 'text' as const }];
    const scale = 1.5;
    const h0 = getTrackHeight({ type: 'video', scale });
    const h1 = getTrackHeight({ type: 'text', scale });
    // getCumulativeHeightBefore 求和 = 单轨高度 + 间隔，不含目标轨
    expect(getCumulativeHeightBefore({ tracks, trackIndex: 1, scale })).toBe(h0 + 4);
    // getTotalTracksHeight = 各轨高度之和 + 间隔（间隔数 = 轨数 - 1）
    expect(getTotalTracksHeight({ tracks, scale })).toBe(h0 + h1 + 4);
  });

  it('倍率放大后总高严格变高（用户可见效果成立）', () => {
    const tracks = [{ type: 'video' as const }];
    expect(getTotalTracksHeight({ tracks, scale: 2 })).toBeGreaterThan(
      getTotalTracksHeight({ tracks, scale: 1 }),
    );
  });
});
