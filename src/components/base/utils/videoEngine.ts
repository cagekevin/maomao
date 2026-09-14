/**
 * 视频处理引擎层（复刻官方 shared.js 的 Ec / Dc / Oc / bc）。
 *
 * 官方用 mediabunny（浏览器 WebCodecs 媒体工具包）做视频处理，而非 ffmpeg.wasm / 本地引擎：
 *  - _c()   → import('mediabunny') 主库
 *  - Ec     → 读视频元数据（时长/宽高/fps）
 *  - Dc     → 单输入处理：trim / extractAudio / sizeFrameRate
 *  - Oc     → 多输入拼接（多轨视频 + 音频，按片段区间 + 静音）
 *  - bc     → 进度控制器（attach conversion/output，cancel）
 *  - hi     → 上传（update 2026-09-13：真实落盘 localTool 返回持久 /files/ URL；失败返 null，
 *             不再是原型时代的 URL.createObjectURL 临时地址 —— 见 uploadResult JSDoc / TD-22-2）
 *
 * 用法与官方保持一致：返回 { blob, metadata:{duration,width,height,fps}, mimeType, extension }。
 */
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  ConversionCanceledError,
  Input,
  InputVideoTrack,
  InputAudioTrack,
  Mp3OutputFormat,
  Mp4OutputFormat,
  Output,
  WavOutputFormat,
  AudioBufferSource,
  AudioSampleSink,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  VideoSampleSink,
  VideoSampleSource,
} from 'mediabunny';
// `Rotation` / `VideoCodec` / `AudioCodec` 只作类型（`import type` 编译期擦除，不产生运行时依赖）。
import type { AudioCodec, Rotation, VideoCodec } from 'mediabunny';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { logger } from '../core/logger.ts';
import { uploadFileToLocal } from '../api/filesApi.ts';
import { UPLOAD_DIRS } from './uploadDirs.ts';
import { safeFileName } from '../core/utils.ts';
// TD-22-1：crossOrigin 单点裁决（同源不设 / 真跨源才设 anonymous），不再就地恒设
import { setCrossOriginForReadable } from './captureFrame.ts';
import { releaseQuietly } from './asyncGuard.ts';

/** 进度/结果公共形状 */
interface ProgressOptions {
  controller?: ProgressController;
  onProgress?: (p: number) => void;
}

/** concatVideos 内部每段拼接单元的精确形状（替代原来的 any[]，字段均来自 mediabunny 轨道类型） */
interface ConcatSegment {
  video: InputVideoTrack;
  audio: InputAudioTrack | null;
  sourceDuration: number;
  start: number;
  end: number;
  duration: number;
  muted: boolean;
}
/** processVideo 选项（对齐官方 Dc 的 t） */
export interface ProcessVideoOptions extends ProgressOptions {
  mode: 'trim' | 'extractAudio' | 'sizeFrameRate';
  start?: number;
  end?: number;
  format?: 'm4a' | 'wav' | 'mp3';
  width?: number;
  height?: number;
  fps?: number;
}
/** concatVideos 选项（对齐官方 Oc 的 t） */
interface ConcatOptions extends ProgressOptions {
  segments?: { start?: number; end?: number; muted?: boolean }[];
  width?: number;
  height?: number;
  fps?: number;
}
/** videoToGif 选项（对齐官方 ic） */
interface GifOptions {
  fps?: number;
  maxSize?: number;
  colors?: number;
  startTime?: number;
  endTime?: number;
  speed?: number;
  timeoutMs?: number;
  onProgress?: (p: number) => void;
}
/** 视频元数据形状 */
interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
}
/** 视频处理统一返回形状 */
interface VideoProcessResult {
  blob: Blob;
  metadata: VideoMetadata;
  mimeType: string;
  extension: string;
}

/** 无损直通的一段：原始素材 + 取用区间（秒）。 */
export interface LosslessSegment {
  blob: Blob;
  /** 源入点。**会被吸附到其前方最近的关键帧**（代价：入点精度受关键帧间隔限制，导出后如实回传 `actualStart`）。 */
  start: number;
  /** 源出点（秒）。 */
  end: number;
  /** 显示名，只用于报错文案（让用户知道是哪个片段出了问题）。 */
  label: string;
}

/** 无损直通选项。 */
export interface LosslessExportOptions extends ProgressOptions {
  /** 取消信号（`docs/120` C5.4：全程可中断）。 */
  signal?: AbortSignal;
}

