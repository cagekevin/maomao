import { useEffect } from 'react'

/**
 * 通用工具集中实现 —— 唯一入口，禁止散落手写替代。
 *
 * 约定：
 *  - deepClone / formatTime / debounce / throttle 一律从本文件 import
 *  - 业务代码禁止手写 `JSON.parse(JSON.stringify())`、`setTimeout` 防抖、时间格式化
 *  - ID 生成不在此，统一走 ./idGen.js 的 generateId
 */

/** JSON 深拷贝（通用业务对象；含函数/Date/循环引用者请勿用） */
export function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

/**
 * 时间格式化。opts：
 *  - 默认 `{ locale: 'zh-CN' }` → `new Date(ts).toLocaleString('zh-CN', { hour12: false })`（TaskCenter）
 *  - `{ mode: 'time' }` → HH:mm:ss（logger）
 *  - `{ mode: 'file' }` → yyyymmdd_HHmmss，落盘文件名时间戳（filesApi）
 */
export function formatTime(ts = Date.now(), opts = {}) {
  const d = typeof ts === 'number' || typeof ts === 'string' ? new Date(ts) : ts
  if (Number.isNaN(d.getTime())) return ''
  if (opts.mode === 'file') {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  }
  if (opts.mode === 'time') {
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }
  try { return d.toLocaleString('zh-CN', { hour12: false }) } catch { return '' }
}

/** 防抖（返回包装函数 + cancel） */
export function debounce(fn, ms) {
  let timer = null
  const wrapped = (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; fn(...args) }, ms)
  }
  wrapped.cancel = () => { if (timer) { clearTimeout(timer); timer = null } }
  return wrapped
}

/** 节流（返回包装函数 + cancel） */
export function throttle(fn, ms) {
  let last = 0
  let timer = null
  let lastArgs = null
  const wrapped = (...args) => {
    const now = Date.now()
    const remain = ms - (now - last)
    lastArgs = args
    if (remain <= 0) {
      if (timer) { clearTimeout(timer); timer = null }
      last = now
      fn(...args)
    } else if (!timer) {
      timer = setTimeout(() => { timer = null; last = Date.now(); fn(...lastArgs) }, remain)
    }
  }
  wrapped.cancel = () => { if (timer) { clearTimeout(timer); timer = null } }
  return wrapped
}

/**
 * effect 内防抖 hook（封装「依赖变化 → 重建定时器 → cleanup 清除」模式）。
 * 等价于手写 `useEffect(() => { const t = setTimeout(fn, ms); return () => clearTimeout(t) }, deps)`。
 * condition=false 时跳过（不设定时器），等价于手写 effect 里提前 `if (cond) return`。
 */
export function useDebouncedEffect(fn, deps, delay, condition = true) {
  useEffect(() => {
    if (!condition) return undefined
    const timer = setTimeout(fn, delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
