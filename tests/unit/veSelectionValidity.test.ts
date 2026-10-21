// @vitest-environment jsdom
/**
 * 回归锁：选择的**有效性不变量** —— 选择必须指向当前场景里存在的元素（TD-22-26）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约：`SelectionManager.getSelectedElements()` 返回的集合**永远**是
 * 「选择意图 ∩ 当前 tracks 中存在的元素」。因此：
 *   · 任何删除路径（删元素 / 素材连带删除 / 删轨道 / 删场景）后，幽灵选择**自动不可见**；
 *   · 撤销把元素带回来后，选择**自动恢复**（无需命令捕获 / 还原 previousSelection）；
 *   · 调用方不需要记得任何清理动作（此前只有 UI 的 delete-selected 记得清，
 *     其它三条路径漏 → 属性面板白板）。
 *   · `useSyncExternalStore` 契约：状态未变时 `getSelectedElements()` 必须返回**同一引用**，
 *     否则 React 判定"每次都变了"→ 无限重渲染。
 * ════════════════════════════════════════════════════════════════
 * 注：跑「素材连带删除」用例时会打出一行
 * `[error] videoEditor | Failed to delete media item: indexedDB is not defined` ——
 * 那是 jsdom 没有持久层、`RemoveMediaAssetCommand` 的存储删除如实报错的记录（已 catch），
 * **不是断言失败**，不必修。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { at } from '../helpers/at';
import { mediaAssetOf, sceneOf } from '../helpers/fixtures';
import { EditorCore } from '../../src/components/videoEditor/engine/core';
import { RemoveMediaAssetCommand } from '../../src/components/videoEditor/engine/commands/media/remove-media-asset.ts';
import type { TProject } from '../../src/components/videoEditor/types/project';
import type { MediaAsset } from '../../src/components/videoEditor/types/mediaAssets';
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
  };
}

function videoElement(id: string, startTime: number) {
  return {
    id,
    type: 'video',
    name: id,
    mediaId: `m-${id}`,
    startTime,
    duration: 1,
    trimStart: 0,
  };
}

function textElement(id: string) {
  return { id, type: 'text', name: id, content: id, startTime: 0, duration: 1 };
}

/**
 * 刻意构造「**同一轨里混装video + text 元素**」——本套件测的是「选中列表里出现跨类型/跨轨元素时
 * 如何判定有效性」，需要的就是类型上不成立的组合（拆成两条合规轨道会改变用例语义：
 * 选择项会落到不同 trackId 上）。故单点收口 + 注释，而不是硬套工厂。
 */
function track(id: string, elements: unknown[]): TimelineTrack {
  return {
    id,
    type: 'video',
    isMain: id === 't1',
    muted: false,
    hidden: false,
    elements,
  } as unknown as TimelineTrack;
}

function makeScene(tracks: TimelineTrack[]): TScene {
  // 走共享工厂（补 bookmarks / 时间戳），不再整块断言成 TScene
  return sceneOf({ id: 's1', name: 's1', isMain: true, tracks });
}

function videoAsset(id: string): MediaAsset {
  // 走共享工厂（补 file 等必填字段），不再整块断言成 MediaAsset
  return mediaAssetOf({ id, name: id, type: 'video', url: `blob:${id}` });
}

/** 选中 e1（t1 上）。 */
function selectE1(editor: EditorCore): void {
  editor.selection.setSelectedElements({ elements: [{ trackId: 't1', elementId: 'e1' }] });
}

describe('选择的失效/恢复由读取侧不变量保证（TD-22-26）', () => {
  let editor: EditorCore;

  beforeEach(() => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    editor.save.pause();
    editor.project.setActiveProject({ project: makeProject('p1') });
    editor.scenes.setScenes({
      scenes: [makeScene([track('t1', [videoElement('e1', 0), textElement('e2')])])],
      activeSceneId: 's1',
    });
  });

  afterEach(() => {
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('删元素后选择自动失效（无需调用方清理）', () => {
    selectE1(editor);
    expect(editor.selection.getSelectedElements()).toHaveLength(1);

    editor.timeline.deleteElements({ elements: [{ trackId: 't1', elementId: 'e1' }] });

    expect(editor.selection.getSelectedElements()).toEqual([]);
  });

  it('素材连带删除后选择自动失效（TD-22-26 的原始症状路径）', () => {
    editor.media.setAssets({ assets: [videoAsset('m-e1')] });
    selectE1(editor);

    // 删素材 → 命令内部委托 deleteElements 把该素材上的元素一并删掉。
    editor.command.execute({ command: new RemoveMediaAssetCommand('p1', 'm-e1') });

    expect(at(editor.timeline.getTracks(), 0).elements).toHaveLength(1);
    expect(editor.selection.getSelectedElements()).toEqual([]);
  });

  it('删轨道后该轨上的选择自动失效', () => {
    editor.scenes.setScenes({
      scenes: [makeScene([track('t1', [textElement('e2')]), track('t2', [videoElement('x1', 0)])])],
      activeSceneId: 's1',
    });
    editor.selection.setSelectedElements({ elements: [{ trackId: 't2', elementId: 'x1' }] });
    expect(editor.selection.getSelectedElements()).toHaveLength(1);

    editor.timeline.removeTrack({ trackId: 't2' });

    expect(editor.selection.getSelectedElements()).toEqual([]);
  });

  it('撤销把元素带回来后，选择自动恢复', () => {
    selectE1(editor);

    editor.timeline.deleteElements({ elements: [{ trackId: 't1', elementId: 'e1' }] });
    expect(editor.selection.getSelectedElements()).toEqual([]);

    editor.command.undo();

    expect(editor.selection.getSelectedElements()).toEqual([{ trackId: 't1', elementId: 'e1' }]);
  });

  it('只失效被删的那部分，其余选择保留（不是一刀切全清）', () => {
    editor.selection.setSelectedElements({
      elements: [
        { trackId: 't1', elementId: 'e1' },
        { trackId: 't1', elementId: 'e2' },
      ],
    });

    editor.timeline.deleteElements({ elements: [{ trackId: 't1', elementId: 'e1' }] });

    expect(editor.selection.getSelectedElements()).toEqual([{ trackId: 't1', elementId: 'e2' }]);
  });

  it('useSyncExternalStore 契约：状态未变时返回同一引用', () => {
    selectE1(editor);

    const first = editor.selection.getSelectedElements();
    expect(editor.selection.getSelectedElements()).toBe(first);

    // tracks 变了但选择内容不变（引用要稳住，否则 React 无限重渲染）。
    editor.timeline.updateTracks(editor.timeline.getTracks());
    expect(editor.selection.getSelectedElements()).toBe(first);
  });
});
