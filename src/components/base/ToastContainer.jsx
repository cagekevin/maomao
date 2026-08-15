import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { subscribe, getToasts, dismissToast } from './toastStore.js'

/**
 * 统一通知渲染容器（配合 toastStore 使用）。
 *
 * 【用法】
 * App 根挂一次：<ToastContainer />  （默认顶部居中）
 * 之后任何组件 showToast() 即可弹出，无需再挂。
 *
 * 【位置决策】
 * 固定在「正上方居中」（top-center）。右上角/右下角将来可能放别的东西（任务列表等），
 * 顶部居中不影响它们，也是用户确认的落点。
 *
 * 【视觉（对齐 doc39 §3.2 状态色模板）】
 *  - success 绿 / error 红 / warning 黄 / info 蓝，填充 /10 + 描边 /30 + 柔光；
 *  - 多条纵向堆叠，自动消失。
 */
export default function ToastContainer() {
  const [items, setItems] = useState(getToasts())
  const timers = useRef(new Map())

  // 订阅 store 变化
  useEffect(() => subscribe(() => setItems(getToasts())), [])

  // 每条 toast 自动消失：duration>0 时到点 dismiss（计时放在渲染侧，避免 store 持有 timer）
  useEffect(() => {
    items.forEach((t) => {
      if (t.duration <= 0) return
      if (timers.current.has(t.id)) return
      timers.current.set(t.id, setTimeout(() => dismissToast(t.id), t.duration))
    })
    // 清理已消失的 timer
    const alive = new Set(items.map((t) => t.id))
    timers.current.forEach((timer, id) => {
      if (!alive.has(id)) { clearTimeout(timer); timers.current.delete(id) }
    })
  }, [items])

  // 关闭某条（手动）
  const close = useCallback((id) => dismissToast(id), [])

  if (typeof document === 'undefined') return null
  if (items.length === 0) return null

  const ICONS = {
    success: <CheckCircle2 size={16} className="text-emerald-300" />,
    error: <XCircle size={16} className="text-rose-300" />,
    warning: <AlertTriangle size={16} className="text-amber-300" />,
    info: <Info size={16} className="text-blue-300" />,
  }
  // doc39 §3.2 状态色模板（/10 填充 + /30 描边 + 20px/0.15 柔光）
  const COLORS = {
    success: 'from-green-500/10 to-emerald-500/10 border-green-500/30 shadow-glow-success',
    error: 'from-red-500/10 to-rose-500/10 border-red-500/30 shadow-glow-error',
    warning: 'from-yellow-500/10 to-amber-500/10 border-yellow-500/30 shadow-glow-warning',
    info: 'from-blue-500/10 to-indigo-500/10 border-blue-500/30 shadow-glow-info',
  }

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-ceiling-1 flex flex-col items-center gap-2 pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-gradient-to-b ${COLORS[t.type] || COLORS.info} text-gray-200 text-sm shadow-xl backdrop-blur-sm animate-slide-up`}
        >
          {ICONS[t.type] || ICONS.info}
          <span className="whitespace-nowrap">{t.message}</span>
          <button type="button" className="ml-1 text-gray-400 hover:text-white transition-colors" onClick={() => close(t.id)} title="关闭">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
