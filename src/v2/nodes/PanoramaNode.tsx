// ============================================================
// PanoramaNode - 720全景图节点
// 原版函数名: Yc (L19516-L20143)
// ============================================================
import { memo, useState, useRef, useEffect, useMemo, useCallback, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { NodeProps, Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import {
  Camera,
  Maximize2,
  X,
  Image,
  Grid2x2,
  Grid3x3,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';
import ResizeController from './ResizeController';

// ====== External dependency stubs ======

// TODO: implement yt - Three.js Canvas wrapper component
function PanoCanvas({
  children,
  resize,
  gl,
  dpr,
  style,
}: {
  children: React.ReactNode;
  resize?: { debounce: number };
  gl?: Record<string, unknown>;
  dpr?: number | [number, number];
  style?: React.CSSProperties;
}) {
  // TODO: implement
  return <div style={style}>{children}</div>;
}

// TODO: implement Jc - PanoramaViewer component (forwardRef with capture method)
const PanoViewer = memo(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  forwardRef(function PanoViewer(
    _props: {
      url: string;
      panoType: string;
      fov: number;
      highQuality: boolean;
      orbitControlsRefLocal: React.RefObject<unknown>;
    },
    ref: React.Ref<unknown>,
  ) {
    // TODO: implement
    return <div ref={ref} />;
  }),
);

// ====== PanoramaNode ======

function PanoramaNodeComponent({ id, data, selected }: NodeProps) {
  const { updateNodeData, getNode, setNodes } = useReactFlow();
  const [fov, setFov] = useState(75);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panoType, setPanoType] = useState((data as Record<string, unknown>).panoType as string || 'sphere');
  const nodeWidth = getNode(id)?.measured?.width;
  const nodeHeight = getNode(id)?.measured?.height;

  useEffect(() => {
    const timers = [10, 50, 150, 300].map(delay =>
      setTimeout(() => window.dispatchEvent(new Event('resize')), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [isFullscreen, selected, nodeWidth, nodeHeight]);

  const [highQuality, setHighQuality] = useState(
    (data as Record<string, unknown>).highQuality === undefined
      ? false
      : !!(data as Record<string, unknown>).highQuality,
  );
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState<string | null>(null);
  const orbitControlsRef = useRef(null);
  const panoViewerRef = useRef(null);
  const [aspectRatio, setAspectRatio] = useState(
    (data as Record<string, unknown>).aspectRatio as string || '16:9',
  );
  const [customRatio, setCustomRatio] = useState({ w: 16, h: 9 });
  const aspectRatioValue = aspectRatio === 'custom' ? `${customRatio.w}/${customRatio.h}` : aspectRatio.replace(':', '/');

  useEffect(() => {
    updateNodeData(id, { aspectRatio, highQuality });
  }, [aspectRatio, highQuality, id]);

  useEffect(() => {
    setNodes(nodes =>
      nodes.map(node => {
        if (node.id === id) {
          const w = node.measured?.width || node.width || 512;
          const expectedH = Math.round(w / (16 / 9));
          const currentH = (node.style as Record<string, unknown>)?.height || node.measured?.height || node.height || 288;
          if (Math.abs(currentH - expectedH) > 1) {
            return {
              ...node,
              style: {
                ...(node.style as Record<string, unknown>),
                width: w,
                height: expectedH,
              },
            };
          }
        }
        return node;
      }),
    );
  }, [id]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };
  const getCaptureLabel = (count: number) =>
    count >= 12 ? '正在截取12大视角…' : count >= 4 ? '正在截取四大视角…' : '正在截取当前视角…';
  const getCaptureMode = (count: number) =>
    count >= 12 ? 'twelve' : count >= 4 ? 'four' : 'current';

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    };
    return window.addEventListener('keydown', handler), () => {
      window.removeEventListener('keydown', handler);
    };
  }, [isFullscreen, (data as Record<string, unknown>).showToast]);

  const targetConnections = useHandleConnections({ type: 'target' });
  const sourceNodes = useMemo(
    () => targetConnections.map(conn => conn.source),
    [targetConnections],
  );

  const imageUrl = useMemo(() => {
    if (sourceNodes) {
      const found = (Array.isArray(sourceNodes) ? sourceNodes : [sourceNodes]).find((node: any) => {
        const url = node?.data?.imageUrl;
        return !!(
          url &&
          !url.startsWith('data:video/') &&
          !url.startsWith('data:audio/') &&
          !url.startsWith('data:text/')
        );
      });
      if (found) return (found as any).data.imageUrl;
    }
    return (data as Record<string, unknown>).imageUrl
      ? ((data as Record<string, unknown>).imageUrl as string)
      : null;
  }, [sourceNodes, (data as Record<string, unknown>).imageUrl]);

  const handleCapture = useCallback(
    async (angles: number[] = [0]) => {
      if (orbitControlsRef.current) {
        setCaptureMode(getCaptureMode(angles.length));
        showToast(getCaptureLabel(angles.length));
        setIsCapturing(true);
        if (!getNode(id)) {
          setIsCapturing(false);
          return;
        }
        try {
          const result = await (panoViewerRef.current as any)?.capture(angles, aspectRatioValue);
          if (result && result.length > 0) {
            if (angles.length === 1 && result[0]) {
              updateNodeData(id, { imageUrl: result[0] });
            }
            if (typeof (data as Record<string, unknown>).onCaptureToBox == 'function') {
              const items = result.map((url: string, idx: number) => ({
                url,
                label: `全景截图 ${angles[idx]}度`,
              }));
              ((data as Record<string, unknown>).onCaptureToBox as Function)(id, items);
            }
            if (typeof (data as Record<string, unknown>).showToast == 'function') {
              ((data as Record<string, unknown>).showToast as Function)('已截图并放入图片盒子');
            }
            showToast('截图已放入图片盒子');
          }
        } catch (err) {
          console.error('Screenshot failed', err);
          showToast('截图失败，请重试');
        } finally {
          setIsCapturing(false);
          setCaptureMode(null);
        }
      }
    },
    [id, updateNodeData, data, aspectRatioValue, getNode],
  );

  return (
    <>
      <div
        className={`flex flex-col items-center group/node transition-shadow duration-200 w-full h-full ${selected ? 'z-50' : 'z-10'}`}
      >
        <NodeTitle
          id={id}
          data={data as any}
          defaultTitle="720全景图"
          icon={<Camera size={11} className="text-gray-500" />}
        />
        <ResizeController visible={!!selected} minWidth={512} keepAspectRatio={true} />

        <CustomHandle type="target" position={Position.Left} />

        <div
          className={`relative w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-[border-color,box-shadow] duration-200 group/image flex-1 flex flex-col ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}`}
          id={`pano-container-${id}`}
          style={{
            width: '100%',
            height: '100%',
          }}
          onWheel={e => {
            e.stopPropagation();
            setFov(prev => {
              const next = prev + (e.deltaY > 0 ? 5 : -5);
              return Math.min(Math.max(next, 30), 120);
            });
          }}
        >
          {/* Drag handle */}
          <div className="absolute top-0 left-0 w-full h-8 z-20 flex items-start justify-center pt-2 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors opacity-0 group-hover/image:opacity-100">
            <div className="w-12 h-1.5 bg-white/20 rounded-full pointer-events-none" />
          </div>

          {imageUrl ? (
            <>
              {/* Pano Canvas */}
              <div className="absolute inset-0 cursor-move nowheel nodrag z-0 overflow-hidden bg-black">
                <PanoCanvas
                  resize={{ debounce: 0 }}
                  gl={{
                    preserveDrawingBuffer: true,
                    antialias: highQuality,
                    alpha: true,
                    powerPreference: 'high-performance',
                  }}
                  dpr={
                    highQuality
                      ? window.devicePixelRatio
                        ? Math.max(window.devicePixelRatio, 2)
                        : 2
                      : [1, 1.5]
                  }
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                  }}
                >
                  <PanoViewer
                    ref={panoViewerRef}
                    url={imageUrl}
                    panoType={panoType}
                    fov={fov}
                    highQuality={highQuality}
                    orbitControlsRefLocal={orbitControlsRef}
                  />
                </PanoCanvas>
              </div>

              {/* Capture buttons (left side) */}
              <div
                className={`absolute top-1/2 left-4 -translate-y-1/2 flex flex-col items-center gap-1 z-30 bg-black/60 p-1.5 rounded-xl backdrop-blur-md border border-white/10 shadow-lg nodrag transition-opacity duration-300 ${isCapturing ? 'opacity-100 pointer-events-none' : 'opacity-0 group-hover/image:opacity-100'}`}
                onClick={e => e.stopPropagation()}
              >
                <button
                  className={`p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 ${captureMode === 'current' ? 'text-white bg-white/10' : ''}`}
                  onClick={() => handleCapture([0])}
                  title="当前视角截图"
                >
                  <Camera size={16} className={captureMode === 'current' ? 'animate-spin' : ''} />
                </button>
                <button
                  className={`p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 ${captureMode === 'four' ? 'text-white bg-white/10' : ''}`}
                  onClick={() => handleCapture([90, 180, 270, 0])}
                  title="四大视角截图 (90, 180, 270, 0度)"
                >
                  <Grid2x2 size={16} className={captureMode === 'four' ? 'animate-spin' : ''} />
                </button>
                <button
                  className={`p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all active:scale-95 ${captureMode === 'twelve' ? 'text-white bg-white/10' : ''}`}
                  onClick={() => handleCapture([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330])}
                  title="12大视角截图 (每30度)"
                >
                  <Grid3x3 size={16} className={captureMode === 'twelve' ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Aspect ratio selector (top center) */}
              <div
                className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-1 nodrag shadow-lg max-w-[90%] overflow-hidden opacity-0 group-hover/image:opacity-100 transition-opacity duration-300"
                onClick={e => e.stopPropagation()}
              >
                <span className="text-[10px] text-gray-400 px-2 whitespace-nowrap shrink-0">
                  截图比例
                </span>
                <select
                  value={aspectRatio}
                  onChange={e => setAspectRatio(e.target.value)}
                  className="bg-transparent text-gray-200 text-[10px] pl-1 pr-4 py-0.5 outline-none cursor-pointer appearance-none text-center font-bold shrink-0"
                  style={{
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                  }}
                >
                  <option value="16:9" className="bg-[#222]">16:9</option>
                  <option value="9:16" className="bg-[#222]">9:16</option>
                  <option value="1:1" className="bg-[#222]">1:1</option>
                  <option value="custom" className="bg-[#222]">自定义</option>
                </select>
                {aspectRatio === 'custom' && (
                  <div className="flex items-center gap-1 ml-2 mr-2 border-l border-white/20 pl-2 shrink-0">
                    <input
                      type="number"
                      value={customRatio.w}
                      onChange={e => setCustomRatio(prev => ({ ...prev, w: Number(e.target.value) }))}
                      className="w-8 bg-transparent text-gray-200 text-[10px] outline-none text-center border-b border-transparent focus:border-white/50 min-w-[32px]"
                    />
                    <span className="text-gray-500">:</span>
                    <input
                      type="number"
                      value={customRatio.h}
                      onChange={e => setCustomRatio(prev => ({ ...prev, h: Number(e.target.value) }))}
                      className="w-8 bg-transparent text-gray-200 text-[10px] outline-none text-center border-b border-transparent focus:border-white/50 min-w-[32px]"
                    />
                  </div>
                )}
              </div>

              {/* Toast message */}
              {toastMessage && (
                <div className="absolute top-0 left-1/2 z-50 pointer-events-none nodrag flex items-center justify-center">
                  <div className="animate-[dropIn_2.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/30 px-6 py-3 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-2 mt-12">
                    <span className="text-white font-bold tracking-wider text-sm">
                      {toastMessage}
                    </span>
                  </div>
                </div>
              )}

              {/* Capturing overlay */}
              {isCapturing && (
                <div className="absolute inset-0 z-40 pointer-events-none nodrag flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                  <div className="bg-black/80 border border-white/20 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span className="text-white text-sm font-semibold">截图处理中…</span>
                  </div>
                </div>
              )}

              {/* Aspect ratio crop guide */}
              {!isCapturing && (
                <div
                  className="absolute inset-0 pointer-events-none z-[5]"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <div
                    className="border-[2px] border-dashed border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] transition-all duration-300"
                    style={{
                      aspectRatio: aspectRatioValue,
                      height: '100%',
                      maxHeight: '100%',
                      maxWidth: '100%',
                    }}
                  />
                </div>
              )}

              {/* Fullscreen button */}
              <button
                className="absolute top-6 right-4 p-2.5 bg-black/60 text-gray-300 hover:text-white hover:bg-white/20 rounded-lg backdrop-blur-md transition-all z-40 opacity-0 group-hover/image:opacity-100 border border-white/10 nodrag cursor-pointer shadow-lg duration-300"
                title="全屏漫游"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsFullscreen(true);
                }}
              >
                <Maximize2 size={18} />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-[#151515] transition-colors z-30 relative">
              <Image size={24} className="mb-2" />
              <span className="text-sm">等待输入全景图</span>
              <span className="text-xs mt-1 text-gray-500">请将图片节点连接到此节点</span>
            </div>
          )}
        </div>

        <CustomHandle type="source" position={Position.Right} />
      </div>

      {/* Settings panel (hidden by default) */}
      <div
        className="hidden absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 bg-[#1c1c1c] rounded-2xl border border-[#333] shadow-2xl w-[400px] flex-col nodrag cursor-default transition-all duration-300 z-50 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#222] bg-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Camera size={14} className="text-white" />
            <span className="text-gray-200 text-xs font-medium">
              {typeof (data as Record<string, unknown>).label == 'string' &&
              ((data as Record<string, unknown>).label as string).trim() !== ''
                ? ((data as Record<string, unknown>).label as string)
                : '720全景图'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-4 nodrag">
          {/* Canvas settings (hidden) */}
          <div className="flex flex-col gap-2 shrink-0 hidden">
            <span className="text-xs text-gray-500 font-medium">画布设置</span>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px] flex items-center justify-between gap-2 bg-[#222] p-2 rounded-lg border border-[#444] nodrag">
                <span className="text-[10px] text-gray-400 whitespace-nowrap">截图比例</span>
                <select
                  value={aspectRatio}
                  onChange={e => setAspectRatio(e.target.value)}
                  className="flex-1 min-w-0 bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none cursor-pointer focus:border-white/50"
                >
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                  <option value="1:1">1:1</option>
                  <option value="custom">自定义</option>
                </select>
                {aspectRatio === 'custom' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={customRatio.w}
                      onChange={e => setCustomRatio(prev => ({ ...prev, w: Number(e.target.value) }))}
                      className="w-8 bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none text-center focus:border-white/50"
                    />
                    <span className="text-gray-500">:</span>
                    <input
                      type="number"
                      value={customRatio.h}
                      onChange={e => setCustomRatio(prev => ({ ...prev, h: Number(e.target.value) }))}
                      className="w-8 bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none text-center focus:border-white/50"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Panorama settings */}
          <div className="flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">全景设置</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={highQuality}
                    onChange={e => setHighQuality(e.target.checked)}
                    className="w-3 h-3 rounded border-[#444] bg-[#111] accent-white"
                  />
                  <span
                    className="text-[10px] text-gray-400 select-none"
                    title="开启抗锯接、原画分辨率，可能会导致卡顿"
                  >
                    高画质
                  </span>
                </label>
                <select
                  value={panoType}
                  onChange={t => {
                    setPanoType(t.target.value);
                    updateNodeData(id, { panoType: t.target.value });
                  }}
                  className="ml-auto bg-[#111] text-gray-300 text-[10px] px-1 py-0.5 rounded border border-[#444] outline-none cursor-pointer"
                >
                  <option value="sphere">球状全景</option>
                  <option value="cylinder">柱状全景</option>
                </select>
              </div>
            </div>
          </div>

          {/* Capture button */}
          <div className="mt-auto pt-3">
            <button
              type="button"
              className="w-full py-2.5 bg-white hover:bg-gray-200 text-black text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all shrink-0 shadow-[0_0_20px_rgba(255,255,255,0.15)] transform hover:scale-[1.02]"
              onClick={() => handleCapture()}
            >
              <Camera size={16} /> 截图并生成节点
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen portal */}
      {isFullscreen &&
        imageUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Top right buttons */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <button
                className="bg-white hover:bg-gray-200 text-black px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all transform hover:scale-105"
                onClick={() => {
                  handleCapture();
                }}
              >
                <Camera size={18} />
                <span className="text-sm font-bold">截图</span>
              </button>
              <button
                className="bg-black/50 hover:bg-white/10 text-white p-2.5 rounded-lg backdrop-blur border border-white/10 transition-colors"
                onClick={() => setIsFullscreen(false)}
              >
                <X size={22} />
              </button>
            </div>

            {/* Top center aspect ratio selector */}
            <div
              className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-1 shadow-lg"
              onClick={e => e.stopPropagation()}
            >
              <span className="text-[12px] text-gray-400 px-3 whitespace-nowrap">截图比例</span>
              <select
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value)}
                className="bg-transparent text-gray-200 text-[12px] pl-2 pr-6 py-1 outline-none cursor-pointer appearance-none text-center font-bold"
                style={{
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                }}
              >
                <option value="16:9" className="bg-[#222]">16:9</option>
                <option value="9:16" className="bg-[#222]">9:16</option>
                <option value="1:1" className="bg-[#222]">1:1</option>
                <option value="custom" className="bg-[#222]">自定义</option>
              </select>
              {aspectRatio === 'custom' && (
                <div className="flex items-center gap-2 ml-3 mr-3 border-l border-white/20 pl-3">
                  <input
                    type="number"
                    value={customRatio.w}
                    onChange={e => setCustomRatio(prev => ({ ...prev, w: Number(e.target.value) }))}
                    className="w-10 bg-transparent text-gray-200 text-[12px] outline-none text-center border-b border-transparent focus:border-white/50"
                  />
                  <span className="text-gray-500">:</span>
                  <input
                    type="number"
                    value={customRatio.h}
                    onChange={e => setCustomRatio(prev => ({ ...prev, h: Number(e.target.value) }))}
                    className="w-10 bg-transparent text-gray-200 text-[12px] outline-none text-center border-b border-transparent focus:border-white/50"
                  />
                </div>
              )}
            </div>

            {/* Fullscreen pano viewer */}
            <div className="flex-1 w-full h-full flex items-center justify-center p-8">
              <div
                className="relative shadow-[0_0_50px_rgba(0,0,0,0.8)]"
                id={`pano-container-fullscreen-${id}`}
                style={{
                  aspectRatio: '16/9',
                  width: '100%',
                  maxHeight: 'calc(100vh - 6rem)',
                  maxWidth: 'calc((100vh - 6rem) * (16/9))',
                  margin: 'auto',
                }}
                onWheel={e => {
                  e.stopPropagation();
                  setFov(prev => {
                    const next = prev + (e.deltaY > 0 ? 5 : -5);
                    return Math.min(Math.max(next, 30), 120);
                  });
                }}
              >
                <PanoCanvas
                  resize={{ debounce: 0 }}
                  gl={{
                    preserveDrawingBuffer: true,
                    antialias: highQuality,
                    powerPreference: 'high-performance',
                  }}
                  dpr={
                    highQuality
                      ? window.devicePixelRatio
                        ? Math.max(window.devicePixelRatio, 2)
                        : 2
                      : [1, 1.5]
                  }
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <PanoViewer
                    url={imageUrl}
                    panoType={panoType}
                    fov={fov}
                    highQuality={highQuality}
                    orbitControlsRefLocal={orbitControlsRef}
                  />
                </PanoCanvas>

                {/* Fullscreen capture buttons */}
                <div
                  className={`absolute top-1/2 left-4 -translate-y-1/2 flex flex-col items-center gap-2 z-10 bg-black/60 p-2.5 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg nodrag ${isCapturing ? 'pointer-events-none' : ''}`}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    className={`p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 ${captureMode === 'current' ? 'text-white bg-white/10' : ''}`}
                    onClick={() => handleCapture([0])}
                    title="当前视角截图"
                  >
                    <Camera size={20} className={captureMode === 'current' ? 'animate-spin' : ''} />
                  </button>
                  <button
                    className={`p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 ${captureMode === 'four' ? 'text-white bg-white/10' : ''}`}
                    onClick={() => handleCapture([90, 180, 270, 0])}
                    title="四大视角截图 (90, 180, 270, 0度)"
                  >
                    <Grid2x2 size={20} className={captureMode === 'four' ? 'animate-spin' : ''} />
                  </button>
                  <button
                    className={`p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 ${captureMode === 'twelve' ? 'text-white bg-white/10' : ''}`}
                    onClick={() => handleCapture([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330])}
                    title="12大视角截图 (每30度)"
                  >
                    <Grid3x3 size={20} className={captureMode === 'twelve' ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* Fullscreen toast */}
                {toastMessage && (
                  <div className="absolute top-0 left-1/2 z-50 pointer-events-none nodrag flex items-center justify-center">
                    <div className="animate-[dropIn_2.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards] bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/30 px-8 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center gap-3 mt-16">
                      <span className="text-white font-bold text-xl tracking-wider">
                        {toastMessage}
                      </span>
                    </div>
                  </div>
                )}

                {/* Fullscreen capturing overlay */}
                {isCapturing && (
                  <div className="absolute inset-0 z-40 pointer-events-none nodrag flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                    <div className="bg-black/80 border border-white/20 rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span className="text-white text-base font-semibold">截图处理中…</span>
                    </div>
                  </div>
                )}

                {/* Fullscreen aspect ratio crop guide */}
                {!isCapturing && (
                  <div
                    className="absolute inset-0 pointer-events-none z-[5]"
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      className="border-[2px] border-dashed border-white/30 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all duration-300"
                      style={{
                        aspectRatio: aspectRatioValue,
                        height: '100%',
                        maxHeight: '100%',
                        maxWidth: '100%',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default memo(PanoramaNodeComponent);
