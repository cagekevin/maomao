/**
 * G4 导出管线单测 —— `docs/123` §二.3 G4 · §一.5 O2 · §一.6 P1-P2 · `docs/120` C5 / C8 / C12。
 *
 * 【为什么这些必须自动测，而不是「人工验收一遍」】
 * 本仓没有浏览器运行时，也拿不到真实媒体样本 —— 「逐帧解出画面」这类事只能人工跑。
 * 但导出管线的**编排**（分流判路 / 阶段推进 / 取消接线 / 探针缺失明错 / 素材只取一次）
 * 与环境无关：它全在 `runExport` 这一层，端口一注入就能断言。
 * 不测它，人工验收又能过，是因为「跑通的是一条腿」——另一条腿错了也不会红。
 */
import { describe, expect, it } from 'vitest';
import type {
  EncoderProbeRequest,
  EncoderProbeResult,
} from '../../../src/components/base/utils/encoderProbe.ts';
import type { LosslessExportResult } from '../../../src/components/base/utils/videoEngine.ts';
import { createEmptyProject } from '../../../src/components/videoEditor/core/normalize.ts';
import type { Clip, Project, Track } from '../../../src/components/videoEditor/core/types.ts';
import {
  audibleClipsOf,
  computeDrawRect,
} from '../../../src/components/videoEditor/export/composite.ts';
import {
  planExport,
  runExport,
  type ExportPorts,
  type ExportRequest,
  type ExportStage,
} from '../../../src/components/videoEditor/export/pipeline.ts';

/* ────────────────────────────────────────────────────────────────
 * 夹具
 * ──────────────────────────────────────────────────────────────── */

function clipOf(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'c1',
    kind: 'video',
    sourceUrl: '/files/a.mp4',
    sourceStart: 0,
    sourceEnd: 5,
    timelineStart: 0,
    ...overrides,
  };
}

/** 主轨放一条视频片段的工程。 */
function projectWithMainClip(overrides: Partial<Clip> = {}): { project: Project; clip: Clip } {
  const project = createEmptyProject();
  const clip = clipOf(overrides);
  project.tracks[0].clips.push(clip);
  return { project, clip };
}

function request(project: Project, clips: Clip[]): ExportRequest {
  return { project, sources: clips.map((clip) => ({ clip, url: clip.sourceUrl ?? '' })) };
}

const PROBE_OK: EncoderProbeResult = { ok: true, videoCodec: 'avc', audioCodec: 'aac' };

const LOSSLESS_OK: LosslessExportResult = {
  blob: new Blob(['direct'], { type: 'video/mp4' }),
  metadata: { duration: 5, width: 1280, height: 720, fps: 30 },
  mimeType: 'video/mp4',
  extension: 'mp4',
  actualStart: 0,
  audio: { status: 'kept' },
};

/** 默认全 "真实" 端口；每个用例只覆盖它关心的那一个。 */
function ports(overrides: Partial<ExportPorts> = {}): ExportPorts {
  return {
    probe: async (): Promise<EncoderProbeResult> => PROBE_OK,
    fetchBlob: async (): Promise<Blob> => new Blob(['src'], { type: 'video/mp4' }),
    lossless: async (): Promise<LosslessExportResult> => LOSSLESS_OK,
    composite: async () => ({
      blob: new Blob(['composite'], { type: 'video/mp4' }),
      duration: 5,
      width: 1280,
      height: 720,
      fps: 30,
      audio: { status: 'kept' as const },
    }),
    ...overrides,
  };
}

/* ────────────────────────────────────────────────────────────────
 * 判路（纯函数）
 * ──────────────────────────────────────────────────────────────── */

describe('planExport —— 导出路径唯一判据（docs/120 C5.1）', () => {
  it('主轨同尺寸单片段 → 直通（无损，不重编码）', () => {
    const { project, clip } = projectWithMainClip();
    expect(planExport(request(project, [clip])).route).toBe('direct');
  });

  it('含图片片段 → 合成（图片没有可搬运的编码流）', () => {
    const { project, clip } = projectWithMainClip({ kind: 'image' });
    expect(planExport(request(project, [clip])).route).toBe('composite');
  });

  it('片段尺寸 ≠ 工程尺寸 → 合成（C12.1 红线：尺寸不一致却走直通会产出尺寸乱跳的片子）', () => {
    const { project, clip } = projectWithMainClip({ size: { width: 640, height: 480 } });
    expect(planExport(request(project, [clip])).route).toBe('composite');
  });

  it('叠加轨（自由轨）上有内容 → 合成（直通无法表达叠加/混音）', () => {
    const { project, clip } = projectWithMainClip();
    // 主轨只有一条、无重叠；触发点纯粹是「音频轨这条自由轨上有内容」
    const audio = clipOf({ id: 'a1', kind: 'audio', sourceUrl: '/files/a.m4a' });
    project.tracks[1].clips.push(audio);
    expect(planExport(request(project, [clip, audio])).route).toBe('composite');
  });

  it('素材画像显示编码/分辨率不一致 → 合成（参数不一致就无法直通拼接）', () => {
    const project = createEmptyProject();
    const a = clipOf({ id: 'c1' });
    const b = clipOf({ id: 'c2', timelineStart: 5 });
    project.tracks[0].clips.push(a, b);
    const profiles = new Map([
      ['c1', { width: 1280, height: 720, mimeType: 'video/mp4' }],
      ['c2', { width: 1920, height: 1080, mimeType: 'video/mp4' }],
    ]);
    expect(planExport({ ...request(project, [a, b]), profiles }).route).toBe('composite');
  });

  it('未探测（无画像）时不判异构 —— 不猜（MediaProfile 注释）', () => {
    const project = createEmptyProject();
    const a = clipOf({ id: 'c1' });
    const b = clipOf({ id: 'c2', timelineStart: 5 });
    project.tracks[0].clips.push(a, b);
    expect(planExport(request(project, [a, b])).route).toBe('direct');
  });
});

