import { describe, it, expect, beforeEach } from 'vitest';
import type { EditorCore } from '../../src/components/videoEditor/engine/core';
import { PlaybackManager } from '../../src/components/videoEditor/engine/core/managers/playback-manager.ts';
import { subscribe, clearEvent } from '../../src/components/base/core/eventBus.ts';

/**
 * TD-22-23：播放头跳转的信号通道。
 *
 * 【锁什么】
 *   1. 「跳转」是**离散事件** → 经 eventBus 唯一通道广播 `videoEditor:seek`（发布/订阅成对由 check:events 校验）；
 *   2. 载荷是**钳位后**的真实播放位置（超界入参广播的是钳位值，订阅方拿到的一定是可用时间）；
 *   3. 状态通道（`subscribe()`）不被事件通道取代 —— 两者语义不同，都必须工作。
 *
 * 【为什么原来测不了】原实现走 `window.dispatchEvent`：本文件是 node 环境（vitest 默认）无 `window`
 *   ⇒ 一旦代码回退到旧实现，本文件**直接抛错变红**（探针的天然断言点）。
 */

const SEEK_EVENT = 'videoeditor:seek';

/** 最小 editor 替身：PlaybackManager 只经 `timeline.getTotalDuration()` 取真相，其余不触达。 */
function makeEditor(duration: number): EditorCore {
  return { timeline: { getTotalDuration: () => duration } } as unknown as EditorCore;
}

/** 收集 seek 广播的载荷。 */
function collectSeekTimes() {
  const times: number[] = [];
  const off = subscribe(SEEK_EVENT, (payload) => {
    const time = (payload as { time?: unknown } | null)?.time;
    if (typeof time === 'number') times.push(time);
  });
  return { times, off };
}

beforeEach(() => {
  // eventBus 是模块级单例 Map：不清会跨用例串味（订阅残留 → 计数虚高）。
  clearEvent(SEEK_EVENT);
});

describe('PlaybackManager · 播放头跳转信号（TD-22-23）', () => {
  it('seek() 经 eventBus 广播 videoEditor:seek，载荷是钳位后的时间', () => {
    const playback = new PlaybackManager(makeEditor(10));
    const { times, off } = collectSeekTimes();

    playback.seek({ time: 5 });
    playback.seek({ time: 999 }); // 超总时长 → 广播钳位后的 10，而不是入参 999
    playback.seek({ time: -3 }); // 负值 → 广播钳位后的 0

    off();
    expect(times).toEqual([5, 10, 0]);
  });

  it('退订后不再收到（订阅生命周期可控，不留悬挂回调）', () => {
    const playback = new PlaybackManager(makeEditor(10));
    const { times, off } = collectSeekTimes();
    off();

    playback.seek({ time: 3 });

    expect(times).toEqual([]);
  });

  it('状态通道与事件通道并存：seek 同时触发两者，互不替代', () => {
    const playback = new PlaybackManager(makeEditor(10));
    let stateNotified = 0;
    const offState = playback.subscribe(() => {
      stateNotified++;
    });
    const { times, off } = collectSeekTimes();

    playback.seek({ time: 4 });

    offState();
    off();
    expect(stateNotified).toBe(1);
    expect(times).toEqual([4]);
  });

  it('播放头回到 0 也是跳转信号（不是"只在非零位置才通知"）', () => {
    const playback = new PlaybackManager(makeEditor(10));
    const { times, off } = collectSeekTimes();

    playback.seek({ time: 7 });
    playback.seek({ time: 0 });

    off();
    expect(times).toEqual([7, 0]);
  });
});
