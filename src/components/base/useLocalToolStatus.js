/**
 * localTool 连接状态 hook —— 完整复刻官方 `Gl()`（httpClient-BknZwXjG_components/shared.js L6207-6302，对应 useLocalTool）。
 *
 * 官方逻辑（逐条对齐）：
 *  1. state：{ isConnected:false, port:18080 }（初始未连接）。
 *  2. checkConnection（check）：
 *     - 若 disableLocalTool → 强制 isConnected=false，返回。
 *     - 否则 fetch `${base}/api/status`，若 HTTP ok 且 body.status==='ok' → isConnected=true
 *       （同时记录 version/message；若值未变则不触发多余更新）；
 *       否则 isConnected=false；fetch 抛异常也 isConnected=false。
 *  3. 挂载后立即检测一次（useEffect，依赖 [check, disableLocalTool]）。
 *  4. 定时轮询：setInterval(check, isConnected ? 15000 : 5000) —— 已连接 15s 一次、断开 5s 一次（更快恢复）。
 *     依赖 [isConnected, check, disableLocalTool]。
 *
 * disableLocalTool：官方来自 context `Vl.disableLocalTool || window.__CANVAS_RUNTIME__.disableLocalTool`，
 * 原型无此开关，默认 false（即始终启用连接检测）。
 */
import { useState, useCallback, useEffect } from 'react'
import { API_BASE } from './apiBase.js'

const DEFAULT_PORT = 18080
const POLL_CONNECTED_MS = 15000 // 已连接：15s 轮询一次（官方 Wl）
const POLL_DISCONNECTED_MS = 5000 // 未连接：5s 轮询一次（官方 Ul）

export function useLocalToolStatus() {
  // 官方 disableLocalTool：原型无该开关，恒 false
  const disableLocalTool = false

  const [status, setStatus] = useState({ isConnected: false, port: DEFAULT_PORT, version: '', message: '' })

  const check = useCallback(async () => {
    if (disableLocalTool) {
      setStatus((s) => (s.isConnected ? { ...s, isConnected: false } : s))
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        console.log('[useLocalToolStatus] /api/status 响应:', data?.status)
        if (data?.status === 'ok') {
          setStatus((s) =>
            s.isConnected && s.version === data.version && s.message === data.message
              ? s
              : { ...s, isConnected: true, version: data.version || '', message: data.message || '' }
          )
          return
        }
      }
      setStatus((s) => (s.isConnected ? { ...s, isConnected: false } : s))
    } catch {
      setStatus((s) => (s.isConnected ? { ...s, isConnected: false } : s))
    }
  }, [disableLocalTool])

  // 挂载后立即检测一次（对齐官方 Gl 的 useEffect [r, e]）
  useEffect(() => {
    if (disableLocalTool) {
      setStatus((s) => (s.isConnected ? { ...s, isConnected: false } : s))
      return
    }
    check()
  }, [check, disableLocalTool])

  // 定时轮询（对齐官方 Gl 的 useEffect [t.isConnected, r, e]）
  useEffect(() => {
    if (disableLocalTool) return
    const interval = status.isConnected ? POLL_CONNECTED_MS : POLL_DISCONNECTED_MS
    console.log(`[useLocalToolStatus] 检测间隔 ${interval}ms, isConnected=${status.isConnected}`)
    const id = setInterval(check, interval)
    return () => clearInterval(id)
  }, [status.isConnected, check, disableLocalTool])

  return { status, checkConnection: check }
}
