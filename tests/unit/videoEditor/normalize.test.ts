import { describe, expect, it } from 'vitest';
import { VIDEO_EDITOR_SCHEMA_VERSION } from '../../../src/components/videoEditor/core/constants.ts';
import {
  createEmptyProject,
  normalizeProject,
} from '../../../src/components/videoEditor/core/normalize.ts';

/** 递归收集对象里出现过的所有键名（用于 T2「派生量不落盘」断言）。 */
function collectKeys(value: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, acc);
    return acc;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      acc.add(k);
      collectKeys(v, acc);
    }
  }
  return acc;
}

describe('createEmptyProject', () => {
  it('空工程：fps 30 / playhead 0 / 固定双轨（视频磁吸 + 音频自由）', () => {
    const p = createEmptyProject();
    expect(p.fps).toBe(30);
    expect(p.playhead).toBe(0);
    expect(p.schemaVersion).toBe(VIDEO_EDITOR_SCHEMA_VERSION);
    expect(p.tracks).toHaveLength(2);
    expect(p.tracks[0].kind).toBe('video');
    expect(p.tracks[0].overlay).toBe(false); // 主轨 = 磁吸
    expect(p.tracks[1].kind).toBe('audio');
    expect(p.tracks[1].overlay).toBe(true); // 自由轨 = 可留空
    expect(p.tracks[0].clips).toEqual([]);
    expect(p.tracks[1].clips).toEqual([]);
  });

  it('轨道 id 唯一且由 generateId 生成（非时间基后缀）', () => {
    const p = createEmptyProject();
    expect(p.tracks[0].id).not.toBe(p.tracks[1].id);
    // generateId 形如 `track-v_<base36时间>_<6位随机>`；拒绝清单禁的是 `${id}-b${Date.now()}`
    expect(p.tracks[0].id).toMatch(/^track-v_.+_.+$/);
  });

  it('【I 不变量】三状态默认全部 false，且只增字段不增实体（docs/120 C7.1）', () => {
    const p = createEmptyProject();
    for (const t of p.tracks) {
      expect(t.locked).toBe(false);
      expect(t.hidden).toBe(false);
      expect(t.muted).toBe(false);
    }
  });
});

describe('normalizeProject — 时间纪律 T2（派生不落盘）', () => {
  it('序列化产物中不存在 duration / clipEnd 键', () => {
    const p = createEmptyProject();
    // 塞一个片段，确保片段层也被检查到
    p.tracks[0].clips.push({
      id: 'c1',
      kind: 'video',
      sourceStart: 1,
      sourceEnd: 4,
      timelineStart: 0,
      sourceUrl: '/files/a.mp4',
    });
    const keys = collectKeys(JSON.parse(JSON.stringify(p)));
    expect(keys.has('duration')).toBe(false);
    expect(keys.has('clipEnd')).toBe(false);
  });
});

describe('normalizeProject — 版本守卫（docs/123 §一.4 ②）', () => {
  it('非对象 → reject', () => {
    const r = normalizeProject(null);
    expect(r.status).toBe('reject');
  });

  it('缺少 schemaVersion → reject（不按缺字段渲染）', () => {
    const r = normalizeProject({ tracks: [] });
    expect(r.status).toBe('reject');
    if (r.status === 'reject') expect(r.reason).toContain('schemaVersion');
  });

  it('schemaVersion 高于当前 → reject', () => {
    const r = normalizeProject({ schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION + 1, tracks: [] });
    expect(r.status).toBe('reject');
    if (r.status === 'reject') expect(r.reason).toContain('高于当前支持');
  });

  it('结构损坏（tracks 不是数组）→ reject，而不是静默补空', () => {
    const r = normalizeProject({ schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION, tracks: {} });
    expect(r.status).toBe('reject');
  });

  it('结构损坏（片段缺 id）→ reject（id 是实体身份，补不出默认值）', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [{ id: 't1', kind: 'video', clips: [{ sourceStart: 0, sourceEnd: 1 }] }],
    });
    expect(r.status).toBe('reject');
    if (r.status === 'reject') expect(r.reason).toContain('id');
  });
});

describe('normalizeProject — 缺字段补全（旧版本有已知语义，补默认是对的）', () => {
  it('合法记录：补 fps/playhead/settings/ui，并归一化轨道三状态', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [
        { id: 't1', kind: 'video', clips: [] },
        { id: 't2', kind: 'audio', clips: [] },
      ],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const p = r.value;
    expect(p.fps).toBe(30);
    expect(p.playhead).toBe(0);
    expect(p.settings.width).toBeGreaterThan(0);
    expect(p.ui.dockHeight).toBeGreaterThan(0);
    expect(p.tracks[0].overlay).toBe(false);
    expect(p.tracks[1].overlay).toBe(true);
    expect(p.tracks[0].locked).toBe(false);
  });

  it('NaN / Infinity 时间被回默认值（NaN 会静默污染所有时间运算）', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      playhead: Number.NaN,
      fps: Number.POSITIVE_INFINITY,
      tracks: [],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.value.playhead).toBe(0);
    expect(r.value.fps).toBe(30);
  });

  it('出点倒挂 → 夹成零长片段（不丢弃：丢弃会静默改变时间轴长度）', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [
        {
          id: 't1',
          kind: 'video',
          clips: [{ id: 'c1', kind: 'video', sourceStart: 5, sourceEnd: 2, timelineStart: 0 }],
        },
      ],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.value.tracks[0].clips[0].sourceEnd).toBe(5);
  });
});

describe('normalizeProject — 刻意不做的事（防后人再"补"一次）', () => {
  it('不做重复 id 重铸（docs/123 §二.9 第 1 行已删；本仓 generateId 含随机段，无该根因）', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [
        {
          id: 'dup',
          kind: 'video',
          clips: [
            { id: 'same', kind: 'video', sourceStart: 0, sourceEnd: 1, timelineStart: 0 },
            { id: 'same', kind: 'video', sourceStart: 0, sourceEnd: 1, timelineStart: 1 },
          ],
        },
      ],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.value.tracks[0].clips.map((c) => c.id)).toEqual(['same', 'same']);
  });
});
