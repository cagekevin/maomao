'use client';

import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/videoEditor/ui/ui/tooltip';
import { Button } from '@/components/videoEditor/ui/ui/button';
import {
  Scissors,
  AlignLeft,
  AlignRight,
  Copy,
  Snowflake,
  Trash2,
  Bookmark,
  Magnet,
  Link,
  ZoomOut,
  ZoomIn,
  Rows3,
  Rows4,
} from 'lucide-react';

import { Slider } from '@/components/videoEditor/ui/ui/slider';
import { TIMELINE_CONSTANTS } from '@/components/videoEditor/constants/timeline-constants';
import { sliderToZoom, zoomToSlider } from '@/components/videoEditor/engine/timeline/zoom-utils';

import { type TAction, invokeAction } from '@/components/videoEditor/engine/lib/actions';
import { cn } from '@/components/videoEditor/utils/ui';
import { useTimelineStore } from '@/components/videoEditor/stores/timeline-store';
import { ScrollArea } from '@/components/videoEditor/ui/ui/scroll-area';
import { useElementSelection } from '@/components/videoEditor/hooks-cutia/timeline/element/use-element-selection';

export function TimelineToolbar({
  zoomLevel,
  minZoom,
  setZoomLevel,
  trackHeightScale,
  setTrackHeightScale,
}: {
  zoomLevel: number;
  minZoom: number;
  setZoomLevel: ({ zoom }: { zoom: number }) => void;
  /** 轨道高度倍率（TD-21-16 · 用户可调）。 */
  trackHeightScale: number;
  setTrackHeightScale: (scale: number) => void;
}) {
  const handleZoom = ({ direction }: { direction: 'in' | 'out' }) => {
    const newZoomLevel =
      direction === 'in'
        ? Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, zoomLevel * TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR)
        : Math.max(minZoom, zoomLevel / TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR);
    setZoomLevel({ zoom: newZoomLevel });
  };

  // 高度步进：夹取由 setTrackHeightScale → clampTrackHeightScale 统一负责，此处不重复判边界。
  const handleTrackHeight = ({ direction }: { direction: 'in' | 'out' }) => {
    const step =
      direction === 'in'
        ? TIMELINE_CONSTANTS.TRACK_HEIGHT_SCALE_STEP
        : -TIMELINE_CONSTANTS.TRACK_HEIGHT_SCALE_STEP;
    setTrackHeightScale(trackHeightScale + step);
  };

  return (
    <ScrollArea className="scrollbar-hidden">
      <div className="flex h-10 items-center justify-between border-b px-2 py-1">
        <ToolbarLeftSection />

        <ToolbarRightSection
          zoomLevel={zoomLevel}
          minZoom={minZoom}
          onZoomChange={(zoom) => setZoomLevel({ zoom })}
          onZoom={handleZoom}
          onTrackHeight={handleTrackHeight}
        />
      </div>
    </ScrollArea>
  );
}

