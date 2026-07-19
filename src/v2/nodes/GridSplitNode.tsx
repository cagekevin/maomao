/**
 * GridSplitNode - 网格分割节点
 * 原版函数名: po (L6167-L6960)
 * 来源: App-B9jVCs-a.decompiled.js
 */
import { memo, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Grid3x3,
  GripVertical,
  Scissors,
  CheckCircle2,
  Play,
  RotateCcw,
  Maximize2,
  Trash2,
  ImageIcon,
  X,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';
import type { AppNode } from '../types';

// TODO: implement external functions
// function ro(arr: number[]): number[] { ... }
// function io(arr: number[]): Array<[number, number]> { ... }
// function co(point: { x: number; y: number }): { x: number; y: number; edge?: string } { ... }
// function ao(): string { ... }
// function lo(points: Array<{ x: number; y: number }>, snapTo: string, edge: string): Array<{ x: number; y: number }> { ... }
// function fo(imageUrl: string, shape: any): Promise<string> { ... }
// function no(value: number, min: number, max: number): number { ... }
// const oo = 'crosshair';
// const to = [{ rows: 1, cols: 1, label: '1×1' }, { rows: 2, cols: 2, label: '2×2' }, { rows: 3, cols: 3, label: '3×3' }, { rows: 4, cols: 4, label: '4×4' }];
// const Un = { createPortal: (node: React.ReactNode, container: HTMLElement) => React.ReactPortal };

interface GridSplitNodeData {
  gridSize?: number;
  rows?: number;
  cols?: number;
  splitMode?: 'grid' | 'manual' | 'lasso';
  hLines?: number[];
  vLines?: number[];
  lassoShapes?: Array<{ id: string; points: Array<{ x: number; y: number }>; closed: boolean }>;
  titlePattern?: string;
  sendToImageBox?: boolean;
  imageUrl?: string;
  extractedImages?: (string | null)[];
  onSplit?: (nodeId: string, imageUrl: string, rows: number, cols: number, titlePattern: string, options: any) => void;
  onSplitManual?: (nodeId: string, images: string[], titlePattern: string, options: any) => void;
  onSplitOne?: (nodeId: string, imageUrl: string, rows: number, cols: number, index: number, titlePattern: string, options: any) => void;
  onSplitOneManual?: (nodeId: string, image: string, index: number, titlePattern: string, options: any) => void;
  [key: string]: unknown;
}

interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function GridSplitNode({ id, data, selected }: NodeProps<AppNode>) {
  const nodeData = data as unknown as GridSplitNodeData;

  const gridSize = typeof nodeData.gridSize === 'number' ? nodeData.gridSize : undefined;
  const [splitMode, setSplitMode] = useState<'grid' | 'manual' | 'lasso'>(nodeData.splitMode || 'grid');
  const [rows, setRows] = useState(nodeData.rows ?? gridSize ?? 3);
  const [cols, setCols] = useState(nodeData.cols ?? gridSize ?? 3);
  const [hLines, setHLines] = useState<number[]>(Array.isArray(nodeData.hLines) ? [] : [.5]); // TODO: use ro
  const [vLines, setVLines] = useState<number[]>(Array.isArray(nodeData.vLines) ? [] : [.5]); // TODO: use ro
  const [lassoShapes, setLassoShapes] = useState<Array<{ id: string; points: Array<{ x: number; y: number }>; closed: boolean }>>(
    Array.isArray(nodeData.lassoShapes) ? nodeData.lassoShapes : []
  );
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [titlePattern, setTitlePattern] = useState(nodeData.titlePattern || '#{num}');
  const [sendToImageBox, setSendToImageBox] = useState(nodeData.sendToImageBox ?? false);
  const [showCustomGrid, setShowCustomGrid] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapEdge, setSnapEdge] = useState<string | null>(null);

  // TODO: implement Et function
  // const Et = useNodeExtent();
  // const updateNodeExtent = Et();

  const { updateNodeData } = useReactFlow();
  const targetConnections = useHandleConnections({ type: 'target' });
  const sourceConnections = useMemo(() => new Set(targetConnections.map(conn => conn.sourceHandle?.startsWith('cell-') ? parseInt(conn.sourceHandle.replace('cell-', ''), 10) : -1).filter(i => i >= 0)), [targetConnections]);

  let imageUrl = nodeData.imageUrl;
  if (!imageUrl && targetConnections.length > 0) {
    const conn = (Array.isArray(targetConnections) ? targetConnections : [targetConnections]).find(c => c?.source?.data?.imageUrl);
    if (conn) {
      imageUrl = (conn.source.data as any).imageUrl;
    }
  }

  const cells = useMemo<CellRect[]>(() => {
    if (splitMode === 'grid') {
      const cellW = 1 / cols;
      const cellH = 1 / rows;
      const result: CellRect[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          result.push({
            x: c * cellW,
            y: r * cellH,
            w: cellW,
            h: cellH,
          });
        }
      }
      return result;
    }
    if (splitMode === 'manual') {
      // TODO: implement io function
      // const xCoords = io(vLines);
      // const yCoords = io(hLines);
      const xCoords = [0, ...vLines, 1];
      const yCoords = [0, ...hLines, 1];
      const result: CellRect[] = [];
      for (let [y1, y2] of yCoords) {
        for (let [x1, x2] of xCoords) {
          result.push({
            x: x1,
            y: y1,
            w: x2 - x1,
            h: y2 - y1,
          });
        }
      }
      return result;
    }
    return [];
  }, [splitMode, rows, cols, hLines, vLines]);

  const cellCount = splitMode === 'lasso' ? lassoShapes.filter(s => s.closed && s.points.length >= 3).length : cells.length;
  const displayRows = splitMode === 'grid' ? rows : splitMode === 'manual' ? hLines.length + 1 : 1;
  const displayCols = splitMode === 'grid' ? cols : splitMode === 'manual' ? vLines.length + 1 : cellCount;

  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  // Update node extent
  useEffect(() => {
    // TODO: implement updateNodeExtent
    // updateNodeExtent(id);
  }, [cellCount, id]);

  // Update node data
  useEffect(() => {
    if (splitMode === 'lasso') return;
    if (!imageUrl) {
      updateNodeData(id, {
        extractedImages: [],
        rows: displayRows,
        cols: displayCols,
        gridSize: Math.max(displayRows, displayCols),
        splitMode,
        hLines,
        vLines,
        lassoShapes,
      });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = imageUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => {
            const fallbackImg = new Image();
            fallbackImg.src = imageUrl;
            fallbackImg.onload = () => resolve();
            fallbackImg.onerror = () => resolve();
          };
        });

        const width = img.width;
        const height = img.height;
        const extractedImages: (string | null)[] = [];

        for (const cell of cells) {
          const sx = cell.x * width;
          const sy = cell.y * height;
          const sw = cell.w * width;
          const sh = cell.h * height;

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(sw));
          canvas.height = Math.max(1, Math.round(sh));

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            extractedImages.push(canvas.toDataURL('image/jpeg', 0.85));
          } else {
            extractedImages.push(null);
          }
        }

        if (!cancelled) {
          updateNodeData(id, {
            extractedImages,
            rows: displayRows,
            cols: displayCols,
            gridSize: Math.max(displayRows, displayCols),
            splitMode,
            hLines,
            vLines,
            lassoShapes,
          });
        }
      } catch (error) {
        console.error('Failed to pre-crop images:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, cells, displayRows, displayCols, splitMode, hLines, vLines, lassoShapes, id, updateNodeData]);

  // Lasso mode effect
  useEffect(() => {
    if (splitMode !== 'lasso' || fullscreenRef.current) return;
    if (!imageUrl) {
      updateNodeData(id, {
        extractedImages: [],
        rows: 1,
        cols: 0,
        gridSize: 1,
        splitMode,
        hLines,
        vLines,
        lassoShapes,
      });
      return;
    }

    let cancelled = false;
    (async () => {
      const closedShapes = lassoShapes.filter(s => s.closed && s.points.length >= 3);
      const extractedImages: string[] = [];

      for (const shape of closedShapes) {
        const image = await fo(imageUrl, shape); // TODO: implement fo
        extractedImages.push(image);
        if (cancelled) return;
      }

      if (!cancelled) {
        updateNodeData(id, {
          extractedImages,
          rows: 1,
          cols: closedShapes.length,
          gridSize: Math.max(1, closedShapes.length),
          splitMode,
          hLines,
          vLines,
          lassoShapes,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, lassoShapes, splitMode, hLines, vLines, id, updateNodeData]);

  // Sync lassoShapes from data
  useEffect(() => {
    if (fullscreenRef.current) return;
    const dataShapes = nodeData.lassoShapes;
    if (Array.isArray(dataShapes) && JSON.stringify(dataShapes) !== JSON.stringify(lassoShapes)) {
      setLassoShapes(dataShapes);
    }
  }, [nodeData.lassoShapes]);

  // Sync rows from data
  useEffect(() => {
    const dataRows = nodeData.rows;
    if (typeof dataRows === 'number' && dataRows !== rows) {
      setRows(no(dataRows, 1, 20)); // TODO: implement no
    }
  }, [nodeData.rows]);

  // Sync cols from data
  useEffect(() => {
    const dataCols = nodeData.cols;
    if (typeof dataCols === 'number' && dataCols !== cols) {
      setCols(no(dataCols, 1, 20)); // TODO: implement no
    }
  }, [nodeData.cols]);

  // Sync splitMode from data
  useEffect(() => {
    const dataSplitMode = nodeData.splitMode;
    if (dataSplitMode && dataSplitMode !== splitMode) {
      setSplitMode(dataSplitMode);
    }
  }, [nodeData.splitMode]);

  // Update titlePattern and sendToImageBox
  useEffect(() => {
    updateNodeData(id, {
      titlePattern,
      sendToImageBox,
    });
  }, [titlePattern, sendToImageBox, id, updateNodeData]);

  const getDrawingContainer = useCallback(() => {
    return splitMode === 'lasso' && isFullscreen && fullscreenRef.current
      ? fullscreenRef.current
      : containerRef.current;
  }, [splitMode, isFullscreen]);

  const [draggingLine, setDraggingLine] = useState<{ type: 'h' | 'v'; index: number } | null>(null);

  // Sync hLines from data
  useEffect(() => {
    if (draggingLine) return;
    const dataHLines = nodeData.hLines;
    if (Array.isArray(dataHLines) && JSON.stringify(dataHLines) !== JSON.stringify(hLines)) {
      setHLines([]); // TODO: use ro(dataHLines)
    }
  }, [nodeData.hLines]);

  // Sync vLines from data
  useEffect(() => {
    if (draggingLine) return;
    const dataVLines = nodeData.vLines;
    if (Array.isArray(dataVLines) && JSON.stringify(dataVLines) !== JSON.stringify(vLines)) {
      setVLines([]); // TODO: use ro(dataVLines)
    }
  }, [nodeData.vLines]);

  // Drag line effect
  useEffect(() => {
    if (!draggingLine) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();

      if (draggingLine.type === 'h') {
        const ratio = no((e.clientY - rect.top) / rect.height, 0.01, 0.99); // TODO: implement no
        setHLines(lines => []); // TODO: use ro(lines.map((l, i) => i === draggingLine.index ? ratio : l))
      } else {
        const ratio = no((e.clientX - rect.left) / rect.width, 0.01, 0.99); // TODO: implement no
        setVLines(lines => []); // TODO: use ro(lines.map((l, i) => i === draggingLine.index ? ratio : l))
      }
    };

    const handleMouseUp = () => {
      setDraggingLine(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingLine]);

  // Double click to add line
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (splitMode !== 'manual') return;
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (e.shiftKey) {
      setVLines(lines => []); // TODO: use ro([...lines, x])
    } else {
      setHLines(lines => []); // TODO: use ro([...lines, y])
    }
  }, [splitMode]);

  const removeHLine = useCallback((index: number) => {
    setHLines(lines => lines.filter((_, i) => i !== index));
  }, []);

  const removeVLine = useCallback((index: number) => {
    setVLines(lines => lines.filter((_, i) => i !== index));
  }, []);

  // Lasso drawing
  const drawingStateRef = useRef<{ id: string; lastX: number; lastY: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (splitMode !== 'lasso') return;
    e.stopPropagation();
    e.preventDefault();

    const container = getDrawingContainer();
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const point = {
      x: no((e.clientX - rect.left) / rect.width, 0, 1), // TODO: implement no
      y: no((e.clientY - rect.top) / rect.height, 0, 1), // TODO: implement no
    };

    const snapped = co(point); // TODO: implement co
    setSnapEdge(snapped.edge || null);

    const shapeId = ao(); // TODO: implement ao
    setLassoShapes(shapes => [...shapes, {
      id: shapeId,
      points: [{ x: snapped.x, y: snapped.y }],
      closed: false,
    }]);
    setSelectedShapeId(shapeId);

    drawingStateRef.current = {
      id: shapeId,
      lastX: snapped.x,
      lastY: snapped.y,
    };
  }, [splitMode, getDrawingContainer]);

  // Lasso mouse move
  useEffect(() => {
    if (splitMode !== 'lasso') return;

    const handleMouseMove = (e: MouseEvent) => {
      const state = drawingStateRef.current;
      if (!state) return;

      const container = getDrawingContainer();
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = no((e.clientX - rect.left) / rect.width, 0, 1); // TODO: implement no
      const y = no((e.clientY - rect.top) / rect.height, 0, 1); // TODO: implement no

      const dx = x - state.lastX;
      const dy = y - state.lastY;

      if (dx * dx + dy * dy < 0.0006) return;

      state.lastX = x;
      state.lastY = y;

      setLassoShapes(shapes => shapes.map(shape => {
        if (shape.id !== state.id) return shape;
        return {
          ...shape,
          points: [...shape.points, { x, y }],
        };
      }));
    };

    const handleMouseUp = () => {
      const state = drawingStateRef.current;
      if (!state) return;

      drawingStateRef.current = null;
      const snapTo = snapEdge;
      setSnapEdge(null);

      setLassoShapes(shapes => shapes.map(shape => {
        if (shape.id !== state.id || shape.points.length < 3) return shape;

        const lastPoint = shape.points[shape.points.length - 1];
        const snapped = co(lastPoint); // TODO: implement co
        let points = shape.points.slice();

        if (snapped.edge) {
          points[points.length - 1] = { x: snapped.x, y: snapped.y };
        }

        if (snapTo && snapped.edge) {
          points = lo(points, snapTo, snapped.edge); // TODO: implement lo
        }

        return {
          ...shape,
          points,
          closed: true,
        };
      }).filter(shape => !(shape.id === state.id && shape.points.length < 3)));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [splitMode, snapEdge, getDrawingContainer]);

  const removeShape = useCallback((shapeId: string) => {
    setLassoShapes(shapes => shapes.filter(s => s.id !== shapeId));
    if (selectedShapeId === shapeId) {
      setSelectedShapeId(null);
    }
  }, [selectedShapeId]);

  const clearAllShapes = useCallback(() => {
    setLassoShapes([]);
    setSelectedShapeId(null);
  }, []);

  // Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Handle batch split
  const handleBatchSplit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!imageUrl) return;

    const options = {
      rows: displayRows,
      cols: displayCols,
      titlePattern,
      splitMode,
      hLines,
      vLines,
      sendToImageBox,
    };

    if ((splitMode === 'manual' || splitMode === 'lasso') && typeof nodeData.onSplitManual === 'function') {
      const images = (nodeData.extractedImages || []).filter((img): img is string => typeof img === 'string' && !!img);
      nodeData.onSplitManual(id, images, titlePattern, options);
      return;
    }

    if (typeof nodeData.onSplit === 'function') {
      nodeData.onSplit(id, imageUrl, displayRows, displayCols, titlePattern, options);
    }
  }, [nodeData, id, imageUrl, displayRows, displayCols, titlePattern, sendToImageBox, splitMode, hLines, vLines]);

  // Handle single cell split
  const handleCellSplit = useCallback((index: number) => {
    if (!imageUrl) return;

    const title = titlePattern.replace('{num}', (index + 1).toString());
    const options = {
      rows: displayRows,
      cols: displayCols,
      splitMode,
      sendToImageBox,
    };

    if ((splitMode === 'manual' || splitMode === 'lasso') && typeof nodeData.onSplitOneManual === 'function') {
      const image = (nodeData.extractedImages || [])[index];
      if (image) {
        nodeData.onSplitOneManual(id, image, index, title, options);
        return;
      }
    }

    if (typeof nodeData.onSplitOne === 'function') {
      nodeData.onSplitOne(id, imageUrl, displayRows, displayCols, index, title, options);
    }
  }, [nodeData, id, imageUrl, displayRows, displayCols, titlePattern, sendToImageBox, splitMode]);

  const handleGridSizeChange = (newRows: number, newCols: number) => {
    setRows(newRows);
    setCols(newCols);
  };

  const isGridSize = (r: number, c: number) => rows === r && cols === c;

  const resetLines = () => {
    setHLines([.5]);
    setVLines([.5]);
  };

  const lassoCenters = useMemo(() => {
    return lassoShapes
      .filter(s => s.closed && s.points.length >= 3)
      .map(s => {
        const pointCount = s.points.length;
        let cx = 0;
        let cy = 0;
        for (const p of s.points) {
          cx += p.x;
          cy += p.y;
        }
        return {
          id: s.id,
          cx: cx / pointCount,
          cy: cy / pointCount,
        };
      });
  }, [lassoShapes]);

  return (
    <div className="relative flex flex-col">
      {/* Header */}
      <div className="mb-1 flex items-center justify-between gap-2 w-[280px]">
        <NodeTitle
          id={id}
          data={data}
          defaultTitle="图像切分"
          icon={<Grid3x3 size={11} className="text-gray-500" />}
          className="!mb-0"
        />
        <div className="flex items-center gap-1 nodrag">
          <button
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${
              splitMode === 'grid'
                ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white'
            }`}
            onClick={() => setSplitMode('grid')}
            title="规则网格"
          >
            <Grid3x3 size={11} />
            {' '}规则
          </button>
          <button
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${
              splitMode === 'manual'
                ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white'
            }`}
            onClick={() => setSplitMode('manual')}
            title="手动网格 (拖动切割线)"
          >
            <GripVertical size={11} />
            {' '}手动
          </button>
          <button
            className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border transition-colors ${
              splitMode === 'lasso'
                ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white'
            }`}
            onClick={() => setSplitMode('lasso')}
            title="手动切刀 (任意形状 + 透明通道)"
          >
            <Scissors size={11} />
            {' '}切刀
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 w-[280px] ${
          selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'
        }`}
      >
        <CustomHandle type="target" position={Position.Left} variant="small" />
        <CustomHandle type="source" position={Position.Right} id="batch" variant="small" />

        <div className="p-3 space-y-3 relative z-10 bg-[#1c1c1c] rounded-xl">
          {imageUrl ? (
            <div className="relative w-full">
              <div className="relative w-full rounded bg-black/50 overflow-hidden shadow-inner">
                <img
                  src={imageUrl}
                  alt="Source"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto block opacity-80 select-none pointer-events-none"
                  draggable={false}
                />
                <div
                  ref={containerRef}
                  className="absolute inset-0 nodrag"
                  style={splitMode === 'lasso' ? { cursor: 'crosshair' } : undefined}
                  onDoubleClick={handleDoubleClick}
                  onMouseDown={handleMouseDown}
                  title={
                    splitMode === 'manual'
                      ? '双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除'
                      : splitMode === 'lasso'
                      ? '按住拖动绘制不规则形状，松开自动闭合；起/终点贴近边时自动吸附'
                      : ''
                  }
                >
                  {/* Grid cells */}
                  {splitMode !== 'lasso' &&
                    cells.map((cell, index) => (
                      <div
                        key={index}
                        className="absolute border border-white/20 hover:bg-blue-500/30 hover:border-blue-400 active:bg-blue-500/50 transition-all cursor-pointer rounded-[1px] group/cell"
                        style={{
                          left: `${cell.x * 100}%`,
                          top: `${cell.y * 100}%`,
                          width: `${cell.w * 100}%`,
                          height: `${cell.h * 100}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCellSplit(index);
                        }}
                        title={`点击切出: ${titlePattern.replace('{num}', (index + 1).toString())}`}
                      >
                        <span className="absolute top-0.5 left-0.5 text-[8px] text-white/90 bg-black/50 px-1 rounded-sm font-mono pointer-events-none scale-75 origin-top-left backdrop-blur-[1px]">
                          {index + 1}
                        </span>
                        {sourceConnections.has(index) && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <CheckCircle2 size={16} className="text-green-500 drop-shadow-md bg-black/30 rounded-full p-0.5" />
                          </div>
                        )}
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`cell-${index}`}
                          className="!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]"
                          style={{
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            right: 'auto',
                            minWidth: '6px',
                            minHeight: '6px',
                          }}
                        />
                      </div>
                    ))}

                  {/* Manual mode lines */}
                  {splitMode === 'manual' && (
                    <>
                      {hLines.map((line, index) => (
                        <div
                          key={`h-${index}`}
                          className="absolute left-0 right-0 cursor-row-resize z-[80]"
                          style={{ top: `calc(${line * 100}% - 5px)`, height: 10 }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingLine({ type: 'h', index });
                          }}
                          onClick={(e) => {
                            if (e.shiftKey) {
                              e.stopPropagation();
                              removeHLine(index);
                            }
                          }}
                          title="拖动调整位置 / Shift+点击删除"
                        >
                          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-blue-400/90 shadow-[0_0_4px_rgba(59,130,246,0.8)]" />
                        </div>
                      ))}
                      {vLines.map((line, index) => (
                        <div
                          key={`v-${index}`}
                          className="absolute top-0 bottom-0 cursor-col-resize z-[80]"
                          style={{ left: `calc(${line * 100}% - 5px)`, width: 10 }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingLine({ type: 'v', index });
                          }}
                          onClick={(e) => {
                            if (e.shiftKey) {
                              e.stopPropagation();
                              removeVLine(index);
                            }
                          }}
                          title="拖动调整位置 / Shift+点击删除"
                        >
                          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-blue-400/90 shadow-[0_0_4px_rgba(59,130,246,0.8)]" />
                        </div>
                      ))}
                    </>
                  )}

                  {/* Lasso mode SVG */}
                  {splitMode === 'lasso' && (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      {lassoShapes.map((shape) => {
                        if (shape.points.length < 2) return null;
                        const d =
                          shape.points
                            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`)
                            .join(' ') + (shape.closed ? ' Z' : '');
                        const isSelected = shape.id === selectedShapeId;
                        return (
                          <path
                            key={shape.id}
                            d={d}
                            fill={shape.closed ? (isSelected ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.18)') : 'none'}
                            stroke={isSelected ? '#60a5fa' : '#3b82f6'}
                            strokeWidth={0.4}
                            vectorEffect="non-scaling-stroke"
                          />
                        );
                      })}
                    </svg>
                  )}

                  {/* Lasso mode buttons */}
                  {splitMode === 'lasso' &&
                    lassoCenters.map((center, index) => (
                      <div
                        key={center.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group/cell"
                        style={{ left: `${center.cx * 100}%`, top: `${center.cy * 100}%` }}
                      >
                        <button
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono cursor-pointer border ${
                            selectedShapeId === center.id
                              ? 'bg-blue-500 text-white border-blue-300'
                              : 'bg-black/70 text-white border-white/30 hover:bg-blue-500/80'
                          }`}
                          onClick={(e) => {
                            if (e.shiftKey) {
                              e.stopPropagation();
                              removeShape(center.id);
                              return;
                            }
                            setSelectedShapeId(center.id);
                            handleCellSplit(index);
                          }}
                          title="点击切出 / Shift+点击删除"
                        >
                          <span>{index + 1}</span>
                          {sourceConnections.has(index) && <CheckCircle2 size={10} className="text-green-400" />}
                        </button>
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={`cell-${index}`}
                          className="!opacity-0 group-hover/cell:!opacity-100 !w-1.5 !h-1.5 !bg-blue-500 !border-[1px] !border-white !rounded-full transition-opacity cursor-crosshair z-[100]"
                          style={{
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            right: 'auto',
                            minWidth: '6px',
                            minHeight: '6px',
                          }}
                        />
                      </div>
                    ))}
                </div>
              </div>

              {splitMode === 'manual' && (
                <div className="mt-1 text-[10px] text-gray-500 leading-tight">
                  双击空白加水平线，Shift+双击加垂直线；拖动线移动；Shift+点击线删除。
                </div>
              )}
              {splitMode === 'lasso' && (
                <div className="mt-1 text-[10px] text-gray-500 leading-tight">
                  按住鼠标在图上画一圈即可生成一个透明形状，可以画多个；点击编号切出当前块，Shift+点击删除。
                </div>
              )}
            </div>
          ) : (
            <div className="h-24 flex flex-col items-center justify-center text-gray-600 bg-[#151515] rounded border border-dashed border-[#333]">
              <span className="text-xs">请连接图片</span>
            </div>
          )}

          {/* Controls */}
          <div className="space-y-2 nodrag">
            {/* Grid mode controls */}
            {splitMode === 'grid' && (
              <>
                <div className="flex flex-wrap items-center gap-1">
                  {/* TODO: use to array */}
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
                      onClick={() => handleGridSizeChange(preset.rows, preset.cols)}
                      title={`${preset.rows} 行 × ${preset.cols} 列`}
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
                    onClick={() => setShowCustomGrid((prev) => !prev)}
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
                      onChange={(e) => setRows(no(parseInt(e.target.value || '1', 10) || 1, 1, 20))} // TODO: implement no
                      className="w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none"
                    />
                    <span>×</span>
                    <span>列</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={cols}
                      onChange={(e) => setCols(no(parseInt(e.target.value || '1', 10) || 1, 1, 20))} // TODO: implement no
                      className="w-14 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none"
                    />
                  </div>
                )}
              </>
            )}

            {/* Manual mode controls */}
            {splitMode === 'manual' && (
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>
                  {displayRows} 行 × {displayCols} 列 = {cellCount} 块
                </span>
                <button
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]"
                  onClick={resetLines}
                  title="重置切割线"
                >
                  <RotateCcw size={11} />
                  {' '}重置
                </button>
              </div>
            )}

            {/* Lasso mode controls */}
            {splitMode === 'lasso' && (
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>已绘制 {cellCount} 块</span>
                <div className="flex items-center gap-1">
                  <button
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]"
                    onClick={() => setIsFullscreen(true)}
                    title="全屏聚焦切刀"
                  >
                    <Maximize2 size={11} />
                    {' '}全屏
                  </button>
                  <button
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-red-300 hover:border-red-400/60 disabled:opacity-50"
                    onClick={clearAllShapes}
                    disabled={lassoShapes.length === 0}
                    title="清空所有切刀"
                  >
                    <Trash2 size={11} />
                    {' '}清空
                  </button>
                </div>
              </div>
            )}

            {/* Title pattern input */}
            <div className="flex items-center gap-2">
              <input
                className="flex-1 bg-[#2a2a2a] text-gray-300 text-xs rounded px-2 py-1 border border-[#333] outline-none"
                placeholder="分图角标，{num} 引入数字编号，可留空"
                value={titlePattern}
                onChange={(e) => setTitlePattern(e.target.value)}
              />
            </div>

            {/* Image box checkbox and batch split button */}
            <div className="flex items-center gap-2">
              <label
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] border cursor-pointer transition-colors ${
                  sendToImageBox
                    ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                    : 'bg-[#2a2a2a] border-[#333] text-gray-400 hover:text-white hover:border-[#555]'
                }`}
                title="勾选后未连接图片盒子也会自动新建一个并送入；下游已连图片盒子时会直接送入"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={sendToImageBox}
                  onChange={(e) => setSendToImageBox(e.target.checked)}
                  className="accent-blue-500 sm:w-3 sm:h-3"
                />
                <ImageIcon size={12} />
                <span>图片盒子</span>
              </label>
              <div
                className={`flex-1 flex items-center justify-between bg-[#2a2a2a] rounded-full p-1 pl-3 border border-[#333] transition-colors cursor-pointer group/btn ${
                  imageUrl ? 'hover:border-gray-500' : 'opacity-50 cursor-not-allowed'
                }`}
                onClick={imageUrl ? handleBatchSplit : undefined}
              >
                <span className="text-xs text-gray-300 group-hover/btn:text-white">批量切分</span>
                <button className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                  <Play size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen lasso mode */}
      {splitMode === 'lasso' && isFullscreen && (
        // TODO: use Un.createPortal
        <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col nodrag nowheel">
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10">
            <div className="flex items-center gap-2 text-gray-200 text-sm">
              <Scissors size={16} className="text-blue-400" />
              <span>切刀（全屏聚焦）</span>
              <span className="text-xs text-gray-400 ml-2">
                已绘制 {cellCount} 块 · 起/终点贴近边时会自动吸附
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1 px-2 py-1 rounded border bg-[#2a2a2a] border-[#444] text-gray-200 hover:text-white hover:border-[#666] text-xs disabled:opacity-50"
                onClick={clearAllShapes}
                disabled={lassoShapes.length === 0}
              >
                <Trash2 size={13} />
                {' '}清空
              </button>
              <button
                className="flex items-center gap-1 px-2 py-1 rounded border bg-[#2a2a2a] border-[#444] text-gray-200 hover:text-white hover:border-[#666] text-xs"
                onClick={() => setIsFullscreen(false)}
                title="退出全屏 (Esc)"
              >
                <X size={13} />
                {' '}关闭
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="relative max-w-full max-h-full" style={{ aspectRatio: 'auto' }}>
              <img
                src={imageUrl}
                alt="Source"
                className="max-w-[90vw] max-h-[80vh] object-contain block select-none pointer-events-none"
                draggable={false}
              />
              <div
                ref={fullscreenRef}
                className="absolute inset-0"
                style={{ cursor: 'crosshair' }}
                onMouseDown={handleMouseDown}
              >
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {lassoShapes.map((shape) => {
                    if (shape.points.length < 2) return null;
                    const d =
                      shape.points
                        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 100} ${p.y * 100}`)
                        .join(' ') + (shape.closed ? ' Z' : '');
                    const isSelected = shape.id === selectedShapeId;
                    return (
                      <path
                        key={shape.id}
                        d={d}
                        fill={shape.closed ? (isSelected ? 'rgba(59,130,246,0.30)' : 'rgba(59,130,246,0.18)') : 'none'}
                        stroke={isSelected ? '#60a5fa' : '#3b82f6'}
                        strokeWidth={0.3}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>
                {lassoCenters.map((center, index) => (
                  <div
                    key={center.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${center.cx * 100}%`, top: `${center.cy * 100}%` }}
                  >
                    <button
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono cursor-pointer border ${
                        selectedShapeId === center.id
                          ? 'bg-blue-500 text-white border-blue-300'
                          : 'bg-black/70 text-white border-white/30 hover:bg-blue-500/80'
                      }`}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          e.stopPropagation();
                          removeShape(center.id);
                          return;
                        }
                        setSelectedShapeId(center.id);
                        handleCellSplit(index);
                      }}
                      title="点击切出 / Shift+点击删除"
                    >
                      <span>{index + 1}</span>
                      {sourceConnections.has(index) && <CheckCircle2 size={12} className="text-green-400" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="px-4 py-2 bg-black/60 border-t border-white/10 text-[11px] text-gray-300 leading-snug">
            按住鼠标在图上画一圈生成一个透明形状；起点或终点贴近图片边缘时会自动吸附到该边，并沿边自动闭合多边形（适合切人物 / 主体）。Shift +
            点击编号可删除形状。
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(GridSplitNode);