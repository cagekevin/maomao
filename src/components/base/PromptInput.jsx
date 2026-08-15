import React, { useState, useRef, forwardRef } from 'react'
import { X, Link as LinkIcon } from 'lucide-react'
import { useOutsideClick } from './hooks.js'

/**
 * 提示词输入区（复刻各节点 contentEditable 提示词 + @素材弹层）。
 *
 * 用 textarea 模拟，支持输入 @ 触发素材引用弹层。
 *
 * 尺寸管理（复刻 Co.jsx:407-412 官方 inputWidth/inputHeight 机制）：
 *  - textarea 的 width/height 由 props `inputWidth`/`inputHeight` 驱动（来自 node data）
 *  - 拖拽手柄 onResizeEnd(w,h) → 父节点写回 node.data.inputWidth/inputHeight → 重新传入
 *  - 未拖过时 height 默认 80px（与官方一致）
 *
 * ref 透传（用 callback ref，避免 React.StrictMode 下 useImperativeHandle 时序陷阱）：
 * 父级传入的 ref.current 直接指向 textarea DOM，供面板右下角手柄做 targetRef 拖拽。
 *
 * @param props
 *  - value           提示词
 *  - onChange        提示词变化
 *  - placeholder
 *  - refImages       参考图片素材 [{ id, url, label }]
 *  - refTexts        参考文本素材 [{ id, label, text }]
 *  - onInsert        插入素材引用（回调：name => void）
 *  - inputWidth      输入框宽度（来自 node.data.inputWidth，可选）
 *  - inputHeight     输入框高度（来自 node.data.inputHeight，可选）
 */
const PromptInput = forwardRef(function PromptInput(
  {
    value,
    onChange,
    placeholder = '',
    refImages = [],
    refTexts = [],
    onInsert,
    inputWidth,
    inputHeight
  },
  ref
) {
  const [showMention, setShowMention] = useState(false)
  const inputRef = useRef(null)
  const mentionRef = useRef(null)

  // callback ref：实时同步 textarea DOM 给父级（StrictMode 安全）
  const setTextareaRef = (el) => {
    inputRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  // @素材弹层打开时点击外部自动关闭（公共 hook，见 hooks.js）
  useOutsideClick(mentionRef, showMention, () => setShowMention(false))

  const all = [
    ...refImages.map((i, idx) => ({ ...i, name: `图片${idx + 1}` })),
    ...refTexts.map((t, idx) => ({ ...t, name: `文本${idx + 1}` }))
  ]

  const insert = (name) => {
    onInsert?.(name)
    setShowMention(false)
  }

  return (
    <div className="flex items-start gap-2">
      <div ref={mentionRef} className="flex-1 relative shrink-0">
        <textarea
          ref={setTextareaRef}
          className="w-full bg-transparent text-base-sm text-gray-200 outline-none leading-relaxed placeholder-gray-600 font-sans custom-scrollbar nodrag nowheel nopan resize-none"
          style={{
            width: inputWidth ? `${inputWidth}px` : undefined,
            height: inputHeight ? `${inputHeight}px` : '80px',
            minHeight: '80px',
            overflow: 'auto',
            lineHeight: 1.625
          }}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onWheel={(e) => e.stopPropagation()}
        />

        {showMention && (
          <div
            className="absolute bottom-[calc(100%+4px)] left-0 w-72 bg-surface-1 border border-edge-muted rounded-lg shadow-2xl z-suggest flex flex-col overflow-hidden h-[300px] nopan"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-edge bg-surface">
              <span className="text-xs text-gray-300 font-bold flex items-center gap-2">选择素材引用</span>
              <button className="text-gray-500 hover:text-white p-1" onClick={() => setShowMention(false)}>
                <X size={12} />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag">
              {all.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2">
                  <span className="text-caption-sm">暂无素材</span>
                  <span className="text-caption">上传图片或连接其他节点后可用 @ 引用</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {all.map((item) => (
                    <div
                      key={item.id}
                      className="aspect-square bg-surface-black rounded border border-edge hover:border-blue-500 cursor-pointer overflow-hidden relative group flex flex-col"
                      onClick={() => insert(item.name)}
                    >
                      {item.url ? (
                        <img src={item.url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full bg-surface-1 flex flex-col items-center justify-center p-1 text-center">
                          <LinkIcon size={16} className="text-blue-400 opacity-80 mb-1" />
                          <span className="text-2xs text-gray-400 truncate w-full">{item.label}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-caption text-white">选择</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default PromptInput