import { beforeEach, describe, expect, it, vi } from 'vitest';
import { videoTrackOf, videoElementOf } from '../helpers/fixtures';
import { at } from '../helpers/at';
import type {
  TimelineTrack,
  TimelineElement,
} from '../../src/components/videoEditor/types/timeline';
import { ToggleTrackMuteCommand } from '../../src/components/videoEditor/engine/commands/timeline/track/toggle-track-mute.ts';
import { ToggleTrackVisibilityCommand } from '../../src/components/videoEditor/engine/commands/timeline/track/toggle-track-visibility.ts';
import { ToggleElementsVisibilityCommand } from '../../src/components/videoEditor/engine/commands/timeline/element/toggle-elements-visibility.ts';
import { DuplicateElementsCommand } from '../../src/components/videoEditor/engine/commands/timeline/element/duplicate-elements.ts';
import { DeleteElementsCommand } from '../../src/components/videoEditor/engine/commands/timeline/element/delete-elements.ts';
import { CommandManager } from '../../src/components/videoEditor/engine/core/managers/commands.ts';
import { getTrackControls } from '../../src/components/videoEditor/engine/timeline/track-utils.ts';

/**
 * 守卫：单个开关的**执行侧**在"该对象不支持这个开关"时**必须什么都不做**。
 *
 * ════════════════════════════════════════════════════════════════
 * 母体：一个开关的可用性判据有**两个 UI 入口**（轨道头图标 / 右键菜单项）+ 一个**执行侧兜底**
 * （命令）。三处都要判，而任一处漏了的表现各不相同：
 *
 *   · **UI 漏**（菜单项没守卫）⇒ 用户看到一个点了没反应的"坏按钮"：
 *     文本 / 贴纸轨的右键里有"静音轨道"、音频轨的右键里有"隐藏轨道"。
 *   · **执行侧漏**（命令不提前 return）⇒ 空转一次 `updateTracks`：notify 一次，
 *     还往历史栈压一条**空记录**（用户按撤销时"什么都没变"）。
 *   · **执行侧漏过滤**（元素级）⇒ 给音频元素**写上 `hidden: true` 脏数据**
 *     （类型上它没有这个字段），而输出投影 `getOutputTracks` 会据此把它滤掉
 *     ⇒ **音频被动不发声**（隐藏 ≠ 静音，语义混乱）。
 * ════════════════════════════════════════════════════════════════
 *
 * 断言口径统一为「**`updateTracks` 有没有被调用**」：没被调用 = 既没 notify 也没入栈，
 * 也就是"什么都没发生"——这正是"不支持"应有的行为。
 */

const h = vi.hoisted(() => ({
  tracks: [] as unknown[],
  updateTracks: vi.fn(),
}));

vi.mock('@/components/videoEditor/engine/core/editorInstance', () => ({
  getEditor: () => ({
    timeline: {
      getTracks: () => h.tracks,
      updateTracks: h.updateTracks,
    },
    selection: {
      getSelectedElements: () => [],
      setSelectedElements: () => undefined,
    },
    // 删除命令在「删掉的元素带 mediaId」时会问 project 拿 id 做 ephemeral 清理；
    // 旧写法（整轨/整元素一次性双重断言）把这条依赖藏住了，补上真实桩。
    project: {
      getActiveOrNull: () => null,
    },
  }),
}));

function element(fields: Record<string, unknown>): TimelineElement {
  return videoElementOf({
    id: 'el',
    mediaId: 'media-1',
    name: 'el',
    startTime: 0,
    duration: 1,
    trimStart: 0,
    opacity: 1,
    muted: false,
    transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
    ...fields,
  });
}

function track(fields: Record<string, unknown>): TimelineTrack {
  return videoTrackOf({
    id: 't',
    muted: false,
    hidden: false,
    elements: [],
    ...fields,
  });
}

beforeEach(() => {
  h.tracks = [];
  h.updateTracks.mockClear();
});

describe('轨级开关：不支持该开关的轨 ⇒ 命令什么都不做', () => {
  it('文本轨不可静音 ⇒ 不调用 `updateTracks`（不空转、不压空历史）', () => {
    h.tracks = [track({ id: 't-text', type: 'text', elements: [] })];

    new ToggleTrackMuteCommand('t-text').execute();

    expect(h.updateTracks).not.toHaveBeenCalled();
  });

  it('视频轨可静音 ⇒ 真的取反（前提断言：证明上面那条不是"永远不调用"）', () => {
    h.tracks = [track({ id: 't-video', type: 'video', isMain: false, muted: false })];

    new ToggleTrackMuteCommand('t-video').execute();

    expect(h.updateTracks).toHaveBeenCalledTimes(1);
    const next = at(h.updateTracks.mock.calls, 0)[0] as TimelineTrack[];
    expect((next[0] as { muted: boolean }).muted).toBe(true);
  });

  it('音频轨不可隐藏（「只关声音」走 `muted`）⇒ 不调用 `updateTracks`', () => {
    h.tracks = [track({ id: 't-audio', type: 'audio' })];

    new ToggleTrackVisibilityCommand('t-audio').execute();

    expect(h.updateTracks).not.toHaveBeenCalled();
  });

  it('视频轨可隐藏 ⇒ 真的取反', () => {
    h.tracks = [track({ id: 't-video', type: 'video', isMain: false, hidden: false })];

    new ToggleTrackVisibilityCommand('t-video').execute();

    expect(h.updateTracks).toHaveBeenCalledTimes(1);
    const next = at(h.updateTracks.mock.calls, 0)[0] as TimelineTrack[];
    expect((next[0] as { hidden: boolean }).hidden).toBe(true);
  });
});

