/**
 * 多轨（C 组 · 轨道集合增删 / 跨轨搬移）的行为契约。
 *
 * 【为什么是行为断言而不是"函数被调用"】这些原语的价值全在「返回了什么」：
 *  - 无可变 → 必须返回**入参同一引用**（I4：上层靠 `===` 判「要不要落盘/入栈」）；
 *  - 有可变 → 片段必须真的换了轨，且两类轨的压实规则各自成立。
 * 故断言全部落在「返回值的引用身份」与「返回值的结构事实」上。
 */
import { describe, expect, it } from 'vitest';
import { MAX_TRACKS_PER_KIND } from '../../../src/components/videoEditor/core/constants.ts';
import {
  appendTrack,
  clipEnd,
  findTrackOfClip,
  moveClipAcrossTracks,
  removeTrack,
  trackAccepts,
} from '../../../src/components/videoEditor/core/timelineOps.ts';
import { createEmptyProject } from '../../../src/components/videoEditor/core/normalize.ts';
import type { Clip, Track } from '../../../src/components/videoEditor/core/types.ts';

function clip(id: string, start: number, dur: number, extra: Partial<Clip> = {}): Clip {
  return { id, kind: 'video', sourceStart: 0, sourceEnd: dur, timelineStart: start, ...extra };
}

function track(id: string, kind: Track['kind'], overlay: boolean, clips: Clip[] = []): Track {
  return { id, name: id, kind, overlay, locked: false, hidden: false, muted: false, clips };
}

describe('appendTrack · 加轨', () => {
  it('新增视频轨是叠加轨（overlay:true），且插在同类轨末尾', () => {
    const tracks = [track('v1', 'video', false), track('a1', 'audio', true)];
    const next = appendTrack(tracks, 'video');

    expect(next).toHaveLength(3);
    // 插在 v1 之后、a1 之前（同类轨末尾）——不是简单 push 到数组尾
    expect(next.map((t) => t.id).slice(0, 2)).toEqual(['v1', next[1].id]);
    expect(next[1].kind).toBe('video');
    // 主轨只能一条：新增的视频轨必须是自由轨
    expect(next[1].overlay).toBe(true);
    expect(next[2].id).toBe('a1');
  });

  it('新增音频轨插在最后一条音频轨之后', () => {
    const tracks = [track('v1', 'video', false), track('a1', 'audio', true)];
    const next = appendTrack(tracks, 'audio');
    expect(next).toHaveLength(3);
    expect(next[2].kind).toBe('audio');
    expect(next[2].overlay).toBe(true);
  });

  it('新增视频轨时，工程里原有的第一条视频轨仍是主轨（overlay:false 不变）', () => {
    let tracks: Track[] = [track('v1', 'video', false), track('a1', 'audio', true)];
    tracks = appendTrack(tracks, 'video');
    tracks = appendTrack(tracks, 'video');
    const videoTracks = tracks.filter((t) => t.kind === 'video');
    expect(videoTracks[0].overlay).toBe(false);
    expect(videoTracks.slice(1).every((t) => t.overlay)).toBe(true);
  });

  it('到上限后返回入参同一引用（I4）', () => {
    let tracks: Track[] = [];
    for (let i = 0; i < MAX_TRACKS_PER_KIND; i++) tracks = appendTrack(tracks, 'video');
    expect(tracks).toHaveLength(MAX_TRACKS_PER_KIND);
    // 到顶：必须是**同一个引用**，上层据此判「没变 → 不落盘、不入撤销栈」
    expect(appendTrack(tracks, 'video')).toBe(tracks);
  });

  it('空工程加轨得到可用的视频/音频轨（冷启动路径）', () => {
    const empty = createEmptyProject();
    const withVideo = appendTrack(empty.tracks, 'video');
    expect(withVideo.filter((t) => t.kind === 'video')).toHaveLength(2);
  });
});

