/**
 * CreativeLibraryButton —— 创作库「预设」薄入口。
 *
 * 【形态裁决 2026-09-15】面板改为**全屏层**（FullscreenModal：portal 到 body + 登记模态层 +
 *   Esc 关闭），不再是节点内嵌 div。理由见 CreativeLibrary.tsx 头部「形态裁决」。
 *   为什么要 FullscreenModal 而不是自己 createPortal：它已备好「登记模态层 → 画布快捷键
 *   （⌘Z / Q / W / E）整体让位」与 Esc 接管，自己写会漏登记、导致画布快捷键静默失效
 *   （详见 FullscreenShell.tsx 头部记录的真实事故）。
 *
 * 职责：开关创作库面板 + 把 onApply 上抛给宿主节点。胶囊落地 / 写 data.creativePresets 由宿主节点实现；
 *   **关面板由本组件完成**（`open` state 在此，onApply 后 `setOpen(false)`；Esc / 关闭按钮亦走此）。
 *
 * @param {object} props
 *  - initialTab  初始分区
 *  - onApply     (item: CreativePreset) => void
 */

import { useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import FullscreenModal from '../panels/FullscreenModal.tsx';
import CreativeLibrary, { type CreativeLibraryProps } from './CreativeLibrary.tsx';
import type { CreativePreset } from './creativePresets.ts';

export interface CreativeLibraryButtonProps {
  initialTab?: CreativeLibraryProps['initialTab'];
  onApply: (item: CreativePreset) => void;
}

export default function CreativeLibraryButton({
  initialTab = 'style',
  onApply,
}: CreativeLibraryButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="node-btn-settings"
        aria-pressed={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="预设（创作库）"
      >
        <LayoutGrid size={12} />
        预设
      </button>
      {/* showHeader=false：创作库自带顶栏（5 分区 tab + 关闭），不需要外层标题栏。
          edgeToEdge=true：内容区去掉 p-5，让创作库自己的四段布局（顶栏/副条/网格/底栏）
            直接铺满外层卡片——否则外层 p-5 + 内层自留白各加一份，卡片可用宽度被白吃两遍。
          maxWidth=1120：1560 太宽（2026-09-15 用户裁定收窄）——卡片会被拉成超长横条、
            单卡信息密度过低，扫读反而变慢。1120 在 300px 最小卡宽下稳定 3 列，是浏览效率的上限。 */}
      <FullscreenModal
        open={open}
        showHeader={false}
        edgeToEdge
        maxWidth={1120}
        widthRatio={0.9}
        heightRatio={0.9}
        onClose={() => setOpen(false)}
      >
        <CreativeLibrary
          initialTab={initialTab}
          onClose={() => setOpen(false)}
          onApply={(item) => {
            onApply(item);
            setOpen(false);
          }}
        />
      </FullscreenModal>
    </>
  );
}
