// ============================================================
// 一毛AI画布 - SD2视频生成节点 (Sd2VideoNode)
// 原版函数名: Ao (L9672-L10749)
// ============================================================
import { memo, useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Video,
  Upload,
  Maximize2,
  Download,
  X,
  Play,
  Loader2,
  Square,
  FileText,
  Settings,
  Send,
  Zap,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Music,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';
import ResizeController from './ResizeController';

// ====== External dependency stubs ======

// TODO: implement Oo - useAssetUpload hook
function useAssetUpload(_opts: {
  nodeId: string;
  initialUploadedAssets: Record<string, string>;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  onUploadAsset?: (url: string, type: string) => Promise<string>;
  onShowToast?: (msg: string) => void;
}): {
  uploadedAssets: Record<string, string>;
  uploadingAssetsRef: React.MutableRefObject<Record<string, boolean>>;
  failedAssetsRef: React.MutableRefObject<Record<string, boolean>>;
  uploadAsset: (asset: { id: string; url: string; type: string }) => Promise<void>;
  retryAsset: (asset: { id: string; url: string; type: string }) => Promise<void>;
  getAssetStatus: (resId: string, resUrl: string) => { isUploading: boolean; isUploaded: boolean; isFailed: boolean };
  clearAllFailedAssets: () => void;
} {
  // TODO: implement
  return {
    uploadedAssets: {},
    uploadingAssetsRef: { current: {} },
    failedAssetsRef: { current: {} },
    uploadAsset: async () => {},
    retryAsset: async () => {},
    getAssetStatus: () => ({ isUploading: false, isUploaded: false, isFailed: false }),
    clearAllFailedAssets: () => {},
  };
}

// TODO: implement ii - urlifyAsset (upload file, return { url, thumbnailUrl })
async function urlifyAsset(
  _file: File,
  _options: { subfolder: string; preferThumbnail?: boolean; thumbMaxDim?: number; thumbQuality?: number }
): Promise<{ url: string; thumbnailUrl?: string }> {
  // TODO: implement
  return { url: '' };
}

// TODO: implement yr - resizeImage (resize file to maxDim, return base64)
async function resizeImage(_file: File, _maxDim: number, _quality: number): Promise<string> {
  // TODO: implement
  return '';
}

// TODO: implement ko - size/aspect ratio options
const sizeOptions = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
];

// TODO: implement ea - get model button style
function getModelButtonStyle(_modelName: string, _isSelected: boolean): { className: string; disabled: boolean; title: string } {
  // TODO: implement
  return { className: '', disabled: false, title: '' };
}

// TODO: implement Ja - PresetPromptsPicker component
function PresetPromptsPicker(_props: {
  category: string;
  presetPrompts: unknown[];
  onApply: (prompt: string) => void;
  onToast: (msg: string) => void;
}): React.ReactElement | null {
  // TODO: implement
  return null;
}

// TODO: implement _i - TextareaResizeHandle component
function TextareaResizeHandle(_props: {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLDivElement | null>;
  onRequestFullscreen: () => void;
  onResizeEnd: (width: number, height: number) => void;
}): React.ReactElement | null {
  // TODO: implement
  return null;
}

// TODO: implement vi - FullscreenEditor component
function FullscreenEditorModal(_props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.ReactElement | null {
  // TODO: implement
  return null;
}

// TODO: implement gi - RichTextarea component
function RichTextarea(_props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }): React.ReactElement {
  // TODO: implement
  return <textarea {..._props} />;
}

// ====== NodeData type ======

interface Sd2VideoNodeData {
  prompt?: string;
  size?: string;
  selectedSeconds?: string;
  selectedModel?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  loading?: boolean;
  progress?: number;
  errorMessage?: string;
  videoDurations?: string;
  sd2VideoModel?: string;
  expanded?: boolean;
  inputWidth?: number;
  inputHeight?: number;
  uploadedAssets?: Record<string, string>;
  selectedContextResources?: Array<{ id: string; url: string; type: string; name?: string }>;
  internalResources?: Array<{ id: string; url: string; type: string; name?: string }>;
  presetPrompts?: unknown[];
  label?: string;
  onGenerateSD2Video?: (nodeId: string, prompt: string, size: string, model: string, seconds: string) => void;
  onStop?: (nodeId: string) => void;
  onRefresh?: (nodeId: string) => void;
  onDelete?: () => void;
  onUploadAsset?: (url: string, type: string) => Promise<string>;
  onShowToast?: (msg: string) => void;
  onUpdateLabel?: (label: string) => void;
  [key: string]: unknown;
}

// ====== Component ======

