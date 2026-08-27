import React, { useState, useRef, useCallback, forwardRef } from 'react'
import { X } from 'lucide-react'
import { useOutsideClick } from './hooks.js'
import LazyImage from './LazyImage.jsx'
import {
  isChipEl,
  ensureCaretSlotBeforeChip,
  normalizeChipSlots,
  serializeDOM,
  buildChipEl,
  renderPromptToNodes,
} from './promptChips.js'

/**
 * 提示词输入区（富文本 contentEditable + @素材芯片，或旧版 textarea）。
 *
 * - `richText`（默认 false）：false → 旧版 textarea 行为（纯文本，@ 弹层追加 @名）；
 *   true → 富文本 contentEditable，@素材 渲染成「文字 + 小图」芯片，
 *   序列化为 `@{id:label}` 字符串。
 *
 * 按「先只升生图节点试水」：仅 PromptNode 传 richText，其余节点（TextNode 等）保持 textarea，
 * 零影响。对外接口（value/onChange/placeholder/refImages/refTexts/onInsert/
 * inputWidth/inputHeight/onReady）两种模式一致。
 *
 * onInsert 收到素材对象形如 { id, label, url?, kind }；旧式字符串 name 兼容为
 * { id:name, label:name, kind:'text' }。
 *
 * 尺寸管理：width/height 由 props inputWidth/inputHeight 驱动；ref 透传父级供手柄拖拽。
 *
 * 富文本关键交互（复刻参考仓库 MentionEditor）：
 *  - @ 触发候选弹层；选中插入芯片；
 *  - Backspace/Delete 整颗删除芯片；
 *  - Shift+Enter 手动插 <br> 换行；中文输入法组合中不误触；
 *  - 粘贴只取纯文本；外部 value 变化重建 DOM 并保存/恢复光标。
 */
