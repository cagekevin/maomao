import React from 'react'
import { ArrowUp, Square, RefreshCw } from 'lucide-react'

/**
 * 生成/停止按钮（复刻各节点底部「生成」胶囊按钮）。
 *
 * @param props
 *  - loading      是否生成中
 *  - onGenerate   生成点击
 *  - onStop       停止点击
 *  - onRefresh    生成中时的「刷新」按钮（可选，特惠视频有）
 *  - cost         币消耗（可选，显示在生成按钮内）
 *  - costColor    币颜色（默认橙 yellow）
 *  - label        按钮文字（默认「生成」）
 *  - showCost     cost 是否显示（默认 true）
 */
export default function GenerateButton({
  loading,
  onGenerate,
  onStop,
  onRefresh,
  cost,
  costColor = 'text-orange-400',
  label = '生成',
  showCost = true
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        {onRefresh && (
          <button
            className="flex items-center gap-1 text-gray-400 hover:text-white bg-surface-1 hover:bg-surface-hover-strong border border-edge hover:border-gray-500 rounded-full px-2.5 py-1 transition-colors"
            title="刷新状态"
            onClick={(e) => { e.stopPropagation(); onRefresh() }}
          >
            <RefreshCw size={12} />
            <span className="text-caption">刷新</span>
          </button>
        )}
        <div
          className="flex items-center bg-red-500/10 rounded-full p-1 pl-3 border border-red-500/30 hover:border-red-500/50 transition-colors cursor-pointer group/btn"
          onClick={(e) => { e.stopPropagation(); onStop() }}
        >
          <span className="flex items-center gap-1 mr-3 text-xs text-red-400 group-hover/btn:text-red-300">停止</span>
          <span className="bg-red-500/20 text-red-400 w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-500/30 transition-colors">
            <Square size={10} fill="currentColor" />
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center bg-surface-hover rounded-full p-1 pl-3 border border-edge hover:border-gray-500 transition-colors cursor-pointer group/btn flex-shrink-0 ml-2"
      onClick={(e) => { e.stopPropagation(); onGenerate() }}
    >
      {showCost && cost != null && (
        <span className={`flex items-center gap-0.5 mr-2 text-caption-sm ${costColor} tabular-nums`} title="预计消耗">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 7v10M9 10.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5c0 3.5-6 2-6 5 0 1.4 1.3 2.5 3 2.5s3-1.1 3-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {cost}
        </span>
      )}
      <span className="flex items-center gap-1 mr-3 text-xs text-gray-300 group-hover/btn:text-white">{label}</span>
      <span className="bg-white text-black w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
        <ArrowUp size={14} strokeWidth={3} />
      </span>
    </div>
  )
}
