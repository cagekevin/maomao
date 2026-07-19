/**
 * GridMergeNode - 网格合并节点
 * 原版函数名: To (L7906-L8591)
 * 来源: App-B9jVCs-a.decompiled.js
 */
import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Grid3x3,
  ArrowDown,
  Layers,
  Loader2,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';
import type { AppNode } from '../types';

// TODO: implement external functions
// function Co(imageUrl: string): Promise<HTMLImageElement> { ... }
// function wo(ctx: CanvasRenderingContext2D, width: number, height: number, transparent: boolean, bgColor: string, options?: any): void { ... }
// function _o(state: OverlayState): Promise<string> { ... }
// function yo(props: OverlayEditorProps): JSX.Element { ... }
// function xo(value: number, min: number, max: number): number { ... }
// function So(text: string): { rows: number; cols: number } | null { ... }
// const bo = [{ rows: 1, cols: 1, label: '1×1' }, { rows: 2, cols: 2, label: '2×2' }, { rows: 3, cols: 3, label: '3×3' }, { rows: 4, cols: 4, label: '4×4' }];

interface OverlayState {
  layers: Array<{ id: string; imageUrl: string; x: number; y: number; width: number; height: number; opacity: number }>;
  canvasWidth: number;
  canvasHeight: number;
  bgColor?: string;
}

interface GridMergeNodeData {
  gridSize?: number;
  rows?: number;
  cols?: number;
  mergeMode?: 'grid' | 'longImage' | 'overlay';
  cellSize?: number;
  aspectRatio?: string;
  autoSize?: boolean;
  titlePattern?: string;
  longDirection?: 'vertical' | 'horizontal';
  longGap?: number;
  longTargetSize?: number;
  longAutoSize?: boolean;
  bgColor?: string;
  imageUrl?: string;
  overlayState?: OverlayState;
  canvasWidth?: number;
  canvasHeight?: number;
  onSpawnImageNode?: (nodeId: string, imageUrl: string, type: string) => void;
  onShowToast?: (msg: string) => void;
  [key: string]: unknown;
}

interface GridPreset {
  rows: number;
  cols: number;
  label: string;
}

