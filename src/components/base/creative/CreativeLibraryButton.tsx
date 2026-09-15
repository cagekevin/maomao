/**
 * CreativeLibraryButton —— 创作库「预设」薄入口（入口收敛，§一.6 / 2026-09-15 mockup 第一轮迭代）。
 *
 * 节点底栏只保留一个「预设」按钮，点它打开创作库面板（再点关闭）；分区切换收进面板内 tab，
 * 不再按类型各设入口。替代既有 `prompt/PromptLibraryButton`（旧提示词库，A 类归并后移除）。
 *
 * 覆为全屏浮层（复用 `FullscreenShell`：portal + 模态登记 + Esc 关闭），半屏卡片壳由 `CreativeLibrary` 负责。
 *
 * 职责：只负责「开关创作库面板」+「把 onApply 上抛给宿主节点」。胶囊落地 / 写 data.creativePresets /
 * 关闭面板 都由宿主（节点）在 onApply 里实现。节点必须自备 `insertAssetRef`（PromptInput.onReady）来落胶囊。
 *
 * @param {object} props
 *  - initialTab  初始分区（'image' 节点 → style，'video' → style，'text' → prompt 等，节点自传）
 *  - onApply     (item, fragment) => void：落胶囊 + 写字典 + 关闭面板
 */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import FullscreenShell from '../panels/FullscreenShell.tsx';
import CreativeLibrary, { type CreativeLibraryProps } from './CreativeLibrary.tsx';

export interface CreativeLibraryButtonProps {
  /** 初始分区 */
  initialTab?: CreativeLibraryProps['initialTab'];
  /** 应用回调（落胶囊 + 写字典 + 关闭面板），由节点实现 */
  onApply: CreativeLibraryProps['onApply'];
}

export default function CreativeLibraryButton({
  initialTab = 'style',
  onApply,
}: CreativeLibraryButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="w-[1px] h-3 bg-surface-3 flex-shrink-0 mr-1.5" />
      <button
        type="button"
        className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer"
        title="预设（创作库：风格 / 滤镜 / 运镜 / MJ码图 / 提示词）"
        aria-pressed={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Sparkles size={10} className="text-blue-400" />
        <span>预设</span>
      </button>
      <FullscreenShell
        open={open}
        onClose={() => setOpen(false)}
        className="fixed inset-0 z-ceiling bg-black/75 backdrop-blur-sm flex items-center justify-center nowheel nopan nodrag"
        onClick={() => setOpen(false)}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <CreativeLibrary
            initialTab={initialTab}
            onApply={(item, fragment) => {
              onApply(item, fragment);
              setOpen(false);
            }}
          />
        </div>
      </FullscreenShell>
    </>
  );
}
