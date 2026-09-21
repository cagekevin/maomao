'use client';

import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { useAssetsPanelStore } from '@/components/videoEditor/stores/assets-panel-store';
import { buildIconSvgUrl } from '@/components/videoEditor/engine/lib/iconify-api';
import AudioWaveform from './audio-waveform';
import { MissingMediaIndicator } from './missing-media-indicator';
import { useTimelineElementResize } from '@/components/videoEditor/hooks-cutia/timeline/element/use-element-resize';
import type { SnapPoint } from '@/components/videoEditor/hooks-cutia/timeline/use-timeline-snapping';
import { TIMELINE_CONSTANTS } from '@/components/videoEditor/constants/timeline-constants';
import {
  getTrackClasses,
  getTrackHeight,
  canElementHaveAudio,
  canElementBeHidden,
  hasMediaId,
} from '@/components/videoEditor/engine/timeline';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '../../../ui/context-menu';
import type {
  TimelineElement as TimelineElementType,
  TimelineTrack,
  ElementDragState,
  VideoElement,
} from '@/components/videoEditor/types/timeline';
import type { MediaAsset } from '@/components/videoEditor/types/mediaAssets';
import { mediaSupportsAudio } from '@/components/videoEditor/engine/lib/media/media-utils';
import {
  getActionDefinition,
  type TAction,
  invokeAction,
} from '@/components/videoEditor/engine/lib/actions';
import { useElementSelection } from '@/components/videoEditor/hooks-cutia/timeline/element/use-element-selection';
import { uppercase } from '@/components/videoEditor/utils/string';

import type { ComponentProps } from 'react';
import { VideoThumbnailStrip } from './video-thumbnail-strip';
import {
  Download,
  Scissors,
  Snowflake,
  Music,
  AudioLines,
  Copy,
  Search,
  ArrowLeftRight,
  EyeOff,
  VolumeX,
  Volume2,
  Eye,
  Trash2,
  Pencil,
  FlipHorizontal2,
  Undo2,
  AlertTriangle,
} from 'lucide-react';
import {
  mediaDisplayUrl,
  type RenderAssetResolver,
} from '@/components/videoEditor/lib/mediaDisplayUrl';
import { useRenderAssetResolver } from '@/components/base/utils/media/assetUrl';
import { useMediaLoadFailed } from '@/components/base/utils/media/useMediaLoadFailed';

function getDisplayShortcut(action: TAction) {
  const { defaultShortcuts } = getActionDefinition(action);
  if (!defaultShortcuts?.length) {
    return '';
  }

  return uppercase({
    string: defaultShortcuts[0].replace('+', ' '),
  });
}

interface TimelineElementProps {
  element: TimelineElementType;
  track: TimelineTrack;
  zoomLevel: number;
  /** 轨道高度倍率（TD-21-16）——胶片条等按高度渲染的内容必须与轨道同口径。缺省 = 1。 */
  trackHeightScale?: number;
  isSelected: boolean;
  onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
  onResizeStateChange?: (params: { isResizing: boolean }) => void;
  onElementMouseDown: (e: React.MouseEvent, element: TimelineElementType) => void;
  onElementClick: (e: React.MouseEvent, element: TimelineElementType) => void;
  dragState: ElementDragState;
}

