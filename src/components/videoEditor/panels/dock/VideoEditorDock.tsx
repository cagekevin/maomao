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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { AudioLines, Eye, EyeOff, Lock, LockOpen, Video, Volume2, VolumeX } from 'lucide-react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useCanvasEdges } from '../../../base/canvas/CanvasEdgesContext.tsx';
import {
  clampZoom,
  snapTime,
  timeDeltaToPx,
  timeToX,
  xToTime,
} from '../../../base/utils/timeline/timeScale.ts';
import { DEFAULT_ROW_HEIGHT, SNAP_TOLERANCE_PX } from '../../core/constants.ts';
import { clipDuration, clipEdges } from '../../core/timelineOps.ts';
import type { Clip, Track } from '../../core/types.ts';
import { useEditorFilmstrips } from '../../hooks/useEditorFilmstrips.ts';
import { useEditorSources } from '../../hooks/useEditorSources.ts';
import { useEditorWaveforms } from '../../hooks/useEditorWaveforms.ts';
import { filmstripBackground, waveformPath, waveformSpan } from './clipSourceView.ts';
import { DockStatusBar } from './DockStatusBar.tsx';
import { DockToolbar } from './DockToolbar.tsx';
import { PlaybackSink } from './PlaybackSink.tsx';
import { RulerStrip, RULER_HEIGHT } from './RulerStrip.tsx';
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
const TRACK_LABEL_PX = 78;
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
  /** 轨道行高（`docs/120` C7.5）—— **工程 UI 记忆**，来自 `project.ui.rowHeight`（随工程落盘）。 */
  const rowHeight = project?.ui.rowHeight ?? DEFAULT_ROW_HEIGHT;
  /** 胶片条 / 波形可用高度 = 行高 − 边距 − 名条（随行高派生，filmstrip 键含此高 → 改行高自动重抽）。 */
  const stripHeight = Math.max(8, rowHeight - CLIP_INSET * 2 - CLIP_NAME_BAR);

  /** 工程参数 / 轨道高度编辑面板开关（`docs/120` C12.2 · C7.5）。 */
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  /* ── 基座高度拖柄（C7.5，`Project.ui.dockHeight` 落盘）。点一下无拖动不做，拖过阈值才收起。 */
  const dockResizeRef = useRef<{ startY: number; startH: number; lastY: number } | null>(null);
  const beginDockResize = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const projectNow = storeRef.current.project;
      if (!projectNow) return;
      dockResizeRef.current = {
        startY: e.clientY,
        startH: projectNow.ui?.dockHeight ?? 280,
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
        if (d && d.lastY - d.startY > 60) onClose(); // 大幅度往下拖才收起
        dockResizeRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
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
      className={`relative flex flex-col border-t border-edge bg-surface-deep text-primary ${open ? '' : 'hidden'}`}
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
      {/* 顶部拖柄（mockup `.vd-grip`）：竖直拖动调基座高度 */}
      <div
        role="separator"
        aria-label="拖动调整剪辑器高度"
        title="拖动调整高度"
        className="h-1.5 shrink-0 flex items-center justify-center cursor-ns-resize touch-none hover:bg-surface-hover"
        onPointerDown={beginDockResize}
      >
        <span className="w-9 h-[3px] rounded bg-edge" />
      </div>

      {/* 工带（mockup `.vd-bar`）—— DockToolbar 纯渲染 */}
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
        onPpsChange={setPps}
        trackAreaRef={transport.trackAreaRef}
      />

      {/* 常驻信息 / 设置条 / 断链 / 冲突失败 —— DockStatusBar 纯渲染 */}
      <DockStatusBar
        settingsOpen={settingsOpen}
        project={project}
        rowHeight={rowHeight}
        applyProjectPatch={store.applyProjectPatch}
        brokenCount={brokenIds.size}
        conflict={store.conflict}
        reload={store.reload}
        failed={store.status === 'failed'}
        reason={store.reason}
        exportInfoReason={exp.plan?.reason ?? null}
        letterbox={exp.letterbox}
      />

      {/* ── 轨道区（mockup O5：固定左列图标网格 + 右侧滚动区，二者同高逐行对齐）── */}
      <div className="relative flex-1 flex min-h-0">
        {/* 固定左列：标尺占位 + 每条轨的图标网格头（锁定 / 隐藏 / 静音用颜色状态） */}
        <div
          className="shrink-0 flex flex-col border-r border-edge-faint bg-surface-deep"
          style={{ width: TRACK_LABEL_PX }}
        >
          <div className="shrink-0 border-b border-edge-faint" style={{ height: RULER_HEIGHT }} />
          {project?.tracks.map((track) => (
            <TrackHead
              key={track.id}
              track={track}
              rowHeight={rowHeight}
              onToggle={(patch) =>
                store.applyTracks((tracks) =>
                  tracks.map((t) => (t.id === track.id ? { ...t, ...patch } : t)),
                )
              }
            />
          ))}
        </div>

        {/* 右侧滚动区：标尺 + 轨道行 + 播放头（同一时间原点 = 本区左缘，无左列偏移） */}
        <div
          ref={transport.trackAreaRef}
          className="relative flex-1 overflow-x-auto text-primary"
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

          <RulerStrip
            hasProject={!!project}
            pps={pps}
            totalDuration={transport.totalDuration}
            displayHead={transport.displayHead}
            onPlayheadPointerDown={transport.beginPlayheadDrag}
          />

          {/* 空态提示（mockup `.vd-hollow`）：轨道还空着时给一句引导 */}
          {project && transport.totalDuration <= 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted pointer-events-none">
              在画布上点选素材即可入轨
            </div>
          )}

          {project?.tracks.map((track) => (
            <Lane
              key={track.id}
              track={track}
              pps={pps}
              rowHeight={rowHeight}
              selectedClipId={drag.selectedClipId}
              brokenIds={brokenIds}
              visuals={visuals}
              onClipPointerDown={drag.beginClipDrag}
              onSelectClip={drag.setSelectedClipId}
            />
          ))}
        </div>
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
 * 图片：显示素材本体（`contain`，不裁切）；其余：**留空**（不编占位，见 C11.7b「不撒谎」）。
 */
