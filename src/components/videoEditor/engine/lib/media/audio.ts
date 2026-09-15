import { logger } from '@videoEditor/lib/logger';
import type {
  AudioElement,
  LibraryAudioElement,
  TimelineElement,
  TimelineTrack,
} from '@videoEditor/types/timeline';
import type { MediaAsset } from '@videoEditor/types/assets';
import {
  canElementHaveAudio,
  getElementPlaybackRate,
} from '@videoEditor/engine/timeline/element-utils';
import { canTracktHaveAudio } from '@videoEditor/engine/timeline';
import { mediaSupportsAudio } from '@videoEditor/engine/lib/media/media-utils';

export type CollectedAudioElement = Omit<
  AudioElement,
  'type' | 'mediaId' | 'id' | 'name' | 'sourceType' | 'sourceUrl'
> & { buffer: AudioBuffer; reversed?: boolean };

export function createAudioContext(): AudioContext {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  return new AudioContextConstructor();
}

/**
 * `AudioBuffer` → 单声道 `Float32Array`（"下游只认一串样本"时的唯一转换原语）。
 *
 * 【为什么抽它（TD-22-29 档 1）】字幕识别链路原先走
 * 「混音 → PCM16 WAV 编码（`createWavBlob`）→ 再 `decodeAudioToFloat32` 解码回 samples」，
 * 中间那一次「编码 → 解码」往返只是为了把 `AudioBuffer` 变成一串样本。
 * 现改为：混音直接产目标采样率的 `AudioBuffer`，再用本原语取样本（往返整段消失）。
 *
 * 【声道口径】与原 `decodeAudioToFloat32` **逐字一致**（不得漂移）：
 *   立体声 = `√2·(L+R)/2`（power-preserving——L/R 同相时直接取平均会掉 3dB）；其余取声道 0。
 */
export function toMonoSamples({ buffer }: { buffer: AudioBuffer }): Float32Array {
  const length = buffer.length;
  const samples = new Float32Array(length);

  if (buffer.numberOfChannels === 2) {
    const SCALING_FACTOR = Math.sqrt(2);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      samples[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
    }
    return samples;
  }

  samples.set(buffer.getChannelData(0));
  return samples;
}

/**
 * 倒序副本（`R[i] = S[N−1−i]`，逐声道独立）。
 *
 * 【为什么需要（TD-22-29 档 2）】`AudioBufferSourceNode` **不支持负向播放**
 * （规范未定义 `playbackRate < 0` 的行为），故"倒放"必须在**喂给调度器之前**完成：
 * 先倒序，再让调度器按**正序**算式播 —— 起点换算见 `AudioManager.scheduleClipNode` 的 `trimStart` 注释。
 *
 * 【为什么不原地倒序】同一 `sourceKey` 的素材可能**同时**被正序元素与反转元素引用，
 * 两者共享一份解码结果 ⇒ 原地倒序会污染另一个消费方，故一律产出**独立副本**。
 */
export function reverseAudioBuffer({
  buffer,
  audioContext,
}: {
  buffer: AudioBuffer;
  audioContext: AudioContext;
}): AudioBuffer {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const reversed = audioContext.createBuffer(channels, length, buffer.sampleRate);

  for (let channel = 0; channel < channels; channel++) {
    const source = buffer.getChannelData(channel);
    const target = reversed.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      target[i] = source[length - 1 - i];
    }
  }

  return reversed;
}

