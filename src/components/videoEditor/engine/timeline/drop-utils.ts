import type { TimelineTrack, ElementType } from '@/components/videoEditor/types/timeline';
import { clamp } from '@/components/base/core/utils';
import { TRACK_GAP } from '@/components/videoEditor/constants/timeline-constants';
import { wouldElementOverlap } from './element-utils';
import type { ComputeDropTargetParams, DropTarget } from '@/components/videoEditor/types/timeline';
import {
  isMainTrack,
  enforceMainTrackStart,
  getTrackHeight,
  // 【TD-22-70】元素↔轨道兼容的**唯一实现**。本文件原有一份逐字同实现的私有 `isCompatible`，已删。
  canElementGoOnTrack,
} from './track-utils';

function getTrackAtY({
  mouseY,
  tracks,
  verticalDragDirection,
  scale,
}: {
  mouseY: number;
  tracks: TimelineTrack[];
  verticalDragDirection?: 'up' | 'down' | null;
  scale?: number;
}): { trackIndex: number; relativeY: number } | null {
  let cumulativeHeight = 0;

  for (let i = 0; i < tracks.length; i++) {
    // 走 getTrackHeight（唯一高度入口）——不得直连 TRACK_HEIGHTS，
    // 否则轨道高度可调后"命中区按基准、显示按倍率"会错位。
    const trackHeight = getTrackHeight({ type: tracks[i].type, scale });
    const trackTop = cumulativeHeight;
    const trackBottom = trackTop + trackHeight;

    if (mouseY >= trackTop && mouseY < trackBottom) {
      return {
        trackIndex: i,
        relativeY: mouseY - trackTop,
      };
    }

    if (i < tracks.length - 1 && verticalDragDirection) {
      const gapTop = trackBottom;
      const gapBottom = gapTop + TRACK_GAP;
      if (mouseY >= gapTop && mouseY < gapBottom) {
        const isDraggingUp = verticalDragDirection === 'up';
        return {
          trackIndex: isDraggingUp ? i : i + 1,
          relativeY: isDraggingUp ? trackHeight - 1 : 0,
        };
      }
    }

    cumulativeHeight += trackHeight + TRACK_GAP;
  }

  return null;
}

function getMainTrackIndex({ tracks }: { tracks: TimelineTrack[] }): number {
  return tracks.findIndex((track) => isMainTrack(track));
}

function findBestCompatibleTrack({
  elementType,
  tracks,
  xPosition,
  elementDuration,
  excludeElementId,
}: {
  elementType: ElementType;
  tracks: TimelineTrack[];
  xPosition: number;
  elementDuration: number;
  excludeElementId?: string;
}): number | null {
  const endTime = xPosition + elementDuration;

  // video/image → prefer main track first
  if (elementType === 'video' || elementType === 'image') {
    const mainIdx = getMainTrackIndex({ tracks });
    if (mainIdx >= 0) {
      const hasOverlap = wouldElementOverlap({
        elements: tracks[mainIdx].elements,
        startTime: xPosition,
        endTime,
        excludeElementId,
      });
      if (!hasOverlap) return mainIdx;
    }
  }

  for (let i = 0; i < tracks.length; i++) {
    if (!canElementGoOnTrack({ elementType, trackType: tracks[i].type })) continue;
    const hasOverlap = wouldElementOverlap({
      elements: tracks[i].elements,
      startTime: xPosition,
      endTime,
      excludeElementId,
    });
    if (!hasOverlap) return i;
  }

  return null;
}

function findInsertIndex({
  elementType,
  tracks,
  preferredIndex,
  insertAbove,
}: {
  elementType: ElementType;
  tracks: TimelineTrack[];
  preferredIndex: number;
  insertAbove: boolean;
}): { index: number; position: 'above' | 'below' } {
  const mainTrackIndex = getMainTrackIndex({ tracks });

  if (elementType === 'audio') {
    if (preferredIndex <= mainTrackIndex) {
      return { index: mainTrackIndex + 1, position: 'below' };
    }
    return {
      index: insertAbove ? preferredIndex : preferredIndex + 1,
      position: insertAbove ? 'above' : 'below',
    };
  }

  const overlayInsertIndex = insertAbove ? preferredIndex : preferredIndex + 1;

  if (mainTrackIndex >= 0 && overlayInsertIndex > mainTrackIndex) {
    return { index: mainTrackIndex, position: 'above' };
  }

  return {
    index: overlayInsertIndex,
    position: insertAbove ? 'above' : 'below',
  };
}

