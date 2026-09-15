// @vitest-environment jsdom
/**
 * 回归锁：音效试听的**资源生命周期**（TD-22-42）。
 *
 * ════════════════════════════════════════════════════════════════
 * 契约：`useSoundPreview` 是「试听播放」的**唯一拥有者** —— 创建 / 替换 / 停止 /
 *   **卸载释放** 四件事都在它一个生命周期里闭环。
 *
 * 【为什么锁它】`sounds.tsx` 原先在 `SoundEffectsView` 与 `SavedSoundsView` 里各抄了一份
 * 逐字相同的 `playSound`，**两份都漏了卸载清理**：
 *   · 切 Tab / 关素材面板 / 退出编辑器时试听音**继续播到自然结束**；
 *   · `audioElement` 随组件销毁、引用丢失 → 用户**永远停不掉**。
 * 抄两份不是巧合 —— 「谁拥有这个 audio」当时没有落点，于是每处各建一个、各忘一次。
 * ════════════════════════════════════════════════════════════════
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useSoundPreview } from '../../src/components/videoEditor/hooks-cutia/use-sound-preview';

/** 最小 `Audio` 替身：只实现本 hook 用到的成员，并记录暂停。 */
class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  paused = true;
  private listeners = new Map<string, Array<() => void>>();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, cb: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }

  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  emit(type: string): void {
    for (const cb of this.listeners.get(type) ?? []) cb();
  }
}

describe('音效试听的生命周期（TD-22-42）', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('卸载时暂停正在试听的音频 —— 引用不丢失，用户不再被「停不掉的音乐」困住', () => {
    const { result, unmount } = renderHook(() => useSoundPreview());

    act(() => {
      result.current.toggle({ sound: { id: 1, previewUrl: 'blob:s1' } });
    });

    const audio = FakeAudio.instances[0];
    expect(audio).toBeDefined();
    expect(audio.paused).toBe(false);
    expect(result.current.playingId).toBe(1);

    unmount(); // 切 Tab / 关素材面板 / 退出编辑器 = 卸载

    // 旧实现（sounds.tsx 两份手抄版）此处什么都不做：音频继续播到自然结束，
    // 而 audio 引用随组件销毁 → 用户再也停不掉它。
    expect(audio.paused).toBe(true);
  });

  it('点同一条 = 停止；点另一条 = 换歌（旧的那条必须被停掉）', () => {
    const { result } = renderHook(() => useSoundPreview());

    act(() => result.current.toggle({ sound: { id: 1, previewUrl: 'blob:s1' } }));
    act(() => result.current.toggle({ sound: { id: 2, previewUrl: 'blob:s2' } }));

    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[0].paused).toBe(true);
    expect(FakeAudio.instances[1].paused).toBe(false);
    expect(result.current.playingId).toBe(2);

    act(() => result.current.toggle({ sound: { id: 2, previewUrl: 'blob:s2' } }));

    expect(FakeAudio.instances[1].paused).toBe(true);
    expect(result.current.playingId).toBeNull();
  });

  it('旧音频迟到的 ended 不得清掉新歌的播放态（按 id 判等）', () => {
    const { result } = renderHook(() => useSoundPreview());

    act(() => result.current.toggle({ sound: { id: 1, previewUrl: 'blob:s1' } }));
    act(() => result.current.toggle({ sound: { id: 2, previewUrl: 'blob:s2' } }));

    // 快速切歌的时序窗口：上一条音频的回调迟到触发。
    act(() => FakeAudio.instances[0].emit('ended'));

    // 旧实现是无条件 `setPlayingId(null)` → 会把正在播的新歌状态清掉。
    expect(result.current.playingId).toBe(2);
  });
});
