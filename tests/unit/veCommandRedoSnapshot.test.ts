// @vitest-environment jsdom
/**
 * 回归锁：命令的「快照只捕获一次」契约（redo 不得重捕）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约：命令是「一次可逆操作」——
 *   · `execute()` 首次执行时捕获快照（savedState）；
 *   · `redo()`（缺省 = 再跑一遍 execute）**只能重放动作，不得重捕快照**；
 *   · 因此 `execute → undo → redo → undo` 的最后一次 undo 必须与第一次 undo 结果一致。
 * ════════════════════════════════════════════════════════════════
 * 【为什么锁它】`Command.redo()` 的缺省实现是 `this.execute()`，而快照式命令把
 * `this.savedState = editor.timeline.getTracks()` 无条件写在 `execute()` 顶部 →
 * 重做时用「重做后的（已被改坏的）状态」覆盖快照，此后再撤销**恢复的是重做后状态**。
 * 用户可见症状：删除元素 → 撤销（回来了）→ 重做（又删了）→ 撤销（**元素永久丢失**）。
 * 全库 26 处命令同一写法（母体），本用例锁住收口后的行为，防它再退回「各写一遍」。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorCore } from '../../src/components/videoEditor/engine/core';
import {
  BatchCommand,
  DeleteElementsCommand,
} from '../../src/components/videoEditor/engine/commands';
import type { TProject } from '../../src/components/videoEditor/types/project';
import type { TimelineTrack, TScene } from '../../src/components/videoEditor/types/timeline';

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

/** 用 text 元素（不带 mediaId）以避开 ephemeral 素材清理分支，只测快照语义。 */
function textElement(id: string) {
  return {
    id,
    type: 'text',
    name: id,
    content: id,
    startTime: 0,
    duration: 1,
  };
}

function makeScene(id: string, elementIds: string[]): TScene {
  const track = {
    id: 't1',
    type: 'video',
    isMain: true,
    muted: false,
    hidden: false,
    elements: elementIds.map(textElement),
  };
  return {
    id,
    name: id,
    isMain: true,
    tracks: [track],
    bookmarks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TScene;
}

/** 当前轨上元素 id（按顺序）。 */
function elementIds(editor: EditorCore): string[] {
  return editor.timeline
    .getTracks()
    .flatMap((track: TimelineTrack) => track.elements.map((element) => element.id));
}

describe('命令快照：redo 不得重捕（TD-22-25 母体）', () => {
  let editor: EditorCore;

  beforeEach(() => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    editor.project.setActiveProject({ project: makeProject('p1') });
    editor.scenes.setScenes({ scenes: [makeScene('s1', ['e1', 'e2'])], activeSceneId: 's1' });
  });

  afterEach(() => {
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('删除 → 撤销 → 重做 → 撤销：元素仍能恢复（快照未被重做覆盖）', () => {
    editor.timeline.deleteElements({ elements: [{ trackId: 't1', elementId: 'e1' }] });
    expect(elementIds(editor)).toEqual(['e2']);

    editor.command.undo();
    expect(elementIds(editor)).toEqual(['e1', 'e2']);

    editor.command.redo();
    expect(elementIds(editor)).toEqual(['e2']);

    // ← 这是关键断言：第二次撤销必须与第一次撤销结果一致。
    // 旧实现会在 redo 时把快照重捕成 ['e2']，于是这里恢复出来还是 ['e2']（元素永久丢失）。
    editor.command.undo();
    expect(elementIds(editor)).toEqual(['e1', 'e2']);
  });

  it('BatchCommand 同样满足该契约（其 redo 委托子命令，不重跑 execute 的捕获）', () => {
    editor.command.execute({
      command: new BatchCommand([
        new DeleteElementsCommand([{ trackId: 't1', elementId: 'e1' }]),
        new DeleteElementsCommand([{ trackId: 't1', elementId: 'e2' }]),
      ]),
    });
    expect(elementIds(editor)).toEqual([]);

    editor.command.undo();
    expect(elementIds(editor)).toEqual(['e1', 'e2']);

    editor.command.redo();
    expect(elementIds(editor)).toEqual([]);

    editor.command.undo();
    expect(elementIds(editor)).toEqual(['e1', 'e2']);
  });
});
