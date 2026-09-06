import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X } from 'lucide-react';

/**
 * 全屏弹层组件（复刻 Ai.jsx）。
 *
 * 双击节点/输入框的「全屏编辑」落点。通过 createPortal 挂到 body，
 * 以 `fixed inset-0` 全屏遮罩展示 children 内容，供大空间编辑。
 *
 * - Esc 或点击空白处关闭
 * - 初始尺寸 = min(maxWidth, innerWidth*widthRatio) × innerHeight*0.8
 * - 右下角可拖拽改尺寸（最小 480×320，最大窗口-40）
 *
 * @param props
 *  - open          是否打开
 *  - title         标题
 *  - onClose       关闭回调
 *  - children      全屏编辑内容
 *  - widthRatio    初始宽度占屏比（默认 0.8）
 *  - maxWidth      弹层最大宽度（px，默认 1152；传小值可避免窗口过宽）
 *  - showHeader    是否显示顶部标题栏（默认 true；false 时隐藏标题与关闭提示）
 *  - autoHeight    是否高度随内容自适应（默认 false；true 时高度由 children 决定，最大 95vh）
 */
export interface FullscreenModalProps {
  /** 是否打开 */
  open: boolean;
  /** 标题 */
  title?: string;
  /** 关闭回调 */
  onClose: () => void;
  /** 全屏编辑内容 */
  children: React.ReactNode;
  /** 初始宽度占屏比（默认 0.8） */
  widthRatio?: number;
  /** 弹层最大宽度（px，默认 1152；传小值可避免窗口过宽） */
  maxWidth?: number;
  /** 是否显示顶部标题栏（默认 true；false 时隐藏标题与关闭提示） */
  showHeader?: boolean;
  /** 是否高度随内容自适应（默认 false；true 时高度由 children 决定，最大 95vh） */
  autoHeight?: boolean;
}

interface ModalSize {
  w: number;
  h: number | null;
}

export default function FullscreenModal({
  open,
  title = '编辑输入',
  onClose,
  children,
  widthRatio = 0.8,
  maxWidth = 1152,
  showHeader = true,
  autoHeight = false,
}: FullscreenModalProps) {
  // 初始尺寸：宽度占屏约 widthRatio，受 maxWidth 约束。autoHeight 时高度由内容决定。
  // SSR 环境下 window 不存在，需守卫。
  const [size, setSize] = useState<ModalSize>(() => {
    if (typeof window === 'undefined') return { w: 1000, h: autoHeight ? null : 700 };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.max(480, Math.min(maxWidth, Math.round(vw * widthRatio)));
    const h = autoHeight ? null : Math.max(320, Math.round(vh * 0.8));
    return { w, h };
  });
  const panelRef = useRef<HTMLDivElement>(null);
  // 记录本次按下是否落在遮罩空白上（而非从面板内容开始拖拽/选中）。
  // 用途：遮罩用 onClick 判定关闭，但「从右往左框选文字」时鼠标常会在面板外（遮罩）松开，
  // 此时 click 的 target 会变成遮罩（面板为遮罩子元素，松开的公共祖先就是遮罩）→ 被误判为点击空白关闭。
  // 只有「按下起点也在遮罩」的点击才算真·点空白，拖选松出框外不再误关。
  const backdropStartRef = useRef(false);

  // Esc 关闭（复刻 Ai.jsx useEffect）
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // 右下角拖拽改尺寸（复刻 Ai.jsx s 函数）
  const onPanelResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const baseW = panelRef.current?.offsetWidth ?? size.w;
      const baseH = panelRef.current?.offsetHeight ?? size.h;
      const move = (ev: MouseEvent) => {
        setSize({
          w: Math.max(480, Math.min(window.innerWidth - 40, baseW + (ev.clientX - startX))),
          h: Math.max(320, Math.min(window.innerHeight - 40, baseH + (ev.clientY - startY))),
        });
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [size.w, size.h],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-ceiling-2 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 input-panel-fullscreen-root"
      onMouseDown={(e) => {
        e.stopPropagation();
        // 记录按下起点：只有按在遮罩空白上（而非面板内容，如从右往左框选文字）才算「点空白」。
        backdropStartRef.current = e.target === e.currentTarget;
      }}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        // 需同时满足：本次 click 落在遮罩（拖选松出框外时 target 也会落到遮罩）
        // 且按下起点就在遮罩（排除从面板内容开始拖拽、最后在框外松开的场景）。
        const closeByBackdrop = e.target === e.currentTarget && backdropStartRef.current;
        backdropStartRef.current = false;
        if (closeByBackdrop) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="relative bg-surface-raised border border-edge rounded-xl shadow-2xl flex flex-col overflow-visible"
        style={{ width: size.w, height: size.h ?? undefined, maxWidth: '95vw', maxHeight: '95vh' }}
      >
        {/* 标题栏 */}
        {showHeader && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge-faint bg-surface-1 flex-shrink-0">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Pencil size={14} className="text-blue-400" />
              <span>{title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-caption-sm text-muted">Esc 关闭 · 点击空白处关闭</span>
              <button
                className="p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded transition-colors"
                onClick={onClose}
                title="关闭全屏"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* 内容区：autoHeight 时高度由内容决定，否则填满弹层剩余高度 */}
        <div
          className={`min-h-0 p-5 overflow-hidden custom-scrollbar flex flex-col ${autoHeight ? '' : 'flex-1'}`}
        >
          {children}
        </div>

        {/* 右下角拖拽手柄 */}
        <div
          className="absolute right-1 bottom-1 w-5 h-5 flex items-end justify-end cursor-nwse-resize select-none z-10"
          title="拖动调整窗口大小"
          onMouseDown={onPanelResize}
        >
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            className="block text-muted hover:text-blue-400 transition-colors pointer-events-none"
            aria-hidden="true"
          >
            <line
              x1="14"
              y1="6"
              x2="6"
              y2="14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <line
              x1="14"
              y1="9.5"
              x2="9.5"
              y2="14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <line
              x1="14"
              y1="13"
              x2="13"
              y2="14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>,
    document.body,
  );
}
