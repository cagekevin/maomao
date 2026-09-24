import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, Eraser, MousePointerClick, Loader2 } from 'lucide-react';
import FullscreenShell from '@/components/base/panels/FullscreenShell.tsx';
import { loadImageOrNull } from '@/components/base/utils/net/asyncGuard.ts';
import { canvasToImageDataUrl } from '@/components/base/core/utils.ts';
import { logger } from '@/components/base/core/log/logger.ts';
import { toastError } from '@/components/base/core/event/toastStore.ts';
import {
  MATTING_DEBOUNCE_MS,
  createMattingSession,
  displayToImageCoords,
  type MattingPoint,
  type MattingSession,
} from '../lib/matting/index.ts';

/**
 * AI 抠图 · 全屏编辑器（对齐 ImageEditor / FaceMosaicEditor 形态）。
 *
 * 上传/传入图片 → 左键点物体（正提示点）· 右键点背景（负提示点）
 * → encoder 编码一次（缓存）→ 每次点选跑 decoder → 出透明 PNG。
 *
 * 【分层】模型与推理全在 `image/lib/matting/`（能力片门面）；本组件只做 UI 与画布交互。
 * 本文件**不碰** ORT / 模型路径 / 预处理 / 三段时序（都经门面 import）—— 满足 `ADR-0042` 深模块形态。
 *
 * 【门面是用例编排，不是转发】本组件只说两件事：
 *   ① `createMattingSession(src)` —— 打开时建会话（装载 + 编码，各一次）
 *   ② `session.cutout(points)`    —— 每次点选（复用已编码 embedding）
 * **不需要知道**有两段 ONNX、先编码再推理、坐标怎么换算、阈值是多少 —— 那些都在能力片内。
 *
 * 【数据 0 副本】（`架构师写新业务代码.md` §1.1）本组件所有 `useState` 都是**纯 UI 状态**：
 * 点、运行态、中间 mask —— 删掉它们别处不会失忆（不落盘、无他人关心）。
 * 判据问句：「这个 state 删掉，别处会失忆吗？」→ 不会 ⇒ `useState` 合法。
 * **产物**经 `onSave` 交宿主写回（唯一真源在节点 `data`）。
 *
 * 【失败可见】能力片返回判别联合（`MattingResult`）；本组件**必须处理 `ok:false`**
 * —— 状态条显示生产者给的 `message`（**原样转发，不重编话术**），并 toast。
 * 非渲染期异常（推理是 async 回调）走状态条 + logger，**不指望 ErrorBoundary**。
 *
 * 【生命周期 / 取消】（`架构师写新业务代码.md` Step 3.4）
 *  - 卸载时置 `cancelledRef` ⇒ 晚到的推理结果**不写已卸载组件**；
 *  - 卸载时 `disposeMatting()`（G3 释放）；
 *  - 推理中锁输入（`running`）⇒ 同一时刻只有一次推理（**本仓无通用锁原语**，
 *    以"编辑器是唯一调用方 + UI 锁"论证，见 plan/148 §4.2.4）。
 *
 * 【COOP/COEP】ort.env.wasm.numThreads 固定为 1（能力片内设置）：全仓未开
 * cross-origin isolation ⇒ 无 SharedArrayBuffer。代价是推理变慢，**有意为之**。
 */

