import React, { useMemo } from 'react'
import { LayoutGrid, Map, Maximize, RefreshCw, Zap } from 'lucide-react'

/**
 * 左下角工具栏（复刻 H_.jsx:12013-12094 bottom-left 工具栏）。
 *
 * 【抉择：为什么是「纯展示 + 回调上抛」】
 * 本组件**不含任何业务逻辑**，只渲染按钮、把点击通过 props 回调上抛给画布宿主（App.jsx）。
 * 原因（原则 1 关注点分离）：按钮「点一下该干嘛」是画布壳的决策（整理→dagre、小地图→切
 * MiniMap、缩放→fitView/zoomIn），不该埋在工具栏组件里。这样工具栏可被任何宿主复用，
 * 换一个画布（脚本盒、别的编辑器）直接换回调即可。
 *
 * 【抉择：图标取舍】
 * 官方图标是混淆后的 lucide 组件（Et/He/_Component124 等，无法直接引用）。本组件用
 * **语义等价**的 lucide 图标：
 *  - 整理画布 → LayoutGrid（网格布局，贴合 dagre 自动排列）
 *  - 清理缓存 → RefreshCw（缓存重整语义，非垃圾桶）
 *  - 性能模式 → Zap（闪电，激活黄高亮）
 * 视觉与官方「表达同一动作」即可，不追求逐像素一致（用户确认过不必 100%）。
 *
 * 【onClearCache 说明】
 * 已由 App 传入真实逻辑（释放节点 data 里超过阈值的内联 dataURL 大资源，原型本地版）。
 * 官方 Ki 是把内联大资源转成 /files/ 本地 URL；原型无后端，改为释放超大内联数据，接真后再转 URL。
 * 说明：原「运行工作流（onRun）」按钮已按需求移除。
 *
 * @param {Object} props
 * @param {boolean} props.minimapOn      小地图开关（激活白高亮）
 * @param {Function} props.onToggleMinimap
 * @param {Function} props.onArrange      整理画布（dagre 自动排版）
 * @param {Function} props.onFitView      适合视图（fitView）
 * @param {number} props.zoomPercent      当前缩放百分比（整型）
 * @param {boolean} props.performanceMode 缩放性能模式开关（激活黄高亮）
 * @param {Function} props.onTogglePerformance
 * @param {Function} [props.onClearCache] 清理缓存（App 传入：释放节点内大 dataURL 资源）
 * @param {boolean} [props.localToolConnected] 本地引擎是否连接（左上角第一个对号/断开按钮）
 */
export default function CanvasToolbar({
  minimapOn,
  onToggleMinimap,
  onArrange,
  onFitView,
  zoomPercent,
  performanceMode,
  onTogglePerformance,
  onClearCache,
  localToolConnected,
}) {
  // 缩放%按钮可点击回到 100%
  const zoomPercentText = useMemo(() => `${zoomPercent}%`, [zoomPercent])

  // 框整体紧凑化（用户要求不占大面积）：容器 padding 收窄、按钮 p 减小、分隔线间距减小，图标尺寸不变。
  const baseBtn =
    'p-1.5 rounded-full transition-colors flex items-center justify-center text-gray-400 hover:text-white hover:bg-surface-hover-strong'
  const divider = <span className="w-[1px] h-3.5 bg-surface-3 mx-1" />

  return (
    <div className="flex items-center gap-2">
      {/* 主工具组 */}
      <div className="flex items-center rounded-full px-1 py-0.5">
        {/* 本地引擎连接状态（第一个；大小与其他按钮一致）。已连接=绿勾，未连接=红× */}
        <button
          type="button"
          className={`${baseBtn} ${localToolConnected ? 'text-emerald-400 hover:text-emerald-300' : 'text-red-400 hover:text-red-300'}`}
          title={localToolConnected ? '本地引擎已连接' : '本地引擎未连接'}
        >
          {localToolConnected ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </button>
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
        <button type="button" onClick={onFitView} className={baseBtn} title="适合视图">
          <Maximize size={16} />
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
          className="text-xs text-gray-400 font-medium min-w-[36px] text-center cursor-default select-none"
          title="点击适配视图"
        >
          {zoomPercentText}
        </button>
      </div>
    </div>
  )
}
