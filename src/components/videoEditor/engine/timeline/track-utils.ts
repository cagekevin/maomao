import type {
  TrackType,
  TimelineTrack,
  ElementType,
  VideoTrack,
  AudioTrack,
  StickerTrack,
  TextTrack,
  TimelineElement,
} from '@/components/videoEditor/types/timeline';
import {
  TRACK_HEIGHTS,
  TRACK_GAP,
  clampTrackHeightScale,
} from '@/components/videoEditor/constants/timeline-constants';
import { generateUUID } from '@/components/base/core/idGen.ts';

export function canTracktHaveAudio(track: TimelineTrack): track is VideoTrack | AudioTrack {
  return track.type === 'audio' || track.type === 'video';
}

export function canTrackBeHidden(
  track: TimelineTrack,
): track is VideoTrack | TextTrack | StickerTrack {
  return track.type !== 'audio';
}

/**
 * 轨 `hidden` —— **判据定义（唯一）**。
 *
 * 【两个入口，按用途选，别自己写 `!track.hidden`】
 *   · **输出消费方**（画面 / 声音 / 命中 / 吸附）→ `getOutputTracks`：投影让它们**拿不到**
 *     隐藏项，漏判在结构上不可能（谓词做不到这点：谓词仍要求"记得调"）。
 *   · **编辑期逻辑**（按索引 / 原数组遍历、只判轨级）→ 本谓词。例如
 *     `findAvailableVideoTrackAbove`（找可插入的轨）必须看**原数组**的下标与**全部**元素
 *     （隐藏元素仍占时间轴位置，插入重叠判定不能忽略它们）—— 投影在这里会改变语义。
 *
 * 【为什么连编辑期也要经它】`!track.hidden` 与 `'hidden' in track && track.hidden === true`
 * 行为等价但**写法不同**：同一判据两份写法，改语义（例如换成 `visibility` 枚举）时必然漏改一处。
 */
export function isTrackHidden(track: TimelineTrack): boolean {
  return 'hidden' in track && track.hidden === true;
}

/**
 * 元素 `hidden` —— **判据定义（唯一）**。
 *
 * 【两个入口，同 `isTrackHidden` 的分工】
 *   · **输出消费方**（画面 / 声音 / 命中 / 吸附）→ `getOutputTracks`（拿不到隐藏元素）
 *   · **UI 显示 / 编辑动作**（时间轴上的眼睛遮罩、"是否需要改"的幂等守卫）→ 本谓词
 * 曾散落 5 处 `canElementBeHidden(element) && element.hidden`（写法与这里不同但行为等价）——
 * 同一判据两种写法，改语义时必然漏改。
 */
export function isElementHidden(element: TimelineElement): boolean {
  return 'hidden' in element && element.hidden === true;
}

/**
 * **「参与输出」的轨道/元素投影（唯一入口）** —— 画面与声音共用同一个 `hidden`。
 *
 * 【语义】`hidden = true` ⇒ 该轨 / 该元素**不参与输出**：不出画面，也**不出声音**。
 * 「只想关声音、保留画面」的入口是 `muted`（`isTrackMuted` / `element.muted`），不是 `hidden`。
 *
 * 【为什么是投影而不是谓词】谓词只把判据收成一个函数，消费方仍要**记得调**——
 * 只要还看得见 `hidden` 项，漏判就随时可能发生（实证：关眼睛后画面消失、声音照播，
 * 导出的成品同样带声音）。投影让输出消费方**根本拿不到**被隐藏的轨与元素 ⇒ 漏判无处发生。
 *
 * 【谁必须从这里取（禁直接读 `track.elements`）】
 *   渲染 `scene-builder` · 命中 `hit-test` · 吸附 `use-preview-interaction` ·
 *   音频 `collectAudioSources`（预览与导出共用）。
 * 【UI 显示不受影响】时间轴上的"眼睛"图标读的是 `hidden` 标志本身（显示用途），不经此。
 */
export function getOutputTracks(tracks: TimelineTrack[]): TimelineTrack[] {
  return tracks
    .filter((track) => !isTrackHidden(track))
    .map((track) =>
      track.elements.some((element) => isElementHidden(element))
        ? ({
            ...track,
            elements: track.elements.filter((element) => !isElementHidden(element)),
          } as TimelineTrack)
        : track,
    );
}

/**
 * **静音判据唯一实现**（只有 video / audio 轨有 `muted` 语义；文本 / 贴纸轨无声音）。
 * 消费方（音频采集 `collectAudioSources`）一律经此，不各自内联 `canTracktHaveAudio(track) && track.muted`。
 */
export function isTrackMuted(track: TimelineTrack): boolean {
  return canTracktHaveAudio(track) && track.muted === true;
}

