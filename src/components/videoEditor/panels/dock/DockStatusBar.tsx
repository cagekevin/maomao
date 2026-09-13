/**
 * 常驻信息 / 状态条 + 工程参数与轨道高度设置面板 —— mockup（C5.6 / C13 / C12.2 / C7.5）。
 *
 * 【职责边界】**纯渲染**：把「导出前常驻信息 · 断链预检 · 冲突 / 失败 / 加载 · 设置条」从 Docker 里拆出来，
 * 只消费 props，不持领域逻辑。
 *
 * 【诚实可见（不静默）】这里的每一条都对应一次"必须让用户看见的事实"：
 *  - C5.6：导出路径 / 参数 / 黑边常驻（不「悄悄掉画质」）；
 *  - C13：断链预检（导出会跳过哪些片段）；
 *  - C2.7：版本冲突未落盘（本地改动保留，给"重新加载"）；
 *  - 读取失败红字。
 */
import { useEffect, useState } from 'react';
import { showToast } from '../../../base/core/toastStore.ts';
import { ROW_HEIGHT_MAX, ROW_HEIGHT_MIN } from '../../core/constants.ts';
import type { Project } from '../../core/types.ts';

export interface DockStatusBarProps {
  settingsOpen: boolean;
  project: Project | null;
  rowHeight: number;
  applyProjectPatch: EditorProjectPatch;
  brokenCount: number;
  conflict: boolean;
  reload: () => void;
  failed: boolean;
  reason?: string;
  /** `plan?.reason`（导出路径）—— 空则显示"正在判断导出路径…"。 */
  exportInfoReason: string | null;
  letterbox: 'yes' | 'no' | 'unknown';
}

type EditorProjectPatch = (patch: Partial<Pick<Project, 'settings' | 'fps' | 'ui'>>) => void;

export function DockStatusBar(p: DockStatusBarProps) {
  const {
    settingsOpen,
    project,
    rowHeight,
    applyProjectPatch,
    brokenCount,
    conflict,
    reload,
    failed,
    reason,
    exportInfoReason,
    letterbox,
  } = p;

  return (
    <>
      {/* ── 工程参数 / 轨道高度编辑（docs/120 C12.2 · C7.5）──
           settings/fps/ui 经 applyProjectPatch 落盘且不进撤销栈；改尺寸会让 needsCompositing
           判据翻转（直通⇄合成），这是对的（C12.1）。数值输入在失焦/回车时提交，避免逐键写盘。 */}
      {settingsOpen && project && (
        <div
          className="px-3 py-2 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-edge-faint text-xs"
          data-settings-strip
        >
          <NumField
            label="宽度"
            value={project.settings.width}
            commit={(v) =>
              v > 0
                ? applyProjectPatch({ settings: { ...project.settings, width: v } })
                : showToast('宽度须为正整数')
            }
          />
          <NumField
            label="高度"
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
          {/* 轨道高度（C7.5）：行高单一出处 → 改这一处，胶片/波形/名条同步派生化（键含帧高自动重抽） */}
          <label className="flex items-center gap-2 text-secondary">
            轨道高度
            <input
              type="range"
              min={ROW_HEIGHT_MIN}
              max={ROW_HEIGHT_MAX}
              step={2}
              value={Math.round(rowHeight)}
              className="w-28 accent-current"
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) {
                  const rowH = Math.min(ROW_HEIGHT_MAX, Math.max(ROW_HEIGHT_MIN, v));
                  // 行高 = 工程 UI 记忆：走统一写者持久化（随工程落盘，刷新/切项目保留）
                  applyProjectPatch({ ui: { ...project.ui, rowHeight: rowH } });
                }
              }}
            />
            <span className="tabular-nums text-muted w-7">{Math.round(rowHeight)}px</span>
          </label>
        </div>
      )}

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
    <label className="flex items-center gap-2 text-secondary">
      {label}
      <input
        type="number"
        className="w-20 h-6 px-1.5 rounded border border-edge-faint bg-surface-sunken text-primary tabular-nums"
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
