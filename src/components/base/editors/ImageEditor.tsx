import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Brush,
  Crop,
  Expand,
  Pencil,
  Eraser,
  Type,
  Minus,
  MoveUpRight,
  Square,
  Circle,
  ListOrdered,
  Pipette,
  Undo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  X,
  Check,
} from 'lucide-react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { logger } from '../core/logger.ts';
import { createRafBatch } from '../core/utils.ts';
import { compressImage } from '../utils/imageCompress.ts';
import { loadImageWithTimeout } from '../utils/asyncGuard.ts';
import '../core/toastStore.ts';

/**
 * 全屏图片编辑器（三 Tab 统一编辑台：涂鸦 / 裁剪 / 扩图）。
 *
 * 【架构：单一数据源 + 单向数据流】（112 号规格 §3 = 111 §3.6 的落地）
 *   - baseCvs 底图图层（off-screen canvas）＝ 原始图 / 已应用的裁剪或扩图结果
 *   - drawCvs 涂鸦图层（off-screen canvas）＝ 用户标注的唯一归宿
 *   - viewCvs 可见画布只是 base+draw 的「投影」，不承载状态、不反向驱动 state
 *   - 变更唯一路径：action → 改对应图层 → composite(画布)
 *
 * 【三条绝对红线】（违反即返工）
 *   - ❌ getImageData / putImageData 做画布变换或当数据源（仅吸管读 1px 例外，且必须 try/catch）
 *   - ❌ 就地改活画布尺寸（裁剪/扩图一律「新建游离 canvas + drawImage」）
 *   - ❌ 全画布像素快照撤销栈（撤销栈 = drawCvs 的 ImageBitmap 快照，上限 10，不存 dataURL）
 *
 * 【对外契约】onSave({ dataUrl, width, height }) → onClose（useImageHoverActions 零改动）
 * 【绘制源】初始化走 compressImage(url,{keepOriginalFormat:true}) 同源 dataURL → 画布永不被污染。
 * 【本次重做】112 号规格：三 Tab 合一；钢笔裁剪延后（入口置灰）；扩图补「原比例」默认；出图 PNG。
 */
