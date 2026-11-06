/**
 * mediabunny 技术栈封装（**只做"读元数据/抽帧"这类 mediabunny 真正独有能力**）。
 *
 * ⚠️ **不要在这里重新引入混音** ——「时间轴 → 音频」只有一份实现：
 * 判据 `audio.ts::collectAudioSources`（纯函数，预览与导出共用），
 * 取字节/解码 `audio.ts::resolveAudioSourceBuffer`，混轨 `audio.ts::mixAudioChannels`。
 * 字幕识别链路同样复用 `createTimelineAudioBuffer`（导出同一条式子）。
 */
import { Input, ALL_FORMATS, BlobSource, VideoSampleSink, type InputVideoTrack } from 'mediabunny';

/**
 * 打开视频解码管线：`Input → 主视频轨 → canDecode 校验 → VideoSampleSink` 的**唯一前奏**
 * （2026-11-06 · V6 收口：此前 5 处手抄同一段——processing 两处、timeline-thumbnail、video-cache、
 * 本文件 getVideoInfo；改一处必漏另一处）。
 *
 * 【为什么收进本文件】本文件已自称「mediabunny 技术栈封装唯一入口」；解码前奏是
 * mediabunny 库的原生动作（Input/BlobSource/VideoSampleSink 全来自它），归属一致。
 *
 * 【降级差异归调用方】「无轨 / 不可解码」时各消费方的失败语义不同：
 *  · thumbnail/processing（抽帧路径）→ throw（本函数默认行为，错误文案与原 5 处一致）；
 *  · timeline-thumbnail → 捕获后返回 null（缩略图是锦上添花，不阻断主流程）；
 *  · video-cache → 捕获后 toast + 留痕（播放失败可见）。
 *  本函数只负责**前奏成功**这一件事，不替调用方决定失败怎么呈现。
 *
 * @param opts.sinkless 跳过创建 sink（getVideoInfo 只读元数据，不需要）；此时返回类型收窄为
 * `{ input, videoTrack, sink: null }`（重载二）。
 */
export async function openVideoSink({
  videoFile,
}: {
  videoFile: File;
}): Promise<{ input: Input; sink: VideoSampleSink; videoTrack: InputVideoTrack }>;
export async function openVideoSink(
  { videoFile }: { videoFile: File },
  opts: { sinkless: true },
): Promise<{ input: Input; sink: null; videoTrack: InputVideoTrack }>;
export async function openVideoSink(
  { videoFile }: { videoFile: File },
  opts?: { sinkless?: boolean },
): Promise<{
  input: Input;
  sink: VideoSampleSink | null;
  /** 主视频轨（抽帧路径读 displayWidth/Height 用；sinkless 时仍返回）。 */
  videoTrack: InputVideoTrack;
}> {
  const input = new Input({
    source: new BlobSource(videoFile),
    formats: ALL_FORMATS,
  });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) {
    throw new Error('No video track found in the file');
  }

  const canDecode = await videoTrack.canDecode();
  if (!canDecode) {
    throw new Error('Video codec not supported for decoding');
  }

  return { input, sink: opts?.sinkless ? null : new VideoSampleSink(videoTrack), videoTrack };
}

export async function getVideoInfo({ videoFile }: { videoFile: File }): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
  /** 文件是否含音轨（TD-21-17：驱动时间轴上「带原声视频」的 🔊 角标）。 */
  hasAudio: boolean;
}> {
  // 【2026-11-06 · V6】Input 创建走 openVideoSink 唯一前奏（元数据只读，不需要 sink）。
  const { input } = await openVideoSink({ videoFile }, { sinkless: true });

  const duration = await input.computeDuration();
  const videoTrack = await input.getPrimaryVideoTrack();

  if (!videoTrack) {
    throw new Error('No video track found in the file');
  }

  const packetStats = await videoTrack.computePacketStats(100);
  const fps = packetStats.averagePacketRate;

  // TD-21-17：探测音轨存在性（同一 Input 上，成本极低）——角标只在**确知有音轨**时才亮。
  const audioTrack = await input.getPrimaryAudioTrack();
  const hasAudio = audioTrack != null;

  return {
    duration,
    width: videoTrack.displayWidth,
    height: videoTrack.displayHeight,
    fps,
    hasAudio,
  };
}
