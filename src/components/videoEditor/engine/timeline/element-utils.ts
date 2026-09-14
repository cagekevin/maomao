import { DEFAULT_TEXT_ELEMENT } from '@videoEditor/constants/text-constants';
import { TIMELINE_CONSTANTS } from '@videoEditor/constants/timeline-constants';
import type {
  CreateTimelineElement,
  CreateVideoElement,
  CreateImageElement,
  CreateStickerElement,
  CreateUploadAudioElement,
  CreateLibraryAudioElement,
  TextElement,
  TimelineElement,
  TimelineTrack,
  AudioElement,
  VideoElement,
  ImageElement,
  StickerElement,
  UploadAudioElement,
} from '@videoEditor/types/timeline';

export function canElementHaveAudio(
  element: TimelineElement,
): element is AudioElement | VideoElement {
  return element.type === 'audio' || element.type === 'video';
}

export function canElementBeHidden(
  element: TimelineElement,
): element is VideoElement | ImageElement | TextElement | StickerElement {
  return element.type !== 'audio';
}

export function hasMediaId(
  element: TimelineElement,
): element is UploadAudioElement | VideoElement | ImageElement {
  return 'mediaId' in element;
}

export function requiresMediaId({ element }: { element: CreateTimelineElement }): boolean {
  return (
    element.type === 'video' ||
    element.type === 'image' ||
    (element.type === 'audio' && element.sourceType === 'upload')
  );
}

/**
 * 按素材 id 收集它在时间轴上**全部**元素（跨轨）。
 *
 * 【为什么收口】「按 mediaId 找时间轴元素」这段判据此前被抄成 2 份
 * （`managers/media-manager.removeMediaAsset` 与 `commands/media/remove-media-asset`），
 * 且每份都要自己写「遍历 tracks → 遍历 elements → hasMediaId 判定 → 收集」这一套。
 * 现在「素材减号（从时间轴移除该素材的全部片段）」是第 3 个消费者 —— 故收口在此唯一实现。
 *
 * 【唯一实现的好处】`hasMediaId` 的收窄、跨轨遍历、返回形状都由这一处决定；
 * 消费方只拿到 `{ trackId, elementId }[]`（`timeline.deleteElements` 的入参形状）。
 *
 * @param tracks 时间轴轨道
 * @param mediaId 素材 id
 * @returns 该素材在时间轴上的全部元素定位（无 → 空数组）
 */
export function collectElementsByMediaId({
  tracks,
  mediaId,
}: {
  tracks: TimelineTrack[];
  mediaId: string;
}): Array<{ trackId: string; elementId: string }> {
  const found: Array<{ trackId: string; elementId: string }> = [];
  for (const track of tracks) {
    for (const element of track.elements) {
      if (hasMediaId(element) && element.mediaId === mediaId) {
        found.push({ trackId: track.id, elementId: element.id });
      }
    }
  }
  return found;
}

export function wouldElementOverlap({
  elements,
  startTime,
  endTime,
  excludeElementId,
}: {
  elements: TimelineElement[];
  startTime: number;
  endTime: number;
  excludeElementId?: string;
}): boolean {
  return elements.some((el) => {
    if (excludeElementId && el.id === excludeElementId) return false;
    const elEnd = el.startTime + el.duration;
    return startTime < elEnd && endTime > el.startTime;
  });
}

export function findAvailableVideoTrackAbove({
  tracks,
  sourceTrackId,
  startTime,
  endTime,
}: {
  tracks: TimelineTrack[];
  sourceTrackId: string;
  startTime: number;
  endTime: number;
}): string | null {
  const sourceIndex = tracks.findIndex((track) => track.id === sourceTrackId);

  for (let index = sourceIndex - 1; index >= 0; index--) {
    const track = tracks[index];
    if (
      track.type === 'video' &&
      !track.isMain &&
      !track.hidden &&
      !wouldElementOverlap({ elements: track.elements, startTime, endTime })
    ) {
      return track.id;
    }
  }

  return null;
}

export function getVisualSourceTime({
  timelineTime,
  startTime,
  duration,
  trimStart,
  playbackRate = 1,
  reversed = false,
}: {
  timelineTime: number;
  startTime: number;
  duration: number;
  trimStart: number;
  playbackRate?: number;
  reversed?: boolean;
}): number {
  const elapsed = timelineTime - startTime;
  if (!reversed) return trimStart + elapsed * playbackRate;

  const sourceTime = trimStart + playbackRate * (duration - elapsed);
  return elapsed === 0 ? Math.max(trimStart, sourceTime - 1e-6) : sourceTime;
}

