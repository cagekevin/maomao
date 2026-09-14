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
import type { TimelineTrack } from '../../src/components/videoEditor/types/timeline';

/** 造一条轨（只填被测逻辑会读的字段）。 */
function track(id: string, elements: unknown[]): TimelineTrack {
  return { id, type: 'video', elements, isMain: false } as unknown as TimelineTrack;
}

/** 造一个「带 mediaId」的元素（video 是最常见的形态）。 */
function videoElement(id: string, mediaId: string) {
  return { id, type: 'video', mediaId, name: id, startTime: 0, duration: 1 };
}

/** 造一个「不带 mediaId」的元素（text 不带）。 */
function textElement(id: string) {
  return { id, type: 'text', name: id, content: '', startTime: 0, duration: 1 };
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
