import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { subscribeConfirm, getConfirm, resolveConfirm } from './confirmStore.ts'
import type { ConfirmRequest } from './confirmStore.ts'

/**
 * 统一确认弹窗渲染容器（配合 confirmStore 使用）。
 *
 * 【用法】
 * App 根挂一次：<ConfirmContainer />
 * 之后任何模块 `await askConfirm({ title })` 即可拿到用户选择，无需再挂、无需传参。
 *
 * 【层级决策】z-ceiling-2(2147483646)
 * 必须高于 Toast(ceiling-1 2147483645)——确认框是模态，弹出时提示不该压在它之上；
 * 与全屏弹窗（FullscreenModal / DepthVideoModal 同为 ceiling-2）同级，正常互斥出现。
 *
 * 【交互】
 *  - 遮罩点击 / Esc / 取消按钮 → resolve(false)；
 *  - 确认按钮 → resolve(true)；danger 时转红色，提示这是不可逆的覆盖/删除。
 */
function ConfirmContainer() {
  const [request, setRequest] = useState<ConfirmRequest | null>(getConfirm())
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null)

  // 订阅 store 变化（组件卸载时退订，避免订阅者集合滞留）
  useEffect(() => {
    const unsubscribe = subscribeConfirm(() => setRequest(getConfirm()))
    return () => { unsubscribe() }
  }, [])

  // Esc = 取消（与遮罩点击同义，避免键盘用户被困在弹窗里）
  useEffect(() => {
    if (!request) return undefined
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); resolveConfirm(false) }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [request])

  // 弹出后聚焦确认按钮（空格/回车即可确认，键盘可达）
  useEffect(() => {
    if (request) confirmBtnRef.current?.focus()
  }, [request])

  const onCancel = useCallback(() => resolveConfirm(false), [])
  const onConfirm = useCallback(() => resolveConfirm(true), [])

  if (typeof document === 'undefined') return null
  if (!request) return null

  const items = Array.isArray(request.items) ? request.items.filter(Boolean) : []

  return createPortal(
    <div
      className="fixed inset-0 z-ceiling-2 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onCancel}
      onContextMenu={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={request.title}
    >
      <div
        className="w-full max-w-md bg-surface-raised border border-edge rounded-xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部：图标 + 标题（danger 用琥珀警示色，对齐 ToastContainer 的 status 色语义） */}
        <div className="flex items-start gap-2 px-4 pt-4 pb-2">
          {request.danger && <AlertTriangle size={14} className="text-amber-300 mt-0.5 shrink-0" />}
          <div className="text-white text-body-sm font-medium leading-relaxed">{request.title}</div>
        </div>

        {request.message && (
          <div className="px-4 pb-2 text-secondary text-caption leading-relaxed">{request.message}</div>
        )}

        {/* 受影响条目清单：覆盖类操作必须让用户看见「到底动了哪些」 */}
        {items.length > 0 && (
          <ul className="mx-4 mb-2 px-2 py-1.5 rounded-lg bg-surface border border-edge max-h-40 overflow-y-auto">
            {items.map((label) => (
              <li key={label} className="text-secondary text-caption leading-relaxed py-0.5 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-edge-strong shrink-0" />
                <span className="truncate">{label}</span>
              </li>
            ))}
          </ul>
        )}

        {/* 操作区 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-edge">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-caption text-secondary hover:text-white hover:bg-surface-hover-strong transition-colors cursor-pointer border border-edge bg-transparent"
          >
            {request.cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-lg text-caption font-medium transition-colors cursor-pointer border ${
              request.danger
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-200 hover:bg-rose-500/30'
                : 'bg-white border-white text-black hover:bg-white/90'
            }`}
          >
            {request.confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default React.memo(ConfirmContainer)
