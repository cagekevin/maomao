/**
 * Web Audio 替身（`AudioBuffer` / `AudioContext`）。
 *
 * 【为什么这里允许"一次双转"】jsdom **不实现** Web Audio：`AudioContext` 构造即抛，
 * `AudioBuffer` 也没有可用的构造器。而被测逻辑（混音 / 波形 / 导出）只用到少数成员
 * （`numberOfChannels` / `length` / `sampleRate` / `getChannelData` / `createBuffer` /
 * `decodeAudioData`）—— 属**能力缺口**，不是类型谎报（同 `helpers/dom.ts` / `events.ts`）。
 *
 * 调用点只描述差异，不再各自拼形状 + 断言。
 */

/** 假 `AudioBuffer`：由声道数据反推 length / duration。 */
export function fakeAudioBuffer(init: {
  channels: Float32Array[];
  sampleRate?: number;
}): AudioBuffer {
  const sampleRate = init.sampleRate ?? 44100;
  const length = init.channels[0]?.length ?? 0;
  return {
    numberOfChannels: init.channels.length,
    length,
    sampleRate,
    duration: length / sampleRate,
    getChannelData: (index: number) => init.channels[index],
  } as unknown as AudioBuffer;
}

/** 假 `AudioContext`：只补 `createBuffer` / `decodeAudioData`（其余成员被测逻辑不读）。 */
export function fakeAudioContext(
  init: {
    createBuffer?: (numberOfChannels: number, length: number, sampleRate: number) => AudioBuffer;
    decodeAudioData?: (data: ArrayBuffer) => Promise<AudioBuffer>;
  } = {},
): AudioContext {
  return {
    createBuffer:
      init.createBuffer ??
      ((numberOfChannels: number, length: number, sampleRate: number) =>
        fakeAudioBuffer({
          channels: Array.from({ length: numberOfChannels }, () => new Float32Array(length)),
          sampleRate,
        })),
    decodeAudioData:
      init.decodeAudioData ?? (async () => fakeAudioBuffer({ channels: [new Float32Array(0)] })),
  } as unknown as AudioContext;
}
