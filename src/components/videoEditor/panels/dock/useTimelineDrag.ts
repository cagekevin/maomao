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
  magneticOf,
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
  /** 删除（单一动作）：留洞 / 波纹由**吸附开关**决定，不做成两个按钮。 */
  delete: () => void;
  duplicate: () => void;
}

export interface EditorDrag {
  selectedClipId: string | null;
  setSelectedClipId: (id: string) => void;
  /** 正在被拖拽的片段 id（无拖拽 = `null`）。UI 据此给该片段「正在拖」的视觉反馈。 */
  draggingClipId: string | null;
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

  /**
   * 吸附开关（`project.ui.magnetic`，缺省 = 开）。**唯一读值处** —— 下面所有编辑都经它，
   * 不在各调用点各写一遍 `project?.ui.magnetic ?? true`（那会长出多个判据、迟早漂）。
   */
  const magnetic = magneticOf(project?.ui);

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

    /**
     * 一次 pointermove 的**实际计算与落盘**。
     *
     * 【为什么把它单拎出来，而不是直接把逻辑写在 onMove 里】
     * 指针事件在 120Hz 触控板 / 高刷屏上可达每秒上百次，而每次 `applyTracks` 都是一轮
     * 全量 tracks 重算 + React 重渲染。裸挂 `onMove` = 拖一次炸几十上百次渲染（卡顿来源）。
     * 故 onMove 只**记下最新坐标**，真正的计算交给 `requestAnimationFrame`：
     * 同一帧内无论来多少次 move，只算一次「最新位置」—— 帧率上限即真实刷新率，
     * 且**不丢最后一帧**（用最新坐标算，不是队列回放）。范式与 `ImageZoomDialog` 的 rAF 合帧一致。
     */
    const apply = (clientX: number) => {
      const drag = dragRef.current;
      if (!drag || !project) return;
      const track = project.tracks.find((t) => t.id === drag.trackId);
      const clip = track?.clips.find((c) => c.id === drag.clipId);
      if (!track || !clip) return;
      const dt = pxDeltaToTime(clientX - drag.originX, pps);

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
            // 主轨吸附开：横向拖 = **拖序**（落点序号由 `dropIndexAt` 给，重排后压实，拖不出缝）；
            // 主轨吸附关：横向拖 = **自由摆位**（`placeClipAt`，可拖出空隙，与音频轨同款）；
            // 自由轨（音频）：始终自由摆位（不压实 —— 会毁掉用户摆的空隙）。
            if (tr.overlay || !magnetic) {
              return { ...tr, clips: placeClipAt(tr.clips, clip.id, t) };
            }
            return { ...tr, clips: moveClipTo(tr.clips, clip.id, dropIndexAt(tr.clips, t, clip.id)) };
          }),
        );
        return;
      }

      // 调片段长度（粗档）：只改**源端点**，时间轴落位交给压实（磁吸轨）或自行右移（自由轨）。
      // 语义：左柄右拖 = 裁掉片段开头（右缘随之自动前移 = 波纹）；右柄右拖 = 加长出点。
      // 不做吸附：两种轨上「边缘」都不是自由变量（磁吸轨边缘由压实决定，自由轨边缘不动）。
      const isLeft = drag.mode === 'trimLeft';
      const next = isLeft ? drag.origin.sourceStart + dt : drag.origin.sourceEnd + dt;
      store.applyTracks((tracks) =>
        updateClip(
          tracks,
          clip.id,
          (c) => {
            if (isLeft) {
              const s = Math.max(0, Math.min(next, c.sourceEnd - EPS));
              // 吸附开 + 主轨：`timelineStart` 的真源是**压实**（`relayoutSequential`），此处**不得**手动位移，
              // 否则「先右移再被压回」会闪一帧。入点前进后压实自动把左缘拉回前一片段末尾
              // —— 视觉即「右缘自动往前」（波纹前移），符合磁吸不变量 I1。
              // 其余两条（自由轨 / 吸附关的主轨）：不压实，用户摆好的空隙要保留，
              // 故起点须与入点同量右移（右缘钉住，左缘跟手柄）。
              if (!track.overlay && magnetic) return { ...c, sourceStart: s };
              return {
                ...c,
                sourceStart: s,
                timelineStart: Math.max(0, c.timelineStart + (s - c.sourceStart)),
              };
            }
            return { ...c, sourceEnd: Math.max(c.sourceStart + EPS, next) };
          },
          magnetic,
        ),
      );
    };

    // 合帧状态：pending 存「本帧最新坐标」，raf 为待执行的帧回调 id（0 = 无待执行）。
    let pending: number | null = null;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      pending = e.clientX;
      if (raf) return; // 本帧已有待执行回调 → 只更新坐标，不再排一帧
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (pending === null) return;
        const x = pending;
        pending = null;
        apply(x);
      });
    };
    const onUp = () => {
      // 取消未执行的帧并补最后一帧：否则「松手时那一次 move」可能被丢掉 → 落点差一点
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (pending !== null) {
        const x = pending;
        pending = null;
        apply(x);
      }
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, project, pps, store, magnetic]);

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

  /**
   * C15.2 复制：主轨 = 紧随其后（吸附开压实、关则保留空隙）；自由轨 = 落到轨尾（不压实毁位置）。
   */
  const duplicateSelected = useCallback(() => {
    if (!selectedClipId) return;
    store.applyTracks((tracks) =>
      tracks.map((t) => {
        const source = t.clips.find((c) => c.id === selectedClipId);
        if (!source) return t;
        if (!t.overlay) return { ...t, clips: duplicateClip(t.clips, selectedClipId, magnetic) };
        return {
          ...t,
          clips: [...t.clips, { ...source, id: generateId('clip'), timelineStart: appendTime(t) }],
        };
      }),
    );
  }, [selectedClipId, store, magnetic]);

  /**
   * 删除（**单一动作**）：留洞还是波纹，完全由**吸附开关**决定 ——
   * 吸附开 → 自动左移补上空（波纹）；吸附关 → 留洞。
   *
   * 【为什么不做成两个按钮】「留洞 / 波纹」是剪辑软件的专业术语，普通用户看到两个
   * 一模一样的垃圾桶图标只会困惑；而吸附开关本就是这个选择的上层语义，交给它即可。
   */
  const deleteSelected = useCallback(() => {
    applyMain((clips) =>
      selectedClipId ? removeClips(clips, [selectedClipId], 'lift', magnetic) : null,
    );
  }, [selectedClipId, applyMain, magnetic]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (isEditableTarget(e)) return; // 输入框内不劫键；Esc 不接管（C10.2）
      const action = editorKeyAction(e);
      if (!action) return;
      e.preventDefault();
      if (action === 'undo') store.undo();
      else if (action === 'redo') store.redo();
      // 键盘 Delete 与工带删除**同一个动作**：随吸附开关（吸附开自动补齐 → 修掉「删中间不左移」）
      else if (action === 'delete') deleteSelected();
    },
    [open, store, deleteSelected],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // 能力判据：**直接问原语**（不做第二套「能不能切」的推断），不可用即置灰 + tooltip（O3）
  const canSplit = splitAt(mainClips, playhead) !== null;
  const canTrimLeft = trimLeftAt(mainClips, playhead, magnetic) !== null;
  const canTrimRight = trimRightAt(mainClips, playhead, magnetic) !== null;
  const canDelete = selectedClipId !== null && mainClips.some((c) => c.id === selectedClipId);

  const editing: TimelineEditing = {
    canSplit,
    canTrimLeft,
    canTrimRight,
    canDelete,
    split: () => applyMain((clips) => splitAt(clips, playhead)),
    trimLeft: () => applyMain((clips) => trimLeftAt(clips, playhead, magnetic)),
    trimRight: () => applyMain((clips) => trimRightAt(clips, playhead, magnetic)),
    freeze: () =>
      applyMain(
        (clips) =>
          freezeFrameAt(clips, playhead, DEFAULT_IMAGE_CLIP_DURATION, magnetic)?.clips ?? null,
      ),
    delete: deleteSelected,
    duplicate: duplicateSelected,
  };

  return {
    selectedClipId,
    setSelectedClipId,
    draggingClipId: dragRef.current?.clipId ?? null,
    beginClipDrag,
    applyMain,
    editing,
  };
}
