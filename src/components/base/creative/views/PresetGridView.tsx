/**
 * PresetGridView —— 创作库「风格 / 滤镜 / 运镜」三区共用网格视图。
 *
 * 视觉对照 `mockup/panel-kit-card/index.html`（视觉与交互基准）：一级 pills 分类（.pk-pills/.pk-pill），
 * 卡片大横图（图 + 底部渐变名条）。产物复用本仓 panel-kit 体系 + ResourceLibrary 卡片语言（Tailwind），
 * 不复刻 mockup 的自带 CSS（--mao-* 只在 mockup 内；产品走 src/index.css 令牌 + tailwind）。
 *
 * 交互（§一.6）：点卡片 → onApply(preset) 由父级把胶囊落节点并关闭面板；再点取消由父级管理选中态。
 * 本视图只负责渲染与即时回调，不持有面板关闭逻辑。
 */

import type { CreativePreset } from '../creativePresets.ts';

export interface PresetGridViewProps {
  /** 当前分区与分类过滤后的条目 */
  presets: CreativePreset[];
  /** 当前选中的预设 id（用于描边高亮） */
  selectedId?: string;
  /** 点卡片回调（预设） */
  onApply: (preset: CreativePreset) => void;
}

/** 卡片：图 + 底部渐变名条（对照 mockup .rcard）。 */
function PresetCard({
  preset,
  on,
  onApply,
}: {
  preset: CreativePreset;
  on: boolean;
  onApply: (p: CreativePreset) => void;
}) {
  const src = preset.preview;
  return (
    <button
      type="button"
      className={`group relative overflow-hidden cursor-pointer rounded-xl border text-left ${on ? 'border-accent ring-1 ring-accent/55 bg-surface' : 'border-edge hover:border-edge-raised bg-surface'}`}
      style={{ aspectRatio: '16/10' }}
      onClick={() => onApply(preset)}
      title={preset.name}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-strong text-faint text-xs">
          {preset.name}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 px-3 pt-5 pb-2.5 bg-gradient-to-t from-black/70 to-transparent">
        <p className="m-0 text-xs text-white/[0.92] truncate">{preset.name}</p>
      </div>
    </button>
  );
}

export default function PresetGridView({ presets, selectedId, onApply }: PresetGridViewProps) {
  if (presets.length === 0) {
    return <div className="py-8 text-center text-faint text-xs">没有匹配的结果</div>;
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 align-start overflow-y-auto px-3 py-2 custom-scrollbar">
      {presets.map((p) => (
        <PresetCard key={p.id} preset={p} on={p.id === selectedId} onApply={onApply} />
      ))}
    </div>
  );
}
