import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Clapperboard,
  Copy,
  Download,
  Settings,
  Camera,
  AlertCircle,
  Upload,
  Loader2,
} from 'lucide-react';
import NodeShell from '../base/ui/NodeShell.tsx';
import { useContentHeightSync } from '../base/core/uiHooks.ts';
import GenerateButton from '../base/ui/GenerateButton.tsx';
import { useConnectedInputs } from '../../hooks/useConnectedInputs.ts';
import { useMediaDegrade } from '../../hooks/useMediaDegrade.ts';
import { showToast } from '../base/core/toastStore.ts';
import { contentSet } from '../base/core/contentStore.ts';
import { useNodeData } from '../../hooks/useNodeData.ts';
import '../base/api/index.ts';
import { useRenderImageResolver } from '../base/utils/imageUrl.ts';
import { downloadUrl } from '../base/utils/clipboard.ts';
import { logger } from '../base/core/logger.ts';
import { classifyError } from '../base/utils/genErrors.ts';
import previewUrls from '../base/utils/previewUrl.ts';

/** 多窗口剪贴板存储键（contracts.ts STORAGE_KEYS 登记，集中避免裸键） */
const MULTIWINDOW_CLIPBOARD_KEY = 'mutiwindow-clipboard';

/**
 * 视频抽帧节点（复刻官方 ec.jsx / videoExtractNode）。
 *
 * 结构（外壳统一到 NodeShell，业务内容放在 children）：
 *   <NodeShell minWidth=280 minHeight=mode-dependent handleVariant=small>  ← 标题/端口/背景/缩放/尺寸订阅全内置
 *     <input type=file hidden />
 *     <div flex-1 flex flex-col overflow-hidden relative>         ← 内容+底部 一体（Component1462）
 *       <div flex-1 bg-surface-black p-4 ...>                     ← 内容区（Component1428）
 *       <div p-4 bg-surface ...>                                  ← 底部（Component1461）
 *     </div>
 *   </NodeShell>
 *
 * 功能：
 *  - 视频来源：上传视频文件 或 从直接上游节点自动获取（videoUrl / imageUrl / text 里的视频链接）
 *  - 5 种抽帧模式：固定数量 / 等距 / 智能转场 / 首尾帧 / 手动截取
 *  - 用 canvas.drawImage 抽帧，输出 JPEG base64 缩略图网格
 *  - 单帧/全部复制（mutiwindow-images 格式，可 Ctrl+V 粘贴成图片节点）
 *  - 带进度条、错误提示
 */
/** 视频抽帧节点 data 契约 */
interface VideoExtractNodeData {
  label?: string;
  mode?: string;
  frameCount?: number;
  intervalSec?: number;
  sensitivity?: number;
  videoUrl?: string;
  videoName?: string;
  extractedImages?: string[];
  [key: string]: unknown;
}

interface VideoExtractNodeProps {
  id: string;
  data: VideoExtractNodeData;
  selected?: boolean;
}

/**
 * computeTimes 的返回形态。
 * 智能模式返回 times=[] + duration/threshold（交回主流程边扫边截）；
 * 其余模式返回时间点列表（duration/threshold 填 0）。
 * 用单一形态而非判别联合：此处按 smart 分流的收窄在现有 tsconfig 下不可靠，
 * 统一形态可让两条分支都直接取字段，行为不变。
 */
interface ExtractTimes {
  smart: boolean;
  times: number[];
  duration: number;
  threshold: number;
}

