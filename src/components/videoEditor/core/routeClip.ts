/**
 * C 组 · 判据（谓词）—— `docs/123` §一.4 C 组。
 *
 * 纪律：**每个判据只准有一个真值源**。UI 里不许内联 `kind === 'audio' ? … : …`、
 * 不许内联 `sizes.every(s => s === project.size)` 这类判断 —— 判据一旦被抄成两份，必漂
 * （7 步法 Step 3：**探测重复可收口，判据重复不可合并且必须单点**）。
 *
 * 本文件零外部依赖（只 import 本目录的类型），符合 `docs/123` §二 铁律。
 */
import { hasOverlap } from './timelineOps.ts';
import type { Clip, ClipKind, Project, Track, TrackKind } from './types.ts';

/* ────────────────────────────────────────────────────────────────
 * 分轨唯一判据（docs/120 C11.1）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 片段该进哪一类轨 —— **分轨唯一判据**。
 *
 * 二分而不是三分：`image`（图片素材 / 定格帧产物）进**视频轨**，它是画面。
 * （结构参考 N `getTrackTypeForClipType`，但**不搬**它的「三轨一一对应」——我们只有 video|audio。）
 */
export function routeClipToTrack(kind: ClipKind): TrackKind {
  return kind === 'audio' ? 'audio' : 'video';
}

/* ────────────────────────────────────────────────────────────────
 * 导出路径唯一判据（docs/120 C5.1 / C12.1 红线）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 是否需要**合成重编码**（`false` = 可走无损直通）—— 导出路径的**唯一判据**。
 *
 * 【入参为什么是 `Project` 而不是 `(tracks, projectSize)`】（`docs/123` §二.7 P6）
 * 判据的真源是「**工程基准**」这一个东西。拆成两个参数后，调用方一旦传了与工程不一致的 size，
 * 判据就开始说谎（且没有任何测试会红）。收成一个参数，让"说谎"在类型层就不可能。
 *
 * 【为什么必须包含「片段尺寸 ≠ 工程尺寸」】（`docs/120` C12.1 红线）
 * 参考实现漏了这一条 → 会出现「尺寸不一致却走了直通」，导出结果被按源尺寸原样拼接，
 * 用户在播放器里才发现画面尺寸乱跳。补上它，就是「一次性做对」。
 *
 * 【保守方向说明】判据只依据 **Project 的结构事实**，不假装能判断参数级问题
 * （如「音频轨与视频轨恰为同源同参 → 可无损 copy」需要探测，属导出层 G4）。
 * 结构上不能证明可直通 → 判合成。宁可多编码一次，不可悄悄掉画质（`docs/120` C5.1 的立意）。
 */
export function needsCompositing(project: Project): boolean {
  const { tracks, settings } = project;

  for (const track of tracks) {
    // ① 自由轨（叠加 / 音频）上有内容 → 需要叠加或混音 → 合成。
    //    主轨单个/多个视频片段的「关键帧对齐无损拼接」不需要合成，故主轨不参与本判据。
    if (track.overlay && track.clips.length > 0) return true;

    // ② 时间轴重叠（同轨两片段同时可见/可闻）→ 必须合成（直通无法表达重叠）。
    if (hasOverlap(track.clips)) return true;

    for (const clip of track.clips) {
      // ③ 图片 / 定格帧片段：没有可搬运的编码流 → 必须渲染进画面 → 合成。
      if (clip.kind === 'image') return true;

      // ④ 片段尺寸 ≠ 工程尺寸 → 需要 contain 归一 → 合成（C12.1 红线）。
      //    尺寸探测不到（undefined）时不判 —— 不猜（诚实免责，见 Clip.size 注释）。
      if (
        clip.size &&
        (clip.size.width !== settings.width || clip.size.height !== settings.height)
      ) {
        return true;
      }

      // ⑤ M2 的画面/声音加工（画中画 / 转场 / 音量包络）：数据模型留了字段，
      //    一旦真的有值就必须合成。M1 不会写入这些字段，故此分支在 M1 恒不触发 ——
      //    留着它是因为**判据要跟着数据模型走**，否则 M2 上线时会漏掉分流（同一真源两处维护）。
      //    形状是 unknown（M1 不解释 M2 的类型）：只判「有没有设」。
      if (
        clip.transform !== undefined ||
        clip.transitionIn !== undefined ||
        clip.transitionOut !== undefined
      ) {
        return true;
      }
      if (Array.isArray(clip.volumePoints) && clip.volumePoints.length > 0) return true;
    }
  }
  return false;
}

