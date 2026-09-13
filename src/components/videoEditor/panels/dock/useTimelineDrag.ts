/**
 * 基座时间轴拖拽/编辑/键盘编排 —— `docs/120` §0.4 粗档（拖序 / 调片段长度）· C7.3（锁定轨）· C10（键盘让位三组键）。
 *
 * 【它做什么】把「片段拖拽（move/trimLeft/trimRight）+ 工带编辑动作 + 撤销重做删除键盘」收敛成 hook。
 * 所有编辑都经 `core/timelineOps` 纯函数；能力判据直接问原语（`docs/123` O3：不可用即置灰）。
 *
 * 【ownership】选中态（selectedClipId）归本 hook —— 拖拽要改它、工带/键盘要读它、Lane 要高亮它，
 * Docker 统一从本 hook 取并下发给 DockToolbar / Lane。
 */

/** 「常驻层」声明（`dockContract.test.ts` 按此标记禁用 portal / FullscreenShell）：本目录的文件都挂在 App 根 flex 列内、常驻不 portal，故不许登记 modalLayer。 */
// DOCK_IS_PERSISTENT（常驻层声明 · dockContract.test.ts 按此标记禁用 portal）

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { isEditableTarget } from '../../../base/core/uiHooks.ts';
import { editorKeyAction } from '../../../base/core/modalLayer.ts';
import { showToast } from '../../../base/core/toastStore.ts';
import { generateId } from '../../../base/core/idGen.ts';
import { dropIndexAt, pxDeltaToTime, snapTime } from '../../../base/utils/timeline/timeScale.ts';
import { routeClipToTrack } from '../../core/routeClip.ts';
import {
  appendTime,
  appendTrack,
  clipEdges,
  duplicateClip,
  findTrackOfClip,
  freezeFrameAt,
  magneticOf,
  moveClipAcrossTracks,
  moveClipTo,
  placeClipAt,
  removeClips,
  removeTrack,
  splitAt,
  trimLeftAt,
  trimRightAt,
  updateClip,
} from '../../core/timelineOps.ts';
import {
  DEFAULT_IMAGE_CLIP_DURATION,
  EPS,
  MAX_TRACKS_PER_KIND,
  SNAP_TOLERANCE_PX,
} from '../../core/constants.ts';
import type { Clip, ClipKind, Project, Track, TrackKind } from '../../core/types.ts';
import type { EditorProjectStore } from './useEditorProject.ts';

/** 空片段数组的稳定引用（避免每次渲染新建数组导致下游 memo 失效）。 */
const EMPTY_CLIPS: Clip[] = [];

/**
 * 片段类别能否落进该类别轨道（跨轨拖拽的收放判据）。
 *
 * ★改（2026-09-14）：原实现**重写了一遍**分轨二分（`(clipKind === 'audio' ? 'audio' : 'video')`），
 * 而 `core/routeClip.ts::routeClipToTrack` **已经是**这条判据的唯一真源 ——
 * 两处各写一份 = 判据重复（`docs/123` §一.4 C 组的纪律：「UI 里不许内联 `kind === 'audio' ? …`」）。
 * 当时之所以没调它，只是因为本文件当时没 import 该模块；**判据本身没有任何不同**。
 * 现改为**直接复用**：加 `ClipKind` 时只需改 `TRACK_OF_CLIP` 一处（`Record` 缺失即编译报错）。
 */
function kindFitsTrack(clipKind: ClipKind, trackKind: TrackKind): boolean {
  return routeClipToTrack(clipKind) === trackKind;
}

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
  /**
   * 上一次**已被拒绝**的跨轨目标（锁定轨）id，`null` = 上次未被拒。
   *
   * 【为什么需要它】拖拽 `apply` 每帧都跑（rAF 合帧后仍可达 60 次/秒），
   * 若每帧都对锁定轨 `showToast`，用户会看到 toast 疯狂闪烁堆叠。
   * 记「上一次拒绝的目标」后就变成**状态变化时才提示一次**（进入某锁定轨提示、离开不提示、
   * 再进入再提示）—— 这是「持续状态只报一次」的最小实现，不需要引入计时器。
   */
  lastReject: string | null;
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
  /** 加一条轨（`appendTrack` 的唯一入口；到上限会自行 toast）。 */
  addTrack: (kind: TrackKind) => void;
  /** 删一条轨（非空 / 最后一条同类轨 / 锁定 → 拒绝并 toast 说明）。 */
  deleteTrack: (trackId: string) => void;
}

