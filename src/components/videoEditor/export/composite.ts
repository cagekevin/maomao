/**
 * 合成渲染 + 合成导出 —— `docs/120` C8（预览与合成共用渲染路径 WYSIWYG）· C5（合成重编码）
 * · `docs/123` §二.3 G4 卡。
 *
 * ── 为什么这个文件不是「假接缝」（它确实要存在）──
 * `check-arch` 的复杂度定位（`docs/123` §二.7 P1）把 `export/mediaEngine.ts` 判为假接缝并删除 ——
 * 那一条**只适用于纯转发 `videoEngine` 的壳**。本文件不是壳：它装的是**仓内确实没有**的
 * 帧合成器（`renderFrameAt`）。仓内 `videoEngine.ts` 只有 trim / concat / gif / metadata，
 * **没有「把某一时刻的多轨画面画到一张画布上」这个能力**（`docs/120` §1.3 目录树亦如此标注：「本仓库暂无，需新建」）。
 *
 * ── 为什么它不能落在 `base/utils/`（与 P1 的字面读法冲突，但依赖方向强制）──
 * 它要读 `Track` / `Clip` 这类**剪辑器领域类型**。而机器守卫 G-1 禁止 `base/` 依赖任何业务域
 * ⇒ 合成器**必须**住在剪辑器内（`export/`），不能塞进 `videoEngine.ts`。
 * 结论：`videoEngine.ts` 只收「与领域无关的媒体的操作」（分组搬运）；**与领域模型有关的渲染**落在这里。
 *
 * ── M1 只做 M1（本文件对 M2 字段刻意「不解释」）──
 * `Clip` 的 `transform` / `transitionIn` / `transitionOut` / `volumePoints` 在 M1 的类型是 `unknown`
 * （见 `core/types.ts`）。M1 **不猜它们的形状**，因此本渲染器不做画中画 / 转场 / 音量包络 ——
 * 它就画「contain 归一到工程尺寸」这一件事。M2 定稿这些字段时，在此补渲染分支即可。
 */
import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  VideoSampleSink,
} from 'mediabunny';
import type { VideoSample } from 'mediabunny';
import { ConversionCanceled } from '../../base/utils/videoEngine.ts';
import type { AudioOutcome } from '../../base/utils/videoEngine.ts';
import { activeClipsAt, clipDuration, timelineDuration } from '../core/timelineOps.ts';
import type { Clip, Project, Track } from '../core/types.ts';

/**
 * 导出阶段（`docs/123` §一.5 O2：长任务要能报告「卡在哪一步」，而不是只有一个百分比）。
 *
 * 三态就够 —— 恰好对应 O2 写的「混音 / 画面 / 写音频」。**不设 `done` 态**：
 * 「完成」由 promise resolve 表达，再加一个阶段位是同一件事的第二个信号。
 */
export type ExportStage = 'audio' | 'video' | 'mux';

/** 画布尺寸（= 工程基准，`docs/120` C12）。 */
export interface CanvasSize {
  width: number;
  height: number;
}

/** 一个片段的渲染素材：视频给 `sink`，图片给 `bitmap`。 */
interface ClipRenderSource {
  sink?: VideoSampleSink;
  bitmap?: ImageBitmap;
  /** 素材显示尺寸（**已含旋转**，即 `getDisplayWidth/Height`），用于 contain 摆放。 */
  width: number;
  height: number;
}

/** 片段 → 渲染素材。**同步**（素材须在渲染前全部就绪，见 `openTimelineSources`）。 */
type ClipSourceResolver = (clip: Clip) => ClipRenderSource | undefined;

/** 片段 → 已打开的 `Input`（音频解码用）。 */
type ClipAudioResolver = (clip: Clip) => Input | null;

/**
 * 计算片段在画布上的**绘制矩形**（contain 归一，`docs/120` C12.1 红线）。
 *
 * 只做 contain：M1 的黑边是**如实显示**的既定结果（C12.2 把「消掉黑边」判给 M2 的 fit 模式）。
 * 不引入 `fill` / `cover` 分支 —— 那是 M2 的能力，现在写就是替 M2 定型。
 */
