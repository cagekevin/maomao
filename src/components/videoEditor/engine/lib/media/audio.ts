import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import type {
  AudioElement,
  TimelineElement,
  TimelineTrack,
} from '@/components/videoEditor/types/timeline';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';
import {
  canElementHaveAudio,
  getElementPlaybackRate,
  isElementMuted,
} from '@/components/videoEditor/engine/timeline/element-utils';
import { getOutputTracks, isTrackMuted } from '@/components/videoEditor/engine/timeline';
import {
  indexMediaAssets,
  mediaSupportsAudio,
} from '@/components/videoEditor/engine/lib/media/media-utils';

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
      const l = left[i];
      const r = right[i];
      if (l === undefined || r === undefined) break; // 两声道等长（不可达兜底）
      samples[i] = (SCALING_FACTOR * (l + r)) / 2;
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
      const v = source[length - 1 - i];
      if (v === undefined) break; // source/target 同长（不可达兜底）
      target[i] = v;
    }
  }

  return reversed;
}

/** 音频源里"字节从哪来"的三形态（**取字节方式的唯一列举**，消费方只按 kind 分派）。 */
export type AudioSourceBytes =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string }
  | { kind: 'buffer'; buffer: AudioBuffer };

/**
 * **「时间轴 → 该出哪些声音」的唯一判据产出**（纯函数、同步、不取字节不解码）。
 *
 * 【为什么必须是唯一一份（本仓头号母体）】"该出哪几段、每段的音量/静音/变速/反转/时间"
 * 若被预览与导出各写一份 ⇒ **成片与预览必然漂移**。故判据只此一处，消费方两个
 * （实时播放 `AudioManager` / 导出与字幕 `createTimelineAudioBuffer`）都从它取；
 * **取字节与解码**也收口在 `resolveAudioSourceBuffer`（三条字节来源的分派不各写一遍）。
 *
 * 判据清单（改动前先问：预览与导出**是否都**该这么判）：
 *   · 轨 `hidden` ⇒ 整轨不参与输出（画面 + 声音）；轨 `muted` ⇒ 只关声音（`muted: true` 由调度方跳过）。
 *   · 元素 `hidden` / `duration <= 0` ⇒ 不参与输出。
 *   · 音量：`getElementVolume`（video 元素无 `volume` 字段 ⇒ 1）；变速：`getElementPlaybackRate`；
 *     反转：只有 video 元素有 `reversed`。
 */
export interface AudioSourceSpec {
  elementId: string;
  /** 解码缓存的稳定键（同素材多元素共享一次解码）。 */
  sourceKey: string;
  source: AudioSourceBytes;
  startTime: number;
  duration: number;
  trimStart: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  reversed: boolean;
}

/** 采集阶段就能判定的失败（**生产者给可展示信息**，由调用方决定怎么呈现）。 */
export interface AudioSourceSkipped {
  elementId: string;
  message: string;
}

function getElementVolume({ element }: { element: TimelineElement }): number {
  if ('volume' in element && typeof element.volume === 'number') {
    return element.volume;
  }
  return 1;
}

export function collectAudioSources({
  tracks,
  mediaAssets,
}: {
  tracks: TimelineTrack[];
  mediaAssets: MediaAsset[];
}): { items: AudioSourceSpec[]; skipped: AudioSourceSkipped[] } {
  const mediaMap = indexMediaAssets({ mediaAssets });
  const items: AudioSourceSpec[] = [];
  const skipped: AudioSourceSkipped[] = [];

  // 【可见性 = 参与输出】`getOutputTracks` 已把被隐藏的轨 / 元素滤掉 ⇒ 本处看不到它们，
  // 与画面消费**同一批**轨道（预览与导出都经这里）。
  for (const track of getOutputTracks(tracks)) {
    const trackMuted = isTrackMuted(track);

    for (const element of track.elements) {
      if (!canElementHaveAudio(element)) continue;
      if (element.duration <= 0) continue;

      const muted = trackMuted || isElementMuted(element);

      const base = {
        startTime: element.startTime,
        duration: element.duration,
        trimStart: element.trimStart,
        volume: getElementVolume({ element }),
        muted,
        playbackRate: getElementPlaybackRate({ element }),
        reversed: 'reversed' in element ? (element.reversed ?? false) : false,
      };

      if (element.type === 'audio') {
        const resolvedBytes = resolveAudioElementBytes({ element, mediaMap, skipped });
        if (!resolvedBytes) continue;

        items.push({
          elementId: element.id,
          sourceKey: resolvedBytes.sourceKey,
          source: resolvedBytes.source,
          ...base,
        });
        continue;
      }

      // video：只有**确知含音轨**的素材才参与（`mediaSupportsAudio` 按媒体类型判；
      // 视频无音轨是常态，不是失败 ⇒ 静默跳过，不进 `skipped`）。
      const mediaAsset = mediaMap.get(element.mediaId);
      if (!mediaAsset) {
        skipped.push({ elementId: element.id, message: '视频素材不在本工程素材表中' });
        continue;
      }
      if (!mediaSupportsAudio({ media: mediaAsset })) continue;

      items.push({
        elementId: element.id,
        sourceKey: mediaAsset.id,
        source: { kind: 'file', file: mediaAsset.file },
        ...base,
      });
    }
  }

  return { items, skipped };
}