function ToolbarLeftSection() {
  const editor = useEditor('playback', 'timeline', 'scenes');
  const { selectedElements } = useElementSelection();
  const currentTime = editor.playback.getCurrentTime();
  const currentBookmarked = editor.scenes.isBookmarked({ time: currentTime });
  const [selected] =
    selectedElements.length === 1
      ? editor.timeline.getElementsWithTracks({ elements: selectedElements })
      : [];
  const canFreezeFrame =
    selected?.element.type === 'video' &&
    currentTime >= selected.element.startTime &&
    currentTime < selected.element.startTime + selected.element.duration;

  const handleAction = ({ action, event }: { action: TAction; event: React.MouseEvent }) => {
    event.stopPropagation();
    invokeAction(action);
  };

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delayDuration={500}>
        <ToolbarButton
          icon={<Scissors />}
          tooltip={'分割元素'}
          onClick={({ event }) => handleAction({ action: 'split', event })}
        />

        <ToolbarButton
          icon={<AlignLeft />}
          tooltip={'裁左'}
          onClick={({ event }) => handleAction({ action: 'split-left', event })}
        />

        <ToolbarButton
          icon={<AlignRight />}
          tooltip={'裁右'}
          onClick={({ event }) => handleAction({ action: 'split-right', event })}
        />

        <ToolbarButton
          icon={<Copy />}
          tooltip={'复制元素'}
          onClick={({ event }) => handleAction({ action: 'duplicate-selected', event })}
        />

        <ToolbarButton
          icon={<Snowflake />}
          tooltip={'定格'}
          disabled={!canFreezeFrame}
          onClick={({ event }) => handleAction({ action: 'freeze-frame', event })}
        />

        <ToolbarButton
          icon={<Trash2 />}
          tooltip={'删除元素'}
          onClick={({ event }) => handleAction({ action: 'delete-selected', event })}
        />

        <div className="bg-border mx-1 h-6 w-px" />

        <Tooltip>
          <ToolbarButton
            icon={<Bookmark />}
            isActive={currentBookmarked}
            tooltip={currentBookmarked ? '移除书签' : '添加书签'}
            onClick={({ event }) => handleAction({ action: 'toggle-bookmark', event })}
          />
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function ToolbarRightSection({
  zoomLevel,
  minZoom,
  onZoomChange,
  onZoom,
  onTrackHeight,
}: {
  zoomLevel: number;
  minZoom: number;
  onZoomChange: (zoom: number) => void;
  onZoom: (options: { direction: 'in' | 'out' }) => void;
  onTrackHeight: (options: { direction: 'in' | 'out' }) => void;
}) {
  const { snappingEnabled, rippleEditingEnabled, toggleSnapping, toggleRippleEditing } =
    useTimelineStore();

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delayDuration={500}>
        <ToolbarButton
          icon={<Magnet />}
          isActive={snappingEnabled}
          tooltip={'自动吸附'}
          onClick={() => toggleSnapping()}
        />

        <ToolbarButton
          icon={<Link className="scale-110" />}
          isActive={rippleEditingEnabled}
          tooltip={'波纹编辑'}
          onClick={() => toggleRippleEditing()}
        />
      </TooltipProvider>

      <div className="bg-border mx-1 h-6 w-px" />

      <div className="flex items-center gap-1">
        <Button
          variant="text"
          size="icon"
          type="button"
          onClick={() => onZoom({ direction: 'out' })}
        >
          <ZoomOut />
        </Button>
        <Slider
          className="w-28"
          value={[zoomToSlider({ zoomLevel, minZoom })]}
          onValueChange={(values) =>
            onZoomChange(sliderToZoom({ sliderPosition: values[0], minZoom }))
          }
          min={0}
          max={1}
          step={0.005}
        />
        <Button
          variant="text"
          size="icon"
          type="button"
          onClick={() => onZoom({ direction: 'in' })}
        >
          <ZoomIn />
        </Button>
      </div>

      <div className="bg-border mx-1 h-6 w-px" />

      {/* 【TD-21-16】轨道高度可调：与缩放同形的 ⊖/⊕ 两键步进（夹取在 setter 内统一负责）。 */}
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1">
          <ToolbarButton
            icon={<Rows3 />}
            tooltip={'降低轨道高度'}
            onClick={() => onTrackHeight({ direction: 'out' })}
          />
          <ToolbarButton
            icon={<Rows4 />}
            tooltip={'增加轨道高度'}
            onClick={() => onTrackHeight({ direction: 'in' })}
          />
        </div>
      </TooltipProvider>
    </div>
  );
}

function ToolbarButton({
  icon,
  tooltip,
  onClick,
  disabled,
  isActive,
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: ({ event }: { event: React.MouseEvent }) => void;
  disabled?: boolean;
  isActive?: boolean;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <Button
          variant="text"
          size="icon"
          type="button"
          data-active={isActive || undefined}
          disabled={disabled}
          onClick={(event) => onClick({ event })}
          className={cn('ve-tbtn', disabled && 'cursor-not-allowed opacity-50')}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