/* ────────────────────────────────────────────────────────────────
 * 异构素材判据（直通 concat 的参数一致性前置）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 素材的**探测画像**（只收「判定异构所需」的那几维，不是素材元数据大对象）。
 * 探测不到的维度留空 —— 留空**不参与**异构判定（不猜，诚实免责）。
 */
export interface MediaProfile {
  width?: number;
  height?: number;
  /** 容器/编码的 MIME，如 `video/mp4`。 */
  mimeType?: string;
}

/**
 * 是否存在**异构素材**（分辨率 / 容器编码不一致）。
 *
 * 用途：无损直通的「多片段 concat」要求各段解码参数一致，否则必须**报错**而不是产出坏文件
 * （`docs/120` C5）。本判据只回答「是否一致」，**怎么处置（报错 / 改走合成）由导出层决定**。
 */
export function hasMixedSources(profiles: MediaProfile[]): boolean {
  const known = profiles.filter(
    (p) => p.width !== undefined || p.height !== undefined || p.mimeType,
  );
  if (known.length < 2) return false;
  const first = known[0];
  return known.some(
    (p) =>
      (p.width !== undefined && first.width !== undefined && p.width !== first.width) ||
      (p.height !== undefined && first.height !== undefined && p.height !== first.height) ||
      (p.mimeType !== undefined && first.mimeType !== undefined && p.mimeType !== first.mimeType),
  );
}

/* ────────────────────────────────────────────────────────────────
 * 可闻判据（docs/120 C11.7 · M1 走带必须真出声）
 * ──────────────────────────────────────────────────────────────── */

/**
 * 时间轴上**可闻**的片段（`docs/120` C11.7：M1 走带必须真出声）。
 *
 * **判据单点**：导出混音（`export/composite`）、导出探针（`export/pipeline`）、
 * 预览播放（`panels/dock/PlaybackSink`）都问这一个函数。各写一遍 `!hidden && !muted` 必漂 ——
 * 一处说「有声音」、另一处说「没有」，结果就是「明明有音频却没探音频编码器」/「预览有、导出没有」。
 *
 * 落点：判据属**领域真相（纯、零 IO）**，故收在 `core/`（判据层），不躺在导出域——
 * 否则播放域为了取一个纯函数会反向依赖导出域。
 */
export function audibleClipsOf(tracks: Track[]): Clip[] {
  return tracks
    .filter((track) => !track.hidden && !track.muted)
    .flatMap((track) => track.clips.filter((clip) => clip.kind !== 'image'));
}

/* ────────────────────────────────────────────────────────────────
 * 三状态判据（docs/120 C7.3）—— 锁定收口一处
 * ──────────────────────────────────────────────────────────────── */

function findTrack(tracks: Track[], trackId: string): Track | undefined {
  return tracks.find((t) => t.id === trackId);
}

/** 按片段 id 找所属轨（`docs/120` C1.1：一切改写都先经它定位）。 */
export function findTrackOfClip(tracks: Track[], clipId: string): Track | undefined {
  return tracks.find((t) => t.clips.some((c) => c.id === clipId));
}

/**
 * 轨道是否锁定。**未知 id 一律按「未锁定」**（`docs/123` §一.4 C 组）——
 * 找不到的轨道不应让整个 UI 变灰；真要有问题，断链/数据校验会把它暴露在别处。
 */
export function isTrackLocked(tracks: Track[], trackId: string): boolean {
  return findTrack(tracks, trackId)?.locked ?? false;
}

/** 片段是否锁定（其所属轨锁定即视为锁定；找不到片段 → 未锁定）。 */
export function isClipLocked(tracks: Track[], clipId: string): boolean {
  return findTrackOfClip(tracks, clipId)?.locked ?? false;
}

/** 轨道是否隐藏（只影响渲染与导出，不动数据）。 */
export function isTrackHidden(tracks: Track[], trackId: string): boolean {
  return findTrack(tracks, trackId)?.hidden ?? false;
}

/** 轨道是否静音（只影响出声与导出音轨，不动数据）。 */
export function isTrackMuted(tracks: Track[], trackId: string): boolean {
  return findTrack(tracks, trackId)?.muted ?? false;
}