/**
 * 导出产物的**音轨结局**（判别联合）—— 供上层区分「能不能说这是干净的导出」。
 *
 * 三态而不是 `audioKept: boolean` + `reason: string`：真值是三分的 ——
 * 「本来就没有声音」（`none`，不是损失）、「有声音但没能完整带出来」（`lost`，是损失，必须告知）、
 * 「完整带出来了」（`kept`）。用 boolean + 可空原因表达它，调用方只能靠**嗅探原因字符串**判断
 * 「到底算不算降级」—— 那就是把判据写在文案里（`docs/120` C5：如实告知，不静默）。
 *
 * `lost` 不分「整条丢」与「丢一部分」：两者对调用方的处置完全一样（降级 + 把 `reason` 给用户看），
 * 再分一档就是一个**没人读的**状态位（7 步法 A8：状态不预支）。`reason` 里会写明是哪一种。
 */
export type AudioOutcome =
  { status: 'kept' } | { status: 'lost'; reason: string } | { status: 'none' };

/** 无损直通结果。 */
export interface LosslessExportResult {
  blob: Blob;
  metadata: VideoMetadata;
  mimeType: string;
  extension: string;
  /** 入点被吸附到的**真实**起点（秒）—— 关键帧对齐的代价，**如实告知、不假装精确**（`docs/120` C5 继承点 1）。 */
  actualStart: number;
  /** 音轨结局，见 `AudioOutcome`。 */
  audio: AudioOutcome;
}

/** clamp：保证是偶数且 ≥2 */
function Sc(v: number): number {
  return Math.max(2, Math.round(v / 2) * 2);
}
/** clamp：合法 fps（1~120）否则 30 */
function Cc(v: number): number {
  if (Number.isFinite(v) && v >= 1 && v <= 120) return v;
  return 30;
}
/** 构建 48000Hz 双声道空音频缓冲（用于拼接时补齐静音轨） */
function wc(duration: number, sampleRate = 48000, channels = 2): AudioBuffer {
  return new AudioBuffer({
    length: Math.max(1, Math.round(duration * sampleRate)),
    numberOfChannels: channels,
    sampleRate,
  });
}
/** 重采样到目标采样率/声道（官方 Tc） */
async function Tc(
  audioBuffer: AudioBuffer,
  sampleRate = 48000,
  channels = 2,
): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate === sampleRate && audioBuffer.numberOfChannels === channels)
    return audioBuffer;
  const ctx = new OfflineAudioContext(
    channels,
    Math.max(1, Math.round(audioBuffer.duration * sampleRate)),
    sampleRate,
  );
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();
  return ctx.startRendering();
}

/** 用 Blob 构建 mediabunny Input（官方 xc） */
async function xc(blob: Blob): Promise<Input> {
  return new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
}

/** 转换取消错误（官方 yc） */
export class ConversionCanceled extends Error {
  constructor(message = '视频处理已取消') {
    super(message);
    this.name = 'ConversionCanceledError';
  }
}

/** mediabunny 组件最小可取消契约（conversion/output attach 的对象只需提供 cancel）。 */
interface Cancelable {
  cancel(): void | Promise<unknown>;
}

/** 进度控制器（官方 bc）：attach conversion / output，支持 cancel */
export class ProgressController {
  conversion: Cancelable | null = null;
  output: Cancelable | null = null;
  canceled = false;
  get isCanceled() {
    return this.canceled;
  }
  // conversion/output 的 cancel() 来自手动装配的 mediabunny 组件，签名随版本不稳，用最小 Cancelable 契约兜底（官方 bc）
  attach(conversion: Cancelable) {
    this.conversion = conversion;
    if (this.canceled) conversion.cancel();
  }
  attachOutput(output: Cancelable) {
    this.output = output;
    if (this.canceled) output.cancel();
  }
  async cancel() {
    this.canceled = true;
    await Promise.allSettled([this.conversion?.cancel(), this.output?.cancel()].filter((e) => e));
  }
}

/** 读视频元数据（官方 Ec）→ { duration, width, height, fps } */
export async function readVideoMetadata(blob: Blob): Promise<VideoMetadata> {
  const input = await xc(blob);
  try {
    if (!(await input.canRead())) throw new Error('无法识别视频格式');
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('输入文件不包含视频轨道');
    const [duration, width, height, stats] = await Promise.all([
      input.getDurationFromMetadata(),
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.computePacketStats(120).catch((): null => null),
    ]);
    const dur = duration ?? (await input.computeDuration());
    return {
      duration: Number.isFinite(dur) ? dur : 0,
      width,
      height,
      fps: Cc(stats?.averagePacketRate ?? 0),
    };
  } finally {
    input.dispose();
  }
}

/**
 * 媒体**探测**结果（用于「这个素材能不能用、多长、多大」）。
 *
 * 与 `readVideoMetadata` 的区别（**不是同一件事的两份实现**）：
 *  - `readVideoMetadata` 是**元数据读取器**：要求必须有视频轨（纯音频会抛），失败靠抛；
 *  - 本函数是**探测**：三态可判别（`ok` / `failed` + 原因）、**纯音频也认**、**不抛**。
 *    调用方（素材入轨 / 断链判定）需要的是「能不能读 + 多长」，而不是「读不到就炸」。
 */
