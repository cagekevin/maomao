'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import useDeepCompareEffect from 'use-deep-compare-effect';
import { X, Music, Maximize, MoreVertical, Pause, Play } from 'lucide-react';
import { useEditor } from '@videoEditor/hooks-cutia/use-editor';
import { useRafLoop } from '@videoEditor/hooks-cutia/use-raf-loop';
import { useContainerSize } from '@videoEditor/hooks-cutia/use-container-size';
import { useFullscreen } from '@videoEditor/hooks-cutia/use-fullscreen';
import { CanvasRenderer } from '@videoEditor/engine/services/renderer/canvas-renderer';
import type { RootNode } from '@videoEditor/engine/services/renderer/nodes/root-node';
import { buildScene } from '@videoEditor/engine/services/renderer/scene-builder';
import { formatTimeCode, getLastFrameTime } from '@videoEditor/engine/lib/time';
import { PreviewInteractionOverlay } from './preview-interaction-overlay';
import { EditableTimecode } from '@videoEditor/ui/editable-timecode';
import { invokeAction } from '@videoEditor/engine/lib/actions';
import { Button } from '@videoEditor/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@videoEditor/ui/ui/dropdown-menu';
import {
  handleMediaPreviewKeyDown,
  useMediaPreviewStore,
} from '@videoEditor/stores/media-preview-store';
import type { MediaAsset } from '@videoEditor/types/assets';
import { cn } from '@videoEditor/utils/ui';

function usePreviewSize() {
  const editor = useEditor();
  const activeProject = editor.project.getActive();

  return {
    width: activeProject?.settings.canvasSize.width,
    height: activeProject?.settings.canvasSize.height,
  };
}

function RenderTreeController() {
  const editor = useEditor();
  const tracks = editor.timeline.getTracks();
  const mediaAssets = editor.media.getAssets();
  const activeProject = editor.project.getActive();

  const { width, height } = usePreviewSize();

  useDeepCompareEffect(() => {
    if (!activeProject) return;

    const duration = editor.timeline.getTotalDuration();
    const renderTree = buildScene({
      tracks,
      mediaAssets,
      duration,
      canvasSize: { width, height },
      fitCanvasSize: activeProject.settings.originalCanvasSize ?? {
        width,
        height,
      },
      background: activeProject.settings.background,
    });

    editor.renderer.setRenderTree({ renderTree });
  }, [
    tracks,
    mediaAssets,
    activeProject?.settings.background,
    activeProject?.settings.originalCanvasSize,
    width,
    height,
  ]);

  return null;
}

export function PreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen({ containerRef });
  const editor = useEditor();
  const selectedMediaId = useMediaPreviewStore((state) => state.selectedMediaId);
  const clearSelection = useMediaPreviewStore((state) => state.clearSelection);

  const selectedAsset = useMemo(() => {
    if (!selectedMediaId) return null;
    return editor.media.getAssets().find((asset) => asset.id === selectedMediaId) ?? null;
  }, [selectedMediaId, editor.media]);

  useEffect(() => {
    if (!selectedAsset) return;

    window.addEventListener('keydown', handleMediaPreviewKeyDown);
    return () => window.removeEventListener('keydown', handleMediaPreviewKeyDown);
  }, [selectedAsset]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'panel bg-background relative flex h-full min-h-0 w-full min-w-0 flex-col border-x border-t',
        isFullscreen && 'bg-background',
      )}
    >
      {selectedAsset ? (
        <>
          <PreviewHeader assetName={selectedAsset.name} onClose={clearSelection} />
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-2">
            <AssetPreviewPlayer asset={selectedAsset} />
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-2 pb-0">
            <PreviewCanvas />
            <RenderTreeController />
          </div>
          <PreviewToolbar isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
        </>
      )}
    </div>
  );
}

function PreviewHeader({ assetName, onClose }: { assetName: string; onClose: () => void }) {
  return (
    <div className="flex h-9 items-center justify-between border-b px-3">
      <span className="text-muted-foreground truncate text-xs">正在预览: {assetName}</span>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="size-6"
        onClick={onClose}
        title="关闭预览"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function AssetPreviewPlayer({ asset }: { asset: MediaAsset }) {
  const url = asset.url ?? '';

  if (asset.type === 'video') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {/* biome-ignore lint/a11y/useMediaCaption: preview playback */}
        <video
          key={asset.id}
          src={url}
          controls
          autoPlay
          className="max-h-full max-w-full rounded"
        />
      </div>
    );
  }

  if (asset.type === 'image') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {/* biome-ignore lint: blob URLs don't work with Next.js Image */}
        <img src={url} alt={asset.name} className="max-h-full max-w-full rounded object-contain" />
      </div>
    );
  }

  if (asset.type === 'audio') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <Music className="text-muted-foreground size-16" />
        <span className="text-muted-foreground text-sm">{asset.name}</span>
        {/* biome-ignore lint/a11y/useMediaCaption: preview playback */}
        <audio key={asset.id} src={url} controls autoPlay className="w-64" />
      </div>
    );
  }

  return null;
}