/* ────────────────────────────────────────────────────────────────
 * 编排：分流 / 阶段 / 取消 / 探针 / 去重
 * ──────────────────────────────────────────────────────────────── */

describe('runExport —— 直通路', () => {
  it('空时间轴 → reject（语义上没什么可导的，不是系统错）', async () => {
    const project = createEmptyProject();
    const out = await runExport(request(project, []), { ports: ports() });
    expect(out.status).toBe('reject');
  });

  it('不跑编码器探针 —— 无损直通的意义就是「不需要编码器」', async () => {
    const { project, clip } = projectWithMainClip();
    let probed = false;
    const out = await runExport(request(project, [clip]), {
      ports: ports({
        probe: async (): Promise<EncoderProbeResult> => {
          probed = true;
          return PROBE_OK;
        },
      }),
    });
    expect(probed).toBe(false);
    expect(out.status).toBe('ok');
  });

  it('阶段只报「搬运分组 → 写容器」两个真实阶段（不硬凑不存在的「混音」）', async () => {
    const { project, clip } = projectWithMainClip();
    const stages: ExportStage[] = [];
    await runExport(request(project, [clip]), {
      ports: ports(),
      callbacks: { onStage: (s) => stages.push(s) },
    });
    expect(stages).toEqual(['video', 'mux']);
  });

  it('同一素材被多个片段使用 → 只取一次字节', async () => {
    const project = createEmptyProject();
    const a = clipOf({ id: 'c1', sourceUrl: '/files/same.mp4' });
    const b = clipOf({ id: 'c2', sourceUrl: '/files/same.mp4', timelineStart: 5 });
    project.tracks[0].clips.push(a, b);
    let fetches = 0;
    await runExport(request(project, [a, b]), {
      ports: ports({
        fetchBlob: async () => {
          fetches += 1;
          return new Blob(['src']);
        },
      }),
    });
    expect(fetches).toBe(1);
  });

  it('入点被吸附到的真实起点如实回传（关键帧对齐的代价，不假装精确）', async () => {
    const { project, clip } = projectWithMainClip();
    const out = await runExport(request(project, [clip]), {
      ports: ports({
        lossless: async () => ({ ...LOSSLESS_OK, actualStart: 1.5 }),
      }),
    });
    expect(out.status).not.toBe('reject');
    if (out.status === 'reject') return;
    expect(out.value.actualStart).toBe(1.5);
  });

  it('音轨没带出来 → degraded（不静默产出无声视频还宣称成功）', async () => {
    const { project, clip } = projectWithMainClip();
    const out = await runExport(request(project, [clip]), {
      ports: ports({
        lossless: async () => ({
          ...LOSSLESS_OK,
          audio: { status: 'lost', reason: 'MP4 不接受源音频编码 opus' },
        }),
      }),
    });
    expect(out.status).toBe('degraded');
    if (out.status !== 'degraded') return;
    expect(out.reason).toContain('opus');
    // 产物仍然给了 —— 降级不是失败
    expect(out.value.blob.size).toBeGreaterThan(0);
  });
});

