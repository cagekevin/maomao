import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../../src/components/videoEditor/core/normalize.ts';
import {
  findTrackOfClip,
  hasMixedSources,
  isAudiolessTrack,
  isClipLocked,
  isRenderableTrack,
  isTrackHidden,
  isTrackLocked,
  isTrackMuted,
  mainVideoTrackOf,
  needsCompositing,
  routeClipToTrack,
  rowHeightOf,
} from '../../../src/components/videoEditor/core/routeClip.ts';
import {
  AUDIO_TRACK_ROW_HEIGHT,
  TEXT_TRACK_ROW_HEIGHT,
} from '../../../src/components/videoEditor/core/constants.ts';
import type {
  Clip,
  ClipKind,
  Project,
  Track,
  TrackKind,
} from '../../../src/components/videoEditor/core/types.ts';

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
  it('audio → 音频轨；video 与 image（图片/定格帧）都进视频轨；text → 文字轨', () => {
    expect(routeClipToTrack('audio')).toBe('audio');
    expect(routeClipToTrack('video')).toBe('video');
    expect(routeClipToTrack('image')).toBe('video');
    // ★新增 2026-09-14：文字片段进**专属文字轨**（不复用视频轨）
    expect(routeClipToTrack('text')).toBe('text');
  });

  it('★穷举全部 ClipKind：判据必须覆盖每一个类别（防新增类别时静默走错分支）', () => {
    // 这张「全类别表」就是判据的行为契约：`Record<ClipKind, TrackKind>` 缺键时 tsc 已拦，
    // 但**分错轨**（如 text→video）只有本断言能拦 —— 两者互补，缺一不可。
    const ALL_CLIP_KINDS: ClipKind[] = ['video', 'audio', 'image', 'text'];
    const expected: Record<ClipKind, string> = {
      video: 'video',
      audio: 'audio',
      image: 'video',
      text: 'text',
    };
    for (const k of ALL_CLIP_KINDS) expect(routeClipToTrack(k)).toBe(expected[k]);
    // 只有 audio 分到音频轨（其余都不是音频轨）
    expect(ALL_CLIP_KINDS.filter((k) => routeClipToTrack(k) === 'audio')).toEqual(['audio']);
  });
});

describe('★TrackKind 覆盖（2026-09-14）：画面类/纯声音类必须恰好覆盖全部轨道类别', () => {
  it('RENDERABLE ∪ AUDIOLESS = 全部 TrackKind，且互不相交', () => {
    const ALL_TRACK_KINDS: TrackKind[] = ['video', 'audio', 'text'];
    for (const k of ALL_TRACK_KINDS) {
      const visual = isRenderableTrack(k);
      const audioOnly = isAudiolessTrack(k);
      // 每个类别**必须**恰好属于一侧（两集合互补）—— 落进「无人区」就是漏表态
      expect(visual !== audioOnly).toBe(true);
    }
    // 文字轨**有画面**（要渲染进成片）：漏加它 ⇒ 文字不入成片且导出仍报成功
    expect(isRenderableTrack('text')).toBe(true);
    expect(isAudiolessTrack('audio')).toBe(true);
  });

  it('★rowHeightOf：缩放只针对视频轨（音频/文字固定，不随可调值变化）', () => {
    const p = createEmptyProject();
    const video = p.tracks[0];
    const audio = p.tracks[1];
    const text: Track = {
      id: 't1',
      name: '文字',
      kind: 'text',
      overlay: true,
      locked: false,
      hidden: false,
      muted: false,
      clips: [],
    };

    // 视频轨 = 可调值（跟随滑块）
    expect(rowHeightOf(video, 50)).toBe(50);
    expect(rowHeightOf(video, 96)).toBe(96);
    // 音频轨 / 文字轨 = **固定值**，换可调值也**不变**（用户裁定：缩放只针对视频轨）
    expect(rowHeightOf(audio, 50)).toBe(AUDIO_TRACK_ROW_HEIGHT);
    expect(rowHeightOf(audio, 96)).toBe(AUDIO_TRACK_ROW_HEIGHT);
    expect(rowHeightOf(audio, 24)).toBe(AUDIO_TRACK_ROW_HEIGHT);
    expect(rowHeightOf(text, 50)).toBe(TEXT_TRACK_ROW_HEIGHT);
    expect(rowHeightOf(text, 96)).toBe(TEXT_TRACK_ROW_HEIGHT);
    // 文字轨比音频轨紧凑（mockup 要求）
    expect(TEXT_TRACK_ROW_HEIGHT).toBeLessThan(AUDIO_TRACK_ROW_HEIGHT);
  });

  it('mainVideoTrackOf 取「第一条画面类轨」（文字轨不会被误当主视频轨）', () => {
    const p = createEmptyProject();
    // 把文字轨插到**视频轨之前**：若判据是 `kind === 'video'` 之外的写法就可能选错
    p.tracks.unshift({
      id: 't1',
      name: '文字',
      kind: 'text',
      overlay: true,
      locked: false,
      hidden: false,
      muted: false,
      clips: [clip('txt', 0, 2, { kind: 'text' })],
    });
    expect(mainVideoTrackOf(p)?.kind).toBe('video');
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

  it('多轨（M2）：主视频轨之外的视频轨上有内容 → 必须合成（直通只搬一条视频流）', () => {
    const p = createEmptyProject();
    // 第二条视频轨 = 叠加轨
    p.tracks.splice(1, 0, {
      id: 'v2',
      name: '视频',
      kind: 'video',
      overlay: true,
      locked: false,
      hidden: false,
      muted: false,
      clips: [clip('b', 0, 2)],
    });
    expect(needsCompositing(p)).toBe(true);
  });

  it('多轨（M2）：新增的视频轨空着 → 仍可无损直通（不因"有两条轨"就多编码一次）', () => {
    const p = createEmptyProject();
    p.tracks.splice(1, 0, {
      id: 'v2',
      name: '视频',
      kind: 'video',
      overlay: true,
      locked: false,
      hidden: false,
      muted: false,
      clips: [],
    });
    expect(needsCompositing(p)).toBe(false);
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
