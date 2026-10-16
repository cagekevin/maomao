import { useMemo } from 'react';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
// 【TD-04-45】选中元素的 React 桥接**唯一实现**在 use-element-selection（本处原为逐字重复的内联箭头）。
import { useSelectedElements } from '@/components/videoEditor/hooks-cutia/timeline/element/use-element-selection';
import { cn } from '@/components/videoEditor/utils/ui';
import type {
  AudioElement,
  TimelineTrack,
  TimelineElement,
  ElementType,
} from '@/components/videoEditor/types/timeline';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';
import type { TProjectSettings } from '@/components/videoEditor/types/project';
import { getElementCanvasRect } from '@/components/videoEditor/engine/lib/preview/element-bounds';
import { indexMediaAssets } from '@/components/videoEditor/engine/lib/media/media-utils';
import { hasMediaId, isElementActiveAtTime } from '@/components/videoEditor/engine/timeline';

type ScaleHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type ResizeHandle = 'left' | 'right';

const HANDLE_SIZE = 10;
const RESIZE_HANDLE_WIDTH = 6;
const RESIZE_HANDLE_HEIGHT = 24;

const SCALE_HANDLES: ScaleHandle[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/** 有 `transform` 的元素（音频元素不参与画布叠加层）。 */
type VisualElement = Exclude<TimelineElement, AudioElement>;

interface ElementBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
}

function getHandlePosition({ handle }: { handle: ScaleHandle }) {
  switch (handle) {
    case 'top-left':
      return { left: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 };
    case 'top-right':
      return { right: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 };
    case 'bottom-left':
      return { left: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2 };
    case 'bottom-right':
      return { right: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2 };
  }
}

function getHandleCursor({ handle }: { handle: ScaleHandle }) {
  switch (handle) {
    case 'top-left':
    case 'bottom-right':
      return 'nwse-resize';
    case 'top-right':
    case 'bottom-left':
      return 'nesw-resize';
  }
}

/**
 * 元素 → 叠加层坐标（**唯一几何原语** `getElementCanvasRect` × 画布 → 显示的缩放）。
 *
 * 【为什么不再自己算】这里曾有 `computeMediaBounds` / `computeTextBounds` / `computeStickerBounds`
 * 三份算式，与 `element-bounds`（命中 / 吸附）和 `visual-node`（渲染）**同一件事写三遍**，
 * 且三份取值口径不同（文本：一份估算一份实测；贴纸：一份用画布宽、一份用适配基准）
 * ⇒ 框子套不住画面、点不中自己看到的字。现只此一处派生。
 */
function getElementBounds({
  element,
  media,
  settings,
  displayScale,
}: {
  element: VisualElement;
  media: MediaAsset | undefined;
  settings: Pick<TProjectSettings, 'canvasSize' | 'originalCanvasSize'>;
  displayScale: number;
}): ElementBounds | null {
  const rect = getElementCanvasRect({
    element,
    transform: element.transform,
    media,
    settings,
  });
  if (!rect) return null;

  return {
    left: (rect.centerX - rect.width / 2) * displayScale,
    top: (rect.centerY - rect.height / 2) * displayScale,
    width: rect.width * displayScale,
    height: rect.height * displayScale,
    rotate: rect.rotate,
  };
}