/**
 * 音频元素 → 字节来源。返回 `null` = 该元素不该发声，且**原因已收进 `skipped`**
 * （"素材缺失／不含音轨"是**可判别的失败**，不是"解不出来"——给出各自判词，让上层能区分）。
 */
function resolveAudioElementBytes({
  element,
  mediaMap,
  skipped,
}: {
  element: AudioElement;
  mediaMap: Map<string, MediaAsset>;
  skipped: AudioSourceSkipped[];
}): { sourceKey: string; source: AudioSourceBytes } | null {
  if (element.sourceType === 'upload') {
    const asset = mediaMap.get(element.mediaId);
    if (!asset) {
      skipped.push({ elementId: element.id, message: '音频素材不在本工程素材表中' });
      return null;
    }
    if (!mediaSupportsAudio({ media: asset })) {
      skipped.push({ elementId: element.id, message: '该素材不含音轨' });
      return null;
    }
    // 同素材多元素共享一次解码 ⇒ 缓存键取素材 id（不是元素 id）。
    return { sourceKey: asset.id, source: { kind: 'file', file: asset.file } };
  }

  // 库音频：已解码的 `buffer` 优先（省一次网络往返；也避免"取字节失败 ⇒ 预览无声而成片有声"）。
  if (element.buffer) {
    return { sourceKey: element.id, source: { kind: 'buffer', buffer: element.buffer } };
  }
  return { sourceKey: element.id, source: { kind: 'url', url: element.sourceUrl } };
}

/**
 * 字节 → `AudioBuffer`（**唯一取字节 + 解码原语**，预览与导出共用）。
 *
 * 【生产者给可展示信息】失败**不返回 null**：带判词的判别联合由调用方原样转发
 * —— 否则上层只能自己编"解码失败"（其实往往是**网络/404**），且用户会在**导出的成品**里
 * 才发现"这段音频没了"（产物受损且事后无从回查）。
 */
export async function resolveAudioSourceBuffer({
  source,
  audioContext,
}: {
  source: AudioSourceBytes;
  audioContext: AudioContext;
}): Promise<{ ok: true; buffer: AudioBuffer } | { ok: false; message: string }> {
  if (source.kind === 'buffer') return { ok: true, buffer: source.buffer };

  try {
    if (source.kind === 'file') {
      const arrayBuffer = await source.file.arrayBuffer();
      // .slice(0) avoids the detached-buffer error on repeated decodes
      return { ok: true, buffer: await audioContext.decodeAudioData(arrayBuffer.slice(0)) };
    }

    const response = await fetch(source.url);
    if (!response.ok) {
      return { ok: false, message: `库音频取字节失败：HTTP ${response.status}` };
    }
    const arrayBuffer = await response.arrayBuffer();
    return { ok: true, buffer: await audioContext.decodeAudioData(arrayBuffer.slice(0)) };
  } catch (error) {
    return {
      ok: false,
      message: `音频解码失败：${error instanceof Error ? error.message : String(error)}`,
    };
  }
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

  const { items, skipped } = collectAudioSources({ tracks, mediaAssets });

  const outputChannels = 2;
  const outputLength = Math.ceil(duration * sampleRate);
  const outputBuffer = context.createBuffer(outputChannels, outputLength, sampleRate);

  let mixedCount = 0;
  for (const spec of items) {
    if (spec.muted) continue;

    const resolved = await resolveAudioSourceBuffer({ source: spec.source, audioContext: context });
    if (!resolved.ok) {
      // 【消费者只转发】失败原因由 `resolveAudioSourceBuffer`（生产者）给全，此处原样收进 `skipped`。
      skipped.push({ elementId: spec.elementId, message: resolved.message });
      continue;
    }

    mixAudioChannels({
      spec,
      buffer: resolved.buffer,
      outputBuffer,
      outputLength,
      sampleRate,
    });
    mixedCount++;
  }

  // 【产物受损必须可见】被跳过的元素在此统一上报（导出成片少音频，用户与开发者都要能查）。
  if (skipped.length > 0) {
    videoEditorLogger.warn('时间轴音频：部分元素解析失败（该段音频将缺失）', { skipped });
  }

  // 【有声音才出音轨】一段都没混进去（全静音 / 全部解析失败）⇒ 返回 `null` = **不产出音轨**。
  // 返回一条全零 buffer 等于凭空多一条没有内容的音轨，且把"全部解析失败"这件事掩盖成"有音轨"。
  if (mixedCount === 0) return null;

  return outputBuffer;
}

function mixAudioChannels({
  spec,
  buffer,
  outputBuffer,
  outputLength,
  sampleRate,
}: {
  spec: AudioSourceSpec;
  buffer: AudioBuffer;
  outputBuffer: AudioBuffer;
  outputLength: number;
  sampleRate: number;
}): void {
  const {
    startTime,
    trimStart,
    duration: elementDuration,
    volume,
    playbackRate = 1,
    reversed = false,
  } = spec;

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
      if (sample0 === undefined) continue; // 上方已判界（不可达兜底）
      const nextSample = sourceData[sourceIndex + 1];
      const sample1 = nextSample !== undefined ? nextSample : sample0;
      const interpolated = sample0 + fraction * (sample1 - sample0);

      // 混音是累加：目标通道首帧为 0（TypedArray 初始值），越界不可达
      const mixed = outputData[outputIndex] ?? 0;
      outputData[outputIndex] = mixed + interpolated * volume;
    }
  }
}
