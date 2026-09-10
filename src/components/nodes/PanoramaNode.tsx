import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useReactFlow } from '@xyflow/react';
import {
  Globe,
  X,
  Camera,
  Scan,
  Grid3X3,
  CircleDot,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  Move3D,
} from 'lucide-react';
import NodeShell from '../base/ui/NodeShell.tsx';
import HoverToolbar from '../base/panels/HoverToolbar.tsx';
import { useConnectedInputs } from '../../hooks/useConnectedInputs.ts';
import PanoViewer from '../base/editors/PanoViewer.tsx';
import { generateId } from '../base/core/idGen.ts';
import { buildSpawnNodes, spawnAndCommit } from '../base/canvas/deriveNodes.ts';
import { useCanvasEdges } from '../base/canvas/CanvasEdgesContext.tsx';
import { useRenderImageResolver } from '../base/utils/imageUrl.ts';
import { logger } from '../base/core/logger.ts';
import { toastInfo, toastSuccess, toastError, toastWarning } from '../base/core/toastStore.ts';
import FullscreenShell from '../base/panels/FullscreenShell.tsx';

/**
 * 720 全景图节点（复刻官方 Zl.jsx / panoramaNode）。
 *
 * 交互逻辑（对齐用户预期 + 官方）：
 *  - 主显示区：显示【完整的等距全景图】（2:1 完整图，像普通图片完整显示），
 *    用户导入后能看到整张全景，而不是球心的局部视野。
 *  - 全屏漫游：进入球体视图，从球心用 OrbitControls 旋转查看 360° 全景。
 *  - 截图：在全屏球体里选视角，输出该视角的局部截图（当前 / 四大 / 12大视角）→ spawn assetNode。
 *
 * 需 React 19 + @react-three/fiber@9 + @react-three/drei@10 + three。
 *
 * 更新(2026-09-09) 全景图 bug 审计修复（对照注释语义逐项对齐）：
 *  - 主图 object-contain：2:1 全景在 16:9 节点内完整显示（原 object-cover 裁掉左右首尾相接区域）。
 *  - 球体贴图：走大尺寸按需出图端点（maxDim 4096，非本地回原图）+ PanoViewer 内部 URL 归一化
 *    （治相对 /files/ 黑屏 与 全分辨率大图卡顿）。
 *  - 漫游加载/错误态：R3F Canvas 挂起抛 promise → 外层 Suspense 显示「全景加载中…」；
 *    纹理失败抛 error → 外层 SphereErrorBoundary 显示占位（不再黑屏）。
 *  - 滚轮缩放 fov：球心相机 OrbitControls zoom 无效（distance=0），缩放只能走 fov；
 *    手动非 passive wheel 监听（R3F 对 wheel 默认 passive，React onWheel 无法 preventDefault）。
 *  - 截图比例（aspectRatio/customDim）落盘 data（刷新不重置）。
 *  - doCapture 并发守卫（capturingRef）：capturing 期间忽略再次触发，避免共享 gl 互相污染。
 *  - 依赖数组补 history/getNode；PanoViewer.capture 内部 try/finally 保证异常也恢复渲染目标。
 *
 * 更新(2026-09-10) 按钮交互反馈修复（治「点了没反应/logger 无输出」）：
 *  - 提示统一走全局 toastStore（toastInfo/toastSuccess/toastError/toastWarning）：
 *    原实现自绘局部 toast 只在节点主区渲染，被全屏 createPortal 层盖住 → 全屏下截图反馈不可见。
 *    全局 ToastContainer 挂 z-ceiling（2147483647）远高于全屏 z-modal（9999），全屏下依然可见，
 *    且是项目唯一 toast 入口（对齐 GridSplitNode 等既有用法），不重复造轮子。
 *  - doCapture 加 logger 埋点（截图开始/完成/失败，console 输出 + 上报后端），点击即有日志可查。
 *  - viewerRef 未就绪（纹理加载中/失败，PanoViewer 未挂载）时点击不再静默 return——
 *    toastWarning 明确提示「全景加载中，请稍候再试」。
 *  - 完成提示 toastSuccess「截图完成，已存入图片盒子」，明确结果去向（下游图片盒子/自动新建）。
 *
 * 更新(2026-09-10) 奥卡姆剃刀精简（砍冗余实体，只保留核心价值链）：
 *  - 删除浏览器原生全屏（isNativeFs / toggleNativeFullscreen / fullscreenchange）：漫游层本身即全屏。
 *  - 删除柱状模式（panoType 'cylinder'）：720 全景事实标准为等距柱状，柱状几何/限位/角标一并移除。
 *  - 删除视角 HUD（罗盘 + yaw/pitch 数字）：连带 PanoViewer 的 onViewChange 上报链路。
 *  - 删除 orbitRef / highQuality 纯转发 plumbing（唯一调用点本就写死 false）。
 */

