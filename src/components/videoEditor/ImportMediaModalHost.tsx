/**
 * ImportMediaModalHost —— 导入弹窗的「开关 + 全屏层」薄壳（宿主注入落地动作）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么单独一层壳】`FullscreenModal` 已备好「登记模态层 → 画布快捷键让位 + Esc 关闭」
 * （详见 `FullscreenShell.tsx` 头部记录的真实事故）。两个入口都只需：
 *   `<ImportMediaModalHost open onClose projectId onPick onLocalFiles />`
 * 而不必各自重复 `FullscreenModal` 的 props（形态裁决同 `CreativeLibraryButton`）。
 *
 * 【形态沿用 creative 创作库】showHeader=false（弹窗自带顶栏）+ edgeToEdge（自带四段布局）
 * + maxWidth=1120（与创作库同档，卡片密度一致）。
 * ════════════════════════════════════════════════════════════════
 */
import FullscreenModal from '../base/panels/FullscreenModal.tsx';
import ImportMediaModal from '../base/panels/ImportMediaModal.tsx';
import type { ImportMediaModalProps } from '../base/panels/ImportMediaModal.tsx';

// 宿主（画布 / 剪辑器）只需依赖本薄壳：把落地动作的结果契约一并转出，
// 免得各宿主去猜"弹窗怎么知道成没成"（契约住在弹窗 props，这里只是转出）。
export type { ImportPickOutcome, ImportMediaModalProps } from '../base/panels/ImportMediaModal.tsx';

export interface ImportMediaModalHostProps extends ImportMediaModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportMediaModalHost({
  open,
  onClose,
  projectId,
  onPick,
  onLocalFiles,
}: ImportMediaModalHostProps) {
  return (
    <FullscreenModal
      open={open}
      showHeader={false}
      edgeToEdge
      maxWidth={1120}
      widthRatio={0.9}
      heightRatio={0.9}
      onClose={onClose}
    >
      <ImportMediaModal
        projectId={projectId}
        onPick={onPick}
        onLocalFiles={onLocalFiles}
        onClose={onClose}
      />
    </FullscreenModal>
  );
}
