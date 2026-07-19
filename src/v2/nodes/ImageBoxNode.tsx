import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import {
  Link, Plus, Maximize2, Send, Copy, Download, Image,
  Check, Square, Trash2, Minimize2, ChevronLeft, ChevronRight,
  ImagePlus, MoreVertical, Upload,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import ResizeController from './ResizeController';
import CustomHandle from './CustomHandle';

// ====== External Dependencies ======

// TODO: implement - 生成缩略图
const vr = async (_url: string, _maxDim: number, _quality: number): Promise<string | undefined> => {
  return undefined;
};

// TODO: implement - 生成唯一 ID
const Ph = (): string => {
  return Math.random().toString(36).slice(2);
};

// TODO: implement - 发送到剪映
const qn = async (_items: Array<{ fileUrl: string; fileName: string }>): Promise<{ message: string }> => {
  return { message: '' };
};

// TODO: implement - 从 URL 获取文件名
const Kn = (_url: string, ext: string): string => {
  return `image-${Date.now()}.${ext}`;
};

// ====== Types ======

interface ImageItem {
  id: string;
  url: string;
  thumb?: string;
  label?: string;
  source?: string;
  createdAt?: number;
}

interface ImageBoxNodeData {
  images?: ImageItem[];
  activeIndex?: number;
  expanded?: boolean;
  selectedIds?: string[];
  onShowToast?: (msg: string) => void;
  onZoom?: (nodeId: string, ref: undefined, url: string) => void;
  onSendToActiveTab?: (url: string) => void;
  [key: string]: unknown;
}

// ====== Component ======

const ImageBoxNode = memo(({ id, data, selected }: { id: string; data: ImageBoxNodeData; selected?: boolean }) => {
  const { updateNodeData, getNode } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const images = data.images || [];
  const activeIndex = Math.min(Math.max(0, data.activeIndex ?? 0), Math.max(0, images.length - 1));
  const expanded = data.expanded ?? false;
  const selectedIds = data.selectedIds || [];
  const activeImage = images[activeIndex];
  const [isDragging, setIsDragging] = useState(false);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  useEffect(() => {
    if (menuIndex === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      !target.closest(`[data-thumb-menu]`) && !target.closest(`[data-thumb-menu-portal]`) && (setMenuIndex(null), setMenuPosition(null));
    };
    const timer = window.setTimeout(() => {
      window.addEventListener(`mousedown`, handler, true);
      window.addEventListener(`click`, handler, true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(`mousedown`, handler, true);
      window.removeEventListener(`click`, handler, true);
    };
  }, [menuIndex]);

  const setSelectedIds = useCallback((ids: string[]) => updateNodeData(id, { selectedIds: ids }), [id, updateNodeData]);

  const toggleSelectedId = useCallback((imgId: string) => {
    const next = new Set(selectedIds);
    next.has(imgId) ? next.delete(imgId) : next.add(imgId);
    setSelectedIds(Array.from(next));
  }, [selectedIds, setSelectedIds]);

  const allSelected = images.length > 0 && selectedIds.length === images.length;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(allSelected ? [] : images.map(img => img.id));
  }, [allSelected, images, setSelectedIds]);

  const addImages = useCallback(async (newImages: Array<{ url: string; label?: string; source?: string }>) => {
    if (newImages.length === 0) return;
    const items = await Promise.all(newImages.map(async (img) => {
      let thumb: string | undefined;
      try {
        thumb = await vr(img.url, 256, 0.7);
      } catch {
        thumb = undefined;
      }
      return {
        id: Ph(),
        url: img.url,
        thumb,
        label: img.label,
        source: img.source || `upload`,
        createdAt: Date.now(),
      };
    }));
    const updated = [...images, ...items];
    updateNodeData(id, { images: updated, activeIndex: updated.length - 1 });
  }, [images, id, updateNodeData]);

  const removeImage = useCallback((index: number) => {
    const removed = images[index];
    const remaining = images.filter((_, i) => i !== index);
    updateNodeData(id, {
      images: remaining,
      activeIndex: Math.min(activeIndex, Math.max(0, remaining.length - 1)),
      selectedIds: removed ? selectedIds.filter(sid => sid !== removed.id) : selectedIds,
    });
  }, [activeIndex, images, id, selectedIds, updateNodeData]);

  const removeSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const removeSet = new Set(selectedIds);
    const remaining = images.filter(img => !removeSet.has(img.id));
    updateNodeData(id, {
      images: remaining,
      activeIndex: Math.min(activeIndex, Math.max(0, remaining.length - 1)),
      selectedIds: [],
    });
  }, [activeIndex, images, id, selectedIds, updateNodeData]);

  const setActiveIndex = useCallback((index: number) => {
    if (index < 0 || index >= images.length) return;
    updateNodeData(id, { activeIndex: index });
  }, [id, images.length, updateNodeData]);

  const moveImage = useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
    const arr = images.slice();
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    void moved.id;
    let newActive = activeIndex;
    const currentId = images[activeIndex]?.id;
    if (currentId) {
      newActive = arr.findIndex(img => img.id === currentId);
      if (newActive < 0) newActive = 0;
    }
    updateNodeData(id, { images: arr, activeIndex: newActive });
  }, [activeIndex, id, images, updateNodeData]);

  const prevImage = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((activeIndex - 1 + images.length) % images.length);
  }, [activeIndex, images.length, setActiveIndex]);

  const nextImage = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((activeIndex + 1) % images.length);
  }, [activeIndex, images.length, setActiveIndex]);

  const setExpanded = useCallback((val: boolean) => {
    updateNodeData(id, { expanded: val });
  }, [id, updateNodeData]);

  const connections = useHandleConnections({ type: 'target' });
  const sourceNodes = useMemo(
    () => connections.map(c => getNode(c.source)).filter(Boolean) as Array<{ id: string; data: any; type?: string }>,
    [connections, getNode]
  );

  const upstreamImages = useMemo(() => {
    if (!sourceNodes) return [];
    const nodes = Array.isArray(sourceNodes) ? sourceNodes : [sourceNodes];
    const result: Array<{ id: string; url: string }> = [];
    nodes.forEach(node => {
      if (!node) return;
      if (typeof node.data?.imageUrl === `string` && (node.data.imageUrl.startsWith(`http`) || node.data.imageUrl.startsWith(`data:image`))) {
        result.push({ id: node.id, url: node.data.imageUrl });
      }
      if (node.type === `imageBoxNode` && Array.isArray(node.data?.images)) {
        node.data.images.forEach((img: ImageItem) => {
          if (img?.url) result.push({ id: `${node.id}-${img.id}`, url: img.url });
        });
      }
      if (node.type === `videoExtractNode` && Array.isArray(node.data?.extractedImages)) {
        node.data.extractedImages.forEach((url: string, idx: number) => {
          if (url) result.push({ id: `${node.id}-ext-${idx}`, url });
        });
      }
    });
    return result;
  }, [sourceNodes]);

  const readFilesAsDataUrls = useCallback(async (fileList: FileList | File[]): Promise<Array<{ url: string; label: string }>> => {
    const files = Array.from(fileList).filter(f => f.type.startsWith(`image/`));
    return (await Promise.all(files.map(file => new Promise<{ url: string; label: string } | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ url: reader.result as string, label: file.name });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    })))).filter(Boolean) as Array<{ url: string; label: string }>;
  }, []);

  const handleFileInput = useCallback(async (files: FileList | File[]) => {
    const dataUrls = await readFilesAsDataUrls(files);
    if (dataUrls.length !== 0) addImages(dataUrls.map(item => ({ ...item, source: `upload` })));
  }, [addImages, readFilesAsDataUrls]);

  useEffect(() => {
    if (!selected) return;
    const handlePaste = async (event: ClipboardEvent) => {
      if (!event.clipboardData) return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === `INPUT` || activeEl.tagName === `TEXTAREA` || (activeEl as HTMLElement).isContentEditable)) return;
      const files = Array.from(event.clipboardData.items)
        .filter(item => item.kind === `file` && item.type.startsWith(`image/`))
        .map(item => item.getAsFile())
        .filter(Boolean) as File[];
      if (files.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const dataUrls = await readFilesAsDataUrls(files);
        addImages(dataUrls.map(item => ({ ...item, source: `paste` })));
        return;
      }
      const text = event.clipboardData.getData(`text/plain`).trim();
      if (text && (text.startsWith(`http`) || text.startsWith(`data:image/`))) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        addImages([{ url: text, source: `paste` }]);
      }
    };
    window.addEventListener(`paste`, handlePaste, true);
    return () => window.removeEventListener(`paste`, handlePaste, true);
  }, [selected, addImages, readFilesAsDataUrls]);

  const handleFileDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (dragSourceIndex !== null) {
      setDragSourceIndex(null);
      setDropTargetIndex(null);
      return;
    }
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const dataUrls = await readFilesAsDataUrls(event.dataTransfer.files);
      if (dataUrls.length > 0) {
        addImages(dataUrls.map(item => ({ ...item, source: `drop` })));
        return;
      }
    }
    const text = event.dataTransfer.getData(`text/plain`) || event.dataTransfer.getData(`text/uri-list`);
    if (text && (text.startsWith(`http`) || text.startsWith(`data:image/`))) {
      addImages([{ url: text, source: `drop` }]);
    }
  }, [addImages, readFilesAsDataUrls, dragSourceIndex]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (dragSourceIndex === null) {
      isDragging || setIsDragging(true);
    }
  }, [isDragging, dragSourceIndex]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    if (event.currentTarget === event.target) setIsDragging(false);
  }, []);

  const importFromConnections = useCallback(() => {
    if (upstreamImages.length === 0) {
      data.onShowToast?.(`当前没有上游连线提供图片`);
      return;
    }
    const existingUrls = new Set(images.map(img => img.url));
    const newImages = upstreamImages.filter(img => !existingUrls.has(img.url));
    if (newImages.length === 0) {
      data.onShowToast?.(`上游连线图片已全部导入`);
      return;
    }
    addImages(newImages.map(img => ({ url: img.url, source: `connect` })));
    data.onShowToast?.(`已导入 ${newImages.length} 张连线图`);
  }, [addImages, data.onShowToast, images, upstreamImages]);

  const handleDownload = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (!activeImage) return;
    const a = document.createElement(`a`);
    a.href = activeImage.url;
    a.download = activeImage.label || `image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [activeImage]);

  const handleZoom = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (activeImage) data.onZoom?.(id, undefined, activeImage.url);
  }, [activeImage, data.onZoom, id]);

  const handleSend = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (activeImage) data.onSendToActiveTab?.(activeImage.url);
  }, [activeImage, data.onSendToActiveTab]);

  const imageCount = images.length;

  const copyImageToClipboard = useCallback(async (url: string) => {
    const showToast = data.onShowToast;
    try {
      const img = new Image();
      img.crossOrigin = `anonymous`;
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(Error(`image load failed`));
      });
      const canvas = document.createElement(`canvas`);
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext(`2d`);
      if (!ctx) throw Error(`canvas ctx`);
      ctx.drawImage(img, 0, 0);
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return reject(Error(`blob null`));
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            resolve();
          } catch (e) {
            reject(e);
          }
        }, `image/png`);
      });
      showToast?.(`图片已复制，可以在画布中粘贴`);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        showToast?.(`图片链接已复制（直接复制图片失败）`);
      } catch {
        showToast?.(`复制失败，可能因跨域或权限限制`);
      }
    }
  }, [data.onShowToast]);

  const sendToJianYing = useCallback(async () => {
    const showToast = data.onShowToast;
    const selectedSet = new Set(selectedIds);
    const toSend = selectedSet.size > 0 ? images.filter(img => selectedSet.has(img.id)) : images;
    if (toSend.length === 0) {
      showToast?.(`没有可发送的图片`);
      return;
    }
    showToast?.(`正在发送 ${toSend.length} 张到剪映…`);
    const result = await qn(toSend.map(img => ({
      fileUrl: img.url,
      fileName: Kn(img.url, `png`),
    })));
    showToast?.(result.message);
  }, [images, selectedIds, data.onShowToast]);

  const downloadFile = useCallback((url: string, filename?: string) => {
    if (!url) return;
    const a = document.createElement(`a`);
    a.href = url;
    a.download = filename || `image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <div className={`relative w-full h-full group/node`}>
      <ResizeController visible={!!selected} minWidth={240} minHeight={expanded ? 280 : 200} />
      <input
        ref={fileInputRef}
        type={`file`}
        accept={`image/*`}
        multiple
        style={{ display: `none` }}
        onChange={async (e) => {
          if (e.target.files) {
            await handleFileInput(e.target.files);
            e.target.value = ``;
          }
        }}
      />
      <div className={`absolute -top-12 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
        <div className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
          <button
            className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
            title={`从连线图一键导入`}
            onClick={(e) => { e.stopPropagation(); importFromConnections(); }}
          >
            <Link size={14} />
          </button>
          <button
            className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
            title={`添加本地图片`}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            <Plus size={14} />
          </button>
          {imageCount > 0 && (
            <button
              className={`p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#333] rounded-md`}
              title={selectedIds.length > 0 ? `发送选中 ${selectedIds.length} 张到剪映` : `发送全部到剪映`}
              onClick={(e) => { e.stopPropagation(); sendToJianYing(); }}
            >
              <svg viewBox={`0 0 1389 1024`} width={`14`} height={`14`} fill={`currentColor`} aria-hidden={`true`}>
                <path d={`M1140.11 150.95l243.537-120.088c0 33.024 0.24 63.046 0 93.188-0.24 22.096 6.124 48.636-3.843 65.208-9.607 15.611-36.266 21.015-55.6 30.622L737.457 510.852c6.004 3.482 10.327 6.485 15.01 8.766 204.99 101.834 410.1 203.428 615.208 304.902 12.13 6.004 16.212 12.49 15.972 25.819-0.84 45.753-0.24 91.506-0.24 141.103l-239.935-118.407c-12.97 24.498-23.537 50.197-39.028 72.293-37.227 53.199-91.507 77.456-154.913 77.697-250.742 0.96-501.365 0.96-752.107 0.24-97.271 0-176.289-65.328-190.94-161.638C0 817.915 3.604 772.642 6.005 728.33c0.48-9.247 14.05-20.775 24.258-25.819 111.681-56.44 223.723-111.801 335.764-167.402l47.555-23.657c-125.972-62.685-249.782-124.89-374.312-185.655-24.859-12.009-37.228-26.78-35.066-55.24 2.882-40.59-1.441-81.9 5.044-121.649C23.057 64.367 103.395 0.6 189.257 0.6 443.844 0.6 698.429 0.96 952.894 0.36c87.904-0.24 157.315 60.524 181.933 134.858l5.164 15.732z m-566.332-8.767H207.51a105.677 105.677 0 0 0-27.98 3.603c-20.415 5.524-31.343 21.135-33.505 43.232-1.921 20.054 3.363 31.943 24.018 42.03 125.851 60.524 250.982 122.49 375.153 185.895 21.616 11.048 38.188 11.169 60.043 0 125.132-63.406 251.223-125.13 376.715-187.696 6.364-3.122 15.13-7.686 16.812-13.21 12.009-40.95-13.57-74.094-56.681-74.094l-368.308 0.36z m0 736.857H949.89c31.223 0 48.035-16.812 49.356-47.795a67.009 67.009 0 0 0-0.24-18.974c-1.561-5.524-4.803-12.85-9.487-15.13-134.498-67.25-268.996-134.138-403.854-200.307a26.9 26.9 0 0 0-20.775 0 86586.855 86586.855 0 0 0-408.897 202.348c-3.843 2.041-9.007 6.364-9.367 10.087-4.203 38.188 11.528 70.852 55 70.371 123.93-1.44 248.1-0.48 372.27-0.48v-0.12z`} />
              </svg>
            </button>
          )}
          {!expanded && activeImage && (
            <>
              <div className={`w-px h-4 bg-[#333] mx-1`} />
              <button
                className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                title={`放大`}
                onClick={handleZoom}
              >
                <Maximize2 size={14} />
              </button>
              <button
                className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                title={`发送到左侧网站`}
                onClick={handleSend}
              >
                <Send size={14} />
              </button>
              <button
                className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                title={`复制当前图片到剪贴板`}
                onClick={(e) => { e.stopPropagation(); if (activeImage) copyImageToClipboard(activeImage.url); }}
              >
                <Copy size={14} />
              </button>
              <button
                className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`}
                title={`下载当前图片`}
                onClick={handleDownload}
              >
                <Download size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className={`flex justify-between items-center w-full mb-1`}>
        <NodeTitle
          id={id}
          data={data}
          defaultTitle={`图片盒子`}
          icon={<Image size={11} className={`text-gray-500`} />}
          className={`!mb-0`}
        />
        <div className={`flex items-center gap-1 nodrag`}>
          {expanded && imageCount > 0 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}
                className={`px-1.5 py-0.5 rounded hover:bg-[#333] text-gray-400 hover:text-white inline-flex items-center gap-1 text-[10px]`}
                title={allSelected ? `取消全选` : `全选`}
              >
                {allSelected ? <Check size={10} /> : <Square size={10} />}
                <span>全选</span>
              </button>
              {selectedIds.length > 0 && (
                <>
                  <span className={`text-gray-300 text-[10px]`}>已选 {selectedIds.length}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSelected(); }}
                    className={`px-1.5 py-0.5 rounded hover:bg-[#333] hover:text-red-400 text-gray-400 inline-flex items-center gap-1 text-[10px]`}
                    title={`删除已选`}
                  >
                    <Trash2 size={10} />
                  </button>
                </>
              )}
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className={`px-1.5 py-0.5 rounded hover:bg-[#333] text-gray-400 hover:text-white inline-flex items-center gap-1 text-[10px] transition-colors`}
            title={expanded ? `折叠为单图` : `展开为缩略图网格`}
          >
            {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            <span>{expanded ? `折叠` : `展开`}</span>
          </button>
        </div>
      </div>
      <div className={`relative w-full h-full flex-1 min-h-0`}>
        <div
          className={`bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 w-full h-full flex flex-col ${selected ? `border-[#555]` : isDragging ? `border-gray-400` : `border-[#333] hover:border-[#444]`}`}
          onDrop={handleFileDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <CustomHandle type={`target`} position={Position.Left} id={`in`} />
          <CustomHandle type={`source`} position={Position.Right} id={`active`} />
          <div className={`flex-1 bg-[#121212] flex items-center justify-center relative overflow-hidden`}>
            {imageCount === 0 && (
              <div
                className={`flex flex-col items-center justify-center absolute inset-0 bg-[#151515] hover:bg-[#1a1a1a] transition-colors cursor-pointer group`}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                <div className={`w-12 h-12 rounded-xl bg-[#222] border border-dashed border-[#444] group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all`}>
                  <ImagePlus size={20} className={`text-gray-600 group-hover:text-blue-500/80 transition-colors`} />
                </div>
                <div className={`text-[10px] text-gray-500 mt-2`}>
                  拖拽 / 粘贴 / 点击添加图片
                </div>
              </div>
            )}
            {!expanded && activeImage && (
              <>
                <img
                  src={activeImage.url}
                  alt={activeImage.label || `图片 ${activeIndex + 1}`}
                  className={`w-full h-full object-contain cursor-pointer`}
                  draggable={false}
                  loading={`lazy`}
                  decoding={`async`}
                  onDoubleClick={(e) => { e.stopPropagation(); data.onZoom?.(id, undefined, activeImage.url); }}
                />
                {imageCount > 1 && (
                  <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-1.5 py-1 rounded-full bg-black/60 backdrop-blur-sm opacity-0 group-hover/node:opacity-100 transition-opacity`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); prevImage(); }}
                      className={`w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center`}
                      title={`上一张`}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className={`px-1 text-[10px] text-white tabular-nums select-none`}>
                      {activeIndex + 1}/{imageCount}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); nextImage(); }}
                      className={`w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center`}
                      title={`下一张`}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
            {expanded && imageCount > 0 && (
              <div className={`absolute inset-0 overflow-auto p-2 nowheel`}>
                <div
                  className={`grid gap-1.5`}
                  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(72px, 1fr))` }}
                >
                  {images.map((img, idx) => {
                    const isSelected = selectedIds.includes(img.id);
                    const isActive = idx === activeIndex;
                    return (
                      <div
                        key={img.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.effectAllowed = `move`;
                          try {
                            e.dataTransfer.setData(`text/plain`, String(idx));
                          } catch { /* empty */ }
                          setDragSourceIndex(idx);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (dragSourceIndex !== null && dragSourceIndex !== idx) setDropTargetIndex(idx);
                        }}
                        onDragOver={(e) => {
                          if (dragSourceIndex !== null) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = `move`;
                            if (dropTargetIndex !== idx) setDropTargetIndex(idx);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (dragSourceIndex !== null) e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          if (dragSourceIndex !== null) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (dragSourceIndex !== idx) moveImage(dragSourceIndex, idx);
                            setDragSourceIndex(null);
                            setDropTargetIndex(null);
                          }
                        }}
                        onDragEnd={(e) => {
                          e.stopPropagation();
                          setDragSourceIndex(null);
                          setDropTargetIndex(null);
                        }}
                        className={`relative aspect-square rounded-md overflow-hidden border cursor-grab active:cursor-grabbing group/thumb transition-all nodrag ${dropTargetIndex === idx && dragSourceIndex !== null && dragSourceIndex !== idx ? `border-blue-400 ring-2 ring-blue-400/60 scale-[1.03]` : isActive ? `border-blue-500` : isSelected ? `border-emerald-500` : `border-[#333]`} ${dragSourceIndex === idx ? `opacity-40` : ``}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey || e.ctrlKey || e.metaKey) {
                            setActiveIndex(idx);
                          } else {
                            toggleSelectedId(img.id);
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          data.onZoom?.(id, undefined, img.url);
                        }}
                        title={img.label || (isSelected ? `点击取消选择` : `点击选择 (按住 Ctrl 设为默认图)`)}
                      >
                        <img src={img.thumb || img.url} className={`w-full h-full bg-[#0e0e0e]`} />
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelectedId(img.id); }}
                          className={`absolute top-1 left-1 w-4 h-4 rounded flex items-center justify-center transition-colors ${isSelected ? `bg-emerald-500 text-white` : `bg-black/50 text-gray-300 group-hover/thumb:bg-black/70`}`}
                          title={isSelected ? `取消选择` : `选择`}
                        >
                          {isSelected ? <Check size={10} /> : <Square size={10} />}
                        </button>
                        {isActive && (
                          <span className={`absolute bottom-1 left-1 px-1 py-px rounded bg-blue-500 text-white text-[8px] font-medium`}>
                            默认
                          </span>
                        )}
                        <div className={`absolute top-1 right-1`} data-thumb-menu={true}>
                          <button
                            onMouseDown={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (menuIndex === idx) {
                                setMenuIndex(null);
                                setMenuPosition(null);
                              } else {
                                const rect = e.currentTarget.getBoundingClientRect();
                                let left = rect.right - 130;
                                if (left < 8) left = 8;
                                if (left + 130 > window.innerWidth - 8) left = window.innerWidth - 8 - 130;
                                let top = rect.bottom + 4;
                                if (top + 220 > window.innerHeight - 8) top = rect.top - 220 - 4;
                                setMenuIndex(idx);
                                setMenuPosition({ top, left });
                              }
                            }}
                            className={`w-4 h-4 rounded bg-black/60 text-gray-200 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-opacity ${menuIndex === idx ? `opacity-100` : `opacity-0 group-hover/thumb:opacity-100`}`}
                            title={`更多操作`}
                          >
                            <MoreVertical size={10} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className={`aspect-square rounded-md border border-dashed border-[#444] hover:border-blue-500/50 hover:bg-[#1a1a1a] text-gray-500 hover:text-blue-400 flex items-center justify-center transition-colors nodrag`}
                    title={`添加图片`}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            )}
            {isDragging && (
              <div className={`absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none`}>
                <div className={`px-3 py-1.5 rounded-md bg-[#1c1c1c] border border-blue-500/40 text-blue-300 text-xs flex items-center gap-1.5`}>
                  <Upload size={12} />
                  {' '}松开以加入图片盒子
                </div>
              </div>
            )}
          </div>
        </div>
        {menuIndex !== null && menuPosition && images[menuIndex] && createPortal(
          <div
            data-thumb-menu-portal={true}
            className={`fixed z-[99999] min-w-[130px] bg-[#1c1c1c] border border-[#333] rounded-md shadow-2xl p-1 nodrag nowheel`}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {(() => {
              const idx = menuIndex;
              const img = images[idx];
              const close = () => {
                setMenuIndex(null);
                setMenuPosition(null);
              };
              return (
                <>
                  <button
                    className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`}
                    onClick={() => { copyImageToClipboard(img.url); close(); }}
                  >
                    <Copy size={11} className={`text-gray-400`} />
                    <span>复制图片</span>
                  </button>
                  <button
                    className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`}
                    onClick={() => { downloadFile(img.url, img.label); close(); }}
                  >
                    <Download size={11} className={`text-gray-400`} />
                    <span>下载</span>
                  </button>
                  <button
                    className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`}
                    onClick={() => { data.onZoom?.(id, undefined, img.url); close(); }}
                  >
                    <Maximize2 size={11} className={`text-gray-400`} />
                    <span>放大查看</span>
                  </button>
                  <button
                    className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`}
                    onClick={() => { data.onSendToActiveTab?.(img.url); close(); }}
                  >
                    <Send size={11} className={`text-gray-400`} />
                    <span>发送</span>
                  </button>
                  {idx !== activeIndex && (
                    <button
                      className={`w-full text-left px-2 py-1.5 text-[11px] text-gray-300 hover:bg-[#333] hover:text-white rounded flex items-center gap-2`}
                      onClick={() => { setActiveIndex(idx); close(); }}
                    >
                      <Maximize2 size={11} className={`text-gray-400`} />
                      <span>设为默认</span>
                    </button>
                  )}
                  <div className={`h-[1px] bg-[#333] my-1`} />
                  <button
                    className={`w-full text-left px-2 py-1.5 text-[11px] text-red-400 hover:bg-[#333] rounded flex items-center gap-2`}
                    onClick={() => { removeImage(idx); close(); }}
                  >
                    <Trash2 size={11} />
                    <span>从盒子删除</span>
                  </button>
                </>
              );
            })()}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
});

export default ImageBoxNode;