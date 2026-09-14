/**
 * 常驻信息 / 状态条 —— mockup（C5.6 / C13）。
 *
 * 【职责边界】**纯渲染**：把「导出前常驻信息 · 断链预检 · 冲突 / 失败 / 加载」从 Docker 里拆出来，
 * 只消费 props，不持领域逻辑。
 * 工程参数与轨道高度编辑（C12.2 / C7.5）已迁至 `DockToolbar` 的**齿轮弹窗**（点齿轮弹出、点外部关闭）。
 *
 * 【诚实可见（不静默）】这里的每一条都对应一次"必须让用户看见的事实"：
 *  - C5.6：导出路径 / 参数 / 黑边常驻（不「悄悄掉画质」）；
 *  - C13：断链预检（导出会跳过哪些片段）；
 *  - C2.7：版本冲突未落盘（本地改动保留，给"重新加载"）；
 *  - 读取失败红字。
 */

/** 「常驻层」声明（`dockContract.test.ts` 按此标记禁用 portal / FullscreenShell）：本目录的文件都挂在 App 根 flex 列内、常驻不 portal，故不许登记 modalLayer。 */
// DOCK_IS_PERSISTENT（常驻层声明 · dockContract.test.ts 按此标记禁用 portal）

import { Plus } from 'lucide-react';
import type { Project } from '../../core/types.ts';

export interface DockStatusBarProps {
  project: Project | null;
  brokenCount: number;
  conflict: boolean;
  reload: () => void;
  failed: boolean;
  reason?: string;
  /** `plan?.reason`（导出路径）—— 空则显示"正在判断导出路径…"。 */
  exportInfoReason: string | null;
  letterbox: 'yes' | 'no' | 'unknown';
  /**
   * 加轨操作（「＋ 文字 / ＋ 视频 / ＋ 音频」）—— **与下面那行小字同排**（用户口径）。
   *
   * 【为什么把加轨并进信息行，而不是它自己独占一行】
   * 两者都是「基座底部的常驻元信息/操作区」：一个是**操作**（加轨）、一个是**状态**
   * （导出路径 / 尺寸 / 帧率 / 黑边）。分成两行时，加轨那行只放两个小按钮却吃掉 28px 全宽；
   * 并成一行后基线对齐（`flex items-center`），视觉上也更像一条"底栏"而不是两个碎片条。
   * 代价仅是行高从 24px 抬到 28px（按钮要 20px 才点得准），比多占一整行划算。
   *
   * 【为什么把动作以回调传进来，而不是在这里 import 领域逻辑】
   * DockStatusBar 的职责边界是**纯渲染**（见文件头）。加轨的判据与动作都在 `useTimelineDrag`，
   * 故这里只收「三个动作 + 各自的可用性 + 上限说明」，不自己算轨道数。
   */
  onAddTrack: (kind: 'text' | 'video' | 'audio') => void;
  /** ★新增 2026-09-14：文字轨入口（用户口径：最左边加一个「文字」就好）。 */
  canAddText: boolean;
  canAddVideo: boolean;
  canAddAudio: boolean;
  addTrackLimit: number;
}

