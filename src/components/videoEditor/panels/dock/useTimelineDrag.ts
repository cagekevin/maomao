/**
 * 基座时间轴拖拽/编辑/键盘编排 —— `docs/120` §0.4 粗档（拖序 / 调片段长度）· C7.3（锁定轨）· C10（键盘让位三组键）。
 *
 * 【它做什么】把「片段拖拽（move/trimLeft/trimRight）+ 工带编辑动作 + 撤销重做删除键盘」收敛成 hook。
 * 所有编辑都经 `core/timelineOps` 纯函数；能力判据直接问原语（`docs/123` O3：不可用即置灰）。
 *
 * 【ownership】选中态（selectedClipId）归本 hook —— 拖拽要改它、工带/键盘要读它、Lane 要高亮它，
 * Docker 统一从本 hook 取并下发给 DockToolbar / Lane。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { isEditableTarget } from '../../../base/core/uiHooks.ts';
import { editorKeyAction } from '../../../base/core/modalLayer.ts';
import { showToast } from '../../../base/core/toastStore.ts';
import { generateId } from '../../../base/core/idGen.ts';
import { dropIndexAt, pxDeltaToTime, snapTime } from '../../../base/utils/timeline/timeScale.ts';
import {
  appendTime,
  clipEdges,
  duplicateClip,
  freezeFrameAt,
  moveClipTo,
  placeClipAt,
  removeClips,
  splitAt,
  trimLeftAt,
  trimRightAt,
  updateClip,
} from '../../core/timelineOps.ts';
import { DEFAULT_IMAGE_CLIP_DURATION, EPS, SNAP_TOLERANCE_PX } from '../../core/constants.ts';
import type { Clip, Project, Track } from '../../core/types.ts';
import type { EditorProjectStore } from './useEditorProject.ts';

/** 空片段数组的稳定引用（避免每次渲染新建数组导致下游 memo 失效）。 */
const EMPTY_CLIPS: Clip[] = [];

/**
 * 一次拖拽的进行时状态。
 * `origin` 存**拖拽开始时**的片段字段（不是实时读）——增量一律相对起点算，
 * 否则每次 pointermove 都在上一帧的结果上累加，误差会越拖越大。
 */
interface ClipDrag {
  mode: 'move' | 'trimLeft' | 'trimRight';
  clipId: string;
  trackId: string;
  originX: number;
  origin: { timelineStart: number; sourceStart: number; sourceEnd: number };
}

/** 工带编辑动作（能力判据 + 动作），DockToolbar 只做「按钮 → 动作」的极薄绑定，不持领域逻辑。 */
export interface TimelineEditing {
  canSplit: boolean;
  canTrimLeft: boolean;
  canTrimRight: boolean;
  canDelete: boolean;
  split: () => void;
  trimLeft: () => void;
  trimRight: () => void;
  freeze: () => void;
  deleteLift: () => void;
  deleteRipple: () => void;
  duplicate: () => void;
}

export interface EditorDrag {
  selectedClipId: string | null;
  setSelectedClipId: (id: string) => void;
  dragging: boolean;
  beginClipDrag: (
    e: ReactPointerEvent,
    clip: Clip,
    track: Track,
    mode: 'move' | 'trimLeft' | 'trimRight',
  ) => void;
  applyMain: (fn: (clips: Clip[]) => Clip[] | null) => void;
  editing: TimelineEditing;
}

