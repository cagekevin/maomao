/**
 * 【TD-22-70】元素 ↔ 轨道兼容判据 —— 锁住**唯一实现** `track-utils.canElementGoOnTrack`。
 *
 * 收口前该规则另有一份逐字同实现的私有副本（`drop-utils.ts:53 isCompatible`，已删）；
 * 且**原先无任何测试覆盖**本规则 ⇒ 本条断言即"先红后绿"的落点：
 *   · 删掉真源里 `sticker` 分支 ⇒ 第 1 条红（sticker 会落到末尾 return false）；
 *   · 把 `image` 从 video 轨挪走 ⇒ 第 2 条红。
 */
import { describe, expect, it } from 'vitest';
import { canElementGoOnTrack } from '../../src/components/videoEditor/engine/timeline/track-utils';

describe('canElementGoOnTrack — 元素↔轨道兼容唯一判据（TD-22-70）', () => {
  it('text／audio／sticker 各只落同类型轨道', () => {
    expect(canElementGoOnTrack({ elementType: 'text', trackType: 'text' })).toBe(true);
    expect(canElementGoOnTrack({ elementType: 'text', trackType: 'video' })).toBe(false);

    expect(canElementGoOnTrack({ elementType: 'audio', trackType: 'audio' })).toBe(true);
    expect(canElementGoOnTrack({ elementType: 'audio', trackType: 'video' })).toBe(false);

    expect(canElementGoOnTrack({ elementType: 'sticker', trackType: 'sticker' })).toBe(true);
    expect(canElementGoOnTrack({ elementType: 'sticker', trackType: 'video' })).toBe(false);
  });

  it('video／image 都落 video 轨（image 不是独立轨道类型）', () => {
    expect(canElementGoOnTrack({ elementType: 'video', trackType: 'video' })).toBe(true);
    expect(canElementGoOnTrack({ elementType: 'image', trackType: 'video' })).toBe(true);

    expect(canElementGoOnTrack({ elementType: 'video', trackType: 'text' })).toBe(false);
    expect(canElementGoOnTrack({ elementType: 'image', trackType: 'audio' })).toBe(false);
  });
});
