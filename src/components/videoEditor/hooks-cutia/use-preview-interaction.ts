import { useCallback, useRef, useState } from 'react';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
// 【TD-04-45】选中元素的 React 桥接**唯一实现**在 use-element-selection（本处原为逐字重复的内联箭头）。
import { useSelectedElements } from '@/components/videoEditor/hooks-cutia/timeline/element/use-element-selection';
import type {
  Transform,
  TimelineTrack,
  TimelineElement,
  TextElement,
} from '@/components/videoEditor/types/timeline';
import type { TProjectSettings } from '@/components/videoEditor/types/project';
import { hitTestElements } from '@/components/videoEditor/engine/lib/preview/hit-test';
import {
  getElementCanvasRect,
  type ElementHalfSize,
} from '@/components/videoEditor/engine/lib/preview/element-bounds';
import {
  computePreviewSnap,
  type SnapGuide,
} from '@/components/videoEditor/engine/lib/preview/snap';
import {
  getOutputTracks,
  hasMediaId,
  isElementActiveAtTime,
} from '@/components/videoEditor/engine/timeline';
import {
  getFontScaleFactor,
  getTextMeasureContext,
  layoutText,
} from '@/components/videoEditor/engine/services/renderer/text-layout';
import { indexMediaAssets } from '@/components/videoEditor/engine/lib/media/media-utils';

type ScaleHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type ResizeHandle = 'left' | 'right';

interface SnapContext {
  elementHalfSize: ElementHalfSize;
  otherElementBounds: Array<{
    centerX: number;
    centerY: number;
    halfWidth: number;
    halfHeight: number;
  }>;
  canvasWidth: number;
  canvasHeight: number;
}

interface DragState {
  startX: number;
  startY: number;
  tracksSnapshot: TimelineTrack[];
  elements: Array<{
    trackId: string;
    elementId: string;
    initialTransform: Transform;
  }>;
  snapContext: SnapContext | null;
}

interface ScaleState {
  startX: number;
  startY: number;
  handle: ScaleHandle;
  tracksSnapshot: TimelineTrack[];
  trackId: string;
  elementId: string;
  initialTransform: Transform;
  anchorX: number;
  anchorY: number;
}

interface ResizeState {
  startX: number;
  startY: number;
  handle: ResizeHandle;
  tracksSnapshot: TimelineTrack[];
  trackId: string;
  elementId: string;
  initialBoxWidth: number;
  initialTransform: Transform;
  scaleFactor: number;
}

