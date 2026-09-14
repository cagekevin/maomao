import { describe, expect, it } from 'vitest';
import { EPS } from '../../../src/components/videoEditor/core/constants.ts';
import * as ops from '../../../src/components/videoEditor/core/timelineOps.ts';
import {
  activeClipsAt,
  appendTime,
  clipDuration,
  clipEdges,
  clipEnd,
  clipOverlaps,
  duplicateClip,
  findClipAt,
  freezeFrameAt,
  hasOverlap,
  magneticOf,
  moveClipTo,
  placeClipAt,
  relayoutSequential,
  removeClips,
  settle,
  splitAt,
  timelineDuration,
  trimLeftAt,
  trimRightAt,
  updateClip,
} from '../../../src/components/videoEditor/core/timelineOps.ts';
import type { Clip, Track } from '../../../src/components/videoEditor/core/types.ts';

/** 造片段：源窗 `[0, dur)`，时间轴起点 `start`。 */
function clip(id: string, start: number, dur: number, extra: Partial<Clip> = {}): Clip {
  return { id, kind: 'video', sourceStart: 0, sourceEnd: dur, timelineStart: start, ...extra };
}

function track(clips: Clip[], overlay = false): Track {
  return {
    id: 'tk',
    name: 'T',
    kind: overlay ? 'audio' : 'video',
    overlay,
    locked: false,
    hidden: false,
    muted: false,
    clips,
  };
}

/** 断言磁吸态（I1）：相邻片段首尾相接。 */
function expectMagnetic(clips: Clip[]) {
  for (let i = 0; i < clips.length - 1; i++) {
    expect(Math.abs(clips[i + 1].timelineStart - clipEnd(clips[i]))).toBeLessThanOrEqual(EPS);
  }
}

describe('A 组 · 查询', () => {
  it('clipDuration / clipEnd 是现算派生量', () => {
    const c = clip('a', 2, 3);
    expect(clipDuration(c)).toBe(3);
    expect(clipEnd(c)).toBe(5);
  });

  it('clipDuration 夹住出点倒挂（兜脏数据，非业务判据）', () => {
    const c = { ...clip('a', 0, 3), sourceStart: 5, sourceEnd: 2 };
    expect(clipDuration(c)).toBe(0);
  });

  it('findClipAt：普通片段半开区间，末片段闭区间（播放头到末尾仍命中）', () => {
    const clips = [clip('a', 0, 2), clip('b', 2, 2)];
    expect(findClipAt(clips, 2)?.clip.id).toBe('b'); // 边界归右
    expect(findClipAt(clips, 4)?.clip.id).toBe('b'); // 末片段闭区间
    expect(findClipAt(clips, 4.5)).toBeNull();
  });

  it('activeClipsAt：自由轨可同时激活多条', () => {
    const t = track([clip('a', 0, 4), clip('b', 1, 2)], true);
    expect(
      activeClipsAt(t, 2)
        .map((c) => c.id)
        .sort(),
    ).toEqual(['a', 'b']);
    expect(activeClipsAt(t, 3.5).map((c) => c.id)).toEqual(['a']);
  });

  it('timelineDuration = 全轨最大 clipEnd', () => {
    expect(timelineDuration([track([clip('a', 0, 2)]), track([clip('b', 5, 3)], true)])).toBe(8);
    expect(timelineDuration([])).toBe(0);
  });

  it('clipEdges：含 0、去重、升序', () => {
    expect(clipEdges([clip('a', 0, 2), clip('b', 2, 3)])).toEqual([0, 2, 5]);
  });

  it('appendTime = 轨上最大 clipEnd（留洞后也不会盖住既有内容）', () => {
    expect(appendTime(track([clip('a', 0, 2), clip('b', 6, 2)]))).toBe(8);
  });

  it('hasOverlap / clipOverlaps：边界接触不算重叠', () => {
    expect(hasOverlap([clip('a', 0, 2), clip('b', 2, 2)])).toBe(false);
    expect(hasOverlap([clip('a', 0, 2), clip('b', 1, 2)])).toBe(true);
    expect(clipOverlaps(track([clip('a', 0, 2), clip('b', 1, 2)], true), 'a')).toBe(true);
    expect(clipOverlaps(track([clip('a', 0, 2)]), '缺失')).toBe(false);
  });
});