export type MediaProbe =
  | { status: 'ok'; width?: number; height?: number; duration: number; hasAudioTrack?: boolean }
  | { status: 'failed'; reason: string };

/**
 * 探测一个媒体文件（视频 / 音频）的可读性、时长与尺寸。
 *
 * 图片不走这里（浏览器侧 `createImageBitmap` 即可，且没有「时长」概念）；
 * 由调用方按素材类别分流。
 */
export async function probeMediaTrack(blob: Blob): Promise<MediaProbe> {
  let input: Input;
  try {
    input = await xc(blob);
  } catch (e) {
    return { status: 'failed', reason: e instanceof Error ? e.message : '无法打开媒体文件' };
  }
  try {
    if (!(await input.canRead())) return { status: 'failed', reason: '无法识别媒体格式' };
    const raw = (await input.getDurationFromMetadata()) ?? (await input.computeDuration());
    const duration = Number.isFinite(raw) ? raw : 0;

    const video = await input.getPrimaryVideoTrack();
    if (video) {
      // `hasAudioTrack`：视频片段音轨**内联**在片段里（docs/120 C4.7），
      // 是否取到音频轨决定 🔊 角标 —— 一次探测给出，不另读第二次文件。
      let hasAudioTrack = false;
      try {
        const audio = await input.getPrimaryAudioTrack();
        hasAudioTrack = !!audio;
      } catch {
        hasAudioTrack = false;
      }
      return {
        status: 'ok',
        width: await video.getDisplayWidth(),
        height: await video.getDisplayHeight(),
        duration,
        hasAudioTrack,
      };
    }
    const audio = await input.getPrimaryAudioTrack();
    if (audio) return { status: 'ok', duration, hasAudioTrack: true };
    return { status: 'failed', reason: '文件里没有可用的视频或音频轨' };
  } catch (e) {
    return { status: 'failed', reason: e instanceof Error ? e.message : '媒体探测失败' };
  } finally {
    input.dispose();
  }
}

/**
 * 单输入处理（官方 Dc）：trim / extractAudio / sizeFrameRate。
 * @param {Blob} blob 输入视频
 * @param {object} t { mode, start, end, format, width, height, fps, controller, onProgress }
 * @returns {{ blob, metadata, mimeType, extension }}
 */
export async function processVideo(
  blob: Blob,
  t: ProcessVideoOptions,
): Promise<VideoProcessResult> {
  const input = await xc(blob);
  const target = new BufferTarget();
  try {
    if (!(await input.canRead())) throw new Error('无法识别视频格式');
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!videoTrack) throw new Error('输入文件不包含视频轨道');
    if (t.mode === 'extractAudio' && !audioTrack) throw new Error('该视频不包含可提取的音频轨道');
    if (t.controller?.isCanceled) throw new ConversionCanceled();

    // init 在下方多分支动态补 trim/video/audio 字段，用 Record 兜底并整体断言给 Conversion.init
    const init: Record<string, unknown> = {
      input,
      output: new Output({
        format:
          t.mode !== 'extractAudio' || t.format === 'm4a'
            ? new Mp4OutputFormat({ fastStart: 'in-memory' })
            : t.format === 'wav'
              ? new WavOutputFormat()
              : new Mp3OutputFormat(),
        target,
      }),
      tracks: 'primary',
      showWarnings: false,
    };
    if (t.mode === 'trim') {
      init.trim = { start: t.start, end: t.end };
      init.video = {};
      init.audio = {};
    } else if (t.mode === 'extractAudio') {
      init.video = { discard: true };
      if (t.format === 'm4a') {
        init.audio = { codec: 'aac' };
      } else if (t.format === 'wav') {
        init.audio = { codec: 'pcm-s16' };
      } else {
        init.audio = { codec: 'mp3', bitrate: 192000 };
      }
    } else {
      // sizeFrameRate
      init.video = {
        codec: 'avc',
        width: t.width,
        height: t.height,
        fit: 'contain',
        frameRate: t.fps,
      };
      init.audio = { codec: 'aac' };
    }

    const conversion = await Conversion.init(
      init as unknown as Parameters<typeof Conversion.init>[0],
    );
    t.controller?.attach(conversion);
    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks.map((e) => e.reason).join('、');
      throw new Error(
        reasons ? `当前浏览器无法完成此处理：${reasons}` : '当前浏览器无法完成此处理',
      );
    }
    conversion.onProgress = (e) => t.onProgress?.(e);
    await conversion.execute();
    if (!target.buffer) throw new Error('视频处理未生成输出文件');

    const duration =
      t.mode === 'trim'
        ? (t.end ?? 0) - (t.start ?? 0)
        : ((await input.getDurationFromMetadata()) ?? (await input.computeDuration()));
    const width = (t.mode === 'sizeFrameRate' ? t.width : await videoTrack.getDisplayWidth()) ?? 0;
    const height =
      (t.mode === 'sizeFrameRate' ? t.height : await videoTrack.getDisplayHeight()) ?? 0;
    const fps = Cc(
      (await videoTrack.computePacketStats(120).catch((): null => null))?.averagePacketRate ?? 0,
    );
    const finalFps = (t.mode === 'sizeFrameRate' ? t.fps : fps) ?? 0;
    const mimeType =
      t.mode === 'extractAudio'
        ? t.format === 'm4a'
          ? 'audio/mp4'
          : t.format === 'wav'
            ? 'audio/wav'
            : 'audio/mpeg'
        : 'video/mp4';
    const extension = t.mode === 'extractAudio' ? t.format : 'mp4';
    return {
      blob: new Blob([target.buffer], { type: mimeType ?? 'video/mp4' }),
      metadata: { duration, width, height, fps: finalFps },
      mimeType: mimeType ?? 'video/mp4',
      extension: extension ?? 'mp4',
    };
  } catch (e) {
    throw e instanceof ConversionCanceledError ? new ConversionCanceled(e.message) : e;
  } finally {
    input.dispose();
  }
}

