/**
 * 走带出声（docs/120 C11.7 · M1）—— 播放调度 + 媒体同步。
 *
 * ── 设计 ──
 * 播放头推进由基座 rAF（`useEditorTransport` 的 `playInfo`）驱动；
 * 本模块只负责**把真实出声绑到播放头上**，不自持时钟（避免两套时钟打架）。
 *
 * 逻辑：
 *  - **可闻判据**复用 `core/routeClip.ts::audibleClipsOf`（单点：`!hidden && !muted`、且排除 `image`），
 *    不在本文件重写一遍 `!hidden && !muted`。
 *  - 每个可闻片段各持一个媒体元素（`video` 片段 → `<video>`，`audio` 片段 → `<audio>`），
 *    **天然支持叠声**（主轨视频原声 + 音频轨配乐同一时刻同时出声）。
 *  - 每次帧同步（播放头每帧变）调用 `PlaybackSink` 内部 effect：把每个元素 `currentTime` 对齐到
 *    `sourceTimeAt(playhead, clip)`（共用映射原语），覆盖率不足即暂停。
 *    ★更新(2026-09-14)：此前本行**名不副实** —— 实现写的是内联
 *    `clip.sourceStart + (playhead - clip.timelineStart)`，并未调用该原语。现已改调 `sourceTimeAt`。
 *  - `M1 不求无缝/精确同步`：元素用自身时钟走，偏差超过容差再对齐 —— 接受少量口红偏移，注释如实标注。
 *
 * ── 命名说明（§四.1 收尾）──
 * 它导出的是**组件** `PlaybackSink`（不是 hook），故不叫 `useEditorPlayback`、不放在 `hooks/`
 * （hooks 目录语义 = hook）。`audibleClipsAt` 纯函数随它一起落到 `panels/dock/`。
 *
 * ── 诚实声明（未真机验收）──
 * 本文件无真实媒体样本 / 无浏览器运行时验证；`syncAll` 的媒体行为（play/pause/seek）**未在真实浏览器跑过**，
 * 只承诺逻辑正确（纯函数 `audibleClipsAt` 有单测）。接手方须真机过一遍再宣称可用。
 */

/** 「常驻层」声明（`dockContract.test.ts` 按此标记禁用 portal / FullscreenShell）：本目录的文件都挂在 App 根 flex 列内、常驻不 portal，故不许登记 modalLayer。 */
// DOCK_IS_PERSISTENT（常驻层声明 · dockContract.test.ts 按此标记禁用 portal）

import { useEffect, useMemo, useRef } from 'react';
import { sourceTimeAt } from '../../../base/utils/timeline/sourceTime.ts';
import { audibleClipsOf } from '../../core/routeClip.ts';
import { EPS } from '../../core/constants.ts';
import { clipEnd } from '../../core/timelineOps.ts';
import type { Clip, ClipKind, Track } from '../../core/types.ts';
import type { EditorClipSource } from '../../hooks/useEditorSources.ts';

/** 一个"该出声"的片段 + 它的可播 URL。 */
export interface AudibleWindow {
  clip: Clip;
  url: string;
}

/** 媒体元素与源时刻对齐的容差（秒）—— 小于它就认为"已经在播"，避免每帧盲 seek。 */
const RESYNC_TOLERANCE_SEC = 0.12;

/**
 * 纯函数：某时刻 `t` **应出声且素材可读**的可闻片段列表（可同时多个 = 叠声）。
 *
 * 与导出混音的"可闻"定义**共用** `audibleClipsOf`，只不过这里再叠加：
 * ① 素材真的取得到（`resolved.ok`）—— 读不到就不该出声；② 时间窗覆盖 `t`。
 */
export function audibleClipsAt(
  tracks: Track[],
  byClipId: ReadonlyMap<string, EditorClipSource>,
  t: number,
): AudibleWindow[] {
  const resolvable = new Map<string, string>();
  for (const [id, s] of byClipId) {
    if (s.resolved.status === 'ok') resolvable.set(id, s.resolved.url);
  }
  return audibleClipsOf(tracks)
    .filter((c) => resolvable.has(c.id) && t >= c.timelineStart - EPS && t < clipEnd(c) + EPS)
    .map((c) => ({ clip: c, url: resolvable.get(c.id)! }));
}

export interface PlaybackSinkProps {
  /** 基座是否展开（折叠即不出声）。 */
  open: boolean;
  /** 是否正在播放。 */
  playing: boolean;
  /** 当前渲染播放头（秒）。 */
  playhead: number;
  tracks: Track[];
  /** `useEditorSources` 的 `byClipId`（素材可读性 + URL）。 */
  sources: ReadonlyMap<string, EditorClipSource>;
}

/**
 * 播放出声的"宿主"：隐藏的 `<video>`/`<audio>` 集合，按播放头实时对齐。
 * 渲染在基座内（普通隐藏节点，非 portal / 非 modalLayer）。
 */
export function PlaybackSink({ open, playing, playhead, tracks, sources }: PlaybackSinkProps) {
  /** 需要出声的片段（可闻 + 素材可读），把可播 URL 在此算好（JSX 里不重取判型）。 */
  const audible = useMemo(
    () =>
      audibleClipsOf(tracks)
        .map((c) => {
          const r = sources.get(c.id)?.resolved;
          return {
            id: c.id,
            kind: c.kind,
            url: r && r.status === 'ok' ? r.url : undefined,
          };
        })
        .filter((e): e is { id: string; kind: ClipKind; url: string } => e.url !== undefined),
    [tracks, sources],
  );

  /** clipId → 媒体元素（回调 ref，避免 list 重建丢引用）。 */
  const elsRef = useRef<Map<string, HTMLMediaElement>>(new Map());
  const setEl = (id: string) => (el: HTMLMediaElement | null) => {
    if (el) elsRef.current.set(id, el);
    else elsRef.current.delete(id);
  };

  useEffect(() => {
    const els = elsRef.current;
    // 折叠 / 未播放 → 全 pause（不 seek 到别处，等 resume 时再对齐）
    if (!open || !playing) {
      for (const el of els.values()) if (!el.paused) el.pause();
      return;
    }
    const active = audibleClipsAt(tracks, sources, playhead);
    const activeIds = new Set(active.map((a) => a.clip.id));
    for (const a of active) {
      const el = els.get(a.clip.id);
      if (!el) continue;
      // 时间轴播放头 → 源媒体时刻（**共用映射原语**；见文件头「★更新(2026-09-14)」）
      const target = sourceTimeAt(playhead, a.clip);
      if (Math.abs(el.currentTime - target) > RESYNC_TOLERANCE_SEC) {
        try {
          el.currentTime = Math.max(0, target);
        } catch {
          el.currentTime = 0;
        }
      }
      if (el.paused) void el.play().catch(() => undefined); // catch-ok: BROWSER_API
    }
    for (const [id, el] of els) {
      if (!activeIds.has(id) && !el.paused) el.pause();
    }
  }, [open, playing, playhead, tracks, sources]);

  return (
    <div data-playback-sink className="hidden" aria-hidden>
      {audible.map((a) =>
        a.kind === 'audio' ? (
          <audio key={a.id} ref={setEl(a.id)} src={a.url} preload="metadata" />
        ) : (
          <video key={a.id} ref={setEl(a.id)} src={a.url} preload="metadata" playsInline />
        ),
      )}
    </div>
  );
}