describe('removeTrack · 删轨', () => {
  it('非空轨拒绝删除并返回原引用（不静默连片段一起丢）', () => {
    const tracks = [track('v1', 'video', false, [clip('c1', 0, 2)]), track('v2', 'video', true)];
    expect(removeTrack(tracks, 'v1')).toBe(tracks);
  });

  it('最后一条同类轨拒绝删除（否则入轨目标消失）', () => {
    const tracks = [track('v1', 'video', false), track('a1', 'audio', true)];
    expect(removeTrack(tracks, 'v1')).toBe(tracks);
    expect(removeTrack(tracks, 'a1')).toBe(tracks);
  });

  it('空轨 + 还有同类兄弟 → 真的删掉（返回不含该轨的新数组）', () => {
    const tracks = [
      track('v1', 'video', false),
      track('v2', 'video', true),
      track('a1', 'audio', true),
    ];
    const next = removeTrack(tracks, 'v2');
    expect(next).not.toBe(tracks);
    expect(next.map((t) => t.id)).toEqual(['v1', 'a1']);
  });

  it('未知 id → 原引用（不猜）', () => {
    const tracks = [track('v1', 'video', false), track('v2', 'video', true)];
    expect(removeTrack(tracks, 'nope')).toBe(tracks);
  });
});

describe('trackAccepts · 入轨可用性判据', () => {
  it('锁定或隐藏的轨不可作为入轨目标', () => {
    expect(trackAccepts(track('t', 'video', false))).toBe(true);
    expect(trackAccepts({ ...track('t', 'video', false), locked: true })).toBe(false);
    expect(trackAccepts({ ...track('t', 'video', false), hidden: true })).toBe(false);
  });
});

describe('moveClipAcrossTracks · 跨轨搬移', () => {
  it('把片段从主轨搬到叠加轨：源轨少一条、目标轨多一条', () => {
    const tracks = [
      track('v1', 'video', false, [clip('c1', 0, 2), clip('c2', 2, 2)]),
      track('v2', 'video', true),
    ];
    const next = moveClipAcrossTracks(tracks, 'c1', 'v2', 5);

    const v1 = next.find((t) => t.id === 'v1')!;
    const v2 = next.find((t) => t.id === 'v2')!;
    expect(v1.clips.map((c) => c.id)).toEqual(['c2']);
    expect(v2.clips.map((c) => c.id)).toEqual(['c1']);
    expect(v2.clips[0].timelineStart).toBe(5);
  });

  it('搬到主轨且吸附开 → 目标轨被压实（不产生空隙）', () => {
    const tracks = [
      track('v1', 'video', false, [clip('c1', 0, 2)]),
      track('v2', 'video', true, [clip('c2', 0, 3)]),
    ];
    // 把叠加轨的 c2 拖到主轨上、落点 10（会被压实，不该停在 10）
    const next = moveClipAcrossTracks(tracks, 'c2', 'v1', 10, true);
    const v1 = next.find((t) => t.id === 'v1')!;
    const moved = v1.clips.find((c) => c.id === 'c2')!;
    expect(moved.timelineStart).toBe(clipEnd(v1.clips[0]));
  });

  it('搬到自由轨（叠加）→ 保留自由落点（不压实）', () => {
    const tracks = [
      track('v1', 'video', false, [clip('c1', 0, 2)]),
      track('v2', 'video', true, [clip('c2', 0, 1)]),
    ];
    const next = moveClipAcrossTracks(tracks, 'c1', 'v2', 7, true);
    const v2 = next.find((t) => t.id === 'v2')!;
    expect(v2.clips.find((c) => c.id === 'c1')!.timelineStart).toBe(7);
  });

  it('同轨（目标 = 源）→ 原引用（不该由本原语处理同轨拖拽）', () => {
    const tracks = [track('v1', 'video', false, [clip('c1', 0, 2)])];
    expect(moveClipAcrossTracks(tracks, 'c1', 'v1', 5)).toBe(tracks);
  });

  it('片段 / 目标轨不存在 → 原引用（I4，不猜）', () => {
    const tracks = [track('v1', 'video', false, [clip('c1', 0, 2)]), track('v2', 'video', true)];
    expect(moveClipAcrossTracks(tracks, 'nope', 'v2', 0)).toBe(tracks);
    expect(moveClipAcrossTracks(tracks, 'c1', 'nope', 0)).toBe(tracks);
  });

  it('搬完后片段仍可被 findTrackOfClip 定位到新轨（真相只有一份）', () => {
    const tracks = [track('v1', 'video', false, [clip('c1', 0, 2)]), track('v2', 'video', true)];
    const next = moveClipAcrossTracks(tracks, 'c1', 'v2', 0);
    expect(findTrackOfClip(next, 'c1')?.id).toBe('v2');
  });
});