/**
 * 多输入拼接（官方 Oc）。至少 2 个视频，取最大宽高 + 目标 fps，逐段写入。
 * @param {Blob[]} blobs 输入视频（顺序=导出顺序）
 * @param {object} t { segments:[{start,end,muted}], controller, onProgress, width, height, fps }
 * @returns {{ blob, metadata, mimeType, extension }}
 */
export async function concatVideos(
  blobs: Blob[],
  t: ConcatOptions = {},
): Promise<VideoProcessResult> {
  if (blobs.length < 2) throw new Error('视频拼接至少需要 2 个输入视频');
  const inputs: Input[] = [];
  let outputTarget: Output | null = null;
  try {
    for (const b of blobs) inputs.push(await xc(b));
    const items: ConcatSegment[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (!(await input.canRead())) throw new Error(`第 ${i + 1} 个视频格式无法识别`);
      const v = await input.getPrimaryVideoTrack();
      if (!v) throw new Error(`第 ${i + 1} 个输入不包含视频轨道`);
      const sourceDuration = (await v.getDurationFromMetadata()) ?? (await v.computeDuration());
      if (!Number.isFinite(sourceDuration) || sourceDuration <= 0)
        throw new Error(`第 ${i + 1} 个视频时长无效`);
      const seg = t.segments?.[i];
      const start = Math.max(0, Math.min(seg?.start ?? 0, sourceDuration));
      const end = Math.max(start, Math.min(seg?.end ?? sourceDuration, sourceDuration));
      const duration = end - start;
      if (duration <= 0) throw new Error(`第 ${i + 1} 个片段范围无效`);
      items.push({
        video: v,
        audio: await input.getPrimaryAudioTrack(),
        sourceDuration,
        start,
        end,
        duration,
        muted: !!seg?.muted,
      });
    }
    if (t.controller?.isCanceled) throw new ConversionCanceled();

    const stats = await items[0].video.computePacketStats(120).catch((): null => null);
    let maxW = 0;
    let maxH = 0;
    for (const it of items) {
      const w = await it.video.getDisplayWidth();
      const h = await it.video.getDisplayHeight();
      if (w > maxW) maxW = w;
      if (h > maxH) maxH = h;
    }
    const outW = Sc(t.width ?? maxW);
    const outH = Sc(t.height ?? maxH);
    const outFps = Cc(t.fps ?? stats?.averagePacketRate ?? 30);
    const totalDur = items.reduce((s, it) => s + it.duration, 0);

    const target = new BufferTarget();
    outputTarget = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    });
    t.controller?.attachOutput(outputTarget);

    // 编码输出统一用 `*Source` 系列：VideoSampleSource / AudioBufferSource 构造参数是 Video/AudioEncodingConfig，
    // `.add(sample)` 编码后送进输出；addVideoTrack / addAudioTrack 第一参类型约束为 VideoSource / AudioSource，运行时
    // 会做 instanceof 校验。历史反例：videoSink 曾被 `new VideoSampleSink({...} as never)` + `: any` 掩盖——VideoSampleSink
    // 是解码侧 sink（非 VideoSource），addVideoTrack 运行时会抛 TypeError，且 `as never`/`any` 让下游彻底失类型（官方 Oc 复刻，已修正）。
    const videoSource = new VideoSampleSource({
      codec: 'avc',
      bitrate: 5000000,
      sizeChangeBehavior: 'contain',
      transform: { width: outW, height: outH, fit: 'contain', frameRate: outFps },
    });
    const audioSource = new AudioBufferSource({
      codec: 'aac',
      bitrate: 192000,
      transform: { sampleRate: 48000, numberOfChannels: 2 },
    });
    outputTarget.addVideoTrack(videoSource, { frameRate: outFps });
    outputTarget.addAudioTrack(audioSource);
    await outputTarget.start();

    let progressMax = 0;
    const report = (e: number) => {
      const p = Math.max(progressMax, Math.min(1, e));
      progressMax = p;
      t.onProgress?.(p);
    };
    let timeline = 0;
    for (let i = 0; i < items.length; i++) {
      if (t.controller?.isCanceled) throw new ConversionCanceled();
      const it = items[i];
      // 解码用 VideoSampleSink（构造参数 InputVideoTrack，.samples(start,end) 读样本流）；输出编码走 videoSource（见上）
      const source = new VideoSampleSink(it.video);
      for await (const sample of source.samples(it.start, it.end)) {
        try {
          if (t.controller?.isCanceled) throw new ConversionCanceled();
          const rel = sample.timestamp - it.start;
          if (rel < 0) continue;
          if (rel >= it.duration) break;
          sample.setTimestamp(timeline + rel);
          if (rel + sample.duration > it.duration) sample.setDuration(it.duration - rel);
          await videoSource.add(sample);
          report((timeline + Math.min(it.duration, rel)) / totalDur);
        } finally {
          sample.close();
        }
      }
      if (it.audio && !it.muted) {
        // 解码用 audioIn（AudioSampleSink 只读样本流，无 .add）；混音后的 buf 喂给外层编码器 audioSource。
        // ⚠️ 命名避 shadow：此前沿用 audioSource 会让下方 audioSource.add(buf) 误指解码 sink 而 TS 报
        //   "Property 'add' does not exist"（AudioSampleSink 无 add），运行时也会 TypeError——解码/编码必须两对象。
        const audioIn: AudioSampleSink = new AudioSampleSink(it.audio);
        const firstTs = (await it.audio.getFirstTimestamp()) + it.start;
        const rate = await it.audio.getSampleRate();
        const ch = await it.audio.getNumberOfChannels();
        const buf = new AudioBuffer({
          length: Math.max(1, Math.round(it.duration * rate)),
          numberOfChannels: ch,
          sampleRate: rate,
        });
        for await (const sample of audioIn.samples(firstTs, firstTs + it.duration)) {
          try {
            if (t.controller?.isCanceled) throw new ConversionCanceled();
            const rel = sample.timestamp - firstTs;
            if (rel >= it.duration) break;
            const sampleBuf = sample.toAudioBuffer();
            const l = Math.max(0, Math.round(rel * rate));
            const u = Math.max(0, Math.round(-rel * rate));
            const d = Math.min(sampleBuf.length - u, buf.length - l);
            if (d <= 0) continue;
            for (let c = 0; c < ch; c++) {
              const data = sampleBuf.getChannelData(Math.min(c, sampleBuf.numberOfChannels - 1));
              buf.copyToChannel(data.subarray(u, u + d), c, l);
            }
          } finally {
            sample.close();
          }
        }
        await audioSource.add(await Tc(buf));
      } else {
        await audioSource.add(wc(it.duration));
      }
      timeline += it.duration;
      report(timeline / totalDur);
    }
    videoSource.close();
    audioSource.close();
    await outputTarget.finalize();
    if (!target.buffer) throw new Error('视频拼接未生成输出文件');
    return {
      blob: new Blob([target.buffer], { type: 'video/mp4' }),
      metadata: { duration: totalDur, width: outW, height: outH, fps: outFps },
      mimeType: 'video/mp4',
      extension: 'mp4',
    };
  } catch (e) {
    if (outputTarget && outputTarget.state !== 'canceled' && outputTarget.state !== 'finalized') {
      await outputTarget.cancel().catch((): undefined => undefined);
    }
    throw t.controller?.isCanceled ? new ConversionCanceled() : e;
  } finally {
    for (const i of inputs) i.dispose();
  }
}

