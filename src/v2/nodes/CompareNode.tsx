// CompareNode - 对比工具节点
// 原版函数名: Lc (L18501-L18811)
import { memo, useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Columns2,
  ArrowLeftRight,
  ArrowUpDown,
  RotateCcw,
  Pause,
  Play,
  Loader2,
  ImageDown,
  Video,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';
import ResizeController from './ResizeController';
import type { AppNode } from '../types';

// TODO: implement - Ic: 从节点数据中提取资源 URL
// function Ic(data: any): string | null { ... }
const extractResourceUrl = (_data: unknown): string | null => {
  // TODO: implement
  return null;
};

// TODO: implement - Fc: 检测媒体类型
// function Fc(url: string): 'video' | 'image' { ... }
const detectMediaKind = (_url: string): 'video' | 'image' => {
  // TODO: implement
  return 'image';
};

// TODO: implement - ii: 上传 data URL 并返回 URL
// function ii(dataUrl: string | Blob, options?: { preferThumbnail?: boolean; subfolder?: string }): Promise<{ url: string }> { ... }
const uploadDataUrl = async (
  _dataUrl: string | Blob,
  _options?: { preferThumbnail?: boolean; subfolder?: string },
): Promise<{ url: string }> => {
  // TODO: implement
  throw new Error('Not implemented: uploadDataUrl');
};

// TODO: implement - Mc: 创建对比画布
// function Mc(elementA: HTMLVideoElement | HTMLImageElement, elementB: HTMLVideoElement | HTMLImageElement, options: { mode: string; orientation: string; split: number; drawDivider: boolean }): Promise<Blob> { ... }
const createComparisonCanvas = async (
  _elA: HTMLVideoElement | HTMLImageElement,
  _elB: HTMLVideoElement | HTMLImageElement,
  _options: { mode: string; orientation: string; split: number; drawDivider: boolean },
): Promise<Blob> => {
  // TODO: implement
  throw new Error('Not implemented: createComparisonCanvas');
};

// TODO: implement - Pc: 录制对比视频
// function Pc(options: { a: HTMLVideoElement | HTMLImageElement; b: HTMLVideoElement | HTMLImageElement; mode: string; orientation: string; durationMs: number; fps: number; onProgress: (p: number) => void }): Promise<{ blob: Blob; ext: string }> { ... }
const recordComparisonVideo = async (
  _options: {
    a: HTMLVideoElement | HTMLImageElement;
    b: HTMLVideoElement | HTMLImageElement;
    mode: string;
    orientation: string;
    durationMs: number;
    fps: number;
    onProgress: (p: number) => void;
  },
): Promise<{ blob: Blob; ext: string }> => {
  // TODO: implement
  throw new Error('Not implemented: recordComparisonVideo');
};

interface CompareNodeData {
  split?: number;
  orientation?: string;
  labelA?: string;
  labelB?: string;
  onSpawnImageNode?: (nodeId: string, url: string, label: string) => void;
  onShowToast?: (msg: string) => void;
  [key: string]: unknown;
}

function CompareNode({ id, data, selected }: NodeProps<AppNode>) {
  const { updateNodeData, getNodes } = useReactFlow();
  const nodeData = data as unknown as CompareNodeData;
  const [split, setSplit] = useState(nodeData.split ?? 0.5);
  const [orientation, setOrientation] = useState(nodeData.orientation || `v`);
  const [isPlaying, setIsPlaying] = useState(false);
  const [busyState, setBusyState] = useState(``);
  const [recordProgress, setRecordProgress] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const imgARef = useRef<HTMLImageElement>(null);
  const imgBRef = useRef<HTMLImageElement>(null);

  const targetConnections = useHandleConnections({ type: `target` });

  const [mediaA, mediaB] = useMemo(() => {
    const allNodes = getNodes();
    const results: Array<{ url: string; kind: 'video' | 'image' }> = [];
    for (const conn of targetConnections) {
      const node = allNodes.find((n) => n.id === conn.source);
      const url = extractResourceUrl(node?.data);
      if (url && !results.some((r) => r.url === url) && results.push({
        url,
        kind: detectMediaKind(url),
      }), results.length >= 2) break;
    }
    return [results[0] || null, results[1] || null];
  }, [targetConnections, getNodes]);

  useEffect(() => {
    updateNodeData(id, {
      split,
      orientation,
    });
  }, [split, orientation, id, updateNodeData]);

  const updateSplitFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = orientation === `v` ? (clientX - rect.left) / rect.width : (clientY - rect.top) / rect.height;
    setSplit(Math.max(0, Math.min(1, ratio)));
  }, [orientation]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateSplitFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    isDraggingRef.current && updateSplitFromPointer(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const hasVideo = mediaA?.kind === `video` || mediaB?.kind === `video`;
  const hasBoth = !!mediaA && !!mediaB;
  const labelA = nodeData.labelA || `A`;
  const labelB = nodeData.labelB || `B`;

  const togglePlay = useCallback(() => {
    const shouldPlay = !isPlaying;
    setIsPlaying(shouldPlay);
    [videoARef.current, videoBRef.current].forEach((v) => {
      v && (shouldPlay ? v.play().catch(() => {}) : v.pause());
    });
  }, [isPlaying]);

  const syncVideoTime = useCallback(() => {
    const a = videoARef.current;
    const b = videoBRef.current;
    a && b && Math.abs(a.currentTime - b.currentTime) > 0.15 && (b.currentTime = a.currentTime);
  }, []);

  const handleReset = () => {
    setSplit(0.5);
    [videoARef.current, videoBRef.current].forEach((v) => {
      v && (v.currentTime = 0);
    });
  };

  const getMediaElements = useCallback((): [HTMLVideoElement | HTMLImageElement, HTMLVideoElement | HTMLImageElement] | null => {
    const a = mediaA?.kind === `video` ? videoARef.current : imgARef.current;
    const b = mediaB?.kind === `video` ? videoBRef.current : imgBRef.current;
    return !a || !b ? null : [a, b];
  }, [mediaA, mediaB]);

  const handleExportImage = useCallback(async () => {
    const els = getMediaElements();
    if (els) {
      setBusyState(`export`);
      try {
        const canvasBlob = await createComparisonCanvas(els[0], els[1], {
          mode: `slider`,
          orientation,
          split,
          drawDivider: true,
        });
        const uploaded = await uploadDataUrl(canvasBlob, {
          preferThumbnail: true,
          subfolder: `canvas/compare`,
        });
        nodeData.onSpawnImageNode?.(id, uploaded.url, `对比图`);
        nodeData.onShowToast?.(`已生成对比图节点`);
      } catch (err: unknown) {
        const error = err as Error | null;
        nodeData.onShowToast?.(error?.message || `生成对比图失败`);
      } finally {
        setBusyState(``);
      }
    }
  }, [getMediaElements, orientation, split, id, nodeData]);

  const handleRecordVideo = useCallback(async () => {
    const els = getMediaElements();
    if (els) {
      setBusyState(`record`);
      setRecordProgress(0);
      try {
        const {
          blob,
          ext,
        } = await recordComparisonVideo({
          a: els[0],
          b: els[1],
          mode: `slider`,
          orientation,
          durationMs: 4000,
          fps: 30,
          onProgress: (p) => setRecordProgress(Math.round(p * 100)),
        });
        const uploaded = await uploadDataUrl(blob, {
          subfolder: `canvas/compare`,
        });
        const finalUrl = /\.(mp4|webm|mov)($|\?)/i.test(uploaded.url) ? uploaded.url : `${uploaded.url}#.${ext}`;
        nodeData.onSpawnImageNode?.(id, finalUrl, `对比视频`);
        nodeData.onShowToast?.(`已生成对比视频节点，可连「视频转GIF」转 GIF`);
      } catch (err: unknown) {
        const error = err as Error | null;
        nodeData.onShowToast?.(error?.message || `录制失败`);
      } finally {
        setBusyState(``);
        setRecordProgress(0);
      }
    }
  }, [getMediaElements, orientation, id, nodeData]);

  const renderMedia = (media: { url: string; kind: 'video' | 'image' } | null, isA: boolean) => {
    if (!media) return null;
    return media.kind === `video` ? (
      <video
        ref={isA ? videoARef : videoBRef}
        src={media.url}
        crossOrigin={`anonymous`}
        className={`absolute inset-0 w-full h-full object-contain bg-black`}
        muted={true}
        loop={true}
        playsInline={true}
        onTimeUpdate={isA ? syncVideoTime : undefined}
      />
    ) : (
      <img
        ref={isA ? imgARef : imgBRef}
        src={media.url}
        crossOrigin={`anonymous`}
        alt={isA ? `A` : `B`}
        className={`absolute inset-0 w-full h-full object-contain bg-black`}
        draggable={false}
      />
    );
  };

  return (
    <div className={`relative group/node w-full h-full min-w-[360px] min-h-[300px]`}>
      <NodeTitle
        id={id}
        data={data}
        defaultTitle={`对比工具`}
        icon={
          <Columns2
            size={11}
            className={`text-gray-500`}
          />
        }
        floating={true}
      />
      <ResizeController
        visible={!!selected}
        minWidth={360}
        minHeight={300}
      />
      <div className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <CustomHandle
          type={`target`}
          position={Position.Left}
        />
        <div
          className={`relative flex-1 m-2 rounded-lg overflow-hidden bg-black select-none`}
        >
          {hasBoth ? (
            <div
              ref={containerRef}
              className={`nodrag absolute inset-0`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                cursor: orientation === `v` ? `ew-resize` : `ns-resize`,
                touchAction: `none`,
              }}
            >
              {renderMedia(mediaB, false)}
              <div
                className={`absolute inset-0`}
                style={{
                  clipPath: orientation === `v` ? `inset(0 ${(1 - split) * 100}% 0 0)` : `inset(0 0 ${(1 - split) * 100}% 0)`,
                }}
              >
                {renderMedia(mediaA, true)}
              </div>
              <div
                className={`absolute bg-white/90 shadow-[0_0_6px_rgba(0,0,0,0.6)] pointer-events-none`}
                style={orientation === `v` ? {
                  left: `${split * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  transform: `translateX(-1px)`,
                } : {
                  top: `${split * 100}%`,
                  left: 0,
                  right: 0,
                  height: 2,
                  transform: `translateY(-1px)`,
                }}
              >
                <div
                  className={`absolute bg-white rounded-full flex items-center justify-center shadow-lg text-[#141414]`}
                  style={orientation === `v` ? {
                    top: `50%`,
                    left: `50%`,
                    width: 26,
                    height: 26,
                    transform: `translate(-50%, -50%)`,
                  } : {
                    left: `50%`,
                    top: `50%`,
                    width: 26,
                    height: 26,
                    transform: `translate(-50%, -50%)`,
                  }}
                >
                  {orientation === `v` ? (
                    <ArrowLeftRight
                      size={14}
                    />
                  ) : (
                    <ArrowUpDown
                      size={14}
                    />
                  )}
                </div>
              </div>
              <span
                className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white pointer-events-none`}
              >
                {labelA}
              </span>
              <span
                className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white pointer-events-none`}
              >
                {labelB}
              </span>
            </div>
          ) : (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500`}
            >
              <Columns2
                size={24}
              />
              <span className={`text-[11px]`}>
                连接 2 个图片 / 视频节点进行对比
              </span>
              <span className={`text-[10px] text-gray-600`}>
                {`已连接 `}
                {[mediaA, mediaB].filter(Boolean).length}
                {` / 2`}
              </span>
            </div>
          )}
        </div>
        <div className={`flex items-center gap-2 px-2.5 pb-2.5`}>
          <button
            onClick={() => setOrientation((o) => o === `v` ? `h` : `v`)}
            className={`nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`}
            title={orientation === `v` ? `切换为上下对比` : `切换为左右对比`}
          >
            {orientation === `v` ? (
              <ArrowLeftRight
                size={14}
              />
            ) : (
              <ArrowUpDown
                size={14}
              />
            )}
          </button>
          <button
            onClick={handleReset}
            className={`nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`}
            title={`重置`}
          >
            <RotateCcw
              size={14}
            />
          </button>
          {hasVideo && (
            <button
              onClick={togglePlay}
              disabled={!hasBoth}
              className={`nodrag flex items-center justify-center h-7 w-7 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`}
              title={isPlaying ? `暂停` : `播放`}
            >
              {isPlaying ? (
                <Pause
                  size={14}
                />
              ) : (
                <Play
                  size={14}
                />
              )}
            </button>
          )}
          <div className={`ml-auto flex items-center gap-1.5`}>
            <button
              onClick={handleExportImage}
              disabled={!hasBoth || !!busyState}
              className={`nodrag flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`}
              title={`生成对比图节点`}
            >
              {busyState === `export` ? (
                <Loader2
                  size={13}
                  className={`animate-spin`}
                />
              ) : (
                <ImageDown
                  size={13}
                />
              )}
              {` 导图`}
            </button>
            <button
              onClick={handleRecordVideo}
              disabled={!hasBoth || !!busyState}
              className={`nodrag flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-[11px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 transition-colors`}
              title={`生成对比视频节点（可连视频转GIF）`}
            >
              {busyState === `record` ? (
                <Fragment>
                  <Loader2
                    size={13}
                    className={`animate-spin`}
                  />
                  {` `}
                  {recordProgress}
                  {`%`}
                </Fragment>
              ) : (
                <Fragment>
                  <Video
                    size={13}
                  />
                  {` 生成视频`}
                </Fragment>
              )}
            </button>
          </div>
        </div>
        <CustomHandle
          type={`source`}
          position={Position.Right}
          id={`main-output`}
        />
      </div>
    </div>
  );
}

export default memo(CompareNode);