function exportCurrentFrame({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const renderTree = editor.renderer.getRenderTree();
  if (!renderTree) return;

  const activeProject = editor.project.getActive();
  if (!activeProject) return;

  const { width, height } = activeProject.settings.canvasSize;
  const fps = activeProject.settings.fps;
  const currentTime = editor.playback.getCurrentTime();

  const renderer = new CanvasRenderer({ width, height, fps });
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;

  renderer
    .renderToCanvas({
      node: renderTree,
      time: currentTime,
      targetCanvas: tempCanvas,
    })
    .then(() => {
      tempCanvas.toBlob((blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeProject.metadata.name}-frame.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    });
}

function PreviewToolbar({
  isFullscreen,
  onToggleFullscreen,
}: {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const editor = useEditor();
  const isPlaying = editor.playback.getIsPlaying();
  const currentTime = editor.playback.getCurrentTime();
  const totalDuration = editor.timeline.getTotalDuration();
  const fps = editor.project.getActive().settings.fps;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center px-5 py-2">
      <div className="flex items-center mt-1">
        <EditableTimecode
          time={currentTime}
          duration={totalDuration}
          format="HH:MM:SS:FF"
          fps={fps}
          onTimeChange={({ time }) => editor.playback.seek({ time })}
          className="text-center"
        />
        <span className="text-muted-foreground px-2 font-mono text-xs">/</span>
        <span className="text-muted-foreground font-mono text-xs">
          {formatTimeCode({
            timeInSeconds: totalDuration,
            format: 'HH:MM:SS:FF',
            fps,
          })}
        </span>
      </div>

      <Button
        variant="text"
        size="icon"
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => invokeAction('toggle-play')}
      >
        {isPlaying ? <Pause /> : <Play />}
      </Button>

      <div className="flex items-center gap-1 justify-self-end">
        <Button
          variant="text"
          size="icon"
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          <Maximize />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="text"
              size="icon"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              title={'更多选项'}
            >
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            <DropdownMenuItem onClick={() => exportCurrentFrame({ editor })}>
              {'导出当前帧'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFrameRef = useRef(-1);
  const lastSceneRef = useRef<RootNode | null>(null);
  const renderingRef = useRef(false);
  const { width: nativeWidth, height: nativeHeight } = usePreviewSize();
  const containerSize = useContainerSize({ containerRef });
  const editor = useEditor();
  const activeProject = editor.project.getActive();

  const renderer = useMemo(() => {
    return new CanvasRenderer({
      width: nativeWidth,
      height: nativeHeight,
      fps: activeProject.settings.fps,
    });
  }, [nativeWidth, nativeHeight, activeProject.settings.fps]);

  const displaySize = useMemo(() => {
    if (!nativeWidth || !nativeHeight || containerSize.width === 0 || containerSize.height === 0) {
      return { width: nativeWidth ?? 0, height: nativeHeight ?? 0 };
    }

    const paddingBuffer = 4;
    const availableWidth = containerSize.width - paddingBuffer;
    const availableHeight = containerSize.height - paddingBuffer;

    const aspectRatio = nativeWidth / nativeHeight;
    const containerAspect = availableWidth / availableHeight;

    const displayWidth =
      containerAspect > aspectRatio ? availableHeight * aspectRatio : availableWidth;
    const displayHeight =
      containerAspect > aspectRatio ? availableHeight : availableWidth / aspectRatio;

    return { width: displayWidth, height: displayHeight };
  }, [nativeWidth, nativeHeight, containerSize.width, containerSize.height]);

  const renderTree = editor.renderer.getRenderTree();

  const render = useCallback(() => {
    if (canvasRef.current && renderTree && !renderingRef.current) {
      const time = editor.playback.getCurrentTime();
      const lastFrameTime = getLastFrameTime({
        duration: renderTree.duration,
        fps: renderer.fps,
      });
      const renderTime = Math.min(time, lastFrameTime);
      const frame = Math.floor(renderTime * renderer.fps);

      if (frame !== lastFrameRef.current || renderTree !== lastSceneRef.current) {
        renderingRef.current = true;
        lastSceneRef.current = renderTree;
        lastFrameRef.current = frame;
        renderer
          .renderToCanvas({
            node: renderTree,
            time: renderTime,
            targetCanvas: canvasRef.current,
          })
          .then(() => {
            renderingRef.current = false;
          });
      }
    }
  }, [renderer, renderTree, editor.playback]);

  useRafLoop(render);

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center">
      <div className="relative" style={{ width: displaySize.width, height: displaySize.height }}>
        <canvas
          ref={canvasRef}
          width={nativeWidth}
          height={nativeHeight}
          className="block border"
          style={{
            width: displaySize.width,
            height: displaySize.height,
            background:
              activeProject.settings.background.type === 'blur'
                ? 'transparent'
                : activeProject?.settings.background.color,
          }}
        />
        <PreviewInteractionOverlay canvasRef={canvasRef} displaySize={displaySize} />
      </div>
    </div>
  );
}