/**
 * 无损直通导出（分组搬运，**绕开编解码器**）—— `docs/120` C5 继承点 1 · `docs/123` §一.6 P1。
 *
 * ── 为什么不能用 `Conversion`（trim 模式）──
 * 入点不在关键帧上时，mediabunny 的 `Conversion` 会**强制重编码**（`firstTimestamp < startTimestamp`）；
 * 这就把「无损」卖掉了，还白白跑一遍编码器（4K 上足以让导出不可用）。
 * 故这里直接搬已编码分组：从入点前最近的关键帧开始，把分组原样写进新容器、时间戳平移到零点。
 * 全程不碰编解码器 ⇒ 又快又不掉画质；**代价是入点精度受关键帧间隔限制**，返回值里的
 * `actualStart` 就是这个代价的诚实回执（UI 据此提示，不假装精确）。
 *
 * ── 单段与多段是同一件事 ──
 * 只暴露**一个**入口（不是 `exportLosslessTrim` + `exportLosslessConcat` 两个名）：
 * 「一段」只是「多段」的退化情形，两个入口会逼调用方各自判一次「该调哪个」= 同一真相两处判。
 *
 * ── 多段的前提是解码参数一致 ──
 * 直通复制要求各段共用同一套解码参数（编码 + 尺寸）。不一致时**明确报错**，
 * 宁可让调用方改走合成重编码，也不产出一个播不动的文件（`docs/120` C5）。
 *
 * ── 音轨的两条出口 ──
 * 编码被目标容器接受**且**各段解码参数一致 → `EncodedAudioPacketSource` 原样搬（零 CPU、零损）；
 * 否则**丢弃音轨**并在 `audioDropReason` 里如实说明 —— 丢一条音轨，总比整个导出失败好。
 *
 * @param segments 按导出顺序排列的片段（≥1）
 * @param t        进度 / 取消
 */
