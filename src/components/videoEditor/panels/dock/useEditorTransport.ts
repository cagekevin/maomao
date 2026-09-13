/**
 * 基座走带/播放头编排 —— `docs/120` C11.7（上一 / 播放推进 / 下一片段边界）。
 *
 * 【它做什么】把「播放头 + 播放钟」（rAF 推进）、seek、边界跳转收敛成 hook。
 * 播放钟的推进头放在**局部状态** `playInfo.t`，只在播放结束/暂停/手工移动时 `setPlayhead` 落一次盘 ——
 * 避免 `applyProjectPatch → saveProject`（CAS 写）随每帧落盘造成写放大（`docs/123` §3.7）。
 *
 * 【trackAreaRef 为什么在这里】`beginPlayheadDrag` 的 seek 要读滚动区 DOM（时间原点 = 其左缘），
 * 故由本 hook 自持 ref，Docker 把它绑到滚动区根 div 上。
 *
 * 【deps 原样保留】`setPlayhead` 依赖 `store`（每次渲染换身份）⇒ 播放期的 rAF effect 逐帧重挂 ——
 * 这与拆分前 Docker 里的行为**完全一致**（每帧从 base+startedAt 重算，仍然正确推进）；不顺手"优化"它。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { clipEdges, timelineDuration } from '../../core/timelineOps.ts';
import { SNAP_TOLERANCE_PX } from '../../core/constants.ts';
import { snapTime, xToTime } from '../../../base/utils/timeline/timeScale.ts';
import type { Project } from '../../core/types.ts';
import type { EditorProjectStore } from './useEditorProject.ts';

export interface EditorTransport {
  /** 当前渲染播放头（秒）；播放中 = playInfo.t，否则 = 工程 playhead。 */
  displayHead: number;
  /** 是否正在播放（Docker/Toolbar 据此切 Pause/Play 图标）。 */
  playing: boolean;
  totalDuration: number;
  trackAreaRef: React.RefObject<HTMLDivElement | null>;
  setPlayhead: (t: number) => void;
  beginPlayheadDrag: (e: ReactPointerEvent) => void;
  onTogglePlay: () => void;
  stepToBoundary: (dir: 1 | -1) => void;
}

export function useEditorTransport(opts: {
  store: EditorProjectStore;
  project: Project | null;
  /** 缩放（像素/秒）—— seek 的时间↔像素换算用它。 */
  pps: number;
}): EditorTransport {
  const { store, project, pps } = opts;
  const totalDuration = project ? timelineDuration(project.tracks) : 0;
  const playhead = project?.playhead ?? 0;

  const setPlayhead = useCallback(
    (t: number) => {
      store.applyProjectPatch({ playhead: Math.max(0, Math.min(totalDuration, t)) });
    },
    [store, totalDuration],
  );

  /**
   * 播放头拖动 seek（参照 `director3d/panels/Timeline.tsx::beginPlayheadDrag` 的形态：
   * 按住竖线顶部菱形把手 / 加宽的命中区，左右拖动实时移动播放头）。
   *
   * 【同一时间原点】与标尺 / 片段 / 点击落点共用滚动区（`trackAreaRef`）原点 —— 左列已移出滚动区，无偏移。
   * 【同一条吸附判据】拖动也走 `snapTime(clipEdges(...), pps, SNAP_TOLERANCE_PX)` —— 判据单点，不抄第二份。
   * 【rAF 节流】`applyProjectPatch → saveProject`（CAS 写）在拖拽期会高频触发，须由调用方节流。
   */
  const beginPlayheadDrag = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation(); // 别冒泡到轨道区 onPointerDown（避免双写播放头）
      const el = trackAreaRef.current;
      if (!el) return;
      const seekAt = (clientX: number) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) return;
        // `el` = 滚动区（轨道左列已移出滚动区），故时间原点即是其左缘 —— 无需左列偏移
        const raw = xToTime(clientX - rect.left + el.scrollLeft, pps, 0);
        setPlayhead(
          snapTime(
            raw,
            clipEdges(project?.tracks.flatMap((t) => t.clips) ?? []),
            pps,
            SNAP_TOLERANCE_PX,
          ),
        );
      };
      seekAt(e.clientX);
      let raf: number | null = null;
      const onMove = (ev: PointerEvent) => {
        if (raf !== null) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          seekAt(ev.clientX);
        });
      };
      const onUp = () => {
        if (raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [pps, project, setPlayhead],
  );

  /**
   * 播放进行中的位移状态（`playInfo.t` = 当前显示播放头）。
   * 【为什么不进 store 每帧写】见文件头。只在播放结束 / 暂停 / 手工移动时 `setPlayhead` 落一次盘。
   */
  const [playInfo, setPlayInfo] = useState<{
    t: number;
    base: number;
    startedAt: number;
  } | null>(null);
  const displayHead = playInfo ? playInfo.t : playhead;

  useEffect(() => {
    if (!playInfo) return;
    let raf = 0;
    const step = (now: number) => {
      const next = playInfo.base + (now - playInfo.startedAt) / 1000;
      if (next >= totalDuration) {
        setPlayhead(totalDuration); // 到头：落盘在结束时
        setPlayInfo(null);
        return;
      }
      setPlayInfo({ ...playInfo, t: next });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playInfo, totalDuration, setPlayhead]);

  const onTogglePlay = useCallback(() => {
    if (playInfo) {
      setPlayhead(playInfo.t); // 暂停：结算当前推进头
      setPlayInfo(null);
      return;
    }
    setPlayInfo({ t: playhead, base: playhead, startedAt: performance.now() });
  }, [playInfo, playhead, setPlayhead]);

  /** 上一 / 下一**片段边界**（C11.7 走带）：跨到相邻的 `clipEdges` 候选。 */
  const stepToBoundary = useCallback(
    (dir: 1 | -1) => {
      if (!project) return;
      const batch = playInfo ? playInfo.t : playhead;
      setPlayInfo(null); // 手工移动终止播放（播放态是只读态）
      const edges = clipEdges(project.tracks.flatMap((t) => t.clips));
      const next =
        dir === 1
          ? (edges.find((e) => e > batch + 1e-6) ?? totalDuration)
          : ([...edges].reverse().find((e) => e < batch - 1e-6) ?? 0);
      setPlayhead(next);
    },
    [project, playInfo, playhead, totalDuration, setPlayhead],
  );

  const trackAreaRef = useRef<HTMLDivElement | null>(null);

  return {
    displayHead,
    playing: playInfo !== null,
    totalDuration,
    trackAreaRef,
    setPlayhead,
    beginPlayheadDrag,
    onTogglePlay,
    stepToBoundary,
  };
}
