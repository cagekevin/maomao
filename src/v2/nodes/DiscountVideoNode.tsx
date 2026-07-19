// ============================================================
// 一毛AI画布 - 特惠视频生成节点 (DiscountVideoNode)
// 原版函数名: os (L11322-L12746)
// ============================================================
import { memo, useState, useRef, useEffect, useMemo, useReducer, Fragment } from 'react';
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
  Coins,
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
  setUploadedAssets: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  uploadingAssetsRef: React.MutableRefObject<Record<string, boolean>>;
  failedAssetsRef: React.MutableRefObject<Record<string, boolean>>;
  uploadAsset: (asset: { id: string; url: string; type: string }) => Promise<void>;
  getAssetStatus: (resId: string, resUrl: string) => { isUploading: boolean; isUploaded: boolean; isFailed: boolean };
  clearAllFailedAssets: () => void;
} {
  // TODO: implement
  const [uploadedAssets, setUploadedAssets] = useState<Record<string, string>>({});
  return {
    uploadedAssets,
    setUploadedAssets,
    uploadingAssetsRef: { current: {} },
    failedAssetsRef: { current: {} },
    uploadAsset: async () => {},
    getAssetStatus: () => ({ isUploading: false, isUploaded: false, isFailed: false }),
    clearAllFailedAssets: () => {},
  };
}

// TODO: implement ii - urlifyAsset
async function urlifyAsset(
  _file: File,
  _options: { subfolder: string; preferThumbnail?: boolean; thumbMaxDim?: number; thumbQuality?: number }
): Promise<{ url: string; thumbnailUrl?: string }> {
  // TODO: implement
  return { url: '' };
}

// TODO: implement yr - resizeImage
async function resizeImage(_file: File, _maxDim: number, _quality: number): Promise<string> {
  // TODO: implement
  return '';
}

// TODO: implement Li - prefetch API
async function prefetchApi(_url: string): Promise<void> {
  // TODO: implement
}

// TODO: implement zi - useInterval hook
function useInterval(_callback: () => void, _delay: number | null): void {
  // TODO: implement
}

// TODO: implement Ii - use some hook
function useSomeHook(): unknown {
  // TODO: implement
  return undefined;
}

// TODO: implement Fi - get discount video config
function getDiscountVideoConfig(): { discountVideoSpecs?: Record<string, unknown> } {
  // TODO: implement
  return {};
}

// TODO: implement Hi - get model spec by name
function getModelSpec(_modelName: string): unknown | null {
  // TODO: implement
  return null;
}

// TODO: implement Vo - get allowed values from spec
function getAllowedValues(_spec: unknown, _key: string, _defaults: string[]): string[] {
  // TODO: implement
  return _defaults;
}

// TODO: implement Fo - get duration spec
function getDurationSpec(_spec: unknown): { mode: string; options?: number[]; min?: number; max?: number; step?: number } | null {
  // TODO: implement
  return null;
}

// TODO: implement Bo - get spec value
function getSpecValue<T>(_spec: unknown, _key: string): T | undefined {
  // TODO: implement
  return undefined;
}

// TODO: implement Ho - get allowed durations
function getAllowedDurations(_spec: unknown, _defaults: number[]): number[] {
  // TODO: implement
  return _defaults;
}

// TODO: implement Uo - get duration range
function getDurationRange(_spec: unknown, _range: { min: number; max: number }): { min: number; max: number; step: number } {
  // TODO: implement
  return { min: _range.min, max: _range.max, step: 1 };
}

// TODO: implement Lo - check if duration is valid
function isDurationValid(_durationSpec: ReturnType<typeof getDurationSpec>, _duration: number): boolean {
  // TODO: implement
  return true;
}

// TODO: implement Go - validate generate params
function validateGenerateParams(_spec: unknown, _params: Record<string, unknown>): { ok: boolean; errors: string[] } {
  // TODO: implement
  return { ok: true, errors: [] };
}

// TODO: implement Xi - check if model is built-in
function isBuiltinModel(_modelName: string): boolean {
  // TODO: implement
  return false;
}

// TODO: implement Ui - get model price
function getModelPrice(_modelName: string): number | null {
  // TODO: implement
  return null;
}

// TODO: implement Wi - get model price unit
function getModelPriceUnit(_modelName: string): string | null {
  // TODO: implement
  return null;
}

// TODO: implement Zi - format price
function formatPrice(_price: number): string {
  // TODO: implement
  return String(_price);
}

// TODO: implement ea - get model button style
function getModelButtonStyle(_modelName: string, _isSelected: boolean): { className: string; disabled: boolean; title: string } {
  // TODO: implement
  return { className: '', disabled: false, title: '' };
}

// TODO: implement Yn - CopyUrlButton component
function CopyUrlButton(_props: { url: string; fallbackExt: string; onToast: (msg: string) => void }): React.ReactElement | null {
  // TODO: implement
  return null;
}

// TODO: implement pi - LoadingOverlay component
function LoadingOverlay(_props: {
  label: string;
  backgroundUrl?: string;
  children: React.ReactNode;
}): React.ReactElement | null {
  // TODO: implement
  return null;
}

// TODO: implement hi - LoadingSpinner component
function LoadingSpinner(_props: { category: string }): React.ReactElement | null {
  // TODO: implement
  return null;
}

// TODO: implement ns - ModelSpecCard component
function ModelSpecCard(_props: { name: string; entry: unknown; bare: boolean }): React.ReactElement | null {
  // TODO: implement
  return null;
}

// TODO: implement rs - ModelCompareDialog component
function ModelCompareDialog(_props: {
  open: boolean;
  modelNames: string[];
  specsByName: Record<string, unknown>;
  selectedModel: string;
  onClose: () => void;
  onConfirm: (model: string) => void;
}): React.ReactElement | null {
  // TODO: implement
  return null;
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
  targetRef: React.RefObject<HTMLTextAreaElement | null>;
  onRequestFullscreen: () => void;
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

// TODO: implement qo - CoinIcon component
function CoinIcon(_props: { className?: string }): React.ReactElement | null {
  // TODO: implement
  return <Coins className={_props.className} />;
}

// ====== Aspect ratio options ======

const is = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '自定义', value: 'custom' },
];

// ====== Resolution options ======

const as = [
  { label: '1080p', value: '1080p' },
  { label: '720p', value: '720p' },
  { label: '480p', value: '480p' },
  { label: '360p', value: '360p' },
];

// ====== NodeData type ======