export function buildTextElement({
  raw,
  startTime,
}: {
  raw: Partial<Omit<TextElement, 'type' | 'id'>>;
  startTime: number;
}): CreateTimelineElement {
  const t = raw as Partial<TextElement>;

  return {
    type: 'text',
    name: t.name ?? DEFAULT_TEXT_ELEMENT.name,
    content: t.content ?? DEFAULT_TEXT_ELEMENT.content,
    duration: t.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
    startTime,
    trimStart: 0,
    trimEnd: 0,
    fontSize: typeof t.fontSize === 'number' ? t.fontSize : DEFAULT_TEXT_ELEMENT.fontSize,
    fontFamily: t.fontFamily ?? DEFAULT_TEXT_ELEMENT.fontFamily,
    color: t.color ?? DEFAULT_TEXT_ELEMENT.color,
    backgroundColor: t.backgroundColor ?? DEFAULT_TEXT_ELEMENT.backgroundColor,
    textAlign: t.textAlign ?? DEFAULT_TEXT_ELEMENT.textAlign,
    fontWeight: t.fontWeight ?? DEFAULT_TEXT_ELEMENT.fontWeight,
    fontStyle: t.fontStyle ?? DEFAULT_TEXT_ELEMENT.fontStyle,
    textDecoration: t.textDecoration ?? DEFAULT_TEXT_ELEMENT.textDecoration,
    transform: t.transform ?? DEFAULT_TEXT_ELEMENT.transform,
    opacity: t.opacity ?? DEFAULT_TEXT_ELEMENT.opacity,
    stroke: t.stroke,
    shadow: t.shadow,
  };
}

export function buildStickerElement({
  iconName,
  startTime,
}: {
  iconName: string;
  startTime: number;
}): CreateStickerElement {
  return {
    type: 'sticker',
    name: iconName.split(':')[1] || iconName,
    iconName,
    duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
    startTime,
    trimStart: 0,
    trimEnd: 0,
    transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
    opacity: 1,
  };
}

export function buildVideoElement({
  mediaId,
  name,
  duration,
  startTime,
  trimStart = 0,
  trimEnd = 0,
}: {
  mediaId: string;
  name: string;
  duration: number;
  startTime: number;
  trimStart?: number;
  trimEnd?: number;
}): CreateVideoElement {
  return {
    type: 'video',
    mediaId,
    name,
    duration,
    startTime,
    trimStart,
    trimEnd,
    muted: false,
    hidden: false,
    transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
    opacity: 1,
  };
}

export function buildImageElement({
  mediaId,
  name,
  duration,
  startTime,
}: {
  mediaId: string;
  name: string;
  duration: number;
  startTime: number;
}): CreateImageElement {
  return {
    type: 'image',
    mediaId,
    name,
    duration,
    startTime,
    trimStart: 0,
    trimEnd: 0,
    hidden: false,
    transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
    opacity: 1,
  };
}

export function buildUploadAudioElement({
  mediaId,
  name,
  duration,
  startTime,
  buffer,
}: {
  mediaId: string;
  name: string;
  duration: number;
  startTime: number;
  buffer?: AudioBuffer;
}): CreateUploadAudioElement {
  const element: CreateUploadAudioElement = {
    type: 'audio',
    sourceType: 'upload',
    mediaId,
    name,
    duration,
    startTime,
    trimStart: 0,
    trimEnd: 0,
    volume: 1,
    muted: false,
  };
  if (buffer) {
    element.buffer = buffer;
  }
  return element;
}

export function buildLibraryAudioElement({
  sourceUrl,
  name,
  duration,
  startTime,
  buffer,
}: {
  sourceUrl: string;
  name: string;
  duration: number;
  startTime: number;
  buffer?: AudioBuffer;
}): CreateLibraryAudioElement {
  const element: CreateLibraryAudioElement = {
    type: 'audio',
    sourceType: 'library',
    sourceUrl,
    name,
    duration,
    startTime,
    trimStart: 0,
    trimEnd: 0,
    volume: 1,
    muted: false,
  };
  if (buffer) {
    element.buffer = buffer;
  }
  return element;
}

export function getElementsAtTime({
  tracks,
  time,
}: {
  tracks: TimelineTrack[];
  time: number;
}): { trackId: string; elementId: string }[] {
  const result: { trackId: string; elementId: string }[] = [];

  for (const track of tracks) {
    for (const element of track.elements) {
      const elementStart = element.startTime;
      const elementEnd = element.startTime + element.duration;

      if (time > elementStart && time < elementEnd) {
        result.push({ trackId: track.id, elementId: element.id });
      }
    }
  }

  return result;
}