export function computeDropTarget({
  elementType,
  mouseX,
  mouseY,
  tracks,
  playheadTime,
  isExternalDrop,
  elementDuration,
  pixelsPerSecond,
  zoomLevel,
  trackHeightScale,
  verticalDragDirection,
  startTimeOverride,
  excludeElementId,
}: ComputeDropTargetParams): DropTarget {
  const xPosition =
    typeof startTimeOverride === 'number'
      ? startTimeOverride
      : isExternalDrop
        ? playheadTime
        : Math.max(0, mouseX / (pixelsPerSecond * zoomLevel));

  const mainTrackIndex = getMainTrackIndex({ tracks });

  if (tracks.length === 0) {
    if (elementType === 'audio') {
      return {
        trackIndex: 0,
        isNewTrack: true,
        insertPosition: 'below',
        xPosition,
      };
    }
    return { trackIndex: 0, isNewTrack: true, insertPosition: null, xPosition };
  }

  const trackAtMouse = getTrackAtY({
    mouseY,
    tracks,
    verticalDragDirection,
    scale: trackHeightScale,
  });

  if (!trackAtMouse) {
    const compatibleIndex = findBestCompatibleTrack({
      elementType,
      tracks,
      xPosition,
      elementDuration,
      excludeElementId,
    });

    if (compatibleIndex !== null) {
      const targetTrack = tracks[compatibleIndex];
      const adjustedXPosition = enforceMainTrackStart({
        tracks,
        targetTrackId: targetTrack.id,
        requestedStartTime: xPosition,
        excludeElementId,
      });

      return {
        trackIndex: compatibleIndex,
        isNewTrack: false,
        insertPosition: null,
        xPosition: adjustedXPosition,
      };
    }

    const isAboveAllTracks = mouseY < 0;

    if (elementType === 'audio') {
      return {
        trackIndex: tracks.length,
        isNewTrack: true,
        insertPosition: 'below',
        xPosition,
      };
    }

    if (isAboveAllTracks) {
      return {
        trackIndex: 0,
        isNewTrack: true,
        insertPosition: 'above',
        xPosition,
      };
    }

    return {
      trackIndex: Math.max(0, mainTrackIndex),
      isNewTrack: true,
      insertPosition: 'above',
      xPosition,
    };
  }

  const { trackIndex, relativeY } = trackAtMouse;
  const track = tracks[trackIndex];
  const trackHeight = getTrackHeight({ type: track.type, scale: trackHeightScale });
  const isInUpperHalf = relativeY < trackHeight / 2;

  const isTrackCompatible = canElementGoOnTrack({
    elementType,
    trackType: track.type,
  });

  const endTime = xPosition + elementDuration;
  const hasOverlap = wouldElementOverlap({
    elements: track.elements,
    startTime: xPosition,
    endTime,
    excludeElementId,
  });

  if (isTrackCompatible && !hasOverlap) {
    const targetTrack = tracks[trackIndex];
    // safe: snap to 0 only happens when element becomes the new earliest,
    // meaning the space before the current earliest is empty
    const adjustedXPosition = enforceMainTrackStart({
      tracks,
      targetTrackId: targetTrack.id,
      requestedStartTime: xPosition,
      excludeElementId,
    });

    return {
      trackIndex,
      isNewTrack: false,
      insertPosition: null,
      xPosition: adjustedXPosition,
    };
  }

  const fallbackIndex = findBestCompatibleTrack({
    elementType,
    tracks,
    xPosition,
    elementDuration,
    excludeElementId,
  });

  if (fallbackIndex !== null) {
    const fallbackTrack = tracks[fallbackIndex];
    const adjustedXPosition = enforceMainTrackStart({
      tracks,
      targetTrackId: fallbackTrack.id,
      requestedStartTime: xPosition,
      excludeElementId,
    });

    return {
      trackIndex: fallbackIndex,
      isNewTrack: false,
      insertPosition: null,
      xPosition: adjustedXPosition,
    };
  }

  let insertAbove = isInUpperHalf;
  if (!isTrackCompatible && verticalDragDirection) {
    insertAbove = verticalDragDirection === 'up';
  }

  const { index, position } = findInsertIndex({
    elementType,
    tracks,
    preferredIndex: trackIndex,
    insertAbove,
  });

  return {
    trackIndex: index,
    isNewTrack: true,
    insertPosition: position,
    xPosition,
  };
}

export function getDropLineY({
  dropTarget,
  tracks,
  scale,
}: {
  dropTarget: DropTarget;
  tracks: TimelineTrack[];
  /** 轨道高度倍率（TD-21-16）——落点线必须与渲染同口径。 */
  scale?: number;
}): number {
  const safeTrackIndex = clamp(dropTarget.trackIndex, 0, tracks.length);
  let y = 0;

  for (let i = 0; i < safeTrackIndex; i++) {
    y += getTrackHeight({ type: tracks[i].type, scale }) + TRACK_GAP;
  }

  return y;
}
