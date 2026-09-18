'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import useDeepCompareEffect from 'use-deep-compare-effect';
import { X, Music, Maximize, MoreVertical, Pause, Play } from 'lucide-react';
import { useEditor } from '@/components/videoEditor/hooks-cutia/use-editor';
import { useRafLoop } from '@/components/videoEditor/hooks-cutia/use-raf-loop';
import { useContainerSize } from '@/components/videoEditor/hooks-cutia/use-container-size';
import { useFullscreen } from '@/components/videoEditor/hooks-cutia/use-fullscreen';
import { CanvasRenderer } from '@/components/videoEditor/engine/services/renderer/canvas-renderer';
import type { RootNode } from '@/components/videoEditor/engine/services/renderer/nodes/root-node';
import { buildScene } from '@/components/videoEditor/engine/services/renderer/scene-builder';
import { formatTimeCode, getLastFrameTime } from '@/components/videoEditor/engine/lib/time';
import { PreviewInteractionOverlay } from './preview-interaction-overlay';
import { EditableTimecode } from '@/components/videoEditor/ui/editable-timecode';
import { invokeAction } from '@/components/videoEditor/engine/lib/actions';
import { Button } from '@/components/videoEditor/ui/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/videoEditor/ui/ui/dropdown-menu';
import {
  handleMediaPreviewKeyDown,
  useMediaPreviewStore,
} from '@/components/videoEditor/stores/media-preview-store';
import type { MediaAsset } from '@/components/videoEditor/types/assets';
import { cn } from '@/components/videoEditor/utils/ui';
import { useMediaLoadFailed } from '@/components/base/utils/useMediaLoadFailed.ts';
// 【TD-06-14】canvas 异步产出走唯一出口；失败必须**可见**（原 `if (!blob) return;` = 点了导出什么都没发生）。
import { canvasToBlob } from '@/components/base/core/utils';
import { toast } from '@/components/videoEditor/lib/toast';
import { MissingMediaIndicator } from '@/components/videoEditor/ui/editor/panels/timeline/missing-media-indicator';

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
  // 【2026-09-17 TD-16-29②】三个媒体元素此前**全裸**（无 onError）：素材文件缺失 / 4xx / 解码失败时
  // 浏览器只给黑框（video）/ 裂图或 alt（img）/ 控件可见但静音（audio）—— 用户与开发者
  // 都**无法区分**「还没加载」与「已损坏」。现共用 `useMediaLoadFailed` 显式失败态。
  const url = asset.url ?? '';
  const { failed, onError } = useMediaLoadFailed(asset.url, '预览素材', {
    id: asset.id,
    type: asset.type,
  });

  if (failed) {
    // 失败时**不再**渲染媒体元素（否则黑框/静音控件与占位同屏，等于没说清）
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <MissingMediaIndicator kind="source-unavailable" name={asset.name} className="max-w-md" />
      </div>
    );
  }

  if (asset.type === 'video') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {/* biome-ignore lint/a11y/useMediaCaption: preview playback */}
        <video
          key={asset.id}
          src={url}
          controls
          autoPlay
          onError={onError}
          className="max-h-full max-w-full rounded"
        />
      </div>
    );
  }

  if (asset.type === 'image') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        {/* biome-ignore lint: blob URLs don't work with Next.js Image */}
        <img
          src={url}
          alt={asset.name}
          onError={onError}
          className="max-h-full max-w-full rounded object-contain"
        />
      </div>
    );
  }

  if (asset.type === 'audio') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4">
        <Music className="text-muted-foreground size-16" />
        <span className="text-muted-foreground text-sm">{asset.name}</span>
        {/* biome-ignore lint/a11y/useMediaCaption: preview playback */}
        <audio key={asset.id} src={url} controls autoPlay onError={onError} className="w-64" />
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
    .then(() => canvasToBlob(tempCanvas, 'image/png'))
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeProject.metadata.name}-frame.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    })
    .catch((e: unknown) => {
      // 【TD-06-14】失败必须诚实可见：原实现是 `if (!blob) return;` —— 用户点了"导出当前帧"，
      //   什么都没发生、零提示零留痕（最难排查的一类假成功）。文案由本动作（所有方）给全。
      toast.error('导出当前帧失败', { description: (e as { message?: string })?.message });
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