function VideoExtractNode({ id, data, selected }: VideoExtractNodeProps) {
  const connected = useConnectedInputs(id);
  const { isHidden } = useMediaDegrade();
  const hideVideo = isHidden('video');
  const render = useRenderImageResolver();

  // 模式与参数
  const [mode, setMode] = useState(data.mode || 'count');
  const [frameCount, setFrameCount] = useState(data.frameCount || 9);
  const [intervalSec, setIntervalSec] = useState(data.intervalSec || 2);
  const [sensitivity, setSensitivity] = useState(data.sensitivity || 30);

  // 视频来源
  const [file, setFile] = useState<File | null>(null); // 上传的 File
  const [videoUrl, setVideoUrl] = useState(data.videoUrl || '');
  const [videoName, setVideoName] = useState(data.videoName || '');

  // 卸载时释放预览 Blob URL，避免内存泄漏（对齐 VideoProcessNode / AgentPanel）
  useEffect(
    () => () => {
      previewUrls.release(videoUrl);
    },
    [videoUrl],
  );

  // 抽帧结果
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [extractedImages, setExtractedImages] = useState(data.extractedImages || []);
  // 结果落盘唯一入口（P0-2 收口）：本地处理无 server 任务，不走 useNodeGeneration，
  // 抽帧结果写 node.data.extractedImages 随画布快照落盘恢复（对齐 CONTEXT 真相源契约 ③文本类例外）。
  const { patchData } = useNodeData(id);
  // 原子防重入（对齐 useNodeGeneration R4）：同步 ref 防快速双击并发抽帧
  const extractingRef = useRef(false);

  // 高度自适应（对齐剧本盒子 ScriptBoxNode 范式 + useContentHeightSync 的 wrapperRef 统一修复）：
  // NodeShell 只订阅渲染 node.width/height，不负责写回；若 node.height 不跟随内容高度写回，
  // ReactFlow wrapper(.react-flow__node) 高度会滞后于视觉框，连接节点的 conic 跑马灯
  // （index.css .react-flow__node::before 用 inset 锚定 wrapper）就会高度不贴合。
  // 必须传 wrapperRef（NodeShell 根 div，含标题栏）作测量基准——若只绑内容区会漏标题栏，
  // 写回的 node.height 比视觉框矮（停在最后内容底部）。syncWidth 保持宽度贴合。
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useContentHeightSync(null, id, {
    minHeight: mode === 'manual' ? 380 : 220,
    fallbackWidth: 420,
    syncWidth: true,
    wrapperRef,
  });

  // 手动模式：播放器 + 帧轨道
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 从上游自动获取视频链接（对齐官方 ec.jsx 的连接检测）
  const upstreamVideo = connected.videos?.[0]?.url || '';
  useEffect(() => {
    if (file) return; // 手动上传优先
    const detected = upstreamVideo || '';
    if (detected && detected !== videoUrl) {
      setVideoUrl(detected);
      setVideoName(extractName(detected));
      setErrorMessage('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamVideo]);

  function extractName(url: string) {
    if (url.startsWith('data:video/')) return 'base64_video.mp4';
    try {
      const u = new URL(url);
      const n = u.pathname.split('/').pop();
      return n && n.includes('.') ? n + u.search : url;
    } catch {
      return url;
    }
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    previewUrls.release(videoUrl); // 替换前释放旧预览，避免计数错位
    setVideoUrl(previewUrls.create(f));
    setVideoName(f.name);
    setErrorMessage('');
    setExtractedImages([]);
    patchData({ extractedImages: [] }); // 换素材清空落盘结果，防旧帧残留
    setProgress(0);
    e.target.value = '';
  };

  // 抽一帧（seek 后 drawImage 到 canvas → base64）
  const seekTo = useCallback((video: HTMLVideoElement, time: number) => {
    return new Promise<string>((resolve, reject) => {
      let done = false;
      const onSeeked = () => {
        if (done) return;
        done = true;
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onErr);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Canvas not supported');
          let w = video.videoWidth;
          let h = video.videoHeight;
          if (w === 0 || h === 0) throw new Error('Video dimensions not available');
          // 限制最大 800，保持比例
          if (w > 800 || h > 800) {
            if (w > h) {
              h = Math.round((h * 800) / w);
              w = 800;
            } else {
              w = Math.round((w * 800) / h);
              h = 800;
            }
          }
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch (err) {
          reject(err);
        }
      };
      const onErr = () => {
        if (done) return;
        done = true;
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onErr);
        reject(new Error('Video load failed'));
      };
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onErr);
      video.currentTime = time;
    });
  }, []);

  // 智能检测：16×16 缩略图像素差
  const smartCapture = useCallback((video: HTMLVideoElement, time: number) => {
    return new Promise<Uint8ClampedArray>((resolve, reject) => {
      let done = false;
      const onSeeked = () => {
        if (done) return;
        done = true;
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onErr);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 16;
          canvas.height = 16;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Canvas not supported');
          ctx.drawImage(video, 0, 0, 16, 16);
          resolve(ctx.getImageData(0, 0, 16, 16).data);
        } catch (err) {
          reject(err);
        }
      };
      const onErr = () => {
        if (done) return;
        done = true;
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onErr);
        reject(new Error('Video load failed'));
      };
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onErr);
      video.currentTime = time;
    });
  }, []);

  // 计算抽帧时间点列表
  function computeTimes(
    duration: number,
    mode: string,
    count: number,
    interval: number,
    sens: number,
  ): ExtractTimes {
    const times: number[] = [];
    if (mode === 'count') {
      const n = Math.max(1, count);
      const step = duration / (n + 1);
      for (let i = 1; i <= n; i++) times.push(i * step);
    } else if (mode === 'interval') {
      const step = Math.max(0.5, interval);
      for (let t = step; t < duration; t += step) times.push(t);
    } else if (mode === 'first_last') {
      times.push(0, Math.max(0, duration - 0.1));
    } else if (mode === 'smart') {
      // 0.5s 步进扫描 16×16 像素差
      const threshold = (0.01 + Math.pow((100 - sens) / 100, 2) * 0.24) * 195840;
      // 智能模式在主流程里单独处理（需要边扫描边截帧），这里返回空由调用方特殊处理
      return { smart: true, times, duration, threshold };
    }
    return { smart: false, times, duration: 0, threshold: 0 };
  }

  const startExtract = async () => {
    if (!videoUrl && !file) {
      showToast('请先上传视频或连接包含视频的节点');
      return;
    }
    // 【防重入】同步 ref 原子防重：快速双击时第二次立即被拒，避免并发抽帧（对齐 useNodeGeneration R4）
    if (extractingRef.current) return;
    extractingRef.current = true;
    // 仅当本次用上传 File 现场创建预览 URL 时才需在收尾释放；否则 src 即为状态里的 videoUrl，
    // 生命周期已由组件卸载/替换素材时的 release 管理，此处不重复 revoke。
    const ownUrl = file ? previewUrls.create(file) : null;
    const src = ownUrl || videoUrl;
    setLoading(true);
    setErrorMessage('');
    setProgress(0);
    setExtractedImages([]);
    // 结果落盘：先清旧帧（失败/中途刷新为空态，不残留旧结果）
    patchData({ extractedImages: [] });
    logger.debug('抽帧', 'start', { nodeId: id, mode, source: ownUrl ? 'file' : 'url' });
    try {
      const video = document.createElement('video');
      video.src = src;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror = () => rej(new Error('无法加载视频'));
      });
      const dur = video.duration;
      if (!dur || isNaN(dur) || dur === Infinity) throw new Error('无法获取视频时长');

      // 手动模式：引导在播放器中截取
      if (mode === 'manual') {
        setLoading(false);
        showToast('手动模式请直接在上方播放器中截取');
        return;
      }

      const times = computeTimes(dur, mode, frameCount, intervalSec, sensitivity);
      const frames: string[] = [];
      if (!times.smart) {
        // 固定数量 / 等距 / 首尾帧：按时间点列表逐帧截取
        const list = times.times;
        for (let i = 0; i < list.length; i++) {
          setProgress(50 + Math.round((i / list.length) * 50));
          frames.push(await seekTo(video, list[i]));
          setExtractedImages([...frames]);
        }
      } else {
        // 智能转场检测
        const threshold = times.threshold;
        let prev: Uint8ClampedArray | null = null;
        const allTimes: number[] = [];
        for (let t = 0.5; t < times.duration; t += 0.5) {
          setProgress(Math.round((t / times.duration) * 50));
          const data = await smartCapture(video, t);
          if (prev) {
            let diff = 0;
            for (let i = 0; i < data.length; i += 4) {
              diff += Math.abs(data[i] - prev[i]);
              diff += Math.abs(data[i + 1] - prev[i + 1]);
              diff += Math.abs(data[i + 2] - prev[i + 2]);
            }
            if (diff > threshold) {
              allTimes.push(t);
              t += 1;
              prev = await smartCapture(video, t);
              continue;
            }
          }
          prev = data;
        }
        if (allTimes.length === 0) allTimes.push(times.duration / 2);
        for (let i = 0; i < allTimes.length; i++) {
          setProgress(50 + Math.round((i / allTimes.length) * 50));
          frames.push(await seekTo(video, allTimes[i]));
          setExtractedImages([...frames]);
        }
      }
      setProgress(100);
      setLoading(false);
      // 结果落盘：最终帧数组一次性写 node.data（逐帧仅 state 实时预览，避免高频大数组写快照）
      patchData({ extractedImages: frames });
      logger.debug('抽帧', 'done', { nodeId: id, frames: frames.length });
      showToast(`抽帧完成！共提取 ${frames.length} 张图片`);
      video.src = '';
      video.load();
    } catch (err) {
      // 【R7 错误分类记录】抽帧异常经 classifyError 统一分类（本地处理多为 business；加载远程视频失败为 network），
      // 分类结果进日志供排查；message 原样透传（错误透传铁律），UI 错误态仍走 errorMessage 节点展示。
      const cls = classifyError(err);
      logger.error('VideoExtractNode', 'Frame extraction failed', {
        error: err?.message,
        errType: cls.type,
        retryable: cls.retryable,
      });
      setLoading(false);
      setErrorMessage(err.message || '抽帧失败，可能是视频格式或跨域限制');
    } finally {
      // 收尾释放本次现场创建的预览 URL，避免重复上传/抽帧累积泄漏（P2-5）
      if (ownUrl) previewUrls.release(ownUrl);
      extractingRef.current = false; // 防重入复位
    }
  };

  const manualCapture = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas not supported');
      let w = v.videoWidth;
      let h = v.videoHeight;
      if (w > 800 || h > 800) {
        if (w > h) {
          h = Math.round((h * 800) / w);
          w = 800;
        } else {
          w = Math.round((w * 800) / h);
          h = 800;
        }
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(v, 0, 0, w, h);
      const img = canvas.toDataURL('image/jpeg', 0.8);
      // 手动截取是低频用户操作：state 与 node.data 同步追加（结果落盘，刷新不丢）
      const next = [...extractedImages, img];
      setExtractedImages(next);
      patchData({ extractedImages: next });
      showToast('已截取当前帧');
    } catch {
      showToast('截取失败，可能是跨域限制或视频未就绪');
    }
  };

  const copySingle = async (img: string) => {
    try {
      const payload = JSON.stringify({ type: 'mutiwindow-images', images: [img] });
      try {
        await navigator.clipboard.writeText(payload);
      } catch {
        contentSet(MULTIWINDOW_CLIPBOARD_KEY, payload);
      }
      showToast('已复制当前帧，请在空白处粘贴 (Ctrl+V)');
    } catch {
      showToast('复制失败');
    }
  };

  const copyAll = async () => {
    if (!extractedImages.length) {
      showToast('没有提取出的图片可复制');
      return;
    }
    try {
      const payload = JSON.stringify({ type: 'mutiwindow-images', images: extractedImages });
      try {
        await navigator.clipboard.writeText(payload);
      } catch {
        contentSet(MULTIWINDOW_CLIPBOARD_KEY, payload);
      }
      showToast(`已复制 ${extractedImages.length} 张图片`);
    } catch {
      showToast('复制失败');
    }
  };

  return (
    /* 外壳统一到 NodeShell：标题/端口/背景/圆角/边框/阴影/缩放手柄/尺寸订阅全部内置。
       抽帧节点是内容自适应（高度随 mode 取 minHeight，宽度默认 420 可拖拽调整），
       所以 minHeight/defaultHeight 按 mode 切换；端口用 NodeShell 默认 small 左右口。 */
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="视频抽帧"
      icon={<Clapperboard size={11} className="text-muted" />}
      selected={selected}
      minWidth={280}
      minHeight={mode === 'manual' ? 380 : 220}
      handleVariant="small"
      wrapperRef={wrapperRef}
      className="min-w-[280px]"
      style={{ minHeight: mode === 'manual' ? 380 : 220 }}
    >
      {/* 隐藏文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        style={{ display: 'none' }}
        onChange={onUpload}
      />

      {/* 内容+底部 一体容器（对齐官方 Component1462）。
          参照 ImageBoxNode 成熟范式：NodeShell 主容器不加 overflow-hidden，
          children 主容器负责 overflow 裁剪，圆角由内部内容区/底部块各自提供：
          顶部 → 内容区 rounded-t-xl + overflow-x-hidden 裁出上圆角（y 轴保留滚动）；
          底部 → 底部块 rounded-b-xl + overflow-hidden 裁出下圆角。 */}
      <div className="relative w-full flex flex-col">
        {/* 内容区（对齐官方 Component1428）：内容自然撑高，节点整体高度由 useContentHeightSync 测
              NodeShell 根 div（wrapperRef，含标题栏）写回 node.height，保证跑马灯贴合。 */}
        <div className="bg-surface-black p-4 relative border-b border-edge-faint flex flex-col gap-4 rounded-t-xl">
          {extractedImages.length > 0 && (
            <button
              onClick={copyAll}
              className="absolute top-2 right-2 z-10 text-caption-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 h-6 px-2 rounded bg-surface-1/90 hover:bg-surface-hover-strong transition-colors cursor-pointer border-none"
            >
              <Copy size={12} /> 复制全部
            </button>
          )}

          {errorMessage && (
            <div className="flex flex-col items-center justify-center min-h-[120px] gap-2 text-red-400 p-4 text-center">
              <AlertCircle size={24} />
              <span className="text-xs break-words">{errorMessage}</span>
            </div>
          )}

          {mode === 'manual' && videoUrl && !errorMessage && (
            <div className="flex flex-col gap-3 bg-surface p-3 rounded-lg border border-edge flex-shrink-0">
              {!hideVideo && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  crossOrigin="anonymous"
                  className="w-full aspect-video bg-black rounded"
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  playsInline
                  muted
                  controls
                />
              )}
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => {
                    if (videoRef.current)
                      videoRef.current.currentTime = Math.max(
                        0,
                        videoRef.current.currentTime - 0.033,
                      );
                  }}
                  className="h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer"
                  title="后退1帧"
                >
                  -1帧
                </button>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.01"
                  value={currentTime}
                  onChange={(e) => {
                    if (videoRef.current) videoRef.current.currentTime = Number(e.target.value);
                  }}
                  className="flex-1 accent-white min-w-0"
                />
                <button
                  onClick={() => {
                    if (videoRef.current)
                      videoRef.current.currentTime = Math.min(
                        duration,
                        videoRef.current.currentTime + 0.033,
                      );
                  }}
                  className="h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer"
                  title="前进1帧"
                >
                  +1帧
                </button>
                <button
                  onClick={manualCapture}
                  className="px-4 py-1.5 bg-white hover:bg-gray-200 rounded-md text-black font-medium ml-2 flex-shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer border-none"
                >
                  <Camera size={14} /> 截取
                </button>
              </div>
            </div>
          )}

          {!errorMessage && extractedImages.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs text-secondary font-medium">
                  已提取 {extractedImages.length} 帧
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3 auto-rows-max">
                {extractedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="aspect-video bg-black rounded-lg border relative group/img border-edge overflow-hidden"
                  >
                    <img
                      src={render(img)}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copySingle(img);
                        }}
                        className="p-2 bg-surface-1 hover:bg-white rounded-full text-body hover:text-black transition-all shadow-lg cursor-pointer border-none"
                        title="复制为新节点 (Ctrl+V粘贴)"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            downloadUrl(img, `frame-${idx + 1}.jpg`);
                          } catch {}
                        }}
                        className="p-2 bg-surface-1 hover:bg-white rounded-full text-body hover:text-black transition-all shadow-lg cursor-pointer border-none"
                        title="下载"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !errorMessage && (mode !== 'manual' || !videoUrl) ? (
            <div className="flex items-center justify-center min-h-[120px]">
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={24} className="animate-spin text-secondary" />
                  <span className="text-xs text-secondary">正在处理... {progress}%</span>
                  <div className="w-32 h-1 bg-surface-hover-strong rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted">等待提取</span>
              )}
            </div>
          ) : null}
        </div>

        {/* 底部（对齐官方 Component1461） */}
        {/* 底部（对齐官方 Component1461）：白色配置区，rounded-b-xl + overflow-hidden 裁出下圆角 */}
        <div className="p-4 bg-surface flex flex-col gap-4 nodrag border-t border-edge-faint rounded-b-xl overflow-hidden">
          {videoUrl ? (
            <div className="w-full flex items-center justify-between bg-surface-black rounded-lg px-3 py-2.5 border border-edge">
              <div className="flex items-center gap-2 overflow-hidden">
                <Clapperboard size={16} className="text-secondary flex-shrink-0" />
                <span className="text-xs text-body truncate" title={videoName}>
                  {videoName || '已连接视频'}
                </span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-caption-sm text-body hover:text-white flex-shrink-0 ml-2 h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded transition-colors cursor-pointer"
              >
                替换视频
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 rounded-xl border-2 border-dashed border-edge bg-surface-black hover:bg-surface hover:border-edge-strong flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
            >
              <div className="p-3 bg-surface-1 rounded-full">
                <Upload size={18} className="text-secondary" />
              </div>
              <span className="text-xs text-secondary font-medium">点击上传视频或连接节点</span>
            </div>
          )}

          {showConfig && (
            <div className="flex flex-col gap-4 bg-surface-black border border-edge rounded-lg p-4 mt-1">
              <div className="flex flex-col gap-2">
                <span className="text-caption-sm text-secondary font-medium">抽帧模式</span>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-surface-1 border border-edge rounded-md px-3 py-2 text-xs text-primary outline-none focus:border-white transition-colors"
                >
                  <option value="count">固定数量 (均匀分布)</option>
                  <option value="interval">等距抽帧 (间隔秒数)</option>
                  <option value="smart">智能转场检测</option>
                  <option value="first_last">首尾帧 (第一帧和最后一帧)</option>
                  <option value="manual">手动截取 (拖动轨道截取)</option>
                </select>
              </div>
              {mode === 'count' && (
                <div className="flex flex-col gap-2">
                  <span className="text-caption-sm text-secondary font-medium">提取总张数</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={frameCount}
                    onChange={(e) => setFrameCount(Number(e.target.value))}
                    className="w-full bg-surface-1 border border-edge rounded-md px-3 py-2 text-xs text-primary outline-none focus:border-white transition-colors"
                  />
                </div>
              )}
              {mode === 'interval' && (
                <div className="flex flex-col gap-2">
                  <span className="text-caption-sm text-secondary font-medium">间隔秒数 (秒)</span>
                  <input
                    type="number"
                    min="0.5"
                    max="3600"
                    step="0.5"
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Number(e.target.value))}
                    className="w-full bg-surface-1 border border-edge rounded-md px-3 py-2 text-xs text-primary outline-none focus:border-white transition-colors"
                  />
                </div>
              )}
              {mode === 'smart' && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span className="text-caption-sm text-secondary font-medium">检测敏感度</span>
                    <span className="text-caption-sm text-muted">{sensitivity}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={sensitivity}
                    onChange={(e) => setSensitivity(Number(e.target.value))}
                    className="w-full accent-white"
                  />
                  <span className="text-caption text-muted">数值越高越容易触发截图</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center mt-1">
            <button
              className={`flex items-center gap-1.5 h-6 px-2 rounded text-caption-sm transition-colors cursor-pointer border ${showConfig ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-transparent hover:bg-surface-hover border-transparent hover:border-edge text-body'}`}
              onClick={() => setShowConfig(!showConfig)}
              title="参数配置"
            >
              <Settings size={12} />
              <span className="font-medium">{showConfig ? '收起配置' : '配置'}</span>
            </button>
            {mode !== 'manual' && (
              /* 主操作按钮统一到生图节点的 GenerateButton（胶囊 + 白圆箭头，颜色/尺寸/loading 态与生图完全一致）。
                   不做置灰/半透明：GenerateButton 始终显示正常色（与生图一致），
                   无视频时仅 onGenerate 拦截并 toast，避免出现生图没有的置灰态导致颜色观感不同。 */
              <GenerateButton
                label="开始处理"
                showCost={false}
                loading={loading}
                onGenerate={() => {
                  if (videoUrl && !loading) startExtract();
                  else if (!videoUrl) showToast('请先上传或连接视频');
                }}
                onStop={() => setLoading(false)}
              />
            )}
          </div>
        </div>
      </div>
    </NodeShell>
  );
}
export default React.memo(VideoExtractNode);