function Sd2VideoNode({ id, data, selected }: NodeProps<{ data: Sd2VideoNodeData }>) {
  const {
    updateNodeData,
    setEdges,
    addNodes,
    addEdges,
    getNodes,
  } = useReactFlow();

  const d = data;

  const [prompt, setPrompt] = useState(d.prompt || ``);
  const [size, setSize] = useState(d.size || localStorage.getItem(`mutiwindow_sd2video_size`) || `16:9`);
  const [selectedSeconds, setSelectedSeconds] = useState(
    d.selectedSeconds ||
    localStorage.getItem(`mutiwindow_sd2video_seconds`) ||
    (d.videoDurations && d.videoDurations.split(`
`)[0].trim()) ||
    `10`
  );
  const [selectedModel, setSelectedModel] = useState(
    d.selectedModel ||
    localStorage.getItem(`mutiwindow_sd2video_model`) ||
    (d.sd2VideoModel && d.sd2VideoModel.split(`
`)[0].trim()) ||
    ``
  );
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [selectedContextResources, setSelectedContextResources] = useState(d.selectedContextResources || []);
  const [internalResources, setInternalResources] = useState(d.internalResources || []);

  const {
    uploadedAssets: ee,
    uploadingAssetsRef: R,
    failedAssetsRef: z,
    uploadAsset: B,
    retryAsset: te,
    getAssetStatus: ne,
    clearAllFailedAssets: re,
  } = useAssetUpload({
    nodeId: id,
    initialUploadedAssets: d.uploadedAssets || {},
    updateNodeData: updateNodeData as (id: string, data: Record<string, unknown>) => void,
    onUploadAsset: d.onUploadAsset,
    onShowToast: d.onShowToast,
  });

  useEffect(() => {
    d.selectedContextResources && setSelectedContextResources(d.selectedContextResources);
  }, [d.selectedContextResources]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node) && setShowModelDropdown(false);
      settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node) && setShowSettingsDropdown(false);
    };
    (showModelDropdown || showSettingsDropdown) && document.addEventListener(`mousedown`, handler, true);
    return () => {
      document.removeEventListener(`mousedown`, handler, true);
    };
  }, [showModelDropdown, showSettingsDropdown]);

  const [expanded, setExpanded] = useState(d.expanded === undefined ? true : d.expanded);
  useEffect(() => {
    d.expanded !== undefined && setExpanded(d.expanded);
  }, [d.expanded]);

  const renderAssetOverlay = ({
    resId,
    resUrl,
    resType,
  }: {
    resId: string;
    resUrl: string;
    resType: string;
  }) => {
    const status = ne(resId, resUrl);
    if (!status.isUploading && !status.isUploaded && !status.isFailed) return null;
    if (status.isFailed) {
      return (
        <div
          className={`absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`}
          title={`上传失败,点击重试`}
          onClick={(r) => {
            r.stopPropagation();
            handleRetry({ id: resId, url: resUrl, type: resType });
          }}
        >
          <RefreshCw
            size={14}
            className={`text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`}
          />
          <span
            className={`text-[8px] text-white mt-0.5 font-medium leading-none`}
          >
            重试
          </span>
        </div>
      );
    }
    return (
      <div
        className={`absolute top-0 left-0 p-0.5 pointer-events-none`}
      >
        {status.isUploading ? (
          <Loader2
            size={12}
            className={`animate-spin drop-shadow-md`}
            style={{ color: `rgb(210,2,7)` }}
          />
        ) : status.isUploaded ? (
          <CheckCircle2
            size={12}
            className={`text-green-500 drop-shadow-md`}
          />
        ) : null}
      </div>
    );
  };

  const handleRetry = async (e: { id: string; url: string; type: string }) => {
    await te(e).catch(() => {});
  };

  const connections = useHandleConnections({ type: `target` });
  const connectedNodes = useMemo(() => connections.map((c) => c.source), [connections]);

  const resources = useMemo(() => {
    if (!connectedNodes) return { images: [], videos: [], audios: [], texts: [] };
    const nodes = Array.isArray(connectedNodes) ? connectedNodes : [connectedNodes];
    const images: Array<{ id: string; url: string; type: string }> = [];
    const videos: Array<{ id: string; url: string; type: string }> = [];
    const audios: Array<{ id: string; url: string; type: string }> = [];
    const texts: Array<{ id: string; label: string; text: string }> = [];

    nodes.forEach((node) => {
      const conn = connections.find((c) => c.source === node?.id);
      if (node?.data?.imageUrl) {
        const url = node.data.imageUrl as string;
        if (url.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(url)) {
          videos.push({ id: node.id, url, type: `video` });
        } else if (url.startsWith(`data:audio/`) || /\.(mp3|wav|ogg|aac)($|\?)/i.test(url)) {
          audios.push({ id: node.id, url, type: `audio` });
        } else {
          images.push({ id: node.id, url, type: `image` });
        }
      }
      if (node?.data?.videoUrl) {
        videos.push({ id: node.id, url: node.data.videoUrl as string, type: `video` });
      }
      if (node?.data?.audioUrl) {
        audios.push({ id: node.id, url: node.data.audioUrl as string, type: `audio` });
      }
      if (node?.type === `videoExtractNode` && node?.data?.extractedImages) {
        if (conn && conn.sourceHandle && conn.sourceHandle.startsWith(`frame-`)) {
          const frameIdx = parseInt(conn.sourceHandle.replace(`frame-`, ``), 10);
          if (!(node.data.hiddenIndices as number[] || []).includes(frameIdx)) {
            const allImages = node.data.allExtractedImages as string[] | undefined;
            if (allImages && allImages[frameIdx]) {
              images.push({ id: `${node.id}-ext-${frameIdx}`, url: allImages[frameIdx], type: `image` });
            }
          }
        } else {
          (node.data.extractedImages as string[]).forEach((imgUrl, idx) => {
            images.push({ id: `${node.id}-ext-${idx}`, url: imgUrl, type: `image` });
          });
        }
      }
      if (node?.type === `imageBoxNode` && Array.isArray(node.data?.images)) {
        const boxImages = node.data.images as Array<{ id: string; url: string }>;
        const selectedIds = node.data.selectedIds as string[] || [];
        if (selectedIds.length > 0) {
          const idSet = new Set(selectedIds);
          boxImages.forEach((img, idx) => {
            if (img?.url && idSet.has(img.id)) {
              images.push({ id: `${node.id}-box-${idx}`, url: img.url, type: `image` });
            }
          });
        } else {
          const activeImg = boxImages[typeof node.data.activeIndex === `number` ? node.data.activeIndex as number : 0]?.url;
          if (activeImg) {
            images.push({ id: `${node.id}-box-active`, url: activeImg, type: `image` });
          }
        }
      }
      const textExcludedTypes = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`]);
      if (node?.data?.text && !textExcludedTypes.has(node.type as string)) {
        texts.push({
          id: node.id,
          label: node?.type === `audioNode` ? `听音断句结果` : (node.data.label as string) || `文本节点`,
          text: node.data.text as string,
        });
      }
    });

    return { images, videos, audios, texts };
  }, [connectedNodes, connections]);

  useEffect(() => {
    if (d.onUploadAsset) {
      [...selectedContextResources, ...resources.images, ...resources.videos, ...resources.audios].forEach((e) => {
        if (!e.url || e.url.startsWith(`asset://`)) return;
        const url = e.url;
        const assetId = e.id;
        if (!ee[url] && !R.current[assetId] && !z.current[assetId]) {
          B({ id: assetId, url: e.url, type: e.type }).catch((err) => {
            console.error(`Auto upload failed for`, assetId, err);
          });
        }
      });
    }
  }, [selectedContextResources, resources, ee, B, id]);

  useEffect(() => {
    d.prompt !== undefined && d.prompt !== prompt && setPrompt(d.prompt);
  }, [d.prompt]);

  useEffect(() => {
    d.size !== undefined && d.size !== size && setSize(d.size);
  }, [d.size]);

  useEffect(() => {
    if (d.sd2VideoModel && !selectedModel) {
      const firstModel = d.sd2VideoModel.split(`
`)[0].trim();
      setSelectedModel(firstModel);
      updateNodeData(id, { selectedModel: firstModel });
    }
  }, [d.sd2VideoModel, selectedModel, id, updateNodeData]);

  useEffect(() => {
    d.selectedModel && d.selectedModel !== selectedModel && setSelectedModel(d.selectedModel);
  }, [d.selectedModel]);

  useEffect(() => {
    if (d.videoDurations && !selectedSeconds) {
      const firstDuration = d.videoDurations.split(`
`)[0].trim();
      setSelectedSeconds(firstDuration);
      updateNodeData(id, { selectedSeconds: firstDuration });
    }
  }, [d.videoDurations, selectedSeconds, id, updateNodeData]);

  useEffect(() => {
    d.selectedSeconds && d.selectedSeconds !== selectedSeconds && setSelectedSeconds(d.selectedSeconds);
  }, [d.selectedSeconds]);

  useEffect(() => {}, [d.videoUrl, d.loading]);

  const handleGenerate = () => {
    if (Object.keys(R.current).length > 0) {
      d.onShowToast?.(`素材正在上传处理中，请等待所有对勾出现后再生成`);
      return;
    }
    if (Object.keys(z.current).length > 0) {
      d.onShowToast?.(`有素材上传失败，已为您重新尝试上传，请稍后`);
      re();
      return;
    }
    if (!prompt.trim() && resources.images.length === 0 && resources.texts.length === 0 && selectedContextResources.length === 0) {
      d.onShowToast?.(`请输入提示词或连接参考节点`);
      return;
    }
    d.onGenerateSD2Video?.(id, prompt, size, selectedModel, selectedSeconds);
  };

  return (
    <div
      className={`relative flex flex-col items-center group/node transition-all w-full h-full min-w-[200px] min-h-[200px] ` + (selected ? `z-50` : `z-10`)}
    >
      <NodeTitle
        id={id}
        data={d as unknown as Record<string, unknown>}
        defaultTitle={`SD2视频`}
        icon={<Video size={11} className={`text-gray-500`} />}
      />

      {!d.loading && (
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}
        >
          <div
            className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}
          >
            {resources.images.length === 0 && (
              <button
                className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                title={`上传参考图`}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Upload size={14} />
              </button>
            )}
            {d.videoUrl && (
              <Fragment>
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                  title={`全屏播放`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullscreen(true);
                  }}
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                  title={`下载`}
                  onClick={async (e) => {
                    if (e.stopPropagation(), d.videoUrl) try {
                      if (d.onShowToast?.(`开始下载视频...`), typeof chrome < `u` && chrome.downloads) chrome.downloads.download({
                        url: d.videoUrl,
                        filename: `yimao/video-${Date.now()}.mp4`,
                        saveAs: false
                      });else {
                        const blob = await (await fetch(d.videoUrl)).blob(),
                          blobUrl = window.URL.createObjectURL(blob),
                          a = document.createElement(`a`);
                        a.href = blobUrl, a.download = `video-${Date.now()}.mp4`, document.body.appendChild(a), a.click(), window.URL.revokeObjectURL(blobUrl), document.body.removeChild(a);
                      }
                    } catch (err) {
                      console.error(`Download failed:`, err), d.onShowToast?.(`下载失败，请重试`), window.open(d.videoUrl, `_blank`);
                    }
                  }}
                >
                  <Download size={14} />
                </button>
                {d.onDelete && (
                  <button
                    className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md`}
                    title={`删除`}
                    onClick={(e) => {
                      e.stopPropagation();
                      d.onDelete?.();
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </Fragment>
            )}
          </div>
        </div>
      )}

      <ResizeController
        visible={!!selected}
        minWidth={200}
        minHeight={200}
      />

      <input
        type={`file`}
        ref={fileInputRef}
        style={{ display: `none` }}
        accept={`image/*,video/*,audio/*`}
        onChange={async (t) => {
          const file = t.target.files?.[0];
          if (!file) return;
          const mediaType = file.type.startsWith(`video`) ? `video` : file.type.startsWith(`audio`) ? `audio` : `image`;
          const fileName = file.name;
          try {
            const newNodeId = `node-${Date.now()}`;
            const currentNode = getNodes().find((n) => n.id === id);
            const position = currentNode
              ? { x: currentNode.position.x - 300, y: currentNode.position.y }
              : { x: 0, y: 0 };
            if (mediaType === `image`) {
              let imageUrl = ``;
              let thumbnailUrl: string | undefined;
              try {
                const result = await urlifyAsset(file, {
                  subfolder: `canvas/upload`,
                  preferThumbnail: true,
                  thumbMaxDim: 480,
                  thumbQuality: 75,
                });
                if (result.url && /^https?:\/\//i.test(result.url)) {
                  imageUrl = result.url;
                  thumbnailUrl = result.thumbnailUrl;
                }
              } catch (err) {
                console.warn(`[SD2VideoNode] urlifyAsset failed, fallback to resizeImage:`, err);
              }
              imageUrl ||= await resizeImage(file, 2048, 0.85);
              addNodes({
                id: newNodeId,
                type: `imageNode`,
                position,
                data: {
                  imageUrl,
                  thumbnailUrl,
                  label: fileName || `图片素材`,
                },
              });
              addEdges({
                id: `edge-${newNodeId}-${id}`,
                source: newNodeId,
                target: id,
              });
              return;
            }
            let mediaUrl = ``;
            try {
              const result = await urlifyAsset(file, { subfolder: `canvas/upload` });
              if (result.url && /^https?:\/\//i.test(result.url)) {
                mediaUrl = result.url;
              }
            } catch (err) {
              console.warn(`[SD2VideoNode] urlifyAsset failed for media, fallback to base64:`, err);
            }
            const createMediaNode = (url: string) => {
              addNodes(
                mediaType === `video`
                  ? {
                      id: newNodeId,
                      type: `videoExtractNode`,
                      position,
                      data: { videoUrl: url, videoName: fileName || `视频素材` },
                    }
                  : {
                      id: newNodeId,
                      type: `audioNode`,
                      position,
                      data: { audioUrl: url, audioName: fileName || `音频素材` },
                    }
              );
              addEdges({
                id: `edge-${newNodeId}-${id}`,
                source: newNodeId,
                target: id,
              });
            };
            if (mediaUrl) {
              createMediaNode(mediaUrl);
            } else {
              const reader = new FileReader();
              reader.onload = (loadEvent) => {
                const dataUrl = loadEvent.target?.result as string;
                createMediaNode(dataUrl);
              };
              reader.readAsDataURL(file);
            }
          } catch (err) {
            console.error(`File upload failed:`, err);
          }
          t.target.value = ``;
        }}
      />

      <div
        className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 cursor-pointer group/display w-full flex-1 flex flex-col overflow-visible
            ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `}
        onClick={() => {
          setExpanded(!expanded);
          updateNodeData(id, { expanded: !expanded });
        }}
      >
        <div
          className={`flex items-center justify-center relative w-full flex-1 rounded-b-xl overflow-hidden ` + (d.videoUrl ? `` : `bg-[#0d0c0c]`)}
        >
          {d.videoUrl && (
            <Fragment>
              <video
                src={d.videoUrl}
                poster={d.thumbnailUrl}
                className={`max-w-full max-h-[400px] w-full h-full object-contain block ` + (d.loading ? `opacity-50 blur-sm` : ``)}
                controls={false}
                autoPlay={false}
                muted={false}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setShowFullscreen(true);
                }}
              />
              {!d.loading && (
                <div
                  className={`absolute inset-0 flex items-center justify-center pointer-events-none`}
                >
                  <button
                    className={`w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-black/70 transition-all nodrag pointer-events-auto`}
                    title={`播放视频`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullscreen(true);
                    }}
                  >
                    <Play className={`text-white w-6 h-6`} />
                  </button>
                </div>
              )}
            </Fragment>
          )}

          {d.loading && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 z-10 overflow-hidden bg-[#0d0c0c]`}
            >
              {(resources.images[0] || d.thumbnailUrl) && (
                <div
                  className={`absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110`}
                  style={{
                    backgroundImage: `url(${d.thumbnailUrl || resources.images[0].url})`,
                  }}
                />
              )}
              <div
                className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer`}
                style={{ transform: `skewX(-20deg)` }}
              />
              <div
                className={`relative z-10 flex flex-col items-center gap-2`}
              >
                <Loader2 size={32} />
                <span
                  className={`text-xs font-mono tracking-wider text-white/80`}
                >
                  {!d.progress || d.progress === 0 ? `生成中...` : `生成中... ${d.progress}%`}
                </span>
                <button
                  onClick={(t) => {
                    t.stopPropagation();
                    d.onStop?.(id);
                  }}
                  className={`mt-2 bg-[#222]/80 hover:bg-[#333] border border-[#444] text-gray-400 hover:text-gray-200 px-3 py-1 rounded-full text-[10px] flex items-center gap-1.5 transition-colors backdrop-blur-sm`}
                >
                  <Square size={10} fill={`currentColor`} />
                  停止
                </button>
              </div>
            </div>
          )}

          {!d.videoUrl && !d.loading && !d.errorMessage && (
            <div
              className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}
            >
              <Video size={80} className={`text-gray-700`} strokeWidth={1.2} />
            </div>
          )}

          {d.errorMessage && !d.loading && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}
            >
              <AlertCircle size={32} />
              <div
                className={`text-xs font-medium max-w-full break-words`}
              >
                {d.errorMessage}
              </div>
            </div>
          )}
        </div>
      </div>

      <CustomHandle
        type={`target`}
        position={Position.Left}
        variant={`large`}
      />
      <CustomHandle
        type={`source`}
        position={Position.Right}
        variant={`large`}
      />

      {(() => {
        const panelContent = (
          <div className={`space-y-3`}>
            <div className={`flex flex-col gap-2 mb-2`}>
              {internalResources.length > 0 && (
                <div
                  className={`flex flex-wrap gap-2 mb-1 p-2 bg-[#1a1a1a] border border-[#333] rounded-lg`}
                >
                  <div
                    className={`w-full text-[10px] text-gray-500 mb-1`}
                  >
                    已上传素材(输入 @ 引用)
                  </div>
                  {internalResources.map((t, n) => {
                    const typeLabel = t.type.startsWith(`image`) ? `图片` : t.type.startsWith(`video`) ? `视频` : t.type.startsWith(`audio`) ? `音频` : `素材`;
                    return (
                      <div
                        key={`internal-${n}`}
                        className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`}
                        title={t.name || `素材`}
                      >
                        <div
                          className={`w-full h-full relative cursor-pointer`}
                          onDoubleClick={(e) => {
                            if (e.stopPropagation(), t.type.startsWith(`video`) || t.type.startsWith(`audio`)) {
                              const mediaEl = document.createElement(t.type.startsWith(`video`) ? `video` : `audio`);
                              mediaEl.src = t.url, mediaEl.controls = true, mediaEl.style.position = `fixed`, mediaEl.style.top = `50%`, mediaEl.style.left = `50%`, mediaEl.style.transform = `translate(-50%, -50%)`, mediaEl.style.maxWidth = `90vw`, mediaEl.style.maxHeight = `90vh`, mediaEl.style.zIndex = `999999`, mediaEl.style.boxShadow = `0 0 0 100vmax rgba(0,0,0,0.8)`, document.body.appendChild(mediaEl), mediaEl.play();
                              const clickHandler = (evt: Event) => {
                                if (evt.target !== mediaEl) {
                                  mediaEl.pause(), document.body.removeChild(mediaEl), document.removeEventListener(`click`, clickHandler);
                                }
                              };
                              setTimeout(() => document.addEventListener(`click`, clickHandler), 100);
                            }
                          }}
                        >
                          {t.type.startsWith(`image`) ? (
                            <img src={t.url} alt={`Ref`} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} />
                          ) : t.type.startsWith(`video`) ? (
                            <div className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Video size={16} className={`text-purple-400`} />
                            </div>
                          ) : (
                            <div className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Music size={16} className={`text-yellow-500`} />
                            </div>
                          )}
                        </div>
                        {renderAssetOverlay({ resId: t.id, resUrl: t.url, resType: t.type })}
                        <div
                          className={`absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}
                        >
                          {typeLabel}
                          {t.type.startsWith(`image`)
                            ? internalResources.filter((e) => e.type.startsWith(`image`)).findIndex((e) => e.id === t.id) + 1
                            : t.type.startsWith(`video`)
                            ? internalResources.filter((e) => e.type.startsWith(`video`)).findIndex((e) => e.id === t.id) + 1
                            : t.type.startsWith(`audio`)
                            ? internalResources.filter((e) => e.type.startsWith(`audio`)).findIndex((e) => e.id === t.id) + 1
                            : n + 1}
                        </div>
                        <div
                          className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`}
                          onClick={(t) => {
                            t.stopPropagation();
                            const filtered = internalResources.filter((_, i) => i !== n);
                            setInternalResources(filtered);
                            updateNodeData(id, { internalResources: filtered });
                          }}
                        >
                          <X size={10} className={`text-white`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(resources.images.length > 0 || resources.videos.length > 0 || resources.audios.length > 0 || resources.texts.length > 0 || selectedContextResources.length > 0) && (
                <div className={`flex flex-wrap gap-2 mb-1`}>
                  {resources.images.map((t, n) => (
                    <div
                      key={`img-${n}`}
                      className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`}
                      title={`连线图片`}
                    >
                      <img src={t.url} alt={`Ref`} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} />
                      {renderAssetOverlay({ resId: t.id, resUrl: t.url, resType: `image` })}
                      <div
                        className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}
                      >
                        图片{n + 1}
                      </div>
                      <div
                        className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`}
                        onClick={(n) => {
                          n.stopPropagation();
                          setEdges((edges) => edges.filter((edge) => !(edge.target === id && edge.source === t.id)));
                        }}
                      >
                        <X size={10} className={`text-white`} />
                      </div>
                    </div>
                  ))}

                  {resources.videos?.map((t, n) => (
                    <div
                      key={`vid-${n}`}
                      className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`}
                      title={`连线视频`}
                    >
                      <video
                        src={t.url}
                        className={`w-full h-full object-cover cursor-pointer`}
                        muted={true}
                        playsInline={true}
                        preload={`metadata`}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          const videoEl = document.createElement(`video`);
                          videoEl.src = t.url, videoEl.controls = true, videoEl.style.position = `fixed`, videoEl.style.top = `50%`, videoEl.style.left = `50%`, videoEl.style.transform = `translate(-50%, -50%)`, videoEl.style.maxWidth = `90vw`, videoEl.style.maxHeight = `90vh`, videoEl.style.zIndex = `999999`, videoEl.style.backgroundColor = `black`, videoEl.style.boxShadow = `0 25px 50px -12px rgba(0, 0, 0, 0.5)`, videoEl.style.borderRadius = `12px`;
                          const overlay = document.createElement(`div`);
                          overlay.style.position = `fixed`, overlay.style.inset = `0`, overlay.style.backgroundColor = `rgba(0,0,0,0.9)`, overlay.style.zIndex = `999998`, overlay.style.backdropFilter = `blur(4px)`, overlay.onclick = () => {
                            document.body.contains(videoEl) && document.body.removeChild(videoEl), document.body.contains(overlay) && document.body.removeChild(overlay);
                          }, document.body.appendChild(overlay), document.body.appendChild(videoEl), videoEl.play().catch(() => {});
                        }}
                      />
                      <div
                        className={`absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`}
                        title={`上传失败,点击重试`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetry({ id: t.id, url: t.url, type: `video` });
                        }}
                      >
                        <RefreshCw
                          size={14}
                          className={`text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`}
                        />
                        <span
                          className={`text-[8px] text-white mt-0.5 font-medium leading-none`}
                        >
                          重试
                        </span>
                      </div>
                      <div
                        className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`}
                        onClick={(n) => {
                          n.stopPropagation();
                          setEdges((edges) => edges.filter((edge) => !(edge.target === id && edge.source === t.id)));
                        }}
                      >
                        <X size={10} className={`text-white`} />
                      </div>
                    </div>
                  ))}

                  {resources.audios?.map((t, n) => (
                    <div
                      key={`aud-${n}`}
                      className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`}
                      title={`连线音频`}
                    >
                      <div
                        className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}
                      >
                        <Music size={16} className={`text-yellow-500`} />
                      </div>
                      {renderAssetOverlay({ resId: t.id, resUrl: t.url, resType: `audio` })}
                      <div
                        className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}
                      >
                        音频{n + 1}
                      </div>
                      <div
                        className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`}
                        onClick={(n) => {
                          n.stopPropagation();
                          setEdges((edges) => edges.filter((edge) => !(edge.target === id && edge.source === t.id)));
                        }}
                      >
                        <X size={10} className={`text-white`} />
                      </div>
                    </div>
                  ))}

                  {selectedContextResources.filter((e) => {
                    const isImage = resources.images.some((t) => t.id === e.id);
                    const isVideo = resources.videos?.some((t) => t.id === e.id);
                    const isAudio = resources.audios?.some((t) => t.id === e.id);
                    const isAny = [...resources.images, ...(resources.videos || []), ...(resources.audios || [])].some((t) => t.id === e.id);
                    return !isImage && !isVideo && !isAudio && isAny;
                  }).map((t, n) => {
                    let label = ``;
                    label = t.type.startsWith(`image`) ? `图片${resources.images.findIndex((e) => e.id === t.id) + 1}` : t.type.startsWith(`video`) ? `视频${resources.videos.findIndex((e) => e.id === t.id) + 1}` : t.type.startsWith(`audio`) ? `音频${resources.audios.findIndex((e) => e.id === t.id) + 1}` : `素材${n + 1}`;
                    return (
                      <div
                        key={`ctx-${n}`}
                        className={`w-10 h-10 rounded-md overflow-hidden border border-pink-500/50 relative group bg-black`}
                        title={`通过 @ 选中的素材`}
                      >
                        <div
                          className={`w-full h-full relative cursor-pointer`}
                          onDoubleClick={(e) => {
                            if (e.stopPropagation(), t.type.startsWith(`video`) || t.type.startsWith(`audio`)) {
                              const mediaEl = document.createElement(t.type.startsWith(`video`) ? `video` : `audio`);
                              mediaEl.src = t.url, mediaEl.controls = true, mediaEl.style.position = `fixed`, mediaEl.style.top = `50%`, mediaEl.style.left = `50%`, mediaEl.style.transform = `translate(-50%, -50%)`, mediaEl.style.maxWidth = `90vw`, mediaEl.style.maxHeight = `90vh`, mediaEl.style.zIndex = `999999`, mediaEl.style.boxShadow = `0 0 0 100vmax rgba(0,0,0,0.8)`, document.body.appendChild(mediaEl), mediaEl.play();
                              const clickHandler = (evt: Event) => {
                                if (evt.target !== mediaEl) {
                                  mediaEl.pause(), document.body.removeChild(mediaEl), document.removeEventListener(`click`, clickHandler);
                                }
                              };
                              setTimeout(() => document.addEventListener(`click`, clickHandler), 100);
                            }
                          }}
                        >
                          {t.type.startsWith(`image`) ? (
                            <img src={t.url} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover opacity-80`} />
                          ) : t.type.startsWith(`video`) ? (
                            <div className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Video size={16} className={`text-purple-400 opacity-80`} />
                            </div>
                          ) : (
                            <div className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                              <Music size={16} className={`text-yellow-500 opacity-80`} />
                            </div>
                          )}
                        </div>
                        {renderAssetOverlay({ resId: t.id, resUrl: t.url, resType: t.type })}
                        <div
                          className={`absolute inset-0 bg-pink-500/10 pointer-events-none`}
                        />
                        <div
                          className={`absolute bottom-0 left-0 right-0 bg-pink-500/80 text-[8px] text-white text-center py-0.5 truncate pointer-events-none`}
                        >
                          {label}
                        </div>
                        <div
                          className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`}
                          onClick={(t) => {
                            t.stopPropagation();
                            const filtered = selectedContextResources.filter((_, i) => i !== n);
                            setSelectedContextResources(filtered);
                            updateNodeData(id, { selectedContextResources: filtered });
                          }}
                        >
                          <X size={10} className={`text-white`} />
                        </div>
                      </div>
                    );
                  })}

                  {resources.texts.map((e, t) => (
                    <div
                      key={`txt-${t}`}
                      className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-help group/text`}
                      title={e.text}
                    >
                      <FileText size={10} />
                      <span className={`max-w-[80px] truncate`}>
                        {e.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className={`flex items-start gap-2`}>
                <div className={`flex-1 nodrag relative`}>
                  <RichTextarea
                    ref={textareaRef as React.Ref<HTMLTextAreaElement>}
                    className={`w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nowheel nopan nodrag`}
                    style={{
                      width: d.inputWidth ? `${d.inputWidth}px` : undefined,
                      height: d.inputHeight ? `${d.inputHeight}px` : `80px`,
                      minHeight: `80px`,
                      overflow: `auto`,
                    }}
                    placeholder={`描述你想要的视频内容 (输入 @ 调出素材)...`}
                    value={prompt}
                    onChange={(t) => {
                      if (setPrompt(t), updateNodeData(id, { prompt: t }), t.endsWith(`@`) ? setShowAssetPicker(true) : t.includes(`@`) || setShowAssetPicker(false), !d.inputHeight || d.inputHeight <= 200) {
                        const el = textareaRef.current;
                        requestAnimationFrame(() => {
                          if (el) {
                            el.style.height = `auto`;
                            const h = Math.max(80, Math.min(el.scrollHeight, 200));
                            el.style.height = h + `px`;
                            updateNodeData(id, { inputHeight: h });
                          }
                        });
                      }
                    }}
                    onKeyDown={(e) => {
                      e.key === `Enter` && (e.ctrlKey || e.metaKey) && handleGenerate();
                    }}
                    autoFocus={expanded}
                    onWheel={(e) => e.stopPropagation()}
                  />

                  {showAssetPicker && (
                    <div
                      className={`absolute bottom-full left-0 mb-1 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[100] flex flex-col overflow-hidden h-[300px] nopan`}
                      onWheel={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className={`flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`}
                      >
                        <div
                          className={`text-xs text-gray-300 font-bold flex items-center gap-2`}
                        >
                          <span>选择素材引用</span>
                        </div>
                        <button
                          onClick={() => setShowAssetPicker(false)}
                          className={`text-gray-500 hover:text-white p-1`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div
                        className={`p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}
                      >
                        {(() => {
                          const assets = [
                            ...resources.images.map((e) => ({ id: e.id, url: e.url, type: `image` })),
                            ...resources.videos.map((e) => ({ id: e.id, url: e.url, type: `video` })),
                            ...resources.audios.map((e) => ({ id: e.id, url: e.url, type: `audio` })),
                          ];
                          return assets.length === 0 ? (
                            <div className={`text-center text-gray-500 text-xs py-10`}>
                              暂无素材，请先上传
                            </div>
                          ) : (
                            <div className={`grid grid-cols-4 gap-1.5`}>
                              {assets.map((t) => (
                                <div
                                  key={t.id}
                                  className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group`}
                                  onClick={() => {
                                    const lastAtIndex = prompt.lastIndexOf(`@`);
                                    const before = lastAtIndex >= 0 ? prompt.substring(0, lastAtIndex) + prompt.substring(lastAtIndex + 1) : prompt;
                                    let assetLabel = ``;
                                    assetLabel = t.type.startsWith(`image`) ? `图片${resources.images.findIndex((e) => e.id === t.id) + 1}` : t.type.startsWith(`video`) ? `视频${resources.videos.findIndex((e) => e.id === t.id) + 1}` : t.type.startsWith(`audio`) ? `音频${resources.audios.findIndex((e) => e.id === t.id) + 1}` : `素材1`;
                                    const newPrompt = before + `@${assetLabel} `;
                                    setPrompt(newPrompt);
                                    updateNodeData(id, { prompt: newPrompt });
                                    setShowAssetPicker(false);
                                  }}
                                >
                                  {t.type.startsWith(`image`) ? (
                                    <img src={t.url} loading={`lazy`} decoding={`async`} className={`w-full h-full object-cover`} />
                                  ) : t.type.startsWith(`video`) ? (
                                    <video src={t.url} preload={`metadata`} className={`w-full h-full object-cover`} />
                                  ) : t.type.startsWith(`audio`) ? (
                                    <div className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                                      <span className={`text-[10px] text-gray-400`}>音频</span>
                                    </div>
                                  ) : (
                                    <div className={`p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full`}>
                                      {t.url}
                                    </div>
                                  )}
                                  <div
                                    className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}
                                  >
                                    <span className={`text-[10px] text-white`}>选择</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`}
              >
                <div
                  className={`flex items-center gap-1.5 overflow-visible z-50`}
                >
                  <div
                    className={`relative nodrag flex items-center`}
                    ref={settingsDropdownRef}
                  >
                    <button
                      className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[120px]`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettingsDropdown(!showSettingsDropdown);
                      }}
                      title={`选择比例和时长`}
                    >
                      <Settings size={12} className={`opacity-70`} />
                      <span className={`truncate`}>
                        {sizeOptions.find((e) => e.value === size)?.label || size || `16:9`} · {selectedSeconds}s
                      </span>
                    </button>
                    {showSettingsDropdown && (
                      <div
                        className={`absolute bottom-full left-0 mb-1 w-48 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-64 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <div className={`text-[10px] text-gray-500 mb-2 px-1`}>
                            比例 / 分辨率
                          </div>
                          <div className={`mb-2`}>
                            <input
                              type={`text`}
                              value={size}
                              onChange={(t) => {
                                setSize(t.target.value);
                                updateNodeData(id, { size: t.target.value });
                                localStorage.setItem(`mutiwindow_sd2video_size`, t.target.value);
                              }}
                              placeholder={`自定义分辨率如 1280x720`}
                              className={`w-full bg-[#1c1c1c] border border-[#333] rounded px-2 py-1.5 text-[11px] text-gray-200 outline-none focus:border-blue-500 transition-colors`}
                            />
                          </div>
                          <div className={`flex flex-wrap gap-1.5`}>
                            {sizeOptions.map((t) => (
                              <button
                                key={t.value}
                                className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ` + (size === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`)}
                                onClick={() => {
                                  setSize(t.value);
                                  updateNodeData(id, { size: t.value });
                                  localStorage.setItem(`mutiwindow_sd2video_size`, t.value);
                                }}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {d.videoDurations && (
                          <div>
                            <div className={`text-[10px] text-gray-500 mb-2 px-1`}>
                              时长 (秒)
                            </div>
                            <div className={`flex flex-wrap gap-1.5`}>
                              {d.videoDurations.split(`
`).map((e) => e.trim()).filter((e) => e !== ``).map((t, n) => (
                                <button
                                  key={n}
                                  className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ` + (selectedSeconds === t ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`)}
                                  onClick={() => {
                                    setSelectedSeconds(t);
                                    updateNodeData(id, { selectedSeconds: t });
                                    localStorage.setItem(`mutiwindow_sd2video_seconds`, t);
                                  }}
                                >
                                  {t}s
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!!(d.sd2VideoModel && d.sd2VideoModel.split(`
`).filter((e) => e.trim() !== ``).length > 0) && (
                    <div
                      className={`relative nodrag flex items-center`}
                      ref={modelDropdownRef}
                    >
                      <div className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                      <button
                        className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[100px]`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowModelDropdown(!showModelDropdown);
                        }}
                        title={`选择模型`}
                      >
                        <span className={`truncate`}>
                          {selectedModel || `选择模型`}
                        </span>
                      </button>
                      {showModelDropdown && (
                        <div
                          className={`absolute bottom-full left-0 mb-1 w-48 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-48 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className={`text-[10px] text-gray-500 mb-2 px-1`}>
                            模型
                          </div>
                          {d.sd2VideoModel.split(`
`).map((e) => e.trim()).filter((e) => e !== ``).map((t, n) => {
                            const btnStyle = getModelButtonStyle(t, selectedModel === t);
                            return (
                              <button
                                key={n}
                                className={btnStyle.className}
                                disabled={btnStyle.disabled}
                                onClick={() => {
                                  if (!btnStyle.disabled) {
                                    setSelectedModel(t);
                                    updateNodeData(id, { selectedModel: t });
                                    localStorage.setItem(`mutiwindow_sd2video_model`, t);
                                    setShowModelDropdown(false);
                                  }
                                }}
                                title={btnStyle.title}
                              >
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <PresetPromptsPicker
                    category={`video`}
                    presetPrompts={d.presetPrompts || []}
                    onApply={(t) => {
                      const newPrompt = prompt ? `${prompt}, ${t}` : t;
                      setPrompt(newPrompt);
                      updateNodeData(id, { prompt: newPrompt });
                    }}
                    onToast={(e) => d.onShowToast?.(e)}
                  />
                </div>

                <div className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
                  {d.loading ? (
                    <div className={`flex items-center gap-1.5`}>
                      <button
                        className={`flex items-center gap-1 text-gray-400 hover:text-white bg-[#222] hover:bg-[#333] border border-[#333] hover:border-gray-500 rounded-full px-2.5 py-1 transition-colors`}
                        onClick={(t) => {
                          t.stopPropagation();
                          d.onRefresh?.(id);
                        }}
                        title={`刷新状态`}
                      >
                        <RefreshCw size={12} />
                        <span className={`text-[10px]`}>刷新</span>
                      </button>
                      <div
                        className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`}
                        onClick={(t) => {
                          t.stopPropagation();
                          d.onStop?.(id);
                        }}
                      >
                        <div className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>
                          停止
                        </div>
                        <button
                          className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}
                        >
                          <Square size={10} fill={`currentColor`} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerate();
                      }}
                    >
                      <div className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>
                        生成
                      </div>
                      <button
                        className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}
                      >
                        <Send size={14} strokeWidth={3} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

        return (
          <Fragment>
            <div
              className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl w-[500px] transition-all duration-300 origin-top z-50
                ${expanded ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {!showEditorModal && panelContent}
              {expanded && !showEditorModal && (
                <TextareaResizeHandle
                  targetRef={textareaRef as React.RefObject<HTMLTextAreaElement | null>}
                  onRequestFullscreen={() => setShowEditorModal(true)}
                  onResizeEnd={(w, h) => updateNodeData(id, { inputWidth: w, inputHeight: h })}
                />
              )}
            </div>
            <FullscreenEditorModal
              open={showEditorModal}
              title={`编辑提示词 - 特惠视频`}
              onClose={() => setShowEditorModal(false)}
            >
              {panelContent}
            </FullscreenEditorModal>
          </Fragment>
        );
      })()}

      {showFullscreen && d.videoUrl && createPortal(
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md`}
          onClick={() => setShowFullscreen(false)}
        >
          <button
            className={`absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50`}
            onClick={() => setShowFullscreen(false)}
          >
            <X size={32} />
          </button>
          <video
            src={d.videoUrl}
            className={`max-w-[95vw] max-h-[95vh] object-contain shadow-2xl rounded-lg outline-none`}
            controls={true}
            autoPlay={true}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setShowFullscreen(true);
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}

export default memo(Sd2VideoNode);
