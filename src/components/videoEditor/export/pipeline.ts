/**
 * 导出管线 —— **唯一入口**（`docs/123` §一.5 O2 / §一.6 P1-P2 · `docs/120` C5 / C12）。
 *
 * ── 为什么必须只有一个入口 ──
 * `needsCompositing(project)` 是导出路径的**唯一判据**（`docs/120` C5.1）。若 UI 与执行各判一次，
 * 就会出现「工具带说走无损、实际走了合成」（或反过来）—— 用户永远不知道自己掉了画质没有。
 * 故本模块把「判路」(`planExport`) 与「执行」(`runExport`) 放在一处，执行**只消费**判路的结果。
 *
 * ── 两条路 ──
 *  - `direct`   ：主轨各片段编码/尺寸一致、无画面加工 → 关键帧对齐**无损直通**（不碰编码器）。
 *                 代价：入点精度受关键帧间隔限制 → 由 `actualStart` 如实回传。
 *  - `composite`：含叠加轨内容 / 图片片段 / 尺寸不一致 / 画面加工 → **逐帧渲染 + 重编码**。
 *
 * ── 什么必须报错、什么可以降级（7 步法 Step 4：在根因发生地炸开）──
 *  - 能力缺失（没有 avc / aac 编码器）→ **抛明确错误**（`docs/123` §一.6 P2：**绝不退化到未压缩 PCM**）。
 *    错误信息里写明缺的是哪一类，UI 直接红字展示（`docs/120` C9）。
 *  - 「音轨没能带出来」→ **降级**（`OpResult.degraded`）：画面是好的、只是没有声音，
 *    原因如实给出 —— 不静默产出一条无声视频还宣称成功。
 *  - 时间轴为空 / 没有可导出片段 → `reject`（**语义上没什么可导的**，不是系统错；见 `core/result.ts` O1）。
 *  - 素材读不到 / 编码失败 → **抛**（系统错，原样上抛、保留原始栈）。
 *
 * ── 探针为什么只在 `composite` 路上跑（与 C5 字面读法的差异，附理由）──
 * C5 写「导出前跑一次能力探针」。但 **`direct` 路根本不碰编码器**（它搬的是已编码分组），
 * 为它跑探针 = 给不会发生的场景预付成本（铁律 5），还会把「无损直通」的卖点
 * （**没有编码器也能出片**，正是它存在的理由）白白丢掉。故探针只在真要编码时跑 ——
 * 这与 P2 的立意（明错、不退化）完全一致。
 *
 * ── 阶段（`docs/123` §一.5 O2）──
 * 通过 `callbacks.onStage` 流式报告（`audio` 混音 / `video` 画面 / `mux` 写音频与收尾），
 * **不额外抛「带阶段的错误」**：调用方已经收到了阶段事件流，再包一层是同一信息的第二份。
 */
import { probeEncoders } from '../../base/utils/encoderProbe.ts';
import type { EncoderProbeRequest, EncoderProbeResult } from '../../base/utils/encoderProbe.ts';
import { exportLossless } from '../../base/utils/videoEngine.ts';
import type {
  AudioOutcome,
  LosslessExportResult,
  LosslessSegment,
} from '../../base/utils/videoEngine.ts';
import type { OpResult } from '../core/result.ts';
import { hasMixedSources, needsCompositing } from '../core/routeClip.ts';
import type { MediaProfile } from '../core/routeClip.ts';
import type { Clip, Project } from '../core/types.ts';
import { audibleClipsOf, exportComposite, openTimelineSources } from './composite.ts';
import type { BlobFetcher, CompositeExportResult, ExportStage } from './composite.ts';

/** 阶段类型归属 `composite.ts`（真正产出三阶段的地方）；此处转发以保持「导出公共词汇表 = pipeline」的入口单一。 */
export type { ExportStage } from './composite.ts';

/**
 * 导出的目标编码器 —— **只有一组**，不是「按优先级试候选」的列表。
 *
 * `docs/120` C9 / `docs/123` §一.6 P1：目标运行时（Blink/Chromium）**保证** avc + aac 可用，
 * 探针是「**确认**」而不是「兜底」——所以没有候选链、没有降级路径。
 */
const EXPORT_VIDEO_CODECS: readonly ['avc'] = ['avc'];
const EXPORT_AUDIO_CODECS: readonly ['aac'] = ['aac'];

const MISSING_ENCODER_TEXT: Record<'webcodecs' | 'video' | 'audio', string> = {
  webcodecs: '当前运行环境不支持 WebCodecs 视频编码，无法导出（请升级客户端）',
  video: '当前运行环境不支持 H.264（avc）视频编码，无法导出',
  audio: '当前运行环境不支持 AAC 音频编码 —— 本产品不产出未压缩音轨，故无法导出（请升级客户端）',
};

/** 一个待导出片段：片段本体 + **已解析出的原始素材地址**（经 `data/sourceResolver`）。 */
interface ExportSource {
  clip: Clip;
  /** 原始素材地址（**不是**出图端点，见 `data/sourceResolver.ts` 的说明）。 */
  url: string;
}

