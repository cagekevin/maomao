import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import { subscribe } from '@/components/base/core/event/eventBus';
import { VIDEOEDITOR_SEEK_EVENT } from '@/components/base/core/contracts';
import { releaseQuietly } from '@/components/base/utils/net/asyncGuard';
import type { EditorCore } from '@/components/videoEditor/engine/core';
import type { AudioSourceSpec } from '@/components/videoEditor/engine/lib/media/audio';
import {
  createAudioContext,
  collectAudioSources,
  resolveAudioSourceBuffer,
  reverseAudioBuffer,
} from '@/components/videoEditor/engine/lib/media/audio';
import { getVisualSourceTime } from '@/components/videoEditor/engine/timeline/element-utils';

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private playbackStartTime = 0;
  private playbackStartContextTime = 0;
  private clips: AudioSourceSpec[] = [];
  private decodedBuffers = new Map<string, AudioBuffer>();
  private queuedSources = new Set<AudioBufferSourceNode>();
  private playbackSessionId = 0;
  private lastIsPlaying = false;
  private lastVolume = 1;
  private unsubscribers: Array<() => void> = [];
  private timelineChangeTimer: number | null = null;

  constructor(private editor: EditorCore) {
    this.lastVolume = this.editor.playback.getVolume();

    this.unsubscribers.push(
      this.editor.playback.subscribe(this.handlePlaybackChange),
      this.editor.timeline.subscribe(this.handleTimelineChange),
      this.editor.media.subscribe(this.handleTimelineChange),
      // 播放头跳转 → 按新位置重排音频。走 eventBus 唯一通道（`EVENTS['videoeditor:seek']`，TD-22-23）：
      // 原实现是 `window.addEventListener('playback-seek')`，属 eventBus 红线禁止的"第二套广播"。
      subscribe(VIDEOEDITOR_SEEK_EVENT, this.handleSeek),
    );
  }

  /**
   * 重置音频上下文（**重置，不是销毁**）：停掉在途调度 + 清解码缓存与片段表。
   * 实例继续服务下一个项目 —— 订阅（含 eventBus 的 seek 通道）、`AudioContext` 一律保留。
   *
   * 由 `EditorCore.releaseProjectContext()` 在「切换 / 关闭 / 新建项目、退出编辑器」时调用。
   * 不清的后果：切项目后旧项目的 `AudioBuffer` 与 `queuedSources` 仍在，
   * 旧片段继续被调度（与 TD-22-42「切 Tab 不暂停试听」同源，维度是切项目）。
   *
   * 【sessionId++ 的必要性】`startPlayback` / `scheduleAllClips` 是 async，
   * 重置瞬间可能有在途 await；递增会让它醒来后 fail-fast
   * （`sessionId !== this.playbackSessionId`），防止旧项目的 clips 写回新上下文。
   */
  reset(): void {
    this.playbackSessionId++;
    this.stopPlayback();
    this.clips = [];
    this.decodedBuffers.clear();
    if (this.timelineChangeTimer !== null) {
      window.clearTimeout(this.timelineChangeTimer);
      this.timelineChangeTimer = null;
    }
  }

  /**
   * 销毁音频上下文（**终止实例**，不可复用）：重置 + 解订阅 + 关 `AudioContext`。
   *
   * 【为什么不与 reset 合并】两者语义不同：项目切换要的是「可继续服务的重置」，
   * 关掉 `AudioContext` 后再播放会重建（多一次设备握手），切项目不该付这个代价。
   * 当前 `EditorCore` 是**长驻单例**（永不销毁实例），故暂无调用者；
   * 保留它是为了「实例终结」这条路径有唯一正确的出口，而不是让后人各写一份。
   */
  dispose(): void {
    this.reset();
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
      this.masterGain = null;
    }
  }

  private handlePlaybackChange = (): void => {
    const isPlaying = this.editor.playback.getIsPlaying();
    const volume = this.editor.playback.getVolume();

    if (volume !== this.lastVolume) {
      this.lastVolume = volume;
      this.updateGain();
    }

    if (isPlaying !== this.lastIsPlaying) {
      this.lastIsPlaying = isPlaying;
      if (isPlaying) {
        void this.startPlayback({
          time: this.editor.playback.getCurrentTime(),
        });
      } else {
        this.stopPlayback();
      }
    }
  };

  private handleSeek = (payload: unknown): void => {
    const time = (payload as { time?: unknown } | null)?.time;
    if (typeof time !== 'number') return;

    if (this.editor.playback.getIsScrubbing()) {
      this.stopPlayback();
      return;
    }

    if (this.editor.playback.getIsPlaying()) {
      void this.startPlayback({ time });
      return;
    }

    this.stopPlayback();
  };

  private handleTimelineChange = (): void => {
    if (this.timelineChangeTimer !== null) {
      window.clearTimeout(this.timelineChangeTimer);
    }

    this.timelineChangeTimer = window.setTimeout(() => {
      this.timelineChangeTimer = null;
      this.decodedBuffers.clear();

      if (!this.editor.playback.getIsPlaying()) return;

      void this.startPlayback({
        time: this.editor.playback.getCurrentTime(),
      });
    }, 300);
  };

  private ensureAudioContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;
    if (typeof window === 'undefined') return null;

    this.audioContext = createAudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.lastVolume;
    this.masterGain.connect(this.audioContext.destination);
    return this.audioContext;
  }

  private updateGain(): void {
    if (!this.masterGain) return;
    this.masterGain.gain.value = this.lastVolume;
  }

  private async startPlayback({ time }: { time: number }): Promise<void> {
    const audioContext = this.ensureAudioContext();
    if (!audioContext) return;

    this.stopPlayback();
    this.playbackSessionId++;
    const sessionId = this.playbackSessionId;

    const tracks = this.editor.timeline.getTracks();
    const mediaAssets = this.editor.media.getAssets();
    const duration = this.editor.timeline.getTotalDuration();

    if (duration <= 0) return;

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // 判据来自与导出**同一份**采集原语（`collectAudioSources`）—— 预览与成片"该出哪几段声音"不再各判一遍。
    const { items, skipped } = collectAudioSources({ tracks, mediaAssets });
    if (skipped.length > 0) {
      videoEditorLogger.warn('时间轴音频：部分元素解析失败（该段音频将缺失）', { skipped });
    }
    this.clips = items;
    if (!this.editor.playback.getIsPlaying()) return;
    if (sessionId !== this.playbackSessionId) return;

    this.playbackStartTime = time;
    this.playbackStartContextTime = audioContext.currentTime;

    await this.scheduleAllClips({ time, sessionId });
  }

  private async scheduleAllClips({
    time,
    sessionId,
  }: {
    time: number;
    sessionId: number;
  }): Promise<void> {
    const audioContext = this.audioContext;
    if (!audioContext) return;

    for (const spec of this.clips) {
      if (spec.muted) continue;

      const clipEnd = spec.startTime + spec.duration;
      if (clipEnd <= time) continue;
      if (sessionId !== this.playbackSessionId) return;

      try {
        const buffer = await this.getDecodedBuffer({ spec });
        if (!buffer) continue;
        if (sessionId !== this.playbackSessionId) return;
        if (!this.editor.playback.getIsPlaying()) return;

        this.scheduleClipNode({ spec, buffer, time });
      } catch (error) {
        videoEditorLogger.warn('Failed to schedule audio clip:', spec.elementId, error);
      }
    }
  }

  private scheduleClipNode({
    spec,
    buffer,
    time,
  }: {
    spec: AudioSourceSpec;
    buffer: AudioBuffer;
    time: number;
  }): void {
    const audioContext = this.audioContext;
    if (!audioContext || !this.masterGain) return;

    const rate = spec.playbackRate;
    const elapsed = Math.max(0, time - spec.startTime);
    // 【声画同源（TD-22-14 母体）】"现在该播源素材的哪一刻"**只允许有一个式子**：
    //   画面取帧走 `getVisualSourceTime`（`VisualNode.getLocalTime`，带 reversed），
    //   音频调度前先是**手写**同一式子（`trimStart + elapsed × rate`）—— 改一处忘另一处
    //   即变速下静默失步（画面 2×、声音 1×）。现改为直接调那个原语。
    //
    // 【reversed 的起点换算（TD-22-29 档 2）】喂进来的 buffer 已是**倒序副本** R
    //   （`R[i] = S[D−i]`，D = 源总时长），故"源时间 p"对应 R 上的 `D − p`。
    //   把 reversed 的源位置 `p = trimStart + rate × (duration − elapsed)` 代入：
    //       D − p = (D − trimStart − rate × duration) + rate × elapsed
    //   —— 正是「以 `trimStart' = D − trimStart − rate × duration` 走**正序**算式」。
    //   所以这里只换算起点、仍走正序分支：**调度域（怎么播）与求值域（该播哪一刻）各守一处**，
    //   不必让 `getVisualSourceTime` 去理解"buffer 已被倒过来"。
    const trimStart = spec.reversed
      ? buffer.duration - spec.trimStart - rate * spec.duration
      : spec.trimStart;
    const sourceOffset = getVisualSourceTime({
      timelineTime: Math.max(spec.startTime, time),
      startTime: spec.startTime,
      duration: spec.duration,
      trimStart,
      playbackRate: rate,
    });
    const remainingDuration = spec.duration - elapsed;

    if (remainingDuration <= 0) return;

    const timelineStart = Math.max(spec.startTime, time);
    const scheduleTime = this.playbackStartContextTime + (timelineStart - this.playbackStartTime);

    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = rate;

    const clipGain = audioContext.createGain();
    clipGain.gain.value = spec.volume;
    node.connect(clipGain);
    clipGain.connect(this.masterGain);

    if (scheduleTime >= audioContext.currentTime) {
      node.start(scheduleTime, sourceOffset, remainingDuration);
    } else {
      const late = audioContext.currentTime - scheduleTime;
      const adjustedOffset = sourceOffset + late * rate;
      const adjustedDuration = remainingDuration - late;
      if (adjustedDuration > 0) {
        node.start(audioContext.currentTime, adjustedOffset, adjustedDuration);
      } else {
        return;
      }
    }

    this.queuedSources.add(node);
    node.addEventListener('ended', () => {
      node.disconnect();
      this.queuedSources.delete(node);
    });
  }

  private async getDecodedBuffer({ spec }: { spec: AudioSourceSpec }): Promise<AudioBuffer | null> {
    // 倒放片段取的是**倒序副本** ⇒ 缓存键必须带上 `reversed` 维度，
    // 否则同一素材的正序元素与反转元素会互相串用（TD-22-29 档 2）。
    const cacheKey = spec.reversed ? `${spec.sourceKey}#reversed` : spec.sourceKey;
    const cached = this.decodedBuffers.get(cacheKey);
    if (cached) return cached;

    const audioContext = this.audioContext;
    if (!audioContext) return null;

    // 取字节 + 解码走**与导出同一份**原语（`resolveAudioSourceBuffer`）—— 三条字节来源
    // （文件 / 库 URL / 已解码 buffer）的分派不再各写一遍。
    const resolved = await resolveAudioSourceBuffer({ source: spec.source, audioContext });
    if (!resolved.ok) {
      // 【TD-22-63 取证后证伪，防重报】解码失败**有留痕**（本 warn 带 sourceKey + 生产者判词），
      // 返回 null = 「该片段本次不发声」的**文档化契约**（调用方 continue 跳过）：
      // ① 播放循环内 toast = 每帧刷屏（同一坏片段每 tick 都会再试）；
      // ② 持续态读者已存在：波形组件的「素材不可用」错误态（audio-waveform / MissingMediaIndicator）；
      // ③ 失败原因多为坏文件/不支持编码，用户可行动作 = 重新导入（波形错误态已表达）。
      videoEditorLogger.warn('Failed to decode audio:', spec.sourceKey, resolved.message);
      return null;
    }

    const buffer = spec.reversed
      ? reverseAudioBuffer({ buffer: resolved.buffer, audioContext })
      : resolved.buffer;
    this.decodedBuffers.set(cacheKey, buffer);
    return buffer;
  }

  private stopPlayback(): void {
    for (const source of this.queuedSources) {
      // TD-16-3：`stop()` 失败走 `RELEASE_FAIL` 唯一实现（原语自带理由），不再手写 catch-ok 标记。
      releaseQuietly(() => source.stop());
      source.disconnect();
    }
    this.queuedSources.clear();
  }
}
