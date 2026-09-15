/**
 * mediabunny 技术栈封装（**只做"读元数据/抽帧"这类 mediabunny 真正独有能力**）。
 *
 * 【混音实现已于 2026-09-15 移除（TD-22-29 档 1）】本文件原有第二套混音：
 * `extractTimelineAudio` / `decodeAndMixAudioSource`（+ `createWavBlob` / `writeString`）。
 * 它是「时间轴 → 音频」的第 3 份实现（另两份：实时播放 `collectAudioClips`、
 * 主导出 `collectAudioElements` + `mixAudioChannels`），与主导出**行为漂移**
 * （不应用 `volume` / `reversed`），且产物绕了一次「WAV 编码 → 再解码」往返。
 * 现字幕识别链路直接复用主导出求值（`createTimelineAudioBuffer`）。
 * ⚠️ **不要在这里重新引入混音** —— 要改"该出哪段音频"的判据，改 `audio.ts` 的那一份（唯一）。
 */
import { Input, ALL_FORMATS, BlobSource } from 'mediabunny';

export async function getVideoInfo({ videoFile }: { videoFile: File }): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
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

  return {
    duration,
    width: videoTrack.displayWidth,
    height: videoTrack.displayHeight,
    fps,
  };
}