export async function collectAudioElements({
  tracks,
  mediaAssets,
  audioContext,
}: {
  tracks: TimelineTrack[];
  mediaAssets: MediaAsset[];
  audioContext: AudioContext;
}): Promise<CollectedAudioElement[]> {
  const mediaMap = new Map<string, MediaAsset>(mediaAssets.map((media) => [media.id, media]));
  const pendingElements: Array<Promise<CollectedAudioElement | null>> = [];

  for (const track of tracks) {
    if (canTracktHaveAudio(track) && track.muted) continue;

    for (const element of track.elements) {
      if (!canElementHaveAudio(element)) continue;
      if (element.duration <= 0) continue;

      const isTrackMuted = canTracktHaveAudio(track) && track.muted;
      const isElementMuted = 'muted' in element ? (element.muted ?? false) : false;
      const muted = isTrackMuted || isElementMuted;

      if (element.type === 'audio') {
        const volume = element.volume ?? 1;
        pendingElements.push(
          resolveAudioBufferForElement({
            element,
            mediaMap,
            audioContext,
          }).then((audioBuffer) => {
            if (!audioBuffer) return null;
            return {
              buffer: audioBuffer,
              startTime: element.startTime,
              duration: element.duration,
              trimStart: element.trimStart,
              volume,
              muted,
              playbackRate: element.playbackRate ?? 1,
            };
          }),
        );
      }

      if (element.type === 'video') {
        const mediaAsset = mediaMap.get(element.mediaId);
        if (!mediaAsset || !mediaSupportsAudio({ media: mediaAsset })) continue;

        pendingElements.push(
          resolveVideoAudioBuffer({
            file: mediaAsset.file,
            audioContext,
          }).then((audioBuffer) => {
            if (!audioBuffer) return null;
            return {
              buffer: audioBuffer,
              startTime: element.startTime,
              duration: element.duration,
              trimStart: element.trimStart,
              volume: 1,
              muted,
              playbackRate: element.playbackRate ?? 1,
              reversed: element.reversed ?? false,
            };
          }),
        );
      }
    }
  }

  const resolvedElements = await Promise.all(pendingElements);
  const audioElements: CollectedAudioElement[] = [];
  for (const element of resolvedElements) {
    if (element) audioElements.push(element);
  }
  return audioElements;
}

async function resolveVideoAudioBuffer({
  file,
  audioContext,
}: {
  file: File;
  audioContext: AudioContext;
}): Promise<AudioBuffer | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } catch (error) {
    logger.warn('Failed to decode video audio:', error);
    return null;
  }
}

async function resolveAudioBufferForElement({
  element,
  mediaMap,
  audioContext,
}: {
  element: AudioElement;
  mediaMap: Map<string, MediaAsset>;
  audioContext: AudioContext;
}): Promise<AudioBuffer | null> {
  try {
    if (element.sourceType === 'upload') {
      const asset = mediaMap.get(element.mediaId);
      if (!asset || !mediaSupportsAudio({ media: asset })) return null;

      const arrayBuffer = await asset.file.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer.slice(0));
    }

    if (element.buffer) return element.buffer;

    // 与 `fetchLibraryAudioSource/Clip` 共用同一个取字节原语（TD-22-39）。
    const response = await fetchLibraryAudioResponse({ sourceUrl: element.sourceUrl });
    if (!response) return null;

    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } catch (error) {
    logger.warn('Failed to decode audio:', error);
    return null;
  }
}

export interface AudioClipSource {
  id: string;
  sourceKey: string;
  file: File;
  startTime: number;
  duration: number;
  trimStart: number;
  muted: boolean;
  volume: number;
  playbackRate: number;
  /**
   * 倒放（**仅 video 元素有该字段**，audio 元素不支持反转）。
   * 调度域不支持负向播放 ⇒ 喂给调度器前取倒序副本，起点随之换算（TD-22-29 档 2）。
   */
  reversed: boolean;
}

/**
 * 库音频的**唯一取字节原语**：`sourceUrl` → 已校验 `ok` 的 `Response`（失败返 null + 一次 warn）。
 *
 * 【为什么抽它、抽到哪一层（TD-22-39）】库音频的取字节骨架在本文件里曾被抄成 **3 份**
 * （`fetchLibraryAudioSource` / `fetchLibraryAudioClip` / `resolveAudioBufferForElement` 的
 * 库分支），三处的 `fetch → 校验 ok → 抛同一条错误文案 → catch warn 返 null` **逐字相同**，
 * 只有「拿到字节之后做什么」不同（转 `File` / 转 `arrayBuffer` 解码）。
 * 按 Step 3 的「重复种类」判别：
 *   · 「怎么把字节取回来」（fetch / 校验 / 失败策略）= **探测重复** → 收口到本函数；
 *   · 「取回来之后干什么」（组装形状 / 解码）= **用途差异** → 各自保留在上层。
 * 参数取**最小契约** `{ sourceUrl }`（本原语只依赖它），不绑 `LibraryAudioElement`。
 */