interface DiscountVideoNodeData {
  prompt?: string;
  size?: string;
  resolution?: string;
  selectedSeconds?: string;
  selectedModel?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  loading?: boolean;
  progress?: number;
  errorMessage?: string;
  videoDurations?: string;
  discountVideoModel?: string;
  expanded?: boolean;
  uploadedAssets?: Record<string, string>;
  selectedContextResources?: Array<{ id: string; url: string; type: string; name?: string; sourceNodeId?: string; isDisconnected?: boolean }>;
  presetPrompts?: unknown[];
  label?: string;
  onGenerateDiscountVideo?: (nodeId: string, prompt: string, size: string, model: string, seconds: string, resolution: string) => void;
  onStop?: (nodeId: string) => void;
  onRefresh?: (nodeId: string) => void;
  onDelete?: () => void;
  onUploadAsset?: (url: string, type: string) => Promise<string>;
  onShowToast?: (msg: string) => void;
  onUpdateLabel?: (label: string) => void;
  [key: string]: unknown;
}

// ====== Component ======

function DiscountVideoNode({ id, data, selected }: NodeProps<{ data: DiscountVideoNodeData }>) {
  const {
    updateNodeData,
    setEdges,
    addNodes,
    addEdges,
    getNodes,
    setNodes,
    getNode,
  } = useReactFlow();

  const d = data;

  const [prompt, setPrompt] = useState(d.prompt || ``);
  const [size, setSize] = useState(d.size || localStorage.getItem(`mutiwindow_discountvideo_size`) || `16:9`);
  const [customRatio, setCustomRatio] = useState(`16:9`);
  const [resolution, setResolution] = useState(d.resolution || localStorage.getItem(`mutiwindow_discountvideo_resolution`) || `1080p`);
  const [selectedSeconds, setSelectedSeconds] = useState(
    d.selectedSeconds ||
    localStorage.getItem(`mutiwindow_discountvideo_seconds`) ||
    `10`
  );
  const [selectedModel, setSelectedModel] = useState(
    d.selectedModel ||
    localStorage.getItem(`mutiwindow_discountvideo_model`) ||
    (d.discountVideoModel && d.discountVideoModel.split(`
`)[0].trim()) ||
    ``
  );
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetPickerAt, setAssetPickerAt] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedContextResources, setSelectedContextResources] = useState(d.selectedContextResources || []);

  const {
    uploadedAssets: ce,
    setUploadedAssets: le,
    uploadingAssetsRef: ue,
    failedAssetsRef: V,
    uploadAsset: H,
    getAssetStatus: U,
    clearAllFailedAssets: W,
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
      settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node) && setShowSettingsDropdown(false);
      modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node) && (setShowModelDropdown(false), setHoveredModel(null));
    };
    (showSettingsDropdown || showModelDropdown) && document.addEventListener(`mousedown`, handler, true);
    return () => {
      document.removeEventListener(`mousedown`, handler, true);
    };
  }, [showSettingsDropdown, showModelDropdown]);

  useEffect(() => {
    prefetchApi(`/api`).catch(() => {});
  }, []);

  const [, forceUpdate] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    useInterval(() => forceUpdate());
  }, []);

  const pe = useSomeHook();

  const modelList = useMemo(
    () =>
      d.discountVideoModel
        ? d.discountVideoModel.split(`
`).map((e) => e.trim()).filter(Boolean)
        : [],
    [d.discountVideoModel]
  );

  const specsByName = useMemo(() => {
    const config = getDiscountVideoConfig();
    const specs: Record<string, unknown> = {};
    for (const name of modelList) {
      specs[name] = getModelSpec(name) ?? config?.discountVideoSpecs?.[name as string] ?? null;
    }
    return specs;
  }, [modelList, d.discountVideoModel, pe]);

  const currentSpec = useMemo(() => (selectedModel ? getModelSpec(selectedModel) ?? specsByName[selectedModel] ?? null : null), [selectedModel, specsByName]);

  const allowedResolutions = useMemo(() => {
    const vals = getAllowedValues(currentSpec, `resolutions`, as.map((e) => e.value));
    return as.filter((t) => vals.includes(t.value));
  }, [currentSpec]);

  const allowedAspectRatios = useMemo(() => {
    const vals = getAllowedValues(currentSpec, `aspectRatios`, is.map((e) => e.value));
    return is.filter((t) => vals.includes(t.value));
  }, [currentSpec]);

  const durationSpec = useMemo(() => getDurationSpec(currentSpec), [currentSpec]);
  const durationSpecValue = getSpecValue(currentSpec, `durationSpec`);

  const allowedDurations = useMemo(() => {
    const defaults = (d.videoDurations || `4\n6\n8\n10\n12\n15`)
      .split(`
`)
      .map((e) => e.trim())
      .filter(Boolean)
      .map(Number)
      .filter((e) => Number.isFinite(e) && e > 0);
    return getAllowedDurations(currentSpec, defaults.length ? defaults : [4, 6, 8, 10, 12, 15]);
  }, [currentSpec, d.videoDurations]);

  const durationRange = useMemo(() => {
    const defaults = (d.videoDurations || `4\n6\n8\n10\n12\n15`)
      .split(`
`)
      .map((e) => e.trim())
      .filter(Boolean)
      .map(Number)
      .filter((e) => Number.isFinite(e) && e > 0);
    return getDurationRange(currentSpec, {
      min: defaults.length ? Math.min(...defaults) : 4,
      max: defaults.length ? Math.max(...defaults) : 15,
    });
  }, [currentSpec, d.videoDurations]);

  const rangeMin = durationRange.min;
  const rangeMax = durationRange.max;
  const rangeStep = durationRange.step;
  const isDiscreteDuration = durationSpec?.mode === `discrete`;

  useEffect(() => {
    if (!selectedModel || !currentSpec) return;
    let newResolution = resolution;
    let newSize = size;
    let newSeconds = selectedSeconds;
    if (allowedResolutions.length && !allowedResolutions.some((e) => e.value === resolution)) {
      newResolution = allowedResolutions[0].value;
      setResolution(newResolution);
      updateNodeData(id, { resolution: newResolution });
      localStorage.setItem(`mutiwindow_discountvideo_resolution`, newResolution);
    }
    if (allowedAspectRatios.length && size !== `custom` && !allowedAspectRatios.some((e) => e.value === size)) {
      newSize = allowedAspectRatios[0].value;
      setSize(newSize);
      updateNodeData(id, { size: newSize });
      localStorage.setItem(`mutiwindow_discountvideo_size`, newSize);
    }
    const numSeconds = Number(selectedSeconds);
    if (durationSpec && durationSpec) {
      if (!isDurationValid(durationSpec, numSeconds)) {
        newSeconds = durationSpec.mode === `discrete` ? String(durationSpec.options![0]) : String(durationSpec.min);
        setSelectedSeconds(newSeconds);
        updateNodeData(id, { selectedSeconds: newSeconds });
        localStorage.setItem(`mutiwindow_discountvideo_seconds`, newSeconds);
      }
    } else if (allowedDurations.length && (!Number.isFinite(numSeconds) || !allowedDurations.includes(numSeconds))) {
      newSeconds = String(allowedDurations[0]);
      setSelectedSeconds(newSeconds);
      updateNodeData(id, { selectedSeconds: newSeconds });
      localStorage.setItem(`mutiwindow_discountvideo_seconds`, newSeconds);
    }
  }, [selectedModel, currentSpec]);

  const [expanded, setExpanded] = useState(d.expanded === undefined ? true : d.expanded);
  useEffect(() => {
    d.expanded !== undefined && setExpanded(d.expanded);
  }, [d.expanded]);

  const handleRetryUpload = async (t: { id: string; url: string; type: string }) => {
    if (d.onUploadAsset) {
      delete V.current[t.id];
      ue.current[t.id] = true;
      try {
        const result = await d.onUploadAsset(t.url, t.type);
        if (!result || typeof result !== `string`) throw Error(`网关返回为空`);
        le((prev) => {
          const updated = { ...prev, [t.url]: result };
          updateNodeData(id, { uploadedAssets: updated });
          return updated;
        });
      } catch (err) {
        console.error(`Retry upload failed for`, t.id, err);
        d.onShowToast?.(`素材重试失败: ${(err as Error)?.message || err}`);
        V.current[t.id] = true;
      } finally {
        delete ue.current[t.id];
      }
    }
  };

  const renderAssetOverlay = ({
    resId,
    resUrl,
    resType,
  }: {
    resId: string;
    resUrl: string;
    resType: string;
  }) => {
    const status = U(resId, resUrl);
    if (!status.isUploading && !status.isUploaded && !status.isFailed) return null;
    if (status.isFailed) {
      return (
        <div
          className={`absolute inset-0 bg-red-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center cursor-pointer hover:bg-red-900/85 transition-colors group/retry z-10`}
          title={`上传失败,点击重试`}
          onClick={(r) => {
            r.stopPropagation();
            handleRetryUpload({ id: resId, url: resUrl, type: resType });
          }}
        >
          <RefreshCw
            size={14}
            className={`text-white drop-shadow-md group-hover/retry:rotate-180 transition-transform duration-300`}
          />
          <span className={`text-[8px] text-white mt-0.5 font-medium leading-none`}>
            重试
          </span>
        </div>
      );
    }
    return (
      <div className={`absolute top-0 left-0 p-0.5 pointer-events-none`}>
        {status.isUploading ? (
          <Loader2 size={12} className={`animate-spin drop-shadow-md text-white`} />
        ) : status.isUploaded ? (
          <CheckCircle2 size={12} className={`text-green-500 drop-shadow-md`} />
        ) : null}
      </div>
    );
  };

  const connections = useHandleConnections({ type: `target` });
  const connectedNodes = useMemo(() => connections.map((c) => c.source), [connections]);

  const resources = useMemo(() => {
    if (!connectedNodes) return { images: [], videos: [], audios: [], texts: [] };
    const nodes = Array.isArray(connectedNodes) ? connectedNodes : [connectedNodes];
    const images: Array<{ id: string; url: string; type: string; sourceNodeId: string }> = [];
    const videos: Array<{ id: string; url: string; type: string; sourceNodeId: string }> = [];
    const audios: Array<{ id: string; url: string; type: string; sourceNodeId: string }> = [];
    const texts: Array<{ id: string; sourceNodeId: string; label: string; text: string }> = [];

    nodes.forEach((node) => {
      const conn = connections.find((c) => c.source === node?.id);
      if (node?.data?.imageUrl) {
        const url = node.data.imageUrl as string;
        if (url.startsWith(`data:video/`) || /\.(mp4|webm|mov|ogg)($|\?)/i.test(url)) {
          videos.push({ id: node.id, url, type: `video`, sourceNodeId: node.id });
        } else if (url.startsWith(`data:audio/`) || /\.(mp3|wav|ogg|aac)($|\?)/i.test(url)) {
          audios.push({ id: node.id, url, type: `audio`, sourceNodeId: node.id });
        } else {
          images.push({ id: node.id, url, type: `image`, sourceNodeId: node.id });
        }
      }
      if (node?.data?.videoUrl) {
        videos.push({ id: node.id, url: node.data.videoUrl as string, type: `video`, sourceNodeId: node.id });
      }
      if (node?.data?.audioUrl) {
        audios.push({ id: node.id, url: node.data.audioUrl as string, type: `audio`, sourceNodeId: node.id });
      }
      if (node?.type === `videoExtractNode` && node?.data?.extractedImages) {
        if (conn && conn.sourceHandle && conn.sourceHandle.startsWith(`frame-`)) {
          const frameIdx = parseInt(conn.sourceHandle.replace(`frame-`, ``), 10);
          if (!(node.data.hiddenIndices as number[] || []).includes(frameIdx)) {
            const allImages = node.data.allExtractedImages as string[] | undefined;
            if (allImages && allImages[frameIdx]) {
              images.push({ id: `${node.id}-ext-${frameIdx}`, url: allImages[frameIdx], type: `image`, sourceNodeId: node.id });
            }
          }
        } else {
          (node.data.extractedImages as string[]).forEach((imgUrl, idx) => {
            images.push({ id: `${node.id}-ext-${idx}`, url: imgUrl, type: `image`, sourceNodeId: node.id });
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
              images.push({ id: `${node.id}-box-${idx}`, url: img.url, type: `image`, sourceNodeId: node.id });
            }
          });
        } else {
          const activeImg = boxImages[typeof node.data.activeIndex === `number` ? (node.data.activeIndex as number) : 0]?.url;
          if (activeImg) {
            images.push({ id: `${node.id}-box-active`, url: activeImg, type: `image`, sourceNodeId: node.id });
          }
        }
      }
      const textAllowedTypes = new Set([`textNode`, `audioNode`, `textConcatNode`]);
      if (node?.data?.text && textAllowedTypes.has(node.type as string)) {
        texts.push({
          id: node.id,
          sourceNodeId: node.id,
          label: node?.type === `audioNode` ? `听音断句结果` : (node.data.label as string) || `文本节点`,
          text: node.data.text as string,
        });
      }
    });

    return { images, videos, audios, texts };
  }, [connectedNodes, connections]);

  const allUploadableAssets = useMemo(() => {
    const assets: Array<{ id: string; url: string; type: string }> = [];
    const normalizeType = (t: string) => (typeof t !== `string` || t.startsWith(`image`) ? `image` : t.startsWith(`video`) ? `video` : t.startsWith(`audio`) ? `audio` : `image`);
    selectedContextResources.forEach((n) => {
      if (n?.url && !n.url.startsWith(`asset://`)) {
        assets.push({ id: n.id, url: n.url, type: normalizeType(n.type) });
      }
    });
    resources.images.forEach((t) => {
      if (t.url && !t.url.startsWith(`asset://`)) assets.push({ id: t.id, url: t.url, type: `image` });
    });
    resources.videos.forEach((t) => {
      if (t.url && !t.url.startsWith(`asset://`)) assets.push({ id: t.id, url: t.url, type: `video` });
    });
    resources.audios.forEach((t) => {
      if (t.url && !t.url.startsWith(`asset://`)) assets.push({ id: t.id, url: t.url, type: `audio` });
    });
    return assets;
  }, [selectedContextResources, resources]);

  useEffect(() => {
    for (const asset of allUploadableAssets) {
      if (!asset.url || asset.url.startsWith(`asset://`)) continue;
      const url = asset.url;
      const assetId = asset.id;
      if (!ce[url] && !ue.current[assetId] && !V.current[assetId]) {
        H({ id: assetId, url: asset.url, type: asset.type }).catch((err) => {
          console.error(`Auto upload failed for`, assetId, err);
        });
      }
    }
  }, [useMemo(() => allUploadableAssets.map((e) => `${e.id}|${e.url}`).join(`;`), [allUploadableAssets]), ce, H]);

  useEffect(() => {
    d.prompt !== undefined && d.prompt !== prompt && setPrompt(d.prompt);
  }, [d.prompt]);

  useEffect(() => {
    d.size !== undefined && d.size !== size && setSize(d.size);
  }, [d.size]);

  useEffect(() => {
    if (d.discountVideoModel && !selectedModel) {
      const firstModel = d.discountVideoModel.split(`
`)[0].trim();
      setSelectedModel(firstModel);
      updateNodeData(id, { selectedModel: firstModel });
    }
  }, [d.discountVideoModel, selectedModel, id, updateNodeData]);

  const hasInitializedModel = useRef(false);
  useEffect(() => {
    if (!hasInitializedModel.current) {
      if (d.selectedModel && d.selectedModel !== selectedModel) setSelectedModel(d.selectedModel);
      if ((d.selectedModel || selectedModel)) hasInitializedModel.current = true;
    }
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
    if (Object.keys(ue.current).length > 0) {
      d.onShowToast?.(`素材正在上传处理中，请等待所有对勾出现后再生成`);
      return;
    }
    if (Object.keys(V.current).length > 0) {
      d.onShowToast?.(`有素材上传失败，已为您重新尝试上传，请稍后`);
      W();
      return;
    }
    if (!selectedModel.trim()) {
      d.onShowToast?.(`请选择 AI 模型`);
      return;
    }
    if (!prompt.trim() && resources.images.length === 0 && resources.texts.length === 0 && selectedContextResources.length === 0) {
      d.onShowToast?.(`请输入提示词或连接参考节点`);
      return;
    }
    const effectiveSize = size === `custom` ? customRatio : size;
    const validation = validateGenerateParams(currentSpec, {
      modelName: selectedModel,
      prompt,
      resolution,
      aspectRatio: effectiveSize,
      seconds: selectedSeconds,
      imageCount: resources.images.length,
      videoCount: resources.videos.length,
      audioCount: resources.audios.length,
    });
    if (!validation.ok) {
      d.onShowToast?.(validation.errors[0] || `当前参数不符合模型要求`);
      return;
    }
    d.onGenerateDiscountVideo?.(id, prompt, effectiveSize, selectedModel, selectedSeconds, resolution);
  };

  const handleDownload = async (e: React.MouseEvent) => {
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
  };

  const handleFileUpload = async (t: React.ChangeEvent<HTMLInputElement>) => {
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
          console.warn(`[DiscountVideoNode] urlifyAsset failed, fallback to resizeImage:`, err);
        }
        imageUrl ||= await resizeImage(file, 2048, 0.85);
        addNodes({
          id: newNodeId,
          type: `imageNode`,
          position,
          data: { imageUrl, thumbnailUrl, label: fileName || `图片素材` },
        });
        addEdges({ id: `edge-${newNodeId}-${id}`, source: newNodeId, target: id });
        return;
      }
      let mediaUrl = ``;
      try {
        const result = await urlifyAsset(file, { subfolder: `canvas/upload` });
        if (result.url && /^https?:\/\//i.test(result.url)) {
          mediaUrl = result.url;
        }
      } catch (err) {
        console.warn(`[DiscountVideoNode] urlifyAsset failed for media, fallback to base64:`, err);
      }
      const createMediaNode = (url: string) => {
        addNodes(
          mediaType === `video`
            ? { id: newNodeId, type: `videoExtractNode`, position, data: { videoUrl: url, videoName: fileName || `视频素材` } }
            : { id: newNodeId, type: `audioNode`, position, data: { audioUrl: url, audioName: fileName || `音频素材` } }
        );
        addEdges({ id: `edge-${newNodeId}-${id}`, source: newNodeId, target: id });
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
  };

  const insertAssetMention = (label: string, replace = false) => {
    const el = textareaRef.current;
    const mention = `@${label} `;
    if (!el) {
      const newPrompt = replace && assetPickerAt >= 0 ? prompt.substring(0, assetPickerAt) + mention + prompt.substring(assetPickerAt + 1) : prompt + mention;
      setPrompt(newPrompt);
      updateNodeData(id, { prompt: newPrompt });
      return;
    }
    const selStart = el.selectionStart ?? prompt.length;
    const selEnd = el.selectionEnd ?? prompt.length;
    let before: string;
    let after: string;
    if (replace && assetPickerAt >= 0) {
      before = prompt.substring(0, assetPickerAt);
      after = prompt.substring(assetPickerAt + 1);
    } else {
      before = prompt.substring(0, selStart);
      after = prompt.substring(selEnd);
    }
    const newPrompt = before + mention + after;
    setPrompt(newPrompt);
    updateNodeData(id, { prompt: newPrompt });
    const cursorPos = before.length + mention.length;
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    });
  };

  const getAssetLabel = (e: { id: string; type: string }) =>
    e.type.startsWith(`image`) ? `图片${resources.images.findIndex((t) => t.id === e.id) + 1}` :
    e.type.startsWith(`video`) ? `视频${resources.videos.findIndex((t) => t.id === e.id) + 1}` :
    e.type.startsWith(`audio`) ? `音频${resources.audios.findIndex((t) => t.id === e.id) + 1}` :
    `素材1`;

  // Parse aspect ratio to numeric value
  const parsedRatio = (() => {
    const ratioStr = size === `custom` ? customRatio : size;
    if (!ratioStr) return null;
    const match = ratioStr.match(/^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const w = parseFloat(match[1]);
    const h = parseFloat(match[2]);
    if (!w || !h) return null;
    return w / h;
  })();
  const hasValidRatio = parsedRatio !== null;
  const computedWidth = hasValidRatio && parsedRatio ? Math.round(380 * Math.sqrt(parsedRatio)) : null;
  const computedHeight = hasValidRatio && parsedRatio ? Math.round(380 / Math.sqrt(parsedRatio)) : null;

  const prevHeightRef = useRef(computedHeight);
  const animFrameRef = useRef<number | null>(null);
  const [animatedHeight, setAnimatedHeight] = useState<number | null>(null);

  useEffect(() => {
    const prevHeight = prevHeightRef.current;
    prevHeightRef.current = computedHeight;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (computedWidth === null || computedHeight === null) {
      setAnimatedHeight(null);
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id || node.style?.height !== undefined) return node;
          const oldWidth = 420 - ((node.style?.width ?? node.width ?? 380) as number);
          return {
            ...node,
            width: 420,
            height: 420,
            style: { ...node.style, width: 420, height: 420 },
            position: { x: node.position.x - oldWidth / 2, y: node.position.y },
          };
        })
      );
      return;
    }
    const currentNode = getNode(id);
    const currentWidth = currentNode?.style?.width ?? currentNode?.width ?? 380;
    const currentX = currentNode?.position.x ?? 0;
    const currentY = currentNode?.position.y ?? 0;
    const startHeight = prevHeight ?? computedHeight;
    const targetWidth = computedWidth;
    const targetHeight = computedHeight;
    if (prevHeight === null || Math.round(currentWidth) === targetWidth && Math.round(startHeight) === targetHeight) {
      setAnimatedHeight(null);
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;
          const nodeWidth = node.style?.width ?? node.width ?? 380;
          if (Math.round(nodeWidth) === targetWidth && node.style?.height === undefined) return node;
          const diff = targetWidth - nodeWidth;
          const newStyle = { ...node.style, width: targetWidth };
          delete (newStyle as Record<string, unknown>).height;
          return {
            ...node,
            width: targetWidth,
            height: undefined,
            style: newStyle,
            position: { x: node.position.x - diff / 2, y: node.position.y },
          };
        })
      );
      return;
    }
    const easeOut = (t: number) => 1 - (1 - t) ** 3;
    const bottomY = currentY + startHeight;
    const centerX = currentX + currentWidth / 2;
    const startTime = performance.now();
    const animate = (time: number) => {
      const progress = Math.min(1, (time - startTime) / 360);
      const eased = easeOut(progress);
      const currentW = currentWidth + (targetWidth - currentWidth) * eased;
      const currentH = startHeight + (targetHeight - startHeight) * eased;
      setAnimatedHeight(currentH);
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== id) return node;
          const newStyle = { ...node.style, width: currentW };
          delete (newStyle as Record<string, unknown>).height;
          return {
            ...node,
            width: currentW,
            height: undefined,
            style: newStyle,
            position: { x: centerX - currentW / 2, y: bottomY - currentH },
          };
        })
      );
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        animFrameRef.current = null;
        setAnimatedHeight(null);
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id !== id) return node;
            const newStyle = { ...node.style, width: targetWidth };
            delete (newStyle as Record<string, unknown>).height;
            return {
              ...node,
              width: targetWidth,
              height: undefined,
              style: newStyle,
              position: { x: centerX - targetWidth / 2, y: bottomY - targetHeight },
            };
          })
        );
      }
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [computedWidth, computedHeight, id]);

  const aspectStyle = hasValidRatio
    ? animatedHeight === null
      ? parsedRatio
        ? { aspectRatio: String(parsedRatio) }
        : undefined
      : { height: animatedHeight }
    : undefined;

  return (
    <div
      className={`relative flex flex-col items-center group/node w-full min-w-[200px] min-h-[200px] ` + (hasValidRatio ? `h-auto` : `h-full`) + ` ` + (selected ? `z-50` : `z-10`)}
    >
      <NodeTitle
        id={id}
        data={d as unknown as Record<string, unknown>}
        defaultTitle={`特惠视频`}
        icon={<Zap size={11} className={`text-gray-500`} />}
      />

      {!d.loading && (
        <div
          className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}
        >
          <div
            className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}
          >
            <button
              className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`}
              title={`上传图片、视频或音频素材`}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Upload size={14} />
            </button>
            {d.videoUrl && (
              <Fragment>
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`}
                  title={`全屏播放`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullscreen(true);
                  }}
                >
                  <Maximize2 size={14} />
                </button>
                <button
                  className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md transition-colors`}
                  title={`下载`}
                  onClick={handleDownload}
                >
                  <Download size={14} />
                </button>
                <CopyUrlButton url={d.videoUrl} fallbackExt={`mp4`} onToast={(e) => d.onShowToast?.(e)} />
                {d.onDelete && (
                  <button
                    className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors`}
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
        keepAspectRatio={hasValidRatio}
      />

      <input
        type={`file`}
        ref={fileInputRef}
        style={{ display: `none` }}
        accept={`image/*,video/*,audio/*`}
        onChange={handleFileUpload}
      />

      <div
        className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-colors duration-300 cursor-pointer group/display flex flex-col overflow-hidden w-full
            ${hasValidRatio ? `` : `flex-1`}
            ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}
        `}
        style={aspectStyle}
        onClick={() => {
          setExpanded(!expanded);
          updateNodeData(id, { expanded: !expanded });
        }}
      >
        <div
          className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ` + (d.videoUrl ? `` : `bg-[#121212]`)}
        >
          {d.videoUrl && (
            <Fragment>
              <video
                src={d.videoUrl}
                poster={d.thumbnailUrl}
                className={`max-w-full w-full h-full object-contain block ` + (d.loading ? `opacity-50 blur-sm` : ``)}
                controls={false}
                autoPlay={false}
                muted={false}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setShowFullscreen(true);
                }}
              />
              {!d.loading && (
                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none`}>
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
            <LoadingOverlay
              label={!d.progress || d.progress === 0 ? `生成中...` : `生成中... ${d.progress}%`}
              backgroundUrl={d.thumbnailUrl || resources.images[0]?.url}
            >
              <LoadingSpinner category={`video`} />
            </LoadingOverlay>
          )}

          {!d.videoUrl && !d.loading && !d.errorMessage && (
            <div className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] pointer-events-none`}>
              <Zap size={80} className={`text-gray-700`} strokeWidth={1.2} />
            </div>
          )}

          {d.errorMessage && !d.loading && !d.videoUrl && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-[#1a1a1a] p-4 text-center`}>
              <AlertCircle size={32} />
              <div className={`text-xs font-medium max-w-full break-words`}>
                {d.errorMessage}
              </div>
            </div>
          )}
        </div>
      </div>

      <CustomHandle type={`target`} position={Position.Left} variant={`large`} />
      <CustomHandle type={`source`} position={Position.Right} variant={`large`} />

      {(() => {
        const panelContent = (
          <div className={`space-y-3`}>
            <div className={`flex flex-col gap-2 mb-2`}>
              {(resources.images.length > 0 || resources.videos.length > 0 || resources.audios.length > 0 || resources.texts.length > 0 || selectedContextResources.length > 0) && (
                <div className={`flex flex-wrap gap-2 mb-1`}>
                  {resources.images.map((t, n) => (
                    <div
                      key={`img-${n}`}
                      className={`w-10 h-10 rounded-md overflow-hidden border border-[#444] relative group bg-black`}
                      title={`连线图片 (点击底部标签插入到提示词)`}
                    >
                      <img src={t.url} alt={`Ref`} className={`w-full h-full object-cover`} />
                      {renderAssetOverlay({ resId: t.id, resUrl: t.url, resType: `image` })}
                      <button
                        type={`button`}
                        className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`}
                        title={`点击插入 @图片${n + 1}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          insertAssetMention(`图片${n + 1}`);
                        }}
                      >
                        图片{n + 1}
                      </button>
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
                      title={`连线视频 (点击底部标签插入到提示词)`}
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
                      {renderAssetOverlay({ resId: t.id, resUrl: t.url, resType: `video` })}
                      <button
                        type={`button`}
                        className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`}
                        title={`点击插入 @视频${n + 1}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          insertAssetMention(`视频${n + 1}`);
                        }}
                      >
                        视频{n + 1}
                      </button>
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
                      title={`连线音频 (点击底部标签插入到提示词)`}
                    >
                      <div className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                        <Music size={16} className={`text-yellow-500`} />
                      </div>
                      {renderAssetOverlay({ resId: t.id, resUrl: t.url, resType: `audio` })}
                      <button
                        type={`button`}
                        className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`}
                        title={`点击插入 @音频${n + 1}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          insertAssetMention(`音频${n + 1}`);
                        }}
                      >
                        音频{n + 1}
                      </button>
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
                        className={`w-10 h-10 rounded-md overflow-hidden relative group bg-black`}
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
                            <img src={t.url} className={`w-full h-full object-cover opacity-80`} />
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
                        {renderAssetOverlay({ resId: t.id, resUrl: t.url, resType: t.type.startsWith(`image`) ? `image` : t.type.startsWith(`video`) ? `video` : `audio` })}
                        <div className={`absolute inset-0 bg-blue-500/10 pointer-events-none`} />
                        <button
                          type={`button`}
                          className={`absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-[8px] text-white text-center py-0.5 truncate cursor-pointer transition-colors`}
                          title={`点击插入 @${label}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            insertAssetMention(label);
                          }}
                        >
                          {label}
                        </button>
                        <div
                          className={`absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all z-10`}
                          onClick={(n) => {
                            if (n.stopPropagation(), (t as unknown as { isConnected?: boolean }).isConnected) {
                              setEdges((edges) => edges.filter((edge) => !(edge.source === t.sourceNodeId && edge.target === id)));
                            } else {
                              const filtered = selectedContextResources.filter((e) => e.id !== t.id);
                              setSelectedContextResources(filtered);
                              updateNodeData(id, { selectedContextResources: filtered });
                            }
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
                      <span className={`max-w-[80px] truncate`}>{e.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className={`flex items-start gap-2`}>
                <div className={`flex-1 nodrag relative`}>
                  <textarea
                    ref={textareaRef}
                    className={`w-full h-20 bg-transparent text-[15px] text-gray-200 min-h-[80px] outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nowheel nopan nodrag`}
                    style={{ resize: `none`, boxSizing: `border-box` }}
                    placeholder={`描述你想要的视频内容 (输入 @ 调出素材)...`}
                    value={prompt}
                    onChange={(t) => {
                      const value = t.target.value;
                      const cursorPos = t.target.selectionStart ?? value.length;
                      setPrompt(value);
                      updateNodeData(id, { prompt: value });
                      const before = value.substring(0, cursorPos);
                      const lastAtIndex = before.lastIndexOf(`@`);
                      if (lastAtIndex >= 0) {
                        const charBefore = lastAtIndex === 0 ? `` : before[lastAtIndex - 1];
                        const afterAt = before.substring(lastAtIndex + 1);
                        const isAtStart = lastAtIndex === 0 || /\s/.test(charBefore);
                        const noSpaceAfter = !/\s/.test(afterAt);
                        if (isAtStart && noSpaceAfter) {
                          setAssetPickerAt(lastAtIndex);
                          setShowAssetPicker(true);
                          return;
                        }
                      }
                      setAssetPickerAt(-1);
                      setShowAssetPicker(false);
                    }}
                    onKeyDown={(e) => {
                      e.key === `Enter` && (e.ctrlKey || e.metaKey) && handleGenerate();
                      e.key === `Escape` && showAssetPicker && setShowAssetPicker(false);
                    }}
                    autoFocus={expanded}
                    onWheel={(e) => e.stopPropagation()}
                  />

                  {showAssetPicker && (
                    <div
                      className={`absolute bottom-[calc(100%+4px)] left-0 w-72 bg-[#222] border border-[#444] rounded-lg shadow-2xl z-[999999] flex flex-col overflow-hidden h-[300px] nopan`}
                      onWheel={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={`flex items-center justify-between p-2 border-b border-[#333] bg-[#1a1a1a]`}>
                        <div className={`text-xs text-gray-300 font-bold flex items-center gap-2`}>
                          <span>选择素材引用</span>
                        </div>
                        <button
                          onClick={() => setShowAssetPicker(false)}
                          className={`text-gray-500 hover:text-white p-1`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className={`p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag`}>
                        {(() => {
                          const assets = [
                            ...resources.images.map((e) => ({ id: e.id, url: e.url, type: `image` })),
                            ...resources.videos.map((e) => ({ id: e.id, url: e.url, type: `video` })),
                            ...resources.audios.map((e) => ({ id: e.id, url: e.url, type: `audio` })),
                          ];
                          return assets.length === 0 ? (
                            <div className={`text-center text-gray-500 text-xs py-10`}>暂无素材，请先上传</div>
                          ) : (
                            <div className={`grid grid-cols-4 gap-1.5`}>
                              {assets.map((e) => (
                                <div
                                  key={e.id}
                                  className={`aspect-square bg-[#111] rounded border border-[#333] hover:border-blue-500 cursor-pointer overflow-hidden relative group`}
                                  onClick={() => {
                                    insertAssetMention(getAssetLabel(e), true);
                                    setAssetPickerAt(-1);
                                    setShowAssetPicker(false);
                                  }}
                                >
                                  {e.type.startsWith(`image`) ? (
                                    <img src={e.url} className={`w-full h-full object-cover`} />
                                  ) : e.type.startsWith(`video`) ? (
                                    <video src={e.url} className={`w-full h-full object-cover`} />
                                  ) : e.type.startsWith(`audio`) ? (
                                    <div className={`w-full h-full bg-[#222] flex items-center justify-center p-1`}>
                                      <span className={`text-[10px] text-gray-400`}>音频</span>
                                    </div>
                                  ) : (
                                    <div className={`p-1 text-[8px] text-gray-400 break-all overflow-hidden h-full`}>{e.url}</div>
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

              <div className={`flex items-center justify-between pt-2 border-t border-[#2a2a2a] nodrag`}>
                <div className={`flex items-center gap-1.5 overflow-visible z-50`}>
                  <div className={`relative nodrag flex items-center`} ref={settingsDropdownRef}>
                    <button
                      className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettingsDropdown(!showSettingsDropdown);
                      }}
                      title={`选择比例和时长`}
                    >
                      <Settings size={12} className={`opacity-70`} />
                      <span className={`whitespace-nowrap`}>
                        {is.find((e) => e.value === size)?.label || `16:9`} · {resolution} · {selectedSeconds}s
                      </span>
                    </button>
                    {showSettingsDropdown && (
                      <div
                        className={`absolute bottom-full left-0 mb-1 w-72 bg-[#222] border border-[#333] rounded-lg shadow-xl p-3 z-50 flex flex-col gap-3 max-h-none overflow-visible nopan nodrag`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <div className={`text-[10px] text-gray-500 mb-2 px-1`}>比例</div>
                          <div className={`flex flex-wrap gap-1.5 mb-2`}>
                            {allowedAspectRatios
                              .filter((e) => selectedModel.startsWith(`grok-`) || selectedModel.startsWith(`firefly-`) ? e.value === `16:9` || e.value === `9:16` : true)
                              .map((t) => (
                                <button
                                  key={t.value}
                                  className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ` + (size === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`)}
                                  onClick={() => {
                                    setSize(t.value);
                                    updateNodeData(id, { size: t.value });
                                    localStorage.setItem(`mutiwindow_discountvideo_size`, t.value);
                                  }}
                                >
                                  {t.label}
                                </button>
                              ))}
                          </div>
                          {size === `custom` && (
                            <div className={`bg-[#1c1c1c] p-2 rounded border border-[#333] mb-2 flex flex-col gap-2`}>
                              <div className={`flex items-center gap-2`}>
                                <span className={`text-[10px] text-gray-500 w-10`}>比例:</span>
                                <input
                                  type={`text`}
                                  value={customRatio}
                                  onChange={(e) => setCustomRatio(e.target.value)}
                                  placeholder={`如 16:9`}
                                  className={`flex-1 bg-[#121212] border border-[#444] rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-blue-500`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className={`text-[10px] text-gray-500 mb-2 px-1`}>分辨率</div>
                          <div className={`flex flex-wrap gap-1.5 mb-3`}>
                            {allowedResolutions.map((t) => (
                              <button
                                key={t.value}
                                className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ` + (resolution === t.value ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`)}
                                onClick={() => {
                                  setResolution(t.value);
                                  updateNodeData(id, { resolution: t.value });
                                  localStorage.setItem(`mutiwindow_discountvideo_resolution`, t.value);
                                }}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className={`text-[10px] text-gray-500 mb-2 px-1`}>时长 (秒)</div>
                          {durationSpec && isDiscreteDuration ? (
                            <div className={`flex flex-wrap gap-1.5 px-1 mb-1`}>
                              {allowedDurations.map((t) => (
                                <button
                                  key={t}
                                  type={`button`}
                                  className={`px-3 py-1.5 text-[11px] rounded-md transition-colors ` + (String(t) === selectedSeconds ? `bg-[#444] text-white` : `bg-[#1c1c1c] text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`)}
                                  onClick={() => {
                                    setSelectedSeconds(String(t));
                                    updateNodeData(id, { selectedSeconds: String(t) });
                                    localStorage.setItem(`mutiwindow_discountvideo_seconds`, String(t));
                                  }}
                                >
                                  {t}s
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className={`flex items-center gap-2 px-1`}>
                              <input
                                type={`range`}
                                min={rangeMin}
                                max={rangeMax}
                                step={rangeStep}
                                value={selectedSeconds}
                                onChange={(t) => {
                                  setSelectedSeconds(t.target.value);
                                  updateNodeData(id, { selectedSeconds: t.target.value });
                                  localStorage.setItem(`mutiwindow_discountvideo_seconds`, t.target.value);
                                }}
                                className={`flex-1 accent-blue-500`}
                              />
                              <input
                                type={`number`}
                                value={selectedSeconds}
                                onChange={(t) => {
                                  const val = t.target.value;
                                  setSelectedSeconds(val);
                                  updateNodeData(id, { selectedSeconds: val });
                                  localStorage.setItem(`mutiwindow_discountvideo_seconds`, val);
                                }}
                                className={`w-12 bg-[#1c1c1c] text-gray-200 border border-[#333] rounded px-1 py-0.5 text-xs outline-none text-center`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {modelList.length > 0 && (
                    <div className={`relative nodrag flex items-center`} ref={modelDropdownRef}>
                      <div className={`w-[1px] h-3 bg-[#444] mr-1.5`} />
                      <button
                        className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowModelDropdown((prev) => (prev && setHoveredModel(null), !prev));
                        }}
                        title={selectedModel ? `${selectedModel}（${isBuiltinModel(selectedModel) ? `内置` : `第三方`}）` : `选择 AI 模型`}
                      >
                        {selectedModel && (
                          <span
                            className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ` + (isBuiltinModel(selectedModel) ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`)}
                          >
                            {isBuiltinModel(selectedModel) ? `内置` : `三方`}
                          </span>
                        )}
                        <span className={`whitespace-nowrap`}>{selectedModel || `选择模型`}</span>
                      </button>
                      {showModelDropdown && (
                        <div
                          className={`absolute bottom-full left-0 mb-1 bg-[#222] border border-[#333] rounded-lg shadow-xl z-50 flex items-stretch nowheel nopan nodrag`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className={`w-max min-w-[13rem] max-w-[24rem] shrink-0 flex flex-col border-r border-[#333]`}>
                            <div className={`relative flex-1 min-h-0`}>
                              <div className={`p-2 max-h-[24rem] overflow-x-hidden overflow-y-auto no-scrollbar`}>
                                {(() => {
                                  const allModels = modelList;
                                  const builtinModels = allModels.filter((e) => isBuiltinModel(e));
                                  const thirdPartyModels = allModels.filter((e) => !isBuiltinModel(e));
                                  const renderModelItem = (name: string, index: number, isBuiltin: boolean) => {
                                    const price = isBuiltin ? getModelPrice(name) : null;
                                    const unit = isBuiltin ? getModelPriceUnit(name) : null;
                                    const btnStyle = getModelButtonStyle(name, selectedModel === name);
                                    return (
                                      <div
                                        key={`${isBuiltin ? `b` : `o`}-${index}`}
                                        role={`button`}
                                        className={`relative ${btnStyle.className}`}
                                        onClick={() => {
                                          if (!btnStyle.disabled) {
                                            setSelectedModel(name);
                                            updateNodeData(id, { selectedModel: name });
                                            localStorage.setItem(`mutiwindow_discountvideo_model`, name);
                                            setShowModelDropdown(false);
                                            setHoveredModel(null);
                                          }
                                        }}
                                        onMouseEnter={() => setHoveredModel(name)}
                                        onMouseLeave={() => setHoveredModel((prev) => (prev === name ? null : prev))}
                                        title={btnStyle.title}
                                      >
                                        <span
                                          className={`shrink-0 px-1 rounded text-[9px] leading-[14px] border ` + (isBuiltin ? `bg-white/10 text-white/90 border-white/30` : `bg-gray-500/15 text-gray-400 border-gray-500/40`)}
                                        >
                                          {isBuiltin ? `内置` : `三方`}
                                        </span>
                                        <span className={`flex-1 whitespace-nowrap`}>{name}</span>
                                        {price !== null && (
                                          <span className={`shrink-0 inline-flex items-center gap-0.5 text-[10px] text-yellow-300 tabular-nums`}>
                                            <CoinIcon className={`w-2.5 h-2.5`} />
                                            <span>{formatPrice(price)}{unit ? `/${unit}` : ``}</span>
                                          </span>
                                        )}
                                      </div>
                                    );
                                  };
                                  return (
                                    <Fragment>
                                      {builtinModels.length > 0 && (
                                        <div className={`text-[9px] text-gray-500 px-2 pt-0.5 pb-1`}>内置模型</div>
                                      )}
                                      {builtinModels.map((e, i) => renderModelItem(e, i, true))}
                                      {thirdPartyModels.length > 0 && (
                                        <div className={`text-[9px] text-gray-500 px-2 pt-1.5 pb-1`}>第三方模型</div>
                                      )}
                                      {thirdPartyModels.map((e, i) => renderModelItem(e, i, false))}
                                    </Fragment>
                                  );
                                })()}
                              </div>
                              <div className={`pointer-events-none absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-[#222] to-transparent`} />
                              <div className={`pointer-events-none absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-[#222] to-transparent`} />
                            </div>
                            <div className={`shrink-0 p-2 border-t border-[#333]`}>
                              <button
                                type={`button`}
                                className={`w-full text-center px-2 py-1.5 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-[#2a2a2a] rounded-md transition-colors cursor-pointer`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowModelDropdown(false);
                                  setHoveredModel(null);
                                  setShowModelDropdown(false);
                                }}
                              >
                                详细对比
                              </button>
                            </div>
                          </div>
                          {(() => {
                            const specModel = (hoveredModel && isBuiltinModel(hoveredModel) ? hoveredModel : null) || (selectedModel && isBuiltinModel(selectedModel) ? selectedModel : null) || modelList.find((e) => isBuiltinModel(e)) || null;
                            return (
                              <div className={`w-72 shrink-0 p-2 max-h-[28rem] overflow-x-hidden overflow-y-auto no-scrollbar`}>
                                {specModel ? (
                                  <ModelSpecCard name={specModel} entry={specsByName[specModel]} bare={true} />
                                ) : (
                                  <div className={`h-full flex items-center justify-center text-[11px] text-gray-500`}>
                                    悬停内置模型查看详情
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  <ModelCompareDialog
                    open={false}
                    modelNames={modelList}
                    specsByName={specsByName}
                    selectedModel={selectedModel}
                    onClose={() => {}}
                    onConfirm={(t) => {
                      setSelectedModel(t);
                      updateNodeData(id, { selectedModel: t });
                      localStorage.setItem(`mutiwindow_discountvideo_model`, t);
                    }}
                  />

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
                        <div className={`flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300`}>停止</div>
                        <button className={`bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors`}>
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
                      {selectedModel && isBuiltinModel(selectedModel) && getModelPrice(selectedModel) !== null &&
                        (() => {
                          const price = getModelPrice(selectedModel)!;
                          const unit = getModelPriceUnit(selectedModel);
                          const isPerSecond = unit === `秒` || unit === `s` || unit === `sec`;
                          const seconds = parseInt(selectedSeconds, 10) || 0;
                          const totalCost = isPerSecond ? price * seconds : price;
                          return (
                            <div
                              className={`flex items-center gap-0.5 mr-2 text-[12px] text-yellow-300 tabular-nums`}
                              title={`预计消耗 ${formatPrice(totalCost)} 特惠币${isPerSecond ? `（${formatPrice(price)}/秒 × ${seconds}秒）` : ``}`}
                            >
                              <CoinIcon className={`w-3.5 h-3.5`} />
                              <span>{formatPrice(totalCost)}</span>
                            </div>
                          );
                        })()}
                      <div className={`flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white`}>生成</div>
                      <button className={`bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors`}>
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
              className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl min-w-[500px] w-max max-w-[920px] transition-all duration-300 origin-top z-50
                ${expanded ? `opacity-100 scale-100 p-4 overflow-visible` : `opacity-0 scale-95 pointer-events-none h-0 p-0 border-0 overflow-hidden`}
              `}
              onClick={(e) => e.stopPropagation()}
            >
              {!showEditorModal && panelContent}
              {expanded && !showEditorModal && (
                <TextareaResizeHandle
                  targetRef={textareaRef}
                  onRequestFullscreen={() => setShowEditorModal(true)}
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

export default memo(DiscountVideoNode);
