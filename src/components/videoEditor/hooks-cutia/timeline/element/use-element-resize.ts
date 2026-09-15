import { useState, useEffect, useRef, useCallback } from 'react';
import type { TimelineElement, TimelineTrack } from '@videoEditor/types/timeline';
import { snapTimeToFrame } from '@videoEditor/engine/lib/time';
import {
  getElementPlaybackRate,
  getElementSourceDuration,
} from '@videoEditor/engine/timeline/element-utils';
import { EditorCore } from '@videoEditor/engine/core';
import {
  useTimelineSnapping,
  type SnapPoint,
} from '@videoEditor/hooks-cutia/timeline/use-timeline-snapping';
import { useTimelineStore } from '@videoEditor/stores/timeline-store';

export interface ResizeState {
  elementId: string;
  side: 'left' | 'right';
  startX: number;
  initialTrimStart: number;
  initialStartTime: number;
  initialDuration: number;
  initialPlaybackRate: number;
}

interface UseTimelineElementResizeProps {
  element: TimelineElement;
  track: TimelineTrack;
  zoomLevel: number;
  onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
  onResizeStateChange?: (params: { isResizing: boolean }) => void;
}

export function useTimelineElementResize({
  element,
  track,
  zoomLevel,
  onSnapPointChange,
  onResizeStateChange,
}: UseTimelineElementResizeProps) {
  const editor = EditorCore.getInstance();
  const activeProject = editor.project.getActive();
  const snappingEnabled = useTimelineStore((state) => state.snappingEnabled);
  const { findSnapPoints, snapToNearestPoint } = useTimelineSnapping();

  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [currentTrimStart, setCurrentTrimStart] = useState(element.trimStart);
  const [currentStartTime, setCurrentStartTime] = useState(element.startTime);
  const [currentDuration, setCurrentDuration] = useState(element.duration);
  const currentTrimStartRef = useRef(element.trimStart);
  const currentStartTimeRef = useRef(element.startTime);
  const currentDurationRef = useRef(element.duration);
  /**
   * 源素材总时长 —— 拖拽**开始时**问一次真源（media asset），整段拖拽共用。
   *
   * 【TD-22-21】这个值原先"悄悄藏在 `element.trimEnd` 里"，靠 `trimStart + duration×rate + trimEnd`
   * 反推；副本一旦漂移（`split-elements` 就漂过），右侧边界就算错。现在直取 media 的 duration。
   */
  const sourceDurationRef = useRef(0);

  const handleResizeStart = ({
    e,
    elementId,
    side,
  }: {
    e: React.MouseEvent;
    elementId: string;
    side: 'left' | 'right';
  }) => {
    e.stopPropagation();
    e.preventDefault();

    const rate = getElementPlaybackRate({ element });

    // 拖拽起点问一次「源素材有多长」（真源 = media asset）：整段拖拽的边界都基于它。
    sourceDurationRef.current = getElementSourceDuration({
      element,
      mediaAssets: editor.media.getAssets(),
    });

    setResizing({
      elementId,
      side,
      startX: e.clientX,
      initialTrimStart: element.trimStart,
      initialStartTime: element.startTime,
      initialDuration: element.duration,
      initialPlaybackRate: rate,
    });

    setCurrentTrimStart(element.trimStart);
    setCurrentStartTime(element.startTime);
    setCurrentDuration(element.duration);
    currentTrimStartRef.current = element.trimStart;
    currentStartTimeRef.current = element.startTime;
    currentDurationRef.current = element.duration;
    onResizeStateChange?.({ isResizing: true });
  };

  const canExtendElementDuration = useCallback(() => {
    if (element.type === 'text' || element.type === 'image') {
      return true;
    }

    return false;
  }, [element.type]);

  const updateTrimFromMouseMove = useCallback(
    ({ clientX }: { clientX: number }) => {
      if (!resizing) return;

      const deltaX = clientX - resizing.startX;
      let deltaTime = deltaX / (50 * zoomLevel);
      let resizeSnapPoint: SnapPoint | null = null;

      const projectFps = activeProject.settings.fps;
      const minDurationSeconds = 1 / projectFps;
      const canSnap = snappingEnabled;
      if (canSnap) {
        const tracks = editor.timeline.getTracks();
        const playheadTime = editor.playback.getCurrentTime();
        const snapPoints = findSnapPoints({
          tracks,
          playheadTime,
          excludeElementId: element.id,
        });
        if (resizing.side === 'left') {
          const targetStartTime = resizing.initialStartTime + deltaTime;
          const snapResult = snapToNearestPoint({
            targetTime: targetStartTime,
            snapPoints,
            zoomLevel,
          });
          resizeSnapPoint = snapResult.snapPoint;
          if (snapResult.snapPoint) {
            deltaTime = snapResult.snappedTime - resizing.initialStartTime;
          }
        } else {
          const baseEndTime = resizing.initialStartTime + resizing.initialDuration;
          const targetEndTime = baseEndTime + deltaTime;
          const snapResult = snapToNearestPoint({
            targetTime: targetEndTime,
            snapPoints,
            zoomLevel,
          });
          resizeSnapPoint = snapResult.snapPoint;
          if (snapResult.snapPoint) {
            deltaTime = snapResult.snappedTime - baseEndTime;
          }
        }
      }
      onSnapPointChange?.(resizeSnapPoint);

      // 【TD-22-21】`trimEnd` 字段已删：它 = **源素材右侧剩余**，此处由真源派生（不再持久化、不会漂移）：
      //   initialTrimEnd = 素材总长 − trimStart − duration × rate
      const initialTrimEnd = Math.max(
        0,
        sourceDurationRef.current -
          resizing.initialTrimStart -
          resizing.initialDuration * resizing.initialPlaybackRate,
      );

      if (resizing.side === 'left') {
        const rate = resizing.initialPlaybackRate;
        const sourceDuration = sourceDurationRef.current;
        const maxAllowed = sourceDuration - initialTrimEnd - minDurationSeconds * rate;
        const calculated = resizing.initialTrimStart + deltaTime * rate;

        if (calculated >= 0 && calculated <= maxAllowed) {
          const newTrimStart = snapTimeToFrame({
            time: Math.min(maxAllowed, calculated),
            fps: projectFps,
          });
          const sourceTrimDelta = newTrimStart - resizing.initialTrimStart;
          const timelineDelta = sourceTrimDelta / rate;
          const newStartTime = snapTimeToFrame({
            time: resizing.initialStartTime + timelineDelta,
            fps: projectFps,
          });
          const newDuration = snapTimeToFrame({
            time: resizing.initialDuration - timelineDelta,
            fps: projectFps,
          });

          setCurrentTrimStart(newTrimStart);
          setCurrentStartTime(newStartTime);
          setCurrentDuration(newDuration);
          currentTrimStartRef.current = newTrimStart;
          currentStartTimeRef.current = newStartTime;
          currentDurationRef.current = newDuration;
        } else if (calculated < 0) {
          if (canExtendElementDuration()) {
            const extensionAmount = Math.abs(calculated) / rate;
            const maxExtension = resizing.initialStartTime;
            const actualExtension = Math.min(extensionAmount, maxExtension);
            const newStartTime = snapTimeToFrame({
              time: resizing.initialStartTime - actualExtension,
              fps: projectFps,
            });
            const newDuration = snapTimeToFrame({
              time: resizing.initialDuration + actualExtension,
              fps: projectFps,
            });

            setCurrentTrimStart(0);
            setCurrentStartTime(newStartTime);
            setCurrentDuration(newDuration);
            currentTrimStartRef.current = 0;
            currentStartTimeRef.current = newStartTime;
            currentDurationRef.current = newDuration;
          } else {
            const sourceTrimDelta = 0 - resizing.initialTrimStart;
            const timelineDelta = sourceTrimDelta / rate;
            const newStartTime = snapTimeToFrame({
              time: resizing.initialStartTime + timelineDelta,
              fps: projectFps,
            });
            const newDuration = snapTimeToFrame({
              time: resizing.initialDuration - timelineDelta,
              fps: projectFps,
            });

            setCurrentTrimStart(0);
            setCurrentStartTime(newStartTime);
            setCurrentDuration(newDuration);
            currentTrimStartRef.current = 0;
            currentStartTimeRef.current = newStartTime;
            currentDurationRef.current = newDuration;
          }
        }
      } else {
        const rate = resizing.initialPlaybackRate;
        const sourceDuration = sourceDurationRef.current;
        // `newTrimEnd` 现在只是**临时推演量**（不再持久化）：减小 = 取更多源素材（变长），
        // 增大 = 裁掉（变短）。片段长度最终由 duration 单独表达。
        const newTrimEnd = initialTrimEnd - deltaTime * rate;

        if (newTrimEnd < 0) {
          // 想延长到超出源素材：文本/图片没有"源长度"概念 → 允许；视频/音频 → 停在素材末尾。
          const baseDuration = resizing.initialDuration + initialTrimEnd / rate;
          const newDuration = snapTimeToFrame({
            time: canExtendElementDuration()
              ? baseDuration + Math.abs(newTrimEnd) / rate
              : baseDuration,
            fps: projectFps,
          });

          setCurrentDuration(newDuration);
          currentDurationRef.current = newDuration;
        } else {
          const maxTrimEnd = sourceDuration - resizing.initialTrimStart - minDurationSeconds * rate;
          const trimmedEnd = snapTimeToFrame({
            time: Math.min(maxTrimEnd, newTrimEnd),
            fps: projectFps,
          });
          const newDuration = snapTimeToFrame({
            time: resizing.initialDuration - (trimmedEnd - initialTrimEnd) / rate,
            fps: projectFps,
          });

          setCurrentDuration(newDuration);
          currentDurationRef.current = newDuration;
        }
      }
    },
    [
      resizing,
      zoomLevel,
      activeProject.settings.fps,
      snappingEnabled,
      editor,
      findSnapPoints,
      snapToNearestPoint,
      element.id,
      onSnapPointChange,
      canExtendElementDuration,
    ],
  );

  const handleResizeEnd = useCallback(() => {
    if (!resizing) return;

    const finalTrimStart = currentTrimStartRef.current;
    const finalStartTime = currentStartTimeRef.current;
    const finalDuration = currentDurationRef.current;
    const trimStartChanged = finalTrimStart !== resizing.initialTrimStart;
    const startTimeChanged = finalStartTime !== resizing.initialStartTime;
    const durationChanged = finalDuration !== resizing.initialDuration;

    // 【TD-22-21】片段形态由「trimStart + duration」唯一确定，不再提交 trimEnd。
    // 顺带修掉一个**真功能缺陷**：原实现只提交 `trimStart` / `trimEnd` 而**从不提交 `duration`**，
    // 于是「拖右边缘改时长」在松手后不会落库（UI 预览弹回）—— 因为 `duration` 才是长度的真源。
    if (trimStartChanged || durationChanged) {
      editor.timeline.updateElementTrim({
        elementId: element.id,
        trimStart: finalTrimStart,
        duration: finalDuration,
      });
    }

    if (startTimeChanged) {
      editor.timeline.updateElementStartTime({
        elements: [{ trackId: track.id, elementId: element.id }],
        startTime: finalStartTime,
      });
    }

    if (durationChanged) {
      editor.timeline.updateElementDuration({
        trackId: track.id,
        elementId: element.id,
        duration: finalDuration,
      });
    }

    setResizing(null);
    onResizeStateChange?.({ isResizing: false });
    onSnapPointChange?.(null);
  }, [resizing, editor.timeline, element.id, track.id, onResizeStateChange, onSnapPointChange]);

  useEffect(() => {
    if (!resizing) return;

    const handleDocumentMouseMove = ({ clientX }: MouseEvent) => {
      updateTrimFromMouseMove({ clientX });
    };

    const handleDocumentMouseUp = () => {
      handleResizeEnd();
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [resizing, handleResizeEnd, updateTrimFromMouseMove]);

  return {
    resizing,
    isResizing: resizing !== null,
    handleResizeStart,
    currentTrimStart,
    currentStartTime,
    currentDuration,
  };
}
