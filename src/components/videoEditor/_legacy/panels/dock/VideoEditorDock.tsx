/**
 * 视频剪辑器**基座**（常驻底部层）—— `docs/123` §二.3 G3/G5 卡 · `docs/120` C10 / C4 / C11 / C13。
 *
 * ── 形态铁律（改它之前先读这三条）──
 * 1. **常驻底部层，不是全屏层**：挂 `App` 根 flex 列的底部（`TopNav` 与画布之间**不覆盖**画布），
 *    **不用 `FullscreenShell` / 不用 portal / 不登记 `modalLayer`**（`docs/120` C10.1）。
 *    登记一次 → 画布快捷键全废、「画布点选素材入轨」这个**主入口**直接死掉。
 * 2. **非模态**：基座展开时画布仍可点选/拖节点（`docs/123` G3 人工验收项）。
 * 3. **键盘只让位三组键**（`docs/120` C10「关键区分」表）：Delete/Backspace · ⌘Z · ⌘⇧Z(⌘Y)。
 *    其余画布快捷键照旧 —— 判据与 `useCanvasShortcuts` **共用同一个 `editorKeyAction()`**。
 *
 * ── 两条入口（`docs/120` C4）──
 * · **顶栏按钮**（`TopNav`）：展开 / 收起基座。
 * · **画布上点选素材节点**（C11）：**仅基座展开时**生效，选中即落轨尾；折叠态点选**不产生任何动作**。
 *
 * ── 本文件是什么（拆分后，`docs/128` §3）──
 * **纯编排层**：状态声明 + hook 调用 + 组件组装 + 回调绑定。**不含领域逻辑**，各自归位：
 *   · 入轨 → `useEditorIngest` · 走带/播放头 → `useEditorTransport` · 拖拽/编辑/键盘 → `useTimelineDrag`
 *   · 导出 → `useEditorExport` · 工带 → `DockToolbar` · 常驻/设置条 → `DockStatusBar` · 标尺/播放头 → `RulerStrip` · 出声 → `PlaybackSink`
 * 留在本文件的：C4.5 挂载硬断言、派生（allClips/visuals）、轨道渲染（Lane/TrackHead）、基座高度拖柄。
 *
 * ── 未做的部分（诚实清单，别读成已完成）──
 * 多选 + 框选批量删除（C11.8）· 右键集（C15，用户裁定不做）。走带出声未真机验收。
 */

/** 「常驻层」声明（`dockContract.test.ts` 按此标记禁用 portal / FullscreenShell）：本目录的文件都挂在 App 根 flex 列内、常驻不 portal，故不许登记 modalLayer。 */
// DOCK_IS_PERSISTENT（常驻层声明 · dockContract.test.ts 按此标记禁用 portal）

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { Eye, EyeOff, Lock, LockOpen, Trash2, Volume2, VolumeX } from 'lucide-react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useCanvasEdges } from '../../../base/canvas/CanvasEdgesContext.tsx';
import {
  clampZoom,
  snapTime,
  timeDeltaToPx,
  timeToX,
  xToTime,
} from '../../../base/utils/timeline/timeScale.ts';
import {
  DEFAULT_ROW_HEIGHT,
  DOCK_CLICK_TOLERANCE_PX,
  MAX_TRACKS_PER_KIND,
  SNAP_TOLERANCE_PX,
} from '../../core/constants.ts';
import { rowHeightOf, trackHasAudio } from '../../core/routeClip.ts';
import { clipDuration, clipEdges, magneticOf } from '../../core/timelineOps.ts';
import type { Clip, Track, TrackKind } from '../../core/types.ts';
import { useEditorFilmstrips } from '../../hooks/useEditorFilmstrips.ts';
import { useEditorSources } from '../../hooks/useEditorSources.ts';
import { useEditorWaveforms } from '../../hooks/useEditorWaveforms.ts';
import { filmstripBackground, waveformPath, waveformSpan } from './clipSourceView.ts';
import { DockStatusBar } from './DockStatusBar.tsx';
import { DockToolbar } from './DockToolbar.tsx';
import { PlaybackSink } from './PlaybackSink.tsx';
import {
  PLAYHEAD_HIT_HALF_WIDTH_PX,
  playheadLineStyle,
  RulerStrip,
  RULER_HEIGHT,
} from './RulerStrip.tsx';
import { useEditorExport } from './useEditorExport.ts';
import { useEditorIngest } from './useEditorIngest.ts';
import { useEditorProject } from './useEditorProject.ts';
import { useEditorTransport } from './useEditorTransport.ts';
import { useTimelineDrag } from './useTimelineDrag.ts';

/** 基座时间轴的初始缩放（像素/秒）。用户可用工具带的 ⊖ / 滑块 / ⊕ 改（C12/工具带形态）。 */
const INITIAL_PPS = clampZoom(40);

/**
 * 轨道行高与片段内部件高度。
 * `docs/120` C11.10c 红线：「胶片条 / 波形占剩余高度并**随之缩放**」「禁止写死像素」。
 * 三者由行高**派生**；行高是**工程 UI 记忆**（`ui.rowHeight`，随工程落盘，`docs/120` C7.5）。
 */
/**
 * 轨道头固定列宽（px）。
 *
 * 【为什么从 78px 抬到 126px —— 算出来的，不是拍出来的】
 * mockup 原形态是 `[类型图标][锁][眼][喇叭]` **4 格** 13px 图标 + `gap:2px`：
 *   4×13 + 3×2 = 58px，78px 里剩 20px 作为左右留白（各 10px）。
 *
 * M2 多轨后必须多出两个东西：**序号**（`V1`/`V2` —— 否则两条「视频轨」无从区分）
 * 与**删轨按钮**（删轨只能住在这里，见 `TrackHead` 的说明）。按下表重算：
 *   `[序号][锁][眼][喇叭][删]` = 5 格
 *   · 序号格 30px（`V1` 是两个字符，需要真的放得下）
 *   · 每个按钮格 22px（13px 图标 + 9px 命中区余量 —— 22px 是按「鼠标能稳定点中」定的，
 *     不是按图标尺寸；低于此值时相邻按钮会互相抢点击）
 *   · `gap` 1px + 左右留白各 8px
 *   30 + 4×22 + 4×1 + 2×8 = 126px ✅
 *
 * 【为什么是**固定**宽度，不随「能不能删」伸缩】列宽变化会让右侧轨道区宽度跟着跳，
 * 用户会看到「一条轨删光片段后画面整体挪了一下」——典型的视觉 bug。故固定为
 * **最宽那个状态**（可删轨）的宽度。
 */
