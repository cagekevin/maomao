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
}

export function DockStatusBar(p: DockStatusBarProps) {
  const { project, brokenCount, conflict, reload, failed, reason, exportInfoReason, letterbox } = p;

  return (
    <>
      {/* ── C5.6：导出前信息**常驻**（路径 / 工程参数 / 黑边 / 音频出口），不弹预检窗 ── */}
      {project && (
        <div
          className="px-3 h-6 flex items-center text-[10px] text-muted bg-surface-sunken truncate"
          data-export-info
        >
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
        </div>
      )}

      {/* ── C13：断链预检 —— 只有**真的需要决策**时才拦一次（其余信息常驻，见上） ── */}
      {brokenCount > 0 && (
        <div className="px-3 py-1 text-xs bg-danger/15 text-danger" data-broken-banner>
          有 {brokenCount} 个片段素材读不到 —— 导出会**跳过**这些片段，其余照常。
        </div>
      )}

      {/* ── 状态条：冲突 / 失败（诚实可见，不静默）── */}
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
    </>
  );
}
