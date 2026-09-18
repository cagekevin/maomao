/**
 * 资源预览 overlay —— 素材库（ResourceLibrary）与生成（GeneratedView）**共用的唯一实现**。
 *
 * 【为什么存在（TD-01-22 · 2026-09-18）】两个面板此前各自内联一份**逐字节相同**的全屏预览
 * （含 `TextPreview` 组件），且视频判据在两侧各写 4 处内联 `type === 'video' || startsWith('video')`。
 * 同一能力抄多份必然漂移（实测 `TextPreview` 的类型图标一侧有一侧无），故收口于此。
 *
 * 【分工】本组件只负责「把一条资源铺成全屏预览」：
 *   · text → `TextPreview`；audio → 播放器卡片；其余（image）→ 可拖到画布的大图；
 *   · video → 委托统一原语 `ImageZoomDialog`（含截屏/下载当前帧），本组件不再自写播放器。
 * 视频判定走 `assetType.isVideoResource`（与 `isAudio` 同族），**禁止在此再写一份**。
 * 拖到画布的 dragProps 由调用方注入（沿用各面板既有的 `useResourceCardDragProps` 组合，
 * 避免本组件反向依赖面板的 connected/onRefreshed 上下文）。
 */
import React, { useEffect, useRef } from 'react';
import { FileText, Music } from 'lucide-react';
import ImageZoomDialog from '../editors/ImageZoomDialog.tsx';
import { isAudio, isVideoResource } from '../utils/assetType.ts';
import { toAbsoluteFileUrl } from '../api/filesApi.ts';
import { toImgDragProps, useTextAsset } from '../../../hooks/useAssetDragToCanvas.ts';
import type { ResourceDragSourceProps } from '../../../hooks/useResourceMoveToFolder.ts';
import type { ResourceItem } from '../api/localToolApi.ts';

/** 拖到画布的 dragProps 工厂（各面板由 `useResourceCardDragProps` 提供）；此处只声明所需的最窄形状。 */
type AssetDragProps = (asset: {
  url: string;
  name?: string;
  type?: string;
}) => ResourceDragSourceProps;

// 文字素材预览：完整展示文件内容
// 三态显式区分（读取与三态归 `useTextAsset` 唯一实现，此处只做呈现）：加载中 / 读到（含真空）/ 读失败。
// 旧实现 `fetchText(url).then(setText)` + `text || '（加载中...）'` 把「读失败」和「真空文件」
// 都渲染成"加载中..." —— 永远转圈，用户无从判别（TD-18-17 · 一诚实）。
const TextPreview = React.memo(function TextPreview({ url, name }: { url: string; name?: string }) {
  const state = useTextAsset(url);
  const body =
    state.phase === 'loading'
      ? '（加载中...）'
      : state.phase === 'failed'
        ? `（${state.error}）`
        : state.text || '（空文件）';
  return (
    <div className="w-[360px] max-w-[90vw] bg-surface-2 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={18} className="text-yellow-400" />
        <span className="text-sm text-primary m-0">{name}</span>
      </div>
      <pre
        className={`text-xs whitespace-pre-wrap break-words max-h-[55vh] overflow-y-auto custom-scrollbar m-0 ${state.phase === 'failed' ? 'text-red-400' : 'text-secondary'}`}
      >
        {body}
      </pre>
    </div>
  );
});

export interface ResourcePreviewProps {
  item: ResourceItem | null;
  onClose: () => void;
  assetDragProps: AssetDragProps;
}

export function ResourcePreviewOverlay({ item, onClose, assetDragProps }: ResourcePreviewProps) {
  const videoZoomRef = useRef<HTMLDialogElement>(null);
  // 视频预览：item 变为视频时自动打开统一视频框（关闭由 onClose 复位）
  useEffect(() => {
    if (item && isVideoResource(item.type, item.url)) videoZoomRef.current?.showModal();
  }, [item]);

  if (!item) return null;

  if (isVideoResource(item.type, item.url)) {
    return <ImageZoomDialog ref={videoZoomRef} url={item.url} kind="video" onClose={onClose} />;
  }

  return (
    <div
      className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-w-full max-h-full flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {item.type === 'text' ? (
          <TextPreview url={item.url ?? ''} name={item.name} />
        ) : isAudio(item.type, item.url) ? (
          <div className="w-[300px] bg-surface-2 rounded-xl p-6 flex flex-col items-center gap-3">
            <Music size={40} className="text-green-400" />
            <p className="text-xs text-secondary m-0">{item.name}</p>
            <audio src={item.url} controls className="w-full" />
          </div>
        ) : (
          <img
            src={toAbsoluteFileUrl(item.url)}
            alt={item.name}
            {...toImgDragProps(
              assetDragProps({
                url: toAbsoluteFileUrl(item.url),
                name: item.name,
                type: item.type,
              }),
            )}
            className="max-h-[75vh] max-w-full rounded-lg object-contain cursor-grab active:cursor-grabbing"
          />
        )}
        <p className="text-xs text-muted m-0">
          {item.name} · {item.folder}
        </p>
        <button
          className="px-4 py-1.5 rounded-lg bg-surface-hover text-body hover:bg-surface-hover-strong text-xs cursor-pointer border-none"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
