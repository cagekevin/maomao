import React, { useState, useRef, useCallback, forwardRef, ForwardedRef } from 'react'
import { createPortal } from 'react-dom'
import { useOutsideClick } from '../core/uiHooks.ts'
import LazyImage from '../ui/LazyImage.tsx'
import {
  isChipEl,
  ensureCaretSlotBeforeChip,
  normalizeChipSlots,
  serializeDOM,
  buildChipEl,
  renderPromptToNodes,
  autoLinkAssetsByName,
} from './promptChips.ts'
import {
  detectMentionQuery,
  computeMentionPlacement,
  MENTION_PANEL_W,
} from './promptMention.ts'

/**
 * 提示词输入区（富文本 contentEditable + @素材芯片）。
 *
 * - 所有调用方均传 richText（4 个节点 + 全屏编辑器），旧 textarea 分支为死代码，已删除。
 * - 对外接口（value/onChange/placeholder/refImages/refTexts/onInsert/onReady/
 *   inputWidth/inputHeight）保持不变；新增可选 portalTarget。
 *
 * @候选弹层（核心交互）：
 *  - 触发判定走 promptMention.detectMentionQuery（邮箱 abc@、超长、带标点不弹）；
 *  - 定位走 promptMention.computeMentionPlacement：默认「向上弹、底边贴 @ 行上方 4px」，
 *    空间不足自动翻转到下方；坐标始终取「@」字符矩形而非光标矩形（含芯片行不再偏 3~4px）；
 *  - portal 到 body + fixed + z-popover（默认），跳出节点层叠上下文 → 不被相邻节点盖住、
 *    不随画布缩放；全屏编辑器内传 portalTarget={null} 走内联 absolute（弹窗本身已是最顶层）。
 *  - 方向键上下切换高亮、Enter 选中、Esc 关闭（同一 @ 不再重弹）、失焦/点外部关闭、IME 组字中不判定。
 */
