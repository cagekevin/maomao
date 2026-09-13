/**
 * 走带出声 —— 纯判据单测（docs/120 C11.7 · M1）。
 *
 * 只测可测的：`audibleClipsAt`（某时刻该出声且素材可读的可闻片段）。
 * 媒体元素的真机行为（play/pause/seek）**不在单测范围**（无浏览器/媒体样本），如文件头声明。
 */
import { describe, expect, it } from 'vitest';
import { audibleClipsAt } from '../../../src/components/videoEditor/panels/dock/PlaybackSink.tsx';
import type { Clip, Track } from '../../../src/components/videoEditor/core/types.ts';
import type { EditorClipSource } from '../../../src/components/videoEditor/hooks/useEditorSources.ts';

function clip(p: Partial<Clip>): Clip {
  return {
    id: p.id ?? 'c',
    kind: 'video',
    sourceStart: 0,
    sourceEnd: 10,
    timelineStart: 0,
    ...p,
  };
}

function track(p: Partial<Track>): Track {
  return {
    id: 't',
    name: 't',
    kind: 'video',
    overlay: false,
    locked: false,
    hidden: false,
    muted: false,
    clips: [],
    ...p,
  };
}

const ok = (url: string): EditorClipSource => ({ resolved: { status: 'ok', url } });
const broken = (): EditorClipSource => ({ resolved: { status: 'broken', reason: 'x' } });

describe('audibleClipsAt', () => {
  it('同一时刻主轨视频 + 音频轨片段同时出声（叠声）', () => {
    const video = clip({
      id: 'v1',
      kind: 'video',
      timelineStart: 0,
      sourceStart: 5,
      sourceEnd: 15,
    });
    const audio = clip({
      id: 'a1',
      kind: 'audio',
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: 20,
    });
    const tracks = [
      track({ id: 'videoTrack', kind: 'video', overlay: false, clips: [video] }),
      track({ id: 'audioTrack', kind: 'audio', overlay: true, clips: [audio] }),
    ];
    const sources = new Map([
      ['v1', ok('v://1')],
      ['a1', ok('a://1')],
    ]);

    const active = audibleClipsAt(tracks, sources, 3);
    expect(active.map((a) => a.clip.id).sort()).toEqual(['a1', 'v1']);
  });

  it('播放头在该片段窗口之外 → 不出声', () => {
    const video = clip({ id: 'v1', timelineStart: 10, sourceEnd: 20 });
    const tracks = [track({ clips: [video] })];
    const sources = new Map([['v1', ok('v://1')]]);

    expect(audibleClipsAt(tracks, sources, 0)).toEqual([]);
    expect(audibleClipsAt(tracks, sources, 9)).toEqual([]);
    expect(audibleClipsAt(tracks, sources, 10).map((a) => a.clip.id)).toEqual(['v1']);
    expect(audibleClipsAt(tracks, sources, 19).map((a) => a.clip.id)).toEqual(['v1']);
    // 窗口结束（clipEnd = 30）之后 → 停
    expect(audibleClipsAt(tracks, sources, 31)).toEqual([]);
  });

  it('静音/hidden 轨可闻片段 → 不出声（复用 audibleClipsOf 判据）', () => {
    const video = clip({ id: 'v1', timelineStart: 0 });
    const muted = track({ clips: [video], muted: true });
    const hidden = track({ clips: [video], hidden: true });
    const sources = new Map([['v1', ok('v://1')]]);

    expect(audibleClipsAt([muted], sources, 1)).toEqual([]);
    expect(audibleClipsAt([hidden], sources, 1)).toEqual([]);
  });

  it('图片片段不参与出声', () => {
    const img = clip({ id: 'p1', kind: 'image', timelineStart: 0 });
    const sources = new Map([['p1', ok('p://1')]]);
    expect(audibleClipsAt([track({ clips: [img] })], sources, 1)).toEqual([]);
  });

  it('素材读不到（断链）的片段不出声', () => {
    const video = clip({ id: 'v1', timelineStart: 0 });
    const sources = new Map([['v1', broken()]]);
    expect(audibleClipsAt([track({ clips: [video] })], sources, 1)).toEqual([]);
  });
});