function clipStripStyle(clip: Clip, visual: ClipVisual | undefined): CSSProperties {
  if (clip.kind === 'image' && visual) {
    return {
      backgroundImage: `url(${visual.url})`,
      backgroundSize: 'contain',
      backgroundPosition: 'center',
    };
  }
  if (clip.kind === 'video' && visual?.stripUrl) {
    return {
      backgroundImage: `url(${visual.stripUrl})`,
      ...filmstripBackground(clip, visual.sourceDuration),
    };
  }
  return {};
}

/** 轨道头（mockup `.ve-thead`）：`[类型][锁][眼][喇叭]` 四列固定图标网格，跨轨列位对齐；状态靠颜色。 */
function TrackHead({
  track,
  rowHeight,
  onToggle,
}: {
  track: Track;
  rowHeight: number;
  onToggle: (patch: Partial<Pick<Track, 'locked' | 'hidden' | 'muted'>>) => void;
}) {
  return (
    <div
      className="shrink-0 flex items-center justify-center gap-0.5"
      style={{ height: rowHeight }}
      data-track-id={track.id}
    >
      <span className="opacity-60" title={track.name}>
        {track.kind === 'audio' ? <AudioLines size={13} /> : <Video size={13} />}
      </span>
      <button
        type="button"
        className={track.locked ? 'text-accent' : 'text-muted hover:text-secondary'}
        title={track.locked ? '解锁' : '锁定'}
        onClick={() => onToggle({ locked: !track.locked })}
      >
        {track.locked ? <Lock size={13} /> : <LockOpen size={13} />}
      </button>
      <button
        type="button"
        className={track.hidden ? 'text-accent' : 'text-muted hover:text-secondary'}
        title={track.hidden ? '显示' : '隐藏'}
        onClick={() => onToggle({ hidden: !track.hidden })}
      >
        {track.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button
        type="button"
        className={track.muted ? 'text-accent' : 'text-muted hover:text-secondary'}
        title={track.muted ? '取消静音' : '静音'}
        onClick={() => onToggle({ muted: !track.muted })}
      >
        {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </button>
    </div>
  );
}

/** 一条轨道行（滚动区内，mockup `.ve-lane`）：只放片段，左列已由固定列 `TrackHead` 承担。 */
function Lane({
  track,
  pps,
  rowHeight,
  selectedClipId,
  brokenIds,
  visuals,
  onClipPointerDown,
  onSelectClip,
}: {
  track: Track;
  pps: number;
  rowHeight: number;
  selectedClipId: string | null;
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
      className="relative rounded-md bg-surface-sunken"
      style={{ height: rowHeight }}
      data-lane-id={track.id}
    >
      {track.clips.map((clip) => {
        const broken = brokenIds.has(clip.id);
        const visual = visuals.get(clip.id);
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
              left: timeToX(clip.timelineStart, pps, 0),
              width: Math.max(2, timeDeltaToPx(clipDuration(clip), pps)),
              top: CLIP_INSET,
              bottom: CLIP_INSET,
              // 选中：accent 光圈（内联读变量，不依赖 Tailwind 是否生成类）
              ...(selectedClipId === clip.id
                ? {
                    borderColor: 'rgb(var(--mao-accent) / 1)',
                    boxShadow: '0 0 0 1px rgb(var(--mao-accent) / 1)',
                  }
                : {}),
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
            {/* 胶片条 / 波形 / 图片本体占剩余高度并随之缩放（C11.10c） */}
            {clip.kind === 'audio' ? (
              <span
                className="min-h-0 flex-1 relative overflow-hidden bg-[linear-gradient(180deg,rgba(59,130,246,.20),rgba(59,130,246,.07))]"
                data-clip-waveform
              >
                {visual?.peaks && visual.peaks.length > 0 && (
                  // 波形与胶片条**共用同一映射**（`waveformSpan`）
                  <span
                    className="absolute inset-y-0"
                    style={waveformSpan(clip, visual.sourceDuration)}
                  >
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
            ) : (
              <span
                className="min-h-0 flex-1 bg-no-repeat text-sky-300"
                style={clipStripStyle(clip, visual)}
                data-clip-strip
              />
            )}
            {/* 调片段长度的两个**边缘把手**（§0.4 粗档，mockup `.ve-clip .trim`：accent 细条）。
              stopPropagation：别把「拖动主体」也触发 */}
            <span
              aria-label="调左边缘"
              className="absolute inset-y-0 left-0 w-1 cursor-ew-resize bg-accent/70 hover:bg-accent"
              onPointerDown={(e) => onClipPointerDown(e, clip, track, 'trimLeft')}
            />
            <span
              aria-label="调右边缘"
              className="absolute inset-y-0 right-0 w-1 cursor-ew-resize bg-accent/70 hover:bg-accent"
              onPointerDown={(e) => onClipPointerDown(e, clip, track, 'trimRight')}
            />
          </div>
        );
      })}
    </div>
  );
}
