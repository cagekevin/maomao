// @vitest-environment jsdom
/**
 * 回归锁：转场「可用交界」的判据（TD-22-49）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约一（阈值）：`ADJACENCY_EPSILON = 0.05` **不是**"过严的 bug"。
 *   片段 `startTime` 一律帧对齐 + 拖动走 `snapElementEdge`（±10px 吸附）
 *   ⇒ 真相接时 gap 恒为 0，最坏（吸附差一帧）也只有 `1/fps`。
 *   本锁把这条"为什么 0.05 够用"钉住：相接 ✅ / 差一帧 ✅ / 留出间隔 ❌。
 *
 * 契约二（同源）：面板显示的「可用交界数」必须 == **一次点击实际能加上** 的转场数。
 *   它俩若漂移，就会出现"显示有 2 个、点了说没找到" —— 那正是 TD-22-49 的用户体验。
 * ════════════════════════════════════════════════════════════════
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorCore } from '../../src/components/videoEditor/engine/core';
import {
  areElementsAdjacent,
  findAdjacentPairs,
} from '../../src/components/videoEditor/engine/timeline/transition-utils';
import { TRANSITION_PRESETS } from '../../src/components/videoEditor/constants/transition-constants';
import type { TProject } from '../../src/components/videoEditor/types/project';
import type {
  TScene,
  VideoElement,
  VideoTrack,
} from '../../src/components/videoEditor/types/timeline';

function videoEl(id: string, startTime: number, duration: number): VideoElement {
  return {
    id,
    type: 'video',
    mediaId: 'm1',
    name: id,
    startTime,
    duration,
    trimStart: 0,
    playbackRate: 1,
    muted: false,
    hidden: false,
    transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
    opacity: 1,
  } as unknown as VideoElement;
}

function videoTrack({ id, elements }: { id: string; elements: VideoElement[] }): VideoTrack {
  return {
    id,
    type: 'video',
    isMain: false,
    muted: false,
    hidden: false,
    elements,
  } as unknown as VideoTrack;
}

describe('转场「相邻」判据 —— 阈值口径（TD-22-49）', () => {
  it('首尾相接（gap = 0）→ 相邻', () => {
    expect(
      areElementsAdjacent({ elementA: videoEl('a', 0, 2), elementB: videoEl('b', 2, 2) }),
    ).toBe(true);
  });

  it('差一帧（30fps ≈ 0.033s < 0.05）→ 仍相邻（覆盖"吸附差一帧"的极端）', () => {
    expect(
      areElementsAdjacent({
        elementA: videoEl('a', 0, 2),
        elementB: videoEl('b', 2 + 1 / 30, 2),
      }),
    ).toBe(true);
  });

  it('留出可感知的间隔（0.2s）→ **不**相邻（间距有意义：转场不能跨黑场）', () => {
    expect(
      areElementsAdjacent({ elementA: videoEl('a', 0, 2), elementB: videoEl('b', 2.2, 2) }),
    ).toBe(false);
  });

  it('findAdjacentPairs：只有真相接才成对', () => {
    expect(
      findAdjacentPairs({
        track: videoTrack({ id: 't1', elements: [videoEl('a', 0, 2), videoEl('b', 2, 2)] }),
      }),
    ).toHaveLength(1);
    expect(
      findAdjacentPairs({
        track: videoTrack({ id: 't2', elements: [videoEl('a', 0, 2), videoEl('b', 3, 2)] }),
      }),
    ).toHaveLength(0);
  });
});

function makeProject(id: string): TProject {
  return {
    metadata: { id, name: id, duration: 0, createdAt: new Date(), updatedAt: new Date() },
    scenes: [],
    currentSceneId: '',
    settings: {
      fps: 30,
      canvasSize: { width: 1920, height: 1080 },
      originalCanvasSize: null,
      background: { type: 'color', color: '#000000' },
    },
    version: 3,
  } as unknown as TProject;
}

function makeScene(tracks: VideoTrack[]): TScene {
  return {
    id: 's1',
    name: 's1',
    isMain: true,
    tracks,
    bookmarks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TScene;
}

describe('countAdjacentJunctions 与写路径同源 —— 「看得见的就能加上」（TD-22-49）', () => {
  let editor: EditorCore;

  beforeEach(() => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    editor.save.pause();
    editor.project.setActiveProject({ project: makeProject('p1') });
    editor.scenes.setScenes({
      scenes: [
        makeScene([
          // 有 2 个交界（a→b、b→c 都相接）
          videoTrack({
            id: 't1',
            elements: [videoEl('a', 0, 2), videoEl('b', 2, 2), videoEl('c', 4, 1)],
          }),
          // 有 2 个交界（上一段末尾 == 下一段起点）
          videoTrack({
            id: 't2',
            elements: [videoEl('d', 0, 1), videoEl('e', 1, 1), videoEl('f', 2, 1)],
          }),
          // 无交界（留了间隔）
          videoTrack({ id: 't3', elements: [videoEl('g', 0, 1), videoEl('h', 5, 1)] }),
        ]),
      ],
      activeSceneId: 's1',
    });
  });

  afterEach(() => {
    editor.save.stop();
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('显示的可用交界数 == 一次点击实际能加上的转场数（2 + 2 + 0 = 4）', () => {
    const shown = editor.timeline.countAdjacentJunctions();
    expect(shown).toBe(4);

    const { applied } = editor.timeline.addTransitionsToAdjacentPairs({
      type: TRANSITION_PRESETS[0].type,
      duration: 0.5,
    });
    expect(applied).toBe(shown);
  });

  it('加完转场后，交界数不变（转场不改变"片段是否相接"）', () => {
    const before = editor.timeline.countAdjacentJunctions();
    editor.timeline.addTransitionsToAdjacentPairs({
      type: TRANSITION_PRESETS[0].type,
      duration: 0.5,
    });
    expect(editor.timeline.countAdjacentJunctions()).toBe(before);
  });

  it('把片段拖到相接后，交界数随之上升 —— 面板数字与轨道实况同步', () => {
    expect(editor.timeline.countAdjacentJunctions()).toBe(4);

    editor.timeline.updateElements({
      updates: [
        {
          trackId: 't3',
          elementId: 'h',
          // g 的末尾是 1.0 → 把 h 拖到 1.0 即相接
          updates: { startTime: 1 },
        },
      ],
      pushHistory: false,
    });

    expect(editor.timeline.countAdjacentJunctions()).toBe(5);
  });
});