export async function exportLossless(
  segments: LosslessSegment[],
  t: LosslessExportOptions = {},
): Promise<LosslessExportResult> {
  if (segments.length === 0) throw new Error('没有可导出的片段');
  const inputs: Input[] = [];
  let output: Output | null = null;
  const cancels = () => t.controller?.isCanceled === true || t.signal?.aborted === true;
  const throwIfAborted = () => {
    if (cancels()) throw new ConversionCanceled();
  };

  try {
    interface Prepared {
      seg: LosslessSegment;
      video: InputVideoTrack;
      codec: VideoCodec;
      width: number;
      height: number;
      rotation: Rotation;
      audio: InputAudioTrack | null;
      audioCodec: AudioCodec | null;
      /** 音频解码参数签名；各段一致才允许直通搬运音轨。 */
      audioSignature: string | null;
    }

    for (const seg of segments) inputs.push(await xc(seg.blob));

    const prepared: Prepared[] = [];
    for (let i = 0; i < inputs.length; i++) {
      throwIfAborted();
      const input = inputs[i];
      const seg = segments[i];
      if (!Number.isFinite(seg.start) || !Number.isFinite(seg.end) || seg.end <= seg.start) {
        throw new Error(`片段「${seg.label}」的区间无效：出点必须大于入点`);
      }
      if (!(await input.canRead())) throw new Error(`片段「${seg.label}」格式无法识别`);
      const video = await input.getPrimaryVideoTrack();
      if (!video) throw new Error(`片段「${seg.label}」没有视频轨`);
      const codec = await video.getCodec();
      if (!codec)
        throw new Error(`片段「${seg.label}」无法识别源编码，无法直通（请改走合成重编码）`);
      const audio = await input.getPrimaryAudioTrack();
      const audioCodec = audio ? await audio.getCodec() : null;
      const audioConfig = audio ? await audio.getDecoderConfig() : null;
      prepared.push({
        seg,
        video,
        codec,
        width: await video.getDisplayWidth(),
        height: await video.getDisplayHeight(),
        rotation: await video.getRotation(),
        audio,
        audioCodec,
        audioSignature: audioConfig
          ? `${audioConfig.codec}|${audioConfig.sampleRate}|${audioConfig.numberOfChannels}`
          : null,
      });
    }

    const first = prepared[0];
    const mismatched = prepared.find(
      (p) => p.codec !== first.codec || p.width !== first.width || p.height !== first.height,
    );
    if (mismatched) {
      throw new Error(
        `片段「${mismatched.seg.label}」的编码或分辨率与首个片段不一致，无法无损直通` +
          `（${mismatched.codec} ${mismatched.width}×${mismatched.height} vs ` +
          `${first.codec} ${first.width}×${first.height}）—— 请改走合成重编码`,
      );
    }

    const target = new BufferTarget();
    output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    t.controller?.attachOutput(output);

    if (!output.format.getSupportedVideoCodecs().includes(first.codec)) {
      throw new Error(`MP4 容器不支持源视频编码 ${first.codec}，无法无损直通`);
    }
    const videoSource = new EncodedVideoPacketSource(first.codec);
    // 旋转走容器元数据（不烤进帧）：这是「无损」的一部分 —— 重编码会把旋转烤进像素。
    output.addVideoTrack(videoSource, { rotation: first.rotation });

    const keepAudio =
      first.audioCodec !== null &&
      first.audioSignature !== null &&
      output.format.getSupportedAudioCodecs().includes(first.audioCodec) &&
      prepared.every((p) => p.audioSignature === first.audioSignature);
    const audioSource =
      keepAudio && first.audioCodec ? new EncodedAudioPacketSource(first.audioCodec) : null;
    if (audioSource) output.addAudioTrack(audioSource);

    await output.start();

    let timelineCursor = 0;
    let firstVideoPacket = true;
    let firstAudioPacket = true;
    let actualStart = 0;
    const totalSpan = prepared.reduce((sum, p) => sum + (p.seg.end - p.seg.start), 0);

    for (const [index, p] of prepared.entries()) {
      throwIfAborted();
      // 入点吸附到前一个关键帧：否则解码器拿不到参考帧，画面会花。
      const videoSink = new EncodedPacketSink(p.video);
      const startPacket =
        (await videoSink.getKeyPacket(p.seg.start)) ?? (await videoSink.getFirstKeyPacket());
      if (!startPacket) throw new Error(`片段「${p.seg.label}」没有可用的关键帧`);
      if (index === 0) actualStart = startPacket.timestamp;
      // 画面与声音共用同一个基准点，拼接点上两轨才对齐。
      const base = startPacket.timestamp;
      const videoDecoderConfig = await p.video.getDecoderConfig();

      for await (const packet of videoSink.packets(startPacket)) {
        throwIfAborted();
        if (packet.timestamp >= p.seg.end) break;
        await videoSource.add(
          packet.clone({ timestamp: timelineCursor + (packet.timestamp - base) }),
          firstVideoPacket && videoDecoderConfig
            ? { decoderConfig: videoDecoderConfig }
            : undefined,
        );
        firstVideoPacket = false;
        if (totalSpan > 0) {
          const done = timelineCursor + Math.max(0, packet.timestamp - base);
          t.onProgress?.(Math.min(1, done / totalSpan));
        }
      }

      if (audioSource && p.audio) {
        const audioSink = new EncodedPacketSink(p.audio);
        const audioStart = (await audioSink.getPacket(base)) ?? undefined;
        const audioDecoderConfig = await p.audio.getDecoderConfig();
        for await (const packet of audioSink.packets(audioStart)) {
          throwIfAborted();
          if (packet.timestamp >= p.seg.end) break;
          const shifted = timelineCursor + (packet.timestamp - base);
          // 音频分组可能早于入点，平移后为负会被容器拒绝
          if (shifted < 0) continue;
          await audioSource.add(
            packet.clone({ timestamp: shifted }),
            firstAudioPacket && audioDecoderConfig
              ? { decoderConfig: audioDecoderConfig }
              : undefined,
          );
          firstAudioPacket = false;
        }
      }
      timelineCursor += p.seg.end - base;
    }

    videoSource.close();
    audioSource?.close();
    await output.finalize();
    if (!target.buffer) throw new Error('无损导出未产生有效数据');
    t.onProgress?.(1);

    const stats = await first.video.computePacketStats(120).catch((): null => null);
    let audio: AudioOutcome;
    if (audioSource) audio = { status: 'kept' };
    else if (!first.audio) audio = { status: 'none' };
    else if (!first.audioCodec) audio = { status: 'lost', reason: '无法识别源音频编码' };
    else {
      audio = {
        status: 'lost',
        reason: `MP4 不接受源音频编码 ${first.audioCodec}，或各段音频参数不一致`,
      };
    }
    return {
      blob: new Blob([target.buffer], { type: 'video/mp4' }),
      metadata: {
        duration: timelineCursor,
        width: first.width,
        height: first.height,
        fps: Cc(stats?.averagePacketRate ?? 0),
      },
      mimeType: 'video/mp4',
      extension: 'mp4',
      actualStart,
      audio,
    };
  } catch (e) {
    if (output && output.state !== 'canceled' && output.state !== 'finalized') {
      await output.cancel().catch((): undefined => undefined);
    }
    if (cancels()) throw new ConversionCanceled();
    throw e instanceof ConversionCanceledError ? new ConversionCanceled(e.message) : e;
  } finally {
    for (const i of inputs) i.dispose();
  }
}