interface ImageEditorProps {
  /** 要编辑的图片 URL（dataURL / http / blob / /files/） */
  imageUrl: string;
  /** 初始 Tab：'crop' / 'expand' 直接进对应 Tab，其余（含未知）回退涂鸦 */
  initialTool?: string;
  /** 保存回调（保存 = 导出 PNG 覆盖本节点），width/height 为最终画布真实像素 */
  onSave?: (payload: { dataUrl: string; width: number; height: number }) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/* ── 涂鸦 9 工具（与现行 1:1）── */
const DRAW_TOOLS = [
  'pencil',
  'eraser',
  'text',
  'line',
  'arrow',
  'square',
  'circle',
  'number',
  'eyedropper',
] as const;
type DrawTool = (typeof DRAW_TOOLS)[number];

const PRESET_COLORS = ['#ff3b30', '#facc15', '#22c55e', '#3b82f6', '#ffffff', '#000000'];
const LINE_WIDTH_MIN = 1;
const LINE_WIDTH_MAX = 20;

/* ── 裁剪比例（自由/原比例/常用画幅，与设计稿对齐，7 项）── */
const CROP_RATIOS = [
  { key: 'free', label: '自由' },
  { key: 'original', label: '原比例' },
  { key: '1:1', label: '1:1', value: 1 },
  { key: '16:9', label: '16:9', value: 16 / 9 },
  { key: '9:16', label: '9:16', value: 9 / 16 },
  { key: '4:3', label: '4:3', value: 4 / 3 },
  { key: '3:4', label: '3:4', value: 3 / 4 },
];

/* ── 扩图（复刻 AI-Canvas ExpandEditor 机制）──
 * factor ∈ [1, √2]（面积 = factor² 倍 → 最多 2 倍），与内部 zoom（=1/factor）语义相反 */
const OUTPAINT_FACTOR_MIN = 1;
const OUTPAINT_FACTOR_MAX = Math.SQRT2;
const OUTPAINT_FACTOR_STEP = 0.01;
const OUTPAINT_ZOOM_MIN = 1 / OUTPAINT_FACTOR_MAX;
const OUTPAINT_ZOOM_MAX = 1 / OUTPAINT_FACTOR_MIN;
/** 扩图白边填充色（纯白）。 */
export const OUTPAINT_FILL = '#ffffff';

/** 扩图目标比例（首项「原比例」为本期新增：只往外扩、不改画幅）。 */
export const OUTPAINT_RATIOS = [
  { key: 'original', label: '原比例', ratio: undefined as number | undefined },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 },
  { key: '3:4', label: '3:4', ratio: 3 / 4 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
  { key: '9:16', label: '9:16', ratio: 9 / 16 },
];

/**
 * 计算扩图目标画布（纯函数，可单测）。
 * @param srcW 原图自然宽 / @param srcH 原图自然高
 * @param ratio 目标画幅比例（宽/高）；undefined 则用原图比例（只外扩不改画幅）
 * @param zoom 外扩量（0.3~1，越小白边越多）；越界自动钳制
 * @returns 目标画布 tw×th、原图尺寸 sw×sh、原图可移动范围 maxOffX/maxOffY
 */
export function computeOutpaintTarget(
  srcW: number,
  srcH: number,
  ratio: number | undefined,
  zoom: number,
): { tw: number; th: number; sw: number; sh: number; maxOffX: number; maxOffY: number } {
  const sw = Math.max(1, Math.round(srcW));
  const sh = Math.max(1, Math.round(srcH));
  const srcRatio = sw / sh;
  const r = ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : srcRatio;
  let baseW: number;
  let baseH: number;
  if (r >= srcRatio) {
    baseH = sh;
    baseW = Math.round(sh * r);
  } else {
    baseW = sw;
    baseH = Math.round(sw / r);
  }
  const z = Math.max(OUTPAINT_ZOOM_MIN, Math.min(OUTPAINT_ZOOM_MAX, zoom));
  const tw = Math.round(baseW / z);
  const th = Math.round(baseH / z);
  return { tw, th, sw, sh, maxOffX: (tw - sw) / 2, maxOffY: (th - sh) / 2 };
}

/**
 * 由「归一化偏移 offset（[-0.5,0.5]）」计算原图在目标画布内的绘制起点（纯函数，可单测）。
 * offset=-0.5 → 贴左/贴上；+0.5 → 贴右/贴下；0 → 居中。
 */
export function computeOutpaintDrawPos(
  offset: { x: number; y: number },
  maxOffX: number,
  maxOffY: number,
): { dx: number; dy: number } {
  return {
    dx: Math.round(maxOffX + Math.max(-0.5, Math.min(0.5, offset.x)) * 2 * maxOffX),
    dy: Math.round(maxOffY + Math.max(-0.5, Math.min(0.5, offset.y)) * 2 * maxOffY),
  };
}

export default function ImageEditor({
  imageUrl,
  initialTool = 'pencil',
  onSave,
  onClose,
}: ImageEditorProps) {
  // ── 图层（单一数据源）──
  const baseCvsRef = useRef<HTMLCanvasElement | null>(null);
  const drawCvsRef = useRef<HTMLCanvasElement | null>(null);
  const viewCvsRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  // ── Tab 与工具 ──
  const [tab, setTab] = useState<'draw' | 'crop' | 'expand'>(
    initialTool === 'crop' ? 'crop' : initialTool === 'expand' ? 'expand' : 'draw',
  );
  const [tool, setTool] = useState<DrawTool>(
    (DRAW_TOOLS as readonly string[]).includes(initialTool) ? (initialTool as DrawTool) : 'pencil',
  );
  const [color, setColor] = useState('#ff3b30');
  const [lineWidth, setLineWidth] = useState(4);
  const [seq, setSeq] = useState(1);

  // ── editorDoc 派生状态 ──
  const [docSize, setDocSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [undoSteps, setUndoSteps] = useState(0);
  const [strokeCount, setStrokeCount] = useState(0);

  // ── 文字输入 ──
  const [textInput, setTextInput] = useState<{
    x: number;
    y: number;
    left: number;
    top: number;
    text: string;
  } | null>(null);

  // ── 裁剪态（ReactCrop，单位 %）──
  const [crop, setCrop] = useState<any>(undefined);
  const [cropRatioKey, setCropRatioKey] = useState('free');

  // ── 扩图态 ──
  const [outpaintRatioKey, setOutpaintRatioKey] = useState('original');
  const [outpaintFactor, setOutpaintFactor] = useState(1);
  const [outpaintOffset, setOutpaintOffset] = useState({ x: 0, y: 0 });

  // ── Tab 切换：切离「裁剪」即清空 crop 选区 ──
  // 否则 crop state 切走不清理，再切回时旧选区仍在（ReactCrop 也一直在 DOM 里 disabled，
  // 遮罩可能残留盖在其它 Tab 的画布上）。清空后由上方进入-crop 的 effect 自动重建默认选区。
  // 不放在 setTab updater 里调 setCrop（updater 须为纯函数，避免副作用在 StrictMode 双跑）。
  const switchTab = useCallback(
    (next: 'draw' | 'crop' | 'expand') => {
      if (next !== 'crop' && tab === 'crop') setCrop(undefined);
      setTab(next);
    },
    [tab],
  );

  // ── 撤销栈（drawCvs 的 ImageBitmap 快照，上限 10）──
  const drawSnapshotsRef = useRef<ImageBitmap[]>([]);
  const snapChainRef = useRef<Promise<void>>(Promise.resolve());

  const eraseUndoAll = useCallback(() => {
    drawSnapshotsRef.current.forEach((b) => {
      try {
        b.close?.();
      } catch {}
    });
    drawSnapshotsRef.current = [];
    setUndoSteps(0);
  }, []);

  const queueSnapshot = useCallback(() => {
    const cvs = drawCvsRef.current;
    if (!cvs || !cvs.width || !cvs.height) return;
    snapChainRef.current = snapChainRef.current.then(async () => {
      try {
        const bmp = await createImageBitmap(cvs);
        drawSnapshotsRef.current.push(bmp);
        if (drawSnapshotsRef.current.length > 10) {
          const dropped = drawSnapshotsRef.current.shift()!;
          try {
            dropped.close?.();
          } catch {}
        }
        setUndoSteps(drawSnapshotsRef.current.length);
      } catch {
        // 极端环境拿不到快照不阻断绘制
      }
    });
  }, []);

  // 合成：viewCvs = base + draw（画布是 editorDoc 的投影）
  const renderView = useCallback(() => {
    const v = viewCvsRef.current;
    const b = baseCvsRef.current;
    const d = drawCvsRef.current;
    if (!v) return;
    const ctx = v.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, v.width, v.height);
    if (b) ctx.drawImage(b, 0, 0);
    if (d) ctx.drawImage(d, 0, 0);
  }, []);

  const undo = useCallback(() => {
    const bmp = drawSnapshotsRef.current.pop();
    if (!bmp) return;
    const d = drawCvsRef.current;
    if (d) {
      const ctx = d.getContext('2d');
      ctx?.clearRect(0, 0, d.width, d.height);
      ctx?.drawImage(bmp, 0, 0);
    }
    try {
      bmp.close?.();
    } catch {}
    setUndoSteps(drawSnapshotsRef.current.length);
    renderView();
  }, [renderView]);

  // rAF 合帧渲染（112 §3 性能基线：拖拽高频不逐帧重绘）
  const compositeBatcherRef = useRef<(() => void) | null>(null);
  const scheduleComposite = useCallback(() => {
    if (compositeBatcherRef.current) {
      compositeBatcherRef.current();
      return;
    }
    const batcher = createRafBatch(() => {
      compositeBatcherRef.current = null;
      renderView();
    });
    compositeBatcherRef.current = () => batcher();
    batcher();
  }, [renderView]);

  // ── 视图缩放 ──
  const clampZoom = useCallback((z: number) => Math.min(8, Math.max(0.05, z)), []);
  const zoomIn = useCallback(() => setZoom((z) => clampZoom(z * 1.2)), [clampZoom]);
  const zoomOut = useCallback(() => setZoom((z) => clampZoom(z / 1.2)), [clampZoom]);
  const resetZoom = useCallback(() => setZoom(1), []);
  const fitAfterResize = useCallback(
    (w: number, h: number) => {
      const vp = viewportRef.current;
      if (!vp) {
        setZoom(1);
        return;
      }
      // ★ 画幅变化后必须重算缩放（109 §2.3：缺这步白边在视口外看不见、拖不动）
      setZoom(clampZoom(Math.min((vp.clientWidth - 32) / w, (vp.clientHeight - 32) / h, 1)));
    },
    [clampZoom],
  );

  // ── 初始化：同源 dataURL 铺底图 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { dataUrl } = await compressImage(imageUrl, { keepOriginalFormat: true });
        const im = await loadImageWithTimeout(dataUrl);
        if (cancelled) return;
        const w = im.naturalWidth;
        const h = im.naturalHeight;
        if (!w || !h) return;
        if (!baseCvsRef.current) baseCvsRef.current = document.createElement('canvas');
        const b = baseCvsRef.current;
        b.width = w;
        b.height = h;
        b.getContext('2d')?.drawImage(im, 0, 0);
        if (!drawCvsRef.current) drawCvsRef.current = document.createElement('canvas');
        const d = drawCvsRef.current;
        d.width = w;
        d.height = h;
        eraseUndoAll();
        setSeq(1);
        setStrokeCount(0);
        setDocSize({ w, h });
        fitAfterResize(w, h);
        renderView();
      } catch (err) {
        logger.warn('ImageEditor', '图片加载失败', (err as Error)?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // 文字输入框聚焦
  useEffect(() => {
    if (textInput && textInputRef.current) {
      const el = textInputRef.current;
      el.focus();
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {}
    }
  }, [textInput]);

  // 进入裁剪 Tab 且无选区 → 初始化默认 80% 选区
  useEffect(() => {
    if (tab !== 'crop' || crop || !docSize.w || !docSize.h) return;
    const { w, h } = docSize;
    const aspect = cropRatioKey === 'original' ? w / h : undefined;
    if (aspect) {
      setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 80 }, aspect, w, h), w, h));
    } else {
      setCrop(centerCrop({ unit: '%', width: 80, height: 80 }, w, h));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, crop, docSize]);

  // ── 滚轮缩放 ──
  const wheelBatcherRef = useRef<((arg: number) => void) | null>(null);
  if (!wheelBatcherRef.current) {
    wheelBatcherRef.current = createRafBatch((deltaY: number) =>
      setZoom((z) => clampZoom(z * (deltaY < 0 ? 1.1 : 0.9))),
    );
  }
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelBatcherRef.current?.(e.deltaY);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, []);

  // ── 空格平移 ──
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const scrollRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !textInput) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceDown(false);
        setPanning(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [textInput]);

  const onPanStart = useCallback((e: React.MouseEvent) => {
    const vp = viewportRef.current;
    if (!vp) return;
    e.preventDefault();
    setPanning(true);
    scrollRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: vp.scrollLeft,
      scrollTop: vp.scrollTop,
    };
  }, []);
  useEffect(() => {
    if (!panning) return;
    const batch = createRafBatch((clientX: number, clientY: number) => {
      const vp = viewportRef.current;
      if (vp) {
        vp.scrollLeft = scrollRef.current.scrollLeft - (clientX - scrollRef.current.x);
        vp.scrollTop = scrollRef.current.scrollTop - (clientY - scrollRef.current.y);
      }
    });
    const move = (e: MouseEvent) => batch(e.clientX, e.clientY);
    const up = () => {
      batch.flush();
      setPanning(false);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      batch.cancel();
    };
  }, [panning]);

  // 事件坐标 → viewCvs 自然像素坐标（内部像素 / 渲染盒比例）
  const toCanvasPos = useCallback((e: React.PointerEvent, el: HTMLCanvasElement) => {
    const rect = el.getBoundingClientRect();
    const cxp = 'touches' in e ? (e as any).touches[0].clientX : e.clientX;
    const cyp = 'touches' in e ? (e as any).touches[0].clientY : e.clientY;
    return {
      x: (cxp - rect.left) * (el.width / (rect.width || 1)),
      y: (cyp - rect.top) * (el.height / (rect.height || 1)),
    };
  }, []);

  // ── 涂鸦绘制 ──
  const drawingRef = useRef(false);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastMovePosRef = useRef<{ x: number; y: number } | null>(null);

  const commitText = useCallback(() => {
    if (!textInput) return;
    const text = (textInput.text || '').trim();
    if (!text) return;
    const d = drawCvsRef.current;
    if (d) {
      const ctx = d.getContext('2d');
      if (ctx) {
        queueSnapshot();
        ctx.fillStyle = color;
        // 输入框字体是屏幕 CSS px（未乘 zoom）；落盘画在 drawCvs 自然像素，须 /zoom 才能与原输入框同屏观感
        const fontSize = Math.max(20, lineWidth * 5) / (zoom > 0 ? zoom : 1);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(text, textInput.x, textInput.y + fontSize * 0.1);
        setStrokeCount((n) => n + 1);
        scheduleComposite();
      }
    }
    setTextInput(null);
  }, [textInput, color, lineWidth, queueSnapshot, scheduleComposite, zoom]);

  const onCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (tab !== 'draw') return;
      const v = viewCvsRef.current;
      if (!v) return;
      const { x, y } = toCanvasPos(e, v);
      if (tool === 'eyedropper') {
        const d = drawCvsRef.current;
        let px: Uint8ClampedArray | null = null;
        try {
          const source = d && d.width && d.height ? d : v;
          px =
            source.getContext('2d')?.getImageData(Math.round(x), Math.round(y), 1, 1)?.data ?? null;
        } catch {
          px = null;
        }
        if (px) {
          setColor(`#${`000000${((px[0] << 16) | (px[1] << 8) | px[2]).toString(16)}`.slice(-6)}`);
        }
        setTool('pencil');
        return;
      }
      if (tool === 'text') {
        e.preventDefault();
        if (textInput) {
          commitText();
          return;
        }
        const vp = viewportRef.current;
        const vpRect = vp?.getBoundingClientRect();
        const cxp = 'touches' in e ? (e as any).touches[0].clientX : e.clientX;
        const cyp = 'touches' in e ? (e as any).touches[0].clientY : e.clientY;
        setTextInput({
          x,
          y,
          left: vpRect ? cxp - vpRect.left + (vp.scrollLeft || 0) : cxp,
          top: vpRect ? cyp - vpRect.top + (vp.scrollTop || 0) : cyp,
          text: '',
        });
        return;
      }
      if (tool === 'number') {
        const d = drawCvsRef.current;
        if (d) {
          const ctx = d.getContext('2d');
          if (ctx) {
            queueSnapshot();
            ctx.beginPath();
            ctx.arc(x, y, Math.max(15, lineWidth * 3), 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${Math.max(16, lineWidth * 3)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(seq), x, y + 1);
            setSeq((s) => s + 1);
            setStrokeCount((n) => n + 1);
            scheduleComposite();
          }
        }
        return;
      }
      drawingRef.current = true;
      shapeStartRef.current = { x, y };
      lastMovePosRef.current = { x, y };
      queueSnapshot();
      const d = drawCvsRef.current;
      const ctx = d?.getContext('2d');
      if (ctx) {
        if (tool === 'pencil') {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        } else if (tool === 'eraser') {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, lineWidth * 3, 0, Math.PI * 2);
          ctx.clip();
          ctx.clearRect(0, 0, d.width, d.height);
          ctx.restore();
        }
      }
    },
    [
      tab,
      tool,
      toCanvasPos,
      textInput,
      commitText,
      color,
      lineWidth,
      seq,
      queueSnapshot,
      scheduleComposite,
    ],
  );

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawingRef.current || tab !== 'draw') return;
      const v = viewCvsRef.current;
      const d = drawCvsRef.current;
      if (!v || !d) return;
      const { x, y } = toCanvasPos(e, v);
      lastMovePosRef.current = { x, y };
      const ctx = d.getContext('2d');
      if (!ctx) return;
      if (tool === 'pencil') {
        ctx.lineTo(x, y);
        ctx.stroke();
        scheduleComposite();
      } else if (tool === 'eraser') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, lineWidth * 3, 0, Math.PI * 2);
        ctx.clip();
        ctx.clearRect(0, 0, d.width, d.height);
        ctx.restore();
        scheduleComposite();
      } else if (tool === 'line' || tool === 'arrow' || tool === 'square' || tool === 'circle') {
        // 形状实时预览画在 viewCvs（display 层），drawCvs 保持干净直到松手提交
        const start = shapeStartRef.current || { x, y };
        const vctx = v.getContext('2d');
        if (!vctx) return;
        renderView();
        vctx.beginPath();
        vctx.strokeStyle = color;
        vctx.lineWidth = lineWidth;
        vctx.lineCap = 'round';
        vctx.lineJoin = 'round';
        if (tool === 'square') vctx.rect(start.x, start.y, x - start.x, y - start.y);
        else if (tool === 'circle') {
          const r = Math.sqrt((x - start.x) ** 2 + (y - start.y) ** 2);
          vctx.arc(start.x, start.y, r, 0, Math.PI * 2);
        } else if (tool === 'line') {
          vctx.moveTo(start.x, start.y);
          vctx.lineTo(x, y);
        } else if (tool === 'arrow') {
          const head = Math.max(10, lineWidth * 3);
          const dx = x - start.x;
          const dy = y - start.y;
          const ang = Math.atan2(dy, dx);
          vctx.moveTo(start.x, start.y);
          vctx.lineTo(x, y);
          vctx.moveTo(x, y);
          vctx.lineTo(
            x - head * Math.cos(ang - Math.PI / 6),
            y - head * Math.sin(ang - Math.PI / 6),
          );
          vctx.moveTo(x, y);
          vctx.lineTo(
            x - head * Math.cos(ang + Math.PI / 6),
            y - head * Math.sin(ang + Math.PI / 6),
          );
        }
        vctx.stroke();
      }
    },
    [tab, tool, toCanvasPos, color, lineWidth, renderView, scheduleComposite],
  );

  const onCanvasPointerUp = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const d = drawCvsRef.current;
    const v = viewCvsRef.current;
    if (d && v && (tool === 'line' || tool === 'arrow' || tool === 'square' || tool === 'circle')) {
      const dctx = d.getContext('2d');
      const start = shapeStartRef.current;
      const end = lastMovePosRef.current || start;
      if (dctx && start && end) {
        dctx.beginPath();
        dctx.strokeStyle = color;
        dctx.lineWidth = lineWidth;
        dctx.lineCap = 'round';
        dctx.lineJoin = 'round';
        if (tool === 'square') dctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        else if (tool === 'circle') {
          const r = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
          dctx.arc(start.x, start.y, r, 0, Math.PI * 2);
        } else if (tool === 'line') {
          dctx.moveTo(start.x, start.y);
          dctx.lineTo(end.x, end.y);
        } else if (tool === 'arrow') {
          const head = Math.max(10, lineWidth * 3);
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const ang = Math.atan2(dy, dx);
          dctx.moveTo(start.x, start.y);
          dctx.lineTo(end.x, end.y);
          dctx.moveTo(end.x, end.y);
          dctx.lineTo(
            end.x - head * Math.cos(ang - Math.PI / 6),
            end.y - head * Math.sin(ang - Math.PI / 6),
          );
          dctx.moveTo(end.x, end.y);
          dctx.lineTo(
            end.x - head * Math.cos(ang + Math.PI / 6),
            end.y - head * Math.sin(ang + Math.PI / 6),
          );
        }
        dctx.stroke();
        setStrokeCount((n) => n + 1);
        shapeStartRef.current = null;
        lastMovePosRef.current = null;
        scheduleComposite();
        return;
      }
    }
    renderView();
  }, [tool, color, lineWidth, renderView, scheduleComposite]);

  // ── 清空涂鸦 ──
  const clearAll = useCallback(() => {
    const d = drawCvsRef.current;
    if (!d) return;
    queueSnapshot();
    d.getContext('2d')?.clearRect(0, 0, d.width, d.height);
    setSeq(1);
    scheduleComposite();
  }, [queueSnapshot, scheduleComposite]);

  // ── 裁剪比例切换 ──
  const selectCropRatio = useCallback(
    (key: string) => {
      setCropRatioKey(key);
      const item = CROP_RATIOS.find((r) => r.key === key);
      const { w, h } = docSize;
      if (!w || !h) return;
      const aspect = key === 'original' ? w / h : key === 'free' ? undefined : item?.value;
      if (aspect) {
        setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 80 }, aspect, w, h), w, h));
      } else {
        setCrop(centerCrop({ unit: '%', width: 80, height: 80 }, w, h));
      }
    },
    [docSize],
  );

  // 扩图画幅 → 显示缩放（扩图专用 fit；切画幅必须重算，否则白边在视口外看不见、拖不动）
  const fitOutpaint = useCallback(
    (tw: number, th: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      setZoom(clampZoom(Math.min((vp.clientWidth - 32) / tw, (vp.clientHeight - 32) / th, 1)));
    },
    [clampZoom],
  );

  // ── 扩图预览（仅视图层，不入撤销栈/不落盘；保存时经 buildFinalCanvas 出图）──
  const renderOutpaintPreview = useCallback(() => {
    const v = viewCvsRef.current;
    const b = baseCvsRef.current;
    if (!v || !b) return;
    const srcW = b.width;
    const srcH = b.height;
    if (!srcW || !srcH) return;
    const ratio = OUTPAINT_RATIOS.find((r) => r.key === outpaintRatioKey)?.ratio;
    const t = computeOutpaintTarget(srcW, srcH, ratio, 1 / outpaintFactor);
    const { dx, dy } = computeOutpaintDrawPos(outpaintOffset, t.maxOffX, t.maxOffY);
    const vctx = v.getContext('2d');
    if (!vctx) return;
    vctx.clearRect(0, 0, v.width, v.height);
    vctx.fillStyle = OUTPAINT_FILL;
    vctx.fillRect(0, 0, v.width, v.height);
    vctx.drawImage(b, dx, dy);
    // 涂鸦层与其底图同偏移叠加（与 buildFinalCanvas 导出一致，扩图预览才不"丢标注"）
    const d = drawCvsRef.current;
    if (d && d.width) vctx.drawImage(d, dx, dy);
  }, [outpaintRatioKey, outpaintFactor, outpaintOffset]);

  // → 画幅/外扩变化即重算缩放 + 重绘预览（★ 切画幅后必须 fit，否则白边在视口外看不见、拖不动）
  const updateOutpaintParams = useCallback(
    (ratioKey: string, factor: number) => {
      setOutpaintRatioKey(ratioKey);
      setOutpaintFactor(factor);
      setOutpaintOffset({ x: 0, y: 0 });
      const b = baseCvsRef.current;
      if (!b || !b.width || !b.height) return;
      const ratio = OUTPAINT_RATIOS.find((r) => r.key === ratioKey)?.ratio;
      const t = computeOutpaintTarget(b.width, b.height, ratio, 1 / factor);
      // 画幅一变立即重算显示缩放（109 §2.3）；预览由下方 [outpaintRatioKey,outpaintFactor] effect 落笔
      fitOutpaint(t.tw, t.th);
    },
    [fitOutpaint],
  );

  // 进入扩图 Tab / 底图就绪 → 按当前 Tab 统一渲染：扩图预览（目标画幅）+ fit，其余重合成
  useEffect(() => {
    if (tab === 'expand') {
      const b = baseCvsRef.current;
      if (!b || !b.width || !b.height) return;
      const ratio = OUTPAINT_RATIOS.find((r) => r.key === outpaintRatioKey)?.ratio;
      const t = computeOutpaintTarget(b.width, b.height, ratio, 1 / outpaintFactor);
      fitOutpaint(t.tw, t.th);
      renderOutpaintPreview();
    } else {
      renderView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, docSize]);

  // ── 扩图：拖原图定位（屏幕位移 → 归一化 offset [-0.5,0.5]，越界 clamp）──
  const expDragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(
    null,
  );
  const onOutpaintPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (tab !== 'expand') return;
      e.preventDefault();
      e.stopPropagation();
      expDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        ox: outpaintOffset.x,
        oy: outpaintOffset.y,
      };
    },
    [tab, outpaintOffset],
  );
  const onOutpaintPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = expDragRef.current;
      if (!drag || tab !== 'expand') return;
      const v = viewCvsRef.current;
      const b = baseCvsRef.current;
      if (!v || !b) return;
      const srcW = b.width;
      const srcH = b.height;
      if (!srcW || !srcH) return;
      const ratio = OUTPAINT_RATIOS.find((r) => r.key === outpaintRatioKey)?.ratio;
      const t = computeOutpaintTarget(srcW, srcH, ratio, 1 / outpaintFactor);
      const scale = v.width / (v.offsetWidth || 1);
      const dxNat = (e.clientX - drag.startX) * scale;
      const dyNat = (e.clientY - drag.startY) * scale;
      const nx = t.maxOffX > 0 ? drag.ox + dxNat / (2 * t.maxOffX) : 0;
      const ny = t.maxOffY > 0 ? drag.oy + dyNat / (2 * t.maxOffY) : 0;
      const next = { x: Math.max(-0.5, Math.min(0.5, nx)), y: Math.max(-0.5, Math.min(0.5, ny)) };
      setOutpaintOffset(next);
    },
    [tab, outpaintRatioKey, outpaintFactor],
  );
  const onOutpaintPointerUp = useCallback((e: React.PointerEvent) => {
    expDragRef.current = null;
    (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
  }, []);

  // 扩图画幅/外扩变化时重绘预览
  useEffect(() => {
    if (tab !== 'expand') return;
    renderOutpaintPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outpaintOffset, outpaintRatioKey, outpaintFactor, tab]);

  // ── 构建最终结果画布（按当前 Tab 语义：保存即应用）──
  // 统一「保存」按钮：涂鸦=底图+标注合成；裁剪=区间裁出；扩图=纯白底+原图内接。
  // 均「新建游离 canvas + drawImage」，不读像素、不就地改活画布尺寸（112 §3 红线）。
  const buildFinalCanvas = useCallback(() => {
    const b = baseCvsRef.current;
    const d = drawCvsRef.current;
    if (!b || !d || !b.width || !b.height) return null;
    if (tab === 'draw') {
      const out = document.createElement('canvas');
      out.width = b.width;
      out.height = b.height;
      const oc = out.getContext('2d');
      oc?.drawImage(b, 0, 0);
      oc?.drawImage(d, 0, 0);
      return out;
    }
    if (tab === 'crop') {
      // 用实时选区 crop（百分比）而非拖拽完成回调——未拖动过就直接保存时也要能取到选区
      const c = crop;
      const { w, h } = docSize;
      if (!c || !c.width || !c.height || !w || !h) return null;
      const sx = Math.max(0, Math.min(w, Math.round((c.x / 100) * w)));
      const sy = Math.max(0, Math.min(h, Math.round((c.y / 100) * h)));
      const sw = Math.max(1, Math.min(w - sx, Math.round((c.width / 100) * w)));
      const sh = Math.max(1, Math.min(h - sy, Math.round((c.height / 100) * h)));
      const src = document.createElement('canvas');
      src.width = w;
      src.height = h;
      const sc = src.getContext('2d');
      sc?.drawImage(b, 0, 0);
      sc?.drawImage(d, 0, 0);
      const out = document.createElement('canvas');
      out.width = sw;
      out.height = sh;
      out.getContext('2d')?.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
      return out;
    }
    // expand
    const srcW = b.width;
    const srcH = b.height;
    const ratio = OUTPAINT_RATIOS.find((r) => r.key === outpaintRatioKey)?.ratio;
    const t = computeOutpaintTarget(srcW, srcH, ratio, 1 / outpaintFactor);
    const { dx, dy } = computeOutpaintDrawPos(outpaintOffset, t.maxOffX, t.maxOffY);
    const comp = document.createElement('canvas');
    comp.width = srcW;
    comp.height = srcH;
    const cc = comp.getContext('2d');
    cc?.drawImage(b, 0, 0);
    cc?.drawImage(d, 0, 0);
    const out = document.createElement('canvas');
    out.width = t.tw;
    out.height = t.th;
    const oc = out.getContext('2d');
    if (oc) {
      oc.fillStyle = OUTPAINT_FILL;
      oc.fillRect(0, 0, t.tw, t.th);
      oc.drawImage(comp, dx, dy, t.sw, t.sh);
    }
    return out;
  }, [tab, crop, docSize, outpaintRatioKey, outpaintFactor, outpaintOffset]);

  // ── 保存：把当前 Tab 结果导成 PNG 覆盖本节点（唯一确认动作，无独立「应用」按钮）──
  const handleSave = useCallback(() => {
    const out = buildFinalCanvas();
    if (!out) return;
    onSave?.({
      dataUrl: out.toDataURL('image/png'),
      width: out.width,
      height: out.height,
    });
    onClose?.();
  }, [buildFinalCanvas, onSave, onClose]);

  // ── 工具按钮 ──
  const toolDef: { t: DrawTool; icon: React.ReactNode; title: string }[] = [
    { t: 'pencil', icon: <Pencil size={14} />, title: '画笔 (P)' },
    { t: 'eraser', icon: <Eraser size={14} />, title: '橡皮 (E)' },
    { t: 'text', icon: <Type size={14} />, title: '文字 (T)' },
    { t: 'line', icon: <Minus size={14} />, title: '直线' },
    { t: 'arrow', icon: <MoveUpRight size={14} />, title: '箭头' },
    { t: 'square', icon: <Square size={14} />, title: '方框' },
    { t: 'circle', icon: <Circle size={14} />, title: '圆框' },
    { t: 'number', icon: <ListOrdered size={14} />, title: '序号标记' },
    { t: 'eyedropper', icon: <Pipette size={14} />, title: '吸管取色' },
  ];

  const curAspect = cropRatioKey === 'original' ? docSize.w / docSize.h : undefined;

  // 画布内容尺寸：扩图 = 目标画幅（tw×th，四周留白要在画布内可见）；涂鸦/裁剪 = 底图尺寸
  const outpaintTarget =
    tab === 'expand' && baseCvsRef.current && baseCvsRef.current.width
      ? computeOutpaintTarget(
          baseCvsRef.current.width,
          baseCvsRef.current.height,
          OUTPAINT_RATIOS.find((r) => r.key === outpaintRatioKey)?.ratio,
          1 / outpaintFactor,
        )
      : null;
  const viewW = outpaintTarget ? outpaintTarget.tw : docSize.w;
  const viewH = outpaintTarget ? outpaintTarget.th : docSize.h;

  return createPortal(
    <div className="fixed inset-0 z-ceiling flex flex-col bg-canvas select-none">
      {/* ── Header：标题 + 三 Tab + 右侧动作 ── */}
      <div className="flex items-center justify-between px-3.5 h-[52px] shrink-0 bg-surface-raised border-b border-edge-muted">
        <div className="flex items-center gap-3">
          <span className="text-body-sm text-strong font-medium mr-1">图片编辑</span>
          <span className="text-caption text-faint">
            {docSize.w} × {docSize.h} · PNG
          </span>
          {/* 三 Tab（seg.tabs 同款） */}
          <div className="flex items-center gap-1 p-[3px] rounded-[9px] bg-input border border-edge-muted ml-3">
            <TabBtn
              active={tab === 'draw'}
              icon={<Brush size={12} />}
              label="涂鸦"
              onClick={() => switchTab('draw')}
            />
            <TabBtn
              active={tab === 'crop'}
              icon={<Crop size={12} />}
              label="裁剪"
              onClick={() => switchTab('crop')}
            />
            <TabBtn
              active={tab === 'expand'}
              icon={<Expand size={12} />}
              label="扩图"
              onClick={() => switchTab('expand')}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'draw' && (
            <>
              <IconBtn title="撤销 (⌘Z)" disabled={undoSteps === 0} onClick={undo}>
                <Undo2 size={15} />
              </IconBtn>
              <IconBtn title="清空涂鸦" onClick={clearAll}>
                <Trash2 size={15} />
              </IconBtn>
              <div className="w-px h-5 bg-surface-3 mx-1" />
            </>
          )}
          {tab === 'crop' && (
            <>
              <IconBtn title="重置选区" onClick={() => setCrop(undefined)}>
                <RotateCcw size={15} />
              </IconBtn>
              <div className="w-px h-5 bg-surface-3 mx-1" />
            </>
          )}
          {tab === 'expand' && (
            <>
              <IconBtn title="重置" onClick={() => updateOutpaintParams(outpaintRatioKey, 1)}>
                <RotateCcw size={15} />
              </IconBtn>
              <div className="w-px h-5 bg-surface-3 mx-1" />
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-[30px] px-3 rounded-lg text-body-xs text-body hover:text-white hover:bg-surface-hover transition-colors flex items-center gap-1"
          >
            <X size={14} /> 取消
          </button>
          {/* 单一「保存」＝应用当前 Tab 结果并写回（用户决策：无独立「应用裁剪/应用扩图」） */}
          <button
            type="button"
            onClick={handleSave}
            className="h-[30px] px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1 text-body-xs font-medium"
          >
            <Check size={14} /> 保存
          </button>
        </div>
      </div>

      {/* ── 上下文工具条（随 Tab 切换）── */}
      {tab === 'draw' && (
        <div className="flex items-center gap-2.5 h-[46px] shrink-0 px-3.5 bg-surface-deep border-b border-edge-faint">
          {/* 9 工具胶囊 */}
          <div className="flex items-center gap-0.5 p-[3px] rounded-full bg-surface-1 border border-edge-muted">
            {toolDef.map((d) => (
              <button
                key={d.t}
                type="button"
                title={d.title}
                onClick={() => setTool(d.t)}
                className={`w-[28px] h-[26px] rounded-full flex items-center justify-center transition-colors ${
                  tool === d.t
                    ? 'bg-blue-500 text-white'
                    : 'text-muted hover:bg-surface-hover hover:text-white'
                }`}
              >
                {d.icon}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-surface-3" />
          {/* 颜色预设 */}
          <div className="flex items-center gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-full border transition-shadow ${
                  color === c ? 'ring-2 ring-blue-500' : 'border-white/20'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-[22px] h-[22px] rounded-md border border-edge-strong p-0 cursor-pointer"
            title="自定义颜色"
          />
          <div className="w-px h-5 bg-surface-3" />
          <span className="text-caption-sm text-faint">粗细</span>
          <input
            type="range"
            min={LINE_WIDTH_MIN}
            max={LINE_WIDTH_MAX}
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            className="w-[96px] accent-blue-500"
          />
          <span className="text-caption-sm text-body tabular-nums">{lineWidth}px</span>
          <div className="flex-1" />
          <span className="text-caption-sm text-faint">空格 + 拖拽平移 · 滚轮缩放</span>
        </div>
      )}

      {tab === 'crop' && (
        <div className="flex items-center gap-2.5 h-[46px] shrink-0 px-3.5 bg-surface-deep border-b border-edge-faint">
          <span className="text-caption-sm text-faint">模式</span>
          <div className="flex items-center gap-[3px]">
            <ModeBtn active label="矩形" />
            <button
              type="button"
              disabled
              title="钢笔裁剪（本期延后）"
              className="h-6 px-2 rounded-md text-caption-sm bg-surface-hover/60 border border-edge-muted text-faint/60 cursor-not-allowed"
            >
              钢笔
            </button>
          </div>
          <div className="w-px h-5 bg-surface-3" />
          <span className="text-caption-sm text-faint">比例</span>
          <div className="flex items-center gap-[3px]">
            {CROP_RATIOS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => selectCropRatio(r.key)}
                className={`h-6 px-2 rounded-md text-caption-sm transition-colors border ${
                  cropRatioKey === r.key
                    ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                    : 'bg-surface-hover border-edge-muted text-secondary hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-surface-3" />
          <span className="text-caption-sm text-faint">选区</span>
          {curCropSizeLabel(crop, docSize)}
          <div className="flex-1" />
          <span className="text-caption-sm text-faint">拖动边角调整 · 拖动选区移动</span>
        </div>
      )}

      {tab === 'expand' && (
        <div className="flex items-center gap-2.5 h-[46px] shrink-0 px-3.5 bg-surface-deep border-b border-edge-faint">
          <span className="text-caption-sm text-faint">画幅</span>
          <div className="flex items-center gap-[3px]">
            {OUTPAINT_RATIOS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => updateOutpaintParams(r.key, outpaintFactor)}
                className={`h-6 px-2 rounded-md text-caption-sm transition-colors border ${
                  outpaintRatioKey === r.key
                    ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                    : 'bg-surface-hover border-edge-muted text-secondary hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-surface-3" />
          <span className="text-caption-sm text-faint">外扩</span>
          <input
            type="range"
            min={OUTPAINT_FACTOR_MIN}
            max={OUTPAINT_FACTOR_MAX}
            step={OUTPAINT_FACTOR_STEP}
            value={outpaintFactor}
            onChange={(e) => updateOutpaintParams(outpaintRatioKey, parseFloat(e.target.value))}
            className="w-[150px] accent-blue-500"
          />
          <span className="text-caption-sm text-body tabular-nums">
            +{Math.round((outpaintFactor * outpaintFactor - 1) * 100)}%
          </span>
          <div className="w-px h-5 bg-surface-3" />
          <span className="text-caption-sm text-faint">填充</span>
          <span className="h-6 px-2 rounded-md text-caption-sm bg-white text-black border border-edge">
            白
          </span>
          <div className="flex-1" />
          <span className="text-caption-sm text-faint">拖动原图定位 · 面积最多 2 倍</span>
        </div>
      )}

      {/* ── 画布区（nodrag，避免拖笔误拖节点）──
          画布工作区背景 = 透明棋盘（逐项对齐旧 mockup image-editor-tabs-mockup.html 的 .checker：
          底透出 bg-black，格 #171717），而非纯黑平铺。 */}
      <div
        ref={viewportRef}
        onMouseDown={spaceDown ? onPanStart : undefined}
        className="flex-1 overflow-auto bg-black nodrag"
        style={{
          cursor: spaceDown ? (panning ? 'grabbing' : 'grab') : undefined,
          backgroundImage:
            'linear-gradient(45deg,#171717 25%,transparent 25%,transparent 75%,#171717 75%),linear-gradient(45deg,#171717 25%,transparent 25%,transparent 75%,#171717 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 8px 8px',
        }}
      >
        <div className="min-w-full min-h-full flex items-center justify-center p-4 w-fit">
          <ReactCrop
            crop={crop}
            onChange={(_, pc) => setCrop(pc)}
            aspect={curAspect}
            ruleOfThirds
            disabled={tab !== 'crop'}
            style={{ display: 'block' }}
          >
            <canvas
              ref={viewCvsRef}
              width={viewW}
              height={viewH}
              onPointerDown={
                tab === 'draw'
                  ? onCanvasPointerDown
                  : tab === 'expand'
                    ? onOutpaintPointerDown
                    : undefined
              }
              onPointerMove={
                tab === 'draw'
                  ? onCanvasPointerMove
                  : tab === 'expand'
                    ? onOutpaintPointerMove
                    : undefined
              }
              onPointerUp={
                tab === 'draw'
                  ? onCanvasPointerUp
                  : tab === 'expand'
                    ? onOutpaintPointerUp
                    : undefined
              }
              className={`shadow-2xl nodrag ${
                tab === 'expand' ? 'cursor-move' : tab === 'draw' ? 'cursor-crosshair' : ''
              }`}
              style={{
                touchAction: 'none',
                width: viewW ? `${viewW * zoom}px` : undefined,
                height: viewH ? `${viewH * zoom}px` : undefined,
                pointerEvents: spaceDown ? 'none' : undefined,
              }}
            />
          </ReactCrop>
        </div>

        {/* 文字输入浮层 */}
        {textInput && (
          <input
            ref={textInputRef}
            type="text"
            value={textInput.text}
            onChange={(e) => setTextInput((t) => (t ? { ...t, text: e.target.value } : t))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText();
              else if (e.key === 'Escape') {
                e.stopPropagation();
                setTextInput(null);
              }
            }}
            onBlur={commitText}
            placeholder="输入文字..."
            className="absolute nodrag z-modal-raise rounded-sm border border-blue-500 bg-black/65"
            style={{
              left: textInput.left,
              top: textInput.top,
              color,
              fontSize: `${Math.max(20, lineWidth * 5)}px`,
              fontWeight: 'bold',
              outline: 'none',
              padding: '1px 3px',
              margin: 0,
              minWidth: '40px',
              lineHeight: 1,
              caretColor: color,
            }}
          />
        )}

        {/* 左下缩放浮层 */}
        <div className="absolute left-3 bottom-3 flex items-center gap-0.5 px-[3px] py-[3px] rounded-full bg-surface-raised/95 border border-edge backdrop-blur-md">
          <ZoomBtn title="缩小" onClick={zoomOut}>
            <ZoomOut size={14} />
          </ZoomBtn>
          <button
            type="button"
            onClick={resetZoom}
            className="px-2 text-caption-sm text-primary tabular-nums min-w-[44px] text-center hover:text-white"
            title="重置为 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ZoomBtn title="放大" onClick={zoomIn}>
            <ZoomIn size={14} />
          </ZoomBtn>
          <ZoomBtn title="适应窗口" onClick={() => fitAfterResize(viewW, viewH)}>
            <Maximize size={14} />
          </ZoomBtn>
        </div>
      </div>

      {/* ── 底部状态条 ── */}
      {tab === 'draw' && (
        <StatusBar>
          <span>画幅</span>
          <b>
            {docSize.w} × {docSize.h}
          </b>
          <span>·</span>
          <span>缩放</span>
          <b>{Math.round(zoom * 100)}%</b>
          <span>·</span>
          <span>涂鸦层</span>
          <b className="text-green-400">{strokeCount} 笔</b>
          <span>·</span>
          <span>源</span>
          <b>同源 dataURL（画布无污染）</b>
          <div className="ml-auto">
            <span>保存 = 覆盖本节点</span>
          </div>
        </StatusBar>
      )}
      {tab === 'crop' && (
        <StatusBar>
          <span>原图</span>
          <b>
            {docSize.w} × {docSize.h}
          </b>
          <span>·</span>
          <span>裁剪后</span>
          <b>{curCropSizeLabelOnly(crop, docSize)}</b>
          <span>·</span>
          <span>缩放</span>
          <b>{Math.round(zoom * 100)}%</b>
          <div className="ml-auto">
            <span>应用后回到涂鸦 Tab，结果成为新底图</span>
          </div>
        </StatusBar>
      )}
      {tab === 'expand' && (
        <ExpandStatusBar docSize={docSize} ratioKey={outpaintRatioKey} factor={outpaintFactor} />
      )}
    </div>,
    document.body,
  );
}

/* ── 小组件 ── */
function TabBtn({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-caption-sm transition-colors border ${
        active
          ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
          : 'border-transparent text-secondary hover:bg-surface-hover hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({
  title,
  disabled,
  danger,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors border border-transparent ${
        disabled
          ? 'text-faint/50 cursor-not-allowed'
          : danger
            ? 'text-muted hover:text-red-400 hover:bg-surface-hover'
            : 'text-muted hover:text-white hover:bg-surface-hover'
      }`}
    >
      {children}
    </button>
  );
}

function ModeBtn({ active, label }: { active?: boolean; label: string }) {
  return (
    <button
      type="button"
      className={`h-6 px-2 rounded-md text-caption-sm transition-colors border ${
        active
          ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
          : 'bg-surface-hover border-edge-muted text-secondary hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function ZoomBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-6 h-[22px] rounded-full flex items-center justify-center text-muted hover:text-white hover:bg-surface-hover"
    >
      {children}
    </button>
  );
}

function StatusBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 h-[34px] shrink-0 px-3.5 border-t border-edge-faint bg-surface-deep text-caption-sm text-faint">
      {children}
    </div>
  );
}

/* 裁剪选区尺寸标签（自然像素） */
function curCropSizeLabel(
  c: { x: number; y: number; width: number; height: number } | undefined,
  size: { w: number; h: number },
) {
  if (!c || !c.width || !c.height || !size.w || !size.h) {
    return <span className="text-caption-sm text-body tabular-nums">—</span>;
  }
  const w = Math.round((c.width / 100) * size.w);
  const h = Math.round((c.height / 100) * size.h);
  return (
    <span className="text-caption-sm text-body tabular-nums">
      {w} × {h}
    </span>
  );
}

function curCropSizeLabelOnly(
  c: { x: number; y: number; width: number; height: number } | undefined,
  size: { w: number; h: number },
) {
  if (!c || !c.width || !c.height || !size.w || !size.h) return <b>—</b>;
  return (
    <b>
      {Math.round((c.width / 100) * size.w)} × {Math.round((c.height / 100) * size.h)}
    </b>
  );
}

/* 扩图状态条 */
function ExpandStatusBar({
  docSize,
  ratioKey,
  factor,
}: {
  docSize: { w: number; h: number };
  ratioKey: string;
  factor: number;
}) {
  return (
    <div className="flex items-center gap-3.5 h-[34px] shrink-0 px-3.5 border-t border-edge-faint bg-surface-deep text-caption-sm text-faint">
      <span>原图</span>
      <b>
        {docSize.w} × {docSize.h}
      </b>
      <span>·</span>
      <span>扩图后</span>
      <b>{expandGoalLabel(docSize, ratioKey, factor)}</b>
      <span>·</span>
      <span>面积</span>
      <b>+{Math.round((factor * factor - 1) * 100)}%</b>
      <span>·</span>
      <span>填充</span>
      <b>纯白 #FFFFFF</b>
      <div className="ml-auto">
        <span>只输出一张图 · 是否送 AI 补全由用户决定</span>
      </div>
    </div>
  );
}

function expandGoalLabel(size: { w: number; h: number }, ratioKey: string, factor: number) {
  const ratio = OUTPAINT_RATIOS.find((r) => r.key === ratioKey)?.ratio;
  const t = computeOutpaintTarget(size.w, size.h, ratio, 1 / factor);
  return (
    <>
      {t.tw} × {t.th}
    </>
  );
}