export function DockStatusBar(p: DockStatusBarProps) {
  const {
    project,
    brokenCount,
    conflict,
    reload,
    failed,
    reason,
    exportInfoReason,
    letterbox,
    onAddTrack,
    canAddText,
    canAddVideo,
    canAddAudio,
    addTrackLimit,
  } = p;

  return (
    <>
      {/* ── C5.6：导出前信息**常驻**（路径 / 工程参数 / 黑边 / 音频出口）+ 加轨操作，**同一行** ── */}
      {project && (
        <div
          className="px-3 h-7 flex items-center gap-1.5 text-[10px] text-muted bg-surface-sunken"
          data-export-info
        >
          {/* 左组：加轨（低频操作，放在行的最左端，与右侧状态信息拉开）。
              顺序按**层序**排列：文字（最上层轨）→ 视频 → 音频（用户口径 2026-09-14：
              「最左边加一个文字就好了」）。按钮顺序与轨道区自上而下的显示顺序一致。 */}
          <span className="shrink-0 select-none text-muted/80">添加轨道</span>
          <AddTrackButton
            label="文字"
            enabled={canAddText}
            hint={
              canAddText
                ? '新增一条文字轨（位于最上层，盖住视频）'
                : `文字轨已达上限（${addTrackLimit} 条）`
            }
            onClick={() => onAddTrack('text')}
          />
          <AddTrackButton
            label="视频"
            enabled={canAddVideo}
            hint={
              canAddVideo
                ? '新增一条视频轨（作为叠加层，可自由摆放）'
                : `视频轨已达上限（${addTrackLimit} 条）`
            }
            onClick={() => onAddTrack('video')}
          />
          <AddTrackButton
            label="音频"
            enabled={canAddAudio}
            hint={canAddAudio ? '新增一条音频轨' : `音频轨已达上限（${addTrackLimit} 条）`}
            onClick={() => onAddTrack('audio')}
          />
          <span className="w-px h-3.5 bg-edge shrink-0" />

          {/* 右组：导出前状态信息（`ml-auto` 顶到最右，`truncate` 收纳长文案）。
              外层不给 `truncate`（那需要 `overflow-hidden` + 定宽），改由这层自己收窄 —— 
              加轨按钮是 `shrink-0`，故长文案会先被压缩，按钮永不挤压。 */}
          <span className="ml-auto min-w-0 truncate">
            {exportInfoReason ?? '正在判断导出路径…'}
            <span className="mx-1">·</span>
            {project.settings.width}×{project.settings.height}
            <span className="mx-1">·</span>
            {project.fps}fps
            <span className="mx-1">·</span>
            {letterbox === 'yes'
              ? '成片会有黑边（片段比例 ≠ 工程比例）'
              : letterbox === 'no'
                ? '无黑边'
                : '片段尺寸未探测，可能带黑边'}
            <span className="mx-1">·</span>
            音频出口 AAC 48kHz
          </span>
        </div>
      )}

      {/* ── 警告浮层：absolute 浮在状态条（加轨行）正上方 ──
          根因：这三个 banner 原本是 dock flex 列的子项，默认会被 flex-shrink 压扁，
          拖拽基座高度时争空间 → 横幅被裁切/不显示 → 忽隐忽现。
          现改为绝对定位浮层（相对外层 `relative` 容器），脱离 flex 压缩，
          且多个同时触发时向上整齐堆叠、互不重叠。 */}
      <div className="absolute left-0 right-0 bottom-full z-20 flex flex-col">
        {/* ── C13：断链预检 ── */}
        {brokenCount > 0 && (
          <div className="px-3 py-1 text-xs bg-danger/15 text-danger" data-broken-banner>
            有 {brokenCount} 个片段素材读不到 —— 导出会**跳过**这些片段，其余照常。
          </div>
        )}
        {/* ── 冲突（诚实可见，不静默）── */}
        {conflict && (
          <div className="px-3 py-1 text-xs bg-danger/15 text-danger flex items-center gap-2">
            工程已在别处更新，本次改动**未落盘**（本地改动保留）。
            <button type="button" className="underline" onClick={reload}>
              重新加载
            </button>
          </div>
        )}
        {failed && (
          <div className="px-3 py-1 text-xs bg-danger/15 text-danger">
            工程读取失败：{reason ?? '未知原因'}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * 信息行里的一个「加轨」小按钮。
 *
 * 【尺寸为什么是 `h-5 px-2`】信息行高 28px，按钮 20px 上下各留 4px。
 * 低于 20px 时命中区过窄（图标 11px + 文字 10px 已经占满），点在边缘容易落空。
 * 【为什么不用 `border-dashed`】虚线框在这一行（`bg-surface-sunken` 底）上会显得像"待填空白"
 * 而不是可点按钮；实线细框 + hover 变色与工带其它按钮同族。
 */
function AddTrackButton({
  label,
  enabled,
  hint,
  onClick,
}: {
  label: string;
  enabled: boolean;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      title={hint}
      onClick={onClick}
      className="shrink-0 h-5 px-1.5 rounded flex items-center gap-0.5 border border-edge-strong/50 text-secondary hover:bg-surface-hover hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Plus size={11} />
      {label}
    </button>
  );
}