export function computeDrawRect(
  source: { width: number; height: number },
  canvas: CanvasSize,
): { x: number; y: number; width: number; height: number } {
  const scale = Math.min(
    canvas.width / Math.max(1, source.width),
    canvas.height / Math.max(1, source.height),
  );
  const width = source.width * scale;
  const height = source.height * scale;
  return { x: (canvas.width - width) / 2, y: (canvas.height - height) / 2, width, height };
}

/** 把一个片段的画面画到画布上（含素材时刻 → 画面取用）。 */
async function drawClipAt(
  context: CanvasRenderingContext2D,
  canvas: CanvasSize,
  clip: Clip,
  sourceTime: number,
  resolve: ClipSourceResolver,
  samplesToClose: VideoSample[],
): Promise<void> {
  const source = resolve(clip);
  if (!source) return;
  const rect = computeDrawRect(source, canvas);

  if (source.bitmap) {
    context.drawImage(source.bitmap, rect.x, rect.y, rect.width, rect.height);
    return;
  }
  if (!source.sink) return;

  const sample = await source.sink.getSample(Math.max(0, sourceTime));
  if (!sample) return;
  samplesToClose.push(sample);
  // 用 `VideoSample.draw` 而不是 `toCanvasImageSource()` + `drawImage`：
  // 前者由 mediabunny 处理旋转与像素宽高比，后者要自己补这些（且类型上还得断言）。
  sample.draw(context, rect.x, rect.y, rect.width, rect.height);
}

/**
 * 渲染某一时刻的一帧（预览与合成共用的**同一条路径**，`docs/120` C8）。
 *
 * 规则：轨道按数组顺序自下而上叠加；**隐藏轨跳过**（C7.1：隐藏只影响渲染，不动数据）；
 * 每个轨上取 `activeClipsAt`（自由轨允许同刻多条，全部画上）。
 *
 * **为什么不导出**：M1 没有监视器（`docs/120` §0.8 把「画面」判给 M2），所以它此刻的消费者
 * 只有 `exportComposite` 一个。现在导出 = 给不存在的调用方预留 API（7 步法 A8 + `check:dead-code`）。
 * M2 的预览要复用它时，把它 `export` 出去即可 —— 那时它才真的有第二个读者。
 */
async function renderFrameAt(
  context: CanvasRenderingContext2D,
  canvas: CanvasSize,
  tracks: Track[],
  time: number,
  resolve: ClipSourceResolver,
): Promise<void> {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const samplesToClose: VideoSample[] = [];
  try {
    for (const track of tracks) {
      if (track.hidden || track.kind !== 'video') continue;
      for (const clip of activeClipsAt(track, time)) {
        // 素材时刻 = 入点 + 片段内已播时长（`sourceStart` + (t - timelineStart)）。
        await drawClipAt(
          context,
          canvas,
          clip,
          clip.sourceStart + (time - clip.timelineStart),
          resolve,
          samplesToClose,
        );
      }
    }
  } finally {
    // `docs/120` C8.2：谁取样本谁关 —— 不关就是帧泄漏（渲染循环里会瞬间吃穿内存）。
    for (const sample of samplesToClose) sample.close();
  }
}

/* ────────────────────────────────────────────────────────────────
 * 素材就绪（打开 Input / 位图），供渲染与混音共用
 * ──────────────────────────────────────────────────────────────── */

/** 打开后的时间轴素材集合 + 释放函数。 */
export interface TimelineSources {
  resolveVideo: ClipSourceResolver;
  resolveAudio: ClipAudioResolver;
  /** 释放所有 `Input` 与 `ImageBitmap`（**必须在 finally 调用**，见 C8.2）。 */
  dispose: () => void;
}

/** 按 URL 取字节（注入点：测试 / 非浏览器环境）。 */
export type BlobFetcher = (url: string) => Promise<Blob>;

/**
 * 打开时间轴用到的全部素材。
 *
 * 按 **url** 去重（两个片段用同一素材是常态，别开两份 `Input`，更别取两次字节）。
 * 音频片段（`kind: 'audio'`）**不建渲染素材** —— 它没有画面，`resolveVideo` 对它返回 `undefined`，
 * `renderFrameAt` 自然跳过。
 */
