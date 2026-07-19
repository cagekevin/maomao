// ============================================================
// 一毛AI画布 - 听音断句节点（AudioNode）
// 严格复刻原版 App.js L12802-L13217 结构
// ============================================================
import { memo, useMemo, useRef, useState, useEffect, useCallback, Fragment } from 'react';
import { NodeProps, Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeData, AppNode } from '../types';
import CustomHandle from './CustomHandle';
import NodeTitle from './NodeTitle';
import {
  Upload,
  X,
  Loader2,
  AlertCircle,
  Copy,
  FileAudio,
  Settings,
  Mic,
} from 'lucide-react';

// ====== External dependency stubs ======

// TODO: implement ss function - audio transcription API call
async function ss(
  _file: File,
  _apiUrl: string,
  _apiKey: string,
  _model: string,
  _prompt: string,
  _maxDuration: number,
  _pauseGap: number
): Promise<unknown[]> {
  // TODO: implement
  return [];
}

// TODO: implement Yn component - download URL button
function DownloadUrlButton({ url, fallbackExt, size, onToast }: { url: string; fallbackExt: string; size: number; onToast: (msg: string) => void }) {
  // TODO: implement
  return null;
}

// ====== Main Component ======

interface AudioNodeData extends NodeData {
  audioUrl?: string;
  audioName?: string;
  prompt?: string;
  maxDuration?: number;
  pauseGap?: number;
  audioApiUrl?: string;
  audioApiKey?: string;
  audioModel?: string;
  loading?: boolean;
  errorMessage?: string;
  chunks?: unknown[];
  text?: string;
  onGenerateAudio?: () => Promise<void>;
  onShowToast?: (msg: string) => void;
  onUpdateLabel?: (label: string) => void;
}