describe('B 组 · 编辑（I4：无变化必须返回入参本身）', () => {
  it('【I1/I2】relayoutSequential 只合空隙、保相对顺序；已是磁吸 → 同引用', () => {
    const gapped = [clip('a', 0, 2), clip('b', 5, 3)];
    const packed = relayoutSequential(gapped);
    expect(packed.map((c) => c.id)).toEqual(['a', 'b']);
    expectMagnetic(packed);
    expect(packed.map((c) => c.timelineStart)).toEqual([0, 2]);

    const already = [clip('a', 0, 2), clip('b', 2, 3)];
    expect(relayoutSequential(already)).toBe(already); // I4 同引用
  });

  it('【I2】库内不存在任何排序函数（顺序真相只有「数组顺序」一份）', () => {
    const sortish = Object.keys(ops).filter((k) => /sort/i.test(k));
    expect(sortish).toEqual([]);
  });

  it('【I1 的例外恢复动作】不另立 closeGaps（语义入口即 relayoutSequential，避免两名指一物）', () => {
    expect(Object.keys(ops)).not.toContain('closeGaps');
  });

  it('moveClipTo：重排 + 压实；同位置 / 未知 id → 同引用', () => {
    const clips = [clip('a', 0, 1), clip('b', 1, 1), clip('c', 2, 1)];
    const moved = moveClipTo(clips, 'c', 0);
    expect(moved.map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expectMagnetic(moved);
    expect(moveClipTo(clips, 'a', 0)).toBe(clips);
    expect(moveClipTo(clips, '不存在', 0)).toBe(clips);
  });

  it('moveClipTo：目标序号夹取到合法范围', () => {
    const clips = [clip('a', 0, 1), clip('b', 1, 1)];
    expect(moveClipTo(clips, 'a', 99).map((c) => c.id)).toEqual(['b', 'a']);
    expect(moveClipTo(clips, 'b', -5).map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('duplicateClip：副本紧随其后、id 全新且非时间基后缀', () => {
    const clips = [clip('a', 0, 2), clip('b', 2, 1)];
    const next = duplicateClip(clips, 'a');
    expect(next.map((c) => c.kind)).toEqual(['video', 'video', 'video']);
    const copy = next[1];
    expect(copy.id).not.toBe('a');
    expect(copy.id).not.toMatch(/-b\d+$/); // 拒绝清单：禁 `${id}-b${Date.now()}`
    expect(next.map((c) => c.timelineStart)).toEqual([0, 2, 4]);
  });

  it('removeClips：吸附开 → 一律波纹前移（即使 mode=lift）；吸附关 → 才按 mode 留洞', () => {
    const clips = [clip('a', 0, 2), clip('b', 2, 2), clip('c', 4, 2)];
    // 吸附开（缺省）：mode 被忽略，强制补齐（否则「开了吸附却留洞」自相矛盾）
    const forced = removeClips(clips, ['b'], 'lift');
    expect(forced.map((c) => c.timelineStart)).toEqual([0, 2]); // 前移压实
    // 吸附关：显式 lift / ripple 才各有其义
    const lifted = removeClips(clips, ['b'], 'lift', false);
    expect(lifted.map((c) => c.timelineStart)).toEqual([0, 4]); // 洞保留
    const rippled = removeClips(clips, ['b'], 'ripple', false);
    expect(rippled.map((c) => c.timelineStart)).toEqual([0, 2]); // 前移压实
    expect(removeClips(clips, ['不存在'], 'lift')).toBe(clips); // I4
  });

  it('【吸附开关】magnetic=false 时主轨原语保留空隙（settle 不压实）', () => {
    const gapped = [clip('a', 0, 2), clip('b', 5, 3)];
    // 吸附关：settle 原样返回（同引用，I4）
    expect(settle(gapped, false)).toBe(gapped);
    // 吸附开：压实
    expect(settle(gapped, true).map((c) => c.timelineStart)).toEqual([0, 2]);
    // magneticOf：缺省 = 开（旧工程字段缺失 → 回到历史行为）
    expect(magneticOf(undefined)).toBe(true);
    expect(magneticOf({})).toBe(true);
    expect(magneticOf({ magnetic: false })).toBe(false);
  });

  it('removeClips：删空是合法结果（不引入「至少保留一个片段」）', () => {
    const clips = [clip('a', 0, 2)];
    expect(removeClips(clips, ['a'], 'ripple')).toEqual([]);
  });

  it('splitAt：严格内部可切；落在边界 / 越界 → null（调用处置灰 + tooltip）', () => {
    const clips = [clip('a', 0, 4)];
    const next = splitAt(clips, 2);
    expect(next).toHaveLength(2);
    expect(next?.[0].sourceEnd).toBe(2);
    expect(next?.[1].sourceStart).toBe(2);
    expect(next?.[1].timelineStart).toBe(2);
    expect(next?.[1].id).not.toBe('a');
    expect(splitAt(clips, 0)).toBeNull();
    expect(splitAt(clips, 4)).toBeNull();
    expect(splitAt(clips, 9)).toBeNull();
  });

  it('trimLeftAt / trimRightAt：保留播放头另一侧并压实', () => {
    const clips = [clip('a', 0, 4), clip('b', 4, 2)];
    const left = trimLeftAt(clips, 1);
    expect(left?.[0].sourceStart).toBe(1); // 源入点前进
    expect(left?.[0].sourceEnd).toBe(4);
    // 主轨是磁吸的：裁掉左半后不留头空隙，剩余内容回到 0 起（压实是 I1 的要求）
    expect(left?.[0].timelineStart).toBe(0);
    expect(timelineDuration([track(left!)])).toBe(5); // 原 6 - 裁掉的 1

    const right = trimRightAt(clips, 3);
    expect(right?.[0].sourceEnd).toBe(3);
    expect(right?.[1].timelineStart).toBe(3); // 压实
    expect(trimRightAt(clips, 0)).toBeNull();
  });

  it('freezeFrameAt：插入图片片段（不新增 clip 类型），总时长增加定格时长', () => {
    const clips = [clip('a', 0, 4)];
    const result = freezeFrameAt(clips, 2, 3);
    expect(result).not.toBeNull();
    const out = result!.clips;
    expect(out.map((c) => c.kind)).toEqual(['video', 'image', 'video']);
    expect(out[1].sourceEnd - out[1].sourceStart).toBe(3);
    expect(timelineDuration([track(out)])).toBe(7); // 4 + 3
    expectMagnetic(out);
    expect(freezeFrameAt(clips, 0, 3)).toBeNull();
  });

  it('updateClip 左裁（手柄左柄）：只改入点，主轨压实 → 右缘随之自动前移（波纹）', () => {
    const main = track([clip('a', 0, 2), clip('b', 2, 3), clip('c', 5, 1)]);
    const tracks = [main];

    // 把 b 的入点从 0 推到 1（左裁 1s）：只改 sourceStart，不动 timelineStart
    const cut = updateClip(tracks, 'b', (c) => ({ ...c, sourceStart: 1 }));
    const clips = cut[0].clips;

    expect(clips[1].sourceStart).toBe(1); // 入点前进
    expect(clips[1].sourceEnd).toBe(3); // 出点不动
    expect(clipDuration(clips[1])).toBe(2); // 时长 3 → 2
    expect(clips[1].timelineStart).toBe(2); // 左缘仍贴前一片段末尾（压实）
    expect(clips[2].timelineStart).toBe(4); // 后续片段前移（波纹前移）
    expectMagnetic(clips); // I1 仍成立，无空隙
  });

  it('updateClip：主轨更新后顺排、自由轨保留位置；无变化 → 同引用（I4）', () => {
    const main = track([clip('a', 0, 2), clip('b', 2, 2)]);
    const free = track([clip('c', 7, 2)], true);
    const tracks = [main, free];

    const grown = updateClip(tracks, 'b', (c) => ({ ...c, sourceEnd: 5 }));
    expectMagnetic(grown[0].clips); // 主轨压实
    expect(grown[1]).toBe(free); // 未涉及的自由轨引用未变

    const freeMoved = updateClip(tracks, 'c', (c) => ({ ...c, timelineStart: 10 }));
    expect(freeMoved[1].clips[0].timelineStart).toBe(10); // 自由轨保留位置
    expect(freeMoved[0]).toBe(main);

    expect(updateClip(tracks, 'b', (c) => c)).toBe(tracks); // 同片段引用 → 整体同引用
    expect(updateClip(tracks, '不存在', (c) => c)).toBe(tracks);
  });

  it('placeClipAt：自由轨定位不压实；未变 → 同引用', () => {
    const clips = [clip('a', 0, 2), clip('b', 5, 2)];
    expect(placeClipAt(clips, 'b', 8).map((c) => c.timelineStart)).toEqual([0, 8]);
    expect(placeClipAt(clips, 'b', 5)).toBe(clips);
    expect(placeClipAt(clips, 'a', -3)[0].timelineStart).toBe(0); // 夹 >= 0
  });
});