export async function openTimelineSources(
  entries: { clip: Clip; url: string }[],
  fetchBlob: BlobFetcher,
): Promise<TimelineSources> {
  const inputs = new Map<string, Input>();
  const blobs = new Map<string, Blob>();
  const renderSources = new Map<string, ClipRenderSource>();
  /** 片段 id → 素材 url（`resolveAudio` 要按 id 反查，不能每次 `entries.find` 线性扫）。 */
  const urlByClipId = new Map<string, string>();
  const bitmaps: ImageBitmap[] = [];

  const blobOf = async (url: string): Promise<Blob> => {
    const hit = blobs.get(url);
    if (hit) return hit;
    const blob = await fetchBlob(url);
    blobs.set(url, blob);
    return blob;
  };
  const inputOf = async (url: string): Promise<Input> => {
    const hit = inputs.get(url);
    if (hit) return hit;
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(await blobOf(url)) });
    inputs.set(url, input);
    return input;
  };

  try {
    for (const entry of entries) {
      const { clip, url } = entry;
      urlByClipId.set(clip.id, url);
      if (renderSources.has(clip.id)) continue;

      if (clip.kind === 'image') {
        const bitmap = await createImageBitmap(await blobOf(url));
        bitmaps.push(bitmap);
        renderSources.set(clip.id, { bitmap, width: bitmap.width, height: bitmap.height });
        continue;
      }
      const input = await inputOf(url);
      const videoTrack = await input.getPrimaryVideoTrack();
      if (!videoTrack) continue; // 纯音频片段：无画面可画
      renderSources.set(clip.id, {
        sink: new VideoSampleSink(videoTrack),
        width: await videoTrack.getDisplayWidth(),
        height: await videoTrack.getDisplayHeight(),
      });
    }
  } catch (e) {
    for (const bitmap of bitmaps) bitmap.close();
    for (const input of inputs.values()) input.dispose();
    throw e;
  }

  return {
    resolveVideo: (clip) => renderSources.get(clip.id),
    resolveAudio: (clip) => {
      const url = urlByClipId.get(clip.id);
      return url ? (inputs.get(url) ?? null) : null;
    },
    dispose: () => {
      for (const bitmap of bitmaps) bitmap.close();
      for (const input of inputs.values()) input.dispose();
      bitmaps.length = 0;
      inputs.clear();
      blobs.clear();
      renderSources.clear();
      urlByClipId.clear();
    },
  };
}

/* ────────────────────────────────────────────────────────────────
 * 音频混流（M1 子集：按时轴位置叠加；**不做音量包络**，那是 M2）
 * ──────────────────────────────────────────────────────────────── */

/** 混音输出采样率 / 声道（`docs/120` C12：48 kHz 固定，M1 不暴露）。 */
const MIX_SAMPLE_RATE = 48_000;
const MIX_CHANNELS = 2;

/**
 * 混音声道缓冲。
 *
 * 必须显式写成 `Float32Array<ArrayBuffer>`：`AudioBuffer.copyToChannel` 不接受
 * 底层为 `SharedArrayBuffer` 的视图，而默认的 `Float32Array` 是 `Float32Array<ArrayBufferLike>`。
 */
type MixChannel = Float32Array<ArrayBuffer>;

/**
 * 把一个片段的声音叠加进目标缓冲。
 *
 * 增益逐样本取自**轨道级**静音（轨级已在调用前过滤）；**不做片段级音量包络** ——
 * `clip.volumePoints` 在 M1 是 `unknown`（不解释形状）。
 * 重采样用最近邻：剪辑场景足够，且避免为此引入重采样依赖。
 */