export interface ExportRequest {
  project: Project;
  /**
   * 参与导出的片段。
   *
   * 断链片段的处置在**调用方**：`docs/120` C13.4 / C5.6 要求导出前预检、由用户选「跳过 / 取消」。
   * 那是业务决策，管线不替用户决定，也**不静默跳过**（静默跳过 = 产出用户没预期的成片）。
   */
  sources: ExportSource[];
  /** 素材探测画像（`hooks/useEditorSources` 产物），用于异构判定；缺省 = 未探测（不判异构）。 */
  profiles?: ReadonlyMap<string, MediaProfile>;
}

/** 导出路径。 */
type ExportRoute = 'direct' | 'composite';

export interface ExportPlan {
  route: ExportRoute;
  /**
   * 走这条路的**原因**（`docs/120` C5.1 / C5.6：路径与原因常驻可见，不「悄悄掉画质」）。
   *
   * 注意它是**粗粒度**的：`needsCompositing` 的触发点（叠加 / 图片 / 尺寸 / M2 加工）**不在此重列** ——
   * 精确到「是哪一条触发的」就等于把那条判据再实现一遍（判据必须单点，7 步法 Step 3）。
   */
  reason: string;
}

/**
 * 判路（**纯函数**，可单测；也是 UI 常驻提示的数据源）。
 *
 * 判据链只有两条，且都是既有判据的复用、无新判断：
 *  ① `needsCompositing(project)`（`core/routeClip.ts`，120 C5.1 / C12.1）—— 结构事实；
 *  ② `hasMixedSources(profiles)`（同文件）—— 参数一致性；**判据只依据探测结果**，
 *     未探测就不判（不猜，见 `MediaProfile` 注释）。
 */
export function planExport(request: ExportRequest): ExportPlan {
  const { project, sources, profiles } = request;

  if (needsCompositing(project)) {
    return {
      route: 'composite',
      reason: '工程含叠加轨内容 / 图片片段 / 片段尺寸与工程尺寸不一致 / 画面加工 —— 需合成重编码',
    };
  }

  const known = sources
    .map((source) => profiles?.get(source.clip.id))
    .filter((profile): profile is MediaProfile => profile !== undefined);
  if (hasMixedSources(known)) {
    return {
      route: 'composite',
      reason: '各片段的分辨率或编码不一致，无法无损直通 —— 导出将归一到工程尺寸（重编码）',
    };
  }

  return {
    route: 'direct',
    reason:
      '各片段编码与分辨率一致且无画面加工 —— 关键帧对齐无损直通（不重编码；入点精度受关键帧间隔限制）',
  };
}

/** 导出产物。 */
export interface ExportArtifact {
  blob: Blob;
  /** 实际走的路径与原因（UI 据此回执「这次有没有重编码」）。 */
  plan: ExportPlan;
  /** 无损直通：入点被吸附到的**真实**起点（秒）。合成路径无此概念。 */
  actualStart?: number;
  /** 音轨结局（判别联合，见 `AudioOutcome`）。 */
  audio: AudioOutcome;
}

interface ExportCallbacks {
  /** 阶段推进（`docs/123` §一.5 O2）。 */
  onStage?: (stage: ExportStage) => void;
  /** 0~1 总进度。 */
  onProgress?: (progress: number) => void;
}

/**
 * 外部能力端口（默认接真实实现；测试注入假实现）。
 *
 * 抽成端口不是为了「可替换实现」（只有一种实现，见铁律 5），而是为了让**编排**可单测：
 * 分流决策 / 阶段推进 / 取消接线 / 探测缺失明错 —— 这几件事与「浏览器里能不能真的解出帧」无关，
 * 却在真实环境里**跑不到**（本仓无浏览器运行时）。不抽端口，这部分就只能靠人工验收。
 */
export interface ExportPorts {
  probe(request: EncoderProbeRequest): Promise<EncoderProbeResult>;
  fetchBlob: BlobFetcher;
  lossless(
    segments: LosslessSegment[],
    options: { onProgress?: (progress: number) => void; signal?: AbortSignal },
  ): Promise<LosslessExportResult>;
  composite(
    request: { project: Project; sources: ExportSource[]; fetchBlob: BlobFetcher },
    options: {
      onStage?: (stage: ExportStage) => void;
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    },
  ): Promise<CompositeExportResult>;
}

const defaultPorts: ExportPorts = {
  probe: (request) => probeEncoders(request),
  fetchBlob: async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`素材读取失败（HTTP ${response.status}）：${url}`);
    return response.blob();
  },
  lossless: (segments, options) => exportLossless(segments, options),
  composite: async (request, options) => {
    const sources = await openTimelineSources(request.sources, request.fetchBlob);
    try {
      return await exportComposite({
        project: request.project,
        resolveVideo: sources.resolveVideo,
        resolveAudio: sources.resolveAudio,
        ...options,
      });
    } finally {
      sources.dispose();
    }
  },
};

