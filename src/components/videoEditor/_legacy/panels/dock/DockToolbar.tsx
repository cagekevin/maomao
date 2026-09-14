/**
 * 工带 header —— mockup `.vd-bar`（紧凑 36px，图标行 + 单色 mono 时间码）。
 *
 * 【职责边界】**纯渲染**：只做「按钮 → 回调」的极薄绑定，**不持领域逻辑**（判据/动作都从 props 来）。
 * 走带 / 编辑能力（can*）+ 动作都来自 `useTimelineDrag.editing` 与 `useEditorTransport`；导出状态来自
 * `useEditorExport`；缩放与设置开关来自 Docker。
 *
 * 【齿轮弹窗（C12.2 · C7.5）】工程参数 / 轨道高度编辑收在此处的小浮层里（点齿轮弹出、点外部 / Esc 关闭）。
 * 不做成底部通栏设置条：那是「表单」不是「命令」，通栏横跨整个底部、字号被迫与轨道区齐大，很扎眼；
 * 浮层可压到 11px 紧凑排布，且不占轨道可视高度。
 */

/** 「常驻层」声明（`dockContract.test.ts` 按此标记禁用 portal / FullscreenShell）：本目录的文件都挂在 App 根 flex 列内、常驻不 portal，故不许登记 modalLayer。 */
// DOCK_IS_PERSISTENT（常驻层声明 · dockContract.test.ts 按此标记禁用 portal）

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import {
  Cog,
  Magnet,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { showToast } from '../../../base/core/toastStore.ts';
import { formatTickLabel } from '../../../base/utils/timeline/rulerTicks.ts';
import {
  clampZoom,
  fitZoom,
  MAX_PIXELS_PER_SECOND,
  MIN_PIXELS_PER_SECOND,
} from '../../../base/utils/timeline/timeScale.ts';
import { ROW_HEIGHT_MAX, ROW_HEIGHT_MIN, ZOOM_STEP } from '../../core/constants.ts';
import type { ExportStage } from '../../export/pipeline.ts';
import type { Project } from '../../core/types.ts';
import type { TimelineEditing } from './useTimelineDrag.ts';

/** 工程参数写者（Docker 的 `store.applyProjectPatch`）：settings/fps/ui 不进撤销栈。 */
type ApplyProjectPatch = (patch: Partial<Pick<Project, 'settings' | 'fps' | 'ui'>>) => void;

/** 导出阶段的用户可读名（`docs/123` §一.5 O2 的三阶段）。 */
const STAGE_LABEL: Record<ExportStage, string> = {
  audio: '混音中',
  video: '渲染画面中',
  mux: '写入中',
};

export interface DockToolbarProps {
  displayHead: number;
  totalDuration: number;
  playing: boolean;
  pps: number;
  canUndo: boolean;
  canRedo: boolean;
  onTogglePlay: () => void;
  stepToBoundary: (dir: 1 | -1) => void;
  undo: () => void;
  redo: () => void;
  editing: TimelineEditing;
  duplicateEnabled: boolean;
  canExport: boolean;
  exporting: boolean;
  exportStage: ExportStage | null;
  exportProgress: number;
  onExport: () => Promise<void>;
  abortExport: () => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  /** 齿轮弹窗的数据源与写者（弹窗内直接提交参数）。 */
  project: Project | null;
  rowHeight: number;
  applyProjectPatch: ApplyProjectPatch;
  /** 吸附开关当前值（`project.ui.magnetic`，缺省 = 开）。 */
  magnetic: boolean;
  onToggleMagnetic: () => void;
  /**
   * 工具带正中「收起按钮」的按下处理（一物两用：点一下收起 / 上下拖动调高度）。
   * 判据在 Docker 的 `beginDockResize`（位移阈值区分点击与拖动），本组件只做绑定。
   */
  onDockResizePointerDown: (e: ReactPointerEvent) => void;
  onPpsChange: (pps: number) => void;
  trackAreaRef: RefObject<HTMLDivElement | null>;
}

export function DockToolbar(p: DockToolbarProps) {
  const {
    displayHead,
    totalDuration,
    playing,
    pps,
    canUndo,
    canRedo,
    onTogglePlay,
    stepToBoundary,
    undo,
    redo,
    editing,
    duplicateEnabled,
    canExport,
    exporting,
    exportStage,
    exportProgress,
    onExport,
    abortExport,
    settingsOpen,
    onToggleSettings,
    project,
    rowHeight,
    applyProjectPatch,
    magnetic,
    onToggleMagnetic,
    onDockResizePointerDown,
    onPpsChange,
    trackAreaRef,
  } = p;

  return (
    <header className="relative flex items-center gap-1 px-2.5 h-9 border-b border-edge-faint text-xs text-primary">
      <span className="text-[11px] text-secondary select-none">时间轴</span>

      {/* 走带（mockup 左上第一组：上一/播放/下一片段边界）—— C11.7 */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className="p-1.5 rounded text-secondary hover:bg-surface-hover"
          title="上一片段边界"
          onClick={() => stepToBoundary(-1)}
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          className="p-1.5 rounded text-accent hover:bg-surface-hover"
          title={playing ? '暂停' : '播放 / 暂停（M1 只出声）'}
          onClick={onTogglePlay}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          className="p-1.5 rounded text-secondary hover:bg-surface-hover"
          title="下一片段边界"
          onClick={() => stepToBoundary(1)}
        >
          <SkipForward size={14} />
        </button>
      </div>

      <span className="mx-1 tabular-nums font-mono text-[11px]">
        {formatTickLabel(displayHead, 1)}
      </span>
      <span className="text-muted">/</span>
      <span className="tabular-nums font-mono text-[11px] text-muted">
        {formatTickLabel(totalDuration, 1)}
      </span>

      <span className="w-px h-4 bg-edge mx-1" />

      {/* 撤销 / 重做（mockup 图标，恒常渲染，不可用即置灰） */}
      <DockAction
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M4.2 7.8h9.6a5.4 5.4 0 0 1 0 10.8H10" />
            <path d="M7.6 4.4 4.2 7.8l3.4 3.4" />
          </svg>
        }
        label="撤销"
        enabled={canUndo}
        disabledHint="没有可撤销的编辑"
        onClick={undo}
      />
      <DockAction
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M19.8 7.8h-9.6a5.4 5.4 0 0 0 0 10.8H14" />
            <path d="M16.4 4.4l3.4 3.4-3.4 3.4" />
          </svg>
        }
        label="重做"
        enabled={canRedo}
        disabledHint="没有可重做的编辑"
        onClick={redo}
      />

      <span className="w-px h-4 bg-edge mx-1" />

      {/* 分割 / 裁左 / 裁右 / 定格（mockup 图标：切线与半砍） */}
      <DockAction
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M12 2.8v18.4" />
            <path d="M8.2 6.4H2.6v11.2h5.6" />
            <path d="M15.8 6.4h5.6v11.2h-5.6" />
          </svg>
        }
        label="分割"
        enabled={editing.canSplit}
        disabledHint="把播放头移到片段内部再分割"
        onClick={editing.split}
      />
      <DockAction
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M12.6 3v18" strokeDasharray="2.2 2.6" />
            <path d="M16.6 5.8h4.8v12.4h-4.8" />
          </svg>
        }
        label="裁左"
        enabled={editing.canTrimLeft}
        disabledHint="把播放头移到片段内部"
        onClick={editing.trimLeft}
      />
      <DockAction
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M6.6 5.8H1.8v12.4h4.8" />
            <path d="M11.4 3v18" strokeDasharray="2.2 2.6" />
          </svg>
        }
        label="裁右"
        enabled={editing.canTrimRight}
        disabledHint="把播放头移到片段内部"
        onClick={editing.trimRight}
      />
      <DockAction
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M2.8 5.4h18.4" />
            <path d="M7.2 5.4v13.2h13.6V5.4" />
          </svg>
        }
        label="定格"
        enabled={editing.canSplit}
        disabledHint="把播放头移到片段内部"
        onClick={editing.freeze}
      />

      <span className="w-px h-4 bg-edge mx-1" />

      {/* 删除 + 复制。删除是**单一动作**：留洞还是自动补齐由「吸附」开关决定（不做两个同名按钮）。 */}
      <DockAction
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M4 6.6h16" />
            <path d="M9.4 6.6V4.3h5.2v2.3" />
            <path d="M6.7 6.6v13h10.6v-13" />
          </svg>
        }
        label="删除"
        enabled={editing.canDelete}
        disabledHint="先选中一个片段"
        onClick={editing.delete}
      />
      <DockAction
        icon={
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5.5A1.5 1.5 0 0 1 6.5 4H15" />
          </svg>
        }
        label="复制"
        enabled={duplicateEnabled}
        disabledHint="先选中一个片段"
        onClick={editing.duplicate}
      />

      <span className="ml-auto" />
      {/* 收起按钮（**工具带正中间**）：用**绝对定位**钉在 header 的水平中轴，而非"自动边距夹在中间"。
          ⚠️ `ml-auto` + `mr-auto` 只按**剩余空间**平分 —— 左右两组宽度不等时它会偏（实测就是偏的）。
          绝对定位 `left-1/2 -translate-x-1/2` 才与「底部半圆展开把手」落在**同一条垂直中轴**上。
          一物两用：**点一下**收起基座、**上下拖动**调高度（判据在 `beginDockResize`，位移阈值区分）。
          hover 时**底色块与横线整层等比放大**（scale 施在含横线的那层上，比例始终一致）。 */}
      <button
        type="button"
        aria-label="收起时间轴"
        title="点一下收起 · 按住上下拖动可调高度"
        onPointerDown={onDockResizePointerDown}
        /* Y 轴 `-6px` 微调垂直位置：视觉重心略高于几何中点更顺眼
           （横线本身也在按钮内居中，整体上移后与左组图标行的视觉基线更齐）。 */
        className="group absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[calc(50%+6px)] h-4 px-2 flex items-center justify-center cursor-pointer touch-none"
      >
        <span
          className="flex items-center justify-center w-11 h-[9px] rounded-full
                     transition-[transform,background-color] duration-150 ease-out
                     group-hover:scale-[1.35] group-hover:bg-surface-hover"
        >
          <span className="w-8 h-[3px] rounded-full bg-edge-strong/70 group-hover:bg-edge-strong" />
        </span>
      </button>

      {/* 吸附开关（全局开关，属右组）：开 = 主轨磁吸无空隙（删除自动补齐、拖拽拖不出缝）；
          关 = 主轨可留空隙（删除留洞、可拖出缝）。状态随工程落盘（`project.ui.magnetic`）。 */}
      <button
        type="button"
        className={`p-1.5 rounded hover:bg-surface-hover flex items-center gap-1 ${
          magnetic ? 'text-accent' : 'text-secondary'
        }`}
        title={
          magnetic
            ? '吸附已开：片段之间不留空隙（拖拽 / 删除都会自动对齐）'
            : '吸附已关：允许片段之间留出空隙'
        }
        aria-pressed={magnetic}
        onClick={onToggleMagnetic}
      >
        <Magnet size={14} />
      </button>

      <span className="w-px h-4 bg-edge mx-1" />

      {/* 时间轴缩放（mockup 右组：⊖ + 滑块 + ⊕ + 自适应）—— `clampZoom` 走同一取值域。
          图标用 lucide SVG（与走带 / 编辑动作同族），不用 `⊖ ⊕ ⤢` 文字字形：
          字形大小随字号走（比 15px 图标明显偏小）、且粗细与 `strokeWidth` 不一致，看着"不是一个系统"。 */}
      <button
        type="button"
        className="p-1.5 rounded hover:bg-surface-hover text-secondary"
        title="缩小时间轴"
        onClick={() => onPpsChange(clampZoom(pps / ZOOM_STEP))}
      >
        <Minus size={14} />
      </button>
      <input
        type="range"
        min={MIN_PIXELS_PER_SECOND}
        max={MAX_PIXELS_PER_SECOND}
        step={1}
        value={Math.round(pps)}
        title="时间轴缩放"
        className="w-20 accent-current"
        onChange={(e) => onPpsChange(clampZoom(Number(e.target.value)))}
      />
      <button
        type="button"
        className="p-1.5 rounded hover:bg-surface-hover text-secondary"
        title="放大时间轴"
        onClick={() => onPpsChange(clampZoom(pps * ZOOM_STEP))}
      >
        <Plus size={14} />
      </button>
      <button
        type="button"
        className="p-1.5 rounded hover:bg-surface-hover text-secondary"
        title="缩放到一屏看全"
        onClick={() => {
          const el = trackAreaRef.current;
          if (el) onPpsChange(fitZoom(totalDuration, el.clientWidth));
        }}
      >
        <Maximize2 size={14} />
      </button>

      <span className="w-px h-4 bg-edge mx-1" />

      {/* 工程参数 / 轨道高度（docs/120 C12.2 · C7.5）：齿轮 → 小浮层（点外部 / Esc 关闭） */}
      <SettingsMenu
        open={settingsOpen}
        onToggle={onToggleSettings}
        onClose={() => settingsOpen && onToggleSettings()}
        project={project}
        rowHeight={rowHeight}
        applyProjectPatch={applyProjectPatch}
      />

      <span className="w-px h-4 bg-edge mx-1" />

      {/* 导出 + 阶段进度（`docs/123` §一.5 O2：长任务要能看出卡在哪一步） */}
      <div className="flex items-center gap-2">
        {exporting && (
          <span className="tabular-nums text-[11px] text-muted">
            {STAGE_LABEL[exportStage ?? 'audio']} {Math.round(exportProgress * 100)}%
          </span>
        )}
        <button
          type="button"
          disabled={exporting || !canExport}
          title={exporting ? '导出中…' : '导出为画布节点'}
          onClick={() => void onExport()}
          className={`px-2.5 py-1 rounded ${
            exporting || !canExport ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-hover'
          }`}
        >
          导出
        </button>
        {exporting && (
          <button
            type="button"
            className="px-2.5 py-1 rounded hover:bg-surface-hover"
            onClick={abortExport}
          >
            取消
          </button>
        )}
      </div>
    </header>
  );
}

