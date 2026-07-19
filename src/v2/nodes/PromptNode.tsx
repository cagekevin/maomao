import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import {
  ImagePlus, Maximize2, Send, Download, Upload, Square, Play,
  Zap, X, FileText, AlertCircle, Pencil, Crop,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import ResizeController from './ResizeController';
import CustomHandle from './CustomHandle';

// ====== External Dependency Stubs ======

// TODO: implement - PromptTextarea 组件 (gi)
const PromptTextarea = memo((props: any) => {
  return <textarea {...props} ref={props.ref} />;
});

// TODO: implement - PresetPromptsButton 组件 (Ja)
const PresetPromptsButton = (_props: { category: string; presetPrompts: any[]; onApply: (t: string) => void; onToast: (msg: string) => void }) => {
  return null;
};

// TODO: implement - InputResizeHandle 组件 (_i)
const InputResizeHandle = (_props: { targetRef: React.RefObject<any>; onRequestFullscreen: () => void; onResizeEnd: (w: number, h: number) => void }) => {
  return null;
};

// TODO: implement - FullscreenEditorModal 组件 (vi)
const FullscreenEditorModal = (_props: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) => {
  return null;
};

// TODO: implement - LoadingOverlay 组件 (pi)
const LoadingOverlay = (_props: { label: string; backgroundUrl?: string; children: React.ReactNode }) => {
  return null;
};

// TODO: implement - LoadingSpinner 组件 (hi)
const LoadingSpinner = (_props: { category: string }) => {
  return null;
};

// TODO: implement - DownloadUrlButton 组件 (Yn)
const DownloadUrlButton = (_props: { url: string; fallbackExt: string; onToast: (msg: string) => void }) => {
  return null;
};

// TODO: implement - 获取原图配置
const Q_getConfig = async (_ref: string): Promise<string | null> => {
  return null;
};

// TODO: implement - 文件转 URL (ii)
const urlifyAsset = async (_file: File, _options: any): Promise<{ url: string; thumbnailUrl?: string }> => {
  return { url: '', thumbnailUrl: '' };
};

// TODO: implement - useThumbnail hook 工厂 (pr)
const useThumbnailHook = () => ({
  useThumbnail: () => false,
});

// TODO: implement - 响应式宽度 hook (oi)
const useResponsiveWidth = (_baseWidth: number): number => _baseWidth;

// TODO: implement - 响应式 URL (Lr)
const getResponsiveUrl = (_url: string | undefined, _width: number, _type: string): string | null => {
  return null;
};

// TODO: implement - 获取调度 ID (_a)
const getScheduleId = (_modelName: string): string | null => {
  return null;
};

// TODO: implement - 获取调度列表 (la)
const getSchedules = (): Array<{ id: string; name: string; steps: any[]; enabled: boolean; category: string }> => {
  return [];
};

// TODO: implement - 监听调度变化 (ha)
const onSchedulesChange = (_callback: (schedules: any[]) => void): void => {
  // empty
};

// TODO: implement - 获取调度模型 ID (ga)
const getScheduleModelId = (_scheduleId: string): string => {
  return '';
};

// TODO: implement - 是否内置模型 (Xi)
const isBuiltinModel = (_modelName: string): boolean => {
  return false;
};

// TODO: implement - 获取模型单价 (Ui)
const getModelCost = (_modelName: string): number | null => {
  return null;
};

// TODO: implement - 获取模型批量单价 (Wi)
const getModelCostPerBatch = (_modelName: string): number | null => {
  return null;
};

// TODO: implement - 获取模型项样式 (ea)
const getModelItemStyle = (_modelName: string, _isSelected: boolean): { className: string; title: string; disabled: boolean } => {
  return {
    className: `w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`,
    title: '',
    disabled: false,
  };
};

// TODO: implement - 格式化费用 (Zi)
const formatCost = (_cost: number): string => {
  return '0';
};

// ====== Types ======

interface ContextResource {
  id: string;
  url: string;
  sourceNodeId: string;
}

interface ConnectedResource {
  id: string;
  url: string;
  type: string;
  label?: string;
  isConnected?: boolean;
}

interface PromptNodeData {
  prompt?: string;
  aspectRatio?: string;
  imageSize?: string;
  selectedModel?: string;
  drawingModel?: string;
  apiFormat?: string;
  selectedContextResources?: ConnectedResource[];
  expanded?: boolean;
  imageUrl?: string;
  imageUrlRef?: string;
  imageUrlThumbRef?: string;
  thumbnailUrl?: string;
  loading?: boolean;
  errorMessage?: string;
  presetPrompts?: any[];
  inputWidth?: number;
  inputHeight?: number;
  _styleWidth?: number;
  onShowToast?: (msg: string) => void;
  onZoom?: (nodeId: string, ref: string | undefined, url: string) => void;
  onCrop?: (nodeId: string, url: string, ref: string | undefined) => void;
  onEdit?: (nodeId: string, ref: string | undefined, url: string) => void;
  onSendToActiveTab?: (url: string) => void;
  onAddImage?: (nodeId: string, url: string, ref: string | undefined, thumbRef?: string | undefined) => void;
  onGenerate?: (nodeId: string, prompt: string, size: string, model: string, format: string, batch: number) => void;
  onStop?: (nodeId: string) => void;
  [key: string]: unknown;
}

// ====== Component ======

const PromptNode = memo(({ id, data, selected, width }: { id: string; data: PromptNodeData; selected?: boolean; width?: number }) => {
  const { updateNodeData, setEdges, setNodes, getNode } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [prompt, setPrompt] = useState(data.prompt || ``);
  const [aspectRatio, setAspectRatio] = useState(() => {
    const stored = localStorage.getItem(`mutiwindow_prompt_aspectRatio`);
    return data.aspectRatio || stored || `Auto`;
  });
  const [imageSize, setImageSize] = useState(() => {
    const stored = localStorage.getItem(`mutiwindow_prompt_imageSize`);
    return data.imageSize || stored || `1K`;
  });

  useEffect(() => {
    const stored = localStorage.getItem(`mutiwindow_prompt_aspectRatio`);
    const val = data.aspectRatio || stored || `Auto`;
    if (val !== data.aspectRatio) updateNodeData(id, { aspectRatio: val });
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(`mutiwindow_prompt_imageSize`);
    const val = data.imageSize || stored || `1K`;
    if (val !== data.imageSize) updateNodeData(id, { imageSize: val });
  }, []);

  const [showAspectPopup, setShowAspectPopup] = useState(false);
  const aspectPopupRef = useRef<HTMLDivElement>(null);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [showModelPopup, setShowModelPopup] = useState(false);
  const [showMoreRatios, setShowMoreRatios] = useState(false);
  const modelPopupRef = useRef<HTMLDivElement>(null);
  const [showFormatPopup, setShowFormatPopup] = useState(false);
  const formatPopupRef = useRef<HTMLDivElement>(null);
  const [showBatchPopup, setShowBatchPopup] = useState(false);
  const batchPopupRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpandedState] = useState(data.expanded === undefined ? true : data.expanded);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [selectedContextResources, setSelectedContextResources] = useState(data.selectedContextResources || []);
  const [selectedModel, setSelectedModel] = useState(
    data.selectedModel ||
    localStorage.getItem(`mutiwindow_prompt_model`) ||
    (data.drawingModel && data.drawingModel.split(`\n`)[0].trim()) ||
    ``
  );
  const [apiFormat, setApiFormat] = useState(data.apiFormat || `auto`);
  const [batchCount, setBatchCount] = useState(1);
  const [schedules, setSchedules] = useState(() => getSchedules().filter(s => s.enabled && s.category === `image`));

  useEffect(() => {
    onSchedulesChange((list: any[]) => {
      setSchedules(list.filter((s: any) => s.enabled && s.category === `image`));
    });
  }, []);

  const scheduleId = getScheduleId(selectedModel);
  const scheduleEntry = scheduleId ? schedules.find(s => s.id === scheduleId) : null;
  const presetPrompts = data.presetPrompts || [];

  const applyPreset = (text: string) => {
    if (!text) return;
    const newPrompt = prompt ? `${prompt}, ${text}` : text;
    setPrompt(newPrompt);
    updateNodeData(id, { prompt: newPrompt });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<any>(null);
  const mentionContainerRef = useRef<HTMLDivElement>(null);

  const isGeminiFormat = useMemo(() => {
    const lower = (selectedModel || ``).toLowerCase();
    const hasGeminiKeyword = lower.includes(`banana`) || lower.includes(`gemini`) || lower.includes(`香蕉`) || lower.includes(`芭蕉`);
    return apiFormat === `gemini` || (apiFormat === `auto` && hasGeminiKeyword);
  }, [selectedModel, apiFormat]);

  const ratioOptions = useMemo(() => {
    if (isGeminiFormat) {
      return showMoreRatios
        ? [`Auto`, `1:1`, `1:4`, `1:8`, `2:3`, `3:2`, `3:4`, `4:1`, `4:3`, `4:5`, `5:4`, `8:1`, `9:16`, `16:9`, `21:9`, `9:21`, `1:3`, `3:1`, `2:1`, `1:2`]
        : Array.from(new Set([`Auto`, `1:1`, `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, `21:9`, aspectRatio]));
    }
    return [`Auto`, `1:1`, `16:9`, `9:16`, `3:2`, `2:3`, `4:3`, `3:4`, `21:9`, `9:21`, `1:3`, `3:1`, `2:1`, `1:2`];
  }, [isGeminiFormat, showMoreRatios, aspectRatio]);

  useEffect(() => {
    setPrompt(data.prompt || ``);
    if (data.aspectRatio !== undefined) setAspectRatio(data.aspectRatio);
    if (data.imageSize !== undefined) setImageSize(data.imageSize);
    if (data.selectedModel !== undefined) setSelectedModel(data.selectedModel);
    if (data.apiFormat !== undefined) setApiFormat(data.apiFormat);
    if (data.selectedContextResources) setSelectedContextResources(data.selectedContextResources);
    if (data.expanded !== undefined) setExpandedState(data.expanded);
  }, [data.prompt, data.aspectRatio, data.imageSize, data.selectedModel, data.apiFormat, data.selectedContextResources, data.expanded]);

  useEffect(() => {
    if (!getScheduleId(selectedModel) && data.drawingModel) {
      const models = data.drawingModel.split(`\n`).map((m: string) => m.trim()).filter(Boolean);
      if (models.length > 0 && (!selectedModel || !models.includes(selectedModel))) {
        setSelectedModel(models[0]);
        updateNodeData(id, { selectedModel: models[0] });
      }
    }
  }, [data.drawingModel, selectedModel, id, updateNodeData]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (aspectPopupRef.current && !aspectPopupRef.current.contains(e.target as Node)) setShowAspectPopup(false);
      if (modelPopupRef.current && !modelPopupRef.current.contains(e.target as Node)) setShowModelPopup(false);
      if (formatPopupRef.current && !formatPopupRef.current.contains(e.target as Node)) setShowFormatPopup(false);
      if (batchPopupRef.current && !batchPopupRef.current.contains(e.target as Node)) setShowBatchPopup(false);
    };
    if (showAspectPopup || showModelPopup || showFormatPopup || showBatchPopup) {
      document.addEventListener(`mousedown`, handler, true);
    }
    return () => {
      document.removeEventListener(`mousedown`, handler, true);
    };
  }, [showAspectPopup, showModelPopup, showFormatPopup, showBatchPopup]);

  const connections = useHandleConnections({ type: 'target' });
  const sourceNodes = useMemo(
    () => connections.map(c => getNode(c.source)).filter(Boolean) as Array<{ id: string; data: any; type?: string }>,
    [connections, getNode]
  );

  const contextResources = useMemo((): { images: ContextResource[]; texts: Array<{ id: string; sourceNodeId: string; label: string; text: string }> } => {
    if (!sourceNodes) return { images: [], texts: [] };
    const nodes = Array.isArray(sourceNodes) ? sourceNodes : [sourceNodes];
    const images: ContextResource[] = [];
    const texts: Array<{ id: string; sourceNodeId: string; label: string; text: string }> = [];

    nodes.forEach(node => {
      if (!node) return;
      const conn = connections.find(c => c.source === node?.id);

      if (node?.data?.imageUrl) {
        images.push({ id: node.id, url: node.data.imageUrl, sourceNodeId: node.id });
      }

      if (node?.type === `videoExtractNode` && node?.data?.extractedImages) {
        if (conn && conn.sourceHandle && conn.sourceHandle.startsWith(`frame-`)) {
          const frameIdx = parseInt(conn.sourceHandle.replace(`frame-`, ``), 10);
          if (!(node.data.hiddenIndices || []).includes(frameIdx)) {
            const allImages = node.data.allExtractedImages;
            if (allImages && allImages[frameIdx]) {
              images.push({ id: `${node.id}-ext-${frameIdx}`, url: allImages[frameIdx], sourceNodeId: node.id });
            }
          }
        } else {
          node.data.extractedImages.forEach((url: string, idx: number) => {
            images.push({ id: `${node.id}-ext-${idx}`, url, sourceNodeId: node.id });
          });
        }
      }

      if (node?.type === `imageBoxNode` && Array.isArray(node.data?.images)) {
        const imgs = node.data.images;
        const selIds = node.data.selectedIds || [];
        if (selIds.length > 0) {
          const selSet = new Set(selIds);
          imgs.forEach((img: any, idx: number) => {
            if (img?.url && selSet.has(img.id)) {
              images.push({ id: `${node.id}-box-${idx}`, url: img.url, sourceNodeId: node.id });
            }
          });
        } else {
          const activeImg = imgs[typeof node.data.activeIndex === `number` ? node.data.activeIndex : 0]?.url;
          if (activeImg) {
            images.push({ id: `${node.id}-box-active`, url: activeImg, sourceNodeId: node.id });
          }
        }
      }

      const skipTypes = new Set([`promptNode`, `imageNode`, `imageBoxNode`, `videoNode`, `sd2VideoNode`, `discountVideoNode`, `gridSplitNode`, `gridMergeNode`, `cropNode`, `urlToImageNode`, `fileToUrlNode`, `panoramaNode`, `videoExtractNode`]);
      if (node?.data?.text && !skipTypes.has(node.type!)) {
        const text = String(node.data.text).trim();
        if (node.type === `textNode` && (/^https?:\/\/[^\s]+$/.test(text) || text.startsWith(`data:image/`))) {
          images.push({ id: node.id, url: text, sourceNodeId: node.id });
        } else {
          texts.push({
            id: node.id,
            sourceNodeId: node.id,
            label: node?.type === `audioNode` ? `听音断句结果` : node.data.label || `文本节点`,
            text: node.data.text,
          });
        }
      }
    });

    return { images, texts };
  }, [sourceNodes, connections]);

  const toggleExpanded = () => {
    setExpandedState(!expanded);
    updateNodeData(id, { expanded: !expanded });
  };

  const imageUrl = data.imageUrl;
  const imageUrlRef = data.imageUrlRef;
  const imageUrlThumbRef = data.imageUrlThumbRef;
  const thumbnailUrl = data.thumbnailUrl;
  const { useThumbnail } = useThumbnailHook();
  const responsiveWidth = useResponsiveWidth(width ?? data._styleWidth ?? 420);
  const displayUrl = useThumbnail ? (getResponsiveUrl(imageUrl, responsiveWidth, `image`) || thumbnailUrl || imageUrl) : (imageUrl || thumbnailUrl);
  const isLoading = data.loading;
  const errorMessage = data.errorMessage;

  const insertMention = (mention: string, replaceMode = false) => {
    const textareaComp = textareaRef.current;
    const textareaEl = textareaComp?.textareaRef?.current || textareaComp;
    const mentionStr = `@${mention} `;
    if (!textareaEl) {
      const newPrompt = replaceMode && mentionIndex >= 0
        ? prompt.substring(0, mentionIndex) + mentionStr + prompt.substring(mentionIndex + 1)
        : prompt + mentionStr;
      setPrompt(newPrompt);
      updateNodeData(id, { prompt: newPrompt });
      return;
    }
    const selStart = textareaEl.selectionStart ?? prompt.length;
    const selEnd = textareaEl.selectionEnd ?? prompt.length;
    let before: string;
    let after: string;
    if (replaceMode && mentionIndex >= 0) {
      before = prompt.substring(0, mentionIndex);
      after = prompt.substring(mentionIndex + 1);
    } else {
      before = prompt.substring(0, selStart);
      after = prompt.substring(selEnd);
    }
    const newPrompt = before + mentionStr + after;
    setPrompt(newPrompt);
    updateNodeData(id, { prompt: newPrompt });
    const cursorPos = before.length + mentionStr.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current?.textareaRef?.current || textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
      }
    });
  };

  const getMentionLabel = (resource: { id: string; type: string }) => {
    if (resource.type.startsWith(`image`)) return `图片${contextResources.images.findIndex(r => r.id === resource.id) + 1}`;
    if (resource.type.startsWith(`text`)) return `文本${contextResources.texts.findIndex(r => r.id === resource.id) + 1}`;
    return `素材1`;
  };

  const handleDownload = async (event: React.MouseEvent) => {
    if (event.stopPropagation(), !imageUrl) return;
    let downloadUrl = imageUrl;
    let usedOriginal = false;
    if (console.log(`[PromptNode] 下载开始:`, { nodeId: id, imageUrlRef, currentImageLength: imageUrl?.length }), imageUrlRef) try {
      const original = await Q_getConfig(imageUrlRef);
      console.log(`[PromptNode] 读取原图结果:`, { imageUrlRef, originalFound: !!original, originalLength: original?.length });
      if (original && typeof original === `string` && original.length > 1e4) {
        downloadUrl = original;
        usedOriginal = true;
        console.log(`[PromptNode] 下载使用原图成功, size:`, original.length);
      } else {
        console.log(`[PromptNode] 原图未找到或数据异常，使用当前图片`);
      }
    } catch (err) {
      console.warn(`[PromptNode] 获取原图失败，使用当前图片:`, err);
    } else {
      console.log(`[PromptNode] 无原图引用(imageUrlRef)，下载当前图片`);
    }
    console.log(`[PromptNode] 开始下载:`, { useOriginal: usedOriginal, urlLength: downloadUrl.length, isHttp: downloadUrl.startsWith(`http`) });
    try {
      if (typeof chrome < `u` && (chrome as any).downloads) {
        (chrome as any).downloads.download({ url: downloadUrl, filename: `yimao/generated-${Date.now()}.png`, saveAs: false });
      } else {
        const blob = await (await fetch(downloadUrl)).blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement(`a`);
        a.href = blobUrl;
        a.download = `generated-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1e3);
      }
    } catch (err) {
      console.error(`[PromptNode] 下载失败:`, err);
      data.onShowToast && data.onShowToast(`下载失败，可能因跨域限制`);
      window.open(downloadUrl, `_blank`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await urlifyAsset(file, { subfolder: `canvas/upload`, preferThumbnail: true, thumbMaxDim: 480, thumbQuality: 75 });
      if (result.url && /^https?:\/\//i.test(result.url)) {
        data.onAddImage && data.onAddImage(id, result.url, result.url, result.thumbnailUrl || result.url);
        event.target.value = ``;
        return;
      }
    } catch (err) {
      console.warn(`[PromptNode] urlifyAsset failed, fallback to base64:`, err);
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = (evt.target as FileReader).result;
      data.onAddImage && data.onAddImage(id, result as string, imageUrlRef, imageUrlThumbRef);
    };
    reader.readAsDataURL(file);
    event.target.value = ``;
  };

  // Parse aspect ratio to numeric value
  const parseAspectRatio = (ratio: string | undefined): number | null => {
    if (!ratio || ratio === `Auto`) return null;
    const match = ratio.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const w = parseFloat(match[1]);
    const h = parseFloat(match[2]);
    if (!w || !h) return null;
    return w / h;
  };

  const ratioValue = parseAspectRatio(aspectRatio);
  const hasRatio = ratioValue !== null;
  const ratioWidth = hasRatio && ratioValue ? Math.round(360 * Math.sqrt(ratioValue)) : null;
  const ratioHeight = hasRatio && ratioValue ? Math.round(360 / Math.sqrt(ratioValue)) : null;

  const prevRatioHeightRef = useRef(ratioHeight);
  const animFrameRef = useRef<number | null>(null);
  const [animatedHeight, setAnimatedHeight] = useState<number | null>(null);

  // Aspect ratio animation effect
  useEffect(() => {
    const prevHeight = prevRatioHeightRef.current;
    prevRatioHeightRef.current = ratioHeight;

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (ratioWidth === null || ratioHeight === null) {
      setAnimatedHeight(null);
      setNodes((nodes: any[]) => nodes.map((node: any) => {
        if (node.id !== id || node.style?.height !== undefined) return node;
        const diff = 420 - (node.style?.width ?? node.width ?? 360);
        return {
          ...node,
          width: 420,
          height: 420,
          style: { ...node.style, width: 420, height: 420 },
          position: { x: node.position.x - diff / 2, y: node.position.y },
        };
      }));
      return;
    }

    const currentNode = getNode(id);
    const currentWidth = currentNode?.style?.width ?? currentNode?.width ?? 360;
    const currentX = currentNode?.position.x ?? 0;
    const currentY = currentNode?.position.y ?? 0;
    const startHeight = prevHeight ?? ratioHeight;
    const targetWidth = ratioWidth;
    const targetHeight = ratioHeight;

    if (prevHeight === null || (Math.round(currentWidth) === targetWidth && Math.round(startHeight) === targetHeight)) {
      setAnimatedHeight(null);
      setNodes((nodes: any[]) => nodes.map((node: any) => {
        if (node.id !== id) return node;
        const nodeWidth = node.style?.width ?? node.width ?? 360;
        if (Math.round(nodeWidth) === targetWidth && node.style?.height === undefined) return node;
        const diff = targetWidth - nodeWidth;
        const newStyle = { ...node.style, width: targetWidth };
        delete (newStyle as any).height;
        return {
          ...node,
          width: targetWidth,
          height: undefined,
          style: newStyle,
          position: { x: node.position.x - diff / 2, y: node.position.y },
        };
      }));
      return;
    }

    const easeOut = (t: number) => 1 - (1 - t) ** 3;
    const bottomY = currentY + startHeight;
    const centerX = currentX + currentWidth / 2;
    const startTime = performance.now();

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startTime) / 360);
      const eased = easeOut(progress);
      const animWidth = currentWidth + (targetWidth - currentWidth) * eased;
      const animHeight = startHeight + (targetHeight - startHeight) * eased;

      setAnimatedHeight(animHeight);
      setNodes((nodes: any[]) => nodes.map((node: any) => {
        if (node.id !== id) return node;
        const newStyle = { ...node.style, width: animWidth };
        delete (newStyle as any).height;
        return {
          ...node,
          width: animWidth,
          height: undefined,
          style: newStyle,
          position: { x: centerX - animWidth / 2, y: bottomY - animHeight },
        };
      }));

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
        setAnimatedHeight(null);
        setNodes((nodes: any[]) => nodes.map((node: any) => {
          if (node.id !== id) return node;
          const newStyle = { ...node.style, width: targetWidth };
          delete (newStyle as any).height;
          return {
            ...node,
            width: targetWidth,
            height: undefined,
            style: newStyle,
            position: { x: centerX - targetWidth / 2, y: bottomY - targetHeight },
          };
        }));
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [ratioWidth, ratioHeight, id, setNodes, getNode]);

  // Build the expanded panel content
  const expandedPanel = (() => {
    const allImages: Array<ConnectedResource & { isConnected: boolean }> = [
      ...contextResources.images.map(img => ({ ...img, isConnected: true })),
      ...selectedContextResources.filter(r => r.type.startsWith(`image`)).map(r => ({ ...r, isConnected: false })),
    ];

    const panelContent = (
      <div className={`space-y-3`}>
        <div className={`flex flex-col gap-2 mb-2`}>
          {(allImages.length > 0 || contextResources.texts.length > 0) && (
            <div className={`flex flex-wrap gap-2 mb-1`}>
              {allImages.map((img, idx) => {
                const label = `图片${idx + 1}`;
                return (
                  <div key={`img-${idx}`} className={`w-10 h-10 rounded-md overflow-hidden relative group bg-black`} title={img.isConnected ? `已连线的图片` : `上传的图片`}>
                    <img src={img.url} className={`w-full h-full object-cover opacity-80`} />
                    <div className={`absolute inset-0 bg-blue-500/10 pointer-events-none`} />
                    <button
                      type={`button`}
                      className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`}
                      title={`点击插入 @${label}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => { e.stopPropagation(); insertMention(label); }}
                    >
                      {label}
                    </button>
                    <div
                      className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (img.isConnected) {
                          setEdges((edges: any[]) => edges.filter(edge => !(edge.source === img.sourceNodeId && edge.target === id)));
                        } else {
                          const next = selectedContextResources.filter(r => r.id !== img.id);
                          setSelectedContextResources(next);
                          updateNodeData(id, { selectedContextResources: next });
                        }
                      }}
                    >
                      <X size={10} className={`text-white`} />
                    </div>
                  </div>
                );
              })}
              {contextResources.texts.map((txt, idx) => {
                const label = `文本${idx + 1}`;
                return (
                  <div
                    key={`txt-${idx}`}
                    className={`h-8 px-2 bg-[#2a2a2a] border border-[#444] rounded flex items-center gap-1 text-[10px] text-gray-300 hover:bg-[#333] hover:border-blue-500 hover:text-blue-400 transition-colors cursor-pointer group/text relative`}
                    title={txt.text}
                    onClick={(e) => { e.stopPropagation(); insertMention(label); }}
                  >
                    <FileText size={10} />
                    <span className={`max-w-[80px] truncate`}>{label} ({txt.label})</span>
                    <div
                      className={`absolute -top-1 -right-1 p-0.5 bg-black hover:bg-red-500 rounded-full cursor-pointer opacity-0 group-hover/text:opacity-100 transition-all`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEdges((edges: any[]) => edges.filter(edge => !(edge.source === txt.sourceNodeId && edge.target === id)));
                      }}
                    >
                      <X size={10} className={`text-white`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`flex items-start gap-2`}>
            <div className={`flex-1 nodrag relative`} ref={mentionContainerRef}>
              <PromptTextarea
                ref={textareaRef}
                className={`w-full bg-transparent text-[15px] text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan`}
                style={{
                  width: data.inputWidth ? `${data.inputWidth}px` : undefined,
                  height: data.inputHeight ? `${data.inputHeight}px` : `80px`,
                  minHeight: `80px`,
                  overflow: `auto`,
                }}
                placeholder={`描述你想要的画面 (输入 @ 调出素材)...`}
                value={prompt}
                onChange={(value: string) => {
                  const textareaEl = textareaRef.current?.textareaRef?.current || textareaRef.current;
                  const cursorPos = textareaEl ? (textareaEl as HTMLTextAreaElement).selectionStart : value.length;
                  setPrompt(value);
                  updateNodeData(id, { prompt: value });
                  const before = value.substring(0, cursorPos);
                  const atIdx = before.lastIndexOf(`@`);
                  if (atIdx >= 0) {
                    const charBefore = atIdx === 0 ? `` : before[atIdx - 1];
                    const afterAt = before.substring(atIdx + 1);
                    const isStandalone = atIdx === 0 || /\s/.test(charBefore);
                    const noSpaceAfter = !/\s/.test(afterAt);
                    if (isStandalone && noSpaceAfter) {
                      setMentionIndex(atIdx);
                      setShowMentionPopup(true);
                      return;
                    }
                  }
                  setMentionIndex(-1);
                  setShowMentionPopup(false);
                  if (!data.inputHeight || data.inputHeight <= 200) {
                    requestAnimationFrame(() => {
                      if (textareaEl) {
                        (textareaEl as HTMLTextAreaElement).style.height = `auto`;
                        const h = Math.max(80, Math.min((textareaEl as HTMLTextAreaElement).scrollHeight, 200));
                        (textareaEl as HTMLTextAreaElement).style.height = h + `px`;
                        updateNodeData(id, { inputHeight: h });
                      }
                    });
                  }
                }}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === `Escape` && showMentionPopup) setShowMentionPopup(false);
                }}
                autoFocus={expanded}
                onWheel={(e: React.WheelEvent) => e.stopPropagation()}
              />

              {showMentionPopup && (
                <div
                  className={`absolute bottom-[calc(100%+4px)] left-0 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[999999] flex flex-col overflow-hidden h-[300px] nopan`}
                  onWheel={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`}>
                    <div className={`text-xs text-gray-300 font-bold flex items-center gap-2`}>
                      <span>选择素材引用</span>
                    </div>
                    <button onClick={() => setShowMentionPopup(false)} className={`text-gray-500 hover:text-white p-1`}>
                      <X size={12} />
                    </button>
                  </div>
                  <div className={`p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}>
                    {(() => {
                      const items = [
                        ...contextResources.images.map(img => ({ id: img.id, url: img.url, type: `image` })),
                        ...contextResources.texts.map(txt => ({ id: txt.id, url: txt.text, type: `text`, label: txt.label })),
                      ];
                      return items.length === 0 ? (
                        <div className={`text-center text-gray-500 text-xs py-10`}>暂无素材，请先连线</div>
                      ) : (
                        <div className={`grid grid-cols-4 gap-1.5`}>
                          {items.map(item => (
                            <div
                              key={item.id}
                              className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group flex flex-col`}
                              onClick={() => {
                                insertMention(getMentionLabel(item), true);
                                setMentionIndex(-1);
                                setShowMentionPopup(false);
                              }}
                            >
                              {item.type.startsWith(`image`) ? (
                                <img src={item.url} className={`w-full h-full object-cover`} />
                              ) : (
                                <div className={`w-full h-full bg-[#222] flex flex-col items-center justify-center p-1 text-center`}>
                                  <FileText size={16} className={`text-blue-400 opacity-80 mb-1`} />
                                  <span className={`text-[8px] text-gray-400 truncate w-full`}>{item.label}</span>
                                </div>
                              )}
                              <div className={`absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity`}>
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

          <div className={`flex items-center justify-between mt-2 pt-2 border-t border-[#2a2a2a] nodrag`}>
            <div className={`flex items-center gap-1.5 overflow-visible`}>
              {/* Aspect Ratio / Image Size Selector */}
              <div className={`relative nodrag`} ref={aspectPopupRef}>
                <button
                  type={`button`}
                  className={`flex items-center gap-1.5 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`}
                  onMouseDown={(e) => { e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); setShowAspectPopup(!showAspectPopup); }}
                >
                  <div className={`w-2.5 h-3 border border-current rounded-[2px]`} />
                  <span>{aspectRatio} · {imageSize}</span>
                </button>
                {showAspectPopup && (
                  <div
                    className={`absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      <div className={`text-[10px] text-gray-500 mb-2`}>画质</div>
                      <div className={`flex gap-1.5`}>
                        {[`1K`, `2K`, `4K`].map(size => (
                          <button
                            key={size}
                            type={`button`}
                            className={`flex-1 py-1.5 text-[11px] rounded-md border transition-colors ${imageSize === size ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`}
                            onMouseDown={(e) => { e.stopPropagation(); }}
                            onClick={() => {
                              setShowAspectPopup(false);
                              setImageSize(size);
                              requestAnimationFrame(() => {
                                updateNodeData(id, { imageSize: size });
                                localStorage.setItem(`mutiwindow_prompt_imageSize`, size);
                              });
                            }}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className={`text-[10px] text-gray-500 mb-2`}>比例</div>
                      <div className={`flex flex-wrap gap-1.5`}>
                        {ratioOptions.map(ratio => (
                          <button
                            key={ratio}
                            type={`button`}
                            className={`px-3 py-1.5 text-[11px] rounded-md border transition-colors ${aspectRatio === ratio ? `bg-[#333] border-[#555] text-white` : `bg-[#1a1a1a] border-transparent text-gray-400 hover:bg-[#2a2a2a]`}`}
                            onMouseDown={(e) => { e.stopPropagation(); }}
                            onClick={() => {
                              setShowAspectPopup(false);
                              setAspectRatio(ratio);
                              requestAnimationFrame(() => {
                                updateNodeData(id, { aspectRatio: ratio });
                                localStorage.setItem(`mutiwindow_prompt_aspectRatio`, ratio);
                              });
                            }}
                          >
                            {ratio}
                          </button>
                        ))}
                        {isGeminiFormat && !showMoreRatios && (
                          <button
                            type={`button`}
                            className={`px-3 py-1.5 text-[11px] rounded-md border border-transparent bg-[#1a1a1a] text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-400 transition-colors`}
                            onMouseDown={(e) => { e.stopPropagation(); }}
                            onClick={() => setShowMoreRatios(true)}
                          >
                            更多...
                          </button>
                        )}
                        {isGeminiFormat && showMoreRatios && (
                          <button
                            type={`button`}
                            className={`px-3 py-1.5 text-[11px] rounded-md border border-transparent bg-[#1a1a1a] text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-400 transition-colors`}
                            onMouseDown={(e) => { e.stopPropagation(); }}
                            onClick={() => setShowMoreRatios(false)}
                          >
                            收起
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Model Selector */}
              {!!(data.drawingModel && data.drawingModel.split(`\n`).filter((m: string) => m.trim() !== ``).length > 0 || schedules.length > 0) && (
                <div className={`relative nodrag flex items-center`} ref={modelPopupRef}>
                  <div className={`w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5`} />
                  <button
                    className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`}
                    onClick={(e) => { e.stopPropagation(); setShowModelPopup(!showModelPopup); }}
                    title={scheduleEntry ? `调度：${scheduleEntry.name}` : selectedModel ? `${selectedModel}（${isBuiltinModel(selectedModel) ? `内置` : `第三方`}）` : `选择模型`}
                  >
                    {scheduleEntry ? (
                      <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>调度</span>
                    ) : selectedModel ? (
                      <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${isBuiltinModel(selectedModel) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                        {isBuiltinModel(selectedModel) ? `内置` : `三方`}
                      </span>
                    ) : null}
                    <span className={`whitespace-nowrap`}>
                      {scheduleEntry ? scheduleEntry.name : selectedModel || `选择模型`}
                    </span>
                  </button>
                  {showModelPopup && (
                    <div
                      className={`absolute bottom-full left-0 mb-1 min-w-[17rem] w-max max-w-[29rem] bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block max-h-60 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const drawingModels = (data.drawingModel || ``).split(`\n`).map((m: string) => m.trim()).filter((m: string) => m !== ``);
                        const builtinModels = drawingModels.filter((m: string) => isBuiltinModel(m)).sort((a: string, b: string) => a.localeCompare(b));
                        const thirdPartyModels = drawingModels.filter((m: string) => !isBuiltinModel(m)).sort((a: string, b: string) => a.localeCompare(b));

                        const renderModelItem = (modelName: string, index: number, isBuiltin: boolean) => {
                          const cost = isBuiltin ? getModelCost(modelName) : null;
                          const costPerBatch = isBuiltin ? getModelCostPerBatch(modelName) : null;
                          const style = getModelItemStyle(modelName, selectedModel === modelName);
                          return (
                            <div
                              key={`${isBuiltin ? `b` : `o`}-${index}`}
                              role={`button`}
                              className={style.className}
                              title={style.title}
                              onClick={() => {
                                if (style.disabled) return;
                                setSelectedModel(modelName);
                                updateNodeData(id, { selectedModel: modelName });
                                localStorage.setItem(`mutiwindow_prompt_model`, modelName);
                                setShowModelPopup(false);
                              }}
                            >
                              <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ${isBuiltin ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`}`}>
                                {isBuiltin ? `内置` : `三方`}
                              </span>
                              <span className={`flex-1 whitespace-nowrap`}>{modelName}</span>
                              {cost !== null && (
                                <span className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums`}>
                                  <Zap className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                  <span>{formatCost(cost)}{costPerBatch ? `/${costPerBatch}` : ``}</span>
                                </span>
                              )}
                            </div>
                          );
                        };

                        return (
                          <>
                            {schedules.length > 0 && (
                              <>
                                <div className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center justify-between`}>
                                  <span className={`flex items-center gap-1`}>
                                    <Zap className={`w-2.5 h-2.5`} strokeWidth={2.5} />
                                    <span>模型调度</span>
                                  </span>
                                  <span
                                    className={`ml-auto text-white/90 hover:text-white cursor-pointer transition-colors`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.dispatchEvent(new CustomEvent(`mutiwindow-open-schedule-settings`));
                                    }}
                                  >
                                    配置 ›
                                  </span>
                                </div>
                                {schedules.map(sched => {
                                  const modelId = getScheduleModelId(sched.id);
                                  return (
                                    <div
                                      key={sched.id}
                                      role={`button`}
                                      className={`w-full flex items-center gap-1.5 mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors cursor-pointer ${selectedModel === modelId ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`}
                                      onClick={() => {
                                        setSelectedModel(modelId);
                                        updateNodeData(id, { selectedModel: modelId });
                                        localStorage.setItem(`mutiwindow_prompt_model`, modelId);
                                        setShowModelPopup(false);
                                      }}
                                      title={`${sched.name}（${sched.steps.length} 个模型按序重试）`}
                                    >
                                      <span className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border bg-blue-500/20 text-blue-200 border-blue-400/40`}>调度</span>
                                      <span className={`flex-1 whitespace-nowrap`}>{sched.name}</span>
                                      <span className={`shrink-0 text-[10px] text-gray-500`}>{sched.steps.length} 模型</span>
                                    </div>
                                  );
                                })}
                                {(builtinModels.length > 0 || thirdPartyModels.length > 0) && (
                                  <div className={`h-px bg-[#333] my-1.5`} />
                                )}
                              </>
                            )}
                            {builtinModels.length > 0 && (
                              <>
                                <div className={`text-[10px] text-blue-300 mb-1 px-1 flex items-center gap-1`}>
                                  <span>✨</span>
                                  <span>内置模型</span>
                                  <span
                                    className={`ml-auto text-white/90 hover:text-white cursor-pointer whitespace-nowrap`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.dispatchEvent(new CustomEvent(`mutiwindow-open-builtin-settings`));
                                      setShowModelPopup(false);
                                    }}
                                    title={`查看内置模型详情`}
                                  >
                                    详情 ›
                                  </span>
                                </div>
                                {builtinModels.map((model, idx) => renderModelItem(model, idx, true))}
                              </>
                            )}
                            {thirdPartyModels.length > 0 && (
                              <>
                                {builtinModels.length > 0 && <div className={`h-px bg-[#333] my-1.5`} />}
                                <div className={`text-[10px] text-gray-500 mb-1 px-1`}>第三方 API</div>
                                {thirdPartyModels.map((model, idx) => renderModelItem(model, idx, false))}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* API Format Selector */}
              <div className={`relative nodrag flex items-center`} ref={formatPopupRef}>
                <div className={`w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5`} />
                <button
                  className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`}
                  onClick={(e) => { e.stopPropagation(); setShowFormatPopup(!showFormatPopup); }}
                  title={`请求格式`}
                >
                  <span className={`truncate`}>
                    {apiFormat === `auto` ? `自动格式` : apiFormat === `openai` ? `OpenAI格式` : `Gemini格式`}
                  </span>
                </button>
                {showFormatPopup && (
                  <div
                    className={`absolute bottom-full left-0 mb-1 w-32 bg-[#222] border border-[#333] rounded-lg shadow-xl p-2 z-50 block nodrag`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={`text-[10px] text-gray-500 mb-2 px-1`}>请求格式</div>
                    {[
                      { label: `自动检测`, value: `auto` },
                      { label: `OpenAI 格式`, value: `openai` },
                      { label: `Gemini 格式`, value: `gemini` },
                    ].map(option => (
                      <button
                        key={option.value}
                        className={`w-full block mb-1 last:mb-0 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate ${apiFormat === option.value ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`}
                        onClick={() => {
                          setApiFormat(option.value);
                          updateNodeData(id, { apiFormat: option.value });
                          setShowFormatPopup(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preset Prompts */}
              <PresetPromptsButton
                category={`image`}
                presetPrompts={presetPrompts}
                onApply={applyPreset}
                onToast={(msg: string) => data.onShowToast?.(msg)}
              />
            </div>

            <div className={`flex items-center gap-3 flex-shrink-0 ml-2`}>
              {isLoading ? (
                <div
                  className={`flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn`}
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onStop && data.onStop(id);
                  }}
                >
                  <div className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>
                    停止
                  </div>
                  <button className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
                    <Square size={10} fill={`currentColor`} />
                  </button>
                </div>
              ) : (
                <div className={`flex items-center gap-2`}>
                  {/* Batch Count Selector */}
                  <div className={`relative nodrag flex items-center`} ref={batchPopupRef}>
                    <button
                      className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-[#333] hover:border-[#555] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`}
                      onClick={(e) => { e.stopPropagation(); setShowBatchPopup(!showBatchPopup); }}
                      title={`批量生成数量`}
                    >
                      <span>x{batchCount}</span>
                    </button>
                    {showBatchPopup && (
                      <div
                        className={`absolute bottom-full right-0 mb-1 w-16 bg-[#222] border border-[#333] rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            className={`w-full text-center py-1.5 text-[11px] rounded-md transition-colors ${batchCount === n ? `bg-[#333] text-white` : `text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`}`}
                            onClick={(e) => { e.stopPropagation(); setBatchCount(n); setShowBatchPopup(false); }}
                          >
                            x{n}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Generate Button */}
                  <div
                    className={`flex items-center bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] hover:border-gray-500 transition-colors cursor-pointer group/btn`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!prompt.trim() && contextResources.images.length === 0 && contextResources.texts.length === 0) {
                        data.onShowToast && data.onShowToast(`请输入提示词或连接参考节点`);
                        return;
                      }
                      data.onGenerate && data.onGenerate(id, prompt, `1024x1024`, selectedModel, apiFormat, batchCount);
                    }}
                  >
                    {selectedModel && isBuiltinModel(selectedModel) && getModelCost(selectedModel) !== null && (
                      <div className={`flex items-center gap-0.5 mr-2 text-[11px] text-orange-400 tabular-nums`}>
                        <Zap className={`w-3 h-3`} strokeWidth={2.5} />
                        <span>{formatCost((getModelCost(selectedModel) || 0) * batchCount)}</span>
                      </div>
                    )}
                    <div className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>
                      生成
                    </div>
                    <button className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
                      <Play size={14} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );

    return (
      <>
        <div
          className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${expanded ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `}
          onClick={(e) => e.stopPropagation()}
        >
          {!showFullscreen && panelContent}
          {expanded && !showFullscreen && (
            <InputResizeHandle
              targetRef={textareaRef}
              onRequestFullscreen={() => setShowFullscreen(true)}
              onResizeEnd={(w: number, h: number) => updateNodeData(id, { inputWidth: w, inputHeight: h })}
            />
          )}
        </div>
        <FullscreenEditor
          open={showFullscreen}
          title={`编辑提示词 - 生图`}
          onClose={() => setShowFullscreen(false)}
        >
          {panelContent}
        </FullscreenEditor>
      </>
    );
  })();

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center group/node w-full min-w-[160px] min-h-[160px] ${hasRatio ? `h-auto` : `h-full`} ${selected ? `z-50` : `z-10`}`}
    >
      <NodeTitle
        id={id}
        data={data}
        defaultTitle={`生图节点`}
        icon={<ImagePlus size={11} className={`text-gray-500`} />}
      />

      {!isLoading && (
        <div className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <div className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            {contextResources.images.length === 0 && (
              <button
                className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                title={`上传参考图`}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                <Upload size={14} />
              </button>
            )}
            {imageUrl && (
              <>
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                  title={`放大`}
                  onClick={(e) => { e.stopPropagation(); data.onZoom && data.onZoom(id, imageUrlRef, imageUrl); }}
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                  title={`裁剪`}
                  onClick={(e) => { e.stopPropagation(); data.onCrop && data.onCrop(id, imageUrl, imageUrlRef); }}
                >
                  <Crop size={14} />
                </button>
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                  title={`编辑`}
                  onClick={(e) => { e.stopPropagation(); data.onEdit && data.onEdit(id, imageUrlRef, imageUrl); }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  className={`p-1.5 text-gray-400 hover:text-blue-400 hover:bg-[#333] rounded-md`}
                  title={`发送到左侧网站`}
                  onClick={(e) => { e.stopPropagation(); data.onSendToActiveTab && data.onSendToActiveTab(imageUrl); }}
                >
                  <Send size={14} />
                </button>
                <DownloadUrlButton
                  url={imageUrl}
                  fallbackExt={`png`}
                  onToast={(msg: string) => data.onShowToast?.(msg)}
                />
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                  title={`下载`}
                  onClick={handleDownload}
                >
                  <Download size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <ResizeController visible={!!selected} minWidth={160} minHeight={160} keepAspectRatio={hasRatio} />

      <input
        type={`file`}
        ref={fileInputRef}
        style={{ display: `none` }}
        accept={`image/*`}
        onChange={handleFileUpload}
      />

      <div
        className={`relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-colors duration-300 cursor-pointer group/image w-full flex flex-col
          ${hasRatio ? `` : `flex-1`}
          ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `}
        style={hasRatio ? (animatedHeight === null ? (ratioValue ? { aspectRatio: String(ratioValue) } : undefined) : { height: animatedHeight }) : undefined}
        onClick={toggleExpanded}
      >
        <div className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${imageUrl ? `` : `bg-[#0d0c0c]`}`}>
          {imageUrl && (
            <img
              src={displayUrl}
              alt={`Generated Content`}
              loading={`lazy`}
              decoding={`async`}
              className={`max-w-full w-full h-full object-contain block ${isLoading ? `opacity-50 blur-sm` : ``}`}
              draggable={false}
              onError={(e) => {
                const target = e.currentTarget;
                if (imageUrl && target.src !== imageUrl) target.src = imageUrl;
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                data.onZoom && data.onZoom(id, imageUrlRef, imageUrl);
              }}
            />
          )}
          {isLoading && (
            <LoadingOverlay label={`生图中...`} backgroundUrl={imageUrl || contextResources.images[0]?.url}>
              <LoadingSpinner category={`image`} />
            </LoadingOverlay>
          )}
          {errorMessage && !isLoading && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
              <AlertCircle size={32} />
              <div className={`text-xs font-medium max-w-full break-words`}>{errorMessage}</div>
              <button
                className={`text-[10px] bg-[#333] hover:bg-[#444] text-gray-300 px-3 py-1 rounded-full border border-gray-600 transition-colors`}
                onClick={(e) => { e.stopPropagation(); }}
              >
                请检查设置或重试
              </button>
            </div>
          )}
          {!imageUrl && !isLoading && !errorMessage && (
            <div className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
              <ImagePlus size={80} className={`text-gray-700`} strokeWidth={1.2} />
            </div>
          )}
          <div className={`absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none`} />
        </div>
      </div>

      <CustomHandle type={`target`} position={Position.Left} variant={`large`} />
      <CustomHandle type={`source`} position={Position.Right} variant={`large`} />

      {expandedPanel}
    </div>
  );
});

export default PromptNode;