export interface ExportRunOptions {
  callbacks?: ExportCallbacks;
  /** 取消信号（`docs/120` C5.4：取消必须**真中断**，否则第二次导出会撞残留）。 */
  signal?: AbortSignal;
  /** 端口覆盖（测试注入）。 */
  ports?: Partial<ExportPorts>;
}

/** 一次导出。返回值见文件头「什么必须报错、什么可以降级」。 */
export async function runExport(
  request: ExportRequest,
  options: ExportRunOptions = {},
): Promise<OpResult<ExportArtifact>> {
  const ports: ExportPorts = { ...defaultPorts, ...options.ports };
  const callbacks = options.callbacks ?? {};
  const signal = options.signal;
  const plan = planExport(request);

  if (request.sources.length === 0) {
    return { status: 'reject', reason: '时间轴上没有可导出的片段' };
  }

  let artifact: ExportArtifact;
  if (plan.route === 'direct') {
    artifact = await runDirect(request, ports, plan, callbacks, signal);
  } else {
    await assertEncodersUsable(request, ports);
    const result = await ports.composite(
      { project: request.project, sources: request.sources, fetchBlob: ports.fetchBlob },
      { signal, onStage: callbacks.onStage, onProgress: callbacks.onProgress },
    );
    artifact = { blob: result.blob, plan, audio: result.audio };
  }

  return artifact.audio.status === 'lost'
    ? { status: 'degraded', value: artifact, reason: artifact.audio.reason }
    : { status: 'ok', value: artifact };
}

/**
 * 无损直通。
 *
 * 阶段只有两个且是真的：「搬运分组」（画面与声音一起搬）与「写容器」（`finalize`）。
 * **不硬凑成三分** —— 编造一个不存在的「混音」阶段比不报阶段更糟。
 */
async function runDirect(
  request: ExportRequest,
  ports: ExportPorts,
  plan: ExportPlan,
  callbacks: ExportCallbacks,
  signal?: AbortSignal,
): Promise<ExportArtifact> {
  // 【只取**主轨**的片段】直通拼的是「一条视频流」。`request.sources` 是「参与导出的全部片段」
  // （合成路要按它解析所有素材），若照单搬运，音频轨上的片段会被当成视频段塞进同一条流。
  // 主轨判据 = `!overlay`，与 `core/types.ts` 的轨道二分同源，不另立判断。
  const onlySource = new Map(request.sources.map((s) => [s.clip.id, s.url]));
  const mainClips = request.project.tracks.filter((t) => !t.overlay).flatMap((t) => t.clips);

  // 同一素材被多个片段使用时只取一次字节（素材复用是常态，见 `docs/120` C11.4）。
  const blobs = new Map<string, Blob>();
  const segments: LosslessSegment[] = [];
  for (const clip of mainClips) {
    const url = onlySource.get(clip.id);
    // 不在这份清单里 = 调用方已按 C13 让用户选择跳过（`sources` 即「参与导出的片段」）
    if (url === undefined) continue;
    let blob = blobs.get(url);
    if (!blob) {
      blob = await ports.fetchBlob(url);
      blobs.set(url, blob);
    }
    segments.push({
      blob,
      start: clip.sourceStart,
      end: clip.sourceEnd,
      label: clip.name ?? clip.id,
    });
  }
  if (segments.length === 0) throw new Error('主轨上没有可直通的片段');

  callbacks.onStage?.('video');
  const result = await ports.lossless(segments, {
    signal,
    onProgress: callbacks.onProgress,
  });
  callbacks.onStage?.('mux');

  return { blob: result.blob, plan, actualStart: result.actualStart, audio: result.audio };
}

/**
 * 编码器能力**确认**（不是「试候选」）。
 *
 * 只探「这次真的要用到的」：视频编码必用（合成路要逐帧编码）；音频编码**只在有时间轴上真有可闻片段时**才要求 ——
 * 可闻与否问 `audibleClipsOf`（判据单点，与混音同一函数），不在这里重写 `!hidden && !muted`。
 */
async function assertEncodersUsable(request: ExportRequest, ports: ExportPorts): Promise<void> {
  const needsAudio = audibleClipsOf(request.project.tracks).length > 0;
  const result = await ports.probe({
    videoCodecs: [...EXPORT_VIDEO_CODECS],
    audioCodecs: needsAudio ? [...EXPORT_AUDIO_CODECS] : undefined,
  });
  // 用 `in` 收窄（照 `director3d/App.tsx:1933` 的既有先例）：
  // 本仓 `tsconfig` 是 `strict: false`，**boolean 字面量判别收窄不生效**（`ok: true|false` 收不紧），
  // 而 `in` 收窄与 strictNullChecks 无关，且不需要任何类型断言。
  if ('missing' in result) throw new Error(MISSING_ENCODER_TEXT[result.missing]);
}
