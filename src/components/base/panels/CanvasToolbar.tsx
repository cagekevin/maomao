import React, { type ReactNode } from 'react';
import { LayoutGrid, Map, Maximize, RefreshCw, Zap } from 'lucide-react';

export interface CanvasToolbarProps {
  /** 小地图开关（激活白高亮） */
  minimapOn: boolean;
  onToggleMinimap: () => void;
  /** 整理画布（dagre 自动排版） */
  onArrange: () => void;
  /** 适合视图（fitView） */
  onFitView: () => void;
  /** 缩放百分比显示（叶子组件插槽，P0-C C3：宿主注入自订阅 store 的 ZoomPercent） */
  zoomPercentNode: ReactNode;
  /** 缩放性能模式开关（激活黄高亮） */
  performanceMode: boolean;
  onTogglePerformance: () => void;
  /** 清理缓存（App 传入：释放节点内大 dataURL 资源） */
  onClearCache?: () => void;
  /** 本地引擎是否连接（左上角第一个对号/断开按钮） */
  localToolConnected?: boolean;
}

function CanvasToolbar({
  minimapOn,
  onToggleMinimap,
  onArrange,
  onFitView,
  zoomPercentNode,
  performanceMode,
  onTogglePerformance,
  onClearCache,
  localToolConnected,
}: CanvasToolbarProps) {
  // 框整体紧凑化（用户要求不占大面积）：容器 padding 收窄、按钮 p 减小、分隔线间距减小，图标尺寸不变。
  const baseBtn =
    'p-1.5 rounded-full transition-colors flex items-center justify-center text-secondary hover:text-white hover:bg-surface-hover-strong';

  return (
    <div className="flex items-center gap-2">
      {/* 主工具组 */}
      <div className="flex items-center rounded-full px-1 py-0.5">
        {/* 本地引擎连接状态（纯指示器，非按钮）。已连接=绿勾，未连接=红× */}
        <span
          role="status"
          aria-live="polite"
          className={`p-1.5 flex items-center justify-center ${localToolConnected ? 'text-emerald-400' : 'text-red-400'} transition-colors duration-300`}
          title={localToolConnected ? '本地引擎已连接' : '本地引擎未连接'}
        >
          {localToolConnected ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </span>
        <button type="button" onClick={onArrange} className={baseBtn} title="整理画布">
          <LayoutGrid size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleMinimap}
          className={`${baseBtn} ${minimapOn ? 'text-white' : ''}`}
          title="画布小地图"
        >
          <Map size={16} />
        </button>
        <button
          type="button"
          onClick={onClearCache}
          className={baseBtn}
          title="清理缓存：将内联大资源转为本地URL"
        >
          <RefreshCw size={16} />
        </button>
        {/* 缩放性能模式（复刻 H_.jsx:12047-12049，闪电图标 Zap，激活黄高亮） */}
        <button
          type="button"
          onClick={onTogglePerformance}
          className={`${baseBtn} ${performanceMode ? 'text-yellow-400 hover:text-yellow-300' : ''}`}
          title={performanceMode ? '缩放性能模式已开启' : '缩放性能模式已关闭'}
        >
          <Zap size={16} />
        </button>
        <button
          type="button"
          onClick={onFitView}
          className={`${baseBtn} gap-1 text-xs min-w-[36px] cursor-pointer active:scale-95 select-none`}
          title="缩放适配：点击适配视图"
        >
          <Maximize size={14} />
          {zoomPercentNode}
        </button>
      </div>
    </div>
  );
}

export default React.memo(CanvasToolbar);
