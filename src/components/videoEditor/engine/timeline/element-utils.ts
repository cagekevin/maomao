import { DEFAULT_TEXT_ELEMENT } from '@/components/videoEditor/constants/text-constants';
// 轨级可见性判据（唯一实现）—— 编辑期按索引遍历时用谓词，输出路径用 `getOutputTracks` 投影。
import { isTrackHidden } from './track-utils';
import { TIMELINE_CONSTANTS } from '@/components/videoEditor/constants/timeline-constants';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';
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
} from '@/components/videoEditor/types/timeline';

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

/**
 * **元素在时间轴上占据的区间（唯一算式）**：`[startTime, startTime + duration)`。
 *
 * 【口径】`duration` 是**时间轴上的可见时长**（`trimStart` 是源素材入点、`playbackRate` 只参与
 * 源域换算）⇒ 时间轴区间恒为 `start + duration`。这是数据模型的**算术定义**，没有口径可选项；
 * 收成一处的收益是"改时间模型时只改这里"，**不是**防漂移（别把它当判据）。
 *
 * 【区间**判定**各有一处，别在调用方内联比较】
 *   · 该不该显示 / 命中 → `isElementActiveAtTime`：半开 `[start, end)`（起点那一刻画面确实显示它）
 *   · 能不能在此刻切成两段 → `canSplitElementAtTime`：开区间 `(start, end)`（端点上切出 0 长度段）
 */
export function getElementTimeRange({ element }: { element: TimelineElement }): {
  start: number;
  end: number;
} {
  return { start: element.startTime, end: element.startTime + element.duration };
}

/**
 * **「这一刻该不该显示 / 命中这个元素」的唯一判据**（半开区间 `[start, end)`）。
 *
 * 【为什么必须唯一】命中（`hit-test`）/ 框子（`selection-overlay`）/ 吸附
 * （`use-preview-interaction`）/ 文本绘制（`TextNode.isInRange`）/ 定格可用性
 * （`timeline-toolbar`）曾各写一遍同一式子；`use-editor-actions` 还写了它的**德摩根展开**
 * （`t < start || t >= end`）—— 同一判据六种写法，任一处把边界写歪就是"框子画着却点不中"，
 * 且只在恰好落在边界的那一帧显形（最难自查的一类漂移）。
 */
export function isElementActiveAtTime({
  element,
  time,
}: {
  element: TimelineElement;
  time: number;
}): boolean {
  const { start, end } = getElementTimeRange({ element });
  return time >= start && time < end;
}

/**
 * **「这一刻能不能把这个元素切成两段」的唯一判据**（开区间 `(start, end)`）。
 *
 * 【为什么与"显示"判据的边界不同】端点上切会产出 **0 长度段**（左段或右段为空）。
 * 该判据有**两个消费方**，它们必须同口径：
 *   · 选取：`getElementsAtTime`（"分割"动作无选中时取播放头所在元素）
 *   · 执行：`SplitElementsCommand` 的守卫
 * 曾各写一份（`(start,end)` vs `<= start || >= end`）—— 一处改边界就会出现
 * **"选得出来但切不动"**：命令空转一次 `updateTracks`，还会往历史栈里压一条空记录
 * （用户按撤销时"什么都没变"）。
 */
export function canSplitElementAtTime({
  element,
  time,
}: {
  element: TimelineElement;
  time: number;
}): boolean {
  const { start, end } = getElementTimeRange({ element });
  return time > start && time < end;
}

/**
 * **元素级静音判据（唯一实现）** —— 与轨级 `isTrackMuted` 结构对称。
 *
 * 【语义】只有能出声的元素（video / audio）才谈静音；`muted` 缺失 = 不静音。
 * 与 `hidden` 的分工同轨级：`muted` = 只关声音（保留画面），`hidden` = 不参与输出。
 *
 * 【消费方】音频采集 `audio.ts#collectAudioSources`（预览与导出共用）· 时间轴上的静音角标 ·
 * 元素右键"静音"的幂等守卫 —— 曾各自内联（`canElementHaveAudio(element) && element.muted === true`
 * 与 `'muted' in element ? (element.muted ?? false) : false` 两种写法）。
 */
export function isElementMuted(element: TimelineElement): boolean {
  return canElementHaveAudio(element) && element.muted === true;
}

/**
 * **按 `(trackId, elementId)` 在轨道快照里定位元素（唯一查找原语）**。
 *
 * 【为什么收】"选中项 = `{trackId, elementId}`" 是所有批量命令的入参形态，
 * 定位元素要连写两层可选链（`tracks.find(...)?.elements.find(...)`）—— 各命令里
 * 抄了 4 遍，任一处把 `?.` 写漏或把 id 比错字段就是"这条命令静默什么都没做"。
 */
export function findElementInTracks({
  tracks,
  trackId,
  elementId,
}: {
  tracks: TimelineTrack[];
  trackId: string;
  elementId: string;
}): TimelineElement | null {
  const track = tracks.find((t) => t.id === trackId);
  return track?.elements.find((e) => e.id === elementId) ?? null;
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
  duration,
  excludeElementId,
}: {
  elements: TimelineElement[];
  startTime: number;
  /** 待判定元素在**时间轴上**的时长（不传 `endTime`：让调用方**不需要**算结束时刻）。 */
  duration: number;
  excludeElementId?: string | undefined;
}): boolean {
  const endTime = startTime + duration;
  return elements.some((el) => {
    if (excludeElementId && el.id === excludeElementId) return false;
    const elRange = getElementTimeRange({ element: el });
    return startTime < elRange.end && endTime > elRange.start;
  });
}

export function findAvailableVideoTrackAbove({
  tracks,
  sourceTrackId,
  startTime,
  duration,
}: {
  tracks: TimelineTrack[];
  sourceTrackId: string;
  startTime: number;
  duration: number;
}): string | null {
  const sourceIndex = tracks.findIndex((track) => track.id === sourceTrackId);

  for (let index = sourceIndex - 1; index >= 0; index--) {
    const track = tracks[index];
    if (
      // 此处**读字段本身**而非 `isMainTrack`：类型已收窄到 video ⇒ `isMainTrack` 的
      // `type === 'video'` 检查是冗余的；而它作为**类型谓词**，在否定位置会让 TS 把
      // `track` 推成 `never`（先 `type === 'video'` 收窄、再否定 VideoTrack 谓词 = 空集）。
      track.type === 'video' &&
      !track.isMain &&
      // 判据经唯一实现（不能直读 `!track.hidden`）；此处**不能**用 `getOutputTracks` 投影 ——
      // 它会把隐藏**元素**一并滤掉，而"是否与已有元素重叠"必须看全部元素（隐藏元素仍占位）。
      !isTrackHidden(track) &&
      !wouldElementOverlap({ elements: track.elements, startTime, duration })
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
  playbackRate?: number | undefined;
  reversed?: boolean | undefined;
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
  hasAudio,
}: {
  mediaId: string;
  name: string;
  duration: number;
  startTime: number;
  trimStart?: number | undefined;
  /** TD-21-17：源视频是否含音轨（🔊 角标数据源）；由导入探测随素材带来。 */
  hasAudio?: boolean | undefined;
}): CreateVideoElement {
  return {
    type: 'video',
    mediaId,
    name,
    duration,
    startTime,
    trimStart,
    hasAudio,
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
      // 与 `SplitElementsCommand` 的守卫**同一判据**（开区间：端点上切会产出 0 长度段）。
      if (canSplitElementAtTime({ element, time })) {
        result.push({ trackId: track.id, elementId: element.id });
      }
    }
  }

  return result;
}