/** 加载 video 元素（复刻官方 nc.jsx）：onloadedmetadata 后 resolve，带超时 */
function loadVideoElement(url: string, timeoutMs = 15000): Promise<HTMLVideoElement> {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video');
    setCrossOriginForReadable(video, url); // TD-22-1：单点裁决（videoToGif 会 getImageData 读回）
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    const timer = window.setTimeout(() => {
      reject(new Error('视频加载超时'));
    }, timeoutMs);
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      resolve(video);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('视频加载失败（可能是跨域或格式不支持）'));
    };
  });
}

/** seek 视频并等待 seeked（复刻官方 rc） */
function seekVideo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = t;
  });
}

/** 格式化文件大小（复刻官方 uc）：B / KB / MB */
export function formatBytes(e: number): string {
  if (e < 1024) return `${e} B`;
  if (e < 1048576) return `${(e / 1024).toFixed(1)} KB`;
  return `${(e / 1048576).toFixed(2)} MB`;
}

/**
 * 视频转 GIF（复刻官方 ic.jsx）。
 * @param {string} url 视频地址（blob / http / data）
 * @param {object} t { fps=10, maxSize=480, colors=256, startTime=0, endTime, speed=1, timeoutMs=30000, onProgress }
 * @returns {Promise<{blob, width, height, frameCount, size}>}
 */
