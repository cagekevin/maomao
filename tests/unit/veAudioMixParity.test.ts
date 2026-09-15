import { describe, it, expect } from 'vitest';
import type { MediaAsset } from '../../src/components/videoEditor/types/assets';
import type { TimelineTrack, VideoElement } from '../../src/components/videoEditor/types/timeline';
import {
  collectAudioClips,
  reverseAudioBuffer,
  toMonoSamples,
} from '../../src/components/videoEditor/engine/lib/media/audio.ts';

/**
 * TD-22-29（音频混音双后端收口）的两个新原语 + 判据采集。
 *
 * 【锁什么】
 *   1. `toMonoSamples` 的声道口径与**被它取代的** `decodeAudioToFloat32` **逐字一致**
 *      （立体声 `√2·(L+R)/2` 功率保持；不是简单平均）—— 否则字幕识别拿到的能量会变（静默漂移）。
 *   2. `reverseAudioBuffer` 逐声道倒序、**不动源 buffer**（同一素材的正序元素仍在引用它）。
 *   3. `collectAudioClips` 把 `reversed` 判据采集到 clip 上（实时播放据此取倒序副本 —— 档 2 的前置）。
 */

type FakeChannels = Float32Array[];

function makeFakeBuffer(channels: FakeChannels, sampleRate = 44100): AudioBuffer {
  const length = channels[0].length;
  return {
    numberOfChannels: channels.length,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (index: number) => channels[index],
  } as unknown as AudioBuffer;
}

function makeFakeContext(): AudioContext {
  return {
    createBuffer: (numberOfChannels: number, length: number, sampleRate: number) =>
      makeFakeBuffer(
        Array.from({ length: numberOfChannels }, () => new Float32Array(length)),
        sampleRate,
      ),
  } as unknown as AudioContext;
}

describe('TD-22-29 · toMonoSamples（单声道导出原语）', () => {
  it('立体声走 √2·(L+R)/2 的功率保持混音（不是简单平均）', () => {
    const left = Float32Array.from([0.5, -0.25]);
    const right = Float32Array.from([0.5, 0.25]);

    const samples = toMonoSamples({ buffer: makeFakeBuffer([left, right]) });

    // ⚠️ 精度只能给 6 位：`Float32Array` 仅 ~7 位有效数字，`toBeCloseTo(…, 10)` 会假红。
    expect(samples[0]).toBeCloseTo(Math.SQRT2 / 2, 6);
    expect(samples[1]).toBeCloseTo(0, 6);
    // 反证"不是简单平均"：简单平均会给出 0.5，与本值差 0.2 —— 两者不可同时成立。
    expect(samples[0]).not.toBeCloseTo(0.5, 6);
  });

  it('单声道原样复制（逐样本、长度一致）', () => {
    const samples = toMonoSamples({
      buffer: makeFakeBuffer([Float32Array.from([0.1, -0.2, 0.3])]),
    });

    expect(samples).toHaveLength(3);
    expect(samples[0]).toBeCloseTo(0.1, 6);
    expect(samples[1]).toBeCloseTo(-0.2, 6);
    expect(samples[2]).toBeCloseTo(0.3, 6);
  });
});

describe('TD-22-29 · reverseAudioBuffer（倒序副本原语）', () => {
  it('逐声道独立倒序，长度与采样率保持不变', () => {
    const source = makeFakeBuffer(
      [Float32Array.from([1, 2, 3, 4]), Float32Array.from([10, 20, 30, 40])],
      48000,
    );

    const reversed = reverseAudioBuffer({ buffer: source, audioContext: makeFakeContext() });

    expect(reversed.length).toBe(4);
    expect(reversed.sampleRate).toBe(48000);
    expect(Array.from(reversed.getChannelData(0))).toEqual([4, 3, 2, 1]);
    expect(Array.from(reversed.getChannelData(1))).toEqual([40, 30, 20, 10]);
  });

  it('不原地改写源 buffer（正序元素可能仍在引用同一份解码结果）', () => {
    const source = makeFakeBuffer([Float32Array.from([1, 2, 3])]);

    reverseAudioBuffer({ buffer: source, audioContext: makeFakeContext() });

    expect(Array.from(source.getChannelData(0))).toEqual([1, 2, 3]);
  });
});

describe('TD-22-29 · collectAudioClips 采集倒放判据', () => {
  function makeTracks({ reversed }: { reversed: boolean }): TimelineTrack[] {
    const element = {
      id: 'el-1',
      name: 'clip.mp4',
      type: 'video',
      mediaId: 'media-1',
      startTime: 0,
      duration: 2,
      trimStart: 0,
      muted: false,
      opacity: 1,
      reversed,
    } as unknown as VideoElement;

    return [
      {
        id: 'track-1',
        type: 'video',
        muted: false,
        elements: [element],
      } as unknown as TimelineTrack,
    ];
  }

  const mediaAssets = [{ id: 'media-1', type: 'video', file: {} } as unknown as MediaAsset];

  it('reversed video 元素 → clip.reversed = true', async () => {
    const clips = await collectAudioClips({ tracks: makeTracks({ reversed: true }), mediaAssets });

    expect(clips).toHaveLength(1);
    expect(clips[0].reversed).toBe(true);
  });

  it('未反转 → clip.reversed = false', async () => {
    const clips = await collectAudioClips({ tracks: makeTracks({ reversed: false }), mediaAssets });

    expect(clips[0].reversed).toBe(false);
  });
});
