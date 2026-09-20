// @vitest-environment jsdom
/**
 * 回归锁：片段「源窗口」语义（TD-22-21 删除 `trimEnd` 字段）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约一：**源素材总长的真源是 media asset 的 `duration`**，不是 element 上的副本。
 *   原实现把「右侧还剩多少」存在 `element.trimEnd` 里，拖拽边界靠
 *   `trimStart + duration × rate + trimEnd` **反推**素材总长 —— 副本一漂移（split 就漂过），
 *   右侧边界就算错。现由 `getElementSourceDuration` 直取 media。
 *
 * 契约二：**片段形态由「trimStart + duration」唯一确定**。
 *   顺带修掉一个真功能缺陷：原 `updateElementTrim` 只提交 `trimStart`/`trimEnd`
 *   而**从不提交 `duration`** → 「拖右边缘改时长」松手后不落库（UI 预览弹回）。
 * ════════════════════════════════════════════════════════════════
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorCore } from '../../src/components/videoEditor/engine/core';
import { getElementSourceDuration } from '../../src/components/videoEditor/engine/timeline/element-utils';
import type { MediaAsset } from '../../src/components/videoEditor/types/mediaAssets';
import type { TProject } from '../../src/components/videoEditor/types/project';
import type { TScene, TimelineElement } from '../../src/components/videoEditor/types/timeline';

function media(id: string, duration?: number): MediaAsset {
  return { id, name: id, type: 'video', duration } as unknown as MediaAsset;
}

function element(overrides: Record<string, unknown>): TimelineElement {
  return {
    id: 'e1',
    type: 'video',
    mediaId: 'm1',
    name: 'e1',
    startTime: 0,
    duration: 3,
    trimStart: 0,
    playbackRate: 1,
    ...overrides,
  } as unknown as TimelineElement;
}

describe('getElementSourceDuration —— 拖拽边界问真源，不靠副本反推（TD-22-21）', () => {
  it('视频：返回 media asset 的真实时长', () => {
    expect(getElementSourceDuration({ element: element({}), mediaAssets: [media('m1', 10)] })).toBe(
      10,
    );
  });

  it('素材缺失（断链）：退回「已用源长度」—— 保守边界，不允许再裁出源范围', () => {
    // 已用源长度 = trimStart 1 + duration 3 × rate 1 = 4
    expect(
      getElementSourceDuration({
        element: element({ trimStart: 1 }),
        mediaAssets: [],
      }),
    ).toBe(4);
  });

  it('变速元素：已用源长度按 playbackRate 折算（rate=2 → 1 + 3×2 = 7）', () => {
    expect(
      getElementSourceDuration({
        element: element({ trimStart: 1, playbackRate: 2 }),
        mediaAssets: [],
      }),
    ).toBe(7);
  });

  it('文本/贴纸：无源素材概念 → 退回已用长度（duration 5）', () => {
    const text = element({ type: 'text', duration: 5, mediaId: undefined });
    expect(getElementSourceDuration({ element: text, mediaAssets: [media('m1', 10)] })).toBe(5);
  });

  it('media 存在但 duration 未填（图片等）→ 退回已用长度', () => {
    expect(getElementSourceDuration({ element: element({}), mediaAssets: [media('m1')] })).toBe(3);
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

function makeScene(): TScene {
  return {
    id: 's1',
    name: 's1',
    isMain: true,
    tracks: [
      {
        id: 't1',
        type: 'video',
        isMain: true,
        muted: false,
        hidden: false,
        elements: [element({})],
      },
    ],
    bookmarks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TScene;
}

describe('updateElementTrim 提交 duration —— 拖右边缘改时长能落库（TD-22-21 顺带修复）', () => {
  let editor: EditorCore;

  beforeEach(() => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    editor.save.pause();
    editor.project.setActiveProject({ project: makeProject('p1') });
    editor.scenes.setScenes({ scenes: [makeScene()], activeSceneId: 's1' });
  });

  afterEach(() => {
    editor.save.stop();
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('提交的 duration 真实生效（原实现从不提交 duration → 拖曳结果会被丢弃）', () => {
    editor.timeline.updateElementTrim({ elementId: 'e1', trimStart: 0.5, duration: 2.5 });

    const el = editor.timeline.getTracks()[0].elements[0];
    expect(el.duration).toBe(2.5);
    expect(el.trimStart).toBe(0.5);
    // 关键：element 上**不再有** trimEnd 字段（旧存档里的该字段被忽略，无人读）。
    expect('trimEnd' in el).toBe(false);
  });

  it('撤销后回到原形态', () => {
    editor.timeline.updateElementTrim({ elementId: 'e1', trimStart: 0.5, duration: 2.5 });
    editor.command.undo();

    const el = editor.timeline.getTracks()[0].elements[0];
    expect(el.duration).toBe(3);
    expect(el.trimStart).toBe(0);
  });
});
