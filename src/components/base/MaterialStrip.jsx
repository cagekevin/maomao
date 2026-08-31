import React from 'react'
import { X, Link as LinkIcon } from 'lucide-react'
import LazyImage from './LazyImage.tsx'

/**
 * 素材缩略图条（生图/文本/视频等节点的「下方素材参考区」通用组件）。
 *
 * 以生图节点（PromptNode）素材区为标准统一：三节点共用此组件，避免各自复制导致样式不一致。
 * 形态：
 *  - 图片/媒体缩略图：方形缩略图 + 底部蓝色「@名」插入按钮 + 右上角红色 ×（hover 显示，断开连线）
 *  - 文本素材：胶囊标签 + 右上角红色 ×（hover 显示，断开连线）
 *
 * 断线规则：
 *  - 只有带 sourceNodeId 的素材（来自 useConnectedInputs 的真实上游连线）才显示红色 × 可断开；
 *  - data.images 塞进来的剧本盒子资产（无 sourceNodeId）不显示 ×，不能断开（它不是连线来源）。
 *
 *  @param props
 *  - images   [{url, sourceNodeId?, label?, id?}] 图片/媒体素材
 *  - texts    [{sourceNodeId?, label?, text?, id?}] 文本素材
 *  - onInsert (asset) => void  点击蓝色 @标签插入到提示词/文本框。
 *      asset = { id, label, url?, kind: 'image'|'text' }（富文本芯片所需完整信息，
 *      不再只传 name——让 @素材 能渲染成带缩略图的小图芯片，见 promptChips.js）
 *  - onDisconnect (sourceNodeId) => void   点击红色 × 断开该来源节点 → 本节点的连线
 *  - readOnly boolean         只读展示：去掉「点击 @插入」交互，仅显示缩略图/文字标签（含 × 断线）
 */
function MaterialStrip({ images = [], texts = [], onInsert, onDisconnect, readOnly = false }) {
  if (images.length === 0 && texts.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mb-1">
      {images.map((img, i) => {
        const name = img.label || `图片${i + 1}`
        const canDisconnect = !!img.sourceNodeId
        return (
          <div key={img.id || img.url || i} className="w-10 h-10 rounded-md overflow-hidden relative group bg-black cursor-grab active:cursor-grabbing nodrag nopan" title={canDisconnect ? '已连线的素材' : '上传的素材'}>
            <LazyImage src={img.url} alt={name} className="w-full h-full" imgClassName="w-full h-full object-cover opacity-80 pointer-events-none" />
            <div className="absolute inset-0 bg-blue-500/10 pointer-events-none" />
            {!readOnly && (
              <button type="button" className="absolute bottom-0 left-0 right-0 bg-blue-500/80 hover:bg-blue-500 text-2xs text-white text-center py-0.5 truncate cursor-pointer transition-colors" title={`点击插入 @${name}`} onClick={(e) => { e.stopPropagation(); onInsert?.({ id: img.id || `img-${i}`, label: name, url: img.url, kind: 'image' }) }}>{name}</button>
            )}
            {canDisconnect && (
              <span className="absolute top-0 right-0 p-0.5 bg-black/50 hover:bg-red-500/80 rounded-bl-md cursor-pointer opacity-0 group-hover:opacity-100 transition-all" title="断开连线" onClick={(e) => { e.stopPropagation(); onDisconnect?.(img.sourceNodeId) }}><X size={10} className="text-white" /></span>
            )}
          </div>
        )
      })}
      {texts.map((t, i) => {
        const name = t.label || `文本${i + 1}`
        const canDisconnect = !!t.sourceNodeId
        return (
          <div key={t.id || i} className={`h-8 px-2 bg-surface-hover border border-edge-muted rounded flex items-center gap-1 text-caption text-body relative ${readOnly ? '' : 'hover:bg-surface-hover-strong hover:border-blue-500 hover:text-blue-400 transition-colors group/text cursor-pointer'}`} title={t.text || name} onClick={readOnly ? undefined : (e) => { e.stopPropagation(); onInsert?.({ id: t.id || `text-${i}`, label: name, kind: 'text' }) }}>
            <LinkIcon size={10} />
            <span className="max-w-[80px] truncate">{name}{t.text ? ` (${t.label || ''})` : ''}</span>
            {canDisconnect && (
              <span className="absolute -top-1 -right-1 p-0.5 bg-black hover:bg-red-500 rounded-full cursor-pointer opacity-0 group-hover/text:opacity-100 transition-all" title="断开连线" onClick={(e) => { e.stopPropagation(); onDisconnect?.(t.sourceNodeId) }}><X size={10} className="text-white" /></span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default React.memo(MaterialStrip)
