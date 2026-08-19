/**
 * 共享「查看大图」弹层 —— 替代各图片节点里重复的 <dialog> 实现。
 *
 * 设计取舍：
 *  - 容器用原生 <dialog>（文档顶层、无 z-index 打架、Esc/点空白关闭稳定）。
 *  - 交互参考官方 1mao：滚轮缩放 + 拖拽平移。
 *    // 更新(2026-08)：关闭交互由「双击关闭」改为「点空白/关闭按钮关闭」——双击拖拽图时易误触关掉，
 *    //  原「双击关闭」的语义（官方 1mao 参考）保留不删，仅关闭触发方式变更。
 *  - 缩放/拖拽监听：wheel 用原生非被动监听确保 preventDefault 生效；
 *    拖拽用 window 级 pointermove/up（而非 setPointerCapture），避免捕获指针吞掉按钮点击。
 *  - 初始大小：图片以 max-w-full max-h-full object-contain 适配视口，scale=1 即适配大小。
 *  - 复制/下载按钮：网页沙箱无法唤起系统原生图片查看器菜单，故用应用内按钮
 *    复用 clipboard.js 的 copyImageToClipboard / downloadUrl。
 *
 * 用法：
 *  const zoomRef = useRef(null)
 *  <ImageZoomDialog ref={zoomRef} url={zoomUrl} />
 *  打开：zoomRef.current?.showModal()
 */
import { forwardRef, useState, useRef, useCallback, useEffect } from 'react'
import { toAbsoluteFileUrl } from './imageUrl.js'
import { copyImageToClipboard, downloadUrl } from './clipboard.js'
import { createRafBatch } from './utils.js'

const ImageZoomDialog = forwardRef(function ImageZoomDialog({ url }, ref) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const imgRef = useRef(null) // P10：拖拽期给 img 挂 will-change
  const [copied, setCopied] = useState(false)
  const [copyErr, setCopyErr] = useState(false)

  const setRef = useCallback((node) => {
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [ref])

  // 每次打开/换图重置缩放与位移
  useEffect(() => {
    if (url) {
      setScale(1)
      setOffset({ x: 0, y: 0 })
      setCopied(false)
      setCopyErr(false)
    }
  }, [url])

  // 原生 wheel 监听（非被动），确保缩放生效；P3：增量累计 + rAF 合并到每帧一次 setScale
  useEffect(() => {
    const node = typeof ref === 'function' ? null : ref?.current
    if (!node) return
    let pending = 0
    const batch = createRafBatch((delta) => {
      pending = 0
      setScale((s) => Math.min(Math.max(0.1, s + delta), 10))
    })
    const onWheel = (e) => {
      e.preventDefault()
      pending += -e.deltaY * 0.0015
      batch(pending)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      node.removeEventListener('wheel', onWheel)
      batch.cancel()
    }
  })

  // window 级拖拽，避免 setPointerCapture 吞掉按钮点击；P3：平移增量 rAF 合并 + P10 will-change
  useEffect(() => {
    let pending = { x: 0, y: 0 }
    const batch = createRafBatch((dx, dy) => {
      pending = { x: 0, y: 0 }
      setOffset((o) => ({ x: o.x + dx, y: o.y + dy }))
    })
    const onMove = (e) => {
      if (!dragging.current) return
      pending.x += e.clientX - lastPointer.current.x
      pending.y += e.clientY - lastPointer.current.y
      lastPointer.current = { x: e.clientX, y: e.clientY }
      batch(pending.x, pending.y)
    }
    const onUp = () => {
      dragging.current = false
      batch.flush() // 松手补最后一帧，避免差一帧
      if (imgRef.current) imgRef.current.style.willChange = '' // P10：拖拽结束移除
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      batch.cancel()
    }
  }, [])

  const onPointerDown = useCallback((e) => {
    dragging.current = true
    lastPointer.current = { x: e.clientX, y: e.clientY }
    // P10：拖拽期挂 will-change（transform 会被高频改写，提示浏览器提前建合成层）
    if (imgRef.current) imgRef.current.style.willChange = 'transform'
  }, [])

  const close = useCallback((e) => {
    const dlg = (e?.currentTarget)?.closest?.('dialog') || (typeof ref === 'function' ? null : ref?.current)
    dlg?.close?.()
  }, [ref])

  const handleCopy = useCallback(async () => {
    const abs = toAbsoluteFileUrl(url || '')
    const { ok } = await copyImageToClipboard(abs)
    if (ok) { setCopied(true); setCopyErr(false) } else { setCopyErr(true); setCopied(false) }
    setTimeout(() => { setCopied(false); setCopyErr(false) }, 2000)
  }, [url])

  const handleDownload = useCallback(async () => {
    const abs = toAbsoluteFileUrl(url || '')
    const name = (url || '').split('/').pop() || 'image.png'
    await downloadUrl(abs, name)
  }, [url])

  const src = url ? toAbsoluteFileUrl(url) : ''
  // 「点空白关闭」判断放内部容器 div（onClick）而非本 dialog：因容器 fixed inset-0 铺满覆盖本层，
  //   dialog 的 e.target===currentTarget 永远不成立（死代码）。语义：点非图片/非工具栏的空白区即关闭。

  return (
    <dialog
      ref={setRef}
      className="m-0 w-screen h-screen max-w-none max-h-none bg-black/85 border-0 p-0 backdrop:bg-black/85"
    >
      {src && (
        <div
          className="fixed inset-0 flex items-center justify-center overflow-hidden select-none"
          onPointerDown={onPointerDown}
          onClick={(e) => { if (e.target === e.currentTarget) close(e) }}
          style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
        >
          <img
            ref={imgRef}
            src={src}
            alt="大图"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragging.current ? 'none' : 'transform 0.08s ease-out',
              cursor: dragging.current ? 'grabbing' : 'grab',
            }}
            className="max-w-full max-h-full object-contain pointer-events-none"
            draggable={false}
          />

          {/* 右上角关闭 */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close(e) }}
            className="absolute top-4 right-4 z-[10000] text-white hover:text-gray-300 bg-black/50 p-2 rounded-full transition-colors"
            aria-label="关闭"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>

          {/* 底部工具栏：复制 / 下载 + 缩放提示 */}
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2 bg-black/55 backdrop-blur px-3 py-2 rounded-full text-white text-sm"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* 复制按钮：固定 min-w 让「复制图片/已复制/复制失败」三态切换不跳宽；成功态绿、失败态红橙 */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCopy() }}
              className={`px-3 py-1 rounded-full min-w-[88px] text-center transition-colors ${copied ? 'text-emerald-300 hover:bg-white/15' : copyErr ? 'text-red-300 hover:bg-white/15' : 'hover:bg-white/15'}`}
            >
              {copied ? '已复制 ✓' : copyErr ? '复制失败' : '复制图片'}
            </button>
            <span className="opacity-30">|</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDownload() }}
              className="px-3 py-1 rounded-full hover:bg-white/15 transition-colors"
            >
              下载
            </button>
            <span className="opacity-50 ml-1 hidden sm:inline">滚轮缩放 · 拖拽平移 · 点空白关闭</span>
          </div>
        </div>
      )}
    </dialog>
  )
})

export default ImageZoomDialog