function GridMergeNode({ id, data, selected }: NodeProps<AppNode>) {
  const nodeData = data as unknown as GridMergeNodeData;

  const gridSize = typeof nodeData.gridSize === 'number' ? nodeData.gridSize : undefined;
  const [mergeMode, setMergeMode] = useState<'grid' | 'longImage' | 'overlay'>(nodeData.mergeMode || 'grid');
  const [rows, setRows] = useState(nodeData.rows ?? gridSize ?? 3);
  const [cols, setCols] = useState(nodeData.cols ?? gridSize ?? 3);
  const [cellSize, setCellSize] = useState(nodeData.cellSize || 512);
  const [aspectRatio, setAspectRatio] = useState(nodeData.aspectRatio || '1:1');
  const [autoSize, setAutoSize] = useState(nodeData.autoSize ?? true);
  const [titlePattern, setTitlePattern] = useState(nodeData.titlePattern || '');
  const [longDirection, setLongDirection] = useState<'vertical' | 'horizontal'>(nodeData.longDirection || 'vertical');
  const [longGap, setLongGap] = useState(nodeData.longGap ?? 0);
  const [longTargetSize, setLongTargetSize] = useState(nodeData.longTargetSize ?? 1024);
  const [longAutoSize, setLongAutoSize] = useState(nodeData.longAutoSize ?? true);
  const [showCustomGrid, setShowCustomGrid] = useState(false);
  const [gridSizeText, setGridSizeText] = useState(`${rows}x${cols}`);
  const [bgColor, setBgColor] = useState(nodeData.bgColor || 'transparent');
  const [previewUrl, setPreviewUrl] = useState<string | null>(nodeData.imageUrl || null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [gridCells, setGridCells] = useState<(string | null)[]>([]);
  const [longImages, setLongImages] = useState<string[]>([]);

  const hasDraggedRef = useRef(false);
  const lastImagesHashRef = useRef('');

  const [overlayState, setOverlayState] = useState<OverlayState>(() => {
    const state = nodeData.overlayState;
    return state && Array.isArray(state.layers) ? state : {
      layers: [],
      canvasWidth: nodeData.canvasWidth || 1024,
      canvasHeight: nodeData.canvasHeight || 1024,
    };
  });

  // TODO: implement Et function
  // const Et = useNodeExtent();
  // const updateNodeExtent = Et();

  const { updateNodeData } = useReactFlow();
  const targetConnections = useHandleConnections({ type: 'target' });
  const upstreamNodes = useMemo(() => targetConnections.map(conn => conn.source), [targetConnections]);

  // Update node extent
  useEffect(() => {
    // TODO: implement updateNodeExtent
    // updateNodeExtent(id);
  }, [rows, cols, mergeMode, id]);

  // Update node data
  useEffect(() => {
    updateNodeData(id, {
      mergeMode,
      rows,
      cols,
      cellSize,
      aspectRatio,
      autoSize,
      titlePattern,
      longDirection,
      longGap,
      longTargetSize,
      longAutoSize,
      bgColor,
      overlayState,
      canvasWidth: overlayState.canvasWidth,
      canvasHeight: overlayState.canvasHeight,
    });
  }, [mergeMode, rows, cols, cellSize, aspectRatio, autoSize, titlePattern, longDirection, longGap, longTargetSize, longAutoSize, bgColor, overlayState, id, updateNodeData]);

  // Sync bgColor to overlayState
  useEffect(() => {
    if (overlayState.bgColor !== bgColor) {
      setOverlayState(prev => ({
        ...prev,
        bgColor,
      }));
    }
  }, [bgColor, overlayState.bgColor]);

  // Process upstream images
  useEffect(() => {
    const totalCells = rows * cols;
    const cells = Array(totalCells).fill(null);
    const images: string[] = [];
    let writeIndex = 0;

    const sources = upstreamNodes.length > 0 ? (Array.isArray(upstreamNodes) ? upstreamNodes : [upstreamNodes]) : [];

    for (const conn of targetConnections) {
      const targetHandle = conn.targetHandle;
      const sourceData = sources.find(s => s.id === conn.source)?.data;
      if (!sourceData) continue;

      const getImages = (): string[] => {
        if (sourceData.images && Array.isArray(sourceData.images)) {
          const imgs = sourceData.images;
          const selectedIds = sourceData.selectedIds || [];
          if (selectedIds.length > 0) {
            const idSet = new Set(selectedIds);
            const filtered: string[] = [];
            imgs.forEach(img => {
              if (img?.url && idSet.has(img.id)) {
                filtered.push(img.url);
              }
            });
            if (filtered.length > 0) return filtered;
          }
          const mapped = imgs.map(img => img?.url).filter((url): url is string => !!url);
          if (mapped.length > 0) return mapped;
        }
        if (Array.isArray(sourceData.extractedImages)) {
          return sourceData.extractedImages.filter(Boolean) as string[];
        }
        if (sourceData.imageUrl) {
          return [sourceData.imageUrl];
        }
        return [];
      };

      if (targetHandle === 'default' || !targetHandle) {
        const imgs = getImages();
        for (const img of imgs) {
          images.push(img);
          while (writeIndex < cells.length && cells[writeIndex] !== null) {
            writeIndex++;
          }
          if (writeIndex < cells.length) {
            cells[writeIndex] = img;
          }
        }
      } else if (targetHandle && targetHandle.startsWith('cell-')) {
        const cellIndex = parseInt(targetHandle.replace('cell-', ''), 10);
        if (cellIndex >= 0 && cellIndex < totalCells) {
          if (sourceData.imageUrl) {
            cells[cellIndex] = sourceData.imageUrl;
            images.push(sourceData.imageUrl);
          } else if (Array.isArray(sourceData.extractedImages)) {
            const img = sourceData.extractedImages.find(Boolean);
            if (img) {
              cells[cellIndex] = img;
              images.push(img);
            }
          }
        }
      }
    }

    const imagesHash = JSON.stringify(images);
    setGridCells(prevCells => {
      if (imagesHash === lastImagesHashRef.current && hasDraggedRef.current && prevCells.length === cells.length) {
        return prevCells;
      }
      lastImagesHashRef.current = imagesHash;
      hasDraggedRef.current = false;
      return cells;
    });
    setLongImages(prevImages => (hasDraggedRef.current && prevImages.length === images.length ? prevImages : images));
  }, [targetConnections, upstreamNodes, rows, cols]);

  const renderTimeoutRef = useRef<number | null>(null);

  // Render to canvas function
  const renderToCanvas = useCallback(async (transparent: boolean): Promise<string | null> => {
    try {
      if (mergeMode === 'longImage') {
        const images = longImages;
        if (images.length === 0) return null;

        const loadedImages = (await Promise.all(images.map(Co))).filter((img): img is HTMLImageElement => img !== null); // TODO: implement Co
        if (loadedImages.length === 0) return null;

        const isVertical = longDirection === 'vertical';
        const baseSize = longAutoSize ? (isVertical ? loadedImages[0].width : loadedImages[0].height) : longTargetSize;

        let totalWidth = 0;
        let totalHeight = 0;
        const sizes: Array<{ w: number; h: number }> = [];

        if (isVertical) {
          totalWidth = baseSize;
          for (const img of loadedImages) {
            const w = baseSize;
            const h = Math.round(img.height / img.width * baseSize);
            sizes.push({ w, h });
            totalHeight += h;
          }
          totalHeight += longGap * Math.max(0, loadedImages.length - 1);
        } else {
          totalHeight = baseSize;
          for (const img of loadedImages) {
            const h = baseSize;
            const w = Math.round(img.width / img.height * baseSize);
            sizes.push({ w, h });
            totalWidth += w;
          }
          totalWidth += longGap * Math.max(0, loadedImages.length - 1);
        }

        const scale = transparent ? 1 : Math.min(1, 800 / Math.max(totalWidth, totalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(totalWidth * scale));
        canvas.height = Math.max(1, Math.round(totalHeight * scale));

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        wo(ctx, canvas.width, canvas.height, transparent, bgColor); // TODO: implement wo

        let offset = 0;
        loadedImages.forEach((img, i) => {
          const size = sizes[i];
          const w = size.w * scale;
          const h = size.h * scale;

          if (isVertical) {
            ctx.drawImage(img, 0, offset, w, h);
            offset += h + longGap * scale;
          } else {
            ctx.drawImage(img, offset, 0, w, h);
            offset += w + longGap * scale;
          }
        });

        return canvas.toDataURL(transparent ? 'image/png' : 'image/jpeg', transparent ? 1 : 0.85);
      }

      if (mergeMode === 'grid') {
        const totalCells = rows * cols;
        const cellImages = gridCells.slice(0, totalCells);
        const loadedImages = await Promise.all(cellImages.map(img => img ? Co(img) : Promise.resolve(null))); // TODO: implement Co

        let cellW = cellSize;
        let cellH = cellSize;
        const firstImage = loadedImages.find(Boolean);

        if (autoSize && firstImage) {
          cellW = firstImage.width;
          cellH = firstImage.height;
        } else {
          const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
          const ratio = ratioW / ratioH;
          cellH = Math.round(cellSize / ratio);
        }

        const totalWidth = cellW * cols;
        const totalHeight = cellH * rows;
        const scale = transparent ? 1 : Math.min(1, 600 / Math.max(totalWidth, totalHeight));

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(totalWidth * scale));
        canvas.height = Math.max(1, Math.round(totalHeight * scale));

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        wo(ctx, canvas.width, canvas.height, transparent, bgColor, { // TODO: implement wo
          rows,
          cols,
          cellW: cellW * scale,
          cellH: cellH * scale,
        });

        loadedImages.forEach((img, i) => {
          if (i >= totalCells || !img) return;

          const row = Math.floor(i / cols);
          const col = i % cols;
          const x = col * cellW * scale;
          const y = row * cellH * scale;
          const w = cellW * scale;
          const h = cellH * scale;

          ctx.drawImage(img, x, y, w, h);

          const title = titlePattern.trim() ? titlePattern.replace('{num}', (i + 1).toString()) : '';
          if (title) {
            const fontSize = Math.max(12, w * 0.08);
            ctx.font = `bold ${fontSize}px sans-serif`;
            const metrics = ctx.measureText(title);
            const paddingX = fontSize * 0.6;
            const paddingY = fontSize * 0.4;
            const bgWidth = metrics.width + paddingX * 2;
            const bgHeight = fontSize + paddingY * 2;
            const margin = w * 0.03;

            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            const bgX = x + margin;
            const bgY = y + margin;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 8);
            } else {
              ctx.rect(bgX, bgY, bgWidth, bgHeight);
            }
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'center';
            ctx.fillText(title, bgX + bgWidth / 2, bgY + bgHeight / 2 + 2);
          }
        });

        return canvas.toDataURL(transparent ? 'image/png' : 'image/jpeg', transparent ? 1 : 0.85);
      }

      return null;
    } catch (error) {
      console.error('renderToCanvas failed', error);
      return null;
    }
  }, [mergeMode, longImages, longDirection, longAutoSize, longTargetSize, longGap, bgColor, gridCells, rows, cols, cellSize, autoSize, aspectRatio, titlePattern]);

  // Debounced preview render
  useEffect(() => {
    if (renderTimeoutRef.current !== null) {
      window.clearTimeout(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = window.setTimeout(async () => {
      const result = await renderToCanvas(false);
      setPreviewUrl(result);
    }, 250);

    return () => {
      if (renderTimeoutRef.current !== null) {
        window.clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [renderToCanvas]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (
      (mergeMode === 'longImage' && longImages.length === 0) ||
      (mergeMode === 'grid' && gridCells.every(cell => !cell)) ||
      (mergeMode === 'overlay' && overlayState.layers.length === 0)
    ) {
      return;
    }

    setIsExporting(true);
    try {
      let result = null;
      if (mergeMode === 'overlay') {
        result = await _o(overlayState); // TODO: implement _o
      } else {
        result = await renderToCanvas(true);
      }

      if (result) {
        setPreviewUrl(result);
        updateNodeData(id, {
          imageUrl: result,
        });
        // TODO: implement updateNodeExtent
        // updateNodeExtent(id);
        if (typeof nodeData.onSpawnImageNode === 'function') {
          nodeData.onSpawnImageNode(id, result, `merged-${mergeMode}`);
        }
      }
    } finally {
      setIsExporting(false);
    }
  }, [mergeMode, longImages, gridCells, overlayState, renderToCanvas, id, updateNodeData, nodeData]);

  const totalCells = rows * cols;
  const isGridSize = (r: number, c: number) => rows === r && cols === c;

  useMemo(() => null, []);

  const displayCellCount = useMemo(() => {
    if (mergeMode === 'longImage') {
      return Math.max(1, longImages.length || 3);
    }
    return totalCells;
  }, [mergeMode, longImages.length, totalCells]);

  return (
    <div className="relative flex flex-col">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between gap-2 min-w-[320px]">
        <NodeTitle
          id={id}
          data={data}
          defaultTitle="图像拼图"
          icon={<Grid3x3 size={11} className="text-gray-500" />}
          className="!mb-0"
        />
        <div className="flex items-center gap-1 nodrag">
          <button
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${
              mergeMode === 'grid'
                ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white'
            }`}
            onClick={() => setMergeMode('grid')}
            title="网格拼图"
          >
            <Grid3x3 size={11} />
            {' '}网格
          </button>
          <button
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${
              mergeMode === 'longImage'
                ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white'
            }`}
            onClick={() => setMergeMode('longImage')}
            title="无限长图"
          >
            <ArrowDown size={11} />
            {' '}长图
          </button>
          <button
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${
              mergeMode === 'overlay'
                ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white'
            }`}
            onClick={() => setMergeMode('overlay')}
            title="叠加"
          >
            <Layers size={11} />
            {' '}叠加
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 min-w-[320px] flex flex-col ${
          selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'
        }`}
      >
        <CustomHandle
          type="target"
          id="default"
          position={Position.Left}
          className="!w-4 !h-4 z-50"
          style={{ top: '15px' }}
        />
        <CustomHandle type="source" position={Position.Right} id="merged-output" />

        <div
          className={`p-3 space-y-3 bg-[#1a1a1a] ${previewUrl ? 'rounded-b-xl' : 'rounded-xl'} relative drag-handle`}
        >
          {mergeMode !== 'overlay' && (
            <div
              className="bg-[#0d0c0c] rounded border border-[#333] flex items-center justify-center relative overflow-hidden nodrag"
              style={{ minHeight: 160, maxHeight: 360 }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-full max-h-[360px] object-contain block"
                />
              ) : (
                <div
                  className="grid w-full p-2 gap-1 opacity-50"
                  style={{
                    gridTemplateColumns: mergeMode === 'longImage' ? '1fr' : `repeat(${cols}, minmax(0, 1fr))`,
                    gridTemplateRows:
                      mergeMode === 'longImage'
                        ? `repeat(${displayCellCount}, minmax(40px, 1fr))`
                        : `repeat(${rows}, minmax(0, 1fr))`,
                    minHeight: 160,
                  }}
                >
                  {Array.from({ length: displayCellCount }).map((_, i) => (
                    <div
                      key={i}
                      className="border border-[#333] border-dashed rounded-[2px] flex items-center justify-center bg-[#1a1a1a] text-[10px] text-[#555] min-h-[40px]"
                    >
                      图 {i + 1}
                    </div>
                  ))}
                </div>
              )}

              {/* Grid mode drag overlay */}
              {mergeMode === 'grid' && (
                <div
                  className="absolute inset-0 grid gap-1 p-2 pointer-events-none"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: totalCells }).map((_, i) => {
                    const cellImage = gridCells[i];
                    const isSource = dragSourceIndex === i;
                    const isTarget = dragSourceIndex !== null && dragSourceIndex !== i && dragTargetIndex === i;

                    return (
                      <div
                        key={i}
                        className={`relative pointer-events-auto group/cell rounded-[2px] transition-all
                          ${cellImage ? 'cursor-grab active:cursor-grabbing' : ''}
                          ${isSource ? 'opacity-30 ring-2 ring-blue-300' : ''}
                          ${isTarget ? 'ring-2 ring-blue-400 bg-blue-400/15 shadow-[inset_0_0_0_2px_rgba(96,165,250,0.6)]' : ''}
                        `}
                        draggable={!!cellImage}
                        onDragStart={(e) => {
                          if (!cellImage) return;
                          e.stopPropagation();
                          setDragSourceIndex(i);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('application/x-yimao-puzzle', String(i));

                          const dragImage = document.createElement('div');
                          dragImage.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
                          document.body.appendChild(dragImage);
                          e.dataTransfer.setDragImage(dragImage, 0, 0);
                          setTimeout(() => {
                            try {
                              document.body.removeChild(dragImage);
                            } catch {}
                          }, 0);
                        }}
                        onDragEnter={(e) => {
                          if (dragSourceIndex !== null) {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragTargetIndex(i);
                          }
                        }}
                        onDragOver={(e) => {
                          if (dragSourceIndex !== null) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'move';
                          }
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          setDragTargetIndex(prev => (prev === i ? null : prev));
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          const data = e.dataTransfer.getData('application/x-yimao-puzzle');
                          const sourceIndex = data ? parseInt(data, 10) : dragSourceIndex ?? -1;

                          if (sourceIndex < 0 || sourceIndex === i || Number.isNaN(sourceIndex)) {
                            setDragSourceIndex(null);
                            setDragTargetIndex(null);
                            return;
                          }

                          hasDraggedRef.current = true;
                          setGridCells(cells => {
                            const newCells = cells.slice();
                            const temp = newCells[sourceIndex];
                            newCells[sourceIndex] = newCells[i];
                            newCells[i] = temp;
                            return newCells;
                          });
                          setDragSourceIndex(null);
                          setDragTargetIndex(null);
                        }}
                        onDragEnd={(e) => {
                          e.stopPropagation();
                          setDragSourceIndex(null);
                          setDragTargetIndex(null);
                        }}
                        title={cellImage ? `第 ${i + 1} 格：拖到其它格子可交换位置` : ''}
                      >
                        {dragSourceIndex !== null && (
                          <span
                            className={`absolute top-1 right-1 px-1 py-px rounded text-[9px] font-mono pointer-events-none transition-colors
                              ${isTarget ? 'bg-blue-500 text-white' : 'bg-black/60 text-white/80'}
                            `}
                          >
                            {i + 1}
                          </span>
                        )}
                        <Handle
                          type="target"
                          position={Position.Left}
                          id={`cell-${i}`}
                          className="!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]"
                          style={{
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            minWidth: '6px',
                            minHeight: '6px',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Long image mode drag overlay */}
              {mergeMode === 'longImage' && longImages.length > 0 && (
                <div
                  className="absolute inset-0 grid p-2 gap-0 pointer-events-none"
                  style={{
                    gridTemplateColumns:
                      longDirection === 'horizontal' ? `repeat(${longImages.length}, minmax(0, 1fr))` : '1fr',
                    gridTemplateRows:
                      longDirection === 'vertical' ? `repeat(${longImages.length}, minmax(0, 1fr))` : '1fr',
                  }}
                >
                  {longImages.map((_, i) => {
                    const isSource = dragSourceIndex === i;
                    const isTarget = dragSourceIndex !== null && dragSourceIndex !== i && dragTargetIndex === i;

                    return (
                      <div
                        key={i}
                        className={`pointer-events-auto cursor-grab active:cursor-grabbing rounded-[2px] transition-all
                          ${isSource ? 'opacity-30 ring-2 ring-blue-300' : ''}
                          ${isTarget ? 'ring-2 ring-blue-400 bg-blue-400/15 shadow-[inset_0_0_0_2px_rgba(96,165,250,0.6)]' : ''}
                        `}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDragSourceIndex(i);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('application/x-yimao-puzzle', String(i));

                          const dragImage = document.createElement('div');
                          dragImage.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
                          document.body.appendChild(dragImage);
                          e.dataTransfer.setDragImage(dragImage, 0, 0);
                          setTimeout(() => {
                            try {
                              document.body.removeChild(dragImage);
                            } catch {}
                          }, 0);
                        }}
                        onDragEnter={(e) => {
                          if (dragSourceIndex !== null) {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragTargetIndex(i);
                          }
                        }}
                        onDragOver={(e) => {
                          if (dragSourceIndex !== null) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'move';
                          }
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          setDragTargetIndex(prev => (prev === i ? null : prev));
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          const data = e.dataTransfer.getData('application/x-yimao-puzzle');
                          const sourceIndex = data ? parseInt(data, 10) : dragSourceIndex ?? -1;

                          if (sourceIndex < 0 || sourceIndex === i || Number.isNaN(sourceIndex)) {
                            setDragSourceIndex(null);
                            setDragTargetIndex(null);
                            return;
                          }

                          hasDraggedRef.current = true;
                          setLongImages(images => {
                            const newImages = images.slice();
                            const temp = newImages[sourceIndex];
                            newImages[sourceIndex] = newImages[i];
                            newImages[i] = temp;
                            return newImages;
                          });
                          setDragSourceIndex(null);
                          setDragTargetIndex(null);
                        }}
                        onDragEnd={(e) => {
                          e.stopPropagation();
                          setDragSourceIndex(null);
                          setDragTargetIndex(null);
                        }}
                        title={`第 ${i + 1} 张：拖到其它项可交换顺序`}
                      >
                        {dragSourceIndex !== null && (
                          <span
                            className={`absolute m-1 px-1 py-px rounded text-[9px] font-mono pointer-events-none transition-colors
                              ${isTarget ? 'bg-blue-500 text-white' : 'bg-black/60 text-white/80'}
                            `}
                          >
                            {i + 1}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Loading overlay */}
              {isExporting && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="animate-spin text-white" />
                </div>
              )}
            </div>
          )}

          {/* Overlay mode editor */}
          {mergeMode === 'overlay' && (
            // TODO: implement yo component
            <div className="text-gray-500 text-sm">TODO: Overlay editor component</div>
          )}

          {/* Controls */}
          <div className="space-y-2 nodrag">
            {/* Background color */}
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span>背景</span>
              <button
                className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
                  bgColor === 'transparent'
                    ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                    : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white'
                }`}
                onClick={() => setBgColor('transparent')}
                title="透明背景（导出 PNG 保留透明通道）"
              >
                透明
              </button>
              <input
                type="color"
                value={bgColor === 'transparent' ? '#000000' : bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-6 h-5 rounded border border-[#333] bg-transparent cursor-pointer"
                title="自定义背景色"
              />
              {bgColor !== 'transparent' && (
                <span className="font-mono text-gray-500">{bgColor}</span>
              )}
            </div>

            {/* Grid mode controls */}
            {mergeMode === 'grid' && (
              <>
                <div className="flex flex-wrap items-center gap-1">
                  {/* TODO: use bo array */}
                  {[
                    { rows: 1, cols: 1, label: '1×1' },
                    { rows: 2, cols: 2, label: '2×2' },
                    { rows: 3, cols: 3, label: '3×3' },
                    { rows: 4, cols: 4, label: '4×4' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                        isGridSize(preset.rows, preset.cols)
                          ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                          : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]'
                      }`}
                      onClick={() => {
                        setRows(preset.rows);
                        setCols(preset.cols);
                        setGridSizeText(`${preset.rows}x${preset.cols}`);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      showCustomGrid
                        ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                        : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]'
                    }`}
                    onClick={() => setShowCustomGrid(prev => !prev)}
                  >
                    自定义
                  </button>
                </div>
                {showCustomGrid && (
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                    <span>行</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={rows}
                      onChange={(e) => {
                        const val = xo(parseInt(e.target.value || '1', 10) || 1, 1, 20); // TODO: implement xo
                        setRows(val);
                        setGridSizeText(`${val}x${cols}`);
                      }}
                      className="w-12 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none"
                    />
                    <span>×</span>
                    <span>列</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={cols}
                      onChange={(e) => {
                        const val = xo(parseInt(e.target.value || '1', 10) || 1, 1, 20); // TODO: implement xo
                        setCols(val);
                        setGridSizeText(`${rows}x${val}`);
                      }}
                      className="w-12 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none"
                    />
                    <span className="mx-1 text-[#555]">|</span>
                    <input
                      type="text"
                      value={gridSizeText}
                      placeholder="1x5"
                      onChange={(e) => setGridSizeText(e.target.value)}
                      onBlur={() => {
                        const parsed = So(gridSizeText); // TODO: implement So
                        if (parsed) {
                          setRows(parsed.rows);
                          setCols(parsed.cols);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const parsed = So(gridSizeText); // TODO: implement So
                          if (parsed) {
                            setRows(parsed.rows);
                            setCols(parsed.cols);
                          }
                        }
                      }}
                      className="flex-1 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none"
                    placeholder="分图角标，{num} 引入数字编号，可留空"
                    value={titlePattern}
                    onChange={(e) => setTitlePattern(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={autoSize ? 'auto' : cellSize}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'auto') {
                        setAutoSize(true);
                      } else {
                        setAutoSize(false);
                        setCellSize(Number(val));
                      }
                    }}
                    className="bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none flex-1"
                    title="单格尺寸"
                  >
                    <option value="auto">自适应</option>
                    <option value={256}>256px</option>
                    <option value={512}>512px</option>
                    <option value={1024}>1024px</option>
                    <option value={2048}>2048px</option>
                  </select>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none flex-1"
                    title="比例"
                    disabled={autoSize}
                    style={{ opacity: autoSize ? 0.5 : 1 }}
                  >
                    <option value="1:1">1:1</option>
                    <option value="16:9">16:9</option>
                    <option value="4:3">4:3</option>
                    <option value="3:4">3:4</option>
                    <option value="9:16">9:16</option>
                  </select>
                </div>
              </>
            )}

            {/* Long image mode controls */}
            {mergeMode === 'longImage' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <span>方向</span>
                  <button
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      longDirection === 'vertical'
                        ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                        : 'bg-[#2a2a2a] border-[#333] text-gray-400'
                    }`}
                    onClick={() => setLongDirection('vertical')}
                  >
                    垂直
                  </button>
                  <button
                    className={`px-2 py-0.5 rounded border transition-colors ${
                      longDirection === 'horizontal'
                        ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                        : 'bg-[#2a2a2a] border-[#333] text-gray-400'
                    }`}
                    onClick={() => setLongDirection('horizontal')}
                  >
                    水平
                  </button>
                  <span className="ml-auto">{longImages.length} 张</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={longAutoSize}
                      onChange={(e) => setLongAutoSize(e.target.checked)}
                      className="accent-blue-500"
                    />
                    {' '}跟随首图
                  </label>
                  <span>{longDirection === 'vertical' ? '宽度' : '高度'}</span>
                  <input
                    type="number"
                    min={64}
                    max={4096}
                    value={longTargetSize}
                    onChange={(e) => setLongTargetSize(xo(parseInt(e.target.value || '1024', 10) || 1024, 64, 4096))} // TODO: implement xo
                    disabled={longAutoSize}
                    className="w-20 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none disabled:opacity-50"
                  />
                  <span>间距</span>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={longGap}
                    onChange={(e) => setLongGap(xo(parseInt(e.target.value || '0', 10) || 0, 0, 200))} // TODO: implement xo
                    className="w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none"
                  />
                </div>
              </div>
            )}

            {/* Export button */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                disabled={
                  mergeMode === 'overlay'
                    ? overlayState.layers.length === 0
                    : targetConnections.length === 0
                }
                className={`flex-1 py-1.5 rounded text-xs transition-colors ${
                  mergeMode === 'overlay'
                    ? overlayState.layers.length > 0
                    : targetConnections.length > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-[#333] text-gray-500 cursor-not-allowed'
                }`}
              >
                开始合成
              </button>
            </div>
          </div>
        </div>

        <CustomHandle type="source" position={Position.Right} id="batch-output" />
      </div>
    </div>
  );
}

export default memo(GridMergeNode);