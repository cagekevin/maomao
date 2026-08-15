import React from 'react'
import { FileText, Image as ImageIcon, Clapperboard } from 'lucide-react'

/**
 * 画布空状态引导 —— 完整复刻官方 H_.jsx L12622-12682「右键自由生成你的想象」。
 *
 * 官方触发条件（L12622）：`Ne && De.length===0 && !St && !Fe`
 *  - Ne：画布已加载完成（true）
 *  - De.length===0：节点数为 0（空画布）
 *  - !St：不在加载中
 *  - !Fe：没有右键菜单打开
 * 即：画布加载完成后且没有任何节点时，在画布中央显示引导。
 *
 * 结构（对齐官方）：
 *  - 标题胶囊（bg-surface-raised rounded-full ... border-edge shadow-lg）：图表图标 + 「右键自由生成你的想象」
 *  - 三个按钮：文字生成(textNode) / 图片生成(promptNode) / 特惠视频(discountVideoNode)，
 *    点击在画布中央新建对应节点。
 *
 * @param {object} props
 *  - onAdd: (type) => void  新建节点回调（App 传 addNode，落点在画布中央）
 */
export default function EmptyCanvasGuide({ onAdd }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center pointer-events-auto transform -translate-y-10">
        {/* 标题胶囊：图表图标 + 文案 */}
        <div className="bg-surface-raised rounded-full px-5 py-2.5 flex items-center gap-3 mb-10 border border-edge shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          <span className="text-base font-medium text-gray-200 tracking-wide">右键自由生成你的想象</span>
        </div>

        {/* 三个生成入口 */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onAdd('textNode')}
            className="flex items-center gap-2 px-6 py-3.5 bg-transparent hover:bg-surface-1 border border-edge hover:border-gray-500 rounded-2xl transition-all text-gray-400 hover:text-gray-200"
          >
            <FileText size={18} className="text-gray-500" />
            <span className="text-sm font-medium">文字生成</span>
          </button>
          <button
            type="button"
            onClick={() => onAdd('promptNode')}
            className="flex items-center gap-2 px-6 py-3.5 bg-transparent hover:bg-surface-1 border border-edge hover:border-gray-500 rounded-2xl transition-all text-gray-400 hover:text-gray-200"
          >
            <ImageIcon size={18} className="text-gray-500" />
            <span className="text-sm font-medium">图片生成</span>
          </button>
          <button
            type="button"
            onClick={() => onAdd('discountVideoNode')}
            className="flex items-center gap-2 px-6 py-3.5 bg-transparent hover:bg-surface-1 border border-edge hover:border-gray-500 rounded-2xl transition-all text-gray-400 hover:text-gray-200"
          >
            <Clapperboard size={18} className="text-gray-500" />
            <span className="text-sm font-medium">特惠视频</span>
          </button>
        </div>
      </div>
    </div>
  )
}