const TRACK_LABEL_PX = 126;
/** 片段名条高度（C11.10b：名字**不压在缩略图上**，独立一条窄条）。 */
const CLIP_NAME_BAR = 15;
/** 片段在行内的上下边距。 */
const CLIP_INSET = 2;

/** 基座高度可拖范围（C7.5）：上限够看全、下限保住工具带 + 至少一行轨道。 */
const DOCK_MIN_HEIGHT = 120;
const DOCK_MAX_HEIGHT = 520;

interface VideoEditorDockProps {
  open: boolean;
  onClose: () => void;
  /** 工程随项目走（`docs/120` C2.6）；切换项目由 `App` 用 `key` 强制重挂载。 */
  projectId: string;
}

export default function VideoEditorDock({ open, onClose, projectId }: VideoEditorDockProps) {
  // 首次展开才加载（折叠不重载、也不丢状态）；常驻挂载 = 与 AgentPanel 同款（open 控显隐）
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  /* ── C4.5 硬断言：必须在 ReactFlowProvider 子树内 ──
   * 挂到 provider 之外时，导出回写（`spawnAndCommit`）会**静默失败且无任何报错**。
   * 故在挂载期就断言，不递延到「用户点了导出才发现没反应」。 */
  const flow = useReactFlow();
  if (typeof flow?.setNodes !== 'function' || typeof flow?.getNodes !== 'function') {
    throw new Error(
      '视频剪辑器基座必须挂在 ReactFlowProvider 子树内：缺失该上下文时导出回写会静默失败（docs/120 C4.5）',
    );
  }
  const history = useCanvasEdges();

  const store = useEditorProject(projectId, everOpened);
  const project = store.project;
  const sources = useEditorSources(project);

  /** 缩放（像素/秒）—— 工具带 ⊖ / 滑块 / ⊕ 可改（经 `clampZoom` 走同一取值域）。 */
  const [pps, setPps] = useState(INITIAL_PPS);
  /**
   * **视频轨**行高（`docs/120` C7.5）—— **工程 UI 记忆**，来自 `project.ui.rowHeight`（随工程落盘）。
   *
   * ⚠️ 它**只作用于视频轨**（用户裁定 2026-09-14：「放大缩小轨道只针对视频轨道」）。
   * 音频轨 / 文字轨用固定值 —— 实际取值一律经 `rowHeightOf(track, videoRowHeight)` 获取，
   * **不得在渲染处直接用它**（那会让音频轨跟着缩放，即本次要修的 bug）。
   */
  const videoRowHeight = project?.ui.rowHeight ?? DEFAULT_ROW_HEIGHT;
  /**
   * 胶片条 / 波形可用高度 —— 按**视频轨**行高派生（只有视频轨有胶片条，见 C11.10c；
   * filmstrip 键含此高 → 改行高自动重抽）。音频/文字轨虽共用这套内部件高度，
   * 但它们的波形/文字是「占剩余高度」自适应的，不受本值影响正确性。
   */
  const stripHeight = Math.max(8, videoRowHeight - CLIP_INSET * 2 - CLIP_NAME_BAR);

  /** 工程参数 / 轨道高度编辑面板开关（`docs/120` C12.2 · C7.5）。 */
  const [settingsOpen, setSettingsOpen] = useState(false);

  /**
   * 轨道区当前的横向滚动量（px）。
   *
   * 【为什么标尺要读它】修正后的结构里，**标尺在纵向滚动容器内、但横向要跟着轨道行一起走**。
   * 标尺不能自己再做一次 `overflow-x-auto`（那会变成第二个横向滚动容器，两个滚动位置会漂），
   * 故它由这一个状态量**平移跟随**轨道区的 `scrollLeft` —— 横向真相只有一份（轨道区的滚动位置）。
   */
  const [scrollX, setScrollX] = useState(0);

  /**
   * 轨道区可视宽度（px）—— 由 `ResizeObserver` 跟随容器变化。
   *
   * 【为什么要它】标尺在 `sticky` 行里、自己不滚动，故它的宽度必须**显式**给
   * （内容全是 `absolute`，`flex-1` 撑不出宽度）。而标尺要铺的宽度 = 「可视宽」与
   * 「时间轴内容宽」的**较大者**：内容比可视短时铺满可视宽（标尺不会缺一截），
   * 内容更长时铺到内容宽（横滚到哪都有刻度）。
   */
  const [viewportW, setViewportW] = useState(0);

  /** 吸附开关（`project.ui.magnetic`，缺省 = 开）—— 随工程落盘、不进撤销栈。 */
  const magnetic = magneticOf(project?.ui);

  /* ── 生命周期 refs（挂载期存活；导出/入轨异步回写前要复核，坑 §五.1：真收紧不重挂）── */
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  /** 基座高度拖柄要读**最新** store（`store` 每次渲染换身份 → 经 ref，见坑 §五.1）。 */
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  });

  /* ── 派生（纯 React 视图态，非领域逻辑）── */
  const allClips = useMemo(() => project?.tracks.flatMap((t) => t.clips) ?? [], [project]);
  const playhead = project?.playhead ?? 0;

  /**
   * 轨道区可视宽（`ResizeObserver` 跟随）。
   *
   * 【为什么不用 `window.resize`】基座宽度不只随窗口变 —— 侧栏开合、基座高度拖拽也会改它。
   * `ResizeObserver` 直接观测那个元素本身，是所有变化的**唯一正确连接点**。
   */
  const trackScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = trackScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number') setViewportW(w);
    });
    ro.observe(el);
    setViewportW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const brokenIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, state] of sources.byClipId) {
      if (state.resolved.status === 'broken') ids.add(id);
    }
    return ids;
  }, [sources.byClipId]);

  // 胶片条（C11.10：一条图共享所有同源片段）
  const stripEntries = useMemo(
    () =>
      allClips
        .map((clip) => {
          const state = sources.byClipId.get(clip.id);
          if (clip.kind !== 'video' || state?.resolved.status !== 'ok') return null;
          return { url: state.resolved.url, duration: state.duration ?? 0 };
        })
        .filter((e): e is { url: string; duration: number } => e !== null),
    [allClips, sources.byClipId],
  );
  const strips = useEditorFilmstrips(stripEntries, stripHeight);

  // 音频素材的真实波形（C11.7b：峰值数组）
  const audioUrls = useMemo(
    () =>
      allClips
        .map((clip) => {
          const state = sources.byClipId.get(clip.id);
          return clip.kind === 'audio' && state?.resolved.status === 'ok'
            ? state.resolved.url
            : null;
        })
        .filter((u): u is string => u !== null),
    [allClips, sources.byClipId],
  );
  const waveforms = useEditorWaveforms(audioUrls);

  // 片段 → 画面该显示什么（胶片条 / 图片本体 / 波形 / 都没有）
  const visuals = useMemo(() => {
    const map = new Map<string, ClipVisual>();
    for (const clip of allClips) {
      const state = sources.byClipId.get(clip.id);
      if (!state || state.resolved.status !== 'ok') continue;
      map.set(clip.id, {
        url: state.resolved.url,
        sourceDuration: state.duration ?? clipDuration(clip),
        stripUrl: strips.get(state.resolved.url),
        peaks: waveforms.get(state.resolved.url),
        hasAudio: state.hasAudio,
      });
    }
    return map;
  }, [allClips, sources.byClipId, strips, waveforms]);

  /* ── 单项职责 hook（纯编排接线；各自持有领域逻辑，见文件头归属清单）── */
  useEditorIngest({ flow, open, store, aliveRef });
  const transport = useEditorTransport({ store, project, pps });
  const drag = useTimelineDrag({ store, project, pps, playhead, open });
  const exp = useEditorExport({ flow, history, project, allClips, sources, aliveRef });

  /**
   * 标尺要铺的宽度 = max(可视宽, 时间轴内容宽)。
   *
   * 时间轴内容宽用 `timeToX(总时长)` 而不是读 DOM：它与片段定位**同一套换算**
   * （`timeToX` + 同一 `pps`），故刻度与片段的像素位置必然一致（读 DOM 反而会因时序差一帧）。
   * 末尾额外留 24px 余量：播放头/片段拖到最右端时仍有可滚空间。
   */
  const rulerContentW = Math.max(viewportW, timeToX(transport.totalDuration, pps, 0) + 24);

  /* ── 顶部拖柄 = **收起按钮 + 高度拖柄**二合一（都在正中，入口/出口对称）──
   *
   * 交互设计（用户口径：基座从中间展开，关闭也该在中间）：
   *  · **点一下**（位移 < 阈值）→ **收起基座**（明确的关闭出口，可发现性远高于"往下拖"）；
   *  · **按住上下拖** → 调整基座高度（C7.5，落盘 `ui.dockHeight`）。
   * 两条动作共用同一命中区，靠"松手时有没有真的拖动"区分 —— 与 tab 拖拽的 `MOVE_THRESHOLD`
   * 同一套判据（`assistantTable/useTabDragSort.ts`），不另立第二套。
   *
   * ⚠️ 原实现只有"拖过 60px 才收起"，没有任何提示 → 用户根本不知道能关（可发现性事故）。
   */
  const dockResizeRef = useRef<{ startY: number; startH: number; lastY: number } | null>(null);
  const beginDockResize = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (!storeRef.current.project) return;
      dockResizeRef.current = {
        startY: e.clientY,
        startH: storeRef.current.project.ui?.dockHeight ?? 280,
        lastY: e.clientY,
      };
      const onMove = (ev: PointerEvent) => {
        const d = dockResizeRef.current;
        if (!d) return;
        d.lastY = ev.clientY;
        const next = Math.min(
          DOCK_MAX_HEIGHT,
          Math.max(DOCK_MIN_HEIGHT, d.startH + (d.startY - ev.clientY)),
        );
        storeRef.current.applyProjectPatch({
          ui: { ...(storeRef.current.project?.ui ?? {}), dockHeight: next },
        });
      };
      const onUp = () => {
        const d = dockResizeRef.current;
        dockResizeRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (!d) return;
        // 位移 ≤ 阈值 = 用户只是**点了一下**（没想调高度）→ 收起基座。
        // 这比「拖过 60px 才收起」好得多：关闭入口变成**明确的一次点击**，人人都会用。
        if (Math.abs(d.lastY - d.startY) <= DOCK_CLICK_TOLERANCE_PX) onClose();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [onClose],
  );

  return (
    <section
      aria-label="视频剪辑器"
      data-video-editor-dock
      /* 编辑器整体 `select-none`：这里拖拽操作密集（片段 / 手柄 / 播放头），
         不禁止选中就会在拖拽时顺手刷出一片蓝底文字。 */
      className={`relative flex flex-col border-t border-edge bg-surface-deep text-primary select-none ${open ? '' : 'hidden'}`}
      style={{ height: project?.ui.dockHeight ?? 280 }}
    >
      {/* 走带真出声（docs/120 C11.7 · M1）：随播放头对齐的隐藏媒体元素 */}
      <PlaybackSink
        open={open}
        playing={transport.playing}
        playhead={transport.displayHead}
        tracks={project?.tracks ?? EMPTY_TRACKS}
        sources={sources.byClipId}
      />
      {/* 工带（mockup `.vd-bar`）—— DockToolbar 纯渲染。
          收起按钮（横线）已**并入工具带正中间**，不再单独占一行（省一行高度）。 */}
      <DockToolbar
        displayHead={transport.displayHead}
        totalDuration={transport.totalDuration}
        playing={transport.playing}
        pps={pps}
        canUndo={store.canUndo}
        canRedo={store.canRedo}
        onTogglePlay={transport.onTogglePlay}
        stepToBoundary={transport.stepToBoundary}
        undo={store.undo}
        redo={store.redo}
        editing={drag.editing}
        duplicateEnabled={
          !!drag.selectedClipId && allClips.some((c) => c.id === drag.selectedClipId)
        }
        canExport={allClips.length > 0}
        exporting={exp.exporting}
        exportStage={exp.exportStage}
        exportProgress={exp.exportProgress}
        onExport={exp.onExport}
        abortExport={exp.abortExport}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((o) => !o)}
        project={project}
        // 齿轮里的「轨道高度」滑块改的是**视频轨**行高（`ui.rowHeight`）——
        // 音频/文字轨用固定值，不随它变化（`rowHeightOf` 是唯一判据处）
        rowHeight={videoRowHeight}
        applyProjectPatch={store.applyProjectPatch}
        magnetic={magnetic}
        onToggleMagnetic={() =>
          project && store.applyProjectPatch({ ui: { ...project.ui, magnetic: !magnetic } })
        }
        onDockResizePointerDown={beginDockResize}
        onPpsChange={setPps}
        trackAreaRef={transport.trackAreaRef}
      />

      {/* ── 轨道区（修正后的滚动结构，见下方长注释）──
       *
       * 【为什么是这个层级 —— 原结构有一个真实的对齐 bug】
       * 原实现把 `overflow-x-auto` 放在右列上，于是**横向滚动条成了轨道行的一个兄弟**：
       *   · 轨道变多 → 纵向溢出，但**没有任何纵向滚动容器** → 左列与右列都够不到下方轨道；
       *   · 横向滚动条（~10px）压在右侧底部 → 右列的轨道行整体上移 10px；
       *   · 左列连横向溢出都没有容器 → 直接被裁切。
       * 结果：左列第 N 行与右列第 N 行**不再同一像素行**（用户口径：「他们就不在一行」）。
       *
       * 【修正后的结构】滚动分两层，各管一个方向，**纵向只有一个主人**：
       *   ┌ 外层 `overflow-y-auto`（唯一纵滚）—— 同时管左列与右列，二者天然同步
       *   │  ├ 标尺行 `sticky top-0`（横向滚动时钉住，不随内容滚走）
       *   │  └ 内容行 [flex]
       *   │      ├ 左列（**无任何 overflow**，高度由内容撑开 = 随外层一起滚）
       *   │      └ 右列 `overflow-x-auto`（只横滚，纵向交给外层）
       *
       * 关键点：右列的 `overflow-x-auto` 不再携带纵向语义，故它不会与外层争纵向滚动；
       * 横向滚动条出现在**内容行内部底部**，不再把左列顶上去（左列在纵向由外层统一对齐）。
       */}
      <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {/* 标尺行：左右两列各占位，横向滚动时**钉在顶部**（`sticky`），纵向随外层滚 */}
        <div className="sticky top-0 z-20 flex bg-surface-deep">
          {/* 左列标尺占位 */}
          <div
            className="shrink-0 border-r border-b border-edge-faint"
            style={{ width: TRACK_LABEL_PX, height: RULER_HEIGHT }}
          />
          {/* 右侧标尺：与下方轨道区共用同一横向滚动 —— 故它自己**不是**滚动容器，
              而是由父级传入的 transform 跟随；见下方 trackAreaRef 的说明。 */}
          <div className="flex-1 min-w-0 relative overflow-hidden border-b border-edge-faint">
            <div
              className="absolute top-0 left-0 h-full"
              style={{ transform: `translateX(${-scrollX}px)` }}
            >
              <RulerStrip
                hasProject={!!project}
                pps={pps}
                totalDuration={transport.totalDuration}
                displayHead={transport.displayHead}
                onPlayheadPointerDown={transport.beginPlayheadDrag}
                contentWidth={rulerContentW}
              />
            </div>
          </div>
        </div>

        {/* 内容行：左列（不动）+ 右列（只横滚） */}
        <div className="flex min-h-0">
          {/* 固定左列：**不设任何 overflow** —— 既不横滚也不纵滚（纵向由最外层统一管），
              这样它与右侧轨道行在任何滚动状态下都逐行同高、同一像素位置。 */}
          <div
            className="shrink-0 flex flex-col border-r border-edge-faint bg-surface-deep"
            style={{ width: TRACK_LABEL_PX }}
          >
            {project?.tracks.map((track, index) => (
              <Fragment key={track.id}>
                <TrackHead
                  track={track}
                  // 轨道序号（V1/V2/A1/A2）：按**同类别内的出现次序**算，与层序分组一致。
                  // 名字（`track.name`）仍保留在 tooltip 里 —— 序号管"第几层"，名字管"这是什么"。
                  ordinal={ordinalOf(project.tracks, track, index)}
                  canDelete={
                    !track.locked &&
                    track.clips.length === 0 &&
                    project.tracks.filter((t) => t.kind === track.kind).length > 1
                  }
                  // 行高经**唯一判据** `rowHeightOf`（视频轨=可调值；音频/文字=固定值）——
                  // 与右侧 `Lane` 用同一函数，保证左列与右列**逐像素同高对齐**
                  rowHeight={rowHeightOf(track, videoRowHeight)}
                  onToggle={(patch) =>
                    store.applyTracks((tracks) =>
                      tracks.map((t) => (t.id === track.id ? { ...t, ...patch } : t)),
                    )
                  }
                  onDelete={() => drag.deleteTrack(track.id)}
                />
                {/* 与右侧轨道区**逐行同高对齐**：每条轨道头下方同样一条底边，让分隔线横向贯通整行 */}
                <div className="h-px shrink-0 bg-edge-faint" aria-hidden />
              </Fragment>
            ))}
          </div>

          {/* 右侧滚动区：**只负责横向滚动**（`overflow-y-hidden` 明确交出纵向）。
              纵向滚动条由最外层承担，故这里不会出现第二条纵向条。
              `trackScrollRef` 观测可视宽；`transport.trackAreaRef`（同一元素）给 seek 换算用。 */}
          <div
            ref={(el) => {
              transport.trackAreaRef.current = el;
              trackScrollRef.current = el;
            }}
            className="relative flex-1 min-w-0 overflow-x-auto overflow-y-hidden text-primary"
            onScroll={(e) => setScrollX(e.currentTarget.scrollLeft)}
            onPointerDown={(e) => {
              // 点轨道区 = 移动播放头（D 组换算原语的消费点），并**吸附到片段边界**
              const rect = e.currentTarget.getBoundingClientRect();
              if (rect.width <= 0) return;
              const raw = xToTime(e.clientX - rect.left + e.currentTarget.scrollLeft, pps, 0);
              transport.setPlayhead(
                snapTime(
                  raw,
                  clipEdges(project?.tracks.flatMap((t) => t.clips) ?? []),
                  pps,
                  SNAP_TOLERANCE_PX,
                ),
              );
            }}
          >
            {store.status === 'loading' && (
              <div className="p-3 text-xs opacity-60">正在加载工程…</div>
            )}

            {project?.tracks.map((track) => (
              <Fragment key={track.id}>
                <Lane
                  track={track}
                  pps={pps}
                  rowHeight={rowHeightOf(track, videoRowHeight)}
                  selectedClipId={drag.selectedClipId}
                  draggingClipId={drag.draggingClipId}
                  brokenIds={brokenIds}
                  visuals={visuals}
                  onClipPointerDown={drag.beginClipDrag}
                  onSelectClip={drag.setSelectedClipId}
                />
                {/* **每条轨道下方**的底边线：独立 1px 元素，**无条件渲染** ——
                    不依赖轨道自身高度/内容，空轨道（如还没放音频的音频轨）同样有线；
                    末轨下方也保留（用户口径：每条都要有一条 border，不分首末）。 */}
                <div className="h-px shrink-0 bg-edge-faint" aria-hidden />
              </Fragment>
            ))}

            {/* ── 播放头：**贯穿整条轨道区**的「红线 + 命中区」两层 ──
             *
             * 标尺行里那一套只覆盖 22px 高（它在 `sticky` 行内，伸不下来），故轨道区这段
             * 必须自己再画一遍 —— 但**定位与宽度全部读 `RulerStrip` 的同一处定义**，不另算一套：
             *   · 位置 → `playheadLineStyle`（曾因这里漏半宽补偿 ⇒ 上下错开 1px，用户实测报出）
             *   · 命中宽 → `PLAYHEAD_HIT_HALF_WIDTH_PX`（保证上下两段手感一致）
             *
             * 【为什么命中区要单独一层、且不能 `pointer-events-none`】
             * 用户口径：「下面没办法拖动了」—— 红线本体是 `pointer-events-none`（纯视觉），
             * 若轨道区没有自己的命中层，那么红线在轨道区经过的地方就完全点不动。
             * 故这里补一条**贯穿整高的透明命中带**，与标尺段调同一个 `beginPlayheadDrag`。
             *
             * 【为什么不担心挡住片段拖拽】命中带只有 `PLAYHEAD_HIT_HALF_WIDTH_PX × 2` = 10px 宽，
             * 紧贴红线；片段其余绝大部分区域照常可拖 —— 与剪映 / Premiere 同款做法。
             * 层级 z-[18]：高于片段（片段 z 默认），低于左列固定列与标尺行（z-20/21）。 */}
            {project && (
              <>
                <div
                  data-playhead-line
                  className="absolute top-0 bottom-0 z-[17] pointer-events-none"
                  style={{
                    ...playheadLineStyle((t) => timeToX(t, pps, 0), transport.displayHead),
                    background: 'rgb(var(--mao-danger) / 1)',
                  }}
                  aria-hidden
                />
                <div
                  data-playhead-hit
                  role="slider"
                  aria-label="播放头"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(transport.totalDuration)}
                  aria-valuenow={Math.round(transport.displayHead)}
                  title="拖动播放头"
                  className="absolute top-0 bottom-0 z-[18] cursor-ew-resize touch-none"
                  style={{
                    left: timeToX(transport.displayHead, pps, 0),
                    marginLeft: -PLAYHEAD_HIT_HALF_WIDTH_PX,
                    width: PLAYHEAD_HIT_HALF_WIDTH_PX * 2,
                  }}
                  onPointerDown={transport.beginPlayheadDrag}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* 常驻信息 / 设置条 / 断链 / 冲突失败 + **加轨操作** —— DockStatusBar 纯渲染。
          置于**轨道区之下**（贴底）：导出前信息是「结论行」，放在画面最下方一栏，不占轨道可视高度。
          加轨按钮与这行小字**同排**（用户口径）；加轨是低频操作，放在这行最左端，不与状态信息混读。 */}
      {/* `relative` 提供警告浮层的定位上下文；`shrink-0` 让状态条永远不被 dock 高度拖拽压扁 */}
      <div className="relative shrink-0">
        <DockStatusBar
          project={project}
          brokenCount={brokenIds.size}
          conflict={store.conflict}
          reload={store.reload}
          failed={store.status === 'failed'}
          reason={store.reason}
          exportInfoReason={exp.plan?.reason ?? null}
          letterbox={exp.letterbox}
          onAddTrack={drag.addTrack}
          // 可用性判据与 `appendTrack` 的上限同源（`MAX_TRACKS_PER_KIND`），不在这里另算一套
          canAddText={
            (project?.tracks.filter((t) => t.kind === 'text').length ?? 0) < MAX_TRACKS_PER_KIND
          }
          canAddVideo={
            (project?.tracks.filter((t) => t.kind === 'video').length ?? 0) < MAX_TRACKS_PER_KIND
          }
          canAddAudio={
            (project?.tracks.filter((t) => t.kind === 'audio').length ?? 0) < MAX_TRACKS_PER_KIND
          }
          addTrackLimit={MAX_TRACKS_PER_KIND}
        />
      </div>
    </section>
  );
}

