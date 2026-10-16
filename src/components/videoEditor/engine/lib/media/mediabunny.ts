/**
 * mediabunny 技术栈封装（**只做"读元数据/抽帧"这类 mediabunny 真正独有能力**）。
 *
 * ⚠️ **不要在这里重新引入混音** ——「时间轴 → 音频」只有一份实现：
 * 判据 `audio.ts::collectAudioSources`（纯函数，预览与导出共用），
 * 取字节/解码 `audio.ts::resolveAudioSourceBuffer`，混轨 `audio.ts::mixAudioChannels`。
 * 字幕识别链路同样复用 `createTimelineAudioBuffer`（导出同一条式子）。
 */
import { Input, ALL_FORMATS, BlobSource } from 'mediabunny';

export async function getVideoInfo({ videoFile }: { videoFile: File }): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
  /** 文件是否含音轨（TD-21-17：驱动时间轴上「带原声视频」的 🔊 角标）。 */
  hasAudio: boolean;
}> {
  const input = new Input({
    source: new BlobSource(videoFile),
    formats: ALL_FORMATS,
  });

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
