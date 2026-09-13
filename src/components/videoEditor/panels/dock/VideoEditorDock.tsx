/**
 * 视频剪辑器**基座**（常驻底部层）—— `docs/123` §二.3 G3 卡 · `docs/120` C10 / C4.5。
 *
 * ── 形态铁律（改它之前先读这三条）──
 * 1. **常驻底部层，不是全屏层**：挂 `App` 根 flex 列的底部（`TopNav` 与画布之间**不覆盖**画布），
 *    **不用 `FullscreenShell` / 不用 portal / 不登记 `modalLayer`**（`docs/120` C10.1）。
 *    登记一次 → 画布快捷键全废、「画布点选素材入轨」这个**主入口**直接死掉。
 * 2. **非模态**：基座展开时画布仍可点选/拖节点（`docs/123` G3 人工验收项）。
 * 3. **键盘只让位三组键**（`docs/120` C10「关键区分」表）：Delete/Backspace · ⌘Z · ⌘⇧Z(⌘Y)。
 *    其余画布快捷键（Q/W/E、⌘A/D/G/L…）照旧 —— 判据与 `useCanvasShortcuts` **共用同一个
 *    `editorKeyAction()`**（判据单点，`docs/123` §二.6 G-3）。
 *
 * ── 本 Gate（G3）做到哪 ──
 * 形态 + 开合 + 键盘归属 + 工程状态闭环（读 `projectRepository`、经 `core/timelineOps` 改、落盘）。
 * 缩略图胶片条 / 真实波形 / 吸附 / 走带出声 / 断链红标 / 导出 = 后续 Gate（G4/G5）。
 * 因此**不摆没有行为的按钮**：每个按钮都真的调一个 core 原语，做不了的按钮置灰 + tooltip（`docs/123` §一.5 O3）。
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  Lock,
  LockOpen,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
} from 'lucide-react';
import { isEditableTarget } from '../../../base/core/uiHooks.ts';
import { editorKeyAction } from '../../../base/core/modalLayer.ts';
import {
  clampZoom,
  timeDeltaToPx,
  timeToX,
  xToTime,
} from '../../../base/utils/timeline/timeScale.ts';
import { formatTickLabel } from '../../../base/utils/timeline/rulerTicks.ts';
import {
  freezeFrameAt,
  removeClips,
  splitAt,
  timelineDuration,
  trimLeftAt,
  trimRightAt,
  clipDuration,
} from '../../core/timelineOps.ts';
import { DEFAULT_IMAGE_CLIP_DURATION } from '../../core/constants.ts';
import type { Clip, Track } from '../../core/types.ts';
import { useEditorProject } from './useEditorProject.ts';

/** 基座时间轴的固定缩放（像素/秒）。缩放交互属 G5；这里过 `clampZoom` 走同一取值域。 */
const DOCK_PPS = clampZoom(40);

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

  const store = useEditorProject(projectId, everOpened);
  const project = store.project;

  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const mainTrack = project?.tracks.find((t) => !t.overlay) ?? null;
  const mainClips = mainTrack?.clips ?? [];
  const playhead = project?.playhead ?? 0;

  /** 只对磁吸轨（主轨）应用 B 组编辑原语 —— 见 `core/timelineOps.ts` 的限制说明。 */
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

  const setPlayhead = useCallback(
    (t: number) => {
      if (!project) return;
      const clamped = Math.max(0, Math.min(timelineDuration(project.tracks), t));
      store.applyProjectPatch({ playhead: clamped });
    },
    [project, store],
  );

  // 能力判据：**直接问原语**（不做第二套「能不能切」的推断），不可用即置灰 + tooltip（O3）
  const canSplit = splitAt(mainClips, playhead) !== null;
  const canTrimLeft = trimLeftAt(mainClips, playhead) !== null;
  const canTrimRight = trimRightAt(mainClips, playhead) !== null;
  const canDelete = selectedClipId !== null && mainClips.some((c) => c.id === selectedClipId);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      // 输入框内不劫键（时间码输入框等）；Esc 不接管（C10.2）
      if (isEditableTarget(e)) return;
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

  const trackAreaRef = useRef<HTMLDivElement | null>(null);

  return (
    <section
      aria-label="视频剪辑器"
      data-video-editor-dock
      className={`relative border-t border-border bg-surface-panel-2 text-primary ${open ? '' : 'hidden'}`}
      style={{ height: project?.ui.dockHeight ?? 280 }}
    >
      {/* ── 工带 ── */}
      <header className="flex items-center gap-2 px-3 h-10 border-b border-border text-xs">
        <button
          type="button"
          className="px-2 py-1 rounded hover:bg-surface-hover"
          title="收起剪辑器"
          onClick={onClose}
        >
          <ChevronDown size={14} />
        </button>
        <span className="tabular-nums font-medium">{formatTickLabel(playhead, 1)}</span>
        <span className="opacity-50">/</span>
        <span className="tabular-nums opacity-70">
          {formatTickLabel(project ? timelineDuration(project.tracks) : 0, 1)}
        </span>

        <span className="w-px h-4 bg-border mx-1" />

        <DockAction
          icon={<Scissors size={14} />}
          label="分割"
          enabled={canSplit}
          disabledHint="把播放头移到片段内部再分割"
          onClick={() => applyMain((clips) => splitAt(clips, playhead))}
        />
        <DockAction
          icon={<Scissors size={14} className="-scale-x-100" />}
          label="裁左"
          enabled={canTrimLeft}
          disabledHint="把播放头移到片段内部"
          onClick={() => applyMain((clips) => trimLeftAt(clips, playhead))}
        />
        <DockAction
          icon={<Scissors size={14} />}
          label="裁右"
          enabled={canTrimRight}
          disabledHint="把播放头移到片段内部"
          onClick={() => applyMain((clips) => trimRightAt(clips, playhead))}
        />
        <DockAction
          icon={<span className="text-[11px]">⏸</span>}
          label="定格"
          enabled={canSplit}
          disabledHint="把播放头移到片段内部"
          onClick={() =>
            applyMain(
              (clips) => freezeFrameAt(clips, playhead, DEFAULT_IMAGE_CLIP_DURATION)?.clips ?? null,
            )
          }
        />

        <span className="w-px h-4 bg-border mx-1" />

        <DockAction
          icon={<Trash2 size={14} />}
          label="删除(留洞)"
          enabled={canDelete}
          disabledHint="先选中一个片段"
          onClick={() =>
            applyMain((clips) =>
              selectedClipId ? removeClips(clips, [selectedClipId], 'lift') : null,
            )
          }
        />
        <DockAction
          icon={<Trash2 size={14} />}
          label="删除(波纹)"
          enabled={canDelete}
          disabledHint="先选中一个片段"
          onClick={() =>
            applyMain((clips) =>
              selectedClipId ? removeClips(clips, [selectedClipId], 'ripple') : null,
            )
          }
        />

        <span className="ml-auto" />
        <DockAction
          icon={<Undo2 size={14} />}
          label="撤销"
          enabled={store.canUndo}
          disabledHint="没有可撤销的编辑"
          onClick={store.undo}
        />
        <DockAction
          icon={<Redo2 size={14} />}
          label="重做"
          enabled={store.canRedo}
          disabledHint="没有可重做的编辑"
          onClick={store.redo}
        />
      </header>

      {/* ── 状态条：冲突 / 失败 / 加载（诚实可见，不静默）── */}
      {store.conflict && (
        <div className="px-3 py-1 text-xs bg-danger/15 text-danger flex items-center gap-2">
          工程已在别处更新，本次改动**未落盘**（本地改动保留）。
          <button type="button" className="underline" onClick={store.reload}>
            重新加载
          </button>
        </div>
      )}
      {store.status === 'failed' && (
        <div className="px-3 py-1 text-xs bg-danger/15 text-danger">
          工程读取失败：{store.reason ?? '未知原因'}
        </div>
      )}

      {/* ── 轨道区 ── */}
      <div
        ref={trackAreaRef}
        className="relative overflow-x-auto"
        style={{ height: `calc(100% - 2.5rem)` }}
        onPointerDown={(e) => {
          // 点轨道区 = 移动播放头（D 组换算原语的消费点）
          const rect = e.currentTarget.getBoundingClientRect();
          if (rect.width <= 0) return;
          setPlayhead(xToTime(e.clientX - rect.left + e.currentTarget.scrollLeft, DOCK_PPS, 0));
        }}
      >
        {store.status === 'loading' && <div className="p-3 text-xs opacity-60">正在加载工程…</div>}

        {project?.tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            selectedClipId={selectedClipId}
            onSelectClip={setSelectedClipId}
            onToggle={(patch) =>
              store.applyTracks((tracks) =>
                tracks.map((t) => (t.id === track.id ? { ...t, ...patch } : t)),
              )
            }
          />
        ))}

        {/* 播放头 */}
        {project && (
          <div
            className="absolute top-0 bottom-0 w-px bg-danger pointer-events-none"
            style={{ left: timeToX(playhead, DOCK_PPS, 0) }}
          />
        )}
      </div>
    </section>
  );
}

