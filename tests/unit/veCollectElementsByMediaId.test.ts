/**
 * 回归锁：`collectElementsByMediaId`（按素材 id 收集时间轴元素）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约：
 *   · 跨**全部轨道**收集（同一素材可能被放在多条轨上）；
 *   · 只认 `hasMediaId` 的元素（audio/image/video 带 mediaId；text/sticker 不带）；
 *   · 返回形状 = `{ trackId, elementId }[]`（`timeline.deleteElements` 的入参）；
 *   · 无命中 → 空数组（不返回 null，不抛）。
 * ════════════════════════════════════════════════════════════════
 * 【为什么收口】这段判据此前被抄成 2 份（`media-manager.removeMediaAsset` 与
 * `commands/media/remove-media-asset`），本轮「素材减号」是第 3 个消费者。
 * 本用例锁住唯一实现的行为，防它再被抄回去。
 */
import { describe, expect, it } from 'vitest';
import { collectElementsByMediaId } from '../../src/components/videoEditor/engine/timeline/element-utils';
import { textElementOf, videoElementOf, videoTrackOf } from '../helpers/fixtures';
import type {
  TimelineElement,
  TimelineTrack,
  VideoElement,
} from '../../src/components/videoEditor/types/timeline';

// 轨道/元素一律走 tests/helpers/fixtures 的工厂补齐必填字段 —— 旧写法只写「被测逻辑会读的字段」
// 再靠双重断言硬转，等于用断言盖住「fixture 只填了一半」。
function track(id: string, elements: TimelineElement[]): TimelineTrack {
  // 本套件**故意**在一条 video 轨里混装 text 元素（验「只收带 mediaId 的」这条判据，
  // 拆成两条合规轨道就换了语义）。这种组合类型上不成立，故在此单点收口：窄收成
  // 「元素数组」，不再像旧写法那样把整条轨断成 TimelineTrack。
  return videoTrackOf({
    id,
    isMain: false,
    elements: elements as VideoElement[],
  });
}

/** 「带 mediaId」的元素（video 是最常见的形态）。 */
function videoElement(id: string, mediaId: string): TimelineElement {
  return videoElementOf({ id, mediaId, name: id });
}

/** 「不带 mediaId」的元素（text 不带）。 */
function textElement(id: string): TimelineElement {
  return textElementOf({ id, name: id });
}

describe('collectElementsByMediaId', () => {
  it('跨全部轨道收集同一素材的元素', () => {
    const tracks = [
      track('t1', [videoElement('e1', 'm1'), videoElement('e2', 'm2')]),
      track('t2', [videoElement('e3', 'm1')]),
    ];
    expect(collectElementsByMediaId({ tracks, mediaId: 'm1' })).toEqual([
      { trackId: 't1', elementId: 'e1' },
      { trackId: 't2', elementId: 'e3' },
    ]);
  });

  it('只认带 mediaId 的元素（text 等不被误收）', () => {
    const tracks = [track('t1', [videoElement('e1', 'm1'), textElement('e2')])];
    expect(collectElementsByMediaId({ tracks, mediaId: 'm1' })).toEqual([
      { trackId: 't1', elementId: 'e1' },
    ]);
  });

  it('无命中 → 空数组（不返回 null、不抛）', () => {
    const tracks = [track('t1', [videoElement('e1', 'm1')])];
    expect(collectElementsByMediaId({ tracks, mediaId: '不存在' })).toEqual([]);
  });

  it('无轨道 → 空数组', () => {
    expect(collectElementsByMediaId({ tracks: [], mediaId: 'm1' })).toEqual([]);
  });
});
