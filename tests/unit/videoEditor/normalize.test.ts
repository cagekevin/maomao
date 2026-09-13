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
    expect(p.ui.rowHeight).toBe(38);
    expect(p.ui.dockHeight).toBeGreaterThan(0);
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

  it('多轨工程（M2）：任意条数的轨道都能原样读回，数量与顺序都不丢', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [
        { id: 'v1', kind: 'video', clips: [] },
        { id: 'v2', kind: 'video', overlay: true, clips: [] },
        { id: 'v3', kind: 'video', overlay: true, clips: [] },
        { id: 'a1', kind: 'audio', clips: [] },
        { id: 'a2', kind: 'audio', clips: [] },
      ],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.value.tracks.map((t) => t.id)).toEqual(['v1', 'v2', 'v3', 'a1', 'a2']);
  });

  it('两条 overlay:false 的视频轨（写坏的记录）→ 加载期收敛为「只有第一条是主轨」', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [
        { id: 'v1', kind: 'video', clips: [] },
        // 第二条也声称自己是主轨：放行会让「主轨压实」与直通导出各指一条轨（判据说谎）
        { id: 'v2', kind: 'video', clips: [] },
      ],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.value.tracks[0].overlay).toBe(false);
    expect(r.value.tracks[1].overlay).toBe(true);
  });

  it('★层序收敛：文字轨排在视频轨【之后】的工程 → 加载期提到最前（文字必须在最上层）', () => {
    // 数组 index 越小 = 轨道区越靠上 **且** 画面越靠上（renderFrameAt 倒序绘制）。
    // 若放行「文字轨在视频之后」，文字会被视频**盖住**（且无任何提示）。
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [
        { id: 'v1', kind: 'video', clips: [] },
        { id: 'a1', kind: 'audio', clips: [] },
        { id: 't1', kind: 'text', overlay: true, clips: [] }, // 写在最后 = 会被视频盖住
      ],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.value.tracks.map((t) => t.id)).toEqual(['t1', 'v1', 'a1']);
  });

  it('★层序收敛：已合规时返回**原数组引用**（I4，不制造新数组以免误触发落盘）', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [
        { id: 't1', kind: 'text', overlay: true, clips: [] },
        { id: 'v1', kind: 'video', clips: [] },
        { id: 'a1', kind: 'audio', clips: [] },
      ],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    // 顺序不变（文字本来就在最前）
    expect(r.value.tracks.map((t) => t.id)).toEqual(['t1', 'v1', 'a1']);
  });

  it('★层序收敛：音频轨的前后位置**不被触碰**（它无画面、不参与层序）', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [
        { id: 'a1', kind: 'audio', clips: [] },
        { id: 'v1', kind: 'video', clips: [] },
        { id: 't1', kind: 'text', overlay: true, clips: [] },
      ],
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    // 文字提到最前，其余（含音频在视频之前这种非常规序）**原样保留**
    expect(r.value.tracks.map((t) => t.id)).toEqual(['t1', 'a1', 'v1']);
  });

  it('轨道行高是工程 UI 记忆：持久化回读保留（C7.5，刷新不丢）', () => {
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [],
      ui: { dockHeight: 280, rowHeight: 56 },
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.value.ui.rowHeight).toBe(56);
  });

  it('持久化边界守卫：视图快变量（pps/选中/开合）即使误写进 ui 也会被模型拒收', () => {
    // 「缩放 / 选中 / 面板开合」是这次的屏幕此刻，不该进工程真源。`fromRecord` 用字段白名单读 ui，
    // 所以哪怕调用方误把它写进原始 ui，读取端也只会保留 dockHeight/rowHeight —— 模型不被污染。
    const r = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [],
      ui: {
        dockHeight: 400,
        rowHeight: 44,
        pps: 1.7, // 视图快变量：缩放
        selectedClipId: 'c1', // 视图快变量：选中
        settingsOpen: true, // 视图快变量：面板开合
      },
    });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.value.ui.dockHeight).toBe(400);
    expect(r.value.ui.rowHeight).toBe(44);
    // 三个视图快变量都**没有**进模型（白名单靠结构，不靠自觉）
    expect(Object.keys(r.value.ui)).toEqual(['dockHeight', 'rowHeight', 'magnetic']);
  });

  it('吸附开关（ui.magnetic）随工程往返：读回 false 保留；缺省 / 脏值 → 回落 undefined（= 视为开）', () => {
    const withOff = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [],
      ui: { dockHeight: 280, rowHeight: 38, magnetic: false },
    });
    expect(withOff.status).toBe('ok');
    if (withOff.status !== 'ok') return;
    expect(withOff.value.ui.magnetic).toBe(false); // 落盘 → 读回不丢（白名单已登记）

    // 缺省 = `undefined`（`magneticOf` 视为开）
    const absent = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [],
      ui: { dockHeight: 280, rowHeight: 38 },
    });
    expect(absent.status).toBe('ok');
    if (absent.status !== 'ok') return;
    expect(absent.value.ui.magnetic).toBeUndefined();

    // 脏值（字符串 "false"）不认，回落 undefined，不当真
    const dirty = normalizeProject({
      schemaVersion: VIDEO_EDITOR_SCHEMA_VERSION,
      tracks: [],
      ui: { dockHeight: 280, rowHeight: 38, magnetic: 'false' },
    });
    expect(dirty.status).toBe('ok');
    if (dirty.status !== 'ok') return;
    expect(dirty.value.ui.magnetic).toBeUndefined();
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
