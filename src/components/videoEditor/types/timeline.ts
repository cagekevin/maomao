export interface TScene {
  id: string;
  name: string;
  isMain: boolean;
  tracks: TimelineTrack[];
  bookmarks: number[];
  createdAt: Date;
  updatedAt: Date;
}

export type TrackType = 'video' | 'text' | 'audio' | 'sticker';

interface BaseTrack {
  id: string;
  name: string;
}

export interface VideoTrack extends BaseTrack {
  type: 'video';
  elements: (VideoElement | ImageElement)[];
  transitions?: TrackTransition[];
  isMain: boolean;
  muted: boolean;
  hidden: boolean;
}

export interface TextTrack extends BaseTrack {
  type: 'text';
  elements: TextElement[];
  hidden: boolean;
}

export interface AudioTrack extends BaseTrack {
  type: 'audio';
  elements: AudioElement[];
  muted: boolean;
}

export interface StickerTrack extends BaseTrack {
  type: 'sticker';
  elements: StickerElement[];
  hidden: boolean;
}

export type TimelineTrack = VideoTrack | TextTrack | AudioTrack | StickerTrack;

export interface Transform {
  scale: number;
  position: {
    x: number;
    y: number;
  };
  rotate: number;
  flipX?: boolean;
  flipY?: boolean;
}

// ---- Transitions ----

export type TransitionType =
  | 'fade'
  | 'dissolve'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out';

export interface TrackTransition {
  id: string;
  type: TransitionType;
  duration: number;
  fromElementId: string;
  toElementId: string;
}

interface BaseAudioElement extends BaseTimelineElement {
  type: 'audio';
  volume: number;
  muted?: boolean;
  buffer?: AudioBuffer;
  playbackRate?: number;
}

export interface UploadAudioElement extends BaseAudioElement {
  sourceType: 'upload';
  mediaId: string;
}

export interface LibraryAudioElement extends BaseAudioElement {
  sourceType: 'library';
  sourceUrl: string;
}

export type AudioElement = UploadAudioElement | LibraryAudioElement;

interface BaseTimelineElement {
  id: string;
  name: string;
  duration: number;
  startTime: number;
  trimStart: number;
  // ── 【没有 `trimEnd`（2026-09-15 删除 · TD-22-21）】────────────────────
  // 它曾是「源素材右侧还剩多少没用」的**冗余副本**：
  //     素材总长 = trimStart + duration × playbackRate + trimEnd
  // 而素材总长的**真源**是 media asset 的 `duration`（上传时读元数据得到，见 processing.ts）。
  // 删除依据（逐条取证）：
  //   · 真正读它的只有 **1 处** —— `use-element-resize` 的拖拽边界（现已改问 media.duration）；
  //   · 渲染取帧 / 导出解码 / 音频混音**从不读它**（都自算 `trimStart + duration × rate`），
  //     只是把它在 `AudioMixSource` / `VisualNodeParams` 里搬来搬去（无消费者）；
  //   · 且两处对它的**语义理解互相矛盾**：resize 按 `+ trimEnd` 反推素材总长，
  //     而 `split-elements` 的注释按 `= trimStart + duration×rate` 当"源出点"用 —— 一字段两义。
  // 冗余副本 + 语义漂移 = 拖拽边界会算错（split 就漂过），删掉即根治。
  // 兼容：旧工程存档里的该字段成为未知字段，反序列化时被忽略（无人读 → 无行为变化）。
}

export interface VideoElement extends BaseTimelineElement {
  type: 'video';
  mediaId: string;
  muted?: boolean;
  hidden?: boolean;
  /**
   * 源视频**是否含音轨**（TD-21-17）。驱动时间轴上「带原声视频」的 🔊 角标 ——
   * 让用户一眼看出「这条有声音」，而 C4.7 红线规定音轨**内联**在视频片段里、不拆轨。
   * 在导入时由 `getVideoInfo` 探测（mediabunny `getPrimaryAudioTrack`）后随素材落到此处；
   * 存量旧工程缺该字段 → undefined = **不亮角标**（宁可不显示，不撒谎说有声音）。
   */
  hasAudio?: boolean;
  transform: Transform;
  opacity: number;
  playbackRate?: number;
  reversed?: boolean;
}