describe('元素级隐藏：只改**可隐藏**的元素（音频元素不写 `hidden` 脏数据）', () => {
  it('选中的是音频元素 ⇒ 什么都不做（曾给它写上 `hidden: true` ⇒ 被动不发声）', () => {
    h.tracks = [track({ id: 't-audio', type: 'audio', elements: [element({ type: 'audio' })] })];

    new ToggleElementsVisibilityCommand([{ trackId: 't-audio', elementId: 'el' }]).execute();

    expect(h.updateTracks).not.toHaveBeenCalled();
  });

  it('混选（视频 + 音频）⇒ 只改视频元素', () => {
    h.tracks = [
      track({
        id: 't-video',
        type: 'video',
        isMain: false,
        elements: [element({ id: 'el-video', type: 'video' })],
      }),
      track({
        id: 't-audio',
        type: 'audio',
        elements: [element({ id: 'el-audio', type: 'audio' })],
      }),
    ];

    new ToggleElementsVisibilityCommand([
      { trackId: 't-video', elementId: 'el-video' },
      { trackId: 't-audio', elementId: 'el-audio' },
    ]).execute();

    expect(h.updateTracks).toHaveBeenCalledTimes(1);
    const next = at(h.updateTracks.mock.calls, 0)[0] as TimelineTrack[];
    const videoElement = at(at(next, 0).elements as Array<{ hidden?: boolean }>, 0);
    const audioElement = at(at(next, 1).elements as Array<{ hidden?: boolean }>, 0);
    expect(videoElement.hidden).toBe(true);
    // 音频元素**不得**被写入 `hidden`（类型上它没有这个字段）
    expect(audioElement.hidden).toBeUndefined();
  });
});

describe('轨道可控项的**唯一声明**（图标区与右键菜单同源渲染）', () => {
  it('文本 / 贴纸轨有「隐藏」没有「静音」；音频轨反过来（「删除」非主轨都有）', () => {
    expect(getTrackControls(track({ type: 'text' })).map((c) => c.key)).toEqual([
      'visibility',
      'remove',
    ]);
    expect(getTrackControls(track({ type: 'sticker' })).map((c) => c.key)).toEqual([
      'visibility',
      'remove',
    ]);
    expect(getTrackControls(track({ type: 'audio' })).map((c) => c.key)).toEqual([
      'mute',
      'remove',
    ]);
  });

  it('视频**主轨**可静音可隐藏，但不可删除（垫底基础层）', () => {
    expect(getTrackControls(track({ type: 'video', isMain: true })).map((c) => c.key)).toEqual([
      'mute',
      'visibility',
    ]);
  });

  it('视频非主轨三项齐全，`isOff` 反映当前开关态', () => {
    expect(
      getTrackControls(track({ type: 'video', isMain: false, muted: true, hidden: true })),
    ).toEqual([
      { key: 'mute', isOff: true },
      { key: 'visibility', isOff: true },
      { key: 'remove', isOff: false },
    ]);
  });
});

describe('空转的命令不进撤销历史（由管理器裁决，不靠调用方自觉）', () => {
  it('无选中时「复制元素」⇒ 不产生历史条目（曾留下一条"按撤销什么都没变"的空记录）', () => {
    const manager = new CommandManager();

    manager.execute({ command: new DuplicateElementsCommand({ elements: [] }) });

    expect(manager.canUndo()).toBe(false);
  });

  it('给文本轨点「静音轨道」⇒ 不产生历史条目', () => {
    h.tracks = [track({ id: 't-text', type: 'text', elements: [] })];
    const manager = new CommandManager();

    manager.execute({ command: new ToggleTrackMuteCommand('t-text') });

    expect(manager.canUndo()).toBe(false);
  });

  it('**反向断言**：真的改了状态的命令必须进历史（证明上面两条不是"永远不入栈"）', () => {
    h.tracks = [track({ id: 't-video', type: 'video', isMain: false, muted: false })];
    const manager = new CommandManager();

    manager.execute({ command: new ToggleTrackMuteCommand('t-video') });

    expect(manager.canUndo()).toBe(true);
  });

  it('批次里**全部**空转 ⇒ 整批不入栈（部分空转 ⇒ 仍入栈）', () => {
    const manager = new CommandManager();

    manager.executeBatch({
      commands: [new DeleteElementsCommand([]), new DeleteElementsCommand([])],
    });
    expect(manager.canUndo()).toBe(false);

    h.tracks = [
      track({
        id: 't-video',
        type: 'video',
        isMain: false,
        elements: [element({ type: 'video' })],
      }),
    ];
    manager.executeBatch({
      commands: [
        new DeleteElementsCommand([]),
        new DeleteElementsCommand([{ trackId: 't-video', elementId: 'el' }]),
      ],
    });
    expect(manager.canUndo()).toBe(true);
  });
});