export function usePreviewInteraction({
  canvasRef,
  overlayRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayRef: React.RefObject<HTMLDivElement | null>;
}) {
  const editor = useEditor('playback', 'timeline', 'project', 'media', 'selection');
  const [isDragging, setIsDragging] = useState(false);
  const [isScaling, setIsScaling] = useState(false);
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);
  const dragStateRef = useRef<DragState | null>(null);
  const scaleStateRef = useRef<ScaleState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const scalePointerIdRef = useRef<number | null>(null);
  const resizePointerIdRef = useRef<number | null>(null);

  const selectedElements = useSelectedElements();

  const getCanvasCoordinates = useCallback(
    ({ clientX, clientY }: { clientX: number; clientY: number }) => {
      if (!canvasRef.current) return { x: 0, y: 0 };

      const rect = canvasRef.current.getBoundingClientRect();
      const logicalWidth = canvasRef.current.width;
      const logicalHeight = canvasRef.current.height;
      const scaleX = logicalWidth / rect.width;
      const scaleY = logicalHeight / rect.height;

      const canvasX = (clientX - rect.left) * scaleX;
      const canvasY = (clientY - rect.top) * scaleY;

      return { x: canvasX, y: canvasY };
    },
    [canvasRef],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      const startPos = getCanvasCoordinates({
        clientX: event.clientX,
        clientY: event.clientY,
      });

      const settings = editor.project.getActive().settings;
      const tracks = editor.timeline.getTracks();
      const mediaAssets = editor.media.getAssets();
      const currentTime = editor.playback.getCurrentTime();

      // 命中口径（画布尺寸 + 适配基准）由 `hitTestElements` 从 settings 内部派生 —— 本处不喂。
      const hitResult = hitTestElements({
        point: startPos,
        tracks,
        mediaAssets,
        settings,
        currentTime,
      });

      if (!hitResult) {
        editor.selection.clearSelection();
        return;
      }

      const isAlreadySelected = selectedElements.some(
        (selected) =>
          selected.trackId === hitResult.trackId && selected.elementId === hitResult.element.id,
      );

      let draggedElementIds: Set<string>;

      if (!isAlreadySelected) {
        editor.selection.setSelectedElements({
          elements: [
            {
              trackId: hitResult.trackId,
              elementId: hitResult.element.id,
            },
          ],
        });

        draggedElementIds = new Set([hitResult.element.id]);

        dragStateRef.current = {
          startX: startPos.x,
          startY: startPos.y,
          tracksSnapshot: tracks,
          elements: [
            {
              trackId: hitResult.trackId,
              elementId: hitResult.element.id,
              initialTransform: hitResult.transform,
            },
          ],
          snapContext: null,
        };
      } else {
        const elementsWithTracks = editor.timeline.getElementsWithTracks({
          elements: selectedElements,
        });

        const draggableElements = elementsWithTracks.filter(
          ({ element }) =>
            element.type === 'video' ||
            element.type === 'image' ||
            element.type === 'text' ||
            element.type === 'sticker',
        );

        if (draggableElements.length === 0) return;

        draggedElementIds = new Set(draggableElements.map(({ element }) => element.id));

        dragStateRef.current = {
          startX: startPos.x,
          startY: startPos.y,
          tracksSnapshot: tracks,
          elements: draggableElements.map(({ track, element }) => ({
            trackId: track.id,
            elementId: element.id,
            initialTransform: (element as { transform: Transform }).transform,
          })),
          snapContext: null,
        };
      }

      const primaryElement = dragStateRef.current.elements[0];
      if (primaryElement === undefined) {
        dragStateRef.current = null; // 无可拖拽主元素 ⇒ 本次拖拽作废
        return;
      }

      dragStateRef.current.snapContext = buildSnapContext({
        tracks,
        mediaAssets,
        currentTime,
        settings,
        draggedElementIds,
        primaryElement,
      });

      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [selectedElements, editor, getCanvasCoordinates],
  );

  const handleScaleStart = useCallback(
    ({
      event,
      handle,
      element,
      trackId,
    }: {
      event: React.PointerEvent;
      handle: ScaleHandle;
      element: TimelineElement;
      trackId: string;
    }) => {
      if (element.type === 'audio') return;

      const startPos = getCanvasCoordinates({
        clientX: event.clientX,
        clientY: event.clientY,
      });
      const transform = (element as { transform: Transform }).transform;

      const canvasWidth = canvasRef.current?.width ?? 0;
      const canvasHeight = canvasRef.current?.height ?? 0;
      const anchorX = canvasWidth / 2 + transform.position.x;
      const anchorY = canvasHeight / 2 + transform.position.y;

      scaleStateRef.current = {
        startX: startPos.x,
        startY: startPos.y,
        handle,
        tracksSnapshot: editor.timeline.getTracks(),
        trackId,
        elementId: element.id,
        initialTransform: transform,
        anchorX,
        anchorY,
      };

      scalePointerIdRef.current = event.pointerId;
      overlayRef.current?.setPointerCapture(event.pointerId);

      setIsScaling(true);
    },
    [editor, getCanvasCoordinates, canvasRef, overlayRef],
  );

  const handleResizeStart = useCallback(
    ({
      event,
      handle,
      element,
      trackId,
    }: {
      event: React.PointerEvent;
      handle: ResizeHandle;
      element: TimelineElement;
      trackId: string;
    }) => {
      if (element.type !== 'text') return;

      const textElement = element as TextElement;
      const startPos = getCanvasCoordinates({
        clientX: event.clientX,
        clientY: event.clientY,
      });

      const canvasHeight = canvasRef.current?.height ?? 0;
      const scaleFactor = getFontScaleFactor({ canvasHeight });

      // 起始框宽 = 元素**当前实际占宽**（`layoutText` 实测 —— 与渲染 / 框子同一份排版）。
      // 不再用 `字符数 × 字号 × 0.6` 估算：`0.6 em` 是**西文**均宽，汉字是全角（≈1.0 em）
      // ⇒ 中文文本拖框时起始基准明显偏窄，第一下拖动就会跳。
      const layout = layoutText({
        element: textElement,
        canvasHeight,
        context: getTextMeasureContext(),
      });
      const initialBoxWidth =
        textElement.boxWidth && textElement.boxWidth > 0
          ? textElement.boxWidth
          : scaleFactor > 0
            ? layout.width / scaleFactor
            : layout.width;

      resizeStateRef.current = {
        startX: startPos.x,
        startY: startPos.y,
        handle,
        tracksSnapshot: editor.timeline.getTracks(),
        trackId,
        elementId: element.id,
        initialBoxWidth,
        initialTransform: textElement.transform,
        scaleFactor,
      };

      resizePointerIdRef.current = event.pointerId;
      overlayRef.current?.setPointerCapture(event.pointerId);
    },
    [editor, getCanvasCoordinates, canvasRef, overlayRef],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const currentPos = getCanvasCoordinates({
        clientX: event.clientX,
        clientY: event.clientY,
      });

      if (resizeStateRef.current) {
        const state = resizeStateRef.current;
        const { scaleFactor } = state;

        const rawDeltaX = currentPos.x - state.startX;
        const initialWidthPx = state.initialBoxWidth * scaleFactor;

        const directedDelta = state.handle === 'right' ? rawDeltaX : -rawDeltaX;
        const newWidthPx = Math.max(20, initialWidthPx + directedDelta);
        const newBoxWidth = newWidthPx / scaleFactor;

        const widthChangePx = (newBoxWidth - state.initialBoxWidth) * scaleFactor;
        const positionOffsetX = state.handle === 'right' ? widthChangePx / 2 : -widthChangePx / 2;

        editor.timeline.updateElements({
          updates: [
            {
              trackId: state.trackId,
              elementId: state.elementId,
              updates: {
                boxWidth: newBoxWidth,
                transform: {
                  ...state.initialTransform,
                  position: {
                    x: state.initialTransform.position.x + positionOffsetX,
                    y: state.initialTransform.position.y,
                  },
                },
              },
            },
          ],
          pushHistory: false,
        });
        return;
      }

      // scaling takes priority
      if (scaleStateRef.current && isScaling) {
        const state = scaleStateRef.current;
        const initialDist = Math.hypot(state.startX - state.anchorX, state.startY - state.anchorY);
        const currentDist = Math.hypot(currentPos.x - state.anchorX, currentPos.y - state.anchorY);

        if (initialDist < 1) return;

        const ratio = currentDist / initialDist;
        const newScale = Math.max(0.1, Math.min(5, state.initialTransform.scale * ratio));

        editor.timeline.updateElements({
          updates: [
            {
              trackId: state.trackId,
              elementId: state.elementId,
              updates: {
                transform: {
                  ...state.initialTransform,
                  scale: newScale,
                },
              },
            },
          ],
          pushHistory: false,
        });
        return;
      }

      if (!dragStateRef.current || !isDragging) return;

      const deltaX = currentPos.x - dragStateRef.current.startX;
      const deltaY = currentPos.y - dragStateRef.current.startY;

      const primaryElement = dragStateRef.current.elements[0];
      if (primaryElement === undefined) return; // 拖拽态必有主元素（不可达兜底）
      const primaryRawPosition = {
        x: primaryElement.initialTransform.position.x + deltaX,
        y: primaryElement.initialTransform.position.y + deltaY,
      };

      let snapDeltaX = 0;
      let snapDeltaY = 0;
      let newGuides: SnapGuide[] = [];

      const { snapContext } = dragStateRef.current;
      if (snapContext) {
        const snapResult = computePreviewSnap({
          position: primaryRawPosition,
          elementHalfSize: snapContext.elementHalfSize,
          canvasWidth: snapContext.canvasWidth,
          canvasHeight: snapContext.canvasHeight,
          otherElements: snapContext.otherElementBounds,
        });
        snapDeltaX = snapResult.snappedPosition.x - primaryRawPosition.x;
        snapDeltaY = snapResult.snappedPosition.y - primaryRawPosition.y;
        newGuides = snapResult.activeGuides;
      }

      setActiveGuides(newGuides);

      const updates = dragStateRef.current.elements.map(
        ({ trackId, elementId, initialTransform }) => ({
          trackId,
          elementId,
          updates: {
            transform: {
              ...initialTransform,
              position: {
                x: initialTransform.position.x + deltaX + snapDeltaX,
                y: initialTransform.position.y + deltaY + snapDeltaY,
              },
            },
          },
        }),
      );

      editor.timeline.updateElements({ updates, pushHistory: false });
    },
    [isDragging, isScaling, getCanvasCoordinates, editor],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (resizeStateRef.current) {
        const state = resizeStateRef.current;
        const currentPos = getCanvasCoordinates({
          clientX: event.clientX,
          clientY: event.clientY,
        });

        const rawDeltaX = currentPos.x - state.startX;
        const hasResized = Math.abs(rawDeltaX) > 1;

        if (hasResized) {
          const { scaleFactor } = state;
          const initialWidthPx = state.initialBoxWidth * scaleFactor;
          const directedDelta = state.handle === 'right' ? rawDeltaX : -rawDeltaX;
          const newWidthPx = Math.max(20, initialWidthPx + directedDelta);
          const newBoxWidth = newWidthPx / scaleFactor;

          const widthChangePx = (newBoxWidth - state.initialBoxWidth) * scaleFactor;
          const positionOffsetX = state.handle === 'right' ? widthChangePx / 2 : -widthChangePx / 2;

          editor.timeline.updateTracks(state.tracksSnapshot);
          editor.timeline.updateElements({
            updates: [
              {
                trackId: state.trackId,
                elementId: state.elementId,
                updates: {
                  boxWidth: newBoxWidth,
                  transform: {
                    ...state.initialTransform,
                    position: {
                      x: state.initialTransform.position.x + positionOffsetX,
                      y: state.initialTransform.position.y,
                    },
                  },
                },
              },
            ],
          });
        } else {
          editor.timeline.updateTracks(state.tracksSnapshot);
        }

        if (resizePointerIdRef.current !== null) {
          overlayRef.current?.releasePointerCapture(resizePointerIdRef.current);
          resizePointerIdRef.current = null;
        }

        resizeStateRef.current = null;
        return;
      }

      // handle scale commit
      if (scaleStateRef.current && isScaling) {
        const state = scaleStateRef.current;
        const currentPos = getCanvasCoordinates({
          clientX: event.clientX,
          clientY: event.clientY,
        });

        const initialDist = Math.hypot(state.startX - state.anchorX, state.startY - state.anchorY);
        const currentDist = Math.hypot(currentPos.x - state.anchorX, currentPos.y - state.anchorY);
        const hasScaled = Math.abs(currentDist - initialDist) > 1;

        if (hasScaled) {
          const ratio = currentDist / Math.max(1, initialDist);
          const newScale = Math.max(0.1, Math.min(5, state.initialTransform.scale * ratio));

          editor.timeline.updateTracks(state.tracksSnapshot);
          editor.timeline.updateElements({
            updates: [
              {
                trackId: state.trackId,
                elementId: state.elementId,
                updates: {
                  transform: {
                    ...state.initialTransform,
                    scale: newScale,
                  },
                },
              },
            ],
          });
        } else {
          editor.timeline.updateTracks(state.tracksSnapshot);
        }

        if (scalePointerIdRef.current !== null) {
          overlayRef.current?.releasePointerCapture(scalePointerIdRef.current);
          scalePointerIdRef.current = null;
        }

        scaleStateRef.current = null;
        setIsScaling(false);
        return;
      }

      // handle drag commit
      if (!dragStateRef.current || !isDragging) return;

      const currentPos = getCanvasCoordinates({
        clientX: event.clientX,
        clientY: event.clientY,
      });

      const deltaX = currentPos.x - dragStateRef.current.startX;
      const deltaY = currentPos.y - dragStateRef.current.startY;

      const hasMovement = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5;

      if (!hasMovement) {
        dragStateRef.current = null;
        setIsDragging(false);
        setActiveGuides([]);
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }

      const primaryElement = dragStateRef.current.elements[0];
      if (primaryElement === undefined) return; // 拖拽态必有主元素（不可达兜底）
      const primaryRawPosition = {
        x: primaryElement.initialTransform.position.x + deltaX,
        y: primaryElement.initialTransform.position.y + deltaY,
      };

      let snapDeltaX = 0;
      let snapDeltaY = 0;

      const { snapContext } = dragStateRef.current;
      if (snapContext) {
        const snapResult = computePreviewSnap({
          position: primaryRawPosition,
          elementHalfSize: snapContext.elementHalfSize,
          canvasWidth: snapContext.canvasWidth,
          canvasHeight: snapContext.canvasHeight,
          otherElements: snapContext.otherElementBounds,
        });
        snapDeltaX = snapResult.snappedPosition.x - primaryRawPosition.x;
        snapDeltaY = snapResult.snappedPosition.y - primaryRawPosition.y;
      }

      editor.timeline.updateTracks(dragStateRef.current.tracksSnapshot);

      const updates = dragStateRef.current.elements.map(
        ({ trackId, elementId, initialTransform }) => ({
          trackId,
          elementId,
          updates: {
            transform: {
              ...initialTransform,
              position: {
                x: initialTransform.position.x + deltaX + snapDeltaX,
                y: initialTransform.position.y + deltaY + snapDeltaY,
              },
            },
          },
        }),
      );

      editor.timeline.updateElements({ updates });

      dragStateRef.current = null;
      setIsDragging(false);
      setActiveGuides([]);
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [isDragging, isScaling, getCanvasCoordinates, editor, overlayRef],
  );

  const isResizing = resizeStateRef.current !== null;

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onScaleStart: handleScaleStart,
    onResizeStart: handleResizeStart,
    isTransforming: isDragging || isScaling || isResizing,
    activeGuides,
  };
}