const PromptInput = forwardRef(function PromptInput(
  {
    value,
    onChange,
    placeholder = '',
    refImages = [],
    refTexts = [],
    onInsert,
    onReady,          // 可选（富文本模式）：挂载后把「光标处插入素材」的函数上抛给父级
    inputWidth,
    inputHeight,
    richText = false  // true → 富文本芯片；false → 旧版 textarea
  },
  ref
) {
  // 素材候选统一形态（两种模式共用弹层）
  const all = [
    ...refImages.map((i, idx) => ({
      id: i.id ?? `img-${idx}`,
      label: i.label || `图片${idx + 1}`,
      url: i.url,
      kind: 'image',
    })),
    ...refTexts.map((t, idx) => ({
      id: t.id ?? `text-${idx}`,
      label: t.label || `文本${idx + 1}`,
      kind: 'text',
    })),
  ]

  const [showMention, setShowMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0) // 候选列表当前高亮项（键盘上下键导航）
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 }) // 弹层跟随光标位置

  // 过滤后的候选列表（mentionQuery 为空则全部）。声明在 handleKeyDown 之前，避免 TDZ。
  const filtered = mentionQuery
    ? all.filter((m) => m.label.toLowerCase().includes(mentionQuery.trim().toLowerCase()))
    : all

  // 弹层关闭时清空 activeIndex/mentionQuery，避免下次打开残留
  React.useEffect(() => {
    if (!showMention) {
      setActiveIndex(0)
      setMentionQuery('')
    }
  }, [showMention])

  // ────────────────────────────────────────────────────────────────
  // 旧版 textarea 模式（richText=false）
  // ────────────────────────────────────────────────────────────────
  const inputRef = useRef(null)
  const textareaWrapRef = useRef(null)
  const setTextareaRef = (el) => {
    inputRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }
  useOutsideClick(textareaWrapRef, showMention, () => setShowMention(false))
  const insertText = (name) => {
    onInsert?.(name)
    setShowMention(false)
  }
  const renderTextareaMode = () => (
    <div className="flex items-start gap-2">
      <div ref={textareaWrapRef} className="flex-1 relative shrink-0">
        <textarea
          ref={setTextareaRef}
          className="w-full bg-transparent text-base-sm text-primary outline-none leading-relaxed placeholder-muted-2 font-sans custom-scrollbar nodrag nowheel nopan resize-none"
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
            className="absolute bottom-[calc(100%+4px)] left-0 w-56 bg-surface-1 border border-edge-muted rounded-lg shadow-2xl z-suggest flex flex-col overflow-hidden h-[300px] nopan"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2">
              <span className="text-caption-sm text-secondary flex items-center gap-2">可能@的内容</span>
              <button className="text-muted hover:text-white p-1" onClick={() => setShowMention(false)}>
                <X size={12} />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag">
              {all.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-2 gap-2">
                  <span className="text-caption-sm">暂无素材</span>
                  <span className="text-caption">上传素材后可用 @ 引用</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {all.map((item) => (
                    <div
                      key={item.id}
                      className="aspect-square bg-surface-black rounded border border-edge hover:border-blue-500 cursor-pointer overflow-hidden relative group flex flex-col"
                      onClick={() => insertText(item.label)}
                    >
                      {item.url ? (
                        <LazyImage src={item.url} alt="" className="w-full h-full" />
                      ) : (
                        <div className="w-full h-full bg-surface-1 flex flex-col items-center justify-center p-1 text-center">
                          <span className="text-2xs text-secondary truncate w-full">{item.label}</span>
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

  // ────────────────────────────────────────────────────────────────
  // 富文本 contentEditable 模式（richText=true）
  // ────────────────────────────────────────────────────────────────
  const editorRef = useRef(null)
  const wrapRef = useRef(null)
  const savedRangeRef = useRef(null)
  const syncingRef = useRef(false)
  useOutsideClick(wrapRef, showMention, () => setShowMention(false))

  const setEditorRef = (el) => {
    editorRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  const saveCursor = useCallback((root) => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return 0
    const range = sel.getRangeAt(0)
    if (!root.contains(range.startContainer)) return 0
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
    let offset = 0
    let node
    while ((node = walker.nextNode())) {
      if (node === range.startContainer) return offset + range.startOffset
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentElement?.closest('[data-ref-id]')) continue
        offset += (node.textContent || '').length
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.hasAttribute('data-ref-id')) offset += 1
      }
    }
    return offset
  }, [])

  const restoreCursor = useCallback((root, offset) => {
    const sel = window.getSelection()
    if (!sel) return
    const range = document.createRange()
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL)
    let count = 0
    let node
    while ((node = walker.nextNode())) {
      let nodeLen = 0
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentElement?.closest('[data-ref-id]')) continue
        nodeLen = (node.textContent || '').length
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.hasAttribute('data-ref-id')) nodeLen = 1
      }
      if (count + nodeLen >= offset) {
        range.setStart(node, offset - count)
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        return
      }
      count += nodeLen
    }
    range.selectNodeContents(root)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }, [])

  const emitDOM = useCallback(() => {
    const el = editorRef.current
    if (!el || syncingRef.current) return
    onChange?.(serializeDOM(el))
  }, [onChange])

  // 外部 value 变化 → 重建 DOM（仅不一致时）
  React.useEffect(() => {
    const el = editorRef.current
    if (!el) return
    normalizeChipSlots(el)
    if (serializeDOM(el) === value) return
    const sel = window.getSelection()
    const cursor = sel && sel.rangeCount ? saveCursor(el) : null
    syncingRef.current = true
    el.innerHTML = ''
    for (const node of renderPromptToNodes(value || '', null)) el.appendChild(node)
    normalizeChipSlots(el)
    syncingRef.current = false
    if (cursor !== null) restoreCursor(el, cursor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const deleteChipNearCursor = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return
    const node = range.startContainer
    const offset = range.startOffset
    if (node.nodeType === Node.TEXT_NODE && offset === 0 && isChipEl(node.previousSibling)) {
      node.previousSibling.remove()
      return true
    }
    if (node.nodeType === Node.ELEMENT_NODE && offset > 0 && isChipEl(node.childNodes[offset - 1])) {
      node.childNodes[offset - 1].remove()
      return true
    }
    if (node.nodeType === Node.TEXT_NODE && offset === (node.textContent || '').length && isChipEl(node.nextSibling)) {
      node.nextSibling.remove()
      return true
    }
    return false
  }, [])

  // 计算「@」相对输入框容器的像素位置（用于弹层跟随光标）
  const getCaretPos = useCallback(() => {
    const el = editorRef.current
    const wrap = wrapRef.current
    if (!el || !wrap) return { top: 0, left: 0 }
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return { top: 0, left: 0 }
    const range = sel.getRangeAt(0)
    // 通过临时 range 定位到「@」字符处，让弹层贴近触发点而非光标末尾
    let rect = null
    if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
      const text = range.startContainer.textContent || ''
      const cursorPos = range.startOffset
      const atIdx = text.slice(0, cursorPos).lastIndexOf('@')
      if (atIdx >= 0) {
        const r = document.createRange()
        r.setStart(range.startContainer, atIdx)
        r.setEnd(range.startContainer, atIdx + 1)
        rect = r.getBoundingClientRect()
      }
    }
    if (!rect) rect = range.getBoundingClientRect()
    // 取编辑区当前行高，弹层顶边对齐「@」所在行的下一行，精确贴合光标
    const cs = window.getComputedStyle(el)
    const lh = parseFloat(cs.lineHeight) || 24
    const wrapRect = wrap.getBoundingClientRect()
    return {
      top: rect.top - wrapRect.top + lh,
      left: rect.left - wrapRect.left,
    }
  }, [])

  const detectMention = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    normalizeChipSlots(el)
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node && node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      const cursorPos = range.startOffset
      const before = text.slice(0, cursorPos)
      const atIdx = before.lastIndexOf('@')
      const afterAt = atIdx >= 0 ? before.slice(atIdx + 1) : ''
      const inMention = atIdx >= 0
        && !afterAt.includes(' ')
        && !afterAt.includes('\n')
        && !afterAt.includes('{')
      if (inMention) {
        setMentionQuery(afterAt)
        setShowMention(true)
        setActiveIndex(0)
        setMentionPos(getCaretPos())
        savedRangeRef.current = range.cloneRange()
      } else if (showMention) {
        setShowMention(false)
      }
    } else if (showMention) {
      setShowMention(false)
    }
  }, [showMention, getCaretPos])

  const insertChipAtCursor = useCallback(
    (item) => {
      const el = editorRef.current
      if (!el) return
      const sel = window.getSelection()
      let range = sel && sel.rangeCount ? sel.getRangeAt(0) : null
      if (!range || !el.contains(range.startContainer)) {
        range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        if (sel) { sel.removeAllRanges(); sel.addRange(range) }
      }
      const chip = buildChipEl(item.id, item.label, item.kind, item.url)
      range.insertNode(chip)
      ensureCaretSlotBeforeChip(chip)
      range.setStartAfter(chip)
      range.collapse(true)
      if (sel) { sel.removeAllRanges(); sel.addRange(range) }
      emitDOM()
    },
    [emitDOM]
  )

  const handleSelectMention = useCallback(
    (item) => {
      const sel = window.getSelection()
      const saved = savedRangeRef.current
      savedRangeRef.current = null
      if (sel && saved) { sel.removeAllRanges(); sel.addRange(saved) }
      const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null
      if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
        const cursor = range.startOffset
        const text = range.startContainer.textContent || ''
        const atIdx = text.slice(0, cursor).lastIndexOf('@')
        if (atIdx >= 0) {
          const del = document.createRange()
          del.setStart(range.startContainer, atIdx)
          del.setEnd(range.startContainer, cursor)
          del.deleteContents()
          del.collapse(true)
          if (sel) { sel.removeAllRanges(); sel.addRange(del) }
        }
      }
      insertChipAtCursor(item)
      setShowMention(false)
      setMentionQuery('')
    },
    [insertChipAtCursor]
  )

  const handleExternalInsert = useCallback(
    (payload) => {
      const item = typeof payload === 'string'
        ? { id: payload, label: payload, kind: 'text' }
        : payload
      if (item && typeof item === 'object' && item.id) {
        insertChipAtCursor(item)
      } else {
        onInsert?.(payload)
      }
      setShowMention(false)
    },
    [insertChipAtCursor, onInsert]
  )

  React.useEffect(() => {
    onReady?.(handleExternalInsert)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.nativeEvent.isComposing) return
      if (e.key.startsWith('Arrow') && editorRef.current) normalizeChipSlots(editorRef.current)
      // 候选弹层打开时：上下键切换高亮（拦截以免在内容区里移动光标）
      if (showMention && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        if (filtered.length > 0) {
          e.preventDefault()
          setActiveIndex((i) => {
            const max = filtered.length - 1
            if (e.key === 'ArrowDown') return i >= max ? 0 : i + 1
            return i <= 0 ? max : i - 1
          })
          return
        }
      }
      if (showMention && e.key === 'Enter' && !e.shiftKey) {
        if (filtered.length > 0) {
          e.preventDefault()
          const idx = Math.min(activeIndex, filtered.length - 1)
          handleSelectMention(filtered[idx])
          return
        }
      }
      if (showMention && e.key === 'Escape') {
        e.preventDefault()
        setShowMention(false)
        return
      }
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        const sel = window.getSelection()
        if (!sel || !sel.rangeCount) return
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const br = document.createElement('br')
        range.insertNode(br)
        const next = br.nextSibling
        if (!next) {
          const filler = document.createElement('br')
          br.parentNode?.insertBefore(filler, null)
          range.setStartBefore(filler)
        } else {
          range.setStartAfter(br)
        }
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        emitDOM()
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (deleteChipNearCursor()) {
          e.preventDefault()
          emitDOM()
          return
        }
      }
    },
    [showMention, mentionQuery, filtered, activeIndex, handleSelectMention, deleteChipNearCursor, emitDOM]
  )

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault()
      const plain = e.clipboardData.getData('text/plain')
      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) return
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(plain))
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
      emitDOM()
    },
    [emitDOM]
  )

  const renderRichMode = () => (
    <div className="flex items-start gap-2">
      <div ref={wrapRef} className="flex-1 relative shrink-0">
        <div
          ref={setEditorRef}
          contentEditable
          suppressContentEditableWarning
          className="w-full bg-transparent text-base-sm text-primary outline-none leading-relaxed font-sans custom-scrollbar nodrag nowheel nopan resize-none"
          style={{
            width: inputWidth ? `${inputWidth}px` : undefined,
            height: inputHeight ? `${inputHeight}px` : '80px',
            minHeight: '80px',
            overflow: 'auto',
            lineHeight: 1.625,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
          onInput={(e) => { detectMention(e); emitDOM() }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={emitDOM}
        />
        {!value && (
          <span
            className="pointer-events-none absolute top-0 left-0 text-base-sm text-muted-2"
            style={{ lineHeight: 1.625, paddingTop: '1px' }}
            aria-hidden="true"
          >
            {placeholder}
          </span>
        )}
        {showMention && (
          <div
            className="absolute w-48 bg-surface-1 border border-edge-muted rounded-lg shadow-2xl z-suggest flex flex-col overflow-hidden max-h-[300px] nopan"
            style={{ top: mentionPos.top, left: mentionPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2">
              <span className="text-caption-sm text-secondary flex items-center gap-2">可能@的内容</span>
              <button className="text-muted hover:text-white p-1" onClick={() => setShowMention(false)}>
                <X size={12} />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-2 gap-2 py-4">
                  <span className="text-caption-sm">暂无素材</span>
                  <span className="text-caption">上传素材后可用 @ 引用</span>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {filtered.map((item, i) => {
                    const active = i === activeIndex
                    return (
                      <div
                        key={item.id}
                        data-mention-active={active || undefined}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${active ? 'bg-blue-500/25 text-white' : 'hover:bg-edge text-body'}`}
                        onMouseEnter={() => setActiveIndex(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectMention(item)}
                      >
                        {/* 缩略图：40px 方形圆角，图片素材显示缩略，文本素材显示 @ 图标 */}
                        <div className="w-9 h-9 rounded-md overflow-hidden bg-surface-black shrink-0 flex items-center justify-center">
                          {item.kind === 'image' && item.url ? (
                            <LazyImage src={item.url} alt="" className="w-full h-full" />
                          ) : (
                            <span className="text-secondary text-base">@</span>
                          )}
                        </div>
                        {/* 标签 */}
                        <span className="text-base-sm truncate flex-1">{item.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return richText ? renderRichMode() : renderTextareaMode()
})

export default PromptInput