export function TimelineElement({
  element,
  track,
  zoomLevel,
  trackHeightScale,
  isSelected,
  onSnapPointChange,
  onResizeStateChange,
  onElementMouseDown,
  onElementClick,
  dragState,
}: TimelineElementProps) {
  const editor = useEditor('timeline', 'media');
  const { selectedElements } = useElementSelection();
  const { requestRevealMedia } = useAssetsPanelStore();

  const mediaAssets = editor.media.getAssets();
  let mediaAsset: MediaAsset | null = null;

  if (hasMediaId(element)) {
    mediaAsset = mediaAssets.find((asset) => asset.id === element.mediaId) ?? null;
  }

  const hasAudio = mediaSupportsAudio({ media: mediaAsset });

  const { handleResizeStart, isResizing, currentStartTime, currentDuration } =
    useTimelineElementResize({
      element,
      track,
      zoomLevel,
      onSnapPointChange,
      onResizeStateChange,
    });

  const isCurrentElementSelected = selectedElements.some(
    (selected) => selected.elementId === element.id && selected.trackId === track.id,
  );

  const isBeingDragged = dragState.elementId === element.id;
  const isBatchDragged =
    !isBeingDragged &&
    dragState.isDragging &&
    isCurrentElementSelected &&
    selectedElements.length > 1;
  const timeDelta = dragState.isDragging ? dragState.currentTime - dragState.startElementTime : 0;
  const dragOffsetY =
    isBeingDragged && dragState.isDragging ? dragState.currentMouseY - dragState.startMouseY : 0;
  const elementStartTime =
    isBeingDragged && dragState.isDragging
      ? dragState.currentTime
      : isBatchDragged
        ? Math.max(0, element.startTime + timeDelta)
        : element.startTime;
  const displayedStartTime = isResizing ? currentStartTime : elementStartTime;
  const displayedDuration = isResizing ? currentDuration : element.duration;
  const elementWidth = displayedDuration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
  const elementLeft = displayedStartTime * 50 * zoomLevel;

  const handleRevealInMedia = ({ event }: { event: React.MouseEvent }) => {
    event.stopPropagation();
    if (hasMediaId(element)) {
      requestRevealMedia(element.mediaId);
    }
  };

  const isMuted = canElementHaveAudio(element) && element.muted === true;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={`absolute top-0 h-full select-none ${isBeingDragged ? 'z-30' : 'z-10'}`}
          style={{
            left: `${elementLeft}px`,
            width: `${elementWidth}px`,
            transform:
              isBeingDragged && dragState.isDragging
                ? `translate3d(0, ${dragOffsetY}px, 0)`
                : undefined,
          }}
        >
          <ElementInner
            element={element}
            track={track}
            zoomLevel={zoomLevel}
            trackHeightScale={trackHeightScale}
            isSelected={isSelected}
            isBeingDragged={isBeingDragged}
            hasAudio={hasAudio}
            isMuted={isMuted}
            mediaAssets={mediaAssets}
            onElementClick={onElementClick}
            onElementMouseDown={onElementMouseDown}
            handleResizeStart={handleResizeStart}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="z-[200] w-64">
        <ActionMenuItem action="split" icon={<Scissors />}>
          {'分割'}
        </ActionMenuItem>
        {element.type === 'video' && (
          <ContextMenuItem
            icon={<Snowflake />}
            onClick={(event) => {
              event.stopPropagation();
              invokeAction('freeze-frame', {
                trackId: track.id,
                elementId: element.id,
              });
            }}
          >
            {'定格'}
          </ContextMenuItem>
        )}
        <CopyMenuItem />
        {element.type === 'video' && selectedElements.length === 1 && (
          <ActionMenuItem action="export-selected-clip" icon={<Download className="size-4" />}>
            {'导出选中片段'}
          </ActionMenuItem>
        )}
        {canElementHaveAudio(element) && hasAudio && (
          <>
            <MuteMenuItem
              isMultipleSelected={selectedElements.length > 1}
              isCurrentElementSelected={isCurrentElementSelected}
              isMuted={isMuted}
            />
            {element.type === 'video' && (
              <ActionMenuItem action="detach-audio" icon={<Music />}>
                {'分离音频'}
              </ActionMenuItem>
            )}
          </>
        )}
        {element.type === 'video' && selectedElements.length === 1 && (
          <VideoEditSubmenu element={element as VideoElement} trackId={track.id} />
        )}
        {element.type === 'text' && (
          <ActionMenuItem action="convert-to-speech" icon={<AudioLines />}>
            {selectedElements.length > 1
              ? `Convert ${selectedElements.length} to speech`
              : '转换为语音'}
          </ActionMenuItem>
        )}
        {canElementBeHidden(element) && (
          <VisibilityMenuItem
            element={element}
            isMultipleSelected={selectedElements.length > 1}
            isCurrentElementSelected={isCurrentElementSelected}
          />
        )}
        {selectedElements.length === 1 && (
          <ActionMenuItem action="duplicate-selected" icon={<Copy />}>
            {'复制一份'}
          </ActionMenuItem>
        )}
        {selectedElements.length === 1 && hasMediaId(element) && (
          <>
            <ContextMenuItem icon={<Search />} onClick={(event) => handleRevealInMedia({ event })}>
              {'显示素材'}
            </ContextMenuItem>
            <ContextMenuItem icon={<ArrowLeftRight />} disabled>
              {'替换素材'}
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <DeleteMenuItem
          isMultipleSelected={selectedElements.length > 1}
          isCurrentElementSelected={isCurrentElementSelected}
          elementType={element.type}
          selectedCount={selectedElements.length}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function ElementInner({
  element,
  track,
  zoomLevel,
  trackHeightScale,
  isSelected,
  isBeingDragged,
  hasAudio,
  isMuted,
  mediaAssets,
  onElementClick,
  onElementMouseDown,
  handleResizeStart,
}: {
  element: TimelineElementType;
  track: TimelineTrack;
  zoomLevel: number;
  /** 轨道高度倍率（TD-21-16）——透传给 ElementContent 的胶片条，须与轨道同口径。 */
  trackHeightScale?: number;
  isSelected: boolean;
  isBeingDragged: boolean;
  hasAudio: boolean;
  isMuted: boolean;
  mediaAssets: MediaAsset[];
  onElementClick: (e: React.MouseEvent, element: TimelineElementType) => void;
  onElementMouseDown: (e: React.MouseEvent, element: TimelineElementType) => void;
  handleResizeStart: (params: {
    e: React.MouseEvent;
    elementId: string;
    side: 'left' | 'right';
  }) => void;
}) {
  return (
    <div
      className={`ve-clip relative h-full cursor-pointer overflow-hidden ${getTrackClasses({
        type: track.type,
      })} ${isBeingDragged ? 'z-30' : 'z-10'} ${canElementBeHidden(element) && element.hidden ? 'opacity-50' : ''}`}
    >
      <button
        type="button"
        className="absolute inset-0 size-full cursor-pointer"
        onClick={(e) => onElementClick(e, element)}
        onMouseDown={(e) => onElementMouseDown(e, element)}
      >
        <div className="absolute inset-0 flex h-full items-center">
          <ElementContent
            element={element}
            track={track}
            zoomLevel={zoomLevel}
            trackHeightScale={trackHeightScale}
            mediaAssets={mediaAssets}
          />
        </div>

        {canElementBeHidden(element) && element.hidden && (
          <div className="ve-veil pointer-events-none">
            <EyeOff className="size-6" />
          </div>
        )}
        {hasAudio && isMuted && (
          <div className="pointer-events-none ve-veil-badge">
            <VolumeX className="size-3.5" />
          </div>
        )}
        {/* TD-21-17：视频**真含音轨**（element.hasAudio，导入时探测）且未静音 → 🔊 角标。
            与上面「静音 🔇」互补：C4.7 红线规定音轨内联在视频片段里、不拆轨，
            故用户需要「这条有声音」的可见指示。判据用**元素字段**（真实探测结果），
            不用 `mediaSupportsAudio`（那是「视频类型通常有音轨」的猜测，静音视频会误报）。 */}
        {element.type === 'video' && element.hasAudio === true && !isMuted && (
          <div className="pointer-events-none ve-veil-badge">
            <Volume2 className="size-3.5" />
          </div>
        )}
      </button>

      {isSelected && (
        <>
          <div className="ve-clip-selected pointer-events-none absolute inset-0" />
          <ResizeHandle side="left" elementId={element.id} handleResizeStart={handleResizeStart} />
          <ResizeHandle side="right" elementId={element.id} handleResizeStart={handleResizeStart} />
        </>
      )}
    </div>
  );
}

function ResizeHandle({
  side,
  elementId,
  handleResizeStart,
}: {
  side: 'left' | 'right';
  elementId: string;
  handleResizeStart: (params: {
    e: React.MouseEvent;
    elementId: string;
    side: 'left' | 'right';
  }) => void;
}) {
  const isLeft = side === 'left';
  return (
    <button
      type="button"
      className={`absolute top-0 bottom-0 z-50 flex w-[0.6rem] items-center justify-center ${isLeft ? 'left-0 cursor-w-resize' : 'right-0 cursor-e-resize'}`}
      onMouseDown={(e) => handleResizeStart({ e, elementId, side })}
      aria-label={`${isLeft ? 'Left' : 'Right'} resize handle`}
    >
      <div className="bg-foreground h-[1.5rem] w-[0.2rem] rounded-full" />
    </button>
  );
}

/**
 * 贴纸片段内容（图标 + 名称）。
 *
 * 【为什么抽成独立组件 · 2026-09-17 TD-16-29②】原来这里是**裸 `<img>`（无 onError）**：
 * `buildIconSvgUrl` 走 localTool 代理抓上游 SVG，网络失败 / 前缀写错 / 上游 404 时浏览器
 * 只剩破图图标（或 `alt` 文本），与"这个贴纸本来就没图"无从区分。onError 是 hook，
 * 不能在 `ElementContent` 的条件分支里调用（hooks 规则），故抽为独立组件。
 */
function StickerContent({ iconName, name }: { iconName: string; name: string }) {
  const { failed, onError } = useMediaLoadFailed(iconName, '贴纸图标', { iconName });

  return (
    <div className="flex size-full items-center gap-2 pl-2">
      {failed ? (
        // 失败 → 与时间轴其他"素材不可用"共用同一表达（虚线红框 + 告警），不留给浏览器破图
        <AlertTriangle className="text-destructive size-5 shrink-0" aria-label="贴纸图标加载失败" />
      ) : (
        <img
          src={buildIconSvgUrl(iconName, { width: 20, height: 20 })}
          alt={name}
          className="size-5 shrink-0"
          width={20}
          height={20}
          onError={onError}
        />
      )}
      <span className="ve-clip-text truncate">{name}</span>
    </div>
  );
}

/**
 * 时间轴「图片片段」的缩略背景。
 *
 * 【为什么用 `<img>` 而非 CSS backgroundImage · 2026-09-17 TD-16-29②】
 * CSS 背景图**没有 onError 可挂** ⇒ 素材缺失 / 4xx 时只有空白，失败完全不可见。
 * `<img>` 视觉等价（`object-cover` = `background-size:cover`）却能挂 onError；
 * `pointer-events-none` 保持原 `pointerEvents:'none'`，不改变拖拽/选中行为。
 */
function TimelineImageElement({
  asset,
  resolveThumb,
  name,
}: {
  asset: MediaAsset;
  resolveThumb: RenderAssetResolver;
  name: string;
}) {
  const src = mediaDisplayUrl({ asset, resolve: resolveThumb });
  const { failed, onError } = useMediaLoadFailed(src, '时间轴图片片段', { assetId: asset.id });

  if (failed) {
    return <MissingMediaIndicator kind="source-unavailable" name={name} />;
  }

  return (
    <img
      src={src}
      alt={name}
      onError={onError}
      className="pointer-events-none absolute inset-0 size-full object-cover"
    />
  );
}

function ElementContent({
  element,
  track,
  zoomLevel,
  trackHeightScale,
  mediaAssets,
}: {
  element: TimelineElementType;
  track: TimelineTrack;
  zoomLevel: number;
  /** 轨道高度倍率（TD-21-16）——胶片条按此渲染，与轨道同口径。缺省 = 1。 */
  trackHeightScale?: number;
  mediaAssets: MediaAsset[];
}) {
  // TD-22-52：片段缩略图走 maomao 统一图片出口（服务端按需出小图 + 尊重「显示缩略图」开关）
  const resolveThumb = useRenderAssetResolver();

  if (element.type === 'text') {
    return (
      <div className="flex size-full items-center justify-start pl-2">
        <span className="ve-clip-text truncate">{element.content}</span>
      </div>
    );
  }

  if (element.type === 'sticker') {
    return <StickerContent iconName={element.iconName} name={element.name} />;
  }

  if (element.type === 'audio') {
    const audioBuffer = element.buffer;
    const audioBlob =
      element.sourceType === 'upload'
        ? mediaAssets.find((asset) => asset.id === element.mediaId)?.file
        : undefined;

    const audioUrl =
      element.sourceType === 'library'
        ? element.sourceUrl
        : mediaAssets.find((asset) => asset.id === element.mediaId)?.url;

    if (audioBuffer || audioUrl) {
      return (
        <div className="flex size-full items-center gap-2">
          <div className="min-w-0 flex-1">
            <AudioWaveform
              audioBuffer={audioBuffer}
              audioBlob={audioBlob}
              audioUrl={audioUrl}
              duration={element.duration}
              volume={element.volume}
              height={24}
              className="w-full"
            />
          </div>
        </div>
      );
    }

    // audio 既无解码缓冲也无可播 URL —— 源取不到（仍是一句"素材不可用"，不再是一行光秃秃的名字）
    return <MissingMediaIndicator kind="source-unavailable" name={element.name} />;
  }

  const mediaAsset = mediaAssets.find((asset) => asset.id === element.mediaId);
  if (!mediaAsset) {
    // 素材**记录**都不在了（被删 / 加载失败 / 切项目重置）—— 与"记录在但源取不到"分开表达：
    // 前者的补救是重新导入，后者是检查本地服务 / 重新上传（TD-22-48）
    return <MissingMediaIndicator kind="missing-asset" name={element.name} />;
  }

  if (mediaAsset.type === 'video' && mediaAsset.file) {
    // 走 getTrackHeight（唯一高度入口）而非 TRACK_HEIGHTS：轨道高度可调后，
    // 胶片条必须与轨道同口径，否则"轨道变高了、胶片条还按基准"会错位（TD-21-16）。
    const trackHeight = getTrackHeight({ type: track.type, scale: trackHeightScale });
    const elementWidth = element.duration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;

    return (
      <div className="relative size-full">
        <VideoThumbnailStrip
          mediaId={element.mediaId}
          file={mediaAsset.file}
          thumbnailUrl={mediaAsset.thumbnailUrl}
          trimStart={element.trimStart}
          duration={element.duration}
          elementWidth={elementWidth}
          trackHeight={trackHeight}
          zoomLevel={zoomLevel}
          fps={mediaAsset.fps ?? 30}
          mediaWidth={mediaAsset.width ?? 1920}
          mediaHeight={mediaAsset.height ?? 1080}
        />
      </div>
    );
  }

  if (mediaAsset.type === 'image' && (mediaAsset.persistentUrl || mediaAsset.url)) {
    // 【2026-09-17 TD-16-29②】原来这里是 CSS `backgroundImage: url(...)` —— **无 onError 可挂**，
    // 素材文件缺失 / 4xx 时只有一片空白背景，用户与开发者都无法区分「还没加载」与「已损坏」。
    // 改用 `<img>`（视觉等价：object-cover 对应 background-size:cover，pointerEvents:none 保持
    // 不挡拖拽），从而能挂 onError → 失败走统一 `MissingMediaIndicator` 显式表达。
    return (
      <TimelineImageElement asset={mediaAsset} resolveThumb={resolveThumb} name={element.name} />
    );
  }

  // video 有 asset 但 `file` 缺 / image 有 asset 但 `url` 缺 —— 记录在、源取不到（TD-22-48）
  return <MissingMediaIndicator kind="source-unavailable" name={element.name} />;
}

function CopyMenuItem() {
  return (
    <ActionMenuItem action="copy-selected" icon={<Copy />}>
      {'复制'}
    </ActionMenuItem>
  );
}

function MuteMenuItem({
  isMultipleSelected,
  isCurrentElementSelected,
  isMuted,
}: {
  isMultipleSelected: boolean;
  isCurrentElementSelected: boolean;
  isMuted: boolean;
}) {
  const getIcon = () => {
    if (isMultipleSelected && isCurrentElementSelected) {
      return <VolumeX />;
    }
    return isMuted ? <Volume2 /> : <VolumeX />;
  };

  return (
    <ActionMenuItem action="toggle-elements-muted-selected" icon={getIcon()}>
      {isMuted ? '取消静音' : '静音'}
    </ActionMenuItem>
  );
}

function VisibilityMenuItem({
  element,
  isMultipleSelected,
  isCurrentElementSelected,
}: {
  element: TimelineElementType;
  isMultipleSelected: boolean;
  isCurrentElementSelected: boolean;
}) {
  const isHidden = canElementBeHidden(element) && element.hidden;

  const getIcon = () => {
    if (isMultipleSelected && isCurrentElementSelected) {
      return <EyeOff />;
    }
    return isHidden ? <Eye /> : <EyeOff />;
  };

  return (
    <ActionMenuItem action="toggle-elements-visibility-selected" icon={getIcon()}>
      {isHidden ? '显示' : '隐藏'}
    </ActionMenuItem>
  );
}

function DeleteMenuItem({
  isMultipleSelected,
  isCurrentElementSelected,
  elementType,
  selectedCount,
}: {
  isMultipleSelected: boolean;
  isCurrentElementSelected: boolean;
  elementType: TimelineElementType['type'];
  selectedCount: number;
}) {
  return (
    <ActionMenuItem action="delete-selected" variant="destructive" icon={<Trash2 />}>
      {isMultipleSelected && isCurrentElementSelected
        ? `Delete ${selectedCount} elements`
        : `Delete ${elementType === 'text' ? '文字' : '片段'}`}
    </ActionMenuItem>
  );
}

function VideoEditSubmenu({ element, trackId }: { element: VideoElement; trackId: string }) {
  const editor = useEditor('timeline', 'media');

  const isMirrored = element.transform.flipX === true;
  const isReversed = element.reversed === true;

  const toggleMirror = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    editor.timeline.updateElements({
      updates: [
        {
          trackId,
          elementId: element.id,
          updates: {
            transform: {
              ...element.transform,
              flipX: !isMirrored,
            },
          },
        },
      ],
    });
  };

  const toggleReverse = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    editor.timeline.updateElements({
      updates: [
        {
          trackId,
          elementId: element.id,
          updates: { reversed: !isReversed },
        },
      ],
    });
  };

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Pencil className="size-4" />
        {'基础编辑'}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        <ContextMenuCheckboxItem
          className="px-4"
          checked={isMirrored}
          onClick={toggleMirror}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              toggleMirror(event);
            }
          }}
        >
          <FlipHorizontal2 className="size-4" />
          {'镜像'}
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem
          className="px-4"
          checked={isReversed}
          onClick={toggleReverse}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              toggleReverse(event);
            }
          }}
        >
          <Undo2 className="size-4" />
          {'倒放'}
        </ContextMenuCheckboxItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

function ActionMenuItem({
  action,
  children,
  ...props
}: Omit<ComponentProps<typeof ContextMenuItem>, 'onClick' | 'textRight'> & {
  action: TAction;
}) {
  return (
    <ContextMenuItem
      onClick={(event) => {
        event.stopPropagation();
        invokeAction(action);
      }}
      textRight={getDisplayShortcut(action)}
      {...props}
    >
      {children}
    </ContextMenuItem>
  );
}