function AudioNode({ id, data, selected }: NodeProps<AppNode>) {
  const { updateNodeData, getNodes, getEdges } = useReactFlow();
  const nodeData = data as AudioNodeData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [prompt, setPrompt] = useState(nodeData.prompt || '请输出简体中文。');
  const [maxDuration, setMaxDuration] = useState(nodeData.maxDuration || 10);
  const [pauseGap, setPauseGap] = useState(nodeData.pauseGap || 0.3);

  useEffect(() => {
    updateNodeData(id, {
      prompt,
      maxDuration,
      pauseGap,
    });
  }, [prompt, maxDuration, pauseGap, id, updateNodeData]);

  const targetConnections = useHandleConnections({ type: 'target' });
  const connectedSources = useMemo(() => {
    return targetConnections.map((conn) => conn.source);
  }, [targetConnections]);

  const prevConnectedUrlRef = useRef('');

  useEffect(() => {
    if (localFile) return;

    const sources = Array.isArray(connectedSources) ? connectedSources : connectedSources ? [connectedSources] : [];
    let foundUrl = '';

    for (const sourceId of sources) {
      const sourceNode = // TODO: implement - get node data from sourceId
        null as unknown as { data: Record<string, unknown> };
      if (sourceNode?.data) {
        if (sourceNode.data.videoUrl && typeof sourceNode.data.videoUrl === 'string') {
          const url = sourceNode.data.videoUrl as string;
          if (url.startsWith('data:audio/') || url.startsWith('data:video/') || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(url)) {
            foundUrl = url;
            break;
          }
        }
        if (sourceNode.data.imageUrl && typeof sourceNode.data.imageUrl === 'string') {
          const url = sourceNode.data.imageUrl as string;
          if (url.startsWith('data:audio/') || url.startsWith('data:video/') || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(url)) {
            foundUrl = url;
            break;
          }
        }
        if (sourceNode.data.text && typeof sourceNode.data.text === 'string') {
          const match = (sourceNode.data.text as string).match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
          if (match) {
            foundUrl = match[0];
            break;
          }
        }
      }
    }

    if (foundUrl && foundUrl !== prevConnectedUrlRef.current) {
      prevConnectedUrlRef.current = foundUrl;
      let fileName = 'connected_audio.mp3';
      if (foundUrl.startsWith('data:audio/')) {
        fileName = 'base64_audio.mp3';
      } else {
        try {
          const urlObj = new URL(foundUrl);
          const pathName = urlObj.pathname.split('/').pop();
          fileName = pathName && pathName.length > 0 && pathName !== '/' && pathName.includes('.')
            ? pathName + urlObj.search
            : foundUrl;
        } catch {
          fileName = foundUrl;
        }
      }
      nodeData.audioUrl = foundUrl;
      nodeData.audioName = fileName;
      setPrompt((p) => p);
      updateNodeData(id, {
        audioUrl: foundUrl,
        audioName: fileName,
        errorMessage: undefined,
      });
    } else if (!foundUrl && prevConnectedUrlRef.current) {
      prevConnectedUrlRef.current = '';
      if (!localFile) {
        updateNodeData(id, {
          audioUrl: undefined,
          audioName: undefined,
        });
      }
    }
  }, [connectedSources, localFile, id, updateNodeData]);

  const handleGenerate = useCallback(async () => {
    let audioFile = localFile;

    if (!audioFile) {
      const edges = getEdges();
      const nodes = getNodes();
      const incomingEdges = edges.filter((edge) => edge.target === id);
      let connectedUrl = '';

      for (const edge of incomingEdges) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (sourceNode) {
          if (sourceNode.data.audioUrl && typeof sourceNode.data.audioUrl === 'string') {
            connectedUrl = sourceNode.data.audioUrl as string;
            break;
          }
          if (sourceNode.data.videoUrl && typeof sourceNode.data.videoUrl === 'string') {
            const url = sourceNode.data.videoUrl as string;
            if (url.startsWith('data:audio/') || url.startsWith('data:video/') || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(url)) {
              connectedUrl = url;
              break;
            }
          }
          if (sourceNode.data.imageUrl && typeof sourceNode.data.imageUrl === 'string') {
            const url = sourceNode.data.imageUrl as string;
            if (url.startsWith('data:audio/') || url.startsWith('data:video/') || /\.(mp3|wav|ogg|m4a|mp4|webm|mov)($|\?)/i.test(url)) {
              connectedUrl = url;
              break;
            }
          }
          if (sourceNode.data.text && typeof sourceNode.data.text === 'string') {
            const match = (sourceNode.data.text as string).match(/(https?:\/\/[^\s"'`<>]+)|(data:(audio|video)\/[^\s"']+)/i);
            if (match) {
              connectedUrl = match[0];
              break;
            }
          }
        }
      }

      if (connectedUrl) {
        updateNodeData(id, {
          loading: true,
          errorMessage: '正在下载音频...',
        });

        try {
          if (connectedUrl.startsWith('data:audio/') || connectedUrl.startsWith('data:video/')) {
            const parts = connectedUrl.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'audio/mpeg';
            const binaryStr = atob(parts[1]);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (; len--;) bytes[len] = binaryStr.charCodeAt(len);
            const ext = mimeType.split('/')[1] || 'mp3';
            const fileName = `media_generated.${ext}`;
            audioFile = new File([bytes], fileName, { type: mimeType });
            updateNodeData(id, {
              audioUrl: URL.createObjectURL(audioFile),
              audioName: fileName,
            });
          } else {
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 180000);
            const response = await fetch(connectedUrl, {
              signal: abortController.signal,
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`下载失败: ${response.status}`);

            const blob = await response.blob();
            const fileName = connectedUrl.split('/').pop() || 'audio.mp3';
            audioFile = new File([blob], fileName, { type: blob.type || 'audio/mpeg' });
            updateNodeData(id, {
              audioUrl: URL.createObjectURL(audioFile),
              audioName: fileName,
            });
          }
        } catch (err) {
          const error = err as Error;
          updateNodeData(id, {
            loading: false,
            errorMessage: error.name === 'AbortError' ? '音频下载超时 (3分钟)' : `音频下载失败: ${error.message}`,
          });
          return;
        }
      }
    }

    if (!audioFile) {
      nodeData.onShowToast?.('请先上传音频文件或连接包含音频URL的节点');
      return;
    }

    if (!nodeData.audioApiUrl || !nodeData.audioApiKey) {
      updateNodeData(id, {
        errorMessage: '请在设置中配置听音 API Key',
      });
      return;
    }

    updateNodeData(id, {
      loading: true,
      errorMessage: undefined,
    });

    try {
      const chunks = await ss(
        audioFile,
        nodeData.audioApiUrl,
        nodeData.audioApiKey,
        nodeData.audioModel || 'whisper-1',
        prompt,
        maxDuration,
        pauseGap
      );
      updateNodeData(id, {
        loading: false,
        chunks,
        text: JSON.stringify(chunks, null, 2),
      });
      nodeData.onShowToast?.('听音断句完成！');
    } catch (err) {
      console.error('Audio processing failed:', err);
      updateNodeData(id, {
        loading: false,
        errorMessage: (err as Error).message || '处理失败，请重试',
      });
    }
  }, [localFile, nodeData, prompt, maxDuration, pauseGap, id, updateNodeData, getNodes, getEdges]);

  useEffect(() => {
    updateNodeData(id, {
      onGenerateAudio: handleGenerate,
    });
  }, [localFile, nodeData.audioApiUrl, nodeData.audioApiKey, nodeData.audioModel, prompt, maxDuration, pauseGap]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalFile(file);
    const url = URL.createObjectURL(file);
    nodeData.audioUrl = url;
    nodeData.audioName = file.name;
    setPrompt((p) => p);
    updateNodeData(id, {
      audioUrl: url,
      audioName: file.name,
      errorMessage: undefined,
      chunks: undefined,
    });
    e.target.value = '';
  };

  return (
    <div className={`relative flex flex-col group/node transition-all w-[360px] ${selected ? 'z-50' : 'z-10'}`}>
      <NodeTitle
        id={id}
        data={nodeData}
        defaultTitle="听音断句"
        icon={<span className="text-gray-500">🎙️</span>}
      />

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="audio/*,video/*"
        onChange={handleFileChange}
      />

      {nodeData.audioUrl && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4">
          <div className="flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg">
            <DownloadUrlButton
              url={nodeData.audioUrl}
              fallbackExt="mp3"
              size={13}
              onToast={(msg) => nodeData.onShowToast?.(msg)}
            />
            <button
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#333] rounded-md"
              onClick={() => {
                setLocalFile(null);
                updateNodeData(id, {
                  audioUrl: undefined,
                  audioName: undefined,
                  chunks: undefined,
                  errorMessage: undefined,
                });
              }}
              title="清除"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div
        className={`relative bg-[#1c1c1c] rounded-xl overflow-visible border shadow-xl transition-all duration-300 flex flex-col
          ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}
        `}
        style={{ minHeight: '160px' }}
      >
        <CustomHandle type="target" position={Position.Left} />
        <CustomHandle type="source" position={Position.Right} />

        <div className="flex-1 p-3 overflow-y-auto bg-[#1a1a1a] custom-scrollbar relative min-h-[80px] max-h-[160px] rounded-t-xl">
          {nodeData.loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 bg-[#1a1a1a]/80 backdrop-blur-sm z-10">
              <Loader2 size={24} className="animate-spin" />
              <span className="text-xs">处理中...</span>
            </div>
          )}

          {nodeData.errorMessage && !nodeData.loading ? (
            <div className="text-red-400 text-[10px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <span className="break-all leading-tight">{nodeData.errorMessage}</span>
            </div>
          ) : nodeData.chunks ? (
            <div className="flex flex-col gap-1 nodrag">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500">
                  处理结果 ({nodeData.chunks.length} 句)
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (nodeData.chunks) {
                      navigator.clipboard.writeText(JSON.stringify(nodeData.chunks, null, 2));
                      nodeData.onShowToast?.('JSON 已复制到剪贴板');
                    }
                  }}
                  className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
                >
                  <Copy size={10} />
                  {' 复制 JSON'}
                </button>
              </div>
              <pre className="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all nodrag select-text mt-1">
                {JSON.stringify(nodeData.chunks, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-xs mt-8">
              等待上传并处理...
            </div>
          )}
        </div>

        <div
          className="p-3 bg-[#1a1a1a] flex flex-col gap-3 nodrag border-t border-[#2a2a2a] rounded-b-xl relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {nodeData.audioUrl ? (
            <div className="w-full flex flex-col gap-2 bg-[#111] p-2 rounded-lg border border-[#333]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileAudio size={14} className="text-green-500 flex-shrink-0" />
                  <span className="text-xs text-gray-300 truncate" title={nodeData.audioName}>
                    {nodeData.audioName}
                  </span>
                </div>
              </div>
              {nodeData.audioUrl.match(/\.(mp4|webm|mov|ogg)($|\?)/i) || nodeData.audioUrl.startsWith('data:video/') ? (
                <video
                  src={nodeData.audioUrl}
                  controls
                  className="w-full h-24 object-contain outline-none nodrag bg-black rounded"
                />
              ) : (
                <audio
                  src={nodeData.audioUrl}
                  controls
                  className="w-full h-8 outline-none nodrag"
                />
              )}
            </div>
          ) : (
            <div
              className="w-full py-4 rounded-lg border border-dashed border-[#444] bg-[#111] hover:bg-[#1a1a1a] hover:border-[#666] flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group/upload"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload
                size={16}
                className="text-gray-500 group-hover/upload:text-green-500 transition-colors"
              />
              <span className="text-[10px] text-gray-500">
                点击上传音视频或连接含音频的节点
              </span>
            </div>
          )}

          {showConfig && (
            <div className="flex flex-col gap-3 bg-[#111] border border-[#333] rounded p-3 mt-1 animate-fade-in nodrag">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-400">提示词 (Prompt)</label>
                <input
                  type="text"
                  className="w-full bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="请输出简体中文。"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[10px] text-gray-400">换气停顿 (秒)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="w-full bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                    value={pauseGap}
                    onChange={(e) => setPauseGap(parseFloat(e.target.value) || 0.3)}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-[10px] text-gray-400">强制熔断 (秒)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className="w-full bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
                    value={maxDuration}
                    onChange={(e) => setMaxDuration(parseFloat(e.target.value) || 10)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-1">
            <button
              className={`p-1.5 rounded flex items-center gap-1 transition-colors ${
                showConfig ? 'text-blue-400 bg-[#333]' : 'text-gray-400 hover:bg-[#333]'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setShowConfig(!showConfig);
              }}
              title="参数配置"
            >
              <Settings size={14} />
              <span className="text-[10px]">{showConfig ? '收起配置' : '配置'}</span>
            </button>
            <button
              className={`px-4 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition-all ${
                nodeData.audioUrl
                  ? nodeData.loading
                    ? 'bg-blue-600/50 text-white cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-[#333] text-gray-500 cursor-not-allowed'
              }`}
              onClick={handleGenerate}
              disabled={!nodeData.audioUrl || nodeData.loading}
            >
              {nodeData.loading ? (
                <Fragment>
                  <Loader2 size={12} className="animate-spin" />
                  处理中...
                </Fragment>
              ) : (
                <Fragment>
                  <Mic size={12} />
                  开始断句
                </Fragment>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(AudioNode);
