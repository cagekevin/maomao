import type { EditorCore } from '@videoEditor/engine/core';

export class PlaybackManager {
  private isPlaying = false;
  private currentTime = 0;
  private volume = 1;
  private muted = false;
  private previousVolume = 1;
  private isScrubbing = false;
  private listeners = new Set<() => void>();
  private playbackTimer: number | null = null;
  private lastUpdate = 0;

  constructor(private editor: EditorCore) {}

  play(): void {
    const duration = this.editor.timeline.getTotalDuration();

    // 空时间轴没有可播放内容 → 不进入播放态（守卫，不是补丁，TD-22-22）。
    // 【原实现在此处的缺陷】它只对「已播到末尾」回卷（`duration > 0 && currentTime >= duration`），
    // `duration === 0` 时照样 `isPlaying = true` + 启动 raf：`updateTime` 的 else 分支
    // 对 0 时长没有上界 → `currentTime` 无限增长、raf 永续（空工程按空格即可复现）。
    // 播放态的含义是「正在播放内容」；没有内容就不该是播放态。
    if (duration <= 0) return;

    if (this.currentTime >= duration) {
      this.seek({ time: 0 });
    }

    this.isPlaying = true;
    this.startTimer();
    this.notify();
  }

  /**
   * 重置播放上下文（**重置，不是销毁**）：停表 + 归零 + 清拖动态。
   *
   * 由 `EditorCore.releaseProjectContext()` 在「切换 / 关闭 / 新建项目、退出编辑器」时调用。
   * 【为什么需要它】本类是 `EditorCore` 单例的一部分，`currentTime` / `isPlaying` / raf 句柄
   * 都跨项目存活：不清则切项目后时间码停在旧位置、甚至在后台继续跑旧项目的表。
   * 音量 / 静音属**用户偏好**（与项目无关），跨项目保留，故不在此清。
   */
  reset(): void {
    this.pause();
    this.currentTime = 0;
    this.isScrubbing = false;
    this.notify();
  }

  pause(): void {
    this.isPlaying = false;
    this.stopTimer();
    this.notify();
  }

  toggle(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek({ time }: { time: number }): void {
    const duration = this.editor.timeline.getTotalDuration();
    this.currentTime = Math.max(0, Math.min(duration, time));
    this.notify();

    window.dispatchEvent(
      new CustomEvent('playback-seek', {
        detail: { time: this.currentTime },
      }),
    );
  }

  setVolume({ volume }: { volume: number }): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.volume = clampedVolume;
    this.muted = clampedVolume === 0;
    if (clampedVolume > 0) {
      this.previousVolume = clampedVolume;
    }
    this.notify();
  }

  mute(): void {
    if (this.volume > 0) {
      this.previousVolume = this.volume;
    }
    this.muted = true;
    this.volume = 0;
    this.notify();
  }

  unmute(): void {
    this.muted = false;
    this.volume = this.previousVolume;
    this.notify();
  }

  toggleMute(): void {
    if (this.muted) {
      this.unmute();
    } else {
      this.mute();
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getVolume(): number {
    return this.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setScrubbing({ isScrubbing }: { isScrubbing: boolean }): void {
    this.isScrubbing = isScrubbing;
    this.notify();
  }

  getIsScrubbing(): boolean {
    return this.isScrubbing;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private startTimer(): void {
    if (this.playbackTimer) {
      cancelAnimationFrame(this.playbackTimer);
    }

    this.lastUpdate = performance.now();
    this.updateTime();
  }

  private stopTimer(): void {
    if (this.playbackTimer) {
      cancelAnimationFrame(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  private updateTime = (): void => {
    if (!this.isPlaying) return;

    const now = performance.now();
    const delta = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    const duration = this.editor.timeline.getTotalDuration();
    const newTime = this.currentTime + delta;

    // 「到末尾」与「时间轴变空」是**同一条判据**（`newTime >= duration` 就是上界）：
    // duration 为 0 时 `newTime >= 0` 恒真 → 停表并钳到 0，不会无限推进、不会续帧。
    // 【原实现在此处的缺陷（TD-22-22）】它把上界写成 `duration > 0 && newTime >= duration`，
    // 一旦 duration 归零（清空元素 / 切项目）该分支短路 → 落进 else 无限推进 + 永续 raf。
    // 不要为 0 时长再补一条 "if (duration <= 0)" 守卫 —— 那是同一判据的第二处表达；
    // 上界本身已经覆盖它（判据单点，Step 3「单一规则」）。
    if (newTime >= duration) {
      this.pause();
      this.currentTime = duration;
      this.notify();

      window.dispatchEvent(
        new CustomEvent('playback-seek', {
          detail: { time: duration },
        }),
      );
      // 已到末尾 / 已变空：`pause()` 已停表，显式 return 不再续帧
      // （原实现无条件续帧，靠下一帧开头的 `!isPlaying` 早退兜住 —— 那是隐式依赖）。
      return;
    }

    this.currentTime = newTime;
    this.notify();

    window.dispatchEvent(
      new CustomEvent('playback-update', {
        detail: { time: newTime },
      }),
    );

    this.playbackTimer = requestAnimationFrame(this.updateTime);
  };
}