async function mixClip(
  target: MixChannel[],
  totalLength: number,
  clip: Clip,
  input: Input,
): Promise<void> {
  const duration = clipDuration(clip);
  if (duration <= 0) return;
  const audioTrack = await input.getPrimaryAudioTrack();
  if (!audioTrack) return;

  const sink = new AudioBufferSink(audioTrack);
  for await (const wrapped of sink.buffers(clip.sourceStart, clip.sourceEnd)) {
    const timeInClip = wrapped.timestamp - clip.sourceStart;
    if (timeInClip >= duration) break;

    const startSample = Math.round((clip.timelineStart + timeInClip) * MIX_SAMPLE_RATE);
    const ratio = wrapped.buffer.sampleRate / MIX_SAMPLE_RATE;
    const span = Math.round(wrapped.buffer.duration * MIX_SAMPLE_RATE);

    for (let channel = 0; channel < MIX_CHANNELS; channel++) {
      // 单声道素材复制到两个声道
      const sourceChannel = Math.min(channel, wrapped.buffer.numberOfChannels - 1);
      const data = wrapped.buffer.getChannelData(sourceChannel);
      const out = target[channel];
      for (let i = 0; i < span; i++) {
        const dest = startSample + i;
        if (dest < 0 || dest >= totalLength) continue;
        const sourceIndex = Math.floor(i * ratio);
        if (sourceIndex >= data.length) break;
        out[dest] += data[sourceIndex];
      }
    }
  }
}

/**
 * 时间轴上**可闻**的片段（`docs/120` C11.7：M1 走带必须真出声）。
 *
 * **判据单点**：混音（本文件）与「导出是否需要音频编码器」（`pipeline.ts` 的探针请求）
 * 都问这一个函数。各写一遍 `!hidden && !muted` 必漂 —— 一处说「有声音」、另一处说「没有」，
 * 结果就是「明明有音频却没探音频编码器」。
 */
export function audibleClipsOf(tracks: Track[]): Clip[] {
  return tracks
    .filter((track) => !track.hidden && !track.muted)
    .flatMap((track) => track.clips.filter((clip) => clip.kind !== 'image'));
}

/** 混音产物 + 覆盖度（`missing > 0` 表示有片段的声音没进得来，必须告知）。 */
interface MixedTimelineAudio {
  /** 混音结果；时间轴上没有任何可闻片段时为 `null`。 */
  buffer: AudioBuffer | null;
  /** 应当发声的片段总数。 */
  total: number;
  /** 其中素材读不到、没能混进来的片段数。 */
  missing: number;
}

/**
 * 把时间轴上**所有可闻片段**的音轨叠加成一条（`docs/120` C11.7：M1 走带必须真出声，
 * 故导出也必须真的把声音写进去，不能只有画面）。
 *
 * 可闻 = 轨未 `hidden`、未 `muted`，且片段不是 `image`（图片没有声音）。
 *
 * 返回值带上 `missing` 计数：**「某个片段的音频读不到」不能静默**（否则用户只会在播放、
 * 导出后才发现少了一段声音，且毫无线索）—— 由调用方转成 `AudioOutcome.lost` 明示。
 */
async function mixTimelineAudio(options: {
  tracks: Track[];
  duration: number;
  resolveAudio: ClipAudioResolver;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}): Promise<MixedTimelineAudio> {
  const { tracks, duration, resolveAudio, onProgress, signal } = options;
  const clips = audibleClipsOf(tracks);
  if (clips.length === 0) return { buffer: null, total: 0, missing: 0 };

  const length = Math.max(1, Math.round(duration * MIX_SAMPLE_RATE));
  const channels: MixChannel[] = Array.from(
    { length: MIX_CHANNELS },
    () => new Float32Array(new ArrayBuffer(length * Float32Array.BYTES_PER_ELEMENT)),
  );

  let missing = 0;
  for (const [index, clip] of clips.entries()) {
    if (signal?.aborted) throw new ConversionCanceled();
    const input = resolveAudio(clip);
    if (!input || !(await input.getPrimaryAudioTrack())) missing += 1;
    else await mixClip(channels, length, clip, input);
    onProgress?.((index + 1) / clips.length);
  }

  const buffer = new AudioBuffer({
    length,
    numberOfChannels: MIX_CHANNELS,
    sampleRate: MIX_SAMPLE_RATE,
  });
  for (let channel = 0; channel < MIX_CHANNELS; channel++) {
    buffer.copyToChannel(channels[channel], channel, 0);
  }
  return { buffer, total: clips.length, missing };
}

/* ────────────────────────────────────────────────────────────────
 * 合成导出（逐帧渲染 + 重编码）
 * ──────────────────────────────────────────────────────────────── */

