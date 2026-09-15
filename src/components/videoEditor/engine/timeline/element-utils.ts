import { DEFAULT_TEXT_ELEMENT } from '@videoEditor/constants/text-constants';
import { TIMELINE_CONSTANTS } from '@videoEditor/constants/timeline-constants';
import type { MediaAsset } from '@videoEditor/types/assets';
import type {
  CreateTextElement,
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

/**
 * 元素的**播放倍率**（`playbackRate` 的唯一读取口）。
 *
 * 【为什么收口（TD-22-14 的今天形态）】这个三行判据原先在 4 处各自手写：
 * `use-element-resize`（拖拽边界）· `split-elements`（切开换算）· 本文件的
 * `getElementSourceDuration` · `lib/media/audio.ts`（混音取源）。
 * 它们**必须**给出同一个数 —— 否则"画面按一个倍率、声音按另一个"即静默失步。
 * 判据本身只有一种合法写法（缺省 / 非数字 → 1），故是可收口的**探测重复**（7 步法 Step 3）。
 *
 * 【刻意不做的事】不把"非法值"夹进 `MIN/MAX_PLAYBACK_RATE`：取值域校验属**UI 写入侧**
 * （`engine/timeline/speed-utils.ts` 的 `clampPlaybackRate`），读取侧若也夹，
 * 就会把"存档里的越界值"悄悄改成别的倍率 —— 渲染与混音应当**如实按存档值播**。
 */
export function getElementPlaybackRate({ element }: { element: TimelineElement }): number {
  if ('playbackRate' in element && typeof element.playbackRate === 'number') {
    return element.playbackRate;
  }
  return 1;
}

/**
 * 元素的**源素材总时长** —— 拖拽边界的唯一依据。
 *
 * 【为什么要有它（TD-22-21）】删掉 `element.trimEnd` 之后，拖拽把手需要知道的"素材有多长"
 * 改为**直接问真源**：media asset 的 `duration`（上传时读视频/音频元数据得到，见
 * `lib/media/processing.ts`）。原实现是用冗余字段反推（`trimStart + duration × rate + trimEnd`）
 * —— 副本一旦漂移（`split-elements` 就漂过），右侧拖拽的边界随即算错。
 *
 * 【素材缺失时】退回"当前已用长度"（即**不允许再裁出源范围**）：断链片段本就播不了，
 * 保守边界比错误边界安全（不新增损失）。
 */
export function getElementSourceDuration({
  element,
  mediaAssets,
}: {
  element: TimelineElement;
  mediaAssets: MediaAsset[];
}): number {
  const rate = getElementPlaybackRate({ element });
  const usedSourceLength = element.trimStart + element.duration * rate;

  const mediaId = 'mediaId' in element ? element.mediaId : undefined;
  if (!mediaId) return usedSourceLength; // 文本 / 贴纸：无源素材概念

  const asset = mediaAssets.find((item) => item.id === mediaId);
  return asset?.duration ?? usedSourceLength;
}

/**
 * 文本元素构造函数（**唯一**路径；`DEFAULT_TEXT_ELEMENT` 单源的消费方）。
 *
 * 【返回类型 = `CreateTextElement`，不是 `CreateTimelineElement`（2026-09-15 收窄）】
 * 本函数**恒定**产出 `type:'text'`，此前声明为 `CreateTimelineElement`（5 支联合）属**过宽**：
 * 消费方（`createSubtitleFromTemplate` 及其调用方 captions.tsx / 测试）拿到联合类型后，
 * 访问 `.content` / `.fontSize` 等文本字段全部报「不存在于 CreateUploadAudioElement」——
 * 把本该由**产出者**保证的形态，变成消费方的类型噪音。
 */
export function buildTextElement({
  raw,
  startTime,
}: {
  raw: Partial<Omit<TextElement, 'type' | 'id'>>;
  startTime: number;
}): CreateTextElement {
  const t = raw as Partial<TextElement>;

  return {
    type: 'text',
    name: t.name ?? DEFAULT_TEXT_ELEMENT.name,
    content: t.content ?? DEFAULT_TEXT_ELEMENT.content,
    duration: t.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
    startTime,
    trimStart: 0,
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
}: {
  mediaId: string;
  name: string;
  duration: number;
  startTime: number;
  trimStart?: number;
}): CreateVideoElement {
  return {
    type: 'video',
    mediaId,
    name,
    duration,
    startTime,
    trimStart,
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
