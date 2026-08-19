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
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { logger } from './logger.js'
import { httpRequest } from './httpClient.js'
import { API_BASE } from './config.js'
import { LOCAL_TOOL_PING_TIMEOUT } from './config.js'

const DEFAULT_PORT = 18080
const POLL_CONNECTED_MS = 15000 // 已连接：15s 轮询一次（官方 Wl）
const POLL_DISCONNECTED_MS = 5000 // 未连接：5s 轮询一次（官方 Ul）

/**
 * 单例共享状态：多个组件调用 useLocalToolStatus() 时复用同一份轮询，
 * 避免每个实例各自 setInterval 导致请求翻倍。
 */
let sharedStatus = { isConnected: false, port: DEFAULT_PORT, version: '', message: '' }
const listeners = new Set()
let pollTimer = null
let pollRunning = false
const disableLocalTool = false // 原型无该开关，恒 false

function emit() {
  for (const l of listeners) l()
}

async function runCheck() {
  if (disableLocalTool) {
    if (sharedStatus.isConnected) {
      sharedStatus = { ...sharedStatus, isConnected: false }
      emit()
    }
    return
  }
  try {
    const data = await httpRequest(`${API_BASE}/api/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      timeoutMs: LOCAL_TOOL_PING_TIMEOUT,
      retries: 0,
    })
    logger.info('useLocalToolStatus', '/api/status 响应', data?.status)
    if (data?.status === 'ok') {
      if (
        !sharedStatus.isConnected ||
        sharedStatus.version !== data.version ||
        sharedStatus.message !== data.message
      ) {
        sharedStatus = {
          ...sharedStatus,
          isConnected: true,
          version: data.version || '',
          message: data.message || '',
        }
        emit()
      }
      return
    }
    if (sharedStatus.isConnected) {
      sharedStatus = { ...sharedStatus, isConnected: false }
      emit()
    }
  } catch {
    if (sharedStatus.isConnected) {
      sharedStatus = { ...sharedStatus, isConnected: false }
      emit()
    }
  }
}

function schedulePoll() {
  if (disableLocalTool || pollRunning) return
  pollRunning = true
  const interval = sharedStatus.isConnected ? POLL_CONNECTED_MS : POLL_DISCONNECTED_MS
  logger.info('useLocalToolStatus', '检测间隔', { interval, isConnected: sharedStatus.isConnected })
  runCheck()
  pollTimer = setInterval(runCheck, interval)
}

function restartPoll() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  schedulePoll()
}

export function useLocalToolStatus() {
  const subscribe = useCallback((cb) => {
    listeners.add(cb)
    // 首个订阅者启动轮询
    if (listeners.size === 1) {
      runCheck()
      schedulePoll()
    }
    return () => {
      listeners.delete(cb)
      if (listeners.size === 0 && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
        pollRunning = false
      }
    }
  }, [])

  const getSnapshot = useCallback(() => sharedStatus, [])

  const status = useSyncExternalStore(subscribe, getSnapshot)

  // 连接状态变化时调整轮询频率
  useEffect(() => {
    restartPoll()
  }, [status.isConnected])

  return { status, checkConnection: runCheck }
}