/** 空轨道数组的稳定引用（供 PlaybackSink 等无工程时占位）。 */
const EMPTY_TRACKS: Track[] = [];

/** 片段在时间轴上的画面素材（胶片条 / 图片本体 / 波形）。 */
interface ClipVisual {
  url: string;
  sourceDuration: number;
  stripUrl?: string;
  peaks?: Float32Array;
  /** 是否含内联音轨（🔊 角标；缺省=未知，仅 `true` 显示）。 */
  hasAudio?: boolean;
}

/**
 * 片段「画面区」的 CSS。
 * 视频：共享胶片图 + `filmstripBackground` 映射到本片段源区间（裁剪即所见，C11.10）；
 * 图片：显示素材本体（`contain`，不裁切）；
 * **其余：留空**（不编占位，见 C11.7b「不撒谎」）—— 文字片段属于此列（见下方说明）。
 *
 * ★改（2026-09-14）：原来判 `clip.kind === 'video'` / `'image'` 两个 if 后 `return {}`。
 * 加 `'text'` 后它**静默掉进 `return {}`**（画面区全空）——
 * 但**文字片段恰好本该如此**：它的内容由 `laneClipBody` 的**文字分支**直接渲染
 * （不靠背景图），故此处「留空」是**正确语义**，不是漏判。
 * 为免后人误读成漏判，下面用显式 `switch` 把「哪些类别在这里有背景」写全。
 */