const RATIO_OPTIONS = ['16:9', '9:16', '1:1', 'custom'];
/** 12 大视角（每 30°） */
const ANGLES_12 = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
/** 四大视角 */
const ANGLES_4 = [90, 180, 270, 0];

/** 玻璃拟态图标按钮（全屏漫游层统一控件，避免各处手写 hover/禁用态）。 */
function IconButton({
  icon,
  title,
  onClick,
  active = false,
  disabled = false,
  danger = false,
}: {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      className={`grid place-items-center w-8 h-8 rounded-xl transition-all active:scale-90 cursor-pointer border-none
        ${
          active
            ? 'bg-white/20 text-white'
            : danger
              ? 'text-white/60 hover:bg-red-500/25 hover:text-red-200'
              : 'text-white/60 hover:bg-white/10 hover:text-white'
        }
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
      {icon}
    </button>
  );
}

/** 带文字的胶囊按钮（截图/自动漫游等需要语义明确的操作）。 */
function TextButton({
  icon,
  label,
  title,
  onClick,
  active = false,
  loading = false,
  disabled = false,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  onClick?: () => void;
  active?: boolean;
  loading?: boolean;
  disabled?: boolean;
  tone?: 'default' | 'sky';
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      className={`flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-caption-sm whitespace-nowrap transition-all active:scale-95 cursor-pointer border-none
        ${
          active
            ? tone === 'sky'
              ? 'bg-sky-400/25 text-sky-100'
              : 'bg-white/20 text-white'
            : 'text-white/65 hover:bg-white/10 hover:text-white'
        }
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  );
}

/** 分段选择器（球/柱、截图比例；替代原生 <select>，视觉与项目其它分段控件一致）。 */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center p-0.5 rounded-xl bg-white/5 border border-white/5 nodrag">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(o.value);
          }}
          className={`h-6 px-2 rounded-lg text-caption-sm whitespace-nowrap transition-all active:scale-95 cursor-pointer border-none
            ${
              value === o.value
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-white/55 hover:bg-white/10 hover:text-white/90'
            }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface PanoramaNodeData {
  label?: string;
  imageUrl?: string;
  aspectRatio?: string;
  customDim?: { w: number; h: number };
  images?: Array<{ url?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}
interface PanoramaNodeProps {
  id: string;
  data: PanoramaNodeData;
  selected?: boolean;
}
/** PanoViewer 暴露的命令式句柄（ref）。 */
interface PanoViewerHandle {
  capture: (angles: number[], ratio: string) => Promise<string[]>;
  reset: () => void;
}

/** 球体全景错误边界：纹理加载失败（404 / CORS）时给出可见占位，而不是黑屏。
 *  原理：R3F Canvas 内部错误会经 CanvasImpl throw 传播到外层 React 树（见 R3F CanvasImpl `if (error) throw error`）。 */
class SphereErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[Pano] 全景球体渲染失败', error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#0b0b0d] text-red-400/80">
          <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 grid place-items-center">
            <Globe size={20} className="text-red-400/70" />
          </div>
          <span className="text-body-sm font-medium">全景加载失败</span>
          <span className="text-caption text-red-400/50">图片可能已失效或跨域不可访问</span>
        </div>
      );
    }
    return this.props.children;
  }
}

/** 双环 spinner：底环是轨道，顶环是进度指示（比单边框圈更有"正在构建"的质感）。 */
function Spinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-2 border-white/12" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sky-400 animate-spin" />
    </div>
  );
}

/** 球体全景加载遮罩（R3F Canvas 挂起时经外层 Suspense fallback 显示）。 */
function SphereLoadingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0b0b0d]">
      <Spinner size={30} />
      <span className="text-caption-sm text-white/60">全景纹理加载中…</span>
      <span className="text-2xs text-white/30">首次进入需解码高分辨率贴图</span>
    </div>
  );
}

function PanoramaNode({ id, data, selected }: PanoramaNodeProps) {
  const { setNodes, getNodes, getNode, getEdges, setEdges } = useReactFlow();
  // 标题改名 → 写回 data.label，让下游 @名 匹配 / 素材条显示跟随
  const rename = useCallback(
    (name: string) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: name } } : n)),
      );
    },
    [id, setNodes],
  );
  const history = useCanvasEdges();
  const connected = useConnectedInputs(id);
  const thumbResolve = useRenderImageResolver();
  const [fullscreen, setFullscreen] = useState(false); // 全景漫游（球体视图）
  const [capturing, setCapturing] = useState(false);
  const [shotKind, setShotKind] = useState(null); // 'current'|'four'|'twelve'
  const [imgError, setImgError] = useState(false); // 【R2 治理】主全景图加载失败占位（TASK-018#4 静默）
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || '16:9');
  const [customDim, setCustomDim] = useState(
    data.customDim && typeof data.customDim.w === 'number' ? data.customDim : { w: 16, h: 9 },
  );
  const [autoRotate, setAutoRotate] = useState(false); // 自动漫游（绕 Y 轴缓慢自转）
  const [showFrame, setShowFrame] = useState(true); // 取景框（截图构图参考，可关）
  const [showHint, setShowHint] = useState(true); // 首次进入的操作引导（3.5s 后淡出）
  // 【滚轮缩放】球心相机 OrbitControls zoom 无效（相机与 target 距离为 0），缩放只能走 fov。
  const [fov, setFov] = useState(75);
  const viewerRef = useRef<PanoViewerHandle | null>(null);
  const sphereBoxRef = useRef<HTMLDivElement | null>(null);
  const capturingRef = useRef(false); // 【并发守卫】capturing 是异步 state，闭包里可能过期，用 ref 同步

  const ratioStr =
    aspectRatio === 'custom' ? `${customDim.w}/${customDim.h}` : aspectRatio.replace(':', '/');

  // 输入全景图 URL：连接上游图片 或 data.imageUrl
  const panoUrl = (() => {
    const src = connected.images?.find((im) => im?.url)?.url;
    if (src) return src;
    return data.imageUrl || null;
  })();

  // 球体贴图专用地址：本地文件走大尺寸按需出图（4096 上限），非本地（data:/blob:/公网）回原图。
  // 与主图 thumbResolve（默认 640）不同——球体内表面需要更高分辨率才不糊；
  // 但仍优于直接加载全分辨率原图（全景图常 8192 宽，显存/解码压力大）。
  const sphereTextureUrl = panoUrl ? thumbResolve(panoUrl, { maxDim: 4096 }) : '';

  // 节点 data 写回（不可变更新：P0-B 红线，禁止原地 mutation，否则下游窄订阅静默不更新）
  const patchData = useCallback(
    (patch: Record<string, unknown>) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [id, setNodes],
  );

  // 【R2 治理】panoUrl 变化时重置图片错误态（换图后可重试加载）
  const prevPanoRef = useRef(panoUrl);
  useEffect(() => {
    if (prevPanoRef.current !== panoUrl) {
      prevPanoRef.current = panoUrl;
      setImgError(false);
    }
  }, [panoUrl]);

  // 【滚轮缩放】全屏漫游中滚轮调整视野（fov 放大/缩小）。
  // 为什么手动 addEventListener：R3F 对 wheel 事件默认 passive，React 的 onWheel 无法 preventDefault
  // 页面滚动；非 passive 原生监听才能既拦截滚动又调 fov。OrbitControls enableZoom=false 时不消费 wheel。
  useEffect(() => {
    const el = sphereBoxRef.current;
    if (!fullscreen || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setFov((f) => Math.min(120, Math.max(30, f + (e.deltaY > 0 ? 3 : -3))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [fullscreen]);

  // 进入漫游：锁页面滚动 + 展示操作引导（3.5s 后淡出）+ 重置自动漫游。
  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setShowHint(true);
    setAutoRotate(false);
    const t = window.setTimeout(() => setShowHint(false), 3500);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [fullscreen]);

  // 截图（复刻官方 F：在全屏球体里选视角裁切输出局部）
  const doCapture = useCallback(
    async (angles: number[] = [0]) => {
      // 【并发守卫】capturing 期间忽略再次触发，避免两个 capture 共享同一 gl 互相污染
      if (capturingRef.current) return;
      // 【可见反馈】全景未就绪（纹理加载中/失败，PanoViewer 未挂载，viewerRef 为 null）时
      // 不静默——明确提示用户原因，而不是"点了没反应"
      if (!viewerRef.current) {
        toastWarning('全景加载中，请稍候再试');
        return;
      }
      capturingRef.current = true;
      const kind = angles.length >= 12 ? 'twelve' : angles.length >= 4 ? 'four' : 'current';
      setShotKind(kind);
      logger.info('panoNode', '截图开始', { kind, count: angles.length, ratio: ratioStr });
      toastInfo(
        kind === 'twelve'
          ? '正在截取12大视角…'
          : kind === 'four'
            ? '正在截取四大视角…'
            : '正在截取当前视角…',
      );
      setCapturing(true);
      try {
        const shots = await viewerRef.current.capture(angles, ratioStr);
        if (shots && shots.length > 0) {
          if (angles.length === 1 && shots[0]) {
            setNodes((ns) =>
              ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, imageUrl: shots[0] } } : n)),
            );
          }
          // 输出到图片盒子（对齐官方 onCaptureToBox / H_.jsx xr）：
          //  1) 有连接到本节点的 imageBoxNode 下游 → 把截图追加到该图片盒子的 images
          //  2) 没有 → 新建 imageBoxNode（420×420），截图作为 images，自动连线本节点 → 图片盒子
          const boxes = getEdges()
            .filter((e) => e.source === id)
            .map((e) => e.target)
            .filter((tid) => getNode(tid)?.type === 'imageBoxNode');
          const newImages = shots.map((url, i) => ({
            id: `${generateId('panoShot')}-${i}`,
            url,
            label: `全景截图 ${angles[i] || 0}度`,
            source: 'gen',
            createdAt: Date.now(),
          }));
          if (boxes.length > 0) {
            // 有图片盒子下游：追加到第一个盒子
            const boxId = boxes[0];
            setNodes((ns) =>
              ns.map((n) => {
                if (n.id !== boxId) return n;
                const existing = (n.data?.images as Array<{ url?: string }> | undefined) || [];
                const existingUrls = new Set(existing.map((x) => x.url));
                const fresh = newImages.filter((x) => !existingUrls.has(x.url));
                const merged = [...existing, ...fresh];
                return {
                  ...n,
                  data: { ...n.data, images: merged, activeIndex: merged.length - 1 },
                };
              }),
            );
          } else {
            // 无图片盒子下游：新建图片盒子 + 自动连线
            const me = getNode(id);
            const boxId = generateId('imageBoxNode');
            const spawned = buildSpawnNodes(
              {
                id,
                position: {
                  x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60,
                  y: me?.position.y ?? 100,
                },
              },
              [
                {
                  id: boxId,
                  type: 'imageBoxNode',
                  position: {
                    x: (me?.position.x ?? 100) + (me?.measured?.width ?? 640) + 60,
                    y: me?.position.y ?? 100,
                  },
                  style: { width: 420, height: 420 },
                  data: {
                    images: newImages,
                    activeIndex: newImages.length - 1,
                    expanded: newImages.length > 1,
                    label: '图片盒子',
                  },
                },
              ],
              { targetHandle: null },
            );
            spawnAndCommit(spawned, { getNodes, getEdges, setNodes, setEdges, history });
          }
          logger.info('panoNode', '截图完成', { count: shots.length, nodeId: id });
          toastSuccess('截图完成，已存入图片盒子');
        }
      } catch (e) {
        logger.warn('panoNode', '截图失败', {
          error: e instanceof Error ? e.message : String(e),
        });
        toastError('截图失败，请重试');
      } finally {
        capturingRef.current = false;
        setCapturing(false);
        setShotKind(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, ratioStr, setNodes, getNodes, getNode, getEdges, setEdges, history],
  );

  // 【键盘快捷键】漫游层高频操作全部可键盘完成（输入框聚焦时不拦截，避免吃字）。
  // Esc 退出 · 空格 自动漫游 · R 复位 · +/- 视野 · F 取景框 · 1/2/3 截图
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      switch (e.key) {
        case 'Escape':
          setFullscreen(false);
          break;
        case ' ':
          e.preventDefault();
          setAutoRotate((v) => !v);
          break;
        case 'r':
        case 'R':
          viewerRef.current?.reset();
          break;
        case '+':
        case '=':
          setFov((f) => Math.min(120, f + 5));
          break;
        case '-':
        case '_':
          setFov((f) => Math.max(30, f - 5));
          break;
        case 'f':
        case 'F':
          setShowFrame((v) => !v);
          break;
        case '1':
          void doCapture([0]);
          break;
        case '2':
          void doCapture(ANGLES_4);
          break;
        case '3':
          void doCapture(ANGLES_12);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, doCapture]);

  // 截图比例（分段控件 + 自定义宽高）。
  // 为什么不用原生 <select>：全屏层是深色玻璃拟态，原生下拉在 macOS/Windows 下样式割裂且不可控；
  // 分段控件把 4 个选项一次展开，选比例少一次点击，也更贴合"取景构图"的心智。
  const renderRatioPicker = () => (
    <div className="flex items-center gap-1.5 nodrag">
      <span className="text-caption-sm text-white/40 shrink-0 whitespace-nowrap">比例</span>
      <Segmented
        value={aspectRatio}
        options={RATIO_OPTIONS.map((r) => ({ value: r, label: r === 'custom' ? '自定义' : r }))}
        onChange={(v) => {
          setAspectRatio(v);
          patchData({ aspectRatio: v }); // 落盘：刷新后不重置
        }}
      />
      {aspectRatio === 'custom' && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            value={customDim.w}
            onChange={(e) => {
              const next = { ...customDim, w: Math.max(1, Number(e.target.value) || 1) };
              setCustomDim(next);
              patchData({ customDim: next });
            }}
            className="w-9 h-6 text-center text-caption-sm bg-white/5 border border-white/10 rounded-md text-white outline-none focus:border-sky-400/60 nodrag [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-white/30 text-caption-sm">:</span>
          <input
            type="number"
            min={1}
            value={customDim.h}
            onChange={(e) => {
              const next = { ...customDim, h: Math.max(1, Number(e.target.value) || 1) };
              setCustomDim(next);
              patchData({ customDim: next });
            }}
            className="w-9 h-6 text-center text-caption-sm bg-white/5 border border-white/10 rounded-md text-white outline-none focus:border-sky-400/60 nodrag [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      )}
    </div>
  );

  // 截图按钮组（全屏左侧，纵向；icon + 文字，比纯图标更容易看出"点下去干嘛"）
  const renderShotButtons = () => (
    <div className="flex flex-col gap-1 p-1.5 nodrag">
      <TextButton
        icon={<CircleDot size={15} />}
        label="当前视角"
        title="截取当前视角 (1)"
        loading={shotKind === 'current'}
        disabled={capturing}
        onClick={() => doCapture([0])}
      />
      <TextButton
        icon={<Grid3X3 size={15} />}
        label="四大视角"
        title="前/后/左/右四视角 (2)"
        loading={shotKind === 'four'}
        disabled={capturing}
        onClick={() => doCapture(ANGLES_4)}
      />
      <TextButton
        icon={<Scan size={15} />}
        label="12大视角"
        title="每 30° 一镜共 12 张 (3)"
        loading={shotKind === 'twelve'}
        disabled={capturing}
        onClick={() => doCapture(ANGLES_12)}
      />
    </div>
  );

  // 截图处理中遮罩
  const renderCapturingOverlay = () =>
    capturing && (
      <div className="absolute inset-0 z-[110] pointer-events-none nodrag flex items-center justify-center bg-black/25">
        <div className="bg-black/75 border border-white/10 rounded-2xl px-5 py-3.5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] flex items-center gap-3">
          <Spinner size={18} />
          <span className="text-white text-body-sm font-medium">截图处理中…</span>
        </div>
      </div>
    );

  // 截图比例取景框遮罩（虚线框 + 外压暗，便于构图；只在未截图时显示）
  const renderRatioOverlay = () =>
    !capturing && (
      <div
        className="absolute inset-0 pointer-events-none z-[40]"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <div
          className="border-2 border-dashed border-white/35 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] rounded-sm transition-colors duration-300"
          style={{
            aspectRatio: ratioStr,
            height: '100%',
            maxHeight: '100%',
            maxWidth: '100%',
            ...(showFrame ? {} : { borderColor: 'transparent', boxShadow: 'none' }),
          }}
        />
      </div>
    );

  // 全屏球体漫游（复刻官方 Component1861）：黑幕 + 顶部工具条。
  // 外壳负责 portal 与模态登记（漫游期间画布快捷键让位）。
  // 不传 onClose = 不接管 Esc —— 本层键盘体系自洽（1/2/3 截图、空格漫游、+/- 缩放），
  // 贸然加 Esc 退出会盖掉既有交互设计。
  const renderFullscreen = () => (
    <FullscreenShell
      open={fullscreen && !!panoUrl}
      className="fixed inset-0 z-modal bg-black flex flex-col nodrag"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* 顶部条：居中比例控件 + 右侧操作（最高层级，压在一切之上） */}
      <div className="absolute top-0 inset-x-0 z-[120] h-16 px-4 flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 px-2 h-9 rounded-xl bg-black/45 backdrop-blur border border-white/10 shadow-lg">
          {renderRatioPicker()}
        </div>

        <div className="absolute right-4 pointer-events-auto flex items-center gap-1.5">
          <div className="flex items-center px-1 h-9 rounded-xl bg-black/45 backdrop-blur border border-white/10">
            <IconButton
              icon={<RotateCcw size={16} />}
              title="复位视角 (R)"
              onClick={() => viewerRef.current?.reset()}
            />
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <IconButton
              icon={<ZoomOut size={16} />}
              title="缩小 (-)"
              onClick={() => setFov((f) => Math.min(120, f + 8))}
            />
            <IconButton
              icon={<ZoomIn size={16} />}
              title="放大 (+)"
              onClick={() => setFov((f) => Math.max(30, f - 8))}
            />
          </div>
          <div className="flex items-center px-1 h-9 rounded-xl bg-black/45 backdrop-blur border border-white/10">
            <TextButton
              icon={autoRotate ? <Pause size={14} /> : <Play size={14} />}
              label={autoRotate ? '暂停' : '漫游'}
              active={autoRotate}
              title="自动绕行旋转 (空格)"
              onClick={() => setAutoRotate((v) => !v)}
            />
            <TextButton
              icon={<Camera size={14} />}
              label="截图"
              active={shotKind === 'current'}
              loading={shotKind === 'current'}
              disabled={capturing}
              title="截取当前视角 (1)"
              onClick={() => doCapture([0])}
            />
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button
              type="button"
              title="退出漫游 (Esc)"
              onClick={() => setFullscreen(false)}
              className="grid place-items-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-red-500/25 transition-colors cursor-pointer border-none"
            >
              <X size={19} />
            </button>
          </div>
        </div>
      </div>

      {/* 主视图：球体全景，四周留黑边（cinema 黑边），viewport 区域球体不超界 */}
      <div className="absolute inset-0 p-0">
        <div className="relative w-full h-full overflow-hidden">
          <div ref={sphereBoxRef} className="absolute inset-0">
            {/* 加载/错误态：R3F Canvas 挂起时（纹理加载中）抛 promise 给外层 Suspense；
                  纹理加载失败抛 error 给外层 ErrorBoundary（R3F CanvasImpl 的错误外抛机制）。 */}
            <SphereErrorBoundary>
              <Suspense fallback={<SphereLoadingOverlay />}>
                <Canvas
                  resize={{ debounce: 0 }}
                  dpr={1.5}
                  gl={{
                    preserveDrawingBuffer: true,
                    antialias: true,
                    alpha: true,
                    powerPreference: 'high-performance',
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'grab',
                    touchAction: 'none',
                  }}
                >
                  <PanoViewer
                    ref={viewerRef}
                    url={sphereTextureUrl}
                    fov={fov}
                    autoRotate={autoRotate}
                  />
                </Canvas>
              </Suspense>
            </SphereErrorBoundary>
          </div>

          {renderCapturingOverlay()}
          {renderRatioOverlay()}
        </div>
      </div>

      {/* 左：截图按钮条（玻璃胶囊，避让取景框不会跑到画面外） */}
      <div className="absolute left-5 top-1/2 -translate-y-1/2 z-[110] rounded-2xl bg-black/45 backdrop-blur-md border border-white/10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] pointer-events-none">
        <div className="pointer-events-auto">{renderShotButtons()}</div>
      </div>

      {/* 底：操作引导（进入时提示，3.5s 后淡出） */}
      <div
        className={`absolute bottom-5 inset-x-0 z-[90] flex justify-center transition-opacity duration-500 ${showHint ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex items-center gap-4 px-4 h-8 rounded-full bg-black/45 backdrop-blur border border-white/10 text-caption-sm text-white/60">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Move3D size={13} className="text-sky-300/80" />
            拖拽看 360°
          </span>
          <span className="text-white/20">|</span>
          <span className="whitespace-nowrap">滚轮缩放</span>
          <span className="text-white/20">|</span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            快捷键
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 text-2xs">空格</kbd>
            漫游
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 text-2xs">1/2/3</kbd>
            截图
          </span>
        </div>
      </div>
    </FullscreenShell>
  );

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="720全景图"
      icon={<Globe size={11} className="text-muted" />}
      selected={selected}
      keepAspect
      aspectRatio="16:9"
      defaultHeight={360}
      handleVariant="small"
      className="min-w-[320px] min-h-[240px]"
      onRename={rename}
    >
      <HoverToolbar buttons={[]} />

      {/* 主显示区（照模板：只布局，圆角/裁剪在内部显示框） */}
      <div className="relative flex flex-col w-full flex-1 min-h-0 group/image">
        {panoUrl ? (
          <div className="flex-1 relative overflow-hidden rounded-xl bg-black">
            {/* 完整全景图（等距展开）；加载失败显示占位（R2：不再静默空白） */}
            {imgError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-black text-red-400/80">
                <div className="w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/20 grid place-items-center">
                  <Globe size={20} className="text-red-400/70" />
                </div>
                <div className="text-center">
                  <div className="text-body-sm font-medium">全景图加载失败</div>
                  <div className="text-caption mt-1 text-red-400/50">
                    图片可能已失效或跨域不可访问
                  </div>
                </div>
              </div>
            ) : (
              /* object-contain：2:1 全景图在 16:9 节点里完整显示（cover 会裁掉左右首尾相接区域） */
              <img
                src={thumbResolve(panoUrl)}
                alt="全景图"
                draggable={false}
                onError={() => setImgError(true)}
                onLoad={() => setImgError(false)}
                className="w-full h-full object-contain"
              />
            )}

            {/* 顶部拖拽 grip */}
            <div className="absolute top-0 left-0 w-full h-8 z-20 flex items-start justify-center pt-2 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors opacity-0 group-hover/image:opacity-100 pointer-events-none">
              <div className="w-12 h-1.5 bg-white/25 rounded-full pointer-events-none" />
            </div>

            {/* 左下：投影类型角标 */}
            {!imgError && (
              <span className="absolute bottom-4 left-4 z-30 flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-caption-sm text-white/75 nodrag pointer-events-none">
                <Globe size={12} />
                球状 360°
              </span>
            )}

            {/* 全景漫游按钮（hover 显示，进入球体旋转裁切） */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFullscreen(true);
              }}
              title="全景漫游（旋转查看 360° 并裁切）"
              className="absolute bottom-4 right-4 z-40 flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white/10 text-white hover:bg-white hover:text-black backdrop-blur-md border border-white/15 nodrag cursor-pointer transition-colors"
            >
              <Maximize2 size={15} />
              <span className="text-caption-sm font-medium">全景漫游</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-surface-muted rounded-xl">
            <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-edge grid place-items-center">
              <Globe size={24} strokeWidth={1.4} className="text-muted" />
            </div>
            <div className="text-center">
              <div className="text-caption-sm font-medium text-secondary">720 全景图</div>
              <div className="text-caption mt-0.5 text-faint">连接图片节点以显示全景</div>
            </div>
          </div>
        )}
      </div>

      {renderFullscreen()}
    </NodeShell>
  );
}
export default React.memo(PanoramaNode);