export interface CompositeExportOptions {
  project: Project;
  /** 片段渲染素材（`openTimelineSources` 产物）。 */
  resolveVideo: ClipSourceResolver;
  /** 片段音频输入（`openTimelineSources` 产物）。 */
  resolveAudio: ClipAudioResolver;
  onStage?: (stage: ExportStage) => void;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

export interface CompositeExportResult {
  blob: Blob;
  duration: number;
  width: number;
  height: number;
  fps: number;
  /** 音轨结局（判别联合，见 `AudioOutcome`）。 */
  audio: AudioOutcome;
}

/**
 * 合成导出 —— 多轨叠加 / 图片片段 / 尺寸不一致都走这条路。
 *
 * 与无损直通互斥：这里**逐帧渲染并重编码**，因此支持任意合成，代价是慢且有一次编码损失。
 * 调用方必须先用 `needsCompositing` / `planExport` 判过（「能直通就别进来」，`docs/120` C5）。
 *
 * 进度按 C5 的三段分：**混音 20% / 画面 70% / 写音频 10%** —— 用户能看出「现在卡在哪一步」。
 */
export async function exportComposite(t: CompositeExportOptions): Promise<CompositeExportResult> {
  const { project, resolveVideo, resolveAudio, onStage, onProgress, signal } = t;
  const duration = timelineDuration(project.tracks);
  if (duration <= 0) throw new Error('时间轴为空，没有可导出的内容');

  const canvas: CanvasSize = { width: project.settings.width, height: project.settings.height };
  const fps = project.fps > 0 ? project.fps : 30;
  const surface = document.createElement('canvas');
  surface.width = canvas.width;
  surface.height = canvas.height;
  let output: Output | null = null;
  const throwIfAborted = () => {
    if (signal?.aborted) throw new ConversionCanceled();
  };

  try {
    const context = surface.getContext('2d', { alpha: false });
    if (!context) throw new Error('无法创建合成画布');

    const target = new BufferTarget();
    output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const videoSource = new CanvasSource(surface, { codec: 'avc', bitrate: 5_000_000 });
    output.addVideoTrack(videoSource, { frameRate: fps });

    onStage?.('audio');
    const mixed = await mixTimelineAudio({
      tracks: project.tracks,
      duration,
      resolveAudio,
      signal,
      onProgress: (value) => onProgress?.(value * 0.2),
    });
    const audioSource =
      mixed.buffer !== null ? new AudioBufferSource({ codec: 'aac', bitrate: 128_000 }) : null;
    if (audioSource) output.addAudioTrack(audioSource);

    await output.start();

    onStage?.('video');
    const frameCount = Math.max(1, Math.round(duration * fps));
    const frameDuration = 1 / fps;
    for (let frame = 0; frame < frameCount; frame++) {
      throwIfAborted();
      const time = frame * frameDuration;
      await renderFrameAt(context, canvas, project.tracks, time, resolveVideo);
      await videoSource.add(time, frameDuration);
      onProgress?.(0.2 + (frame / frameCount) * 0.7);
    }
    videoSource.close();

    if (audioSource && mixed.buffer) {
      onStage?.('mux');
      await audioSource.add(mixed.buffer);
      audioSource.close();
      onProgress?.(1);
    }

    await output.finalize();
    if (!target.buffer) throw new Error('合成导出未产生有效数据');
    onProgress?.(1);

    let audio: AudioOutcome;
    if (mixed.total === 0) audio = { status: 'none' };
    else if (mixed.missing === 0) audio = { status: 'kept' };
    else {
      audio = {
        status: 'lost',
        reason: `${mixed.missing}/${mixed.total} 个片段的音频素材读不到，未计入混音`,
      };
    }

    return {
      blob: new Blob([target.buffer], { type: 'video/mp4' }),
      duration,
      width: canvas.width,
      height: canvas.height,
      fps,
      audio,
    };
  } catch (e) {
    if (output && output.state !== 'canceled' && output.state !== 'finalized') {
      await output.cancel().catch((): undefined => undefined);
    }
    if (signal?.aborted) throw new ConversionCanceled();
    throw e;
  } finally {
    // 释放画布占用（4K 画布的位图不小；导出结束就该还回去）
    surface.width = 1;
    surface.height = 1;
  }
}
