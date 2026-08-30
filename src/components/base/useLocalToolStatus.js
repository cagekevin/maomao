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
 *     依赖 [isConnected, check, disableLocalTool]。轮询统一经 ensurePoll() 幂等收敛（见该函数注释）：
 *     目标间隔未变则不重建。订阅 / 首次挂载 / 状态变化三处都会调到它，靠幂等避免互相打架。
 *
 * disableLocalTool：官方来自 context `Vl.disableLocalTool || window.__CANVAS_RUNTIME__.disableLocalTool`，
 * 原型无此开关，默认 false（即始终启用连接检测）。
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { logger } from './logger.ts'
import { httpRequest } from './httpClient.ts'
import { API_BASE, LOCAL_TOOL_PORT, LOCAL_TOOL_PING_TIMEOUT } from './config.js'

const DEFAULT_PORT = LOCAL_TOOL_PORT
const POLL_CONNECTED_MS = 15000 // 已连接：15s 轮询一次（官方 Wl）
const POLL_DISCONNECTED_MS = 5000 // 未连接：5s 轮询一次（官方 Ul）

/**
 * 单例共享状态：多个组件调用 useLocalToolStatus() 时复用同一份轮询，
 * 避免每个实例各自 setInterval 导致请求翻倍。
 */
let sharedStatus = { isConnected: false, port: DEFAULT_PORT, version: '', message: '' }
const listeners = new Set()
let pollTimer = null
// 当前生效的轮询间隔（0 = 未启动）。兼作「是否已在跑」的判据，
// 替代原先的 pollRunning 布尔标志（标志需靠别处记得复位，漏复位会让轮询永久停摆，见 ensurePoll 注释）。
let pollIntervalMs = 0
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

/**
 * 确保轮询在跑（幂等，唯一入口）：首个订阅者接入、连接状态变化两处统一收敛到这里。
 *
 * 幂等规则：已在跑且目标间隔未变 → 直接返回（不重建 timer、不重复发请求）；
 *           否则清掉旧 timer，按当前连接状态重建，并立即检测一次。
 *
 * 【为何不用 pollRunning 布尔标志】原实现的 `restartPoll()` 清掉 timer 后没复位 `pollRunning`
 * → 随后的 `schedulePoll()` 被该标志挡回 → interval 被杀后**永不重建**，连接状态一变化，
 * 断线检测就永久失效（界面永远显示「已连接」）。改用「目标间隔值比对」做判据，无需手动复位，
 * 结构性避免了这类漏复位 bug。副作用：顺带消除首次挂载重复 ping（原实现共发 3 次 /api/status）。
 */
function ensurePoll() {
  if (disableLocalTool) return
  const interval = sharedStatus.isConnected ? POLL_CONNECTED_MS : POLL_DISCONNECTED_MS
  if (pollTimer && pollIntervalMs === interval) return
  if (pollTimer) clearInterval(pollTimer)
  pollIntervalMs = interval
  logger.info('useLocalToolStatus', '检测间隔', { interval, isConnected: sharedStatus.isConnected })
  runCheck()
  pollTimer = setInterval(runCheck, interval)
}

export function useLocalToolStatus() {
  const subscribe = useCallback((cb) => {
    listeners.add(cb)
    // 首个订阅者启动轮询（ensurePoll 幂等，内部已含首次 runCheck，此处不再单独 ping）
    if (listeners.size === 1) ensurePoll()
    return () => {
      listeners.delete(cb)
      if (listeners.size === 0 && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
        pollIntervalMs = 0
      }
    }
  }, [])

  const getSnapshot = useCallback(() => sharedStatus, [])

  const status = useSyncExternalStore(subscribe, getSnapshot)

  // 连接状态变化时调整轮询频率（间隔未变则 ensurePoll 幂等跳过，不重复起 timer）
  useEffect(() => {
    ensurePoll()
  }, [status.isConnected])

  return { status, checkConnection: runCheck }
}
