'use client';

import { useEditor } from '@videoEditor/hooks-cutia/use-editor';

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@videoEditor/ui/ui/tooltip';
import { Button } from '@videoEditor/ui/ui/button';
import { SplitSquareHorizontal } from 'lucide-react';

import { Slider } from '@videoEditor/ui/ui/slider';
import { TIMELINE_CONSTANTS } from '@videoEditor/constants/timeline-constants';
import { sliderToZoom, zoomToSlider } from '@videoEditor/engine/timeline/zoom-utils';

import { type TAction, invokeAction } from '@videoEditor/engine/lib/actions';
import { cn } from '@videoEditor/utils/ui';
import { useTimelineStore } from '@videoEditor/stores/timeline-store';
import { ScrollArea } from '@videoEditor/ui/ui/scroll-area';
import {
  Bookmark02Icon,
  Delete02Icon,
  SnowIcon,
  ScissorIcon,
  MagnetIcon,
  Link04Icon,
  SearchAddIcon,
  SearchMinusIcon,
  Copy01Icon,
  AlignLeftIcon,
  AlignRightIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useElementSelection } from '@videoEditor/hooks-cutia/timeline/element/use-element-selection';

export function TimelineToolbar({
  zoomLevel,
  minZoom,
  setZoomLevel,
}: {
  zoomLevel: number;
  minZoom: number;
  setZoomLevel: ({ zoom }: { zoom: number }) => void;
}) {
  const handleZoom = ({ direction }: { direction: 'in' | 'out' }) => {
    const newZoomLevel =
      direction === 'in'
        ? Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, zoomLevel * TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR)
        : Math.max(minZoom, zoomLevel / TIMELINE_CONSTANTS.ZOOM_BUTTON_FACTOR);
    setZoomLevel({ zoom: newZoomLevel });
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
        />
      </div>
    </ScrollArea>
  );
}

function ToolbarLeftSection() {
  const editor = useEditor();
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
          icon={<HugeiconsIcon icon={ScissorIcon} />}
          tooltip={'分割元素'}
          onClick={({ event }) => handleAction({ action: 'split', event })}
        />

        <ToolbarButton
          icon={<HugeiconsIcon icon={AlignLeftIcon} />}
          tooltip={'裁左'}
          onClick={({ event }) => handleAction({ action: 'split-left', event })}
        />

        <ToolbarButton
          icon={<HugeiconsIcon icon={AlignRightIcon} />}
          tooltip={'裁右'}
          onClick={({ event }) => handleAction({ action: 'split-right', event })}
        />

        <ToolbarButton
          icon={<SplitSquareHorizontal />}
          tooltip={'即将推出'}
          disabled={true}
          onClick={({ event: _event }) => {}}
        />

        <ToolbarButton
          icon={<HugeiconsIcon icon={Copy01Icon} />}
          tooltip={'复制元素'}
          onClick={({ event }) => handleAction({ action: 'duplicate-selected', event })}
        />

        <ToolbarButton
          icon={<HugeiconsIcon icon={SnowIcon} />}
          tooltip={'定格'}
          disabled={!canFreezeFrame}
          onClick={({ event }) => handleAction({ action: 'freeze-frame', event })}
        />

        <ToolbarButton
          icon={<HugeiconsIcon icon={Delete02Icon} />}
          tooltip={'删除元素'}
          onClick={({ event }) => handleAction({ action: 'delete-selected', event })}
        />

        <div className="bg-border mx-1 h-6 w-px" />

        <Tooltip>
          <ToolbarButton
            icon={<HugeiconsIcon icon={Bookmark02Icon} />}
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
}: {
  zoomLevel: number;
  minZoom: number;
  onZoomChange: (zoom: number) => void;
  onZoom: (options: { direction: 'in' | 'out' }) => void;
}) {
  const { snappingEnabled, rippleEditingEnabled, toggleSnapping, toggleRippleEditing } =
    useTimelineStore();

  return (
    <div className="flex items-center gap-1">
      <TooltipProvider delayDuration={500}>
        <ToolbarButton
          icon={<HugeiconsIcon icon={MagnetIcon} />}
          isActive={snappingEnabled}
          tooltip={'自动吸附'}
          onClick={() => toggleSnapping()}
        />

        <ToolbarButton
          icon={<HugeiconsIcon icon={Link04Icon} className="scale-110" />}
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
          <HugeiconsIcon icon={SearchMinusIcon} />
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
          <HugeiconsIcon icon={SearchAddIcon} />
        </Button>
      </div>
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
          variant={isActive ? 'secondary' : 'text'}
          size="icon"
          type="button"
          disabled={disabled}
          onClick={(event) => onClick({ event })}
          className={cn('rounded-sm', disabled ? 'cursor-not-allowed opacity-50' : '')}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
