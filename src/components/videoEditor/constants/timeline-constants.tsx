import type { TTimelineViewState } from '@/components/videoEditor/types/project';
import type { TrackType } from '@/components/videoEditor/types/timeline';
import { Music, Smile, Type, Video } from 'lucide-react';

export const TRACK_HEIGHTS: Record<TrackType, number> = {
  video: 60,
  text: 25,
  audio: 50,
  sticker: 50,
} as const;

export const TRACK_GAP = 4;

export const TIMELINE_CONSTANTS = {
  PIXELS_PER_SECOND: 50,
  DEFAULT_ELEMENT_DURATION: 5,
  PADDING_TOP_PX: 0,
  ZOOM_MIN: 0.1,
  ZOOM_MAX: 100,
  ZOOM_BUTTON_FACTOR: 1.7,
  ZOOM_ANCHOR_PLAYHEAD_THRESHOLD: 0.15,
  /** 轨道高度倍率上下限（TD-21-16 · 用户可调）。1 = 基准高度。 */
  TRACK_HEIGHT_SCALE_MIN: 0.6,
  TRACK_HEIGHT_SCALE_MAX: 2.5,
  /** 每次点按 ⊕/⊖ 的高度倍率步长 */
  TRACK_HEIGHT_SCALE_STEP: 0.2,
} as const;

/**
 * 夹取轨道高度倍率到合法区间。
 *
 * 【唯一实现】倍率的边界判据只此一处 —— 消费方（渲染 / 拖拽换算 / 工具栏）一律经此，
 * 不各自 `Math.max/min`（否则边界值漂移时会出现"显示按 A 算、命中区按 B 算"）。
 * 非法输入（undefined / NaN）→ 返回 1（缺省），而非静默取边界值。
 */
export function clampTrackHeightScale(scale: number | undefined): number {
  if (scale === undefined || !Number.isFinite(scale)) return 1;
  return Math.min(
    TIMELINE_CONSTANTS.TRACK_HEIGHT_SCALE_MAX,
    Math.max(TIMELINE_CONSTANTS.TRACK_HEIGHT_SCALE_MIN, scale),
  );
}

export const DEFAULT_TIMELINE_VIEW_STATE: TTimelineViewState = {
  zoomLevel: 1,
  scrollLeft: 0,
  playheadTime: 0,
};

export const TRACK_ICONS: Record<TrackType, React.ReactNode> = {
  video: <Video className="text-muted-foreground size-4 shrink-0" />,
  text: <Type className="text-muted-foreground size-4 shrink-0" />,
  audio: <Music className="text-muted-foreground size-4 shrink-0" />,
  sticker: <Smile className="text-muted-foreground size-4 shrink-0" />,
} as const;
