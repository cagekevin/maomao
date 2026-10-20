'use client';

import { useMemo } from 'react';
import { AudioProperties } from './audio-properties';
import { VideoProperties } from './video-properties';
import { TextProperties } from './text-properties';
import { StickerProperties } from './sticker-properties';
import { EmptyView } from './empty-view';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { useElementSelection } from '@/components/videoEditor/hooks-cutia/timeline/element/use-element-selection';
import type { TimelineElement, TimelineTrack } from '@/components/videoEditor/types/timeline';

interface ElementWithTrack {
  element: TimelineElement;
  track: TimelineTrack;
}

function groupByType(items: ElementWithTrack[]) {
  const groups: Record<string, ElementWithTrack[]> = {};
  for (const item of items) {
    const key = item.element.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

export function PropertiesPanel() {
  const editor = useEditor('timeline');
  const { selectedElements } = useElementSelection();

  const elementsWithTracks = editor.timeline.getElementsWithTracks({
    elements: selectedElements,
  });

  const grouped = useMemo(() => groupByType(elementsWithTracks), [elementsWithTracks]);
  // 各类型首个条目：面板只渲染「同类型首元素」的属性，先取好避免每处 `grouped.x[0]` 再判空
  const firstVideo = grouped['video']?.[0];
  const firstImage = grouped['image']?.[0];
  const firstAudio = grouped['audio']?.[0];
  const firstSticker = grouped['sticker']?.[0];

  return (
    // 【不再外包 ScrollArea】（2026-09-15）里层每个面板（`PanelBaseView`）**自己就有**
    // 一个滚动容器 —— 两层 ScrollArea 嵌套会让内容滚两次、并各带一份内边距（稀疏感来源之一）。
    <div className="panel bg-background h-full border overflow-hidden">
      {selectedElements.length > 0 ? (
        <>
          {grouped['text'] && grouped['text'].length > 0 && (
            <TextProperties
              elements={grouped['text'].map((item) => ({
                element:
                  item.element as import('@/components/videoEditor/types/timeline').TextElement,
                trackId: item.track.id,
              }))}
            />
          )}
          {firstVideo && (
            <VideoProperties
              _element={
                firstVideo.element as import('@/components/videoEditor/types/timeline').VideoElement
              }
              trackId={firstVideo.track.id}
            />
          )}
          {firstImage && (
            <VideoProperties
              _element={
                firstImage.element as import('@/components/videoEditor/types/timeline').ImageElement
              }
              trackId={firstImage.track.id}
            />
          )}
          {firstAudio && (
            <AudioProperties
              _element={
                firstAudio.element as import('@/components/videoEditor/types/timeline').AudioElement
              }
              trackId={firstAudio.track.id}
            />
          )}
          {firstSticker && (
            <StickerProperties
              _element={
                firstSticker.element as import('@/components/videoEditor/types/timeline').StickerElement
              }
              trackId={firstSticker.track.id}
            />
          )}
        </>
      ) : (
        <EmptyView />
      )}
    </div>
  );
}