export function useTimelineDrag(opts: {
  store: EditorProjectStore;
  project: Project | null;
  pps: number;
  playhead: number;
  open: boolean;
}): EditorDrag {
  const { store, project, pps, playhead, open } = opts;

  const mainTrack = project?.tracks.find((t) => !t.overlay) ?? null;
  const mainClips = mainTrack?.clips ?? EMPTY_CLIPS;

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  /* ── 拖拽（`docs/120` §0.4 粗档：拖序 / 调片段长度）── */
  const dragRef = useRef<ClipDrag | null>(null);
  const [dragging, setDragging] = useState(false);

  /** 拖拽起点：记下片段的**原始**字段（增量相对起点算，见 `ClipDrag`）。 */
  const beginClipDrag = useCallback(
    (e: ReactPointerEvent, clip: Clip, track: Track, mode: ClipDrag['mode']) => {
      if (track.locked) {
        // C7.3：锁定轨禁止一切编辑 —— 拖动是编辑，明说（不静默吞掉这次拖拽）
        showToast(`「${track.name}」已锁定，不可拖动`);
        return;
      }
      e.stopPropagation();
      setSelectedClipId(clip.id);
      dragRef.current = {
        mode,
        clipId: clip.id,
        trackId: track.id,
        originX: e.clientX,
        origin: {
          timelineStart: clip.timelineStart,
          sourceStart: clip.sourceStart,
          sourceEnd: clip.sourceEnd,
        },
      };
      setDragging(true);
    },
    [],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !project) return;
      const track = project.tracks.find((t) => t.id === drag.trackId);
      const clip = track?.clips.find((c) => c.id === drag.clipId);
      if (!track || !clip) return;
      const dt = pxDeltaToTime(e.clientX - drag.originX, pps);

      if (drag.mode === 'move') {
        // 目标时刻 = 起点时刻 + 指针位移，再吸附到**本轨其它片段**的边界
        // （候选从哪来是宿主判据；`snapTime` 只回答"最近的候选是哪条"）
        const raw = Math.max(0, drag.origin.timelineStart + dt);
        const t = snapTime(
          raw,
          clipEdges(track.clips.filter((c) => c.id !== clip.id)),
          pps,
          SNAP_TOLERANCE_PX,
        );
        store.applyTracks((tracks) =>
          tracks.map((tr) => {
            if (tr.id !== track.id) return tr;
            // 主轨是磁吸的：横向拖 = **拖序**（落点序号由 `dropIndexAt` 给，重排后压实）
            // 自由轨（音频）：横向拖 = 自由摆位（`placeClipAt`，不压实 —— 会毁掉用户摆的空隙）
            return tr.overlay
              ? { ...tr, clips: placeClipAt(tr.clips, clip.id, t) }
              : { ...tr, clips: moveClipTo(tr.clips, clip.id, dropIndexAt(tr.clips, t, clip.id)) };
          }),
        );
        return;
      }

      // 调片段长度（粗档）：只改**源端点**。磁吸轨由 `updateClip` 内部的压实收尾，自由轨保留位置。
      // 不做吸附：两种轨上「边缘」都不是自由变量（磁吸轨边缘由压实决定，自由轨边缘不动）。
      const isLeft = drag.mode === 'trimLeft';
      const next = isLeft ? drag.origin.sourceStart + dt : drag.origin.sourceEnd + dt;
      store.applyTracks((tracks) =>
        updateClip(tracks, clip.id, (c) => {
          if (isLeft) {
            const s = Math.max(0, Math.min(next, c.sourceEnd - EPS));
            // `timelineStart` 与源入点同量右移：右缘（timelineStart+duration）钉住，左缘=timelineStart 跟手柄走。
            return {
              ...c,
              sourceStart: s,
              timelineStart: Math.max(0, c.timelineStart + (s - c.sourceStart)),
            };
          }
          return { ...c, sourceEnd: Math.max(c.sourceStart + EPS, next) };
        }),
      );
    };
    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, project, pps, store]);

  /* ── 编辑动作（工带）—— 全部经 `core/` 原语，能力判据直接问原语 ── */
  const applyMain = useCallback(
    (fn: (clips: Clip[]) => Clip[] | null) => {
      store.applyTracks((tracks) =>
        tracks.map((t) => {
          if (t.overlay) return t;
          const next = fn(t.clips);
          return next ? { ...t, clips: next } : t;
        }),
      );
    },
    [store],
  );

  /** C15.2 复制：主轨 = 紧随其后并压实（`duplicateClip`）；自由轨 = 落到轨尾（不压实毁位置）。 */
  const duplicateSelected = useCallback(() => {
    if (!selectedClipId) return;
    store.applyTracks((tracks) =>
      tracks.map((t) => {
        const source = t.clips.find((c) => c.id === selectedClipId);
        if (!source) return t;
        if (!t.overlay) return { ...t, clips: duplicateClip(t.clips, selectedClipId) };
        return {
          ...t,
          clips: [...t.clips, { ...source, id: generateId('clip'), timelineStart: appendTime(t) }],
        };
      }),
    );
  }, [selectedClipId, store]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (isEditableTarget(e)) return; // 输入框内不劫键；Esc 不接管（C10.2）
      const action = editorKeyAction(e);
      if (!action) return;
      e.preventDefault();
      if (action === 'undo') store.undo();
      else if (action === 'redo') store.redo();
      else if (action === 'delete' && selectedClipId) {
        applyMain((clips) => removeClips(clips, [selectedClipId], 'lift'));
      }
    },
    [open, store, selectedClipId, applyMain],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // 能力判据：**直接问原语**（不做第二套「能不能切」的推断），不可用即置灰 + tooltip（O3）
  const canSplit = splitAt(mainClips, playhead) !== null;
  const canTrimLeft = trimLeftAt(mainClips, playhead) !== null;
  const canTrimRight = trimRightAt(mainClips, playhead) !== null;
  const canDelete = selectedClipId !== null && mainClips.some((c) => c.id === selectedClipId);

  const editing: TimelineEditing = {
    canSplit,
    canTrimLeft,
    canTrimRight,
    canDelete,
    split: () => applyMain((clips) => splitAt(clips, playhead)),
    trimLeft: () => applyMain((clips) => trimLeftAt(clips, playhead)),
    trimRight: () => applyMain((clips) => trimRightAt(clips, playhead)),
    freeze: () =>
      applyMain(
        (clips) => freezeFrameAt(clips, playhead, DEFAULT_IMAGE_CLIP_DURATION)?.clips ?? null,
      ),
    deleteLift: () =>
      applyMain((clips) => (selectedClipId ? removeClips(clips, [selectedClipId], 'lift') : null)),
    deleteRipple: () =>
      applyMain((clips) =>
        selectedClipId ? removeClips(clips, [selectedClipId], 'ripple') : null,
      ),
    duplicate: duplicateSelected,
  };

  return {
    selectedClipId,
    setSelectedClipId,
    dragging,
    beginClipDrag,
    applyMain,
    editing,
  };
}