function ElementOverlay({
  bounds,
  elementType,
  isTransforming,
  onScaleStart,
  onResizeStart,
}: {
  bounds: ElementBounds;
  elementType: ElementType;
  isTransforming: boolean;
  onScaleStart: ({ event, handle }: { event: React.PointerEvent; handle: ScaleHandle }) => void;
  onResizeStart?: ({ event, handle }: { event: React.PointerEvent; handle: ResizeHandle }) => void;
}) {
  const showResizeHandles = elementType === 'text' && onResizeStart;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        transform: bounds.rotate !== 0 ? `rotate(${bounds.rotate}deg)` : undefined,
        transformOrigin: 'center center',
        zIndex: 1000,
      }}
    >
      {/* Selection border */}
      <div
        className={cn(
          'absolute inset-0 rounded border-2',
          isTransforming ? 'border-primary/70' : 'border-primary',
        )}
      />

      {/* Corner handles (proportional scale) */}
      {SCALE_HANDLES.map((handle) => (
        <div
          key={handle}
          className="bg-primary border-background pointer-events-auto absolute rounded-sm border"
          style={{
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            cursor: getHandleCursor({ handle }),
            ...getHandlePosition({ handle }),
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            onScaleStart({ event, handle });
          }}
        />
      ))}

      {/* Side handles for text width resize */}
      {showResizeHandles && (
        <>
          {/* Left handle */}
          <div
            className="bg-primary border-background pointer-events-auto absolute rounded-sm border"
            style={{
              width: RESIZE_HANDLE_WIDTH,
              height: RESIZE_HANDLE_HEIGHT,
              cursor: 'ew-resize',
              left: -RESIZE_HANDLE_WIDTH / 2,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onResizeStart({ event, handle: 'left' });
            }}
          />
          {/* Right handle */}
          <div
            className="bg-primary border-background pointer-events-auto absolute rounded-sm border"
            style={{
              width: RESIZE_HANDLE_WIDTH,
              height: RESIZE_HANDLE_HEIGHT,
              cursor: 'ew-resize',
              right: -RESIZE_HANDLE_WIDTH / 2,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onResizeStart({ event, handle: 'right' });
            }}
          />
        </>
      )}
    </div>
  );
}

export function SelectionOverlay({
  displaySize,
  onScaleStart,
  onResizeStart,
  isTransforming,
}: {
  displaySize: { width: number; height: number };
  onScaleStart: ({
    event,
    handle,
    element,
    trackId,
  }: {
    event: React.PointerEvent;
    handle: ScaleHandle;
    element: TimelineElement;
    trackId: string;
  }) => void;
  onResizeStart: ({
    event,
    handle,
    element,
    trackId,
  }: {
    event: React.PointerEvent;
    handle: ResizeHandle;
    element: TimelineElement;
    trackId: string;
  }) => void;
  isTransforming: boolean;
}) {
  const editor = useEditor('playback', 'timeline', 'project', 'media');

  const selectedElements = useSelectedElements();

  const currentTime = editor.playback.getCurrentTime();
  const activeProject = editor.project.getActive();
  const mediaAssets = editor.media.getAssets();
  const canvasWidth = activeProject?.settings.canvasSize.width ?? 0;
  const displayScale = canvasWidth > 0 ? displaySize.width / canvasWidth : 1;

  const mediaMap = useMemo(() => indexMediaAssets({ mediaAssets }), [mediaAssets]);

  const elementsWithTracks = editor.timeline.getElementsWithTracks({
    elements: selectedElements,
  });

  const visibleElements = elementsWithTracks.filter(
    (item): item is { track: TimelineTrack; element: VisualElement } => {
      const { element } = item;
      if (element.type === 'audio') return false;
      return isElementActiveAtTime({ element, time: currentTime });
    },
  );

  if (visibleElements.length === 0 || displaySize.width === 0) {
    return null;
  }

  return (
    <>
      {visibleElements.map(({ track, element }) => {
        const media = hasMediaId(element) ? mediaMap.get(element.mediaId) : undefined;

        const bounds = getElementBounds({
          element,
          media,
          settings: activeProject.settings,
          displayScale,
        });

        if (!bounds) return null;

        return (
          <ElementOverlay
            key={element.id}
            bounds={bounds}
            elementType={element.type}
            isTransforming={isTransforming}
            onScaleStart={({ event, handle }) =>
              onScaleStart({
                event,
                handle,
                element,
                trackId: track.id,
              })
            }
            onResizeStart={({ event, handle }) =>
              onResizeStart({
                event,
                handle,
                element,
                trackId: track.id,
              })
            }
          />
        );
      })}
    </>
  );
}