interface MattingEditorProps {
  /** 要抠的图片 URL（dataURL / http / blob / /files/） */
  assetUrl?: string;
  /** 保存回调（透明 PNG）。尺寸与原图一致 —— 仍传 width/height 以对齐 ImageEditor 契约 */
  onSave?: (payload: { dataUrl: string; width: number; height: number }) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/** 已落下的提示点（**原图像素坐标**；正/负点由 `kind` 表达） */
type PromptPoint = MattingPoint;

export default function MattingEditor({ assetUrl, onSave, onClose }: MattingEditorProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const baseCvsRef = useRef<HTMLCanvasElement | null>(null); // 底图（原图尺寸）
  const maskCvsRef = useRef<HTMLCanvasElement | null>(null); // mask 叠加（显示尺寸）
  const dotCvsRef = useRef<HTMLCanvasElement | null>(null); // 点标记（显示尺寸）
  const sessionRef = useRef<MattingSession | null>(null);
  const cancelledRef = useRef(false);

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [displayScale, setDisplayScale] = useState(1);
  const [status, setStatus] = useState('正在加载模型…');
  const [busy, setBusy] = useState(false);
  const [points, setPoints] = useState<PromptPoint[]>([]);
  const [elapsed, setElapsed] = useState<string>('--');
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 图片装载 + 模型装载（一次）──
  useEffect(() => {
    cancelledRef.current = false;
    (async () => {
      if (!assetUrl) return;
      const img = await loadImageOrNull(assetUrl);
      if (cancelledRef.current) return;
      if (!img) {
        setStatus('图片加载失败');
        toastError('抠图：图片加载失败');
        return;
      }
      imgRef.current = img;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) {
        setStatus('图片尺寸非法');
        return;
      }
      // 底图（原图尺寸）—— 抠图产物与原图同尺寸
      const base = baseCvsRef.current ?? document.createElement('canvas');
      baseCvsRef.current = base;
      base.width = w;
      base.height = h;
      base.getContext('2d')?.drawImage(img, 0, 0);

      // 点标记层用原图尺寸（与底图同坐标系，避免二次换算）
      for (const cv of [maskCvsRef.current, dotCvsRef.current]) {
        if (cv) {
          cv.width = w;
          cv.height = h;
        }
      }
      setDims({ w, h });

      // 建会话（G2：打开编辑器才装载+编码；门面内部编排三段时序）
      setStatus('正在加载模型（约 45 MB，首次较慢）…');
      const created = await createMattingSession(extractSource(img, w, h));
      if (cancelledRef.current) return;
      if (!created.ok) {
        // 生产者的 message 原样转发，不重编话术
        setStatus(created.message);
        toastError(created.message);
        return;
      }
      sessionRef.current = created.data;
      setStatus('就绪 · 左键点物体 · 右键点背景');
    })();

    return () => {
      // G3 释放 + 取消在途结果
      cancelledRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetUrl]);

  // ── 显示缩放：适配容器 ──
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const fitToContainer = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !dims.w || !dims.h) return;
    const s = Math.min((el.clientWidth - 32) / dims.w, (el.clientHeight - 32) / dims.h, 1);
    setDisplayScale(s > 0 ? s : 1);
  }, [dims.w, dims.h]);
  useEffect(() => {
    fitToContainer();
    window.addEventListener('resize', fitToContainer);
    return () => window.removeEventListener('resize', fitToContainer);
  }, [fitToContainer]);

  // ── 点标记重绘 ──
  const redrawDots = useCallback(
    (list: readonly PromptPoint[]) => {
      const cv = dotCvsRef.current;
      const ctx = cv?.getContext('2d');
      if (!cv || !ctx) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of list) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7 / displayScale, 0, Math.PI * 2);
        ctx.fillStyle = p.kind === 'fg' ? '#22c55e' : '#ef4444';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / displayScale, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    },
    [displayScale],
  );

  // ── 推理：交给会话，拿 alpha → 紫叠加 + 透明抠图 ──
  const runPredict = useCallback(
    async (list: readonly PromptPoint[]) => {
      const session = sessionRef.current;
      if (!session || list.length === 0) return;

      setBusy(true);
      setStatus('推理中…');
      const t0 = performance.now();
      // 门面只收「原图坐标点」，换算/时序/阈值都在能力片内
      const pred = await session.cutout(list);
      if (cancelledRef.current) return;
      setBusy(false);

      if (!pred.ok) {
        setStatus(pred.message);
        toastError(pred.message);
        return;
      }

      const alpha = pred.data;

      // mask 叠加（紫色半透明）
      const mcv = maskCvsRef.current;
      const mctx = mcv?.getContext('2d');
      if (mcv && mctx) {
        const overlay = mctx.createImageData(dims.w, dims.h);
        for (let i = 0, j = 0; i < alpha.length; i += 1, j += 4) {
          overlay.data[j] = 139;
          overlay.data[j + 1] = 92;
          overlay.data[j + 2] = 246;
          overlay.data[j + 3] = alpha[i] ? 140 : 0;
        }
        mctx.putImageData(overlay, 0, 0);
      }

      // 透明抠图（原图 RGB + alpha）—— 唯一出口 canvasToImageDataUrl
      const base = baseCvsRef.current;
      const bctx = base?.getContext('2d', { willReadFrequently: true });
      if (base && bctx) {
        const out = bctx.getImageData(0, 0, dims.w, dims.h);
        for (let i = 0, j = 3; i < alpha.length; i += 1, j += 4) {
          out.data[j] = alpha[i];
        }
        const tmp = document.createElement('canvas');
        tmp.width = dims.w;
        tmp.height = dims.h;
        tmp.getContext('2d')?.putImageData(out, 0, 0);
        setCutoutUrl(canvasToImageDataUrl(tmp, 'image/png'));
      }

      setElapsed(`${((performance.now() - t0) / 1000).toFixed(2)}s`);
      setStatus(`✓ ${list.length} 个点 → mask 完成`);
    },
    [dims.w, dims.h],
  );

  // ── 点选：左键正点 / 右键负点 ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!sessionRef.current) return;
      if (busy) {
        setStatus('推理中，请稍候…');
        return;
      }
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      // 右键 = 负点（背景），其余 = 正点（物体内部）
      const kind: MattingPoint['kind'] = e.button === 2 ? 'bg' : 'fg';
      // 显示坐标 → 原图坐标（门面提供的交互用纯函数）
      const p = displayToImageCoords(
        { x: e.clientX - rect.left, y: e.clientY - rect.top },
        displayScale,
      );
      const next: PromptPoint[] = [...points, { x: p.x, y: p.y, kind }];
      setPoints(next);
      redrawDots(next);
      // 防抖批量送推理（照抄演示页既有行为）
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void runPredict(next), MATTING_DEBOUNCE_MS);
    },
    [busy, points, displayScale, redrawDots, runPredict],
  );

  const handleClear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPoints([]);
    const cv = dotCvsRef.current;
    cv?.getContext('2d')?.clearRect(0, 0, cv.width, cv.height);
    const mcv = maskCvsRef.current;
    mcv?.getContext('2d')?.clearRect(0, 0, mcv.width, mcv.height);
    setCutoutUrl(null);
    setElapsed('--');
    setStatus('已清除 · 左键点物体 · 右键点背景');
  }, []);

  const handleSave = useCallback(() => {
    if (!cutoutUrl || !dims.w || !dims.h) {
      toastError('抠图：还没有可保存的结果');
      return;
    }
    onSave?.({ dataUrl: cutoutUrl, width: dims.w, height: dims.h });
    onClose?.();
  }, [cutoutUrl, dims.w, dims.h, onSave, onClose]);

  const viewW = dims.w * displayScale;
  const viewH = dims.h * displayScale;

  return (
    <FullscreenShell
      open
      onClose={onClose}
      keyMap={{ 'mod+z': handleClear }}
      className="fixed inset-0 z-ceiling flex flex-col bg-canvas select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 h-[52px] shrink-0 bg-surface-raised border-b border-edge-muted">
        <div className="flex items-center gap-3">
          <span className="text-body-sm text-strong font-medium mr-1">AI 抠图</span>
          <span className="text-caption text-faint">
            {dims.w} × {dims.h} · PNG 透明
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClear}
            disabled={points.length === 0}
            className="h-[30px] px-3 rounded-lg text-body-xs text-body hover:text-white hover:bg-surface-hover transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Eraser size={14} /> 清除点
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[30px] px-3 rounded-lg text-body-xs text-body hover:text-white hover:bg-surface-hover transition-colors flex items-center gap-1"
          >
            <X size={14} /> 取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!cutoutUrl}
            className="h-[30px] px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1 text-body-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={14} /> 保存抠图
          </button>
        </div>
      </div>

      {/* 提示条 */}
      <div className="flex items-center gap-2.5 h-[46px] shrink-0 px-3.5 bg-surface-deep border-b border-edge-faint">
        <MousePointerClick size={14} className="text-muted" />
        <span className="text-caption-sm text-body">
          <b className="text-green-400">左键</b> 点物体内部（正点） ·
          <b className="text-red-400"> 右键</b> 点背景（负点）
        </span>
        <div className="flex-1" />
        {/* 只显示**用户可感知**的事实：点数（他点的）· 耗时（他等的）。
            ❌ 不显示「输入 1024px」—— 那是模型内部参数，用户看不懂也用不上。 */}
        <span className="text-caption-sm text-faint tabular-nums">
          点数 {points.length} · 耗时 {elapsed}
        </span>
      </div>

      {/* 画布区 */}
      <div ref={wrapRef} className="flex-1 overflow-auto bg-black nodrag">
        <div className="min-w-full min-h-full flex items-center justify-center p-4 w-fit">
          <div
            className="relative shadow-2xl cursor-crosshair"
            style={{ width: viewW || undefined, height: viewH || undefined }}
            onPointerDown={handlePointerDown}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* 三层严格对齐：外层 div 的宽高已是 `原图 × displayScale`（**精确等比**），
                故三层一律 `inset-0 w-full h-full` **铺满**，不加 `object-contain`
                （若加，letterbox 只影响 <img>、不影响 canvas ⇒ 三层错位，
                 且点选坐标基准（外层 div）与实际图形不再重合）。 */}
            <img
              src={assetUrl}
              alt="待抠图"
              draggable={false}
              className="absolute inset-0 w-full h-full"
            />
            <canvas
              ref={maskCvsRef}
              className="absolute inset-0 w-full h-full pointer-events-none opacity-70"
            />
            <canvas
              ref={dotCvsRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* 状态条 */}
      <div className="flex items-center gap-3.5 h-[34px] shrink-0 px-3.5 border-t border-edge-faint bg-surface-deep text-caption-sm text-faint">
        {busy && <Loader2 size={12} className="animate-spin text-blue-400" />}
        <span className="truncate">{status}</span>
        <div className="ml-auto shrink-0">
          <span>保存 = 覆盖本节点</span>
        </div>
      </div>
    </FullscreenShell>
  );
}

/** 从 Image 取出 RGBA 像素（**只做取像素，不做预处理** —— 缩放/归一化在能力片内）。 */
function extractSource(img: HTMLImageElement, w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx?.drawImage(img, 0, 0);
  const data = ctx?.getImageData(0, 0, w, h).data ?? new Uint8ClampedArray(0);
  logger.debug('AI抠图', '源图像素已取出', { w, h, bytes: data.length });
  return { data, width: w, height: h };
}