/** 轨道可控项（时间轴上的图标按钮与右键菜单项共用同一份声明）。 */
export type TTrackControlKey = 'mute' | 'visibility' | 'remove';

export interface TTrackControl {
  key: TTrackControlKey;
  /** 该开关当前处于"关"态（喇叭已静音 / 眼睛已隐藏）；`remove` 无此语义，恒 `false`。 */
  isOff: boolean;
}

/**
 * **「这条轨有哪些操作可用」的唯一声明** —— 图标按钮与右键菜单项**都遍历它渲染**。
 *
 * 【为什么必须是数据而不是两处各写 `if`】原先图标区与右键菜单是**两个独立入口**：
 * 图标区写了能力守卫（`canTracktHaveAudio` / `canTrackBeHidden`），菜单**两个都没写** ——
 * 于是文本 / 贴纸轨的右键里出现「静音轨道」、音频轨的右键里出现「隐藏轨道」，点了没反应。
 * 同一判据写在两个入口 ⇒ 必然漏一个；而这类漏**没有编译期兜底**（都是合法 JSX）。
 *
 * ⇒ 现在两处**遍历同一份数据**：不可用的操作**根本不会出现在列表里** ——
 *   不是"拦住"，是**不存在**。
 *
 * 【诚实边界】它保证的是"UI 生不出不可用的项"；`TimelineManager` 的开关方法仍是公开 API，
 * 直接调用时能力判定仍在那一个谓词里（`canTracktHaveAudio` / `canTrackBeHidden`）——
 * 判据只有一份，不存在第二处写法。
 */
export function getTrackControls(track: TimelineTrack): TTrackControl[] {
  const controls: TTrackControl[] = [];

  if (canTracktHaveAudio(track)) {
    controls.push({ key: 'mute', isOff: isTrackMuted(track) });
  }
  if (canTrackBeHidden(track)) {
    controls.push({ key: 'visibility', isOff: isTrackHidden(track) });
  }
  if (!isMainTrack(track)) {
    controls.push({ key: 'remove', isOff: false });
  }

  return controls;
}

export function getTrackClasses({ type }: { type: TrackType }) {
  // 轨道底色视觉已收敛到 videoEditorTheme.css §8（.ve-clip-bg-*）
  return `ve-clip-bg-${type}`;
}

/**
 * 轨道高度（基准 × 用户可调倍率）。
 *
 * 【TD-21-16 · 2026-09-17】`scale` 缺省 = 1 ⇒ 行为与加此参数前**完全一致**（消费方零改动）。
 * 倍率由 `TTimelineViewState.trackHeightScale` 提供（用户可调），夹取经 `clampTrackHeightScale`。
 * 缓存的**只有倍率**，基准高度仍是 `TRACK_HEIGHTS` 单一真源。
 */
export function getTrackHeight({ type, scale }: { type: TrackType; scale?: number }): number {
  return Math.round(TRACK_HEIGHTS[type] * clampTrackHeightScale(scale));
}

export function getCumulativeHeightBefore({
  tracks,
  trackIndex,
  scale,
}: {
  tracks: Array<{ type: TrackType }>;
  trackIndex: number;
  scale?: number;
}): number {
  return tracks
    .slice(0, trackIndex)
    .reduce((sum, track) => sum + getTrackHeight({ type: track.type, scale }) + TRACK_GAP, 0);
}

export function getTotalTracksHeight({
  tracks,
  scale,
}: {
  tracks: Array<{ type: TrackType }>;
  scale?: number;
}): number {
  const tracksHeight = tracks.reduce(
    (sum, track) => sum + getTrackHeight({ type: track.type, scale }),
    0,
  );
  const gapsHeight = Math.max(0, tracks.length - 1) * TRACK_GAP;
  return tracksHeight + gapsHeight;
}

export function buildEmptyTrack({
  id,
  type,
  name,
}: {
  id: string;
  type: TrackType;
  name?: string;
}): TimelineTrack {
  const trackName =
    name ??
    (type === 'video'
      ? 'Video track'
      : type === 'text'
        ? 'Text track'
        : type === 'audio'
          ? 'Audio track'
          : type === 'sticker'
            ? 'Sticker track'
            : 'Track');

  switch (type) {
    case 'video':
      return {
        id,
        name: trackName,
        type: 'video',
        elements: [],
        hidden: false,
        muted: false,
        isMain: false,
      };
    case 'text':
      return {
        id,
        name: trackName,
        type: 'text',
        elements: [],
        hidden: false,
      };
    case 'sticker':
      return {
        id,
        name: trackName,
        type: 'sticker',
        elements: [],
        hidden: false,
      };
    case 'audio':
      return {
        id,
        name: trackName,
        type: 'audio',
        elements: [],
        muted: false,
      };
    default:
      throw new Error(`Unsupported track type: ${type}`);
  }
}

