// VideoToGifNode - 视频转GIF节点
// 原版函数名: Gs (L16746-L17022)
import { memo, useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Position, useReactFlow, useHandleConnections, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Film, Upload, AlertCircle, Loader2, Zap } from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';
import type { AppNode } from '../types';

// TODO: 外部依赖函数 - 需要从原版中提取
// Ws: 获取连接节点的第一个资源 URL
// Rs: 获取视频时长 (videoUrl: string) => Promise<number>
// Ls: 视频转 GIF (videoUrl: string, options: {...}) => Promise<{ blob: Blob; width: number; height: number; frameCount: number; size: number }>
// Us: 格式化文件大小 (bytes: number) => string

// TODO: 配置常量 - 需要从原版中提取
const resolutionOptions = [240, 360, 480, 720]; // zs
const fpsOptions = [5, 10, 15, 20, 25, 30]; // Bs
const speedOptions = [ // Vs
  { value: 0.5, label: '0.5x' },
  { value: 0.75, label: '0.75x' },
  { value: 1, label: '1x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
];
const colorOptions = [ // Hs
  { value: 64, label: '64色' },
  { value: 128, label: '128色' },
  { value: 256, label: '256色' },
];

function formatFileSize(bytes: number): string {
  // TODO: Us - 实现文件大小格式化
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface VideoToGifNodeData {
  videoUrl?: string;
  videoName?: string;
  fps?: number;
  maxSize?: number;
  colors?: number;
  speed?: number;
  loading?: boolean;
  progress?: number;
  errorMessage?: string;
  resultInfo?: {
    width: number;
    height: number;
    frameCount: number;
    size: number;
  };
  onAddImage?: (nodeId: string, url: string) => void;
  onSpawnImageNode?: (nodeId: string, url: string, type: string) => void;
  onShowToast?: (msg: string) => void;
  [key: string]: unknown;
}

function VideoToGifNode({ id, data, selected }: NodeProps<AppNode>) {
  const { updateNodeData } = useReactFlow();
  const nodeData = data as unknown as VideoToGifNodeData;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fps, setFps] = useState(nodeData.fps || 10);
  const [maxSize, setMaxSize] = useState(nodeData.maxSize || 480);
  const [colors, setColors] = useState(nodeData.colors || 256);
  const [speed, setSpeed] = useState(nodeData.speed || 1);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  const targetConnections = useHandleConnections({ type: 'target' });
  const sourceIds = useMemo(() => targetConnections.map((conn) => conn.source), [targetConnections]);
  const prevUrlRef = useRef('');

  // Effect: 同步连接的视频 URL
  useEffect(() => {
    // TODO: Ws - 获取连接节点的第一个资源 URL
    // const url = getFirstConnectedResourceUrl(Array.isArray(sourceIds) ? sourceIds : sourceIds ? [sourceIds] : []);
    const url: string | undefined = undefined; // TODO: 替换为 Ws 调用
    if (url && url !== prevUrlRef.current) {
      prevUrlRef.current = url;
      let name = `connected_video.mp4`;
      try {
        const parsed = new URL(url).pathname.split(`/`).pop();
        if (parsed && parsed.includes(`.`)) {
          name = parsed;
        }
      } catch { /* ignore */ }
      updateNodeData(id, {
        videoUrl: url,
        videoName: name,
        errorMessage: undefined,
      });
    } else if (!url && prevUrlRef.current) {
      prevUrlRef.current = '';
      updateNodeData(id, {
        videoUrl: undefined,
        videoName: undefined,
      });
    }
  }, [sourceIds, id, updateNodeData]);

  // Effect: 获取视频时长
  useEffect(() => {
    if (!nodeData.videoUrl) {
      setDuration(0);
      return;
    }
    let cancelled = false;
    // TODO: Rs - 获取视频时长
    // getVideoDuration(nodeData.videoUrl).then((dur) => {
    //   if (!cancelled && dur) {
    //     setDuration(dur);
    //     setStartTime(0);
    //     setEndTime(dur);
    //   }
    // }).catch(() => {});
    Promise.resolve(undefined).then((dur: unknown) => {
      if (!cancelled && dur) {
        setDuration(dur as number);
        setStartTime(0);
        setEndTime(dur as number);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [nodeData.videoUrl]);

  // Effect: 同步参数到节点数据
  useEffect(() => {
    updateNodeData(id, {
      fps,
      maxSize,
      colors,
      speed,
    });
  }, [fps, maxSize, colors, speed, id, updateNodeData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    nodeData.onAddImage?.(id, url);
    e.target.value = '';
  };

  const handleGenerate = useCallback(async () => {
    const videoUrl = nodeData.videoUrl;
    if (!videoUrl) {
      nodeData.onShowToast?.(`请先上传视频或连接包含视频的节点`);
      return;
    }
    updateNodeData(id, {
      loading: true,
      progress: 0,
      errorMessage: undefined,
      resultInfo: undefined,
    });
    try {
      // TODO: Ls - 视频转 GIF
      // const result = await convertVideoToGif(videoUrl, {
      //   fps,
      //   maxSize,
      //   colors,
      //   speed,
      //   startTime: duration ? startTime : 0,
      //   endTime: duration ? endTime : undefined,
      //   onProgress: (p) => updateNodeData(id, { progress: Math.round(p * 100) }),
      // });
      // const blobUrl = URL.createObjectURL(result.blob);
      // updateNodeData(id, {
      //   loading: false,
      //   progress: 100,
      //   resultInfo: {
      //     width: result.width,
      //     height: result.height,
      //     frameCount: result.frameCount,
      //     size: result.size,
      //   },
      // });
      // nodeData.onSpawnImageNode?.(id, blobUrl, 'GIF');
      console.warn('TODO: convertVideoToGif not implemented');
    } catch (err: unknown) {
      const error = err as Error | null;
      updateNodeData(id, {
        loading: false,
        errorMessage: error?.message || `GIF 生成失败`,
      });
      nodeData.onShowToast?.(error?.message || `GIF 生成失败`);
    }
  }, [nodeData.videoUrl, fps, maxSize, colors, speed, startTime, endTime, duration, id, updateNodeData, nodeData]);

  const isLoading = !!nodeData.loading;
  const hasResult = !!nodeData.resultInfo;
  const hasVideo = !!nodeData.videoUrl;

  return (
    <div className={`relative group/node w-full h-full min-w-[300px] min-h-[200px]`}>
      <NodeTitle
        id={id}
        data={data}
        defaultTitle={`视频转GIF`}
        icon={
          <Film
            size={11}
            className={`text-gray-500`}
          />
        }
        floating={true}
      />
      <NodeResizer
        isVisible={!!selected}
        minWidth={300}
        minHeight={200}
      />
      <div className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <CustomHandle
          type={`target`}
          position={Position.Left}
        />
        <input
          type={`file`}
          ref={fileInputRef}
          style={{ display: `none` }}
          accept={`video/*`}
          onChange={handleFileChange}
        />
        <div className={`flex-1 p-3 flex flex-col gap-2.5`}>
          {!hasVideo && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`}
            >
              <Upload size={20} />
              <span className={`text-[11px]`}>上传视频 或 左侧连接视频节点</span>
            </button>
          )}
          {nodeData.errorMessage && (
            <div className={`flex items-center gap-1.5 text-[11px] text-red-400`}>
              <AlertCircle
                size={13}
                className={`shrink-0`}
              />
              <span className={`break-words`}>{nodeData.errorMessage}</span>
            </div>
          )}
          <div className={`grid grid-cols-4 gap-2`}>
            <label className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              清晰度
              <select
                value={maxSize}
                onChange={(e) => setMaxSize(Number(e.target.value))}
                className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}
              >
                {resolutionOptions.map((val) => (
                  <option key={val} value={val}>{val}p</option>
                ))}
              </select>
            </label>
            <label className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              帧率
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}
              >
                {fpsOptions.map((val) => (
                  <option key={val} value={val}>{val} fps</option>
                ))}
              </select>
            </label>
            <label className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              速度
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}
              >
                {speedOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <label className={`nodrag flex flex-col gap-1 text-[10px] text-gray-500`}>
              色彩
              <select
                value={colors}
                onChange={(e) => setColors(Number(e.target.value))}
                className={`nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]`}
              >
                {colorOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
          </div>
          {duration > 0 && (
            <div className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
              <span className={`shrink-0`}>裁剪</span>
              <input
                type={`range`}
                min={0}
                max={duration}
                step={0.1}
                value={startTime}
                onChange={(e) => setStartTime(Math.min(parseFloat(e.target.value), endTime - 0.1))}
                className={`nodrag flex-1 accent-blue-500`}
              />
              <input
                type={`range`}
                min={0}
                max={duration}
                step={0.1}
                value={endTime}
                onChange={(e) => setEndTime(Math.max(parseFloat(e.target.value), startTime + 0.1))}
                className={`nodrag flex-1 accent-blue-500`}
              />
              <span className={`shrink-0 tabular-nums w-20 text-right`}>
                {startTime.toFixed(1)}-{endTime.toFixed(1)}s
              </span>
            </div>
          )}
          {nodeData.resultInfo && (
            <div className={`text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`}>
              <span>{nodeData.resultInfo.width}×{nodeData.resultInfo.height}</span>
              <span>·</span>
              <span>{nodeData.resultInfo.frameCount} 帧</span>
              <span>·</span>
              <span className={`text-blue-400`}>{formatFileSize(nodeData.resultInfo.size)}</span>
            </div>
          )}
          <div className={`mt-auto flex items-center gap-2`}>
            {hasVideo && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`}
                title={`重新上传视频`}
              >
                <Upload size={14} />
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !hasVideo}
              className={`nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
            >
              {isLoading ? (
                <Fragment>
                  <Loader2
                    size={13}
                    className={`animate-spin`}
                  />
                  {' '}生成中 {nodeData.progress || 0}%
                </Fragment>
              ) : (
                <Fragment>
                  <Zap size={13} />
                  {' '}{hasResult ? '重新免费生成' : '免费生成'}
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

export default memo(VideoToGifNode);
