/**
 * 工带 header —— mockup `.vd-bar`（紧凑 36px，图标行 + 单色 mono 时间码）。
 *
 * 【职责边界】**纯渲染**：只做「按钮 → 回调」的极薄绑定，**不持领域逻辑**（判据/动作都从 props 来）。
 * 走带 / 编辑能力（can*）+ 动作都来自 `useTimelineDrag.editing` 与 `useEditorTransport`；导出状态来自
 * `useEditorExport`；缩放与设置开关来自 Docker。
 */
import type { ReactNode, RefObject } from 'react';
import { Cog, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { formatTickLabel } from '../../../base/utils/timeline/rulerTicks.ts';
import {
  clampZoom,
  fitZoom,
  MAX_PIXELS_PER_SECOND,
  MIN_PIXELS_PER_SECOND,
} from '../../../base/utils/timeline/timeScale.ts';
import { ZOOM_STEP } from '../../core/constants.ts';
import type { ExportStage } from '../../export/pipeline.ts';
import type { TimelineEditing } from './useTimelineDrag.ts';

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
    onPpsChange,
    trackAreaRef,
  } = p;

  return (
    <header className="flex items-center gap-1 px-2.5 h-9 border-b border-edge-faint text-xs text-primary">
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

      {/* 删除（留洞 / 波纹）+ 复制 */}
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
        label="删除(留洞)"
        enabled={editing.canDelete}
        disabledHint="先选中一个片段"
        onClick={editing.deleteLift}
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
            <path d="M4 6.6h16" />
            <path d="M9.4 6.6V4.3h5.2v2.3" />
            <path d="M6.7 6.6v13h10.6v-13" />
          </svg>
        }
        label="删除(波纹)"
        enabled={editing.canDelete}
        disabledHint="先选中一个片段"
        onClick={editing.deleteRipple}
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

      {/* 时间轴缩放（mockup 右组：⊖ + 滑块 + ⊕ + 自适应）—— `clampZoom` 走同一取值域 */}
      <button
        type="button"
        className="p-1.5 rounded hover:bg-surface-hover text-secondary"
        title="缩小时间轴"
        onClick={() => onPpsChange(clampZoom(pps / ZOOM_STEP))}
      >
        ⊖
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
        ⊕
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
        ⤢
      </button>

      <span className="w-px h-4 bg-edge mx-1" />

      {/* 工程参数 / 轨道高度（docs/120 C12.2 · C7.5）开关 ── 面板在 DockStatusBar 渲染 */}
      <button
        type="button"
        className={`p-1.5 rounded hover:bg-surface-hover ${settingsOpen ? 'text-accent' : 'text-secondary'}`}
        title="工程参数与轨道高度"
        onClick={onToggleSettings}
      >
        <Cog size={14} />
      </button>

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
