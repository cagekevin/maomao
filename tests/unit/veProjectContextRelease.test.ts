// @vitest-environment jsdom
/**
 * 回归锁：编辑器「项目上下文」的释放点（`EditorCore.releaseProjectContext`）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约：
 *   · **唯一入口**：切换 / 关闭 / 新建项目、退出编辑器、编辑器卸载，
 *     一律走 `releaseProjectContext()`；
 *   · 它必须一次性复位**全部**跨项目状态：命令栈 / 选择 / 播放 / 渲染树 / 媒体 / 场景 / 活跃项目；
 *   · 语义 = **重置**（实例可继续服务下一个项目），不是销毁；
 *   · 复位后 `undo()` 是空操作 —— 这是「切项目后 Ctrl+Z 串台」被消除的**行为证据**。
 * ════════════════════════════════════════════════════════════════
 * 【为什么锁它】这件事此前被散写成 4 处「`media.clearAllAssets()` + `scenes.clearScenes()`」
 * 两行，且每处都记不全（命令栈/选择/音频/播放无人清）——
 * 后果：B 项目 Ctrl+Z 把 A 项目的 tracks 快照写回（TD-22-45）、
 * 选择残留旧 trackId/elementId 触发误删（TD-22-46）、跨场景撤销覆盖（TD-22-32）。
 * 本用例把「清干净」变成机器可验证的契约，防它再退回「散写 + 漏记」。
 *
 * 【2026-09-17 TD-22-63】原「切场景 = 切编辑上下文」用例已随 `switchToScene` 一同删除
 * （场景层幽灵预留清理，见 scenes-manager.ts 头注释）：运行时无任何切场景入口，
 * 该用例锁的是「如果切场景必须清上下文」的条件不变式——触发条件不存在＝锁空集。
 * TD-22-32 的知识（全局命令栈无法表达跨场景撤销）已移入 scenes-manager 头注释与当日轮次日志。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorCore } from '../../src/components/videoEditor/engine/core';
import { Command } from '../../src/components/videoEditor/engine/commands/base-command.ts';
import type { TProject } from '../../src/components/videoEditor/types/project';
import type { TimelineTrack, TScene } from '../../src/components/videoEditor/types/timeline';
import type { MediaAsset } from '../../src/components/videoEditor/types/mediaAssets';

/** 记录调用次数的探针命令（不碰任何真实状态，只证明「栈里有没有它」）。 */
class SpyCommand extends Command {
  public undoCount = 0;

  execute(): void {
    /* 探针：无需副作用 */
  }

  override undo(): void {
    this.undoCount += 1;
  }
}

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

