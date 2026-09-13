import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../../src/components/videoEditor/core/normalize.ts';
import {
  findTrackOfClip,
  hasMixedSources,
  isClipLocked,
  isTrackHidden,
  isTrackLocked,
  isTrackMuted,
  needsCompositing,
  routeClipToTrack,
} from '../../../src/components/videoEditor/core/routeClip.ts';
import type { Clip, ClipKind, Project } from '../../../src/components/videoEditor/core/types.ts';

function clip(id: string, start: number, dur: number, extra: Partial<Clip> = {}): Clip {
  return { id, kind: 'video', sourceStart: 0, sourceEnd: dur, timelineStart: start, ...extra };
}

/** 空工程 + 往指定轨塞片段。 */
function projectWith(video: Clip[], audio: Clip[] = [], patch: (p: Project) => void = () => {}) {
  const p = createEmptyProject();
  p.tracks[0].clips.push(...video);
  p.tracks[1].clips.push(...audio);
  patch(p);
  return p;
}

describe('routeClipToTrack — 分轨唯一判据（docs/120 C11.1）', () => {
  it('audio → 音频轨；video 与 image（图片/定格帧）都进视频轨', () => {
    expect(routeClipToTrack('audio')).toBe('audio');
    expect(routeClipToTrack('video')).toBe('video');
    expect(routeClipToTrack('image')).toBe('video');
  });

  it('穷举 ClipKind：只有 audio 分到音频轨（防未来新增类别时静默漏判）', () => {
    const kinds: ClipKind[] = ['video', 'audio', 'image'];
    const toAudio = kinds.filter((k) => routeClipToTrack(k) === 'audio');
    expect(toAudio).toEqual(['audio']);
  });
});

describe('needsCompositing — 导出路径唯一判据（docs/120 C5.1 / C12.1）', () => {
  it('空工程 / 主轨单个视频 → 可直通（false）', () => {
    expect(needsCompositing(createEmptyProject())).toBe(false);
    expect(needsCompositing(projectWith([clip('a', 0, 4)]))).toBe(false);
  });

  it('主轨多个同尺寸视频 → 仍可无损拼接（false）', () => {
    expect(needsCompositing(projectWith([clip('a', 0, 2), clip('b', 2, 2)]))).toBe(false);
  });

  it('片段尺寸 ≠ 工程尺寸 → 必须合成（C12.1 红线，A 版漏了这条）', () => {
    const p = projectWith([clip('a', 0, 2, { size: { width: 1920, height: 1080 } })]);
    expect(p.settings.width).toBe(1280);
    expect(needsCompositing(p)).toBe(true);
  });

  it('片段尺寸与工程一致 → 不因此判合成', () => {
    const p = projectWith([clip('a', 0, 2)]);
    expect(needsCompositing(projectWith([clip('a', 0, 2, { size: { ...p.settings } })]))).toBe(
      false,
    );
  });

  it('图片片段（含定格帧）→ 没有可搬运的编码流 → 必须合成', () => {
    expect(needsCompositing(projectWith([clip('a', 0, 2, { kind: 'image' })]))).toBe(true);
  });

  it('自由轨（叠加 / 音频）上有内容 → 必须合成', () => {
    expect(
      needsCompositing(projectWith([clip('a', 0, 2)], [clip('m', 0, 2, { kind: 'audio' })])),
    ).toBe(true);
  });

  it('同轨重叠 → 必须合成（直通表达不了重叠）', () => {
    expect(needsCompositing(projectWith([clip('a', 0, 4), clip('b', 1, 2)]))).toBe(true);
  });

  it('M2 加工字段一旦有值 → 必须合成（判据跟着数据模型走，M2 上线不漏分流）', () => {
    expect(
      needsCompositing(projectWith([clip('a', 0, 2, { transform: { scale: 2, x: 0, y: 0 } })])),
    ).toBe(true);
    expect(
      needsCompositing(projectWith([clip('a', 0, 2, { volumePoints: [{ t: 0, gain: 0.5 }] })])),
    ).toBe(true);
  });

  it('入参收成单个 Project（不是 tracks + size 两参）', () => {
    expect(needsCompositing.length).toBe(1);
  });
});

describe('hasMixedSources — 异构素材判据', () => {
  it('维度一致 / 单条 / 全空 → false', () => {
    expect(hasMixedSources([])).toBe(false);
    expect(hasMixedSources([{ width: 1280, height: 720 }])).toBe(false);
    expect(
      hasMixedSources([
        { width: 1280, height: 720, mimeType: 'video/mp4' },
        { width: 1280, height: 720, mimeType: 'video/mp4' },
      ]),
    ).toBe(false);
    expect(hasMixedSources([{}, {}])).toBe(false); // 探测不到 → 不参与判定（不猜）
  });

  it('分辨率或容器不一致 → true', () => {
    expect(hasMixedSources([{ width: 1280 }, { width: 1920 }])).toBe(true);
    expect(
      hasMixedSources([
        { width: 1280, mimeType: 'video/mp4' },
        { width: 1280, mimeType: 'video/webm' },
      ]),
    ).toBe(true);
  });
});

describe('三状态判据 — 锁定收口一处（docs/120 C7.3）', () => {
  it('未知 id 一律按「未锁定 / 未隐藏 / 未静音」（不猜）', () => {
    const p = createEmptyProject();
    expect(isTrackLocked(p.tracks, '不存在')).toBe(false);
    expect(isTrackHidden(p.tracks, '不存在')).toBe(false);
    expect(isTrackMuted(p.tracks, '不存在')).toBe(false);
    expect(isClipLocked(p.tracks, '不存在')).toBe(false);
  });

  it('片段锁定跟随所属轨；locate 所属轨', () => {
    const p = projectWith([clip('a', 0, 2)]);
    p.tracks[0].locked = true;
    expect(isTrackLocked(p.tracks, p.tracks[0].id)).toBe(true);
    expect(isClipLocked(p.tracks, 'a')).toBe(true);
    expect(findTrackOfClip(p.tracks, 'a')?.id).toBe(p.tracks[0].id);
    expect(findTrackOfClip(p.tracks, 'b')).toBeUndefined();
  });

  it('隐藏 / 静音只读状态，不动数据', () => {
    const p = projectWith([clip('a', 0, 2)]);
    p.tracks[0].hidden = true;
    p.tracks[0].muted = true;
    expect(isTrackHidden(p.tracks, p.tracks[0].id)).toBe(true);
    expect(isTrackMuted(p.tracks, p.tracks[0].id)).toBe(true);
    expect(p.tracks[0].clips).toHaveLength(1);
  });
});
