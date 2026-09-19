/**
 * encoderProbe 单测（卡 7 · docs/126）。
 * 覆盖判别联合的四条出口（webcodecs / video / audio / ok）+ memo（同 UA 同参数返回同一 Promise）。
 * 端口可注入 → 用假端口断言真实分支，不依赖 mediabunny / 真实 WebCodecs。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type {
  EncoderProbeRequest,
  EncoderQueryPort,
} from '../../src/components/director3d/encoderProbe.ts';

type FakePort = EncoderQueryPort & {
  video: ReturnType<typeof vi.fn>;
  audio: ReturnType<typeof vi.fn>;
};

function fakePort(video: string | null, audio: string | null): FakePort {
  return {
    video: vi.fn(async () => video as never),
    audio: vi.fn(async () => audio as never),
  } as unknown as FakePort;
}

const REQ: EncoderProbeRequest = { videoCodecs: ['avc', 'av1', 'vp9'] as never };

let savedVideoEncoder: unknown;
beforeEach(() => {
  // 每个用例拿一份全新模块（清掉模块级 memo），互不污染
  vi.resetModules();
  savedVideoEncoder = (globalThis as Record<string, unknown>).VideoEncoder;
});
afterEach(() => {
  (globalThis as Record<string, unknown>).VideoEncoder = savedVideoEncoder;
});

describe('probeEncoders — 判别联合（不得退化成 boolean）', () => {
  it('WebCodecs 缺失 → missing:webcodecs，且不查编码器', async () => {
    (globalThis as Record<string, unknown>).VideoEncoder = undefined;
    const { probeEncoders } = await import('../../src/components/director3d/encoderProbe.ts');
    const port = fakePort('avc', 'aac');
    const r = await probeEncoders(REQ, port);
    expect(r).toEqual({ ok: false, missing: 'webcodecs' });
    expect(port.video).not.toHaveBeenCalled();
  });

  it('有 WebCodecs 但候选视频编码器都不可用 → missing:video', async () => {
    (globalThis as Record<string, unknown>).VideoEncoder = function () {};
    const { probeEncoders } = await import('../../src/components/director3d/encoderProbe.ts');
    const r = await probeEncoders(REQ, fakePort(null, 'aac'));
    expect(r).toEqual({ ok: false, missing: 'video' });
  });

  it('视频可用且未请求音频 → ok，audioCodec=null', async () => {
    (globalThis as Record<string, unknown>).VideoEncoder = function () {};
    const { probeEncoders } = await import('../../src/components/director3d/encoderProbe.ts');
    const port = fakePort('avc', 'aac');
    const r = await probeEncoders(REQ, port);
    expect(r).toEqual({ ok: true, videoCodec: 'avc', audioCodec: null });
    expect(port.audio).not.toHaveBeenCalled();
  });

  it('视频可用、请求音频但不可用 → missing:audio', async () => {
    (globalThis as Record<string, unknown>).VideoEncoder = function () {};
    const { probeEncoders } = await import('../../src/components/director3d/encoderProbe.ts');
    const r = await probeEncoders({ ...REQ, audioCodecs: ['aac'] as never }, fakePort('avc', null));
    expect(r).toEqual({ ok: false, missing: 'audio' });
  });

  it('视频 + 音频都可用 → ok，两者都带出', async () => {
    (globalThis as Record<string, unknown>).VideoEncoder = function () {};
    const { probeEncoders } = await import('../../src/components/director3d/encoderProbe.ts');
    const r = await probeEncoders(
      { ...REQ, audioCodecs: ['aac'] as never },
      fakePort('av1', 'opus'),
    );
    expect(r).toEqual({ ok: true, videoCodec: 'av1', audioCodec: 'opus' });
  });
});

describe('probeEncoders — memo（默认端口，UA + 请求参数为键）', () => {
  it('同参数重复调用返回同一个结果对象（不重复 configure）', async () => {
    (globalThis as Record<string, unknown>).VideoEncoder = undefined;
    const { probeEncoders } = await import('../../src/components/director3d/encoderProbe.ts');
    const a = await probeEncoders(REQ);
    const b = await probeEncoders(REQ);
    expect(a).toBe(b);
    expect(a).toEqual({ ok: false, missing: 'webcodecs' });
  });
});