async function fetchLibraryAudioResponse({
  sourceUrl,
}: {
  sourceUrl: string;
}): Promise<Response | null> {
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Library audio fetch failed: ${response.status}`);
    }
    return response;
  } catch (error) {
    logger.warn('Failed to fetch library audio:', error);
    return null;
  }
}

/** 库音频 → `File`（由上面的取字节原语派生）。 */
async function fetchLibraryAudioFile({
  element,
}: {
  element: LibraryAudioElement;
}): Promise<File | null> {
  const response = await fetchLibraryAudioResponse({ sourceUrl: element.sourceUrl });
  if (!response) return null;

  const blob = await response.blob();
  return new File([blob], `${element.name}.mp3`, { type: 'audio/mpeg' });
}

async function fetchLibraryAudioClip({
  element,
  muted,
}: {
  element: LibraryAudioElement;
  muted: boolean;
}): Promise<AudioClipSource | null> {
  const file = await fetchLibraryAudioFile({ element });
  if (!file) return null;

  return {
    id: element.id,
    sourceKey: element.id,
    file,
    startTime: element.startTime,
    duration: element.duration,
    trimStart: element.trimStart,
    muted,
    volume: element.volume ?? 1,
    playbackRate: element.playbackRate ?? 1,
    // 库音频是 audio 元素，不支持反转（与 `collectMediaAudioClip` 的窄化口径一致）。
    reversed: false,
  };
}

function getElementVolume({ element }: { element: TimelineElement }): number {
  if ('volume' in element && typeof element.volume === 'number') {
    return element.volume;
  }
  return 1;
}

function collectMediaAudioClip({
  element,
  mediaAsset,
  muted,
}: {
  element: TimelineElement;
  mediaAsset: MediaAsset;
  muted: boolean;
}): AudioClipSource {
  return {
    id: element.id,
    sourceKey: mediaAsset.id,
    file: mediaAsset.file,
    startTime: element.startTime,
    duration: element.duration,
    trimStart: element.trimStart,
    muted,
    volume: getElementVolume({ element }),
    playbackRate: getElementPlaybackRate({ element }),
    // 只有 video 元素有 `reversed`（audio 元素类型上就没有该字段）⇒ 窄化后取值，缺省 false。
    reversed: 'reversed' in element ? (element.reversed ?? false) : false,
  };
}

export async function collectAudioClips({
  tracks,
  mediaAssets,
}: {
  tracks: TimelineTrack[];
  mediaAssets: MediaAsset[];
}): Promise<AudioClipSource[]> {
  const clips: AudioClipSource[] = [];
  const mediaMap = new Map<string, MediaAsset>(mediaAssets.map((asset) => [asset.id, asset]));
  const pendingLibraryClips: Array<Promise<AudioClipSource | null>> = [];

  for (const track of tracks) {
    const isTrackMuted = canTracktHaveAudio(track) && track.muted;

    for (const element of track.elements) {
      if (!canElementHaveAudio(element)) continue;

      const isElementMuted = 'muted' in element ? (element.muted ?? false) : false;
      const muted = isTrackMuted || isElementMuted;

      if (element.type === 'audio') {
        if (element.sourceType === 'upload') {
          const mediaAsset = mediaMap.get(element.mediaId);
          if (!mediaAsset) continue;

          clips.push(
            collectMediaAudioClip({
              element,
              mediaAsset,
              muted,
            }),
          );
        } else {
          pendingLibraryClips.push(fetchLibraryAudioClip({ element, muted }));
        }
        continue;
      }

      if (element.type === 'video') {
        const mediaAsset = mediaMap.get(element.mediaId);
        if (!mediaAsset) continue;

        if (mediaSupportsAudio({ media: mediaAsset })) {
          clips.push(
            collectMediaAudioClip({
              element,
              mediaAsset,
              muted,
            }),
          );
        }
      }
    }
  }

  const resolvedLibraryClips = await Promise.all(pendingLibraryClips);
  for (const clip of resolvedLibraryClips) {
    if (clip) clips.push(clip);
  }

  return clips;
}

export async function createTimelineAudioBuffer({
  tracks,
  mediaAssets,
  duration,
  sampleRate = 44100,
  audioContext,
}: {
  tracks: TimelineTrack[];
  mediaAssets: MediaAsset[];
  duration: number;
  sampleRate?: number;
  audioContext?: AudioContext;
}): Promise<AudioBuffer | null> {
  const context = audioContext ?? createAudioContext();

  const audioElements = await collectAudioElements({
    tracks,
    mediaAssets,
    audioContext: context,
  });

  if (audioElements.length === 0) return null;

  const outputChannels = 2;
  const outputLength = Math.ceil(duration * sampleRate);
  const outputBuffer = context.createBuffer(outputChannels, outputLength, sampleRate);

  for (const element of audioElements) {
    if (element.muted) continue;

    mixAudioChannels({
      element,
      outputBuffer,
      outputLength,
      sampleRate,
    });
  }

  return outputBuffer;
}

function mixAudioChannels({
  element,
  outputBuffer,
  outputLength,
  sampleRate,
}: {
  element: CollectedAudioElement;
  outputBuffer: AudioBuffer;
  outputLength: number;
  sampleRate: number;
}): void {
  const {
    buffer,
    startTime,
    trimStart,
    duration: elementDuration,
    volume,
    playbackRate = 1,
    reversed = false,
  } = element;

  // 【声画同源（TD-22-14 母体）】下面是"源时间步进"的**样本域**等价实现：
  //   源窗口 = `[trimStart, trimStart + duration × rate]`（按**源侧**长度，不是时间轴长度），
  //   每个输出样本让源前进 `sourceStep` 个样本 —— 与 `getVisualSourceTime`
  //   （时间域：`trimStart + elapsed × rate`）描述的是**同一条源时间线**，改动必须成对。
  //   此处刻意**不**调那个原语：它是逐样本增量推进，逐样本调函数会把 O(n) 抬成 O(n·常数)
  //   （导出混音是热路径），故保留闭式步进 + 本注释互指。
  const sourceStartSample = Math.floor(trimStart * buffer.sampleRate);
  const sourceEndSample = Math.min(
    buffer.length - 1,
    Math.ceil((trimStart + elementDuration * playbackRate) * buffer.sampleRate) - 1,
  );
  const outputStartSample = Math.floor(startTime * sampleRate);
  const outputSampleCount = Math.floor(elementDuration * sampleRate);
  const sourceStep = (buffer.sampleRate / sampleRate) * playbackRate;

  const outputChannels = 2;
  for (let channel = 0; channel < outputChannels; channel++) {
    const outputData = outputBuffer.getChannelData(channel);
    const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
    const sourceData = buffer.getChannelData(sourceChannel);

    for (let i = 0; i < outputSampleCount; i++) {
      const outputIndex = outputStartSample + i;
      if (outputIndex >= outputLength) break;

      const sourcePos = reversed
        ? sourceEndSample - i * sourceStep
        : sourceStartSample + i * sourceStep;
      const sourceIndex = Math.floor(sourcePos);
      if (sourceIndex < 0 || sourceIndex >= sourceData.length) continue;

      const fraction = sourcePos - sourceIndex;
      const sample0 = sourceData[sourceIndex];
      const sample1 = sourceIndex + 1 < sourceData.length ? sourceData[sourceIndex + 1] : sample0;
      const interpolated = sample0 + fraction * (sample1 - sample0);

      outputData[outputIndex] += interpolated * volume;
    }
  }
}
