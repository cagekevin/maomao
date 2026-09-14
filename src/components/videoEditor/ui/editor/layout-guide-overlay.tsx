'use client';

import { useEditorStore } from '@videoEditor/stores/editor-store';
// 更新(2026-09-14)：原 `import Image from "next/image"` 已删（Next 依赖，且会遮蔽原生 Image 构造器）。

function TikTokGuide() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* 更新(2026-09-14)：原为 next/image 的 <Image fill />，改原生 <img> 后
			    fill 属性无意义（className 的 inset-0 size-full 已表达同一语义），已删。 */}
      <img
        src="/platform-guides/tiktok-blueprint.png"
        alt="TikTok layout guide"
        className="absolute inset-0 size-full object-contain"
        draggable={false}
      />
    </div>
  );
}

export function LayoutGuideOverlay() {
  const { layoutGuide } = useEditorStore();

  if (layoutGuide.platform === null) return null;
  if (layoutGuide.platform === 'tiktok') return <TikTokGuide />;

  return null;
}