export function useTimelineDrag(opts: {
  store: EditorProjectStore;
  project: Project | null;
  pps: number;
  playhead: number;
  open: boolean;
}): EditorDrag {
  const { store, project, pps, playhead, open } = opts;

  /**
   * 「无选中时的回落轨」= 主轨（M1 的既有手感）。
   * ⚠️ 它**不再**是编辑动作的唯一落点：见下方 `editTargetTrackId` 的说明。
   */
  const mainTrack = project?.tracks.find((t) => !t.overlay) ?? null;

  /**
   * 吸附开关（`project.ui.magnetic`，缺省 = 开）。**唯一读值处** —— 下面所有编辑都经它，
   * 不在各调用点各写一遍 `project?.ui.magnetic ?? true`（那会长出多个判据、迟早漂）。
   */
  const magnetic = magneticOf(project?.ui);

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  /**
   * 编辑动作的**落点轨**（M2 多轨后不再是「主轨」）。
   *
   * 【判据顺序】选中片段在哪条轨，编辑就作用在哪条轨 —— 这才符合「我选了什么就改什么」。
   * 无选中时回落到**主轨**（分割 / 裁切 / 定格这三个动作只需要「播放头所在处」，
   * 不要求先选中；回落主轨保持 M1 的既有手感，不凭空要求用户先选片段）。
   *
   * 【为什么不能用 `find((t) => !t.overlay)` 当"要改哪条轨"】那正是 M1 的写法，
   * 多轨后它会把「叠加轨上选中的片段」误改到主轨上（改错对象）。
   */
  const editTargetTrackId =
    (selectedClipId ? findTrackOfClip(project?.tracks ?? [], selectedClipId)?.id : null) ??
    mainTrack?.id ??
    null;

  /** 编辑动作作用的那组片段 —— **判据与动作同源**（都取 `editTargetTrackId`）。 */
  const editClips =
    (editTargetTrackId
      ? project?.tracks.find((t) => t.id === editTargetTrackId)?.clips
      : undefined) ?? EMPTY_CLIPS;

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
        lastReject: null,
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
    const apply = (clientX: number, clientY: number) => {
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

        // ── 跨轨判定（M2 多轨）──
        // 指针纵向落在哪条 Lane 上，就是目标轨。判据取自 DOM（`data-lane-id`）而不是
        // 自己按行高累加算：行高是 `ui.rowHeight`（用户可调），算出来的「第几行」会与
        // 实际渲染脱节（且隐藏轨不占布局）。**行高变了这里不需要跟着改**。
        const targetId = (() => {
          const el = document.elementFromPoint(clientX, clientY);
          const lane = el?.closest('[data-lane-id]');
          return lane?.getAttribute('data-lane-id') ?? null;
        })();
        const targetTrack = targetId ? project.tracks.find((x) => x.id === targetId) : null;

        // 只有「落在另一条**能收下它**的轨上」才算跨轨；否则保持本轨行为不变
        // （拖到空白处 / 拖到类型不匹配的轨 → 视作同轨拖拽，不被"吸"走，避免误操作）。
        if (
          targetTrack &&
          targetTrack.id !== track.id &&
          kindFitsTrack(clip.kind, targetTrack.kind)
        ) {
          if (targetTrack.locked) {
            // 锁定轨拒绝一切编辑（C7.3）：明说一次就够，不必每帧 toast
            if (drag.lastReject !== targetTrack.id) {
              drag.lastReject = targetTrack.id;
              showToast(`「${targetTrack.name}」已锁定，未移入`);
            }
            return;
          }
          if (drag.lastReject !== null) drag.lastReject = null;
          store.applyTracks((tracks) =>
            moveClipAcrossTracks(tracks, clip.id, targetTrack.id, Math.max(0, t), magnetic),
          );
          return;
        }
        if (drag.lastReject !== null) drag.lastReject = null;

        store.applyTracks((tracks) =>
          tracks.map((tr) => {
            if (tr.id !== track.id) return tr;
            // 主轨吸附开：横向拖 = **拖序**（落点序号由 `dropIndexAt` 给，重排后压实，拖不出缝）；
            // 主轨吸附关：横向拖 = **自由摆位**（`placeClipAt`，可拖出空隙，与音频轨同款）；
            // 自由轨（叠加 / 音频）：始终自由摆位（不压实 —— 会毁掉用户摆的空隙）。
            if (tr.overlay || !magnetic) {
              return { ...tr, clips: placeClipAt(tr.clips, clip.id, t) };
            }
            return {
              ...tr,
              clips: moveClipTo(tr.clips, clip.id, dropIndexAt(tr.clips, t, clip.id)),
            };
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
    // 【为什么是 x+y 两个分量】跨轨判定要用指针的**纵向**位置（`elementFromPoint(x, y)`），
    // 故 pending 必须带上 `clientY`；只存 x 会让跨轨判断永远用「上一帧的 y」。
    let pending: { x: number; y: number } | null = null;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (raf) return; // 本帧已有待执行回调 → 只更新坐标，不再排一帧
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (pending === null) return;
        const p = pending;
        pending = null;
        apply(p.x, p.y);
      });
    };
    const onUp = () => {
      // 取消未执行的帧并补最后一帧：否则「松手时那一次 move」可能被丢掉 → 落点差一点
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (pending !== null) {
        const p = pending;
        pending = null;
        apply(p.x, p.y);
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

  /**
   * 把纯函数应用于**目标轨**（`editTargetTrackId`）的片段数组。
   *
   * 返回 `null` = 不可用（置灰），与 M1 一致。找不到目标轨 → 原引用不动（I4）。
   */
  const applyMain = useCallback(
    (fn: (clips: Clip[]) => Clip[] | null) => {
      const targetId = editTargetTrackId;
      if (!targetId) return;
      store.applyTracks((tracks) =>
        tracks.map((t) => {
          if (t.id !== targetId) return t;
          const next = fn(t.clips);
          return next ? { ...t, clips: next } : t;
        }),
      );
    },
    [store, editTargetTrackId],
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

  /* ── 轨道增删（M2 多轨）—— 工带 / 轨道头入口共用的唯一动作源 ── */

  /**
   * 加一条轨。`appendTrack` 已内含**上限判据**（返回原引用 = 到顶了），
   * 故这里只要判「返回的是不是原引用」就知道该不该提示 —— 不在 UI 里再算一遍轨道数
   * （那会长出第二个「能加几条」的判据）。
   */
  const addTrack = useCallback(
    (kind: TrackKind) => {
      let added = false;
      store.applyTracks((tracks) => {
        const next = appendTrack(tracks, kind);
        added = next !== tracks;
        return next;
      });
      if (!added) showToast(`轨道数已达上限（${MAX_TRACKS_PER_KIND} 条），未新增`);
    },
    [store],
  );

  /**
   * 删一条轨。
   *
   * 「非空轨 / 最后一条同类轨」的拒绝判据在 `removeTrack` 里（返回原引用），
   * 此处负责把**为什么没删掉**说清楚（Step 4：不静默吞）—— 判据单点，UI 只翻译原因。
   */
  const deleteTrack = useCallback(
    (trackId: string) => {
      const track = project?.tracks.find((t) => t.id === trackId);
      if (!track) return;
      if (track.locked) {
        showToast(`「${track.name}」已锁定，不可删除`);
        return;
      }
      if (track.clips.length > 0) {
        showToast(`「${track.name}」上还有 ${track.clips.length} 个片段，请先清空再删除`);
        return;
      }
      const sameKindCount = project?.tracks.filter((t) => t.kind === track.kind).length ?? 0;
      if (sameKindCount <= 1) {
        showToast('至少要保留一条同类轨道');
        return;
      }
      // 删掉的轨上若正好有选中片段 → 清掉选中态（否则"选中一个已不存在的片段"是幽灵态）
      if (selectedClipId && track.clips.some((c) => c.id === selectedClipId)) {
        setSelectedClipId(null);
      }
      store.applyTracks((tracks) => removeTrack(tracks, trackId));
    },
    [store, project, selectedClipId],
  );

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
  // 片段来源 = `editClips`（选中片段所属轨 / 无选中回落主轨），与动作落点**同一个来源** ——
  // 判据与动作不同源就会「按得出、点了没反应」。
  const canSplit = splitAt(editClips, playhead) !== null;
  const canTrimLeft = trimLeftAt(editClips, playhead, magnetic) !== null;
  const canTrimRight = trimRightAt(editClips, playhead, magnetic) !== null;
  const canDelete = selectedClipId !== null && editClips.some((c) => c.id === selectedClipId);

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
    addTrack,
    deleteTrack,
  };
}
