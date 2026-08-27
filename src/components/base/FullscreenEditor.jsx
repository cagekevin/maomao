import React from 'react'
import { Minimize2 } from 'lucide-react'
import FullscreenModal from './FullscreenModal'
import MaterialStrip from './MaterialStrip'
import PromptInput from './PromptInput'

/**
 * 统一的全屏编辑弹层（编辑提示词 / 文本）。
 *
 * 所有节点共用：无标题栏、右上角「缩小」按钮（点击即关闭）、
 * 高度随内容自适应、顶部显示上游连入的图片与文本。
 *
 * @param props
 *  - open          是否打开
 *  - onClose       关闭回调（缩小 / Esc / 点击遮罩）
 *  - variant       'prompt'（默认，含素材区）| 'text'（纯文本编辑）
 *  - value         当前文本值
 *  - onChange      文本变更回调
 *  - placeholder   占位文案
 *  - refImages     上游图片素材
 *  - refTexts      上游文本素材
 *  - onInsert      点击素材 @插入 回调
 *  - onDisconnect  素材断线回调
 *  - maxWidth      弹层最大宽度（默认 1000）
 *  - widthRatio    初始宽度占屏比（默认 0.9）
 *  - richText      false=textarea（默认）| true=富文本芯片（仅生图节点试水时开启）
 */
export default function FullscreenEditor({
  open,
  onClose,
  variant = 'prompt',
  value,
  onChange,
  placeholder = '',
  refImages = [],
  refTexts = [],
  onInsert,
  onDisconnect,
  maxWidth = 1200,
  widthRatio = 0.9,
  richText = false
}) {
  const showMaterials = variant === 'prompt'
  // 富文本模式：MaterialStrip 插入走 PromptInput 上抛的能力；否则兼容旧回调（提取 label 字符串）
  const insertAssetRef = React.useRef(null)
  const handleInsert = (asset) => {
    if (richText && typeof insertAssetRef.current === 'function') {
      insertAssetRef.current(asset)
    } else {
      const label = typeof asset === 'string' ? asset : (asset && asset.label) || ''
      onInsert?.(label)
    }
  }
  return (
    <FullscreenModal open={open} onClose={onClose} showHeader={false} autoHeight maxWidth={maxWidth} widthRatio={widthRatio}>
      {/* 右上角「缩小」按钮：点击即关闭 */}
      <button
        className="absolute top-3 right-3 z-10 p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded transition-colors"
        onClick={onClose}
        title="缩小"
      >
        <Minimize2 size={16} />
      </button>

      <div className="flex flex-col gap-2">
        {showMaterials && (
          <MaterialStrip images={refImages} texts={refTexts} onInsert={handleInsert} onDisconnect={onDisconnect} />
        )}
        {richText ? (
          <PromptInput
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            refImages={refImages}
            refTexts={refTexts}
            onInsert={onInsert}
            onReady={(fn) => { insertAssetRef.current = fn }}
            inputHeight={538}
            richText
          />
        ) : (
          <textarea
            autoFocus
            className="w-full h-[538px] min-h-0 bg-transparent text-primary outline-none custom-scrollbar resize-none rounded"
            style={{ fontSize: '14px', lineHeight: 1.8, color: 'rgb(var(--mao-text-primary))' }}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </FullscreenModal>
  )
}
