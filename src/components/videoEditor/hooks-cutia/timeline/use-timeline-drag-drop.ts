import { videoEditorLogger } from '@/components/videoEditor/lib/videoEditorLogger';
import { useState, useCallback, type RefObject } from 'react';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { processMediaAssets } from '@/components/videoEditor/engine/lib/media/processing';
import { videoEditorToast } from '@/components/videoEditor/lib/videoEditorToast';
import { TIMELINE_CONSTANTS } from '@/components/videoEditor/constants/timeline-constants';
import { snapTimeToFrame } from '@/components/videoEditor/engine/lib/time';
import {
  buildTextElement,
  buildStickerElement,
  buildUploadAudioElement,
  buildVideoElement,
  buildImageElement,
} from '@/components/videoEditor/engine/timeline/element-utils';
import { computeDropTarget } from '@/components/videoEditor/engine/timeline/drop-utils';
import { getDragData, hasDragData } from '@/components/videoEditor/engine/lib/drag-data';
import type { TrackType, DropTarget, ElementType } from '@/components/videoEditor/types/timeline';
import type { MediaDragData, StickerDragData } from '@/components/videoEditor/types/drag';

interface UseTimelineDragDropProps {
  containerRef: RefObject<HTMLDivElement | null>;
  headerRef?: RefObject<HTMLElement | null>;
  zoomLevel: number;
  /** 轨道高度倍率（TD-21-16）——外部拖入的落点判定必须与渲染同口径。缺省 = 1。 */
  trackHeightScale?: number;
}