function makeScene(id: string, tracks: unknown[] = []): TScene {
  return {
    id,
    name: id,
    isMain: true,
    tracks,
    bookmarks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TScene;
}

/** 造一条含单个 video 元素的轨（让 `getTotalDuration()` 非 0，被测的是「有内容」的情形）。 */
function trackOf(id: string, duration: number): TimelineTrack {
  return {
    id,
    type: 'video',
    isMain: true,
    muted: false,
    hidden: false,
    elements: [
      {
        id: `${id}-e1`,
        type: 'video',
        mediaId: 'm1',
        name: 'e1',
        startTime: 0,
        duration,
        trimStart: 0,
        playbackRate: 1,
        volume: 1,
      },
    ],
  } as unknown as TimelineTrack;
}

function makeAsset(id: string): MediaAsset {
  return { id, name: id, type: 'video', url: `blob:${id}` } as unknown as MediaAsset;
}

describe('EditorCore.releaseProjectContext', () => {
  let editor: EditorCore;

  beforeEach(() => {
    // 单例工厂：先丢弃上一个实例，保证每个用例拿到干净 Core。
    EditorCore.reset();
    editor = EditorCore.getInstance();
    // 装一个「有活跃项目 + 有活跃场景」的最小可用上下文（多数 API 都要求它存在）。
    editor.project.setActiveProject({ project: makeProject('p1') });
    editor.scenes.setScenes({ scenes: [makeScene('s1')], activeSceneId: 's1' });
  });

  afterEach(() => {
    // 单例无销毁出口；测试自己摘掉 AudioManager 挂的 window 监听，防跨用例累积。
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('一次性复位全部跨项目状态（命令栈/选择/播放/渲染树/媒体/场景/活跃项目）', () => {
    // 需要一个「有内容」的时间轴才能观察到播放位置被复位（空时间轴下 seek 会被 clamp 到 0）。
    editor.scenes.setScenes({ scenes: [makeScene('s1', [trackOf('t1', 5)])], activeSceneId: 's1' });

    const command = new SpyCommand();
    editor.command.execute({ command });
    // 选择必须指向**存在的**元素：`trackOf('t1', …)` 生成的元素 id 是 `t1-e1`。
    // （本 fixture 原写 `e1` 这个不存在的 id —— 选择有效性不变量落地后当场被揪出。）
    editor.selection.setSelectedElements({ elements: [{ trackId: 't1', elementId: 't1-e1' }] });
    editor.playback.seek({ time: 5 });
    editor.media.setAssets({ assets: [makeAsset('m1')] });

    expect(editor.command.canUndo()).toBe(true);
    expect(editor.selection.getSelectedElements()).toHaveLength(1);
    expect(editor.playback.getCurrentTime()).toBe(5);
    expect(editor.media.getAssets()).toHaveLength(1);
    expect(editor.scenes.getScenes()).toHaveLength(1);

    editor.releaseProjectContext();

    expect(editor.command.canUndo()).toBe(false);
    expect(editor.command.canRedo()).toBe(false);
    expect(editor.selection.getSelectedElements()).toEqual([]);
    expect(editor.playback.getCurrentTime()).toBe(0);
    expect(editor.playback.getIsPlaying()).toBe(false);
    expect(editor.renderer.getRenderTree()).toBeNull();
    expect(editor.media.getAssets()).toEqual([]);
    expect(editor.scenes.getScenes()).toEqual([]);
    expect(editor.project.getActiveOrNull()).toBeNull();
  });

  it('复位后 undo 是空操作 —— 跨项目串台的行为证据（TD-22-45）', () => {
    const command = new SpyCommand();
    editor.command.execute({ command });

    editor.releaseProjectContext();
    editor.command.undo();

    expect(command.undoCount).toBe(0);
  });

  it('是「重置」不是「销毁」：复位后实例仍可服务下一个项目', () => {
    editor.releaseProjectContext();

    editor.project.setActiveProject({ project: makeProject('p2') });
    editor.scenes.setScenes({ scenes: [makeScene('s2')], activeSceneId: 's2' });

    expect(editor.project.getActiveOrNull()?.metadata.id).toBe('p2');
    expect(editor.scenes.getActiveScene().id).toBe('s2');
    // 命令栈仍可正常累积（订阅/实例未被破坏）。
    editor.command.execute({ command: new SpyCommand() });
    expect(editor.command.canUndo()).toBe(true);
  });
});

describe('空时间轴的播放守卫（TD-22-22）', () => {
  let editor: EditorCore;

  beforeEach(() => {
    EditorCore.reset();
    editor = EditorCore.getInstance();
    editor.project.setActiveProject({ project: makeProject('p1') });
    editor.scenes.setScenes({ scenes: [makeScene('s1')], activeSceneId: 's1' });
  });

  afterEach(() => {
    editor.audio.dispose();
    EditorCore.reset();
  });

  it('时长 0 时 play() 直接在入口返回 —— 不产生任何播放态通知', () => {
    expect(editor.timeline.getTotalDuration()).toBe(0);
    const onPlaybackChange = vi.fn();
    const unsubscribe = editor.playback.subscribe(onPlaybackChange);

    editor.playback.play();

    // 入口守卫（play 内）与 tick 守卫（updateTime 内）针对**不同时序**，
    // 在「本来就空」这一场景下两者结果相同 —— 故断言必须落在入口守卫独有的后果上：
    // 旧实现会先置 `isPlaying = true` 并 notify，再被 tick 兜回 → 播放图标闪一下 +
    // 一次无意义的 seek。新实现连通知都不发。
    expect(onPlaybackChange).not.toHaveBeenCalled();
    expect(editor.playback.getIsPlaying()).toBe(false);
    expect(editor.playback.getCurrentTime()).toBe(0);
    unsubscribe();
  });

  it('播放途中时间轴变空（清空元素 / 切项目）→ 停表归零，不无限推进', async () => {
    editor.scenes.setScenes({ scenes: [makeScene('s1', [trackOf('t1', 5)])], activeSceneId: 's1' });
    editor.playback.play();
    expect(editor.playback.getIsPlaying()).toBe(true);

    // 时间轴被清空 = 切项目 / 删光元素后的等效状态（rAF 由 setup 垫片实现为 setTimeout(0)）。
    editor.scenes.setScenes({ scenes: [makeScene('s1')], activeSceneId: 's1' });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(editor.playback.getIsPlaying()).toBe(false);
    expect(editor.playback.getCurrentTime()).toBe(0);
  });
});