export async function videoToGif(
  url: string,
  t: GifOptions = {},
): Promise<{ blob: Blob; width: number; height: number; frameCount: number; size: number }> {
  const {
    fps = 10,
    maxSize = 480,
    colors = 256,
    startTime = 0,
    endTime,
    speed = 1,
    timeoutMs = 30000,
    onProgress,
  } = t;
  const video = await loadVideoElement(url, timeoutMs);
  const duration = video.duration;
  if (!duration || isNaN(duration) || duration === Infinity) throw new Error('无法获取视频时长');
  const start = Math.max(0, startTime);
  const end = Math.min(endTime ?? duration, duration);
  const span = Math.max(0.1, end - start);
  let w = video.videoWidth;
  let h = video.videoHeight;
  if (!w || !h) throw new Error('无法获取视频尺寸');
  // 等比缩放至 maxSize 内（长边 = maxSize）
  if (w > maxSize || h > maxSize) {
    if (w >= h) {
      h = Math.round((h * maxSize) / w);
      w = maxSize;
    } else {
      w = Math.round((w * maxSize) / h);
      h = maxSize;
    }
  }
  w = Math.max(2, w - (w % 2));
  h = Math.max(2, h - (h % 2));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D 不可用');
  const realFps = Math.max(0.5, Math.min(30, fps));
  const realSpeed = Math.max(0.1, Math.min(8, speed));
  const frameCount = Math.max(1, Math.round(span * realFps));
  const delay = Math.max(20, Math.round(1000 / realFps / realSpeed));
  const paletteSize = Math.max(2, Math.min(256, colors));
  const encoder = GIFEncoder();
  for (let i = 0; i < frameCount; i++) {
    const time = start + i / realFps;
    await seekVideo(video, Math.min(time, end));
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const palette = quantize(data, paletteSize);
    const index = applyPalette(data, palette);
    encoder.writeFrame(index, w, h, { palette, delay });
    onProgress?.((i + 1) / frameCount);
    await new Promise((r) => setTimeout(r, 0));
  }
  encoder.finish();
  video.removeAttribute('src');
  releaseQuietly(() => video.load());
  const bytes = encoder.bytes();
  const arr = new Uint8Array(bytes.length);
  arr.set(bytes);
  const blob = new Blob([arr], { type: 'image/gif' });
  return { blob, width: w, height: h, frameCount, size: blob.size };
}

/**
 * 上传/持久化（官方 hi）。
 * 【修复】此前原型直接 URL.createObjectURL 生成临时地址，刷新即失效 → 视频处理产物丢失。
 * 现在真正落盘到 localTool（POST /api/files/upload），返回持久 /files/ URL。
 *
 * 【TD-22-2 修复（2026-09-13·错误透传铁律）】落盘失败**返回 null**，不再伪造临时 blob: URL
 * 冒充成功 —— 旧兜底让消费方拿到"刷新即失效的节点"却弹「完成」toast（假成功）。
 * 与 `filesApi.uploadFileToLocal`（失败返 null）同一纪律：失败可见，由消费方显式报错。
 * 深审实证（22 区第七轮）：同仓 depthVideo / director3d 均已避开此兜底，本处是最后一处反模式。
 *
 * @param {Blob|string} blob 处理后的文件（Blob）或已持久 URL（字符串原样返回）
 * @param {{ subfolder?: string }} [opts] 落盘子目录（默认 canvas/video-process）
 * @returns {Promise<{ url: string } | null>} 成功 = 持久 URL；落盘失败/异常 = null（调用方必须处理）
 */
export async function uploadResult(
  blob: Blob | string,
  _opts: { subfolder?: string } = {},
): Promise<{ url: string } | null> {
  if (typeof blob === 'string') return { url: blob };
  const subfolder = _opts?.subfolder || UPLOAD_DIRS.videoProcess;
  try {
    // blob 运行时实为 File，读 .name（Blob 类型无该字段，这里缩小为 File 取原始文件名）
    const name = safeFileName(
      (blob as File).name || `video_${Date.now()}.${blob.type?.split('/')[1] || 'mp4'}`,
    );
    const url = await uploadFileToLocal(blob, subfolder, name);
    if (url) return { url };
    logger.warn('videoEngine', '视频产物落盘失败（本地服务未启动？）—— 不再降级为临时 blob URL');
    return null;
  } catch (e) {
    logger.warn('videoEngine', '视频产物落盘异常 —— 不再降级为临时 blob URL', e);
    return null;
  }
}