export interface ImageElement extends BaseTimelineElement {
  type: 'image';
  mediaId: string;
  hidden?: boolean;
  transform: Transform;
  opacity: number;
}

export interface TextStroke {
  color: string;
  width: number;
}

export interface TextShadow {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
}

export interface TextElement extends BaseTimelineElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  textAlign: 'left' | 'center' | 'right';
  /**
   * 字重（CSS / Canvas 的 `font-weight` 数字值，如 400 / 700）。
   *
   * 【2026-09-19 由 `'normal' | 'bold'` 改为数字】原二值形态有两个问题：
   *  ① 表达能力只有两档，而中文字体（苹方 / 思源等）本身有 6~7 档；
   *  ② 渲染层为把它塞进 CSS 语法做了**二值压平**（旧 `text-node.ts`：
   *     `fontWeight === 'bold' ? 'bold' : 'normal'`）⇒ 除 `bold` 外一切都被渲染成 400
   *     —— 即便数据里写了 500 / 600，画布也**静默渲染成 400**（选了没反应）。
   * 改为数字后渲染层**直通**，不再有压平这一步。
   *
   * ⚠️ **可选档位随字体而异**（见 `constants/font-constants.ts` 的 `FontOption.weights`）：
   * UI 只列当前字体实际有的档，不做"全局 5 档"（否则在微软雅黑上选 500 会被静默取最近档）。
   * 【老工程】不做迁移（项目约定：不为存量兼容）——旧值 `'normal'/'bold'` 不再被解析。
   */
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  hidden?: boolean;
  transform: Transform;
  opacity: number;
  stroke?: TextStroke;
  shadow?: TextShadow;
  boxWidth?: number;
  backgroundBorderRadius?: number;
  backgroundOpacity?: number;
  backgroundPaddingX?: number;
  backgroundPaddingY?: number;
}

export interface StickerElement extends BaseTimelineElement {
  type: 'sticker';
  iconName: string;
  hidden?: boolean;
  transform: Transform;
  opacity: number;
  color?: string;
}

export type TimelineElement =
  AudioElement | VideoElement | ImageElement | TextElement | StickerElement;

export type ElementType = TimelineElement['type'];

export type CreateUploadAudioElement = Omit<UploadAudioElement, 'id'>;
export type CreateLibraryAudioElement = Omit<LibraryAudioElement, 'id'>;
export type CreateAudioElement = CreateUploadAudioElement | CreateLibraryAudioElement;
export type CreateVideoElement = Omit<VideoElement, 'id'>;
export type CreateImageElement = Omit<ImageElement, 'id'>;
export type CreateTextElement = Omit<TextElement, 'id'>;
export type CreateStickerElement = Omit<StickerElement, 'id'>;
export type CreateTimelineElement =
  | CreateAudioElement
  | CreateVideoElement
  | CreateImageElement
  | CreateTextElement
  | CreateStickerElement;

// ---- Drag State ----

export interface ElementDragState {
  isDragging: boolean;
  elementId: string | null;
  trackId: string | null;
  startMouseX: number;
  startMouseY: number;
  startElementTime: number;
  clickOffsetTime: number;
  currentTime: number;
  currentMouseY: number;
}

export interface DropTarget {
  trackIndex: number;
  isNewTrack: boolean;
  insertPosition: 'above' | 'below' | null;
  xPosition: number;
}

export interface ComputeDropTargetParams {
  elementType: ElementType;
  mouseX: number;
  mouseY: number;
  tracks: TimelineTrack[];
  playheadTime: number;
  isExternalDrop: boolean;
  elementDuration: number;
  pixelsPerSecond: number;
  zoomLevel: number;
  /**
   * 轨道高度倍率（TD-21-16）。命中判定的 Y 换算必须与渲染**同口径** ——
   * 否则"显示按倍率、落点按基准"会错位（拖拽落到相邻轨道）。
   * 缺省 = 1（与不加此参数前行为一致）。
   */
  trackHeightScale?: number;
  verticalDragDirection?: 'up' | 'down' | null;
  startTimeOverride?: number;
  excludeElementId?: string;
}

export interface ClipboardItem {
  trackId: string;
  trackType: TrackType;
  element: CreateTimelineElement;
}