export function getDefaultInsertIndexForTrack({
  tracks,
  trackType,
}: {
  tracks: TimelineTrack[];
  trackType: TrackType;
}): number {
  if (trackType === 'audio') {
    return tracks.length;
  }

  const mainTrackIndex = tracks.findIndex((track) => isMainTrack(track));
  if (mainTrackIndex >= 0) {
    return mainTrackIndex;
  }

  const firstAudioTrackIndex = tracks.findIndex((track) => track.type === 'audio');
  if (firstAudioTrackIndex >= 0) {
    return firstAudioTrackIndex;
  }

  return tracks.length;
}

export function getHighestInsertIndexForTrack({
  tracks,
  trackType,
}: {
  tracks: TimelineTrack[];
  trackType: TrackType;
}): number {
  const mainTrackIndex = tracks.findIndex((track) => isMainTrack(track));

  if (trackType === 'audio') {
    return mainTrackIndex >= 0 ? mainTrackIndex + 1 : tracks.length;
  }

  return 0;
}

export function isMainTrack(track: TimelineTrack): track is VideoTrack {
  return track.type === 'video' && track.isMain === true;
}

export function getMainTrack({ tracks }: { tracks: TimelineTrack[] }): TimelineTrack | null {
  return tracks.find((track) => isMainTrack(track)) ?? null;
}

export function ensureMainTrack({ tracks }: { tracks: TimelineTrack[] }): TimelineTrack[] {
  const hasMainTrack = tracks.some((track) => isMainTrack(track));

  if (!hasMainTrack) {
    const mainTrack: TimelineTrack = {
      id: generateUUID(),
      name: 'Main Track',
      type: 'video',
      elements: [],
      muted: false,
      isMain: true,
      hidden: false,
    };
    // 追加在**末位**：轨道数组序 = 图层序（下标 0 = 最上层），主轨是基础层 ⇒ 必须垫底。
    // 前置（`[mainTrack, ...tracks]`）会让缺主轨的旧工程把主轨摆到最上层 —— 与新插入逻辑
    // （`getDefaultInsertIndexForTrack` 把新轨插在主轨之上）自相矛盾。
    return [...tracks, mainTrack];
  }

  return tracks;
}

export function canElementGoOnTrack({
  elementType,
  trackType,
}: {
  elementType: ElementType;
  trackType: TrackType;
}): boolean {
  if (elementType === 'text') return trackType === 'text';
  if (elementType === 'audio') return trackType === 'audio';
  if (elementType === 'sticker') return trackType === 'sticker';
  if (elementType === 'video' || elementType === 'image') {
    return trackType === 'video';
  }
  return false;
}

export function validateElementTrackCompatibility({
  element,
  track,
}: {
  element: { type: ElementType };
  track: { type: TrackType };
}): { isValid: boolean; errorMessage?: string } {
  const isValid = canElementGoOnTrack({
    elementType: element.type,
    trackType: track.type,
  });

  if (!isValid) {
    return {
      isValid: false,
      errorMessage: `${element.type} elements cannot be placed on ${track.type} tracks`,
    };
  }

  return { isValid: true };
}

export function getEarliestMainTrackElement({
  tracks,
  excludeElementId,
}: {
  tracks: TimelineTrack[];
  excludeElementId?: string;
}): TimelineElement | null {
  const mainTrack = getMainTrack({ tracks });
  if (!mainTrack) {
    return null;
  }

  const elements = mainTrack.elements.filter(
    (element) => !excludeElementId || element.id !== excludeElementId,
  );

  if (elements.length === 0) {
    return null;
  }

  return elements.reduce((earliest, element) =>
    element.startTime < earliest.startTime ? element : earliest,
  );
}

export function enforceMainTrackStart({
  tracks,
  targetTrackId,
  requestedStartTime,
  excludeElementId,
}: {
  tracks: TimelineTrack[];
  targetTrackId: string;
  requestedStartTime: number;
  excludeElementId?: string;
}): number {
  const mainTrack = getMainTrack({ tracks });
  if (!mainTrack || mainTrack.id !== targetTrackId) {
    return requestedStartTime;
  }

  const earliestElement = getEarliestMainTrackElement({
    tracks,
    excludeElementId,
  });

  if (!earliestElement) {
    return 0;
  }

  // main track must always start at time 0; if this element would
  // become the earliest, pin it to the start
  if (requestedStartTime <= earliestElement.startTime) {
    return 0;
  }

  return requestedStartTime;
}