export function useTimelineDragDrop({
  containerRef,
  headerRef,
  zoomLevel,
  trackHeightScale,
}: UseTimelineDragDropProps) {
  const editor = useEditor('playback', 'timeline', 'project', 'media');
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [dragElementType, setElementType] = useState<ElementType | null>(null);

  const tracks = editor.timeline.getTracks();
  const currentTime = editor.playback.getCurrentTime();
  const mediaAssets = editor.media.getAssets();
  const activeProject = editor.project.getActive();

  const getSnappedTime = useCallback(
    ({ time }: { time: number }) => {
      const projectFps = activeProject.settings.fps;
      return snapTimeToFrame({ time, fps: projectFps });
    },
    [activeProject.settings.fps],
  );

  const getElementType = useCallback(
    ({ dataTransfer }: { dataTransfer: DataTransfer }): ElementType | null => {
      const dragData = getDragData({ dataTransfer });
      if (!dragData) return null;

      if (dragData.type === 'text') return 'text';
      if (dragData.type === 'sticker') return 'sticker';
      if (dragData.type === 'media') {
        return dragData.mediaType;
      }
      return null;
    },
    [],
  );

  const getElementDuration = useCallback(
    ({ elementType, mediaId }: { elementType: ElementType; mediaId?: string }): number => {
      if (elementType === 'text' || elementType === 'sticker') {
        return TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
      }
      if (mediaId) {
        const media = mediaAssets.find((m) => m.id === mediaId);
        return media?.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
      }
      return TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
    },
    [mediaAssets],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const hasAsset = hasDragData({ dataTransfer: e.dataTransfer });
    const hasFiles = e.dataTransfer.types.includes('Files');
    if (!hasAsset && !hasFiles) return;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const headerHeight = headerRef?.current?.getBoundingClientRect().height ?? 0;
      const hasFiles = e.dataTransfer.types.includes('Files');
      const isExternal = hasFiles && !hasDragData({ dataTransfer: e.dataTransfer });

      const elementType = getElementType({ dataTransfer: e.dataTransfer });

      if (!elementType && hasFiles && isExternal) {
        setDropTarget(null);
        setElementType(null);
        return;
      }

      if (!elementType) return;

      setElementType(elementType);

      const dragData = getDragData({ dataTransfer: e.dataTransfer });
      const duration = getElementDuration({
        elementType,
        mediaId: dragData?.type === 'media' ? dragData.id : undefined,
      });

      const mouseX = e.clientX - rect.left;
      const mouseY = Math.max(0, e.clientY - rect.top - headerHeight);

      const target = computeDropTarget({
        elementType,
        mouseX,
        mouseY,
        tracks,
        playheadTime: currentTime,
        isExternalDrop: isExternal,
        elementDuration: duration,
        pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
        zoomLevel,
        trackHeightScale,
      });

      target.xPosition = getSnappedTime({ time: target.xPosition });

      setDropTarget(target);
      e.dataTransfer.dropEffect = 'copy';
    },
    [
      containerRef,
      headerRef,
      tracks,
      currentTime,
      zoomLevel,
      getElementType,
      getElementDuration,
      getSnappedTime,
      // 【2026-09-17 补】trackHeightScale 参与落点轨道的垂直命中计算，漏列会让 DragOver 用旧缩放。
      trackHeightScale,
    ],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const { clientX, clientY } = e;
        if (
          clientX < rect.left ||
          clientX > rect.right ||
          clientY < rect.top ||
          clientY > rect.bottom
        ) {
          setIsDragOver(false);
          setDropTarget(null);
          setElementType(null);
        }
      }
    },
    [containerRef],
  );

  const executeTextDrop = useCallback(
    ({
      target,
      dragData,
    }: {
      target: DropTarget;
      dragData: { name?: string; content?: string };
    }) => {
      let trackId: string;

      if (target.isNewTrack) {
        trackId = editor.timeline.addTrack({
          type: 'text',
          index: target.trackIndex,
        });
      } else {
        const track = tracks[target.trackIndex];
        if (!track) return;
        trackId = track.id;
      }

      const element = buildTextElement({
        raw: {
          name: dragData.name ?? '',
          content: dragData.content ?? '',
        },
        startTime: target.xPosition,
      });

      editor.timeline.insertElement({
        placement: { mode: 'explicit', trackId },
        element,
      });
    },
    [editor.timeline, tracks],
  );

  const executeStickerDrop = useCallback(
    ({ target, dragData }: { target: DropTarget; dragData: StickerDragData }) => {
      let trackId: string;

      if (target.isNewTrack) {
        trackId = editor.timeline.addTrack({
          type: 'sticker',
          index: target.trackIndex,
        });
      } else {
        const track = tracks[target.trackIndex];
        if (!track) return;
        trackId = track.id;
      }

      const element = buildStickerElement({
        iconName: dragData.iconName,
        startTime: target.xPosition,
      });

      editor.timeline.insertElement({
        placement: { mode: 'explicit', trackId },
        element,
      });
    },
    [editor.timeline, tracks],
  );

  const executeMediaDrop = useCallback(
    ({ target, dragData }: { target: DropTarget; dragData: MediaDragData }) => {
      const mediaAsset = mediaAssets.find((m) => m.id === dragData.id);
      if (!mediaAsset) return;

      const trackType: TrackType = dragData.mediaType === 'audio' ? 'audio' : 'video';
      let trackId: string;

      if (target.isNewTrack) {
        trackId = editor.timeline.addTrack({
          type: trackType,
          index: target.trackIndex,
        });
      } else {
        const track = tracks[target.trackIndex];
        if (!track) return;
        trackId = track.id;
      }

      const duration = mediaAsset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;

      if (dragData.mediaType === 'audio') {
        editor.timeline.insertElement({
          placement: { mode: 'explicit', trackId },
          element: buildUploadAudioElement({
            mediaId: mediaAsset.id,
            name: mediaAsset.name,
            duration,
            startTime: target.xPosition,
          }),
        });
      } else if (dragData.mediaType === 'video') {
        editor.timeline.insertElement({
          placement: { mode: 'explicit', trackId },
          element: buildVideoElement({
            mediaId: mediaAsset.id,
            name: mediaAsset.name,
            duration,
            startTime: target.xPosition,
            hasAudio: mediaAsset.hasAudio, // TD-21-17：🔊 角标数据源
          }),
        });
      } else {
        editor.timeline.insertElement({
          placement: { mode: 'explicit', trackId },
          element: buildImageElement({
            mediaId: mediaAsset.id,
            name: mediaAsset.name,
            duration,
            startTime: target.xPosition,
          }),
        });
      }
    },
    [editor.timeline, mediaAssets, tracks],
  );

  const executeFileDrop = useCallback(
    async ({ files, mouseX, mouseY }: { files: File[]; mouseX: number; mouseY: number }) => {
      if (!activeProject) return;

      const processedAssets = await processMediaAssets({ files });

      for (const asset of processedAssets) {
        const result = await editor.media.addMediaAsset({
          projectId: activeProject.metadata.id,
          asset,
        });

        // ── 修复(2026-09-15 · TD-22-37)：判别联合直接判成败。
        // 原为「addMediaAsset 返回 id（失败也返）→ `getAssets().find(name+url)` 二次探测」，
        // 且探测不中时**静默跳过**（用户拖进来了却什么都没发生，零提示）。
        // 现在：成败由结果给出（失败时 MediaManager 已回滚 + 已 toast），此处只跳过插入。
        if (!result.ok) continue;

        const mediaAsset = result.asset;
        const duration = mediaAsset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
        const currentTracks = editor.timeline.getTracks();
        const dropTarget = computeDropTarget({
          elementType: mediaAsset.type,
          mouseX,
          mouseY,
          tracks: currentTracks,
          playheadTime: currentTime,
          isExternalDrop: true,
          elementDuration: duration,
          pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
          zoomLevel,
          trackHeightScale,
        });

        const trackType: TrackType = mediaAsset.type === 'audio' ? 'audio' : 'video';
        const trackId = dropTarget.isNewTrack
          ? editor.timeline.addTrack({
              type: trackType,
              index: dropTarget.trackIndex,
            })
          : currentTracks[dropTarget.trackIndex]?.id;

        if (!trackId) return;

        if (mediaAsset.type === 'audio') {
          editor.timeline.insertElement({
            placement: { mode: 'explicit', trackId },
            element: buildUploadAudioElement({
              mediaId: mediaAsset.id,
              name: mediaAsset.name,
              duration,
              startTime: dropTarget.xPosition,
              buffer: new AudioBuffer({ length: 1, sampleRate: 44100 }),
            }),
          });
        } else if (mediaAsset.type === 'video') {
          editor.timeline.insertElement({
            placement: { mode: 'explicit', trackId },
            element: buildVideoElement({
              mediaId: mediaAsset.id,
              name: mediaAsset.name,
              duration,
              startTime: dropTarget.xPosition,
              hasAudio: mediaAsset.hasAudio, // TD-21-17：🔊 角标数据源
            }),
          });
        } else {
          editor.timeline.insertElement({
            placement: { mode: 'explicit', trackId },
            element: buildImageElement({
              mediaId: mediaAsset.id,
              name: mediaAsset.name,
              duration,
              startTime: dropTarget.xPosition,
            }),
          });
        }
      }
    },
    // 【2026-09-17 补】落点计算依赖 trackHeightScale；且 editor.media/editor.timeline 已入 deps，
    // 本处补齐后与 handleDragOver 同口径。
    [activeProject, editor.media, editor.timeline, currentTime, zoomLevel, trackHeightScale],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();

      const hasAsset = hasDragData({ dataTransfer: e.dataTransfer });
      const hasFiles = e.dataTransfer.files?.length > 0;

      if (!hasAsset && !hasFiles) return;

      const currentTarget = dropTarget;
      setIsDragOver(false);
      setDropTarget(null);
      setElementType(null);

      try {
        if (hasAsset) {
          if (!currentTarget) return;
          const dragData = getDragData({ dataTransfer: e.dataTransfer });
          if (!dragData) return;

          if (dragData.type === 'text') {
            executeTextDrop({ target: currentTarget, dragData });
          } else if (dragData.type === 'sticker') {
            executeStickerDrop({ target: currentTarget, dragData });
          } else {
            executeMediaDrop({ target: currentTarget, dragData });
          }
        } else if (hasFiles) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const mouseX = e.clientX - rect.left;
          const headerHeight = headerRef?.current?.getBoundingClientRect().height ?? 0;
          const mouseY = Math.max(0, e.clientY - rect.top - headerHeight);
          await executeFileDrop({
            files: Array.from(e.dataTransfer.files),
            mouseX,
            mouseY,
          });
        }
      } catch (err) {
        videoEditorLogger.error('Failed to process drop:', err);
        videoEditorToast.error('Failed to process drop');
      }
    },
    [
      dropTarget,
      executeTextDrop,
      executeStickerDrop,
      executeMediaDrop,
      executeFileDrop,
      containerRef,
      headerRef,
    ],
  );

  return {
    isDragOver,
    dropTarget,
    dragElementType,
    dragProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
