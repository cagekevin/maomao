// ============================================================
// 一毛AI画布 - 图片/媒体展示节点（ImageNode）
// 严格复刻原版 App.js L2001-2337 结构
// ============================================================
import { memo, useMemo, useRef, useState, useCallback } from 'react';
import { NodeProps, Position, useReactFlow } from '@xyflow/react';
import type { NodeData, AppNode } from '../types';
import CustomHandle from './CustomHandle';
import NodeTitle from './NodeTitle';
import ResizeController from './ResizeController';

// ====== SVG Icons (lucide style) ======

function ImageIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function VideoIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function AudioIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function FileTextIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15" />
      <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ====== Media type ======
type MediaType = 'image' | 'video' | 'audio' | 'text' | 'empty';

// ====== Component ======
function ImageNode({ id, data, selected, width }: NodeProps<AppNode>) {
  const { updateNodeData } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageError, setImageError] = useState(false);
  const [isVideoHovered, setIsVideoHovered] = useState(false);

  // 判断 mediaType
  const mediaType: MediaType = useMemo(() => {
    const url: string = (data.imageUrl as string) || '';
    if (!url) return 'empty';
    if (url.startsWith('data:video/')) return 'video';
    if (url.startsWith('data:audio/')) return 'audio';
    if (url.startsWith('data:text/')) return 'text';
    const videoExts = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
    const audioExts = ['.mp3', '.wav', '.ogg', '.flac', '.aac'];
    const textExts = ['.txt', '.json', '.csv', '.md'];
    const lower = url.toLowerCase();
    if (videoExts.some((ext) => lower.includes(ext))) return 'video';
    if (audioExts.some((ext) => lower.includes(ext))) return 'audio';
    if (textExts.some((ext) => lower.includes(ext))) return 'text';
    return 'image';
  }, [data.imageUrl]);

  // 是否为 http URL
  const isHttpUrl = useMemo(() => {
    const url: string = (data.imageUrl as string) || '';
    return url.startsWith('http://') || url.startsWith('https://');
  }, [data.imageUrl]);

  // 标题配置
  const titleConfig = useMemo(() => {
    switch (mediaType) {
      case 'video':
        return { title: '视频', icon: <VideoIcon /> };
      case 'audio':
        return { title: '音频', icon: <AudioIcon /> };
      case 'text':
        return { title: '文本文件', icon: <FileTextIcon /> };
      case 'image':
        return { title: '图片', icon: <ImageIcon /> };
      default:
        return { title: '图片', icon: <ImageIcon /> };
    }
  }, [mediaType]);

  // 文件上传处理
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        updateNodeData(id, { imageUrl: result });
        setImageError(false);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [id, updateNodeData],
  );

  // 触发文件选择
  const triggerUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 复制 URL
  const handleCopyUrl = useCallback(() => {
    const url: string = (data.imageUrl as string) || '';
    if (url) {
      navigator.clipboard.writeText(url);
      (data.onShowToast as ((msg: string) => void) | undefined)?.('URL 已复制');
    }
  }, [data.imageUrl, data.onShowToast]);

  // 下载
  const handleDownload = useCallback(() => {
    const url: string = (data.imageUrl as string) || '';
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `download_${Date.now()}`;
    a.click();
  }, [data.imageUrl]);

  // URL 转 Base64
  const handleUrlToBase64 = useCallback(() => {
    const url: string = (data.imageUrl as string) || '';
    if (!url) return;
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          updateNodeData(id, { imageUrl: reader.result as string });
        };
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        (data.onShowToast as ((msg: string) => void) | undefined)?.('转换失败');
      });
  }, [data.imageUrl, id, updateNodeData, data.onShowToast]);

  return (
    <div className="relative group/node w-full h-full min-w-[120px] min-h-[80px]">
      {/* si - 节点标题栏 */}
      <NodeTitle
        id={id}
        data={data as unknown as Record<string, unknown>}
        defaultTitle={titleConfig.title}
        icon={titleConfig.icon}
      />

      {/* ci - Resize 控制器 */}
      <ResizeController visible={!!selected} />

      {/* 隐藏 file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,text/plain"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 悬浮工具栏 */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4">
        <div className="flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg">
          {/* 上传/替换 */}
          <button
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
            onClick={triggerUpload}
            title="上传/替换"
          >
            <UploadIcon />
          </button>

          {/* 放大 - image/empty */}
          {(mediaType === 'image' || mediaType === 'empty') && (
            <button
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
              onClick={() => (data.onZoom as (() => void) | undefined)?.()}
              title="放大"
            >
              <ZoomInIcon />
            </button>
          )}

          {/* 裁剪 - image/empty */}
          {(mediaType === 'image' || mediaType === 'empty') && (
            <button
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
              onClick={() => (data.onCrop as (() => void) | undefined)?.()}
              title="裁剪"
            >
              <CropIcon />
            </button>
          )}

          {/* 编辑 - image/empty */}
          {(mediaType === 'image' || mediaType === 'empty') && (
            <button
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
              onClick={() => (data.onEdit as (() => void) | undefined)?.()}
              title="编辑"
            >
              <EditIcon />
            </button>
          )}

          {/* URL转Base64 - http URL + image */}
          {isHttpUrl && mediaType === 'image' && (
            <button
              className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-[#333] rounded-md"
              onClick={handleUrlToBase64}
              title="URL转Base64"
            >
              <LinkIcon />
            </button>
          )}

          {/* 分隔线 */}
          <div className="w-px h-4 bg-[#333] mx-1" />

          {/* 发送到网站 */}
          <button
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
            onClick={() => (data.onSendToActiveTab as (() => void) | undefined)?.()}
            title="发送到网站"
          >
            <SendIcon />
          </button>

          {/* 复制URL */}
          <button
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
            onClick={handleCopyUrl}
            title="复制URL"
          >
            <CopyIcon />
          </button>

          {/* 下载 */}
          <button
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
            onClick={handleDownload}
            title="下载"
          >
            <DownloadIcon />
          </button>
        </div>
      </div>

      {/* 主内容卡片 */}
      <div
        className={`bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 w-full h-full flex flex-col ${
          selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'
        }`}
      >
        {/* CustomHandle target Left */}
        <CustomHandle type="target" position={Position.Left} variant="large" />

        {/* 内容展示区 */}
        <div className="flex-1 p-0 bg-[#121212] flex items-center justify-center relative overflow-hidden">
          {/* image */}
          {mediaType === 'image' && !imageError && (
            <img
              src={data.imageUrl as string}
              alt=""
              className="w-full h-full object-contain"
              onDoubleClick={() =>
                (data.onZoom as (() => void) | undefined)?.()
              }
              onError={() => setImageError(true)}
            />
          )}

          {/* image error fallback */}
          {mediaType === 'image' && imageError && (
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <ImageIcon size={24} />
              <span className="text-[11px]">加载失败</span>
            </div>
          )}

          {/* video */}
          {mediaType === 'video' && (
            <video
              src={data.imageUrl as string}
              className="w-full h-full object-contain"
              controls={isVideoHovered}
              autoPlay={isVideoHovered}
              muted={!isVideoHovered}
              preload="none"
              onMouseEnter={() => setIsVideoHovered(true)}
              onMouseLeave={() => setIsVideoHovered(false)}
            />
          )}

          {/* audio */}
          {mediaType === 'audio' && (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <AudioIcon size={32} />
              <audio
                src={data.imageUrl as string}
                controls
                className="w-3/4"
              />
            </div>
          )}

          {/* text */}
          {mediaType === 'text' && (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <FileTextIcon size={32} />
              <span className="text-[11px]">文本/数据文件</span>
            </div>
          )}

          {/* empty */}
          {mediaType === 'empty' && (
            <div
              className="flex flex-col items-center justify-center gap-2 w-full h-full border-2 border-dashed border-[#333] rounded-lg cursor-pointer hover:border-[#555] transition-colors"
              onClick={triggerUpload}
            >
              <ImageIcon size={24} />
              <span className="text-[11px] text-gray-500">点击上传</span>
            </div>
          )}
        </div>

        {/* CustomHandle source Right */}
        <CustomHandle type="source" position={Position.Right} variant="large" />
      </div>
    </div>
  );
}

export default memo(ImageNode);