/** 工带按钮：不可用时**置灰 + tooltip 说明为什么**（`docs/123` §一.5 O3：不可用状态 ≠ 刚发生的动作）。 */
function DockAction({
  icon,
  label,
  enabled,
  disabledHint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  enabled: boolean;
  disabledHint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      title={enabled ? label : disabledHint}
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded ${
        enabled ? 'hover:bg-surface-hover' : 'opacity-40 cursor-not-allowed'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** 一条轨：轨道头（名 + 三状态）+ 片段条。 */
function TrackRow({
  track,
  selectedClipId,
  onSelectClip,
  onToggle,
}: {
  track: Track;
  selectedClipId: string | null;
  onSelectClip: (id: string) => void;
  onToggle: (patch: Partial<Pick<Track, 'locked' | 'hidden' | 'muted'>>) => void;
}) {
  return (
    <div className="flex items-stretch border-b border-border" data-track-id={track.id}>
      <div className="w-28 shrink-0 flex items-center gap-1 px-2 py-1 text-xs border-r border-border">
        <span className="truncate">{track.name}</span>
        <button
          type="button"
          className="ml-auto opacity-70 hover:opacity-100"
          title={track.locked ? '解锁' : '锁定'}
          onClick={() => onToggle({ locked: !track.locked })}
        >
          {track.locked ? <Lock size={12} /> : <LockOpen size={12} />}
        </button>
        <button
          type="button"
          className="opacity-70 hover:opacity-100"
          title={track.hidden ? '显示' : '隐藏'}
          onClick={() => onToggle({ hidden: !track.hidden })}
        >
          {track.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <button
          type="button"
          className="opacity-70 hover:opacity-100"
          title={track.muted ? '取消静音' : '静音'}
          onClick={() => onToggle({ muted: !track.muted })}
        >
          {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
      </div>

      <div className="relative flex-1 h-10 min-w-full">
        {track.clips.map((clip) => (
          <button
            key={clip.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectClip(clip.id);
            }}
            className={`absolute top-1 bottom-1 rounded border text-[11px] truncate px-1 text-left ${
              selectedClipId === clip.id
                ? 'border-danger bg-danger/20'
                : 'border-border bg-surface-panel'
            }`}
            style={{
              left: timeToX(clip.timelineStart, DOCK_PPS, 0),
              width: Math.max(2, timeDeltaToPx(clipDuration(clip), DOCK_PPS)),
            }}
            title={`${clip.name ?? clip.id} · ${clipDuration(clip).toFixed(2)}s`}
          >
            {clip.name ?? clip.kind}
          </button>
        ))}
      </div>
    </div>
  );
}