/** 工带动作按钮（mockup 工具带 = 图标行，不带文字）：不可用时**置灰 + tooltip 说明为什么**（O3）。 */
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
      className={`p-1.5 rounded flex items-center justify-center ${
        enabled
          ? 'text-secondary hover:bg-surface-hover hover:text-primary'
          : 'opacity-50 cursor-not-allowed'
      }`}
    >
      {icon}
    </button>
  );
}

/**
 * 齿轮 + 工程参数浮层（C12.2 · C7.5）。
 *
 * 【为什么是浮层而不是底部通栏设置条】参数是「表单」（数值输入 + 滑块），通栏横跨整个底部、
 * 字号被迫与轨道区齐大，与画面格格不入；浮层可压到 11px 紧凑排布，且**不占轨道可视高度**。
 *
 * 【关闭行为】点外部 / Esc 关闭；点浮层内不关（否则输入框一点就没了）。
 * 用 `pointerdown` 而非 `click`：拖拽起点也能正确判定「点在外面」。
 */
function SettingsMenu({
  open,
  onToggle,
  onClose,
  project,
  rowHeight,
  applyProjectPatch,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  project: Project | null;
  rowHeight: number;
  applyProjectPatch: ApplyProjectPatch;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <button
        type="button"
        className={`p-1.5 rounded hover:bg-surface-hover ${open ? 'text-accent' : 'text-secondary'}`}
        title="工程参数与轨道高度"
        onClick={onToggle}
      >
        <Cog size={14} />
      </button>
      {open && project && (
        <div
          className="absolute right-0 top-full mt-1 z-40 w-56 p-3 rounded-lg flex flex-col gap-2.5 bg-surface-1 border border-edge shadow-[0_20px_60px_-10px_rgb(0_0_0/0.85)] text-[11px]"
          data-settings-popover
          // 浮层内点击不冒泡到轨道区（避免误移播放头）
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
            <NumField
              label="宽"
              value={project.settings.width}
              commit={(v) =>
                v > 0
                  ? applyProjectPatch({ settings: { ...project.settings, width: v } })
                  : showToast('宽度须为正整数')
              }
            />
            <NumField
              label="高"
              value={project.settings.height}
              commit={(v) =>
                v > 0
                  ? applyProjectPatch({ settings: { ...project.settings, height: v } })
                  : showToast('高度须为正整数')
              }
            />
            <NumField
              label="帧率"
              value={project.fps}
              commit={(v) => (v > 0 ? applyProjectPatch({ fps: v }) : showToast('帧率须为正数'))}
            />
            {/* **视频轨**高度（C7.5）：行高单一出处 → 改这一处，胶片/名条同步派生化（键含帧高自动重抽）。
                ⚠️ 标签必须写明「视频轨」—— 该滑块**只作用于视频轨**（用户裁定 2026-09-14），
                音频/文字轨用固定行高。写「轨道高度」会让人以为它能改所有轨（与事实不符 = 撒谎）。 */}
            <label className="flex flex-col gap-1 col-span-2 text-[10px] text-muted">
              <span className="flex items-center justify-between">
                视频轨高度
                <span className="tabular-nums">{Math.round(rowHeight)}px</span>
              </span>
              <input
                type="range"
                min={ROW_HEIGHT_MIN}
                max={ROW_HEIGHT_MAX}
                step={2}
                value={Math.round(rowHeight)}
                className="w-full accent-current"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isFinite(v)) return;
                  const rowH = Math.min(ROW_HEIGHT_MAX, Math.max(ROW_HEIGHT_MIN, v));
                  // 行高 = 工程 UI 记忆：走统一写者持久化（随工程落盘，刷新/切项目保留）
                  applyProjectPatch({ ui: { ...project.ui, rowHeight: rowH } });
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/** 数值输入框（工程参数编辑用）：失焦 / 回车才提交，避免逐键写盘。校验交给调用方 `commit`。 */
function NumField({
  label,
  value,
  commit,
}: {
  label: string;
  value: number;
  commit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  const submit = () => {
    const v = Number(draft);
    if (!Number.isFinite(v)) return;
    commit(v);
  };
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-muted">
      {label}
      <input
        type="number"
        className="w-full h-5 px-1.5 rounded border border-edge-faint bg-surface-sunken text-primary text-[11px] tabular-nums"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
    </label>
  );
}