function buildSnapContext({
  tracks,
  mediaAssets,
  currentTime,
  settings,
  draggedElementIds,
  primaryElement,
}: {
  tracks: TimelineTrack[];
  mediaAssets: ReturnType<ReturnType<typeof useEditor>['media']['getAssets']>;
  currentTime: number;
  settings: Pick<TProjectSettings, 'canvasSize' | 'originalCanvasSize'>;
  draggedElementIds: Set<string>;
  primaryElement: { elementId: string; initialTransform: Transform };
}): SnapContext | null {
  const mediaMap = indexMediaAssets({ mediaAssets });
  const canvasWidth = settings.canvasSize.width;
  const canvasHeight = settings.canvasSize.height;

  let primaryEl: TimelineElement | undefined;
  for (const track of tracks) {
    const found = track.elements.find((e) => e.id === primaryElement.elementId);
    if (found) {
      primaryEl = found;
      break;
    }
  }

  if (!primaryEl || primaryEl.type === 'audio') return null;

  // 矩形走**唯一几何原语**（与画面 / 框子 / 命中同一份算式与尺寸来源）。
  const primaryRect = getElementCanvasRect({
    element: primaryEl,
    transform: primaryElement.initialTransform,
    media: hasMediaId(primaryEl) ? mediaMap.get(primaryEl.mediaId) : undefined,
    settings,
  });

  if (!primaryRect) return null;

  const elementHalfSize: ElementHalfSize = {
    halfWidth: primaryRect.width / 2,
    halfHeight: primaryRect.height / 2,
  };

  const otherElementBounds: SnapContext['otherElementBounds'] = [];

  // 吸附候选与画面/命中**同一批**轨道（隐藏项已由投影滤掉，无从漏判）。
  for (const track of getOutputTracks(tracks)) {
    for (const element of track.elements) {
      if (element.type === 'audio') continue;
      if (draggedElementIds.has(element.id)) continue;

      if (!isElementActiveAtTime({ element, time: currentTime })) continue;

      const rect = getElementCanvasRect({
        element,
        transform: (element as { transform: Transform }).transform,
        media: hasMediaId(element) ? mediaMap.get(element.mediaId) : undefined,
        settings,
      });
      if (!rect) continue;

      otherElementBounds.push({
        centerX: rect.centerX,
        centerY: rect.centerY,
        halfWidth: rect.width / 2,
        halfHeight: rect.height / 2,
      });
    }
  }

  return { elementHalfSize, otherElementBounds, canvasWidth, canvasHeight };
}
