import { useCallback, useEffect, useRef } from 'react';
import { Director3DApp } from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import './styles.css';
import FullscreenShell from '../base/panels/FullscreenShell.tsx';

/**
 * Director3DOverlay：把 3D 导演台白膜预演作为全屏 overlay 嵌入画布节点。
 *
 * 由 Director3DNode 双击节点后 createPortal 挂载到 document.body。
 * 每个节点用独立 storageKey（director3d-project-<nodeId>），工程互不干扰。
 *
 * 挂载期间在 document 捕获阶段拦截目标不在 overlay 内的 pointer/wheel 事件，
 * 确保 maomao 画布在 overlay 打开时不响应鼠标交互（3D 导演台内部事件不受影响）。
 *
 * Props：
 *  - nodeId：节点 id，用于生成独立工程存储 key
 *  - onExit：退出回调，回传 { thumbnailDataUrl?, captures? }
 */
interface CaptureItem {
  type: 'image' | 'video';
  blob: Blob;
  fileName: string;
}

interface Director3DOverlayProps {
  nodeId: string;
  onExit?: (payload: { thumbnailDataUrl: string | null; captures: CaptureItem[] }) => void;
}

export function Director3DOverlay({ nodeId, onExit }: Director3DOverlayProps) {
  const capturesRef = useRef<CaptureItem[]>([]);
  const thumbnailRef = useRef<string | null>(null);
  const hostRef = useRef(null);
  const storageKey = nodeId ? `director3d-project-${nodeId}` : null;

  // 挂载期间：拦截画布的鼠标/滚轮/拖拽/粘贴事件，避免画布被误操作。
  // - pointer/wheel：仅当目标在 overlay 外（画布）时拦截，不影响 3D 导演台内部。
  // - drag/paste：overlay 打开时无条件拦截（画布拖拽/粘贴建节点无需保留，3D 导演台内部用 file input 上传、内部 state 处理关键帧）。
  useEffect(() => {
    const blockPointerOutside = (e: Event) => {
      const target = e.target;
      const host = hostRef.current;
      if (target && host && host.contains(target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const blockAll = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const pointerEvents = ['pointerdown', 'pointermove', 'pointerup', 'wheel'];
    const captureEvents = ['dragover', 'dragenter', 'dragleave', 'drop', 'paste'];
    pointerEvents.forEach((name) => document.addEventListener(name, blockPointerOutside, true));
    captureEvents.forEach((name) => document.addEventListener(name, blockAll, true));
    // React Flow 的 onDrop/onDragOver 是 React 合成事件，委托到 #root。
    // 在 #root 捕获阶段拦截 drag/drop，确保画布拖拽建节点被阻止（overlay 不在 #root 内，不受影响）。
    const hostRoot = document.getElementById('root');
    const rootCaptureCleanup: Array<() => void> = [];
    if (hostRoot) {
      const rootBlock = (e: Event) => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      const rootEvents = ['dragover', 'drop', 'dragenter', 'dragleave'];
      rootEvents.forEach((name) => {
        hostRoot.addEventListener(name, rootBlock, true);
        rootCaptureCleanup.push(() => hostRoot.removeEventListener(name, rootBlock, true));
      });
    }
    // 双保险：overlay 打开期间禁用画布根容器的 pointer-events，从 CSS 层面屏蔽画布所有鼠标/拖拽交互。
    const previousPointerEvents = hostRoot ? hostRoot.style.pointerEvents : '';
    if (hostRoot) hostRoot.style.pointerEvents = 'none';
    return () => {
      pointerEvents.forEach((name) =>
        document.removeEventListener(name, blockPointerOutside, true),
      );
      captureEvents.forEach((name) => document.removeEventListener(name, blockAll, true));
      rootCaptureCleanup.forEach((fn) => fn());
      if (hostRoot) hostRoot.style.pointerEvents = previousPointerEvents;
    };
  }, []);

  // 受控导出：收集产物（Blob），退出时交给宿主落盘/回写画布
  const handleExport = useCallback(({ type, blob, fileName }: CaptureItem) => {
    capturesRef.current = [...capturesRef.current, { type, blob, fileName }];
  }, []);

  // 缩略图回传：App 每次截图成功后给出节点预览图
  const handleThumbnail = useCallback((dataUrl: string) => {
    if (dataUrl) thumbnailRef.current = dataUrl;
  }, []);

  // 退出：把收集的产物整理为 thumbnailDataUrl + captures 回传
  const handleExit = useCallback(() => {
    onExit?.({
      thumbnailDataUrl: thumbnailRef.current || null,
      captures: capturesRef.current.map((it) => ({
        type: it.type,
        blob: it.blob,
        fileName: it.fileName,
      })),
    });
  }, [onExit]);

  // 登记为全屏模态层：本 overlay 盖住整个画布期间，画布快捷键（⌘Z/⌘D/Ctrl+G/Q/W/E）必须让位。
  // 只登记、不接管 Esc —— Director3D 有一整套自己的键位（D/Z/Y/V/F1-F4，见 App.tsx:1085
  // 的捕获监听），贸然加 Esc 退出会盖掉既有设计。条件挂载 → 挂载即打开，enabled 留默认 true。
  // 全屏外壳负责 portal / 模态登记（画布快捷键在导演台打开期间让位）。
  // 不传 onClose = 不接管 Esc —— 导演台有一整套自己的键位（D/Z/Y/V/F1-F4，
  // 见 App.tsx:1085 的捕获监听），外壳退出会盖掉既有设计。
  // ref 透传到外壳 div：本层要拿它做命令式操作（屏蔽宿主指针事件）。
  return (
    <FullscreenShell
      open
      ref={hostRef}
      className="director3d-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000 }}
    >
      <ErrorBoundary label="Director3D">
        <Director3DApp
          storageKey={storageKey}
          onExport={handleExport}
          onExit={handleExit}
          onThumbnail={handleThumbnail}
        />
      </ErrorBoundary>
    </FullscreenShell>
  );
}
