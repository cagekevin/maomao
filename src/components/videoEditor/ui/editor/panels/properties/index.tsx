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
  const editor = useEditor();
  const { selectedElements } = useElementSelection();

  const elementsWithTracks = editor.timeline.getElementsWithTracks({
    elements: selectedElements,
  });

  const grouped = useMemo(() => groupByType(elementsWithTracks), [elementsWithTracks]);

  return (
    // 【不再外包 ScrollArea】（2026-09-15）里层每个面板（`PanelBaseView`）**自己就有**
    // 一个滚动容器 —— 两层 ScrollArea 嵌套会让内容滚两次、并各带一份内边距（稀疏感来源之一）。
    <div className="panel bg-background h-full border overflow-hidden">
      {selectedElements.length > 0 ? (
        <>
          {grouped.text && grouped.text.length > 0 && (
            <TextProperties
              elements={grouped.text.map((item) => ({
                element:
                  item.element as import('@/components/videoEditor/types/timeline').TextElement,
                trackId: item.track.id,
              }))}
            />
          )}
          {grouped.video && grouped.video.length > 0 && (
            <VideoProperties
              _element={
                grouped.video[0]
                  .element as import('@/components/videoEditor/types/timeline').VideoElement
              }
              trackId={grouped.video[0].track.id}
            />
          )}
          {grouped.image && grouped.image.length > 0 && (
            <VideoProperties
              _element={
                grouped.image[0]
                  .element as import('@/components/videoEditor/types/timeline').ImageElement
              }
              trackId={grouped.image[0].track.id}
            />
          )}
          {grouped.audio && grouped.audio.length > 0 && (
            <AudioProperties
              _element={
                grouped.audio[0]
                  .element as import('@/components/videoEditor/types/timeline').AudioElement
              }
              trackId={grouped.audio[0].track.id}
            />
          )}
          {grouped.sticker && grouped.sticker.length > 0 && (
            <StickerProperties
              _element={
                grouped.sticker[0]
                  .element as import('@/components/videoEditor/types/timeline').StickerElement
              }
              trackId={grouped.sticker[0].track.id}
            />
          )}
        </>
      ) : (
        <EmptyView />
      )}
    </div>
  );
}
