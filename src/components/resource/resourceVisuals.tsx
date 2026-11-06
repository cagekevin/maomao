import React, { useMemo } from 'react';
import { Image as ImageIcon, Play, FileText, Music } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTextAsset } from '@/hooks/useAssetDragToCanvas';

/**
 * 生成面板 / 素材库面板共用的**视觉原子**（2026-11-06 收口）。
 *
 * 【为什么存在】`TYPE_BADGE`（类型→图标+配色）、`TextAssetCell`（文字资源卡片：展示文件内容前几行）
 * 此前在 `generate/GeneratedView` 与 `resource/ResourceLibrary` 各抄一份、逐字相同 ——
 * 与 `PagedFooter` / `ResourceCardActions` / `useInlineNameEditing` / `useResourceItemActions`
 * 同一族的 SSOT 第二份。
 *
 * 【落点】属**素材域**（操作对象是 ResourceItem 的类型与内容）⇒ `components/resource/`；
 * `generate/` 消费素材域的方向本已存在（GeneratedView 已 import ResourcePreview / ResourceCardActions / PagedFooter）。
 *
 * 【TextAssetCell 契约】失败必须可见：不退回 name —— 否则「读失败」与「文件名」在界面上无从区分
 * （TD-18-17 · 一诚实）。文字读取与三态归 `useTextAsset` 唯一实现，本组件只做呈现。
 */

export interface TypeBadgeEntry {
  icon: LucideIcon;
  cls: string;
}

export const TYPE_BADGE: Record<string, TypeBadgeEntry> & { image: TypeBadgeEntry } = {
  image: { icon: ImageIcon, cls: 'text-blue-400 bg-blue-500/10' },
  video: { icon: Play, cls: 'text-purple-400 bg-purple-500/10' },
  audio: { icon: Music, cls: 'text-green-400 bg-green-500/10' },
  text: { icon: FileText, cls: 'text-yellow-400 bg-yellow-500/10' },
};

export const TextAssetCell = React.memo(function TextAssetCell({
  url,
  name,
}: {
  url: string;
  name?: string | undefined;
}) {
  const state = useTextAsset(url);
  // 失败必须可见：不退回 name —— 否则"读失败"与"文件名"在界面上无从区分（TD-18-17 · 一诚实）
  const text = state.phase === 'ok' ? state.text : state.phase === 'failed' ? state.error : '';
  const display = useMemo(() => String(text || name || '').slice(0, 120), [text, name]);
  return (
    <div className="w-full h-full bg-surface-strong flex items-center justify-center px-1.5">
      {display && (
        <p className="text-2xs text-muted leading-tight m-0 line-clamp-3 break-all text-center">
          {display}
        </p>
      )}
    </div>
  );
});