interface PromptInputProps {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  refImages?: Array<{ id?: string; label?: string; url?: string }>
  refTexts?: Array<{ id?: string; label?: string; url?: string }>
  onInsert?: (item: { kind: 'image' | 'text'; url?: string; label?: string }) => void
  onReady?: (fn: (item: unknown) => void) => void
  inputWidth?: number | string
  inputHeight?: number | string
  autoFocus?: boolean
  portalTarget?: HTMLElement | null
  richText?: boolean
}

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
    autoFocus = false, // 挂载后自动聚焦并把光标放到末尾（仅全屏弹窗等主动打开的场景传 true）
    portalTarget = document.body // null → 全屏弹窗内保持内联；默认 portal 到 body
  }: PromptInputProps,
  ref: ForwardedRef<HTMLDivElement>
) {
  // 素材候选统一形态
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
      url: t.url,
      kind: 'text',
    })),
  ]

  const [showMention, setShowMention] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0) // 候选列表当前高亮项（键盘上下键导航）
  const [mentionPos, setMentionPos] = useState(null) // { placement, left, top?, bottom?, height }

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

  const editorRef = useRef<HTMLDivElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const popRef = useRef(null)
  const savedRangeRef = useRef(null)
  const syncingRef = useRef(false)
  const composingRef = useRef(false)      // 中文输入法组字中
  const mentionAtRef = useRef(-1)         // 本次弹层对应的 @ 下标（Esc 后据此不再重弹）
  const dismissedAtRef = useRef(-1)       // 被 Esc 关闭的 @ 下标

  // portal 出去后弹层不在 wrap 内，须把 popRef 一并纳入「内部」判定。
  // useMemo 固定数组引用，避免每次渲染让 useOutsideClick 重复挂/卸监听。
  const outsideRefs = React.useMemo(() => [wrapRef, popRef], [])
  useOutsideClick(outsideRefs, showMention, () => setShowMention(false))

  const setEditorRef = (el) => {
    editorRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  // ⚠️ 返回 null 表示「本编辑器不持有光标，重建后不要动 selection」。
  // 全屏弹窗打开时，节点面板里那个 PromptInput 仍在挂载且与弹窗共用同一个 value：
  // 在弹窗里每敲一个字 → value 变 → 面板那个实例也走「外部 value 变化 → 重建 DOM」分支。
  // 它若照旧返回 0 并 restoreCursor(el, 0)，就会把全局 selection 抢到自己内部，
  // 光标瞬间跳出全屏编辑器 → 后面的字全打进面板那个隐藏输入框（表现为「一写字光标就错乱」）。
  const saveCursor = useCallback((root) => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return null
    const range = sel.getRangeAt(0)
    if (!root.contains(range.startContainer)) return null
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

  // refImages/refTexts → metaMap（id → {kind,url,label}），作为缩略图恢复 + 最新名的兜底来源。
  // 序列化的字符串已自带缩略图 URL 与 label，此处仅在字符串缺缩略图（旧数据/刚插入）或
  // 「上游改名」时补最新信息——改名后字符串里仍是旧 label，metaMap 里是当前最新名。
  const chipMetaMap = React.useMemo(() => {
    const m = new Map()
    for (const im of refImages || []) {
      if (im && im.id) m.set(im.id, { kind: 'image', url: im.url, label: im.label })
    }
    for (const t of refTexts || []) {
      if (t && t.id && !m.has(t.id)) m.set(t.id, { kind: 'text', label: t.label })
    }
    return m
  }, [refImages, refTexts])

  // 名字签名：把素材的 label 拼成签名，改名 → label 变 → 签名变 → 才触发 @名 自动转芯片重转换。
  // 用「名字签名」而非直接依赖 all 数组：all 每次 render 新建，裸依赖会每次渲染重跑（浪费）。
  // nameSignature 用 \u0001（控制字符）连接，杜绝 label 内容冲突。
  const nameSignature = React.useMemo(
    () => [...(refImages || []).map((i) => i.label || ''), ...(refTexts || []).map((t) => t.label || '')].join('\u0001'),
    [refImages, refTexts]
  )
  // 素材 id 签名：跟踪 refImages/refTexts 的 id 集合，用于侦测「某素材已从素材列表消失
  //（如上游节点被断开/删除）」，从而把富文本里引用它的芯片一并清掉。用 \u0002 连接防冲突。
  const refIdsSignature = React.useMemo(
    () => [...(refImages || []).map((i) => i.id || ''), ...(refTexts || []).map((t) => t.id || '')].join('\u0002'),
    [refImages, refTexts]
  )

  // 外部 value 变化 / 素材名字变化 → 重建 DOM。
  // 重建前先 autoLinkAssetsByName 把「@素材名」转成 @{id:label|thumb} 芯片字符串，
  // 使「已输入的 @名」在改名后自动变成缩略图芯片。
  // 短路条件：value 与 DOM 一致 且 素材名字未变 才跳过——名字变了时 DOM 里的芯片
  // 仍显示旧名，必须强制重建（用 metaMap 里的最新名覆盖，见 renderPromptToNodes）。
  const prevNameSigRef = useRef(nameSignature)
  React.useEffect(() => {
    const el = editorRef.current
    if (!el) return
    normalizeChipSlots(el)
    const nameChanged = prevNameSigRef.current !== nameSignature
    prevNameSigRef.current = nameSignature
    if (!nameChanged && serializeDOM(el) === value) return
    // 光标不在本编辑器内（如焦点正在全屏弹窗里）→ 只重建 DOM，绝不碰 selection
    const cursor = saveCursor(el)
    syncingRef.current = true
    el.innerHTML = ''
    for (const node of renderPromptToNodes(autoLinkAssetsByName(value || '', all), chipMetaMap)) el.appendChild(node)
    normalizeChipSlots(el)
    syncingRef.current = false
    if (cursor !== null) restoreCursor(el, cursor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, chipMetaMap, nameSignature])

  // 素材消失清理：某素材 id 从 refImages/refTexts 中消失（典型：点素材缩略图红 × 断开上游连线）
  // → 把富文本里引用它的 @芯片 一并移除并写回，避免缩略图残留在富文本里指向已断上游。
  // 说明：value 序列化字符串里芯片自带缩略图 URL（@{id:label|thumb}），只靠重建 DOM 不会消失，
  // 必须按 id 命中后删除 DOM 芯片并经 emitDOM 同步回 value。
  const prevRefIdsSigRef = useRef(refIdsSignature)
  React.useEffect(() => {
    const el = editorRef.current
    const prevSig = prevRefIdsSigRef.current
    prevRefIdsSigRef.current = refIdsSignature
    if (!el || prevSig === refIdsSignature) return
    // 本次仍存在的 id 集合
    const remain = new Set(refIdsSignature.split('\u0002').filter(Boolean))
    // 上一份里存在、本次消失的 id
    const gone = prevSig.split('\u0002').filter((id) => id && !remain.has(id))
    if (gone.length === 0) return
    const goneSet = new Set(gone)
    let changed = false
    for (const chip of Array.from(el.querySelectorAll('[data-ref-id]'))) {
      const id = chip.getAttribute('data-ref-id')
      if (id && goneSet.has(id)) {
        chip.remove()
        changed = true
      }
    }
    if (changed) {
      normalizeChipSlots(el)
      emitDOM()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refIdsSignature])

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

  // 取「@」字符的视口矩形（fixed 弹层的锚点）；找不到时退回光标矩形。
  const getAtRect = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return null
    const range = sel.getRangeAt(0)
    let rect = null
    if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
      const text = range.startContainer.textContent || ''
      const atIdx = text.slice(0, range.startOffset).lastIndexOf('@')
      if (atIdx >= 0) {
        const r = document.createRange()
        r.setStart(range.startContainer, atIdx)
        r.setEnd(range.startContainer, atIdx + 1)
        rect = r.getBoundingClientRect()
      }
    }
    if (!rect) rect = range.getBoundingClientRect()
    return rect ? { top: rect.top, bottom: rect.bottom, left: rect.left } : null
  }, [])

  // 计算弹层位置：portal 模式用视口坐标（fixed）；内联模式换算成相对 wrap（absolute）。
  const computeMentionPos = useCallback(() => {
    const anchor = getAtRect()
    if (!anchor) return null
    if (portalTarget) {
      return computeMentionPlacement(anchor)
    }
    const wrap = wrapRef.current
    if (!wrap) return null
    const wrapRect = wrap.getBoundingClientRect()
    return computeMentionPlacement(
      {
        top: anchor.top - wrapRect.top,
        bottom: anchor.bottom - wrapRect.top,
        left: anchor.left - wrapRect.left,
      },
      { viewportW: wrapRect.width, viewportH: wrapRect.height }
    )
  }, [getAtRect, portalTarget])

  const detectMention = useCallback(() => {
    const el = editorRef.current
    if (!el || composingRef.current) return
    normalizeChipSlots(el)
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (!node || node.nodeType !== Node.TEXT_NODE) {
      if (showMention) setShowMention(false)
      return
    }
    const before = (node.textContent || '').slice(0, range.startOffset)
    const res = detectMentionQuery(before)
    if (res.active && all.length > 0) {
      if (res.atIndex === dismissedAtRef.current) return // Esc 后同一 @ 不再重弹
      dismissedAtRef.current = -1
      const pos = computeMentionPos()
      mentionAtRef.current = res.atIndex
      setMentionQuery(res.query)
      setActiveIndex(0)
      if (pos) setMentionPos(pos)
      savedRangeRef.current = range.cloneRange()
      setShowMention(true)
    } else if (showMention) {
      setShowMention(false)
    }
  }, [showMention, all.length, computeMentionPos])

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

  // 自动聚焦（对齐全屏弹窗里 textarea 分支的 autoFocus）：
  // 光标放末尾，避免落在开头导致「新输入插在最前面」。
  React.useEffect(() => {
    if (!autoFocus) return
    const el = editorRef.current
    if (!el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    if (sel) { sel.removeAllRanges(); sel.addRange(range) }
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
        e.stopPropagation() // 不冒泡给全屏弹窗，避免 Esc 同时关掉全屏
        dismissedAtRef.current = mentionAtRef.current
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

  const renderMentionPopup = () => {
    const popup = (
      <div
        ref={popRef}
        data-mention-portal
        data-mention-placement={mentionPos.placement}
        data-mention-count={filtered.length}
        className={`${portalTarget ? 'fixed z-popover' : 'absolute z-popover'} flex flex-col overflow-hidden rounded-lg border border-edge bg-surface-1 shadow-2xl nodrag nowheel nopan`}
        style={{
          width: MENTION_PANEL_W,
          left: mentionPos.left,
          top: mentionPos.top,
          bottom: mentionPos.bottom,
          maxHeight: mentionPos.height,
        }}
        onMouseDown={(e) => e.preventDefault()} // 保住编辑器焦点，避免 blur → 自杀式关闭
      >
        <div className="flex-1 overflow-y-auto custom-scrollbar nowheel nopan nodrag">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-caption text-muted">无匹配素材</div>
          ) : (
            <div className="flex flex-col gap-0.5 p-1">
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
                    {/* 缩略图：36px 方形圆角，图片素材显示缩略，文本素材显示 @ 图标 */}
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
    )
    return portalTarget ? createPortal(popup, portalTarget) : popup
  }

  return (
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
          onInput={(e) => {
            emitDOM()
            if (composingRef.current || e.nativeEvent.isComposing) return // 组字中不判定
            detectMention()
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { emitDOM(); setShowMention(false) }}
          onCompositionStart={() => { composingRef.current = true; setShowMention(false) }}
          onCompositionEnd={() => { composingRef.current = false }}
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
        {showMention && mentionPos && renderMentionPopup()}
      </div>
    </div>
  )
})

export default PromptInput
