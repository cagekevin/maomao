// @vitest-environment jsdom
/**
 * 回归锁：转场的增 / 删 / 改必须走命令栈（TD-22-40）+ 插入元素要连 settings 一起回滚（TD-22-34）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约一（TD-22-40）：`TimelineManager.addTransition / removeTransition / updateTransition`
 *   与元素、轨道操作**同级** —— 每次提交都入 `CommandManager`，因此可 `undo` / `redo`；
 *   且**判据单点在本层**：无效操作（轨道不对 / 元素不存在 / 不邻接 / 转场不存在）
 *   直接返回、**不入栈**（否则撤销历史里会多出一条按下去没反应的命令）。
 *
 * 契约二（TD-22-34）：`InsertElementCommand` 在「首个可视元素」时会以 `pushHistory:false`
 *   顺带改 `project.settings`（画布尺寸 / 帧率）；该改动必须由本命令的 `undo` 一并回滚 ——
 *   否则撤销插入后画布尺寸/帧率残留，用户得手动改回。
 *
 * 契约三（TD-22-51）：**批量应用转场 = 一条历史条目** —— `addTransitionsToAdjacentPairs`
 *   把整批命令经 `CommandManager.executeBatch` 一次入栈，故 `undo()` **一次**全部回滚。
 *   原实现在 UI 层（`transitions.tsx`）循环调 N 次 `addTransition` → 入栈 N 条、撤销要按 N 次。
 * ════════════════════════════════════════════════════════════════
 * 【为什么锁它】此前 transition 三个方法直接 `updateTracks()` 写回、绕过命令栈 → 用户
 * 加/删/改转场**全部不可撤销**（误删转场无法恢复）；`InsertElementCommand.undo` 只还原
 * tracks、不回滚 settings。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorCore } from '../../src/components/videoEditor/engine/core';
import type { TProject } from '../../src/components/videoEditor/types/project';
import type { MediaAsset } from '../../src/components/videoEditor/types/assets';
import type {
  TimelineTrack,
  TrackTransition,
  TScene,
  VideoTrack,
} from '../../src/components/videoEditor/types/timeline';

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

function videoElement(id: string, startTime: number, duration: number) {
  return {
    id,
    type: 'video',
    name: id,
    mediaId: `m-${id}`,
    startTime,
    duration,
    trimStart: 0,
    playbackRate: 1,
  };
}

/** 一条 video 轨（元素由调用方给：相邻 / 不邻接都在此构造）。 */
function makeScene({ elements }: { elements: unknown[] }): TScene {
  const track = {
    id: 't1',
    type: 'video',
    isMain: true,
    muted: false,
    hidden: false,
    elements,
  };
  return {
    id: 's1',
    name: 's1',
    isMain: true,
    tracks: [track],
    bookmarks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TScene;
}

function videoAsset(id: string, width: number, height: number, fps: number): MediaAsset {
  return {
    id,
    name: id,
    type: 'video',
    url: `blob:${id}`,
    width,
    height,
    fps,
  } as unknown as MediaAsset;
}

/** 当前轨上的转场列表。 */
function transitionsOf(editor: EditorCore): TrackTransition[] {
  const track = editor.timeline.getTracks().find((item: TimelineTrack) => item.id === 't1');
  return (track as VideoTrack | undefined)?.transitions ?? [];
}

/** 装载「两个相邻元素」的最小可编辑时间轴。 */
function setupAdjacent(editor: EditorCore): void {
  editor.project.setActiveProject({ project: makeProject('p1') });
  editor.scenes.setScenes({
    scenes: [
      makeScene({
        elements: [videoElement('e1', 0, 1), videoElement('e2', 1, 1)],
      }),
    ],
    activeSceneId: 's1',
  });
}

describe('转场增删改走命令栈（TD-22-40）', () => {
  let editor: EditorCore;

  beforeEach(() => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    // 关掉 800ms 防抖保存：本组只测命令栈语义，不引入异步落盘噪音。
    editor.save.pause();
    setupAdjacent(editor);
  });

  afterEach(() => {
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('加转场：撤销后消失、重做后回来', () => {
    const transition = editor.timeline.addTransition({
      trackId: 't1',
      fromElementId: 'e1',
      toElementId: 'e2',
      type: 'fade',
      duration: 0.5,
    });

    expect(transition).not.toBeNull();
    expect(transitionsOf(editor)).toHaveLength(1);

    editor.command.undo();
    expect(transitionsOf(editor)).toHaveLength(0);

    editor.command.redo();
    expect(transitionsOf(editor)).toHaveLength(1);
    // 重做后仍是**同一条**转场（id 在构造期生成，不随 redo 变化）。
    expect(transitionsOf(editor)[0].id).toBe(transition?.id);
  });

  it('删转场：撤销后恢复（误删可救）', () => {
    editor.timeline.addTransition({
      trackId: 't1',
      fromElementId: 'e1',
      toElementId: 'e2',
      type: 'fade',
      duration: 0.5,
    });
    const transitionId = transitionsOf(editor)[0].id;

    editor.timeline.removeTransition({ trackId: 't1', transitionId });
    expect(transitionsOf(editor)).toHaveLength(0);

    editor.command.undo();
    expect(transitionsOf(editor)).toHaveLength(1);
    expect(transitionsOf(editor)[0].id).toBe(transitionId);
  });

  it('改转场时长：撤销后回到原时长', () => {
    editor.timeline.addTransition({
      trackId: 't1',
      fromElementId: 'e1',
      toElementId: 'e2',
      type: 'fade',
      duration: 0.5,
    });
    const transitionId = transitionsOf(editor)[0].id;

    editor.timeline.updateTransition({
      trackId: 't1',
      transitionId,
      updates: { duration: 0.9 },
    });
    expect(transitionsOf(editor)[0].duration).toBe(0.9);

    editor.command.undo();
    expect(transitionsOf(editor)[0].duration).toBe(0.5);
  });

  it('不邻接的两元素：返回 null 且**不入栈**（无效操作不污染撤销历史）', () => {
    editor.scenes.setScenes({
      scenes: [makeScene({ elements: [videoElement('e1', 0, 1), videoElement('e2', 5, 1)] })],
      activeSceneId: 's1',
    });

    const result = editor.timeline.addTransition({
      trackId: 't1',
      fromElementId: 'e1',
      toElementId: 'e2',
      type: 'fade',
      duration: 0.5,
    });

    expect(result).toBeNull();
    expect(transitionsOf(editor)).toHaveLength(0);
    expect(editor.command.canUndo()).toBe(false);
  });
});

describe('插入首个可视元素：撤销连画布尺寸一起回滚（TD-22-34）', () => {
  let editor: EditorCore;

  beforeEach(() => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    editor.save.pause();
    editor.project.setActiveProject({ project: makeProject('p1') });
    // 空轨：让插入的元素成为「首个元素」，触发 settings 自动初始化分支。
    editor.scenes.setScenes({ scenes: [makeScene({ elements: [] })], activeSceneId: 's1' });
    editor.media.setAssets({ assets: [videoAsset('m-e1', 1280, 720, 24)] });
  });

  afterEach(() => {
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('撤销插入后 canvasSize / fps 回到插入前', () => {
    const before = editor.project.getActive().settings;

    editor.timeline.insertElement({
      element: { type: 'video', mediaId: 'm-e1', name: 'v1', startTime: 0, duration: 1 },
      placement: { mode: 'explicit', trackId: 't1' },
    } as never);

    const afterInsert = editor.project.getActive().settings;
    expect(afterInsert.canvasSize).toEqual({ width: 1280, height: 720 });
    expect(afterInsert.fps).toBe(24);

    editor.command.undo();

    const afterUndo = editor.project.getActive().settings;
    expect(afterUndo.canvasSize).toEqual(before.canvasSize);
    expect(afterUndo.fps).toBe(before.fps);
    expect(afterUndo.originalCanvasSize).toBe(before.originalCanvasSize);
  });
});

describe('批量应用转场 = 一条历史条目（TD-22-51）', () => {
  let editor: EditorCore;

  beforeEach(() => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    editor.save.pause();
    setupAdjacent(editor);
  });

  afterEach(() => {
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('3 个首尾相接片段（2 个邻接对）：整批只入栈一条 → 撤销**一次**全部回滚', () => {
    // 必须用 N≥2 个邻接对才能测出「粒度」：1 对时新旧实现等价（executeBatch 单条直用）。
    editor.scenes.setScenes({
      scenes: [
        makeScene({
          elements: [videoElement('e1', 0, 1), videoElement('e2', 1, 1), videoElement('e3', 2, 1)],
        }),
      ],
      activeSceneId: 's1',
    });

    const { applied } = editor.timeline.addTransitionsToAdjacentPairs({
      type: 'fade',
      duration: 0.5,
    });

    expect(applied).toBe(2);
    expect(transitionsOf(editor)).toHaveLength(2);

    // 旧实现（UI 层循环调 addTransition）此处 `canUndo` 后 history 有 **2** 条 → 撤销一次只剩 1 条。
    editor.command.undo();
    expect(transitionsOf(editor)).toHaveLength(0);
    expect(editor.command.canUndo()).toBe(false); // 一次撤销即回到干净状态
  });

  it('无相邻片段对：applied=0 且**不入栈**（不污染撤销历史）', () => {
    editor.scenes.setScenes({
      scenes: [makeScene({ elements: [videoElement('e1', 0, 1), videoElement('e2', 5, 1)] })],
      activeSceneId: 's1',
    });

    const { applied } = editor.timeline.addTransitionsToAdjacentPairs({
      type: 'fade',
      duration: 0.5,
    });

    expect(applied).toBe(0);
    expect(transitionsOf(editor)).toHaveLength(0);
    expect(editor.command.canUndo()).toBe(false);
  });
});