describe('runExport —— 合成路', () => {
  function compositeRequest(): ExportRequest {
    const { project, clip } = projectWithMainClip({ kind: 'image' });
    return request(project, [clip]);
  }

  it('缺编码器 → 抛明确错误（P2：绝不退化为未压缩 PCM）', async () => {
    await expect(
      runExport(compositeRequest(), {
        ports: ports({
          probe: async (): Promise<EncoderProbeResult> => ({ ok: false, missing: 'audio' }),
        }),
      }),
    ).rejects.toThrow(/AAC/);
  });

  it('缺 WebCodecs → 错误信息说明是环境问题（可据此提示升级客户端）', async () => {
    await expect(
      runExport(compositeRequest(), {
        ports: ports({
          probe: async (): Promise<EncoderProbeResult> => ({ ok: false, missing: 'webcodecs' }),
        }),
      }),
    ).rejects.toThrow(/WebCodecs/);
  });

  it('有时间轴上可闻片段 → 探针要求音频编码器', async () => {
    const { project, clip } = projectWithMainClip({ kind: 'image' });
    const audible = clipOf({ id: 'a1', kind: 'audio', sourceUrl: '/files/a.m4a' });
    project.tracks[1].clips.push(audible);
    let seen: EncoderProbeRequest | undefined;
    await runExport(request(project, [clip, audible]), {
      ports: ports({
        probe: async (r): Promise<EncoderProbeResult> => {
          seen = r;
          return PROBE_OK;
        },
      }),
    });
    expect(seen?.audioCodecs).toEqual(['aac']);
  });

  it('没有可闻片段（只有图片）→ 不要求音频编码器（判据与混音同源：audibleClipsOf）', async () => {
    let seen: EncoderProbeRequest | undefined;
    await runExport(compositeRequest(), {
      ports: ports({
        probe: async (r): Promise<EncoderProbeResult> => {
          seen = r;
          return PROBE_OK;
        },
      }),
    });
    expect(seen?.videoCodecs).toEqual(['avc']);
    expect(seen?.audioCodecs).toBeUndefined();
  });

  it('阶段由合成端口透传（混音 → 画面 → 写音频）', async () => {
    const stages: ExportStage[] = [];
    await runExport(compositeRequest(), {
      ports: ports({
        composite: async (_r, options) => {
          for (const s of ['audio', 'video', 'mux'] as const) options.onStage?.(s);
          return {
            blob: new Blob(['c']),
            duration: 5,
            width: 1280,
            height: 720,
            fps: 30,
            audio: { status: 'kept' as const },
          };
        },
      }),
      callbacks: { onStage: (s) => stages.push(s) },
    });
    expect(stages).toEqual(['audio', 'video', 'mux']);
  });
});

describe('runExport —— 取消接线（docs/120 C5.4）', () => {
  it('取消信号真的传到端口（否则「取消」只是 UI 上的假动作）', async () => {
    const { project, clip } = projectWithMainClip();
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    await runExport(request(project, [clip]), {
      signal: controller.signal,
      ports: ports({
        lossless: async (_segments, options) => {
          seen = options.signal;
          return LOSSLESS_OK;
        },
      }),
    });
    expect(seen).toBe(controller.signal);
  });

  it('端口抛出的取消错误原样上抛（不被包装成「导出失败」，调用方能区分取消与失败）', async () => {
    const { project, clip } = projectWithMainClip();
    const canceled = new Error('视频处理已取消');
    canceled.name = 'ConversionCanceledError';
    await expect(
      runExport(request(project, [clip]), {
        ports: ports({
          lossless: async () => {
            throw canceled;
          },
        }),
      }),
    ).rejects.toBe(canceled);
  });
});

/* ────────────────────────────────────────────────────────────────
 * 纯几何 / 纯判据（合成器的可测部分）
 * ──────────────────────────────────────────────────────────────── */

describe('computeDrawRect —— contain 归一（docs/120 C12.1）', () => {
  it('源比画布小 → 放大到贴满一边并居中', () => {
    expect(computeDrawRect({ width: 640, height: 480 }, { width: 1280, height: 720 })).toEqual({
      x: 160,
      y: 0,
      width: 960,
      height: 720,
    });
  });

  it('源与画布同比例 → 正好铺满（无黑边、无偏移）', () => {
    expect(computeDrawRect({ width: 1920, height: 1080 }, { width: 1280, height: 720 })).toEqual({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    });
  });

  it('方形源放进宽画布 → 左右留黑边（M1 如实留黑边，消黑边是 M2 的 fit 模式）', () => {
    expect(computeDrawRect({ width: 100, height: 100 }, { width: 1280, height: 720 })).toEqual({
      x: 280,
      y: 0,
      width: 720,
      height: 720,
    });
  });

  it('尺寸为 0 的脏素材不产生 NaN / Infinity 矩形', () => {
    const rect = computeDrawRect({ width: 0, height: 0 }, { width: 1280, height: 720 });
    for (const v of [rect.x, rect.y, rect.width, rect.height])
      expect(Number.isFinite(v)).toBe(true);
  });
});

describe('audibleClipsOf —— 可闻判据单点（docs/120 C11.7）', () => {
  it('隐藏轨 / 静音轨 / 图片片段都不算可闻', () => {
    const project = createEmptyProject();
    const [video, audio] = project.tracks;
    video.clips.push(clipOf({ id: 'v1' }));
    video.clips.push(clipOf({ id: 'v2', kind: 'image', timelineStart: 5 }));
    audio.clips.push(clipOf({ id: 'a1', kind: 'audio' }));
    expect(audibleClipsOf(project.tracks).map((c) => c.id)).toEqual(['v1', 'a1']);

    const muted = project.tracks.map((t): Track =>
      t.kind === 'audio' ? { ...t, muted: true } : t,
    );
    expect(audibleClipsOf(muted).map((c) => c.id)).toEqual(['v1']);
  });
});
