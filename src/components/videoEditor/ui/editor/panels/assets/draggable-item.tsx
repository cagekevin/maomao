'use client';

import { Plus } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AspectRatio } from '@videoEditor/ui/ui/aspect-ratio';
import { Button } from '@videoEditor/ui/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@videoEditor/ui/ui/tooltip';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import { clearDragData, setDragData } from '@videoEditor/engine/lib/drag-data';
import type { TimelineDragData } from '@videoEditor/types/drag';
import { cn } from '@videoEditor/utils/ui';

export interface DraggableItemProps {
  name: string;
  preview: ReactNode;
  dragData: TimelineDragData;
  onDragStart?: ({ e }: { e: React.DragEvent }) => void;
  onAddToTimeline?: ({ currentTime }: { currentTime: number }) => void;
  onClick?: () => void;
  aspectRatio?: number;
  className?: string;
  containerClassName?: string;
  shouldShowPlusOnDrag?: boolean;
  shouldShowLabel?: boolean;
  isRounded?: boolean;
  variant?: 'card' | 'compact';
  isDraggable?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
}

export function DraggableItem({
  name,
  preview,
  dragData,
  onDragStart,
  onAddToTimeline,
  onClick,
  aspectRatio = 16 / 9,
  className = '',
  containerClassName,
  shouldShowPlusOnDrag = true,
  shouldShowLabel = true,
  variant = 'card',
  isDraggable = true,
  isHighlighted = false,
  isSelected = false,
}: DraggableItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const editor = useEditor();
  // mockup 口径：选中/高亮 = 仅缩略图 2px 描边（offset 1px），无底色、不套整卡
  // 视觉定义已收敛到 ve-theme.css §8（.ve-card-selected）

  const handleAddToTimeline = () => {
    onAddToTimeline?.({ currentTime: editor.playback.getCurrentTime() });
  };

  const emptyImg = new window.Image();
  emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';

  useEffect(() => {
    if (!isDragging) return;

    const handleDragOver = (e: DragEvent) => {
      setDragPosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener('dragover', handleDragOver);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
    };
  }, [isDragging]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setDragImage(emptyImg, 0, 0);

    setDragData({ dataTransfer: e.dataTransfer, dragData });
    e.dataTransfer.effectAllowed = 'copy';

    setDragPosition({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
    didDragRef.current = true;

    onDragStart?.({ e });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    clearDragData();
  };

  const handleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onClick?.();
  };

  return (
    <>
      {variant === 'card' ? (
        // biome-ignore lint/a11y/useSemanticElements: container wraps draggable content with nested interactive elements
        <div
          ref={dragRef}
          className={cn('group relative', containerClassName ?? 'size-28')}
          onClick={handleClick}
          onKeyUp={(event) => {
            if (event.key === 'Enter') handleClick();
          }}
          role="button"
          tabIndex={0}
        >
          <div
            className={cn(
              'relative flex h-auto w-full cursor-default flex-col gap-1 p-1',
              className,
            )}
          >
            <AspectRatio
              ratio={aspectRatio}
              className={cn(
                've-card-thumb',
                (isHighlighted || isSelected) && 've-card-selected',
                isDraggable && '[&::-webkit-drag-ghost]:opacity-0',
              )}
              draggable={isDraggable}
              onDragStart={isDraggable ? handleDragStart : undefined}
              onDragEnd={isDraggable ? handleDragEnd : undefined}
            >
              {preview}
              {!isDragging && (
                <PlusButton
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={handleAddToTimeline}
                />
              )}
            </AspectRatio>
            {shouldShowLabel && (
              <span className="ve-card-name w-full truncate text-left" title={name}>
                <span className="sr-only">{name}</span>
                <span aria-hidden="true">
                  {name.length > 8 ? `${name.slice(0, 16)}...${name.slice(-3)}` : name}
                </span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div ref={dragRef} className="group relative w-full">
          <button
            type="button"
            className={cn(
              'flex h-8 w-full cursor-default items-center gap-3 px-1',
              isDraggable && '[&::-webkit-drag-ghost]:opacity-0',
              className,
            )}
            draggable={isDraggable}
            onDragStart={isDraggable ? handleDragStart : undefined}
            onDragEnd={isDraggable ? handleDragEnd : undefined}
            onClick={handleClick}
          >
            <div
              className={cn(
                'size-6 flex-shrink-0 overflow-hidden rounded-[0.35rem]',
                (isHighlighted || isSelected) && 've-card-selected',
              )}
            >
              {preview}
            </div>
            <span className="w-full flex-1 truncate text-sm text-left">{name}</span>
          </button>
        </div>
      )}

      {isDraggable &&
        isDragging &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed z-9999"
            style={{
              left: dragPosition.x - 40,
              top: dragPosition.y - 40,
            }}
          >
            <div className="w-[80px]">
              <AspectRatio
                ratio={1}
                className="ring-primary relative overflow-hidden rounded-md shadow-2xl ring-3"
              >
                <div className="size-full [&_img]:size-full [&_img]:rounded-none [&_img]:object-cover">
                  {preview}
                </div>
                {shouldShowPlusOnDrag && (
                  <PlusButton
                    onClick={handleAddToTimeline}
                    tooltipText="Add to timeline or drag to position"
                  />
                )}
              </AspectRatio>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function PlusButton({
  className,
  onClick,
  tooltipText,
}: {
  className?: string;
  onClick?: () => void;
  tooltipText?: string;
}) {
  const button = (
    <Button
      size="icon"
      className={cn('ve-card-plus', className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      title={tooltipText}
    >
      <Plus />
    </Button>
  );

  if (tooltipText) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