function clipStripStyle(clip: Clip, visual: ClipVisual | undefined): CSSProperties {
  switch (clip.kind) {
    case 'image':
      if (!visual) return {};
      return {
        backgroundImage: `url(${visual.url})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    case 'video':
      if (!visual?.stripUrl) return {};
      return {
        backgroundImage: `url(${visual.stripUrl})`,
        ...filmstripBackground(clip, visual.sourceDuration),
      };
    case 'audio':
    case 'text':
      // 音频走波形分支（在 `laneClipBody` 里、不进本函数）；文字由文字分支直接绘制。
      return {};
  }
}

/**
 * 片段行内「画面区」的渲染 —— **按类别穷举**（★新增 2026-09-14）。
 *
 * 【为什么从「二分」改成「穷举」】原写法是 `clip.kind === 'audio' ? <波形/> : <胶片条/>`。
 * 加 `'text'` 后它**不报错**，而是把文字片段静默塞进 `else` —— 渲染成一条**空的胶片条**，
 * 文字内容**完全看不见**（用户只看到一条空片段，无从理解）。
 * 改为 `switch` + `never` 兜底：新增 `ClipKind` 时**本函数就是编译错误**，
 * 强制在这里表态「它长什么样」（与 `routeClipToTrack` 的 `Record` 同一套手法）。
 *
 * 各类别的画面区：
 *  - `video` / `image` → 胶片条 / 图片本体（背景图，随 `clipStripStyle`）；
 *  - `audio`          → 真实波形（`peaks`，占满剩余高度）；
 *  - `text`           → **直接显示文字内容**（名条已省去：内容本身就是名字）。
 */
function laneClipBody(clip: Clip, visual: ClipVisual | undefined): ReactNode {
  switch (clip.kind) {
    case 'audio':
      return (
        <span
          className="min-h-0 flex-1 relative overflow-hidden bg-[linear-gradient(180deg,rgba(59,130,246,.20),rgba(59,130,246,.07))]"
          data-clip-waveform
        >
          {visual?.peaks && visual.peaks.length > 0 && (
            // 波形与胶片条**共用同一映射**（`waveformSpan`）
            <span className="absolute inset-y-0" style={waveformSpan(clip, visual.sourceDuration)}>
              <svg
                className="w-full h-full"
                viewBox={`0 0 ${visual.peaks.length} 100`}
                preserveAspectRatio="none"
                aria-hidden
              >
                <path d={waveformPath(visual.peaks)} fill="currentColor" />
              </svg>
            </span>
          )}
        </span>
      );
    case 'text':
      // 文字片段：内容直读（`textStyle` 形状在 M2 定稿前是 `unknown`，此处**不解释**它 ——
      // 只取 `clip.name` 作为显示文案；M2 定稿后改为读 textStyle.content）。
      return (
        <span
          className="min-h-0 flex-1 flex items-center justify-center px-1.5 overflow-hidden"
          data-clip-text
        >
          <span className="truncate text-[10px] text-violet-100">{clip.name ?? '文字'}</span>
        </span>
      );
    case 'video':
    case 'image':
      return (
        <span
          className="min-h-0 flex-1 bg-no-repeat text-sky-300"
          style={clipStripStyle(clip, visual)}
          data-clip-strip
        />
      );
  }
}

/**
 * 轨道头（mockup `.ve-thead` 的 M2 形态）：`[序号][锁][眼][喇叭][删]` 五格固定网格，跨轨列位对齐。
 *
 * 【为什么序号取代了类型图标（不是「图标 + 序号」并列）】
 * 序号本身就是**自解释**的：`V1` = 视频第 1 条、`A2` = 音频第 2 条 —— 前缀字母已经表达了类别。
 * 图标与序号并列是同一信息的第二遍表达（每多一格就是 22px，直接吃掉画面宽度）。
 *
 * 【为什么删轨**必须**留在本列，不能放右侧轨道行上】
 * 右侧轨道区是 `overflow-x-auto` 且随时会被缩放（`pps`）推走 —— 放在那里的按钮会随内容
 * 横向滚出视口（「不知道跑到哪儿去了」）。本列是**不滚动**的固定列，是唯一能保证
 * 「按钮永远在同一像素位置」的地方。
 *
 * 【为什么删除不再是 hover 才显】
 * 「悬停才出现」对**低频但需要可发现**的动作是反模式：用户不知道那里有东西，
 * 就不会去悬停。故删轨常显 —— 用**颜色**表达可用性（可删 = 常态灰、悬停转红；
 * 不可删 = 置灰 + `cursor-not-allowed` + tooltip 说明原因），而不是用「可见性」。
 */
function TrackHead({
  track,
  ordinal,
  canDelete,
  rowHeight,
  onToggle,
  onDelete,
}: {
  track: Track;
  /** 同类别内的序号（V1/V2 · A1/A2）—— **仅显示**，不参与任何判据。 */
  ordinal: string;
  /** 能否删除（非空 / 最后一条同类轨 / 锁定 → 不可，置灰 + tooltip 说明）。 */
  canDelete: boolean;
  rowHeight: number;
  onToggle: (patch: Partial<Pick<Track, 'locked' | 'hidden' | 'muted'>>) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="shrink-0 flex items-center justify-center gap-px px-2"
      style={{ height: rowHeight }}
      data-track-id={track.id}
    >
      {/* 序号格：`V1`/`A2` —— 前缀字母即类别，故不再另占一格放类型图标。
          宽度由常量 `TRACK_LABEL_PX` 的算式定为 30px，此处只给样式不写死宽度。 */}
      <span
        className={`w-[30px] shrink-0 text-center text-[10px] font-medium tabular-nums ${
          TRACK_ORDINAL_CLASS[track.kind]
        }`}
        title={`${ordinal} · ${track.name}`}
      >
        {ordinal}
      </span>
      <TrackIconButton
        active={track.locked}
        activeClass="text-accent"
        title={track.locked ? '解锁' : '锁定'}
        onClick={() => onToggle({ locked: !track.locked })}
      >
        {track.locked ? <Lock size={13} /> : <LockOpen size={13} />}
      </TrackIconButton>
      <TrackIconButton
        active={track.hidden}
        activeClass="text-accent"
        title={track.hidden ? '显示' : '隐藏'}
        onClick={() => onToggle({ hidden: !track.hidden })}
      >
        {track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </TrackIconButton>
      {/* 静音：★只在**有音源的轨**上渲染（文字轨没有音源 —— 给它静音按钮是误导）。
          判据问 `trackHasAudio`（与「可闻片段」同一套类别真源，不是另判一次），
          保留**占位空格**（与 mockup 一致：静音格 `visibility:hidden`）——
          这样四格列位在所有轨之间保持对齐，不会因为「这条没有静音钮」而整列错位。 */}
      {trackHasAudio(track.kind) ? (
        <TrackIconButton
          active={track.muted}
          activeClass="text-accent"
          title={track.muted ? '取消静音' : '静音'}
          onClick={() => onToggle({ muted: !track.muted })}
        >
          {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </TrackIconButton>
      ) : (
        <span className="w-[22px] h-full shrink-0" aria-hidden />
      )}
      {/* 删轨：**常显**（不是 hover 才出现）—— 可用性靠颜色表达，不靠可见性。
          判别：可删 = 常态 muted 灰 / 悬停转 danger 红；不可删 = 40% 透明 + not-allowed。 */}
      <TrackIconButton
        disabled={!canDelete}
        activeClass="hover:text-danger"
        title={
          canDelete
            ? `删除「${track.name}」`
            : track.locked
              ? '已锁定的轨道不可删除'
              : track.clips.length > 0
                ? '轨道上还有片段，请先清空再删除'
                : '至少要保留一条同类轨道'
        }
        onClick={onDelete}
      >
        <Trash2 size={13} />
      </TrackIconButton>
    </div>
  );
}

/**
 * 轨道头的一个图标按钮 —— **统一命中区**（`w-[22px] h-full`）。
 *
 * 抽出来的唯一理由：5 个按钮的宽度/间距必须**由同一处决定**（否则改一个忘一个，
 * 网格列位就错开了，跨轨不再对齐）。这不是「假接缝」——它有 5 个真实调用点。
 */
function TrackIconButton({
  active = false,
  activeClass,
  disabled = false,
  title,
  onClick,
  children,
}: {
  /** 三态开关是否处于「激活」态（锁定 / 隐藏 / 静音为真）。 */
  active?: boolean;
  /** 激活态的颜色类。 */
  activeClass: string;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`w-[22px] h-full shrink-0 flex items-center justify-center rounded ${
        disabled
          ? 'opacity-40 cursor-not-allowed text-muted'
          : active
            ? activeClass
            : `text-muted hover:text-secondary ${activeClass.includes('hover') ? activeClass : 'hover:bg-surface-hover'}`
      }`}
    >
      {children}
    </button>
  );
}

/**
 * 同类别内的序号（`V1` / `V2` / `A1` / `A2` / `T1`）—— **纯显示派生**。
 *
 * 为什么不用 `track.name`：所有视频轨的默认名都是「视频」（`normalize.ts::createEmptyTrack`
 * 刻意不做重名编号，见那里的注释），用户无法靠名字区分两条视频轨。序号按**同类别出现次序**
 * 现算，永远与轨道头的实际排列一致（不落盘 = 不可能与 `tracks` 漂移）。
 *
 * ★改（2026-09-14）：前缀由三元表达式改为 `Record` —— 加 `'text'` 时三元会**静默全部产出 `V`**
 * （文字轨显示成 `V1`，与视频轨序号撞名，用户无从区分）。`Record` 缺键即编译错误。
 */
const ORDINAL_PREFIX: Record<TrackKind, string> = { video: 'V', audio: 'A', text: 'T' };

/** 各类轨序号格的颜色（`Record` 而非三元 —— 理由同 `ORDINAL_PREFIX`，加类别时必须表态）。 */
const TRACK_ORDINAL_CLASS: Record<TrackKind, string> = {
  video: 'text-sky-400/70',
  audio: 'text-emerald-400/70',
  text: 'text-violet-400/70',
};

function ordinalOf(tracks: Track[], track: Track, index: number): string {
  const prefix = ORDINAL_PREFIX[track.kind];
  let n = 0;
  for (let i = 0; i <= index && i < tracks.length; i++) {
    if (tracks[i].kind === track.kind) n++;
  }
  return `${prefix}${n}`;
}

/** 一条轨道行（滚动区内，mockup `.ve-lane`）：只放片段，左列已由固定列 `TrackHead` 承担。 */
function Lane({
  track,
  pps,
  rowHeight,
  selectedClipId,
  draggingClipId,
  brokenIds,
  visuals,
  onClipPointerDown,
  onSelectClip,
}: {
  track: Track;
  pps: number;
  rowHeight: number;
  selectedClipId: string | null;
  /** 正在被拖拽的片段 id（无拖拽 = `null`）—— 命中时才加「正在拖」的视觉反馈。 */
  draggingClipId: string | null;
  brokenIds: Set<string>;
  visuals: ReadonlyMap<string, ClipVisual>;
  onClipPointerDown: (
    e: ReactPointerEvent,
    clip: Clip,
    track: Track,
    mode: 'move' | 'trimLeft' | 'trimRight',
  ) => void;
  onSelectClip: (id: string) => void;
}) {
  return (
    <div
      className="relative rounded-md"
      style={{
        height: rowHeight,
        // 隐藏轨的虚线框用 **inset box-shadow** 而非 `border`：border 占盒内 1px，
        // 会把轨道内容整体推移 1px（用户会看到「一开隐藏就抖一下」）。box-shadow 不参与布局。
        ...(track.hidden ? { boxShadow: 'inset 0 0 0 1px rgb(var(--mao-edge-strong) / 0.7)' } : {}),
      }}
      data-lane-id={track.id}
    >
      {track.clips.map((clip) => {
        const broken = brokenIds.has(clip.id);
        const visual = visuals.get(clip.id);
        const isDragging = draggingClipId === clip.id;
        return (
          <div
            key={clip.id}
            role="button"
            tabIndex={0}
            onPointerDown={(e) => onClipPointerDown(e, clip, track, 'move')}
            onClick={(e) => {
              e.stopPropagation();
              onSelectClip(clip.id);
            }}
            className={`absolute flex flex-col overflow-hidden rounded-[5px] border cursor-grab active:cursor-grabbing ${
              broken
                ? 'border-danger/60 bg-danger/15'
                : selectedClipId === clip.id
                  ? 'bg-surface-1'
                  : 'border-white/10 bg-surface-1 hover:border-white/25'
            }`}
            style={{
              // 隐藏轨：整轨内容**去色 + 变淡**（与轨道头的 EyeOff 呼应）；静音轨：只**降饱和**（画面还在、声音不出）。
              // 用内联 `filter` 而非 Tailwind `grayscale`/`saturate-50`：前者与仓内既有做法一致，且不赌
              // 「该工具类是否被生成」。filter / opacity **不参与布局** ⇒ 开关时不产生任何位移。
              ...(track.hidden
                ? { opacity: 0.3, filter: 'grayscale(1) saturate(0)' }
                : track.muted
                  ? { filter: 'saturate(0.45)' }
                  : {}),
              left: timeToX(clip.timelineStart, pps, 0),
              width: Math.max(2, timeDeltaToPx(clipDuration(clip), pps)),
              top: CLIP_INSET,
              bottom: CLIP_INSET,
              // 「正在拖」反馈：半透明 + 浮起阴影 + 抬到最上层（一眼看出这一段在跟手）。
              // 全部是 paint-only（opacity/box-shadow/z-index），**不改尺寸** ⇒ 拖拽中不抖。
              ...(isDragging ? { opacity: 0.85, zIndex: 20 } : {}),
              // 选中：accent 光圈（内联读变量，不依赖 Tailwind 是否生成类）
              ...(selectedClipId === clip.id
                ? {
                    borderColor: 'rgb(var(--mao-accent) / 1)',
                    boxShadow: '0 0 0 1px rgb(var(--mao-accent) / 1)',
                  }
                : {}),
              ...(isDragging ? { boxShadow: '0 6px 18px rgb(0 0 0 / 0.55)' } : {}),
            }}
            // C13：断链是**持续状态**（红标 + 原因），不是一次性 toast
            title={
              broken
                ? `${clip.name ?? clip.id} · 素材已失效`
                : `${clip.name ?? clip.id} · ${clipDuration(clip).toFixed(2)}s`
            }
          >
            {/* C11.10b：素材名**不压在缩略图上** —— 独立的顶部窄条 */}
            <span
              className="shrink-0 truncate px-1 text-[9px] leading-[15px] text-white bg-black/45 flex items-center gap-1"
              style={{ height: CLIP_NAME_BAR }}
            >
              {/* 🔊 角标（docs/120 C4.7）：视频片段含内联音轨才显示；缺省(未知)=不显示，不谎称没声音 */}
              {clip.kind === 'video' && visual?.hasAudio && (
                <Volume2 size={9} className="shrink-0 text-sky-300" aria-label="含原声音轨" />
              )}
              <span className="truncate">{clip.name ?? clip.kind}</span>
            </span>
            {/* 胶片条 / 波形 / 图片本体 / 文字内容 —— 占剩余高度并随之缩放（C11.10c）。
                ★改（2026-09-14）：由「audio ? 波形 : 胶片条」二分改为**按类别穷举**
                （`laneClipBody`）。原二分在加 `'text'` 后会把它**静默塞进 else 分支**
                （渲染成一条空的胶片条），文字内容**看不见** —— 正是要消灭的静默错分支。 */}
            {laneClipBody(clip, visual)}
            {/* 调片段长度的两个**边缘把手**（§0.4 粗档，mockup `.ve-clip .trim`：accent 细条）。
              stopPropagation：别把「拖动主体」也触发 */}
            <span
              aria-label="调左边缘"
              className={`absolute inset-y-0 left-0 w-1 cursor-ew-resize hover:bg-accent/80 ${
                selectedClipId === clip.id ? 'bg-accent/50' : ''
              }`}
              onPointerDown={(e) => onClipPointerDown(e, clip, track, 'trimLeft')}
            />
            <span
              aria-label="调右边缘"
              className={`absolute inset-y-0 right-0 w-1 cursor-ew-resize hover:bg-accent/80 ${
                selectedClipId === clip.id ? 'bg-accent/50' : ''
              }`}
              onPointerDown={(e) => onClipPointerDown(e, clip, track, 'trimRight')}
            />
          </div>
        );
      })}

      {/* 轨道三态（锁定 / 隐藏 / 静音）的**轨道级视觉反馈** ——
          光靠轨道头图标变色不够：用户视线在轨道上时，看不出这一轨处于什么状态。
          遮罩层在片段**之上**且 `pointer-events-none`（不拦片段的拖拽 / 选中），
          **纯灰调、不占布局**（无 border / 无尺寸位移）：锁定 = 斜条纹灰罩（「这一片被锁住，不可编辑」）。 */}
      {track.locked && (
        <div
          className="absolute inset-0 rounded-md pointer-events-none z-10"
          data-lane-locked
          style={{
            backgroundColor: 'rgb(0 0 0 / 0.42)',
            backgroundImage:
              'repeating-linear-gradient(-45deg, transparent 0 6px, rgb(255 255 255 / 0.14) 6px 8px)',
            boxShadow: 'inset 0 0 0 1px rgb(var(--mao-edge-strong) / 0.9)',
          }}
        />
      )}
    </div>
  );
}
