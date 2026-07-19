// ============================================================
// 一毛AI画布 - 音频播放器节点（AudioPlayerNode）
// 严格复刻原版 App.js L13404-L13581 结构
// ============================================================
import { memo, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { NodeProps, Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeData, AppNode } from '../types';
import CustomHandle from './CustomHandle';
import NodeTitle from './NodeTitle';
import ResizeController from './ResizeController';
import { Download, X, Upload } from 'lucide-react';

// ====== SVG Icons (lucide style) ======

function AudioIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

// ====== Audio Player Component ======

interface AudioPlayerProps {
  playUrl: string;
  loading: boolean;
  error: string;
}

function AudioPlayer({ playUrl, loading, error }: AudioPlayerProps) {
  // TODO: implement audio player component
  return (
    <div className="w-full h-full flex items-center justify-center">
      {loading ? (
        <div className="text-gray-500 text-xs">加载中...</div>
      ) : error ? (
        <div className="text-red-400 text-xs">{error}</div>
      ) : (
        <audio src={playUrl} controls className="w-full outline-none" />
      )}
    </div>
  );
}

// ====== Main Component ======

interface AudioPlayerNodeData extends NodeData {
  audioUrl?: string;
  audioName?: string;
}

function AudioPlayerNode({ id, data, selected }: NodeProps<AppNode>) {
  const { updateNodeData } = useReactFlow();
  const nodeData = data as AudioPlayerNodeData;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetConnections = useHandleConnections({ type: 'target' });
  const connectedAudioUrl = useMemo(() => {
    const connections = Array.isArray(targetConnections) ? targetConnections : targetConnections ? [targetConnections] : [];
    for (const conn of connections) {
      const audioUrl = // TODO: implement ls function to extract audio URL from connected node
        conn?.data;
      if (audioUrl) return audioUrl;
    }
    return '';
  }, [targetConnections]);

  const audioUrl = connectedAudioUrl || nodeData.audioUrl || '';
  const [playUrl, setPlayUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const blobUrlRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    const cleanup = () => {
      if (blobUrlRef.current) {
        try {
          URL.revokeObjectURL(blobUrlRef.current);
        } catch {}
        blobUrlRef.current = '';
      }
    };

    if (!audioUrl) {
      cleanup();
      setPlayUrl('');
      setError('');
      setLoading(false);
      return;
    }

    if (audioUrl.startsWith('data:') || audioUrl.startsWith('blob:')) {
      cleanup();
      setPlayUrl(audioUrl);
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    (async () => {
      try {
        const trimmedUrl = audioUrl.trim().replace(/^`+|`+$/g, '');
        const response = await fetch(trimmedUrl, {
          signal: abortController.signal
        });

        if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}`);

        const blob = await response.blob();

        if (cancelled) return;

        cleanup();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setPlayUrl(url);
        setLoading(false);
      } catch (err) {
        if (cancelled || (err as Error)?.name === 'AbortError') return;
        setPlayUrl(audioUrl);
        setError((err as Error)?.message || '加载失败，尝试直接播放');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        try {
          URL.revokeObjectURL(blobUrlRef.current);
        } catch {}
      }
    };
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    updateNodeData(id, {
      audioUrl: URL.createObjectURL(file),
      audioName: file.name
    });
  }, [id, updateNodeData]);

  const handleClear = useCallback(() => {
    updateNodeData(id, {
      audioUrl: undefined,
      audioName: undefined
    });
  }, [id, updateNodeData]);

  const audioName = nodeData.audioName || (audioUrl ? decodeURIComponent(audioUrl.split('/').pop()?.split('?')[0] || '音频') : '');
  const hasAudio = !!audioUrl;

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioUrl) return;

    try {
      const link = document.createElement('a');
      if (audioUrl.startsWith('blob:') || audioUrl.startsWith('data:')) {
        link.href = audioUrl;
      } else {
        const blob = await (await fetch(audioUrl.trim().replace(/^`+|`+$/g, ''))).blob();
        link.href = URL.createObjectURL(blob);
      }
      link.download = audioName || 'audio';
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (link.href.startsWith('blob:') && !audioUrl.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      }
    } catch {}
  }, [audioUrl, audioName]);

  return (
    <div className={`relative flex flex-col items-center group/node transition-all ${selected ? 'z-50' : 'z-10'}`} style={{ width: '100%', height: '100%', minWidth: 320, minHeight: 200 }}>
      <NodeTitle
        id={id}
        data={nodeData}
        defaultTitle="音频"
        icon={<AudioIcon size={11} className="text-gray-500" />}
      />

      {hasAudio && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4">
          <div className="flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg">
            <button
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md"
              title="下载音频"
              onClick={handleDownload}
            >
              <Download size={14} />
            </button>
            {!connectedAudioUrl && (
              <button
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md"
                title="清除"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 flex flex-col w-full h-full ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}`}>
        <CustomHandle type="target" position={Position.Left} variant="small" />
        <CustomHandle type="source" position={Position.Right} variant="small" />

        <div className="flex-1 flex flex-col rounded-xl overflow-hidden min-h-0">
          {hasAudio ? (
            <AudioPlayer playUrl={playUrl} loading={loading} error={error} />
          ) : (
            <div
              className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-400 cursor-pointer bg-[#151515] transition-colors nodrag"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={26} />
              <span className="text-[12px]">点击上传音频</span>
              <span className="text-[10px] text-gray-600">或从左侧连线接入</span>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.flac,.aac,.opus,.m4a,.wma,.aiff"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.currentTarget.value = '';
          }}
        />

        <ResizeController minWidth={320} minHeight={200} />
      </div>
    </div>
  );
}

export default memo(AudioPlayerNode);