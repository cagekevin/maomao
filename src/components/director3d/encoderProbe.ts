/**
 * 编码器能力探针（唯一实现）：WebCodecs + 视频/音频编码器可判别的可用性查询。
 *
 * 【为什么收口】此前这段判断**内联在 `director3d/App.tsx:1919/1933`**（导出处理器里）：
 *   `typeof VideoEncoder === 'undefined'` + `getFirstEncodableVideoCodec(['avc','av1','vp9'], …)`。
 * 视频剪辑器导出（`123` G4 / `120` C9）**曾是**预期的第二消费方 → 抽成独立模块，避免第 2 份。
 *
 * 【落点】本域（`director3d/encoderProbe.ts`，2026-09-19 域归位迁入）：`refs` 实测唯一消费者
 * = `director3d/App.tsx` ⇒ 单域 ⇒ 按 ADR-0040 L4 归本域。原头注「抽到这里后两域共用」**不成立**
 * （未取证，ADR-0001）；将来剪辑器真要用时按「跨域消费不改归属」另论。
 * **类型**取自 mediabunny（`import type`，编译期擦除，
 * 不产生运行时依赖）；**运行时查询**用 `mediabunny` 自带能力查询（`getFirstEncodable*Codec`），
 * 不引新依赖、不自造 `isConfigSupported` 猜测（`120` §3：mediabunny 内部已做 typeof 守卫与异常吞掉）。
 *
 * 【判别联合（硬边界②）】结果**必须可判别**，禁止退化成 boolean：
 *   `{ok:true, videoCodec, audioCodec}` | `{ok:false, missing:'webcodecs'|'video'|'audio'}`
 * `missing:'webcodecs'` 即"两者都缺"（WebCodecs 不存在 → 视频/音频编码器都不可能有）。
 *
 * 【memo（120 C9 / 123 P1：「启动期一次，结果按 UA/版本 memo」）】
 * 用默认端口时按 `UA + 请求参数` 记忆 Promise：同 UA 同参数重复调用返回**同一个** Promise（不重复 configure）。
 * 传入自定义 `query` 端口（测试 / 复用）时**不缓存**——避免与真实能力混淆。
 *
 * 【不是"兜底"】探针只回答"能不能"，**不提供降级路径**：目标平台（Blink/Chromium）保证可用；
 * 缺失时由调用方**直接报错明示用户**，绝不静默退化（`120` C5/D1/D2 已裁定）。
 */
import type { AudioCodec, Quality, VideoCodec } from 'mediabunny';

/** 一次探针请求：要检查哪些候选编码器、以及可选的编码参数。 */
export interface EncoderProbeRequest {
  /** 候选视频编码器（按优先级）。 */
  videoCodecs: readonly VideoCodec[];
  /** 候选音频编码器；**不传 = 本次不要求音频**（`audioCodec` 返回 null 且不影响 ok）。 */
  audioCodecs?: readonly AudioCodec[];
  width?: number;
  height?: number;
  quality?: Quality;
}

/** 探针结果（判别联合，不做 boolean 退化）。 */
export type EncoderProbeResult =
  | { ok: true; videoCodec: VideoCodec; audioCodec: AudioCodec | null }
  | { ok: false; missing: 'webcodecs' | 'video' | 'audio' };

/** 能力查询端口（默认真实 mediabunny；可注入以便单测/复用）。 */
export interface EncoderQueryPort {
  video(
    codecs: readonly VideoCodec[],
    opts: { width?: number; height?: number; quality?: Quality },
  ): Promise<VideoCodec | null>;
  audio(codecs: readonly AudioCodec[], opts: { quality?: Quality }): Promise<AudioCodec | null>;
}

/** 默认端口：mediabunny 自带能力查询（动态 import，避免顶层拉入编码器栈）。 */
const mediabunnyEncoderQuery: EncoderQueryPort = {
  async video(codecs, opts) {
    const { getFirstEncodableVideoCodec } = await import('mediabunny');
    return getFirstEncodableVideoCodec([...codecs], opts);
  },
  async audio(codecs, opts) {
    const { getFirstEncodableAudioCodec } = await import('mediabunny');
    return getFirstEncodableAudioCodec([...codecs], opts);
  },
};

let memoKey = '';
let memo: Promise<EncoderProbeResult> | null = null;

function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
}

async function runProbe(
  request: EncoderProbeRequest,
  query: EncoderQueryPort,
): Promise<EncoderProbeResult> {
  if (typeof VideoEncoder === 'undefined') return { ok: false, missing: 'webcodecs' };
  const videoCodec = await query.video(request.videoCodecs, {
    width: request.width,
    height: request.height,
    quality: request.quality,
  });
  if (!videoCodec) return { ok: false, missing: 'video' };
  if (!request.audioCodecs || request.audioCodecs.length === 0)
    return { ok: true, videoCodec, audioCodec: null };
  const audioCodec = await query.audio(request.audioCodecs, { quality: request.quality });
  if (!audioCodec) return { ok: false, missing: 'audio' };
  return { ok: true, videoCodec, audioCodec };
}

/**
 * 探测编码器能力。默认走 mediabunny 并按 `UA + 请求参数` memo；
 * 注入自定义 `query` 时每次真实查询（不缓存）。
 */
export function probeEncoders(
  request: EncoderProbeRequest,
  query: EncoderQueryPort = mediabunnyEncoderQuery,
): Promise<EncoderProbeResult> {
  if (query !== mediabunnyEncoderQuery) return runProbe(request, query);
  const key = [
    ua(),
    request.videoCodecs.join(','),
    request.audioCodecs?.join(',') ?? '',
    request.width ?? '',
    request.height ?? '',
    String(request.quality ?? ''),
  ].join('\u0000');
  if (memo && memoKey === key) return memo;
  memoKey = key;
  memo = runProbe(request, query);
  return memo;
}
